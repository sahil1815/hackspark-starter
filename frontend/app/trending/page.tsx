"use client";
import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "../lib/api";
import Navbar from "../components/Navbar";

interface Recommendation {
  productId: number;
  name: string;
  category: string;
  score: number;
}

const CATEGORY_ICONS: Record<string, string> = {
  ELECTRONICS: "⚡", FURNITURE: "🛋️", VEHICLES: "🚗", TOOLS: "🔧",
  OUTDOOR: "🏕️", SPORTS: "⚽", MUSIC: "🎸", CAMERAS: "📷", OFFICE: "💼",
};

function SkeletonCard() {
  return (
    <div className="rounded-2xl p-5 animate-pulse" style={{ background: "var(--brand-surface)", border: "1px solid var(--brand-border)" }}>
      <div className="h-10 w-10 rounded-xl mb-4" style={{ background: "var(--brand-border)" }} />
      <div className="h-4 rounded-full mb-2 w-1/3" style={{ background: "var(--brand-border)" }} />
      <div className="h-5 rounded-full mb-3 w-3/4" style={{ background: "var(--brand-border)" }} />
      <div className="h-3 rounded-full w-1/2" style={{ background: "var(--brand-border)" }} />
    </div>
  );
}

export default function TrendingPage() {
  const [recs, setRecs]       = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [date, setDate]       = useState("");

  const fetchRecs = useCallback(async () => {
    setLoading(true); setError("");
    const today = new Date().toISOString().split("T")[0];
    setDate(today);
    try {
      const res  = await apiFetch(`/analytics/recommendations?date=${today}&limit=6`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch");
      setRecs(data.recommendations ?? []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load trending products");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRecs(); }, [fetchRecs]);

  const maxScore = recs.length > 0 ? Math.max(...recs.map(r => r.score)) : 1;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--background)" }}>
      <Navbar />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
          <div>
            <p className="text-sm font-semibold mb-1" style={{ color: "var(--brand-secondary)" }}>P18 · SEASONAL AI</p>
            <h1 className="text-3xl font-bold" style={{ color: "var(--brand-primary)" }}>What&apos;s Trending Today?</h1>
            {date && <p className="text-sm mt-1" style={{ color: "var(--brand-muted)" }}>
              Showing seasonal picks for <strong>{date}</strong> — based on historical rental patterns.
            </p>}
          </div>
          <button id="trending-refresh-btn" onClick={fetchRecs} disabled={loading}
            className="self-start sm:self-auto flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold transition-all hover:scale-105 disabled:opacity-50"
            style={{ background: "var(--brand-secondary)", color: "white" }}>
            {loading ? "⏳ Loading…" : "🔄 Refresh"}
          </button>
        </div>

        {/* Error state */}
        {error && !loading && (
          <div className="px-5 py-4 rounded-2xl text-sm mb-6 text-center" style={{ background: "#fee2e2", color: "#991b1b" }}>
            ⚠️ {error}<br />
            <button onClick={fetchRecs} className="mt-2 underline font-medium">Try again</button>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && recs.length === 0 && (
          <div className="text-center py-20">
            <div className="text-5xl mb-4">🔍</div>
            <p className="font-semibold" style={{ color: "var(--brand-primary)" }}>No trending products found</p>
            <p className="text-sm mt-1" style={{ color: "var(--brand-muted)" }}>No historical data for this seasonal window.</p>
          </div>
        )}

        {/* Cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
            : recs.map((r, i) => (
              <div key={r.productId}
                className="glass-card rounded-2xl p-5 flex flex-col gap-4 animate-fade-in-up hover:-translate-y-1 transition-all duration-300"
                style={{ boxShadow: "0 2px 16px rgba(0,0,0,0.06)", animationDelay: `${i * 0.08}s` }}>
                {/* Rank badge */}
                <div className="flex items-start justify-between">
                  <div className="text-3xl">{CATEGORY_ICONS[r.category] ?? "📦"}</div>
                  <span className="text-xs font-bold px-2 py-1 rounded-full"
                        style={{ background: i === 0 ? "#fef3c7" : "var(--brand-light)", color: i === 0 ? "#92400e" : "var(--brand-secondary)" }}>
                    {i === 0 ? "🏆 #1" : `#${i + 1}`}
                  </span>
                </div>

                {/* Name & category */}
                <div>
                  <span className="text-xs font-semibold" style={{ color: "var(--brand-secondary)" }}>{r.category}</span>
                  <h3 className="font-semibold text-base leading-tight mt-0.5" style={{ color: "var(--brand-primary)" }}>{r.name}</h3>
                  <p className="text-xs mt-0.5" style={{ color: "var(--brand-muted)" }}>Product #{r.productId}</p>
                </div>

                {/* Score bar */}
                <div>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span style={{ color: "var(--brand-muted)" }}>Seasonal Score</span>
                    <span className="font-bold" style={{ color: "var(--brand-primary)" }}>{r.score}</span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--brand-border)" }}>
                    <div className="h-full rounded-full transition-all duration-700"
                         style={{ width: `${(r.score / maxScore) * 100}%`, background: "linear-gradient(90deg,#1e3a5f,#38bdf8)" }} />
                  </div>
                </div>

                {/* Links */}
                <div className="flex gap-2 mt-auto">
                  <a href={`/availability?productId=${r.productId}`}
                    className="flex-1 text-center text-xs font-semibold py-2 rounded-xl transition-all hover:scale-105"
                    style={{ background: "var(--brand-light)", color: "var(--brand-secondary)" }}>
                    Check Availability
                  </a>
                </div>
              </div>
            ))
          }
        </div>
      </main>
    </div>
  );
}
