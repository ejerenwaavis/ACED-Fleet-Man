'use client';

import React, { useState, useEffect } from 'react';
import { PageHeader, Btn, Modal, Input, Select } from '@/components/fleet/UI';
import { apiFetch } from '@/lib/api';
import { exportToCsv } from '@/lib/exportCsv';
import { TabletSmartphone, Plus, Edit2, Trash2, AlertCircle, Download } from 'lucide-react';

export default function DevicesDashboard() {
  const [devices, setDevices] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  // Form State
  const [deviceId, setDeviceId] = useState('');
  const [type, setType] = useState('scanner');
  const [model, setModel] = useState('');
  const [status, setStatus] = useState('Spare');
  const [assignedVehicle, setAssignedVehicle] = useState('');
  const [notes, setNotes] = useState('');
  const [currentEditId, setCurrentEditId] = useState<string | null>(null);
  const [isExportMode, setIsExportMode] = useState(false);
  const [selectedExportIds, setSelectedExportIds] = useState<string[]>([]);

  const fetchDevices = async () => {
    try {
      const res = await apiFetch('/api/devices');
      const data = await res.json();
      setDevices(data);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchVehicles = async () => {
    try {
      const res = await apiFetch('/api/vehicles-data');
      const data = await res.json();
      setVehicles(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchDevices();
    fetchVehicles();
  }, []);

  const openAddModal = () => {
    setIsEditing(false);
    setCurrentEditId(null);
    setDeviceId('');
    setType('scanner');
    setModel('');
    setStatus('Spare');
    setAssignedVehicle('');
    setNotes('');
    setIsModalOpen(true);
  };

  const openEditModal = (d: any) => {
    setIsEditing(true);
    setCurrentEditId(d._id);
    setDeviceId(d.deviceId);
    setType(d.type);
    setModel(d.model || '');
    setStatus(d.status);
    setAssignedVehicle(d.assignedVehicle || '');
    setNotes(d.notes || '');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { deviceId, type, model, status, assignedVehicle, notes };
    try {
      if (isEditing && currentEditId) {
        await apiFetch(`/api/devices/${currentEditId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        await apiFetch('/api/devices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }
      setIsModalOpen(false);
      fetchDevices();
    } catch (e) {
      console.error(e);
      alert('Failed to save device.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this device?')) return;
    try {
      await apiFetch(`/api/devices/${id}`, { method: 'DELETE' });
      fetchDevices();
    } catch (e) {
      console.error(e);
      alert('Failed to delete.');
    }
  };

  const handleExport = () => {
    const dataToExport = devices.map(d => ({
      'Device ID': d.deviceId,
      'Type': d.type,
      'Model': d.model || 'N/A',
      'Status': d.status,
      'Assigned Vehicle': d.assignedVehicle || 'Unassigned',
      'Notes': d.notes || '',
      'Added On': new Date(d.createdAt).toLocaleDateString()
    }));
    exportToCsv('Assets_Devices_Export', dataToExport);
  };

  const typeOptions = [
    { label: 'Scanner', value: 'scanner' },
    { label: 'iPad', value: 'ipad' },
    { label: 'Radar', value: 'radar' },
    { label: 'Camera', value: 'camera' },
    { label: 'Other', value: 'other' }
  ];

  const statusOptions = [
    { label: 'Assigned', value: 'Assigned' },
    { label: 'Spare', value: 'Spare' },
    { label: 'Faulty', value: 'Faulty' },
    { label: 'In Repair', value: 'In Repair' },
    { label: 'Retired', value: 'Retired' }
  ];

  const vehicleOptions = [
    { label: '-- No Assignment --', value: '' },
    ...vehicles.map(v => ({ label: `Truck ${v.truckNumber}`, value: v.truckNumber }))
  ];

  return (
    <div className="max-w-6xl mx-auto pb-12">
      <PageHeader
        eyebrow="Fleet Resources"
        title="Assets & Devices"
        subtitle="Manage scanners, iPads, and other hardware assets."
        right={
          isExportMode ? (
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-[var(--steel)]">{selectedExportIds.length} selected</span>
              <Btn variant="ghost" onClick={() => { setIsExportMode(false); setSelectedExportIds([]); }}>Cancel</Btn>
              <Btn variant="primary" icon={Download} onClick={() => {
                const selectedDevices = devices.filter(d => selectedExportIds.includes(d._id));
                const dataToExport = selectedDevices.map(d => ({
                  'Device ID': d.deviceId,
                  'Type': d.type,
                  'Model': d.model || 'N/A',
                  'Status': d.status,
                  'Assigned Vehicle': d.assignedVehicle || 'Unassigned',
                  'Notes': d.notes || '',
                  'Added On': new Date(d.createdAt).toLocaleDateString()
                }));
                exportToCsv('Assets_Devices_Export', dataToExport);
                setIsExportMode(false);
                setSelectedExportIds([]);
              }}>Confirm Export</Btn>
            </div>
          ) : (
            <>
              <Btn variant="ghost" icon={Download} onClick={() => setIsExportMode(true)}>Export CSV</Btn>
              <Btn variant="primary" icon={Plus} onClick={openAddModal}>Add Device</Btn>
            </>
          )
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white border border-[var(--hairline)] rounded-xl p-4 shadow-sm flex flex-col justify-center">
            <span className="text-[var(--steel)] text-sm font-semibold uppercase tracking-wider mb-1">Total Assets</span>
            <span className="text-3xl font-display font-bold text-[var(--ink)]">{devices.length}</span>
        </div>
        <div className="bg-white border border-[var(--hairline)] rounded-xl p-4 shadow-sm flex flex-col justify-center">
            <span className="text-[var(--steel)] text-sm font-semibold uppercase tracking-wider mb-1">Deployed</span>
            <span className="text-3xl font-display font-bold text-[var(--ink)]">{devices.filter(d => d.status === 'Assigned').length}</span>
        </div>
        <div className="bg-white border border-[var(--hairline)] rounded-xl p-4 shadow-sm flex flex-col justify-center">
            <span className="text-[var(--steel)] text-sm font-semibold uppercase tracking-wider mb-1">Spares</span>
            <span className="text-3xl font-display font-bold text-[var(--ink)]">{devices.filter(d => d.status === 'Spare').length}</span>
        </div>
        <div className="bg-[var(--red-bg)] border border-[var(--red)] border-opacity-30 rounded-xl p-4 shadow-sm flex flex-col justify-center">
            <span className="text-[var(--red)] text-sm font-semibold uppercase tracking-wider mb-1">Faulty / Repair</span>
            <span className="text-3xl font-display font-bold text-[var(--red)]">{devices.filter(d => d.status === 'Faulty' || d.status === 'In Repair').length}</span>
        </div>
      </div>

      <div className="bg-[var(--surface)] border border-[var(--hairline)] rounded-xl overflow-hidden shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-[var(--canvas)] border-b border-[var(--hairline)]">
            <tr>
              {isExportMode && (
                <th className="px-4 py-3 w-12 text-center">
                  <input type="checkbox" 
                         checked={selectedExportIds.length === devices.length && devices.length > 0}
                         onChange={(e) => setSelectedExportIds(e.target.checked ? devices.map((d: any) => d._id) : [])}
                         className="rounded border-[var(--hairline)]" />
                </th>
              )}
              <th className="px-4 py-3 font-semibold text-[var(--steel-light)]">Device ID</th>
              <th className="px-4 py-3 font-semibold text-[var(--steel-light)]">Type</th>
              <th className="px-4 py-3 font-semibold text-[var(--steel-light)]">Model</th>
              <th className="px-4 py-3 font-semibold text-[var(--steel-light)]">Status</th>
              <th className="px-4 py-3 font-semibold text-[var(--steel-light)]">Assignment</th>
              <th className="px-4 py-3 font-semibold text-[var(--steel-light)] text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--hairline)]">
            {devices.map(d => (
              <tr key={d._id} className="hover:bg-gray-50/50">
                {isExportMode && (
                  <td className="px-4 py-3 text-center">
                    <input type="checkbox" 
                           checked={selectedExportIds.includes(d._id)}
                           onChange={(e) => {
                             if (e.target.checked) setSelectedExportIds([...selectedExportIds, d._id]);
                             else setSelectedExportIds(selectedExportIds.filter(id => id !== d._id));
                           }}
                           className="rounded border-[var(--hairline)]" />
                  </td>
                )}
                <td className="px-4 py-3 font-medium text-[var(--ink)] flex items-center gap-2">
                    <TabletSmartphone className="w-4 h-4 text-[var(--steel)]" />
                    {d.deviceId}
                </td>
                <td className="px-4 py-3 text-[var(--steel)] capitalize">{d.type}</td>
                <td className="px-4 py-3 text-[var(--steel)]">{d.model || '-'}</td>
                <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${
                        d.status === 'Assigned' ? 'bg-[var(--signal-dim)] text-[var(--signal)]' :
                        d.status === 'Faulty' ? 'bg-[var(--red-bg)] text-[var(--red)]' :
                        d.status === 'In Repair' ? 'bg-amber-100 text-amber-700' :
                        d.status === 'Spare' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-700'
                    }`}>
                        {d.status}
                    </span>
                </td>
                <td className="px-4 py-3 text-[var(--steel)]">
                    {d.assignedVehicle ? `Truck ${d.assignedVehicle}` : <span className="text-gray-400 italic">Unassigned</span>}
                </td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => openEditModal(d)} className="p-1 text-[var(--steel)] hover:text-[var(--signal)] transition-colors"><Edit2 className="w-4 h-4" /></button>
                  <button onClick={() => handleDelete(d._id)} className="p-1 text-[var(--steel)] hover:text-[var(--red)] transition-colors ml-2"><Trash2 className="w-4 h-4" /></button>
                </td>
              </tr>
            ))}
            {devices.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[var(--steel)]">
                  No devices added yet. Click "Add Device" to start your asset registry.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={isEditing ? 'Edit Device' : 'Add New Device'} maxWidth="max-w-lg">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Device ID / Serial" value={deviceId} onChange={(e: any) => setDeviceId(e.target.value)} required />
            <Input label="Model (Optional)" value={model} onChange={(e: any) => setModel(e.target.value)} />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <Select label="Type" options={typeOptions} value={type} onChange={(e: any) => setType(e.target.value)} required />
            <Select label="Status" options={statusOptions} value={status} onChange={(e: any) => {
                setStatus(e.target.value);
                if (e.target.value !== 'Assigned') setAssignedVehicle('');
            }} required />
          </div>

          {status === 'Assigned' && (
            <Select label="Assigned Truck" options={vehicleOptions} value={assignedVehicle} onChange={(e: any) => setAssignedVehicle(e.target.value)} />
          )}
          
          <Input label="Notes (Optional)" value={notes} onChange={(e: any) => setNotes(e.target.value)} />

          <div className="pt-4 border-t border-[var(--hairline)] flex justify-end gap-2">
            <Btn variant="ghost" type="button" onClick={() => setIsModalOpen(false)}>Cancel</Btn>
            <Btn variant="primary" type="submit">{isEditing ? 'Save Changes' : 'Create Device'}</Btn>
          </div>
        </form>
      </Modal>
    </div>
  );
}
