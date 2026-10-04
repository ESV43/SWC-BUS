/* SWC Bus Slip — booking app (demo + Apps Script live mode, weekend + event specials) */
(function(){
  const CFG = window.SWC_CONFIG || {};
  const API = (CFG.APPS_SCRIPT_URL || "").trim();
  const LIVE = API.length > 10;
  const TOTAL = CFG.TOTAL_SEATS || 32;
  const DOMAIN = CFG.ALLOWED_DOMAIN || "@iisertvm.ac.in";
  const $ = (id) => document.getElementById(id);
  const cardsEl = $("serviceCards"), countdownEl = $("countdown"), modeBadge = $("modeBadge");
  let services = [];
  let user = null;
  try { user = JSON.parse(localStorage.getItem("swc_user") || "null"); } catch(e){}

  const pad = (n)=>String(n).padStart(2,"0");
  const isoOf = (d)=>d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate());
  const fmtD = (iso)=>{ const p=iso.split("-").map(Number); return new Date(p[0],p[1]-1,p[2]).toLocaleDateString("en-IN",{weekday:"short",day:"numeric",month:"short"}); };
  const fmtT = (d)=>d.toLocaleString("en-IN",{day:"numeric",month:"short",hour:"numeric",minute:"2-digit"});
  const esc = (s)=>String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
  function toast(msg, type=""){ const t=document.createElement("div"); t.className="toast "+type; t.textContent=msg; $("toasts").appendChild(t); setTimeout(()=>t.remove(),4500); }
  function showModal(title, body){ $("modalTitle").textContent=title; $("modalBody").innerHTML=body; $("modal").classList.remove("hidden"); }
  $("modalClose").onclick=()=>$("modal").classList.add("hidden");
  $("modal").addEventListener("click",(e)=>{ if(e.target.id==="modal") $("modal").classList.add("hidden"); });

  modeBadge.textContent = LIVE ? "● LIVE" : "DEMO";
  modeBadge.classList.toggle("live", LIVE);
  const demoTools = $("demoTools");
  if (demoTools) demoTools.classList.toggle("hidden", LIVE);

  /* next Saturday + Sunday 9 PM departures (form open till 9 PM) */
  function nextServiceDates(){
    const out=[];
    for(let i=0;i<14 && out.length<2;i++){
      const now=new Date();
      const d=new Date(now.getFullYear(),now.getMonth(),now.getDate()+i);
      const dow=d.getDay();
      if(dow===6||dow===0){
        const dep=new Date(d.getFullYear(),d.getMonth(),d.getDate(),21,0,0);
        if(dep.getTime()>Date.now()) out.push(isoOf(d));
      }
    }
    return out;
  }
  function windowFor(iso){
    const p=iso.split("-").map(Number);
    const opens=new Date(p[0],p[1]-1,p[2]-1,17,30,0);
    const closes=new Date(p[0],p[1]-1,p[2],21,0,0);
    const dep=new Date(p[0],p[1]-1,p[2],21,0,0);
    return {opens,closes,dep};
  }
  function dayName(iso){ const p=iso.split("-").map(Number); return new Date(p[0],p[1]-1,p[2]).toLocaleDateString("en-IN",{weekday:"long"}); }

  /* demo store */
  const LS_B="swc_bookings_v1", LS_D="swc_disabled_v1", LS_S="swc_specials_v1";
  const getB=()=>{ try{return JSON.parse(localStorage.getItem(LS_B)||"[]");}catch(e){return[];} };
  const setB=(a)=>{ try{localStorage.setItem(LS_B,JSON.stringify(a));}catch(e){} };
  const getD=()=>{ try{return JSON.parse(localStorage.getItem(LS_D)||"{}");}catch(e){return{};} };
  const getS=()=>{ try{return JSON.parse(localStorage.getItem(LS_S)||"[]");}catch(e){return[];} };
  const setS=(a)=>{ try{localStorage.setItem(LS_S,JSON.stringify(a));}catch(e){} };
  if(!localStorage.getItem(LS_B)){
    const dts=nextServiceDates(); const s1=dts[0];
    const seed=[]; const nm=["Aarav","Diya","Ishaan","Meera","Arjun","Sana","Kiran","Devika"];
    if(s1) for(let i=0;i<19;i++) seed.push({bookingId:"SWC-DEMO"+(100+i),serviceId:"WEEKEND-"+s1,serviceName:"Weekend Night Bus",serviceDate:s1,day:dayName(s1),name:nm[i%nm.length]+" M",email:"student"+i+"@iisertvm.ac.in",phone:"98765432"+pad(10+i),status:"CONFIRMED",seatNo:String(i+1),waitlistPosition:"",createdAt:new Date().toISOString()});
    setB(seed);
  }
  const svcKey=(b)=>b.serviceId || ("WEEKEND-"+b.serviceDate);

  function demoStatus(iso){
    const dis=getD(); const disabled=!!dis[iso];
    const w=windowFor(iso); const now=new Date();
    const sid="WEEKEND-"+iso;
    const all=getB().filter(b=>svcKey(b)===sid);
    const confirmed=all.filter(b=>b.status==="CONFIRMED").length;
    const waitlist=all.filter(b=>b.status==="WAITLIST").length;
    let win="open"; const open=!disabled&&now>=w.opens&&now<=w.closes;
    if(disabled) win="disabled"; else if(now<w.opens) win="upcoming"; else if(now>w.closes) win="closed";
    return {serviceId:sid,kind:"weekend",serviceName:"Weekend Night Bus",serviceDate:iso,day:dayName(iso),
      departure:iso+" 21:00",from:"Thampanoor",to:"IISER TVM",totalSeats:TOTAL,confirmedCount:confirmed,
      available:Math.max(0,TOTAL-confirmed),waitlistCount:waitlist,disabled,disableReason:dis[iso]||"",
      bookingOpen:open,window:win,opensAt:fmtT(w.opens),closesAt:fmtT(w.closes),
      opensISO:w.opens.toISOString(),closesISO:w.closes.toISOString(),departISO:w.dep.toISOString()};
  }
  // demo specials: open immediately after adding, till departure
  function specialStatus(sp){
    const now=new Date();
    const dep=new Date(sp.departISO);
    const total=sp.totalSeats||TOTAL;
    const all=getB().filter(b=>svcKey(b)===sp.serviceId);
    const confirmed=all.filter(b=>b.status==="CONFIRMED").length;
    const waitlist=all.filter(b=>b.status==="WAITLIST").length;
    const disabled=!!sp.disabled;
    let win="open"; const open=!disabled&&now<=dep;
    if(disabled) win="disabled"; else if(now>dep) win="closed";
    return {serviceId:sp.serviceId,kind:"special",serviceName:sp.serviceName,serviceDate:sp.serviceDate,day:dayName(sp.serviceDate),
      departure:sp.serviceDate+" "+sp.departTime,from:sp.from||"Thampanoor",to:sp.to||"IISER TVM",
      totalSeats:total,confirmedCount:confirmed,available:Math.max(0,total-confirmed),waitlistCount:waitlist,
      disabled,disableReason:sp.reason||"",bookingOpen:open,window:win,
      opensAt:"now",closesAt:fmtT(dep),opensISO:new Date(2000,0,1).toISOString(),closesISO:dep.toISOString(),departISO:dep.toISOString()};
  }

  async function apiGet(params){
    const u=API+(API.includes("?")?"&":"?")+new URLSearchParams(params).toString();
    const r=await fetch(u); return r.json();
  }
  async function apiPost(body){
    const r=await fetch(API,{method:"POST",headers:{"Content-Type":"text/plain;charset=utf-8"},body:JSON.stringify(body)});
    return r.json();
  }

  async function loadServices(){
    if(LIVE){
      try{
        const j=await apiGet({action:"services"});
        if(j.ok&&j.services&&j.services.length){ services=j.services; return render(); }
      }catch(e){ toast("Live backend unreachable — showing local estimate.","err"); }
    }
    const list=nextServiceDates().map(demoStatus);
    getS().forEach(sp=>{ if(new Date(sp.departISO).getTime()>Date.now()-36e5) list.push(specialStatus(sp)); });
    list.sort((a,b)=>new Date(a.departISO)-new Date(b.departISO));
    services=list.slice(0,10); render();
  }

  function stamp(s){
    if(s.disabled) return `<span class="stamp off">OFF</span>`;
    if(s.window==="upcoming") return `<span class="stamp soon">OPENS ${esc(s.opensAt).toUpperCase()}</span>`;
    if(s.window==="closed") return `<span class="stamp off">GONE</span>`;
    if(s.available<=0) return `<span class="stamp full">FULL</span>`;
    return `<span class="stamp open">OPEN</span>`;
  }

  function render(){
    cardsEl.innerHTML=services.map(s=>{
      const pct=Math.min(100,Math.round(s.confirmedCount/s.totalSeats*100));
      const title=s.kind==="special"?esc(s.serviceName):s.day.slice(0,3).toUpperCase();
      const sub2=`${fmtD(s.serviceDate)} · ${esc(String(s.departure).split(" ").pop())} · ${esc(s.from)} → ${esc(s.to)}`;
      const sub=s.disabled?("Off"+(s.disableReason?": "+esc(s.disableReason):""))
        : s.window==="upcoming"?("Opens "+esc(s.opensAt))
        : s.window==="closed"?("Closed "+esc(s.closesAt))
        : s.available>0?(`${s.waitlistCount? s.waitlistCount+" on waitlist · ":""}closes ${esc(String(s.departure).split(" ").pop())}`)
        :(`Sorry — all ${s.totalSeats} filled`+(s.waitlistCount?` · ${s.waitlistCount} waiting`:" — join waitlist"));
      const can=s.bookingOpen;
      const btn=s.disabled?"NOT OPERATING":s.window==="upcoming"?"OPENS "+esc(s.opensAt):s.window==="closed"?"BOOKING CLOSED":s.available>0?"BOOK THIS BUS":"JOIN WAITLIST";
      return `<div class="bus ${s.disabled?"off":""} ${s.available<=0&&!s.disabled?"full":""}">
        <div class="bus-top"><div><div class="bus-day">${title}</div><div class="bus-date">${sub2}</div></div>${stamp(s)}</div>
        <div class="seat-big">${s.disabled?"–":s.available}<small> / ${s.totalSeats} left</small></div>
        <div class="meter"><i style="width:${s.disabled?0:pct}%"></i></div>
        <div class="bus-meta">${sub}</div>
        <button class="pick" ${can?"":"disabled"} onclick="window._prefill('${esc(s.serviceId)}')">${btn}</button>
      </div>`;
    }).join("") || `<p class="hint">No upcoming buses right now — check back soon.</p>`;
    $("fService").innerHTML=services.map(s=>`<option value="${esc(s.serviceId)}">${s.kind==="special"?esc(s.serviceName)+" · ":""}${s.day.slice(0,3)} ${fmtD(s.serviceDate)} — ${s.disabled?"off":s.available<=0?"full · waitlist":s.available+" left"}</option>`).join("");
    tick();
  }
  window._prefill=(sid)=>{ $("fService").value=sid; $("bookForm").scrollIntoView({behavior:"smooth",block:"center"}); };

  function svcWindow(s){
    if(s.opensISO&&s.closesISO) return {opens:new Date(s.opensISO),closes:new Date(s.closesISO),dep:new Date(s.departISO||s.closesISO)};
    const w=windowFor(s.serviceDate); return {opens:w.opens,closes:w.closes,dep:w.dep};
  }
  function shortDay(s){ return s.kind==="special"?s.serviceName:(s.day||"").slice(0,3); }
  function tick(){
    if(!services.length) return;
    const now=new Date();
    let ev=null;
    for(const s of services){
      if(s.disabled) continue;
      const w=svcWindow(s);
      if(now<w.opens){ ev={t:w.opens,label:`${shortDay(s)} booking opens in`}; break; }
      if(now<=w.closes){ ev={t:w.closes,label:`${shortDay(s)} booking closes in`}; break; }
      if(now<=w.dep){ ev={t:w.dep,label:`${shortDay(s)} bus leaves in`}; break; }
    }
    if(!ev){ countdownEl.textContent="No upcoming buses right now — check back soon."; return; }
    const ms=ev.t-now; if(ms<0){countdownEl.textContent="updating…";return;}
    const h=Math.floor(ms/36e5),m=Math.floor(ms%36e5/6e4),sec=Math.floor(ms%6e4/1e3);
    countdownEl.textContent=`⏳ ${ev.label} ${pad(h)}:${pad(m)}:${pad(sec)}`;
  }
  setInterval(tick,1000);

  /* auth */
  function initAuth(){
    paintUser();
    const cid=(CFG.GOOGLE_CLIENT_ID||"").trim();
    if(!cid){
      $("loginBtn").onclick=()=>{
        const em=prompt("Demo sign-in — your @iisertvm.ac.in email:","student@iisertvm.ac.in");
        if(!em) return;
        if(!em.toLowerCase().endsWith(DOMAIN)){ toast("Only "+DOMAIN+" IDs allowed.","err"); return; }
        user={name:em.split("@")[0],email:em.toLowerCase()};
        localStorage.setItem("swc_user",JSON.stringify(user)); paintUser(); toast("Signed in as "+user.email,"ok");
      };
      return;
    }
    try{
      google.accounts.id.initialize({client_id:cid,callback:onCred});
      google.accounts.id.renderButton($("gBtnWrap"),{theme:"outline",size:"large",text:"signin_with",shape:"rectangular"});
    }catch(e){}
    $("loginBtn").onclick=()=>{ try{google.accounts.id.prompt();}catch(e){toast("Google sign-in not ready yet.","err");} };
  }
  function onCred(resp){
    try{
      const payload=JSON.parse(atob(resp.credential.split(".")[1]));
      const email=(payload.email||"").toLowerCase();
      if(!email.endsWith(DOMAIN)){ toast("Only "+DOMAIN+" IDs can book.","err"); return; }
      user={name:payload.name||email.split("@")[0],email};
      localStorage.setItem("swc_user",JSON.stringify(user)); paintUser();
      $("fEmail").value=email; if(!$("fName").value&&payload.name) $("fName").value=payload.name;
      toast("Verified "+email,"ok");
    }catch(e){ toast("Sign-in failed.","err"); }
  }
  function paintUser(){
    const has=!!user;
    $("loginBtn").classList.toggle("hidden",has);
    $("userChip").classList.toggle("hidden",!has);
    if(has){ $("userEmail").textContent=user.email; if(!$("lookupEmail").value) $("lookupEmail").value=user.email; if(!$("fEmail").value) $("fEmail").value=user.email; }
  }
  $("logoutBtn").onclick=()=>{ user=null; localStorage.removeItem("swc_user"); paintUser(); };

  /* book */
  $("bookForm").addEventListener("submit",async(e)=>{
    e.preventDefault();
    const msg=$("formMsg"); msg.className="form-msg"; msg.textContent="";
    const serviceId=$("fService").value;
    const svc=services.find(x=>x.serviceId===serviceId) || {};
    const name=$("fName").value.trim(), phone=$("fPhone").value.trim(), email=$("fEmail").value.trim().toLowerCase();
    if(!email.endsWith(DOMAIN)){ msg.className="form-msg err"; msg.textContent="Only "+DOMAIN+" IDs can book."; return; }
    if(user&&user.email!==email){ msg.className="form-msg err"; msg.textContent="Signed in as "+user.email+" — use the same email."; return; }
    $("bookBtn").disabled=true; $("bookBtn").textContent="BOOKING…";
    try{
      const j = LIVE
        ? await apiPost({action:"book",serviceId,serviceDate:svc.serviceDate,name,email,phone}).then(r=>{ if(!r.ok) throw new Error(r.error); return r; })
        : demoBook(serviceId,name,email,phone);
      const tag=svc.serviceName?esc(svc.serviceName)+" · ":"";
      if(j.status==="CONFIRMED"){
        msg.className="form-msg ok"; msg.textContent="Booked! Mail sent to "+email;
        showModal("Seat booked ✅",`Hi <b>${esc(name)}</b> — ${tag}<b>${esc(svc.serviceDate||"")}</b> confirmed.<br><br>ID: <b>${esc(j.bookingId)}</b><br>Mail from <b>SWC.IISER.TVM</b> sent to <b>${esc(email)}</b>.<br>Be ready 15 min early with college ID.`);
      }else{
        msg.className="form-msg ok"; msg.textContent=`All ${svc.totalSeats||""} filled — waitlist #${j.waitlistPosition}`;
        showModal("Waitlist #"+j.waitlistPosition,`Sorry, all seats are filled.<br><br>You are <b>#${esc(j.waitlistPosition)}</b> for ${tag}<b>${esc(svc.serviceDate||"")}</b> (ID <b>${esc(j.bookingId)}</b>).<br>Auto-confirm + mail if someone cancels.`);
      }
      loadServices(); loadMy(email);
    }catch(err){ msg.className="form-msg err"; msg.textContent=err.message; toast(err.message,"err"); }
    finally{ $("bookBtn").disabled=false; $("bookBtn").textContent="BOOK SEAT →"; }
  });

  function demoBook(serviceId,name,email,phone){
    const st=services.find(x=>x.serviceId===serviceId);
    if(!st) throw new Error("Unknown bus service.");
    if(st.disabled) throw new Error("This bus is not operating"+(st.disableReason?" ("+st.disableReason+")":"")+".");
    if(!st.bookingOpen) throw new Error(st.window==="upcoming"?("Opens "+st.opensAt+"."):("Closed ("+st.opensAt+" → "+st.closesAt+")."));
    const all=getB();
    if(all.some(b=>svcKey(b)===serviceId&&b.email===email&&(b.status==="CONFIRMED"||b.status==="WAITLIST")))
      throw new Error("You already booked this bus. See My bookings.");
    const c=all.filter(b=>svcKey(b)===serviceId&&b.status==="CONFIRMED").length;
    const w=all.filter(b=>svcKey(b)===serviceId&&b.status==="WAITLIST").length;
    const id=(st.kind==="special"?"EVT-":"SWC-")+st.serviceDate.replace(/-/g,"")+"-"+Math.random().toString(36).slice(2,8).toUpperCase();
    const rec=c<st.totalSeats
      ? {bookingId:id,serviceId,serviceName:st.serviceName,serviceDate:st.serviceDate,day:st.day,name,email,phone,status:"CONFIRMED",seatNo:String(c+1),waitlistPosition:"",createdAt:new Date().toISOString()}
      : {bookingId:id,serviceId,serviceName:st.serviceName,serviceDate:st.serviceDate,day:st.day,name,email,phone,status:"WAITLIST",seatNo:"",waitlistPosition:String(w+1),createdAt:new Date().toISOString()};
    all.push(rec); setB(all);
    setTimeout(()=>toast("📧 SWC.IISER.TVM → "+email+": "+(rec.status==="CONFIRMED"?"confirmed":"waitlist #"+rec.waitlistPosition),"ok"),500);
    return {ok:true,status:rec.status,bookingId:id,seatNo:rec.seatNo,waitlistPosition:rec.waitlistPosition};
  }

  /* demo: add a sample event bus (visible only in DEMO) */
  const demoBtn=$("demoEventBtn");
  if(demoBtn) demoBtn.onclick=()=>{
    const name=prompt("Event bus name:","Tech Fest Shuttle");
    if(!name) return;
    let date=prompt("Date (YYYY-MM-DD):",isoOf(new Date(Date.now()+3*864e5)));
    if(!date||!/^\d{4}-\d{2}-\d{2}$/.test(date)) return alert("Use YYYY-MM-DD.");
    const time=prompt("Departure time (HH:MM, 24h):","14:30");
    const m=String(time||"").match(/^(\d{1,2}):(\d{2})$/);
    if(!m) return alert("Use HH:MM.");
    const seats=parseInt(prompt("Number of seats:","20")||"20",10)||20;
    const p=date.split("-").map(Number);
    const dep=new Date(p[0],p[1]-1,p[2],parseInt(m[1],10),parseInt(m[2],10),0);
    if(dep.getTime()<Date.now()) return alert("Pick a future date/time.");
    const list=getS();
    list.push({serviceId:"EVT-"+date+"-"+name.toUpperCase().replace(/[^A-Z0-9]+/g,"-").slice(0,20)+"-"+Math.random().toString(36).slice(2,5).toUpperCase(),
      serviceName:name,serviceDate:date,departTime:m[1].padStart(2,"0")+":"+m[2],from:"Thampanoor",to:"IISER TVM",
      totalSeats:seats,disabled:false,reason:"",departISO:dep.toISOString()});
    setS(list); toast("Demo event bus added — open now!","ok"); loadServices();
  };

  /* my bookings */
  $("lookupBtn").onclick=()=>loadMy($("lookupEmail").value.trim().toLowerCase());
  async function loadMy(email){
    const box=$("myList");
    if(!email||!email.includes("@")){ box.innerHTML=`<p class="hint">Enter a valid email.</p>`; return; }
    box.innerHTML=`<p class="hint">Loading…</p>`;
    let list=[];
    try{
      if(LIVE){ const j=await apiPost({action:"mybookings",email}); if(!j.ok) throw new Error(j.error); list=j.bookings; }
      else list=getB().filter(b=>b.email===email).reverse();
    }catch(e){ box.innerHTML=`<p class="hint">⚠️ ${esc(e.message)}</p>`; return; }
    if(!list.length){ box.innerHTML=`<p class="hint">No bookings for <b>${esc(email)}</b>.</p>`; return; }
    box.innerHTML=list.map(b=>{
      const nm=b.serviceName||b.day||"";
      const dep=b.departure||b.serviceDate||"";
      return `<div class="ticket-row">
      <div><strong>${esc(nm)} · ${esc(dep)}</strong><br><span class="id">${esc(b.bookingId)}${b.seatNo?" · seat "+esc(b.seatNo):""}${b.waitlistPosition?" · WL #"+esc(b.waitlistPosition):""}</span></div>
      <div style="display:flex;gap:8px;align-items:center"><span class="pill ${b.status}">${b.status}</span>
      ${(b.status==="CONFIRMED"||b.status==="WAITLIST")?`<button class="cancel" onclick="window._cancel('${b.bookingId}','${esc(b.email||email)}')">Cancel</button>`:""}</div>
    </div>`;}).join("");
  }
  window._cancel=async(id,email)=>{
    if(!confirm("Cancel "+id+"? Seat goes to the waitlist.")) return;
    try{
      if(LIVE){
        const j=await apiPost({action:"cancel",bookingId:id,email});
        if(!j.ok) throw new Error(j.error);
        toast(j.message,"ok"); showModal("Cancelled",esc(j.message)+"<br><br>Mail sent by <b>SWC.IISER.TVM</b>.");
      }else{
        const all=getB(); const r=all.find(b=>b.bookingId===id);
        if(!r||r.email!==email) throw new Error("Email mismatch.");
        if(r.status==="CANCELLED") throw new Error("Already cancelled.");
        const sid=svcKey(r); const wasSeat=!!r.seatNo;
        r.status="CANCELLED";
        const wl=all.filter(b=>svcKey(b)===sid&&b.status==="WAITLIST").sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt));
        let promoted=null;
        if(wl.length&&wasSeat){
          promoted=wl[0]; const old=promoted.waitlistPosition;
          promoted.status="CONFIRMED"; promoted.seatNo=String(all.filter(b=>svcKey(b)===sid&&b.status==="CONFIRMED").length+1); promoted.waitlistPosition="";
          setTimeout(()=>toast("📧 SWC.IISER.TVM → "+promoted.email+": WL #"+old+" now CONFIRMED","ok"),500);
        }
        let n=1; all.filter(b=>svcKey(b)===sid&&b.status==="WAITLIST").sort((a,b)=>new Date(a.createdAt)-new Date(b.createdAt)).forEach(w=>w.waitlistPosition=String(n++));
        setB(all);
        toast(promoted?("Cancelled. "+promoted.email+" promoted."):"Cancelled.","ok");
        showModal("Cancelled",promoted?(`Booking <b>${esc(id)}</b> cancelled.<br><b>${esc(promoted.email)}</b> promoted from waitlist & mailed.`):(`Booking <b>${esc(id)}</b> cancelled.`));
      }
    }catch(e){ toast(e.message,"err"); }
    loadServices(); loadMy(email);
  };

  initAuth(); loadServices();
  if(user) loadMy(user.email);
})();
