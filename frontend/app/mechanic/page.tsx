'use client';

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Truck, Wrench, AlertTriangle, CheckCircle2, Settings, MapPin, ExternalLink, Image as ImageIcon } from "lucide-react";
import { PageHeader, Btn, JobStatusPill, Modal, Select, Input } from "@/components/fleet/UI";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/components/fleet/AuthProvider";

export default function MechanicDashboard() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [groupByTruck, setGroupByTruck] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [updateStatus, setUpdateStatus] = useState("");
  const [mechanicNotes, setMechanicNotes] = useState("");
  const [laborHours, setLaborHours] = useState("");
  const [laborRate, setLaborRate] = useState("");
  const [mechanicPhotos, setMechanicPhotos] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Mechanic Initiate Job
  const [isInitiateModalOpen, setIsInitiateModalOpen] = useState(false);
  const [initTitle, setInitTitle] = useState("");
  const [initDesc, setInitDesc] = useState("");
  const [initPhotos, setInitPhotos] = useState<File[]>([]);
  const [isInitiating, setIsInitiating] = useState(false);

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
    setMechanicPhotos([]);
    setIsUpdateModalOpen(true);
  };

  const handleUpdate = async (e: any) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("status", updateStatus);
      formData.append("mechanicNotes", mechanicNotes);
      if (laborHours) formData.append("laborHours", laborHours.toString());
      if (laborRate) formData.append("laborRate", laborRate.toString());
      
      mechanicPhotos.forEach((file) => {
        formData.append("mechanicAttachments", file);
      });

      const res = await apiFetch(`/api/msp/jobs/${selectedJob._id}/status`, {
        method: "PATCH",
        body: formData
      });
      if (res.ok) {
        setIsUpdateModalOpen(false);
        fetchJobs();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInitiateJob = async (e: any) => {
    e.preventDefault();
    if (isInitiating || !selectedJob || !initTitle || !initDesc) return;
    setIsInitiating(true);
    try {
      const formData = new FormData();
      formData.append("title", initTitle);
      formData.append("description", initDesc);
      formData.append("vehicleId", selectedJob.vehicleId?._id || selectedJob.vehicleId); // Depending on populate
      formData.append("parentRequestId", selectedJob._id);
      
      initPhotos.forEach((file) => {
        formData.append("mechanicAttachments", file);
      });

      const res = await apiFetch(`/api/msp/jobs/initiate`, {
        method: "POST",
        body: formData
      });
      if (res.ok) {
        setIsInitiateModalOpen(false);
        setInitTitle("");
        setInitDesc("");
        setInitPhotos([]);
        fetchJobs();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsInitiating(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-[var(--steel)]">Loading jobs...</div>;

  const categories = ["All", ...Array.from(new Set(jobs.map((j: any) => j.category).filter(Boolean)))];

  const filteredJobs = jobs.filter((j: any) => selectedCategory === "All" || j.category === selectedCategory);

  const availableJobs = filteredJobs.filter((j: any) => ['pending', 'assigned'].includes(j.status) && (!j.assignedMechanicId || j.assignedMechanicId?._id !== user?._id));
  const myActiveJobs = filteredJobs.filter((j: any) => ['accepted', 'in-progress', 'awaiting-parts'].includes(j.status) && (user?.role !== 'mechanic' || j.assignedMechanicId?._id === user?._id));
  const completed = filteredJobs.filter((j: any) => ['completed', 'invoiced', 'closed'].includes(j.status) && (user?.role !== 'mechanic' || j.assignedMechanicId?._id === user?._id));

  const Column = ({ title, items, icon: Icon, color }: any) => {
    let content;
    
    if (groupByTruck) {
      const grouped: Record<string, any[]> = {};
      items.forEach((j: any) => {
        const key = typeof j.vehicleId === 'object' && j.vehicleId?.truckNumber ? j.vehicleId.truckNumber : (j.vehicleId || 'No Vehicle');
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(j);
      });
      content = Object.entries(grouped).map(([truck, truckJobs]) => (
        <div key={truck} className="mb-4">
          <div className="font-bold text-xs text-[var(--steel)] uppercase tracking-wider mb-2 px-1 border-b border-[var(--hairline)] pb-1 flex items-center gap-1">
            <Truck className="w-3 h-3" /> {truck} ({truckJobs.length})
          </div>
          <div className="space-y-3">
            {truckJobs.map((job: any) => <JobCard key={job._id} job={job} />)}
          </div>
        </div>
      ));
    } else {
      content = items.map((job: any) => <JobCard key={job._id} job={job} />);
    }

    return (
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
          {content}
          {items.length === 0 && (
            <div className="text-center p-6 text-sm text-[var(--steel-light)] border-2 border-dashed border-[var(--hairline)] rounded-xl">
              No jobs in this category
            </div>
          )}
        </div>
      </div>
    );
  };

  const JobCard = ({ job }: { job: any }) => (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-[var(--hairline)] hover:border-[var(--signal)] cursor-pointer transition-colors" onClick={() => openUpdateModal(job)}>
      <div className="flex justify-between items-start mb-3">
        <JobStatusPill status={job.status} />
        <div className="text-xs text-[var(--steel)] font-mono">{new Date(job.createdAt).toLocaleDateString()}</div>
      </div>
      <h4 className="font-bold text-[var(--ink)] mb-1">{job.title}</h4>
      <p className="text-sm text-[var(--steel)] mb-3 line-clamp-2">{job.description}</p>
      
      <div className="flex items-center justify-between pt-3 border-t border-[var(--hairline)]">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--ink)]">
          {job.category && (
            <span className="bg-gray-100 px-1.5 py-0.5 rounded mr-1 text-gray-600">{job.category}</span>
          )}
          {job.requestType === 'Property / Facility Issue' ? (
            <><MapPin className="w-3 h-3 text-[var(--steel)]" /> Property</>
          ) : (
            <><Truck className="w-3 h-3 text-[var(--steel)]" /> {typeof job.vehicleId === 'object' ? job.vehicleId?.truckNumber : (job.vehicleId || 'Vehicle')}</>
          )}
        </div>
        <div className="text-[10px] text-[var(--steel)] uppercase tracking-wider font-semibold bg-[var(--canvas)] px-2 py-1 rounded-md">
          {job.entityId?.name || "Unknown DSP"}
        </div>
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
          <Link href="/mechanic/settings">
            <Btn variant="ghost" icon={Settings}>Shop Settings</Btn>
          </Link>
        }
      />

      <div className="mb-4 flex gap-4 items-center bg-[var(--surface)] p-2 rounded-lg border border-[var(--hairline)]">
        <Select
          value={selectedCategory}
          onChange={(e: any) => setSelectedCategory(e.target.value)}
          options={categories.map(c => ({ label: c, value: c as string }))}
          className="w-48 !mb-0"
        />
        <label className="flex items-center gap-2 text-sm font-medium text-[var(--ink)] cursor-pointer">
          <input 
            type="checkbox" 
            checked={groupByTruck} 
            onChange={(e) => setGroupByTruck(e.target.checked)} 
            className="rounded border-[var(--hairline)] text-[var(--signal)] focus:ring-[var(--signal)]"
          />
          Group by Truck
        </label>
      </div>

      <div className="flex-1 flex gap-6 overflow-x-auto pb-4">
        <Column title="New Requests" items={availableJobs} icon={AlertTriangle} color="var(--amber)" />
        <Column title={user?.role === 'mechanic' ? "My Jobs" : "Active Jobs"} items={myActiveJobs} icon={Wrench} color="var(--signal)" />
        <Column title="Completed" items={completed} icon={CheckCircle2} color="var(--green)" />
      </div>

      <Modal isOpen={isUpdateModalOpen} onClose={() => setIsUpdateModalOpen(false)} title="Update Job Status">
        {selectedJob && (
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="mb-4">
              <h3 className="font-bold text-lg text-[var(--ink)]">{selectedJob.title}</h3>
              <p className="text-sm text-[var(--steel)] mb-3">{selectedJob.description}</p>
              
              {selectedJob.location && (
                <div className="flex items-center gap-2 mb-3 bg-[var(--surface)] p-3 rounded-lg border border-[var(--hairline)]">
                  <MapPin className="w-5 h-5 text-[var(--steel)]" />
                  <span className="flex-1 text-sm font-medium">{selectedJob.location}</span>
                  <a href={`https://maps.google.com/?q=${encodeURIComponent(selectedJob.location)}`} target="_blank" rel="noreferrer" className="text-[var(--signal)] text-sm flex items-center gap-1 hover:underline">
                    Navigate <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}

              {selectedJob.attachments && selectedJob.attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {selectedJob.attachments.map((url: string, i: number) => (
                    <a key={i} href={url} target="_blank" rel="noreferrer" className="w-16 h-16 rounded-lg overflow-hidden border border-[var(--hairline)] block bg-gray-100 flex items-center justify-center relative group">
                       <img src={url} className="w-full h-full object-cover" alt="Attachment" />
                       <div className="absolute inset-0 bg-black/50 hidden group-hover:flex items-center justify-center">
                         <ExternalLink className="w-4 h-4 text-white" />
                       </div>
                    </a>
                  ))}
                </div>
              )}
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

            <div>
              <label className="block text-sm font-medium text-[var(--ink)] mb-1.5">Progress Photos</label>
              <input 
                type="file" 
                multiple 
                accept="image/*"
                onChange={(e) => setMechanicPhotos(Array.from(e.target.files || []))}
                className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[var(--signal)] file:text-white hover:file:bg-[var(--signal-dark)] border border-[var(--hairline)] rounded-lg"
              />
              {mechanicPhotos.length > 0 && (
                <p className="text-xs text-[var(--steel)] mt-1">{mechanicPhotos.length} file(s) selected for upload</p>
              )}
            </div>
            
            {selectedJob.mechanicAttachments && selectedJob.mechanicAttachments.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-[var(--ink)] mb-1.5">Previously Uploaded Progress Photos</label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {selectedJob.mechanicAttachments.map((url: string, i: number) => (
                    <a key={i} href={url} target="_blank" rel="noreferrer" className="w-16 h-16 rounded-lg overflow-hidden border border-[var(--hairline)] block bg-gray-100 flex items-center justify-center relative group">
                       <img src={url} className="w-full h-full object-cover" alt="Mechanic Attachment" />
                       <div className="absolute inset-0 bg-black/50 hidden group-hover:flex items-center justify-center">
                         <ExternalLink className="w-4 h-4 text-white" />
                       </div>
                    </a>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-between items-center pt-4 border-t border-[var(--hairline)]">
              <Btn variant="ghost" onClick={() => {
                setIsUpdateModalOpen(false);
                setIsInitiateModalOpen(true);
              }}>
                + Sub-Job / Parts Request
              </Btn>
              <Btn variant="primary" type="submit" isLoading={isSubmitting}>
                Save Updates
              </Btn>
            </div>
          </form>
        )}
      </Modal>

      <Modal isOpen={isInitiateModalOpen} onClose={() => setIsInitiateModalOpen(false)} title="Initiate Sub-Job / Parts Request">
        <form onSubmit={handleInitiateJob} className="space-y-4">
          <div className="mb-4">
            <p className="text-sm text-[var(--steel)]">
              This will create a new request linked to <strong>{selectedJob?.title}</strong>. Depending on fleet settings, it may require approval.
            </p>
          </div>
          <Input 
            label="Request Title" 
            value={initTitle} 
            onChange={(e: any) => setInitTitle(e.target.value)} 
            placeholder="e.g. Needs new brake pads"
            required
          />
          <div>
            <label className="block text-sm font-medium text-[var(--ink)] mb-1.5">Detailed Description</label>
            <textarea 
              className="w-full px-3 py-2 border border-[var(--hairline)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--signal)] text-sm bg-white"
              rows={4}
              value={initDesc}
              onChange={(e) => setInitDesc(e.target.value)}
              placeholder="Why is this needed? Include part numbers if known."
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--ink)] mb-1.5">Supporting Photos</label>
            <input 
              type="file" 
              multiple 
              accept="image/*"
              onChange={(e) => setInitPhotos(Array.from(e.target.files || []))}
              className="w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[var(--signal)] file:text-white hover:file:bg-[var(--signal-dark)] border border-[var(--hairline)] rounded-lg"
            />
          </div>
          <div className="flex justify-end pt-4 border-t border-[var(--hairline)] mt-6">
            <Btn variant="primary" type="submit" isLoading={isInitiating}>Submit Request</Btn>
          </div>
        </form>
      </Modal>

    </div>
  );
}
