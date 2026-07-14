'use client';

import React, { useEffect, useState } from "react";
import { Plus, ListFilter, AlertTriangle } from "lucide-react";
import { PageHeader, Btn, ManifestTag, StatusPill, OilGauge, Modal, Input, Select } from "@/components/fleet/UI";

const API_BASE = typeof window !== 'undefined' && window.location.port === '3001' ? 'http://localhost:3000' : '';

export default function FleetRoster() {
  const [vehicles, setVehicles] = useState([]);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingTruck, setEditingTruck] = useState<any>(null);

  const fetchVehicles = () => {
    fetch(`${API_BASE}/api/vehicles-data`)
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
    const data = Object.fromEntries(formData.entries());

    const url = id ? `${API_BASE}/api/vehicles/${id}` : `${API_BASE}/api/vehicles`;
    
    try {
      await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(data)
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
            <Btn variant="primary" icon={Plus} onClick={() => setIsAddOpen(true)}>Add truck</Btn>
          </>
        }
      />

      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title="Add Truck">
        <TruckForm />
      </Modal>

      <Modal isOpen={!!editingTruck} onClose={() => setEditingTruck(null)} title="Edit Truck">
        {editingTruck && <TruckForm defaultValues={editingTruck} id={editingTruck._id} />}
      </Modal>

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
                <td className="px-5 py-4 text-right">
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
              <div className="col-span-2 flex justify-end mt-2">
                <Btn variant="ghost" onClick={() => setEditingTruck(v)}>Edit</Btn>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
