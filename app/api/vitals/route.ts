import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

// Ported from dashboard_server/flask_blueprints/vitals_bp.py. No Python
// needed at all here - reading a sysfs file and shelling out to vcgencmd
// are both plain Node. Requires /sys/class/thermal mounted read-only and
// vcgencmd + /dev/vchiq available in the container (see docker-compose.yml).

const execFileAsync = promisify(execFile);

export async function GET() {
  const out = { temp: 0, power: 0, cpu: 0, ram: 0 };

  try {
    const raw = await readFile("/sys/class/thermal/thermal_zone0/temp", "utf-8");
    out.temp = Math.round(Number(raw) / 1000);
  } catch {
    // sysfs path not present (e.g. running off-Pi in dev) - leave default
  }

  try {
    const { stdout } = await execFileAsync("vcgencmd", ["measure_volts", "core"]);
    const power = parseFloat(stdout.replace("volt=", "").replace("V\n", ""));
    out.power = Math.round(power * 10) / 10;
  } catch {
    // vcgencmd not available - leave default
  }

  const os = await import("node:os");
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  out.ram = Math.round(((totalMem - freeMem) / totalMem) * 100);
  // Note: original Python used psutil.cpu_percent(interval=5), a 5s blocking
  // sample - not worth blocking a request for on every poll. If you want a
  // live CPU% number, sample it on an interval in a small background loop
  // (same pattern as sensor_poller) and read the last value here instead.

  return NextResponse.json(out);
}
