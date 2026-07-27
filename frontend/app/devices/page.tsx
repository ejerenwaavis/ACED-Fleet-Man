'use client';

import React, { useState, useEffect } from 'react';
import { PageHeader, Btn, Modal, Input, Select } from '@/components/fleet/UI';
import { apiFetch } from '@/lib/api';
import { exportToCsv } from '@/lib/exportCsv';
import { exportToPdf, exportGroupedToPdf } from '@/lib/exportPdf';
import { TabletSmartphone, Plus, Edit2, Trash2, AlertCircle, Download, ScanBarcode, Search, FileText, ArrowUp, ArrowDown } from 'lucide-react';
import { useAuth } from '@/components/fleet/AuthProvider';
import { BarcodeScanner } from '@/components/fleet/BarcodeScanner';
import { OcrScanner } from '@/components/fleet/OcrScanner';
import { useSearchParams } from 'next/navigation';

export default function DevicesDashboard() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [devices, setDevices] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerTarget, setScannerTarget] = useState<'deviceId' | 'imei'>('deviceId');
  const [scannerMode, setScannerMode] = useState<'barcode' | 'text'>('barcode');
  const [activeTab, setActiveTab] = useState('All');
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [deviceId, setDeviceId] = useState('');
  const [type, setType] = useState('scanner');
  const [model, setModel] = useState('');
  const [imei, setImei] = useState('');
  const [ownership, setOwnership] = useState('');
  const [provider, setProvider] = useState('');
  const [status, setStatus] = useState('Spare');
  const [assignedVehicle, setAssignedVehicle] = useState('');
  const [notes, setNotes] = useState('');
  const [verifiedSerialNumber, setVerifiedSerialNumber] = useState('');
  const [verifiedBy, setVerifiedBy] = useState('');
  const [currentEditId, setCurrentEditId] = useState<string | null>(null);
  const [viewingDevice, setViewingDevice] = useState<any>(null);
  const [isExportMode, setIsExportMode] = useState(false);
  const [selectedExportIds, setSelectedExportIds] = useState<string[]>([]);
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);

  const handleSelect = (id: string, checked: boolean, shiftKey: boolean, list: any[]) => {
    if (shiftKey && lastSelectedId) {
      const currentIndex = list.findIndex(item => item._id === id);
      const lastIndex = list.findIndex(item => item._id === lastSelectedId);
      if (currentIndex !== -1 && lastIndex !== -1) {
        const start = Math.min(currentIndex, lastIndex);
        const end = Math.max(currentIndex, lastIndex);
        const idsInRange = list.slice(start, end + 1).map(item => item._id);
        
        if (checked) {
          setSelectedExportIds(prev => Array.from(new Set([...prev, ...idsInRange])));
        } else {
          setSelectedExportIds(prev => prev.filter(pId => !idsInRange.includes(pId)));
        }
      }
    } else {
      if (checked) setSelectedExportIds(prev => [...prev, id]);
      else setSelectedExportIds(prev => prev.filter(pId => pId !== id));
    }
    setLastSelectedId(id);
  };
  
  const [sortField, setSortField] = useState('deviceId');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [filterOwnership, setFilterOwnership] = useState('All');
  const [filterProvider, setFilterProvider] = useState('All');

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

  useEffect(() => {
    const q = searchParams.get('q');
    if (q !== null) {
      setSearchQuery(q);
    }
  }, [searchParams]);

  const filteredDevices = devices.filter(d => {
    if (activeTab !== 'All' && d.type?.toLowerCase() !== activeTab.toLowerCase()) return false;
    if (filterOwnership !== 'All' && (d.ownership || 'None') !== filterOwnership) return false;
    if (filterProvider !== 'All' && (d.provider || 'None') !== filterProvider) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (d.deviceId?.toLowerCase() || '').includes(q) ||
      (d.type?.toLowerCase() || '').includes(q) ||
      (d.model?.toLowerCase() || '').includes(q) ||
      (d.status?.toLowerCase() || '').includes(q) ||
      (d.assignedVehicle?.toLowerCase() || '').includes(q) ||
      (d.imei?.toLowerCase() || '').includes(q) ||
      (d.ownership?.toLowerCase() || '').includes(q) ||
      (d.provider?.toLowerCase() || '').includes(q) ||
      (d.notes?.toLowerCase() || '').includes(q)
    );
  });

  const sortedDevices = [...filteredDevices].sort((a, b) => {
    let aVal = a[sortField];
    let bVal = b[sortField];
    if (sortField === 'assignedVehicle') {
      aVal = aVal ? Number(aVal) : Infinity;
      bVal = bVal ? Number(bVal) : Infinity;
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    }
    aVal = String(aVal || '').toLowerCase();
    bVal = String(bVal || '').toLowerCase();
    if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  const uniqueOwners = Array.from(new Set(devices.map(d => d.ownership || 'None'))).sort();
  const uniqueProviders = Array.from(new Set(devices.map(d => d.provider || 'None'))).sort();

  const handleSort = (field: string) => {
    if (sortField === field) setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDirection('asc'); }
  };

  const openAddModal = () => {
    setIsEditing(false);
    setCurrentEditId(null);
    setDeviceId('');
    setType('scanner');
    setModel('');
    setImei('');
    setOwnership('');
    setProvider('');
    setStatus('Spare');
    setAssignedVehicle('');
    setNotes('');
    setVerifiedSerialNumber('');
    setVerifiedBy('');
    setIsModalOpen(true);
  };

  const openEditModal = (d: any) => {
    setIsEditing(true);
    setCurrentEditId(d._id);
    setDeviceId(d.deviceId);
    setType(d.type);
    setModel(d.model || '');
    setImei(d.imei || '');
    setOwnership(d.ownership || '');
    setProvider(d.provider || '');
    setStatus(d.status);
    setAssignedVehicle(d.assignedVehicle || '');
    setNotes(d.notes || '');
    setVerifiedSerialNumber(d.verifiedSerialNumber || '');
    setVerifiedBy(d.verifiedBy || '');
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    
    if (status === 'Assigned' && assignedVehicle) {
      const existingDevice = devices.find(d => 
        d.assignedVehicle === assignedVehicle && 
        d.type === type && 
        d._id !== currentEditId
      );
      if (existingDevice) {
        if (!confirm(`Truck ${assignedVehicle} already has a ${type} assigned to it (ID: ${existingDevice.deviceId}). Proceeding will unassign the previous device. Do you want to continue?`)) {
          return;
        }
      }
    }
    
    setIsSubmitting(true);
    const payload = { deviceId, type, model, imei, ownership, provider, status, assignedVehicle, notes, verifiedSerialNumber, verifiedBy };
    try {
      let res;
      if (isEditing && currentEditId) {
        res = await apiFetch(`/api/devices/${currentEditId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        res = await apiFetch('/api/devices', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      }
      
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Failed to save device.');
      }
      
      setIsModalOpen(false);
      fetchDevices();
    } catch (e: any) {
      console.error(e);
      alert(e.message || 'Failed to save device.');
    } finally {
      setIsSubmitting(false);
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

  const handleViewDeviceEdit = () => {
    const d = viewingDevice;
    setViewingDevice(null);
    openEditModal(d);
  };

  const handleExport = () => {
    const dataToExport = sortedDevices.map(d => ({
      'Device ID': d.deviceId,
      'Type': d.type,
      'IMEI': d.imei || 'N/A',
      'Verified Serial #': d.verifiedSerialNumber || 'N/A',
      'Verified By': d.verifiedBy || 'N/A',
      'Model': d.model || 'N/A',
      'Ownership': d.ownership || 'N/A',
      'Provider': d.provider || 'N/A',
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
              <Btn variant="ghost" icon={FileText} disabled={!selectedExportIds.length} onClick={() => {
                const selectedDevices = devices.filter(d => selectedExportIds.includes(d._id));
                const types = Array.from(new Set(selectedDevices.map(d => d.type)));
                const groups = types.map(t => {
                  const typeRows = selectedDevices.filter(d => d.type === t).map(d => {
                    const row: Record<string, string> = {
                      'Device ID': d.deviceId
                    };
                    if (t === 'ipad' || t === 'scanner') {
                      row['IMEI'] = d.imei || 'N/A';
                    }
                    row['Verified Serial #'] = d.verifiedSerialNumber || 'N/A';
                    row['Verified By'] = d.verifiedBy || 'N/A';
                    row['Assigned Truck'] = d.assignedVehicle ? `Truck ${d.assignedVehicle}` : 'Unassigned';
                    row['Model'] = d.model || 'N/A';
                    row['Ownership'] = d.ownership || 'N/A';
                    row['Provider'] = d.provider || 'N/A';
                    row['Status'] = d.status;
                    return row;
                  });
                  return { section: String(t).toUpperCase() + 'S', rows: typeRows };
                });
                exportGroupedToPdf('Assets & Devices Export', groups);
                setIsExportMode(false);
                setSelectedExportIds([]);
              }}>Export PDF</Btn>
              <Btn variant="primary" icon={Download} disabled={!selectedExportIds.length} onClick={() => {
                const selectedDevices = devices.filter(d => selectedExportIds.includes(d._id));
                const dataToExport = selectedDevices.map(d => ({
                  'Device ID': d.deviceId,
                  'Type': d.type,
                  'IMEI': d.imei || 'N/A',
                  'Verified Serial #': d.verifiedSerialNumber || 'N/A',
                  'Verified By': d.verifiedBy || 'N/A',
                  'Model': d.model || 'N/A',
                  'Ownership': d.ownership || 'N/A',
                  'Provider': d.provider || 'N/A',
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
              <Btn variant="ghost" icon={Download} onClick={() => setIsExportMode(true)}>Export Details</Btn>
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

      <div className="flex flex-col md:flex-row items-center gap-4 mb-4">
        <div className="relative w-full md:flex-1">
          <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--steel-light)]" />
          <input 
            type="text" 
            placeholder="Search devices by ID, type, model, assignment, IMEI..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-[var(--hairline)] rounded-xl bg-white focus:outline-none focus:border-[var(--signal)] focus:ring-1 focus:ring-[var(--signal)] text-sm"
          />
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <select
            value={filterOwnership}
            onChange={(e) => setFilterOwnership(e.target.value)}
            className="px-3 py-2 border border-[var(--hairline)] rounded-xl bg-white focus:outline-none focus:border-[var(--signal)] text-sm text-[var(--ink)]"
          >
            <option value="All">All Owners</option>
            {uniqueOwners.map(o => <option key={o} value={o}>{o === 'None' ? 'No Owner' : o}</option>)}
          </select>
          <select
            value={filterProvider}
            onChange={(e) => setFilterProvider(e.target.value)}
            className="px-3 py-2 border border-[var(--hairline)] rounded-xl bg-white focus:outline-none focus:border-[var(--signal)] text-sm text-[var(--ink)]"
          >
            <option value="All">All Providers</option>
            {uniqueProviders.map(p => <option key={p} value={p}>{p === 'None' ? 'No Provider' : p}</option>)}
          </select>
        </div>
      </div>
      
      <div className="flex overflow-x-auto border-b border-[var(--hairline)] mb-4 hide-scrollbar">
        {['All', 'Scanner', 'iPad', 'Camera', 'Radar', 'Other'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`whitespace-nowrap px-4 py-3 font-medium text-sm transition-colors border-b-2 ${
              activeTab === tab 
                ? 'border-[var(--signal)] text-[var(--signal)]'
                : 'border-transparent text-[var(--steel)] hover:text-[var(--ink)] hover:border-[var(--hairline)]'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="bg-[var(--surface)] border border-[var(--hairline)] rounded-xl overflow-x-auto shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="bg-[var(--canvas)] border-b border-[var(--hairline)]">
            <tr>
              {isExportMode && (
                <th className="px-4 py-3 w-12 text-center">
                  <input type="checkbox" 
                         checked={selectedExportIds.length === filteredDevices.length && filteredDevices.length > 0}
                         onChange={(e) => setSelectedExportIds(e.target.checked ? filteredDevices.map((d: any) => d._id) : [])}
                         className="rounded border-[var(--hairline)]" />
                </th>
              )}
              <th className="px-4 py-3 font-semibold text-[var(--steel-light)] cursor-pointer hover:text-[var(--ink)] whitespace-nowrap" onClick={() => handleSort('deviceId')}>
                Device ID {sortField === 'deviceId' && (sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 inline" /> : <ArrowDown className="w-3 h-3 inline" />)}
              </th>
              <th className="px-4 py-3 font-semibold text-[var(--steel-light)] cursor-pointer hover:text-[var(--ink)] whitespace-nowrap" onClick={() => handleSort('imei')}>
                IMEI {sortField === 'imei' && (sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 inline" /> : <ArrowDown className="w-3 h-3 inline" />)}
              </th>
              <th className="px-4 py-3 font-semibold text-[var(--steel-light)] cursor-pointer hover:text-[var(--ink)] whitespace-nowrap" onClick={() => handleSort('verifiedSerialNumber')}>
                Verified Serial # {sortField === 'verifiedSerialNumber' && (sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 inline" /> : <ArrowDown className="w-3 h-3 inline" />)}
              </th>
              <th className="px-4 py-3 font-semibold text-[var(--steel-light)] cursor-pointer hover:text-[var(--ink)] whitespace-nowrap" onClick={() => handleSort('type')}>
                Type {sortField === 'type' && (sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 inline" /> : <ArrowDown className="w-3 h-3 inline" />)}
              </th>
              <th className="px-4 py-3 font-semibold text-[var(--steel-light)] cursor-pointer hover:text-[var(--ink)] whitespace-nowrap" onClick={() => handleSort('model')}>
                Model {sortField === 'model' && (sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 inline" /> : <ArrowDown className="w-3 h-3 inline" />)}
              </th>
              <th className="px-4 py-3 font-semibold text-[var(--steel-light)] cursor-pointer hover:text-[var(--ink)] whitespace-nowrap" onClick={() => handleSort('ownership')}>
                Ownership {sortField === 'ownership' && (sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 inline" /> : <ArrowDown className="w-3 h-3 inline" />)}
              </th>
              <th className="px-4 py-3 font-semibold text-[var(--steel-light)] cursor-pointer hover:text-[var(--ink)] whitespace-nowrap" onClick={() => handleSort('provider')}>
                Provider {sortField === 'provider' && (sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 inline" /> : <ArrowDown className="w-3 h-3 inline" />)}
              </th>
              <th className="px-4 py-3 font-semibold text-[var(--steel-light)] cursor-pointer hover:text-[var(--ink)] whitespace-nowrap" onClick={() => handleSort('status')}>
                Status {sortField === 'status' && (sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 inline" /> : <ArrowDown className="w-3 h-3 inline" />)}
              </th>
              <th className="px-4 py-3 font-semibold text-[var(--steel-light)] cursor-pointer hover:text-[var(--ink)] whitespace-nowrap" onClick={() => handleSort('assignedVehicle')}>
                Assignment {sortField === 'assignedVehicle' && (sortDirection === 'asc' ? <ArrowUp className="w-3 h-3 inline" /> : <ArrowDown className="w-3 h-3 inline" />)}
              </th>
              <th className="px-4 py-3 font-semibold text-[var(--steel-light)] whitespace-nowrap">Notes</th>
              <th className="px-4 py-3 font-semibold text-[var(--steel-light)] text-right whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--hairline)]">
            {sortedDevices.length === 0 ? (
              <tr>
                <td colSpan={isExportMode ? 12 : 11} className="px-4 py-8 text-center text-[var(--steel)]">
                  No devices match your search.
                </td>
              </tr>
            ) : sortedDevices.map(d => (
              <tr key={d._id} className="hover:bg-gray-50/50 cursor-pointer" onClick={() => setViewingDevice(d)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setViewingDevice(d); } }}>
                {isExportMode && (
                  <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" 
                           checked={selectedExportIds.includes(d._id)}
                           onChange={(e: any) => handleSelect(d._id, e.target.checked, e.nativeEvent.shiftKey, sortedDevices)}
                           className="rounded border-[var(--hairline)]" />
                  </td>
                )}
                <td className="px-4 py-3 font-medium text-[var(--ink)] flex items-center gap-2 whitespace-nowrap">
                    <TabletSmartphone className="w-4 h-4 text-[var(--steel)]" />
                    {d.deviceId}
                </td>
                <td className="px-4 py-3 text-[var(--steel)] whitespace-nowrap">{d.imei || '-'}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                    {d.verifiedSerialNumber ? (
                      <span className="text-[var(--ink)] font-medium">{d.verifiedSerialNumber}</span>
                    ) : (
                      <span className="text-gray-400 italic">Not verified</span>
                    )}
                </td>
                <td className="px-4 py-3 text-[var(--steel)] capitalize whitespace-nowrap">{d.type}</td>
                <td className="px-4 py-3 text-[var(--steel)] whitespace-nowrap">{d.model || '-'}</td>
                <td className="px-4 py-3 text-[var(--steel)] whitespace-nowrap">{d.ownership || '-'}</td>
                <td className="px-4 py-3 text-[var(--steel)] whitespace-nowrap">{d.provider || '-'}</td>
                <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${
                        d.status === 'Assigned' ? 'bg-[var(--signal-dim)] text-[var(--signal)]' :
                        d.status === 'Faulty' ? 'bg-[var(--red-bg)] text-[var(--red)]' :
                        d.status === 'In Repair' ? 'bg-amber-100 text-amber-700' :
                        d.status === 'Spare' ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-700'
                    }`}>
                        {d.status}
                    </span>
                </td>
                <td className="px-4 py-3 text-[var(--steel)] whitespace-nowrap">
                    {d.assignedVehicle ? `Truck ${d.assignedVehicle}` : <span className="text-gray-400 italic">Unassigned</span>}
                </td>
                <td className="px-4 py-3 text-[var(--steel)] max-w-[200px] truncate" title={d.notes || ''}>
                    {d.notes || '-'}
                </td>
                <td className="px-4 py-3 text-right whitespace-nowrap">
                  {/* Actions moved to Details Modal */}
                </td>
              </tr>
            ))}
            {devices.length === 0 && (
              <tr>
                <td colSpan={11} className="px-4 py-8 text-center text-[var(--steel)]">
                  No devices added yet. Click "Add Device" to start your asset registry.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal isOpen={!!viewingDevice} onClose={() => setViewingDevice(null)} title="Device Details" maxWidth="max-w-lg">
        {viewingDevice && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="block text-xs font-semibold uppercase tracking-wider text-[var(--steel-light)] mb-1">Device ID / Serial</span>
                <span className="text-[var(--ink)] font-medium">{viewingDevice.deviceId}</span>
              </div>
              <div>
                <span className="block text-xs font-semibold uppercase tracking-wider text-[var(--steel-light)] mb-1">Type</span>
                <span className="text-[var(--ink)] font-medium capitalize">{viewingDevice.type}</span>
              </div>
              <div>
                <span className="block text-xs font-semibold uppercase tracking-wider text-[var(--steel-light)] mb-1">IMEI (as originally recorded)</span>
                <span className="text-[var(--ink)] font-medium">{viewingDevice.imei || '—'}</span>
              </div>
              <div>
                <span className="block text-xs font-semibold uppercase tracking-wider text-[var(--steel-light)] mb-1">Verified Serial #</span>
                <span className="text-[var(--ink)] font-medium">{viewingDevice.verifiedSerialNumber || 'Not verified yet'}</span>
              </div>
              <div>
                <span className="block text-xs font-semibold uppercase tracking-wider text-[var(--steel-light)] mb-1">Verified By</span>
                <span className="text-[var(--ink)] font-medium">{viewingDevice.verifiedBy || '—'}</span>
              </div>
              <div>
                <span className="block text-xs font-semibold uppercase tracking-wider text-[var(--steel-light)] mb-1">Model</span>
                <span className="text-[var(--ink)] font-medium">{viewingDevice.model || '—'}</span>
              </div>
              <div>
                <span className="block text-xs font-semibold uppercase tracking-wider text-[var(--steel-light)] mb-1">Ownership</span>
                <span className="text-[var(--ink)] font-medium">{viewingDevice.ownership || '—'}</span>
              </div>
              <div>
                <span className="block text-xs font-semibold uppercase tracking-wider text-[var(--steel-light)] mb-1">Provider</span>
                <span className="text-[var(--ink)] font-medium">{viewingDevice.provider || '—'}</span>
              </div>
              <div>
                <span className="block text-xs font-semibold uppercase tracking-wider text-[var(--steel-light)] mb-1">Status</span>
                <span className="text-[var(--ink)] font-medium">{viewingDevice.status}</span>
              </div>
              <div>
                <span className="block text-xs font-semibold uppercase tracking-wider text-[var(--steel-light)] mb-1">Assigned To</span>
                <span className="text-[var(--ink)] font-medium">{viewingDevice.assignedVehicle ? `Truck ${viewingDevice.assignedVehicle}` : 'Unassigned'}</span>
              </div>
            </div>
            {viewingDevice.notes && (
              <div>
                <span className="block text-xs font-semibold uppercase tracking-wider text-[var(--steel-light)] mb-1">Notes</span>
                <p className="text-[var(--ink)] text-sm whitespace-pre-wrap">{viewingDevice.notes}</p>
              </div>
            )}
            <div className="pt-4 border-t border-[var(--hairline)] flex justify-end gap-2">
              <Btn variant="ghost" type="button" onClick={() => setViewingDevice(null)}>Close</Btn>
              {(user?.role === 'admin' || user?.role === 'manager') && (
                <>
                  <Btn variant="primary" type="button" onClick={handleViewDeviceEdit}>Edit</Btn>
                  <button 
                    onClick={() => {
                      handleDelete(viewingDevice._id);
                      setViewingDevice(null);
                    }} 
                    className="p-2 text-[var(--steel)] hover:text-[var(--red)] transition-colors ml-2" 
                    title="Delete Device"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={isEditing ? 'Edit Device' : 'Add New Device'} maxWidth="max-w-lg">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="mb-4">
              <label className="block text-sm font-medium text-[var(--ink)] mb-1.5">Device ID / Serial</label>
              <div className="relative">
                <input 
                  type="text"
                  required
                  value={deviceId}
                  onChange={(e: any) => setDeviceId(e.target.value)}
                  className="w-full pl-3 pr-10 py-2 border border-[var(--hairline)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--signal)] focus:border-transparent text-sm bg-white"
                />
                <button
                  type="button"
                  onClick={() => { setScannerTarget('deviceId'); setIsScannerOpen(true); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--steel)] hover:text-[var(--signal)] hover:bg-[var(--canvas)] rounded transition-colors"
                  title="Scan Barcode / QR Code"
                >
                  <ScanBarcode className="w-4 h-4" />
                </button>
              </div>
            </div>
            <Input label="Model (Optional)" value={model} onChange={(e: any) => setModel(e.target.value)} />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <Input label="Ownership (Optional)" value={ownership} onChange={(e: any) => setOwnership(e.target.value)} placeholder="e.g. Discounter" />
            <Input label="Provider (Optional)" value={provider} onChange={(e: any) => setProvider(e.target.value)} placeholder="e.g. Velocito" />
          </div>
          
          {(type === 'ipad' || type === 'scanner') && (
            <div className="grid grid-cols-1 gap-4 mb-4">
              <div className="relative w-full">
                <label className="block text-sm font-medium text-[var(--ink)] mb-1.5">
                  IMEI (Required for {type === 'ipad' ? 'iPad' : 'Scanner'})
                </label>
                <div className="relative">
                  <input 
                    type="text"
                    required
                    value={imei}
                    onChange={(e: any) => setImei(e.target.value)}
                    className="w-full pl-3 pr-10 py-2 border border-[var(--hairline)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--signal)] focus:border-transparent text-sm bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => { setScannerTarget('imei'); setIsScannerOpen(true); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--steel)] hover:text-[var(--signal)] hover:bg-[var(--canvas)] rounded transition-colors"
                    title="Scan Barcode / QR Code"
                  >
                    <ScanBarcode className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <Input 
              label="Verified Serial Number (Optional)" 
              value={verifiedSerialNumber} 
              onChange={(e: any) => setVerifiedSerialNumber(e.target.value)} 
              placeholder="Corrected value from device OS/battery compartment"
            />
            <Input 
              label="Verified By (Optional)" 
              value={verifiedBy} 
              onChange={(e: any) => setVerifiedBy(e.target.value)} 
              placeholder="Engineer/tech who confirmed it"
            />
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
            <Btn variant="primary" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Processing...' : (isEditing ? 'Save Changes' : 'Create Device')}
            </Btn>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isScannerOpen} onClose={() => setIsScannerOpen(false)} title={`Scan ${scannerTarget === 'deviceId' ? 'Device ID' : 'IMEI'}`} maxWidth="max-w-sm">
        <div className="mb-4 flex border-b border-[var(--hairline)]">
          <button
            className={`flex-1 py-2 text-sm font-semibold transition-colors ${scannerMode === 'barcode' ? 'border-b-2 border-[var(--signal)] text-[var(--signal)]' : 'text-[var(--steel)]'}`}
            onClick={() => setScannerMode('barcode')}
          >
            Barcode / QR
          </button>
          <button
            className={`flex-1 py-2 text-sm font-semibold transition-colors ${scannerMode === 'text' ? 'border-b-2 border-[var(--signal)] text-[var(--signal)]' : 'text-[var(--steel)]'}`}
            onClick={() => setScannerMode('text')}
          >
            Text / IMEI
          </button>
        </div>

        {scannerMode === 'barcode' ? (
          <BarcodeScanner 
            onResult={(result) => {
              if (scannerTarget === 'deviceId') setDeviceId(result);
              else setImei(result);
              setIsScannerOpen(false);
            }} 
            onClose={() => setIsScannerOpen(false)} 
          />
        ) : (
          <OcrScanner 
            onResult={(result) => {
              if (scannerTarget === 'deviceId') setDeviceId(result);
              else setImei(result);
              setIsScannerOpen(false);
            }} 
            onClose={() => setIsScannerOpen(false)} 
          />
        )}
      </Modal>
    </div>
  );
}
