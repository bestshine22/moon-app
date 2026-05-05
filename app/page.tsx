"use client";

import { useEffect, useMemo, useState } from "react";
import SunCalc from "suncalc";

/* ================= Helpers ================= */
const rad2deg = (r: number) => (r * 180) / Math.PI;

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

function fmtTime(d?: Date) {
  if (!d) return "-";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function Card({ title, children }: any) {
  return (
    <div style={{
      background: "#0f172a",
      borderRadius: 16,
      padding: 16,
      boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
      border: "1px solid rgba(255,255,255,0.06)"
    }}>
      <div style={{ opacity: 0.8, marginBottom: 10, fontWeight: 600 }}>
        {title}
      </div>
      <div style={{ fontSize: 14, lineHeight: 1.9 }}>
        {children}
      </div>
    </div>
  );
}

/* ================ Page ================= */
export default function Page() {
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [dt, setDt] = useState(new Date().toISOString().slice(0, 16));
  const [heading, setHeading] = useState(0);
  const [lang, setLang] = useState<"ar" | "en">("ar");
  const [data, setData] = useState<any>(null);
  const [weather, setWeather] = useState<any>(null);

  /* ---------- i18n ---------- */
  const t = useMemo(() => ({
    ar: {
      title: "🌙 مرصد الهلال",
      calc: "احسب",
      lat: "خط العرض",
      lng: "خط الطول",
      observer: "📍 موقع الراصد",
      moon: "🌙 بيانات القمر",
      times: "🌇 أوقات مهمة",
      vis: "👁️ تقييم الرؤية (أسلوب عودة)",
      weather: "☁️ الطقس",
      alt: "الارتفاع",
      az: "الاتجاه",
      illum: "الإضاءة",
      age: "العمر",
      sunset: "غروب الشمس",
      moonset: "غروب القمر",
      lag: "مكث الهلال",
      elong: "الاستطالة",
      arcv: "فرق الارتفاع (ARCV)",
      width: "عرض الهلال (W)",
      cond: "شرط الغروب",
      visible: "مرئي",
      diff: "صعب",
      not: "غير مرئي",
      cloud: "نسبة الغيوم"
    },
    en: {
      title: "🌙 Hilal Observatory",
      calc: "Calculate",
      lat: "Latitude",
      lng: "Longitude",
      observer: "📍 Observer",
      moon: "🌙 Moon Data",
      times: "🌇 Key Times",
      vis: "👁️ Visibility (Odeh-like)",
      weather: "☁️ Weather",
      alt: "Altitude",
      az: "Azimuth",
      illum: "Illumination",
      age: "Age",
      sunset: "Sunset",
      moonset: "Moonset",
      lag: "Lag",
      elong: "Elongation",
      arcv: "ARCV",
      width: "Width (W)",
      cond: "Sun–Moon Order",
      visible: "Visible",
      diff: "Difficult",
      not: "Not visible",
      cloud: "Cloud Cover"
    }
  }), []);

  /* ---------- sensors ---------- */
  useEffect(() => {
    navigator.geolocation?.getCurrentPosition((p) => {
      setLat(p.coords.latitude.toFixed(6));
      setLng(p.coords.longitude.toFixed(6));
    });

    window.addEventListener("deviceorientation", (e) => {
      if (e.alpha != null) setHeading(360 - e.alpha);
    });
  }, []);

  /* ---------- Weather (Open-Meteo free) ---------- */
  const fetchWeather = async (la: number, lo: number) => {
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${la}&longitude=${lo}&hourly=cloudcover&forecast_days=1`;
      const res = await fetch(url);
      const json = await res.json();
      const cloud = json.hourly?.cloudcover?.[0] ?? 0;
      setWeather({ cloud });
    } catch {
      setWeather(null);
    }
  };

  /* ---------- calc ---------- */
  const calc = async () => {
    const d = new Date(dt);
    const la = Number(lat);
    const lo = Number(lng);

    const moon = SunCalc.getMoonPosition(d, la, lo);
    const sun = SunCalc.getPosition(d, la, lo);
    const illum = SunCalc.getMoonIllumination(d);
    const times = SunCalc.getTimes(d, la, lo);
    const mt = SunCalc.getMoonTimes(d, la, lo);

    const alt = rad2deg(moon.altitude);
    const az = rad2deg(moon.azimuth) + 180;
    const sunAlt = rad2deg(sun.altitude);

    const lag =
      mt.set && times.sunset
        ? (mt.set.getTime() - times.sunset.getTime()) / 60000
        : 0;

    const elong = illum.phase * 360;

    const arcv = alt - sunAlt;

    const width = illum.fraction * elong;

    const goodOrder =
      mt.set && times.sunset ? mt.set > times.sunset : false;

    /* ===== Odeh-like rule (practical) ===== */
    let vis = t[lang].not;

    if (!goodOrder || lag < 10) {
      vis = "❌ " + t[lang].not;
    } else if (arcv >= 10 && elong >= 10 && lag >= 40) {
      vis = "✅ " + t[lang].visible;
    } else if (arcv >= 6 && elong >= 8 && lag >= 20) {
      vis = "⚠️ " + t[lang].diff;
    } else {
      vis = "❌ " + t[lang].not;
    }

    setData({
      alt: alt.toFixed(2),
      az: az.toFixed(2),
      illum: (illum.fraction * 100).toFixed(1),
      age: (illum.phase * 29.53).toFixed(1),
      sunset: fmtTime(times.sunset),
      moonset: fmtTime(mt.set),
      lag: lag.toFixed(1),
      elong: elong.toFixed(1),
      arcv: arcv.toFixed(1),
      width: width.toFixed(2),
      goodOrder,
      vis
    });

    fetchWeather(la, lo);
  };

  const dir =
    data ? (Number(data.az) - heading + 360) % 360 : 0;

  /* ---------- UI ---------- */
  return (
    <div style={{
      minHeight: "100vh",
      background: "radial-gradient(circle at 20% 0%, #020617, #000)",
      color: "white",
      padding: 16,
      fontFamily: "system-ui"
    }}>
      {/* Header */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 12
      }}>
        <h1 style={{ fontSize: 22 }}>{t[lang].title}</h1>
        <button onClick={() => setLang(lang === "ar" ? "en" : "ar")}>
          🌐 {lang === "ar" ? "EN" : "AR"}
        </button>
      </div>

      {/* Controls */}
      <Card title="Controls">
        <div style={{ display: "grid", gap: 8 }}>
          <input type="datetime-local" value={dt}
            onChange={(e) => setDt(e.target.value)} />

          <input placeholder={t[lang].lat} value={lat}
            onChange={(e) => setLat(e.target.value)} />

          <input placeholder={t[lang].lng} value={lng}
            onChange={(e) => setLng(e.target.value)} />

          <button onClick={calc}
            style={{
              padding: 10,
              borderRadius: 10,
              background: "#2563eb",
              color: "white",
              border: "none"
            }}>
            {t[lang].calc}
          </button>
        </div>
      </Card>

      {data && (
        <div style={{ marginTop: 14, display: "grid", gap: 12 }}>

          <Card title={t[lang].observer}>
            <div>{lat}, {lng}</div>
            <div>{toDMS(Number(lat), "lat")} , {toDMS(Number(lng), "lng")}</div>
          </Card>

          <Card title={t[lang].moon}>
            <div>{t[lang].alt}: {data.alt}°</div>
            <div>{t[lang].az}: {data.az}°</div>
            <div>{t[lang].illum}: {data.illum}%</div>
            <div>{t[lang].age}: {data.age}</div>
          </Card>

          <Card title={t[lang].times}>
            <div>{t[lang].sunset}: {data.sunset}</div>
            <div>{t[lang].moonset}: {data.moonset}</div>
            <div>{t[lang].lag}: {data.lag} min</div>
            <div>{t[lang].cond}: {data.goodOrder ? "✅" : "❌"}</div>
          </Card>

          <Card title={t[lang].vis}>
            <div>{t[lang].elong}: {data.elong}°</div>
            <div>{t[lang].arcv}: {data.arcv}°</div>
            <div>{t[lang].width}: {data.width}</div>
            <h3>{data.vis}</h3>
          </Card>

          {weather && (
            <Card title={t[lang].weather}>
              <div>{t[lang].cloud}: {weather.cloud}%</div>
            </Card>
          )}

          {/* Compass */}
          <Card title="🧭">
            <div style={{
              textAlign: "center",
              fontSize: 40,
              transform: `rotate(${dir}deg)`
            }}>
              ↑
            </div>
          </Card>

          {/* Map */}
          <Card title="🗺️">
            <iframe
              width="100%"
              height="200"
              style={{ borderRadius: 10 }}
              src={`https://maps.google.com/maps?q=${lat},${lng}&z=6&output=embed`}
            />
          </Card>

        </div>
      )}
    </div>
  );
}