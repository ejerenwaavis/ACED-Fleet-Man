'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

interface AuthContextType {
  user: any;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true });

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    // We don't block the login page
    if (pathname === '/login') {
      setLoading(false);
      return;
    }

    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) {
          router.push('/login');
          return;
        }

        const data = await res.json();
        const loggedInUser = data.user;
        setUser(loggedInUser);

        if (loggedInUser.role === 'unassigned' && pathname !== '/onboarding') {
          router.push('/onboarding');
        } else if (loggedInUser.role !== 'unassigned' && pathname === '/onboarding') {
          router.push('/');
        } else {
          setLoading(false);
        }
      } catch (err) {
        router.push('/login');
      }
    };

    checkAuth();
  }, [pathname, router]);

  if (loading) {
    return <div className="min-h-screen bg-[var(--canvas)] flex items-center justify-center text-[var(--steel)]">Loading...</div>;
  }

  return (
    <AuthContext.Provider value={{ user, loading }}>
      {children}
    </AuthContext.Provider>
  );
}
