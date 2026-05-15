"use client";

import { useEffect, useState } from "react";
import * as Astronomy from "astronomy-engine";

function localInputNow() {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}

function fmtTime(d?: Date) {
  if (!d) return "-";
  return d.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" });
}

function fmtDate(d?: Date) {
  if (!d) return "-";
  return d.toLocaleDateString("ar-SA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function fmtDay(d?: Date) {
  if (!d) return "-";
  return d.toLocaleDateString("ar-SA", { weekday: "long" });
}

function ageText(hours: number) {
  const h = Math.floor(hours);
  const m = Math.floor((hours - h) * 60);
  const s = Math.floor((((hours - h) * 60) - m) * 60);
  return `${h} ساعة ${m} دقيقة ${s} ثانية`;
}

function addMinutes(d: Date, m: number) {
  return new Date(d.getTime() + m * 60000);
}

function moonInfo(date: Date, observer: Astronomy.Observer, newMoonDate: Date) {
  const time = new Astronomy.AstroTime(date);

  const eq = Astronomy.Equator("Moon", time, observer, true, true);
  const hor = Astronomy.Horizon(time, observer, eq.ra, eq.dec, "normal");

  const elongation = Astronomy.AngleFromSun("Moon", time);
  const illum = Astronomy.Illumination("Moon", time);

  const ageHours = (date.getTime() - newMoonDate.getTime()) / 3600000;

  return {
    date: fmtDate(date),
    day: fmtDay(date),
    time: fmtTime(date),
    altitude: hor.altitude.toFixed(2),
    azimuth: hor.azimuth.toFixed(2),
    age: ageText(Math.max(0, ageHours)),
    elongation: elongation.toFixed(2),
    illumination: (illum.phase_fraction * 100).toFixed(3),
  };
}

export default function Page() {
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [observeTime, setObserveTime] = useState(localInputNow());
  const [mainResult, setMainResult] = useState<any>(null);
  const [customResult, setCustomResult] = useState<any>(null);

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 }
    );
  }, []);

  function findBestHilalTime(observer: Astronomy.Observer) {
    const now = new Date();

    const nextNewMoon = Astronomy.SearchMoonPhase(
      0,
      new Astronomy.AstroTime(now),
      40
    ).date;

    let best: any = null;

    for (let day = 0; day <= 3; day++) {
      const checkDay = new Date(nextNewMoon);
      checkDay.setDate(checkDay.getDate() + day);

      const dayStart = new Date(
        checkDay.getFullYear(),
        checkDay.getMonth(),
        checkDay.getDate(),
        0,
        0,
        0
      );

      const sunsetEvent = Astronomy.SearchRiseSet(
        "Sun",
        observer,
        -1,
        new Astronomy.AstroTime(dayStart),
        2
      );

      if (!sunsetEvent) continue;

      const sunset = sunsetEvent.date;

      const moonsetEvent = Astronomy.SearchRiseSet(
        "Moon",
        observer,
        -1,
        new Astronomy.AstroTime(sunset),
        1
      );

      if (!moonsetEvent) continue;

      const moonset = moonsetEvent.date;
      const lag = (moonset.getTime() - sunset.getTime()) / 60000;

      if (lag <= 0) continue;

      for (let m = 5; m < lag - 2; m += 2) {
        const t = addMinutes(sunset, m);
        const info = moonInfo(t, observer, nextNewMoon);

        const altitude = Number(info.altitude);
        const elongation = Number(info.elongation);
        const illumination = Number(info.illumination);

        const score =
          altitude * 2 +
          elongation * 1.5 +
          lag * 0.25 +
          illumination * 0.5;

        if (!best || score > best.score) {
          best = {
            score,
            sunset,
            moonset,
            lag,
            newMoonDate: nextNewMoon,
            info,
          };
        }
      }
    }

    return best;
  }

  function calculate() {
    const observer = new Astronomy.Observer(Number(lat), Number(lng), 0);

    const best = findBestHilalTime(observer);

    if (!best) {
      setMainResult({
        error: "لم يتم العثور على وقت مناسب لرصد الهلال الجديد من موقعك خلال الأيام القادمة.",
      });
      return;
    }

    setMainResult({
      newMoonDate: fmtDate(best.newMoonDate),
      newMoonTime: fmtTime(best.newMoonDate),
      sunset: fmtTime(best.sunset),
      moonset: fmtTime(best.moonset),
      lag: best.lag.toFixed(1),
      best: best.info,
    });

    calculateCustom(best.newMoonDate);
  }

  function calculateCustom(newMoonDate?: Date) {
    const observer = new Astronomy.Observer(Number(lat), Number(lng), 0);
    const date = new Date(observeTime);

    const baseNewMoon =
      newMoonDate ??
      Astronomy.SearchMoonPhase(
        0,
        new Astronomy.AstroTime(new Date()),
        40
      ).date;

    setCustomResult(moonInfo(date, observer, baseNewMoon));
  }

  return (
    <main style={styles.page}>
      <div style={styles.container}>
        <header style={styles.header}>
          <div style={styles.moon}>🌙</div>
          <h1 style={styles.title}>مرصد الهلال</h1>
          <p style={styles.subtitle}>أفضل وقت لرصد الهلال الجديد حسب موقعك</p>
        </header>

        <section style={styles.card}>
          <h2 style={styles.cardTitle}>📍 موقع الراصد</h2>

          <label style={styles.label}>خط العرض</label>
          <input value={lat} onChange={(e) => setLat(e.target.value)} style={styles.input} />

          <label style={styles.label}>خط الطول</label>
          <input value={lng} onChange={(e) => setLng(e.target.value)} style={styles.input} />

          <button onClick={calculate} style={styles.primaryButton}>🔭 احسب</button>
        </section>

        {mainResult?.error && (
          <section style={styles.card}>
            <h2>{mainResult.error}</h2>
          </section>
        )}

        {mainResult?.best && (
          <section style={styles.card}>
            <h2 style={styles.cardTitle}>🌑 الهلال الجديد القادم</h2>
            <Result label="تاريخ الاقتران" value={mainResult.newMoonDate} />
            <Result label="وقت الاقتران" value={mainResult.newMoonTime} />
            <Result label="غروب الشمس" value={mainResult.sunset} />
            <Result label="غروب القمر" value={mainResult.moonset} />
            <Result label="مكث القمر" value={`${mainResult.lag} دقيقة`} />

            <h2 style={styles.cardTitle}>⭐ أفضل وقت للرصد حسب موقعك</h2>
            <div style={styles.highlightBox}>
              <Result label="التاريخ" value={mainResult.best.date} />
              <Result label="اليوم" value={mainResult.best.day} />
              <Result label="الساعة" value={mainResult.best.time} />
              <Result label="الاتجاه بالبوصلة" value={`${mainResult.best.azimuth}°`} />
              <Result label="الارتفاع" value={`${mainResult.best.altitude}°`} />
              <Result label="العمر" value={mainResult.best.age} />
              <Result label="الاستطالة" value={`${mainResult.best.elongation}°`} />
              <Result label="الإضاءة" value={`${mainResult.best.illumination}%`} />
            </div>
          </section>
        )}

        <section style={styles.card}>
          <h2 style={styles.cardTitle}>🕒 وقت رصدك أنت</h2>

          <input
            type="datetime-local"
            value={observeTime}
            onChange={(e) => setObserveTime(e.target.value)}
            style={styles.input}
          />

          <button onClick={() => calculateCustom()} style={styles.secondaryButton}>
            احسب وقت رصدي
          </button>

          {customResult && (
            <div style={styles.customBox}>
              <Result label="موقعي بالإحداثيات" value={`${lat}, ${lng}`} />
              <Result label="التاريخ" value={customResult.date} />
              <Result label="اليوم" value={customResult.day} />
              <Result label="الساعة" value={customResult.time} />
              <Result label="عمر القمر" value={customResult.age} />
              <Result label="الارتفاع" value={`${customResult.altitude}°`} />
              <Result label="الاستطالة" value={`${customResult.elongation}°`} />
              <Result label="الإضاءة" value={`${customResult.illumination}%`} />
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Result({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.resultItem}>
      <div style={styles.resultLabel}>{label}</div>
      <div style={styles.resultValue}>{value}</div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "radial-gradient(circle at top, #1e3a8a 0%, #020617 38%, #000 100%)",
    color: "white",
    fontFamily: "Arial, sans-serif",
    padding: 18,
    direction: "rtl",
  },
  container: { maxWidth: 520, margin: "0 auto" },
  header: { textAlign: "center", padding: "20px 0" },
  moon: { fontSize: 50 },
  title: { margin: "8px 0", fontSize: 34 },
  subtitle: { opacity: 0.75, margin: 0 },
  card: {
    background: "rgba(15,23,42,.9)",
    border: "1px solid rgba(255,255,255,.08)",
    borderRadius: 24,
    padding: 20,
    marginBottom: 18,
    boxShadow: "0 18px 45px rgba(0,0,0,.35)",
  },
  cardTitle: { fontSize: 20, marginTop: 0, marginBottom: 14 },
  label: { display: "block", marginBottom: 6, opacity: 0.85 },
  input: {
    width: "100%",
    padding: 14,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,.12)",
    background: "#020617",
    color: "white",
    marginBottom: 12,
    fontSize: 16,
    boxSizing: "border-box",
  },
  primaryButton: {
    width: "100%",
    padding: 16,
    borderRadius: 18,
    border: "none",
    background: "linear-gradient(135deg,#2563eb,#7c3aed)",
    color: "white",
    fontSize: 20,
    fontWeight: "bold",
    cursor: "pointer",
  },
  secondaryButton: {
    width: "100%",
    padding: 14,
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,.15)",
    background: "#334155",
    color: "white",
    fontSize: 17,
    fontWeight: "bold",
    cursor: "pointer",
  },
  highlightBox: {
    display: "grid",
    gap: 10,
    background: "rgba(37,99,235,.12)",
    borderRadius: 18,
    padding: 14,
  },
  customBox: { marginTop: 16, display: "grid", gap: 10 },
  resultItem: {
    background: "rgba(255,255,255,.06)",
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
  },
  resultLabel: { fontSize: 13, opacity: 0.7, marginBottom: 4 },
  resultValue: { fontSize: 20, fontWeight: "bold" },
};