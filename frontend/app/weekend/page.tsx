'use client';

import React, { useState, useEffect } from "react";
import { Check, X, Send } from "lucide-react";
import { PageHeader, Btn } from "@/components/fleet/UI";
import { useRouter } from "next/navigation";

export default function WeekendWalkthrough() {
  const router = useRouter();
  const [vehicles, setVehicles] = useState([]);
  const [checklistItems, setChecklistItems] = useState<any[]>([]);
  const [formData, setFormData] = useState<Record<string, string>>({
    vehicleId: "",
    mileage: "",
    bodyDamage: "",
    notes: ""
  });

  useEffect(() => {
    const API_BASE = typeof window !== 'undefined' && window.location.port === '3001' ? 'http://localhost:3000' : '';
    fetch(`${API_BASE}/api/vehicles-data`)
      .then(res => res.json())
      .then(d => setVehicles(d))
      .catch(console.error);

    fetch(`${API_BASE}/api/checklist-items`)
      .then(res => res.json())
      .then(data => {
        setChecklistItems(data.filter((item: any) => item.weekendWalkthrough));
      })
      .catch(console.error);
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.vehicleId) return;
    
    const API_BASE = typeof window !== 'undefined' && window.location.port === '3001' ? 'http://localhost:3000' : '';
    await fetch(`${API_BASE}/api/walkthrough/weekend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });
    
    router.push('/');
  };

  const updateField = (field: string, val: string) => {
    setFormData(p => ({ ...p, [field]: val }));
  };

  const AssetCheck = ({ label, fieldPrefix }: { label: string, fieldPrefix: string }) => {
    const statusField = `${fieldPrefix}Status` as keyof typeof formData;
    const notesField = `${fieldPrefix}Notes` as keyof typeof formData;
    const statusVal = formData[statusField];
    
    return (
      <div className="bg-[var(--surface)] border border-[var(--hairline)] rounded-xl overflow-hidden">
        <div className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <span className="font-semibold text-[var(--ink)]">{label}</span>
          <div className="flex w-full lg:w-64 p-1 bg-[var(--canvas)] rounded-lg">
            <button 
              type="button"
              onClick={() => updateField(statusField, "pass")}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-semibold transition-all ${
                statusVal === "pass" ? "bg-[var(--green)] text-white shadow-sm" : "text-[var(--steel)] hover:bg-white"
              }`}
            >
              <Check className="w-4 h-4" /> Pass
            </button>
            <button 
              type="button"
              onClick={() => updateField(statusField, "fail")}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-semibold transition-all ${
                statusVal === "fail" ? "bg-[var(--red)] text-white shadow-sm" : "text-[var(--steel)] hover:bg-white"
              }`}
            >
              <X className="w-4 h-4" /> Fail
            </button>
          </div>
        </div>
        {statusVal === "fail" && (
          <div className="p-4 pt-0 bg-red-50/30 border-t border-[var(--hairline)]">
            <textarea 
              placeholder={`Describe the issue with ${label.toLowerCase()}...`}
              className="w-full p-3 border border-[var(--hairline)] rounded-lg bg-white text-sm focus:outline-none focus:border-[var(--red)]"
              rows={2}
              value={formData[notesField]}
              onChange={(e) => updateField(notesField, e.target.value)}
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-3xl mx-auto">
      <PageHeader eyebrow="Inspection" title="Weekend Walkthrough" />

      <form onSubmit={handleSave} className="space-y-6">
        <div className="bg-[var(--surface)] p-5 rounded-xl border border-[var(--hairline)] space-y-4">
          <div>
            <label className="block text-sm font-semibold text-[var(--ink)] mb-2">Select Vehicle</label>
            <select 
              className="w-full p-3 border border-[var(--hairline)] rounded-lg bg-[var(--canvas)] focus:outline-none focus:border-[var(--signal)]"
              value={formData.vehicleId}
              onChange={(e) => updateField("vehicleId", e.target.value)}
              required
            >
              <option value="">-- Choose truck --</option>
              {vehicles.map((v: any) => (
                <option key={v._id} value={v._id}>{v.truckNumber} ({v.routeNumber})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-[var(--ink)] mb-2">Current Mileage</label>
            <input 
              type="number"
              className="w-full p-3 border border-[var(--hairline)] rounded-lg bg-[var(--canvas)] focus:outline-none focus:border-[var(--signal)]"
              placeholder="e.g. 150000"
              value={formData.mileage}
              onChange={(e) => updateField("mileage", e.target.value)}
              required
            />
          </div>
        </div>

        {formData.vehicleId && (
          <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4">
            <h3 className="font-semibold text-lg text-[var(--ink)] mb-4">Asset Checks</h3>
            {checklistItems.map(item => (
              <AssetCheck key={item._id} label={item.name} fieldPrefix={item.name} />
            ))}
            
            <div className="mt-6 space-y-4 bg-[var(--surface)] p-5 rounded-xl border border-[var(--hairline)]">
              <div>
                <label className="block text-sm font-semibold text-[var(--ink)] mb-2">Body Damage</label>
                <textarea 
                  placeholder="Note any scratches, dents, etc."
                  className="w-full p-3 border border-[var(--hairline)] rounded-lg bg-[var(--canvas)] min-h-[80px] focus:outline-none focus:border-[var(--signal)]"
                  value={formData.bodyDamage}
                  onChange={e => updateField("bodyDamage", e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-[var(--ink)] mb-2">Additional Notes</label>
                <textarea 
                  placeholder="Any other observations?"
                  className="w-full p-3 border border-[var(--hairline)] rounded-lg bg-[var(--canvas)] min-h-[80px] focus:outline-none focus:border-[var(--signal)]"
                  value={formData.notes}
                  onChange={e => updateField("notes", e.target.value)}
                />
              </div>
            </div>
            
            <div className="pt-6">
              <Btn type="submit" variant="primary" className="w-full" icon={Send}>Submit Inspection</Btn>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
