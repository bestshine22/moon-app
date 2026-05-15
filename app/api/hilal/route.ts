import { NextResponse } from "next/server";
import * as Astronomy from "astronomy-engine";

function fmt(n: number) {
  return Number.isFinite(n) ? n.toFixed(2) : "-";
}

function ageText(hours: number) {
  const totalSeconds = Math.max(0, Math.round(hours * 3600));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h} ساعة ${m} دقيقة ${s} ثانية`;
}

function crescentWidthArcMin(elongDeg: number) {
  const moonSemiDiameterArcMin = 16.0;
  const e = (elongDeg * Math.PI) / 180;
  return moonSemiDiameterArcMin * (1 - Math.cos(e));
}

function visibilityStatus(
  altitude: number,
  elongation: number,
  illumination: number,
  lag: number,
  ageHours: number,
  arcv: number,
  width: number
) {
  if (
    altitude >= 10 &&
    elongation >= 12 &&
    illumination >= 0.8 &&
    illumination <= 3.5 &&
    lag >= 35 &&
    ageHours >= 18 &&
    ageHours <= 36 &&
    arcv >= 10 &&
    width >= 0.35
  ) {
    return {
      text: "مناسب للرؤية بالعين المجردة",
      level: "good",
    };
  }

  if (
    altitude >= 7 &&
    elongation >= 10 &&
    illumination <= 4.5 &&
    lag >= 25 &&
    ageHours >= 15 &&
    arcv >= 7 &&
    width >= 0.25
  ) {
    return {
      text: "ممكن بصعوبة بالعين المجردة",
      level: "medium",
    };
  }

  return {
    text: "غير مناسب للعين المجردة",
    level: "bad",
  };
}

function moonData(
  date: Date,
  observer: Astronomy.Observer,
  newMoon: Date,
  lag: number
) {
  const time = new Astronomy.AstroTime(date);

  const moonEq = Astronomy.Equator("Moon", time, observer, true, true);
  const moonHor = Astronomy.Horizon(time, observer, moonEq.ra, moonEq.dec, "normal");

  const sunEq = Astronomy.Equator("Sun", time, observer, true, true);
  const sunHor = Astronomy.Horizon(time, observer, sunEq.ra, sunEq.dec, "normal");

  const elongation = Astronomy.AngleFromSun("Moon", time);
  const illumination = Astronomy.Illumination("Moon", time);

  const ageHours = (date.getTime() - newMoon.getTime()) / 3600000;
  const illumPercent = illumination.phase_fraction * 100;
  const arcv = moonHor.altitude - sunHor.altitude;
  const width = crescentWidthArcMin(elongation);

  const status = visibilityStatus(
    moonHor.altitude,
    elongation,
    illumPercent,
    lag,
    ageHours,
    arcv,
    width
  );

  return {
    iso: date.toISOString(),
    azimuth: fmt(moonHor.azimuth),
    altitude: fmt(moonHor.altitude),
    ageHours: fmt(ageHours),
    ageText: ageText(ageHours),
    elongation: fmt(elongation),
    illumination: fmt(illumPercent),
    arcv: fmt(arcv),
    width: fmt(width),
    visibility: status.text,
    visibilityLevel: status.level,
    numeric: {
      altitude: moonHor.altitude,
      elongation,
      illumination: illumPercent,
      ageHours,
      arcv,
      width,
    },
  };
}

function findBest(observer: Astronomy.Observer) {
  const now = new Date();

  const newMoonTime = Astronomy.SearchMoonPhase(
    0,
    new Astronomy.AstroTime(now),
    40
  );

  const newMoon = newMoonTime.date;
  let best: any = null;

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

    const sunsetTime = Astronomy.SearchRiseSet(
      "Sun",
      observer,
      -1,
      new Astronomy.AstroTime(dayStart),
      2
    );

    if (!sunsetTime) continue;

    const sunset = sunsetTime.date;

    const moonsetTime = Astronomy.SearchRiseSet(
      "Moon",
      observer,
      -1,
      new Astronomy.AstroTime(sunset),
      1
    );

    if (!moonsetTime) continue;

    const moonset = moonsetTime.date;
    const lag = (moonset.getTime() - sunset.getTime()) / 60000;

    if (lag <= 20) continue;

    for (let minute = 8; minute <= Math.min(75, lag - 3); minute += 2) {
      const t = new Date(sunset.getTime() + minute * 60000);

      const info = moonData(t, observer, newMoon, lag);

      const altitude = info.numeric.altitude;
      const elongation = info.numeric.elongation;
      const illum = info.numeric.illumination;
      const age = info.numeric.ageHours;
      const arcv = info.numeric.arcv;
      const width = info.numeric.width;

      if (age < 15) continue;
      if (age > 40) continue;
      if (altitude < 5) continue;
      if (elongation < 9) continue;
      if (illum > 4.5) continue;
      if (arcv < 6) continue;
      if (width < 0.2) continue;

      const idealMinute = Math.min(45, Math.max(18, lag * 0.45));
      const timingPenalty = Math.abs(minute - idealMinute) * 0.5;

      const score =
        altitude * 3.0 +
        elongation * 2.2 +
        arcv * 2.0 +
        width * 25 +
        lag * 0.18 -
        illum * 0.35 -
        timingPenalty;

      if (!best || score > best.score) {
        best = {
          score,
          newMoonIso: newMoon.toISOString(),
          sunsetIso: sunset.toISOString(),
          moonsetIso: moonset.toISOString(),
          lag: lag.toFixed(1),
          best: info,
        };
      }
    }
  }

  return best;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const lat = Number(searchParams.get("lat"));
    const lng = Number(searchParams.get("lng"));
    const observeTime = searchParams.get("observeTime");

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json(
        { error: "الإحداثيات غير صحيحة" },
        { status: 400 }
      );
    }

    const observer = new Astronomy.Observer(lat, lng, 0);
    const best = findBest(observer);

    if (!best) {
      return NextResponse.json({
        error:
          "لم يتم العثور على وقت مناسب للرؤية بالعين المجردة من هذا الموقع خلال الأيام القادمة.",
      });
    }

    let custom = null;

    if (observeTime) {
      custom = moonData(
        new Date(observeTime),
        observer,
        new Date(best.newMoonIso),
        Number(best.lag)
      );
    }

    return NextResponse.json({
      observer: { lat, lng },
      best,
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