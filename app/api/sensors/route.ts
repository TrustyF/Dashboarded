import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";

// Ported from dashboard_server/flask_blueprints/sensors_bp.py, but the actual
// DHT22 GPIO read now happens in the standalone sensor_poller/poll.py process
// (see repo root) rather than in-process here - Node can't talk to the DHT22
// directly, and there's no reason for the frequently-redeployed web app
// container to also need GPIO device access.
//
// poll.py keeps its own rolling history and writes it to SENSOR_DATA_PATH on
// an interval; this route just reads that file back out.

const DATA_PATH = process.env.SENSOR_DATA_PATH ?? "/data/sensor/latest.json";

type SensorHistory = {
  temp: (number | null)[];
  humidity: (number | null)[];
  time: string[];
};

async function readHistory(): Promise<SensorHistory> {
  try {
    return JSON.parse(await readFile(DATA_PATH, "utf-8"));
  } catch {
    return { temp: [], humidity: [], time: [] };
  }
}

export async function GET() {
  const history = await readHistory();
  return NextResponse.json(history);
}
