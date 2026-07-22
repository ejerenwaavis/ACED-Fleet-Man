'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { useAuth } from '@/components/fleet/AuthProvider';
import { Btn } from '@/components/fleet/UI';
import { Truck, ShieldCheck, CalendarCheck, Loader2, AlertTriangle, FileText } from 'lucide-react';
import { format } from 'date-fns';

export default function PublicTruckProfilePage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  
  const [vehicle, setVehicle] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch(`/api/public/vehicles/${params.id}`)
      .then(res => res.json())
      .then(data => {
        if (data.error) throw new Error(data.error);
        setVehicle(data);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [params.id]);

  const [walkthroughs, setWalkthroughs] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'profile' | 'history'>('profile');
  const [expandedRecord, setExpandedRecord] = useState<string | null>(null);

  useEffect(() => {
    if (user && activeTab === 'history' && walkthroughs.length === 0) {
      apiFetch(`/api/vehicles/${params.id}/walkthroughs`)
        .then(res => res.json())
        .then(data => {
          if (!data.error) setWalkthroughs(data);
        })
        .catch(console.error);
    }
  }, [user, activeTab, params.id, walkthroughs.length]);

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-[var(--canvas)] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--signal)]" />
      </div>
    );
  }

  if (error || !vehicle) {
    return (
      <div className="min-h-screen bg-[var(--canvas)] flex items-center justify-center p-4">
        <div className="text-center">
          <Truck className="w-12 h-12 text-[var(--steel-light)] mx-auto mb-4" />
          <h1 className="font-display font-bold text-2xl text-[var(--ink)] mb-2">Truck Not Found</h1>
          <p className="text-[var(--steel)]">This vehicle profile does not exist.</p>
        </div>
      </div>
    );
  }

  const isDotValid = vehicle.dotInspectionExpiry && new Date(vehicle.dotInspectionExpiry) > new Date();
  const isRegValid = vehicle.registrationExpiry && new Date(vehicle.registrationExpiry) > new Date();

  return (
    <div className="min-h-screen bg-[var(--canvas)] p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-2xl border border-[var(--hairline)] overflow-hidden shadow-sm">
          {/* Header */}
          <div className="bg-[var(--ink)] p-8 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--signal)] rounded-bl-full opacity-20 pointer-events-none"></div>
            
            <div className="flex justify-between items-start mb-6">
              <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/20">
                <Truck className="w-8 h-8 text-white" />
              </div>
              <div className="bg-white/10 px-3 py-1 rounded-full text-xs font-semibold border border-white/20 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-green-400" />
                {vehicle.entityName}
              </div>
            </div>
            
            <div className="text-sm font-semibold tracking-widest text-[var(--steel-light)] uppercase mb-1">
              Vehicle Profile
            </div>
            <h1 className="font-display font-bold text-4xl text-white mb-2">
              Truck #{vehicle.truckNumber}
            </h1>
            <div className="text-sm text-white/60 font-mono">
              VIN: {vehicle.vin}
            </div>
          </div>

          {/* Tabs */}
          {user && (
            <div className="flex border-b border-[var(--hairline)] bg-[var(--surface)] px-6">
              <button 
                className={`py-4 px-4 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'profile' ? 'border-[var(--signal)] text-[var(--ink)]' : 'border-transparent text-[var(--steel)] hover:text-[var(--ink-2)]'}`}
                onClick={() => setActiveTab('profile')}
              >
                Overview
              </button>
              <button 
                className={`py-4 px-4 text-sm font-semibold border-b-2 transition-colors ${activeTab === 'history' ? 'border-[var(--signal)] text-[var(--ink)]' : 'border-transparent text-[var(--steel)] hover:text-[var(--ink-2)]'}`}
                onClick={() => setActiveTab('history')}
              >
                Inspection History
              </button>
            </div>
          )}

          {/* Body */}
          <div className="p-6 md:p-8 space-y-6 min-h-[300px]">
            {activeTab === 'profile' && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* DOT Status */}
                  <div className={`p-4 rounded-xl border ${isDotValid ? 'bg-[var(--green-bg)] border-green-200' : 'bg-[var(--red-bg)] border-red-200'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      {isDotValid ? <ShieldCheck className="w-5 h-5 text-[var(--green)]" /> : <AlertTriangle className="w-5 h-5 text-[var(--red)]" />}
                      <h3 className={`font-semibold ${isDotValid ? 'text-[var(--green)]' : 'text-[var(--red)]'}`}>DOT Inspection</h3>
                    </div>
                    <div className="text-sm text-[var(--ink)]">
                      {vehicle.dotInspectionExpiry 
                        ? (isDotValid ? `Valid until ${format(new Date(vehicle.dotInspectionExpiry), 'MMM d, yyyy')}` : `Expired on ${format(new Date(vehicle.dotInspectionExpiry), 'MMM d, yyyy')}`)
                        : 'No record found'}
                    </div>
                  </div>

                  {/* Reg Status */}
                  <div className={`p-4 rounded-xl border ${isRegValid ? 'bg-[var(--green-bg)] border-green-200' : 'bg-[var(--red-bg)] border-red-200'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      {isRegValid ? <CalendarCheck className="w-5 h-5 text-[var(--green)]" /> : <AlertTriangle className="w-5 h-5 text-[var(--red)]" />}
                      <h3 className={`font-semibold ${isRegValid ? 'text-[var(--green)]' : 'text-[var(--red)]'}`}>Registration</h3>
                    </div>
                    <div className="text-sm text-[var(--ink)]">
                      {vehicle.registrationExpiry 
                        ? (isRegValid ? `Valid until ${format(new Date(vehicle.registrationExpiry), 'MMM d, yyyy')}` : `Expired on ${format(new Date(vehicle.registrationExpiry), 'MMM d, yyyy')}`)
                        : 'No record found'}
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-[var(--hairline)]">
                  {user ? (
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Btn variant="primary" icon={FileText} className="flex-1 justify-center h-12" onClick={() => router.push(`/?action=new_request&vehicle=${vehicle._id}`)}>
                        Submit Maintenance Request
                      </Btn>
                      <Btn variant="ghost" className="h-12 justify-center" onClick={() => router.push('/')}>
                        Dashboard
                      </Btn>
                    </div>
                  ) : (
                    <div className="text-center p-6 bg-[var(--surface)] border border-[var(--hairline)] rounded-xl">
                      <p className="text-[var(--steel)] mb-4">You must be logged in to submit a maintenance request or view full documentation.</p>
                      <Btn variant="outline" className="w-full justify-center" onClick={() => router.push(`/login?redirect=/truck/${params.id}`)}>
                        Log In
                      </Btn>
                    </div>
                  )}
                </div>
              </>
            )}

            {activeTab === 'history' && (
              <div className="space-y-4 relative">
                {walkthroughs.length === 0 ? (
                  <div className="text-center p-8 border border-dashed border-[var(--hairline)] rounded-xl text-[var(--steel)]">
                    No walkthroughs recorded for this vehicle yet.
                  </div>
                ) : (
                  <div className="absolute left-6 top-4 bottom-4 w-px bg-[var(--hairline)] -z-10" />
                )}
                {walkthroughs.map((w: any) => {
                  const hasFails = Object.values(w.data || {}).includes('fail') || !!w.maintenanceNote;
                  const isExpanded = expandedRecord === w._id;
                  
                  return (
                    <div key={w._id} className="relative pl-14">
                      {/* Timeline dot */}
                      <div className={`absolute left-[20px] top-4 w-3 h-3 rounded-full border-2 border-white shadow-sm ${hasFails ? 'bg-[var(--red)]' : 'bg-[var(--green)]'}`} />
                      
                      <div className="bg-[var(--surface)] border border-[var(--hairline)] rounded-xl p-4 overflow-hidden">
                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 mb-2 cursor-pointer" onClick={() => setExpandedRecord(isExpanded ? null : w._id)}>
                          <div>
                            <div className="font-semibold text-[var(--ink)]">
                              {format(new Date(w.date), 'MMM d, yyyy h:mm a')}
                            </div>
                            <div className="text-xs text-[var(--steel)] flex items-center gap-2 mt-1">
                              <span>By {w.reporterId?.displayName || 'Unknown Driver'}</span>
                              {w.mileage && (
                                <>
                                  <span className="w-1 h-1 rounded-full bg-[var(--steel-light)]" />
                                  <span>{w.mileage.toLocaleString()} mi</span>
                                </>
                              )}
                            </div>
                          </div>
                          <div className={`text-xs font-semibold px-2 py-1 rounded-md ${hasFails ? 'bg-[var(--red-bg)] text-[var(--red)]' : 'bg-[var(--green-bg)] text-[var(--green)]'}`}>
                            {hasFails ? 'Issues Found' : 'All Clear'}
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="mt-4 pt-4 border-t border-[var(--hairline)] space-y-3 animate-in fade-in slide-in-from-top-2">
                            {w.maintenanceNote && (
                              <div className="p-3 bg-[var(--red-bg)] rounded-lg border border-red-100 mb-3">
                                <div className="text-xs font-bold text-[var(--red)] mb-1 uppercase tracking-wider">Maintenance Note</div>
                                <div className="text-sm text-[var(--ink)]">{w.maintenanceNote}</div>
                              </div>
                            )}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {Object.entries(w.data || {}).map(([key, value]) => (
                                <div key={key} className="flex justify-between items-center p-2 rounded bg-[var(--canvas)] text-sm">
                                  <span className="text-[var(--steel)] capitalize">{key.replace(/_/g, ' ')}</span>
                                  <span className={`font-semibold ${value === 'pass' ? 'text-[var(--green)]' : value === 'fail' ? 'text-[var(--red)]' : 'text-[var(--ink)]'}`}>
                                    {String(value)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
