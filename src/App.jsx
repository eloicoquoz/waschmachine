import { useState, useRef, useEffect } from "react";
import {
  loginWithGoogle, registerWithEmail, loginWithEmail, onAuthChange,
  subscribeTournaments, createTournament, respondToTournament, removeResponse,
  validateTeam, addResult, subscribeChat, sendMessage,
  subscribeFeed, createFeedPost, toggleLike, uploadMedia,
  deleteFeedPost, subscribeUsers,
} from "./firebase.js";

let ME = "Eloi";

const C = {
  bg:"#151F2E", surface:"#1B2A3E", card:"#1F3050", border:"#2A4268",
  gold:"#F5A920", cyan:"#3BC4E8", coral:"#E8503B", amber:"#F59E0B",
  green:"#22C55E", silver:"#A8B4C0", text:"#EDE8D8", muted:"#7A9BBF",
  dimmed:"#263B58", navy:"#0F1A2A",
};

const OUTDOOR_SURFACES = ["Beach","Gazon","Water"];
const PLAYER_FORMATS   = ["1v1","2v2","3v3","4v4","6v6","8v8","Mix libre"];
const FEED_EMOJIS      = ["🏐","🏖","🏆","⛱","🌊","🔥","🎉","🥇","💪","🤝"];
const FEED_GRADS = [
  "linear-gradient(135deg,#0D4F6E,#3BC4E8)",
  "linear-gradient(135deg,#6B3A10,#F5A920)",
  "linear-gradient(135deg,#3B4A10,#A0C020)",
  "linear-gradient(135deg,#1A3A7A,#3B7AE8)",
  "linear-gradient(135deg,#6B1040,#E8503B)",
];
const INIT_NOTIFS = [{id:1,read:false,type:"reminder_response",text:"N'oublie pas de répondre aux tournois !",tid:null,time:""}];
const NOTIF_TYPES = {
  reminder_response:{icon:"⏰"},new_tournament:{icon:"🏐"},
  new_feed:{icon:"📸"},new_chat:{icon:"💬"},
  tournament_reminder:{icon:"📅"},result_added:{icon:"🏆"},
};

/* ── Helpers ── */
const isPast   = (t) => new Date(t.rawDate) < new Date();
const myAnswer = (t) => (t.yesResponses||[]).includes(ME)?"yes":(t.noResponses||[]).includes(ME)?"no":null;
const fmtType  = (t) => t.playType==="Indoor"?"Indoor":(t.surface||"");
const plcColor = (p) => p===1?C.gold:p===2?C.silver:p===3?C.amber:C.muted;
const plcLabel = (p) => p===1?"🥇 1re place":p===2?"🥈 2e place":p===3?"🥉 3e place":p+"e place";
const capInfo  = (t) => {
  const n=(t.yesResponses||[]).length, max=t.maxPlayers||8;
  if(n<(t.minPlayers||2)) return {text:`${n}/${max} — Pas encore assez`,color:C.coral};
  if(n<max)               return {text:`${n}/${max} — Places disponibles`,color:C.gold};
  if(n===max)             return {text:`${n}/${max} — Équipe au complet !`,color:C.cyan};
  if(n<2*max)             return {text:`${n} inscrits — remplaçants possibles`,color:C.amber};
  return                         {text:`${n} inscrits — 2e équipe possible !`,color:C.green};
};
const IS = (x) => Object.assign({width:"100%",padding:"12px 14px",boxSizing:"border-box",background:C.card,border:`1px solid ${C.border}`,borderRadius:12,color:C.text,fontSize:14,fontFamily:"inherit",outline:"none"},x||{});

/* ── Logo ── */
function WaschLogo({size}) {
  size=size||40;
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" style={{flexShrink:0}}>
      <circle cx="20" cy="20" r="19.5" fill={C.navy}/>
      <circle cx="20" cy="15.5" r="8.5" fill="#F5A920"/>
      <path d="M 14 12.5 Q 20 7 26 12.5 Q 20 18.5 14 12.5" fill="#3BC4E8" opacity="0.9"/>
      <path d="M 11.5 14.5 Q 20 10.5 28.5 14.5" stroke={C.navy} strokeWidth="1.1" fill="none"/>
      <path d="M 11.5 17 Q 20 21 28.5 17" stroke={C.navy} strokeWidth="1.1" fill="none"/>
      <path d="M 14.5 22.5 L 13 32.5 H 27 L 25.5 22.5 Z" fill="#3BC4E8" opacity="0.8"/>
      <line x1="14.5" y1="22.5" x2="25.5" y2="22.5" stroke="#F5A920" strokeWidth="1.5"/>
      <path d="M 14.2 26.5 Q 20 24.5 25.8 26.5" stroke="white" strokeWidth="0.8" fill="none" opacity="0.45"/>
      <circle cx="18" cy="29.5" r="1" fill="white" opacity="0.35"/>
      <circle cx="22" cy="28.5" r="0.7" fill="white" opacity="0.3"/>
      <circle cx="26.5" cy="7" r="1.2" fill="#3BC4E8" opacity="0.8"/>
      <circle cx="20" cy="20" r="19" fill="none" stroke="#F5A920" strokeWidth="1.5"/>
    </svg>
  );
}

/* ── Shell — vraie app plein écran ── */
function Shell({children,notif,onNotif,tab,onTabChange,unread,memberCount}) {
  const tabs=[
    {id:"home",icon:"🏠",l:"Accueil"},
    {id:"tournois",icon:"🏐",l:"Tournois"},
    {id:"feed",icon:"📸",l:"Feed"},
    {id:"chats",icon:"💬",l:"Chats"},
    {id:"profil",icon:"👤",l:"Profil"},
  ];
  const hasUnrd=unread&&Object.values(unread).some(Boolean);
  return (
    <div style={{background:C.bg,minHeight:"100dvh",display:"flex",flexDirection:"column",fontFamily:"'Inter','Segoe UI',sans-serif",maxWidth:500,margin:"0 auto",position:"relative"}}>
      {/* Header */}
      <div style={{background:C.navy,padding:"12px 16px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:12,position:"sticky",top:0,zIndex:50,flexShrink:0}}>
        <WaschLogo size={38}/>
        <div>
          <div style={{color:C.gold,fontWeight:800,fontSize:14,letterSpacing:2}}>WASCHMACHINE</div>
          <div style={{color:C.muted,fontSize:10}}>VOLLEYBALL CLUB · {memberCount||"…"} membres</div>
        </div>
        <button onClick={onNotif} style={{marginLeft:"auto",background:"none",border:"none",cursor:"pointer",position:"relative",padding:4}}>
          <span style={{fontSize:22}}>🔔</span>
          {notif>0&&<div style={{position:"absolute",top:0,right:0,width:16,height:16,background:C.coral,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:800,color:"#fff"}}>{notif}</div>}
        </button>
      </div>
      {/* Content */}
      <div style={{flex:1,display:"flex",flexDirection:"column",overflow:"hidden",paddingBottom:onTabChange?68:0}}>
        {children}
      </div>
      {/* Bottom nav — fixé en bas */}
      {onTabChange&&(
        <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:500,background:C.navy,borderTop:`1px solid ${C.border}`,display:"flex",paddingBottom:16,paddingTop:8,zIndex:100}}>
          {tabs.map(t=>(
            <button key={t.id} onClick={()=>onTabChange(t.id)} style={{flex:1,background:"none",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:2,color:tab===t.id?C.gold:C.muted,padding:0,position:"relative"}}>
              <span style={{fontSize:22}}>{t.icon}</span>
              <span style={{fontSize:10,fontWeight:tab===t.id?700:400}}>{t.l}</span>
              {tab===t.id&&<div style={{width:16,height:2,borderRadius:1,background:C.gold,marginTop:1}}/>}
              {t.id==="chats"&&hasUnrd&&tab!=="chats"&&<div style={{position:"absolute",top:0,right:"15%",width:8,height:8,background:C.coral,borderRadius:"50%",border:`1.5px solid ${C.navy}`}}/>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ════ APP ════ */
export default function App() {
  const [authState,setAuth]     = useState("login");
  const [currentUser,setCUser]  = useState(null);
  const [tab,setTab]            = useState("home");
  const [ts,setTs]              = useState([]);
  const [selId,setSelId]        = useState(null);
  const [view,setView]          = useState("main");
  const [chatId,setCId]         = useState(null);
  const [unread,setUnrd]        = useState({});
  const [notifs,setNtfs]        = useState(INIT_NOTIFS);
  const [feed,setFeed]          = useState([]);
  const [members,setMembers]    = useState([]);
  const [toast,setToast]        = useState(null);
  const [flyer,setFlyer]        = useState(null);
  const [picSrc,setPic]         = useState(null);
  const [form,setForm]          = useState({name:"",rawDate:"",lieu:"",playType:"Outdoor",surface:"Beach",playerFormat:"4v4",minPlayers:4,maxPlayers:8,description:"",iParticipate:true});

  const selT = selId ? ts.find(t=>t.id===selId) : null;
  const chatT= chatId? ts.find(t=>t.id===chatId): null;
  const myTs = ts.filter(t=>(t.yesResponses||[]).includes(ME));
  const unreadNtfs = notifs.filter(n=>!n.read).length;

  const toast2=(msg,color)=>{setToast({msg,color});setTimeout(()=>setToast(null),2500);};

  useEffect(()=>onAuthChange(user=>{
    if(user){ME=user.displayName||user.email.split("@")[0];setCUser(user);setAuth("app");}
    else setAuth("login");
  }),[]);
  useEffect(()=>{if(authState!=="app")return;return subscribeTournaments(setTs);},[authState]);
  useEffect(()=>{if(authState!=="app")return;return subscribeFeed(setFeed);},[authState]);
  useEffect(()=>{if(authState!=="app")return;return subscribeUsers(setMembers);},[authState]);
  useEffect(()=>{window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();window._installPrompt=e;});},[]);

  const handleResponse=(id,ans)=>{respondToTournament(String(id),ME,ans);toast2(ans==="yes"?"Inscrit !":"Réponse enregistrée",ans==="yes"?C.cyan:C.muted);};
  const handleRemove=(id)=>{removeResponse(String(id),ME);toast2("Désinscrit",C.coral);};
  const handleValidate=(id)=>{const t=ts.find(t=>t.id===id);validateTeam(String(id),!t.teamValidated);toast2(!t.teamValidated?"Équipe validée ✓":"Validation annulée",!t.teamValidated?C.cyan:C.muted);};
  const handleAddResult=(id,result)=>{addResult(String(id),result);toast2("Résultats ajoutés !",C.gold);};
  const handleCreate=async()=>{
    if(!form.name.trim()||!form.rawDate||!form.lieu.trim()){toast2("Nom, date et lieu requis",C.coral);return;}
    const d=new Date(form.rawDate);
    const dl=isNaN(d)?form.rawDate:d.toLocaleDateString("fr-CH",{weekday:"short",day:"numeric",month:"short",year:"numeric"});
    await createTournament({name:form.name.trim(),date:dl,rawDate:form.rawDate,lieu:form.lieu.trim(),playType:form.playType,surface:form.playType==="Indoor"?null:form.surface,playerFormat:form.playerFormat,deadline:"—",minPlayers:parseInt(form.minPlayers)||2,maxPlayers:parseInt(form.maxPlayers)||8,proposedBy:ME,description:form.description.trim(),flyerUrl:null});
    setForm({name:"",rawDate:"",lieu:"",playType:"Outdoor",surface:"Beach",playerFormat:"4v4",minPlayers:4,maxPlayers:8,description:"",iParticipate:true});
    setFlyer(null);toast2("Tournoi proposé !",C.gold);setView("main");setTab("tournois");
  };
  const sendMsg=(tId,txt)=>{if(txt.trim())sendMessage(String(tId),ME,ME,txt.trim());};
  const openChat=(id)=>{setCId(id);setView("chat");setSelId(null);setUnrd(p=>({...p,[id]:false}));};
  const handleAddPost=async(post)=>{
    let mediaUrl=null;
    if(post.mediaSrc){const res=await fetch(post.mediaSrc);const blob=await res.blob();const file=new File([blob],"media."+(blob.type.split("/")[1]||"jpg"),{type:blob.type});mediaUrl=await uploadMedia(file,ME);}
    await createFeedPost(currentUser.uid,ME,{caption:post.caption,mediaUrl,mediaType:post.mediaSrc?post.mediaType:"gradient",grad:post.grad,emoji:post.emoji});
    toast2("Publié !",C.gold);setView("main");
  };
  const notifClick=(n)=>{setNtfs(p=>p.map(x=>x.id===n.id?{...x,read:true}:x));if(n.tid){setSelId(n.tid);setTab("tournois");}setView("main");};
  const likePhoto=(pid)=>toggleLike(pid,ME);
  const handleDeletePost=(pid)=>{deleteFeedPost(pid);toast2("Post supprimé",C.coral);};
  const handleNotifications=()=>{
    if(!("Notification"in window)){alert("Non supporté sur ce navigateur");return;}
    if(Notification.permission==="granted"){new Notification("Waschmachine 🏐",{body:"Notifications actives !"});toast2("Notifications actives ✓",C.cyan);return;}
    if(Notification.permission==="denied"){alert("Bloquées — autorise les notifications dans les paramètres du navigateur");return;}
    Notification.requestPermission().then(p=>{if(p==="granted"){toast2("Activées ✓",C.cyan);new Notification("Waschmachine 🏐",{body:"Tu recevras les alertes !"});}else toast2("Refusé",C.coral);});
  };
  const handleInstall=()=>{if(window._installPrompt)window._installPrompt.prompt();else toast2("iOS : Safari → Partager → Ajouter à l'écran d'accueil",C.gold);};
  const shell=(c,mc)=><Shell notif={unreadNtfs} onNotif={()=>setView("notifs")} memberCount={mc||members.length}>{c}</Shell>;

  if(authState==="login")      return <LoginScreen onGoogle={()=>setAuth("onboarding")} onEmail={()=>setAuth("email")}/>;
  if(authState==="email")      return <EmailAuthScreen onBack={()=>setAuth("login")} onSuccess={(_,isNew)=>setAuth(isNew?"onboarding":"app")}/>;
  if(authState==="onboarding") return <OnboardingScreen onDone={()=>setAuth("app")}/>;

  if(view==="notifs")  return shell(<NotifsView notifs={notifs} onBack={()=>setView("main")} onNotifClick={notifClick} onMarkAll={()=>setNtfs(p=>p.map(n=>({...n,read:true})))}/>);
  if(view==="charte")  return shell(<CharteView onBack={()=>setView("main")}/>);
  if(view==="create")  return shell(<CreateView form={form} setForm={setForm} flyer={flyer} setFlyer={setFlyer} onSubmit={handleCreate} onBack={()=>setView("main")} formats={PLAYER_FORMATS} surfaces={OUTDOOR_SURFACES}/>);
  if(view==="add-post")return shell(<AddPostView onPost={handleAddPost} onBack={()=>setView("main")}/>);
  if(view==="chat"&&chatT) return shell(<ChatView t={chatT} onSend={t=>sendMsg(chatT.id,t)} onBack={()=>{setView("main");setTab("chats");}}/>);

  return (
    <Shell notif={unreadNtfs} onNotif={()=>setView("notifs")} tab={tab} onTabChange={setTab} unread={unread} memberCount={members.length}>
      <div style={{flex:1,overflowY:"auto",paddingBottom:84}}>
        {tab==="home"    &&<HomeTab myTs={myTs} onSel={setSelId} onChat={openChat} unread={unread} onCal={()=>toast2("Ajouté au calendrier !",C.cyan)}/>}
        {tab==="tournois"&&<TournoisTab ts={ts} onSel={setSelId} onAdd={()=>setView("create")}/>}
        {tab==="feed"    &&<FeedTab feed={feed} onLike={likePhoto} onAdd={()=>setView("add-post")} onDelete={handleDeletePost} currentUser={currentUser}/>}
        {tab==="chats"   &&<ChatsTab myTs={myTs} unread={unread} onOpen={openChat}/>}
        {tab==="profil"  &&<ProfilTab ts={ts} picSrc={picSrc} setPic={setPic} members={members} onNotif={handleNotifications} onInstall={handleInstall} onCharte={()=>setView("charte")}/>}
      </div>
      {selT&&<TModal t={selT} onClose={()=>setSelId(null)} onResponse={handleResponse} onRemove={handleRemove} onValidate={handleValidate} onAddResult={handleAddResult} onChat={openChat}/>}
      {toast&&<div style={{position:"fixed",bottom:90,left:"50%",transform:"translateX(-50%)",background:toast.color+"22",border:`1px solid ${toast.color}`,color:toast.color,padding:"10px 22px",borderRadius:24,fontSize:13,fontWeight:700,whiteSpace:"nowrap",zIndex:200,pointerEvents:"none",maxWidth:"90%",textAlign:"center"}}>{toast.msg}</div>}
    </Shell>
  );
}

/* ── Home ── */
function HomeTab({myTs,onSel,onChat,unread,onCal}) {
  const upcoming=myTs.filter(t=>!isPast(t)).sort((a,b)=>new Date(a.rawDate)-new Date(b.rawDate));
  return (
    <div style={{padding:"20px 16px",paddingBottom:20}}>
      <div style={{color:C.muted,fontSize:13,marginBottom:2}}>Bonjour,</div>
      <div style={{color:C.text,fontSize:24,fontWeight:800,marginBottom:20}}>{ME} 👋</div>
      <div style={{color:C.text,fontSize:16,fontWeight:700,marginBottom:12}}>Mes prochains tournois</div>
      {upcoming.length===0
        ?<div style={{background:C.card,borderRadius:16,padding:24,textAlign:"center",border:`1px solid ${C.border}`}}><div style={{fontSize:32,marginBottom:8}}>🏐</div><div style={{color:C.muted,fontSize:13}}>Aucun tournoi à venir</div></div>
        :upcoming.map(t=>{
          const cap=capInfo(t),hu=unread[t.id];
          return (
            <div key={t.id} style={{background:t.teamValidated?C.cyan+"12":C.card,borderRadius:16,padding:16,border:`2px solid ${C.cyan}55`,marginBottom:12,position:"relative",overflow:"hidden"}}>
              <div style={{position:"absolute",left:0,top:0,bottom:0,width:4,background:C.cyan,borderRadius:"16px 0 0 16px"}}/>
              <div style={{paddingLeft:8}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                  <div style={{color:C.text,fontWeight:700,fontSize:15,cursor:"pointer",flex:1}} onClick={()=>onSel(t.id)}>{t.name}</div>
                  {t.teamValidated&&<div style={{background:C.cyan+"28",color:C.cyan,fontSize:10,fontWeight:700,padding:"3px 8px",borderRadius:20,marginLeft:8,flexShrink:0}}>Validée ✓</div>}
                </div>
                <div style={{color:C.muted,fontSize:12,marginBottom:2}}>📅 {t.date} · 📍 {t.lieu}</div>
                <div style={{color:cap.color,fontSize:12,fontWeight:600,marginBottom:12}}>{cap.text}</div>
                <div style={{display:"flex",gap:8}}>
                  <button onClick={onCal} style={{flex:1,padding:"8px 0",borderRadius:10,border:`1px solid ${C.border}`,background:"none",color:C.cyan,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>📆 Calendrier</button>
                  <button onClick={()=>onChat(t.id)} style={{flex:1,padding:"8px 0",borderRadius:10,border:`1px solid ${hu?C.coral:C.border}`,background:hu?C.coral+"18":"none",color:hu?C.coral:C.gold,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>💬 Chat{hu?" 🔴":""}</button>
                </div>
              </div>
            </div>
          );
        })
      }
    </div>
  );
}

/* ── Feed ── */
function FeedTab({feed,onLike,onAdd,onDelete,currentUser}) {
  const [menuId,setMenuId]=useState(null);
  return (
    <div style={{paddingBottom:20}}>
      <div style={{padding:"16px 16px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",borderBottom:`1px solid ${C.border}`,position:"sticky",top:0,background:C.bg,zIndex:10}}>
        <div style={{color:C.text,fontSize:22,fontWeight:800}}>Feed</div>
        <button onClick={onAdd} style={{width:38,height:38,borderRadius:"50%",background:C.gold,border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,color:C.navy,fontWeight:800}}>+</button>
      </div>
      {feed.map(p=>{
        const liked=p.likes&&p.likes.includes(ME);
        const isOwner=currentUser&&(p.author===currentUser.uid||p.authorName===ME);
        return (
          <div key={p.id} style={{borderBottom:`1px solid ${C.border}`}}>
            <div style={{display:"flex",alignItems:"center",gap:10,padding:"12px 16px"}}>
              <div style={{width:36,height:36,borderRadius:"50%",background:C.gold,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:14,color:C.navy}}>{(p.authorName||p.author||"?")[0]}</div>
              <div><div style={{color:C.text,fontWeight:700,fontSize:13}}>{p.authorName||p.author}</div><div style={{color:C.muted,fontSize:11}}>{p.time||""}</div></div>
              <div style={{marginLeft:"auto",position:"relative"}}>
                <button onClick={()=>setMenuId(menuId===p.id?null:p.id)} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:18,padding:"4px 8px"}}>•••</button>
                {menuId===p.id&&<div style={{position:"absolute",right:0,top:30,background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden",zIndex:20,minWidth:140,boxShadow:"0 8px 24px #0008"}}>
                  {isOwner&&<button onClick={()=>{onDelete(p.id);setMenuId(null);}} style={{width:"100%",padding:"12px 16px",background:"none",border:"none",color:C.coral,fontSize:14,fontWeight:600,cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}>🗑 Supprimer</button>}
                  <button onClick={()=>setMenuId(null)} style={{width:"100%",padding:"12px 16px",background:"none",border:"none",color:C.muted,fontSize:14,cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}>Annuler</button>
                </div>}
              </div>
            </div>
            {p.mediaUrl&&p.mediaType==="image"&&<img src={p.mediaUrl} alt="" style={{width:"100%",maxHeight:400,objectFit:"cover",display:"block"}}/>}
            {p.mediaUrl&&p.mediaType==="video"&&<video src={p.mediaUrl} controls playsInline style={{width:"100%",maxHeight:400,display:"block",background:"#000"}}/>}
            {(!p.mediaUrl||p.mediaType==="gradient")&&<div style={{height:260,background:p.grad,display:"flex",alignItems:"center",justifyContent:"center",fontSize:80}}>{p.emoji}</div>}
            <div style={{padding:"12px 16px"}}>
              <div style={{display:"flex",alignItems:"center",gap:16,marginBottom:8}}>
                <button onClick={()=>onLike(p.id)} style={{background:"none",border:"none",cursor:"pointer",display:"flex",alignItems:"center",gap:5,padding:0}}><span style={{fontSize:22}}>{liked?"❤️":"🤍"}</span></button>
                <span style={{color:C.muted,fontSize:20}}>💬</span>
              </div>
              <div style={{color:C.text,fontWeight:700,fontSize:13,marginBottom:3}}>{(p.likes||[]).length} j'aime</div>
              <div style={{color:C.text,fontSize:13}}><span style={{fontWeight:700}}>{p.authorName||p.author}</span> {p.caption}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── Add Post ── */
function AddPostView({onPost,onBack}) {
  const [caption,setCaption]=useState("");
  const [mediaSrc,setMediaSrc]=useState(null);
  const [mediaType,setMType]=useState(null);
  const [emoji,setEmoji]=useState("🏐");
  const [gradIdx,setGradIdx]=useState(0);
  const fileRef=useRef(null);
  const handleFile=e=>{const fi=e.target.files&&e.target.files[0];if(!fi)return;const isVid=fi.type.startsWith("video/");const r=new FileReader();r.onload=ev=>{setMediaSrc(ev.target.result);setMType(isVid?"video":"image");};r.readAsDataURL(fi);};
  const handlePost=()=>{if(!caption.trim()&&!mediaSrc)return;onPost({author:ME,caption:caption.trim(),mediaSrc,mediaType:mediaSrc?mediaType:"gradient",grad:FEED_GRADS[gradIdx],emoji});};
  const hasMedia=!!mediaSrc;
  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
      <div style={{padding:"14px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:`1px solid ${C.border}`,background:C.surface,flexShrink:0}}>
        <button onClick={onBack} style={{background:"none",border:"none",color:C.gold,fontSize:22,cursor:"pointer",padding:0}}>←</button>
        <div style={{color:C.text,fontSize:17,fontWeight:700}}>Nouvelle publication</div>
        <button onClick={handlePost} style={{background:"none",border:"none",color:C.gold,fontSize:15,fontWeight:800,cursor:"pointer",fontFamily:"inherit",opacity:caption.trim()||mediaSrc?1:0.4}}>Publier</button>
      </div>
      <div style={{flex:1,overflowY:"auto"}}>
        <div style={{position:"relative",background:"#000",cursor:"pointer"}} onClick={()=>{if(!hasMedia)fileRef.current&&fileRef.current.click();}}>
          {!hasMedia&&<div style={{height:280,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",background:FEED_GRADS[gradIdx],gap:10}}>
            <div style={{fontSize:70}}>{emoji}</div>
            <div style={{background:"#0008",borderRadius:24,padding:"10px 20px",display:"flex",alignItems:"center",gap:8}} onClick={e=>{e.stopPropagation();fileRef.current&&fileRef.current.click();}}>
              <span style={{fontSize:18}}>📷</span><span style={{color:"#fff",fontWeight:700,fontSize:14}}>Ajouter une photo ou vidéo</span>
            </div>
          </div>}
          {hasMedia&&mediaType==="image"&&<img src={mediaSrc} alt="" style={{width:"100%",maxHeight:380,objectFit:"cover",display:"block"}}/>}
          {hasMedia&&mediaType==="video"&&<video src={mediaSrc} controls playsInline style={{width:"100%",maxHeight:380,display:"block",background:"#000"}}/>}
          {hasMedia&&<div style={{position:"absolute",top:10,right:10,display:"flex",gap:8}}>
            <button onClick={e=>{e.stopPropagation();fileRef.current&&fileRef.current.click();}} style={{background:"#000b",border:"none",borderRadius:20,padding:"6px 12px",color:"#fff",fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>✏️ Changer</button>
            <button onClick={e=>{e.stopPropagation();setMediaSrc(null);setMType(null);}} style={{background:"#000b",border:"none",borderRadius:20,padding:"6px 12px",color:C.coral,fontSize:12,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>✕</button>
          </div>}
        </div>
        <input ref={fileRef} type="file" accept="image/*,video/*" onChange={handleFile} style={{display:"none"}}/>
        <div style={{display:"flex",gap:12,padding:"14px 16px",borderBottom:`1px solid ${C.border}`}}>
          <div style={{width:38,height:38,borderRadius:"50%",background:`linear-gradient(135deg,${C.gold},${C.cyan})`,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:15,color:C.navy,flexShrink:0}}>{ME[0]}</div>
          <textarea value={caption} onChange={e=>setCaption(e.target.value)} placeholder="Écris une légende..." style={{flex:1,background:"none",border:"none",color:C.text,fontSize:15,resize:"none",outline:"none",fontFamily:"inherit",minHeight:70,lineHeight:1.5}}/>
        </div>
        {!hasMedia&&<div style={{padding:"14px 16px"}}>
          <div style={{color:C.muted,fontSize:12,fontWeight:700,marginBottom:10}}>APPARENCE</div>
          <div style={{color:C.muted,fontSize:12,marginBottom:8}}>Fond</div>
          <div style={{display:"flex",gap:8,marginBottom:14}}>{FEED_GRADS.map((g,i)=><div key={i} onClick={()=>setGradIdx(i)} style={{width:40,height:40,borderRadius:10,background:g,cursor:"pointer",border:`3px solid ${gradIdx===i?C.gold:"transparent"}`,flexShrink:0}}/>)}</div>
          <div style={{color:C.muted,fontSize:12,marginBottom:8}}>Emoji</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:8}}>{FEED_EMOJIS.map(e=><button key={e} onClick={()=>setEmoji(e)} style={{width:40,height:40,borderRadius:10,background:emoji===e?C.gold+"22":C.card,border:`2px solid ${emoji===e?C.gold:C.border}`,fontSize:20,cursor:"pointer"}}>{e}</button>)}</div>
        </div>}
        <div style={{padding:"16px"}}><button onClick={handlePost} style={{width:"100%",padding:16,borderRadius:14,border:"none",background:`linear-gradient(135deg,${C.gold},${C.gold}CC)`,color:C.navy,fontWeight:800,fontSize:16,cursor:"pointer",fontFamily:"inherit",opacity:caption.trim()||mediaSrc?1:0.5}}>Publier</button></div>
      </div>
    </div>
  );
}

/* ── Tournois ── */
function TCard({t,onSel}) {
  const ans=myAnswer(t),past=isPast(t),cap=capInfo(t);
  const pct=Math.min(Math.round((t.yesResponses||[]).length/(t.maxPlayers||8)*100),100);
  const bc=past?C.border:ans==="yes"?C.green:ans==="no"?C.coral:C.border;
  const bw=!past&&ans!==null?"2px":"1px";
  const bg=t.teamValidated&&ans==="yes"?C.cyan+"12":past?C.navy+"88":C.card;
  return (
    <div onClick={()=>onSel(t.id)} style={{background:bg,borderRadius:16,padding:16,border:`${bw} solid ${bc}`,cursor:"pointer",position:"relative",overflow:"hidden",opacity:past?0.9:1}}>
      {!past&&ans!==null&&<div style={{position:"absolute",left:0,top:0,bottom:0,width:4,background:bc,borderRadius:"16px 0 0 16px"}}/>}
      <div style={{paddingLeft:!past&&ans!==null?8:0}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
          <div style={{flex:1,marginRight:8}}>
            <div style={{color:past?C.muted:C.text,fontWeight:700,fontSize:15}}>{t.name}</div>
            <div style={{color:C.muted,fontSize:12,marginTop:1}}>{t.date}</div>
          </div>
          {past&&t.result&&<div style={{background:plcColor(t.result.placement)+"28",color:plcColor(t.result.placement),fontSize:11,fontWeight:700,padding:"4px 10px",borderRadius:20,flexShrink:0}}>{plcLabel(t.result.placement)}</div>}
          {past&&!t.result&&<div style={{background:C.muted+"22",color:C.muted,fontSize:11,fontWeight:700,padding:"4px 10px",borderRadius:20,flexShrink:0}}>Terminé</div>}
          {!past&&ans==="yes"&&<div style={{background:t.teamValidated?C.cyan+"28":C.green+"22",color:t.teamValidated?C.cyan:C.green,fontSize:11,fontWeight:700,padding:"4px 10px",borderRadius:20,flexShrink:0}}>{t.teamValidated?"Validé ✓":"Oui ✓"}</div>}
          {!past&&ans==="no"&&<div style={{background:C.coral+"22",color:C.coral,fontSize:11,fontWeight:700,padding:"4px 10px",borderRadius:20,flexShrink:0}}>Non ✕</div>}
          {!past&&ans===null&&<div style={{background:C.gold+"22",color:C.gold,fontSize:11,fontWeight:700,padding:"4px 10px",borderRadius:20,flexShrink:0}}>Ouvert</div>}
        </div>
        <div style={{display:"flex",gap:12,flexWrap:"wrap",marginBottom:past?0:6}}>
          <span style={{color:C.muted,fontSize:12}}>📍 {t.lieu}</span>
          <span style={{color:C.muted,fontSize:12}}>🏐 {t.playerFormat} {fmtType(t)}</span>
        </div>
        {!past&&<div>
          <div style={{color:cap.color,fontSize:11,fontWeight:600,marginBottom:5,marginTop:6}}>{cap.text}</div>
          <div style={{background:C.dimmed,borderRadius:3,height:3,overflow:"hidden"}}><div style={{background:`linear-gradient(90deg,${C.green},${C.cyan})`,width:`${pct}%`,height:"100%",borderRadius:3}}/></div>
        </div>}
        {past&&t.result&&<div style={{color:C.muted,fontSize:12,marginTop:6,fontStyle:"italic"}}>"{t.result.notes}"</div>}
      </div>
    </div>
  );
}

function TournoisTab({ts,onSel,onAdd}) {
  const upcoming=ts.filter(t=>!isPast(t)),past=ts.filter(t=>isPast(t));
  const [showPast,setShowPast]=useState(true);
  return (
    <div style={{paddingBottom:20}}>
      <div style={{padding:"16px 16px 0",display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16,position:"sticky",top:0,background:C.bg,zIndex:10,paddingBottom:16,borderBottom:`1px solid ${C.border}`}}>
        <div style={{color:C.text,fontSize:22,fontWeight:800}}>Tournois</div>
        <button onClick={onAdd} style={{background:C.gold,border:"none",borderRadius:20,color:C.navy,fontWeight:800,fontSize:13,padding:"8px 16px",cursor:"pointer",fontFamily:"inherit"}}>+ Proposer</button>
      </div>
      <div style={{padding:"0 16px"}}>
        <div style={{color:C.muted,fontSize:11,fontWeight:700,letterSpacing:1,marginBottom:10}}>À VENIR</div>
        <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:20}}>{upcoming.map(t=><TCard key={t.id} t={t} onSel={onSel}/>)}</div>
        <button onClick={()=>setShowPast(p=>!p)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",width:"100%",background:"none",border:"none",cursor:"pointer",padding:"6px 0",marginBottom:10}}>
          <div style={{color:C.muted,fontSize:11,fontWeight:700,letterSpacing:1}}>HISTORIQUE ({past.length})</div>
          <div style={{color:C.muted,fontSize:14}}>{showPast?"▾":"▸"}</div>
        </button>
        {showPast&&<div style={{display:"flex",flexDirection:"column",gap:10}}>{past.map(t=><TCard key={t.id} t={t} onSel={onSel}/>)}</div>}
      </div>
    </div>
  );
}

/* ── Modal Tournoi ── */
function TModal({t,onClose,onResponse,onRemove,onValidate,onAddResult,onChat}) {
  const ans=myAnswer(t),cap=capInfo(t);
  const isAdmin=t.proposedBy===ME,isIn=ans==="yes",past=isPast(t);
  const canManage=(t.yesResponses||[]).includes(ME)||isAdmin;
  const [addingRes,setAddingRes]=useState(false);
  const [rForm,setRForm]=useState({placement:1,totalTeams:8,notes:""});
  const topColor=t.result?plcColor(t.result.placement):(t.teamValidated&&isIn)?C.cyan:C.gold;
  const modalBg=(t.teamValidated&&isIn)?`linear-gradient(180deg,${C.cyan}18,${C.surface} 40%)`:C.surface;
  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"#000c",display:"flex",flexDirection:"column",justifyContent:"flex-end",zIndex:50}}>
      <div onClick={e=>e.stopPropagation()} style={{background:modalBg,borderRadius:"28px 28px 0 0",padding:24,borderTop:`2px solid ${topColor}44`,maxHeight:"90vh",overflowY:"auto"}}>
        <div style={{width:40,height:4,background:C.border,borderRadius:2,margin:"0 auto 20px"}}/>
        {t.result&&<div style={{background:plcColor(t.result.placement)+"22",border:`1px solid ${plcColor(t.result.placement)}44`,borderRadius:14,padding:"14px 16px",marginBottom:16,textAlign:"center"}}>
          <div style={{fontSize:40,marginBottom:4}}>{t.result.placement===1?"🥇":t.result.placement===2?"🥈":t.result.placement===3?"🥉":"🏐"}</div>
          <div style={{color:plcColor(t.result.placement),fontWeight:800,fontSize:18}}>{plcLabel(t.result.placement)}</div>
          <div style={{color:C.muted,fontSize:12,marginTop:2}}>sur {t.result.totalTeams} équipes · par {t.result.addedBy}</div>
          {t.result.notes&&<div style={{color:C.text,fontSize:13,marginTop:8,lineHeight:1.4,fontStyle:"italic"}}>"{t.result.notes}"</div>}
        </div>}
        {t.teamValidated&&isIn&&!t.result&&<div style={{background:C.cyan+"22",border:`1px solid ${C.cyan}44`,borderRadius:12,padding:"8px 16px",marginBottom:16,textAlign:"center",color:C.cyan,fontWeight:700,fontSize:13}}>🎉 Équipe officiellement inscrite !</div>}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
          <div><div style={{color:C.text,fontWeight:800,fontSize:20}}>{t.name}</div><div style={{color:C.muted,fontSize:12,marginTop:4}}>Proposé par {t.proposedBy}{isAdmin?" (toi)":""}</div></div>
          <button onClick={onClose} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:18,padding:0,marginLeft:8}}>✕</button>
        </div>
        {t.description&&<div style={{background:C.card,borderRadius:12,padding:12,marginBottom:14,color:C.muted,fontSize:13,lineHeight:1.55,borderLeft:`3px solid ${C.gold}`}}>{t.description}</div>}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
          {[{icon:"📅",l:"Date",v:t.date},{icon:"📍",l:"Lieu",v:t.lieu},{icon:"🏐",l:"Format",v:`${t.playerFormat} ${fmtType(t)}`},{icon:"⏰",l:"Deadline",v:t.deadline}].map(i=>(
            <div key={i.l} style={{background:C.card,borderRadius:10,padding:"10px 12px"}}><div style={{color:C.muted,fontSize:11,marginBottom:2}}>{i.icon} {i.l}</div><div style={{color:C.text,fontSize:12,fontWeight:600}}>{i.v}</div></div>
          ))}
        </div>
        <div style={{marginBottom:14}}>
          <div style={{color:cap.color,fontWeight:700,fontSize:13,marginBottom:8}}>{cap.text}</div>
          {(t.yesResponses||[]).length>0&&<><div style={{color:C.green,fontSize:11,fontWeight:700,marginBottom:5}}>OUI — {(t.yesResponses||[]).length}</div><div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:10}}>{(t.yesResponses||[]).map(n=><div key={n} style={{background:n===ME?C.green+"22":C.card,border:`1px solid ${n===ME?C.green+"88":C.border}`,color:n===ME?C.green:C.text,fontSize:11,fontWeight:600,padding:"4px 10px",borderRadius:20}}>{n===ME?"Toi ✓":n}</div>)}</div></>}
          {(t.noResponses||[]).length>0&&<><div style={{color:C.coral,fontSize:11,fontWeight:700,marginBottom:5}}>NON — {(t.noResponses||[]).length}</div><div style={{display:"flex",flexWrap:"wrap",gap:6}}>{(t.noResponses||[]).map(n=><div key={n} style={{background:n===ME?C.coral+"22":C.card,border:`1px solid ${n===ME?C.coral+"88":C.border}`,color:n===ME?C.coral:C.muted,fontSize:11,padding:"4px 10px",borderRadius:20}}>{n===ME?"Toi ✕":n}</div>)}</div></>}
        </div>
        {past&&canManage&&!t.result&&<div style={{marginBottom:16}}>
          {!addingRes
            ?<button onClick={()=>setAddingRes(true)} style={{width:"100%",padding:14,borderRadius:12,border:`2px dashed ${C.gold}55`,background:C.gold+"08",color:C.gold,fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:"inherit"}}>🏆 Ajouter les résultats</button>
            :<div style={{background:C.card,borderRadius:14,padding:16,border:`1px solid ${C.gold}44`}}>
              <div style={{color:C.gold,fontWeight:700,fontSize:14,marginBottom:14}}>🏆 Résultats</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
                <div><div style={{color:C.muted,fontSize:12,marginBottom:6}}>Classement</div><select value={rForm.placement} onChange={e=>setRForm(p=>({...p,placement:parseInt(e.target.value)}))} style={IS({cursor:"pointer"})}>{[1,2,3,4,5,6,7,8].map(n=><option key={n} value={n} style={{background:C.card}}>{n===1?"🥇 1re":n===2?"🥈 2e":n===3?"🥉 3e":n+"e"} place</option>)}</select></div>
                <div><div style={{color:C.muted,fontSize:12,marginBottom:6}}>Total équipes</div><input type="number" min={2} max={64} value={rForm.totalTeams} onChange={e=>setRForm(p=>({...p,totalTeams:parseInt(e.target.value)}))} style={IS()}/></div>
              </div>
              <div style={{marginBottom:12}}><div style={{color:C.muted,fontSize:12,marginBottom:6}}>Commentaire</div><textarea value={rForm.notes} onChange={e=>setRForm(p=>({...p,notes:e.target.value}))} placeholder="Ambiance, résultats..." style={IS({resize:"none",height:70})}/></div>
              <div style={{display:"flex",gap:10}}>
                <button onClick={()=>setAddingRes(false)} style={{flex:1,padding:12,borderRadius:10,border:`1px solid ${C.border}`,background:"none",color:C.muted,fontWeight:700,cursor:"pointer",fontFamily:"inherit",fontSize:13}}>Annuler</button>
                <button onClick={()=>{onAddResult(t.id,{...rForm,addedBy:ME});setAddingRes(false);}} style={{flex:2,padding:12,borderRadius:10,border:"none",background:C.gold,color:C.navy,fontWeight:800,cursor:"pointer",fontFamily:"inherit",fontSize:13}}>Enregistrer ✓</button>
              </div>
            </div>}
        </div>}
        {isAdmin&&!past&&<div style={{background:C.card,borderRadius:14,padding:14,marginBottom:16,border:`1px solid ${C.gold}33`}}>
          <div style={{color:C.gold,fontSize:12,fontWeight:700,marginBottom:10}}>⚙ Gestion</div>
          <button onClick={()=>onValidate(t.id)} style={{width:"100%",padding:12,borderRadius:10,border:`1px solid ${t.teamValidated?C.cyan:C.border}`,background:t.teamValidated?C.cyan+"22":"none",color:t.teamValidated?C.cyan:C.muted,fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>{t.teamValidated?"✓ Équipe inscrite — cliquer pour annuler":"Marquer l'équipe comme inscrite ✓"}</button>
        </div>}
        {!past&&<div>
          <div style={{display:"flex",gap:10,marginBottom:8}}>
            <button onClick={()=>onResponse(t.id,"yes")} style={{flex:2,padding:14,borderRadius:12,border:`2px solid ${ans==="yes"?C.green:C.border}`,background:ans==="yes"?C.green+"22":"none",color:ans==="yes"?C.green:C.muted,fontWeight:800,fontSize:15,cursor:"pointer",fontFamily:"inherit"}}>✅ Je participe</button>
            <button onClick={()=>onResponse(t.id,"no")} style={{flex:1,padding:14,borderRadius:12,border:`2px solid ${ans==="no"?C.coral:C.border}`,background:ans==="no"?C.coral+"22":"none",color:ans==="no"?C.coral:C.muted,fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:"inherit"}}>❌ Non</button>
          </div>
          {ans!==null&&<button onClick={()=>onRemove(t.id)} style={{width:"100%",padding:"7px 0",background:"none",border:"none",color:C.muted,fontSize:12,cursor:"pointer",fontFamily:"inherit",textDecoration:"underline",marginBottom:8}}>Se retirer complètement</button>}
          {isIn&&<button onClick={()=>onChat(t.id)} style={{width:"100%",padding:12,borderRadius:12,border:`1px solid ${C.border}`,background:"none",color:C.cyan,fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:"inherit"}}>💬 Chat du tournoi</button>}
        </div>}
      </div>
    </div>
  );
}

/* ── Chats ── */
function ChatsTab({myTs,unread,onOpen}) {
  return (
    <div style={{paddingBottom:20}}>
      <div style={{padding:"16px 16px",borderBottom:`1px solid ${C.border}`,position:"sticky",top:0,background:C.bg,zIndex:10}}>
        <div style={{color:C.text,fontSize:22,fontWeight:800}}>Chats</div>
        <div style={{color:C.muted,fontSize:13,marginTop:2}}>Un chat par tournoi où tu participes</div>
      </div>
      <div style={{padding:"12px 16px"}}>
        {myTs.length===0
          ?<div style={{textAlign:"center",padding:"40px 0",color:C.muted,fontSize:13}}>Inscris-toi à un tournoi pour accéder à son chat !</div>
          :myTs.map(t=>{
            const hu=unread[t.id];
            return (
              <div key={t.id} onClick={()=>onOpen(t.id)} style={{display:"flex",alignItems:"center",gap:12,padding:"14px 12px",borderRadius:14,cursor:"pointer",background:hu?C.coral+"10":C.card,marginBottom:8,border:`1px solid ${hu?C.coral+"44":C.border}`}}>
                <div style={{width:46,height:46,borderRadius:"50%",background:hu?C.coral+"22":C.dimmed,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,flexShrink:0,position:"relative"}}>
                  🏐{hu&&<div style={{position:"absolute",top:-2,right:-2,width:12,height:12,background:C.coral,borderRadius:"50%",border:`2px solid ${C.bg}`}}/>}
                </div>
                <div style={{flex:1,overflow:"hidden"}}>
                  <div style={{color:C.text,fontWeight:hu?700:600,fontSize:14,marginBottom:2}}>{t.name}</div>
                  <div style={{color:C.muted,fontSize:12}}>Tape pour voir les messages 💬</div>
                </div>
                <div style={{color:C.muted,fontSize:18}}>›</div>
              </div>
            );
          })
        }
      </div>
    </div>
  );
}

/* ── Chat View ── */
function ChatView({t,onSend,onBack}) {
  const [msgs,setMsgs]=useState([]);
  const [loading,setLoading]=useState(true);
  const [inp,setInp]=useState("");
  useEffect(()=>{if(!t||!t.id)return;return subscribeChat(String(t.id),data=>{setMsgs(data);setLoading(false);});},[t&&t.id]);
  const send=()=>{onSend(inp);setInp("");};
  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
      <div style={{background:C.surface,padding:"12px 16px",borderBottom:`1px solid ${C.border}`,display:"flex",alignItems:"center",gap:12,flexShrink:0}}>
        <button onClick={onBack} style={{background:"none",border:"none",color:C.gold,fontSize:22,cursor:"pointer",padding:0}}>←</button>
        <div><div style={{color:C.text,fontWeight:700,fontSize:15}}>{t.name}</div><div style={{color:C.muted,fontSize:11}}>{(t.yesResponses||[]).length} participants</div></div>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"16px 16px 8px",display:"flex",flexDirection:"column",gap:12}}>
        {loading&&<div style={{textAlign:"center",color:C.muted,fontSize:13,marginTop:40}}>Chargement...</div>}
        {!loading&&msgs.length===0&&<div style={{textAlign:"center",color:C.muted,fontSize:13,marginTop:40}}>Pas encore de messages.</div>}
        {msgs.map(m=>{
          const me=m.author===ME||m.authorName===ME;
          return (
            <div key={m.id} style={{display:"flex",flexDirection:"column",alignItems:me?"flex-end":"flex-start"}}>
              {!me&&<div style={{color:C.muted,fontSize:11,marginBottom:3,paddingLeft:4}}>{m.authorName||m.author}</div>}
              <div style={{background:me?C.gold:C.card,color:me?C.navy:C.text,padding:"10px 14px",borderRadius:me?"18px 18px 4px 18px":"18px 18px 18px 4px",fontSize:14,maxWidth:"75%",lineHeight:1.4,border:me?"none":`1px solid ${C.border}`}}>{m.text}</div>
            </div>
          );
        })}
      </div>
      <div style={{padding:"8px 16px 16px",borderTop:`1px solid ${C.border}`,display:"flex",gap:10,alignItems:"center",flexShrink:0}}>
        <input value={inp} onChange={e=>setInp(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()} placeholder="Écris un message..." style={{flex:1,padding:"11px 16px",background:C.card,border:`1px solid ${C.border}`,borderRadius:24,color:C.text,fontSize:14,fontFamily:"inherit",outline:"none"}}/>
        <button onClick={send} style={{width:42,height:42,borderRadius:"50%",background:C.gold,border:"none",cursor:"pointer",color:C.navy,fontWeight:800,fontSize:18,display:"flex",alignItems:"center",justifyContent:"center"}}>→</button>
      </div>
    </div>
  );
}

/* ── Create Tournoi ── */
function CreateView({form,setForm,flyer,setFlyer,onSubmit,onBack,formats,surfaces}) {
  const f=(k,v)=>setForm(p=>({...p,[k]:v}));
  const fileRef=useRef(null);
  const handleFile=e=>{const fi=e.target.files&&e.target.files[0];if(!fi)return;const r=new FileReader();r.onload=ev=>setFlyer(ev.target.result);r.readAsDataURL(fi);};
  return (
    <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
      <div style={{padding:"14px 16px",display:"flex",alignItems:"center",gap:12,borderBottom:`1px solid ${C.border}`,background:C.surface,flexShrink:0}}>
        <button onClick={onBack} style={{background:"none",border:"none",color:C.gold,fontSize:22,cursor:"pointer",padding:0}}>←</button>
        <div style={{color:C.text,fontSize:20,fontWeight:800}}>Proposer un tournoi</div>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"16px 16px"}}>
        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <div>
            <div style={{color:C.muted,fontSize:12,marginBottom:6}}>Flyer / photo (optionnel)</div>
            <div onClick={()=>fileRef.current&&fileRef.current.click()} style={{width:"100%",boxSizing:"border-box",height:flyer?"auto":90,background:C.card,border:`2px dashed ${C.border}`,borderRadius:14,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",cursor:"pointer",overflow:"hidden"}}>
              {flyer?<img src={flyer} alt="" style={{width:"100%",borderRadius:12,display:"block"}}/>:<><div style={{fontSize:26,marginBottom:4}}>📸</div><div style={{color:C.muted,fontSize:12}}>Flyer, story, photo</div></>}
            </div>
            <input ref={fileRef} type="file" accept="image/*,application/pdf" onChange={handleFile} style={{display:"none"}}/>
            {flyer&&<button onClick={()=>setFlyer(null)} style={{background:"none",border:"none",color:C.coral,cursor:"pointer",fontSize:12,marginTop:4,padding:0,fontFamily:"inherit"}}>✕ Supprimer</button>}
          </div>
          <div><div style={{color:C.muted,fontSize:12,marginBottom:6}}>Nom *</div><input value={form.name} onChange={e=>f("name",e.target.value)} placeholder="ex. Open de Genève" style={IS()}/></div>
          <div><div style={{color:C.muted,fontSize:12,marginBottom:6}}>Date *</div><input type="date" value={form.rawDate} onChange={e=>f("rawDate",e.target.value)} style={IS()}/></div>
          <div><div style={{color:C.muted,fontSize:12,marginBottom:6}}>Lieu *</div><input value={form.lieu} onChange={e=>f("lieu",e.target.value)} placeholder="ex. Genève — Plage des Eaux-Vives" style={IS()}/></div>
          <div>
            <div style={{color:C.muted,fontSize:12,marginBottom:8}}>Type de jeu</div>
            <div style={{display:"flex",gap:10,marginBottom:form.playType==="Outdoor"?12:0}}>
              {["Indoor","Outdoor"].map(tp=><button key={tp} onClick={()=>f("playType",tp)} style={{flex:1,padding:"11px 0",borderRadius:12,border:`2px solid ${form.playType===tp?C.gold:C.border}`,background:form.playType===tp?C.gold+"15":"none",color:form.playType===tp?C.gold:C.muted,fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:"inherit"}}>{tp==="Indoor"?"🏟 Indoor":"🌤 Outdoor"}</button>)}
            </div>
            {form.playType==="Outdoor"&&<div style={{display:"flex",gap:8}}>
              {surfaces.map(s=><button key={s} onClick={()=>f("surface",s)} style={{flex:1,padding:"9px 0",borderRadius:10,border:`2px solid ${form.surface===s?C.cyan:C.border}`,background:form.surface===s?C.cyan+"18":"none",color:form.surface===s?C.cyan:C.muted,fontWeight:700,fontSize:13,cursor:"pointer",fontFamily:"inherit"}}>{s==="Beach"?"🏖 Beach":s==="Gazon"?"🌿 Gazon":"💧 Water"}</button>)}
            </div>}
          </div>
          <div><div style={{color:C.muted,fontSize:12,marginBottom:6}}>Format</div><select value={form.playerFormat} onChange={e=>f("playerFormat",e.target.value)} style={IS({cursor:"pointer"})}>{formats.map(p=><option key={p} value={p} style={{background:C.card}}>{p}</option>)}</select></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <div><div style={{color:C.muted,fontSize:12,marginBottom:6}}>Joueurs min.</div><input type="number" min={1} max={50} value={form.minPlayers} onChange={e=>f("minPlayers",e.target.value)} style={IS()}/></div>
            <div><div style={{color:C.muted,fontSize:12,marginBottom:6}}>Max. / équipe</div><input type="number" min={1} max={50} value={form.maxPlayers} onChange={e=>f("maxPlayers",e.target.value)} style={IS()}/></div>
          </div>
          <div><div style={{color:C.muted,fontSize:12,marginBottom:6}}>Description</div><textarea value={form.description} onChange={e=>f("description",e.target.value)} placeholder="Infos, lien d'inscription..." style={IS({resize:"none",height:70})}/></div>
          <div onClick={()=>f("iParticipate",!form.iParticipate)} style={{display:"flex",alignItems:"center",gap:10,padding:"12px 14px",background:C.card,borderRadius:12,border:`1px solid ${C.border}`,cursor:"pointer"}}>
            <div style={{width:22,height:22,borderRadius:6,border:`2px solid ${form.iParticipate?C.gold:C.border}`,background:form.iParticipate?C.gold:"none",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{form.iParticipate&&<span style={{color:C.navy,fontSize:14,fontWeight:800}}>✓</span>}</div>
            <span style={{color:form.iParticipate?C.text:C.muted,fontSize:14}}>Je participe aussi à ce tournoi</span>
          </div>
          <button onClick={onSubmit} style={{width:"100%",padding:16,borderRadius:14,border:"none",background:`linear-gradient(135deg,${C.gold},${C.gold}CC)`,color:C.navy,fontWeight:800,fontSize:16,cursor:"pointer",fontFamily:"inherit"}}>Proposer ce tournoi</button>
        </div>
      </div>
    </div>
  );
}

/* ── Notifs ── */
function NotifsView({notifs,onBack,onNotifClick,onMarkAll}) {
  const unrd=notifs.filter(n=>!n.read).length;
  return (
    <div style={{height:"100%",overflowY:"auto"}}>
      <div style={{padding:"14px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:`1px solid ${C.border}`,background:C.surface,position:"sticky",top:0}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <button onClick={onBack} style={{background:"none",border:"none",color:C.gold,fontSize:22,cursor:"pointer",padding:0}}>←</button>
          <div style={{color:C.text,fontSize:20,fontWeight:800}}>Notifications</div>
          {unrd>0&&<div style={{background:C.coral,color:"#fff",fontSize:11,fontWeight:800,width:20,height:20,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center"}}>{unrd}</div>}
        </div>
        {unrd>0&&<button onClick={onMarkAll} style={{background:"none",border:"none",color:C.muted,fontSize:12,cursor:"pointer",fontFamily:"inherit"}}>Tout lire</button>}
      </div>
      {notifs.map(n=>{
        const cfg=NOTIF_TYPES[n.type]||{icon:"🔔"};
        return (
          <div key={n.id} onClick={()=>onNotifClick(n)} style={{display:"flex",alignItems:"flex-start",gap:12,padding:"14px 16px",borderBottom:`1px solid ${C.border}`,cursor:"pointer",background:n.read?"none":C.gold+"08"}}>
            <div style={{width:40,height:40,borderRadius:"50%",background:n.read?C.card:C.gold+"22",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{cfg.icon}</div>
            <div style={{flex:1}}>
              <div style={{color:n.read?C.muted:C.text,fontSize:13,lineHeight:1.4,marginBottom:3}}>{n.text}</div>
              <div style={{color:C.muted,fontSize:11}}>{n.time}{n.tid&&<span style={{color:C.cyan}}> · voir →</span>}</div>
            </div>
            {!n.read&&<div style={{width:8,height:8,borderRadius:"50%",background:C.coral,flexShrink:0,marginTop:6}}/>}
          </div>
        );
      })}
    </div>
  );
}

/* ── Charte ── */
function CharteView({onBack}) {
  return (
    <div style={{height:"100%",overflowY:"auto"}}>
      <div style={{padding:"14px 16px",display:"flex",alignItems:"center",gap:12,borderBottom:`1px solid ${C.border}`,background:C.surface,position:"sticky",top:0}}>
        <button onClick={onBack} style={{background:"none",border:"none",color:C.gold,fontSize:22,cursor:"pointer",padding:0}}>←</button>
        <div style={{color:C.text,fontSize:20,fontWeight:800}}>Charte Waschmachine</div>
      </div>
      <div style={{padding:"16px 20px",display:"flex",flexDirection:"column",gap:14}}>
        {[
          {icon:"🏐",title:"Esprit loisir",text:"Waschmachine avant tout c'est du plaisir, de l'ambiance et des verres après le match. La compétition passe après la bonne humeur !"},
          {icon:"✅",title:"Engagement",text:"Si tu t'inscris à un tournoi, tu t'engages à y participer. Préviens au plus vite si tu dois te désister."},
          {icon:"💬",title:"Communication",text:"Utilise l'app pour répondre aux sondages. Pas de réponse = absence."},
          {icon:"🤝",title:"Respect",text:"Respect de tous les membres, des adversaires et des arbitres, sur et hors du terrain."},
          {icon:"💰",title:"Frais",text:"Les frais d'inscription sont couverts par la cotisation annuelle. Pas de frais supplémentaires par tournoi."},
          {icon:"🍺",title:"L'après-tournoi",text:"La vraie victoire c'est le verre d'après. Participation fortement recommandée !"},
        ].map(r=>(
          <div key={r.title} style={{background:C.card,borderRadius:14,padding:16,border:`1px solid ${C.border}`}}>
            <div style={{fontSize:24,marginBottom:6}}>{r.icon}</div>
            <div style={{color:C.gold,fontWeight:700,fontSize:15,marginBottom:6}}>{r.title}</div>
            <div style={{color:C.muted,fontSize:13,lineHeight:1.6}}>{r.text}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Profil ── */
function ProfilTab({ts,picSrc,setPic,members,onNotif,onInstall,onCharte}) {
  const [editing,setEdit]=useState(false);
  const [name,setName]=useState(ME);
  const [bio,setBio]=useState("Volleyball addict 🏐");
  const avatarRef=useRef(null);
  const handleAvatar=e=>{const fi=e.target.files&&e.target.files[0];if(!fi)return;const r=new FileReader();r.onload=ev=>setPic(ev.target.result);r.readAsDataURL(fi);};
  const nbIn=ts.filter(t=>(t.yesResponses||[]).includes(ME)&&!isPast(t)).length;
  const nbPast=ts.filter(t=>(t.yesResponses||[]).includes(ME)&&isPast(t)).length;
  const nbProp=ts.filter(t=>t.proposedBy===ME).length;
  const allYes=ts.filter(t=>(t.yesResponses||[]).includes(ME)).length;
  const nbAns=ts.filter(t=>(t.yesResponses||[]).includes(ME)||(t.noResponses||[]).includes(ME)).length;
  const ratio=nbAns>0?Math.round(allYes/nbAns*100):0;
  const palmares=ts.filter(t=>isPast(t)&&(t.yesResponses||[]).includes(ME)&&t.result);
  const bestP=palmares.length>0?Math.min(...palmares.map(t=>t.result.placement)):null;
  const totalYes=ts.reduce((s,t)=>s+(t.yesResponses||[]).length,0);
  const mostActive=members.length>0?members.map(m=>({name:m.displayName||m.email||"?",n:ts.filter(t=>(t.yesResponses||[]).includes(m.displayName||"")).length})).sort((a,b)=>b.n-a.n)[0]:{name:"—",n:0};
  return (
    <div style={{paddingBottom:20}}>
      <div style={{padding:"20px 16px 16px",display:"flex",flexDirection:"column",alignItems:"center"}}>
        <div style={{position:"relative",marginBottom:14,cursor:"pointer"}} onClick={()=>avatarRef.current&&avatarRef.current.click()}>
          <div style={{width:80,height:80,borderRadius:"50%",border:`3px solid ${C.gold}`,overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center"}}>
            {picSrc?<img src={picSrc} alt="Avatar" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
              :<div style={{width:"100%",height:"100%",background:`linear-gradient(135deg,${C.gold},${C.cyan})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:32,fontWeight:800,color:C.navy}}>{name[0]}</div>}
          </div>
          <div style={{position:"absolute",bottom:0,right:0,width:26,height:26,background:C.gold,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,border:`2px solid ${C.bg}`}}>📷</div>
        </div>
        <input ref={avatarRef} type="file" accept="image/*" onChange={handleAvatar} style={{display:"none"}}/>
        {editing?(
          <div style={{width:"100%",paddingBottom:16}}>
            <input value={name} onChange={e=>setName(e.target.value)} style={IS({marginBottom:10,textAlign:"center",fontSize:18,fontWeight:700})}/>
            <input value={bio} onChange={e=>setBio(e.target.value)} style={IS({textAlign:"center",fontSize:14,marginBottom:14})}/>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>setEdit(false)} style={{flex:1,padding:12,borderRadius:12,border:`1px solid ${C.border}`,background:"none",color:C.muted,fontWeight:700,cursor:"pointer",fontFamily:"inherit",fontSize:14}}>Annuler</button>
              <button onClick={()=>setEdit(false)} style={{flex:2,padding:12,borderRadius:12,border:"none",background:C.gold,color:C.navy,fontWeight:800,cursor:"pointer",fontFamily:"inherit",fontSize:14}}>Enregistrer</button>
            </div>
          </div>
        ):(
          <div style={{textAlign:"center"}}>
            <div style={{color:C.text,fontWeight:800,fontSize:22,marginBottom:4}}>{name}</div>
            <div style={{color:C.muted,fontSize:13,marginBottom:6}}>{bio}</div>
            <div style={{color:C.gold,fontSize:12,fontWeight:600,marginBottom:14}}>Waschmachine Volleyball Club</div>
            <button onClick={()=>setEdit(true)} style={{padding:"8px 20px",borderRadius:20,border:`1px solid ${C.border}`,background:"none",color:C.muted,fontSize:13,cursor:"pointer",fontFamily:"inherit",marginBottom:20}}>Modifier le profil</button>
          </div>
        )}
      </div>
      <div style={{padding:"0 16px",marginBottom:20}}>
        <div style={{color:C.muted,fontSize:11,fontWeight:700,letterSpacing:1,marginBottom:10}}>MON RÉCAP</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
          {[{l:"À venir",v:nbIn,icon:"🏐",col:C.cyan},{l:"Joués",v:nbPast,icon:"✅",col:C.green},{l:"Proposés",v:nbProp,icon:"➕",col:C.gold},{l:"Taux",v:`${ratio}%`,icon:"📊",col:C.amber}].map(s=>(
            <div key={s.l} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:"10px 6px",textAlign:"center"}}>
              <div style={{fontSize:16,marginBottom:3}}>{s.icon}</div>
              <div style={{color:s.col,fontWeight:800,fontSize:16}}>{s.v}</div>
              <div style={{color:C.muted,fontSize:9,marginTop:1}}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>
      {palmares.length>0&&(
        <div style={{padding:"0 16px",marginBottom:20}}>
          <div style={{color:C.muted,fontSize:11,fontWeight:700,letterSpacing:1,marginBottom:10}}>PALMARÈS</div>
          {bestP&&<div style={{background:C.card,borderRadius:14,padding:14,marginBottom:10,border:`1px solid ${plcColor(bestP)}44`,display:"flex",alignItems:"center",gap:12}}>
            <div style={{fontSize:32}}>{bestP===1?"🥇":bestP===2?"🥈":"🥉"}</div>
            <div><div style={{color:plcColor(bestP),fontWeight:800,fontSize:15}}>Meilleur : {plcLabel(bestP)}</div><div style={{color:C.muted,fontSize:12}}>{palmares.find(t=>t.result.placement===bestP)?.name}</div></div>
          </div>}
          {palmares.map(t=>(
            <div key={t.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:`1px solid ${C.border}`}}>
              <span style={{color:C.muted,fontSize:13}}>🏐 {t.name}</span>
              <span style={{color:plcColor(t.result.placement),fontWeight:700,fontSize:13}}>{plcLabel(t.result.placement)}</span>
            </div>
          ))}
        </div>
      )}
      <div style={{padding:"0 16px",marginBottom:20}}>
        <div style={{color:C.muted,fontSize:11,fontWeight:700,letterSpacing:1,marginBottom:10}}>L'ASSO EN CHIFFRES</div>
        <div style={{background:C.card,borderRadius:16,padding:16,border:`1px solid ${C.border}`}}>
          {[{l:"Membres inscrits",v:members.length,icon:"👥"},{l:"Tournois à venir",v:ts.filter(t=>!isPast(t)).length,icon:"🏆"},{l:"Tournois joués",v:ts.filter(t=>isPast(t)).length,icon:"✅"},{l:"Total inscriptions",v:totalYes,icon:"📊"},{l:"Membre le + actif",v:mostActive.name,icon:"⭐"}].map(s=>(
            <div key={s.l} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 0",borderBottom:`1px solid ${C.border}`}}>
              <span style={{color:C.muted,fontSize:13}}>{s.icon} {s.l}</span>
              <span style={{color:C.text,fontWeight:700,fontSize:13}}>{s.v}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{padding:"0 16px"}}>
        <div style={{color:C.muted,fontSize:11,fontWeight:700,letterSpacing:1,marginBottom:10}}>PARAMÈTRES</div>
        {[{icon:"🔔",l:"Notifications",sub:"Activer les rappels et alertes",fn:onNotif},{icon:"📱",l:"Installer l'app",sub:"Ajouter à l'écran d'accueil",fn:onInstall},{icon:"📋",l:"Charte Waschmachine",sub:"Règles de l'association",fn:onCharte}].map(it=>(
          <div key={it.l} onClick={it.fn} style={{display:"flex",alignItems:"center",gap:14,padding:"14px 0",borderBottom:`1px solid ${C.border}`,cursor:"pointer"}}>
            <div style={{width:38,height:38,borderRadius:10,background:C.card,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,flexShrink:0}}>{it.icon}</div>
            <div><div style={{color:C.text,fontSize:14,fontWeight:600}}>{it.l}</div><div style={{color:C.muted,fontSize:12}}>{it.sub}</div></div>
            <div style={{marginLeft:"auto",color:C.muted,fontSize:18}}>›</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ════ AUTH SCREENS ════ */
const AS={background:C.bg,minHeight:"100dvh",display:"flex",flexDirection:"column",fontFamily:"'Inter','Segoe UI',sans-serif",maxWidth:500,margin:"0 auto"};

function LoginScreen({onGoogle,onEmail}) {
  const [loading,setLoad]=useState(false);
  const handleGoogle=async()=>{setLoad(true);try{await loginWithGoogle();}catch(e){setLoad(false);alert("Erreur : "+e.message);}};
  return (
    <div style={AS}>
      <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"40px 32px 20px",background:`linear-gradient(180deg,${C.navy} 0%,${C.bg} 65%)`}}>
        <WaschLogo size={96}/>
        <div style={{color:C.gold,fontWeight:800,fontSize:28,letterSpacing:3,marginTop:22,textAlign:"center"}}>WASCHMACHINE</div>
        <div style={{color:C.muted,fontSize:12,letterSpacing:2,marginTop:5}}>VOLLEYBALL CLUB</div>
        <div style={{color:C.text,fontSize:21,fontWeight:700,marginTop:44,textAlign:"center"}}>Rejoins l'équipe 🏐</div>
        <div style={{color:C.muted,fontSize:14,textAlign:"center",marginTop:10,lineHeight:1.65,maxWidth:280}}>Connecte-toi pour accéder aux tournois, au feed et au chat.</div>
      </div>
      <div style={{padding:"16px 28px 44px",display:"flex",flexDirection:"column",gap:12}}>
        <button onClick={handleGoogle} disabled={loading} style={{width:"100%",padding:16,borderRadius:14,border:"none",background:loading?C.dimmed:C.gold,color:loading?C.muted:C.navy,fontWeight:800,fontSize:16,cursor:loading?"default":"pointer",fontFamily:"inherit",display:"flex",alignItems:"center",justifyContent:"center",gap:10}}>
          {loading?"Connexion en cours...":<><svg width="20" height="20" viewBox="0 0 20 20" style={{flexShrink:0}}><path d="M19.6 10.23c0-.68-.06-1.36-.17-2H10v3.79h5.38a4.6 4.6 0 01-2 3.02v2.5h3.23c1.9-1.75 3-4.33 3-7.31z" fill="#4285F4"/><path d="M10 20c2.7 0 4.96-.9 6.62-2.44l-3.23-2.5c-.9.6-2.05.96-3.39.96-2.6 0-4.8-1.76-5.59-4.12H1.07v2.58A10 10 0 0010 20z" fill="#34A853"/><path d="M4.41 11.9A6 6 0 014.1 10c0-.66.11-1.3.31-1.9V5.52H1.07A10 10 0 000 10c0 1.61.39 3.14 1.07 4.48l3.34-2.58z" fill="#FBBC05"/><path d="M10 3.96c1.47 0 2.79.5 3.83 1.5L16.69 2.4A10 10 0 0010 0 10 10 0 001.07 5.52l3.34 2.58C5.2 5.72 7.4 3.96 10 3.96z" fill="#EA4335"/></svg>Continuer avec Google</>}
        </button>
        <button onClick={onEmail} style={{width:"100%",padding:16,borderRadius:14,border:`1px solid ${C.border}`,background:"none",color:C.text,fontWeight:600,fontSize:15,cursor:"pointer",fontFamily:"inherit"}}>✉️ Continuer avec email</button>
        <div style={{color:C.muted,fontSize:11,textAlign:"center",marginTop:6}}>En continuant, tu acceptes les règles de l'asso Waschmachine.</div>
      </div>
    </div>
  );
}

function EmailAuthScreen({onBack,onSuccess}) {
  const [mode,setMode]=useState("signup");
  const [name,setName]=useState("");
  const [email,setEmail]=useState("");
  const [pass,setPass]=useState("");
  const [error,setError]=useState("");
  const [loading,setLoad]=useState(false);
  const handleSubmit=async()=>{
    if(!email.trim()||!pass){setError("Remplis tous les champs");return;}
    if(mode==="signup"&&!name.trim()){setError("Indique ton prénom");return;}
    if(pass.length<6){setError("Mot de passe : 6 caractères min.");return;}
    setError("");setLoad(true);
    try{
      if(mode==="signup"){await registerWithEmail(email,pass,name.trim());onSuccess(name.trim(),true);}
      else{await loginWithEmail(email,pass);onSuccess(email.split("@")[0],false);}
    }catch(e){
      setLoad(false);
      const msg=e.code==="auth/email-already-in-use"?"Email déjà utilisé":e.code==="auth/wrong-password"?"Mot de passe incorrect":e.code==="auth/user-not-found"?"Aucun compte avec cet email":e.message;
      setError(msg);
    }
  };
  return (
    <div style={AS}>
      <div style={{padding:"16px 20px 14px",display:"flex",alignItems:"center",gap:12,borderBottom:`1px solid ${C.border}`,background:C.surface}}>
        <button onClick={onBack} style={{background:"none",border:"none",color:C.gold,fontSize:22,cursor:"pointer",padding:0}}>←</button>
        <div style={{color:C.text,fontSize:18,fontWeight:700}}>{mode==="signin"?"Se connecter":"Créer un compte"}</div>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"24px 24px 32px",display:"flex",flexDirection:"column",gap:14}}>
        <div style={{display:"flex",background:C.card,borderRadius:12,padding:4,gap:4}}>
          {["signup","signin"].map(m=><button key={m} onClick={()=>{setMode(m);setError("");}} style={{flex:1,padding:"10px 0",borderRadius:10,border:"none",background:mode===m?C.gold:"none",color:mode===m?C.navy:C.muted,fontWeight:700,fontSize:14,cursor:"pointer",fontFamily:"inherit"}}>{m==="signup"?"Inscription":"Connexion"}</button>)}
        </div>
        {mode==="signup"&&<div><div style={{color:C.muted,fontSize:12,marginBottom:6}}>Prénom *</div><input value={name} onChange={e=>setName(e.target.value)} placeholder="ex. Lucas" style={IS()}/></div>}
        <div><div style={{color:C.muted,fontSize:12,marginBottom:6}}>Email *</div><input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="ton@email.com" style={IS()}/></div>
        <div><div style={{color:C.muted,fontSize:12,marginBottom:6}}>Mot de passe *</div><input type="password" value={pass} onChange={e=>setPass(e.target.value)} placeholder={mode==="signup"?"6 caractères minimum":"Ton mot de passe"} style={IS()}/></div>
        {error&&<div style={{background:C.coral+"22",border:`1px solid ${C.coral}44`,borderRadius:10,padding:"10px 14px",color:C.coral,fontSize:13}}>{error}</div>}
        <button onClick={handleSubmit} disabled={loading} style={{width:"100%",padding:16,borderRadius:14,border:"none",background:loading?C.dimmed:C.gold,color:loading?C.muted:C.navy,fontWeight:800,fontSize:16,cursor:loading?"default":"pointer",fontFamily:"inherit",marginTop:4}}>
          {loading?"Connexion...":(mode==="signup"?"Créer mon compte →":"Se connecter →")}
        </button>
        {mode==="signin"&&<button style={{background:"none",border:"none",color:C.muted,fontSize:13,cursor:"pointer",fontFamily:"inherit",textDecoration:"underline",padding:0}}>Mot de passe oublié ?</button>}
      </div>
    </div>
  );
}

function OnboardingScreen({onDone}) {
  const [step,setStep]=useState(0);
  const [dName,setDName]=useState("");
  const [avatar,setAvatar]=useState(null);
  const picRef=useRef(null);
  const handleAvatar=e=>{const fi=e.target.files&&e.target.files[0];if(!fi)return;const r=new FileReader();r.onload=ev=>setAvatar(ev.target.result);r.readAsDataURL(fi);};
  return (
    <div style={AS}>
      <div style={{display:"flex",justifyContent:"center",gap:8,padding:"24px 0 0"}}>
        {[0,1,2].map(i=><div key={i} style={{width:i===step?24:8,height:8,borderRadius:4,background:i===step?C.gold:C.dimmed,transition:"all 0.3s"}}/>)}
      </div>
      <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"20px 28px 40px",textAlign:"center"}}>
        {step===0&&<>
          <div style={{fontSize:72,marginBottom:16}}>🎉</div>
          <div style={{color:C.gold,fontWeight:800,fontSize:26,marginBottom:10}}>Bienvenue !</div>
          <div style={{color:C.muted,fontSize:15,lineHeight:1.65,marginBottom:40,maxWidth:280}}>Tu rejoins l'association Waschmachine Volleyball Club. Configure ton profil pour que tes coéquipiers te reconnaissent.</div>
          <button onClick={()=>setStep(1)} style={{width:"100%",padding:16,borderRadius:14,border:"none",background:C.gold,color:C.navy,fontWeight:800,fontSize:16,cursor:"pointer",fontFamily:"inherit"}}>Configurer mon profil →</button>
        </>}
        {step===1&&<div style={{width:"100%",display:"flex",flexDirection:"column",alignItems:"center"}}>
          <div style={{color:C.text,fontWeight:800,fontSize:22,marginBottom:24}}>Mon profil</div>
          <div style={{position:"relative",marginBottom:24,cursor:"pointer"}} onClick={()=>picRef.current&&picRef.current.click()}>
            <div style={{width:90,height:90,borderRadius:"50%",border:`3px solid ${C.gold}`,overflow:"hidden",display:"flex",alignItems:"center",justifyContent:"center"}}>
              {avatar?<img src={avatar} style={{width:"100%",height:"100%",objectFit:"cover"}}/>:<div style={{width:"100%",height:"100%",background:`linear-gradient(135deg,${C.gold},${C.cyan})`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:36,fontWeight:800,color:C.navy}}>{dName[0]||"?"}</div>}
            </div>
            <div style={{position:"absolute",bottom:0,right:0,width:28,height:28,background:C.gold,borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,border:`2px solid ${C.bg}`}}>📷</div>
          </div>
          <input ref={picRef} type="file" accept="image/*" onChange={handleAvatar} style={{display:"none"}}/>
          <div style={{width:"100%",marginBottom:20}}>
            <div style={{color:C.muted,fontSize:12,marginBottom:6,textAlign:"left"}}>Prénom / Pseudo</div>
            <input value={dName} onChange={e=>setDName(e.target.value)} placeholder="Comment tu t'appelles ?" style={IS({fontSize:16,textAlign:"center"})}/>
          </div>
          <button onClick={()=>{if(dName.trim())setStep(2);}} style={{width:"100%",padding:16,borderRadius:14,border:"none",background:dName.trim()?C.gold:C.dimmed,color:dName.trim()?C.navy:C.muted,fontWeight:800,fontSize:16,cursor:dName.trim()?"pointer":"default",fontFamily:"inherit"}}>Continuer →</button>
        </div>}
        {step===2&&<>
          <div style={{fontSize:72,marginBottom:16}}>🏐</div>
          <div style={{color:C.gold,fontWeight:800,fontSize:26,marginBottom:10}}>C'est parti, {dName.split(" ")[0]} !</div>
          <div style={{color:C.muted,fontSize:15,lineHeight:1.65,marginBottom:40,maxWidth:280}}>Tu fais maintenant partie de Waschmachine. Découvre les tournois, inscris-toi et rejoins le chat !</div>
          <button onClick={onDone} style={{width:"100%",padding:16,borderRadius:14,border:"none",background:C.gold,color:C.navy,fontWeight:800,fontSize:16,cursor:"pointer",fontFamily:"inherit"}}>Voir les tournois 🏆</button>
        </>}
      </div>
    </div>
  );
}
