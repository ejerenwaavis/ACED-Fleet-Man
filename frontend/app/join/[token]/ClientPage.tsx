'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/components/fleet/AuthProvider';
import { Btn } from '@/components/fleet/UI';
import { ShieldCheck, Loader2 } from 'lucide-react';

export default function JoinInvitePage({ params }: { params: { token: string } }) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  
  const [inviteDetails, setInviteDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    // Fetch invite details
    apiFetch(`/api/invites/${params.token}`)
      .then(res => res.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        setInviteDetails(data);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [params.token]);

  const handleClaim = async () => {
    if (!user) {
      router.push(`/login?redirect=/join/${params.token}`);
      return;
    }

    setClaiming(true);
    try {
      const res = await apiFetch(`/api/invites/validate/${params.token}`, {
        method: 'POST'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      // Redirect based on role
      window.location.href = data.entity.entityType === 'msp' ? '/mechanic' : '/';
    } catch (err: any) {
      setError(err.message);
    } finally {
      setClaiming(false);
    }
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-[var(--canvas)] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--signal)]" />
      </div>
    );
  }

  if (error && !inviteDetails) {
    return (
      <div className="min-h-screen bg-[var(--canvas)] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl border border-[var(--hairline)] p-8 text-center shadow-lg">
          <div className="w-16 h-16 bg-[var(--red-bg)] text-[var(--red)] rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="w-8 h-8" />
          </div>
          <h1 className="font-display font-bold text-2xl text-[var(--ink)] mb-2">Invalid Invite</h1>
          <p className="text-[var(--steel)] mb-6">{error}</p>
          <Btn variant="primary" className="w-full justify-center" onClick={() => router.push('/')}>Go Home</Btn>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--canvas)] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl border border-[var(--hairline)] p-8 text-center shadow-lg overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-[var(--signal)]"></div>
        
        <div className="w-20 h-20 bg-[var(--signal-dim)] text-[var(--signal)] rounded-full flex items-center justify-center mx-auto mb-6">
          <ShieldCheck className="w-10 h-10" />
        </div>
        
        <h1 className="font-display font-bold text-3xl text-[var(--ink)] mb-2">You're Invited!</h1>
        <p className="text-[var(--steel)] mb-6 text-lg">
          You have been invited to join <strong className="text-[var(--ink)]">{inviteDetails?.entityName}</strong> as a <strong className="text-[var(--ink)] capitalize">{inviteDetails?.role}</strong>.
        </p>

        {error && (
          <div className="mb-6 p-3 bg-[var(--red-bg)] text-[var(--red)] rounded-lg text-sm">
            {error}
          </div>
        )}

        {!user ? (
          <div className="space-y-4">
            <p className="text-sm text-[var(--steel-light)]">Please log in or create an account to accept.</p>
            <Btn variant="primary" className="w-full justify-center h-12 text-lg" onClick={handleClaim}>Log In to Accept</Btn>
          </div>
        ) : user.entityId ? (
          <div className="p-4 bg-[var(--amber-bg)] text-[var(--amber)] rounded-lg text-sm font-semibold">
            You are already part of an organization. You cannot accept this invite.
          </div>
        ) : (
          <Btn 
            variant="primary" 
            className="w-full justify-center h-12 text-lg" 
            onClick={handleClaim}
            disabled={claiming}
          >
            {claiming ? 'Accepting...' : 'Accept Invite'}
          </Btn>
        )}
      </div>
    </div>
  );
}
