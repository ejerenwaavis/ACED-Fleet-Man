'use client';

import React, { useEffect, useState } from "react";
import { Plus, ListFilter, AlertTriangle, Upload, Barcode, FileText, Download } from "lucide-react";
import { PageHeader, Btn, ManifestTag, StatusPill, OilGauge, Modal, Input, Select } from "@/components/fleet/UI";
import { exportToCsv } from "@/lib/exportCsv";
import { BulkUploadModal } from "@/components/fleet/BulkUploadModal";
import { GenerateMmrModal } from "@/components/fleet/GenerateMmrModal";
import { useSearchParams } from 'next/navigation';
import { getApiBase, apiFetch } from "@/lib/api";

export default function FleetRoster() {
  const API_BASE = getApiBase();
  const searchParams = useSearchParams();
  const [vehicles, setVehicles] = useState([]);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
  const [editingTruck, setEditingTruck] = useState<any>(null);
  const [barcodeTruck, setBarcodeTruck] = useState<any>(null);
  const [mmrTruck, setMmrTruck] = useState<any>(null);
  const [isExportMode, setIsExportMode] = useState(false);
  const [selectedExportIds, setSelectedExportIds] = useState<string[]>([]);
  const [exportError, setExportError] = useState<string | null>(null);

  // Core fields for both export formats: unit number, VIN, and last known mileage are the
  // must-haves; registration/DOT expiration are included too since they were asked for, but are
  // the first columns to drop if the export ever needs to be trimmed further.
  const formatMileage = (value: number | string | null | undefined) =>
    value ? `${Number(value).toLocaleString()} mi` : '--';

  const buildExportRows = () => {
    const selectedVehicles = vehicles.filter((v: any) => selectedExportIds.includes(v._id));
    return selectedVehicles.map((v: any) => ({
      'Truck Number': v.truckNumber || 'N/A',
      'VIN': v.vin || 'N/A',
      'Last Known Mileage': v.lastKnownMileage ? formatMileage(v.lastKnownMileage) : 'N/A',
      'Registration Expiry': v.registrationExpiry ? new Date(v.registrationExpiry).toLocaleDateString() : 'N/A',
      'DOT Expiry': v.dotExpiry ? new Date(v.dotExpiry).toLocaleDateString() : 'N/A'
    }));
  };

  const escapeHtml = (value: unknown) =>
    String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

  // Give the browser a brief moment to finish rendering the new document before printing.
  const PRINT_DIALOG_DELAY_MS = 100;

  const buildExportHtml = (rows: Record<string, string>[], headers: string[]) => `
    <html>
      <head>
        <title>Fleet Roster Export</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 32px; color: #12151c; }
          h1 { font-size: 20px; margin-bottom: 4px; }
          p.meta { color: #6b7280; font-size: 12px; margin-top: 0; margin-bottom: 24px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #e4e7ec; font-size: 13px; }
          th { background: #f2f4f7; text-transform: uppercase; letter-spacing: 0.04em; font-size: 11px; color: #6b7280; }
        </style>
      </head>
      <body>
        <h1>Fleet Roster Export</h1>
        <p class="meta">Generated ${escapeHtml(new Date().toLocaleString())} &middot; ${rows.length} vehicle(s)</p>
        <table>
          <thead><tr>${headers.map(h => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>
          <tbody>
            ${rows.map((r: Record<string, string>) => `<tr>${headers.map(h => `<td>${escapeHtml(r[h])}</td>`).join('')}</tr>`).join('')}
          </tbody>
        </table>
      </body>
    </html>
  `;

  const handleExportPdf = () => {
    const rows = buildExportRows();
    if (!rows.length) {
      setExportError('Please select vehicles to export.');
      return false;
    }
    const headers = Object.keys(rows[0]);
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      setExportError('Please allow pop-ups to export the PDF.');
      return false;
    }
    setExportError(null);
    try {
      printWindow.document.write(buildExportHtml(rows, headers));
      printWindow.document.close();
      window.setTimeout(() => {
        if (!printWindow.closed) {
          printWindow.print();
        }
      }, PRINT_DIALOG_DELAY_MS);
    } catch (error) {
      console.error('Failed to prepare export window', error);
      setExportError('Unable to prepare the PDF export window.');
      printWindow.close();
      return false;
    }
    return true;
  };

  const fetchVehicles = () => {
    apiFetch(`/api/vehicles-data`)
      .then(res => res.json())
      .then(d => setVehicles(d))
      .catch(console.error);
  };

  useEffect(() => {
    fetchVehicles();
  }, []);

  const q = searchParams.get('q')?.toLowerCase() || '';
  const filteredVehicles = vehicles.filter((v: any) => {
    if (!q) return true;
    return (
      (v.truckNumber && v.truckNumber.toLowerCase().includes(q)) ||
      (v.routeNumber && v.routeNumber.toLowerCase().includes(q)) ||
      (v.makeModel && v.makeModel.toLowerCase().includes(q)) ||
      (v.vin && v.vin.toLowerCase().includes(q)) ||
      (v.licensePlate && v.licensePlate.toLowerCase().includes(q)) ||
      (v.status && v.status.toLowerCase().includes(q))
    );
  });

  const handleSubmit = async (e: React.FormEvent, id?: string) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);

    const url = id ? `/api/vehicles/${id}` : `/api/vehicles`;
    
    try {
      await apiFetch(url, {
        method: 'POST',
        headers: {
          'Accept': 'application/json'
        },
        body: formData
      });
      setIsAddOpen(false);
      setEditingTruck(null);
      fetchVehicles();
    } catch (err) {
      console.error(err);
    }
  };

  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrWarning, setOcrWarning] = useState<string | null>(null);

  const handleOcrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    let file = e.target.files?.[0];
    if (!file) return;
    
    setOcrLoading(true);
    setOcrWarning(null);
    try {
      if (file.type === 'application/pdf') {
          const pdfjsLib = await import('pdfjs-dist');
          pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
          
          const arrayBuffer = await file.arrayBuffer();
          const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
          const page = await pdf.getPage(1);
          const viewport = page.getViewport({ scale: 2.0 });
          
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error("Canvas context error");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          
          await page.render({ canvasContext: ctx, viewport } as any).promise;
          
          const imgBlob = await new Promise<Blob | null>(res => canvas.toBlob(res, 'image/jpeg', 0.95));
          if (!imgBlob) throw new Error("Conversion failed");
          
          file = new File([imgBlob], file.name.replace('.pdf', '.jpg'), { type: 'image/jpeg' });
      }

      const formData = new FormData();
      formData.append('file', file);
      const res = await apiFetch('/api/vehicles/ocr', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      
      if (data.vin) {
          const vinInput = document.getElementsByName('vin')[0] as HTMLInputElement;
          if (vinInput) vinInput.value = data.vin;
      }
      if (data.licensePlate) {
          const plateInput = document.getElementsByName('licensePlate')[0] as HTMLInputElement;
          if (plateInput) plateInput.value = data.licensePlate;
      }
      if (data.expiry) {
          const expiryInput = document.getElementsByName('registrationExpiry')[0] as HTMLInputElement;
          if (expiryInput) expiryInput.value = data.expiry;
      }
      if (data.dotExpiry) {
          const dotExpiryInput = document.getElementsByName('dotExpiry')[0] as HTMLInputElement;
          if (dotExpiryInput) dotExpiryInput.value = data.dotExpiry;
      }

      if (data.fallbackUsed) {
          setOcrWarning("Image processed but accuracy isn't guaranteed (OpenAI unavailable, used local fallback). Please review carefully.");
      }
    } catch (err) {
      console.error("OCR Failed", err);
      setOcrWarning("Failed to process document. Please enter data manually.");
    } finally {
      setOcrLoading(false);
    }
  };

  const TruckForm = ({ defaultValues, id }: { defaultValues?: any, id?: string }) => (
    <form onSubmit={(e) => handleSubmit(e, id)}>
      <Input label="Truck Number (e.g. TRK-104)" name="truckNumber" defaultValue={defaultValues?.truckNumber} required />
      <Input label="Route Number (e.g. R-04)" name="routeNumber" defaultValue={defaultValues?.routeNumber} required />
      <Input label="Make / Model" name="makeModel" defaultValue={defaultValues?.makeModel} />
      <Input label="License Plate" name="licensePlate" defaultValue={defaultValues?.licensePlate} />
      <Input label="VIN" name="vin" defaultValue={defaultValues?.vin} />
      <Select label="Fuel Type" name="fuelType" defaultValue={defaultValues?.fuelType || 'gas'} options={[
        { label: 'Gas', value: 'gas' },
        { label: 'Diesel', value: 'diesel' },
        { label: 'Electric', value: 'electric' }
      ]} />
      <Select label="Status" name="status" defaultValue={defaultValues?.status || 'Active'} options={[
        { label: 'Active', value: 'Active' },
        { label: 'In shop', value: 'In shop' },
        { label: 'Down', value: 'Down' }
      ]} />
      
      <Input label="Last Known Mileage" name="lastKnownMileage" type="number" defaultValue={defaultValues?.lastKnownMileage} />
      <Input label="Registration Expiry Date" name="registrationExpiry" type="date" defaultValue={defaultValues?.registrationExpiry ? new Date(defaultValues.registrationExpiry).toISOString().split('T')[0] : ''} />
      <Input label="DOT Inspection Expiry Date" name="dotExpiry" type="date" defaultValue={defaultValues?.dotExpiry ? new Date(defaultValues.dotExpiry).toISOString().split('T')[0] : ''} />
      <div className="mt-6 mb-4 border-t border-[var(--hairline)] pt-4 relative">
        <div className="flex flex-col gap-1 mb-3">
            <div className="flex justify-between items-center">
                <h4 className="text-sm font-semibold text-[var(--ink)]">Documents (Optional)</h4>
                {ocrLoading && <span className="text-xs font-semibold text-[var(--signal)] animate-pulse">Scanning with AI...</span>}
            </div>
            {ocrWarning && <div className="text-xs text-[var(--amber)] font-medium p-2 bg-[var(--amber-bg)] rounded-md">{ocrWarning}</div>}
        </div>
        <div onChange={(e: any) => handleOcrUpload(e)}>
            <Input type="file" label="Registration Document" name="registration" accept="image/*,.pdf" />
        </div>
        <Input type="date" label="Registration Expiry Date" name="registrationExpiry" defaultValue={defaultValues?.registrationExpiry ? new Date(defaultValues.registrationExpiry).toISOString().split('T')[0] : ''} />
        <div onChange={(e: any) => handleOcrUpload(e)}>
            <Input type="file" label="DOT Inspection" name="dotInspection" accept="image/*,.pdf" />
        </div>
        <Input type="file" label="Insurance Policy" name="insurance" accept="image/*,.pdf" />
      </div>

      <div className="flex justify-end gap-2 mt-6">
        <Btn type="button" variant="ghost" onClick={() => { setIsAddOpen(false); setEditingTruck(null); }}>Cancel</Btn>
        <Btn type="submit" variant="primary" disabled={ocrLoading}>Save</Btn>
      </div>
    </form>
  );

  return (
    <div>
      <PageHeader
        eyebrow="Fleet"
        title="Fleet roster"
        subtitle={`${filteredVehicles.length} trucks active right now`}
        right={
          isExportMode ? (
            <div className="flex items-center gap-2">
              {exportError && <span className="text-sm font-medium text-[var(--amber)]">{exportError}</span>}
              <span className="text-sm font-semibold text-[var(--steel)]">{selectedExportIds.length} selected</span>
              <Btn variant="ghost" onClick={() => { setIsExportMode(false); setSelectedExportIds([]); setExportError(null); }}>Cancel</Btn>
              <Btn variant="ghost" icon={FileText} disabled={!selectedExportIds.length} onClick={() => {
                if (handleExportPdf()) {
                  setIsExportMode(false);
                  setSelectedExportIds([]);
                }
              }}>Export PDF</Btn>
              <Btn variant="primary" icon={Download} disabled={!selectedExportIds.length} onClick={() => {
                setExportError(null);
                exportToCsv('Fleet_Roster_Export', buildExportRows());
                setIsExportMode(false);
                setSelectedExportIds([]);
              }}>Export CSV</Btn>
            </div>
          ) : (
            <>
              <Btn variant="ghost" icon={ListFilter}>Filters</Btn>
              <Btn variant="ghost" icon={Download} onClick={() => { setIsExportMode(true); setExportError(null); }}>Export Details</Btn>
              <Btn variant="ghost" icon={Upload} onClick={() => setIsBulkUploadOpen(true)}>Bulk Upload</Btn>
              <Btn variant="primary" icon={Plus} onClick={() => setIsAddOpen(true)}>Add truck</Btn>
            </>
          )
        }
      />

      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Add Truck">
        <TruckForm />
      </Modal>

      <BulkUploadModal 
        isOpen={isBulkUploadOpen} 
        onClose={() => setIsBulkUploadOpen(false)} 
        onSuccess={fetchVehicles} 
      />

      <Modal isOpen={!!editingTruck} onClose={() => setEditingTruck(null)} title="Edit Truck">
        {editingTruck && <TruckForm defaultValues={editingTruck} id={editingTruck._id} />}
      </Modal>

      <Modal isOpen={!!barcodeTruck} onClose={() => setBarcodeTruck(null)} title={`ID Tags - Truck #${barcodeTruck?.truckNumber}`}>
        {barcodeTruck && (
          <div className="flex flex-col items-center justify-center py-4 space-y-6">
            
            {/* Barcode Section */}
            <div className="w-full text-center">
              <h3 className="font-semibold text-[var(--ink)] mb-2">Check-in Barcode</h3>
              <div className="p-4 bg-white border border-[var(--hairline)] rounded-xl shadow-sm inline-block w-full max-w-sm">
                <img 
                  src={`${API_BASE}/api/vehicles/${barcodeTruck._id}/barcode?t=${Date.now()}`} 
                  alt={`Barcode for ${barcodeTruck.truckNumber}`} 
                  className="w-full h-auto object-contain"
                  crossOrigin="use-credentials"
                />
              </div>
              <p className="text-xs text-[var(--steel-light)] mt-2">Used for quick check-ins during vehicle walkthroughs.</p>
            </div>

            {/* QR Code Section */}
            <div className="w-full text-center pt-4 border-t border-[var(--hairline)]">
              <h3 className="font-semibold text-[var(--ink)] mb-2">Public QR Code</h3>
              <div className="p-4 bg-white border border-[var(--hairline)] rounded-xl shadow-sm inline-block">
                <img 
                  src={`${API_BASE}/api/vehicles/${barcodeTruck._id}/qrcode?t=${Date.now()}`} 
                  alt={`QR Code for ${barcodeTruck.truckNumber}`} 
                  className="w-48 h-48 object-contain mx-auto"
                  crossOrigin="use-credentials"
                />
              </div>
              <p className="text-xs text-[var(--steel-light)] mt-2">Scan to view DOT/Reg status or request maintenance.</p>
            </div>

            <div className="flex gap-3 w-full">
              <Btn variant="outline" className="flex-1 justify-center" onClick={() => {
                 const printWindow = window.open('', '_blank');
                 printWindow?.document.write(`
                   <html>
                     <head><title>Print Barcode - ${barcodeTruck.truckNumber}</title></head>
                      <body style="display:flex;justify-content:center;align-items:center;height:100vh;margin:0;">
                       <img src="${API_BASE}/api/vehicles/${barcodeTruck._id}/barcode?t=${Date.now()}" crossOrigin="use-credentials" style="max-width: 100%; height: auto;" />
                      </body> <script>window.onload = function() { window.print(); window.close(); }</script>
                   </html>
                 `);
                 printWindow?.document.close();
              }}>
                Print Barcode
              </Btn>
              <Btn variant="primary" className="flex-1 justify-center" onClick={() => {
                 const printWindow = window.open('', '_blank');
                 printWindow?.document.write(`
                   <html>
                     <head><title>Print QR Code - ${barcodeTruck.truckNumber}</title></head>
                      <body style="display:flex;flex-direction:column;justify-content:center;align-items:center;height:100vh;margin:0;font-family:sans-serif;">
                       <h2 style="margin-bottom:20px;">Truck #${barcodeTruck.truckNumber}</h2>
                       <img src="${API_BASE}/api/vehicles/${barcodeTruck._id}/qrcode?t=${Date.now()}" crossOrigin="use-credentials" style="max-width: 100%; height: auto;" />
                       <p style="margin-top:20px;color:#555;">Scan to Request Maintenance or View Status</p>
                      </body> <script>window.onload = function() { window.print(); window.close(); }</script>
                   </html>
                 `);
                 printWindow?.document.close();
              }}>
                Print QR Code
              </Btn>
            </div>
          </div>
        )}
      </Modal>

      <GenerateMmrModal isOpen={!!mmrTruck} onClose={() => setMmrTruck(null)} mode="single" defaultVehicle={mmrTruck} />

      {/* Desktop Table */}
      <div className="hidden lg:block border border-[var(--hairline)] rounded-xl overflow-hidden bg-[var(--surface)]">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[var(--canvas)] border-b border-[var(--hairline)]">
              {isExportMode && (
                <th className="px-5 py-3 w-12 text-center">
                  <input type="checkbox" 
                         checked={selectedExportIds.length === filteredVehicles.length && filteredVehicles.length > 0}
                         onChange={(e) => setSelectedExportIds(e.target.checked ? filteredVehicles.map((v: any) => v._id) : [])}
                         className="rounded border-[var(--hairline)]" />
                </th>
              )}
              <th className="px-5 py-3 text-xs font-semibold text-[var(--steel-light)] uppercase tracking-wider">Truck</th>
              <th className="px-5 py-3 text-xs font-semibold text-[var(--steel-light)] uppercase tracking-wider">Status</th>
              <th className="px-5 py-3 text-xs font-semibold text-[var(--steel-light)] uppercase tracking-wider">Make / Model</th>
              <th className="px-5 py-3 text-xs font-semibold text-[var(--steel-light)] uppercase tracking-wider">Mileage</th>
              <th className="px-5 py-3 text-xs font-semibold text-[var(--steel-light)] uppercase tracking-wider">Oil Life</th>
              <th className="px-5 py-3 text-xs font-semibold text-[var(--steel-light)] uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--hairline)]">
            {filteredVehicles.map((v: any) => (
              <tr key={v._id} className="hover:bg-gray-50/50">
                {isExportMode && (
                  <td className="px-5 py-4 text-center">
                    <input type="checkbox" 
                           checked={selectedExportIds.includes(v._id)}
                           onChange={(e) => {
                             if (e.target.checked) setSelectedExportIds([...selectedExportIds, v._id]);
                             else setSelectedExportIds(selectedExportIds.filter(id => id !== v._id));
                           }}
                           className="rounded border-[var(--hairline)]" />
                  </td>
                )}
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <ManifestTag route={v.routeNumber} id={v.truckNumber} />
                  </div>
                </td>
                <td className="px-5 py-4"><StatusPill status={v.status} /></td>
                <td className="px-5 py-4">
                  <div className="text-sm font-medium text-[var(--ink)]">{v.makeModel || 'N/A'}</div>
                  <div className="text-xs text-[var(--steel)]">{v.vin || 'No VIN'}</div>
                </td>
                <td className="px-5 py-4 font-semibold text-[var(--ink)]">{formatMileage(v.lastKnownMileage)}</td>
                <td className="px-5 py-4"><OilGauge pct={v.lastOilChange ? 50 : 0} /></td>
                <td className="px-5 py-4 text-right flex gap-2 justify-end">
                  <Btn variant="ghost" icon={FileText} onClick={() => setMmrTruck(v)}>MMR</Btn>
                  <Btn variant="ghost" icon={Barcode} onClick={() => setBarcodeTruck(v)}>ID Tags</Btn>
                  <Btn variant="ghost" onClick={() => setEditingTruck(v)}>Edit</Btn>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Stacked Cards */}
      <div className="lg:hidden space-y-3">
        {filteredVehicles.map((v: any) => (
          <div key={v._id} className={`bg-[var(--surface)] border rounded-xl p-4 ${isExportMode && selectedExportIds.includes(v._id) ? 'border-[var(--signal)] ring-1 ring-[var(--signal)]' : 'border-[var(--hairline)]'}`}>
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                {isExportMode && (
                  <input
                    type="checkbox"
                    checked={selectedExportIds.includes(v._id)}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedExportIds([...selectedExportIds, v._id]);
                      else setSelectedExportIds(selectedExportIds.filter(id => id !== v._id));
                    }}
                    className="w-5 h-5 rounded border-[var(--hairline)] text-[var(--signal)] focus:ring-[var(--signal)]"
                  />
                )}
                <ManifestTag route={v.routeNumber} id={v.truckNumber} size="lg" />
              </div>
              <StatusPill status={v.status} />
            </div>
            <div className="grid grid-cols-2 gap-y-3 gap-x-2 text-sm">
              <div>
                <span className="block text-xs text-[var(--steel-light)] mb-0.5">Make/Model</span>
                <span className="font-semibold text-[var(--ink)]">{v.makeModel || 'N/A'}</span>
              </div>
              <div>
                <span className="block text-xs text-[var(--steel-light)] mb-0.5">License Plate</span>
                <span className="font-semibold text-[var(--ink)] font-mono">{v.licensePlate || 'N/A'}</span>
              </div>
              <div>
                <span className="block text-xs text-[var(--steel-light)] mb-0.5">Last Known Mileage</span>
                <span className="font-semibold text-[var(--ink)]">{formatMileage(v.lastKnownMileage)}</span>
              </div>
              <div>
                <span className="block text-xs text-[var(--steel-light)] mb-1">Oil Life</span>
                <OilGauge pct={v.lastOilChange ? 50 : 0} />
              </div>
              <div className="col-span-2 flex justify-end gap-2 mt-2">
                <Btn variant="ghost" icon={FileText} onClick={() => setMmrTruck(v)}>MMR</Btn>
                <Btn variant="ghost" icon={Barcode} onClick={() => setBarcodeTruck(v)}>ID Tags</Btn>
                <Btn variant="ghost" onClick={() => setEditingTruck(v)}>Edit</Btn>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
