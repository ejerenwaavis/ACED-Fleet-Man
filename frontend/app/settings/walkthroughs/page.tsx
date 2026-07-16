'use client';

import React, { useEffect, useState } from "react";
import { Plus, Edit2, Trash2, ArrowLeft } from "lucide-react";
import { PageHeader, Btn, Modal, Input, Select } from "@/components/fleet/UI";
import { useAuth } from "@/components/fleet/AuthProvider";
import { getApiBase, apiFetch } from "@/lib/api";
import Link from 'next/link';

export default function WalkthroughTemplates() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  const fetchTemplates = () => {
    apiFetch(`/api/walkthrough-templates`)
      .then(res => res.json())
      .then(data => {
         if(Array.isArray(data)) setTemplates(data);
      })
      .catch(console.error);
  };

  useEffect(() => {
    if (user?.role === 'admin' || user?.role === 'manager') {
      fetchTemplates();
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const payload = {
      _id: editingItem?._id,
      name: formData.get('name'),
      frequency: formData.get('frequency'),
      description: formData.get('description'),
      isActive: true,
      items: editingItem?.items || []
    };

    try {
      await apiFetch(`/api/walkthrough-templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      setIsModalOpen(false);
      fetchTemplates();
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;
    try {
      await apiFetch(`/api/walkthrough-templates/${id}`, { method: 'DELETE' });
      fetchTemplates();
    } catch (err) {
      console.error(err);
    }
  };

  const openEdit = (template: any) => {
    setEditingItem(template);
    setIsModalOpen(true);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Link href="/settings">
          <Btn variant="ghost" icon={ArrowLeft} className="px-2" />
        </Link>
        <div className="flex-1">
          <PageHeader eyebrow="Configuration" title="Walkthrough Templates" />
        </div>
        <Btn variant="primary" icon={Plus} onClick={() => { setEditingItem(null); setIsModalOpen(true); }}>
          Create Template
        </Btn>
      </div>

      <div className="bg-[var(--surface)] border border-[var(--hairline)] rounded-xl overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-gray-50/50 text-[var(--steel)] text-xs font-semibold uppercase tracking-wider border-b border-[var(--hairline)]">
            <tr>
              <th className="px-5 py-3">Name</th>
              <th className="px-5 py-3">Frequency</th>
              <th className="px-5 py-3">Fields Count</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--hairline)]">
            {templates.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-center text-[var(--steel)]">No walkthrough templates configured.</td>
              </tr>
            )}
            {templates.map(tmpl => (
              <tr key={tmpl._id} className="hover:bg-gray-50/50">
                <td className="px-5 py-4 font-semibold text-[var(--ink)]">
                  {tmpl.name}
                  <div className="text-xs font-normal text-[var(--steel)] mt-0.5">{tmpl.description}</div>
                </td>
                <td className="px-5 py-4 capitalize">{tmpl.frequency}</td>
                <td className="px-5 py-4 text-[var(--steel)]">{tmpl.items?.length || 0} fields</td>
                <td className="px-5 py-4 text-right flex justify-end gap-2">
                  <Link href={`/settings/walkthroughs/fields?id=${tmpl._id}`}>
                    <Btn variant="secondary">Manage Fields</Btn>
                  </Link>
                  <Btn variant="ghost" icon={Edit2} onClick={() => openEdit(tmpl)} />
                  <Btn variant="ghost" icon={Trash2} className="text-[var(--red)] hover:text-[var(--red)] hover:bg-[var(--red-bg)]" onClick={() => handleDelete(tmpl._id)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingItem ? "Edit Template" : "Create Template"}>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <Input label="Template Name" name="name" required defaultValue={editingItem?.name} placeholder="e.g. DOT Walkthrough" />
          <Input label="Description (Optional)" name="description" defaultValue={editingItem?.description} placeholder="e.g. Mandatory monthly inspection" />
          <Select 
            label="Frequency"
            name="frequency" 
            defaultValue={editingItem?.frequency || 'daily'}
            options={[
              { label: 'Daily', value: 'daily' },
              { label: 'Weekly', value: 'weekly' },
              { label: 'Bi-Weekly', value: 'bi-weekly' },
              { label: 'Monthly', value: 'monthly' },
              { label: 'Custom / On-Demand', value: 'custom' }
            ]}
          />
          <div className="flex gap-3 pt-4 border-t border-[var(--hairline)]">
            <Btn variant="ghost" className="flex-1" type="button" onClick={() => setIsModalOpen(false)}>Cancel</Btn>
            <Btn variant="primary" className="flex-1" type="submit">Save Template</Btn>
          </div>
        </form>
      </Modal>
    </div>
  );
}
