"use client";

import { useEffect, useState } from "react";

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
    second: "2-digit",
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

function decimalToDMS(value: string, type: "lat" | "lng") {
  const num = Number(value);
  if (!Number.isFinite(num)) return "-";

  const absolute = Math.abs(num);
  const degrees = Math.floor(absolute);
  const minutesFloat = (absolute - degrees) * 60;
  const minutes = Math.floor(minutesFloat);
  const seconds = ((minutesFloat - minutes) * 60).toFixed(2);

  const direction =
    type === "lat"
      ? num >= 0
        ? "N"
        : "S"
      : num >= 0
      ? "E"
      : "W";

  return `${degrees}° ${minutes}' ${seconds}" ${direction}`;
}

export default function Page() {
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [height, setHeight] = useState("0");
  const [observeTime, setObserveTime] = useState("");
  const [gpsStatus, setGpsStatus] = useState("لم يتم تحديد الموقع بعد");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  function updateLocation() {
    if (!navigator.geolocation) {
      setGpsStatus("المتصفح لا يدعم تحديد الموقع");
      return;
    }

    setGpsStatus("جاري تحديد موقعك الحالي...");

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));

        if (
          pos.coords.altitude !== null &&
          Number.isFinite(pos.coords.altitude)
        ) {
          setHeight(pos.coords.altitude.toFixed(0));
        }

        setGpsStatus(
          `تم تحديد موقعك الحالي بدقة تقريبية ${Math.round(
            pos.coords.accuracy
          )} متر`
        );
      },
      () => {
        setGpsStatus(
          "تعذر تحديد الموقع. تأكد من تفعيل إذن الموقع أو أدخل الإحداثيات يدويًا."
        );
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 20000,
      }
    );
  }

  useEffect(() => {
    updateLocation();
  }, []);

  async function calculate() {
    if (!lat || !lng) {
      alert("حدد موقعك أو أدخل خط العرض وخط الطول");
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const url =
        `/api/hilal?lat=${encodeURIComponent(lat)}` +
        `&lng=${encodeURIComponent(lng)}` +
        `&height=${encodeURIComponent(height || "0")}` +
        (observeTime
          ? `&observeTime=${encodeURIComponent(localToIso(observeTime))}`
          : "");

      const res = await fetch(url);
      const data = await res.json();

      setResult(data);

      if (data?.hilal?.visualBest?.iso && !observeTime) {
        setObserveTime(toInputValue(data.hilal.visualBest.iso));
      }

      if (data.error) alert(data.error);
    } catch {
      alert("فشل الاتصال بالحسابات");
    } finally {
      setLoading(false);
    }
  }

  const nowData = result?.nowData;
  const visualBest = result?.hilal?.visualBest;
  const custom = result?.custom;

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <div style={styles.moon}>🌙</div>
          <h1 style={styles.title}>مرصد الهلال</h1>
          <p style={styles.subtitle}>
            حسابات فلكية دقيقة للهلال حسب موقعك الحالي والوقت
          </p>
        </header>

        <section style={styles.inputCard}>
          <p style={styles.gpsStatus}>📍 {gpsStatus}</p>

          <div style={styles.inputGrid}>
            <Field label="خط العرض" value={lat} setValue={setLat} />
            <Field label="خط الطول" value={lng} setValue={setLng} />
            <Field label="الارتفاع م" value={height} setValue={setHeight} />

            <div style={styles.fieldWrap}>
              <label style={styles.label}>الإحداثيات DMS</label>
              <div style={styles.dmsBox}>
                <div>{decimalToDMS(lat, "lat")}</div>
                <div>{decimalToDMS(lng, "lng")}</div>
              </div>
            </div>
          </div>

          <button onClick={updateLocation} style={styles.secondaryButton}>
            📍 تحديث موقعي الآن
          </button>

          <button onClick={calculate} style={styles.button}>
            {loading ? "جاري الحساب..." : "🔭 احسب"}
          </button>
        </section>

        {nowData && (
          <section style={styles.greenCard}>
            <h2 style={styles.bigHeading}>🌙 حالة القمر الآن حسب موقعك</h2>

            <div style={styles.grid}>
              <Result label="التاريخ" value={fmtDate(nowData.iso)} icon="📅" green />
              <Result label="اليوم" value={fmtDay(nowData.iso)} icon="🗓️" green />
              <Result label="الساعة" value={fmtTime(nowData.iso)} icon="🕒" green />
              <Result label="ارتفاع القمر الآن" value={`${nowData.altitude}°`} icon="△" green />
              <Result
                label="اتجاه القمر الآن"
                value={`${nowData.azimuth}° - ${directionName(nowData.azimuth)}`}
                icon="🧭"
                green
              />
              <Result label="عمر القمر الآن" value={nowData.ageText} icon="☾" green />
              <Result label="الاستطالة الآن" value={`${nowData.elongation}°`} icon="☼" green />
              <Result label="الإضاءة الآن" value={`${nowData.illumination}%`} icon="🌙" green />
            </div>
          </section>
        )}

        {visualBest && (
          <section style={styles.orangeCard}>
            <h2 style={styles.bigHeading}>👁️ أفضل وقت لرصد هلال بداية الشهر</h2>

            <div style={styles.grid}>
              <Result label="التاريخ" value={fmtDate(visualBest.iso)} icon="📅" orange />
              <Result label="اليوم" value={fmtDay(visualBest.iso)} icon="🗓️" orange />
              <Result label="الساعة" value={fmtTime(visualBest.iso)} icon="🕒" orange />
              <Result label="ارتفاع الهلال" value={`${visualBest.altitude}°`} icon="△" orange />
              <Result
                label="اتجاه الهلال"
                value={`${visualBest.azimuth}° - ${directionName(visualBest.azimuth)}`}
                icon="🧭"
                orange
              />
              <Result label="عمر الهلال" value={visualBest.ageText} icon="☾" orange />
              <Result label="الاستطالة" value={`${visualBest.elongation}°`} icon="☼" orange />
              <Result label="الإضاءة" value={`${visualBest.illumination}%`} icon="🌙" orange />
              <Result label="غروب الشمس" value={fmtTime(result.hilal.sunsetIso)} icon="🌇" orange />
              <Result label="غروب القمر" value={fmtTime(result.hilal.moonsetIso)} icon="🌙" orange />
              <Result label="مكث القمر" value={`${result.hilal.lag} دقيقة`} icon="⌛" orange />
            </div>
          </section>
        )}

        <section style={styles.blueCard}>
          <h2 style={styles.sectionTitle}>🛰️ تحليل وقت الرصد الحقيقي</h2>

          <div style={styles.observationText}>
            حسب موقعك الحالي:
            <br />
            <span>{decimalToDMS(lat, "lat")}</span>
            <br />
            <span>{decimalToDMS(lng, "lng")}</span>
            <br />
            لمعرفة معطيات الهلال في الوقت الذي تمت فيه رؤية الهلال، قم بإدخال وقت الرصد الفعلي هنا.
          </div>

          <input
            type="datetime-local"
            value={observeTime}
            onChange={(e) => setObserveTime(e.target.value)}
            style={styles.fullInput}
          />

          <button onClick={calculate} style={styles.secondaryButton}>
            احسب معطيات وقت الرصد
          </button>

          {custom && (
            <div style={styles.grid}>
              <Result label="وقت الرصد" value={fmtTime(custom.iso)} icon="🕒" blue />
              <Result label="ارتفاع الهلال" value={`${custom.altitude}°`} icon="△" blue />
              <Result label="الاستطالة" value={`${custom.elongation}°`} icon="☼" blue />
              <Result label="الإضاءة" value={`${custom.illumination}%`} icon="🌙" blue />
              <Result label="عمر الهلال" value={custom.ageText} icon="☾" blue />
              <Result
                label="اتجاه الهلال"
                value={`${custom.azimuth}° - ${directionName(custom.azimuth)}`}
                icon="🧭"
                blue
              />
              <Result label="مكث القمر المتبقي" value={`${custom.remainingMoonset} دقيقة`} icon="⌛" blue />
            </div>
          )}
        </section>

        <div style={styles.note}>
          ℹ️ تم فصل حالة القمر الآن عن أفضل وقت لرصد هلال بداية الشهر وعن تحليل وقت الرصد الحقيقي.
        </div>
      </div>
    </main>
  );
}

function Field({ label, value, setValue }: any) {
  return (
    <div style={styles.fieldWrap}>
      <label style={styles.label}>{label}</label>
      <input value={value} onChange={(e) => setValue(e.target.value)} style={styles.input} />
    </div>
  );
}

function Result({ label, value, icon, green, orange, blue }: any) {
  const color = green ? "#4ade80" : orange ? "#fb923c" : blue ? "#60a5fa" : "white";

  return (
    <div style={styles.result}>
      <div style={styles.resultLabel}>{label}</div>
      <div style={styles.icon}>{icon}</div>
      <div style={{ ...styles.resultValue, color }}>{value}</div>
    </div>
  );
}

const boxHeight = 78;

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "radial-gradient(circle at top,#0f172a,#020617 45%,#000)",
    color: "white",
    fontFamily: "Arial, sans-serif",
    direction: "rtl",
    padding: 14,
  },
  container: { maxWidth: 1180, margin: "0 auto" },
  header: { textAlign: "center", padding: "18px 0" },
  moon: { fontSize: 70 },
  title: { fontSize: 42, margin: 0 },
  subtitle: { opacity: 0.75, fontSize: 18 },
  inputCard: {
    background: "rgba(15,23,42,.92)",
    border: "1px solid rgba(255,255,255,.12)",
    borderRadius: 22,
    padding: 26,
    marginBottom: 26,
    boxShadow: "0 18px 50px rgba(0,0,0,.35)",
  },
  gpsStatus: {
    textAlign: "center",
    opacity: 0.85,
    marginTop: 0,
    marginBottom: 20,
    fontSize: 16,
  },
  inputGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
    gap: 22,
    alignItems: "end",
  },
  fieldWrap: {
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
  },
  label: {
    display: "block",
    marginBottom: 10,
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
    minHeight: 24,
  },
  input: {
    width: "100%",
    height: boxHeight,
    padding: "0 20px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,.15)",
    background: "#020617",
    color: "white",
    fontSize: 22,
    boxSizing: "border-box",
    textAlign: "center",
  },
  fullInput: {
    width: "100%",
    height: boxHeight,
    padding: "0 20px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,.15)",
    background: "#020617",
    color: "white",
    fontSize: 22,
    boxSizing: "border-box",
    textAlign: "center",
    marginBottom: 16,
  },
  dmsBox: {
    width: "100%",
    height: boxHeight,
    background: "rgba(255,255,255,.06)",
    border: "1px solid rgba(255,255,255,.15)",
    borderRadius: 14,
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    direction: "ltr",
    fontFamily: "monospace",
    fontSize: 19,
    fontWeight: "bold",
    textAlign: "center",
    whiteSpace: "nowrap",
  },
  button: {
    width: "100%",
    marginTop: 20,
    padding: 18,
    borderRadius: 14,
    border: "none",
    background: "linear-gradient(135deg,#2563eb,#7c3aed)",
    color: "white",
    fontSize: 26,
    fontWeight: "bold",
  },
  secondaryButton: {
    width: "100%",
    marginTop: 16,
    padding: 16,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,.16)",
    background: "rgba(59,130,246,.28)",
    color: "white",
    fontSize: 22,
    fontWeight: "bold",
  },
  bigHeading: {
    textAlign: "center",
    fontSize: 34,
    margin: "8px 0 22px",
  },
  greenCard: {
    background: "rgba(15,23,42,.92)",
    border: "1px solid #22c55e",
    borderRadius: 22,
    padding: 22,
    marginBottom: 20,
  },
  orangeCard: {
    background: "rgba(15,23,42,.92)",
    border: "1px solid #fb923c",
    borderRadius: 22,
    padding: 22,
    marginBottom: 20,
  },
  blueCard: {
    background: "rgba(15,23,42,.92)",
    border: "1px solid #3b82f6",
    borderRadius: 22,
    padding: 22,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 28,
    textAlign: "center",
    marginTop: 0,
  },
  observationText: {
    background: "rgba(255,255,255,.06)",
    borderRadius: 14,
    padding: 16,
    marginBottom: 16,
    textAlign: "center",
    lineHeight: 1.8,
    fontSize: 18,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))",
    gap: 14,
  },
  result: {
    background: "rgba(255,255,255,.06)",
    borderRadius: 14,
    padding: 14,
    textAlign: "center",
    minHeight: 110,
  },
  resultLabel: { opacity: 0.78, fontSize: 16 },
  icon: { fontSize: 28, margin: "8px 0" },
  resultValue: { fontSize: 24, fontWeight: "bold" },
  note: {
    border: "1px solid #3b82f6",
    borderRadius: 18,
    padding: 18,
    textAlign: "center",
    fontSize: 18,
    opacity: 0.9,
    marginBottom: 30,
  },
};