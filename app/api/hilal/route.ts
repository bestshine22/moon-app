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

function visibilityStatus(alt: number, elong: number, illum: number, lag: number) {
  if (alt >= 10 && elong >= 12 && illum <= 3.5 && lag >= 30) {
    return { text: "مرئي بإذن الله", level: "good" };
  }

  if (alt >= 6 && elong >= 9 && lag >= 20) {
    return { text: "ممكن بصعوبة", level: "medium" };
  }

  return { text: "غير مناسب للرؤية", level: "bad" };
}

function moonData(date: Date, observer: Astronomy.Observer, newMoon: Date, lag: number) {
  const time = new Astronomy.AstroTime(date);

  const moonEq = Astronomy.Equator("Moon", time, observer, true, true);
  const moonHor = Astronomy.Horizon(time, observer, moonEq.ra, moonEq.dec, "normal");

  const elongation = Astronomy.AngleFromSun("Moon", time);
  const illumination = Astronomy.Illumination("Moon", time);

  const ageHours = (date.getTime() - newMoon.getTime()) / 3600000;
  const illumPercent = illumination.phase_fraction * 100;

  const status = visibilityStatus(
    moonHor.altitude,
    elongation,
    illumPercent,
    lag
  );

  return {
    iso: date.toISOString(),
    azimuth: fmt(moonHor.azimuth),
    altitude: fmt(moonHor.altitude),
    ageHours: fmt(ageHours),
    ageText: ageText(ageHours),
    elongation: fmt(elongation),
    illumination: fmt(illumPercent),
    visibility: status.text,
    visibilityLevel: status.level,
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

  for (let day = 0; day <= 2; day++) {
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

    if (lag <= 0) continue;

    for (let minute = 5; minute <= Math.min(90, lag - 2); minute += 2) {
      const t = new Date(sunset.getTime() + minute * 60000);
      const info = moonData(t, observer, newMoon, lag);

      const altitude = Number(info.altitude);
      const elongation = Number(info.elongation);
      const illum = Number(info.illumination);
      const age = Number(info.ageHours);

      if (age < 12) continue;
      if (age > 40) continue;
      if (illum > 3.5) continue;
      if (altitude < 3) continue;
      if (elongation < 7) continue;

      const score =
        altitude * 3 +
        elongation * 2 +
        lag * 0.25 -
        illum * 0.5;

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
        error: "تعذر العثور على هلال جديد مناسب للرصد من هذا الموقع خلال الأيام القادمة.",
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