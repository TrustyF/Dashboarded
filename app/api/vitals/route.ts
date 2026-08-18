import { NextResponse } from "next/server";
import { readFile, statfs } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import os from "node:os";

// Ported from dashboard_server/flask_blueprints/vitals_bp.py, then extended
// with uptime/IP/disk (the original only ever exposed temp/power/cpu/ram via
// vitals_container.vue, which was never wired to a page or nav link).

const execFileAsync = promisify(execFile);

// Non-blocking CPU% sample: original Python used psutil.cpu_percent(interval=5),
// a 5s blocking sample - not worth blocking a request for. Sampling os.cpus()
// twice over a short window gives a good-enough estimate without the wait.
async function sampleCpuPercent(sampleMs = 150): Promise<number> {
  const start = os.cpus();
  await new Promise((resolve) => setTimeout(resolve, sampleMs));
  const end = os.cpus();

  let idleDelta = 0;
  let totalDelta = 0;
  for (let i = 0; i < start.length; i++) {
    const s = start[i].times;
    const e = end[i].times;
    const sIdle = s.idle;
    const eIdle = e.idle;
    const sTotal = s.user + s.nice + s.sys + s.idle + s.irq;
    const eTotal = e.user + e.nice + e.sys + e.idle + e.irq;
    idleDelta += eIdle - sIdle;
    totalDelta += eTotal - sTotal;
  }

  if (totalDelta <= 0) return 0;
  return Math.round((1 - idleDelta / totalDelta) * 100);
}

function primaryIp(): string | null {
  const interfaces = os.networkInterfaces();
  for (const entries of Object.values(interfaces)) {
    for (const entry of entries ?? []) {
      if (entry.family === "IPv4" && !entry.internal) return entry.address;
    }
  }
  return null;
}

async function diskUsedPercent(): Promise<number | null> {
  try {
    const stats = await statfs("/");
    const used = stats.blocks - stats.bfree;
    return Math.round((used / stats.blocks) * 100);
  } catch {
    return null;
  }
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export async function GET() {
  const out = {
    temp: 0,
    power: 0,
    cpu: 0,
    ram: 0,
    uptimeSeconds: Math.round(os.uptime()),
    uptime: formatUptime(os.uptime()),
    ip: primaryIp(),
    diskUsedPercent: null as number | null,
  };

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

  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  out.ram = Math.round(((totalMem - freeMem) / totalMem) * 100);
  out.cpu = await sampleCpuPercent();
  out.diskUsedPercent = await diskUsedPercent();

  return NextResponse.json(out);
}
