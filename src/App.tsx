import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, Route, Routes, useNavigate } from "react-router-dom";
import { Bot, Check, ChevronRight, Code2, Cpu, Database, FileWarning, KeyRound, LayoutDashboard, Menu, MessageSquare, PackageSearch, Server, ShieldCheck, Sparkles, Terminal, X, Zap } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { apiFetch, getSubscription, supabase, type Subscription } from "./lib";

const tools = [
  ["Server Doctor", "Analyze logs and find likely causes.", FileWarning],
  ["Plugin Finder", "Find plugins for your server setup.", PackageSearch],
  ["Config Generator", "Generate clean YAML/properties snippets.", Code2],
  ["Rank Builder", "Plan ranks, prefixes and permissions.", ShieldCheck],
  ["Command Helper", "Turn what you want into commands.", Terminal],
  ["Compatibility Checker", "Check versions, Java and plugin conflicts.", Cpu],
  ["Server Builder", "Build a recommended server stack.", Server],
  ["MOTD Generator", "Create a clean server MOTD.", Sparkles]
] as const;

function Layout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const nav = [
    ["/", "Home"], ["/assistant", "Assistant"], ["/tools", "Tools"], ["/pricing", "Pricing"], ["/activate", "Activate"]
  ];
  return <div className="app-shell">
    <header className="topbar">
      <Link className="brand" to="/"><span className="brand-mark">MSA</span><span>Minecraft Server Assistant</span></Link>
      <button className="mobile-menu" onClick={() => setOpen(!open)}>{open ? <X/>:<Menu/>}</button>
      <nav className={open ? "nav open":"nav"}>{nav.map(([href,label]) => <NavLink key={href} onClick={()=>setOpen(false)} className={({isActive})=>isActive?"active":""} to={href}>{label}</NavLink>)}<Link className="nav-cta" to="/dashboard">Dashboard</Link></nav>
    </header>
    {children}
    <footer className="footer"><div><b>MSA</b> — Minecraft Server Assistant</div><div>AI tools for Minecraft server owners.</div></footer>
  </div>
}

function Home() {
  return <main>
    <section className="hero container">
      <div className="eyebrow"><Sparkles size={15}/> Minecraft server AI assistant</div>
      <h1>Your Minecraft server,<br/><span>with an expert beside it.</span></h1>
      <p className="hero-copy">Diagnose errors, plan plugins, generate configurations and get practical server help from one focused AI assistant.</p>
      <div className="hero-actions"><Link className="button primary" to="/activate">Activate access <ChevronRight size={17}/></Link><Link className="button ghost" to="/assistant">Open assistant</Link></div>
      <div className="trust-row"><span><ShieldCheck size={16}/> Secure server-side AI</span><span><Zap size={16}/> Fast answers</span><span><Server size={16}/> Java + Bedrock</span></div>
    </section>
    <section className="container section">
      <div className="section-head"><div><div className="eyebrow">What it does</div><h2>Built for actual server problems.</h2></div><p>Not a generic chatbot. Give it your Minecraft version, server software, plugins and error, and it can reason around that context.</p></div>
      <div className="tool-grid">{tools.slice(0,6).map(([title,desc,Icon])=><div className="tool-card" key={title}><div className="icon-box"><Icon size={20}/></div><h3>{title}</h3><p>{desc}</p></div>)}</div>
    </section>
    <section className="container section split">
      <div><div className="eyebrow">How access works</div><h2>One code. One activation.</h2><p>Your payment is handled manually through Discord. After you receive a subscription code, activate it once and keep using the site while the subscription is active.</p></div>
      <div className="steps">{["Get your code after manual payment.","Activate it once on MSA.","Use the assistant until expiry."].map((x,i)=><div className="step" key={x}><b>0{i+1}</b><span>{x}</span></div>)}</div>
    </section>
  </main>
}

function Activate() {
  const [code,setCode]=useState(""); const [loading,setLoading]=useState(false); const [msg,setMsg]=useState(""); const [ok,setOk]=useState(false); const nav=useNavigate();
  async function activate(e:React.FormEvent){e.preventDefault();setLoading(true);setMsg("");try{await apiFetch("activate-subscription",{code:code.trim()});setOk(true);setMsg("Subscription activated. Redirecting…");setTimeout(()=>nav("/dashboard"),700)}catch(e){setMsg(e instanceof Error?e.message:"Activation failed")}finally{setLoading(false)}}
  return <main className="container narrow page"><div className="panel center"><div className="icon-box big"><KeyRound/></div><div className="eyebrow">Subscription</div><h1>Activate your access</h1><p>Enter the code you received after your manual purchase.</p><form onSubmit={activate} className="form"><input value={code} onChange={e=>setCode(e.target.value.toUpperCase())} placeholder="MSA-XXXX-XXXX" autoComplete="off"/><button className="button primary" disabled={loading || code.length<8}>{loading?"Activating…":"Activate code"}</button></form>{msg&&<div className={ok?"notice success":"notice error"}>{msg}</div>}</div></main>
}

function Assistant() {
  const [messages,setMessages]=useState<{role:"user"|"assistant";content:string}[]>([]);
  const [input,setInput]=useState(""); const [loading,setLoading]=useState(false);
  const [context,setContext]=useState({minecraft:"1.21.1",software:"Paper",java:"21",plugins:""});
  async function send(e?:React.FormEvent){e?.preventDefault(); if(!input.trim()||loading)return; const user=input.trim();setInput("");setMessages(m=>[...m,{role:"user",content:user}]);setLoading(true);try{const data=await apiFetch("ai-chat",{action:"chat",message:user,context,history:messages.slice(-12)});setMessages(m=>[...m,{role:"assistant",content:data.text}]);}catch(e){setMessages(m=>[...m,{role:"assistant",content:`**Error:** ${e instanceof Error?e.message:"Request failed"}`}]);}finally{setLoading(false)}}
  return <main className="container page assistant-page">
    <div className="assistant-head"><div><div className="eyebrow"><Bot size={15}/> AI assistant</div><h1>Ask anything about your server.</h1><p>Give the assistant enough context to make the answer useful.</p></div><button className="button ghost" onClick={()=>setMessages([])}>New chat</button></div>
    <div className="context-bar"><label>MC <input value={context.minecraft} onChange={e=>setContext({...context,minecraft:e.target.value})}/></label><label>Software <input value={context.software} onChange={e=>setContext({...context,software:e.target.value})}/></label><label>Java <input value={context.java} onChange={e=>setContext({...context,java:e.target.value})}/></label><label className="wide">Plugins <input value={context.plugins} onChange={e=>setContext({...context,plugins:e.target.value})}/></label></div>
    <div className="chat"><div className="messages">{messages.length===0&&<div className="empty-chat"><Bot size={28}/><h3>Ready when you are.</h3><p>Try: “Geyser works but Bedrock players cannot join my Paper server.”</p></div>}{messages.map((m,i)=><div className={`message ${m.role}`} key={i}><div className="message-role">{m.role==="user"?"You":"MSA"}</div><div className="message-body"><ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown></div></div>)}{loading&&<div className="message assistant"><div className="message-role">MSA</div><div className="typing">Thinking<span>.</span><span>.</span><span>.</span></div></div>}</div>
      <form className="composer" onSubmit={send}><textarea value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send()}}} placeholder="Describe your Minecraft server problem…"/><button className="send" disabled={!input.trim()||loading}><MessageSquare size={18}/></button></form>
    </div>
  </main>
}

function Tools() {
  return <main className="container page"><div className="eyebrow">Toolkit</div><h1>Minecraft server tools.</h1><p className="page-lead">Each tool uses the same Minecraft-focused AI foundation. Start with the assistant if you are not sure which tool you need.</p><div className="tool-grid large">{tools.map(([title,desc,Icon])=><Link to="/assistant" className="tool-card" key={title}><div className="icon-box"><Icon size={20}/></div><h3>{title}</h3><p>{desc}</p><span className="tool-link">Open with AI <ChevronRight size={15}/></span></Link>)}</div></main>
}

function Pricing(){return <main className="container page"><div className="eyebrow">Access</div><h1>Simple subscription access.</h1><p className="page-lead">Purchase is handled manually through Discord. You receive a code, activate it once, and use MSA until the subscription expires.</p><div className="price-grid">{[["7 Days","Short access"],["30 Days","Most useful for active servers"],["90 Days","Longer access"]].map(([name,desc],i)=><div className={`price-card ${i===1?"featured":""}`} key={name}>{i===1&&<span className="popular">POPULAR</span>}<h2>{name}</h2><p>{desc}</p><div className="price-note">Price set manually</div><ul><li><Check/> AI assistant</li><li><Check/> Server tools</li><li><Check/> Secure activation</li></ul><Link className="button primary full" to="/activate">I have a code</Link></div>)}</div></main>}

function Dashboard(){const [sub,setSub]=useState<Subscription|null>(null); const [loading,setLoading]=useState(true); useEffect(()=>{getSubscription().then(setSub).finally(()=>setLoading(false))},[]); return <main className="container page"><div className="eyebrow"><LayoutDashboard size={15}/> Dashboard</div><h1>Your access.</h1>{loading?<div className="panel">Checking subscription…</div>:!sub?<div className="panel"><h2>No active subscription</h2><p>Activate the code you received to unlock the assistant.</p><Link className="button primary" to="/activate">Activate code</Link></div>:<div className="dash-grid"><div className="stat"><span>Status</span><strong className={sub.status==="active"?"green":""}>{sub.status}</strong></div><div className="stat"><span>Plan</span><strong>{sub.plan}</strong></div><div className="stat"><span>Expires</span><strong>{new Date(sub.expires_at).toLocaleDateString()}</strong></div><div className="panel wide-panel"><h2>Ready to troubleshoot?</h2><p>Open the AI assistant and give it your server context.</p><Link className="button primary" to="/assistant">Open Assistant <ChevronRight size={17}/></Link></div></div>}</main>}

function Admin(){const [email,setEmail]=useState("");const [password,setPassword]=useState("");const [session,setSession]=useState(false);const [codes,setCodes]=useState<any[]>([]);const [duration,setDuration]=useState(30);const [plan,setPlan]=useState("30 Days");const [created,setCreated]=useState(""); const [err,setErr]=useState("");
  async function login(e:React.FormEvent){e.preventDefault();setErr("");const {error}=await supabase.auth.signInWithPassword({email,password});if(error)setErr(error.message);else{setSession(true);load()}}
  async function load(){try{const d=await apiFetch("admin-subscriptions",{action:"list"});setCodes(d.subscriptions||[])}catch(e){setErr(e instanceof Error?e.message:"Admin request failed")}}
  async function create(){try{const d=await apiFetch("admin-subscriptions",{action:"create",plan,duration_days:duration});setCreated(d.code);load()}catch(e){setErr(e instanceof Error?e.message:"Create failed")}}
  async function revoke(id:string){try{await apiFetch("admin-subscriptions",{action:"revoke",id});load()}catch(e){setErr(e instanceof Error?e.message:"Revoke failed")}}
  if(!session)return <main className="container narrow page"><div className="panel"><div className="eyebrow">Admin</div><h1>Admin sign in</h1><form className="form" onSubmit={login}><input value={email} onChange={e=>setEmail(e.target.value)} type="email" placeholder="Admin email"/><input value={password} onChange={e=>setPassword(e.target.value)} type="password" placeholder="Password"/><button className="button primary">Sign in</button></form>{err&&<div className="notice error">{err}</div>}</div></main>
  return <main className="container page"><div className="admin-head"><div><div className="eyebrow">Admin</div><h1>Subscriptions</h1></div><button className="button ghost" onClick={async()=>{await supabase.auth.signOut();setSession(false)}}>Sign out</button></div><div className="admin-grid"><div className="panel"><h2>Create code</h2><div className="form"><input value={plan} onChange={e=>setPlan(e.target.value)} placeholder="Plan name"/><input value={duration} onChange={e=>setDuration(Number(e.target.value))} type="number" min="1" placeholder="Days"/><button className="button primary" onClick={create}>Generate code</button>{created&&<div className="code-result"><b>{created}</b><button onClick={()=>navigator.clipboard.writeText(created)}>Copy</button></div>}</div></div><div className="panel"><h2>Codes</h2>{err&&<div className="notice error">{err}</div>}<div className="table-wrap"><table><thead><tr><th>Code</th><th>Plan</th><th>Status</th><th>Expires</th><th></th></tr></thead><tbody>{codes.map(c=><tr key={c.id}><td>{c.code}</td><td>{c.plan}</td><td>{c.status}</td><td>{c.expires_at?new Date(c.expires_at).toLocaleDateString():"—"}</td><td>{c.status!=="revoked"&&<button className="text-button" onClick={()=>revoke(c.id)}>Revoke</button>}</td></tr>)}</tbody></table></div></div></div></main>
}

export default function App(){return <Layout><Routes><Route path="/" element={<Home/>}/><Route path="/assistant" element={<Assistant/>}/><Route path="/tools" element={<Tools/>}/><Route path="/pricing" element={<Pricing/>}/><Route path="/activate" element={<Activate/>}/><Route path="/dashboard" element={<Dashboard/>}/><Route path="/admin" element={<Admin/>}/></Routes></Layout>}
