import { NextResponse } from "next/server";
import * as Astronomy from "astronomy-engine";

const MAX_MOON_AGE_HOURS = 29.6 * 24;
const MAX_REASONABLE_LAG_MINUTES = 18 * 60;
const KEEP_CURRENT_HILAL_DAYS = 7;

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

function illuminationFromPhaseAngle(phaseAngleDeg: number) {
  const rad = (phaseAngleDeg * Math.PI) / 180;
  return ((1 + Math.cos(rad)) / 2) * 100;
}

function searchNewMoonAfter(date: Date) {
  return Astronomy.SearchMoonPhase(0, new Astronomy.AstroTime(date), 60).date;
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

function chooseHilalNewMoon(now: Date) {
  const previous = searchNewMoonBefore(now);
  const ageDays = (now.getTime() - previous.getTime()) / 86400_000;

  if (ageDays <= KEEP_CURRENT_HILAL_DAYS) {
    return {
      newMoon: previous,
      mode: "current_hilal",
    };
  }

  return {
    newMoon: searchNewMoonAfter(now),
    mode: "next_hilal",
  };
}

function validateMoonAge(ageHours: number) {
  return ageHours >= 0 && ageHours <= MAX_MOON_AGE_HOURS;
}

function formatUtcForJpl(date: Date) {
  const yyyy = date.getUTCFullYear();
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mi = String(date.getUTCMinutes()).padStart(2, "0");

  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

function parseJplMoonData(text: string) {
  const lines = text.split("\n");
  let inside = false;

  for (const line of lines) {
    if (line.includes("$$SOE")) {
      inside = true;
      continue;
    }

    if (line.includes("$$EOE")) break;
    if (!inside) continue;

    const cleaned = line.trim();
    if (!cleaned) continue;

    const parts = cleaned.split(/\s+/);

    const nums = parts
      .map((p) => Number(p))
      .filter((n) => Number.isFinite(n));

    if (nums.length < 4) continue;

    const azimuth = nums[0];
    const altitude = nums[1];
    const elongation = nums[2];
    const phaseAngle = nums[3];
    const illumination = illuminationFromPhaseAngle(phaseAngle);

    return {
      azimuth,
      altitude,
      elongation,
      phaseAngle,
      illumination,
    };
  }

  return null;
}

async function getJplMoonData(
  date: Date,
  lat: number,
  lng: number,
  heightMeters: number
) {
  try {
    const cleanDate = floorToMinute(date);
    const stopDate = addMinutes(cleanDate, 1);

    const start = formatUtcForJpl(cleanDate);
    const stop = formatUtcForJpl(stopDate);

    const heightKm = Number.isFinite(heightMeters) ? heightMeters / 1000 : 0;

    const url =
      "https://ssd.jpl.nasa.gov/api/horizons.api" +
      "?format=json" +
      "&COMMAND='301'" +
      "&EPHEM_TYPE=OBSERVER" +
      "&CENTER='coord@399'" +
      "&COORD_TYPE=GEODETIC" +
      `&SITE_COORD='${lng},${lat},${heightKm}'` +
      `&START_TIME='${start}'` +
      `&STOP_TIME='${stop}'` +
      "&STEP_SIZE='1 m'" +
      "&QUANTITIES='4,23,24'";

    const response = await fetch(url, { cache: "no-store" });
    const data = await response.json();

    const parsed = parseJplMoonData(data?.result || "");
    if (!parsed) return null;

    return {
      ...parsed,
      source: "NASA JPL Horizons",
    };
  } catch {
    return null;
  }
}

function hijriMonthTitle(date: Date) {
  try {
    const nextHijriDay = new Date(date.getTime() + 24 * 60 * 60 * 1000);

    const formatter = new Intl.DateTimeFormat(
      "ar-SA-u-ca-islamic-umalqura",
      {
        month: "long",
        year: "numeric",
      }
    );

    const parts = formatter.formatToParts(nextHijriDay);

    const month =
      parts.find((p) => p.type === "month")?.value || "";

    const year =
      parts.find((p) => p.type === "year")?.value || "";

    return `معطيات هلال شهر ${month} ${year}`;
  } catch {
    return "معطيات الهلال";
  }
}

function moonCalcLocal(
  date: Date,
  observer: Astronomy.Observer,
  baseNewMoon?: Date
) {
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
    phaseAngle: "-",

    accuracySource: "Astronomy Engine",
    jplVerified: false,

    numeric: {
      altitude: moonHor.altitude,
      azimuth: moonHor.azimuth,
      ageHours,
      elongation,
      illumination: illumPercent,
    },
  };
}

async function moonCalc(
  date: Date,
  observer: Astronomy.Observer,
  lat: number,
  lng: number,
  heightMeters: number,
  baseNewMoon?: Date,
  useJpl = true
) {
  const local: any = moonCalcLocal(date, observer, baseNewMoon);

  if (local.invalid) return local;
  if (!useJpl) return local;

  const jpl = await getJplMoonData(floorToMinute(date), lat, lng, heightMeters);

  if (!jpl) return local;

  return {
    ...local,

    azimuth: fmt(jpl.azimuth),
    altitude: fmt(jpl.altitude),
    elongation: fmt(jpl.elongation),
    illumination: fmt(jpl.illumination),
    phaseAngle: fmt(jpl.phaseAngle),

    accuracySource: "NASA JPL Horizons",
    jplVerified: true,

    numeric: {
      ...local.numeric,
      altitude: jpl.altitude,
      azimuth: jpl.azimuth,
      elongation: jpl.elongation,
      illumination: jpl.illumination,
    },
  };
}

function illuminationCheckLocal(
  observer: Astronomy.Observer,
  newMoon: Date,
  checkTime: Date
) {
  const t1 = floorToMinute(checkTime);
  const t2 = addMinutes(t1, 30);

  const a: any = moonCalcLocal(t1, observer, newMoon);
  const b: any = moonCalcLocal(t2, observer, newMoon);

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

function findMoonsetAfterLocal(observer: Astronomy.Observer, startDate: Date) {
  const startInfo: any = moonCalcLocal(startDate, observer);

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

async function findHilalData(
  observer: Astronomy.Observer,
  lat: number,
  lng: number,
  heightMeters: number
) {
  const now = floorToMinute(new Date());
  const chosen = chooseHilalNewMoon(now);
  const newMoon = chosen.newMoon;

  for (let day = 0; day <= 5; day++) {
    const candidateDate = new Date(newMoon);
    candidateDate.setDate(candidateDate.getDate() + day);

    const sunset = findSunset(observer, candidateDate);
    if (!sunset) continue;

    if (sunset <= newMoon) continue;

    const sunsetDataLocal: any = moonCalcLocal(sunset, observer, newMoon);

    if (sunsetDataLocal.invalid) continue;
    if (sunsetDataLocal.numeric.ageHours < 8) continue;
    if (sunsetDataLocal.numeric.ageHours > 48) continue;
    if (sunsetDataLocal.numeric.altitude <= 0) continue;

    const moonset = findMoonsetAfterLocal(observer, sunset);
    if (!moonset) continue;

    const lag = (moonset.getTime() - sunset.getTime()) / 60000;

    if (lag <= 0 || lag > 240) continue;

    let visualBest: any = null;

    for (let minute = 3; minute <= Math.min(20, lag - 2); minute++) {
      const t = floorToMinute(addMinutes(sunset, minute));
      const info: any = moonCalcLocal(t, observer, newMoon);

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
        visualBest = { score, date: t, localData: info };
      }
    }

    const bestDate = visualBest?.date ?? sunset;

    const visualBestAccurate = await moonCalc(
      bestDate,
      observer,
      lat,
      lng,
      heightMeters,
      newMoon,
      true
    );

    const sunsetDataAccurate = await moonCalc(
      sunset,
      observer,
      lat,
      lng,
      heightMeters,
      newMoon,
      true
    );

    const illumCheck = illuminationCheckLocal(observer, newMoon, sunset);

    return {
      kind: chosen.mode,
      monthTitle: hijriMonthTitle(bestDate),
      newMoonIso: newMoon.toISOString(),
      sunsetIso: sunset.toISOString(),
      moonsetIso: moonset.toISOString(),
      lag: lag.toFixed(1),
      sunsetData: sunsetDataAccurate,
      visualBest: visualBestAccurate,
      validation: {
        ok: true,
        illuminationCheck: illumCheck,
        notes: [
          "لا يتم الانتقال لهلال الشهر التالي إلا بعد مرور 7 أيام من ولادة الهلال الحالي.",
          "تم منع الارتفاع السالب.",
          "تم منع المكث غير المنطقي.",
          "تم استخدام NASA JPL Horizons للارتفاع والاتجاه والاستطالة والإضاءة عند توفره.",
        ],
      },
    };
  }

  if (chosen.mode === "current_hilal") {
    const nextNewMoon = searchNewMoonAfter(now);

    return null;
  }

  return null;
}

async function customObservation(
  observer: Astronomy.Observer,
  lat: number,
  lng: number,
  heightMeters: number,
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

  const data: any = await moonCalc(
    customDate,
    observer,
    lat,
    lng,
    heightMeters,
    previous,
    true
  );

  if (data.invalid) return data;

  const moonset = findMoonsetAfterLocal(observer, customDate);

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
        "تم استخدام NASA JPL Horizons للارتفاع والاتجاه والاستطالة والإضاءة عند توفره.",
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

    const heightMeters = Number.isFinite(height) ? height : 0;
    const observer = new Astronomy.Observer(lat, lng, heightMeters);
    const now = floorToMinute(new Date());

    const nowData: any = await moonCalc(
      now,
      observer,
      lat,
      lng,
      heightMeters,
      undefined,
      true
    );

    if (nowData.invalid) {
      return NextResponse.json({
        error: nowData.error,
        nowData,
      });
    }

    const hilal = await findHilalData(observer, lat, lng, heightMeters);

    if (!hilal) {
      return NextResponse.json({
        error: "لم يتم العثور على هلال مناسب خلال الأيام القادمة.",
      });
    }

    let custom = null;

    if (observeTime) {
      custom = await customObservation(
        observer,
        lat,
        lng,
        heightMeters,
        observeTime
      );
    }

    return NextResponse.json({
      observer: {
        lat,
        lng,
        height: heightMeters,
      },

      nowData,
      hilal,
      custom,

      engineValidation: {
        ok: true,
        primaryExternalReference: "NASA JPL Horizons",
        jplUsage:
          "يتم استخدام NASA JPL Horizons للارتفاع والاتجاه والاستطالة والإضاءة عند توفر الاتصال.",
        hilalSwitchRule:
          "لا ينتقل التطبيق لهلال الشهر التالي إلا بعد مرور 7 أيام من ولادة الهلال الحالي.",
        rules: [
          "العمر يُحسب من الاقتران المناسب.",
          "المكث يُحسب من غروب القمر وغروب الشمس محليًا.",
          "أفضل وقت للرصد خوارزمية مبنية فوق بيانات القمر والشمس.",
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