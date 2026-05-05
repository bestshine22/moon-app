"use client";

import { useState, useEffect } from "react";
import SunCalc from "suncalc";

function toDMS(value: number, type: "lat" | "lng") {
  const dir =
    type === "lat"
      ? value >= 0
        ? "N"
        : "S"
      : value >= 0
      ? "E"
      : "W";

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

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition((pos) => {
      setLat(pos.coords.latitude.toFixed(6));
      setLng(pos.coords.longitude.toFixed(6));
    });

    window.addEventListener("deviceorientation", (e) => {
      if (e.alpha !== null) {
        setHeading(360 - e.alpha);
      }
    });
  }, []);

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

    let visibility = "❌ Not visible";
    if (lag > 40 && altitude > 5 && elongation > 10) {
      visibility = "✅ Visible";
    } else if (lag > 20) {
      visibility = "⚠️ Difficult";
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

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(to bottom, #020617, #0f172a)",
      color: "white",
      padding: 20,
      textAlign: "center"
    }}>
      <h1>🌙 Moon Hilal Tracker</h1>

      <div style={{
        background: "#111827",
        padding: 20,
        borderRadius: 12,
        maxWidth: 400,
        margin: "auto"
      }}>
        <input placeholder="Latitude" value={lat}
          onChange={(e) => setLat(e.target.value)}
          style={{ width: "100%", marginBottom: 10, padding: 10 }} />

        <input placeholder="Longitude" value={lng}
          onChange={(e) => setLng(e.target.value)}
          style={{ width: "100%", marginBottom: 10, padding: 10 }} />

        <button onClick={calc}
          style={{ width: "100%", padding: 12, background: "#2563eb", color: "white" }}>
          Calculate
        </button>
      </div>

      {result && (
        <div style={{
          marginTop: 20,
          background: "#111827",
          padding: 20,
          borderRadius: 12,
          maxWidth: 400,
          marginInline: "auto"
        }}>
          <p>📍 Lat: {toDMS(Number(lat), "lat")}</p>
          <p>📍 Lng: {toDMS(Number(lng), "lng")}</p>

          <p>📍 Altitude: {result.altitude}°</p>
          <p>🧭 Azimuth: {result.azimuth}°</p>

          <p>💡 Illumination: {result.illumination}%</p>
          <p>🌗 Age: {result.age} days</p>

          <hr />

          <p>🌇 Sunset: {result.sunset}</p>
          <p>🌙 Moonset: {result.moonset}</p>
          <p>⏳ Lag: {result.lag} min</p>

          <p>📐 Elongation: {result.elongation}°</p>

          <h3>{result.visibility}</h3>

          <hr />

          <p>🧭 Device Heading: {heading.toFixed(0)}°</p>
        </div>
      )}
    </div>
  );
}