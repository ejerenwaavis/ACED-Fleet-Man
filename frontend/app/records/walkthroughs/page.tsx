'use client';

import React, { useEffect, useState } from "react";
import { format } from "date-fns";
import { PageHeader, Btn } from "@/components/fleet/UI";
import { apiFetch } from "@/lib/api";
import { FileText, Download, Filter, Search } from "lucide-react";
import { exportToCsv } from "@/lib/exportCsv";
import { useAuth } from "@/components/fleet/AuthProvider";

export default function WalkthroughLogsPage() {
  const { user } = useAuth();
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    apiFetch(`/api/walkthrough-records`)
      .then(res => res.json())
      .then(data => setRecords(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filteredRecords = records.filter(r => 
    r.vehicleId?.truckNumber?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.templateId?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.reporterId?.displayName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const exportData = () => {
    const dataToExport = filteredRecords.map((r: any) => {
      const base = {
        'Date': format(new Date(r.createdAt), 'yyyy-MM-dd HH:mm'),
        'Truck Number': r.vehicleId?.truckNumber || 'N/A',
        'Template': r.templateId?.name || 'Unknown',
        'Reporter': r.reporterId?.displayName || 'Unknown',
        'Mileage': r.mileage || 'N/A',
        'Maintenance Note': r.maintenanceNote || ''
      };
      
      // Flatten the dynamic data object
      const dynamicData = Object.entries(r.data || {}).reduce((acc: any, [key, value]) => {
        acc[`Data: ${key.replace(/_/g, ' ')}`] = value;
        return acc;
      }, {});

      return { ...base, ...dynamicData };
    });
    
    exportToCsv('Walkthrough_Logs', dataToExport);
  };

  if (user?.role !== 'admin') {
    return (
      <div className="p-8 text-center text-[var(--steel)]">
        You do not have permission to view this page.
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Records"
        title="Walkthrough Logs"
        subtitle="Global view of all submitted walkthroughs and inspections."
        right={
          <>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--steel-light)]" />
              <input 
                type="text" 
                placeholder="Search truck, template..."
                className="pl-9 pr-4 py-2 bg-white border border-[var(--hairline)] rounded-lg text-sm w-64 focus:outline-none focus:border-[var(--signal)] focus:ring-1 focus:ring-[var(--signal)]"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <Btn variant="ghost" icon={Filter}>Filter</Btn>
            <Btn variant="outline" icon={Download} onClick={exportData}>Export CSV</Btn>
          </>
        }
      />

      <div className="bg-white rounded-xl border border-[var(--hairline)] overflow-hidden shadow-sm mt-6">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse whitespace-nowrap">
            <thead>
              <tr className="bg-[var(--canvas)] border-b border-[var(--hairline)]">
                <th className="py-3 px-4 font-semibold text-[var(--steel)] text-xs uppercase tracking-wider">Date & Time</th>
                <th className="py-3 px-4 font-semibold text-[var(--steel)] text-xs uppercase tracking-wider">Truck</th>
                <th className="py-3 px-4 font-semibold text-[var(--steel)] text-xs uppercase tracking-wider">Template</th>
                <th className="py-3 px-4 font-semibold text-[var(--steel)] text-xs uppercase tracking-wider">Reporter</th>
                <th className="py-3 px-4 font-semibold text-[var(--steel)] text-xs uppercase tracking-wider">Mileage</th>
                <th className="py-3 px-4 font-semibold text-[var(--steel)] text-xs uppercase tracking-wider w-full">Submitted Data (Fields)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--hairline)]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[var(--steel)]">Loading logs...</td>
                </tr>
              ) : filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-[var(--steel)]">No walkthrough logs found.</td>
                </tr>
              ) : (
                filteredRecords.map((r) => (
                  <tr key={r._id} className="hover:bg-[var(--canvas)] transition-colors">
                    <td className="py-3 px-4 text-sm font-medium text-[var(--ink)]">
                      {format(new Date(r.createdAt), 'MMM d, yyyy h:mm a')}
                    </td>
                    <td className="py-3 px-4">
                      <span className="bg-gray-100 text-gray-800 text-xs font-semibold px-2.5 py-0.5 rounded border border-gray-200">
                        #{r.vehicleId?.truckNumber || 'N/A'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-[var(--ink)]">
                      {r.templateId?.name || 'Unknown Template'}
                    </td>
                    <td className="py-3 px-4 text-sm text-[var(--steel)]">
                      {r.reporterId?.displayName || 'Unknown'}
                    </td>
                    <td className="py-3 px-4 text-sm text-[var(--steel)]">
                      {r.mileage ? `${r.mileage.toLocaleString()} mi` : '-'}
                    </td>
                    <td className="py-3 px-4 text-sm">
                      <div className="flex gap-2 flex-wrap items-center max-w-xl">
                        {Object.entries(r.data || {}).slice(0, 5).map(([key, val]) => (
                          <div key={key} className="bg-white border border-[var(--hairline)] px-2 py-1 rounded text-xs flex gap-1 items-center shadow-sm">
                            <span className="text-[var(--steel)] capitalize">{key.replace(/_/g, ' ')}:</span>
                            <span className={`font-semibold ${val === 'pass' ? 'text-[var(--green)]' : val === 'fail' ? 'text-[var(--red)]' : 'text-[var(--ink)]'}`}>
                              {String(val)}
                            </span>
                          </div>
                        ))}
                        {Object.keys(r.data || {}).length > 5 && (
                          <div className="text-xs text-[var(--steel)] ml-1">
                            +{Object.keys(r.data || {}).length - 5} more
                          </div>
                        )}
                        {r.maintenanceNote && (
                          <div className="bg-[var(--red-bg)] text-[var(--red)] border border-red-200 px-2 py-1 rounded text-xs font-semibold">
                            Note Attached
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
