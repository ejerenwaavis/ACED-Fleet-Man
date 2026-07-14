'use client';

import React, { useEffect, useState } from "react";
import { Truck, Wrench, ShieldCheck, Moon, CalendarCheck, Plus, AlertTriangle, CheckCircle2, FileText } from "lucide-react";
import { PageHeader, Btn, StatTag, ManifestTag, Modal, Input, Select, TextArea } from "@/components/fleet/UI";
import { useRouter } from "next/navigation";

const API_BASE = typeof window !== 'undefined' && window.location.port === '3001' ? 'http://localhost:3000' : '';

export default function Dashboard() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [isMaintenanceOpen, setIsMaintenanceOpen] = useState(false);

  const fetchData = () => {
    fetch(`${API_BASE}/api/dashboard-data`)
      .then(res => res.json())
      .then(d => setData(d))
      .catch(console.error);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleMaintenanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    
    try {
      await fetch(`${API_BASE}/api/maintenance`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json'
        },
        body: formData
      });
      setIsMaintenanceOpen(false);
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  if (!data) {
    return <div className="flex items-center justify-center py-20 text-[var(--steel)]">Loading dashboard...</div>;
  }

  const { tasks, maintenanceAlerts, vehicles } = data;
  const dueForOil = maintenanceAlerts || [];
  
  // Calculate stats
  const totalVehicles = vehicles.length;
  const activeMaintenance = vehicles.filter((v: any) => v.status === 'in shop').length;
  const pendingMMRs = tasks.filter((t: any) => t.category === 'walkthrough-issue').length; // approximation
  const fleetHealth = Math.round(((totalVehicles - activeMaintenance) / totalVehicles) * 100) || 100;

  return (
    <div>
      <PageHeader
        eyebrow="Dispatch"
        title="Tonight's overview"
        subtitle="Yard closes 9:00 PM"
        right={
          <>
            <Btn variant="ghost" icon={Moon} onClick={() => router.push("/evening")}>Evening walkthrough</Btn>
            <Btn variant="ghost" icon={CalendarCheck} onClick={() => router.push("/weekend")}>Weekend inspection</Btn>
            <Btn variant="primary" icon={Plus} onClick={() => setIsMaintenanceOpen(true)}>New maintenance request</Btn>
          </>
        }
      />

      <Modal isOpen={isMaintenanceOpen} onClose={() => setIsMaintenanceOpen(false)} title="New Maintenance Request">
        <form onSubmit={handleMaintenanceSubmit}>
          <Input label="Title" name="title" required placeholder="Brief issue summary" />
          <Select label="Vehicle" name="vehicleId" required options={vehicles.map((v: any) => ({ label: `${v.truckNumber} - ${v.makeModel || 'Unknown'}`, value: v._id }))} />
          <Select label="Priority" name="priority" required options={[
            { label: 'Low', value: 'Low' },
            { label: 'Medium', value: 'Medium' },
            { label: 'High', value: 'High' }
          ]} />
          <TextArea label="Description" name="description" required placeholder="Detailed description of the issue" />
          <div className="flex justify-end gap-2 mt-6">
            <Btn type="button" variant="ghost" onClick={() => setIsMaintenanceOpen(false)}>Cancel</Btn>
            <Btn type="submit" variant="primary">Submit Request</Btn>
          </div>
        </form>
      </Modal>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatTag label="Total vehicles" value={totalVehicles} accent="var(--ink)" icon={Truck} />
        <StatTag label="Active maintenance" value={activeMaintenance} accent="var(--signal)" icon={Wrench} />
        <StatTag label="Pending MMRs" value={pendingMMRs} accent="var(--amber)" icon={FileText} />
        <StatTag label="Fleet health" value={`${fleetHealth}%`} accent="var(--green)" icon={ShieldCheck} />
      </div>

      {dueForOil.length > 0 && (
        <div className="rounded-xl p-5 mb-6 border flex gap-4 bg-[var(--amber-bg)] border-[#EFD6A8]">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-[var(--amber)]" />
          <div className="flex-1">
            <div className="font-semibold text-sm mb-2 text-[#7A4A05]">
              {dueForOil.length} vehicles are due for an oil change
            </div>
            <div className="flex flex-wrap gap-2">
              {dueForOil.map((t: any) => (
                <div key={t._id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white">
                  <ManifestTag route={t.routeNumber} id={t.truckNumber} />
                  <span className="text-xs font-mono text-[var(--amber)]">Service Due</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border p-5 bg-[var(--surface)] border-[var(--hairline)]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-sm text-[var(--ink)]">Unified task list</h3>
          <span className="text-xs text-[var(--steel-light)]">Walkthroughs, MMRs & requests in one queue</span>
        </div>
        
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-center">
            <CheckCircle2 className="w-9 h-9 mb-3 text-[var(--green)]" />
            <div className="font-semibold text-sm text-[var(--ink)]">Nothing pending</div>
            <div className="text-xs mt-1 text-[var(--steel)]">Every truck's logged in. The yard is locked down for the night.</div>
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map((task: any) => (
              <div key={task._id} className="p-3 border border-[var(--hairline)] rounded-lg flex items-start gap-3">
                <div className={`p-2 rounded-full ${task.category === 'maintenance' ? 'bg-[var(--amber-bg)] text-[var(--amber)]' : 'bg-[var(--signal-dim)] text-[var(--signal)]'}`}>
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-[var(--ink)]">{task.title}</h4>
                  <p className="text-xs text-[var(--steel)]">{task.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
