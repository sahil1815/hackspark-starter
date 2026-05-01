"use client";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { getUser, clearAuth } from "../lib/api";
import { useEffect, useState } from "react";

const NAV_LINKS = [
  { href: "/products",     label: "Products" },
  { href: "/availability", label: "Availability" },
  { href: "/chat",         label: "AI Chat" },
  { href: "/trending",     label: "Trending" },
];

export default function Navbar() {
  const router   = useRouter();
  const pathname = usePathname();
  const [user, setUser]     = useState<Record<string, unknown> | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => { 
    setUser(getUser()); 
    const savedTheme = (localStorage.getItem("rentpi-theme") as "light" | "dark") || "light";
    setTheme(savedTheme);
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === "light" ? "dark" : "light";
    setTheme(newTheme);
    localStorage.setItem("rentpi-theme", newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
  };

  const handleLogout = () => {
    clearAuth();
    setUser(null);
    router.push("/login");
  };

  return (
    <nav className="sticky top-0 z-40 glass-card border-b" style={{ borderColor: "var(--brand-border)" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm"
               style={{ background: "linear-gradient(135deg,#1e3a5f,#2563eb)" }}>Rπ</div>
          <span className="font-bold text-xl gradient-text">RentPi</span>
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-6 text-sm font-medium">
          {NAV_LINKS.map(l => (
            <Link key={l.href} href={l.href}
              className={`transition-colors ${pathname === l.href ? "text-blue-600 font-semibold" : "hover:text-blue-600"}`}
              style={{ color: pathname === l.href ? "var(--brand-secondary)" : "var(--brand-muted)" }}>
              {l.label}
            </Link>
          ))}
        </div>

        {/* Theme Toggle & Auth */}
        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl transition-all hover:scale-110 active:scale-95"
            style={{ background: "var(--brand-light)", color: "var(--brand-secondary)" }}
            aria-label="Toggle theme"
          >
            {theme === "light" ? "🌙" : "☀️"}
          </button>

          {user ? (
            <>
              <Link href="/profile"
                className="hidden sm:flex items-center gap-2 text-sm font-medium px-3 py-1.5 rounded-full transition-all hover:scale-105"
                style={{ background: "var(--brand-light)", color: "var(--brand-secondary)" }}>
                👤 {(user.name as string)?.split(" ")[0] ?? "Profile"}
              </Link>
              <button onClick={handleLogout}
                className="text-sm font-medium px-4 py-2 rounded-full border transition-all hover:scale-105"
                style={{ borderColor: "var(--brand-border)", color: "var(--brand-muted)" }}>
                Logout
              </button>
            </>
          ) : (
            <>
              <Link href="/login"
                className="text-sm font-medium px-4 py-2 rounded-full border transition-all hover:scale-105"
                style={{ borderColor: "var(--brand-secondary)", color: "var(--brand-secondary)" }}>
                Login
              </Link>
              <Link href="/register"
                className="text-sm font-semibold px-4 py-2 rounded-full text-white transition-all hover:opacity-90 hover:scale-105"
                style={{ background: "linear-gradient(135deg,#1e3a5f,#2563eb)" }}>
                Register
              </Link>
            </>
          )}
          {/* Mobile menu toggle */}
          <button className="md:hidden p-2 rounded-lg" onClick={() => setMenuOpen(o => !o)}
                  style={{ color: "var(--brand-muted)" }}>☰</button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t px-4 py-3 flex flex-col gap-3" style={{ borderColor: "var(--brand-border)", background: "var(--brand-surface)" }}>
          {NAV_LINKS.map(l => (
            <Link key={l.href} href={l.href} onClick={() => setMenuOpen(false)}
              className="text-sm font-medium py-1.5" style={{ color: "var(--brand-primary)" }}>{l.label}</Link>
          ))}
        </div>
      )}
    </nav>
  );
}
