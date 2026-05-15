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
  const totalSeconds = Math.max(0, Math.round(hours * 3600));

  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;

  return `${h} ساعة ${m} دقيقة ${s} ثانية`;
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
    (cleanDate.getTime() - newMoon.getTime()) /
    3600000;

  return {
    iso: cleanDate.toISOString(),

    azimuth: fmt(moonHor.azimuth),

    altitude: fmt(moonHor.altitude),

    ageText: ageText(ageHours),

    ageHours: fmt(ageHours),

    elongation: fmt(elongation),

    illumination: fmt(
      illumination.phase_fraction * 100
    ),

    numeric: {
      altitude: moonHor.altitude,
      azimuth: moonHor.azimuth,
      ageHours,
      elongation,
      illumination:
        illumination.phase_fraction * 100,
    },
  };
}

function findBest(
  observer: Astronomy.Observer
) {
  const now = new Date();

  const newMoon =
    Astronomy.SearchMoonPhase(
      0,
      new Astronomy.AstroTime(now),
      40
    ).date;

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

    const sunsetEvent =
      Astronomy.SearchRiseSet(
        Astronomy.Body.Sun,
        observer,
        -1,
        new Astronomy.AstroTime(dayStart),
        2
      );

    if (!sunsetEvent) continue;

    const sunset = sunsetEvent.date;

    const moonsetEvent =
      Astronomy.SearchRiseSet(
        Astronomy.Body.Moon,
        observer,
        -1,
        new Astronomy.AstroTime(sunset),
        1
      );

    if (!moonsetEvent) continue;

    const moonset = moonsetEvent.date;

    const lag =
      (moonset.getTime() -
        sunset.getTime()) /
      60000;

    if (lag <= 0) continue;

    const startMinute = 20;

    const endMinute = Math.min(
      45,
      lag - 5
    );

    if (endMinute <= startMinute)
      continue;

    for (
      let minute = startMinute;
      minute <= endMinute;
      minute += 1
    ) {
      const t = new Date(
        sunset.getTime() +
          minute * 60000
      );

      t.setSeconds(0);
      t.setMilliseconds(0);

      const info = moonCalc(
        t,
        observer,
        newMoon
      );

      const age =
        info.numeric.ageHours;

      const altitude =
        info.numeric.altitude;

      const elongation =
        info.numeric.elongation;

      const illumination =
        info.numeric.illumination;

      if (age < 12 || age > 40)
        continue;

      if (altitude < 0)
        continue;

      const score =
        altitude * 3 +
        elongation * 2 +
        illumination * 0.5 -
        Math.abs(minute - 28) *
          0.8;

      if (
        !best ||
        score > best.score
      ) {
        best = {
          score,

          newMoonIso:
            newMoon.toISOString(),

          sunsetIso:
            floorToMinute(
              sunset
            ).toISOString(),

          moonsetIso:
            floorToMinute(
              moonset
            ).toISOString(),

          lag: lag.toFixed(1),

          best: info,
        };
      }
    }
  }

  return best;
}

export async function GET(
  request: Request
) {
  try {
    const { searchParams } =
      new URL(request.url);

    const lat = Number(
      searchParams.get("lat")
    );

    const lng = Number(
      searchParams.get("lng")
    );

    const observeTime =
      searchParams.get(
        "observeTime"
      );

    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lng)
    ) {
      return NextResponse.json(
        {
          error:
            "الإحداثيات غير صحيحة",
        },
        { status: 400 }
      );
    }

    const observer =
      new Astronomy.Observer(
        lat,
        lng,
        0
      );

    const best =
      findBest(observer);

    if (!best) {
      return NextResponse.json({
        error:
          "لم يتم العثور على هلال جديد مناسب للحساب خلال الأيام القادمة.",
      });
    }

    let custom = null;

    if (observeTime) {
      custom = moonCalc(
        new Date(observeTime),
        observer,
        new Date(
          best.newMoonIso
        )
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
        details: String(
          err?.message || err
        ),
      },
      { status: 500 }
    );
  }
}