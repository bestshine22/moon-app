import { NextResponse } from "next/server";
import * as Astronomy from "astronomy-engine";

const MAX_MOON_AGE_HOURS = 29.6 * 24;
const MAX_REASONABLE_LAG_MINUTES = 18 * 60;
const KEEP_CURRENT_HILAL_DAYS = 7;

const HIJRI_MONTHS = [
  "محرم",
  "صفر",
  "ربيع الأول",
  "ربيع الآخر",
  "جمادى الأولى",
  "جمادى الآخرة",
  "رجب",
  "شعبان",
  "رمضان",
  "شوال",
  "ذو القعدة",
  "ذو الحجة",
];

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
  return ((1 + Math.cos((phaseAngleDeg * Math.PI) / 180)) / 2) * 100;
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
    return { newMoon: previous, mode: "current_hilal" };
  }

  return { newMoon: searchNewMoonAfter(now), mode: "next_hilal" };
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

    const nums = line
      .trim()
      .split(/\s+/)
      .map((p) => Number(p))
      .filter((n) => Number.isFinite(n));

    if (nums.length < 4) continue;

    const azimuth = nums[0];
    const altitude = nums[1];
    const elongation = nums[2];
    const phaseAngle = nums[3];
    const illumination = illuminationFromPhaseAngle(phaseAngle);

    return { azimuth, altitude, elongation, phaseAngle, illumination };
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
    const start = formatUtcForJpl(cleanDate);
    const stop = formatUtcForJpl(addMinutes(cleanDate, 1));
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
    return { ...parsed, source: "NASA JPL Horizons" };
  } catch {
    return null;
  }
}

function hijriMonthTitle(date: Date) {
  try {
    const targetHijriDate = new Date(date.getTime() + 48 * 60 * 60 * 1000);

    const formatter = new Intl.DateTimeFormat("ar-SA-u-ca-islamic-umalqura", {
      month: "long",
      year: "numeric",
      timeZone: "Asia/Riyadh",
    });

    const parts = formatter.formatToParts(targetHijriDate);
    const month = parts.find((p) => p.type === "month")?.value || "";
    const year = parts.find((p) => p.type === "year")?.value || "";

    return `هلال شهر ${month} ${year}`;
  } catch {
    return "الهلال";
  }
}

function hijriForecastTitle(month: number, year: number) {
  return `هلال شهر ${HIJRI_MONTHS[month - 1]} ${year}`;
}

function islamicToJulianDay(year: number, month: number, day: number) {
  return (
    day +
    Math.ceil(29.5 * (month - 1)) +
    (year - 1) * 354 +
    Math.floor((3 + 11 * year) / 30) +
    1948439.5 -
    1
  );
}

function julianDayToDate(jd: number) {
  return new Date((jd - 2440587.5) * 86400_000);
}

function approximateHijriStartDate(year: number, month: number) {
  return julianDayToDate(islamicToJulianDay(year, month, 1));
}

function forecastNewMoonForHijriMonth(year: number, month: number) {
  const approxStart = approximateHijriStartDate(year, month);
  const searchPoint = new Date(approxStart.getTime() + 2 * 86400_000);
  return searchNewMoonBefore(searchPoint);
}

function sunAltitudeLocal(date: Date, observer: Astronomy.Observer) {
  const time = new Astronomy.AstroTime(date);
  const sunEq = Astronomy.Equator(Astronomy.Body.Sun, time, observer, true, true);
  const sunHor = Astronomy.Horizon(time, observer, sunEq.ra, sunEq.dec, "normal");
  return sunHor.altitude;
}

function odehVisibility(data: any, lagMinutes: number, sunAlt: number) {
  const moonAlt = data?.numeric?.altitude ?? Number(data?.altitude);
  const elongation = data?.numeric?.elongation ?? Number(data?.elongation);
  const ageHours = data?.numeric?.ageHours ?? Number(data?.ageHours);

  if (
    !Number.isFinite(moonAlt) ||
    !Number.isFinite(elongation) ||
    !Number.isFinite(lagMinutes) ||
    !Number.isFinite(sunAlt)
  ) {
    return {
      level: "unknown",
      icon: "⚪",
      label: "غير محدد",
      result: "غير محدد",
    };
  }

  const relativeAltitude = moonAlt - sunAlt;
  const moonSemiDiameterArcMin = 16.7;
  const crescentWidthArcMin =
    moonSemiDiameterArcMin * (1 - Math.cos((elongation * Math.PI) / 180));

  const w = crescentWidthArcMin;
  const threshold =
    11.8371 - 6.3226 * w + 0.7319 * w * w - 0.1018 * w * w * w;

  const q = (relativeAltitude - threshold) / 10;

  if (moonAlt <= 0 || lagMinutes <= 0 || ageHours < 8) {
    return {
      level: "impossible",
      icon: "🔴",
      label: "مستحيل",
      result: "مستحيل",
    };
  }

  if (q >= 0.216) {
    return {
      level: "easy",
      icon: "🟢",
      label: "قابل للرؤية بسهولة",
      result: "قابل للرؤية بسهولة",
    };
  }

  if (q >= -0.014) {
    return {
      level: "naked_eye",
      icon: "🟢",
      label: "قابل للرؤية بالعين المجردة",
      result: "قابل للرؤية بالعين المجردة",
    };
  }

  if (q >= -0.160) {
    return {
      level: "optical_then_eye",
      icon: "🟡",
      label: "قابل للرؤية بالتلسكوب",
      result: "قابل للرؤية بالتلسكوب",
    };
  }

  if (q >= -0.232) {
    return {
      level: "optical",
      icon: "🟠",
      label: "قابل للرؤية بالتلسكوب",
      result: "قابل للرؤية بالتلسكوب",
    };
  }

  return {
    level: "not_possible",
    icon: "🔴",
    label: "غير ممكن",
    result: "غير ممكن",
  };
}

function moonCalcLocal(date: Date, observer: Astronomy.Observer, baseNewMoon?: Date) {
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
  const moonEq = Astronomy.Equator(Astronomy.Body.Moon, time, observer, true, true);
  const moonHor = Astronomy.Horizon(time, observer, moonEq.ra, moonEq.dec, "normal");
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

function findMoonsetAfterLocal(observer: Astronomy.Observer, startDate: Date) {
  const startInfo: any = moonCalcLocal(startDate, observer);
  if (startInfo.invalid || startInfo.numeric.altitude <= 0) return null;

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
  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0);

  const event = Astronomy.SearchRiseSet(
    Astronomy.Body.Sun,
    observer,
    -1,
    new Astronomy.AstroTime(dayStart),
    2
  );

  return event ? floorToMinute(event.date) : null;
}

async function buildHilalFromNewMoon(
  observer: Astronomy.Observer,
  lat: number,
  lng: number,
  heightMeters: number,
  newMoon: Date,
  monthTitle: string,
  kind: string
) {
  for (let day = 0; day <= 5; day++) {
    const candidateDate = new Date(newMoon);
    candidateDate.setDate(candidateDate.getDate() + day);

    const sunset = findSunset(observer, candidateDate);
    if (!sunset || sunset <= newMoon) continue;

    const sunsetDataLocal: any = moonCalcLocal(sunset, observer, newMoon);
    if (sunsetDataLocal.invalid) continue;
    if (sunsetDataLocal.numeric.ageHours < 8) continue;
    if (sunsetDataLocal.numeric.ageHours > 48) continue;
    if (sunsetDataLocal.numeric.altitude <= 0) continue;

    const moonset = findMoonsetAfterLocal(observer, sunset);
    if (!moonset) continue;

    const lag = (moonset.getTime() - sunset.getTime()) / 60000;
    if (lag <= 0 || lag > 240) continue;

    const bestTime = floorToMinute(addMinutes(sunset, (4 / 9) * lag));

    const bestTimeData = await moonCalc(
      bestTime,
      observer,
      lat,
      lng,
      heightMeters,
      newMoon,
      true
    );

    const sunAltAtBest = sunAltitudeLocal(bestTime, observer);
    const visibility = odehVisibility(bestTimeData, lag, sunAltAtBest);

    return {
      kind,
      monthTitle,
      newMoonIso: newMoon.toISOString(),
      sunsetIso: sunset.toISOString(),
      moonsetIso: moonset.toISOString(),
      bestTimeIso: bestTime.toISOString(),
      lag: lag.toFixed(1),
      bestTimeData,
      visualBest: bestTimeData,
      visibility,
      validation: {
        ok: true,
        notes: [
          "أفضل وقت للرؤية = غروب الشمس + 4/9 من مكث القمر.",
          "نتيجة الرؤية مختصرة وفق معيار عودة.",
          "تم استخدام NASA JPL Horizons للارتفاع والاتجاه والاستطالة والإضاءة عند توفره.",
        ],
      },
    };
  }

  return null;
}

async function findHilalData(
  observer: Astronomy.Observer,
  lat: number,
  lng: number,
  heightMeters: number
) {
  const now = floorToMinute(new Date());
  const chosen = chooseHilalNewMoon(now);

  return buildHilalFromNewMoon(
    observer,
    lat,
    lng,
    heightMeters,
    chosen.newMoon,
    hijriMonthTitle(chosen.newMoon),
    chosen.mode
  );
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const lat = Number(searchParams.get("lat"));
    const lng = Number(searchParams.get("lng"));
    const height = Number(searchParams.get("height") ?? "0");
    const forecastMonth = Number(searchParams.get("forecastMonth"));
    const forecastYear = Number(searchParams.get("forecastYear"));

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return NextResponse.json({ error: "الإحداثيات غير صحيحة" }, { status: 400 });
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
      return NextResponse.json({ error: nowData.error, nowData });
    }

    const hilal = await findHilalData(observer, lat, lng, heightMeters);

    if (!hilal) {
      return NextResponse.json({
        error: "لم يتم العثور على هلال مناسب خلال الأيام القادمة.",
      });
    }

    let forecast = null;

    if (
      Number.isFinite(forecastMonth) &&
      Number.isFinite(forecastYear) &&
      forecastMonth >= 1 &&
      forecastMonth <= 12 &&
      forecastYear >= 1300 &&
      forecastYear <= 1700
    ) {
      const forecastNewMoon = forecastNewMoonForHijriMonth(
        forecastYear,
        forecastMonth
      );

      forecast = await buildHilalFromNewMoon(
        observer,
        lat,
        lng,
        heightMeters,
        forecastNewMoon,
        hijriForecastTitle(forecastMonth, forecastYear),
        "forecast_hilal"
      );
    }

    return NextResponse.json({
      observer: { lat, lng, height: heightMeters },
      nowData,
      hilal,
      forecast,
      engineValidation: {
        ok: true,
        primaryExternalReference: "NASA JPL Horizons",
        odeh:
          "أفضل وقت للرؤية = Sunset + 4/9 Moon Lag، ونتيجة الرؤية مختصرة وفق معيار عودة.",
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "خطأ في الحساب", details: String(err?.message || err) },
      { status: 500 }
    );
  }
}