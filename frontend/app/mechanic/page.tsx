'use client';

import React, { useEffect, useState } from "react";
import { Wrench, CheckCircle2, AlertTriangle, Settings, Truck } from "lucide-react";
import { PageHeader, Btn, JobStatusPill, Modal, Select } from "@/components/fleet/UI";
import { apiFetch } from "@/lib/api";

export default function MechanicDashboard() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [updateStatus, setUpdateStatus] = useState("");
  const [mechanicNotes, setMechanicNotes] = useState("");
  const [laborHours, setLaborHours] = useState("");
  const [laborRate, setLaborRate] = useState("");

  useEffect(() => {
    fetchJobs();
  }, []);

  const fetchJobs = async () => {
    try {
      const res = await apiFetch(`/api/msp/jobs`);
      const data = await res.json();
      setJobs(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openUpdateModal = (job: any) => {
    setSelectedJob(job);
    setUpdateStatus(job.status);
    setMechanicNotes(job.mechanicNotes || "");
    setLaborHours(job.laborHours || "");
    setLaborRate(job.laborRate || "");
    setIsUpdateModalOpen(true);
  };

  const handleUpdate = async (e: any) => {
    e.preventDefault();
    try {
      const body: any = { status: updateStatus, mechanicNotes };
      if (laborHours) body.laborHours = Number(laborHours);
      if (laborRate) body.laborRate = Number(laborRate);

      const res = await apiFetch(`/api/msp/jobs/${selectedJob._id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (res.ok) {
        setIsUpdateModalOpen(false);
        fetchJobs();
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) return <div className="p-8 text-center text-[var(--steel)]">Loading jobs...</div>;

  const newRequests = jobs.filter((j: any) => ['pending', 'assigned'].includes(j.status));
  const inProgress = jobs.filter((j: any) => ['accepted', 'in-progress', 'awaiting-parts'].includes(j.status));
  const completed = jobs.filter((j: any) => ['completed', 'invoiced', 'closed'].includes(j.status));

  const Column = ({ title, items, icon: Icon, color }: any) => (
    <div className="flex-1 min-w-[300px] bg-[var(--surface)] border border-[var(--hairline)] rounded-xl flex flex-col h-full max-h-[calc(100vh-200px)]">
      <div className="p-4 border-b border-[var(--hairline)] flex items-center justify-between sticky top-0 bg-[var(--surface)] rounded-t-xl z-10">
        <div className="flex items-center gap-2 font-semibold text-[var(--ink)]">
          <Icon className="w-5 h-5" style={{ color }} />
          {title}
        </div>
        <div className="bg-[var(--canvas)] px-2 py-0.5 rounded-full text-xs font-bold text-[var(--steel)]">
          {items.length}
        </div>
      </div>
      <div className="p-3 overflow-y-auto flex-1 flex flex-col gap-3 bg-[var(--canvas)] rounded-b-xl">
        {items.map((job: any) => (
          <div key={job._id} className="bg-white p-4 rounded-xl shadow-sm border border-[var(--hairline)] hover:border-[var(--signal)] cursor-pointer transition-colors" onClick={() => openUpdateModal(job)}>
            <div className="flex justify-between items-start mb-3">
              <JobStatusPill status={job.status} />
              <div className="text-xs text-[var(--steel)] font-mono">{new Date(job.createdAt).toLocaleDateString()}</div>
            </div>
            <h4 className="font-bold text-[var(--ink)] mb-1">{job.title}</h4>
            <p className="text-sm text-[var(--steel)] mb-3 line-clamp-2">{job.description}</p>
            
            <div className="flex items-center justify-between pt-3 border-t border-[var(--hairline)]">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--ink)]">
                <Truck className="w-3 h-3 text-[var(--steel)]" />
                {job.vehicleId}
              </div>
              <div className="text-[10px] text-[var(--steel)] uppercase tracking-wider font-semibold bg-[var(--canvas)] px-2 py-1 rounded-md">
                {job.entityId?.name || "Unknown DSP"}
              </div>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <div className="text-center p-6 text-sm text-[var(--steel-light)] border-2 border-dashed border-[var(--hairline)] rounded-xl">
            No jobs in this category
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col">
      <PageHeader 
        eyebrow="Mechanic Shop" 
        title="Job Board" 
        subtitle="Manage your incoming and active repair orders"
        right={
          <Btn variant="ghost" icon={Settings}>Shop Settings</Btn>
        }
      />

      <div className="flex-1 flex gap-6 overflow-x-auto pb-4">
        <Column title="New Requests" items={newRequests} icon={AlertTriangle} color="var(--amber)" />
        <Column title="In Progress" items={inProgress} icon={Wrench} color="var(--signal)" />
        <Column title="Completed" items={completed} icon={CheckCircle2} color="var(--green)" />
      </div>

      <Modal isOpen={isUpdateModalOpen} onClose={() => setIsUpdateModalOpen(false)} title="Update Job Status">
        {selectedJob && (
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="mb-4">
              <h3 className="font-bold text-lg text-[var(--ink)]">{selectedJob.title}</h3>
              <p className="text-sm text-[var(--steel)]">{selectedJob.description}</p>
            </div>
            
            <Select 
              label="Update Status" 
              value={updateStatus}
              onChange={(e: any) => setUpdateStatus(e.target.value)}
              options={[
                { label: "Pending (Needs Review)", value: "pending" },
                { label: "Assigned to us", value: "assigned" },
                { label: "Accept Job", value: "accepted" },
                { label: "In Progress", value: "in-progress" },
                { label: "Awaiting Parts", value: "awaiting-parts" },
                { label: "Completed", value: "completed" },
                { label: "Invoiced", value: "invoiced" },
                { label: "Closed", value: "closed" }
              ]} 
            />

            <div>
              <label className="block text-sm font-medium text-[var(--ink)] mb-1.5">Mechanic Notes</label>
              <textarea 
                className="w-full px-3 py-2 border border-[var(--hairline)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--signal)] text-sm bg-white"
                rows={4}
                value={mechanicNotes}
                onChange={(e) => setMechanicNotes(e.target.value)}
                placeholder="Enter notes about parts ordered, repairs made, etc."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--ink)] mb-1.5">Labor Hours</label>
                <input 
                  type="number"
                  step="0.1"
                  className="w-full px-3 py-2 border border-[var(--hairline)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--signal)] text-sm bg-white"
                  value={laborHours}
                  onChange={(e) => setLaborHours(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--ink)] mb-1.5">Labor Rate ($/hr)</label>
                <input 
                  type="number"
                  step="0.01"
                  className="w-full px-3 py-2 border border-[var(--hairline)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--signal)] text-sm bg-white"
                  value={laborRate}
                  onChange={(e) => setLaborRate(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Btn type="button" variant="ghost" onClick={() => setIsUpdateModalOpen(false)}>Cancel</Btn>
              <Btn type="submit" variant="primary">Save Changes</Btn>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
