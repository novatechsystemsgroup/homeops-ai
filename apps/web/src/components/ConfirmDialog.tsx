"use client";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  changes: string[];
  onCancel: () => void;
  onConfirm: () => void;
  busy?: boolean;
}

export function ConfirmDialog({ open, title, changes, onCancel, onConfirm, busy }: ConfirmDialogProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-4" role="dialog" aria-modal="true">
      <div className="card w-full max-w-md p-6">
        <h3 className="text-base font-semibold">Confirm this change</h3>
        <p className="mt-2 text-sm text-slate-300">{title}</p>
        <ul className="mt-3 space-y-1 text-sm text-slate-400">
          {changes.map((change) => (
            <li key={change}>• {change}</li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-slate-500">Nothing external happens: no booking, no payment, no message is sent.</p>
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" className="rounded-lg border border-slate-600 px-4 py-2 text-sm hover:border-slate-400" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-slate-950 hover:bg-sky-400" onClick={onConfirm} disabled={busy}>
            {busy ? "Applying…" : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}
