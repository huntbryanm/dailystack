import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  auth,
  signInWithGoogle,
  signOutUser,
  loadUserData,
  saveUserData,
  initializeUser,
  onAuthStateChanged,
} from "./firebase";

// ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
// ┃  REPLACE WITH YOUR GUMROAD PRODUCT PERMALINK     ┃
// ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛
const GUMROAD_URL = "https://yourname.gumroad.com/l/dailystack-pro";

const TEMPLATES = {
  student: { label: "Student", emoji: "📚", desc: "Stay on top of classes, study habits, and self-care",
    habits: ["Morning routine", "Review lecture notes", "Study 2+ hours", "Read for 30 min", "Exercise or walk", "Drink 8 glasses of water", "No social media before noon", "Prepare tomorrow's schedule", "Lights out by 11pm"] },
  professional: { label: "Professional", emoji: "💼", desc: "Maximize your workday and maintain work-life balance",
    habits: ["Plan top 3 priorities", "Deep work block (2+ hrs)", "Inbox zero by end of day", "Take a real lunch break", "15 min walk or stretch", "Learn something new", "Review tomorrow's calendar", "No screens after 9pm", "7+ hours of sleep"] },
  parent: { label: "Parent", emoji: "👨‍👩‍👧", desc: "Balance family life with personal wellness",
    habits: ["Wake before the kids", "Prepare healthy meals", "Quality time with kids (30 min)", "Exercise or movement", "Read with / to kids", "Household task completed", "10 min quiet time", "Connect with partner", "Gratitude or reflection"] },
  entrepreneur: { label: "Entrepreneur", emoji: "🚀", desc: "Build your business while maintaining discipline",
    habits: ["Review KPIs / metrics", "Revenue-generating activity", "Content or marketing task", "Customer outreach", "Work ON the business", "Learn / upskill (30 min)", "Exercise", "Network or build relationships", "Plan tomorrow's MIT"] },
  techworker: { label: "Tech Worker", emoji: "⌨️", desc: "Ship code, stay healthy, avoid burnout",
    habits: ["Stand-up / review tickets", "Deep focus coding block", "Code review or PR", "Take walking breaks", "No meetings block (2 hrs)", "Learn new tool or technique", "Eye breaks (20-20-20 rule)", "Exercise or gym", "Log off on time"] },
  wellness: { label: "Wellness", emoji: "🧘", desc: "Prioritize mental and physical health",
    habits: ["Meditate (10+ min)", "Exercise (30+ min)", "Drink 8 glasses of water", "Eat whole foods", "No processed sugar", "Stretch or yoga", "Spend time outdoors", "Gratitude journal (3 things)", "Sleep by 10:30pm"] },
};

const WEEKDAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2,6);
const dk = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
function getWeekDates(ref) {
  const d = new Date(ref), day = d.getDay(), s = new Date(d);
  s.setDate(d.getDate() - day);
  return Array.from({length:7},(_,i)=>{const dt=new Date(s);dt.setDate(s.getDate()+i);return dt;});
}
const mc = c => ({fontFamily:"'JetBrains Mono',monospace",color:c||"#64748b"});

/* ── Shared Components ──────────────────────────── */

// Segmented progress bar — chunky blocks that fill like a battery/XP bar
const SEGMENTS = 20;
function MeterBar({pct, height=14, mini=false}) {
  const segs = mini ? 10 : SEGMENTS;
  const filledCount = Math.round((Math.min(pct,100)/100)*segs);
  const gap = mini ? 2 : 3;
  const segH = mini ? 6 : height;

  function segColor(i, total) {
    const pos = i / total;
    if (pos < 0.25) return "#8b5cf6";
    if (pos < 0.5) return "#3b82f6";
    if (pos < 0.75) return "#10b981";
    return "#f59e0b";
  }

  return (
    <div style={{position:"relative"}}>
      <div style={{display:"flex",gap:gap,alignItems:"center"}}>
        {Array.from({length:segs},(_,i)=>{
          const filled = i < filledCount;
          const c = segColor(i, segs);
          return (
            <div key={i} style={{
              flex:1,height:segH,
              borderRadius:mini?2:3,
              background:filled?c:"rgba(255,255,255,0.05)",
              boxShadow:filled?`0 0 ${mini?4:8}px ${c}40`:"none",
              opacity:filled?1:0.4,
              transition:`background 0.3s ${i*0.02}s, box-shadow 0.3s ${i*0.02}s, opacity 0.3s ${i*0.02}s`,
            }}/>
          );
        })}
      </div>
      {pct>=100&&<div style={{position:"absolute",inset:0,borderRadius:3,
        background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.15),transparent)",
        animation:"shimmer 1.8s infinite",pointerEvents:"none"}} />}
      {/* Threshold markers */}
      {!mini&&<div style={{position:"absolute",top:segH+4,left:0,right:0,display:"flex",justifyContent:"space-between",pointerEvents:"none"}}>
        {[0,25,50,75,100].map(v=>(
          <span key={v} style={{...mc(pct>=v?(v>=75?"#f59e0b":v>=50?"#10b981":"#64748b"):"#1e293b"),fontSize:8,fontWeight:pct>=v?700:400,
            transition:"color 0.3s"}}>{v}</span>
        ))}
      </div>}
    </div>
  );
}

// Animated ring with glow + pulse at 100%
function PctRing({pct,size=62,stroke=5}) {
  const r=(size-stroke)/2, circ=2*Math.PI*r, off=circ-(Math.min(pct,100)/100)*circ;
  const c=pct>=100?"#f59e0b":pct>=75?"#10b981":pct>=50?"#3b82f6":pct>=25?"#a78bfa":"#334155";
  const glowSize = pct>=100?12:pct>=75?6:0;
  return (
    <div style={{position:"relative",width:size,height:size}}>
      <svg width={size} height={size} style={{transform:"rotate(-90deg)",filter:glowSize?`drop-shadow(0 0 ${glowSize}px ${c}80)`:"none",transition:"filter 0.5s"}}>
        {/* Background track with subtle segments */}
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke}/>
        {/* Colored progress arc */}
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={c} strokeWidth={stroke}
          strokeDasharray={circ} strokeDashoffset={off} strokeLinecap="round"
          style={{transition:"stroke-dashoffset 0.6s cubic-bezier(0.4,0,0.2,1), stroke 0.4s"}} />
        {/* Bright tip */}
        {pct>5&&pct<100&&<circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth={stroke-1}
          strokeDasharray={`${stroke} ${circ-stroke}`} strokeDashoffset={off} strokeLinecap="round"
          style={{transition:"stroke-dashoffset 0.6s cubic-bezier(0.4,0,0.2,1)"}} />}
      </svg>
      {pct>=100&&<div style={{position:"absolute",inset:0,borderRadius:"50%",
        animation:"ringPulse 2s ease-in-out infinite",
        border:`2px solid ${c}30`}} />}
    </div>
  );
}

/* ── Upgrade Modal ──────────────────────────────── */
function UpgradeModal({onClose, onValidate, validating, error}) {
  const [key,setKey]=useState("");
  return (
    <div style={{position:"fixed",inset:0,zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:20}} onClick={onClose}>
      <div style={{position:"absolute",inset:0,background:"rgba(0,0,0,0.75)",backdropFilter:"blur(10px)"}} />
      <div onClick={e=>e.stopPropagation()} style={{position:"relative",maxWidth:460,width:"100%",
        background:"linear-gradient(145deg,#151a2a,#1a2035)",border:"1px solid rgba(245,158,11,0.2)",
        borderRadius:20,padding:32,boxShadow:"0 24px 80px rgba(0,0,0,0.6)"}}>
        <button onClick={onClose} style={{position:"absolute",top:16,right:16,background:"none",border:"none",color:"#475569",fontSize:20,cursor:"pointer"}}>×</button>
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{width:56,height:56,borderRadius:14,background:"linear-gradient(135deg,#f59e0b,#d97706)",
            display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:28,marginBottom:14,
            boxShadow:"0 0 30px rgba(245,158,11,0.3)"}}>▦</div>
          <h2 style={{fontSize:22,fontWeight:800,margin:"0 0 6px",color:"#e2e8f0"}}>Unlock DailyStack Pro</h2>
          <p style={{...mc("#64748b"),fontSize:12,margin:0}}>Lifetime access · One-time payment</p>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:24}}>
          {["Full weekly calendar with history","Cloud sync across all devices","Streak tracking and stats",
            "Unlimited habits and tasks","All 6 starter templates","Data saved forever"].map((f,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",gap:10,fontSize:14,color:"#cbd5e1"}}>
              <span style={{color:"#22c55e",fontSize:16}}>✓</span>{f}
            </div>
          ))}
        </div>
        <a href={GUMROAD_URL} target="_blank" rel="noopener noreferrer" style={{
          display:"flex",alignItems:"center",justifyContent:"center",width:"100%",
          background:"linear-gradient(135deg,#f59e0b,#d97706)",border:"none",color:"#000",
          padding:14,borderRadius:10,fontWeight:800,fontSize:16,fontFamily:"'Outfit',sans-serif",
          textDecoration:"none",boxShadow:"0 4px 24px rgba(245,158,11,0.3)",marginBottom:20}}>
          Buy on Gumroad — $4.99
        </a>
        <div style={{borderTop:"1px solid rgba(255,255,255,0.06)",paddingTop:18}}>
          <div style={{...mc("#64748b"),fontSize:11,marginBottom:10,textAlign:"center"}}>Already purchased? Enter your license key:</div>
          <div style={{display:"flex",gap:8}}>
            <input value={key} onChange={e=>setKey(e.target.value)}
              onKeyDown={e=>{if(e.key==="Enter"&&key.trim())onValidate(key.trim());}}
              placeholder="XXXXXXXX-XXXXXXXX-XXXXXXXX-XXXXXXXX"
              style={{flex:1,background:"rgba(0,0,0,0.3)",border:"1px solid rgba(255,255,255,0.1)",
                borderRadius:8,padding:"10px 14px",color:"#e2e8f0",fontSize:13,...mc(),outline:"none",letterSpacing:"0.5px"}} />
            <button onClick={()=>key.trim()&&onValidate(key.trim())} disabled={validating||!key.trim()}
              style={{background:validating?"rgba(255,255,255,0.05)":"rgba(245,158,11,0.15)",
                border:"1px solid rgba(245,158,11,0.25)",borderRadius:8,padding:"10px 18px",
                color:"#fbbf24",fontWeight:700,fontSize:13,cursor:validating?"wait":"pointer",...mc()}}>
              {validating?"...":"Activate"}
            </button>
          </div>
          {error&&<div style={{color:"#ef4444",fontSize:12,marginTop:8,textAlign:"center"}}>{error}</div>}
        </div>
      </div>
    </div>
  );
}

/* ── Landing Page ───────────────────────────────── */
function Landing({onStart, onUpgrade, isPro, user, onSignIn, onSignOut}) {
  const [v,setV]=useState(false);
  useEffect(()=>{setTimeout(()=>setV(true),100);},[]);
  const t=d=>({opacity:v?1:0,transform:v?"translateY(0)":"translateY(18px)",transition:`all 0.7s cubic-bezier(0.4,0,0.2,1) ${d}s`});
  return (
    <div style={{minHeight:"100vh",fontFamily:"'Outfit',sans-serif",background:"linear-gradient(160deg,#07090f,#0d1117 40%,#111827)",color:"#e2e8f0"}}>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet"/>
      <div style={{position:"fixed",inset:0,pointerEvents:"none",overflow:"hidden"}}>
        <div style={{position:"absolute",top:"-20%",right:"-10%",width:"60vw",height:"60vw",borderRadius:"50%",background:"radial-gradient(circle,rgba(245,158,11,0.04),transparent 70%)"}}/>
        <div style={{position:"absolute",bottom:"-20%",left:"-10%",width:"50vw",height:"50vw",borderRadius:"50%",background:"radial-gradient(circle,rgba(59,130,246,0.04),transparent 70%)"}}/>
        <div style={{position:"absolute",inset:0,opacity:0.03,backgroundImage:"linear-gradient(rgba(255,255,255,0.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.5) 1px,transparent 1px)",backgroundSize:"80px 80px"}}/>
      </div>
      <nav style={{padding:"20px 32px",display:"flex",justifyContent:"space-between",alignItems:"center",position:"relative",zIndex:2,...t(0)}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:32,height:32,borderRadius:8,background:"linear-gradient(135deg,#f59e0b,#d97706)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,fontWeight:900,color:"#000",boxShadow:"0 0 20px rgba(245,158,11,0.3)"}}>▦</div>
          <span style={{fontFamily:"'JetBrains Mono',monospace",fontWeight:700,fontSize:16,color:"#e2e8f0"}}>dailystack</span>
        </div>
        <div style={{display:"flex",gap:10,alignItems:"center"}}>
          {user ? (
            <>
              {isPro&&<span style={{...mc("#f59e0b"),fontSize:11,background:"rgba(245,158,11,0.1)",padding:"4px 12px",borderRadius:20,border:"1px solid rgba(245,158,11,0.2)"}}>PRO ✓</span>}
              <span style={{fontSize:13,color:"#94a3b8"}}>{user.displayName?.split(" ")[0]}</span>
              <button onClick={onSignOut} style={{background:"none",border:"1px solid rgba(255,255,255,0.08)",color:"#64748b",padding:"6px 14px",borderRadius:8,cursor:"pointer",fontSize:12,fontFamily:"'Outfit',sans-serif"}}>Sign Out</button>
            </>
          ) : (
            <button onClick={onSignIn} style={{background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.1)",color:"#e2e8f0",padding:"8px 20px",borderRadius:8,cursor:"pointer",fontSize:14,fontWeight:500,fontFamily:"'Outfit',sans-serif"}}>Sign In</button>
          )}
        </div>
      </nav>
      <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"40px 24px 60px",position:"relative",zIndex:2,textAlign:"center",maxWidth:900,margin:"0 auto"}}>
        <div style={t(0.2)}>
          <div style={{display:"inline-block",padding:"6px 16px",borderRadius:20,background:"rgba(245,158,11,0.1)",border:"1px solid rgba(245,158,11,0.2)",fontFamily:"'JetBrains Mono',monospace",fontSize:12,fontWeight:600,color:"#f59e0b",letterSpacing:"1px",marginBottom:28,textTransform:"uppercase"}}>Habits + Tasks · One daily meter</div>
        </div>
        <h1 style={{fontSize:"clamp(38px,7vw,68px)",fontWeight:900,lineHeight:1.05,margin:"0 0 24px",letterSpacing:"-2px",...t(0.35)}}>
          Track habits.<br/><span style={{background:"linear-gradient(135deg,#f59e0b,#ef4444,#8b5cf6)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>Crush tasks.</span>
        </h1>
        <p style={{fontSize:"clamp(16px,2.2vw,20px)",color:"#94a3b8",maxWidth:580,lineHeight:1.6,margin:"0 0 40px",fontWeight:300,...t(0.5)}}>
          Daily habits keep you consistent. One-off tasks keep you productive.
          DailyStack combines both into a single 100% meter — fill it up every day.
        </p>
        <div style={{display:"flex",gap:14,flexWrap:"wrap",justifyContent:"center",...t(0.65)}}>
          <button onClick={onStart} style={{background:"linear-gradient(135deg,#f59e0b,#d97706)",border:"none",color:"#000",padding:"14px 32px",borderRadius:10,cursor:"pointer",fontSize:16,fontWeight:700,fontFamily:"'Outfit',sans-serif",boxShadow:"0 4px 24px rgba(245,158,11,0.3)"}}
            onMouseEnter={e=>e.target.style.transform="translateY(-2px)"} onMouseLeave={e=>e.target.style.transform="translateY(0)"}>
            {isPro?"Open App":"Try It Free"}
          </button>
          {!isPro&&<button onClick={onUpgrade} style={{background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",color:"#94a3b8",padding:"14px 28px",borderRadius:10,cursor:"pointer",fontSize:16,fontWeight:500,fontFamily:"'Outfit',sans-serif"}}>Get Pro — $4.99</button>}
        </div>
      </div>
      {/* Feature comparison */}
      <div style={{maxWidth:640,margin:"0 auto",padding:"0 24px 40px",position:"relative",zIndex:2,...t(0.85)}}>
        <div style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:16,overflow:"hidden"}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
            <div style={{padding:"16px 20px"}}/>
            <div style={{padding:"16px 20px",textAlign:"center",borderLeft:"1px solid rgba(255,255,255,0.06)"}}><div style={{fontSize:14,fontWeight:700,color:"#94a3b8"}}>Free</div><div style={{...mc("#475569"),fontSize:11}}>$0</div></div>
            <div style={{padding:"16px 20px",textAlign:"center",borderLeft:"1px solid rgba(255,255,255,0.06)",background:"rgba(245,158,11,0.04)"}}><div style={{fontSize:14,fontWeight:700,color:"#f59e0b"}}>Pro</div><div style={{...mc("#f59e0b"),fontSize:11}}>$4.99 lifetime</div></div>
          </div>
          {[["Today preview","✓","✓"],["All 6 templates","✓","✓"],["Weekly calendar","—","✓"],["Cloud sync","—","✓"],["One-off tasks","—","✓"],["Streaks & stats","—","✓"],["Unlimited history","—","✓"]].map(([f,fr,pr],i)=>(
            <div key={i} style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",borderBottom:i<6?"1px solid rgba(255,255,255,0.04)":"none"}}>
              <div style={{padding:"12px 20px",fontSize:13,color:"#94a3b8"}}>{f}</div>
              <div style={{padding:"12px 20px",textAlign:"center",fontSize:13,color:fr==="✓"?"#64748b":"#334155",borderLeft:"1px solid rgba(255,255,255,0.04)"}}>{fr}</div>
              <div style={{padding:"12px 20px",textAlign:"center",fontSize:13,color:pr==="✓"?"#22c55e":"#334155",borderLeft:"1px solid rgba(255,255,255,0.04)",background:"rgba(245,158,11,0.02)"}}>{pr}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:1,background:"rgba(255,255,255,0.04)",borderTop:"1px solid rgba(255,255,255,0.06)",position:"relative",zIndex:2}}>
        {[{icon:"◉",title:"100% Meter",desc:"Habits AND tasks feed one progress bar per day"},{icon:"⟳",title:"Daily Habits",desc:"Recurring activities that repeat every day automatically"},{icon:"☑",title:"One-Off Tasks",desc:"Add tasks to specific days and cross them off when done"},{icon:"☁",title:"Cloud Sync",desc:"Sign in with Google — your data follows you everywhere"}].map((f,i)=>(
          <div key={i} style={{padding:"32px 28px",background:"rgba(7,9,15,0.8)",...t(1.0+i*0.1)}}>
            <div style={{fontSize:22,marginBottom:10,color:"#f59e0b"}}>{f.icon}</div>
            <div style={{fontWeight:700,fontSize:15,marginBottom:6}}>{f.title}</div>
            <div style={{fontSize:13,color:"#64748b",lineHeight:1.5}}>{f.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   MAIN APP
   ═══════════════════════════════════════════════════ */
export default function App() {
  const [page, setPage] = useState("landing");
  const [isPro, setIsPro] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [validating, setValidating] = useState(false);
  const [licenseError, setLicenseError] = useState("");

  const [habits, setHabits] = useState([]);
  const [habitChecks, setHabitChecks] = useState({});
  const [tasks, setTasks] = useState({});
  const [weekOffset, setWeekOffset] = useState(0);
  const [newHabit, setNewHabit] = useState("");
  const [showAddHabit, setShowAddHabit] = useState(false);
  const [showTemplates, setShowTemplates] = useState(true);
  const [editingHabit, setEditingHabit] = useState(null);
  const [editHabitText, setEditHabitText] = useState("");
  const [activeDay, setActiveDay] = useState(null);
  const [taskInputText, setTaskInputText] = useState("");
  const habitInputRef = useRef(null);
  const saveTimerRef = useRef(null);

  /* ── Firebase Auth listener ─────────────────────── */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      setUser(fbUser);
      if (fbUser) {
        try {
          const data = await initializeUser(fbUser.uid, fbUser.email);
          if (data.habits?.length) { setHabits(data.habits); setShowTemplates(false); }
          if (data.habitChecks && Object.keys(data.habitChecks).length) setHabitChecks(data.habitChecks);
          if (data.tasks && Object.keys(data.tasks).length) setTasks(data.tasks);
          if (data.isPro) setIsPro(true);
        } catch (err) {
          console.error("Failed to load user data:", err);
        }
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  /* ── Auto-save to Firestore (debounced) ─────────── */
  useEffect(() => {
    if (!user || !isPro) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveUserData(user.uid, { habits, habitChecks, tasks }).catch(console.error);
    }, 2000);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [habits, habitChecks, tasks, user, isPro]);

  useEffect(()=>{if(showAddHabit&&habitInputRef.current)habitInputRef.current.focus();},[showAddHabit]);

  const today = new Date(), todayKey = dk(today);
  const ref = new Date(today); ref.setDate(ref.getDate()+weekOffset*7);
  const weekDates = getWeekDates(ref);
  const selectedDayKey = activeDay||todayKey;
  const selectedDate = weekDates.find(d=>dk(d)===selectedDayKey)||today;
  const dayTasks = tasks[selectedDayKey]||[];

  const getDayPct = useCallback((d)=>{
    const h=habits.length, hDone=habits.filter(x=>habitChecks[`${d}::${x.id}`]).length;
    const dt=tasks[d]||[], tT=dt.length, tD=dt.filter(x=>x.done).length;
    const total=h+tT; if(!total)return 0;
    return Math.round(((hDone+tD)/total)*100);
  },[habits,habitChecks,tasks]);

  const todayPct = getDayPct(todayKey);
  const getStreak=()=>{let s=0;const d=new Date(today);while(true){const k=dk(d);if(getDayPct(k)>=100){s++;d.setDate(d.getDate()-1);}else if(k===todayKey){d.setDate(d.getDate()-1);}else break;}return s;};
  const streak = isPro?getStreak():0;
  const weekAvg = isPro?Math.round(weekDates.reduce((s,d)=>s+getDayPct(dk(d)),0)/7):0;

  const applyTemplate=k=>{setHabits(TEMPLATES[k].habits.map((name,i)=>({id:`${k}-${i}-${uid()}`,name})));setShowTemplates(false);};
  const addHabit=()=>{const n=newHabit.trim();if(!n)return;setHabits(p=>[...p,{id:uid(),name:n}]);setNewHabit("");};
  const removeHabit=id=>setHabits(p=>p.filter(h=>h.id!==id));
  const toggleHabit=(hid,d)=>setHabitChecks(p=>{const k=`${d}::${hid}`;const n={...p};if(n[k])delete n[k];else n[k]=true;return n;});
  const addTask=d=>{const text=taskInputText.trim();if(!text)return;setTasks(p=>({...p,[d]:[...(p[d]||[]),{id:uid(),text,done:false}]}));setTaskInputText("");};
  const toggleTask=(d,tid)=>setTasks(p=>({...p,[d]:(p[d]||[]).map(t=>t.id===tid?{...t,done:!t.done}:t)}));
  const removeTask=(d,tid)=>setTasks(p=>{const dt=(p[d]||[]).filter(t=>t.id!==tid);const n={...p};if(dt.length)n[d]=dt;else delete n[d];return n;});

  const isFreeAndLocked = d => !isPro && d !== todayKey;
  const openUpgrade = () => setShowUpgrade(true);

  const handleSignIn = async () => {
    try { await signInWithGoogle(); } catch (err) { console.error("Sign-in failed:", err); }
  };
  const handleSignOut = async () => {
    await signOutUser();
    setHabits([]); setHabitChecks({}); setTasks({}); setIsPro(false); setShowTemplates(true); setPage("landing");
  };

  /* ── License validation via serverless function ── */
  const validateLicense = async (key) => {
    setValidating(true); setLicenseError("");
    try {
      const res = await fetch("/api/verify-license", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ license_key: key }),
      });
      const data = await res.json();
      if (data.valid) {
        // If not signed in, prompt sign-in first
        let currentUser = user;
        if (!currentUser) {
          try { currentUser = await signInWithGoogle(); } catch { setLicenseError("Please sign in to activate Pro."); setValidating(false); return; }
        }
        setIsPro(true);
        setShowUpgrade(false);
        await saveUserData(currentUser.uid, { isPro: true, licenseKey: key });
      } else {
        setLicenseError(data.error || "Invalid license key.");
      }
    } catch {
      setLicenseError("Could not verify license. Please try again.");
    }
    setValidating(false);
  };

  if (loading) return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",
      background:"#07090f",fontFamily:"'JetBrains Mono',monospace",color:"#64748b",fontSize:14}}>
      Loading...
    </div>
  );

  if (page==="landing") return (
    <>
      <Landing onStart={()=>setPage("app")} onUpgrade={openUpgrade} isPro={isPro} user={user} onSignIn={handleSignIn} onSignOut={handleSignOut}/>
      {showUpgrade&&<UpgradeModal onClose={()=>setShowUpgrade(false)} onValidate={validateLicense} validating={validating} error={licenseError}/>}
    </>
  );

  /* ═══ TRACKER VIEW ══════════════════════════════ */
  return (
    <div style={{fontFamily:"'Outfit',sans-serif",background:"linear-gradient(160deg,#07090f,#0d1117 40%,#111827)",color:"#e2e8f0",minHeight:"100vh"}}>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet"/>
      <div style={{position:"fixed",inset:0,pointerEvents:"none",overflow:"hidden"}}>
        <div style={{position:"absolute",top:"-30%",right:"-20%",width:"70vw",height:"70vw",borderRadius:"50%",
          background:`radial-gradient(circle,${todayPct>=100?"rgba(245,158,11,0.06)":todayPct>=50?"rgba(16,185,129,0.04)":"rgba(59,130,246,0.03)"} 0%,transparent 70%)`,transition:"background 1.5s"}}/>
      </div>
      <div style={{maxWidth:960,margin:"0 auto",padding:"24px 20px",position:"relative",zIndex:1}}>

        {/* Header */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24,flexWrap:"wrap",gap:10}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:28,height:28,borderRadius:6,background:"linear-gradient(135deg,#f59e0b,#d97706)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:900,color:"#000"}}>▦</div>
            <span style={{...mc("#e2e8f0"),fontWeight:700,fontSize:14}}>dailystack</span>
            {isPro&&<span style={{...mc("#f59e0b"),fontSize:9,background:"rgba(245,158,11,0.1)",padding:"2px 8px",borderRadius:10,border:"1px solid rgba(245,158,11,0.2)"}}>PRO</span>}
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center"}}>
            {user&&<span style={{fontSize:12,color:"#64748b"}}>{user.displayName?.split(" ")[0]}</span>}
            {!isPro&&<button onClick={openUpgrade} style={{...mc("#fbbf24"),background:"rgba(245,158,11,0.1)",border:"1px solid rgba(245,158,11,0.2)",borderRadius:6,padding:"5px 12px",cursor:"pointer",fontSize:11,fontWeight:700}}>Upgrade $4.99</button>}
            <button onClick={()=>setPage("landing")} style={{background:"none",border:"1px solid rgba(255,255,255,0.08)",borderRadius:6,color:"#64748b",padding:"5px 12px",cursor:"pointer",fontSize:11,fontFamily:"'Outfit',sans-serif"}}>← Home</button>
          </div>
        </div>

        {/* Free banner */}
        {!isPro&&(
          <div style={{background:"rgba(245,158,11,0.06)",border:"1px solid rgba(245,158,11,0.15)",borderRadius:12,padding:"14px 20px",marginBottom:18,display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:10}}>
            <div>
              <div style={{fontWeight:700,fontSize:14,color:"#fbbf24",marginBottom:2}}>Free Preview — Today Only</div>
              <div style={{fontSize:12,color:"#94a3b8"}}>Progress won't be saved. Upgrade for the full weekly tracker with cloud sync.</div>
            </div>
            <button onClick={openUpgrade} style={{background:"linear-gradient(135deg,#f59e0b,#d97706)",border:"none",color:"#000",padding:"8px 20px",borderRadius:8,cursor:"pointer",fontWeight:700,fontSize:13,fontFamily:"'Outfit',sans-serif",whiteSpace:"nowrap",flexShrink:0}}>Unlock Pro — $4.99</button>
          </div>
        )}

        {/* Templates */}
        {showTemplates&&(
          <div style={{marginBottom:28}}>
            <h2 style={{...mc(),fontSize:12,fontWeight:600,letterSpacing:"1.5px",textTransform:"uppercase",marginBottom:14}}>Choose your template</h2>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:12}}>
              {Object.entries(TEMPLATES).map(([key,t])=>(
                <button key={key} onClick={()=>applyTemplate(key)} style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.07)",borderRadius:14,padding:20,cursor:"pointer",textAlign:"left",color:"#e2e8f0",transition:"all 0.25s"}}
                  onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,255,255,0.06)";e.currentTarget.style.borderColor="rgba(245,158,11,0.3)";}}
                  onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,0.03)";e.currentTarget.style.borderColor="rgba(255,255,255,0.07)";}}>
                  <div style={{fontSize:28,marginBottom:8}}>{t.emoji}</div>
                  <div style={{fontWeight:700,fontSize:16,marginBottom:4}}>{t.label}</div>
                  <div style={{fontSize:13,color:"#64748b",lineHeight:1.4}}>{t.desc}</div>
                </button>
              ))}
            </div>
            <div style={{textAlign:"center",marginTop:16,fontSize:13,color:"#475569"}}>Or <button onClick={()=>setShowTemplates(false)} style={{background:"none",border:"none",color:"#f59e0b",cursor:"pointer",fontSize:13,textDecoration:"underline",fontFamily:"'Outfit',sans-serif"}}>build from scratch</button></div>
          </div>
        )}

        {!showTemplates&&(
          <>
            {/* Hero meter */}
            <div style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:16,padding:"22px 26px",marginBottom:14}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                <div>
                  <div style={{...mc(),fontSize:10,letterSpacing:"1.5px",textTransform:"uppercase",marginBottom:4}}>Today's Score</div>
                  <div style={{display:"flex",alignItems:"baseline",gap:8}}>
                    <div style={{...mc(todayPct>=100?"#f59e0b":todayPct>=75?"#10b981":todayPct>=50?"#3b82f6":todayPct>=25?"#a78bfa":"#475569"),fontSize:42,fontWeight:700,lineHeight:1,transition:"color 0.5s"}}>{todayPct}%</div>
                    <div style={{fontSize:13,fontWeight:700,color:todayPct>=100?"#f59e0b":todayPct>=75?"#10b981":todayPct>=50?"#3b82f6":"#475569",
                      background:todayPct>=100?"rgba(245,158,11,0.1)":todayPct>=75?"rgba(16,185,129,0.1)":todayPct>=50?"rgba(59,130,246,0.1)":"rgba(255,255,255,0.03)",
                      padding:"3px 10px",borderRadius:6,transition:"all 0.5s"}}>
                      {todayPct>=100?"PERFECT":todayPct>=75?"STRONG":todayPct>=50?"SOLID":todayPct>=25?"BUILDING":"START"}
                    </div>
                  </div>
                </div>
                <div style={{display:"flex",alignItems:"center",justifyContent:"center",position:"relative"}}>
                  <PctRing pct={todayPct}/>
                  <span style={{position:"absolute",fontSize:22,transition:"all 0.3s",
                    transform:todayPct>=100?"scale(1.2)":"scale(1)"}}>
                    {todayPct>=100?"🔥":todayPct>=75?"⚡":todayPct>=50?"💪":todayPct>=25?"🌱":"🌑"}
                  </span>
                </div>
              </div>
              <MeterBar pct={todayPct}/>
              <div style={{display:"flex",gap:6,marginTop:16,flexWrap:"wrap"}}>
                <span style={{...mc(),fontSize:10,background:"rgba(255,255,255,0.04)",padding:"3px 10px",borderRadius:10}}>⟳ {habits.filter(h=>habitChecks[`${todayKey}::${h.id}`]).length}/{habits.length} habits</span>
                <span style={{...mc(),fontSize:10,background:"rgba(255,255,255,0.04)",padding:"3px 10px",borderRadius:10}}>☑ {(tasks[todayKey]||[]).filter(t=>t.done).length}/{(tasks[todayKey]||[]).length} tasks</span>
              </div>
            </div>

            {/* Stats */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:22}}>
              {[{l:"WEEK",v:isPro?`${weekAvg}%`:"—",c:"#3b82f6"},{l:"STREAK",v:isPro?(streak>0?`${streak}d`:"—"):"—",c:"#f59e0b"},{l:"HABITS",v:habits.length,c:"#a78bfa"}].map(s=>(
                <div key={s.l} style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.05)",borderRadius:11,padding:"12px",textAlign:"center",position:"relative",overflow:"hidden"}}>
                  <div style={{...mc(),fontSize:9,letterSpacing:"1.5px",marginBottom:3}}>{s.l}</div>
                  <div style={{...mc(s.c),fontSize:20,fontWeight:700}}>{s.v}</div>
                  {!isPro&&s.l!=="HABITS"&&<div style={{position:"absolute",inset:0,background:"rgba(7,9,15,0.6)",backdropFilter:"blur(2px)",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",borderRadius:11}} onClick={openUpgrade}>
                    <span style={{...mc("#f59e0b"),fontSize:10,fontWeight:600}}>🔒 PRO</span>
                  </div>}
                </div>
              ))}
            </div>

            {/* TWO COLUMNS */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:20}}>
              {/* LEFT: HABITS */}
              <div>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                  <h2 style={{...mc(),fontSize:11,fontWeight:600,letterSpacing:"1.5px",textTransform:"uppercase",margin:0}}>⟳ Daily Habits</h2>
                  <div style={{display:"flex",gap:6}}>
                    <button onClick={()=>setShowTemplates(true)} style={{...mc("#60a5fa"),background:"rgba(59,130,246,0.1)",border:"1px solid rgba(59,130,246,0.2)",borderRadius:6,padding:"4px 10px",cursor:"pointer",fontSize:10,fontWeight:600}}>⟳</button>
                    <button onClick={()=>setShowAddHabit(!showAddHabit)} style={{...mc(showAddHabit?"#f87171":"#fbbf24"),background:showAddHabit?"rgba(239,68,68,0.1)":"rgba(245,158,11,0.1)",border:`1px solid ${showAddHabit?"rgba(239,68,68,0.2)":"rgba(245,158,11,0.2)"}`,borderRadius:6,padding:"4px 10px",cursor:"pointer",fontSize:10,fontWeight:600}}>{showAddHabit?"✕":"+ Add"}</button>
                  </div>
                </div>
                {showAddHabit&&(
                  <div style={{display:"flex",gap:6,marginBottom:10}}>
                    <input ref={habitInputRef} value={newHabit} onChange={e=>setNewHabit(e.target.value)}
                      onKeyDown={e=>{if(e.key==="Enter")addHabit();if(e.key==="Escape")setShowAddHabit(false);}}
                      placeholder="New habit..." style={{flex:1,background:"rgba(0,0,0,0.3)",border:"1px solid rgba(255,255,255,0.08)",borderRadius:7,padding:"8px 12px",color:"#e2e8f0",fontSize:13,outline:"none",fontFamily:"'Outfit',sans-serif"}} />
                    <button onClick={addHabit} style={{background:"linear-gradient(135deg,#f59e0b,#d97706)",border:"none",borderRadius:7,padding:"8px 14px",color:"#000",fontWeight:700,cursor:"pointer",fontSize:12}}>Add</button>
                  </div>
                )}
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                  <button onClick={()=>{if(isPro)setWeekOffset(w=>w-1);else openUpgrade();}} style={{background:"none",border:"1px solid rgba(255,255,255,0.08)",borderRadius:5,padding:"4px 8px",color:isPro?"#94a3b8":"#334155",cursor:isPro?"pointer":"not-allowed",...mc(),fontSize:10}}>←</button>
                  <span style={{...mc(),fontSize:10,color:"#475569"}}>{weekDates[0].toLocaleDateString("en-US",{month:"short",day:"numeric"})} — {weekDates[6].toLocaleDateString("en-US",{month:"short",day:"numeric"})}</span>
                  <button onClick={()=>{if(isPro&&weekOffset<0)setWeekOffset(w=>w+1);else if(!isPro)openUpgrade();}} style={{background:"none",border:"1px solid rgba(255,255,255,0.08)",borderRadius:5,padding:"4px 8px",color:isPro&&weekOffset<0?"#94a3b8":"#334155",cursor:isPro&&weekOffset<0?"pointer":"not-allowed",...mc(),fontSize:10}}>→</button>
                </div>

                <div style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:12,overflow:"hidden"}}>
                  <div style={{display:"grid",gridTemplateColumns:"minmax(90px,1fr) repeat(7,32px)",padding:"8px 10px",borderBottom:"1px solid rgba(255,255,255,0.05)",background:"rgba(255,255,255,0.02)",gap:2}}>
                    <div/>
                    {weekDates.map((d,i)=>{
                      const k=dk(d);const isToday=k===todayKey;const isActive=k===selectedDayKey;const locked=isFreeAndLocked(k);
                      return (<div key={i} style={{textAlign:"center",cursor:locked?"not-allowed":"pointer",opacity:locked?0.3:1}} onClick={()=>{if(!locked)setActiveDay(k);else openUpgrade();}}>
                        <div style={{...mc(isToday||isActive?"#e2e8f0":"#334155"),fontSize:8,fontWeight:isToday?700:400}}>{WEEKDAYS[d.getDay()]}</div>
                        <div style={{...mc(isToday?"#f59e0b":isActive?"#3b82f6":"#475569"),fontSize:11,fontWeight:700,width:22,height:22,lineHeight:"22px",borderRadius:"50%",margin:"1px auto 0",background:isToday?"rgba(245,158,11,0.15)":isActive?"rgba(59,130,246,0.15)":"none"}}>{d.getDate()}</div>
                        {locked&&<div style={{fontSize:7,color:"#f59e0b",marginTop:1}}>🔒</div>}
                      </div>);
                    })}
                  </div>
                  {habits.length===0?(<div style={{padding:"24px",textAlign:"center",color:"#475569",fontSize:13}}>Add habits or pick a template</div>
                  ):habits.map((h,idx)=>(
                    <div key={h.id} style={{display:"grid",gridTemplateColumns:"minmax(90px,1fr) repeat(7,32px)",padding:"6px 10px",alignItems:"center",borderBottom:idx<habits.length-1?"1px solid rgba(255,255,255,0.03)":"none",background:idx%2?"rgba(255,255,255,0.01)":"transparent",gap:2}}>
                      <div style={{display:"flex",alignItems:"center",gap:4,minWidth:0}}>
                        {editingHabit===h.id?(<input value={editHabitText} onChange={e=>setEditHabitText(e.target.value)} autoFocus
                          onKeyDown={e=>{if(e.key==="Enter"){const n=editHabitText.trim();if(n)setHabits(p=>p.map(x=>x.id===h.id?{...x,name:n}:x));setEditingHabit(null);}if(e.key==="Escape")setEditingHabit(null);}}
                          onBlur={()=>{const n=editHabitText.trim();if(n)setHabits(p=>p.map(x=>x.id===h.id?{...x,name:n}:x));setEditingHabit(null);}}
                          style={{flex:1,background:"rgba(0,0,0,0.3)",border:"1px solid rgba(245,158,11,0.3)",borderRadius:4,padding:"2px 6px",color:"#e2e8f0",fontSize:11,outline:"none",minWidth:0,fontFamily:"'Outfit',sans-serif"}} />
                        ):(<span onClick={()=>{setEditingHabit(h.id);setEditHabitText(h.name);}} style={{fontSize:11,color:"#cbd5e1",cursor:"pointer",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{h.name}</span>)}
                        <button onClick={()=>removeHabit(h.id)} style={{background:"none",border:"none",color:"#334155",cursor:"pointer",fontSize:12,padding:"0 2px",flexShrink:0}} onMouseEnter={e=>e.target.style.color="#ef4444"} onMouseLeave={e=>e.target.style.color="#334155"}>×</button>
                      </div>
                      {weekDates.map((d,di)=>{
                        const k=dk(d);const checked=!!habitChecks[`${k}::${h.id}`];const locked=isFreeAndLocked(k);
                        return (<div key={di} style={{display:"flex",justifyContent:"center"}}>
                          <button onClick={()=>{if(locked)openUpgrade();else toggleHabit(h.id,k);}} style={{width:26,height:26,borderRadius:6,
                            border:checked?"2px solid #22c55e":k===todayKey?"2px solid rgba(255,255,255,0.12)":"2px solid rgba(255,255,255,0.05)",
                            background:checked?"rgba(34,197,94,0.15)":locked?"rgba(255,255,255,0.01)":"rgba(255,255,255,0.02)",
                            cursor:locked?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",
                            transition:"all 0.2s",fontSize:locked?8:12,color:locked?"#f59e0b":"#22c55e",fontWeight:700,opacity:locked?0.4:1}}>
                            {locked?"🔒":checked?"✓":""}
                          </button>
                        </div>);
                      })}
                    </div>
                  ))}
                  {habits.length>0&&(
                    <div style={{display:"grid",gridTemplateColumns:"minmax(90px,1fr) repeat(7,32px)",padding:"10px 10px",borderTop:"1px solid rgba(255,255,255,0.05)",background:"rgba(255,255,255,0.02)",gap:2}}>
                      <div style={{...mc(),fontSize:9,letterSpacing:"1px"}}>DAILY %</div>
                      {weekDates.map((d,i)=>{const k=dk(d);const pct=getDayPct(k);const locked=isFreeAndLocked(k);
                        const c=pct>=100?"#f59e0b":pct>=75?"#10b981":pct>=50?"#3b82f6":pct>=25?"#a78bfa":"#334155";
                        return (<div key={i} style={{textAlign:"center",opacity:locked?0.25:1}}>
                          <div style={{...mc(c),fontSize:10,fontWeight:700}}>{locked?"·":pct>0?`${pct}%`:"·"}</div>
                          <div style={{marginTop:3}}><MeterBar pct={locked?0:pct} mini={true}/></div>
                        </div>);
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT: TASKS */}
              <div>
                <div style={{marginBottom:10}}>
                  <h2 style={{...mc(),fontSize:11,fontWeight:600,letterSpacing:"1.5px",textTransform:"uppercase",margin:0}}>☑ Tasks — {selectedDate.toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"})}</h2>
                </div>
                <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
                  {weekDates.map((d,i)=>{
                    const k=dk(d);const isToday=k===todayKey;const isActive=k===selectedDayKey;const locked=isFreeAndLocked(k);
                    const ct=(tasks[k]||[]).length;const cd=(tasks[k]||[]).filter(t=>t.done).length;
                    return (<button key={i} onClick={()=>{if(locked)openUpgrade();else setActiveDay(k);}} style={{
                      display:"flex",flexDirection:"column",alignItems:"center",gap:2,padding:"8px 10px",borderRadius:10,minWidth:42,
                      cursor:locked?"not-allowed":"pointer",opacity:locked?0.35:1,
                      background:isActive?"rgba(59,130,246,0.15)":isToday?"rgba(245,158,11,0.08)":"rgba(255,255,255,0.02)",
                      border:`1px solid ${isActive?"rgba(59,130,246,0.3)":isToday?"rgba(245,158,11,0.15)":"rgba(255,255,255,0.05)"}`,transition:"all 0.2s"}}>
                      <span style={{...mc(isActive?"#60a5fa":isToday?"#fbbf24":"#475569"),fontSize:9,fontWeight:600}}>{WEEKDAYS[d.getDay()]}</span>
                      <span style={{...mc(isActive?"#e2e8f0":isToday?"#fbbf24":"#94a3b8"),fontSize:14,fontWeight:700}}>{d.getDate()}</span>
                      {locked?<span style={{fontSize:7}}>🔒</span>:ct>0&&<span style={{...mc(cd===ct?"#22c55e":"#64748b"),fontSize:8}}>{cd}/{ct}</span>}
                    </button>);
                  })}
                </div>
                <div style={{background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:12,overflow:"hidden",minHeight:200}}>
                  {!isFreeAndLocked(selectedDayKey)?(<div style={{display:"flex",gap:6,padding:10,borderBottom:"1px solid rgba(255,255,255,0.05)"}}>
                    <input value={taskInputText} onChange={e=>setTaskInputText(e.target.value)}
                      onKeyDown={e=>{if(e.key==="Enter")addTask(selectedDayKey);}}
                      placeholder="+ Add a task for this day..."
                      style={{flex:1,background:"rgba(0,0,0,0.2)",border:"1px solid rgba(255,255,255,0.06)",borderRadius:7,padding:"8px 12px",color:"#e2e8f0",fontSize:13,outline:"none",fontFamily:"'Outfit',sans-serif"}} />
                    <button onClick={()=>addTask(selectedDayKey)} style={{...mc("#60a5fa"),background:"rgba(59,130,246,0.15)",border:"1px solid rgba(59,130,246,0.25)",borderRadius:7,padding:"8px 14px",fontWeight:700,cursor:"pointer",fontSize:12}}>Add</button>
                  </div>):(<div style={{padding:"14px 20px",borderBottom:"1px solid rgba(255,255,255,0.05)",textAlign:"center"}}>
                    <button onClick={openUpgrade} style={{...mc("#f59e0b"),background:"none",border:"none",cursor:"pointer",fontSize:12,fontWeight:600}}>🔒 Upgrade to add tasks to other days</button>
                  </div>)}
                  {dayTasks.length===0?(<div style={{padding:"40px 20px",textAlign:"center"}}>
                    <div style={{fontSize:28,marginBottom:8,opacity:0.4}}>☑</div>
                    <div style={{color:"#475569",fontSize:13}}>{isFreeAndLocked(selectedDayKey)?"Unlock Pro to access other days":"No tasks for this day"}</div>
                    {!isFreeAndLocked(selectedDayKey)&&<div style={{color:"#334155",fontSize:11,marginTop:4}}>Add one-off tasks — they count toward your daily %</div>}
                  </div>):(<div style={{padding:"4px 0"}}>
                    {dayTasks.map((task,ti)=>(<div key={task.id} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderBottom:ti<dayTasks.length-1?"1px solid rgba(255,255,255,0.03)":"none"}}>
                      <button onClick={()=>toggleTask(selectedDayKey,task.id)} style={{width:22,height:22,borderRadius:6,flexShrink:0,
                        border:task.done?"2px solid #22c55e":"2px solid rgba(255,255,255,0.12)",
                        background:task.done?"rgba(34,197,94,0.15)":"transparent",
                        cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",
                        fontSize:11,color:"#22c55e",fontWeight:700,transition:"all 0.2s"}}>
                        {task.done?"✓":""}
                      </button>
                      <span style={{flex:1,fontSize:13,color:task.done?"#475569":"#e2e8f0",textDecoration:task.done?"line-through":"none",transition:"all 0.3s"}}>{task.text}</span>
                      <button onClick={()=>removeTask(selectedDayKey,task.id)} style={{background:"none",border:"none",color:"#334155",cursor:"pointer",fontSize:14,padding:"0 4px"}}
                        onMouseEnter={e=>e.target.style.color="#ef4444"} onMouseLeave={e=>e.target.style.color="#334155"}>×</button>
                    </div>))}
                  </div>)}
                  {dayTasks.length>0&&(<div style={{padding:"10px 14px",borderTop:"1px solid rgba(255,255,255,0.05)",background:"rgba(255,255,255,0.02)"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                      <span style={{...mc(),fontSize:10}}>Task progress</span>
                      <span style={{...mc(dayTasks.every(t=>t.done)?"#22c55e":"#94a3b8"),fontSize:11,fontWeight:700}}>{dayTasks.filter(t=>t.done).length}/{dayTasks.length}</span>
                    </div>
                    <MeterBar pct={Math.round((dayTasks.filter(t=>t.done).length/dayTasks.length)*100)} />
                  </div>)}
                </div>
              </div>
            </div>
          </>
        )}

        <div style={{textAlign:"center",marginTop:32,padding:"16px 0",borderTop:"1px solid rgba(255,255,255,0.04)"}}>
          <div style={{...mc("#1e293b"),fontSize:10,letterSpacing:"1.5px"}}>DAILYSTACK · HABITS + TASKS · FILL THE METER</div>
        </div>
      </div>
      {showUpgrade&&<UpgradeModal onClose={()=>setShowUpgrade(false)} onValidate={validateLicense} validating={validating} error={licenseError}/>}
      <style>{`
        @keyframes shimmer{0%{transform:translateX(-100%)}100%{transform:translateX(100%)}}
        @keyframes ringPulse{0%,100%{transform:scale(1);opacity:0.5}50%{transform:scale(1.15);opacity:0}}
        *{box-sizing:border-box;margin:0}
        button:active{transform:scale(0.97)!important}
        input::placeholder{color:#475569}
        ::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.08);border-radius:3px}
      `}</style>
    </div>
  );
}
