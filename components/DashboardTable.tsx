'use client';

import StatusBadge from './StatusBadge';
import Button from './Button';
import { useState } from 'react';
import NotesModal from './NotesModal';

export type DashboardCandidate = {
  id: string;
  name: string;
  title: string;
  skills: string[];
  experience: number;
  status?: string;
  notes?: string;
  resumeUrl?: string;
};

type Props = {
  candidates: DashboardCandidate[];
  onUpdateStatus: (id: string, status: string) => Promise<void>;
  onUpdateNotes: (id: string, notes: string) => Promise<void>;
};

const statuses = ['Strong', 'Good', 'Average', 'Rejected'];

export default function DashboardTable({ candidates, onUpdateStatus, onUpdateNotes }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [notesValue, setNotesValue] = useState<string>('');

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs font-semibold uppercase text-muted">
          <tr>
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Title</th>
            <th className="px-4 py-3">Experience</th>
            <th className="px-4 py-3">Skills</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {candidates.map((cand) => (
            <tr key={cand.id} className="border-t border-slate-100">
              <td className="px-4 py-3 font-semibold text-ink">{cand.name}</td>
              <td className="px-4 py-3 text-muted">{cand.title}</td>
              <td className="px-4 py-3 text-muted">{cand.experience} yrs</td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-1">
                  {cand.skills.slice(0, 4).map((s) => (
                    <span key={s} className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-ink">
                      {s}
                    </span>
                  ))}
                </div>
              </td>
              <td className="px-4 py-3">
                <StatusBadge value={cand.status || 'Unassigned'} />
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-2">
                  {statuses.map((status) => (
                    <Button
                      key={status}
                      variant="ghost"
                      className="px-2 py-1 text-xs"
                      loading={loadingId === `${cand.id}-${status}`}
                      onClick={async () => {
                        setLoadingId(`${cand.id}-${status}`);
                        await onUpdateStatus(cand.id, status);
                        setLoadingId(null);
                      }}
                    >
                      {status}
                    </Button>
                  ))}
                  <Button
                    variant="ghost"
                    className="px-2 py-1 text-xs"
                    onClick={() => {
                      setOpenId(cand.id);
                      setNotesValue(cand.notes || '');
                    }}
                  >
                    Notes
                  </Button>
                  {cand.resumeUrl && (
                    <a className="text-xs font-semibold text-primary underline" href={cand.resumeUrl} target="_blank">
                      Export resume
                    </a>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <NotesModal
        open={Boolean(openId)}
        initial={notesValue}
        onClose={() => setOpenId(null)}
        onSave={async (val) => {
          if (!openId) return;
          await onUpdateNotes(openId, val);
          setOpenId(null);
        }}
      />
    </div>
  );
}

