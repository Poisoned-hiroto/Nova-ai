"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, BrainCircuit, Check, ChevronDown, FileImage, Menu, Plus, Settings2, Sparkles, Trash2, X, Paperclip } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Message = { role: "user" | "assistant"; content: string; image?: string };
type Chat = { id: string; title: string; messages: Message[]; updatedAt: number };
const DEFAULT_MODEL = "meta-llama/llama-3.3-70b-instruct:free";
const prompts = ["Explain a difficult topic simply", "Help me debug some code", "Build me a learning roadmap", "Compare two ideas objectively"];

async function readApiResponse(response: Response): Promise<any> {
  const body = await response.text();
  try {
    return body ? JSON.parse(body) : {};
  } catch {
    const preview = body.replace(/\\s+/g, " ").slice(0, 180);
    throw new Error(
      `Server returned a non-JSON response (HTTP ${response.status}): ${preview || "empty response"}`
    );
  }
}

export default function Home() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeId, setActiveId] = useState("");
  const [models, setModels] = useState<{id:string;name:string}[]>([]);
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [menu, setMenu] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const active = chats.find(c => c.id === activeId);
  const messages = active?.messages ?? [];

  useEffect(() => {
    try {
      const saved = localStorage.getItem("smarty-chats");
      const parsed: Chat[] = saved ? JSON.parse(saved) : [];
      setChats(parsed);
      if (parsed.length) setActiveId(parsed[0].id);
      else {
        const first = { id: crypto.randomUUID(), title: "New conversation", messages: [], updatedAt: Date.now() };
        setChats([first]); setActiveId(first.id);
      }
    } catch {
      const first = { id: crypto.randomUUID(), title: "New conversation", messages: [], updatedAt: Date.now() };
      setChats([first]); setActiveId(first.id);
    }
    fetch("/api/models").then(r => r.json()).then(d => {
      setConfigured(d.configured);
      if (d.models?.length) { setModels(d.models); setModel(d.models[0].id); }
    }).catch(() => setConfigured(false));
  }, []);
  useEffect(() => { if (chats.length) localStorage.setItem("smarty-chats", JSON.stringify(chats)); }, [chats]);
  useEffect(() => { bottom.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length, busy]);

  function newChat() {
    const chat = { id: crypto.randomUUID(), title: "New conversation", messages: [], updatedAt: Date.now() };
    setChats(prev => [chat, ...prev]); setActiveId(chat.id); setInput(""); setError(""); setMobile(false);
  }
  function saveMessages(next: Message[]) {
    setChats(prev => prev.map(c => c.id === activeId ? {
      ...c, messages: next, title: c.messages.length ? c.title : (next[0]?.content.slice(0, 38) || "New conversation"), updatedAt: Date.now()
    } : c));
  }
  async function send(text = input) {
    if ((!text.trim() && !file) || busy) return;
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
      saveMessages(next); setInput(""); setFile(null);
      let reply = "";
      if (image) {
        setAnalyzing(true);
        const response = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dataUrl: image, prompt: text.trim() || "Describe and analyze this image in detail." }) });
        const data = await readApiResponse(response); if (!response.ok) throw new Error(data.error || "Image analysis failed");
        reply = data.analysis;
      } else {
        const response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model, messages: next.map(m => ({ role: m.role, content: m.content })) }) });
        const data = await readApiResponse(response); if (!response.ok) throw new Error(data.error || "Chat request failed");
        reply = data.reply;
      }
      saveMessages([...next, { role: "assistant", content: reply }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally { setBusy(false); setAnalyzing(false); }
  }
  function deleteChat(id: string) {
    const remaining = chats.filter(c => c.id !== id);
    setChats(remaining);
    if (activeId === id) setActiveId(remaining[0]?.id ?? "");
    if (!remaining.length) localStorage.removeItem("smarty-chats");
  }

  return <main className="shell">
    <aside className={"sidebar " + (mobile ? "open" : "")}>
      <div className="brand"><div className="brand-icon"><BrainCircuit size={21}/></div><span>smarty<span className="brand-ai">.ai</span></span><button className="mobile-close" onClick={() => setMobile(false)}><X size={18}/></button></div>
      <button className="new-chat" onClick={newChat}><Plus size={17}/> New chat <span>⌘ K</span></button>
      <div className="section-label">YOUR WORKSPACE</div>
      <div className="history">{chats.map(c => <div className={"history-row " + (c.id === activeId ? "active" : "")} key={c.id}>
        <button className="history-title" onClick={() => {setActiveId(c.id);setMobile(false);}}><span className="history-dot"/>{c.title}</button>
        <button className="delete" aria-label="Delete chat" onClick={() => deleteChat(c.id)}><Trash2 size={14}/></button>
      </div>)}</div>
      <div className="side-bottom"><div className="workspace-card"><Sparkles size={17}/><div><b>SMARTY workspace</b><small>Multi-model AI studio</small></div></div><div className="local-status"><span/> History saved on this device</div></div>
    </aside>
    {mobile && <button className="scrim" onClick={() => setMobile(false)} aria-label="Close sidebar"/>}
    <section className="main">
      <header className="topbar"><div className="top-left"><button className="menu-btn" onClick={() => setMobile(true)}><Menu size={19}/></button><span>Workspace <i>/</i> Chat</span></div><div className="top-right"><span className={"provider " + (configured ? "connected" : "")}><b/> {configured ? "Provider connected" : "Setup required"}</span><button className="settings" title="Settings"><Settings2 size={18}/></button></div></header>
      <section className="conversation">
        {messages.length === 0 ? <div className="welcome"><div className="hero-icon"><BrainCircuit size={31}/><span/></div><div className="eyebrow">✦ &nbsp; YOUR AI WORKSPACE</div><h1>One workspace.<br/><em>Many minds.</em></h1><p>Think bigger, build faster, and get sharper answers.<br/>Choose a model and get to work.</p><div className="prompt-grid">{prompts.map((p,i) => <button key={p} onClick={() => send(p)}><span>{["✳","⌘","↗","◈"][i]}</span>{p}<ArrowUp size={14}/></button>)}</div><div className="tagline"><Sparkles size={13}/> Your ideas deserve more than one perspective.</div></div> : <div className="messages">{messages.map((m,i) => <article className={"message " + m.role} key={i}><div className="avatar">{m.role === "assistant" ? <BrainCircuit size={17}/> : "Y"}</div><div className="message-content"><div className="message-label">{m.role === "assistant" ? "SMARTY AI" : "YOU"}{m.role === "assistant" && <small>{model.split("/").pop()}</small>}</div>{m.image && <img className="uploaded-image" src={m.image} alt="Uploaded image"/>}<div className="markdown"><ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown></div></div></article>)}</div>}
        {busy && <article className="message assistant"><div className="avatar"><BrainCircuit size={17}/></div><div className="message-content"><div className="message-label">SMARTY AI</div><div className="thinking"><span/><span/><span/>{analyzing ? "Analyzing image…" : "Thinking…"}</div></div></article>}
        {error && <div className="error"><span>{error}</span><button onClick={() => setError("")}><X size={15}/></button></div>}
        <div ref={bottom}/>
      </section>
      <footer className="composer-area"><div className="composer"><div className="composer-head"><div className="model-wrap"><button className="model-button" onClick={() => setMenu(!menu)}><span>✳</span>{models.find(m => m.id === model)?.name ?? model.split("/").pop()}<ChevronDown size={14}/></button>{menu && <div className="model-menu">{(models.length ? models : [{id:DEFAULT_MODEL,name:"Llama 3.3 70B (Free)"}]).map(m => <button key={m.id} onClick={() => {setModel(m.id);setMenu(false);}}>{m.name}{model === m.id && <Check size={14}/>}</button>)}</div>}</div><small>AI can make mistakes. Verify important information.</small></div>
        {file && <div className="file-chip"><FileImage size={15}/>{file.name}<button onClick={() => setFile(null)}><X size={14}/></button></div>}
        <textarea value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => {if (e.key === "Enter" && !e.shiftKey) {e.preventDefault();send();}}} placeholder="Message SMARTY AI…" rows={2}/>
        <div className="composer-foot"><div className="attach-area"><button onClick={() => fileInput.current?.click()}><Paperclip size={16}/> Attach</button><input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={e => setFile(e.target.files?.[0] ?? null)}/><small>Images · PNG, JPG, WEBP</small></div><button className="send" disabled={busy || (!input.trim() && !file)} onClick={() => send()}>{busy ? "…" : <ArrowUp size={18}/>}</button></div></div><div className="mobile-disclaimer">SMARTY AI may produce inaccurate information.</div></footer>
    </section>
  </main>;
}
