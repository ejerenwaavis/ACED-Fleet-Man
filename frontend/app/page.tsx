'use client';

import React, { useEffect, useState } from "react";
import { Truck, Wrench, ShieldCheck, Moon, CalendarCheck, Plus, AlertTriangle, CheckCircle2, FileText } from "lucide-react";
import { PageHeader, Btn, StatTag, ManifestTag } from "@/components/fleet/UI";
import { NewMaintenanceRequestModal } from "@/components/fleet/NewMaintenanceRequestModal";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/components/fleet/AuthProvider";

export default function Dashboard() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [templates, setTemplates] = useState<any[]>([]);
  const [activeMsps, setActiveMsps] = useState<any[]>([]);
  const [isMaintenanceOpen, setIsMaintenanceOpen] = useState(false);
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && user?.role === 'mechanic') {
      router.replace('/mechanic');
    }
  }, [user, authLoading, router]);

  const fetchData = () => {
    apiFetch(`/api/dashboard-data`)
      .then(res => res.json())
      .then(d => setData(d))
      .catch(console.error);
      
    apiFetch(`/api/walkthrough-templates`)
      .then(res => res.json())
      .then(res => {
        if(Array.isArray(res)) setTemplates(res);
      })
      .catch(console.error);

    apiFetch(`/api/dsp/active-msps`)
      .then(res => res.json())
      .then(res => {
        if(Array.isArray(res)) setActiveMsps(res);
      })
      .catch(console.error);
  };

  useEffect(() => {
    fetchData();
  }, []);



  if (!data) {
    return <div className="flex items-center justify-center py-20 text-[var(--steel)]">Loading dashboard...</div>;
  }

  const { tasks, maintenanceAlerts, registrationAlerts, vehicles } = data;
  const dueForOil = maintenanceAlerts || [];
  const dueForRegistration = registrationAlerts || [];
  
  // Calculate stats
  const totalVehicles = vehicles.length;
  const activeMaintenance = vehicles.filter((v: any) => v.status === 'in shop').length;
  const pendingMMRs = tasks.filter((t: any) => t.category === 'walkthrough-issue').length; // approximation
  const fleetHealth = Math.round(((totalVehicles - activeMaintenance) / totalVehicles) * 100) || 100;

  return (
    <div>
      <PageHeader
        eyebrow="Dashboard"
        title="Fleet Overview"
        subtitle="Current status of operations"
        right={
          <div className="flex gap-2 flex-wrap justify-end">
            {templates.map(tmpl => (
              <Btn key={tmpl._id} variant="ghost" icon={FileText} onClick={() => router.push(`/walkthrough?id=${tmpl._id}`)}>{tmpl.name}</Btn>
            ))}
            <Btn variant="primary" icon={Plus} onClick={() => setIsMaintenanceOpen(true)}>New maintenance request</Btn>
          </div>
        }
      />

      <NewMaintenanceRequestModal 
        isOpen={isMaintenanceOpen} 
        onClose={() => setIsMaintenanceOpen(false)} 
        vehicles={vehicles} 
        activeMsps={activeMsps} 
        onSuccess={fetchData} 
      />

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

      {dueForRegistration.length > 0 && (
        <div className="rounded-xl p-5 mb-6 border flex gap-4 bg-[#fef2f2] border-[#fecaca]">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-[#ef4444]" />
          <div className="flex-1">
            <div className="font-semibold text-sm mb-2 text-[#b91c1c]">
              {dueForRegistration.length} vehicles have expiring registrations
            </div>
            <div className="flex flex-wrap gap-2">
              {dueForRegistration.map((t: any) => (
                <div key={t._id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-[#fecaca]">
                  <ManifestTag route={t.routeNumber} id={t.truckNumber} />
                  <span className="text-xs font-mono text-[#ef4444]">
                    Exp: {new Date(t.registrationExpiry).toLocaleDateString()}
                  </span>
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
