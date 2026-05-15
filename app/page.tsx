"use client";

import { useState } from "react";

function toLocalInputValue(iso?: string) {
  if (!iso) return "";
  const d = new Date(iso);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function fmtDate(iso?: string) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("ar-SA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function fmtDay(iso?: string) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("ar-SA", { weekday: "long" });
}

function fmtTime(iso?: string) {
  if (!iso) return "-";
  return new Date(iso).toLocaleTimeString("ar-SA", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function directionName(deg: string) {
  const d = Number(deg);
  if (d >= 337.5 || d < 22.5) return "شمال";
  if (d < 67.5) return "شمال شرقي";
  if (d < 112.5) return "شرق";
  if (d < 157.5) return "جنوب شرقي";
  if (d < 202.5) return "جنوب";
  if (d < 247.5) return "جنوب غربي";
  if (d < 292.5) return "غرب";
  return "شمال غربي";
}

export default function Page() {
  const [lat, setLat] = useState("26.4207");
  const [lng, setLng] = useState("50.0888");
  const [observeTime, setObserveTime] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  async function calculate() {
    setLoading(true);
    setResult(null);

    try {
      const url =
        `/api/hilal?lat=${encodeURIComponent(lat)}` +
        `&lng=${encodeURIComponent(lng)}` +
        (observeTime ? `&observeTime=${encodeURIComponent(observeTime)}` : "");

      const res = await fetch(url);
      const data = await res.json();

      setResult(data);

      if (data?.best?.best?.iso && !observeTime) {
        setObserveTime(toLocalInputValue(data.best.best.iso));
      }

      if (data.error) alert(data.error);
    } catch {
      alert("فشل الاتصال بالحسابات");
    } finally {
      setLoading(false);
    }
  }

  const best = result?.best?.best;
  const custom = result?.custom;

  const color =
    best?.visibilityLevel === "good"
      ? "#22c55e"
      : best?.visibilityLevel === "medium"
      ? "#f59e0b"
      : "#ef4444";

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <div style={styles.header}>
          <div style={styles.logo}>🌙</div>
          <h1 style={styles.title}>مرصد الهلال</h1>
          <p style={styles.subtitle}>أفضل وقت لرؤية الهلال الجديد حسب موقعك</p>
        </div>

        <section style={styles.card}>
          <label style={styles.label}>خط العرض</label>
          <input value={lat} onChange={(e) => setLat(e.target.value)} style={styles.input} />

          <label style={styles.label}>خط الطول</label>
          <input value={lng} onChange={(e) => setLng(e.target.value)} style={styles.input} />

          <label style={styles.label}>وقت رصدك أنت - اختياري</label>
          <input
            type="datetime-local"
            value={observeTime}
            onChange={(e) => setObserveTime(e.target.value)}
            style={styles.input}
          />

          <button onClick={calculate} style={styles.button}>
            {loading ? "جاري الحساب..." : "🔭 احسب"}
          </button>
        </section>

        {best && (
          <section style={{ ...styles.card, borderColor: color }}>
            <h2 style={{ ...styles.status, color }}>{best.visibility}</h2>

            <h3>⭐ أفضل وقت للرصد</h3>

            <Result label="التاريخ" value={fmtDate(best.iso)} />
            <Result label="اليوم" value={fmtDay(best.iso)} />
            <Result label="الساعة" value={fmtTime(best.iso)} />
            <Result
              label="الاتجاه بالبوصلة"
              value={`${best.azimuth}° - ${directionName(best.azimuth)}`}
            />
            <Result label="ارتفاع الهلال" value={`${best.altitude}°`} />
            <Result label="عمر الهلال" value={best.ageText} />
            <Result label="الاستطالة" value={`${best.elongation}°`} />
            <Result label="الإضاءة" value={`${best.illumination}%`} />

            <h3>🌇 معلومات الغروب</h3>

            <Result label="غروب الشمس" value={fmtTime(result.best.sunsetIso)} />
            <Result label="غروب القمر" value={fmtTime(result.best.moonsetIso)} />
            <Result label="مكث القمر" value={`${result.best.lag} دقيقة`} />
          </section>
        )}

        {custom && (
          <section style={styles.card}>
            <h3>🕒 نتائج وقت رصدك</h3>

            <Result label="التاريخ" value={fmtDate(custom.iso)} />
            <Result label="اليوم" value={fmtDay(custom.iso)} />
            <Result label="الساعة" value={fmtTime(custom.iso)} />
            <Result
              label="الاتجاه بالبوصلة"
              value={`${custom.azimuth}° - ${directionName(custom.azimuth)}`}
            />
            <Result label="ارتفاع الهلال" value={`${custom.altitude}°`} />
            <Result label="عمر الهلال" value={custom.ageText} />
            <Result label="الاستطالة" value={`${custom.elongation}°`} />
            <Result label="الإضاءة" value={`${custom.illumination}%`} />
            <Result label="حالة الرؤية" value={custom.visibility} />
          </section>
        )}
      </div>
    </main>
  );
}

function Result({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.result}>
      <div style={styles.resultLabel}>{label}</div>
      <div style={styles.resultValue}>{value}</div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "radial-gradient(circle at top,#0f172a,#020617,#000)",
    color: "white",
    fontFamily: "Arial, sans-serif",
    direction: "rtl",
    padding: 16,
  },
  container: { maxWidth: 520, margin: "0 auto" },
  header: { textAlign: "center", marginBottom: 24 },
  logo: { fontSize: 60 },
  title: { margin: 0, fontSize: 38 },
  subtitle: { opacity: 0.7 },
  card: {
    background: "rgba(15,23,42,.92)",
    border: "1px solid rgba(255,255,255,.08)",
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    boxShadow: "0 20px 45px rgba(0,0,0,.35)",
  },
  label: { display: "block", marginBottom: 8, opacity: 0.75 },
  input: {
    width: "100%",
    padding: 14,
    marginBottom: 16,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,.1)",
    background: "#020617",
    color: "white",
    fontSize: 18,
    boxSizing: "border-box",
  },
  button: {
    width: "100%",
    padding: 18,
    borderRadius: 18,
    border: "none",
    background: "linear-gradient(135deg,#2563eb,#7c3aed)",
    color: "white",
    fontSize: 24,
    fontWeight: "bold",
  },
  status: { textAlign: "center", fontSize: 28, marginTop: 0 },
  result: {
    background: "rgba(255,255,255,.06)",
    padding: 14,
    borderRadius: 14,
    marginBottom: 10,
  },
  resultLabel: { opacity: 0.7, marginBottom: 4 },
  resultValue: { fontSize: 22, fontWeight: "bold" },
};