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

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

function ageText(hours: number) {
  const totalSeconds = Math.max(0, Math.round(hours * 3600));
  const days = Math.floor(totalSeconds / 86400);
  const rest = totalSeconds % 86400;
  const h = Math.floor(rest / 3600);
  const m = Math.floor((rest % 3600) / 60);
  const s = rest % 60;

  if (days >= 1) {
    return `${days} يوم ${h} ساعة ${m} دقيقة`;
  }

  return `${h} ساعة ${m} دقيقة ${s} ثانية`;
}

function nextNewMoon(date: Date) {
  return Astronomy.SearchMoonPhase(
    0,
    new Astronomy.AstroTime(date),
    60
  ).date;
}

function previousNewMoon(date: Date) {
  let start = new Date(date.getTime() - 45 * 24 * 60 * 60 * 1000);

  for (let attempt = 0; attempt < 12; attempt++) {
    let candidate = Astronomy.SearchMoonPhase(
      0,
      new Astronomy.AstroTime(start),
      80
    ).date;

    let latestBefore: Date | null = candidate <= date ? candidate : null;

    while (candidate <= date) {
      latestBefore = candidate;

      candidate = Astronomy.SearchMoonPhase(
        0,
        new Astronomy.AstroTime(new Date(candidate.getTime() + 60 * 60 * 1000)),
        80
      ).date;
    }

    if (latestBefore) return latestBefore;

    start = new Date(start.getTime() - 45 * 24 * 60 * 60 * 1000);
  }

  throw new Error("تعذر حساب الاقتران السابق لهذا التاريخ");
}

function moonCalc(
  date: Date,
  observer: Astronomy.Observer,
  ageBaseNewMoon?: Date
) {
  const cleanDate = floorToMinute(date);
  const base = ageBaseNewMoon ?? previousNewMoon(cleanDate);
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

  const elongation = Astronomy.AngleFromSun(Astronomy.Body.Moon, time);
  const illumination = Astronomy.Illumination(Astronomy.Body.Moon, time);

  const ageHours = (cleanDate.getTime() - base.getTime()) / 3600000;

  return {
    iso: cleanDate.toISOString(),
    ageBaseNewMoonIso: base.toISOString(),
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

function findMoonsetAfter(observer: Astronomy.Observer, startDate: Date) {
  const moonInfo = moonCalc(startDate, observer);

  if (moonInfo.numeric.altitude <= 0) {
    return null;
  }

  const moonsetEvent = Astronomy.SearchRiseSet(
    Astronomy.Body.Moon,
    observer,
    -1,
    new Astronomy.AstroTime(startDate),
    1
  );

  if (!moonsetEvent) return null;

  const moonset = floorToMinute(moonsetEvent.date);
  const diff = (moonset.getTime() - startDate.getTime()) / 60000;

  if (diff <= 0 || diff > 240) return null;

  return moonset;
}

function findUpcomingHilal(observer: Astronomy.Observer) {
  const now = floorToMinute(new Date());

  /*
    هذا القسم خاص فقط بهلال بداية الشهر القادم من وقت اليوم.
    لا يتأثر بوقت الرصد اليدوي.
  */
  const newMoon = nextNewMoon(now);

  for (let day = 0; day <= 5; day++) {
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

    if (sunset <= newMoon) continue;

    const sunsetData = moonCalc(sunset, observer, newMoon);

    if (sunsetData.numeric.ageHours < 8) continue;
    if (sunsetData.numeric.ageHours > 48) continue;
    if (sunsetData.numeric.altitude <= 0) continue;

    const moonset = findMoonsetAfter(observer, sunset);
    if (!moonset) continue;

    const lag = (moonset.getTime() - sunset.getTime()) / 60000;

    if (lag <= 0 || lag > 240) continue;

    let visualBest: any = null;

    /*
      أفضل وقت بصري: بعد الغروب بدقائق قليلة.
      لا نسمح بوقت متأخر جدًا حتى لا يهبط القمر كثيرًا.
    */
    for (let minute = 3; minute <= Math.min(20, lag - 2); minute++) {
      const t = floorToMinute(addMinutes(sunset, minute));
      const info = moonCalc(t, observer, newMoon);

      if (info.numeric.ageHours < 8) continue;
      if (info.numeric.ageHours > 48) continue;
      if (info.numeric.altitude <= 0) continue;

      const score =
        info.numeric.altitude * 4 +
        info.numeric.elongation * 1.5 +
        info.numeric.illumination * 0.3 -
        Math.abs(minute - 8) * 0.9;

      if (!visualBest || score > visualBest.score) {
        visualBest = {
          score,
          data: info,
        };
      }
    }

    if (!visualBest) {
      visualBest = {
        score: 0,
        data: sunsetData,
      };
    }

    return {
      newMoonIso: newMoon.toISOString(),
      sunsetIso: sunset.toISOString(),
      moonsetIso: moonset.toISOString(),
      lag: lag.toFixed(1),
      sunsetData,
      visualBest: visualBest.data,
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

    /*
      القسم الأول:
      حالة القمر الآن فقط.
      يستخدم آخر اقتران قبل الآن.
    */
    const now = floorToMinute(new Date());
    const nowData = moonCalc(now, observer);

    /*
      القسم الثاني:
      أفضل وقت لرصد هلال بداية الشهر القادم.
      لا علاقة له بوقت الرصد اليدوي.
    */
    const hilal = findUpcomingHilal(observer);

    if (!hilal) {
      return NextResponse.json({
        error: "لم يتم العثور على هلال مناسب خلال الأيام القادمة.",
      });
    }

    /*
      القسم الثالث:
      تحليل وقت الرصد الحقيقي.
      يستخدم آخر اقتران قبل وقت الرصد المدخل.
    */
    let custom = null;

    if (observeTime) {
      const customDate = floorToMinute(new Date(observeTime));
      const customData: any = moonCalc(customDate, observer);

      const moonsetAfterCustom = findMoonsetAfter(observer, customDate);

      let remainingMoonset = "0.0";

      if (moonsetAfterCustom) {
        const remaining =
          (moonsetAfterCustom.getTime() - customDate.getTime()) / 60000;

        remainingMoonset =
          remaining > 0 && remaining <= 240 ? remaining.toFixed(1) : "0.0";
      }

      custom = {
        ...customData,
        remainingMoonset,
      };
    }

    return NextResponse.json({
      observer: {
        lat,
        lng,
        height,
      },
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