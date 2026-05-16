import { NextResponse } from "next/server";
import * as Astronomy from "astronomy-engine";

function fmt(n: number) {
  return Number.isFinite(n) ? n.toFixed(2) : "-";
}

function floorToMinute(date: Date) {
  const d = new Date(date);
  d.setSeconds(0);
  d.setMilliseconds(0);
  return d;
}

function ageText(hours: number) {
  const totalSeconds = Math.round(hours * 3600);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h} ساعة ${m} دقيقة ${s} ثانية`;
}

function previousNewMoon(now: Date) {
  let start = new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000);

  for (let i = 0; i < 3; i++) {
    const nm = Astronomy.SearchMoonPhase(
      0,
      new Astronomy.AstroTime(start),
      40
    ).date;

    if (nm <= now) return nm;

    start = new Date(start.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  return Astronomy.SearchMoonPhase(
    0,
    new Astronomy.AstroTime(new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)),
    80
  ).date;
}

function nextNewMoon(now: Date) {
  return Astronomy.SearchMoonPhase(
    0,
    new Astronomy.AstroTime(now),
    40
  ).date;
}

function moonCalc(
  date: Date,
  observer: Astronomy.Observer,
  newMoon: Date
) {
  const cleanDate = floorToMinute(date);
  const time = new Astronomy.AstroTime(cleanDate);

  const moonEq = Astronomy.Equator(
    Astronomy.Body.Moon,
    time,
    observer,
    true,
    true
  );

  const moonHor = Astronomy.Horizon(
    time,
    observer,
    moonEq.ra,
    moonEq.dec,
    "normal"
  );

  const elongation = Astronomy.AngleFromSun(
    Astronomy.Body.Moon,
    time
  );

  const illumination = Astronomy.Illumination(
    Astronomy.Body.Moon,
    time
  );

  const ageHours =
    (cleanDate.getTime() - newMoon.getTime()) / 3600000;

  return {
    iso: cleanDate.toISOString(),
    azimuth: fmt(moonHor.azimuth),
    altitude: fmt(moonHor.altitude),
    ageText: ageText(ageHours),
    ageHours: fmt(ageHours),
    elongation: fmt(elongation),
    illumination: fmt(illumination.phase_fraction * 100),
    numeric: {
      altitude: moonHor.altitude,
      azimuth: moonHor.azimuth,
      ageHours,
      elongation,
      illumination: illumination.phase_fraction * 100,
    },
  };
}

function findHilal(observer: Astronomy.Observer) {
  const now = new Date();
  const newMoon = nextNewMoon(now);

  for (let day = 0; day <= 3; day++) {
    const d = new Date(newMoon);
    d.setDate(d.getDate() + day);

    const dayStart = new Date(
      d.getFullYear(),
      d.getMonth(),
      d.getDate(),
      0,
      0,
      0
    );

    const sunsetEvent = Astronomy.SearchRiseSet(
      Astronomy.Body.Sun,
      observer,
      -1,
      new Astronomy.AstroTime(dayStart),
      2
    );

    if (!sunsetEvent) continue;

    const sunset = floorToMinute(sunsetEvent.date);

    const moonsetEvent = Astronomy.SearchRiseSet(
      Astronomy.Body.Moon,
      observer,
      -1,
      new Astronomy.AstroTime(sunset),
      1
    );

    if (!moonsetEvent) continue;

    const moonset = floorToMinute(moonsetEvent.date);

    const lag =
      (moonset.getTime() - sunset.getTime()) / 60000;

    if (lag <= 0) continue;

    let visualBest: any = null;

    for (let minute = 5; minute <= Math.min(25, lag - 3); minute++) {
      const t = floorToMinute(
        new Date(sunset.getTime() + minute * 60000)
      );

      const info = moonCalc(t, observer, newMoon);

      const score =
        info.numeric.altitude * 3 +
        info.numeric.elongation * 1.5 +
        info.numeric.illumination * 0.4 -
        Math.abs(minute - 12) * 0.7;

      if (!visualBest || score > visualBest.score) {
        visualBest = {
          score,
          data: info,
        };
      }
    }

    return {
      newMoonIso: newMoon.toISOString(),
      sunsetIso: sunset.toISOString(),
      moonsetIso: moonset.toISOString(),
      lag: lag.toFixed(1),
      visualBest: visualBest?.data ?? moonCalc(sunset, observer, newMoon),
    };
  }

  return null;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const lat = Number(searchParams.get("lat"));
    const lng = Number(searchParams.get("lng"));
    const height = Number(searchParams.get("height") ?? "0");
    const observeTime = searchParams.get("observeTime");

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json(
        { error: "الإحداثيات غير صحيحة" },
        { status: 400 }
      );
    }

    const observer = new Astronomy.Observer(
      lat,
      lng,
      Number.isFinite(height) ? height : 0
    );

    const now = floorToMinute(new Date());

    const currentMoonAgeBase = previousNewMoon(now);
    const nowData = moonCalc(now, observer, currentMoonAgeBase);

    const hilal = findHilal(observer);

    if (!hilal) {
      return NextResponse.json({
        error: "لم يتم العثور على هلال مناسب.",
      });
    }

    let custom = null;

    if (observeTime) {
      const customDate = floorToMinute(new Date(observeTime));

      const customData: any = moonCalc(
        customDate,
        observer,
        new Date(hilal.newMoonIso)
      );

      const remainingMinutes =
        (new Date(hilal.moonsetIso).getTime() -
          customDate.getTime()) /
        60000;

      custom = {
        ...customData,
        remainingMoonset:
          remainingMinutes > 0
            ? remainingMinutes.toFixed(1)
            : "0.0",
      };
    }

    return NextResponse.json({
      observer: { lat, lng, height },
      nowData,
      hilal,
      custom,
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        error: "خطأ في الحساب",
        details: String(err?.message || err),
      },
      { status: 500 }
    );
  }
}