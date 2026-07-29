'use client';

import React, { useEffect, useState } from "react";
import { Handshake, CheckCircle2, XCircle, Clock, ShieldCheck, Mail, CheckSquare, Square } from "lucide-react";
import { PageHeader, Btn } from "@/components/fleet/UI";
import { apiFetch } from "@/lib/api";
import { exportToCsv } from "@/lib/exportCsv";
import { useAuth } from "@/components/fleet/AuthProvider";
import { Download } from "lucide-react";

export default function PartnershipsPage() {
  const [partnerships, setPartnerships] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  
  useEffect(() => {
    fetchPartnerships();
  }, []);

  const fetchPartnerships = async () => {
    try {
      const res = await apiFetch(`/api/partnerships`);
      const data = await res.json();
      setPartnerships(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRespond = async (id: string, action: 'accept' | 'reject') => {
    try {
      const res = await apiFetch(`/api/partnerships/${id}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action })
      });
      if (res.ok) fetchPartnerships();
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleAutoAssign = async (id: string, currentVal: boolean) => {
    try {
      const res = await apiFetch(`/api/partnerships/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultAutoAssign: !currentVal })
      });
      if (res.ok) fetchPartnerships();
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleAutoApprove = async (id: string, currentVal: boolean) => {
    try {
      const res = await apiFetch(`/api/partnerships/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ autoApproveSupplementalRequests: !currentVal })
      });
      if (res.ok) fetchPartnerships();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div className="p-8 text-center text-[var(--steel)]">Loading partnerships...</div>;

  return (
    <div className="h-full flex flex-col max-w-5xl mx-auto">
      <PageHeader 
        eyebrow="Network" 
        title="Partnerships" 
        subtitle="Manage your fleet's active bonds and pending requests"
        right={<Btn variant="ghost" icon={Download} onClick={() => {
            const dataToExport = partnerships.map((p: any) => ({
                'Partner Name': (p.dspEntityId?._id === user?.entityId ? p.mspEntityId : p.dspEntityId)?.name || 'Unknown',
                'Status': p.status,
                'Terms': p.terms || 'Standard',
                'Auto Assign': p.defaultAutoAssign ? 'Yes' : 'No',
                'Initiated By': p.initiatedBy === user?.entityId ? 'You' : 'Them'
            }));
            exportToCsv('Partnerships_Export', dataToExport);
        }}>Export CSV</Btn>}
      />

      <div className="space-y-6">
        {partnerships.map((p: any) => {
          const userEntityId = user?.entityId?._id || user?.entityId;
          const initiatedById = p.initiatedBy?._id || p.initiatedBy;
          const isMyRequest = String(initiatedById) === String(userEntityId);
          
          const dspId = p.dspEntityId?._id || p.dspEntityId;
          const isDsp = String(dspId) === String(userEntityId);
          
          const otherParty = isDsp ? p.mspEntityId : p.dspEntityId;
          
          return (
            <div key={p._id} className="bg-[var(--surface)] border border-[var(--hairline)] rounded-xl p-6 shadow-sm flex flex-col md:flex-row gap-6 items-start md:items-center">
              
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="font-display font-bold text-xl text-[var(--ink)]">{otherParty?.name || 'Unknown Entity'}</h3>
                  {otherParty?.isVerified && <ShieldCheck className="w-5 h-5 text-green-500" aria-label="Verified" />}
                  <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                    p.status === 'active' ? 'bg-green-100 text-green-700' :
                    p.status === 'requested' ? 'bg-amber-100 text-amber-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {p.status}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-[var(--steel)] mb-3">
                  <Mail className="w-4 h-4 shrink-0" />
                  {otherParty?.contactEmail || 'No email provided'}
                </div>
                <div className="bg-white p-3 rounded-lg border border-[var(--hairline)] text-sm text-[var(--ink)]">
                  <span className="font-semibold text-[var(--steel)] uppercase text-[10px] tracking-wider block mb-1">Terms / Notes</span>
                  {p.terms || 'Standard terms.'}
                </div>
              </div>

              <div className="flex flex-col gap-3 min-w-[200px] w-full md:w-auto">
                {p.status === 'requested' && (
                  <>
                    {!isMyRequest ? (
                      <div className="flex gap-2 w-full">
                        <Btn variant="ghost" className="flex-1" icon={XCircle} onClick={() => handleRespond(p._id, 'reject')}>Decline</Btn>
                        <Btn variant="primary" className="flex-1" icon={CheckCircle2} onClick={() => handleRespond(p._id, 'accept')}>Accept</Btn>
                      </div>
                    ) : (
                      <div className="text-sm text-center text-[var(--steel)] bg-[var(--canvas)] py-2 rounded-lg border border-[var(--hairline)] flex items-center justify-center gap-2">
                        <Clock className="w-4 h-4" /> Request Sent
                      </div>
                    )}
                  </>
                )}

                {p.status === 'active' && isDsp && (
                  <button 
                    onClick={() => handleToggleAutoAssign(p._id, p.defaultAutoAssign)}
                    className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                      p.defaultAutoAssign ? 'bg-indigo-50 border-indigo-200 text-indigo-800' : 'bg-white border-[var(--hairline)] text-[var(--steel)] hover:border-[var(--steel)]'
                    }`}
                  >
                    <div className="flex flex-col items-start text-left">
                      <span className="font-semibold text-sm">Auto-Assign Jobs</span>
                      <span className="text-[10px] opacity-80">Route new jobs here by default</span>
                    </div>
                    {p.defaultAutoAssign ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                  </button>
                )}

                {p.status === 'active' && isDsp && (
                  <button 
                    onClick={() => handleToggleAutoApprove(p._id, p.autoApproveSupplementalRequests)}
                    className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                      p.autoApproveSupplementalRequests ? 'bg-purple-50 border-purple-200 text-purple-800' : 'bg-white border-[var(--hairline)] text-[var(--steel)] hover:border-[var(--steel)]'
                    }`}
                  >
                    <div className="flex flex-col items-start text-left">
                      <span className="font-semibold text-sm">Auto-Approve Jobs</span>
                      <span className="text-[10px] opacity-80">Trust mechanic to initiate jobs</span>
                    </div>
                    {p.autoApproveSupplementalRequests ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                  </button>
                )}
                
                {p.status === 'active' && (
                   <Btn variant="ghost" className="w-full">Manage Bond</Btn>
                )}
              </div>
            </div>
          );
        })}

        {partnerships.length === 0 && (
          <div className="py-16 text-center border-2 border-dashed border-[var(--hairline)] rounded-2xl">
            <Handshake className="w-12 h-12 text-[var(--steel-light)] mx-auto mb-3 opacity-50" />
            <h3 className="text-lg font-bold text-[var(--ink)] mb-1">No Partnerships</h3>
            <p className="text-[var(--steel)]">You don't have any active or pending partnerships.</p>
          </div>
        )}
      </div>
    </div>
  );
}
