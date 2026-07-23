import React, { useState } from "react";
import { Modal, Input, Select, TextArea, Btn } from "./UI";
import { apiFetch } from "@/lib/api";

export function NewMaintenanceRequestModal({ 
  isOpen, 
  onClose, 
  vehicles, 
  activeMsps, 
  onSuccess 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  vehicles: any[]; 
  activeMsps: any[];
  onSuccess: () => void;
}) {
  const [requestType, setRequestType] = useState('Vehicle Issue');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleMaintenanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    const formData = new FormData(e.target as HTMLFormElement);
    
    try {
      await apiFetch(`/api/maintenance`, {
        method: 'POST',
        headers: {
          'Accept': 'application/json'
        },
        body: formData
      });
      onSuccess();
      onClose();
    } catch (err) {
      console.error(err);
      alert("Failed to submit request.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New Maintenance Request">
      <form onSubmit={handleMaintenanceSubmit}>
        <Select 
          label="Request Type" 
          name="requestType" 
          value={requestType}
          onChange={(e: any) => setRequestType(e.target.value)}
          options={[
            { label: 'Vehicle Issue', value: 'Vehicle Issue' },
            { label: 'Property / Facility Issue', value: 'Property / Facility Issue' }
          ]} 
        />
        <Input label="Title" name="title" required placeholder="Brief issue summary" />
        
        {requestType === 'Vehicle Issue' ? (
          <>
            <Select label="Vehicle" name="vehicleId" required options={vehicles.map((v: any) => ({ label: `${v.truckNumber} - ${v.makeModel || 'Unknown'}`, value: v._id }))} />
            <Input label="Location (Optional)" name="location" placeholder="Address or map link where the vehicle is" />
          </>
        ) : (
          <Input label="Location / Asset Description" name="location" required placeholder="e.g. 5401 Tower Road, Main Gate" />
        )}
        <Select label="Priority" name="priority" required options={[
          { label: 'Low', value: 'Low' },
          { label: 'Medium', value: 'Medium' },
          { label: 'High', value: 'High' }
        ]} />
        
        <Select label="Assign to Mechanic Shop" name="assignedMspEntityId" options={[
          { label: 'Auto-assign / Internal (Pending)', value: '' },
          ...activeMsps.map((p: any) => ({ label: p.mspEntityId?.name, value: p.mspEntityId?._id }))
        ]} />

        <TextArea label="Description" name="description" required placeholder="Detailed description of the issue" />
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-[var(--ink)] mb-1.5">Attachments (Optional)</label>
          <input type="file" name="attachments" multiple accept="image/*,video/*" className="w-full text-sm text-[var(--steel)] file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-[var(--signal-dim)] file:text-[var(--signal)] hover:file:bg-[var(--signal-light)]" />
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <Btn type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>Cancel</Btn>
          <Btn type="submit" variant="primary" disabled={isSubmitting}>
            {isSubmitting ? "Submitting..." : "Submit Request"}
          </Btn>
        </div>
      </form>
    </Modal>
  );
}
