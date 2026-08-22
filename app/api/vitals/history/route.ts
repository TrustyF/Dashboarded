import { NextResponse } from "next/server";
import { getVitalsHistory } from "@/lib/vitals-history";

export async function GET() {
  return NextResponse.json(getVitalsHistory());
}
