"use client";

import { useState, useEffect } from "react";
import SunCalc from "suncalc";

export default function Page() {
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [result, setResult] = useState(null);

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition((pos) => {
      setLat(pos.coords.latitude.toFixed(6));
      setLng(pos.coords.longitude.toFixed(6));
    });
  }, []);

  const calc = () => {
    const date = new Date();

    const moon = SunCalc.getMoonPosition(date, Number(lat), Number(lng));
    const illum = SunCalc.getMoonIllumination(date);

    setResult({
      altitude: (moon.altitude * 180 / Math.PI).toFixed(2),
      azimuth: ((moon.azimuth * 180 / Math.PI) + 180).toFixed(2),
      illumination: (illum.fraction * 100).toFixed(1),
      age: (illum.phase * 29.53).toFixed(1),
    });
  };

  return (
    <div style={{ padding: 20, textAlign: "center", background: "#0b0f1a", color: "white", minHeight: "100vh" }}>
      <h1>🌙 Moon Tracker</h1>

      <input
        placeholder="Latitude"
        value={lat}
        onChange={(e) => setLat(e.target.value)}
        style={{ display: "block", margin: "10px auto", padding: 10 }}
      />

      <input
        placeholder="Longitude"
        value={lng}
        onChange={(e) => setLng(e.target.value)}
        style={{ display: "block", margin: "10px auto", padding: 10 }}
      />

      <button onClick={calc} style={{ padding: 10, marginTop: 10 }}>
        Calculate Moon
      </button>

      {result && (
        <div style={{ marginTop: 20 }}>
          <p>📍 Altitude: {result.altitude}°</p>
          <p>🧭 Azimuth: {result.azimuth}°</p>
          <p>💡 Illumination: {result.illumination}%</p>
          <p>🌗 Age: {result.age} days</p>
        </div>
      )}
    </div>
  );
}