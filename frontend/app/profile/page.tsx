"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, getToken, getUser, clearAuth } from "../lib/api";
import Navbar from "../components/Navbar";

interface UserProfile { id: number; name: string; email: string; security_score: number; }
interface Discount    { userId: number; securityScore: number; discountPercent: number; }

const DISCOUNT_TIERS = [
  { min: 80, max: 100, discount: 20, color: "#065f46", bg: "#d1fae5", label: "Gold" },
  { min: 60, max: 79,  discount: 15, color: "#1e40af", bg: "#dbeafe", label: "Silver" },
  { min: 40, max: 59,  discount: 10, color: "#92400e", bg: "#fef3c7", label: "Bronze" },
  { min: 20, max: 39,  discount: 5,  color: "#4b5563", bg: "#f3f4f6", label: "Basic" },
  { min: 0,  max: 19,  discount: 0,  color: "#9ca3af", bg: "#f9fafb", label: "Starter" },
];

function tierForScore(score: number) {
  return DISCOUNT_TIERS.find(t => score >= t.min && score <= t.max) ?? DISCOUNT_TIERS[4];
}

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile]   = useState<UserProfile | null>(null);
  const [discount, setDiscount] = useState<Discount | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState("");

  useEffect(() => {
    if (!getToken()) { router.push("/login"); return; }
    const localUser = getUser();

    const fetchAll = async () => {
      try {
        const res  = await apiFetch("/users/me");
        if (res.status === 401) { clearAuth(); router.push("/login"); return; }
        const data: UserProfile = await res.json();
        setProfile(data);

        // Fetch discount from Central API via gateway
        const userId = data.id ?? (localUser?.id as number);
        if (userId) {
          try {
            const dRes  = await apiFetch(`/users/${userId}/discount`);
            const dData = await dRes.json();
            setDiscount(dData);
          } catch (_) { /* discount fetch is best-effort */ }
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load profile");
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [router]);

  const handleLogout = () => { clearAuth(); router.push("/login"); };

  if (loading) return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--background)" }}>
      <Navbar />
      <div className="flex-1 flex items-center justify-center">
        <div className="text-4xl animate-spin">⏳</div>
      </div>
    </div>
  );

  const tier = discount ? tierForScore(discount.securityScore) : null;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--background)" }}>
      <Navbar />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 sm:px-6 py-10">
        {error && (
          <div className="px-5 py-4 rounded-2xl text-sm mb-6" style={{ background: "#fee2e2", color: "#991b1b" }}>⚠️ {error}</div>
        )}

        {profile && (
          <div className="flex flex-col gap-6">
            {/* Profile card */}
            <div className="glass-card rounded-2xl p-8 flex flex-col items-center text-center gap-4 animate-fade-in-up"
                 style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.07)" }}>
              <div className="w-20 h-20 rounded-full flex items-center justify-center text-white text-3xl font-bold"
                   style={{ background: "linear-gradient(135deg,#1e3a5f,#2563eb)" }}>
                {profile.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h1 className="text-2xl font-bold" style={{ color: "var(--brand-primary)" }}>{profile.name}</h1>
                <p className="text-sm mt-1" style={{ color: "var(--brand-muted)" }}>{profile.email}</p>
              </div>
              <button onClick={handleLogout}
                className="px-5 py-2 rounded-full text-sm font-medium border transition-all hover:scale-105"
                style={{ borderColor: "#ef4444", color: "#ef4444" }}>
                Logout
              </button>
            </div>

            {/* Discount tier card */}
            {discount && tier && (
              <div className="glass-card rounded-2xl p-6 animate-fade-in-up" style={{ animationDelay: "0.1s", boxShadow: "0 4px 24px rgba(0,0,0,0.07)" }}>
                <p className="text-xs font-semibold mb-4" style={{ color: "var(--brand-secondary)" }}>LOYALTY DISCOUNT — P6</p>
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-sm" style={{ color: "var(--brand-muted)" }}>Security Score</p>
                    <p className="text-3xl font-extrabold mt-0.5" style={{ color: "var(--brand-primary)" }}>{discount.securityScore}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: tier.bg, color: tier.color }}>
                      {tier.label} Tier
                    </span>
                    <p className="text-3xl font-extrabold mt-2" style={{ color: tier.color }}>{discount.discountPercent}% OFF</p>
                  </div>
                </div>

                {/* Score bar */}
                <div className="h-3 rounded-full overflow-hidden mb-2" style={{ background: "var(--brand-border)" }}>
                  <div className="h-full rounded-full transition-all duration-700"
                       style={{ width: `${discount.securityScore}%`, background: `linear-gradient(90deg,#1e3a5f,${tier.color})` }} />
                </div>

                {/* Tiers legend */}
                <div className="grid grid-cols-5 gap-1 mt-4">
                  {DISCOUNT_TIERS.slice().reverse().map(t => (
                    <div key={t.label} className="text-center">
                      <div className="text-xs font-semibold px-1 py-1 rounded-lg" style={{ background: t.bg, color: t.color }}>
                        {t.discount}%
                      </div>
                      <p className="text-xs mt-1" style={{ color: "var(--brand-muted)" }}>{t.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick links */}
            <div className="glass-card rounded-2xl p-6 animate-fade-in-up" style={{ animationDelay: "0.2s", boxShadow: "0 4px 24px rgba(0,0,0,0.07)" }}>
              <p className="text-xs font-semibold mb-4" style={{ color: "var(--brand-secondary)" }}>QUICK LINKS</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { href: "/products",     label: "Browse Products", icon: "🏷️" },
                  { href: "/availability", label: "Check Availability", icon: "📅" },
                  { href: "/chat",         label: "AI Assistant",    icon: "🤖" },
                  { href: "/trending",     label: "Trending Today",  icon: "🔥" },
                ].map(l => (
                  <a key={l.href} href={l.href}
                    className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all hover:scale-105"
                    style={{ background: "var(--brand-surface-2)", border: "1px solid var(--brand-border)", color: "var(--brand-primary)" }}>
                    <span>{l.icon}</span>{l.label}
                  </a>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
