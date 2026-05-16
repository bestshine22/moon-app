import { NextResponse } from "next/server";

import { parseJplHorizons } from "@/app/lib/parseJpl";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const lat = searchParams.get("lat");
    const lng = searchParams.get("lng");
    const datetime = searchParams.get("datetime");

    if (!lat || !lng || !datetime) {
      return NextResponse.json({
        error: "Missing parameters",
      });
    }

    const date = new Date(datetime);

    const stopDate = new Date(
      date.getTime() + 60000
    );

    function formatUTC(d: Date) {
      const yyyy = d.getUTCFullYear();

      const mm = String(
        d.getUTCMonth() + 1
      ).padStart(2, "0");

      const dd = String(
        d.getUTCDate()
      ).padStart(2, "0");

      const hh = String(
        d.getUTCHours()
      ).padStart(2, "0");

      const mi = String(
        d.getUTCMinutes()
      ).padStart(2, "0");

      return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
    }

    const start = formatUTC(date);

    const stop = formatUTC(stopDate);

    const url =
      "https://ssd.jpl.nasa.gov/api/horizons.api" +
      "?format=json" +
      "&COMMAND='301'" +
      "&EPHEM_TYPE=OBSERVER" +
      "&CENTER='coord@399'" +
      "&COORD_TYPE=GEODETIC" +
      `&SITE_COORD='${lng},${lat},0'` +
      `&START_TIME='${start}'` +
      `&STOP_TIME='${stop}'` +
      "&STEP_SIZE='1 m'" +
      "&QUANTITIES='4'";

    const response = await fetch(url);

    const data = await response.json();

    const rawText = data?.result || "";

    const parsed =
      parseJplHorizons(rawText);

    return NextResponse.json({
      success: true,
      source: "NASA JPL Horizons",
      parsed,
    });
  } catch (err: any) {
    return NextResponse.json({
      error: err.message,
    });
  }
}