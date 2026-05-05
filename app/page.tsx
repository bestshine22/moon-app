"use client";

import { useEffect, useState } from "react";
import SunCalc from "suncalc";

/* ===== Helpers ===== */
const rad2deg = (r:number)=> r*180/Math.PI;

function toDMS(v:number,type:"lat"|"lng"){
  const dir=type==="lat"?v>=0?"N":"S":v>=0?"E":"W";
  const a=Math.abs(v);
  const d=Math.floor(a);
  const m=Math.floor((a-d)*60);
  const s=(((a-d)*60-m)*60).toFixed(1);
  return `${d}°${m}'${s}" ${dir}`;
}

/* ===== Visibility Models ===== */
function yallop(arcv:number, elong:number){
  const q = arcv - (11.837 + 6.3226*elong - 0.7319*elong*elong);
  if(q > 0) return "✅ Visible";
  if(q > -2) return "⚠️ Optical Aid";
  return "❌ Not visible";
}

function odehLike(arcv:number, lag:number, elong:number){
  if(lag>40 && arcv>10 && elong>10) return "✅ Visible";
  if(lag>20 && arcv>6) return "⚠️ Difficult";
  return "❌ Not visible";
}

function danjon(elong:number){
  return elong < 7 ? "❌ Below Danjon limit" : "✔ Above limit";
}

/* ===== Page ===== */
export default function Page(){

  const [lat,setLat]=useState("");
  const [lng,setLng]=useState("");
  const [dt,setDt]=useState(new Date().toISOString().slice(0,16));
  const [data,setData]=useState<any>(null);

  useEffect(()=>{
    navigator.geolocation?.getCurrentPosition(p=>{
      setLat(p.coords.latitude.toFixed(6));
      setLng(p.coords.longitude.toFixed(6));
    });
  },[]);

  const calc=()=>{
    const d=new Date(dt);
    const la=Number(lat);
    const lo=Number(lng);

    const moon=SunCalc.getMoonPosition(d,la,lo);
    const sun=SunCalc.getPosition(d,la,lo);
    const illum=SunCalc.getMoonIllumination(d);
    const times=SunCalc.getTimes(d,la,lo);
    const mt=SunCalc.getMoonTimes(d,la,lo);

    const alt=rad2deg(moon.altitude);
    const az=rad2deg(moon.azimuth)+180;
    const sunAlt=rad2deg(sun.altitude);

    const lag = mt.set && times.sunset
      ? (mt.set.getTime()-times.sunset.getTime())/60000
      : 0;

    const elong = illum.phase*360;
    const arcv = alt - sunAlt;

    setData({
      alt:alt.toFixed(2),
      az:az.toFixed(2),
      illum:(illum.fraction*100).toFixed(1),
      age:(illum.phase*29.53).toFixed(1),
      sunset:times.sunset?.toLocaleTimeString(),
      moonset:mt.set?.toLocaleTimeString(),
      lag:lag.toFixed(1),
      elong:elong.toFixed(1),
      arcv:arcv.toFixed(1),
      yallop:yallop(arcv,elong),
      odeh:odehLike(arcv,lag,elong),
      danjon:danjon(elong)
    });
  };

  /* ===== PDF ===== */
  const downloadPDF=()=>{
    const text=`
Moon Report
Lat: ${lat}
Lng: ${lng}

Altitude: ${data.alt}
Azimuth: ${data.az}

Illumination: ${data.illum}%
Age: ${data.age}

Lag: ${data.lag}
Elongation: ${data.elong}
ARCV: ${data.arcv}

Yallop: ${data.yallop}
Odeh: ${data.odeh}
Danjon: ${data.danjon}
`;

    const blob=new Blob([text],{type:"application/pdf"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url;
    a.download="moon-report.pdf";
    a.click();
  };

  return(
    <div style={{
      minHeight:"100vh",
      background:"#020617",
      color:"white",
      display:"flex",
      justifyContent:"center",
      alignItems:"center",
      flexDirection:"column",
      padding:20
    }}>

      <h1>🌙 Hilal Pro</h1>

      <div style={{
        background:"#0f172a",
        padding:20,
        borderRadius:16,
        width:300
      }}>
        <input value={lat} onChange={e=>setLat(e.target.value)} placeholder="Latitude"/>
        <input value={lng} onChange={e=>setLng(e.target.value)} placeholder="Longitude"/>
        <input type="datetime-local" value={dt} onChange={e=>setDt(e.target.value)}/>

        <button onClick={calc}>Calculate</button>
      </div>

      {data && (
        <div style={{
          marginTop:20,
          background:"#0f172a",
          padding:20,
          borderRadius:16,
          width:320,
          textAlign:"center"
        }}>
          <h3>📍 Observer</h3>
          <p>{lat}, {lng}</p>
          <p>{toDMS(Number(lat),"lat")} , {toDMS(Number(lng),"lng")}</p>

          <h3>🌙 Moon</h3>
          <p>Altitude: {data.alt}°</p>
          <p>Azimuth: {data.az}°</p>
          <p>Illumination: {data.illum}%</p>
          <p>Age: {data.age}</p>

          <h3>🌇 Times</h3>
          <p>Sunset: {data.sunset}</p>
          <p>Moonset: {data.moonset}</p>
          <p>Lag: {data.lag}</p>

          <h3>📐 Visibility</h3>
          <p>Elongation: {data.elong}</p>
          <p>ARCV: {data.arcv}</p>

          <p><b>Yallop:</b> {data.yallop}</p>
          <p><b>Model 2:</b> {data.odeh}</p>
          <p><b>Danjon:</b> {data.danjon}</p>

          <button onClick={downloadPDF}>
            📄 Download Report
          </button>
        </div>
      )}

    </div>
  );
}