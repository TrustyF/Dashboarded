import { readdir, readFile, statfs } from "node:fs/promises";
import os from "node:os";

// Low-level device reads, shared between the live snapshot
// (app/api/vitals/route.ts) and the background history sampler
// (lib/vitals-history.ts) so there's one place that knows how to talk to
// sysfs.
//
// Deliberately sysfs-only, not vcgencmd: vcgencmd isn't installed in the app
// container (it's a Raspberry-Pi-specific package, not in vanilla Debian
// bookworm's repos - see Dockerfile) and getting it working would mean
// adding Raspberry Pi's apt source plus confirming /dev/vchiq device access,
// for a redeploy cycle to validate. Clock and the under-voltage flag are
// both available straight from the kernel without it; the exact core
// voltage number (e.g. "0.88V") isn't, and was judged not worth that extra
// infra for.

export async function readTempC(): Promise<number | null> {
  try {
    const raw = await readFile("/sys/class/thermal/thermal_zone0/temp", "utf-8");
    return Math.round(Number(raw) / 1000);
  } catch {
    return null;
  }
}

export async function readArmClockMhz(): Promise<number | null> {
  try {
    const raw = await readFile("/sys/devices/system/cpu/cpu0/cpufreq/scaling_cur_freq", "utf-8");
    const khz = Number(raw);
    return Number.isFinite(khz) ? Math.round(khz / 1000) : null;
  } catch {
    return null;
  }
}

// The Pi firmware's hwmon driver (the same one that logs dmesg's
// "Undervoltage detected!"/"Voltage normalised" lines) exposes its alarm as
// a plain sysfs boolean under whichever hwmonN index it lands on - found by
// name rather than hardcoding "hwmon1", since that index isn't guaranteed
// stable across kernel/boot changes.
async function findRpiVoltHwmon(): Promise<string | null> {
  try {
    const entries = await readdir("/sys/class/hwmon");
    for (const entry of entries) {
      const path = `/sys/class/hwmon/${entry}`;
      try {
        const name = (await readFile(`${path}/name`, "utf-8")).trim();
        if (name === "rpi_volt") return path;
      } catch {
        // this hwmon entry has no readable name - skip it
      }
    }
  } catch {
    // /sys/class/hwmon not present (e.g. running off-Pi in dev)
  }
  return null;
}

let rpiVoltHwmonPath: Promise<string | null> | null = null;

export async function readUnderVoltageNow(): Promise<boolean | null> {
  rpiVoltHwmonPath ??= findRpiVoltHwmon();
  const path = await rpiVoltHwmonPath;
  if (!path) return null;
  try {
    const raw = await readFile(`${path}/in0_lcrit_alarm`, "utf-8");
    return raw.trim() === "1";
  } catch {
    return null;
  }
}

// Non-blocking CPU% sample: sampling os.cpus() twice over a short window
// gives a good-enough estimate without blocking a request/tick on it.
export async function sampleCpuPercent(sampleMs = 150): Promise<number> {
  const start = os.cpus();
  await new Promise((resolve) => setTimeout(resolve, sampleMs));
  const end = os.cpus();

  let idleDelta = 0;
  let totalDelta = 0;
  for (let i = 0; i < start.length; i++) {
    const s = start[i].times;
    const e = end[i].times;
    const sTotal = s.user + s.nice + s.sys + s.idle + s.irq;
    const eTotal = e.user + e.nice + e.sys + e.idle + e.irq;
    idleDelta += e.idle - s.idle;
    totalDelta += eTotal - sTotal;
  }

  if (totalDelta <= 0) return 0;
  return Math.round((1 - idleDelta / totalDelta) * 100);
}

export function ramPercent(): number {
  const total = os.totalmem();
  const free = os.freemem();
  return Math.round(((total - free) / total) * 100);
}

export function primaryIp(): string | null {
  const interfaces = os.networkInterfaces();
  for (const entries of Object.values(interfaces)) {
    for (const entry of entries ?? []) {
      if (entry.family === "IPv4" && !entry.internal) return entry.address;
    }
  }
  return null;
}

export async function diskUsedPercent(): Promise<number | null> {
  try {
    const stats = await statfs("/");
    const used = stats.blocks - stats.bfree;
    return Math.round((used / stats.blocks) * 100);
  } catch {
    return null;
  }
}

export function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}
