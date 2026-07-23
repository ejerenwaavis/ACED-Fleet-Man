'use client';

import React, { useEffect, useState } from "react";
import { Settings as SettingsIcon, Plus, Trash2, Edit2, Users, Check, X as XIcon, Shield } from "lucide-react";
import { PageHeader, Btn, Modal, Input, Select } from "@/components/fleet/UI";
import { useAuth } from "@/components/fleet/AuthProvider";
import { getApiBase, apiFetch } from "@/lib/api";
import Link from 'next/link';

export default function Settings() {
  const { user } = useAuth();
  const API_BASE = getApiBase();
  const [requests, setRequests] = useState<any[]>([]);
  const [fleetUsers, setFleetUsers] = useState<any[]>([]);
  
  // Invite State
  const [inviteRole, setInviteRole] = useState('driver');
  const [invitePhone, setInvitePhone] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteResult, setInviteResult] = useState<any>(null);

  const fetchRequests = () => {
    apiFetch(`/api/onboarding/requests`)
      .then(res => res.json())
      .then(data => {
         if(Array.isArray(data)) setRequests(data);
      })
      .catch(console.error);
  };



  const fetchUsers = () => {
    apiFetch(`/api/users`)
      .then(res => res.json())
      .then(data => {
        if(Array.isArray(data)) setFleetUsers(data);
      })
      .catch(console.error);
  };

  useEffect(() => {
    if (user?.role === 'admin' || user?.role === 'manager') {
      fetchRequests();
      fetchUsers();
    }
  }, [user]);

  const handleResolveRequest = async (requestId: string, action: 'approve' | 'reject') => {
    if (!confirm(`Are you sure you want to ${action} this request?`)) return;
    try {
      await apiFetch(`/api/onboarding/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, action })
      });
      fetchRequests();
      fetchUsers();
    } catch (err) {
      console.error(err);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (newRole === 'remove' && !confirm('Are you sure you want to remove this user from the fleet?')) return;
    try {
      await apiFetch(`/api/users/${userId}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole })
      });
      fetchUsers();
    } catch (err) {
      console.error(err);
    }
  };

  const handleGenerateInvite = async () => {
    setInviteLoading(true);
    setInviteResult(null);
    try {
      const res = await apiFetch(`/api/invites/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: inviteRole, phone: invitePhone })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setInviteResult(data);
      setInvitePhone('');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setInviteLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <PageHeader eyebrow="Configuration" title="Settings" />
        <div className="flex items-center gap-3">
          <Link href="/settings/walkthroughs">
            <Btn variant="primary">Walkthrough Templates</Btn>
          </Link>
          <Btn 
            variant="ghost" 
            className="text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200"
            onClick={async () => {
              await apiFetch(`/api/auth/logout`, { method: 'POST' });
              window.location.href = '/login';
            }}
          >
            Logout
          </Btn>
        </div>
      </div>

      {requests.length > 0 && (
        <div className="bg-[var(--surface)] border border-[var(--hairline)] rounded-xl overflow-x-auto mt-6 mb-8">
          <div className="p-5 border-b border-[var(--hairline)] bg-amber-50/30">
            <h3 className="font-semibold text-lg text-[var(--ink)] flex items-center gap-2">
              <Users className="w-5 h-5 text-amber-600" /> Pending Team Requests
            </h3>
            <p className="text-sm text-[var(--steel-light)] mt-1">These users have requested to join your fleet. Review and approve to grant them driver access.</p>
          </div>
          <table className="w-full text-left border-collapse">
            <tbody className="divide-y divide-[var(--hairline)]">
              {requests.map(req => (
                <tr key={req._id} className="hover:bg-gray-50/50">
                  <td className="px-5 py-4">
                    <div className="font-semibold text-[var(--ink)]">{req.userId?.displayName || 'Unknown User'}</div>
                    <div className="text-xs text-[var(--steel)]">{req.userId?.email}</div>
                  </td>
                  <td className="px-5 py-4 text-right flex justify-end gap-2">
                    <Btn variant="primary" icon={Check} onClick={() => handleResolveRequest(req._id, 'approve')}>Approve</Btn>
                    <Btn variant="ghost" icon={XIcon} onClick={() => handleResolveRequest(req._id, 'reject')}>Deny</Btn>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="bg-[var(--surface)] border border-[var(--hairline)] rounded-xl overflow-x-auto mt-6 mb-8">
        <div className="p-5 border-b border-[var(--hairline)]">
          <h3 className="font-semibold text-lg text-[var(--ink)] flex items-center gap-2">
            <Shield className="w-5 h-5 text-[var(--signal)]" /> Team Members
          </h3>
          <p className="text-sm text-[var(--steel-light)] mt-1">Manage roles and access for members of your fleet.</p>
        </div>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-[var(--canvas)] border-b border-[var(--hairline)]">
              <th className="px-5 py-3 text-xs font-semibold text-[var(--steel-light)] uppercase tracking-wider">User</th>
              <th className="px-5 py-3 text-xs font-semibold text-[var(--steel-light)] uppercase tracking-wider">Role</th>
              <th className="px-5 py-3 text-xs font-semibold text-[var(--steel-light)] uppercase tracking-wider text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--hairline)]">
            {fleetUsers.map(member => (
              <tr key={member._id} className="hover:bg-gray-50/50">
                <td className="px-5 py-4">
                  <div className="font-semibold text-[var(--ink)]">{member.displayName || 'Unknown User'}</div>
                  <div className="text-xs text-[var(--steel)]">{member.email}</div>
                </td>
                <td className="px-5 py-4">
                  <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-semibold uppercase tracking-wider
                    ${member.role === 'admin' ? 'bg-purple-100 text-purple-700' : 
                      member.role === 'manager' ? 'bg-blue-100 text-blue-700' : 
                      'bg-gray-100 text-gray-700'}`}>
                    {member.role}
                  </span>
                </td>
                <td className="px-5 py-4 text-right">
                  {user?.role === 'admin' && member._id !== user?._id && (
                    <select 
                      className="text-sm border border-[var(--hairline)] rounded p-1 bg-white"
                      value={member.role}
                      onChange={(e) => handleRoleChange(member._id, e.target.value)}
                    >
                      <option value="driver">Driver</option>
                      <option value="manager">Manager</option>
                      <option value="admin">Admin</option>
                      <option value="remove" className="text-red-600 font-bold">Remove from Fleet</option>
                    </select>
                  )}
                  {user?.role === 'manager' && member.role === 'driver' && (
                    <select 
                      className="text-sm border border-[var(--hairline)] rounded p-1 bg-white"
                      value={member.role}
                      onChange={(e) => handleRoleChange(member._id, e.target.value)}
                    >
                      <option value="driver">Driver</option>
                      <option value="remove" className="text-red-600 font-bold">Remove from Fleet</option>
                    </select>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-[var(--surface)] border border-[var(--hairline)] rounded-xl overflow-x-auto mt-6 mb-8">
        <div className="p-5 border-b border-[var(--hairline)]">
          <h3 className="font-semibold text-lg text-[var(--ink)] flex items-center gap-2">
            <Plus className="w-5 h-5 text-[var(--signal)]" /> Invite Team Members
          </h3>
          <p className="text-sm text-[var(--steel-light)] mt-1">Generate an invite link or send an SMS invite to a new member.</p>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-sm font-semibold text-[var(--ink)] mb-1">Role</label>
              <select 
                className="w-full h-10 border border-[var(--hairline)] rounded-lg px-3 bg-white"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
              >
                <option value="driver">Driver</option>
                <option value="mechanic">Mechanic</option>
                <option value="manager">Manager</option>
                {user?.role === 'admin' && <option value="admin">Admin</option>}
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-sm font-semibold text-[var(--ink)] mb-1">Phone Number (Optional)</label>
              <Input 
                placeholder="e.g. +1234567890" 
                value={invitePhone} 
                onChange={(e: any) => setInvitePhone(e.target.value)}
              />
            </div>
          </div>
          
          <Btn variant="primary" onClick={handleGenerateInvite} disabled={inviteLoading}>
            {inviteLoading ? 'Generating...' : (invitePhone ? 'Send SMS Invite' : 'Generate Invite Link')}
          </Btn>

          {inviteResult && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="font-semibold text-green-800 mb-2">Invite Generated Successfully!</div>
              <p className="text-sm text-green-700 mb-2">
                Share this link with the user to allow them to join as a {inviteRole}:
              </p>
              <div className="flex items-center gap-2">
                <input 
                  type="text" 
                  readOnly 
                  value={inviteResult.inviteLink} 
                  className="flex-1 p-2 text-sm border border-green-300 rounded bg-white"
                />
                <Btn variant="outline" onClick={() => navigator.clipboard.writeText(inviteResult.inviteLink)}>
                  Copy
                </Btn>
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
