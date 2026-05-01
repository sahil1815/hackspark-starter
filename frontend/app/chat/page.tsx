"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import { apiFetch, GATEWAY } from "../lib/api";
import Navbar from "../components/Navbar";

interface ChatMessage { role: "user" | "assistant"; content: string; timestamp: string; }
interface Session     { sessionId: string; name: string; lastMessageAt: string; }

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2">
      <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs text-white flex-shrink-0"
           style={{ background: "var(--brand-primary)" }}>AI</div>
      <div className="px-4 py-3 rounded-2xl rounded-bl-sm flex gap-1.5 items-center"
           style={{ background: "var(--brand-surface)", border: "1px solid var(--brand-border)" }}>
        {[0,1,2].map(i => (
          <span key={i} className="typing-dot w-2 h-2 rounded-full"
                style={{ background: "var(--brand-secondary)", display: "inline-block", animationDelay: `${i*0.2}s` }} />
        ))}
      </div>
    </div>
  );
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function ChatPage() {
  const [sessions, setSessions]       = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<string>("");
  const [sessionName, setSessionName] = useState<string>("New Chat");
  const [messages, setMessages]       = useState<ChatMessage[]>([]);
  const [input, setInput]             = useState("");
  const [loading, setLoading]         = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const endRef  = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadSessions = useCallback(async () => {
    try {
      const res  = await apiFetch("/chat/sessions");
      const data = await res.json();
      setSessions(data.sessions ?? []);
    } catch (_) {}
  }, []);

  const loadHistory = useCallback(async (sid: string) => {
    try {
      const res  = await apiFetch(`/chat/${sid}/history`);
      const data = await res.json();
      setMessages(data.messages ?? []);
      setSessionName(data.name ?? "Chat");
    } catch (_) { setMessages([]); }
  }, []);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const selectSession = (sid: string, name: string) => {
    setActiveSession(sid);
    setSessionName(name);
    loadHistory(sid);
    inputRef.current?.focus();
  };

  const newChat = () => {
    const sid = uuidv4();
    setActiveSession(sid);
    setSessionName("New Chat");
    setMessages([]);
    inputRef.current?.focus();
  };

  const deleteSession = async (sid: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await apiFetch(`/chat/${sid}`, { method: "DELETE" });
    if (activeSession === sid) { setActiveSession(""); setMessages([]); }
    loadSessions();
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    if (!activeSession) newChat();

    const sid = activeSession || uuidv4();
    if (!activeSession) setActiveSession(sid);

    const userMsg: ChatMessage = { role: "user", content: input.trim(), timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res  = await fetch(`${GATEWAY}/chat`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ sessionId: sid, message: userMsg.content }),
      });
      const data = await res.json();
      const reply = data.reply ?? data.response ?? "…";
      setMessages(prev => [...prev, { role: "assistant", content: reply, timestamp: new Date().toISOString() }]);
      loadSessions(); 
    } catch {
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "⚠️ Couldn't reach the server. Make sure the API Gateway is running.",
        timestamp: new Date().toISOString(),
      }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--background)" }}>
      <Navbar />

      <div className="flex flex-1 overflow-hidden" style={{ height: "calc(100vh - 64px)" }}>
        {/* Sidebar */}
        <aside className={`flex flex-col transition-all duration-300 ${sidebarOpen ? "w-72" : "w-0"} flex-shrink-0 overflow-hidden`}
               style={{ background: "var(--brand-surface)", borderRight: "1px solid var(--brand-border)" }}>
          <div className="flex items-center justify-between px-4 py-4 border-b flex-shrink-0"
               style={{ borderColor: "var(--brand-border)" }}>
            <span className="font-semibold text-sm" style={{ color: "var(--brand-primary)" }}>Sessions</span>
            <button id="new-chat-btn" onClick={newChat}
              className="text-xs font-semibold px-3 py-1.5 rounded-full transition-all hover:scale-105"
              style={{ background: "var(--brand-secondary)", color: "white" }}>
              + New
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-2 py-2 flex flex-col gap-1">
            {sessions.length === 0 && (
              <p className="text-xs text-center mt-8 px-4" style={{ color: "var(--brand-muted)" }}>
                No sessions yet. Start a new chat!
              </p>
            )}
            {sessions.map(s => (
              <div key={s.sessionId}
                className={`group flex items-start justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all`}
                style={activeSession === s.sessionId
                  ? { background: "var(--brand-light)", border: "1px solid var(--brand-secondary)" }
                  : { border: "1px solid transparent" }}
                onClick={() => selectSession(s.sessionId, s.name)}>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate" style={{ color: "var(--brand-primary)" }}>{s.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--brand-muted)" }}>{timeAgo(s.lastMessageAt)}</p>
                </div>
                <button onClick={e => deleteSession(s.sessionId, e)}
                  className="opacity-0 group-hover:opacity-100 ml-2 text-xs px-1.5 py-1 rounded-lg transition-all hover:scale-110 flex-shrink-0"
                  style={{ color: "#ef4444", background: "#fee2e2" }}>✕</button>
              </div>
            ))}
          </div>
        </aside>

        {/* Chat area */}
        <div className="flex flex-col flex-1 min-w-0">
          {/* Chat header */}
          <div className="flex items-center gap-3 px-5 py-3 border-b flex-shrink-0"
               style={{ borderColor: "var(--brand-border)", background: "var(--brand-surface)" }}>
            <button id="sidebar-toggle" onClick={() => setSidebarOpen(o => !o)}
              className="p-2 rounded-lg transition-colors hover:bg-black/5 dark:hover:bg-white/5 flex-shrink-0"
              style={{ color: "var(--brand-muted)" }}>☰</button>
            <div>
              <p className="font-semibold text-sm" style={{ color: "var(--brand-primary)" }}>{sessionName}</p>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ background: "#10b981" }} />
                <p className="text-xs" style={{ color: "var(--brand-muted)" }}>RentPi AI · Always on</p>
              </div>
            </div>
          </div>

          {/* Messages (ফিক্স করা হয়েছে) */}
          <div className="flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-4" style={{ background: "var(--background)" }}>
            {messages.length === 0 && !loading && (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
                <div className="text-5xl">🤖</div>
                <p className="font-semibold" style={{ color: "var(--brand-primary)" }}>Ask RentPi AI anything</p>
                <p className="text-sm max-w-xs" style={{ color: "var(--brand-muted)" }}>
                  Check product availability, find trending rentals, explore categories and more.
                </p>
                <div className="flex flex-wrap justify-center gap-2 mt-2">
                  {["What's trending today?", "Check product #42 availability", "Which category has most rentals?"].map(q => (
                    <button key={q} onClick={() => { setInput(q); inputRef.current?.focus(); }}
                      className="text-xs px-3 py-1.5 rounded-full border transition-all hover:scale-105"
                      style={{ borderColor: "var(--brand-secondary)", color: "var(--brand-secondary)", background: "var(--brand-light)" }}>
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((msg, i) => {
              const isUser = msg.role === "user";
              return (
                <div key={i} className={`chat-message flex items-end gap-2 ${isUser ? "flex-row-reverse" : ""}`}>
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 text-white"
                       style={{ background: isUser ? "var(--brand-secondary)" : "var(--brand-primary)" }}>
                    {isUser ? "You" : "AI"}
                  </div>
                  {/* AI Message Bubble (ফিক্স করা হয়েছে) */}
                  <div className="max-w-[75%] px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap shadow-sm"
                       style={isUser
                         ? { background: "var(--brand-secondary)", color: "white", borderRadius: "16px 16px 4px 16px" }
                         : { background: "var(--brand-surface)", color: "var(--foreground)", border: "1px solid var(--brand-border)", borderRadius: "16px 16px 16px 4px" }}>
                    {msg.content}
                  </div>
                </div>
              );
            })}
            {loading && <TypingIndicator />}
            <div ref={endRef} />
          </div>

          {/* Input */}
          <div className="px-4 py-3 flex items-center gap-3 border-t"
               style={{ borderColor: "var(--brand-border)", background: "var(--brand-surface)" }}>
            <input ref={inputRef} id="chat-input" type="text" value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }}}
              placeholder="Ask about rentals, availability, trends…"
              disabled={loading}
              className="flex-1 px-4 py-2.5 rounded-full text-sm outline-none"
              style={{ background: "var(--brand-surface-2)", border: "1px solid var(--brand-border)", color: "var(--foreground)" }} />
            <button id="chat-send-btn" onClick={sendMessage}
              disabled={loading || !input.trim()}
              className="w-10 h-10 rounded-full flex items-center justify-center text-white transition-all hover:scale-110 active:scale-95 disabled:opacity-40 disabled:hover:scale-100"
              style={{ background: "linear-gradient(135deg,#1e3a5f,#2563eb)" }}>↑</button>
          </div>
        </div>
      </div>
    </div>
  );
}