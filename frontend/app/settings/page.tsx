'use client';

import React, { useEffect, useState } from "react";
import { Settings as SettingsIcon, Plus, Trash2, Edit2, Users, Check, X as XIcon } from "lucide-react";
import { PageHeader, Btn, Modal, Input, Select } from "@/components/fleet/UI";

const API_BASE = typeof window !== 'undefined' && window.location.port === '3001' ? 'http://127.0.0.1:3000' : '';

export default function Settings() {
  const [items, setItems] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  const fetchRequests = () => {
    fetch(`${API_BASE}/api/onboarding/requests`)
      .then(res => res.json())
      .then(data => {
         if(Array.isArray(data)) setRequests(data);
      })
      .catch(console.error);
  };

  const fetchItems = () => {
    fetch(`${API_BASE}/api/checklist-items`)
      .then(res => res.json())
      .then(data => setItems(data))
      .catch(console.error);
  };

  useEffect(() => {
    fetchItems();
    fetchRequests();
  }, []);

  const handleResolveRequest = async (requestId: string, action: 'approve' | 'reject') => {
    if (!confirm(`Are you sure you want to ${action} this request?`)) return;
    try {
      await fetch(`${API_BASE}/api/onboarding/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, action })
      });
      fetchRequests();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const data = {
      name: formData.get('name'),
      eveningWalkthrough: formData.get('eveningWalkthrough') === 'true',
      weekendWalkthrough: formData.get('weekendWalkthrough') === 'true',
    };

    const url = editingItem ? `${API_BASE}/api/checklist-items/${editingItem._id}` : `${API_BASE}/api/checklist-items`;
    const method = editingItem ? 'PUT' : 'POST';

    try {
      await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      setIsModalOpen(false);
      setEditingItem(null);
      fetchItems();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this checklist item?')) return;
    try {
      await fetch(`${API_BASE}/api/checklist-items/${id}`, { method: 'DELETE' });
      fetchItems();
    } catch (err) {
      console.error(err);
    }
  };

  const openEdit = (item: any) => {
    setEditingItem(item);
    setIsModalOpen(true);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <PageHeader eyebrow="Configuration" title="Settings" />
        <div className="flex items-center gap-3">
          <Btn variant="primary" icon={Plus} onClick={() => { setEditingItem(null); setIsModalOpen(true); }}>
            Add Checklist Item
          </Btn>
          <Btn 
            variant="ghost" 
            className="text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200"
            onClick={async () => {
              await fetch(`${API_BASE}/api/auth/logout`, { method: 'POST' });
              window.location.href = '/login';
            }}
          >
            Logout
          </Btn>
        </div>
      </div>

      {requests.length > 0 && (
        <div className="bg-[var(--surface)] border border-[var(--hairline)] rounded-xl overflow-hidden mt-6 mb-8">
          <div className="p-5 border-b border-[var(--hairline)] bg-amber-50/30">
            <h3 className="font-semibold text-lg text-[var(--ink)] flex items-center gap-2">
              <Users className="w-5 h-5 text-amber-600" /> Pending Team Requests
            </h3>
            <p className="text-sm text-[var(--steel-light)] mt-1">These users have requested to join your fleet. Review and approve to grant them driver access.</p>
          </div>
          <table className="w-full text-left border-collapse">
            <tbody className="divide-y divide-[var(--hairline)]">
              {requests.map(req => (
                <tr key={req._id} className="hover:bg-gray-50/50">
                  <td className="px-5 py-4">
                    <div className="font-semibold text-[var(--ink)]">{req.userId?.displayName || 'Unknown User'}</div>
                    <div className="text-xs text-[var(--steel)]">{req.userId?.email}</div>
                  </td>
                  <td className="px-5 py-4 text-right flex justify-end gap-2">
                    <Btn variant="primary" icon={Check} onClick={() => handleResolveRequest(req._id, 'approve')}>Approve</Btn>
                    <Btn variant="ghost" icon={XIcon} onClick={() => handleResolveRequest(req._id, 'reject')}>Deny</Btn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="bg-[var(--surface)] border border-[var(--hairline)] rounded-xl overflow-hidden mt-6">
        <div className="p-5 border-b border-[var(--hairline)]">
          <h3 className="font-semibold text-lg text-[var(--ink)] flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-[var(--steel)]" /> Walkthrough Checklist Manager
          </h3>
          <p className="text-sm text-[var(--steel-light)] mt-1">Configure the items that appear in the evening and weekend walkthroughs.</p>
        </div>

        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[var(--canvas)] border-b border-[var(--hairline)]">
              <th className="px-5 py-3 text-xs font-semibold text-[var(--steel-light)] uppercase tracking-wider">Item Name</th>
              <th className="px-5 py-3 text-xs font-semibold text-[var(--steel-light)] uppercase tracking-wider text-center">Evening Walkthrough</th>
              <th className="px-5 py-3 text-xs font-semibold text-[var(--steel-light)] uppercase tracking-wider text-center">Weekend Walkthrough</th>
              <th className="px-5 py-3 text-xs font-semibold text-[var(--steel-light)] uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--hairline)]">
            {items.map(item => (
              <tr key={item._id} className="hover:bg-gray-50/50">
                <td className="px-5 py-4 font-semibold text-[var(--ink)]">{item.name}</td>
                <td className="px-5 py-4 text-center">
                  {item.eveningWalkthrough ? (
                    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-semibold bg-green-100 text-green-700">Active</span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-semibold bg-gray-100 text-gray-500">Disabled</span>
                  )}
                </td>
                <td className="px-5 py-4 text-center">
                  {item.weekendWalkthrough ? (
                    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-semibold bg-green-100 text-green-700">Active</span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-semibold bg-gray-100 text-gray-500">Disabled</span>
                  )}
                </td>
                <td className="px-5 py-4 text-right flex justify-end gap-2">
                  <button onClick={() => openEdit(item)} className="p-2 text-[var(--steel)] hover:text-[var(--signal)] rounded-lg hover:bg-[var(--canvas)] transition-colors">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(item._id)} className="p-2 text-[var(--steel)] hover:text-red-500 rounded-lg hover:bg-[var(--canvas)] transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-center text-[var(--steel)] text-sm">
                  No checklist items configured yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? 'Edit Checklist Item' : 'Add Checklist Item'}>
        <form onSubmit={handleSubmit}>
          <Input 
            label="Item Name" 
            name="name" 
            defaultValue={editingItem?.name} 
            placeholder="e.g. Fire Extinguisher" 
            required 
          />
          
          <Select 
            label="Evening Walkthrough" 
            name="eveningWalkthrough" 
            defaultValue={editingItem?.eveningWalkthrough ? 'true' : 'false'}
            options={[
              { label: 'Yes - Include in Evening', value: 'true' },
              { label: 'No - Skip', value: 'false' }
            ]} 
          />

          <Select 
            label="Weekend Walkthrough" 
            name="weekendWalkthrough" 
            defaultValue={editingItem?.weekendWalkthrough ? 'true' : 'false'}
            options={[
              { label: 'Yes - Include in Weekend', value: 'true' },
              { label: 'No - Skip', value: 'false' }
            ]} 
          />

          <div className="flex justify-end gap-2 mt-6">
            <Btn type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Btn>
            <Btn type="submit" variant="primary">Save Configuration</Btn>
          </div>
        </form>
      </Modal>
    </div>
  );
}
