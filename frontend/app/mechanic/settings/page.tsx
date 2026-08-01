'use client';

import React, { useEffect, useState } from "react";
import { Settings, Save, CheckCircle2 } from "lucide-react";
import { PageHeader, Btn, Input, TextArea } from "@/components/fleet/UI";
import { apiFetch } from "@/lib/api";

export default function ShopSettingsPage() {
  const [settings, setSettings] = useState<any>({
    autoAcceptRules: false,
    standardHourlyRate: 0,
    workingHours: "",
    listedInDirectory: true,
    description: "",
    contactEmail: "",
    contactPhone: ""
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await apiFetch(`/api/mechanic/settings`);
      const data = await res.json();
      setSettings(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setSuccess(false);
    try {
      const res = await apiFetch(`/api/mechanic/settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings)
      });
      if (res.ok) {
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (e: any) => {
    const { name, value, type, checked } = e.target;
    setSettings((prev: any) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  if (loading) return <div className="p-8 text-center text-[var(--steel)]">Loading settings...</div>;

  return (
    <div className="max-w-3xl mx-auto h-full flex flex-col">
      <PageHeader 
        eyebrow="Mechanic Shop" 
        title="Shop Settings" 
        subtitle="Manage your rates, working hours, and auto-assignment rules."
      />

      <form onSubmit={handleSave} className="bg-[var(--surface)] border border-[var(--hairline)] rounded-xl p-6 shadow-sm space-y-6">
        
        <div>
          <h3 className="font-bold text-lg text-[var(--ink)] mb-4">General Profile</h3>
          <TextArea 
            label="Shop Description" 
            name="description" 
            value={settings.description || ""} 
            onChange={handleChange} 
            placeholder="Tell fleets about your services..." 
          />
          <div className="grid grid-cols-2 gap-4">
            <Input 
              label="Contact Email" 
              name="contactEmail" 
              type="email"
              value={settings.contactEmail || ""} 
              onChange={handleChange} 
            />
            <Input 
              label="Contact Phone" 
              name="contactPhone" 
              value={settings.contactPhone || ""} 
              onChange={handleChange} 
            />
          </div>
        </div>

        <hr className="border-[var(--hairline)]" />

        <div>
          <h3 className="font-bold text-lg text-[var(--ink)] mb-4">Operations & Rates</h3>
          <div className="grid grid-cols-2 gap-4">
            <Input 
              label="Standard Hourly Rate ($)" 
              name="standardHourlyRate" 
              type="number"
              step="0.01"
              value={settings.standardHourlyRate || 0} 
              onChange={handleChange} 
            />
            <Input 
              label="Working Hours" 
              name="workingHours" 
              value={settings.workingHours || ""} 
              onChange={handleChange} 
              placeholder="e.g. Mon-Fri 8am-5pm"
            />
          </div>
        </div>

        <hr className="border-[var(--hairline)]" />

        <div>
          <h3 className="font-bold text-lg text-[var(--ink)] mb-4">Fleet Network Preferences</h3>
          
          <label className="flex items-center gap-3 mb-4 cursor-pointer">
            <input 
              type="checkbox" 
              name="autoAcceptRules" 
              checked={!!settings.autoAcceptRules} 
              onChange={handleChange}
              className="w-5 h-5 text-[var(--signal)] border-gray-300 rounded focus:ring-[var(--signal)]" 
            />
            <div>
              <span className="block font-medium text-[var(--ink)]">Auto-Accept Maintenance Requests</span>
              <span className="text-sm text-[var(--steel)]">Automatically accept jobs routed by active partners.</span>
            </div>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input 
              type="checkbox" 
              name="listedInDirectory" 
              checked={!!settings.listedInDirectory} 
              onChange={handleChange}
              className="w-5 h-5 text-[var(--signal)] border-gray-300 rounded focus:ring-[var(--signal)]" 
            />
            <div>
              <span className="block font-medium text-[var(--ink)]">List in Mechanic Directory</span>
              <span className="text-sm text-[var(--steel)]">Allow fleets to discover you and request partnerships.</span>
            </div>
          </label>
        </div>

        <div className="flex items-center justify-end gap-4 pt-4 border-t border-[var(--hairline)]">
          {success && (
            <span className="flex items-center gap-1.5 text-sm font-semibold text-green-600">
              <CheckCircle2 className="w-4 h-4" /> Saved Successfully
            </span>
          )}
          <Btn type="submit" variant="primary" icon={Save} disabled={saving}>
            {saving ? "Saving..." : "Save Settings"}
          </Btn>
        </div>

      </form>
    </div>
  );
}
