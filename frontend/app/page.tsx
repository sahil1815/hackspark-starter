"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Navbar from "./components/Navbar";

// ─── Types ──────────────────────────────────────────────────────────────────
interface Message {
  role: "user" | "model";
  text: string;
  ts: number;
}

interface Product {
  id: number;
  name: string;
  category: string;
  pricePerDay: number;
  available: boolean;
  rating: number;
  reviews: number;
  image: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────
const SESSION_ID = "789";
const CHAT_API = "http://localhost:8000/chat";

const SAMPLE_PRODUCTS: Product[] = [
  { id: 42, name: "Canon EOS R5 Camera", category: "Photography", pricePerDay: 85, available: true, rating: 4.9, reviews: 128, image: "📷" },
  { id: 17, name: "DJI Mavic 3 Pro Drone", category: "Aerial", pricePerDay: 120, available: false, rating: 4.7, reviews: 94, image: "🚁" },
  { id: 8,  name: "Sony A7 IV Mirrorless", category: "Photography", pricePerDay: 70, available: true, rating: 4.8, reviews: 76, image: "📸" },
  { id: 31, name: "GoPro Hero 12 Black", category: "Action Cam", pricePerDay: 35, available: true, rating: 4.6, reviews: 210, image: "🎥" },
];

const STATS = [
  { label: "Active Rentals", value: "2,847", icon: "📦", delta: "+12%" },
  { label: "Products Listed", value: "1,200+", icon: "🏷️", delta: "+5%" },
  { label: "Happy Customers", value: "18,500", icon: "😊", delta: "+8%" },
  { label: "Cities Covered", value: "34", icon: "🌍", delta: "+3" },
];

// ─── Sub-components ──────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2 max-w-xs">
      <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0" style={{ background: "var(--brand-primary)", color: "white" }}>
        AI
      </div>
      <div className="px-4 py-3 rounded-2xl rounded-bl-sm flex gap-1.5 items-center" style={{ background: "var(--brand-light)", border: "1px solid var(--brand-border)" }}>
        {[0,1,2].map(i => (
          <span key={i} className="typing-dot w-2 h-2 rounded-full inline-block" style={{ background: "var(--brand-secondary)", animationDelay: `${i*0.2}s` }} />
        ))}
      </div>
    </div>
  );
}

function ChatMessage({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
  return (
    <div className={`chat-message flex items-end gap-2 ${isUser ? "flex-row-reverse" : ""}`}>
      <div
        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
        style={isUser
          ? { background: "var(--brand-secondary)", color: "white" }
          : { background: "var(--brand-primary)", color: "white" }
        }
      >
        {isUser ? "You" : "AI"}
      </div>
      <div
        className="px-4 py-2.5 rounded-2xl max-w-[78%] text-sm leading-relaxed"
        style={isUser
          ? { background: "var(--brand-secondary)", color: "white", borderRadius: "16px 16px 4px 16px" }
          : { background: "var(--brand-light)", color: "var(--foreground)", border: "1px solid var(--brand-border)", borderRadius: "16px 16px 16px 4px" }
        }
      >
        {msg.text}
      </div>
    </div>
  );
}

function ProductCard({ product, onAsk }: { product: Product; onAsk: (p: Product) => void }) {
  return (
    <div
      className="glass-card rounded-2xl p-5 flex flex-col gap-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl cursor-pointer group"
      style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}
    >
      <div className="flex items-start justify-between">
        <div className="text-4xl">{product.image}</div>
        <span
          className="text-xs font-semibold px-2.5 py-1 rounded-full"
          style={product.available
            ? { background: "#d1fae5", color: "#065f46" }
            : { background: "#fee2e2", color: "#991b1b" }
          }
        >
          {product.available ? "● Available" : "● Unavailable"}
        </span>
      </div>
      <div>
        <p className="text-xs font-medium mb-1" style={{ color: "var(--brand-secondary)" }}>{product.category}</p>
        <h3 className="font-semibold text-base leading-tight" style={{ color: "var(--brand-primary)" }}>{product.name}</h3>
        <div className="flex items-center gap-1 mt-1">
          <span className="text-yellow-400 text-sm">★</span>
          <span className="text-xs font-medium">{product.rating}</span>
          <span className="text-xs" style={{ color: "var(--brand-muted)" }}>({product.reviews} reviews)</span>
        </div>
      </div>
      <div className="flex items-center justify-between pt-1 border-t" style={{ borderColor: "var(--brand-border)" }}>
        <div>
          <span className="text-lg font-bold" style={{ color: "var(--brand-primary)" }}>৳{product.pricePerDay}</span>
          <span className="text-xs ml-1" style={{ color: "var(--brand-muted)" }}>/day</span>
        </div>
        <button
          id={`ask-ai-product-${product.id}`}
          onClick={() => onAsk(product)}
          className="text-xs font-semibold px-3 py-1.5 rounded-full transition-all duration-200 hover:scale-105 active:scale-95"
          style={{ background: "var(--brand-secondary)", color: "white" }}
        >
          Ask AI 🤖
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    { role: "model", text: "Hi! I'm RentPi AI. I can check product availability, suggest rentals, and answer any questions. How can I help you today?", ts: Date.now() },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [mounted, setMounted] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, loading]);

  useEffect(() => {
    if (chatOpen) {
      setUnread(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [chatOpen]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: Message = { role: "user", text: text.trim(), ts: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch(CHAT_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: SESSION_ID, message: text.trim() }),
      });
      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const data = await res.json();
      const reply = data.response ?? data.message ?? data.reply ?? JSON.stringify(data);
      setMessages(prev => [...prev, { role: "model", text: reply, ts: Date.now() }]);
      if (!chatOpen) setUnread(n => n + 1);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      setMessages(prev => [...prev, {
        role: "model",
        text: `⚠️ Couldn't reach the server (${errorMsg}). Make sure the API Gateway is running on port 8000.`,
        ts: Date.now(),
      }]);
    } finally {
      setLoading(false);
    }
  }, [loading, chatOpen]);

  const handleAskAboutProduct = (product: Product) => {
    setChatOpen(true);
    sendMessage(`Is Product #${product.id} (${product.name}) currently available for rent?`);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); }
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--background)" }}>

      <Navbar />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="hero-gradient text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: "radial-gradient(circle at 20% 50%, #38bdf8 0%, transparent 50%), radial-gradient(circle at 80% 20%, #6366f1 0%, transparent 40%)"
        }} />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 md:py-32 relative z-10">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full mb-6 animate-fade-in-up" style={{ background: "rgba(56,189,248,0.15)", color: "#7dd3fc", border: "1px solid rgba(56,189,248,0.3)" }}>
              ✨ Powered by AI &nbsp;·&nbsp; Real-time Availability
            </span>
            <h1 className="text-4xl md:text-6xl font-extrabold leading-tight mb-6 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
              Rent Anything.<br />
              <span style={{ color: "#7dd3fc" }}>Instantly.</span>
            </h1>
            <p className="text-lg md:text-xl leading-relaxed mb-10 animate-fade-in-up" style={{ color: "#cbd5e1", animationDelay: "0.2s" }}>
              RentPi connects you to thousands of products with AI-powered availability checking, smart recommendations, and seamless booking — all in one platform.
            </p>
            <div className="flex flex-wrap gap-4 animate-fade-in-up" style={{ animationDelay: "0.3s" }}>
              <button
                id="hero-browse-btn"
                onClick={() => document.getElementById("products")?.scrollIntoView({ behavior: "smooth" })}
                className="px-7 py-3.5 rounded-full font-semibold text-white transition-all hover:scale-105 hover:shadow-xl"
                style={{ background: "linear-gradient(135deg,#2563eb,#38bdf8)" }}
              >
                Browse Products →
              </button>
              <button
                id="hero-chat-btn"
                onClick={() => setChatOpen(true)}
                className="px-7 py-3.5 rounded-full font-semibold transition-all hover:scale-105"
                style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.3)", color: "white" }}
              >
                🤖 Chat with AI
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats ────────────────────────────────────────────────────────── */}
      <section id="stats" className="py-12" style={{ background: "var(--brand-surface)" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {STATS.map((s, i) => (
              <div
                key={s.label}
                className="stat-card rounded-2xl p-5 relative overflow-hidden animate-fade-in-up"
                style={{ background: "var(--brand-surface-2)", border: "1px solid var(--brand-border)", animationDelay: `${i * 0.1}s` }}
              >
                <div className="stat-shimmer absolute inset-0 pointer-events-none" />
                <div className="text-2xl mb-2">{s.icon}</div>
                <div className="text-2xl font-extrabold" style={{ color: "var(--brand-primary)" }}>{s.value}</div>
                <div className="text-xs mt-0.5" style={{ color: "var(--brand-muted)" }}>{s.label}</div>
                <div className="absolute top-4 right-4 text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: "#d1fae5", color: "#065f46" }}>{s.delta}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Products ─────────────────────────────────────────────────────── */}
      <section id="products" className="py-16" style={{ background: "var(--background)" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
            <div>
              <p className="text-sm font-semibold mb-2" style={{ color: "var(--brand-secondary)" }}>FEATURED RENTALS</p>
              <h2 className="text-3xl font-bold" style={{ color: "var(--brand-primary)" }}>Popular Products</h2>
              <p className="mt-2 text-sm" style={{ color: "var(--brand-muted)" }}>
                Click &quot;Ask AI&quot; on any product to check real-time availability via our AI assistant.
              </p>
            </div>
            <button
              id="products-ask-all-btn"
              onClick={() => { setChatOpen(true); sendMessage("Show me all available products."); }}
              className="self-start sm:self-auto flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-all hover:scale-105"
              style={{ background: "var(--brand-light)", color: "var(--brand-secondary)" }}
            >
              🤖 Ask AI for All Availability
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {SAMPLE_PRODUCTS.map((p, i) => (
              <div key={p.id} className="animate-fade-in-up" style={{ animationDelay: `${i * 0.1}s` }}>
                <ProductCard product={p} onAsk={handleAskAboutProduct} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <section id="features" className="py-16" style={{ background: "var(--brand-surface)" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-sm font-semibold mb-2" style={{ color: "var(--brand-secondary)" }}>WHY RENTPI</p>
            <h2 className="text-3xl font-bold" style={{ color: "var(--brand-primary)" }}>Built for the Modern Renter</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: "🤖", title: "AI-Powered Assistant", desc: "Our agentic AI checks real-time inventory, answers queries, and helps you find the perfect rental — instantly." },
              { icon: "⚡", title: "Real-Time Availability", desc: "Connected to our microservices backend with live inventory updates from the Rental Service." },
              { icon: "🔒", title: "Secure & Scalable", desc: "Enterprise-grade API Gateway, containerized with Docker, and backed by robust user authentication." },
            ].map((f, i) => (
              <div
                key={f.title}
                className="glass-card rounded-2xl p-6 animate-fade-in-up hover:-translate-y-1 transition-all duration-300"
                style={{ animationDelay: `${i * 0.15}s`, boxShadow: "0 2px 16px rgba(0,0,0,0.05)" }}
              >
                <div className="text-3xl mb-4">{f.icon}</div>
                <h3 className="font-bold text-lg mb-2" style={{ color: "var(--brand-primary)" }}>{f.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "var(--brand-muted)" }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="py-10 mt-auto" style={{ background: "var(--brand-primary)", color: "rgba(255,255,255,0.7)" }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white font-bold text-xs" style={{ background: "rgba(255,255,255,0.15)" }}>Rπ</div>
            <span className="font-semibold text-white">RentPi</span>
          </div>
          <p className="text-sm">© 2026 RentPi. AI Gateway on <code className="text-blue-300">:8000</code> · Agentic on <code className="text-blue-300">:8004</code> · Rental on <code className="text-blue-300">:8002</code></p>
        </div>
      </footer>

      {/* ── Floating Chat Button ─────────────────────────────────────────── */}
      {!chatOpen && (
        <button
          id="fab-open-chat"
          onClick={() => setChatOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full text-white text-2xl flex items-center justify-center shadow-2xl transition-all hover:scale-110 active:scale-95"
          style={{ background: "linear-gradient(135deg,#1e3a5f,#2563eb)" }}
          aria-label="Open AI Chat"
        >
          {unread > 0 && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full text-xs flex items-center justify-center font-bold text-white" style={{ background: "#ef4444" }}>
              {unread}
            </span>
          )}
          🤖
        </button>
      )}

      {/* ── Chat Panel ──────────────────────────────────────────────────── */}
      {chatOpen && (
        <div
          id="chat-panel"
          className="fixed bottom-0 right-0 sm:bottom-6 sm:right-6 z-50 flex flex-col animate-slide-in-right"
          style={{
            width: "min(420px, 100vw)",
            height: "min(600px, 100dvh)",
            background: "var(--brand-surface)",
            borderRadius: "clamp(0px, 4vw, 20px)",
            boxShadow: "0 24px 64px rgba(0,0,0,0.18)",
            border: "1px solid var(--brand-border)",
            overflow: "hidden",
          }}
        >
          {/* Chat Header */}
          <div className="flex items-center justify-between px-5 py-4" style={{ background: "linear-gradient(135deg,#1e3a5f,#2563eb)" }}>
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-lg" style={{ background: "rgba(255,255,255,0.15)" }}>🤖</div>
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-blue-800 animate-pulse-ring" style={{ background: "#10b981" }} />
              </div>
              <div>
                <p className="text-sm font-bold text-white">RentPi AI</p>
                <p className="text-xs" style={{ color: "#93c5fd" }}>AI Assistant · Always on</p>
              </div>
            </div>
            <button
              id="chat-close-btn"
              onClick={() => setChatOpen(false)}
              className="w-8 h-8 rounded-full flex items-center justify-center text-white transition-colors hover:bg-white/10"
              aria-label="Close chat"
            >
              ✕
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4" style={{ background: "#f8fafc" }}>
            {messages.map((msg) => (
              <ChatMessage key={msg.ts + msg.role} msg={msg} />
            ))}
            {loading && <TypingIndicator />}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick prompts */}
          {messages.length <= 1 && (
            <div className="px-4 pb-2 flex flex-wrap gap-2">
              {["What's available today?", "Show me cameras", "Best deal under ৳50/day"].map(q => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="text-xs px-3 py-1.5 rounded-full border transition-all hover:scale-105"
                  style={{ borderColor: "var(--brand-secondary)", color: "var(--brand-secondary)", background: "var(--brand-light)" }}
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input Bar */}
          <div className="px-4 py-3 flex items-center gap-3" style={{ borderTop: "1px solid var(--brand-border)", background: "var(--brand-surface)" }}>
            <input
              ref={inputRef}
              id="chat-input"
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about availability..."
              disabled={loading}
              className="flex-1 text-sm px-4 py-2.5 rounded-full outline-none transition-all"
              style={{
                background: "var(--brand-surface-2)",
                border: "1px solid var(--brand-border)",
                color: "var(--foreground)",
              }}
            />
            <button
              id="chat-send-btn"
              onClick={() => sendMessage(input)}
              disabled={loading || !input.trim()}
              className="w-10 h-10 rounded-full flex items-center justify-center text-white transition-all hover:scale-110 active:scale-95 disabled:opacity-40 disabled:hover:scale-100"
              style={{ background: "linear-gradient(135deg,#1e3a5f,#2563eb)" }}
              aria-label="Send message"
            >
              ↑
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
