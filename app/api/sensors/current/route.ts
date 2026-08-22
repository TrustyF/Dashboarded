import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import { fakeSensorHistory } from "@/lib/fake-sensor-data";

const DATA_PATH = process.env.SENSOR_DATA_PATH ?? "/data/sensor/latest.json";

export async function GET() {
  try {
    const raw = await readFile(DATA_PATH, "utf-8");
    const history = JSON.parse(raw) as { temp: (number | null)[]; humidity: (number | null)[] };
    const last = history.temp.length - 1;
    return NextResponse.json({
      temp: last >= 0 ? history.temp[last] : null,
      humidity: last >= 0 ? history.humidity[last] : null,
    });
  } catch {
    if (process.env.NODE_ENV === "production") return NextResponse.json({ temp: null, humidity: null });
    const fake = fakeSensorHistory();
    const last = fake.temp.length - 1;
    return NextResponse.json({ temp: fake.temp[last], humidity: fake.humidity[last] });
  }
}
