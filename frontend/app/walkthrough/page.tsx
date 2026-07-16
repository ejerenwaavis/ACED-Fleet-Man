'use client';

import React, { useState, useEffect } from "react";
import { Check, X, Send, ArrowLeft } from "lucide-react";
import { PageHeader, Btn, Input } from "@/components/fleet/UI";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import Link from "next/link";

export default function DynamicWalkthrough() {
  const router = useRouter();

  const [template, setTemplate] = useState<any>(null);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState("");
  const [data, setData] = useState<Record<string, any>>({});
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [templateId, setTemplateId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const search = new URLSearchParams(window.location.search);
      const id = search.get('id');
      const vId = search.get('vehicleId');
      setTemplateId(id);
      if (vId) setSelectedVehicle(vId);
      
      if (!id) {
        setLoading(false);
        return;
      }
      
      // Fetch template details
      apiFetch(`/api/walkthrough-templates/${id}`)
        .then(res => res.json())
        .then(data => {
          if (!data.error) setTemplate(data);
        })
        .catch(console.error)
        .finally(() => setLoading(false));

      // Fetch vehicles for selection
      apiFetch(`/api/vehicles-data`)
        .then(res => res.json())
        .then(d => setVehicles(d))
        .catch(console.error);
    }
  }, []);

  const handleSave = async () => {
    if (!selectedVehicle) {
      alert("Please select a vehicle.");
      return;
    }

    // Basic validation
    if (template?.items) {
      for (const item of template.items) {
        if (item.required && !data[item.id]) {
          alert(`Please fill out required field: ${item.label}`);
          return;
        }
      }
    }

    try {
      await apiFetch(`/api/walkthrough-records`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: templateId,
          vehicleId: selectedVehicle,
          data,
          maintenanceNote: notes
        })
      });
      alert('Walkthrough submitted successfully!');
      router.push('/');
    } catch (err) {
      console.error(err);
      alert('Failed to submit walkthrough.');
    }
  };

  if (loading) return <div className="p-10 text-center text-[var(--steel)]">Loading walkthrough...</div>;
  if (!template) return <div className="p-10 text-center text-[var(--red)]">Walkthrough template not found.</div>;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/">
          <Btn variant="ghost" icon={ArrowLeft} className="px-2" />
        </Link>
        <PageHeader eyebrow="Walkthrough" title={template.name} />
      </div>

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

        {selectedVehicle && template.items && template.items.length > 0 && (
          <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4">
            <h3 className="font-semibold text-lg text-[var(--ink)] mb-4">Checklist</h3>
            
            {template.items.map((item: any) => (
              <div key={item.id} className="flex flex-col p-4 bg-[var(--surface)] border border-[var(--hairline)] rounded-xl gap-3">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-[var(--ink)]">
                    {item.label}
                    {item.required && <span className="text-[var(--red)] ml-1">*</span>}
                  </span>
                </div>

                {item.type === 'checkbox' && (
                  <div className="flex w-full p-1 bg-[var(--canvas)] rounded-lg">
                    <button 
                      onClick={() => setData(p => ({ ...p, [item.id]: "pass" }))}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-semibold transition-all ${
                        data[item.id] === "pass" ? "bg-[var(--green)] text-white shadow-sm" : "text-[var(--steel)] hover:bg-white border border-transparent"
                      }`}
                    >
                      <Check className="w-4 h-4" /> Pass
                    </button>
                    <button 
                      onClick={() => setData(p => ({ ...p, [item.id]: "fail" }))}
                      className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-md text-sm font-semibold transition-all ${
                        data[item.id] === "fail" ? "bg-[var(--red)] text-white shadow-sm" : "text-[var(--steel)] hover:bg-white border border-transparent"
                      }`}
                    >
                      <X className="w-4 h-4" /> Fail
                    </button>
                  </div>
                )}

                {(item.type === 'text' || item.type === 'number') && (
                  <Input 
                    type={item.type}
                    value={data[item.id] || ''}
                    onChange={(e: any) => setData(p => ({ ...p, [item.id]: e.target.value }))}
                    placeholder={`Enter ${item.type}...`}
                  />
                )}
              </div>
            ))}

            <div className="pt-4">
              <label className="block text-sm font-semibold text-[var(--ink)] mb-2">Additional Notes / Maintenance Issues</label>
              <textarea 
                className="w-full p-4 border border-[var(--hairline)] rounded-xl bg-[var(--surface)] min-h-[100px] focus:outline-none focus:border-[var(--signal)] resize-none"
                placeholder="Describe any issues..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <div className="flex justify-end pt-4">
              <Btn variant="primary" icon={Send} className="w-full lg:w-auto px-8" onClick={handleSave}>
                Submit Walkthrough
              </Btn>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
