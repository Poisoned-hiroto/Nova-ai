"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, BrainCircuit, Check, ChevronDown, FileImage, Menu, Plus, Search, Sparkles, Trash2, X, Paperclip, LogOut, GitCompareArrows, Globe2, UserRound } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { getSupabase } from "@/lib/supabase";
import type { Session, SupabaseClient } from "@supabase/supabase-js";

type Comparison = { requestedModel: string; model?: string; reply?: string; ok: boolean; error?: string };
type Source = { title: string; url: string };
type Message = { role: "user" | "assistant"; content: string; image?: string; sources?: Source[]; comparison?: Comparison[] };
type Chat = { id: string; title: string; messages: Message[]; updatedAt: number };
const DEFAULT_MODEL = "meta-llama/llama-3.3-70b-instruct:free";
const prompts = ["Explain a difficult topic simply", "Help me debug some code", "Build me a learning roadmap", "Compare two ideas objectively"];

async function readApiResponse(response: Response): Promise<any> {
  const body = await response.text();
  try { return body ? JSON.parse(body) : {}; }
  catch {
    const preview = body.replace(/\\s+/g, " ").slice(0, 180);
    throw new Error(`Server returned a non-JSON response (HTTP ${response.status}): ${preview || "empty response"}`);
  }
}

export default function Home() {
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authNotice, setAuthNotice] = useState("");
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeId, setActiveId] = useState("");
  const [models, setModels] = useState<{id:string;name:string}[]>([]);
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [compareModel, setCompareModel] = useState("");
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [menu, setMenu] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [compareEnabled, setCompareEnabled] = useState(false);
  const [webSearch, setWebSearch] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const active = chats.find(c => c.id === activeId);
  const messages = active?.messages ?? [];

  useEffect(() => {
    const client = getSupabase();
    setSupabase(client);
    if (!client) { setAuthReady(true); return; }
    client.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    }).catch(() => setAuthReady(true));
    const { data: listener } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session || !supabase) { setChats([]); setActiveId(""); return; }
    let cancelled = false;
    async function load() {
      const { data, error: loadError } = await supabase!.from("chats").select("id,title,messages,updated_at").order("updated_at", { ascending: false }).limit(100);
      if (cancelled) return;
      if (loadError) { setError("Cloud history could not load: " + loadError.message); return; }
      const loaded: Chat[] = (data ?? []).map((row: any) => ({
        id: row.id, title: row.title, messages: Array.isArray(row.messages) ? row.messages : [],
        updatedAt: new Date(row.updated_at).getTime(),
      }));
      if (!cancelled) {
        if (loaded.length) { setChats(loaded); setActiveId(loaded[0].id); }
        else { const first = { id: crypto.randomUUID(), title: "New conversation", messages: [], updatedAt: Date.now() }; setChats([first]); setActiveId(first.id); }
      }
    }
    load();
    return () => { cancelled = true; };
  }, [session?.user.id, supabase]);

  useEffect(() => {
    if (!session) return;
    fetch("/api/models").then(r => r.json()).then(d => {
      setConfigured(d.configured);
      if (d.models?.length) {
        setModels(d.models);
        setModel((current: string) => d.models.some((m: any) => m.id === current) ? current : d.models[0].id);
        setCompareModel((current: string) => current || d.models.find((m: any) => m.id !== model)?.id || "");
      }
    }).catch(() => setConfigured(false));
  }, [session?.user.id]);

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length, busy]);

  async function authSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return;
    setAuthBusy(true); setAuthError(""); setAuthNotice("");
    try {
      if (authMode === "signup") {
        const { data, error: signError } = await supabase.auth.signUp({ email: email.trim(), password });
        if (signError) throw signError;
        if (!data.session) setAuthNotice("Account created. Check your email to confirm it, then sign in.");
        else setAuthNotice("Account created. You're signed in.");
      } else {
        const { error: signError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (signError) throw signError;
      }
    } catch (e) { setAuthError(e instanceof Error ? e.message : "Authentication failed."); }
    finally { setAuthBusy(false); }
  }

  async function authHeaders() {
    const { data } = await supabase!.auth.getSession();
    if (!data.session?.access_token) throw new Error("Your session expired. Please sign in again.");
    return { "Content-Type": "application/json", Authorization: "Bearer " + data.session.access_token };
  }

  function newChat() {
    const chat = { id: crypto.randomUUID(), title: "New conversation", messages: [], updatedAt: Date.now() };
    setChats(prev => [chat, ...prev]); setActiveId(chat.id); setInput(""); setError(""); setMobile(false);
  }

  async function saveMessages(next: Message[]) {
    if (!session || !supabase) return;
    const current = chats.find(c => c.id === activeId);
    const title = current?.messages.length ? current.title : (next[0]?.content.slice(0, 38) || "New conversation");
    const updatedAt = Date.now();
    const chat: Chat = { id: activeId, title, messages: next, updatedAt };
    setChats(prev => prev.map(c => c.id === activeId ? chat : c));
    const { error: saveError } = await supabase.from("chats").upsert({
      id: chat.id, user_id: session.user.id, title: chat.title, messages: chat.messages,
      updated_at: new Date(updatedAt).toISOString(),
    });
    if (saveError) setError("Cloud save failed: " + saveError.message);
  }

  async function send(text = input) {
    if ((!text.trim() && !file) || busy || !session || !supabase) return;
    setError(""); setBusy(true);
    try {
      let image: string | undefined;
      if (file) {
        if (!file.type.startsWith("image/")) throw new Error("Only image uploads are enabled in this version.");
        image = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file);
        });
      }
      const userMessage: Message = { role: "user", content: text.trim() || (image ? "Analyze this image." : ""), image };
      const next = [...messages, userMessage];
      setInput(""); setFile(null);
      if (image) {
        setAnalyzing(true);
        const response = await fetch("/api/analyze", { method: "POST", headers: await authHeaders(), body: JSON.stringify({ dataUrl: image, prompt: text.trim() || "Describe and analyze this image in detail." }) });
        const data = await readApiResponse(response);
        if (!response.ok) throw new Error(data.error || "Image analysis failed");
        await saveMessages([...next, { role: "assistant", content: data.analysis }]);
      } else if (compareEnabled) {
        if (!compareModel || compareModel === model) throw new Error("Choose a second model different from the primary model.");
        const response = await fetch("/api/compare", {
          method: "POST", headers: await authHeaders(),
          body: JSON.stringify({
            modelA: model, modelB: compareModel, prompt: text.trim(),
            messages: next.map(m => ({ role: m.role, content: m.content })),
            webSearch,
          }),
        });
        const data = await readApiResponse(response);
        if (!response.ok) throw new Error(data.error || "Comparison failed");
        const results: Comparison[] = data.results ?? [];
        await saveMessages([...next, { role: "assistant", content: "Two-model comparison", comparison: results }]);
      } else {
        const response = await fetch("/api/chat", {
          method: "POST", headers: await authHeaders(),
          body: JSON.stringify({ model, messages: next.map(m => ({ role: m.role, content: m.content })), webSearch }),
        });
        const data = await readApiResponse(response);
        if (!response.ok) throw new Error(data.error || "Chat request failed");
        await saveMessages([...next, { role: "assistant", content: data.reply, sources: data.sources ?? [] }]);
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Something went wrong."); }
    finally { setBusy(false); setAnalyzing(false); }
  }

  async function deleteChat(id: string) {
    const remaining = chats.filter(c => c.id !== id);
    setChats(remaining);
    if (activeId === id) setActiveId(remaining[0]?.id ?? "");
    if (supabase) await supabase.from("chats").delete().eq("id", id);
  }

  if (!authReady) return <main className="auth-screen"><div className="auth-card"><BrainCircuit size={32}/><h1>SMARTY AI</h1><p>Loading your secure workspace…</p></div></main>;

  if (!supabase || !session) return <main className="auth-screen">
    <form className="auth-card" onSubmit={authSubmit}>
      <div className="auth-logo"><BrainCircuit size={26}/></div>
      <div className="eyebrow">YOUR PERSONAL AI WORKSPACE</div>
      <h1>{!supabase ? "Connect your workspace" : authMode === "signin" ? "Welcome back." : "Create your account."}</h1>
      <p>{!supabase ? "Add your Supabase project URL and publishable/anon key to Vercel to enable secure account login." : "Sign in to access your conversations across devices."}</p>
      {!supabase ? <div className="auth-setup">Required Vercel variables: <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code></div> : <>
        <label>Email address<input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required autoComplete="email"/></label>
        <label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" minLength={8} required autoComplete={authMode === "signin" ? "current-password" : "new-password"}/></label>
        {authError && <div className="auth-error">{authError}</div>}
        {authNotice && <div className="auth-notice">{authNotice}</div>}
        <button className="auth-submit" disabled={authBusy}>{authBusy ? "Please wait…" : authMode === "signin" ? "Sign in" : "Create account"}</button>
        <button type="button" className="auth-switch" onClick={() => {setAuthMode(authMode === "signin" ? "signup" : "signin");setAuthError("");setAuthNotice("");}}>
          {authMode === "signin" ? "New to SMARTY AI? Create an account" : "Already have an account? Sign in"}
        </button>
      </>}
    </form>
  </main>;

  return <main className="shell">
    <aside className={"sidebar " + (mobile ? "open" : "")}>
      <div className="brand"><div className="brand-icon"><BrainCircuit size={21}/></div><span>smarty<span className="brand-ai">.ai</span></span><button className="mobile-close" onClick={() => setMobile(false)}><X size={18}/></button></div>
      <button className="new-chat" onClick={newChat}><Plus size={17}/> New chat <span>⌘ K</span></button>
      <div className="section-label">YOUR WORKSPACE</div>
      <div className="history">{chats.map(c => <div className={"history-row " + (c.id === activeId ? "active" : "")} key={c.id}>
        <button className="history-title" onClick={() => {setActiveId(c.id);setMobile(false);}}><span className="history-dot"/>{c.title}</button>
        <button className="delete" aria-label="Delete chat" onClick={() => deleteChat(c.id)}><Trash2 size={14}/></button>
      </div>)}</div>
      <div className="side-bottom"><div className="workspace-card"><Sparkles size={17}/><div><b>SMARTY workspace</b><small>Cloud-synced account</small></div></div>
        <div className="account-row"><UserRound size={14}/><span>{session.user.email}</span><button onClick={() => supabase.auth.signOut()} title="Sign out"><LogOut size={14}/></button></div>
      </div>
    </aside>
    {mobile && <button className="scrim" onClick={() => setMobile(false)} aria-label="Close sidebar"/>}
    <section className="main">
      <header className="topbar"><div className="top-left"><button className="menu-btn" onClick={() => setMobile(true)}><Menu size={19}/></button><span>Workspace <i>/</i> Chat</span></div><div className="top-right"><span className={"provider " + (configured ? "connected" : "")}><b/> {configured ? "Provider connected" : "Setup required"}</span></div></header>
      <section className="conversation">
        {messages.length === 0 ? <div className="welcome"><div className="hero-icon"><BrainCircuit size={31}/><span/></div><div className="eyebrow">✦ &nbsp; YOUR AI WORKSPACE</div><h1>One workspace.<br/><em>Many minds.</em></h1><p>Think bigger, build faster, and get sharper answers.<br/>Choose a model and get to work.</p><div className="prompt-grid">{prompts.map((p,i) => <button key={p} onClick={() => send(p)}><span>{["✳","⌘","↗","◈"][i]}</span>{p}<ArrowUp size={14}/></button>)}</div><div className="tagline"><Sparkles size={13}/> Your ideas deserve more than one perspective.</div></div> : <div className="messages">{messages.map((m,i) => <article className={"message " + m.role} key={i}>
          <div className="avatar">{m.role === "assistant" ? <BrainCircuit size={17}/> : "Y"}</div><div className="message-content"><div className="message-label">{m.role === "assistant" ? "SMARTY AI" : "YOU"}{m.role === "assistant" && <small>{m.comparison ? "COMPARISON" : model.split("/").pop()}</small>}</div>
          {m.image && <img className="uploaded-image" src={m.image} alt="Uploaded image"/>}
          {m.comparison ? <div className="comparison-grid">{m.comparison.map((result,j) => <section className="comparison-card" key={result.requestedModel}><div className="comparison-heading"><b>{result.requestedModel.split("/").pop()}</b><span>{result.ok ? "Response" : "Unavailable"}</span></div>{result.ok ? <div className="markdown"><ReactMarkdown remarkPlugins={[remarkGfm]}>{result.reply ?? ""}</ReactMarkdown></div> : <p className="comparison-error">{result.error}</p>}</section>)}</div> : <div className="markdown"><ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown></div>}
          {m.sources?.length ? <div className="source-list"><b>Sources</b>{m.sources.map(source => <a href={source.url} target="_blank" rel="noreferrer" key={source.url}>{source.title}</a>)}</div> : null}
        </div></article>)}</div>}
        {busy && <article className="message assistant"><div className="avatar"><BrainCircuit size={17}/></div><div className="message-content"><div className="message-label">SMARTY AI</div><div className="thinking"><span/><span/><span/>{analyzing ? "Analyzing image…" : compareEnabled ? "Comparing two models…" : webSearch ? "Searching the web and thinking…" : "Thinking…"}</div></div></article>}
        {error && <div className="error"><span>{error}</span><button onClick={() => setError("")}><X size={15}/></button></div>}
        <div ref={bottom}/>
      </section>
      <footer className="composer-area"><div className="composer">
        <div className="composer-head"><div className="model-wrap"><button className="model-button" onClick={() => setMenu(!menu)}><span>✳</span>{models.find(m => m.id === model)?.name ?? model.split("/").pop()}<ChevronDown size={14}/></button>{menu && <div className="model-menu">{(models.length ? models : [{id:DEFAULT_MODEL,name:"Llama 3.3 70B (Free)"}]).map(m => <button key={m.id} onClick={() => {setModel(m.id);setMenu(false);}}>{m.name}{model === m.id && <Check size={14}/>}</button>)}</div>}</div><small>AI can make mistakes. Verify important information.</small></div>
        <div className="feature-toggles">
          <button className={"feature-toggle " + (compareEnabled ? "enabled" : "")} onClick={() => {setCompareEnabled(v => !v);setWebSearch(false);}} aria-pressed={compareEnabled}><GitCompareArrows size={14}/> Compare <span>{compareEnabled ? "ON" : "OFF"}</span></button>
          <button className={"feature-toggle " + (webSearch ? "enabled" : "")} onClick={() => {setWebSearch(v => !v);setCompareEnabled(false);}} aria-pressed={webSearch}><Globe2 size={14}/> Web search <span>{webSearch ? "ON" : "OFF"}</span></button>
        </div>
        {compareEnabled && <div className="compare-select"><span>Compare against</span><select value={compareModel} onChange={e => setCompareModel(e.target.value)}><option value="">Choose second model</option>{models.filter(m => m.id !== model).map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select><small>Only 2 models run, and only when comparison is ON.</small></div>}
        {webSearch && <div className="search-note"><Search size={13}/> Web search can add provider search charges. It stays OFF unless you enable it.</div>}
        {file && <div className="file-chip"><FileImage size={15}/>{file.name}<button onClick={() => setFile(null)}><X size={14}/></button></div>}
        <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => {if (e.key === "Enter" && !e.shiftKey) {e.preventDefault();send();}}} placeholder="Message SMARTY AI…" rows={2}/>
        <div className="composer-foot"><div className="attach-area"><button onClick={() => fileInput.current?.click()}><Paperclip size={16}/> Attach</button><input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={e => setFile(e.target.files?.[0] ?? null)}/><small>Images · PNG, JPG, WEBP</small></div><button className="send" disabled={busy || (!input.trim() && !file)} onClick={() => send()}>{busy ? "…" : <ArrowUp size={18}/>}</button></div>
      </div><div className="mobile-disclaimer">SMARTY AI may produce inaccurate information.</div></footer>
    </section>
  </main>;
}
