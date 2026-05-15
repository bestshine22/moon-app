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

function odehValue(arcv: number, width: number) {
  return arcv - (7.1651 - 6.3226 * width + 0.7319 * width ** 2 - 0.1018 * width ** 3);
}

function odehResult(v: number) {
  if (v >= 5.65) {
    return {
      text: "مرئي بالعين المجردة بسهولة حسب معيار عودة",
      level: "good",
      symbol: "✅",
    };
  }

  if (v >= 2.0) {
    return {
      text: "مرئي بالعين المجردة بصعوبة حسب معيار عودة",
      level: "medium",
      symbol: "⚠️",
    };
  }

  if (v >= -0.96) {
    return {
      text: "قد يحتاج منظارًا حسب معيار عودة",
      level: "optical",
      symbol: "🔭",
    };
  }

  return {
    text: "غير مرئي حسب معيار عودة",
    level: "bad",
    symbol: "❌",
  };
}

function moonData(
  date: Date,
  observer: Astronomy.Observer,
  newMoon: Date,
  lag: number
) {
  const time = new Astronomy.AstroTime(date);

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

  const sunEq = Astronomy.Equator(
    Astronomy.Body.Sun,
    time,
    observer,
    true,
    true
  );

  const sunHor = Astronomy.Horizon(
    time,
    observer,
    sunEq.ra,
    sunEq.dec,
    "normal"
  );

  const elongation = Astronomy.AngleFromSun(Astronomy.Body.Moon, time);
  const illumination = Astronomy.Illumination(Astronomy.Body.Moon, time);

  const ageHours = (date.getTime() - newMoon.getTime()) / 3600000;
  const illumPercent = illumination.phase_fraction * 100;

  const arcv = moonHor.altitude - sunHor.altitude;
  const width = crescentWidthArcMin(elongation);
  const odeh = odehValue(arcv, width);
  const odehStatus = odehResult(odeh);

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
    odehValue: fmt(odeh),
    odehText: odehStatus.text,
    odehSymbol: odehStatus.symbol,
    visibility: odehStatus.text,
    visibilityLevel: odehStatus.level,
    numeric: {
      altitude: moonHor.altitude,
      elongation,
      illumination: illumPercent,
      ageHours,
      arcv,
      width,
      odeh,
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
      Astronomy.Body.Sun,
      observer,
      -1,
      new Astronomy.AstroTime(dayStart),
      2
    );

    if (!sunsetTime) continue;

    const sunset = sunsetTime.date;

    const moonsetTime = Astronomy.SearchRiseSet(
      Astronomy.Body.Moon,
      observer,
      -1,
      new Astronomy.AstroTime(sunset),
      1
    );

    if (!moonsetTime) continue;

    const moonset = moonsetTime.date;
    const lag = (moonset.getTime() - sunset.getTime()) / 60000;

    if (lag <= 20) continue;

    for (let minute = 18; minute <= Math.min(75, lag - 3); minute += 2) {
      const t = new Date(sunset.getTime() + minute * 60000);
      const info = moonData(t, observer, newMoon, lag);

      const altitude = info.numeric.altitude;
      const elongation = info.numeric.elongation;
      const illum = info.numeric.illumination;
      const age = info.numeric.ageHours;
      const arcv = info.numeric.arcv;
      const width = info.numeric.width;
      const odeh = info.numeric.odeh;

      if (age < 15) continue;
      if (age > 40) continue;
      if (altitude < 5) continue;
      if (elongation < 9) continue;
      if (illum > 4.5) continue;
      if (arcv < 6) continue;
      if (width < 0.2) continue;

      const idealMinute = Math.min(45, Math.max(22, lag * 0.45));
      const timingPenalty = Math.abs(minute - idealMinute) * 0.6;

      const score =
        odeh * 12 +
        altitude * 1.8 +
        elongation * 1.4 +
        arcv * 1.2 +
        width * 20 +
        lag * 0.12 -
        illum * 0.25 -
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