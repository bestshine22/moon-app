"use client";

import { useState } from "react";

function localToIso(value: string) {
  if (!value) return "";
  return new Date(value).toISOString();
}

function toInputValue(iso?: string) {
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
  return new Date(iso).toLocaleDateString("ar-SA", {
    weekday: "long",
  });
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
        (observeTime
          ? `&observeTime=${encodeURIComponent(
              localToIso(observeTime)
            )}`
          : "");

      const res = await fetch(url);

      const data = await res.json();

      setResult(data);

      if (data?.best?.best?.iso && !observeTime) {
        setObserveTime(
          toInputValue(data.best.best.iso)
        );
      }

      if (data.error) {
        alert(data.error);
      }
    } catch {
      alert("فشل الاتصال بالحسابات");
    } finally {
      setLoading(false);
    }
  }

  const best = result?.best?.best;
  const custom = result?.custom;

  const statusColor =
    best?.visibilityLevel === "good"
      ? "#22c55e"
      : best?.visibilityLevel === "medium"
      ? "#f59e0b"
      : best?.visibilityLevel === "optical"
      ? "#60a5fa"
      : "#ef4444";

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <div style={styles.moon}>
            🌙
          </div>

          <h1 style={styles.title}>
            مرصد الهلال
          </h1>

          <p style={styles.subtitle}>
            حساب أفضل وقت لرؤية الهلال الجديد
          </p>
        </header>

        <section style={styles.inputCard}>
          <div style={styles.inputGrid}>
            <Field
              label="خط العرض"
              value={lat}
              setValue={setLat}
            />

            <Field
              label="خط الطول"
              value={lng}
              setValue={setLng}
            />

            <div>
              <label style={styles.label}>
                وقت رصدك أنت - اختياري
              </label>

              <input
                type="datetime-local"
                value={observeTime}
                onChange={(e) =>
                  setObserveTime(
                    e.target.value
                  )
                }
                style={styles.input}
              />
            </div>
          </div>

          <button
            onClick={calculate}
            style={styles.button}
          >
            {loading
              ? "جاري الحساب..."
              : "🔭 احسب"}
          </button>
        </section>

        {best && (
          <>
            <h2 style={styles.bigHeading}>
              🔭 أفضل وقت للرصد بالعين المجردة
            </h2>

            <section
              style={{
                ...styles.greenCard,
                borderColor:
                  statusColor,
              }}
            >
              <div
                style={{
                  ...styles.badge,
                  color:
                    statusColor,
                  borderColor:
                    statusColor,
                }}
              >
                {best.odehSymbol}{" "}
                {best.odehText}
              </div>

              <div style={styles.grid}>
                <Result
                  label="التاريخ"
                  value={fmtDate(
                    best.iso
                  )}
                  icon="📅"
                  green
                />

                <Result
                  label="اليوم"
                  value={fmtDay(
                    best.iso
                  )}
                  icon="🗓️"
                  green
                />

                <Result
                  label="الساعة"
                  value={fmtTime(
                    best.iso
                  )}
                  icon="🕒"
                  green
                />

                <Result
                  label="الاتجاه بالبوصلة"
                  value={`${best.azimuth}° - ${directionName(
                    best.azimuth
                  )}`}
                  icon="🧭"
                  green
                />

                <Result
                  label="ارتفاع الهلال"
                  value={`${best.altitude}°`}
                  icon="△"
                  green
                />

                <Result
                  label="عمر الهلال"
                  value={
                    best.ageText
                  }
                  icon="☾"
                  green
                />

                <Result
                  label="الاستطالة"
                  value={`${best.elongation}°`}
                  icon="☼"
                  green
                />

                <Result
                  label="الإضاءة"
                  value={`${best.illumination}%`}
                  icon="🌙"
                  green
                />
              </div>
            </section>

            <section
              style={
                styles.orangeCard
              }
            >
              <h2
                style={
                  styles.sectionTitle
                }
              >
                🌅 معلومات الغروب
              </h2>

              <div
                style={
                  styles.grid3
                }
              >
                <Result
                  label="غروب الشمس"
                  value={fmtTime(
                    result.best
                      .sunsetIso
                  )}
                  icon="🌇"
                  orange
                />

                <Result
                  label="غروب القمر"
                  value={fmtTime(
                    result.best
                      .moonsetIso
                  )}
                  icon="🌙"
                  orange
                />

                <Result
                  label="مكث القمر"
                  value={`${result.best.lag} دقيقة`}
                  icon="⌛"
                  orange
                />
              </div>
            </section>
          </>
        )}

        {custom && (
          <section
            style={styles.blueCard}
          >
            <h2
              style={
                styles.sectionTitle
              }
            >
              🕒 نتائج وقت رصدك
            </h2>

            <div style={styles.grid}>
              <Result
                label="حالة الرؤية"
                value={
                  custom.odehText
                }
                icon="👁️"
                blue
              />

              <Result
                label="التاريخ"
                value={fmtDate(
                  custom.iso
                )}
                icon="📅"
                blue
              />

              <Result
                label="اليوم"
                value={fmtDay(
                  custom.iso
                )}
                icon="🗓️"
                blue
              />

              <Result
                label="الساعة"
                value={fmtTime(
                  custom.iso
                )}
                icon="🕒"
                blue
              />

              <Result
                label="الاتجاه بالبوصلة"
                value={`${custom.azimuth}° - ${directionName(
                  custom.azimuth
                )}`}
                icon="🧭"
                blue
              />

              <Result
                label="ارتفاع الهلال"
                value={`${custom.altitude}°`}
                icon="△"
                blue
              />

              <Result
                label="عمر الهلال"
                value={
                  custom.ageText
                }
                icon="☾"
                blue
              />

              <Result
                label="الاستطالة"
                value={`${custom.elongation}°`}
                icon="☼"
                blue
              />

              <Result
                label="الإضاءة"
                value={`${custom.illumination}%`}
                icon="🌙"
                blue
              />
            </div>
          </section>
        )}

        <div style={styles.note}>
          ℹ️ الحساب يستخدم
          معيار عودة للرؤية
          بالعين المجردة،
          وقد تتأثر الرؤية
          الفعلية بصفاء الجو
          والغبار والأفق.
        </div>
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  setValue,
}: any) {
  return (
    <div>
      <label style={styles.label}>
        {label}
      </label>

      <input
        value={value}
        onChange={(e) =>
          setValue(
            e.target.value
          )
        }
        style={styles.input}
      />
    </div>
  );
}

function Result({
  label,
  value,
  icon,
  green,
  orange,
  blue,
}: any) {
  const color = green
    ? "#4ade80"
    : orange
    ? "#fb923c"
    : blue
    ? "#60a5fa"
    : "white";

  return (
    <div style={styles.result}>
      <div
        style={
          styles.resultLabel
        }
      >
        {label}
      </div>

      <div style={styles.icon}>
        {icon}
      </div>

      <div
        style={{
          ...styles.resultValue,
          color,
        }}
      >
        {value}
      </div>
    </div>
  );
}

const styles: Record<
  string,
  React.CSSProperties
> = {
  page: {
    minHeight: "100vh",
    background:
      "radial-gradient(circle at top,#0f172a,#020617 45%,#000)",
    color: "white",
    fontFamily:
      "Arial, sans-serif",
    direction: "rtl",
    padding: 14,
  },

  container: {
    maxWidth: 980,
    margin: "0 auto",
  },

  header: {
    textAlign: "center",
    padding: "18px 0",
  },

  moon: {
    fontSize: 70,
  },

  title: {
    fontSize: 42,
    margin: 0,
  },

  subtitle: {
    opacity: 0.75,
    fontSize: 18,
  },

  inputCard: {
    background:
      "rgba(15,23,42,.92)",
    border:
      "1px solid rgba(255,255,255,.12)",
    borderRadius: 22,
    padding: 22,
    marginBottom: 26,
    boxShadow:
      "0 18px 50px rgba(0,0,0,.35)",
  },

  inputGrid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit,minmax(220px,1fr))",
    gap: 18,
  },

  label: {
    display: "block",
    marginBottom: 8,
    fontSize: 18,
    fontWeight: "bold",
  },

  input: {
    width: "100%",
    padding: 16,
    borderRadius: 12,
    border:
      "1px solid rgba(255,255,255,.15)",
    background: "#020617",
    color: "white",
    fontSize: 20,
    boxSizing:
      "border-box",
  },

  button: {
    width: "100%",
    marginTop: 22,
    padding: 18,
    borderRadius: 12,
    border: "none",
    background:
      "linear-gradient(135deg,#2563eb,#7c3aed)",
    color: "white",
    fontSize: 26,
    fontWeight: "bold",
  },

  bigHeading: {
    textAlign: "center",
    fontSize: 44,
    margin: "28px 0",
    textShadow:
      "0 0 18px rgba(255,255,255,.35)",
  },

  greenCard: {
    background:
      "rgba(15,23,42,.92)",
    border:
      "1px solid #22c55e",
    borderRadius: 22,
    padding: 22,
    marginBottom: 20,
  },

  orangeCard: {
    background:
      "rgba(15,23,42,.92)",
    border:
      "1px solid #fb923c",
    borderRadius: 22,
    padding: 22,
    marginBottom: 20,
  },

  blueCard: {
    background:
      "rgba(15,23,42,.92)",
    border:
      "1px solid #3b82f6",
    borderRadius: 22,
    padding: 22,
    marginBottom: 20,
  },

  badge: {
    display: "inline-block",
    border: "1px solid",
    borderRadius: 999,
    padding: "10px 18px",
    marginBottom: 18,
    fontSize: 20,
    fontWeight: "bold",
  },

  sectionTitle: {
    fontSize: 28,
    marginTop: 0,
  },

  grid: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit,minmax(190px,1fr))",
    gap: 14,
  },

  grid3: {
    display: "grid",
    gridTemplateColumns:
      "repeat(auto-fit,minmax(220px,1fr))",
    gap: 14,
  },

  result: {
    background:
      "rgba(255,255,255,.06)",
    borderRadius: 14,
    padding: 14,
    textAlign: "center",
    minHeight: 110,
  },

  resultLabel: {
    opacity: 0.78,
    fontSize: 16,
  },

  icon: {
    fontSize: 28,
    margin: "8px 0",
  },

  resultValue: {
    fontSize: 24,
    fontWeight: "bold",
  },

  note: {
    border:
      "1px solid #3b82f6",
    borderRadius: 18,
    padding: 18,
    textAlign: "center",
    fontSize: 18,
    opacity: 0.9,
    marginBottom: 30,
  },
};