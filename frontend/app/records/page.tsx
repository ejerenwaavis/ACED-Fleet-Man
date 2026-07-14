'use client';

import React, { useEffect, useState } from "react";
import { Download, FileText, Filter } from "lucide-react";
import { PageHeader, Btn, ManifestTag } from "@/components/fleet/UI";

export default function MaintenanceRecords() {
  const [records, setRecords] = useState([]);

  useEffect(() => {
    const API_BASE = typeof window !== 'undefined' && window.location.port === '3001' ? 'http://localhost:3000' : '';
    fetch(`${API_BASE}/api/mmr-data`)
      .then(res => res.json())
      .then(d => setRecords(d))
      .catch(console.error);
  }, []);

  return (
    <div>
      <PageHeader
        eyebrow="Records"
        title="Maintenance records"
        subtitle="Monthly Maintenance Reports (MMR)"
        right={
          <>
            <Btn variant="ghost" icon={Filter}>Filter</Btn>
            <Btn variant="primary" icon={Download}>Export all</Btn>
          </>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {records.map((r: any) => (
          <div key={r._id} className="bg-[var(--surface)] border border-[var(--hairline)] rounded-xl p-5 hover:border-[var(--steel-light)] transition-colors cursor-pointer group">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 bg-[var(--canvas)] rounded-lg text-[var(--signal)] group-hover:bg-[var(--signal-dim)] transition-colors">
                <FileText className="w-5 h-5" />
              </div>
              <ManifestTag route={r.vehicleId?.routeNumber || 'N/A'} id={r.vehicleId?.truckNumber || 'N/A'} />
            </div>
            <h4 className="font-semibold text-[var(--ink)] mb-1">
              {new Date(r.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} Report
            </h4>
            <div className="text-sm text-[var(--steel)] flex items-center justify-between mt-3 pt-3 border-t border-[var(--hairline)]">
              <span>{r.mileage} miles</span>
              <Btn variant="ghost" className="h-8 px-2 text-xs">Download PDF</Btn>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
