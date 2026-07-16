'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { apiFetch } from '@/lib/api';

interface AuthContextType {
  user: any;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true });

export const useAuth = () => useContext(AuthContext);

// Pages that should NEVER be blocked by the auth guard
const PUBLIC_PAGES = ['/login'];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const normalizedPath = pathname.endsWith('/') && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
    const isPublic = PUBLIC_PAGES.includes(normalizedPath);

    let cancelled = false;

    const checkAuth = async () => {
      try {
        const res = await apiFetch(`/api/auth/me`);

        if (cancelled) return;

        if (!res.ok) {
          if (isPublic) {
            setLoading(false);
            setReady(true);
          } else {
            window.location.href = '/login';
          }
          return;
        }

        const data = await res.json();
        if (cancelled) return;

        const loggedInUser = data.user;
        setUser(loggedInUser);

        if (isPublic) {
          if (loggedInUser.role === 'unassigned') {
            window.location.href = '/onboarding';
          } else {
            window.location.href = '/';
          }
          return;
        }

        // Onboarding redirect logic
        if (loggedInUser.role === 'unassigned' && normalizedPath !== '/onboarding') {
          window.location.href = '/onboarding';
          return;
        }
        if (loggedInUser.role !== 'unassigned' && normalizedPath === '/onboarding') {
          window.location.href = '/';
          return;
        }

        // All good — render children
        setLoading(false);
        setReady(true);
      } catch (err) {
        if (cancelled) return;
        // Network error — redirect to login
        window.location.href = '/login';
      }
    };

    checkAuth();
    return () => { cancelled = true; };
  }, [pathname]);

  if (!ready) {
    return (
      <div className="min-h-screen bg-[var(--canvas)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-gray-200 border-t-blue-500 rounded-full animate-spin"></div>
          <span className="text-sm text-[var(--steel)]">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
