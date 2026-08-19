"""
Standalone DHT22 poller.

Replaces the in-process sensor reading that used to live inside the Flask
sensors_bp.py route handler. This is the *only* piece of the app that still
needs to be Python + GPIO access - everything else moved to Next.js.

Runs as its own tiny container (see docker-compose.yml), writes the latest
reading plus a rolling history to a JSON file on a shared volume. The
Next.js /api/sensors and /api/sensors/current routes just read that file.

No web framework, no Flask, no HTTP server - just a loop and a file write.
"""

import json
import logging
import os
import random
import time
from collections import deque
from datetime import datetime
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("sensor_poller")

DATA_PATH = Path(os.environ.get("SENSOR_DATA_PATH", "/data/sensor/latest.json"))
POLL_INTERVAL_SECONDS = float(os.environ.get("SENSOR_POLL_INTERVAL", "10"))
HISTORY_LENGTH = int(os.environ.get("SENSOR_HISTORY_LENGTH", "100"))
MAX_RETRY = 5

dht_device = None
try:
    import board
    import adafruit_dht

    dht_device = adafruit_dht.DHT22(board.D4, use_pulseio=False)
    logger.info("adafruit_dht loaded, reading from GPIO4")
except Exception as e:
    # Logging the actual exception (not just a generic message) matters here -
    # "not available" could mean board.py failed to detect the Pi model, a
    # missing native dependency, no GPIO device access in the container, or
    # genuinely no sensor wired up. Those need different fixes.
    logger.warning("adafruit_dht not available (%s: %s) - falling back to simulated readings",
                    type(e).__name__, e)


def read_sensor():
    if dht_device is None:
        return random.randint(0, 50), random.randint(20, 80)

    for attempt in range(MAX_RETRY):
        try:
            temperature_c = round(dht_device.temperature, 1)
            humidity = round(dht_device.humidity, 1)
            return temperature_c, humidity
        except RuntimeError as error:
            # DHT22s are noisy; this happens often under normal operation.
            logger.info("read retry %s/%s: %s", attempt + 1, MAX_RETRY, error.args[0] if error.args else error)
        except Exception:
            logger.exception("unrecoverable sensor error, reinitializing device")
            try:
                dht_device.exit()
            except Exception:
                pass
            break

    return None, None


def main():
    DATA_PATH.parent.mkdir(parents=True, exist_ok=True)

    temp_history = deque(maxlen=HISTORY_LENGTH)
    humidity_history = deque(maxlen=HISTORY_LENGTH)
    time_history = deque(maxlen=HISTORY_LENGTH)

    logger.info("starting poll loop, writing to %s every %ss", DATA_PATH, POLL_INTERVAL_SECONDS)

    while True:
        t, h = read_sensor()
        now = datetime.now().isoformat()

        temp_history.append(t)
        humidity_history.append(h)
        time_history.append(now)

        payload = {
            "temp": list(temp_history),
            "humidity": list(humidity_history),
            "time": list(time_history),
        }

        tmp_path = DATA_PATH.with_suffix(".tmp")
        tmp_path.write_text(json.dumps(payload))
        tmp_path.replace(DATA_PATH)  # atomic swap, avoids readers seeing a half-written file

        time.sleep(POLL_INTERVAL_SECONDS)


if __name__ == "__main__":
    main()
