import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';

// Small building blocks for the Setup screens: dialog, form fields, status, and the four states
// of a list (loading, error with retry, empty, content).

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}

/** A dialog that holds focus, closes with Escape, and gives focus back to the button that opened it. */
export const Modal: React.FC<ModalProps> = ({ title, onClose, children, wide }) => {
  const titleId = useId();
  const box = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const first = box.current?.querySelector<HTMLElement>('input,select,textarea') ?? box.current?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !box.current) return;
      const items = [...box.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (items.length === 0) return;
      const firstItem = items[0];
      const lastItem = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstItem) {
        e.preventDefault();
        lastItem.focus();
      } else if (!e.shiftKey && document.activeElement === lastItem) {
        e.preventDefault();
        firstItem.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      opener?.focus?.();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`w-full ${wide ? 'max-w-3xl' : 'max-w-xl'} max-h-[90vh] overflow-y-auto bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl`}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h2 id={titleId} className="text-base font-bold text-slate-100 border-l-4 border-sky-500 pl-3">
            {title}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800">
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
};

interface FieldProps {
  label: string;
  hint?: string;
  children: (id: string) => React.ReactNode;
  className?: string;
}

export const Field: React.FC<FieldProps> = ({ label, hint, children, className }) => {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-[11px] font-bold uppercase tracking-wider text-slate-300 mb-1.5">
        {label}
      </label>
      {children(id)}
      {hint && <p className="text-xs text-slate-400 mt-1">{hint}</p>}
    </div>
  );
};

const control =
  'w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-500/60 disabled:opacity-60';

export const TextInput: React.FC<React.InputHTMLAttributes<HTMLInputElement>> = (props) => <input {...props} className={control} />;

export const SelectInput: React.FC<React.SelectHTMLAttributes<HTMLSelectElement>> = ({ children, ...rest }) => (
  <select {...rest} className={control}>
    {children}
  </select>
);

export const TextArea: React.FC<React.TextareaHTMLAttributes<HTMLTextAreaElement>> = (props) => <textarea rows={3} {...props} className={control} />;

export const Check: React.FC<{ label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }> = ({ label, checked, onChange, disabled }) => (
  <label className="inline-flex items-center gap-2 text-sm text-slate-200 cursor-pointer">
    <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="w-4 h-4 accent-sky-500" />
    {label}
  </label>
);

type ButtonKind = 'primary' | 'secondary' | 'danger';
const kinds: Record<ButtonKind, string> = {
  primary: 'bg-sky-500 hover:bg-sky-400 text-slate-950',
  secondary: 'bg-slate-800 hover:bg-slate-700 text-slate-100',
  danger: 'bg-rose-600 hover:bg-rose-500 text-white',
};

export const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { kind?: ButtonKind }> = ({ kind = 'primary', className = '', ...rest }) => (
  <button type="button" {...rest} className={`px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-60 ${kinds[kind]} ${className}`} />
);

export const LinkButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { danger?: boolean }> = ({ danger, className = '', ...rest }) => (
  <button type="button" {...rest} className={`text-sm font-medium ${danger ? 'text-rose-400 hover:text-rose-300' : 'text-slate-200 hover:text-white'} ${className}`} />
);

export const StatusBadge: React.FC<{ active: boolean }> = ({ active }) => (
  <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border ${active ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' : 'bg-slate-800 text-slate-300 border-slate-700'}`}>
    {active ? 'Active' : 'Inactive'}
  </span>
);

/** Save and Cancel row, with the server's error message shown above it. */
export const FormActions: React.FC<{ saving: boolean; error: string; onCancel: () => void; saveLabel?: string }> = ({ saving, error, onCancel, saveLabel = 'Save' }) => (
  <div className="pt-4 border-t border-slate-800 space-y-3">
    {error && (
      <p role="alert" className="text-sm text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
        {error}
      </p>
    )}
    <div className="grid grid-cols-2 gap-3">
      <Button type="submit" disabled={saving}>
        {saving ? 'Saving…' : saveLabel}
      </Button>
      <Button kind="secondary" onClick={onCancel} disabled={saving}>
        Cancel
      </Button>
    </div>
  </div>
);

/** The four states of a list: loading, error (with retry), empty, and the content. */
export const ListState: React.FC<{
  loading: boolean;
  error: string;
  onRetry: () => void;
  empty: boolean;
  emptyText: string;
  children: React.ReactNode;
}> = ({ loading, error, onRetry, empty, emptyText, children }) => {
  if (loading) {
    return (
      <div role="status" className="py-12 text-center text-sm text-slate-400">
        Loading…
      </div>
    );
  }
  if (error) {
    return (
      <div role="alert" className="m-4 bg-rose-500/10 border border-rose-500/20 text-rose-300 rounded-xl p-5 space-y-3">
        <p className="font-semibold">Could not load this list.</p>
        <p className="text-sm">{error}</p>
        <Button kind="secondary" onClick={onRetry}>
          Try again
        </Button>
      </div>
    );
  }
  if (empty) return <p className="py-12 text-center text-sm text-slate-400">{emptyText}</p>;
  return <>{children}</>;
};

/** Asks "are you sure?" before something that cannot be undone. */
export const Confirm: React.FC<{
  title: string;
  message: string;
  confirmLabel: string;
  busy: boolean;
  error: string;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ title, message, confirmLabel, busy, error, onConfirm, onCancel }) => (
  <Modal title={title} onClose={onCancel}>
    <p className="text-sm text-slate-300">{message}</p>
    {error && (
      <p role="alert" className="mt-3 text-sm text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
        {error}
      </p>
    )}
    <div className="grid grid-cols-2 gap-3 mt-5">
      <Button kind="danger" onClick={onConfirm} disabled={busy}>
        {busy ? 'Working…' : confirmLabel}
      </Button>
      <Button kind="secondary" onClick={onCancel} disabled={busy}>
        Cancel
      </Button>
    </div>
  </Modal>
);

/** Header, search box, status filter and "add" button above a table. */
export const Toolbar: React.FC<{
  filter: string;
  onFilter: (v: string) => void;
  placeholder: string;
  status: 'active' | 'inactive' | 'all';
  onStatus: (v: 'active' | 'inactive' | 'all') => void;
  addLabel: string;
  onAdd: () => void;
  extra?: React.ReactNode;
}> = ({ filter, onFilter, placeholder, status, onStatus, addLabel, onAdd, extra }) => (
  <div className="flex flex-wrap items-center gap-3 p-4 border-b border-slate-800">
    <input
      type="search"
      value={filter}
      onChange={(e) => onFilter(e.target.value)}
      placeholder={placeholder}
      aria-label={placeholder}
      className={`${control} flex-1 min-w-[12rem]`}
    />
    {extra}
    <select value={status} onChange={(e) => onStatus(e.target.value as 'active' | 'inactive' | 'all')} aria-label="Status" className={`${control} w-auto`}>
      <option value="active">Active</option>
      <option value="inactive">Inactive</option>
      <option value="all">All</option>
    </select>
    <Button onClick={onAdd}>+ {addLabel}</Button>
  </div>
);

export const Th: React.FC<React.ThHTMLAttributes<HTMLTableCellElement>> = ({ className = '', ...rest }) => (
  <th {...rest} scope="col" className={`px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-300 ${className}`} />
);
export const Td: React.FC<React.TdHTMLAttributes<HTMLTableCellElement>> = ({ className = '', ...rest }) => (
  <td {...rest} className={`px-4 py-3 text-sm text-slate-200 align-top ${className}`} />
);

export const Card: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">{children}</div>
);

export function matchesStatus(isActive: boolean, status: 'active' | 'inactive' | 'all'): boolean {
  return status === 'all' || (status === 'active' ? isActive : !isActive);
}
