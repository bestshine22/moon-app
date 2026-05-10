"use client";

import { useEffect, useRef, useState } from "react";
import SunCalc from "suncalc";

/* ================= Helpers ================= */

const rad2deg = (r:number)=> r*180/Math.PI;

function toDMS(v:number,type:"lat"|"lng"){
  const dir=type==="lat"?v>=0?"N":"S":v>=0?"E":"W";
  const a=Math.abs(v);
  const d=Math.floor(a);
  const m=Math.floor((a-d)*60);
  const s=(((a-d)*60-m)*60).toFixed(1);
  return `${d}°${m}'${s}" ${dir}`;
}

function localTime(date?:Date){
  if(!date) return "-";

  return new Intl.DateTimeFormat([],{
    hour:"2-digit",
    minute:"2-digit"
  }).format(date);
}

/* ===== Visibility ===== */

function visibility(arcv:number,lag:number,elong:number){

  if(lag>40 && arcv>10 && elong>10){
    return "✅ مرئي";
  }

  if(lag>20 && arcv>6){
    return "⚠️ صعب";
  }

  return "❌ غير مرئي";
}

/* ================= App ================= */

export default function Page(){

  const [lat,setLat]=useState("");
  const [lng,setLng]=useState("");
  const [dt,setDt]=useState(new Date().toISOString().slice(0,16));
  const [data,setData]=useState<any>(null);
  const [heading,setHeading]=useState(0);

  const videoRef=useRef<HTMLVideoElement>(null);

  /* ===== GPS ===== */

  useEffect(()=>{

    navigator.geolocation?.getCurrentPosition(p=>{
      setLat(p.coords.latitude.toFixed(6));
      setLng(p.coords.longitude.toFixed(6));
    });

    window.addEventListener("deviceorientation",(e)=>{
      if(e.alpha!=null){
        setHeading(360-e.alpha);
      }
    });

  },[]);

  /* ===== Camera ===== */

  const startCamera=async()=>{

    try{
      const stream=await navigator.mediaDevices.getUserMedia({
        video:{
          facingMode:"environment"
        }
      });

      if(videoRef.current){
        videoRef.current.srcObject=stream;
      }

    }catch(err){
      alert("Camera not supported");
    }
  };

  /* ===== Calculate ===== */

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

    const lag=
      mt.set && times.sunset
      ? (mt.set.getTime()-times.sunset.getTime())/60000
      :0;

    const elong=illum.phase*360;

    const arcv=alt-sunAlt;

    setData({
      alt:alt.toFixed(2),
      az:az.toFixed(2),
      illum:(illum.fraction*100).toFixed(1),
      illumRaw:illum.fraction,
      age:(illum.phase*29.53).toFixed(1),
      sunset:localTime(times.sunset),
      moonset:localTime(mt.set),
      lag:lag.toFixed(1),
      elong:elong.toFixed(1),
      arcv:arcv.toFixed(1),
      vis:visibility(arcv,lag,elong)
    });

  };

  /* ===== Compass Direction ===== */

  const direction=
    data
    ? (Number(data.az)-heading+360)%360
    :0;

  /* ===== Result Color ===== */

  const resultColor=
    data?.vis.includes("✅")
    ? "#22c55e"
    : data?.vis.includes("⚠️")
    ? "#f59e0b"
    : "#ef4444";

  return(

    <div style={{
      minHeight:"100vh",
      background:"radial-gradient(circle,#020617,#000)",
      color:"white",
      display:"flex",
      flexDirection:"column",
      alignItems:"center",
      padding:20,
      textAlign:"center",
      fontFamily:"system-ui"
    }}>

      {/* TITLE */}

      <h1 style={{
        fontSize:30,
        marginBottom:10
      }}>
        🌙 Hilal Pro
      </h1>

      {/* INPUT CARD */}

      <div style={{
        width:340,
        background:"#0f172a",
        padding:20,
        borderRadius:20,
        boxShadow:"0 0 40px rgba(37,99,235,0.35)"
      }}>

        <input
          value={lat}
          onChange={e=>setLat(e.target.value)}
          placeholder="Latitude"
          style={{
            width:"100%",
            padding:10,
            marginBottom:8
          }}
        />

        <input
          value={lng}
          onChange={e=>setLng(e.target.value)}
          placeholder="Longitude"
          style={{
            width:"100%",
            padding:10,
            marginBottom:8
          }}
        />

        <input
          type="datetime-local"
          value={dt}
          onChange={e=>setDt(e.target.value)}
          style={{
            width:"100%",
            padding:10,
            marginBottom:12
          }}
        />

        {/* BUTTON */}

        <button
          onClick={calc}
          style={{
            width:"100%",
            padding:14,
            borderRadius:14,
            border:"none",
            background:"#2563eb",
            color:"white",
            fontSize:17,
            fontWeight:"bold",
            cursor:"pointer"
          }}
        >
          🔍 احسب
        </button>

      </div>

      {/* RESULTS */}

      {data && (

        <div style={{
          width:340,
          marginTop:20,
          background:"#0f172a",
          padding:20,
          borderRadius:20,
          boxShadow:"0 0 30px rgba(0,0,0,0.45)"
        }}>

          {/* LOCATION */}

          <h3>📍 موقع الراصد</h3>

          <p>{lat}, {lng}</p>

          <p>
            {toDMS(Number(lat),"lat")}
            {" , "}
            {toDMS(Number(lng),"lng")}
          </p>

          {/* MOON */}

          <h3>🌙 القمر</h3>

          <p>الارتفاع: {data.alt}°</p>

          <p>الاتجاه: {data.az}°</p>

          <p>الإضاءة: {data.illum}%</p>

          <p>العمر: {data.age} يوم</p>

          {/* TIMES */}

          <h3>🌇 الأوقات</h3>

          <p>غروب الشمس: {data.sunset}</p>

          <p>غروب القمر: {data.moonset}</p>

          <p>المكث: {data.lag} دقيقة</p>

          {/* VISIBILITY */}

          <h3>📊 معيار عودة</h3>

          <div style={{
            background:resultColor,
            padding:"12px 16px",
            borderRadius:14,
            fontWeight:"bold",
            fontSize:20,
            marginBottom:15
          }}>
            {data.vis}
          </div>

          <p>الاستطالة: {data.elong}°</p>

          <p>ARCV: {data.arcv}</p>

          {/* REAL MOON */}

          <h3>🌙 شكل الهلال</h3>

          <div style={{
            width:100,
            height:100,
            margin:"auto",
            borderRadius:"50%",
            background:`linear-gradient(
              90deg,
              #111 ${100-data.illumRaw*100}%,
              white ${100-data.illumRaw*100}%
            )`,
            boxShadow:"0 0 25px rgba(255,255,255,0.35)"
          }}/>

          {/* COMPASS */}

          <h3 style={{marginTop:20}}>🧭 البوصلة</h3>

          <div style={{
            width:140,
            height:140,
            margin:"auto",
            borderRadius:"50%",
            border:"4px solid #2563eb",
            position:"relative"
          }}>

            <div style={{
              position:"absolute",
              top:"50%",
              left:"50%",
              transform:`translate(-50%,-50%) rotate(${direction}deg)`,
              fontSize:40
            }}>
              ↑
            </div>

          </div>

          {/* SKY MAP */}

          <h3 style={{marginTop:20}}>🌌 خريطة السماء</h3>

          <div style={{
            height:160,
            borderRadius:16,
            background:"linear-gradient(#020617,#111827)",
            position:"relative",
            overflow:"hidden"
          }}>

            {/* Stars */}

            {[...Array(40)].map((_,i)=>(

              <div
                key={i}
                style={{
                  width:2,
                  height:2,
                  background:"white",
                  borderRadius:"50%",
                  position:"absolute",
                  top:`${Math.random()*100}%`,
                  left:`${Math.random()*100}%`
                }}
              />

            ))}

            {/* Moon */}

            <div style={{
              width:18,
              height:18,
              borderRadius:"50%",
              background:"white",
              position:"absolute",
              bottom:`${data.alt}%`,
              left:`${data.az/3}%`,
              boxShadow:"0 0 20px white"
            }}/>

          </div>

          {/* AR CAMERA */}

          <h3 style={{marginTop:20}}>📷 AR</h3>

          <video
            ref={videoRef}
            autoPlay
            playsInline
            style={{
              width:"100%",
              borderRadius:16,
              background:"#000"
            }}
          />

          <button
            onClick={startCamera}
            style={{
              marginTop:10,
              width:"100%",
              padding:12,
              borderRadius:12,
              border:"none",
              background:"#16a34a",
              color:"white",
              fontWeight:"bold"
            }}
          >
            📷 تشغيل الكاميرا
          </button>

        </div>

      )}

    </div>

  );

}