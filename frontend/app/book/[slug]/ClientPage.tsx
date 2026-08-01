'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/components/fleet/AuthProvider';
import { Btn } from '@/components/fleet/UI';
import { MapPin, ShieldCheck, Mail, Loader2, Wrench } from 'lucide-react';

export default function PublicBookingPage({ params }: { params: { slug: string } }) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  
  const [entity, setEntity] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch(`/api/public/entity/${params.slug}`)
      .then(res => res.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        setEntity(data);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [params.slug]);

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-[var(--canvas)] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--signal)]" />
      </div>
    );
  }

  if (error || !entity) {
    return (
      <div className="min-h-screen bg-[var(--canvas)] flex items-center justify-center p-4">
        <div className="text-center">
          <Wrench className="w-12 h-12 text-[var(--steel-light)] mx-auto mb-4" />
          <h1 className="font-display font-bold text-2xl text-[var(--ink)] mb-2">Vendor Not Found</h1>
          <p className="text-[var(--steel)]">This public profile doesn't exist or has been disabled.</p>
        </div>
      </div>
    );
  }

  const handleBook = () => {
    if (!user) {
      router.push(`/login?redirect=/book/${params.slug}`);
    } else {
      // In a real flow, this could open a pre-filled NewMaintenanceRequestModal
      // For now, redirect to dashboard or service page to submit
      router.push(`/?action=new_request&vendor=${entity._id}`);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--canvas)]">
      {/* Hero Section */}
      <div className="bg-[var(--ink)] pt-20 pb-24 px-4 text-center relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-[var(--signal)] rounded-bl-full opacity-10"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-[var(--signal)] rounded-tr-full opacity-10"></div>
        
        <div className="max-w-2xl mx-auto relative z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 text-white text-xs font-semibold mb-6 border border-white/20">
            <ShieldCheck className="w-3.5 h-3.5 text-green-400" />
            Verified Fleetman Partner
          </div>
          <h1 className="font-display font-bold text-4xl md:text-5xl text-white mb-6">
            {entity.name}
          </h1>
          <p className="text-lg text-white/80 max-w-xl mx-auto">
            {entity.description || "Professional fleet maintenance and repair services."}
          </p>
        </div>
      </div>

      {/* Content Section */}
      <div className="max-w-2xl mx-auto px-4 -mt-12 relative z-20">
        <div className="bg-white rounded-2xl border border-[var(--hairline)] p-6 md:p-8 shadow-sm">
          
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 pb-8 border-b border-[var(--hairline)]">
            <div className="space-y-3">
              <div className="flex items-start gap-3 text-[var(--steel)]">
                <MapPin className="w-5 h-5 shrink-0 mt-0.5 text-[var(--signal)]" />
                <span>{entity.address || "Local Area"}</span>
              </div>
            </div>
            
            <div className="shrink-0 w-full md:w-auto">
              <Btn variant="primary" className="w-full md:w-auto h-12 text-lg px-8" onClick={handleBook}>
                {user ? "Request Quote" : "Log in to Book"}
              </Btn>
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-[var(--ink)] mb-4">About Our Services</h3>
            <p className="text-[var(--steel)] leading-relaxed mb-6">
              We specialize in keeping your fleet on the road. By partnering with us through Fleetman, all invoices, maintenance records, and service histories are automatically synced to your dashboard.
            </p>
            
            {entity.specialties && entity.specialties.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {entity.specialties.map((s: string) => (
                  <span key={s} className="px-3 py-1 rounded-full bg-[var(--canvas)] border border-[var(--hairline)] text-sm text-[var(--ink)]">
                    {s}
                  </span>
                ))}
              </div>
            )}
          </div>
          
        </div>
      </div>
    </div>
  );
}
