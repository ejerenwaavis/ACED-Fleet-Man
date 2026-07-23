'use client';

import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Truck, Loader2 } from "lucide-react";
import { Btn } from "@/components/fleet/UI";
import { getApiBase } from "@/lib/api";

function LoginContent() {
  const API_BASE = getApiBase();
  const searchParams = useSearchParams();
  const redirect = searchParams?.get('redirect');

  const googleUrl = `${API_BASE}/api/auth/google${redirect ? `?state=${encodeURIComponent(redirect)}` : ''}`;

  return (
    <div className="min-h-screen bg-[var(--canvas)] flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-10 border border-[var(--hairline)] flex flex-col items-center">
        
        <div className="w-16 h-16 rounded-2xl bg-[var(--signal)] flex items-center justify-center mb-6 shadow-xl">
          <Truck className="w-8 h-8 text-white" />
        </div>
        
        <h1 className="text-3xl font-display font-bold text-[var(--ink)] mb-2 text-center">
          ACED<span className="text-[var(--signal)]">Fleet</span>
        </h1>
        <p className="text-[var(--steel)] text-center mb-8">
          Sign in to manage your vehicles, run inspections, and track maintenance records.
        </p>

        <a href={googleUrl} className="w-full">
          <Btn variant="primary" className="w-full h-12 text-lg justify-center shadow-md hover:shadow-lg transition-all">
            <svg className="w-5 h-5 mr-3 bg-white rounded-full" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Sign in with Google
          </Btn>
        </a>

        <p className="mt-8 text-xs text-[var(--steel-light)] text-center">
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[var(--canvas)] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-[var(--signal)]" /></div>}>
      <LoginContent />
    </Suspense>
  );
}
