import React from "react";
import { Circle } from "lucide-react";

export function OilGauge({ pct }: { pct: number }) {
  const color = pct < 15 ? "var(--red)" : pct < 35 ? "var(--amber)" : "var(--green)";
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 rounded-full overflow-hidden bg-[var(--hairline)]">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-xs font-mono text-[var(--steel)]">{pct}%</span>
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, { bg: string; fg: string }> = {
    Active: { bg: "var(--green-bg)", fg: "var(--green)" },
    "In shop": { bg: "var(--amber-bg)", fg: "var(--amber)" },
    Down: { bg: "var(--red-bg)", fg: "var(--red)" },
  };
  const s = map[status] || map.Active;
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold" style={{ background: s.bg, color: s.fg }}>
      <Circle className="w-2 h-2" fill={s.fg} stroke="none" />
      {status}
    </span>
  );
}

export function ManifestTag({ route, id, size = "md" }: { route: string; id: string; size?: "md" | "lg" }) {
  const big = size === "lg";
  return (
    <div className="inline-flex items-stretch rounded-lg overflow-hidden border border-[var(--hairline-dark)] shrink-0">
      <div
        className="flex flex-col items-center justify-center px-3"
        style={{
          background: "var(--ink)",
          backgroundImage: `radial-gradient(circle at 0 50%, var(--canvas) 3px, transparent 3.5px), radial-gradient(circle at 100% 50%, var(--canvas) 3px, transparent 3.5px)`,
        }}
      >
        <span className="font-mono text-[#8FA2FF] tracking-widest" style={{ fontSize: big ? 10 : 9 }}>RT</span>
        <span className="font-mono text-white font-bold" style={{ fontSize: big ? 15 : 13 }}>{route}</span>
      </div>
      <div className="flex items-center px-3 bg-white">
        <span className="font-display font-bold text-[var(--ink)]" style={{ fontSize: big ? 20 : 16 }}>{id}</span>
      </div>
    </div>
  );
}

export function StatTag({ label, value, accent, icon: Icon }: { label: string; value: string | number; accent: string; icon: any }) {
  return (
    <div className="flex-1 rounded-xl p-4 border border-[var(--hairline)] bg-[var(--surface)]" style={{ borderTop: `3px solid ${accent}` }}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--steel-light)]">{label}</span>
        <Icon className="w-4 h-4" style={{ color: accent }} />
      </div>
      <div className="font-display text-3xl font-bold text-[var(--ink)]">{value}</div>
    </div>
  );
}

export function NavItem({ icon: Icon, label, active, onClick }: { icon: any; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-center lg:justify-start gap-1 lg:gap-3 px-1 lg:px-3 py-2 lg:py-2.5 rounded-lg text-[10px] lg:text-sm transition-colors flex-col lg:flex-row`}
      style={{
        background: active ? "var(--ink-3)" : "transparent",
        color: active ? "#FFFFFF" : "#9AA5BD",
        fontWeight: active ? 600 : 500,
      }}
    >
      <Icon className="w-5 h-5 lg:w-4 lg:h-4 shrink-0" style={{ color: active ? "var(--signal)" : "#6B7690" }} />
      <span className="truncate">{label}</span>
    </button>
  );
}

export function PageHeader({ eyebrow, title, subtitle, right }: { eyebrow: string; title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <div className="flex flex-col lg:flex-row lg:items-start justify-between mb-6 flex-wrap gap-4">
      <div>
        <div className="text-xs font-semibold uppercase tracking-wider mb-1 text-[var(--signal)]">{eyebrow}</div>
        <h1 className="font-display text-2xl lg:text-3xl font-bold text-[var(--ink)]">{title}</h1>
        {subtitle && <p className="text-sm mt-1 text-[var(--steel)]">{subtitle}</p>}
      </div>
      {right && <div className="flex flex-wrap gap-2 w-full lg:w-auto">{right}</div>}
    </div>
  );
}

export function Btn({ children, variant = "primary", icon: Icon, className = "", ...props }: any) {
  const styles: Record<string, string> = {
    primary: "bg-[var(--signal)] text-white border-[var(--signal)]",
    ghost: "bg-[var(--surface)] text-[var(--ink)] border-[var(--hairline)] hover:bg-gray-50",
    dark: "bg-[var(--ink)] text-white border-[var(--ink)]",
  };
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 lg:py-2.5 py-3 rounded-lg text-sm font-semibold transition-transform active:scale-[0.98] border ${styles[variant]} ${className}`}
    >
      {Icon && <Icon className="w-4 h-4" />}
      {children}
    </button>
  );
}

export function Modal({ isOpen, onClose, title, children }: { isOpen: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-[var(--surface)] border border-[var(--hairline)] rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-4 border-b border-[var(--hairline)]">
          <h2 className="font-semibold text-lg text-[var(--ink)]">{title}</h2>
          <button onClick={onClose} className="text-[var(--steel)] hover:text-[var(--ink)] transition-colors">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>
        <div className="p-4 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}

export function Input({ label, ...props }: any) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-[var(--ink)] mb-1.5">{label}</label>
      <input
        {...props}
        className="w-full px-3 py-2 border border-[var(--hairline)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--signal)] focus:border-transparent text-sm bg-white"
      />
    </div>
  );
}

export function Select({ label, options, ...props }: any) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-[var(--ink)] mb-1.5">{label}</label>
      <select
        {...props}
        className="w-full px-3 py-2 border border-[var(--hairline)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--signal)] focus:border-transparent text-sm bg-white"
      >
        <option value="">Select an option</option>
        {options.map((opt: any) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

export function TextArea({ label, ...props }: any) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-[var(--ink)] mb-1.5">{label}</label>
      <textarea
        {...props}
        rows={4}
        className="w-full px-3 py-2 border border-[var(--hairline)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--signal)] focus:border-transparent text-sm bg-white"
      />
    </div>
  );
}
