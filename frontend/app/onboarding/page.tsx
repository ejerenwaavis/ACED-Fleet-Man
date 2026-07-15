'use client';

import React, { useState } from "react";
import { Plus, Search, Building2, UserPlus, CheckCircle2, AlertCircle } from "lucide-react";
import { Btn, Input, Modal } from "@/components/fleet/UI";

const API_BASE = typeof window !== 'undefined' && window.location.hostname === '127.0.0.1' ? 'http://127.0.0.1:3000' : '';

export default function OnboardingPage() {
  const [activeTab, setActiveTab] = useState<'select' | 'create' | 'join'>('select');
  const [entityName, setEntityName] = useState("");
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const handleCreate = async () => {
    if (!entityName.trim()) return setErrorMsg("Entity name is required");
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch(`${API_BASE}/api/onboarding/create-entity`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityName })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      setSuccessMsg("Entity created successfully! Redirecting...");
      setTimeout(() => {
        window.location.href = "/roster";
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!entityName.trim()) return setErrorMsg("Entity name is required");
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await fetch(`${API_BASE}/api/onboarding/request-join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityName })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      setSuccessMsg("Request sent successfully! You will be notified once the Admin approves it.");
      setEntityName("");
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (activeTab === 'select') {
    return (
      <div className="min-h-screen bg-[var(--canvas)] flex items-center justify-center p-4">
        <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl p-8 border border-[var(--hairline)]">
          <div className="text-center mb-10">
            <h1 className="text-3xl font-bold text-[var(--ink)] mb-3">Welcome to ACED Fleet Man</h1>
            <p className="text-[var(--steel)] text-lg">You're almost there! To get started, you need to either create a new Fleet Organization or join an existing one.</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <button 
              onClick={() => setActiveTab('create')}
              className="flex flex-col items-center p-8 border-2 border-[var(--hairline)] rounded-2xl hover:border-blue-500 hover:bg-blue-50/50 transition-all text-left text-[var(--ink)] group"
            >
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Building2 className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold mb-2 text-center">Create a New Fleet</h3>
              <p className="text-[var(--steel)] text-center text-sm">
                I am an owner or administrator. I want to set up a new organization.
              </p>
            </button>

            <button 
              onClick={() => setActiveTab('join')}
              className="flex flex-col items-center p-8 border-2 border-[var(--hairline)] rounded-2xl hover:border-emerald-500 hover:bg-emerald-50/50 transition-all text-left text-[var(--ink)] group"
            >
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <UserPlus className="w-8 h-8 text-emerald-600" />
              </div>
              <h3 className="text-xl font-bold mb-2 text-center">Join an Existing Fleet</h3>
              <p className="text-[var(--steel)] text-center text-sm">
                I am a driver or manager. I want to request access to my company's fleet.
              </p>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--canvas)] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-[var(--hairline)] relative">
        <button 
          onClick={() => { setActiveTab('select'); setErrorMsg(""); setSuccessMsg(""); }}
          className="text-[var(--steel-light)] hover:text-[var(--ink)] text-sm mb-6 flex items-center font-medium"
        >
          &larr; Back to options
        </button>

        <h2 className="text-2xl font-bold text-[var(--ink)] mb-2">
          {activeTab === 'create' ? 'Create Your Fleet' : 'Join a Fleet'}
        </h2>
        <p className="text-[var(--steel)] mb-6 text-sm">
          {activeTab === 'create' 
            ? 'Enter your company or organization name. You will be assigned as the primary Admin.'
            : 'Enter the exact name of the Fleet Organization you want to join. A request will be sent to their Admin.'}
        </p>

        {errorMsg && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 border border-red-200 rounded-lg text-sm flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-sm flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-[var(--ink)] mb-1.5">Fleet / Entity Name</label>
            <Input 
              placeholder={activeTab === 'create' ? "e.g. Acme Logistics" : "Enter fleet name"} 
              value={entityName}
              onChange={(e: any) => setEntityName(e.target.value)}
              disabled={loading || !!successMsg}
              className="h-12 text-lg"
            />
          </div>

          <Btn 
            variant="primary" 
            className="w-full h-12 text-lg mt-4 justify-center" 
            onClick={activeTab === 'create' ? handleCreate : handleJoin}
            disabled={loading || !!successMsg}
          >
            {loading ? 'Processing...' : (activeTab === 'create' ? 'Create Fleet' : 'Request Access')}
          </Btn>
        </div>
      </div>
    </div>
  );
}
