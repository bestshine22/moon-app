"use client";

import { useEffect, useRef, useState } from "react";
import SunCalc from "suncalc";

/* ================= HELPERS ================= */

const rad2deg = (r: number) => (r * 180) / Math.PI;

function toDMS(v: number, type: "lat" | "lng") {
  const dir =
    type === "lat"
      ? v >= 0
        ? "N"
        : "S"
      : v >= 0
      ? "E"
      : "W";

  const a = Math.abs(v);

  const d = Math.floor(a);
  const m = Math.floor((a - d) * 60);
  const s = (((a - d) * 60 - m) * 60).toFixed(1);

  return `${d}°${m}'${s}" ${dir}`;
}

function localTime(date?: Date) {
  if (!date) return "-";

  return new Intl.DateTimeFormat([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

/* ================= VISIBILITY ================= */

function visibility(
  arcv: number,
  lag: number,
  elong: number
) {
  if (lag > 40 && arcv > 10 && elong > 10) {
    return "✅ مرئي";
  }

  if (lag > 20 && arcv > 6) {
    return "⚠️ صعب";
  }

  return "❌ غير مرئي";
}

/* ================= PAGE ================= */

export default function Page() {
  /* ===== LOCAL TIME ===== */

  const now = new Date();

  const localDateTime = new Date(
    now.getTime() - now.getTimezoneOffset() * 60000
  )
    .toISOString()
    .slice(0, 16);

  /* ===== STATES ===== */

  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");

  const [dt, setDt] = useState(localDateTime);

  const [data, setData] = useState<any>(null);

  const [heading, setHeading] = useState(0);

  const [clouds, setClouds] = useState<number | null>(null);

  const [nasa, setNasa] = useState<any>(null);

  const videoRef = useRef<HTMLVideoElement>(null);

  /* ================= GPS + COMPASS ================= */

  useEffect(() => {
    if (!navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (p) => {
        const newLat =
          p.coords.latitude.toFixed(6);

        const newLng =
          p.coords.longitude.toFixed(6);

        setLat(newLat);

        setLng(newLng);
      },

      (err) => {
        console.log(err);
      },

      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000,
      }
    );

    const handleOrientation = (e: any) => {
      if (e.alpha != null) {
        setHeading(360 - e.alpha);
      }
    };

    window.addEventListener(
      "deviceorientation",
      handleOrientation
    );

    return () => {
      navigator.geolocation.clearWatch(
        watchId
      );

      window.removeEventListener(
        "deviceorientation",
        handleOrientation
      );
    };
  }, []);

  /* ================= LIVE TRACKING ================= */

  useEffect(() => {
    const i = setInterval(() => {
      if (lat && lng) {
        calculate();
      }
    }, 5000);

    return () => clearInterval(i);
  });

  /* ================= CAMERA ================= */

  const startCamera = async () => {
    try {
      const stream =
        await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "environment",
          },
        });

      if (videoRef.current) {
        videoRef.current.srcObject =
          stream;
      }
    } catch {
      alert("Camera not supported");
    }
  };

  /* ================= WEATHER ================= */

  const fetchWeather = async (
    la: number,
    lo: number
  ) => {
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${la}&longitude=${lo}&hourly=cloudcover&forecast_days=1`;

      const res = await fetch(url);

      const json = await res.json();

      const c =
        json.hourly?.cloudcover?.[0] ?? 0;

      setClouds(c);
    } catch {}
  };

  /* ================= NASA ================= */

  const fetchNASA = async () => {
    try {
      const res = await fetch(
        "https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY"
      );

      const json = await res.json();

      setNasa(json);
    } catch {}
  };

  /* ================= CALCULATE ================= */

  const calculate = async () => {
    const d = new Date(dt);

    const la = Number(lat);

    const lo = Number(lng);

    const moon =
      SunCalc.getMoonPosition(
        d,
        la,
        lo
      );

    const sun = SunCalc.getPosition(
      d,
      la,
      lo
    );

    const illum =
      SunCalc.getMoonIllumination(d);

    const times = SunCalc.getTimes(
      d,
      la,
      lo
    );

    const mt = SunCalc.getMoonTimes(
      d,
      la,
      lo
    );

    const alt = rad2deg(
      moon.altitude
    );

    const az =
      rad2deg(moon.azimuth) + 180;

    const sunAlt = rad2deg(
      sun.altitude
    );

    const lag =
      mt.set && times.sunset
        ? (mt.set.getTime() -
            times.sunset.getTime()) /
          60000
        : 0;

    const elong = illum.phase * 360;

    const arcv = alt - sunAlt;

    setData({
      alt: alt.toFixed(2),

      az: az.toFixed(2),

      illum: (
        illum.fraction * 100
      ).toFixed(1),

      illumRaw: illum.fraction,

      age: (
        illum.phase * 29.53
      ).toFixed(1),

      sunset: localTime(
        times.sunset
      ),

      moonset: localTime(mt.set),

      lag: lag.toFixed(1),

      elong: elong.toFixed(1),

      arcv: arcv.toFixed(1),

      vis: visibility(
        arcv,
        lag,
        elong
      ),
    });

    fetchWeather(la, lo);

    fetchNASA();
  };

  /* ================= UI HELPERS ================= */

  const direction = data
    ? (Number(data.az) -
        heading +
        360) %
      360
    : 0;

  const resultColor =
    data?.vis.includes("✅")
      ? "#22c55e"
      : data?.vis.includes("⚠️")
      ? "#f59e0b"
      : "#ef4444";

  /* ================= UI ================= */

  return (
    <div
      style={{
        minHeight: "100vh",

        background:
          "radial-gradient(circle at top,#020617,#000)",

        color: "white",

        display: "flex",

        flexDirection: "column",

        alignItems: "center",

        padding: 20,

        textAlign: "center",

        fontFamily: "system-ui",
      }}
    >
      {/* TITLE */}

      <h1
        style={{
          fontSize: 34,
          marginBottom: 16,
        }}
      >
        🌙 Hilal Pro
      </h1>

      {/* INPUT CARD */}

      <div
        style={{
          width: 360,

          background: "#0f172a",

          padding: 22,

          borderRadius: 28,

          boxShadow:
            "0 0 40px rgba(37,99,235,0.35)",
        }}
      >
        <input
          value={lat}
          onChange={(e) =>
            setLat(e.target.value)
          }
          placeholder="Latitude"
          style={{
            width: "100%",
            padding: 14,
            marginBottom: 12,
            borderRadius: 14,
            border: "none",
          }}
        />

        <input
          value={lng}
          onChange={(e) =>
            setLng(e.target.value)
          }
          placeholder="Longitude"
          style={{
            width: "100%",
            padding: 14,
            marginBottom: 12,
            borderRadius: 14,
            border: "none",
          }}
        />

        <input
          type="datetime-local"
          value={dt}
          onChange={(e) =>
            setDt(e.target.value)
          }
          style={{
            width: "100%",
            padding: 14,
            marginBottom: 16,
            borderRadius: 14,
            border: "none",
          }}
        />

        <button
          onClick={calculate}
          style={{
            width: "100%",

            padding: 16,

            borderRadius: 18,

            border: "none",

            background: "#2563eb",

            color: "white",

            fontWeight: "bold",

            fontSize: 20,

            cursor: "pointer",
          }}
        >
          🔭 احسب
        </button>
      </div>

      {/* RESULTS */}

      {data && (
        <div
          style={{
            width: 360,

            marginTop: 22,

            background: "#0f172a",

            padding: 22,

            borderRadius: 28,

            boxShadow:
              "0 0 35px rgba(0,0,0,0.5)",
          }}
        >
          <h3>📍 موقع الراصد</h3>

          <p>
            {lat}, {lng}
          </p>

          <p>
            {toDMS(
              Number(lat),
              "lat"
            )}{" "}
            ,{" "}
            {toDMS(
              Number(lng),
              "lng"
            )}
          </p>

          <h3>🌙 القمر</h3>

          <p>
            الارتفاع: {data.alt}°
          </p>

          <p>
            الاتجاه: {data.az}°
          </p>

          <p>
            الإضاءة: {data.illum}%
          </p>

          <p>
            العمر: {data.age} يوم
          </p>

          <h3>🌇 الأوقات</h3>

          <p>
            غروب الشمس:{" "}
            {data.sunset}
          </p>

          <p>
            غروب القمر:{" "}
            {data.moonset}
          </p>

          <p>
            المكث: {data.lag} دقيقة
          </p>

          <h3>📊 معيار عودة</h3>

          <div
            style={{
              background:
                resultColor,

              padding:
                "14px 18px",

              borderRadius: 16,

              fontWeight: "bold",

              fontSize: 24,

              marginBottom: 16,
            }}
          >
            {data.vis}
          </div>

          <p>
            الاستطالة:{" "}
            {data.elong}°
          </p>

          <p>
            ARCV: {data.arcv}
          </p>

          <h3>🌙 شكل الهلال</h3>

          <div
            style={{
              width: 110,

              height: 110,

              margin: "auto",

              borderRadius: "50%",

              background: `linear-gradient(
90deg,
#111 ${
                100 -
                data.illumRaw * 100
              }%,
white ${
                100 -
                data.illumRaw * 100
              }%
)`,

              boxShadow:
                "0 0 25px rgba(255,255,255,0.4)",
            }}
          />

          <h3
            style={{
              marginTop: 22,
            }}
          >
            🧭 البوصلة
          </h3>

          <div
            style={{
              width: 150,

              height: 150,

              margin: "auto",

              borderRadius: "50%",

              border:
                "4px solid #2563eb",

              position: "relative",
            }}
          >
            <div
              style={{
                position: "absolute",

                top: "50%",

                left: "50%",

                transform: `translate(-50%,-50%) rotate(${direction}deg)`,

                fontSize: 42,
              }}
            >
              ↑
            </div>
          </div>

          <h3
            style={{
              marginTop: 24,
            }}
          >
            ☁️ الطقس
          </h3>

          <p>
            نسبة الغيوم:{" "}
            {clouds ?? "-"}%
          </p>

          <h3
            style={{
              marginTop: 24,
            }}
          >
            📷 AR
          </h3>

          <video
            ref={videoRef}
            autoPlay
            playsInline
            style={{
              width: "100%",
              borderRadius: 18,
              background: "#000",
            }}
          />

          <button
            onClick={startCamera}
            style={{
              marginTop: 12,

              width: "100%",

              padding: 14,

              borderRadius: 14,

              border: "none",

              background: "#16a34a",

              color: "white",

              fontWeight: "bold",
            }}
          >
            📷 تشغيل الكاميرا
          </button>

          {nasa && (
            <>
              <h3
                style={{
                  marginTop: 24,
                }}
              >
                🛰️ NASA
              </h3>

              <img
                src={nasa.url}
                alt="NASA"
                style={{
                  width: "100%",
                  borderRadius: 18,
                }}
              />

              <p
                style={{
                  marginTop: 10,
                  fontSize: 13,
                  opacity: 0.8,
                }}
              >
                {nasa.title}
              </p>
            </>
          )}

          <h3
            style={{
              marginTop: 24,
            }}
          >
            🌍 الخريطة العالمية
          </h3>

          <iframe
            width="100%"
            height="220"
            style={{
              borderRadius: 18,
              border: "none",
            }}
            src={`https://maps.google.com/maps?q=${lat},${lng}&z=4&output=embed`}
          />
        </div>
      )}
    </div>
  );
}