'use client';

import React, { useEffect, useState } from "react";
import { ArrowLeft, Plus, Trash2, Save, GripVertical } from "lucide-react";
import { PageHeader, Btn, Modal, Input, Select } from "@/components/fleet/UI";
import { useAuth } from "@/components/fleet/AuthProvider";
import { getApiBase, apiFetch } from "@/lib/api";
import Link from 'next/link';
import { useRouter } from "next/navigation";

export default function TemplateFieldsEditor() {
  const router = useRouter();
  const [template, setTemplate] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [newFieldType, setNewFieldType] = useState('checkbox');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('id');
    setTemplateId(id);
    if (!id) return;
    apiFetch(`/api/walkthrough-templates/${id}`)
      .then(res => res.json())
      .then(data => {
        if (!data.error) {
          setTemplate(data);
          setItems(data.items || []);
        }
      })
      .catch(console.error);
  }, []);

  const handleSaveFields = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await apiFetch(`/api/walkthrough-templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...template,
          items
        })
      });
      alert('Fields saved successfully!');
    } catch (err) {
      console.error(err);
      alert('Failed to save fields');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddField = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const newField = {
      id: 'field_' + Date.now().toString(36),
      label: formData.get('label'),
      type: formData.get('type'),
      required: formData.get('required') === 'on',
      isMileageField: formData.get('isMileageField') === 'on'
    };

    setItems([...items, newField]);
    setIsModalOpen(false);
    setNewFieldType('checkbox');
  };

  const removeField = (fieldId: string) => {
    setItems(items.filter(i => i.id !== fieldId));
  };

  if (!template) return <div className="p-10 text-center text-[var(--steel)]">Loading template...</div>;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/settings/walkthroughs">
          <Btn variant="ghost" icon={ArrowLeft} className="px-2" />
        </Link>
        <div className="flex-1">
          <PageHeader eyebrow={`Editing: ${template.name}`} title="Template Fields" />
        </div>
        <Btn variant="secondary" onClick={() => setIsModalOpen(true)} icon={Plus}>Add Field</Btn>
        <Btn variant="primary" onClick={handleSaveFields} icon={Save} disabled={isSubmitting}>
          {isSubmitting ? 'Saving...' : 'Save All Changes'}
        </Btn>
      </div>

      <div className="bg-[var(--surface)] border border-[var(--hairline)] rounded-xl overflow-hidden mb-8">
        <div className="p-4 bg-gray-50/50 border-b border-[var(--hairline)]">
          <h3 className="font-semibold text-[var(--ink)]">Form Fields</h3>
          <p className="text-sm text-[var(--steel)]">Configure the checklist items and questions for this walkthrough.</p>
        </div>
        
        {items.length === 0 ? (
          <div className="p-10 text-center text-[var(--steel)]">
            No fields added yet. Click "Add Field" to start building your walkthrough.
          </div>
        ) : (
          <div className="divide-y divide-[var(--hairline)]">
            {items.map((item, idx) => (
              <div key={item.id} className="p-4 flex items-center gap-4 bg-white hover:bg-gray-50/30">
                <GripVertical className="text-gray-300 w-5 h-5 cursor-move shrink-0" />
                <div className="flex-1">
                  <div className="font-semibold text-[var(--ink)] flex items-center gap-2">
                    {item.label}
                    {item.required && <span className="text-[10px] uppercase font-bold tracking-wider text-red-600 bg-red-50 px-1.5 py-0.5 rounded">Required</span>}
                    {item.isMileageField && <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--signal)] bg-[var(--canvas)] px-1.5 py-0.5 rounded">Mileage</span>}
                  </div>
                  <div className="text-xs text-[var(--steel)] mt-1 uppercase tracking-wider">Type: {item.type}</div>
                </div>
                <Btn variant="ghost" icon={Trash2} className="text-[var(--red)] hover:text-[var(--red)] hover:bg-[var(--red-bg)]" onClick={() => removeField(item.id)} />
              </div>
            ))}
          </div>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Add New Field">
        <form onSubmit={handleAddField} className="p-6 space-y-4">
          <Input label="Field Label / Question" name="label" required placeholder="e.g. Is the fire extinguisher present?" />
          <Select 
            label="Field Type"
            name="type" 
            required
            value={newFieldType}
            onChange={(e: any) => setNewFieldType(e.target.value)}
            options={[
              { label: 'Checkbox (Yes/No)', value: 'checkbox' },
              { label: 'Text Input', value: 'text' },
              { label: 'Number Input', value: 'number' }
            ]}
          />
          <div className="flex items-center gap-3 py-2">
            <input type="checkbox" id="required" name="required" className="w-5 h-5 rounded border-[var(--hairline)] text-[var(--signal)] focus:ring-[var(--signal)]" />
            <label htmlFor="required" className="text-sm font-medium text-[var(--ink)]">Make this field required</label>
          </div>
          {newFieldType === 'number' && (
            <div className="flex items-center gap-3 py-2 bg-[var(--canvas)] px-3 rounded-lg">
              <input type="checkbox" id="isMileageField" name="isMileageField" className="w-5 h-5 rounded border-[var(--hairline)] text-[var(--signal)] focus:ring-[var(--signal)]" />
              <label htmlFor="isMileageField" className="text-sm font-medium text-[var(--ink)]">Use this as the odometer/mileage reading<br/><span className="text-xs font-normal text-[var(--steel)]">Updates the vehicle's Last Known Mileage on Fleet Roster when submitted</span></label>
            </div>
          )}
          <div className="flex gap-3 pt-4 border-t border-[var(--hairline)]">
            <Btn variant="ghost" className="flex-1" type="button" onClick={() => setIsModalOpen(false)}>Cancel</Btn>
            <Btn variant="primary" className="flex-1" type="submit">Add Field</Btn>
          </div>
        </form>
      </Modal>
    </div>
  );
}