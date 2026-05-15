"use client";

import { useEffect, useState } from "react";

function localInputNow() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}

function fmtDateTime(iso?: string) {
  if (!iso) return { date: "-", day: "-", time: "-" };

  const d = new Date(iso);

  return {
    date: d.toLocaleDateString("ar-SA", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    day: d.toLocaleDateString("ar-SA", { weekday: "long" }),
    time: d.toLocaleTimeString("ar-SA", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  };
}

export default function Page() {
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [observeTime, setObserveTime] = useState(localInputNow());
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [gpsStatus, setGpsStatus] = useState("جاري قراءة الموقع...");

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
        setGpsStatus(`تم تحديد الموقع - الدقة ${Math.round(pos.coords.accuracy)} متر`);
      },
      () => {
        setGpsStatus("تعذر قراءة الموقع، أدخل الإحداثيات يدويًا");
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }
    );
  }, []);

  async function calculate() {
    setLoading(true);
    setResult(null);

    try {
      const url =
        `/api/hilal?lat=${encodeURIComponent(lat)}` +
        `&lng=${encodeURIComponent(lng)}` +
        `&observeTime=${encodeURIComponent(observeTime)}`;

      const res = await fetch(url);
      const json = await res.json();

      setResult(json);
    } catch {
      setResult({ error: "حدث خطأ أثناء الحساب" });
    } finally {
      setLoading(false);
    }
  }

  const bestDT = fmtDateTime(result?.best?.best?.iso);
  const newMoonDT = fmtDateTime(result?.best?.newMoonIso);
  const sunsetDT = fmtDateTime(result?.best?.sunsetIso);
  const moonsetDT = fmtDateTime(result?.best?.moonsetIso);
  const customDT = fmtDateTime(result?.custom?.iso);

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <div style={styles.moon}>🌙</div>
          <h1 style={styles.title}>مرصد الهلال</h1>
          <p style={styles.subtitle}>حساب أفضل وقت لرصد الهلال الجديد حسب موقعك</p>
        </header>

        <section style={styles.card}>
          <h2 style={styles.cardTitle}>📍 موقع الراصد</h2>

          <p style={styles.note}>{gpsStatus}</p>

          <label style={styles.label}>خط العرض</label>
          <input value={lat} onChange={(e) => setLat(e.target.value)} style={styles.input} />

          <label style={styles.label}>خط الطول</label>
          <input value={lng} onChange={(e) => setLng(e.target.value)} style={styles.input} />

          <button onClick={calculate} style={styles.primaryButton}>
            {loading ? "جاري الحساب..." : "🔭 احسب"}
          </button>
        </section>

        {result?.error && (
          <section style={styles.card}>
            <h2>{result.error}</h2>
          </section>
        )}

        {result?.best && (
          <section style={styles.card}>
            <h2 style={styles.cardTitle}>🌑 الاقتران / الهلال الجديد القادم</h2>
            <Result label="تاريخ الاقتران" value={newMoonDT.date} />
            <Result label="اليوم" value={newMoonDT.day} />
            <Result label="وقت الاقتران" value={newMoonDT.time} />

            <h2 style={styles.cardTitle}>🌇 معلومات يوم الرصد</h2>
            <Result label="غروب الشمس" value={sunsetDT.time} />
            <Result label="غروب القمر" value={moonsetDT.time} />
            <Result label="مكث القمر" value={`${result.best.lag} دقيقة`} />

            <h2 style={styles.cardTitle}>⭐ أفضل وقت لرصد الهلال حسب موقعك</h2>
            <div style={styles.highlightBox}>
              <Result label="التاريخ" value={bestDT.date} />
              <Result label="اليوم" value={bestDT.day} />
              <Result label="الساعة" value={bestDT.time} />
              <Result label="الاتجاه بالبوصلة" value={`${result.best.best.azimuth}°`} />
              <Result label="الارتفاع" value={`${result.best.best.altitude}°`} />
              <Result label="العمر" value={result.best.best.ageText} />
              <Result label="الاستطالة" value={`${result.best.best.elongation}°`} />
              <Result label="الإضاءة" value={`${result.best.best.illumination}%`} />
              <Result label="ARCV" value={`${result.best.best.arcv}°`} />
              <Result label="عرض الهلال W" value={`${result.best.best.width} دقيقة قوسية`} />
              <Result label="معيار عودة" value={result.best.best.visibility} />
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

          <button onClick={calculate} style={styles.secondaryButton}>
            احسب حسب وقت رصدي
          </button>

          {result?.custom && (
            <div style={styles.customBox}>
              <Result label="موقعي بالإحداثيات" value={`${lat}, ${lng}`} />
              <Result label="التاريخ" value={customDT.date} />
              <Result label="اليوم" value={customDT.day} />
              <Result label="الساعة" value={customDT.time} />
              <Result label="عمر القمر" value={result.custom.ageText} />
              <Result label="الارتفاع" value={`${result.custom.altitude}°`} />
              <Result label="الاستطالة" value={`${result.custom.elongation}°`} />
              <Result label="الإضاءة" value={`${result.custom.illumination}%`} />
              <Result label="الاتجاه بالبوصلة" value={`${result.custom.azimuth}°`} />
              <Result label="معيار عودة" value={result.custom.visibility} />
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
  container: { maxWidth: 520, margin: "0 auto" },
  header: { textAlign: "center", padding: "20px 0" },
  moon: { fontSize: 50 },
  title: { margin: "8px 0", fontSize: 34 },
  subtitle: { opacity: 0.75, margin: 0 },
  card: {
    background: "rgba(15,23,42,.9)",
    border: "1px solid rgba(255,255,255,.08)",
    borderRadius: 24,
    padding: 20,
    marginBottom: 18,
    boxShadow: "0 18px 45px rgba(0,0,0,.35)",
  },
  cardTitle: { fontSize: 20, marginTop: 0, marginBottom: 14 },
  note: { opacity: 0.75, fontSize: 13 },
  label: { display: "block", marginBottom: 6, opacity: 0.85 },
  input: {
    width: "100%",
    padding: 14,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,.12)",
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
    background: "linear-gradient(135deg,#2563eb,#7c3aed)",
    color: "white",
    fontSize: 20,
    fontWeight: "bold",
    cursor: "pointer",
  },
  secondaryButton: {
    width: "100%",
    padding: 14,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,.15)",
    background: "#334155",
    color: "white",
    fontSize: 17,
    fontWeight: "bold",
    cursor: "pointer",
  },
  highlightBox: {
    display: "grid",
    gap: 10,
    background: "rgba(37,99,235,.12)",
    borderRadius: 18,
    padding: 14,
  },
  customBox: { marginTop: 16, display: "grid", gap: 10 },
  resultItem: {
    background: "rgba(255,255,255,.06)",
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  resultLabel: { fontSize: 13, opacity: 0.7, marginBottom: 4 },
  resultValue: { fontSize: 20, fontWeight: "bold" },
};