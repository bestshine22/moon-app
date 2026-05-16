import { NextResponse } from "next/server";
import * as Astronomy from "astronomy-engine";

const MAX_MOON_AGE_HOURS = 29.6 * 24;
const MAX_REASONABLE_LAG_MINUTES = 18 * 60;

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

  if (days >= 1) return `${days} يوم ${h} ساعة ${m} دقيقة`;
  return `${h} ساعة ${m} دقيقة ${s} ثانية`;
}

function searchNewMoonAfter(date: Date) {
  return Astronomy.SearchMoonPhase(
    0,
    new Astronomy.AstroTime(date),
    60
  ).date;
}

function searchNewMoonBefore(date: Date) {
  let start = new Date(date.getTime() - 40 * 86400_000);

  for (let i = 0; i < 12; i++) {
    let candidate = Astronomy.SearchMoonPhase(
      0,
      new Astronomy.AstroTime(start),
      80
    ).date;

    let last: Date | null = null;

    while (candidate <= date) {
      last = candidate;

      candidate = Astronomy.SearchMoonPhase(
        0,
        new Astronomy.AstroTime(new Date(candidate.getTime() + 3600_000)),
        80
      ).date;
    }

    if (last) return last;

    start = new Date(start.getTime() - 40 * 86400_000);
  }

  throw new Error("تعذر العثور على الاقتران السابق");
}

function validateMoonAge(ageHours: number) {
  return ageHours >= 0 && ageHours <= MAX_MOON_AGE_HOURS;
}

function moonCalc(date: Date, observer: Astronomy.Observer, baseNewMoon?: Date) {
  const cleanDate = floorToMinute(date);
  const newMoon = baseNewMoon ?? searchNewMoonBefore(cleanDate);

  const ageHours = (cleanDate.getTime() - newMoon.getTime()) / 3600000;

  if (!validateMoonAge(ageHours)) {
    return {
      invalid: true,
      error: "عمر القمر غير منطقي، تحقق من تاريخ الاقتران المستخدم.",
      iso: cleanDate.toISOString(),
      ageBaseNewMoonIso: newMoon.toISOString(),
      ageHours: fmt(ageHours),
    };
  }

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
  const illumPercent = illumination.phase_fraction * 100;

  return {
    invalid: false,
    iso: cleanDate.toISOString(),
    ageBaseNewMoonIso: newMoon.toISOString(),

    azimuth: fmt(moonHor.azimuth),
    altitude: fmt(moonHor.altitude),
    ageText: ageText(ageHours),
    ageHours: fmt(ageHours),
    elongation: fmt(elongation),
    illumination: fmt(illumPercent),

    numeric: {
      altitude: moonHor.altitude,
      azimuth: moonHor.azimuth,
      ageHours,
      elongation,
      illumination: illumPercent,
    },
  };
}

function illuminationCheck(
  observer: Astronomy.Observer,
  newMoon: Date,
  checkTime: Date
) {
  const t1 = floorToMinute(checkTime);
  const t2 = addMinutes(t1, 30);

  const a: any = moonCalc(t1, observer, newMoon);
  const b: any = moonCalc(t2, observer, newMoon);

  if (a.invalid || b.invalid) {
    return {
      ok: false,
      note: "تعذر فحص تغير الإضاءة.",
    };
  }

  return {
    ok: b.numeric.illumination >= a.numeric.illumination,
    note:
      b.numeric.illumination >= a.numeric.illumination
        ? "الإضاءة تزداد بشكل منطقي بعد الاقتران."
        : "تحذير: الإضاءة لا تزداد كما هو متوقع بعد الاقتران.",
  };
}

function findMoonsetAfter(observer: Astronomy.Observer, startDate: Date) {
  const startInfo: any = moonCalc(startDate, observer);

  if (startInfo.invalid || startInfo.numeric.altitude <= 0) {
    return null;
  }

  const event = Astronomy.SearchRiseSet(
    Astronomy.Body.Moon,
    observer,
    -1,
    new Astronomy.AstroTime(startDate),
    1
  );

  if (!event) return null;

  const moonset = floorToMinute(event.date);
  const diff = (moonset.getTime() - startDate.getTime()) / 60000;

  if (diff <= 0 || diff > MAX_REASONABLE_LAG_MINUTES) return null;

  return moonset;
}

function findSunset(observer: Astronomy.Observer, date: Date) {
  const dayStart = new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    0,
    0,
    0
  );

  const event = Astronomy.SearchRiseSet(
    Astronomy.Body.Sun,
    observer,
    -1,
    new Astronomy.AstroTime(dayStart),
    2
  );

  return event ? floorToMinute(event.date) : null;
}

function findUpcomingHilal(observer: Astronomy.Observer) {
  const now = floorToMinute(new Date());
  const newMoon = searchNewMoonAfter(now);

  for (let day = 0; day <= 5; day++) {
    const candidateDate = new Date(newMoon);
    candidateDate.setDate(candidateDate.getDate() + day);

    const sunset = findSunset(observer, candidateDate);
    if (!sunset) continue;

    if (sunset <= newMoon) continue;

    const sunsetData: any = moonCalc(sunset, observer, newMoon);

    if (sunsetData.invalid) continue;
    if (sunsetData.numeric.ageHours < 8) continue;
    if (sunsetData.numeric.ageHours > 48) continue;
    if (sunsetData.numeric.altitude <= 0) continue;

    const moonset = findMoonsetAfter(observer, sunset);
    if (!moonset) continue;

    const lag = (moonset.getTime() - sunset.getTime()) / 60000;

    if (lag <= 0 || lag > 240) continue;

    let visualBest: any = null;

    for (let minute = 3; minute <= Math.min(20, lag - 2); minute++) {
      const t = floorToMinute(addMinutes(sunset, minute));
      const info: any = moonCalc(t, observer, newMoon);

      if (info.invalid) continue;
      if (info.numeric.ageHours < 8) continue;
      if (info.numeric.ageHours > 48) continue;
      if (info.numeric.altitude <= 0) continue;

      const score =
        info.numeric.altitude * 4 +
        info.numeric.elongation * 1.5 +
        info.numeric.illumination * 0.3 -
        Math.abs(minute - 8) * 0.9;

      if (!visualBest || score > visualBest.score) {
        visualBest = { score, data: info };
      }
    }

    const illumCheck = illuminationCheck(observer, newMoon, sunset);

    return {
      kind: "upcoming_hilal",
      newMoonIso: newMoon.toISOString(),
      sunsetIso: sunset.toISOString(),
      moonsetIso: moonset.toISOString(),
      lag: lag.toFixed(1),
      sunsetData,
      visualBest: visualBest?.data ?? sunsetData,
      validation: {
        ok: true,
        illuminationCheck: illumCheck,
        notes: [
          "أفضل وقت للهلال لا يُحسب قبل الاقتران.",
          "تم منع الارتفاع السالب.",
          "تم منع المكث غير المنطقي.",
          "تم استخدام اقتران الهلال القادم فقط لهذا القسم.",
        ],
      },
    };
  }

  return null;
}

function customObservation(
  observer: Astronomy.Observer,
  observeTime: string
) {
  const customDate = floorToMinute(new Date(observeTime));

  if (Number.isNaN(customDate.getTime())) {
    return {
      invalid: true,
      error: "وقت الرصد غير صحيح.",
    };
  }

  const previous = searchNewMoonBefore(customDate);
  const data: any = moonCalc(customDate, observer, previous);

  if (data.invalid) return data;

  const moonset = findMoonsetAfter(observer, customDate);

  let remainingMoonset = "0.0";

  if (moonset) {
    const remaining = (moonset.getTime() - customDate.getTime()) / 60000;

    remainingMoonset =
      remaining > 0 && remaining <= MAX_REASONABLE_LAG_MINUTES
        ? remaining.toFixed(1)
        : "0.0";
  }

  return {
    ...data,
    remainingMoonset,
    validation: {
      ok: true,
      notes: [
        "تم حساب العمر من آخر اقتران سابق لوقت الرصد المدخل.",
        "لن يتجاوز العمر شهرًا قمريًا طبيعيًا.",
      ],
    },
  };
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
    const nowData: any = moonCalc(now, observer);

    if (nowData.invalid) {
      return NextResponse.json({
        error: nowData.error,
        nowData,
      });
    }

    const hilal = findUpcomingHilal(observer);

    if (!hilal) {
      return NextResponse.json({
        error: "لم يتم العثور على هلال مناسب خلال الأيام القادمة.",
      });
    }

    let custom = null;

    if (observeTime) {
      custom = customObservation(observer, observeTime);
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

      engineValidation: {
        ok: true,
        rules: [
          "كل عمر قمر يُحسب من الاقتران المناسب للقسم.",
          "حالة القمر الآن تستخدم آخر اقتران سابق للوقت الحالي.",
          "أفضل وقت للهلال يستخدم الاقتران القادم فقط.",
          "تحليل وقت الرصد يستخدم آخر اقتران سابق لوقت الرصد.",
          "تم منع عمر أكبر من 29.6 يوم.",
          "تم منع المكث غير المنطقي.",
          "تم منع اختيار هلال قبل الاقتران.",
        ],
      },
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