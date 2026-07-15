'use client';

import React, { useState } from "react";
import { Truck, Moon, CalendarCheck, FileText, LayoutGrid, Search, Bell, X, Settings } from "lucide-react";
import { NavItem } from "./UI";
import { usePathname, useRouter } from "next/navigation";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [searchOpen, setSearchOpen] = useState(false);

  const nav = [
    { key: "/", label: "Dispatch", icon: LayoutGrid },
    { key: "/roster", label: "Fleet roster", icon: Truck },
    { key: "/evening", label: "Evening walkthrough", icon: Moon },
    { key: "/weekend", label: "Weekend inspection", icon: CalendarCheck },
    { key: "/records", label: "Maintenance records", icon: FileText },
    { key: "/settings", label: "Settings", icon: Settings },
  ];

  if (pathname === '/onboarding' || pathname === '/login') {
    return <div className="bg-[var(--canvas)] min-h-screen">{children}</div>;
  }

  return (
    <div className="bg-[var(--canvas)] min-h-screen flex flex-col lg:flex-row pb-[72px] lg:pb-0">
      
      {/* Mobile Top Bar */}
      <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-[var(--surface)] border-b border-[var(--hairline)] sticky top-0 z-40">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--signal)]">
            <Truck className="w-4 h-4 text-white" />
          </div>
          <span className="font-display text-lg font-bold text-[var(--ink)]">
            ACED<span className="text-[var(--signal)]">Fleet</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setSearchOpen(true)} className="w-9 h-9 rounded-lg border border-[var(--hairline)] flex items-center justify-center">
            <Search className="w-4 h-4 text-[var(--steel)]" />
          </button>
          <button className="w-9 h-9 rounded-lg border border-[var(--hairline)] flex items-center justify-center">
            <Bell className="w-4 h-4 text-[var(--steel)]" />
          </button>
        </div>
      </div>

      {/* Mobile Search Overlay */}
      {searchOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-[var(--surface)] flex flex-col">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--hairline)]">
            <Search className="w-5 h-5 text-[var(--steelLight)] shrink-0" />
            <input 
              autoFocus 
              placeholder="Search trucks, routes, drivers..." 
              className="flex-1 bg-transparent border-none focus:outline-none text-base"
            />
            <button onClick={() => setSearchOpen(false)} className="p-2">
              <X className="w-6 h-6 text-[var(--ink)]" />
            </button>
          </div>
        </div>
      )}

      {/* Desktop Sidebar */}
      <div className="hidden lg:flex w-60 shrink-0 flex-col p-4 bg-[var(--ink)] sticky top-0 h-screen">
        <div className="flex items-center gap-2 px-2 py-3 mb-4">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--signal)]">
            <Truck className="w-4.5 h-4.5 text-white" />
          </div>
          <span className="font-display text-[17px] font-bold text-white">
            ACED<span className="text-[var(--signal)]">Fleet</span>
          </span>
        </div>
        <div className="flex flex-col gap-1">
          {nav.map(n => (
            <NavItem 
              key={n.key} 
              icon={n.icon} 
              label={n.label} 
              active={pathname === n.key} 
              onClick={() => router.push(n.key)} 
            />
          ))}
        </div>
        <div className="mt-auto pt-4 border-t border-[var(--hairline-dark)]">
          <div className="flex items-center gap-2 px-2 py-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold bg-[var(--ink-3)] text-white">AE</div>
            <div>
              <div className="text-xs font-semibold text-white">Avis Ejerenwa</div>
              <div className="text-[11px] text-[#6B7690]">Fleet manager</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col w-full">
        {/* Desktop Top Bar */}
        <div className="hidden lg:flex items-center justify-between px-8 py-4 border-b border-[var(--hairline)] bg-[var(--surface)] sticky top-0 z-30">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg w-80 bg-[var(--canvas)]">
            <Search className="w-4 h-4 text-[var(--steel-light)]" />
            <input 
              placeholder="Search trucks, routes, drivers…" 
              className="bg-transparent border-none focus:outline-none text-sm w-full text-[var(--ink)] placeholder:text-[var(--steel-light)]"
            />
          </div>
          <button className="w-9 h-9 rounded-lg border border-[var(--hairline)] flex items-center justify-center bg-white hover:bg-gray-50 cursor-pointer">
            <Bell className="w-4 h-4 text-[var(--steel)]" />
          </button>
        </div>
        
        <main className="p-4 lg:p-8 flex-1 w-full max-w-full overflow-x-hidden">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Tab Bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 h-[72px] bg-[var(--ink)] border-t border-[var(--hairline-dark)] flex items-center justify-around px-2 z-40 pb-safe">
        {nav.map(n => (
          <div key={n.key} className="flex-1 px-1">
             <NavItem 
                icon={n.icon} 
                label={n.label} 
                active={pathname === n.key} 
                onClick={() => router.push(n.key)} 
              />
          </div>
        ))}
      </div>
      
    </div>
  );
}
