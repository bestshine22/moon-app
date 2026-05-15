"use client";

import { useEffect, useState } from "react";
import * as Astronomy from "astronomy-engine";

function getLocalDateTime() {
  const now = new Date();

  return new Date(
    now.getTime() - now.getTimezoneOffset() * 60000
  )
    .toISOString()
    .slice(0, 16);
}

function fmtTime(date?: Date) {
  if (!date) return "-";

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtDate(date?: Date) {
  if (!date) return "-";

  return date.toLocaleDateString("ar-SA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function fmtDay(date?: Date) {
  if (!date) return "-";

  return date.toLocaleDateString("ar-SA", {
    weekday: "long",
  });
}

function formatMoonAge(hours:number){

  const h=Math.floor(hours);

  const m=Math.floor((hours-h)*60);

  const s=Math.floor((((hours-h)*60)-m)*60);

  return `${h} ساعة ${m} دقيقة ${s} ثانية`;

}

export default function Page() {

  const [lat,setLat]=useState("");

  const [lng,setLng]=useState("");

  const [observeTime,setObserveTime]=
    useState(getLocalDateTime());

  const [mainResult,setMainResult]=
    useState<any>(null);

  const [customResult,setCustomResult]=
    useState<any>(null);

  useEffect(()=>{

    navigator.geolocation?.getCurrentPosition(

      (pos)=>{

        setLat(
          pos.coords.latitude.toFixed(6)
        );

        setLng(
          pos.coords.longitude.toFixed(6)
        );

      },

      ()=>{},

      {

        enableHighAccuracy:true,

        maximumAge:0,

        timeout:15000

      }

    );

  },[]);

  function calculate(){

    const la=Number(lat);

    const lo=Number(lng);

    const observer=
      new Astronomy.Observer(
        la,
        lo,
        0
      );

    const now=new Date();

    const astroTime=
      new Astronomy.AstroTime(now);

    /* ===== غروب الشمس ===== */

    const sunsetEvent=
      Astronomy.SearchRiseSet(
        "Sun",
        observer,
        +1,
        astroTime,
        1,
        -0.833
      );

    const sunset=
      sunsetEvent?.date;

    /* ===== غروب القمر ===== */

    const moonsetEvent=
      Astronomy.SearchRiseSet(
        "Moon",
        observer,
        -1,
        astroTime,
        1,
        0
      );

    const moonset=
      moonsetEvent?.date;

    /* ===== المكث ===== */

    const lag =
      sunset && moonset
        ? (
            moonset.getTime() -
            sunset.getTime()
          ) / 60000
        : 0;

    /* ===== أفضل وقت ===== */

    let bestTime:Date|null=null;

    if(
      sunset &&
      moonset &&
      moonset > sunset
    ){

      const bestOffset=
        Math.max(
          10,
          Math.min(
            35,
            lag * 0.35
          )
        );

      bestTime=
        new Date(
          sunset.getTime() +
          bestOffset * 60000
        );

    }

    if(bestTime){

      const result=
        generateMoonData(
          bestTime,
          observer,
          lag
        );

      setMainResult(result);

    }

    calculateCustom();

  }

  function generateMoonData(
    date:Date,
    observer:any,
    lag:number
  ){

    const astro=
      new Astronomy.AstroTime(date);

    /* ===== القمر ===== */

    const equMoon=
      Astronomy.Equator(
        "Moon",
        astro,
        observer,
        true,
        true
      );

    const horMoon=
      Astronomy.Horizon(
        astro,
        observer,
        equMoon.ra,
        equMoon.dec,
        "normal"
      );

    /* ===== الشمس ===== */

    const equSun=
      Astronomy.Equator(
        "Sun",
        astro,
        observer,
        true,
        true
      );

    const horSun=
      Astronomy.Horizon(
        astro,
        observer,
        equSun.ra,
        equSun.dec,
        "normal"
      );

    /* ===== الاستطالة ===== */

    const elongation=
      Astronomy.AngleFromSun(
        "Moon",
        astro
      );

    /* ===== الإضاءة ===== */

    const illum=
      Astronomy.Illumination(
        "Moon",
        astro
      );

    /* ===== عمر الهلال ===== */

    const moonPhase=
      Astronomy.MoonPhase(astro);

    const ageHours=
      moonPhase * 24;

    return {

      date:fmtDate(date),

      day:fmtDay(date),

      time:fmtTime(date),

      azimuth:
        horMoon.azimuth.toFixed(2),

      altitude:
        horMoon.altitude.toFixed(2),

      elongation:
        elongation.toFixed(2),

      illumination:
        illum.phase_fraction
          .toFixed(4)
          .replace(
            "0.",
            ""
          ),

      age:
        formatMoonAge(ageHours),

      lag:
        lag.toFixed(1)

    };

  }

  function calculateCustom(){

    const la=Number(lat);

    const lo=Number(lng);

    const observer=
      new Astronomy.Observer(
        la,
        lo,
        0
      );

    const date=
      new Date(observeTime);

    const result=
      generateMoonData(
        date,
        observer,
        0
      );

    setCustomResult(result);

  }

  return(

    <main style={styles.page}>

      <div style={styles.container}>

        <header style={styles.header}>

          <div style={styles.moon}>
            🌙
          </div>

          <h1 style={styles.title}>
            مرصد الهلال
          </h1>

          <p style={styles.subtitle}>
            حسابات فلكية دقيقة لرصد الهلال
          </p>

        </header>

        <section style={styles.card}>

          <h2 style={styles.cardTitle}>
            📍 موقع الراصد
          </h2>

          <label style={styles.label}>
            خط العرض
          </label>

          <input
            value={lat}
            onChange={(e)=>
              setLat(e.target.value)
            }
            style={styles.input}
          />

          <label style={styles.label}>
            خط الطول
          </label>

          <input
            value={lng}
            onChange={(e)=>
              setLng(e.target.value)
            }
            style={styles.input}
          />

          <button
            onClick={calculate}
            style={styles.primaryButton}
          >
            🔭 احسب
          </button>

        </section>

        {mainResult && (

          <section style={styles.card}>

            <h2 style={styles.cardTitle}>
              ⭐ أفضل وقت لرصد الهلال
            </h2>

            <div style={styles.highlightBox}>

              <Result
                label="التاريخ"
                value={mainResult.date}
              />

              <Result
                label="اليوم"
                value={mainResult.day}
              />

              <Result
                label="الساعة"
                value={mainResult.time}
              />

              <Result
                label="الاتجاه بالبوصلة"
                value={`${mainResult.azimuth}°`}
              />

              <Result
                label="الإرتفاع"
                value={`${mainResult.altitude}°`}
              />

              <Result
                label="العمر"
                value={mainResult.age}
              />

              <Result
                label="الإستطالة"
                value={`${mainResult.elongation}°`}
              />

              <Result
                label="المكث"
                value={`${mainResult.lag} دقيقة`}
              />

              <Result
                label="الإضاءة"
                value={`${mainResult.illumination}%`}
              />

            </div>

          </section>

        )}

        <section style={styles.card}>

          <h2 style={styles.cardTitle}>
            🕒 وقت رصدك أنت
          </h2>

          <input
            type="datetime-local"
            value={observeTime}
            onChange={(e)=>
              setObserveTime(
                e.target.value
              )
            }
            style={styles.input}
          />

          <button
            onClick={calculateCustom}
            style={styles.secondaryButton}
          >
            احسب وقت رصدي
          </button>

          {customResult && (

            <div style={styles.customBox}>

              <Result
                label="موقعي بالإحداثيات"
                value={`${lat}, ${lng}`}
              />

              <Result
                label="التاريخ"
                value={customResult.date}
              />

              <Result
                label="اليوم"
                value={customResult.day}
              />

              <Result
                label="الساعة"
                value={customResult.time}
              />

              <Result
                label="عمر القمر"
                value={customResult.age}
              />

              <Result
                label="الإرتفاع"
                value={`${customResult.altitude}°`}
              />

              <Result
                label="الإستطالة"
                value={`${customResult.elongation}°`}
              />

              <Result
                label="الإضاءة"
                value={`${customResult.illumination}%`}
              />

            </div>

          )}

        </section>

      </div>

    </main>

  );

}

function Result({
  label,
  value
}:{
  label:string;
  value:string;
}){

  return(

    <div style={styles.resultItem}>

      <div style={styles.resultLabel}>
        {label}
      </div>

      <div style={styles.resultValue}>
        {value}
      </div>

    </div>

  );

}

const styles:
Record<string,React.CSSProperties>={

  page:{
    minHeight:"100vh",
    background:
"radial-gradient(circle at top,#1e3a8a 0%,#020617 38%,#000 100%)",
    color:"white",
    fontFamily:"Arial",
    padding:18,
    direction:"rtl"
  },

  container:{
    maxWidth:520,
    margin:"0 auto"
  },

  header:{
    textAlign:"center",
    padding:"20px 0"
  },

  moon:{
    fontSize:50
  },

  title:{
    margin:"8px 0",
    fontSize:34
  },

  subtitle:{
    opacity:0.75,
    margin:0
  },

  card:{
    background:
"rgba(15,23,42,.9)",
    border:
"1px solid rgba(255,255,255,.08)",
    borderRadius:24,
    padding:20,
    marginBottom:18,
    boxShadow:
"0 18px 45px rgba(0,0,0,.35)"
  },

  cardTitle:{
    fontSize:20,
    marginTop:0,
    marginBottom:14
  },

  label:{
    display:"block",
    marginBottom:6,
    opacity:.85
  },

  input:{
    width:"100%",
    padding:14,
    borderRadius:14,
    border:
"1px solid rgba(255,255,255,.12)",
    background:"#020617",
    color:"white",
    marginBottom:12,
    fontSize:16,
    boxSizing:"border-box"
  },

  primaryButton:{
    width:"100%",
    padding:16,
    borderRadius:18,
    border:"none",
    background:
"linear-gradient(135deg,#2563eb,#7c3aed)",
    color:"white",
    fontSize:20,
    fontWeight:"bold",
    cursor:"pointer"
  },

  secondaryButton:{
    width:"100%",
    padding:14,
    borderRadius:16,
    border:
"1px solid rgba(255,255,255,.15)",
    background:"#334155",
    color:"white",
    fontSize:17,
    fontWeight:"bold",
    cursor:"pointer"
  },

  resultGrid:{
    display:"grid",
    gap:10
  },

  highlightBox:{
    display:"grid",
    gap:10,
    background:
"rgba(37,99,235,.12)",
    borderRadius:18,
    padding:14
  },

  customBox:{
    marginTop:16,
    display:"grid",
    gap:10
  },

  resultItem:{
    background:
"rgba(255,255,255,.06)",
    borderRadius:14,
    padding:12
  },

  resultLabel:{
    fontSize:13,
    opacity:.7,
    marginBottom:4
  },

  resultValue:{
    fontSize:20,
    fontWeight:"bold"
  }

};