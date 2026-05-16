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

const GREGORIAN_LOCALE = "en-GB";

function fmtDate(iso?: string) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString(GREGORIAN_LOCALE, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function fmtDay(iso?: string) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString(GREGORIAN_LOCALE, {
    weekday: "long",
  });
}

function fmtTime(iso?: string) {
  if (!iso) return "-";
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
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

function DmsText({ value }: { value: string }) {
  return (
    <span
      dir="ltr"
      style={{
        unicodeBidi: "isolate",
        display: "inline-block",
        fontFamily: "monospace",
        fontWeight: 800,
        letterSpacing: "0.3px",
      }}
    >
      {value}
    </span>
  );
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
        setGpsStatus("تعذر تحديد الموقع. تأكد من تفعيل إذن الموقع.");
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
      alert("حدد موقعك أولًا");
      return;
    }

    setLoading(true);

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
    <main style={pageStyle}>
      <div style={containerStyle}>
        <header style={headerStyle}>
          <div style={{ fontSize: 70 }}>🌙</div>
          <h1 style={titleStyle}>مرصد الهلال</h1>

          <p style={subtitleStyle}>
            حسابات فلكية دقيقة للهلال حسب موقعك والوقت
          </p>

          <p style={nasaStatusStyle}>
            NASA JPL ACTIVE
          </p>
        </header>

        <section style={inputCardStyle}>
          <p style={gpsStyle}>📍 {gpsStatus}</p>

          <div style={inputGridStyle}>
            <Field label="خط العرض" value={lat} setValue={setLat} />
            <Field label="خط الطول" value={lng} setValue={setLng} />
            <Field label="الارتفاع م" value={height} setValue={setHeight} />

            <div style={fieldWrapStyle}>
              <div style={labelStyle}>الإحداثيات DMS</div>
              <div style={dmsBoxStyle}>
                <div>
                  <DmsText value={decimalToDMS(lat, "lat")} />
                </div>
                <div>
                  <DmsText value={decimalToDMS(lng, "lng")} />
                </div>
              </div>
            </div>
          </div>

          <button onClick={updateLocation} style={btn2}>
            📍 تحديث موقعي الآن
          </button>

          <button onClick={calculate} style={btn}>
            {loading ? "جاري الحساب..." : "🔭 احسب"}
          </button>
        </section>

        {nowData && (
          <Section
            title="🌙 حالة القمر الآن حسب موقعك"
            color="#22c55e"
            data={[
              ["التاريخ", fmtDate(nowData.iso), "📅"],
              ["اليوم", fmtDay(nowData.iso), "🗓️"],
              ["الساعة", fmtTime(nowData.iso), "🕒"],
              ["ارتفاع القمر الآن", `${nowData.altitude}°`, "△", nowData.jplVerified],
              [
                "اتجاه القمر الآن",
                `${nowData.azimuth}° - ${directionName(nowData.azimuth)}`,
                "🧭",
                nowData.jplVerified,
              ],
              ["عمر القمر الآن", nowData.ageText, "☾"],
              ["الاستطالة الآن", `${nowData.elongation}°`, "☼", nowData.jplVerified],
              ["الإضاءة الآن", `${nowData.illumination}%`, "🌙"],
            ]}
          />
        )}

        {visualBest && (
          <Section
            title="👁️ أفضل وقت لرصد هلال بداية الشهر"
            color="#fb923c"
            data={[
              ["التاريخ", fmtDate(visualBest.iso), "📅"],
              ["اليوم", fmtDay(visualBest.iso), "🗓️"],
              ["الساعة", fmtTime(visualBest.iso), "🕒"],
              ["ارتفاع الهلال", `${visualBest.altitude}°`, "△", visualBest.jplVerified],
              [
                "اتجاه الهلال",
                `${visualBest.azimuth}° - ${directionName(
                  visualBest.azimuth
                )}`,
                "🧭",
                visualBest.jplVerified,
              ],
              ["عمر الهلال", visualBest.ageText, "☾"],
              ["الاستطالة", `${visualBest.elongation}°`, "☼", visualBest.jplVerified],
              ["الإضاءة", `${visualBest.illumination}%`, "🌙"],
              ["غروب الشمس", fmtTime(result.hilal.sunsetIso), "🌇"],
              ["غروب القمر", fmtTime(result.hilal.moonsetIso), "🌙"],
              ["مكث القمر", `${result.hilal.lag} دقيقة`, "⌛"],
            ]}
          />
        )}

        <section style={analysisCardStyle}>
          <h2 style={analysisTitleStyle}>🛰️ تحليل وقت الرصد الحقيقي</h2>

          <div style={analysisTextStyle}>
            حسب موقعك الحالي:
            <br />
            <DmsText value={decimalToDMS(lat, "lat")} />
            <br />
            <DmsText value={decimalToDMS(lng, "lng")} />
            <br />
            لمعرفة معطيات الهلال وقت الرصد الفعلي أدخل الوقت هنا.
          </div>

          <div style={dateInputWrapStyle}>
            <input
              type="datetime-local"
              value={observeTime}
              onChange={(e) => setObserveTime(e.target.value)}
              style={dateInputStyle}
            />
          </div>

          <button onClick={calculate} style={btn2}>
            احسب معطيات وقت الرصد
          </button>

          {custom && (
            <Section
              title=""
              color="#60a5fa"
              data={[
                ["وقت الرصد", fmtTime(custom.iso), "🕒"],
                ["ارتفاع الهلال", `${custom.altitude}°`, "△", custom.jplVerified],
                ["الاستطالة", `${custom.elongation}°`, "☼", custom.jplVerified],
                ["الإضاءة", `${custom.illumination}%`, "🌙"],
                ["عمر الهلال", custom.ageText, "☾"],
                [
                  "اتجاه الهلال",
                  `${custom.azimuth}° - ${directionName(custom.azimuth)}`,
                  "🧭",
                  custom.jplVerified,
                ],
                [
                  "مكث القمر المتبقي",
                  `${custom.remainingMoonset} دقيقة`,
                  "⌛",
                ],
              ]}
            />
          )}
        </section>

        <div style={noteStyle}>
          🛰️ القيم التي تحمل علامة NASA تم التحقق منها مباشرة عبر NASA JPL Horizons عند توفر الاتصال.
        </div>
      </div>
    </main>
  );
}

function Field({ label, value, setValue }: any) {
  return (
    <div style={fieldWrapStyle}>
      <div style={labelStyle}>{label}</div>

      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        style={inputStyle}
      />
    </div>
  );
}

function Section({ title, color, data }: any) {
  return (
    <section style={sectionStyle(color)}>
      {title && <h2 style={sectionTitleStyle}>{title}</h2>}

      <div style={resultGridStyle}>
        {data.map((item: any, i: number) => (
          <div key={i} style={resultCardStyle}>
            {item[3] && <div style={nasaBadgeStyle}>NASA</div>}

            <div style={resultLabelStyle}>{item[0]}</div>
            <div style={resultIconStyle}>{item[2]}</div>
            <div style={resultValueStyle}>{item[1]}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

const boxHeight = 78;

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  background: "radial-gradient(circle at top,#0f172a,#020617 45%,#000)",
  color: "white",
  fontFamily: "Arial, sans-serif",
  direction: "rtl",
  padding: 14,
  fontWeight: 800,
};

const containerStyle: React.CSSProperties = {
  maxWidth: 1180,
  margin: "0 auto",
};

const headerStyle: React.CSSProperties = {
  textAlign: "center",
  marginBottom: 20,
};

const titleStyle: React.CSSProperties = {
  fontSize: 42,
  margin: 0,
  fontWeight: 900,
};

const subtitleStyle: React.CSSProperties = {
  opacity: 0.85,
  fontWeight: 800,
};

const nasaStatusStyle: React.CSSProperties = {
  textAlign: "center",
  color: "#22c55e",
  fontSize: 18,
  fontWeight: 900,
  marginTop: 10,
};

const inputCardStyle: React.CSSProperties = {
  background: "rgba(15,23,42,.92)",
  borderRadius: 22,
  padding: 24,
  marginBottom: 24,
};

const gpsStyle: React.CSSProperties = {
  textAlign: "center",
  fontWeight: 800,
  fontSize: 18,
  marginBottom: 22,
};

const inputGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
  gap: 20,
  alignItems: "end",
};

const fieldWrapStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  justifyContent: "flex-end",
  minWidth: 0,
};

const labelStyle: React.CSSProperties = {
  minHeight: 28,
  marginBottom: 10,
  fontWeight: 900,
  fontSize: 18,
  textAlign: "center",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: boxHeight,
  padding: "0 16px",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,.15)",
  background: "#020617",
  color: "white",
  colorScheme: "dark",
  accentColor: "#ffffff",
  fontSize: 24,
  fontWeight: 900,
  boxSizing: "border-box",
  textAlign: "center",
};

const dmsBoxStyle: React.CSSProperties = {
  width: "100%",
  height: boxHeight,
  background: "#020617",
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,.15)",
  boxSizing: "border-box",
  padding: "8px 12px",
  lineHeight: 1.7,
  textAlign: "center",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 17,
  fontWeight: 900,
};

const analysisCardStyle: React.CSSProperties = {
  background: "rgba(15,23,42,.92)",
  borderRadius: 22,
  padding: 24,
  marginBottom: 20,
};

const analysisTitleStyle: React.CSSProperties = {
  textAlign: "center",
  fontWeight: 900,
  fontSize: 26,
};

const analysisTextStyle: React.CSSProperties = {
  textAlign: "center",
  lineHeight: 1.9,
  marginBottom: 16,
  fontWeight: 800,
  fontSize: 18,
};

const dateInputWrapStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "center",
  marginTop: 14,
  marginBottom: 14,
};

const dateInputStyle: React.CSSProperties = {
  ...inputStyle,
  maxWidth: 420,
  textAlign: "center",
};

const btn: React.CSSProperties = {
  width: "100%",
  marginTop: 20,
  padding: 18,
  borderRadius: 14,
  border: "none",
  background: "linear-gradient(135deg,#2563eb,#7c3aed)",
  color: "white",
  fontSize: 24,
  fontWeight: 900,
};

const btn2: React.CSSProperties = {
  width: "100%",
  marginTop: 16,
  padding: 16,
  borderRadius: 14,
  border: "1px solid rgba(255,255,255,.16)",
  background: "rgba(59,130,246,.28)",
  color: "white",
  fontSize: 22,
  fontWeight: 900,
};

const sectionStyle = (color: string): React.CSSProperties => ({
  background: "rgba(15,23,42,.92)",
  border: `1px solid ${color}`,
  borderRadius: 22,
  padding: 22,
  marginBottom: 20,
});

const sectionTitleStyle: React.CSSProperties = {
  textAlign: "center",
  marginBottom: 20,
  fontWeight: 900,
  fontSize: 28,
};

const resultGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))",
  gap: 14,
};

const resultCardStyle: React.CSSProperties = {
  background: "rgba(255,255,255,.06)",
  borderRadius: 14,
  padding: 14,
  textAlign: "center",
  minHeight: 118,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  position: "relative",
};

const nasaBadgeStyle: React.CSSProperties = {
  position: "absolute",
  top: 8,
  left: 8,
  background: "#ffffff",
  color: "#0f172a",
  borderRadius: 999,
  padding: "3px 8px",
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: "0.5px",
};

const resultLabelStyle: React.CSSProperties = {
  opacity: 0.85,
  marginBottom: 8,
  fontWeight: 900,
  fontSize: 16,
};

const resultIconStyle: React.CSSProperties = {
  fontSize: 28,
  lineHeight: 1.2,
  marginBottom: 8,
};

const resultValueStyle: React.CSSProperties = {
  fontWeight: 900,
  fontSize: 22,
  lineHeight: 1.4,
};

const noteStyle: React.CSSProperties = {
  border: "1px solid #22c55e",
  borderRadius: 18,
  padding: 16,
  textAlign: "center",
  fontSize: 16,
  fontWeight: 900,
  marginBottom: 30,
  background: "rgba(34,197,94,.08)",
};