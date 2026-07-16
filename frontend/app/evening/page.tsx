'use client';

import React, { useState, useEffect } from "react";
import { Check, X, Camera, Send } from "lucide-react";
import { PageHeader, Btn, ManifestTag } from "@/components/fleet/UI";
import { useRouter } from "next/navigation";
import { getApiBase, apiFetch } from "@/lib/api";

export default function EveningWalkthrough() {
  const router = useRouter();
  const [vehicles, setVehicles] = useState([]);
  const [checklistItems, setChecklistItems] = useState<any[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState("");
  const [checks, setChecks] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");

  useEffect(() => {
    const API_BASE = getApiBase();
    apiFetch(`/api/vehicles-data`)
      .then(res => res.json())
      .then(d => setVehicles(d))
      .catch(console.error);

    apiFetch(`/api/checklist-items`)
      .then(res => res.json())
      .then(data => {
        setChecklistItems(data.filter((item: any) => item.eveningWalkthrough));
      })
      .catch(console.error);
  }, []);

  const handleSave = async (status: string) => {
    if (!selectedVehicle) return;
    const API_BASE = getApiBase();
    await apiFetch(`/api/walkthrough/evening/autosave`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vehicleId: selectedVehicle,
        date: new Date().toISOString(),
        checks,
        maintenanceNote: notes,
        status
      })
    });
    if (status === 'completed') router.push('/');
  };

  const CheckToggle = ({ label, field }: { label: string, field: string }) => {
    const val = checks[field];
    return (
      <div className="flex flex-col lg:flex-row lg:items-center justify-between p-4 bg-[var(--surface)] border border-[var(--hairline)] rounded-xl gap-3">
        <span className="font-semibold text-[var(--ink)]">{label}</span>
        <div className="flex w-full lg:w-auto p-1 bg-[var(--canvas)] rounded-lg">
          <button 
            onClick={() => setChecks(p => ({ ...p, [field]: "pass" }))}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-semibold transition-all ${
              val === "pass" ? "bg-[var(--green)] text-white shadow-sm" : "text-[var(--steel)] hover:bg-white"
            }`}
          >
            <Check className="w-4 h-4" /> Present
          </button>
          <button 
            onClick={() => setChecks(p => ({ ...p, [field]: "fail" }))}
            className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-semibold transition-all ${
              val === "fail" ? "bg-[var(--red)] text-white shadow-sm" : "text-[var(--steel)] hover:bg-white"
            }`}
          >
            <X className="w-4 h-4" /> Missing
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader
        eyebrow="Workflow"
        title="Evening Walkthrough"
      />

      <div className="space-y-6">
        <div className="bg-[var(--surface)] p-5 rounded-xl border border-[var(--hairline)]">
          <label className="block text-sm font-semibold text-[var(--ink)] mb-2">Select Vehicle</label>
          <select 
            className="w-full p-3 border border-[var(--hairline)] rounded-lg bg-[var(--canvas)] focus:outline-none focus:border-[var(--signal)]"
            value={selectedVehicle}
            onChange={(e) => setSelectedVehicle(e.target.value)}
          >
            <option value="">-- Choose truck --</option>
            {vehicles.map((v: any) => (
              <option key={v._id} value={v._id}>{v.truckNumber} ({v.routeNumber})</option>
            ))}
          </select>
        </div>

        {selectedVehicle && (
          <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4">
            <h3 className="font-semibold text-lg text-[var(--ink)] mb-4">Required Checks</h3>
            {checklistItems.map(item => (
               <CheckToggle key={item._id} label={item.name} field={item.name} />
            ))}
            
            <div className="mt-6">
              <label className="block text-sm font-semibold text-[var(--ink)] mb-2">Additional Notes</label>
              <textarea 
                placeholder="Any routing issues or vehicle damage?"
                className="w-full p-3 border border-[var(--hairline)] rounded-lg bg-[var(--surface)] min-h-[100px] focus:outline-none focus:border-[var(--signal)]"
                value={notes}
                onChange={e => setNotes(e.target.value)}
              />
            </div>
            
            <div className="pt-6 flex gap-3">
              <Btn variant="primary" className="flex-1" icon={Send} onClick={() => handleSave('completed')}>Submit Walkthrough</Btn>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
