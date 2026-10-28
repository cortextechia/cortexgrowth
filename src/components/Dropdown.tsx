'use client';

import { useEffect, useRef, useState } from 'react';

// ─── Dropdown do design system (substitui <select> nativo) ────────────────────
// variant "pill" = filtros do topo (CRM e Contatos) · "field" = campos de formulário/drawer.
// Visual nas classes ui-filtro / ui-menu do globals.css.

export function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      className={`h-3 w-3 shrink-0 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
      style={{ color: 'var(--text-muted)' }}
      aria-hidden
    >
      <path d="M5.5 7.5 10 12l4.5-4.5" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Fecha ao clicar fora ou apertar Escape. */
export function usePopover(): { open: boolean; setOpen: (v: boolean) => void; ref: React.RefObject<HTMLDivElement | null> } {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);
  return { open, setOpen, ref };
}

function Check() {
  return (
    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded" style={{ backgroundColor: 'var(--accent-fill)' }} aria-hidden>
      <svg viewBox="0 0 10 10" fill="none" stroke="var(--on-accent)" strokeWidth="1.8" className="h-2.5 w-2.5">
        <polyline points="1.5,5 4,7.5 8.5,2" />
      </svg>
    </span>
  );
}

export function Dropdown({ label, value, options, onChange, onOpen, variant = 'field', className = '' }: {
  label?: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  onOpen?: () => void;
  variant?: 'pill' | 'field';
  className?: string;
}) {
  const { open, setOpen, ref } = usePopover();
  const selected = options.find((o) => o.value === value);
  const isPill = variant === 'pill';
  // Filtro "em uso" = qualquer escolha diferente da primeira opção (o "todos").
  const ativo = isPill && value !== (options[0]?.value ?? '');

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => { const next = !open; setOpen(next); if (next) onOpen?.(); }}
        aria-haspopup="listbox"
        aria-expanded={open}
        data-ativo={ativo}
        className={isPill
          ? 'ui-filtro'
          : 'text-sm rounded-lg pl-3 pr-2.5 py-2 inline-flex items-center justify-between gap-1.5 w-full text-left'}
        style={isPill ? undefined : {
          backgroundColor: 'var(--bg-base)',
          border: `1px solid ${open ? 'var(--accent)' : 'var(--input-border)'}`,
          color: 'var(--text-primary)',
        }}
      >
        <span className="truncate">
          {label && <span style={{ color: ativo ? 'var(--text-secondary)' : 'var(--text-muted)' }}>{label}: </span>}
          <span style={ativo ? { fontWeight: 600 } : undefined}>{selected?.label ?? '—'}</span>
        </span>
        <Chevron open={open} />
      </button>
      {open && (
        <div role="listbox" className="ui-menu absolute z-30 mt-1.5 min-w-full w-max max-w-[300px] max-h-72 overflow-y-auto">
          {options.map((o) => {
            const sel = o.value === value;
            return (
              <button
                key={o.value || '_empty'}
                type="button"
                role="option"
                aria-selected={sel}
                onClick={() => { setOpen(false); if (o.value !== value) onChange(o.value); }}
                className="ui-menu-item"
              >
                <span className="truncate">{o.label}</span>
                {sel && <Check />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
