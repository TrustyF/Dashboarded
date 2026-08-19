import { NextRequest, NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

// Ported from dashboard_server/flask_blueprints/settings_bp.py's ToggleBrightness.
// State is kept in-memory per process, same as the original module-level
// instance - fine for a single always-on container.

const execFileAsync = promisify(execFile);
const BRIGHTNESS_STEPS = [5, 30, 50, 100];
let index = 1; // starts at brightness_array[1] === 30 in the original... actually
// original called set_brightness(100) in __init__ regardless of index; mirror that:
let currentBrightness = 100;

async function setBrightness(pct: number) {
  await execFileAsync("brightnessctl", ["set", `${pct}%`]);
  currentBrightness = pct;
}

export async function GET(req: NextRequest) {
  const action = req.nextUrl.searchParams.get("toggle");

  if (action === "toggle") {
    const nextIndex = (index + 1) % BRIGHTNESS_STEPS.length;
    try {
      // brightnessctl isn't available off-Pi in dev, and may fail on-Pi if
      // the container can't write /sys/class/backlight - fail gracefully
      // (leave currentBrightness/index unchanged) rather than 500ing, same
      // as /api/vitals does for its own Pi-only reads.
      await setBrightness(BRIGHTNESS_STEPS[nextIndex]);
      index = nextIndex;
    } catch (err) {
      return NextResponse.json({ error: "brightnessctl unavailable", detail: String(err) }, { status: 503 });
    }
    return NextResponse.json("ok");
  }

  if (action === "state") {
    return NextResponse.json({ ok: index, brightness: currentBrightness });
  }

  return NextResponse.json({ error: "Invalid toggle value" }, { status: 400 });
}
