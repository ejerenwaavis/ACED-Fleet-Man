'use client';

import React, { useEffect, useState } from "react";
import { Plus, ListFilter, AlertTriangle, Upload, Barcode, FileText } from "lucide-react";
import { PageHeader, Btn, ManifestTag, StatusPill, OilGauge, Modal, Input, Select } from "@/components/fleet/UI";
import { BulkUploadModal } from "@/components/fleet/BulkUploadModal";
import { GenerateMmrModal } from "@/components/fleet/GenerateMmrModal";
import { getApiBase, apiFetch } from "@/lib/api";

export default function FleetRoster() {
  const API_BASE = getApiBase();
  const [vehicles, setVehicles] = useState([]);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isBulkUploadOpen, setIsBulkUploadOpen] = useState(false);
  const [editingTruck, setEditingTruck] = useState<any>(null);
  const [barcodeTruck, setBarcodeTruck] = useState<any>(null);
  const [mmrTruck, setMmrTruck] = useState<any>(null);

  const fetchVehicles = () => {
    apiFetch(`/api/vehicles-data`)
      .then(res => res.json())
      .then(d => setVehicles(d))
      .catch(console.error);
  };

  useEffect(() => {
    fetchVehicles();
  }, []);

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
      
      <div className="mt-6 mb-4 border-t border-[var(--hairline)] pt-4">
        <h4 className="text-sm font-semibold mb-3 text-[var(--ink)]">Documents (Optional)</h4>
        <Input type="file" label="Registration Document" name="registration" accept="image/*,.pdf" />
        <Input type="date" label="Registration Expiry Date" name="registrationExpiry" defaultValue={defaultValues?.registrationExpiry ? new Date(defaultValues.registrationExpiry).toISOString().split('T')[0] : ''} />
        <Input type="file" label="DOT Inspection" name="dotInspection" accept="image/*,.pdf" />
        <Input type="file" label="Insurance Policy" name="insurance" accept="image/*,.pdf" />
      </div>

      <div className="flex justify-end gap-2 mt-6">
        <Btn type="button" variant="ghost" onClick={() => { setIsAddOpen(false); setEditingTruck(null); }}>Cancel</Btn>
        <Btn type="submit" variant="primary">Save</Btn>
      </div>
    </form>
  );

  return (
    <div>
      <PageHeader
        eyebrow="Fleet"
        title="Fleet roster"
        subtitle={`${vehicles.length} trucks active right now`}
        right={
          <>
            <Btn variant="ghost" icon={ListFilter}>Filters</Btn>
            <Btn variant="ghost" icon={Upload} onClick={() => setIsBulkUploadOpen(true)}>Bulk Upload</Btn>
            <Btn variant="primary" icon={Plus} onClick={() => setIsAddOpen(true)}>Add truck</Btn>
          </>
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

      <Modal isOpen={!!barcodeTruck} onClose={() => setBarcodeTruck(null)} title={`Barcode - Truck #${barcodeTruck?.truckNumber}`}>
        {barcodeTruck && (
          <div className="flex flex-col items-center justify-center py-6 space-y-4">
            <div className="p-4 bg-white border border-[var(--hairline)] rounded-xl shadow-sm">
              <img 
                src={`${API_BASE}/api/vehicles/${barcodeTruck._id}/barcode?t=${Date.now()}`} 
                alt={`Barcode for ${barcodeTruck.truckNumber}`} 
                className="w-full h-auto object-contain"
                crossOrigin="use-credentials"
              />
            </div>
            <p className="text-sm text-[var(--steel-light)] text-center mt-3">
              Use this barcode for quick check-ins during vehicle walkthroughs.
            </p>
            <Btn variant="primary" onClick={() => {
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
          </div>
        )}
      </Modal>

      <GenerateMmrModal isOpen={!!mmrTruck} onClose={() => setMmrTruck(null)} mode="single" defaultVehicle={mmrTruck} />

      {/* Desktop Table */}
      <div className="hidden lg:block border border-[var(--hairline)] rounded-xl overflow-hidden bg-[var(--surface)]">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[var(--canvas)] border-b border-[var(--hairline)]">
              <th className="px-5 py-3 text-xs font-semibold text-[var(--steel-light)] uppercase tracking-wider">Truck</th>
              <th className="px-5 py-3 text-xs font-semibold text-[var(--steel-light)] uppercase tracking-wider">Status</th>
              <th className="px-5 py-3 text-xs font-semibold text-[var(--steel-light)] uppercase tracking-wider">Make / Model</th>
              <th className="px-5 py-3 text-xs font-semibold text-[var(--steel-light)] uppercase tracking-wider">Oil Life</th>
              <th className="px-5 py-3 text-xs font-semibold text-[var(--steel-light)] uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--hairline)]">
            {vehicles.map((v: any) => (
              <tr key={v._id} className="hover:bg-gray-50/50">
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
                <td className="px-5 py-4"><OilGauge pct={v.lastOilChange ? 50 : 0} /></td>
                <td className="px-5 py-4 text-right flex gap-2 justify-end">
                  <Btn variant="ghost" icon={FileText} onClick={() => setMmrTruck(v)}>MMR</Btn>
                  <Btn variant="ghost" icon={Barcode} onClick={() => setBarcodeTruck(v)}>Barcode</Btn>
                  <Btn variant="ghost" onClick={() => setEditingTruck(v)}>Edit</Btn>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Stacked Cards */}
      <div className="lg:hidden space-y-3">
        {vehicles.map((v: any) => (
          <div key={v._id} className="bg-[var(--surface)] border border-[var(--hairline)] rounded-xl p-4">
            <div className="flex items-start justify-between mb-4">
              <ManifestTag route={v.routeNumber} id={v.truckNumber} size="lg" />
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
              <div className="col-span-2">
                <span className="block text-xs text-[var(--steel-light)] mb-1">Oil Life</span>
                <OilGauge pct={v.lastOilChange ? 50 : 0} />
              </div>
              <div className="col-span-2 flex justify-end gap-2 mt-2">
                <Btn variant="ghost" icon={FileText} onClick={() => setMmrTruck(v)}>MMR</Btn>
                <Btn variant="ghost" icon={Barcode} onClick={() => setBarcodeTruck(v)}>Barcode</Btn>
                <Btn variant="ghost" onClick={() => setEditingTruck(v)}>Edit</Btn>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
