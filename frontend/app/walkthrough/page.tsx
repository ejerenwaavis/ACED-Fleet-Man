'use client';

import React, { useState, useEffect, useRef } from "react";
import { Check, X, Send, ArrowLeft, Loader2 } from "lucide-react";
import { PageHeader, Btn, Input } from "@/components/fleet/UI";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import Link from "next/link";
import { VehicleCarousel } from "@/components/fleet/VehicleCarousel";

export default function DynamicWalkthrough() {
  const router = useRouter();

  const [template, setTemplate] = useState<any>(null);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState("");
  const [data, setData] = useState<Record<string, any>>({});
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [isFetching, setIsFetching] = useState(false);

  const isFetchingDraft = useRef(false);

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

  // Fetch Draft on Vehicle Selection
  useEffect(() => {
    if (!selectedVehicle || !templateId) return;
    
    isFetchingDraft.current = true;
    setIsFetching(true);
    setData({});
    setNotes("");

    apiFetch(`/api/walkthrough-records/draft?templateId=${templateId}&vehicleId=${selectedVehicle}`)
      .then(res => res.json())
      .then(res => {
        if (res.draft) {
          setData(res.draft.data || {});
          setNotes(res.draft.maintenanceNote || "");
        }
      })
      .catch(console.error)
      .finally(() => {
        setIsFetching(false);
        // slight delay before re-enabling autosave to prevent saving stale data immediately
        setTimeout(() => { isFetchingDraft.current = false; }, 200);
      });
  }, [selectedVehicle, templateId]);

  // Auto-Save Effect
  useEffect(() => {
    if (isFetchingDraft.current || !selectedVehicle || !templateId || Object.keys(data).length === 0) return;

    apiFetch(`/api/walkthrough-records`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        templateId,
        vehicleId: selectedVehicle,
        data,
        maintenanceNote: notes,
        status: 'draft'
      })
    }).catch(console.error);
  }, [data, notes, selectedVehicle, templateId]);

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
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3 px-1">
            <label className="block text-sm font-semibold text-[var(--ink)] flex items-center gap-3">
              Select Vehicle for Walkthrough
              <select 
                value={selectedVehicle || ""}
                onChange={(e) => setSelectedVehicle(e.target.value)}
                className="text-sm font-medium bg-[var(--surface)] border border-[var(--hairline)] rounded-md px-2 py-1 outline-none focus:border-[var(--signal)] cursor-pointer shadow-sm"
              >
                <option value="" disabled>Choose...</option>
                {vehicles.map((v: any) => (
                  <option key={v._id} value={v._id}>{v.truckNumber}</option>
                ))}
                <option value="new">+ Add New Truck</option>
              </select>
            </label>
            <span className="text-xs font-normal text-[var(--steel)] hidden sm:block">Scroll, drag, or use arrows to snap</span>
          </div>
          <div className="-mx-4 px-4 overflow-hidden relative">
            <VehicleCarousel 
              vehicles={vehicles} 
              selectedId={selectedVehicle} 
              onSelect={setSelectedVehicle} 
            />
          </div>
        </div>

        {selectedVehicle && template.items && template.items.length > 0 && (
          <div className="space-y-3 animate-in fade-in slide-in-from-bottom-4">
            <h3 className="font-semibold text-lg text-[var(--ink)] mb-4 flex items-center gap-2">
              Checklist
              {isFetching && <Loader2 className="w-5 h-5 animate-spin text-[var(--signal)]" />}
            </h3>
            
            <div className={`space-y-6 transition-opacity duration-200 ${isFetching ? 'opacity-40 pointer-events-none grayscale-[0.2]' : 'opacity-100'}`}>
              <div className="space-y-3">
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
              </div>

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
          </div>
        )}
      </div>
    </div>
  );
}
