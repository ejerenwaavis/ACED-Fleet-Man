import React, { useState, useEffect, useRef } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import SignatureCanvas from 'react-signature-canvas';
import { Btn, Modal, Input, Select, TextArea } from './UI';
import { Upload, FileType, Check, AlertCircle, Trash2 } from 'lucide-react';
import { getApiBase, apiFetch } from '@/lib/api';

interface GenerateMmrModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'single' | 'batch';
  defaultVehicle?: any;
}

export function GenerateMmrModal({ isOpen, onClose, mode, defaultVehicle }: GenerateMmrModalProps) {
  const API_BASE = getApiBase();
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Single mode state
  const getCurrentMonth = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };
  const [recordMonth, setRecordMonth] = useState(getCurrentMonth());
  const [mileage, setMileage] = useState('');
  const [maintenancePerformed, setMaintenancePerformed] = useState('false');
  const [outOfService, setOutOfService] = useState('false');
  const [companyName, setCompanyName] = useState('ACED Fleet');
  const [domicile, setDomicile] = useState('');
  const [maintenanceNotes, setMaintenanceNotes] = useState('');
  const [sendToEmail, setSendToEmail] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Batch mode state
  const [activeTab, setActiveTab] = useState<'file' | 'text'>('file');
  const [rawText, setRawText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Signature state
  const [userSignature, setUserSignature] = useState<string | null>(null);
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [applySignature, setApplySignature] = useState('true');
  const sigCanvas = useRef<any>(null);

  useEffect(() => {
    if (isOpen) {
      setSuccessMessage(null);
      setError(null);
      apiFetch('/api/auth/me')
        .then(res => res.json())
        .then(data => {
          if (data.user?.signatureFilename) {
            setUserSignature(data.user.signatureFilename);
            setShowSignaturePad(false);
          } else {
            setShowSignaturePad(true);
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  const saveSignature = async () => {
    if (sigCanvas.current && !sigCanvas.current.isEmpty()) {
      setIsGenerating(true);
      try {
        const blob: Blob = await new Promise(resolve => sigCanvas.current.getTrimmedCanvas().toBlob(resolve, 'image/png'));
        const formData = new FormData();
        formData.append('signature', blob, 'signature.png');
        
        const res = await apiFetch('/api/user/signature', {
           method: 'POST',
           body: formData
        });
        if (res.ok) {
           const data = await res.json();
           setUserSignature(data.filename);
           setShowSignaturePad(false);
        } else {
           throw new Error('Failed to save signature');
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsGenerating(false);
      }
    }
  };
  const handleSingleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isGenerating) return;
    setIsGenerating(true);
    setError(null);
    try {
      const maintenance = maintenanceNotes ? [{
        date: new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }),
        description: maintenanceNotes
      }] : [];

      const payload = {
        unit: defaultVehicle?.truckNumber || 'Unknown',
        recordMonth,
        mileage: parseInt(mileage, 10),
        mileageSource: 'actual',
        maintenancePerformed: maintenancePerformed === 'true',
        outOfService: outOfService === 'true',
        companyName,
        domicile,
        applySignature: applySignature === 'true',
        maintenance,
        sendToEmail
      };

      const res = await apiFetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        let errMsg = 'Failed to generate MMR';
        try { const errData = await res.json(); errMsg = errData.error || errMsg; } catch(e) {}
        throw new Error(errMsg);
      }

      if (sendToEmail) {
        const data = await res.json();
        setSuccessMessage(data.message || 'Email sent successfully!');
        setTimeout(() => { onClose(); }, 2000);
      } else {
        // Trigger download
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `MMR_${payload.unit}_${recordMonth}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        onClose();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleBatchGenerate = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    setError(null);
    try {
      let fileToUpload = selectedFile;
      
      // If using text paste, convert to a file
      if (activeTab === 'text') {
        if (!rawText.trim()) throw new Error('Please paste JSON data');
        
        // Try parsing just to validate it's json or csv
        let isJson = false;
        try {
          JSON.parse(rawText);
          isJson = true;
        } catch(e) {}
        
        const blob = new Blob([rawText], { type: isJson ? 'application/json' : 'text/csv' });
        fileToUpload = new File([blob], isJson ? 'data.json' : 'data.csv', { type: isJson ? 'application/json' : 'text/csv' });
      }

      if (!fileToUpload) throw new Error('Please select a file or paste data');

      const formData = new FormData();
      formData.append('file', fileToUpload);
      formData.append('companyName', companyName);
      formData.append('domicile', domicile);
      formData.append('applySignature', applySignature);
      if (sendToEmail) formData.append('sendToEmail', sendToEmail);

      const res = await fetch(`${API_BASE}/api/generate-batch`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        let errMsg = 'Failed to generate batch MMRs';
        try { const errData = await res.json(); errMsg = errData.error || errMsg; } catch(e) {}
        throw new Error(errMsg);
      }

      if (sendToEmail) {
        const data = await res.json();
        setSuccessMessage(data.message || 'Batch emails sent successfully!');
        setTimeout(() => { onClose(); }, 2000);
      } else {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `MMR_Batch.zip`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        onClose();
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError(null);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={mode === 'single' ? `Generate MMR - ${defaultVehicle?.truckNumber}` : 'Batch Generate MMRs'}>
      <div className="space-y-4">
        {error && (
          <div className="p-3 text-sm rounded-lg flex gap-2 items-start border bg-[var(--red-bg)] text-[var(--red)] border-[var(--red)]">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="flex-1">{error}</span>
          </div>
        )}
        {successMessage && (
          <div className="p-3 text-sm rounded-lg flex gap-2 items-start border bg-[var(--green-bg)] text-[var(--green)] border-green-200">
            <Check className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="flex-1">{successMessage}</span>
          </div>
        )}

        {mode === 'single' ? (
          <form id="single-mmr-form" onSubmit={handleSingleGenerate}>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Record Month (YYYY-MM)" type="month" value={recordMonth} onChange={(e: any) => setRecordMonth(e.target.value)} required placeholder="2023-10" />
              <Input label="Mileage" type="number" value={mileage} onChange={(e: any) => setMileage(e.target.value)} required />
              <Select label="Maintenance Performed" value={maintenancePerformed} onChange={(e: any) => setMaintenancePerformed(e.target.value)} options={[{label: 'Yes', value: 'true'}, {label: 'No', value: 'false'}]} />
              <Select label="Out of Service" value={outOfService} onChange={(e: any) => setOutOfService(e.target.value)} options={[{label: 'Yes', value: 'true'}, {label: 'No', value: 'false'}]} />
              <Input label="Company Name" value={companyName} onChange={(e: any) => setCompanyName(e.target.value)} />
              <Input label="Domicile" value={domicile} onChange={(e: any) => setDomicile(e.target.value)} />
            </div>
            <TextArea label="Maintenance Notes (Optional)" value={maintenanceNotes} onChange={(e: any) => setMaintenanceNotes(e.target.value)} placeholder="E.g. Oil change, replaced tires..." />
            <div className="mt-4">
              <Input label="Send to Email (Optional)" type="email" value={sendToEmail} onChange={(e: any) => setSendToEmail(e.target.value)} placeholder="admin@example.com (leaves blank to download locally)" />
            </div>
            
            <div className="mt-4 pt-4 border-t border-[var(--hairline)]">
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-sm font-semibold text-[var(--ink)]">Signature</h4>
                <Select name="applySignature" value={applySignature} onChange={(e: any) => setApplySignature(e.target.value)} options={[{label: 'Apply Signature', value: 'true'}, {label: 'No Signature', value: 'false'}]} />
              </div>
              
              {applySignature === 'true' && (
                <div className="border border-[var(--hairline)] rounded-lg p-4 bg-[var(--canvas)]">
                  {showSignaturePad ? (
                    <div>
                      <div className="border border-dashed border-[var(--steel-light)] rounded bg-white mb-2" style={{height: 150}}>
                        <SignatureCanvas ref={sigCanvas} canvasProps={{className: 'w-full h-full'}} />
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Btn type="button" variant="ghost" onClick={() => sigCanvas.current?.clear()}>Clear</Btn>
                        <Btn type="button" variant="primary" onClick={saveSignature} disabled={isGenerating}>Save Signature</Btn>
                        {userSignature && <Btn type="button" variant="ghost" onClick={() => setShowSignaturePad(false)}>Cancel</Btn>}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="h-16 w-48 bg-white border border-[var(--hairline)] rounded overflow-hidden flex items-center justify-center p-2">
                          <img src={`${API_BASE}/signatures/${userSignature}`} alt="Saved Signature" className="max-h-full max-w-full object-contain" />
                        </div>
                        <span className="text-xs text-[var(--steel)] flex items-center gap-1"><Check className="w-3 h-3 text-[var(--green)]" /> Saved in profile</span>
                      </div>
                      <Btn type="button" variant="ghost" onClick={() => { setShowSignaturePad(true); setTimeout(() => sigCanvas.current?.clear(), 100); }}>Change</Btn>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <div className="flex justify-end gap-2 mt-6">
              <Btn type="button" variant="ghost" onClick={onClose}>Cancel</Btn>
              <Btn type="submit" variant="primary" disabled={isGenerating}>
                {isGenerating ? 'Generating...' : 'Generate PDF'}
              </Btn>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input label="Company Name" value={companyName} onChange={(e: any) => setCompanyName(e.target.value)} />
              <Input label="Domicile" value={domicile} onChange={(e: any) => setDomicile(e.target.value)} />
            </div>

            <div className="mt-2 pt-2 border-t border-[var(--hairline)]">
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-sm font-semibold text-[var(--ink)]">Signature</h4>
                <Select name="applySignature" value={applySignature} onChange={(e: any) => setApplySignature(e.target.value)} options={[{label: 'Apply Signature', value: 'true'}, {label: 'No Signature', value: 'false'}]} />
              </div>
              
              {applySignature === 'true' && (
                <div className="border border-[var(--hairline)] rounded-lg p-4 bg-[var(--canvas)] mb-4">
                  {showSignaturePad ? (
                    <div>
                      <div className="border border-dashed border-[var(--steel-light)] rounded bg-white mb-2" style={{height: 150}}>
                        <SignatureCanvas ref={sigCanvas} canvasProps={{className: 'w-full h-full'}} />
                      </div>
                      <div className="flex gap-2 justify-end">
                        <Btn type="button" variant="ghost" onClick={() => sigCanvas.current?.clear()}>Clear</Btn>
                        <Btn type="button" variant="primary" onClick={saveSignature} disabled={isGenerating}>Save Signature</Btn>
                        {userSignature && <Btn type="button" variant="ghost" onClick={() => setShowSignaturePad(false)}>Cancel</Btn>}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="h-16 w-48 bg-white border border-[var(--hairline)] rounded overflow-hidden flex items-center justify-center p-2">
                          <img src={`${API_BASE}/signatures/${userSignature}`} alt="Saved Signature" className="max-h-full max-w-full object-contain" />
                        </div>
                        <span className="text-xs text-[var(--steel)] flex items-center gap-1"><Check className="w-3 h-3 text-[var(--green)]" /> Saved in profile</span>
                      </div>
                      <Btn type="button" variant="ghost" onClick={() => { setShowSignaturePad(true); setTimeout(() => sigCanvas.current?.clear(), 100); }}>Change</Btn>
                    </div>
                  )}
                </div>
              )}
            </div>
            
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
                Paste JSON/CSV
              </button>
            </div>



            {activeTab === 'file' && (
              <div className="border-2 border-dashed border-[var(--hairline)] rounded-xl p-8 text-center bg-gray-50/50">
                <FileType className="w-10 h-10 text-[var(--steel)] mx-auto mb-3" />
                <h3 className="text-sm font-semibold text-[var(--ink)] mb-1">
                  {selectedFile ? selectedFile.name : 'Drag and drop or click to upload'}
                </h3>
                <p className="text-xs text-[var(--steel-light)] mb-4">Supports .json, .csv</p>
                <div className="relative inline-block">
                  <Btn variant="ghost" icon={Upload}>Select File</Btn>
                  <input 
                    type="file" 
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                    accept=".json,.csv"
                    onChange={handleFileUpload}
                  />
                </div>
              </div>
            )}

            {activeTab === 'text' && (
              <div className="space-y-3">
                <p className="text-xs text-[var(--steel)]">Paste JSON array or CSV for batch generation.</p>
                <textarea
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  className="w-full h-40 p-3 text-xs font-mono border border-[var(--hairline)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--signal)]"
                  placeholder='[\n  {\n    "unit": "123",\n    "recordMonth": "2023-10",\n    "mileage": 15000,\n    "maintenancePerformed": false,\n    "outOfService": false\n  }\n]'
                />
              </div>
            )}
            
            <div className="flex justify-end gap-2 mt-6">
              <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
              <Btn variant="primary" onClick={handleBatchGenerate} disabled={isGenerating}>
                {isGenerating ? 'Generating...' : 'Generate Batch ZIP'}
              </Btn>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
