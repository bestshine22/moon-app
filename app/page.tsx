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

function fmtTime(date?: Date) {
  if (!date) return "-";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function addMinutes(date: Date, min: number) {
  return new Date(date.getTime() + min * 60000);
}

function moonData(date: Date, lat: number, lng: number) {
  const moon = SunCalc.getMoonPosition(date, lat, lng);
  const illum = SunCalc.getMoonIllumination(date);
  const azimuth = (rad2deg(moon.azimuth) + 180 + 360) % 360;

  return {
    altitude: rad2deg(moon.altitude).toFixed(2),
    azimuth: azimuth.toFixed(2),
    age: (illum.phase * 29.530588).toFixed(2),
    elongation: (illum.phase * 360).toFixed(2),
  };
}

export default function Page() {
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [observeTime, setObserveTime] = useState(getLocalDateTime());
  const [mainResult, setMainResult] = useState<any>(null);
  const [customResult, setCustomResult] = useState<any>(null);

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition((pos) => {
      setLat(pos.coords.latitude.toFixed(6));
      setLng(pos.coords.longitude.toFixed(6));
    });
  }, []);

  function calculate() {
    const la = Number(lat);
    const lo = Number(lng);
    const now = new Date();

    const times = SunCalc.getTimes(now, la, lo);
    const moonTimes = SunCalc.getMoonTimes(now, la, lo);
    const sunset = times.sunset;
    const moonset = moonTimes.set;

    const lag =
      moonset && sunset
        ? (moonset.getTime() - sunset.getTime()) / 60000
        : 0;

    let bestTime: Date | null = null;

    if (sunset && moonset && moonset > sunset) {
      const bestOffset = Math.max(10, Math.min(30, lag * 0.35));
      bestTime = addMinutes(sunset, bestOffset);
    }

    const bestData = bestTime ? moonData(bestTime, la, lo) : null;

    setMainResult({
      sunset: fmtTime(sunset),
      moonset: fmtTime(moonset),
      lag: lag.toFixed(1),
      bestTime: bestTime ? fmtTime(bestTime) : "-",
      bestData,
    });

    calculateCustom();
  }

  function calculateCustom() {
    const la = Number(lat);
    const lo = Number(lng);
    const date = new Date(observeTime);
    setCustomResult(moonData(date, la, lo));
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <div style={styles.moon}>🌙</div>
          <h1 style={styles.title}>مرصد الهلال</h1>
          <p style={styles.subtitle}>حساب أفضل وقت واتجاه رصد الهلال حسب موقعك</p>
        </header>

        <section style={styles.card}>
          <h2 style={styles.cardTitle}>📍 موقع الراصد</h2>

          <label style={styles.label}>خط العرض</label>
          <input
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            style={styles.input}
          />

          <label style={styles.label}>خط الطول</label>
          <input
            value={lng}
            onChange={(e) => setLng(e.target.value)}
            style={styles.input}
          />

          <button onClick={calculate} style={styles.primaryButton}>
            🔭 احسب
          </button>
        </section>

        {mainResult && (
          <section style={styles.card}>
            <h2 style={styles.cardTitle}>🌇 معلومات اليوم</h2>

            <div style={styles.resultGrid}>
              <Result label="غروب الشمس" value={mainResult.sunset} />
              <Result label="غروب القمر" value={mainResult.moonset} />
              <Result label="مكث القمر" value={`${mainResult.lag} دقيقة`} />
            </div>

            <h2 style={styles.cardTitle}>⭐ أفضل وقت للرصد</h2>

            <div style={styles.highlightBox}>
              <Result label="أفضل وقت" value={mainResult.bestTime} />
              <Result label="الارتفاع" value={`${mainResult.bestData?.altitude ?? "-"}°`} />
              <Result label="العمر" value={`${mainResult.bestData?.age ?? "-"} يوم`} />
              <Result label="الاستطالة" value={`${mainResult.bestData?.elongation ?? "-"}°`} />
              <Result label="درجة توجيه البوصلة" value={`${mainResult.bestData?.azimuth ?? "-"}°`} />
            </div>
          </section>
        )}

        <section style={styles.card}>
          <h2 style={styles.cardTitle}>🕒 وقت رصدك أنت</h2>

          <input
            type="datetime-local"
            value={observeTime}
            onChange={(e) => setObserveTime(e.target.value)}
            style={styles.input}
          />

          <button onClick={calculateCustom} style={styles.secondaryButton}>
            احسب وقت رصدي
          </button>

          {customResult && (
            <div style={styles.customBox}>
              <Result label="العمر وقت رصدي" value={`${customResult.age} يوم`} />
              <Result label="الارتفاع وقت رصدي" value={`${customResult.altitude}°`} />
              <Result label="الاستطالة وقت رصدي" value={`${customResult.elongation}°`} />
              <Result label="درجة توجيه البوصلة وقت رصدي" value={`${customResult.azimuth}°`} />
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Result({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.resultItem}>
      <div style={styles.resultLabel}>{label}</div>
      <div style={styles.resultValue}>{value}</div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(circle at top, #1e3a8a 0%, #020617 38%, #000 100%)",
    color: "white",
    fontFamily: "Arial, sans-serif",
    padding: 18,
    direction: "rtl",
  },
  container: {
    maxWidth: 520,
    margin: "0 auto",
  },
  header: {
    textAlign: "center",
    padding: "20px 0",
  },
  moon: {
    fontSize: 50,
  },
  title: {
    margin: "8px 0",
    fontSize: 34,
  },
  subtitle: {
    opacity: 0.75,
    margin: 0,
  },
  card: {
    background: "rgba(15, 23, 42, 0.9)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 24,
    padding: 20,
    marginBottom: 18,
    boxShadow: "0 18px 45px rgba(0,0,0,0.35)",
  },
  cardTitle: {
    fontSize: 20,
    marginTop: 0,
    marginBottom: 14,
  },
  label: {
    display: "block",
    marginBottom: 6,
    opacity: 0.85,
  },
  input: {
    width: "100%",
    padding: 14,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "#020617",
    color: "white",
    marginBottom: 12,
    fontSize: 16,
    boxSizing: "border-box",
  },
  primaryButton: {
    width: "100%",
    padding: 16,
    borderRadius: 18,
    border: "none",
    background: "linear-gradient(135deg, #2563eb, #7c3aed)",
    color: "white",
    fontSize: 20,
    fontWeight: "bold",
    cursor: "pointer",
  },
  secondaryButton: {
    width: "100%",
    padding: 14,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.15)",
    background: "#334155",
    color: "white",
    fontSize: 17,
    fontWeight: "bold",
    cursor: "pointer",
  },
  resultGrid: {
    display: "grid",
    gap: 10,
  },
  highlightBox: {
    display: "grid",
    gap: 10,
    background: "rgba(37, 99, 235, 0.12)",
    borderRadius: 18,
    padding: 14,
  },
  customBox: {
    marginTop: 16,
    display: "grid",
    gap: 10,
  },
  resultItem: {
    background: "rgba(255,255,255,0.06)",
    borderRadius: 14,
    padding: 12,
  },
  resultLabel: {
    fontSize: 13,
    opacity: 0.7,
    marginBottom: 4,
  },
  resultValue: {
    fontSize: 20,
    fontWeight: "bold",
  },
};