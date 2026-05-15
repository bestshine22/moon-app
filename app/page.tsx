"use client";

import { useEffect, useState } from "react";
import SunCalc from "suncalc";

const rad2deg = (r: number) => (r * 180) / Math.PI;

function getLocalDateTime() {
  const now = new Date();

  return new Date(
    now.getTime() - now.getTimezoneOffset() * 60000
  )
    .toISOString()
    .slice(0, 16);
}

function fmtTime(date?: Date) {
  if (!date) return "-";

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function addMinutes(date: Date, min: number) {
  return new Date(date.getTime() + min * 60000);
}

function moonData(
  date: Date,
  lat: number,
  lng: number
) {
  const moon =
    SunCalc.getMoonPosition(date, lat, lng);

  const illum =
    SunCalc.getMoonIllumination(date);

  const azimuth =
    (rad2deg(moon.azimuth) + 180 + 360) % 360;

  return {
    altitude: rad2deg(
      moon.altitude
    ).toFixed(2),

    azimuth: azimuth.toFixed(2),

    age: (
      illum.phase * 29.530588
    ).toFixed(2),

    elongation: (
      illum.phase * 360
    ).toFixed(2),
  };
}

export default function Page() {
  const [lat, setLat] = useState("");

  const [lng, setLng] = useState("");

  const [observeTime, setObserveTime] =
    useState(getLocalDateTime());

  const [mainResult, setMainResult] =
    useState<any>(null);

  const [customResult, setCustomResult] =
    useState<any>(null);

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        setLat(
          pos.coords.latitude.toFixed(6)
        );

        setLng(
          pos.coords.longitude.toFixed(6)
        );
      }
    );
  }, []);

  function calculate() {
    const la = Number(lat);

    const lo = Number(lng);

    const now = new Date();

    const times =
      SunCalc.getTimes(now, la, lo);

    const moonTimes =
      SunCalc.getMoonTimes(now, la, lo);

    const sunset = times.sunset;

    const moonset = moonTimes.set;

    const lag =
      moonset && sunset
        ? (moonset.getTime() -
            sunset.getTime()) /
          60000
        : 0;

    let bestTime: Date | null = null;

    if (
      sunset &&
      moonset &&
      moonset > sunset
    ) {
      const bestOffset = Math.max(
        10,
        Math.min(30, lag * 0.35)
      );

      bestTime = addMinutes(
        sunset,
        bestOffset
      );
    }

    const bestData = bestTime
      ? moonData(bestTime, la, lo)
      : null;

    setMainResult({
      sunset: fmtTime(sunset),

      moonset: fmtTime(moonset),

      lag: lag.toFixed(1),

      bestTime: bestTime
        ? fmtTime(bestTime)
        : "-",

      bestData,
    });

    calculateCustom();
  }

  function calculateCustom() {
    const la = Number(lat);

    const lo = Number(lng);

    const date = new Date(observeTime);

    setCustomResult(
      moonData(date, la, lo)
    );
  }

  return (
    <main
      style={{
        padding: 20,

        maxWidth: 500,

        margin: "auto",

        fontFamily: "Arial",
      }}
    >
      <h1>مرصد الهلال</h1>

      <label>خط العرض</label>

      <input
        value={lat}
        onChange={(e) =>
          setLat(e.target.value)
        }
        style={{
          width: "100%",
          padding: 10,
          marginBottom: 10,
        }}
      />

      <label>خط الطول</label>

      <input
        value={lng}
        onChange={(e) =>
          setLng(e.target.value)
        }
        style={{
          width: "100%",
          padding: 10,
          marginBottom: 10,
        }}
      />

      <button
        onClick={calculate}
        style={{
          width: "100%",
          padding: 14,
          marginTop: 10,
        }}
      >
        احسب
      </button>

      {mainResult && (
        <div style={{ marginTop: 25 }}>
          <h2>معلومات اليوم</h2>

          <p>
            غروب الشمس:
            {" "}
            {mainResult.sunset}
          </p>

          <p>
            غروب القمر:
            {" "}
            {mainResult.moonset}
          </p>

          <p>
            مكث القمر:
            {" "}
            {mainResult.lag}
            {" "}
            دقيقة
          </p>

          <h2>
            أفضل وقت للرصد
          </h2>

          <p>
            أفضل وقت:
            {" "}
            {mainResult.bestTime}
          </p>

          <p>
            الارتفاع:
            {" "}
            {mainResult.bestData
              ?.altitude ?? "-"}
            °
          </p>

          <p>
            العمر:
            {" "}
            {mainResult.bestData
              ?.age ?? "-"}
            {" "}
            يوم
          </p>

          <p>
            الاستطالة:
            {" "}
            {mainResult.bestData
              ?.elongation ?? "-"}
            °
          </p>

          <p>
            درجة توجيه البوصلة:
            {" "}
            {mainResult.bestData
              ?.azimuth ?? "-"}
            °
          </p>
        </div>
      )}

      <div style={{ marginTop: 30 }}>
        <h2>وقت رصدك أنت</h2>

        <input
          type="datetime-local"
          value={observeTime}
          onChange={(e) =>
            setObserveTime(e.target.value)
          }
          style={{
            width: "100%",
            padding: 10,
            marginBottom: 10,
          }}
        />

        <button
          onClick={calculateCustom}
          style={{
            width: "100%",
            padding: 12,
          }}
        >
          احسب وقت رصدي
        </button>

        {customResult && (
          <div style={{ marginTop: 15 }}>
            <p>
              العمر وقت رصدي:
              {" "}
              {customResult.age}
              {" "}
              يوم
            </p>

            <p>
              الارتفاع وقت رصدي:
              {" "}
              {customResult.altitude}
              °
            </p>

            <p>
              الاستطالة وقت رصدي:
              {" "}
              {customResult.elongation}
              °
            </p>

            <p>
              درجة توجيه البوصلة وقت رصدي:
              {" "}
              {customResult.azimuth}
              °
            </p>
          </div>
        )}
      </div>
    </main>
  );
}