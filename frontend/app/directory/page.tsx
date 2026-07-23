'use client';

import React, { useEffect, useState } from "react";
import { Search, MapPin, Star, Wrench, ShieldCheck, Mail, Phone, ChevronRight, CheckCircle2 } from "lucide-react";
import { PageHeader, Btn, Modal } from "@/components/fleet/UI";
import { apiFetch } from "@/lib/api";

export default function DirectoryPage() {
  const [msps, setMsps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMsp, setSelectedMsp] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [partnershipTerms, setPartnershipTerms] = useState("Standard Net-30 invoicing. Please review our fleet requirements.");
  const [requesting, setRequesting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchDirectory();
  }, []);

  const fetchDirectory = async () => {
    try {
      const res = await apiFetch(`/api/msp/directory`);
      const data = await res.json();
      setMsps(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const openModal = (msp: any) => {
    setSelectedMsp(msp);
    setSuccess(false);
    setIsModalOpen(true);
  };

  const handleRequest = async (e: any) => {
    e.preventDefault();
    if (requesting) return;
    setRequesting(true);
    setSuccess(false);
    try {
      const res = await apiFetch(`/api/partnerships`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetEntityId: selectedMsp._id,
          terms: partnershipTerms
        })
      });
      if (res.ok) {
        setSuccess(true);
        setTimeout(() => {
          setIsModalOpen(false);
        }, 2000);
      } else {
        const errorData = await res.json();
        alert(errorData.error || "Failed to send request.");
      }
    } catch (err) {
      console.error(err);
      alert("An error occurred while sending the request.");
    } finally {
      setRequesting(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-[var(--steel)]">Loading service provider directory...</div>;

  return (
    <div className="h-full flex flex-col max-w-6xl mx-auto">
      <PageHeader 
        eyebrow="Service Directory" 
        title="Discover Service Providers" 
        subtitle="Find and partner with top-rated service providers and professionals in your area"
      />

      <div className="mb-6 flex gap-4">
        <div className="flex-1 flex items-center gap-2 px-4 py-3 rounded-xl bg-[var(--surface)] border border-[var(--hairline)] shadow-sm">
          <Search className="w-5 h-5 text-[var(--steel)]" />
          <input 
            placeholder="Search for shops, specialties, or locations..." 
            className="bg-transparent border-none focus:outline-none w-full text-[var(--ink)]"
          />
        </div>
        <Btn variant="ghost" icon={MapPin}>Filter by Location</Btn>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {msps.map((msp: any) => (
          <div key={msp._id} className="bg-white rounded-2xl border border-[var(--hairline)] overflow-hidden shadow-sm hover:shadow-md transition-shadow group flex flex-col">
            <div className="h-32 bg-[var(--ink)] relative p-4 flex flex-col justify-between">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--signal)] rounded-bl-full opacity-10 pointer-events-none"></div>
              <div className="flex justify-between items-start z-10">
                <div className="bg-white/10 backdrop-blur-md px-2 py-1 rounded text-xs font-semibold text-white flex items-center gap-1">
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                  4.9
                </div>
                <div className="bg-white/10 backdrop-blur-md p-1.5 rounded-full text-white" title="Verified Partner">
                  <ShieldCheck className="w-4 h-4 text-green-400" />
                </div>
              </div>
              <h3 className="font-display font-bold text-xl text-white z-10">{msp.name}</h3>
            </div>
            
            <div className="p-5 flex-1 flex flex-col">
              <p className="text-sm text-[var(--steel)] mb-4 line-clamp-2">
                {msp.description || "Professional fleet maintenance and repair services."}
              </p>
              
              <div className="space-y-2 mb-6">
                <div className="flex items-center gap-2 text-sm text-[var(--steel-light)]">
                  <MapPin className="w-4 h-4 shrink-0" />
                  <span className="truncate">{msp.address || "Local Area"}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-[var(--steel-light)]">
                  <Mail className="w-4 h-4 shrink-0" />
                  <span className="truncate">{msp.contactEmail || "Contact directly"}</span>
                </div>
                {msp.contactPhone && (
                  <div className="flex items-center gap-2 text-sm text-[var(--steel-light)]">
                    <Phone className="w-4 h-4 shrink-0" />
                    <span className="truncate">{msp.contactPhone}</span>
                  </div>
                )}
              </div>
              
              <div className="mt-auto pt-4 border-t border-[var(--hairline)] flex justify-between items-center">
                <div className="flex gap-1 text-[var(--signal)] font-semibold text-xs items-center uppercase tracking-wider">
                  <Wrench className="w-3 h-3" />
                  Full Service
                </div>
                <button onClick={() => openModal(msp)} className="w-8 h-8 rounded-full bg-[var(--surface)] hover:bg-[var(--signal)] hover:text-white flex items-center justify-center transition-colors group-hover:scale-110">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}

        {msps.length === 0 && (
          <div className="col-span-full py-12 text-center border-2 border-dashed border-[var(--hairline)] rounded-2xl">
            <Wrench className="w-12 h-12 text-[var(--steel-light)] mx-auto mb-3 opacity-50" />
            <h3 className="text-lg font-bold text-[var(--ink)] mb-1">No mechanic shops found</h3>
            <p className="text-[var(--steel)]">There are currently no mechanic entities registered in the directory.</p>
          </div>
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Request Partnership">
        {selectedMsp && !success && (
          <form onSubmit={handleRequest} className="space-y-4">
            <div className="mb-4 bg-[var(--surface)] p-4 rounded-xl border border-[var(--hairline)]">
              <h3 className="font-bold text-lg text-[var(--ink)] flex items-center gap-2">
                {selectedMsp.name}
                <ShieldCheck className="w-4 h-4 text-green-500" />
              </h3>
              <p className="text-sm text-[var(--steel)] mt-1">You are requesting to bond your fleet with this shop.</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-[var(--ink)] mb-1.5">Proposed Terms / Notes</label>
              <textarea 
                className="w-full px-3 py-2 border border-[var(--hairline)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--signal)] text-sm bg-white"
                rows={4}
                value={partnershipTerms}
                onChange={(e) => setPartnershipTerms(e.target.value)}
                required
              />
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Btn type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Btn>
              <Btn type="submit" variant="primary" disabled={requesting}>
                {requesting ? "Sending..." : "Send Request"}
              </Btn>
            </div>
          </form>
        )}
        
        {success && (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-xl font-bold text-[var(--ink)] mb-2">Request Sent!</h3>
            <p className="text-[var(--steel)]">Your partnership request has been securely delivered to {selectedMsp?.name}. They will review it shortly.</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
