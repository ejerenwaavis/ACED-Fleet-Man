import { useState, useRef, useEffect } from 'react';
import { Modal, Btn, Input, Select, TextArea } from './UI';
import { apiFetch, getApiBase } from '@/lib/api';
import SignatureCanvas from 'react-signature-canvas';
import { AlertCircle, Check } from 'lucide-react';

interface AutoGenerateMmrModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AutoGenerateMmrModal({ isOpen, onClose }: AutoGenerateMmrModalProps) {
  const API_BASE = getApiBase();
  const [recordMonth, setRecordMonth] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [domicile, setDomicile] = useState('');
  
  const [fleetVehicles, setFleetVehicles] = useState<any[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Signature state
  const [userSignature, setUserSignature] = useState<string | null>(null);
  const [applySignature, setApplySignature] = useState('false');
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const sigCanvas = useRef<any>(null);

  useEffect(() => {
    if (isOpen) {
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

  useEffect(() => {
    if (isOpen && recordMonth) {
      apiFetch(`/api/auto-mmr-data?month=${recordMonth}`)
        .then(res => res.json())
        .then(data => setFleetVehicles(data))
        .catch(() => {});
    } else if (isOpen && !recordMonth) {
        // Just fetch active vehicles to populate the list without maintenance notes initially
        apiFetch('/api/vehicles-data')
        .then(res => res.json())
        .then(data => {
            const activeVehicles = data.filter((v: any) => v.status === 'Active' || v.status === 'In shop');
            setFleetVehicles(activeVehicles.map((v: any) => ({
                id: v._id,
                unit: v.truckNumber,
                mileage: v.lastKnownMileage || '',
                maintenancePerformed: 'false',
                outOfService: v.status === 'In shop' ? 'true' : 'false',
                maintenanceNotes: ''
            })));
        })
        .catch(() => {});
    }
  }, [isOpen, recordMonth]);

  const saveSignature = async () => {
    if (sigCanvas.current?.isEmpty()) return;
    setIsGenerating(true);
    try {
      const dataUrl = sigCanvas.current.getTrimmedCanvas().toDataURL('image/png');
      const blob = await (await fetch(dataUrl)).blob();
      
      const formData = new FormData();
      formData.append('signature', blob, 'sig.png');
      formData.append('name', 'user-sig');
      
      const res = await fetch(`${API_BASE}/api/user/signature`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error('Failed to save signature');
      const filename = await res.text();
      setUserSignature(filename);
      setShowSignaturePad(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerate = async () => {
    if (!recordMonth) return setError('Record Month is required');
    
    setIsGenerating(true);
    setError(null);
    try {
      const payload = fleetVehicles.map(v => ({
          unit: v.unit,
          recordMonth,
          mileage: parseInt(v.mileage, 10) || 0,
          mileageSource: 'actual',
          maintenancePerformed: v.maintenancePerformed === 'true',
          outOfService: v.outOfService === 'true',
          maintenance: v.maintenanceNotes ? [{ date: new Date().toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' }), description: v.maintenanceNotes }] : []
      }));
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
      const fileToUpload = new File([blob], 'auto_data.json', { type: 'application/json' });

      const formData = new FormData();
      formData.append('file', fileToUpload);
      formData.append('companyName', companyName);
      formData.append('domicile', domicile);
      formData.append('applySignature', applySignature);

      const res = await fetch(`${API_BASE}/api/generate-batch`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        throw new Error('Failed to generate batch MMRs');
      }

      const resBlob = await res.blob();
      const url = window.URL.createObjectURL(resBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `MMR_Batch_Auto.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      
      onClose();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Auto-Generate Fleet MMRs" maxWidth="max-w-4xl">
      <div className="space-y-4">
        {error && (
          <div className="p-3 text-sm rounded-lg flex gap-2 items-start border bg-[var(--red-bg)] text-[var(--red)] border-[var(--red)]">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="flex-1">{error}</span>
          </div>
        )}

        <div className="grid grid-cols-3 gap-4">
          <Input label="Record Month (YYYY-MM)" type="month" value={recordMonth} onChange={(e: any) => setRecordMonth(e.target.value)} required placeholder="2023-10" />
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
        
        <div className="border border-[var(--hairline)] rounded-xl overflow-hidden max-h-[400px] overflow-y-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead className="bg-[var(--canvas)] sticky top-0 border-b border-[var(--hairline)] z-10">
              <tr>
                <th className="px-3 py-2 font-semibold text-[var(--steel-light)]">Unit</th>
                <th className="px-3 py-2 font-semibold text-[var(--steel-light)] w-24">Mileage</th>
                <th className="px-3 py-2 font-semibold text-[var(--steel-light)] text-center w-28">Maintenance</th>
                <th className="px-3 py-2 font-semibold text-[var(--steel-light)] text-center w-16">OOS</th>
                <th className="px-3 py-2 font-semibold text-[var(--steel-light)]">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--hairline)]">
              {fleetVehicles.map((v, i) => (
                <tr key={v.id || v.unit} className="hover:bg-gray-50/50">
                  <td className="px-3 py-2 font-medium text-[var(--ink)]">{v.unit}</td>
                  <td className="px-3 py-2">
                    <input type="number" className="w-full border border-[var(--hairline)] rounded p-1 text-xs" value={v.mileage} onChange={(e) => {
                      const newFleet = [...fleetVehicles];
                      newFleet[i].mileage = e.target.value;
                      setFleetVehicles(newFleet);
                    }} />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <input type="checkbox" checked={v.maintenancePerformed === 'true'} onChange={(e) => {
                      const newFleet = [...fleetVehicles];
                      newFleet[i].maintenancePerformed = e.target.checked ? 'true' : 'false';
                      setFleetVehicles(newFleet);
                    }} />
                  </td>
                  <td className="px-3 py-2 text-center">
                    <input type="checkbox" checked={v.outOfService === 'true'} onChange={(e) => {
                      const newFleet = [...fleetVehicles];
                      newFleet[i].outOfService = e.target.checked ? 'true' : 'false';
                      setFleetVehicles(newFleet);
                    }} />
                  </td>
                  <td className="px-3 py-2">
                    <input type="text" className="w-full border border-[var(--hairline)] rounded p-1 text-xs" placeholder="Notes..." value={v.maintenanceNotes} onChange={(e) => {
                      const newFleet = [...fleetVehicles];
                      newFleet[i].maintenanceNotes = e.target.value;
                      setFleetVehicles(newFleet);
                    }} />
                  </td>
                </tr>
              ))}
              {fleetVehicles.length === 0 && (
                <tr><td colSpan={5} className="px-3 py-4 text-center text-[var(--steel)]">No active vehicles found</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" onClick={handleGenerate} disabled={isGenerating}>
            {isGenerating ? 'Generating...' : 'Generate Auto-ZIP'}
          </Btn>
        </div>
      </div>
    </Modal>
  );
}
