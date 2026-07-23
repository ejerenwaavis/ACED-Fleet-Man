import React, { useState } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { Btn, Modal } from './UI';
import { Upload, FileType, Check, AlertCircle } from 'lucide-react';
import { getApiBase, apiFetch } from '@/lib/api';

interface BulkUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function BulkUploadModal({ isOpen, onClose, onSuccess }: BulkUploadModalProps) {
  const API_BASE = getApiBase();
  const [activeTab, setActiveTab] = useState<'file' | 'text'>('file');
  const [rawText, setRawText] = useState('');
  const [parsedData, setParsedData] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Smart mapping algorithm
  const mapVehicleData = (rawItem: any) => {
    // If it already matches the schema perfectly, use it
    if (rawItem.truckNumber && rawItem.routeNumber) {
      return {
        ...rawItem,
        registrationExpiry: rawItem.registrationExpiry ? new Date(rawItem.registrationExpiry).toISOString() : undefined,
      };
    }

    // Try to extract nested properties if they exist (handling the provided JSON structure)
    const getNested = (obj: any, path: string) => {
      return path.split('.').reduce((acc, part) => acc && acc[part], obj);
    };

    const truckNumber = rawItem.fleet_unit_number || rawItem.truckNumber || rawItem.unit_number || rawItem.id;
    const make = rawItem.make || '';
    const model = rawItem.model || '';
    const makeModel = rawItem.makeModel || `${make} ${model}`.trim();
    const vin = rawItem.vin || '';
    
    let fuelType = 'gas';
    const rawFuel = (rawItem.fuel || rawItem.fuelType || '').toUpperCase();
    if (rawFuel === 'D' || rawFuel === 'DIESEL') fuelType = 'diesel';
    else if (rawFuel === 'E' || rawFuel === 'ELECTRIC') fuelType = 'electric';
    else if (rawFuel === 'H' || rawFuel === 'HYBRID') fuelType = 'hybrid';

    const licensePlate = rawItem.licensePlate || getNested(rawItem, 'current_registration.license_plate_number');
    
    let registrationExpiry = rawItem.registrationExpiry;
    const rawExpiry = getNested(rawItem, 'current_registration.expiration_date');
    if (rawExpiry) {
      registrationExpiry = new Date(rawExpiry).toISOString();
    }

    const registrationUrl = rawItem.registrationUrl || getNested(rawItem, 'current_registration.document_link');
    const dotInspectionUrl = rawItem.dotInspectionUrl || getNested(rawItem, 'current_fai.document_link');

    return {
      routeNumber: rawItem.routeNumber || 'Unassigned',
      truckNumber: String(truckNumber),
      vin,
      makeModel,
      fuelType,
      licensePlate,
      registrationExpiry,
      registrationUrl,
      dotInspectionUrl,
      status: 'Active'
    };
  };

  const handleProcessData = (data: any[]) => {
    try {
      if (!Array.isArray(data)) throw new Error("Parsed data is not an array");
      const mapped = data.map(mapVehicleData).filter(v => v.truckNumber && v.truckNumber !== 'undefined');
      if (mapped.length === 0) throw new Error("No valid vehicles found in the data");
      setParsedData(mapped);
      setError(null);
    } catch (err: any) {
      setError(err.message);
      setParsedData([]);
    }
  };

  const handleTextSubmit = () => {
    try {
      // Try JSON first
      try {
        const json = JSON.parse(rawText);
        // Sometimes the array is wrapped in an object e.g. { vehicles: [...] }
        if (json.vehicles && Array.isArray(json.vehicles)) {
          handleProcessData(json.vehicles);
        } else {
          handleProcessData(json);
        }
        return;
      } catch (e) {
        // Not JSON, try CSV
        Papa.parse(rawText, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            if (results.errors.length > 0 && results.data.length === 0) {
              setError("Failed to parse as JSON or CSV");
            } else {
              handleProcessData(results.data);
            }
          }
        });
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase();
    
    if (ext === 'json') {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const json = JSON.parse(event.target?.result as string);
          if (json.vehicles && Array.isArray(json.vehicles)) handleProcessData(json.vehicles);
          else handleProcessData(json);
        } catch (err) {
          setError("Invalid JSON file");
        }
      };
      reader.readAsText(file);
    } else if (ext === 'csv') {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => handleProcessData(results.data),
        error: () => setError("Failed to parse CSV file")
      });
    } else if (ext === 'xlsx' || ext === 'xls') {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const json = XLSX.utils.sheet_to_json(firstSheet);
          handleProcessData(json);
        } catch (err) {
          setError("Failed to parse Excel file");
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      setError("Unsupported file format. Please use .json, .csv, or .xlsx");
    }
    
    // Reset file input
    e.target.value = '';
  };

  const handleConfirm = async () => {
    setIsUploading(true);
    try {
      const res = await apiFetch(`/api/vehicles/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsedData)
      });
      if (!res.ok) throw new Error('Bulk upload failed on the server');
      
      setParsedData([]);
      setRawText('');
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Bulk Upload Vehicles">
      <div className="space-y-4">
        {/* Tabs */}
        {parsedData.length === 0 && (
          <>
            <div className="flex border-b border-[var(--hairline)]">
              <button
                className={`flex-1 py-2 text-sm font-semibold transition-colors ${activeTab === 'file' ? 'border-b-2 border-[var(--signal)] text-[var(--signal)]' : 'text-[var(--steel)]'}`}
                onClick={() => setActiveTab('file')}
              >
                Upload File
              </button>
              <button
                className={`flex-1 py-2 text-sm font-semibold transition-colors ${activeTab === 'text' ? 'border-b-2 border-[var(--signal)] text-[var(--signal)]' : 'text-[var(--steel)]'}`}
                onClick={() => setActiveTab('text')}
              >
                Paste Data
              </button>
            </div>

            {activeTab === 'file' && (
              <div className="border-2 border-dashed border-[var(--hairline)] rounded-xl p-8 text-center bg-gray-50/50">
                <FileType className="w-10 h-10 text-[var(--steel)] mx-auto mb-3" />
                <h3 className="text-sm font-semibold text-[var(--ink)] mb-1">Drag and drop or click to upload</h3>
                <p className="text-xs text-[var(--steel-light)] mb-4">Supports .json, .csv, .xlsx</p>
                <div className="relative inline-block">
                  <Btn variant="ghost" icon={Upload}>Select File</Btn>
                  <input 
                    type="file" 
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                    accept=".json,.csv,.xlsx,.xls"
                    onChange={handleFileUpload}
                  />
                </div>
              </div>
            )}

            {activeTab === 'text' && (
              <div className="space-y-3">
                <p className="text-xs text-[var(--steel)]">Paste raw JSON (array or object with "vehicles" array) or CSV text below.</p>
                <textarea
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  className="w-full h-40 p-3 text-xs font-mono border border-[var(--hairline)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--signal)]"
                  placeholder='[\n  {\n    "fleet_unit_number": "123",\n    "make": "FORD"\n  }\n]'
                />
                <Btn variant="primary" className="w-full" onClick={handleTextSubmit}>Parse Text</Btn>
              </div>
            )}
          </>
        )}

        {error && (
          <div 
            className="p-3 text-sm rounded-lg flex gap-2 items-start border"
            style={{ backgroundColor: 'var(--red-bg)', color: 'var(--red)', borderColor: 'var(--red)' }}
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="flex-1">{error}</span>
          </div>
        )}

        {/* Preview Table */}
        {parsedData.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[var(--ink)]">Preview Data</h3>
              <span className="text-xs bg-[var(--signal)] text-white px-2 py-0.5 rounded-full font-bold">{parsedData.length} records</span>
            </div>
            
            <div className="border border-[var(--hairline)] rounded-lg overflow-x-auto max-h-60 overflow-y-auto bg-white">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 sticky top-0 border-b border-[var(--hairline)] shadow-sm">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Truck #</th>
                    <th className="px-3 py-2 font-semibold">Make/Model</th>
                    <th className="px-3 py-2 font-semibold">VIN</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--hairline)]">
                  {parsedData.slice(0, 100).map((v, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-mono font-medium">{v.truckNumber}</td>
                      <td className="px-3 py-2 text-[var(--steel)]">{v.makeModel || '-'}</td>
                      <td className="px-3 py-2 font-mono text-[var(--steel)] truncate max-w-[120px]">{v.vin || '-'}</td>
                    </tr>
                  ))}
                  {parsedData.length > 100 && (
                    <tr>
                      <td colSpan={3} className="px-3 py-2 text-center text-[var(--steel)] italic">
                        ...and {parsedData.length - 100} more
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            <div className="flex gap-2 pt-2">
              <Btn variant="ghost" className="flex-1" onClick={() => setParsedData([])}>Cancel</Btn>
              <Btn variant="primary" className="flex-1" onClick={handleConfirm} disabled={isUploading}>
                {isUploading ? 'Uploading...' : 'Confirm & Save'}
              </Btn>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
