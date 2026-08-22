import { NextResponse } from "next/server";
import os from "node:os";
import { diskUsedPercent, formatUptime, primaryIp } from "@/lib/vitals-sampler";

// Ported from dashboard_server/flask_blueprints/vitals_bp.py, then extended
// with uptime/IP/disk (the original only ever exposed temp/power/cpu/ram via
// vitals_container.vue, which was never wired to a page or nav link).
//
// temp/armClock/cpu/ram/under-voltage now live in the history sampler
// (lib/vitals-history.ts) instead of being read here too - the system page
// gets those from /api/vitals/history's latest sample, so this route only
// covers the point-in-time system facts that aren't part of that series.

export async function GET() {
  return NextResponse.json({
    uptimeSeconds: Math.round(os.uptime()),
    uptime: formatUptime(os.uptime()),
    ip: primaryIp(),
    diskUsedPercent: await diskUsedPercent(),
  });
}
