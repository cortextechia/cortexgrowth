'use client';

import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { UserRole } from '@/types';

// Cadeado do plano CRM (2026-10-23): o que não faz parte do plano continua à mostra,
// desativado. Quem barra de verdade é a API (403 PLAN_FEATURE_LOCKED).

export function IconeCadeado({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={`${className} shrink-0`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
    </svg>
  );
}

export function RecursoBloqueado({ titulo, texto, compacto = false }: { titulo: string; texto: string; compacto?: boolean }) {
  const { user } = useAuth();
  // Só quem paga vê o botão; a tela de Assinatura é dessas três funções.
  const podeAssinar = !!user && [UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.TRAFFIC_MANAGER].includes(user.role);

  return (
    <div
      className={`rounded-xl flex flex-col sm:flex-row sm:items-center gap-4 ${compacto ? 'px-4 py-3' : 'px-5 py-5'}`}
      style={{ backgroundColor: 'var(--bg-surface)', border: '1px dashed var(--border-md)' }}
    >
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <span className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
          <IconeCadeado className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{titulo}</p>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>{texto}</p>
        </div>
      </div>
      {podeAssinar ? (
        <Link href="/dashboard/assinatura"
          className="shrink-0 rounded-lg px-4 py-2 text-sm font-semibold text-center"
          style={{ backgroundColor: 'var(--accent-fill)', color: 'var(--on-accent)' }}>
          Ver planos
        </Link>
      ) : (
        <span className="shrink-0 text-xs" style={{ color: 'var(--text-secondary)' }}>
          Fale com o administrador da conta.
        </span>
      )}
    </div>
  );
}
