"use client";

import { useEffect, useState } from "react";
import SunCalc from "suncalc";

const rad2deg = (r: number) => (r * 180) / Math.PI;

function getLocalDateTime() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}

export default function Page() {
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [time, setTime] = useState(getLocalDateTime());
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition((pos) => {
      setLat(pos.coords.latitude.toFixed(6));
      setLng(pos.coords.longitude.toFixed(6));
    });
  }, []);

  function calculate() {
    const date = new Date(time);
    const la = Number(lat);
    const lo = Number(lng);

    const moon = SunCalc.getMoonPosition(date, la, lo);
    const sun = SunCalc.getPosition(date, la, lo);
    const illum = SunCalc.getMoonIllumination(date);

    const times = SunCalc.getTimes(date, la, lo);
    const moonTimes = SunCalc.getMoonTimes(date, la, lo);

    const altitude = rad2deg(moon.altitude);
    const azimuth = (rad2deg(moon.azimuth) + 180 + 360) % 360;
    const sunAltitude = rad2deg(sun.altitude);

    const lag =
      moonTimes.set && times.sunset
        ? (moonTimes.set.getTime() - times.sunset.getTime()) / 60000
        : 0;

    const elongation = illum.phase * 360;
    const arcv = altitude - sunAltitude;
    const age = illum.phase * 29.530588;

    let visibility = "غير مرئي";
    if (lag > 40 && arcv > 10 && elongation > 10) visibility = "مرئي";
    else if (lag > 20 && arcv > 6) visibility = "صعب";

    setResult({
      altitude: altitude.toFixed(2),
      azimuth: azimuth.toFixed(2),
      age: age.toFixed(2),
      illumination: (illum.fraction * 100).toFixed(2),
      sunset: times.sunset?.toLocaleTimeString(),
      moonset: moonTimes.set?.toLocaleTimeString(),
      lag: lag.toFixed(1),
      elongation: elongation.toFixed(2),
      arcv: arcv.toFixed(2),
      visibility,
    });
  }

  return (
    <main style={{ padding: 20, fontFamily: "Arial", maxWidth: 500, margin: "auto" }}>
      <h1>مرصد الهلال</h1>

      <label>خط العرض</label>
      <input value={lat} onChange={(e) => setLat(e.target.value)} style={{ width: "100%", padding: 10, marginBottom: 10 }} />

      <label>خط الطول</label>
      <input value={lng} onChange={(e) => setLng(e.target.value)} style={{ width: "100%", padding: 10, marginBottom: 10 }} />

      <label>وقت الرصد</label>
      <input type="datetime-local" value={time} onChange={(e) => setTime(e.target.value)} style={{ width: "100%", padding: 10, marginBottom: 10 }} />

      <button onClick={calculate} style={{ width: "100%", padding: 12 }}>
        احسب
      </button>

      {result && (
        <div style={{ marginTop: 20 }}>
          <h2>النتائج</h2>
          <p>معيار عودة: {result.visibility}</p>
          <p>درجة توجيه البوصلة للقمر: {result.azimuth}°</p>
          <p>ارتفاع الهلال وقت الرصد: {result.altitude}°</p>
          <p>عمر الهلال وقت الرصد: {result.age} يوم</p>
          <p>إضاءة الهلال: {result.illumination}%</p>
          <p>غروب الشمس: {result.sunset}</p>
          <p>غروب القمر: {result.moonset}</p>
          <p>مكث الهلال: {result.lag} دقيقة</p>
          <p>الاستطالة: {result.elongation}°</p>
          <p>ARCV: {result.arcv}°</p>
        </div>
      )}
    </main>
  );
}