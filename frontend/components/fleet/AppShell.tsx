'use client';

import React, { useState, useEffect } from "react";
import { Truck, ClipboardList, FileText, LayoutGrid, Search, Bell, X, Settings, Wrench, Compass, Handshake, Menu, TabletSmartphone } from "lucide-react";
import { NavItem } from "./UI";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "./AuthProvider";
import { apiFetch } from "@/lib/api";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');

  const { user } = useAuth();

  // Debounce search query to URL
  useEffect(() => {
    const timer = setTimeout(() => {
      const currentQ = searchParams.get('q') || '';
      if (searchQuery !== currentQ) {
         const params = new URLSearchParams(searchParams);
         if (searchQuery) {
           params.set('q', searchQuery);
         } else {
           params.delete('q');
         }
         router.push(`${pathname}?${params.toString()}`);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, pathname, router, searchParams]);

  useEffect(() => {
    if (!user) return;
    
    const role = user.role;
    const entityType = user.entityId?.entityType;
    const isMechanic = entityType === 'msp';
    const normalizedPath = pathname.endsWith('/') && pathname.length > 1 ? pathname.slice(0, -1) : pathname;

    if (isMechanic) {
      const restrictedForMsp = ['/', '/roster', '/directory', '/walkthroughs', '/records', '/service'];
      const isRestricted = restrictedForMsp.some(route => 
        route === '/' ? normalizedPath === '/' : normalizedPath.startsWith(route)
      );
      
      if (isRestricted) {
        router.push('/mechanic');
      }
    } else {
      const restrictedForDsp = ['/mechanic'];
      const isRestricted = restrictedForDsp.some(route => normalizedPath.startsWith(route));
      
      if (isRestricted) {
        router.push('/');
      }
    }

    if (role === 'driver' && normalizedPath.startsWith('/settings')) {
       router.push('/');
    }
  }, [user, pathname, router]);

  const allNav = [
    { key: "/", label: "Dispatch", icon: LayoutGrid },
    { key: "/service", label: "Service & Repairs", icon: Wrench },
    { key: "/roster", label: "Fleet roster", icon: Truck },
    { key: "/directory", label: "Service Directory", icon: Compass },
    { key: "/partnerships", label: "Partnerships", icon: Handshake },
    { key: "/mechanic", label: "Job Board", icon: Wrench },
    { key: "/walkthroughs", label: "Walkthroughs", icon: ClipboardList },
    { key: "/records", label: "Maintenance records", icon: FileText },
    { key: "/devices", label: "Assets & Devices", icon: TabletSmartphone },
    { key: "/settings", label: "Settings", icon: Settings },
  ];

  const nav = allNav.filter(n => {
    const role = user?.role;
    const entityType = user?.entityId?.entityType;

    if (n.key === '/settings' && role === 'driver') return false;

    if (entityType === 'msp') {
      if (['/', '/roster', '/directory', '/walkthroughs', '/records', '/service', '/devices'].includes(n.key)) return false;
    } else {
      if (n.key === '/mechanic') return false;
    }

    return true;
  });

  const normalizedPath = pathname.endsWith('/') && pathname.length > 1 ? pathname.slice(0, -1) : pathname;

  if (normalizedPath === '/onboarding' || normalizedPath === '/login') {
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
        </div>
      </div>

      {/* Mobile Search Overlay */}
      {searchOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-[var(--surface)] flex flex-col">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--hairline)]">
            <Search className="w-5 h-5 text-[var(--steelLight)] shrink-0" />
            <input 
              autoFocus 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
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
              active={normalizedPath === n.key} 
              onClick={() => router.push(n.key)} 
            />
          ))}
        </div>
        <div className="mt-auto pt-4 border-t border-[var(--hairline-dark)]">
          <div className="flex items-center gap-2 px-2 py-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold bg-[var(--ink-3)] text-white">
              {user?.displayName ? user.displayName.substring(0,2).toUpperCase() : 'U'}
            </div>
            <div className="flex-1">
              <div className="text-xs font-semibold text-white truncate max-w-[100px]">{user?.displayName || 'Profile'}</div>
            </div>
            <button 
              onClick={async () => {
                await apiFetch(`/api/auth/logout`, { method: 'POST' });
                window.location.href = '/login';
              }}
              className="text-xs text-[var(--steel)] hover:text-white transition-colors"
              title="Logout"
            >
              Logout
            </button>
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
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search trucks, routes, drivers…" 
              className="bg-transparent border-none focus:outline-none text-sm w-full text-[var(--ink)] placeholder:text-[var(--steel-light)]"
            />
          </div>
        </div>
        
        <main className="p-4 lg:p-8 flex-1 w-full max-w-full overflow-x-hidden">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Tab Bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 h-[72px] bg-[var(--ink)] border-t border-[var(--hairline-dark)] flex items-center justify-around px-2 z-40 pb-safe">
        {nav.slice(0, 4).map(n => (
          <div key={n.key} className="flex-1 px-1">
             <NavItem 
                icon={n.icon} 
                label={n.label} 
                active={normalizedPath === n.key} 
                onClick={() => { setMobileMoreOpen(false); router.push(n.key); }} 
              />
          </div>
        ))}
        {nav.length > 4 && (
          <div className="flex-1 px-1">
             <NavItem 
                icon={Menu} 
                label="More" 
                active={mobileMoreOpen} 
                onClick={() => setMobileMoreOpen(!mobileMoreOpen)} 
              />
          </div>
        )}
      </div>

      {/* Mobile More Menu */}
      {mobileMoreOpen && (
        <div className="lg:hidden fixed inset-0 z-30 bg-black/50" onClick={() => setMobileMoreOpen(false)}>
          <div className="absolute bottom-[72px] left-0 right-0 bg-[var(--ink)] rounded-t-2xl p-4 border-t border-[var(--hairline-dark)]" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-[var(--hairline-dark)]">
              <h3 className="font-semibold text-white">More Options</h3>
              <button onClick={() => setMobileMoreOpen(false)}><X className="w-5 h-5 text-[var(--steel)]" /></button>
            </div>
            <div className="flex flex-col gap-1">
              {nav.slice(4).map(n => (
                <button
                  key={n.key}
                  onClick={() => { setMobileMoreOpen(false); router.push(n.key); }}
                  className="flex items-center gap-3 w-full p-3 rounded-lg text-white"
                  style={{ background: normalizedPath === n.key ? "var(--ink-3)" : "transparent" }}
                >
                  <n.icon className="w-5 h-5" style={{ color: normalizedPath === n.key ? "var(--signal)" : "#6B7690" }} />
                  <span className="font-medium text-sm">{n.label}</span>
                </button>
              ))}
              <div className="mt-4 pt-4 border-t border-[var(--hairline-dark)]">
                 <button 
                  onClick={async () => {
                    await apiFetch(`/api/auth/logout`, { method: 'POST' });
                    window.location.href = '/login';
                  }}
                  className="w-full py-3 text-center rounded-lg bg-[var(--ink-3)] text-white font-semibold text-sm"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
    </div>
  );
}
