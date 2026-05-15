"use client";

import { useEffect, useState } from "react";
import SunCalc from "suncalc";

const rad2deg = (r: number) => (r * 180) / Math.PI;

function getLocalDateTime() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}

function toDMS(v: number, type: "lat" | "lng") {
  const dir =
    type === "lat"
      ? v >= 0 ? "N" : "S"
      : v >= 0 ? "E" : "W";

  const a = Math.abs(v);
  const d = Math.floor(a);
  const m = Math.floor((a - d) * 60);
  const s = (((a - d) * 60 - m) * 60).toFixed(1);

  return `${d}°${m}'${s}" ${dir}`;
}

function fmtTime(date?: Date) {
  if (!date) return "-";
  return new Intl.DateTimeFormat([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60000);
}

function visibility(arcv: number, lag: number, elong: number) {
  if (lag > 40 && arcv > 10 && elong > 10) return "✅ مرئي";
  if (lag > 20 && arcv > 6) return "⚠️ صعب";
  return "❌ غير مرئي";
}

export default function Page() {
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [accuracy, setAccuracy] = useState<number | null>(null);

  const [observeTime, setObserveTime] = useState(getLocalDateTime());
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
        setAccuracy(Math.round(pos.coords.accuracy));
      },
      () => {},
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 20000,
      }
    );
  }, []);

  const calculate = () => {
    const la = Number(lat);
    const lo = Number(lng);
    const obsDate = new Date(observeTime);

    const moon = SunCalc.getMoonPosition(obsDate, la, lo);
    const sun = SunCalc.getPosition(obsDate, la, lo);
    const illum = SunCalc.getMoonIllumination(obsDate);

    const times = SunCalc.getTimes(obsDate, la, lo);
    const moonTimes = SunCalc.getMoonTimes(obsDate, la, lo);

    const altitude = rad2deg(moon.altitude);
    const azimuth = (rad2deg(moon.azimuth) + 180 + 360) % 360;
    const sunAltitude = rad2deg(sun.altitude);

    const lag =
      moonTimes.set && times.sunset
        ? (moonTimes.set.getTime() - times.sunset.getTime()) / 60000
        : 0;

    const elongation = illum.phase * 360;
    const arcv = altitude - sunAltitude;
    const age = illum.phase * 29.530588;

    let startObserve = "-";
    let bestObserve = "-";

    if (times.sunset && moonTimes.set && moonTimes.set > times.sunset) {
      const start = addMinutes(times.sunset, 5);
      const bestOffset = Math.max(10, Math.min(30, lag * 0.35));
      const best = addMinutes(times.sunset, bestOffset);

      startObserve = fmtTime(start);
      bestObserve = fmtTime(best);
    }

    setResult({
      altitude: altitude.toFixed(2),
      azimuth: azimuth.toFixed(2),
      illumination: (illum.fraction * 100).toFixed(2),
      age: age.toFixed(2),
      sunset: fmtTime(times.sunset),
      moonset: fmtTime(moonTimes.set),
      lag: lag.toFixed(1),
      elongation: elongation.toFixed(2),
      arcv: arcv.toFixed(2),
      startObserve,
      bestObserve,
      visibility: visibility(arcv, lag, elongation),
    });
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top, #1e293b 0%, #020617 45%, #000 100%)",
        color: "white",
        fontFamily: "system-ui",
        padding: 20,
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div style={{ width: "100%", maxWidth: 430 }}>
        <h1 style={{ textAlign: "center", fontSize: 34, marginBottom: 6 }}>
          🌙 مرصد الهلال
        </h1>

        <p style={{ textAlign: "center", opacity: 0.75, marginBottom: 22 }}>
          حساب وقت واتجاه رصد الهلال حسب موقع الراصد
        </p>

        <section style={card}>
          <h3>📍 موقع الراصد</h3>

          <input
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            placeholder="خط العرض"
            style={input}
          />

          <input
            value={lng}
            onChange={(e) => setLng(e.target.value)}
            placeholder="خط الطول"
            style={input}
          />

          <p style={{ fontSize: 13, opacity: 0.75 }}>
            DMS: {lat && lng ? `${toDMS(Number(lat), "lat")} , ${toDMS(Number(lng), "lng")}` : "-"}
          </p>

          <p style={{ fontSize: 13, opacity: 0.75 }}>
            دقة GPS: {accuracy ? `${accuracy} متر` : "-"}
          </p>
        </section>

        <section style={card}>
          <h3>🕒 وقت الرصد</h3>

          <input
            type="datetime-local"
            value={observeTime}
            onChange={(e) => setObserveTime(e.target.value)}
            style={input}
          />

          <button onClick={calculate} style={button}>
            🔭 احسب الرصد
          </button>
        </section>

        {result && (
          <section style={card}>
            <h3>📊 معيار عودة</h3>

            <div
              style={{
                padding: "14px 18px",
                borderRadius: 16,
                fontSize: 22,
                fontWeight: "bold",
                background: result.visibility.includes("✅")
                  ? "#16a34a"
                  : result.visibility.includes("⚠️")
                  ? "#f59e0b"
                  : "#dc2626",
                marginBottom: 16,
              }}
            >
              {result.visibility}
            </div>

            <h3>🧭 توجيه البوصلة</h3>
            <p style={big}>
              وجّه البوصلة إلى: {result.azimuth}°
            </p>
            <p style={{ opacity: 0.75 }}>
              هذه الدرجة هي اتجاه القمر من الشمال الحقيقي حسب موقعك.
            </p>

            <h3>🌇 أفضل أوقات الرصد</h3>
            <p>غروب الشمس: {result.sunset}</p>
            <p>غروب القمر: {result.moonset}</p>
            <p>بداية الرصد المقترحة: {result.startObserve}</p>
            <p style={highlight}>أفضل وقت للرصد: {result.bestObserve}</p>

            <h3>🌙 نتائج وقت الرصد الذي أدخلته</h3>
            <p>عمر الهلال: {result.age} يوم</p>
            <p>ارتفاع الهلال: {result.altitude}°</p>
            <p>إضاءة الهلال: {result.illumination}%</p>
            <p>الاستطالة: {result.elongation}°</p>
            <p>فرق الارتفاع ARCV: {result.arcv}°</p>
            <p>مكث الهلال: {result.lag} دقيقة</p>
          </section>
        )}
      </div>
    </main>
  );
}

const card: React.CSSProperties = {
  background: "rgba(15, 23, 42, 0.92)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 24,
  padding: 20,
  marginBottom: 18,
  textAlign: "center",
  boxShadow: "0 18px 45px rgba(0,0,0,0.35)",
};

const input: React.CSSProperties = {
  width: "100%",
  padding: 14,
  borderRadius: 14,
  border: "none",
  marginBottom: 10,
  fontSize: 16,
  textAlign: "center",
};

const button: React.CSSProperties = {
  width: "100%",
  padding: 16,
  borderRadius: 18,
  border: "none",
  background: "linear-gradient(135deg, #2563eb, #7c3aed)",
  color: "white",
  fontWeight: "bold",
  fontSize: 19,
  cursor: "pointer",
};

const big: React.CSSProperties = {
  fontSize: 24,
  fontWeight: "bold",
};

const highlight: React.CSSProperties = {
  fontSize: 20,
  fontWeight: "bold",
  color: "#93c5fd",
};