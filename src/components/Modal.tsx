import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  title: string;
  eyebrow: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  size?: 'medium' | 'large';
}

export function Modal({ title, eyebrow, open, onClose, children, size = 'medium' }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="modal-backdrop fixed inset-0 z-50 overflow-y-auto p-4" onMouseDown={event => event.target === event.currentTarget && onClose()}>
      <section className={`mx-auto mt-[min(6vh,48px)] w-full rounded-2xl bg-white p-5 shadow-2xl sm:p-6 ${size === 'large' ? 'max-w-2xl' : 'max-w-lg'}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="mb-5 flex items-start justify-between gap-4">
          <div><p className="text-xs font-semibold uppercase tracking-[.12em] text-leaf">{eyebrow}</p><h2 className="mt-1 font-display text-xl font-semibold">{title}</h2></div>
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100" aria-label="關閉"><X className="h-4 w-4" /></button>
        </div>
        {children}
      </section>
    </div>
  );
}