"use client";
import { useState, useEffect, useCallback } from "react";
import { apiFetch } from "../lib/api";
import Navbar from "../components/Navbar";

interface Product {
  id: number;
  name: string;
  category: string;
  pricePerDay: number;
  ownerId: number;
}

interface ApiResponse {
  data: Product[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const CATEGORIES = [
  "ALL", "ELECTRONICS", "FURNITURE", "VEHICLES", "TOOLS",
  "OUTDOOR", "SPORTS", "MUSIC", "CAMERAS", "OFFICE",
];

const CATEGORY_ICONS: Record<string, string> = {
  ELECTRONICS: "⚡", FURNITURE: "🛋️", VEHICLES: "🚗", TOOLS: "🔧",
  OUTDOOR: "🏕️", SPORTS: "⚽", MUSIC: "🎸", CAMERAS: "📷", OFFICE: "💼", ALL: "🏷️",
};

function SkeletonCard() {
  return (
    <div className="rounded-2xl p-5 animate-pulse" style={{ background: "var(--brand-surface)", border: "1px solid var(--brand-border)" }}>
      <div className="h-4 rounded-full mb-3 w-1/3" style={{ background: "var(--brand-border)" }} />
      <div className="h-5 rounded-full mb-2 w-3/4" style={{ background: "var(--brand-border)" }} />
      <div className="h-4 rounded-full w-1/2" style={{ background: "var(--brand-border)" }} />
      <div className="h-8 rounded-xl mt-4" style={{ background: "var(--brand-border)" }} />
    </div>
  );
}

export default function ProductsPage() {
  const [products, setProducts]   = useState<Product[]>([]);
  const [meta, setMeta]           = useState<Omit<ApiResponse, "data"> | null>(null);
  const [category, setCategory]   = useState("ALL");
  const [page, setPage]           = useState(1);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState("");
  const [selected, setSelected]   = useState<Product | null>(null);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ page: String(page), limit: "12" });
      if (category !== "ALL") params.set("category", category);
      const res  = await apiFetch(`/rentals/products?${params}`);
      const data: ApiResponse = await res.json();
      if (!res.ok) throw new Error((data as unknown as { error: string }).error || "Failed to load");
      setProducts(data.data);
      setMeta({ page: data.page, limit: data.limit, total: data.total, totalPages: data.totalPages });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load products");
    } finally {
      setLoading(false);
    }
  }, [category, page]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);
  useEffect(() => { setPage(1); }, [category]);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--background)" }}>
      <Navbar />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-10">
        {/* Header */}
        <div className="mb-8">
          <p className="text-sm font-semibold mb-1" style={{ color: "var(--brand-secondary)" }}>CATALOG</p>
          <h1 className="text-3xl font-bold" style={{ color: "var(--brand-primary)" }}>Browse Products</h1>
          {meta && <p className="text-sm mt-1" style={{ color: "var(--brand-muted)" }}>{meta.total.toLocaleString()} products available</p>}
        </div>

        {/* Category filter */}
        <div className="flex flex-wrap gap-2 mb-8">
          {CATEGORIES.map(cat => (
            <button key={cat}
              id={`cat-filter-${cat.toLowerCase()}`}
              onClick={() => setCategory(cat)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all hover:scale-105"
              style={category === cat
                ? { background: "var(--brand-secondary)", color: "white" }
                : { background: "var(--brand-surface)", border: "1px solid var(--brand-border)", color: "var(--brand-muted)" }
              }>
              {CATEGORY_ICONS[cat] ?? "📦"} {cat}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 px-5 py-4 rounded-2xl text-sm" style={{ background: "#fee2e2", color: "#991b1b" }}>
            ⚠️ {error}
          </div>
        )}

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {loading
            ? Array.from({ length: 12 }).map((_, i) => <SkeletonCard key={i} />)
            : products.map(p => (
              <div key={p.id}
                className="glass-card rounded-2xl p-5 flex flex-col gap-3 cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-xl animate-fade-in-up"
                style={{ boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}
                onClick={() => setSelected(p)}>
                <div className="text-3xl">{CATEGORY_ICONS[p.category] ?? "📦"}</div>
                <div>
                  <span className="text-xs font-semibold" style={{ color: "var(--brand-secondary)" }}>{p.category}</span>
                  <h3 className="font-semibold text-sm leading-tight mt-0.5" style={{ color: "var(--brand-primary)" }}>{p.name}</h3>
                  <p className="text-xs mt-0.5" style={{ color: "var(--brand-muted)" }}>Owner #{p.ownerId}</p>
                </div>
                <div className="flex items-center justify-between mt-auto pt-3 border-t" style={{ borderColor: "var(--brand-border)" }}>
                  <div>
                    <span className="font-bold text-base" style={{ color: "var(--brand-primary)" }}>৳{p.pricePerDay}</span>
                    <span className="text-xs ml-1" style={{ color: "var(--brand-muted)" }}>/day</span>
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: "var(--brand-light)", color: "var(--brand-secondary)" }}>
                    #{p.id}
                  </span>
                </div>
              </div>
            ))
          }
        </div>

        {/* Pagination */}
        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-10">
            <button id="prev-page" disabled={page <= 1 || loading}
              onClick={() => setPage(p => p - 1)}
              className="px-5 py-2 rounded-full text-sm font-medium transition-all hover:scale-105 disabled:opacity-40"
              style={{ background: "var(--brand-surface)", border: "1px solid var(--brand-border)", color: "var(--brand-muted)" }}>
              ← Prev
            </button>
            <span className="text-sm font-medium" style={{ color: "var(--brand-primary)" }}>
              Page {meta.page} of {meta.totalPages}
            </span>
            <button id="next-page" disabled={page >= meta.totalPages || loading}
              onClick={() => setPage(p => p + 1)}
              className="px-5 py-2 rounded-full text-sm font-medium transition-all hover:scale-105 disabled:opacity-40"
              style={{ background: "var(--brand-secondary)", color: "white" }}>
              Next →
            </button>
          </div>
        )}
      </main>

      {/* Product Detail Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}
          onClick={() => setSelected(null)}>
          <div className="glass-card rounded-2xl p-8 max-w-md w-full animate-fade-in-up"
            style={{ boxShadow: "0 24px 64px rgba(0,0,0,0.2)" }}
            onClick={e => e.stopPropagation()}>
            <div className="text-4xl mb-4">{CATEGORY_ICONS[selected.category] ?? "📦"}</div>
            <span className="text-xs font-semibold" style={{ color: "var(--brand-secondary)" }}>{selected.category}</span>
            <h2 className="text-xl font-bold mt-1 mb-2" style={{ color: "var(--brand-primary)" }}>{selected.name}</h2>
            <div className="grid grid-cols-2 gap-3 text-sm mt-4">
              {[["Product ID", `#${selected.id}`], ["Owner ID", `#${selected.ownerId}`], ["Price/Day", `৳${selected.pricePerDay}`]].map(([k, v]) => (
                <div key={k} className="rounded-xl p-3" style={{ background: "var(--brand-surface-2)", border: "1px solid var(--brand-border)" }}>
                  <p className="text-xs mb-1" style={{ color: "var(--brand-muted)" }}>{k}</p>
                  <p className="font-semibold" style={{ color: "var(--brand-primary)" }}>{v}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-3 mt-6">
              <a href={`/availability?productId=${selected.id}`}
                className="flex-1 text-center py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
                style={{ background: "linear-gradient(135deg,#1e3a5f,#2563eb)" }}>
                Check Availability
              </a>
              <button onClick={() => setSelected(null)}
                className="px-4 py-2.5 rounded-xl text-sm font-medium border transition-all hover:scale-105"
                style={{ borderColor: "var(--brand-border)", color: "var(--brand-muted)" }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
