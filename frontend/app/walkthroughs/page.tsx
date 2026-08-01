'use client';

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader, Btn } from "@/components/fleet/UI";
import { apiFetch } from "@/lib/api";
import { ClipboardList, ArrowRight, Clock, FileText } from "lucide-react";

export default function WalkthroughsHub() {
  const router = useRouter();
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch(`/api/walkthrough-templates`)
      .then(res => res.json())
      .then(data => {
         if(Array.isArray(data)) setTemplates(data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-4 lg:px-8 py-8">
      <PageHeader
        eyebrow="Fleet Walkthroughs"
        title="Select Walkthrough Type"
      />

      <div className="mt-8">
        {loading ? (
          <div className="text-[var(--steel)]">Loading walkthrough types...</div>
        ) : templates.length === 0 ? (
          <div className="text-center p-12 bg-[var(--surface)] border border-[var(--hairline)] rounded-xl">
            <ClipboardList className="w-12 h-12 mx-auto text-[var(--steel-light)] mb-4" />
            <h3 className="text-lg font-semibold text-[var(--ink)]">No Walkthrough Templates Found</h3>
            <p className="text-[var(--steel)] mt-2">Admins need to create templates in Settings.</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map(tmpl => (
              <button
                key={tmpl._id}
                onClick={() => router.push(`/walkthrough?id=${tmpl._id}`)}
                className="flex flex-col items-start p-6 bg-[var(--surface)] border-2 border-[var(--hairline)] rounded-2xl hover:border-[var(--signal)] hover:shadow-lg transition-all text-left group"
              >
                <div className="w-12 h-12 rounded-xl bg-[var(--signal-dim)] flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <FileText className="w-6 h-6 text-[var(--signal)]" />
                </div>
                <h3 className="text-xl font-bold text-[var(--ink)] mb-2">{tmpl.name}</h3>
                <p className="text-sm text-[var(--steel)] flex-1">{tmpl.description || 'Standard vehicle inspection walkthrough.'}</p>
                <div className="mt-6 flex items-center justify-between w-full border-t border-[var(--hairline)] pt-4">
                  <span className="flex items-center text-xs font-semibold text-[var(--steel)] bg-[var(--canvas)] px-2 py-1 rounded-md capitalize">
                    <Clock className="w-3 h-3 mr-1" />
                    {tmpl.frequency || 'Custom'}
                  </span>
                  <div className="flex items-center text-[var(--signal)] font-medium text-sm">
                    Start <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
