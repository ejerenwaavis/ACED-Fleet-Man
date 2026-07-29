'use client';

import React, { useEffect, useState } from "react";
import { Truck, Wrench, AlertTriangle, CheckCircle2, MapPin, Plus, XCircle, Download, FileText } from "lucide-react";
import { PageHeader, Btn, JobStatusPill, Modal, Input } from "@/components/fleet/UI";
import { NewMaintenanceRequestModal } from "@/components/fleet/NewMaintenanceRequestModal";
import { apiFetch } from "@/lib/api";
import { exportToCsv } from "@/lib/exportCsv";
import { exportRequestCardsToPdf } from "@/lib/exportPdf";
import { useAuth } from "@/components/fleet/AuthProvider";

export default function ServicePage() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isMaintenanceOpen, setIsMaintenanceOpen] = useState(false);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [activeMsps, setActiveMsps] = useState<any[]>([]);
  const currentMonthStr = new Date().toISOString().substring(0, 7);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);
  const [isExportMode, setIsExportMode] = useState(false);
  const [selectedExportIds, setSelectedExportIds] = useState<string[]>([]);
  
  // Modals state
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);
  const [cancelInput, setCancelInput] = useState("");
  const [cancelError, setCancelError] = useState("");
  const [isCancelling, setIsCancelling] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [reqRes, vehRes, mspRes] = await Promise.all([
        apiFetch('/api/fleet/maintenance'),
        apiFetch('/api/vehicles-data'),
        apiFetch('/api/dsp/active-msps')
      ]);
      
      const reqData = await reqRes.json();
      const vehData = await vehRes.json();
      const mspData = await mspRes.json();
      
      if (Array.isArray(reqData)) setRequests(reqData);
      if (Array.isArray(vehData)) setVehicles(vehData);
      if (Array.isArray(mspData)) setActiveMsps(mspData);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filteredRequests = selectedMonth 
    ? requests.filter(r => r.createdAt && r.createdAt.startsWith(selectedMonth))
    : requests;

  useEffect(() => {
    if (!isExportMode) return;
    const visibleRequestIds = new Set(filteredRequests.map((request: any) => request._id));
    setSelectedExportIds(prev => prev.filter(id => visibleRequestIds.has(id)));
  }, [filteredRequests, isExportMode]);

  const newRequests = filteredRequests.filter(r => ['pending', 'assigned'].includes(r.status) && r.approvalStatus !== 'pending_admin_approval');
  const pendingApprovals = filteredRequests.filter(r => r.approvalStatus === 'pending_admin_approval');
  const inProgress = filteredRequests.filter(r => ['accepted', 'in-progress', 'awaiting-parts'].includes(r.status));
  const completed = filteredRequests.filter(r => ['completed', 'invoiced', 'closed'].includes(r.status));

  // Get unique months for the dropdown
  const availableMonths = Array.from(new Set(requests.map(r => r.createdAt?.substring(0, 7)).filter(Boolean))).sort().reverse();
  if (!availableMonths.includes(currentMonthStr)) {
    availableMonths.unshift(currentMonthStr);
  }

  const getExportTruckNumber = (request: any) => {
    if (request.requestType === 'Property / Facility Issue' || !request.vehicleId?.truckNumber) {
      return 'N/A (Property)';
    }
    return request.vehicleId.truckNumber;
  };

  const toExportRequest = (request: any) => {
    const notes = typeof request.mechanicNotes === 'string' ? request.mechanicNotes.trim() : '';
    return {
      title: request.title || 'N/A',
      truckNumber: getExportTruckNumber(request),
      issue: request.description || 'N/A',
      location: request.location?.trim() ? request.location.trim() : 'N/A',
      ...(notes ? { notes } : {})
    };
  };

  const handleRequestExportSelection = (requestId: string, checked: boolean) => {
    const visibleRequestIds = new Set(filteredRequests.map((request: any) => request._id));
    if (!visibleRequestIds.has(requestId)) return;
    if (checked) {
      setSelectedExportIds(prev => (prev.includes(requestId) ? prev : [...prev, requestId]));
      return;
    }
    setSelectedExportIds(prev => prev.filter(id => id !== requestId));
  };

  const handleExportCsv = () => {
    const selectedRequests = filteredRequests.filter((request: any) => selectedExportIds.includes(request._id));
    const rows = selectedRequests.map((request: any) => {
      const row = toExportRequest(request);
      return {
        'Title': row.title,
        'Truck Number': row.truckNumber,
        'Issue': row.issue,
        'Location': row.location,
        'Notes': row.notes || ''
      };
    });
    exportToCsv('Maintenance_Requests_Export', rows);
    setIsExportMode(false);
    setSelectedExportIds([]);
  };

  const handleExportPdf = () => {
    const selectedRequests = filteredRequests.filter((request: any) => selectedExportIds.includes(request._id));
    const rows = selectedRequests.map((request: any) => toExportRequest(request));
    if (exportRequestCardsToPdf('Service & Repairs Export', rows)) {
      setIsExportMode(false);
      setSelectedExportIds([]);
    }
  };

  const openDetails = (job: any) => {
    setSelectedJob(job);
    setIsDetailsModalOpen(true);
  };

  const openCancelModal = (job: any, e: any) => {
    e.stopPropagation();
    setSelectedJob(job);
    setCancelInput("");
    setCancelError("");
    setIsCancelModalOpen(true);
  };

  const confirmCancel = async () => {
    if (cancelInput !== "CANCEL" || !selectedJob) return;
    
    setIsCancelling(true);
    setCancelError("");
    try {
      const res = await apiFetch(`/api/maintenance/${selectedJob._id}/cancel`, { method: 'POST' });
      if (res.ok) {
        setIsCancelModalOpen(false);
        setSelectedJob(null);
        fetchData();
      } else {
        const errorData = await res.json().catch(() => ({}));
        setCancelError(`Failed to cancel request: ${errorData.error || 'Unknown error'}`);
      }
    } catch (err: any) {
      setCancelError(`An error occurred: ${err.message}`);
    } finally {
      setIsCancelling(false);
    }
  };

  const approveRequest = async (e: any) => {
    e.stopPropagation();
    if (!selectedJob) return;
    try {
      const res = await apiFetch(`/api/maintenance/${selectedJob._id}/approve`, { method: 'POST' });
      if (res.ok) {
        setIsDetailsModalOpen(false);
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const sendToNetwork = async (e: any) => {
    e.stopPropagation();
    if (!selectedJob) return;
    try {
      const res = await apiFetch(`/api/maintenance/${selectedJob._id}`, { 
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isInternal: false })
      });
      if (res.ok) {
        setIsDetailsModalOpen(false);
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const Column = ({ title, items, icon: Icon, color }: any) => (
    <div className="flex-1 min-w-[85vw] md:min-w-[300px] snap-center bg-[var(--surface)] border border-[var(--hairline)] rounded-xl flex flex-col h-full max-h-[calc(100vh-200px)] shrink-0">
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
          <div 
            key={job._id} 
            className={`bg-white p-4 rounded-xl shadow-sm border hover:border-[var(--signal)] cursor-pointer transition-colors relative group ${
              isExportMode && selectedExportIds.includes(job._id) ? 'border-[var(--signal)] ring-1 ring-[var(--signal)]' : 'border-[var(--hairline)]'
            }`}
            onClick={() => openDetails(job)}
          >
            <div className="flex justify-between items-start mb-3">
              <JobStatusPill status={job.status} />
              <div className="flex items-center gap-2">
                {isExportMode && (
                  <div onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedExportIds.includes(job._id)}
                      onChange={(e: any) => handleRequestExportSelection(job._id, e.target.checked)}
                      className="w-4 h-4 rounded border-[var(--hairline)] text-[var(--signal)] focus:ring-[var(--signal)]"
                    />
                  </div>
                )}
                <div className="text-xs text-[var(--steel)] font-mono">{new Date(job.createdAt).toLocaleDateString()}</div>
                {['pending', 'assigned'].includes(job.status) && ['admin', 'manager'].includes(user?.role) && (
                  <button 
                    onClick={(e) => openCancelModal(job, e)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-red-500 hover:text-red-700 bg-red-50 hover:bg-red-100 p-1 rounded-md"
                    title="Cancel Request"
                  >
                    <XCircle className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between mb-1">
              <h4 className="font-bold text-[var(--ink)]">{job.title}</h4>
              {job.isInternal && (
                <span className="bg-purple-100 text-purple-800 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider whitespace-nowrap ml-2">Internal Only</span>
              )}
            </div>
            <div className="flex items-center gap-1.5 mb-2">
              {job.category && (
                <span className="bg-gray-100 px-1.5 py-0.5 rounded text-xs font-semibold text-gray-600">{job.category}</span>
              )}
            </div>
            <p className="text-sm text-[var(--steel)] mb-3 line-clamp-2">{job.description}</p>
            
            <div className="flex items-center justify-between pt-3 border-t border-[var(--hairline)]">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--ink)]">
                {job.requestType === 'Property / Facility Issue' ? (
                  <><MapPin className="w-3 h-3 text-[var(--steel)]" /> Property</>
                ) : (
                  <><Truck className="w-3 h-3 text-[var(--steel)]" /> {job.vehicleId?.truckNumber || 'Vehicle'}</>
                )}
              </div>
              <div className="text-[10px] text-[var(--steel)] uppercase tracking-wider font-semibold bg-[var(--canvas)] px-2 py-1 rounded-md max-w-[120px] truncate" title={job.assignedMspEntityId?.name || "Internal / Unassigned"}>
                {job.assignedMspEntityId?.name || "Internal"}
              </div>
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <div className="text-center p-6 text-sm text-[var(--steel-light)] border-2 border-dashed border-[var(--hairline)] rounded-xl">
            No requests in this category
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col">
      <PageHeader 
        eyebrow="Fleet Maintenance" 
        title="Service & Repairs" 
        subtitle="Track active repair jobs and maintenance requests"
        right={
          <div className="flex items-center gap-3">
            <select 
              value={selectedMonth} 
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 py-2 border border-[var(--hairline)] rounded-lg text-sm bg-white outline-none"
            >
              <option value="">All Time</option>
              {availableMonths.map((m: string) => {
                const date = new Date(m + '-02'); // '-02' avoids timezone offset issues
                return <option key={m} value={m}>{date.toLocaleString('default', { month: 'short', year: 'numeric' })}</option>;
              })}
            </select>
            {isExportMode ? (
              <>
                <span className="text-sm font-semibold text-[var(--steel)]">{selectedExportIds.length} selected</span>
                <Btn variant="ghost" onClick={() => { setIsExportMode(false); setSelectedExportIds([]); }}>Cancel</Btn>
                <Btn variant="ghost" icon={FileText} disabled={!selectedExportIds.length} onClick={handleExportPdf}>Export PDF</Btn>
                <Btn variant="primary" icon={Download} disabled={!selectedExportIds.length} onClick={handleExportCsv}>Export CSV</Btn>
              </>
            ) : (
              <>
                <Btn variant="ghost" icon={Download} onClick={() => setIsExportMode(true)}>Export Requests</Btn>
                <Btn variant="primary" icon={Plus} onClick={() => setIsMaintenanceOpen(true)}>New Request</Btn>
              </>
            )}
          </div>
        }
      />

      {loading ? (
        <div className="p-8 text-center text-[var(--steel)]">Loading requests...</div>
      ) : (
        <div className="flex-1 flex gap-6 overflow-x-auto pb-4 snap-x snap-mandatory">
          <Column title="Pending Approvals" items={pendingApprovals} icon={AlertTriangle} color="var(--purple)" />
          <Column title="Pending / Unassigned" items={newRequests} icon={AlertTriangle} color="var(--amber)" />
          <Column title="In Progress" items={inProgress} icon={Wrench} color="var(--signal)" />
          <Column title="Completed" items={completed} icon={CheckCircle2} color="var(--green)" />
        </div>
      )}

      <NewMaintenanceRequestModal 
        isOpen={isMaintenanceOpen} 
        onClose={() => setIsMaintenanceOpen(false)} 
        vehicles={vehicles} 
        activeMsps={activeMsps} 
        onSuccess={fetchData} 
      />

      {/* Details Modal */}
      <Modal isOpen={isDetailsModalOpen} onClose={() => setIsDetailsModalOpen(false)} title="Request Details">
        {selectedJob && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-xl">{selectedJob.title}</h3>
              <JobStatusPill status={selectedJob.status} />
            </div>
            <div className="text-sm text-[var(--steel)]">
              <p><strong>Created:</strong> {new Date(selectedJob.createdAt).toLocaleString()}</p>
              <p><strong>Type:</strong> {selectedJob.requestType}</p>
              <p><strong>Priority:</strong> <span className="capitalize">{selectedJob.priority}</span></p>
              {selectedJob.requestType === 'Vehicle Issue' && selectedJob.vehicleId && (
                <p><strong>Vehicle:</strong> {selectedJob.vehicleId.make} {selectedJob.vehicleId.model} ({selectedJob.vehicleId.truckNumber}) - VIN: {selectedJob.vehicleId.vin}</p>
              )}
              {selectedJob.requestType === 'Property / Facility Issue' && selectedJob.location && (
                <p><strong>Location:</strong> {selectedJob.location}</p>
              )}
              <p><strong>Assigned To:</strong> {selectedJob.assignedMspEntityId?.name || "Internal / Unassigned"}</p>
            </div>
            
            <div className="bg-[var(--canvas)] p-4 rounded-lg">
              <h4 className="font-bold text-sm mb-2">Description</h4>
              <p className="text-sm whitespace-pre-wrap">{selectedJob.description}</p>
            </div>

            {selectedJob.attachments && selectedJob.attachments.length > 0 && (
              <div>
                <h4 className="font-bold text-sm mb-2">Original Attachments</h4>
                <div className="flex gap-2 flex-wrap">
                  {selectedJob.attachments.map((url: string, idx: number) => (
                    <a key={idx} href={url} target="_blank" rel="noreferrer" className="w-24 h-24 bg-gray-200 rounded-lg overflow-hidden border border-[var(--hairline)] block">
                      <img src={url} alt="Attachment" className="w-full h-full object-cover" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {(selectedJob.mechanicNotes || (selectedJob.mechanicAttachments && selectedJob.mechanicAttachments.length > 0)) && (
              <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg mt-4">
                <h4 className="font-bold text-sm mb-2 text-blue-900">Mechanic Updates</h4>
                {selectedJob.mechanicNotes && (
                  <p className="text-sm text-blue-800 whitespace-pre-wrap mb-3">{selectedJob.mechanicNotes}</p>
                )}
                {selectedJob.mechanicAttachments && selectedJob.mechanicAttachments.length > 0 && (
                  <div>
                    <h5 className="font-semibold text-xs text-blue-800 mb-1.5 uppercase tracking-wider">Progress Photos</h5>
                    <div className="flex gap-2 flex-wrap">
                      {selectedJob.mechanicAttachments.map((url: string, idx: number) => (
                        <a key={idx} href={url} target="_blank" rel="noreferrer" className="w-24 h-24 bg-white rounded-lg overflow-hidden border border-blue-200 block shadow-sm relative group">
                          <img src={url} alt="Mechanic Photo" className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-blue-900/40 hidden group-hover:flex items-center justify-center">
                            <span className="text-white text-xs font-bold">View</span>
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            
            <div className="pt-4 border-t border-[var(--hairline)] flex justify-end gap-2 mt-4">
              {selectedJob.isInternal && (
                <Btn variant="outline" onClick={sendToNetwork}>Send to Mechanic Network</Btn>
              )}
              {selectedJob.approvalStatus === 'pending_admin_approval' && (
                <Btn variant="primary" onClick={approveRequest}>Approve Mechanic Request</Btn>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Rigorous Cancel Confirmation Modal */}
      <Modal isOpen={isCancelModalOpen} onClose={() => setIsCancelModalOpen(false)} title="Cancel Maintenance Request">
        <div className="space-y-4">
          <p className="text-sm text-[var(--steel)]">
            You are about to cancel this maintenance request. This action cannot be undone, and the request will be permanently removed from the job board.
          </p>
          <div className="bg-red-50 text-red-700 p-3 rounded-lg text-sm font-semibold flex items-center gap-2 border border-red-200">
            <AlertTriangle className="w-5 h-5" />
            Please type CANCEL below to confirm.
          </div>
          <Input 
            label="Confirmation"
            placeholder="Type CANCEL"
            value={cancelInput}
            onChange={(e: any) => { setCancelInput(e.target.value); setCancelError(""); }}
          />
          {cancelError && (
            <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm font-semibold">
              {cancelError}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-4">
            <Btn variant="outline" onClick={() => setIsCancelModalOpen(false)}>Back</Btn>
            <Btn 
              variant="primary" 
              onClick={confirmCancel} 
              disabled={cancelInput !== "CANCEL" || isCancelling}
              className={cancelInput === "CANCEL" ? "bg-red-600 hover:bg-red-700 text-white" : ""}
            >
              {isCancelling ? 'Cancelling...' : 'Confirm Cancellation'}
            </Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}
