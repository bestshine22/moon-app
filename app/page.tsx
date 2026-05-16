"use client";

import { useEffect, useState } from "react";

function localToIso(value: string) {
  if (!value) return "";
  return new Date(value).toISOString();
}

function toInputValue(iso?: string) {
  if (!iso) return "";

  const d = new Date(iso);

  const local = new Date(
    d.getTime() - d.getTimezoneOffset() * 60000
  );

  return local.toISOString().slice(0, 16);
}

const GREGORIAN_LOCALE = "en-GB";

function fmtDate(iso?: string) {
  if (!iso) return "-";

  return new Date(iso).toLocaleDateString(
    GREGORIAN_LOCALE,
    {
      year: "numeric",
      month: "long",
      day: "numeric",
    }
  );
}

function fmtDay(iso?: string) {
  if (!iso) return "-";

  return new Date(iso).toLocaleDateString(
    GREGORIAN_LOCALE,
    {
      weekday: "long",
    }
  );
}

function fmtTime(iso?: string) {
  if (!iso) return "-";

  return new Date(iso).toLocaleTimeString(
    "en-US",
    {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
    }
  );
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

function decimalToDMS(
  value: string,
  type: "lat" | "lng"
) {
  const num = Number(value);

  if (!Number.isFinite(num)) return "-";

  const absolute = Math.abs(num);

  const degrees = Math.floor(absolute);

  const minutesFloat =
    (absolute - degrees) * 60;

  const minutes = Math.floor(minutesFloat);

  const seconds = (
    (minutesFloat - minutes) *
    60
  ).toFixed(2);

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
  const [height, setHeight] =
    useState("0");

  const [observeTime, setObserveTime] =
    useState("");

  const [gpsStatus, setGpsStatus] =
    useState(
      "لم يتم تحديد الموقع بعد"
    );

  const [loading, setLoading] =
    useState(false);

  const [result, setResult] =
    useState<any>(null);

  function updateLocation() {
    if (!navigator.geolocation) {
      setGpsStatus(
        "المتصفح لا يدعم تحديد الموقع"
      );

      return;
    }

    setGpsStatus(
      "جاري تحديد موقعك الحالي..."
    );

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(
          pos.coords.latitude.toFixed(6)
        );

        setLng(
          pos.coords.longitude.toFixed(6)
        );

        if (
          pos.coords.altitude !== null &&
          Number.isFinite(
            pos.coords.altitude
          )
        ) {
          setHeight(
            pos.coords.altitude.toFixed(0)
          );
        }

        setGpsStatus(
          `تم تحديد موقعك الحالي بدقة تقريبية ${Math.round(
            pos.coords.accuracy
          )} متر`
        );
      },

      () => {
        setGpsStatus(
          "تعذر تحديد الموقع. تأكد من تفعيل إذن الموقع."
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
      alert("حدد موقعك أولًا");
      return;
    }

    setLoading(true);

    try {
      const url =
        `/api/hilal?lat=${encodeURIComponent(
          lat
        )}` +
        `&lng=${encodeURIComponent(
          lng
        )}` +
        `&height=${encodeURIComponent(
          height || "0"
        )}` +
        (observeTime
          ? `&observeTime=${encodeURIComponent(
              localToIso(
                observeTime
              )
            )}`
          : "");

      const res = await fetch(url);

      const data = await res.json();

      setResult(data);

      if (
        data?.hilal?.visualBest?.iso &&
        !observeTime
      ) {
        setObserveTime(
          toInputValue(
            data.hilal.visualBest.iso
          )
        );
      }

      if (data.error)
        alert(data.error);
    } catch {
      alert("فشل الاتصال بالحسابات");
    } finally {
      setLoading(false);
    }
  }

  const nowData = result?.nowData;

  const visualBest =
    result?.hilal?.visualBest;

  const custom = result?.custom;

  return (
    <main
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top,#0f172a,#020617 45%,#000)",
        color: "white",
        fontFamily: "Arial",
        direction: "rtl",
        padding: 14,
      }}
    >
      <div
        style={{
          maxWidth: 1180,
          margin: "0 auto",
        }}
      >
        <div
          style={{
            textAlign: "center",
            marginBottom: 20,
          }}
        >
          <div
            style={{
              fontSize: 70,
            }}
          >
            🌙
          </div>

          <h1
            style={{
              fontSize: 42,
              margin: 0,
            }}
          >
            مرصد الهلال
          </h1>

          <p
            style={{
              opacity: 0.8,
            }}
          >
            حسابات فلكية دقيقة للهلال حسب موقعك والوقت
          </p>
        </div>

        <div
          style={{
            background:
              "rgba(15,23,42,.92)",
            borderRadius: 22,
            padding: 24,
            marginBottom: 24,
          }}
        >
          <p
            style={{
              textAlign: "center",
            }}
          >
            📍 {gpsStatus}
          </p>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit,minmax(220px,1fr))",
              gap: 20,
            }}
          >
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

            <Field
              label="الارتفاع م"
              value={height}
              setValue={setHeight}
            />

            <div>
              <div
                style={{
                  marginBottom: 10,
                  fontWeight: "bold",
                }}
              >
                الإحداثيات DMS
              </div>

              <div
                style={{
                  background:
                    "#020617",
                  borderRadius: 14,
                  padding: 16,
                  lineHeight: 1.8,
                  textAlign: "center",
                }}
              >
                <div>
                  {decimalToDMS(
                    lat,
                    "lat"
                  )}
                </div>

                <div>
                  {decimalToDMS(
                    lng,
                    "lng"
                  )}
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={updateLocation}
            style={btn2}
          >
            📍 تحديث موقعي الآن
          </button>

          <button
            onClick={calculate}
            style={btn}
          >
            {loading
              ? "جاري الحساب..."
              : "🔭 احسب"}
          </button>
        </div>

        {nowData && (
          <Section
            title="🌙 حالة القمر الآن حسب موقعك"
            color="#22c55e"
            data={[
              [
                "التاريخ",
                fmtDate(nowData.iso),
                "📅",
              ],

              [
                "اليوم",
                fmtDay(nowData.iso),
                "🗓️",
              ],

              [
                "الساعة",
                fmtTime(nowData.iso),
                "🕒",
              ],

              [
                "ارتفاع القمر الآن",
                `${nowData.altitude}°`,
                "△",
              ],

              [
                "اتجاه القمر الآن",
                `${nowData.azimuth}° - ${directionName(
                  nowData.azimuth
                )}`,
                "🧭",
              ],

              [
                "عمر القمر الآن",
                nowData.ageText,
                "☾",
              ],

              [
                "الاستطالة الآن",
                `${nowData.elongation}°`,
                "☼",
              ],

              [
                "الإضاءة الآن",
                `${nowData.illumination}%`,
                "🌙",
              ],
            ]}
          />
        )}

        {visualBest && (
          <Section
            title="👁️ أفضل وقت لرصد هلال بداية الشهر"
            color="#fb923c"
            data={[
              [
                "التاريخ",
                fmtDate(
                  visualBest.iso
                ),
                "📅",
              ],

              [
                "اليوم",
                fmtDay(
                  visualBest.iso
                ),
                "🗓️",
              ],

              [
                "الساعة",
                fmtTime(
                  visualBest.iso
                ),
                "🕒",
              ],

              [
                "ارتفاع الهلال",
                `${visualBest.altitude}°`,
                "△",
              ],

              [
                "اتجاه الهلال",
                `${visualBest.azimuth}° - ${directionName(
                  visualBest.azimuth
                )}`,
                "🧭",
              ],

              [
                "عمر الهلال",
                visualBest.ageText,
                "☾",
              ],

              [
                "الاستطالة",
                `${visualBest.elongation}°`,
                "☼",
              ],

              [
                "الإضاءة",
                `${visualBest.illumination}%`,
                "🌙",
              ],

              [
                "غروب الشمس",
                fmtTime(
                  result.hilal
                    .sunsetIso
                ),
                "🌇",
              ],

              [
                "غروب القمر",
                fmtTime(
                  result.hilal
                    .moonsetIso
                ),
                "🌙",
              ],

              [
                "مكث القمر",
                `${result.hilal.lag} دقيقة`,
                "⌛",
              ],
            ]}
          />
        )}

        <div
          style={{
            background:
              "rgba(15,23,42,.92)",
            borderRadius: 22,
            padding: 24,
            marginBottom: 20,
          }}
        >
          <h2
            style={{
              textAlign: "center",
            }}
          >
            🛰️ تحليل وقت الرصد الحقيقي
          </h2>

          <div
            style={{
              textAlign: "center",
              lineHeight: 1.9,
              marginBottom: 16,
            }}
          >
            حسب موقعك الحالي:
            <br />

            {decimalToDMS(
              lat,
              "lat"
            )}

            <br />

            {decimalToDMS(
              lng,
              "lng"
            )}

            <br />

            لمعرفة معطيات الهلال وقت الرصد الفعلي أدخل الوقت هنا.
          </div>

          <div
            style={{
              display: "flex",
              justifyContent:
                "center",
              marginTop: 14,
              marginBottom: 14,
            }}
          >
            <input
              type="datetime-local"
              value={observeTime}
              onChange={(e) =>
                setObserveTime(
                  e.target.value
                )
              }
              style={{
                ...inputStyle,
                maxWidth: 420,
                textAlign: "center",
                filter: "invert(1)",
              }}
            />
          </div>

          <button
            onClick={calculate}
            style={btn2}
          >
            احسب معطيات وقت الرصد
          </button>

          {custom && (
            <Section
              title=""
              color="#60a5fa"
              data={[
                [
                  "وقت الرصد",
                  fmtTime(custom.iso),
                  "🕒",
                ],

                [
                  "ارتفاع الهلال",
                  `${custom.altitude}°`,
                  "△",
                ],

                [
                  "الاستطالة",
                  `${custom.elongation}°`,
                  "☼",
                ],

                [
                  "الإضاءة",
                  `${custom.illumination}%`,
                  "🌙",
                ],

                [
                  "عمر الهلال",
                  custom.ageText,
                  "☾",
                ],

                [
                  "اتجاه الهلال",
                  `${custom.azimuth}° - ${directionName(
                    custom.azimuth
                  )}`,
                  "🧭",
                ],

                [
                  "مكث القمر المتبقي",
                  `${custom.remainingMoonset} دقيقة`,
                  "⌛",
                ],
              ]}
            />
          )}
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
      <div
        style={{
          marginBottom: 10,
          fontWeight: "bold",
        }}
      >
        {label}
      </div>

      <input
        value={value}
        onChange={(e) =>
          setValue(e.target.value)
        }
        style={inputStyle}
      />
    </div>
  );
}

function Section({
  title,
  color,
  data,
}: any) {
  return (
    <div
      style={{
        background:
          "rgba(15,23,42,.92)",
        border: `1px solid ${color}`,
        borderRadius: 22,
        padding: 22,
        marginBottom: 20,
      }}
    >
      {title && (
        <h2
          style={{
            textAlign: "center",
            marginBottom: 20,
          }}
        >
          {title}
        </h2>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(auto-fit,minmax(190px,1fr))",
          gap: 14,
        }}
      >
        {data.map(
          (
            item: any,
            i: number
          ) => (
            <div
              key={i}
              style={{
                background:
                  "rgba(255,255,255,.06)",
                borderRadius: 14,
                padding: 14,
                textAlign: "center",
              }}
            >
              <div
                style={{
                  opacity: 0.8,
                  marginBottom: 8,
                }}
              >
                {item[0]}
              </div>

              <div
                style={{
                  fontSize: 28,
                }}
              >
                {item[2]}
              </div>

              <div
                style={{
                  fontWeight:
                    "bold",
                  fontSize: 22,
                }}
              >
                {item[1]}
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties =
  {
    width: "100%",
    padding: 16,
    borderRadius: 14,
    border:
      "1px solid rgba(255,255,255,.15)",
    background: "#020617",
    color: "white",
    colorScheme: "dark",
    accentColor: "#ffffff",
    fontSize: 20,
    boxSizing: "border-box",
    textAlign: "center",
  };

const btn: React.CSSProperties = {
  width: "100%",
  marginTop: 20,
  padding: 18,
  borderRadius: 14,
  border: "none",
  background:
    "linear-gradient(135deg,#2563eb,#7c3aed)",
  color: "white",
  fontSize: 24,
  fontWeight: "bold",
};

const btn2: React.CSSProperties = {
  width: "100%",
  marginTop: 16,
  padding: 16,
  borderRadius: 14,
  border:
    "1px solid rgba(255,255,255,.16)",
  background:
    "rgba(59,130,246,.28)",
  color: "white",
  fontSize: 22,
  fontWeight: "bold",
};