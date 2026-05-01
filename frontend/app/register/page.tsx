"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GATEWAY, setAuth } from "../lib/api";
import Navbar from "../components/Navbar";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm]     = useState({ name: "", email: "", password: "", confirm: "" });
  const [error, setError]   = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (form.password !== form.confirm) { setError("Passwords do not match"); return; }
    setLoading(true);
    try {
      const res  = await fetch(`${GATEWAY}/users/register`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ name: form.name, email: form.email, password: form.password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Registration failed");
      setAuth(data.token, data.user);
      router.push("/products");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const field = (id: string, label: string, type: string, key: "name"|"email"|"password"|"confirm", ph: string) => (
    <div>
      <label className="block text-sm font-medium mb-1.5" style={{ color: "var(--brand-primary)" }}>{label}</label>
      <input id={id} type={type} required value={form[key]}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
        placeholder={ph}
        className="w-full px-4 py-2.5 rounded-xl text-sm outline-none transition-all"
        style={{ background: "var(--brand-surface-2)", border: "1px solid var(--brand-border)", color: "var(--foreground)" }} />
    </div>
  );

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--background)" }}>
      <Navbar />
      <div className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md">
          <div className="glass-card rounded-2xl p-8" style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.08)" }}>
            <div className="text-center mb-8">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-xl mx-auto mb-4"
                   style={{ background: "linear-gradient(135deg,#1e3a5f,#2563eb)" }}>Rπ</div>
              <h1 className="text-2xl font-bold" style={{ color: "var(--brand-primary)" }}>Create an account</h1>
              <p className="text-sm mt-1" style={{ color: "var(--brand-muted)" }}>Join RentPi and start renting today</p>
            </div>

            {error && (
              <div className="mb-4 px-4 py-3 rounded-xl text-sm" style={{ background: "#fee2e2", color: "#991b1b" }}>
                ⚠️ {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              {field("reg-name",     "Full Name",        "text",     "name",    "John Doe")}
              {field("reg-email",    "Email",            "email",    "email",   "you@example.com")}
              {field("reg-password", "Password",         "password", "password","••••••••")}
              {field("reg-confirm",  "Confirm Password", "password", "confirm", "••••••••")}

              <button id="register-submit" type="submit" disabled={loading}
                className="mt-2 w-full py-3 rounded-xl text-white font-semibold transition-all hover:opacity-90 hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                style={{ background: "linear-gradient(135deg,#1e3a5f,#2563eb)" }}>
                {loading ? "Creating account…" : "Create Account"}
              </button>
            </form>

            <p className="text-center text-sm mt-6" style={{ color: "var(--brand-muted)" }}>
              Already have an account?{" "}
              <Link href="/login" className="font-semibold hover:underline" style={{ color: "var(--brand-secondary)" }}>Sign in</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
