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

function radToDeg(r: number) {
  return r * 180 / Math.PI;
}

export default function Page() {
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 16));
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
      observer: "📍 موقع الراصد",
      moon: "🌙 بيانات القمر",
      lat: "خط العرض",
      lng: "خط الطول",
      altitude: "ارتفاع",
      azimuth: "اتجاه",
      illumination: "الإضاءة",
      age: "العمر",
      sunset: "غروب الشمس",
      moonset: "غروب القمر",
      lag: "مكث الهلال",
      elongation: "الاستطالة",
      visibility: "إمكانية الرؤية",
      ra: "المطلع المستقيم (RA)",
      dec: "الميل (Dec)"
    },
    en: {
      title: "🌙 Hilal Observatory",
      calc: "Calculate",
      observer: "📍 Observer",
      moon: "🌙 Moon Data",
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
      ra: "Right Ascension",
      dec: "Declination"
    }
  };

  const calc = () => {
    const d = new Date(date);
    const latNum = Number(lat);
    const lngNum = Number(lng);

    const moon = SunCalc.getMoonPosition(d, latNum, lngNum);
    const illum = SunCalc.getMoonIllumination(d);
    const times = SunCalc.getTimes(d, latNum, lngNum);
    const moonTimes = SunCalc.getMoonTimes(d, latNum, lngNum);

    const altitude = radToDeg(moon.altitude);
    const azimuth = radToDeg(moon.azimuth) + 180;

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
      ra: radToDeg(moon.rightAscension).toFixed(2),
      dec: radToDeg(moon.declination).toFixed(2),
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
      <h1>{t[lang].title}</h1>

      <button onClick={() => setLang(lang === "ar" ? "en" : "ar")}>
        🌐 {lang === "ar" ? "English" : "العربية"}
      </button>

      <div style={{ marginTop: 15 }}>
        <input type="datetime-local" value={date}
          onChange={(e) => setDate(e.target.value)} />
      </div>

      <div style={{ marginTop: 10 }}>
        <input placeholder={t[lang].lat} value={lat}
          onChange={(e) => setLat(e.target.value)} />
        <input placeholder={t[lang].lng} value={lng}
          onChange={(e) => setLng(e.target.value)} />
      </div>

      <button onClick={calc}>{t[lang].calc}</button>

      {result && (
        <div style={{ marginTop: 20 }}>

          <h3>{t[lang].observer}</h3>
          <p>{lat}, {lng}</p>
          <p>{toDMS(Number(lat), "lat")} , {toDMS(Number(lng), "lng")}</p>

          <h3>{t[lang].moon}</h3>
          <p>{t[lang].altitude}: {result.altitude}°</p>
          <p>{t[lang].azimuth}: {result.azimuth}°</p>

          <p>{t[lang].illumination}: {result.illumination}%</p>
          <p>{t[lang].age}: {result.age}</p>

          <p>{t[lang].sunset}: {result.sunset}</p>
          <p>{t[lang].moonset}: {result.moonset}</p>
          <p>{t[lang].lag}: {result.lag} min</p>

          <p>{t[lang].elongation}: {result.elongation}°</p>
          <p>{t[lang].visibility}: {result.visibility}</p>

          <p>{t[lang].ra}: {result.ra}°</p>
          <p>{t[lang].dec}: {result.dec}°</p>

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