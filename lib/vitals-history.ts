import { ramPercent, readArmClockMhz, readTempC, readUnderVoltageNow, sampleCpuPercent } from "./vitals-sampler";

// Self-sampling rolling history for the system page's charts, kept in this
// process's memory - not a file like sensor_poller's, since there's no
// GPIO involved and no reason to hand this off to a separate container:
// vcgencmd/sysfs are cheap enough to poll straight from Node. Samples
// independently of any client request (a setInterval below), the same way
// poll.py keeps recording sensor history whether or not anyone's looking,
// so re-opening the system page shows the last 30 minutes rather than
// starting from empty.

const SAMPLE_INTERVAL_MS = 10_000;
// 30 min at 10s/sample - long enough to see a PSU swap's effect (see the
// Aug 22 diagnosis this was built for) without growing unbounded.
const HISTORY_LENGTH = 180;

export type VitalsHistory = {
  time: string[];
  tempC: (number | null)[];
  armClockMhz: (number | null)[];
  cpuPercent: number[];
  ramPercent: number[];
  underVoltageNow: boolean[];
};

const history: VitalsHistory = {
  time: [],
  tempC: [],
  armClockMhz: [],
  cpuPercent: [],
  ramPercent: [],
  underVoltageNow: [],
};

function push<T>(arr: T[], value: T) {
  arr.push(value);
  if (arr.length > HISTORY_LENGTH) arr.shift();
}

async function sampleOnce() {
  const [tempC, armClockMhz, underVoltageNow, cpuPercent] = await Promise.all([
    readTempC(),
    readArmClockMhz(),
    readUnderVoltageNow(),
    sampleCpuPercent(),
  ]);

  push(history.time, new Date().toISOString());
  push(history.tempC, tempC);
  push(history.armClockMhz, armClockMhz);
  push(history.cpuPercent, cpuPercent);
  push(history.ramPercent, ramPercent());
  push(history.underVoltageNow, underVoltageNow ?? false);
}

// `next dev`'s HMR re-evaluates this module on every edit elsewhere in the
// app; a plain module-level flag would get reset along with it and stack up
// duplicate intervals. globalThis survives module reloads, so it's the only
// guard that actually keeps this a singleton in dev. In production there's
// exactly one evaluation of this module anyway (see Dockerfile's `node
// server.js` - a single long-lived process, no clustering), so the guard
// is a no-op there.
const g = globalThis as unknown as { __vitalsHistoryTimer?: ReturnType<typeof setInterval> };
if (!g.__vitalsHistoryTimer) {
  sampleOnce();
  g.__vitalsHistoryTimer = setInterval(sampleOnce, SAMPLE_INTERVAL_MS);
}

export function getVitalsHistory(): VitalsHistory {
  return history;
}
