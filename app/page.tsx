"use client";

import { useState, useEffect } from "react";
import SunCalc from "suncalc";

function toDMS(value: number, type: "lat" | "lng") {
  const dir =
    type === "lat"
      ? value >= 0 ? "N" : "S"
      : value >= 0 ? "E" : "W";

  const abs = Math.abs(value);
  const deg = Math.floor(abs);
  const min = Math.floor((abs - deg) * 60);
  const sec = (((abs - deg) * 60 - min) * 60).toFixed(2);

  return `${deg}°${min}'${sec}" ${dir}`;
}

export default function Page() {
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [result, setResult] = useState<any>(null);
  const [heading, setHeading] = useState(0);
  const [lang, setLang] = useState<"ar" | "en">("ar");

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition((pos) => {
      setLat(pos.coords.latitude.toFixed(6));
      setLng(pos.coords.longitude.toFixed(6));
    });

    window.addEventListener("deviceorientation", (e) => {
      if (e.alpha !== null) setHeading(360 - e.alpha);
    });
  }, []);

  const t = {
    ar: {
      title: "🌙 مرصد الهلال",
      calc: "احسب",
      lat: "خط العرض",
      lng: "خط الطول",
      altitude: "ارتفاع القمر",
      azimuth: "اتجاه القمر",
      illumination: "الإضاءة",
      age: "عمر القمر",
      sunset: "غروب الشمس",
      moonset: "غروب القمر",
      lag: "مكث الهلال",
      elongation: "الاستطالة",
      visibility: "إمكانية الرؤية",
    },
    en: {
      title: "🌙 Hilal Tracker",
      calc: "Calculate",
      lat: "Latitude",
      lng: "Longitude",
      altitude: "Altitude",
      azimuth: "Azimuth",
      illumination: "Illumination",
      age: "Age",
      sunset: "Sunset",
      moonset: "Moonset",
      lag: "Lag",
      elongation: "Elongation",
      visibility: "Visibility",
    }
  };

  const calc = () => {
    const date = new Date();
    const latNum = Number(lat);
    const lngNum = Number(lng);

    const moon = SunCalc.getMoonPosition(date, latNum, lngNum);
    const illum = SunCalc.getMoonIllumination(date);
    const times = SunCalc.getTimes(date, latNum, lngNum);
    const moonTimes = SunCalc.getMoonTimes(date, latNum, lngNum);

    const altitude = moon.altitude * 180 / Math.PI;
    const azimuth = moon.azimuth * 180 / Math.PI + 180;

    const lag = moonTimes.set && times.sunset
      ? (moonTimes.set.getTime() - times.sunset.getTime()) / 60000
      : 0;

    const elongation = illum.phase * 360;

    let visibility = lang === "ar" ? "❌ غير مرئي" : "❌ Not visible";
    if (lag > 40 && altitude > 5 && elongation > 10) {
      visibility = lang === "ar" ? "✅ مرئي" : "✅ Visible";
    } else if (lag > 20) {
      visibility = lang === "ar" ? "⚠️ صعب" : "⚠️ Difficult";
    }

    setResult({
      altitude: altitude.toFixed(2),
      azimuth: azimuth.toFixed(2),
      illumination: (illum.fraction * 100).toFixed(1),
      age: (illum.phase * 29.53).toFixed(1),
      sunset: times.sunset?.toLocaleTimeString(),
      moonset: moonTimes.set?.toLocaleTimeString(),
      lag: lag.toFixed(1),
      elongation: elongation.toFixed(1),
      visibility,
    });
  };

  const direction = result ? (Number(result.azimuth) - heading + 360) % 360 : 0;

  return (
    <div style={{
      minHeight: "100vh",
      background: "radial-gradient(circle at top, #020617, #000)",
      color: "white",
      padding: 20,
      textAlign: "center"
    }}>
      <h1 style={{ fontSize: 28 }}>{t[lang].title}</h1>

      <button onClick={() => setLang(lang === "ar" ? "en" : "ar")}
        style={{ marginBottom: 10 }}>
        🌐 {lang === "ar" ? "English" : "العربية"}
      </button>

      <div style={{
        background: "#0f172a",
        padding: 20,
        borderRadius: 16,
        maxWidth: 400,
        margin: "auto",
        boxShadow: "0 0 30px rgba(0,0,255,0.3)"
      }}>
        <input placeholder={t[lang].lat} value={lat}
          onChange={(e) => setLat(e.target.value)}
          style={{ width: "100%", marginBottom: 10, padding: 10 }} />

        <input placeholder={t[lang].lng} value={lng}
          onChange={(e) => setLng(e.target.value)}
          style={{ width: "100%", marginBottom: 10, padding: 10 }} />

        <button onClick={calc}
          style={{
            width: "100%",
            padding: 12,
            background: "#2563eb",
            borderRadius: 8
          }}>
          {t[lang].calc}
        </button>
      </div>

      {result && (
        <div style={{
          marginTop: 20,
          background: "#0f172a",
          padding: 20,
          borderRadius: 16,
          maxWidth: 400,
          marginInline: "auto"
        }}>
          <p>{t[lang].lat}: {toDMS(Number(lat), "lat")}</p>
          <p>{t[lang].lng}: {toDMS(Number(lng), "lng")}</p>

          <p>{t[lang].altitude}: {result.altitude}°</p>
          <p>{t[lang].azimuth}: {result.azimuth}°</p>

          <p>{t[lang].illumination}: {result.illumination}%</p>
          <p>{t[lang].age}: {result.age}</p>

          <p>{t[lang].sunset}: {result.sunset}</p>
          <p>{t[lang].moonset}: {result.moonset}</p>
          <p>{t[lang].lag}: {result.lag} min</p>

          <p>{t[lang].elongation}: {result.elongation}°</p>

          <h3>{t[lang].visibility}: {result.visibility}</h3>

          <div style={{
            marginTop: 20,
            fontSize: 40,
            transform: `rotate(${direction}deg)`
          }}>
            ↑
          </div>
        </div>
      )}
    </div>
  );
}