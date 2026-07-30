'use client';

import React, { useState, useEffect } from "react";
import { PageHeader, Btn, Modal, Input, Select } from "@/components/fleet/UI";
import { apiFetch } from "@/lib/api";
import { Plus, Edit2, Trash2, ListChecks, Smartphone, Settings } from "lucide-react";
import { useAuth } from "@/components/fleet/AuthProvider";

export default function WalkthroughTemplatesManager() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<any[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [frequency, setFrequency] = useState('daily');
  const [items, setItems] = useState<any[]>([]);
  const [deviceTypes, setDeviceTypes] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchTemplates();
    fetchDevices();
  }, []);

  const fetchTemplates = async () => {
    try {
      const res = await apiFetch('/api/walkthrough-templates');
      const data = await res.json();
      setTemplates(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchDevices = async () => {
    try {
      const res = await apiFetch('/api/devices');
      const data = await res.json();
      if (Array.isArray(data)) {
        setDevices(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const uniqueDeviceTypes = Array.from(new Set(devices.map(d => d.type?.toLowerCase()).filter(Boolean)));

  const openAddModal = () => {
    setIsEditing(false);
    setCurrentId(null);
    setName('');
    setDescription('');
    setFrequency('daily');
    setItems([{ id: 'item_1', label: '', type: 'checkbox', required: true }]);
    setDeviceTypes([]);
    setIsModalOpen(true);
  };

  const openEditModal = (t: any) => {
    setIsEditing(true);
    setCurrentId(t._id);
    setName(t.name);
    setDescription(t.description || '');
    setFrequency(t.frequency || 'daily');
    setItems(t.items || []);
    setDeviceTypes(t.deviceTypes || []);
    setIsModalOpen(true);
  };

  const handleAddItem = () => {
    setItems([...items, { id: `item_${Date.now()}`, label: '', type: 'checkbox', required: true }]);
  };

  const handleRemoveItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };
    setItems(newItems);
  };

  const handleToggleDeviceType = (type: string) => {
    if (deviceTypes.includes(type)) {
      setDeviceTypes(deviceTypes.filter(t => t !== type));
    } else {
      setDeviceTypes([...deviceTypes, type]);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || items.length === 0) return alert("Name and at least one item are required.");
    
    setIsSubmitting(true);
    const payload = {
      _id: currentId,
      name,
      description,
      frequency,
      items,
      deviceTypes,
      isActive: true
    };

    try {
      const res = await apiFetch('/api/walkthrough-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        setIsModalOpen(false);
        fetchTemplates();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to save template");
      }
    } catch (e) {
      console.error(e);
      alert("Error saving template");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;
    try {
      await apiFetch(`/api/walkthrough-templates/${id}`, { method: 'DELETE' });
      fetchTemplates();
    } catch (e) {
      console.error(e);
      alert('Failed to delete.');
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 lg:px-8 py-8">
      <PageHeader
        eyebrow="Settings"
        title="Walkthrough Templates"
        subtitle="Curate the walkthroughs and inspections your fleet must perform."
        right={<Btn variant="primary" icon={Plus} onClick={openAddModal}>New Template</Btn>}
      />

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--signal)]"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map(t => (
            <div key={t._id} className="bg-white rounded-xl p-6 border border-[var(--hairline)] shadow-sm hover:shadow-md transition-shadow relative group">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[var(--canvas)] text-[var(--signal)] rounded-lg">
                    <ListChecks className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-[var(--ink)]">{t.name}</h3>
                    <p className="text-xs text-[var(--steel)] capitalize">{t.frequency} Walkthrough</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEditModal(t)} className="p-1.5 text-[var(--steel)] hover:text-[var(--signal)] bg-[var(--canvas)] rounded-md transition-colors">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(t._id)} className="p-1.5 text-[var(--steel)] hover:text-[var(--red)] bg-[var(--canvas)] rounded-md transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              
              {t.description && <p className="text-sm text-[var(--steel)] mb-4 line-clamp-2">{t.description}</p>}
              
              <div className="flex items-center gap-4 text-sm text-[var(--steel)] border-t border-[var(--hairline)] pt-4 mt-auto">
                <div className="flex items-center gap-1.5">
                  <Settings className="w-4 h-4" />
                  <span>{t.items?.length || 0} checks</span>
                </div>
                {t.deviceTypes?.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <Smartphone className="w-4 h-4" />
                    <span>{t.deviceTypes.length} assets</span>
                  </div>
                )}
              </div>
            </div>
          ))}
          {templates.length === 0 && (
            <div className="col-span-full py-12 text-center text-[var(--steel)] border-2 border-dashed border-[var(--hairline)] rounded-xl">
              <ListChecks className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No walkthrough templates created yet.</p>
              <Btn variant="ghost" className="mt-4" onClick={openAddModal}>Create your first template</Btn>
            </div>
          )}
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={isEditing ? 'Edit Template' : 'New Template'} maxWidth="max-w-3xl">
        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Template Name" value={name} onChange={(e: any) => setName(e.target.value)} required placeholder="e.g. Morning Vehicle Inspection" />
            <Select 
              label="Frequency" 
              options={[
                { label: 'Daily', value: 'daily' },
                { label: 'Weekly', value: 'weekly' },
                { label: 'Bi-Weekly', value: 'bi-weekly' },
                { label: 'Monthly', value: 'monthly' },
                { label: 'Custom', value: 'custom' },
              ]} 
              value={frequency} 
              onChange={(e: any) => setFrequency(e.target.value)} 
            />
          </div>
          
          <Input label="Description (Optional)" value={description} onChange={(e: any) => setDescription(e.target.value)} placeholder="Brief description of when/how this should be performed" />

          {uniqueDeviceTypes.length > 0 && (
            <div className="bg-[var(--canvas)] p-4 rounded-xl border border-[var(--hairline)]">
              <label className="block text-sm font-semibold text-[var(--ink)] mb-3 flex items-center gap-2">
                <Smartphone className="w-4 h-4" /> Associated Asset/Device Types
              </label>
              <p className="text-xs text-[var(--steel)] mb-3">If selected, the driver will be prompted to check devices of these types during the walkthrough.</p>
              <div className="flex flex-wrap gap-2">
                {uniqueDeviceTypes.map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handleToggleDeviceType(type)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors capitalize ${
                      deviceTypes.includes(type) 
                        ? 'bg-[var(--signal)] border-[var(--signal)] text-white' 
                        : 'bg-white border-[var(--hairline)] text-[var(--steel)] hover:border-[var(--signal)]'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-semibold text-[var(--ink)]">Checklist Items</label>
              <Btn variant="ghost" type="button" icon={Plus} size="sm" onClick={handleAddItem}>Add Item</Btn>
            </div>
            
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
              {items.map((item, index) => (
                <div key={item.id} className="flex gap-3 items-start p-3 bg-white border border-[var(--hairline)] rounded-lg">
                  <div className="flex-1 space-y-3">
                    <Input 
                      label="Prompt / Question" 
                      value={item.label} 
                      onChange={(e: any) => handleItemChange(index, 'label', e.target.value)} 
                      required 
                      placeholder="e.g. Tire pressure ok?"
                    />
                    <div className="flex gap-4">
                      <div className="flex-1">
                        <Select 
                          label="Input Type" 
                          options={[
                            { label: 'Pass/Fail (Checkbox)', value: 'checkbox' },
                            { label: 'Text Input', value: 'text' },
                            { label: 'Number Input', value: 'number' },
                          ]} 
                          value={item.type} 
                          onChange={(e: any) => handleItemChange(index, 'type', e.target.value)} 
                        />
                      </div>
                      <div className="flex items-end pb-2 gap-4">
                        <label className="flex items-center gap-2 text-sm text-[var(--ink)] cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={item.required} 
                            onChange={(e) => handleItemChange(index, 'required', e.target.checked)}
                            className="rounded border-[var(--hairline)] text-[var(--signal)] focus:ring-[var(--signal)]"
                          />
                          Required
                        </label>
                        <label className="flex items-center gap-2 text-sm text-[var(--ink)] cursor-pointer">
                          <input 
                            type="checkbox" 
                            checked={item.isMileageField} 
                            onChange={(e) => handleItemChange(index, 'isMileageField', e.target.checked)}
                            className="rounded border-[var(--hairline)] text-[var(--signal)] focus:ring-[var(--signal)]"
                          />
                          Is Mileage
                        </label>
                      </div>
                    </div>
                  </div>
                  <button type="button" onClick={() => handleRemoveItem(index)} className="p-2 text-[var(--steel)] hover:text-[var(--red)] transition-colors mt-6" title="Remove Item">
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))}
              {items.length === 0 && (
                <div className="text-center py-6 text-[var(--steel)] text-sm">No items added yet.</div>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-[var(--hairline)] flex justify-end gap-2">
            <Btn variant="ghost" type="button" onClick={() => setIsModalOpen(false)}>Cancel</Btn>
            <Btn variant="primary" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Template'}
            </Btn>
          </div>
        </form>
      </Modal>
    </div>
  );
}
