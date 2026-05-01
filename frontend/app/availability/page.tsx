"use client";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "../lib/api";
import Navbar from "../components/Navbar";
import { Suspense } from "react";

interface BusyPeriod  { start: string; end: string; }
interface FreeWindow  { start: string; end: string; }
interface AvailResult {
  productId: number;
  from: string;
  to: string;
  available: boolean;
  busyPeriods: BusyPeriod[];
  freeWindows: FreeWindow[];
}

function AvailabilityContent() {
  const searchParams = useSearchParams();
  const [productId, setProductId] = useState(searchParams.get("productId") ?? "");
  const [from, setFrom]           = useState("");
  const [to, setTo]               = useState("");
  const [result, setResult]       = useState<AvailResult | null>(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");

  // Pre-fill today as default from date
  useEffect(() => {
    const today = new Date().toISOString().split("T")[0];
    setFrom(today);
    setTo(today);
  }, []);

  const handleCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productId || !from || !to) return;
    setLoading(true); setError(""); setResult(null);
    try {
      const res  = await apiFetch(`/rentals/products/${productId}/availability?from=${from}&to=${to}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to check");
      setResult(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Error checking availability");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--background)" }}>
      <Navbar />
      <main className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-8">
          <p className="text-sm font-semibold mb-1" style={{ color: "var(--brand-secondary)" }}>P7</p>
          <h1 className="text-3xl font-bold" style={{ color: "var(--brand-primary)" }}>Check Availability</h1>
          <p className="text-sm mt-1" style={{ color: "var(--brand-muted)" }}>
            Enter a product ID and date range to see real-time availability.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleCheck} className="glass-card rounded-2xl p-6 flex flex-col gap-5 mb-8"
              style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--brand-primary)" }}>Product ID</label>
            <input id="avail-product-id" type="number" required min="1" value={productId}
              onChange={e => setProductId(e.target.value)} placeholder="e.g. 42"
              className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
              style={{ background: "var(--brand-surface-2)", border: "1px solid var(--brand-border)", color: "var(--foreground)" }} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--brand-primary)" }}>From</label>
              <input id="avail-from" type="date" required value={from} onChange={e => setFrom(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: "var(--brand-surface-2)", border: "1px solid var(--brand-border)", color: "var(--foreground)" }} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--brand-primary)" }}>To</label>
              <input id="avail-to" type="date" required value={to} onChange={e => setTo(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: "var(--brand-surface-2)", border: "1px solid var(--brand-border)", color: "var(--foreground)" }} />
            </div>
          </div>
          <button id="avail-check-btn" type="submit" disabled={loading}
            className="w-full py-3 rounded-xl text-white font-semibold transition-all hover:opacity-90 disabled:opacity-50"
            style={{ background: "linear-gradient(135deg,#1e3a5f,#2563eb)" }}>
            {loading ? "Checking…" : "Check Availability"}
          </button>
        </form>

        {/* Error */}
        {error && (
          <div className="px-5 py-4 rounded-2xl text-sm mb-6" style={{ background: "#fee2e2", color: "#991b1b" }}>⚠️ {error}</div>
        )}

        {/* Result */}
        {result && (
          <div className="glass-card rounded-2xl p-6 flex flex-col gap-5 animate-fade-in-up"
               style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>
            {/* Status badge */}
            <div className="flex items-center gap-3">
              <span className="text-4xl">{result.available ? "✅" : "❌"}</span>
              <div>
                <p className="text-xs font-semibold" style={{ color: "var(--brand-muted)" }}>Product #{result.productId}</p>
                <p className="text-xl font-bold mt-0.5"
                   style={{ color: result.available ? "#065f46" : "#991b1b" }}>
                  {result.available ? "Available for your dates!" : "Not available for your dates"}
                </p>
                <p className="text-xs mt-0.5" style={{ color: "var(--brand-muted)" }}>{result.from} → {result.to}</p>
              </div>
            </div>

            {/* Busy periods */}
            {result.busyPeriods.length > 0 && (
              <div>
                <p className="text-sm font-semibold mb-2" style={{ color: "#991b1b" }}>🔴 Busy Periods</p>
                <div className="flex flex-col gap-2">
                  {result.busyPeriods.map((b, i) => (
                    <div key={i} className="flex items-center justify-between px-4 py-2.5 rounded-xl text-sm"
                         style={{ background: "#fee2e2", color: "#991b1b" }}>
                      <span>{b.start}</span><span>→</span><span>{b.end}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Free windows */}
            {result.freeWindows.length > 0 && (
              <div>
                <p className="text-sm font-semibold mb-2" style={{ color: "#065f46" }}>🟢 Free Windows</p>
                <div className="flex flex-col gap-2">
                  {result.freeWindows.map((w, i) => (
                    <div key={i} className="flex items-center justify-between px-4 py-2.5 rounded-xl text-sm"
                         style={{ background: "#d1fae5", color: "#065f46" }}>
                      <span>{w.start}</span><span>→</span><span>{w.end}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default function AvailabilityPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center" style={{background:"var(--background)"}}>Loading…</div>}>
      <AvailabilityContent />
    </Suspense>
  );
}
