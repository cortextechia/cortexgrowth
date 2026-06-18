'use client';

import { useState } from 'react';
import { CreativeSection } from './CreativeSection';

export default function CriativoPage() {
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);

  const showToast = (msg: string, type: 'ok' | 'err') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  return (
    <div className="w-full max-w-5xl space-y-8">
      {/* Toast */}
      {toast && (
        <div
          className="fixed top-4 right-4 z-50 rounded-xl px-4 py-3 text-sm font-medium shadow-lg"
          style={{
            backgroundColor: toast.type === 'ok' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
            border: `1px solid ${toast.type === 'ok' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
            color: toast.type === 'ok' ? '#22c55e' : '#ef4444',
          }}
        >
          {toast.msg}
        </div>
      )}

      {/* Cabeçalho */}
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>Criativos</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
          Gere briefings, copy e ideias de criativo a partir dos dados da conta.
        </p>
      </div>

      <CreativeSection showToast={showToast} />
    </div>
  );
}
