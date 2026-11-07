'use client';

// Links de cadastro com cortesia de um gestor (só SUPER_ADMIN). Um link por cliente:
// vale para UM cadastro, expira em 7 dias, e quem entra por ele ganha N dias grátis no
// plano escolhido, ligado a este gestor. A comissão do gestor só começa depois da cortesia.

import { useCallback, useEffect, useState } from 'react';
import { apiService } from '@/lib/api';
import type { CourtesyLink } from '@/types';

const fmtData = (d: string) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });

function situacao(l: CourtesyLink): { rotulo: string; style: React.CSSProperties } {
  if (l.usedAt) return { rotulo: `Usado em ${fmtData(l.usedAt)}`, style: { backgroundColor: 'var(--badge-success-bg)', color: 'var(--badge-success-text)' } };
  if (!l.link) return { rotulo: 'Expirado', style: { backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)' } };
  return { rotulo: `Aberto até ${fmtData(l.expiresAt)}`, style: { backgroundColor: 'var(--tint-bg)', color: 'var(--tint-ink)' } };
}

export default function CourtesyLinksPanel({
  managerId,
  showToast,
}: {
  managerId: string;
  showToast: (m: string, t?: 'success' | 'error') => void;
}) {
  const [links, setLinks] = useState<CourtesyLink[] | null>(null);
  const [dias, setDias] = useState('30');
  const [nota, setNota] = useState('');
  const [criando, setCriando] = useState(false);
  const [copiado, setCopiado] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const r = await apiService.listCourtesyLinks(managerId);
      setLinks(r.data);
    } catch {
      setLinks([]);
      showToast('Erro ao carregar os links de cortesia.', 'error');
    }
  }, [managerId, showToast]);

  // Carga inicial com setState no callback (o lint do React recusa setState síncrono no effect).
  useEffect(() => {
    let vivo = true;
    apiService.listCourtesyLinks(managerId)
      .then((r) => { if (vivo) setLinks(r.data); })
      .catch(() => { if (vivo) { setLinks([]); showToast('Erro ao carregar os links de cortesia.', 'error'); } });
    return () => { vivo = false; };
  }, [managerId, showToast]);

  const copiar = async (l: CourtesyLink) => {
    if (!l.link) return;
    await navigator.clipboard.writeText(l.link);
    setCopiado(l.id);
    setTimeout(() => setCopiado(null), 2000);
  };

  const criar = async () => {
    const n = Number(dias);
    if (!Number.isInteger(n) || n < 1 || n > 90) { showToast('Dias grátis: de 1 a 90.', 'error'); return; }
    setCriando(true);
    try {
      const r = await apiService.createCourtesyLink(managerId, { plan: 'STARTER', days: n, ...(nota.trim() ? { note: nota.trim() } : {}) });
      setNota('');
      await carregar();
      await copiar(r.data);
      showToast('Link criado e copiado.');
    } catch {
      showToast('Erro ao criar o link.', 'error');
    } finally {
      setCriando(false);
    }
  };

  const cancelar = async (l: CourtesyLink) => {
    try {
      await apiService.cancelCourtesyLink(managerId, l.id);
      await carregar();
      showToast('Link cancelado.');
    } catch {
      showToast('Erro ao cancelar o link.', 'error');
    }
  };

  const inputStyle: React.CSSProperties = { backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-md)', color: 'var(--text-primary)' };

  return (
    <div className="px-5 py-4 space-y-4" style={{ borderTop: '1px solid var(--border)', backgroundColor: 'var(--bg-elevated)' }}>
      <div>
        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Link de cadastro com cortesia</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
          Um link por cliente, plano Starter. Vale para um cadastro e expira em 7 dias. O cliente entra ligado a este gestor;
          a comissão só começa depois do período grátis.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          Dias grátis
          <input value={dias} onChange={(e) => setDias(e.target.value.replace(/\D/g, ''))} inputMode="numeric"
            className="mt-1 block w-24 rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle} />
        </label>
        <label className="text-xs flex-1 min-w-48" style={{ color: 'var(--text-secondary)' }}>
          Para quem (opcional)
          <input value={nota} onChange={(e) => setNota(e.target.value)} maxLength={100} placeholder="Ex.: nome do cliente"
            className="mt-1 block w-full rounded-lg px-3 py-2 text-sm outline-none" style={inputStyle} />
        </label>
        <button onClick={() => void criar()} disabled={criando} className="ui-btn ui-btn-primary ui-btn-sm">
          {criando ? 'Criando…' : 'Gerar e copiar link'}
        </button>
      </div>

      {links === null ? (
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Carregando…</p>
      ) : links.length === 0 ? (
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Nenhum link gerado para este gestor.</p>
      ) : (
        <ul className="space-y-2">
          {links.map((l) => {
            const s = situacao(l);
            return (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg px-3 py-2.5"
                style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                    {l.organizationName ?? l.note ?? 'Sem identificação'}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {l.days} dias grátis · Starter{l.organizationName && l.note ? ` · ${l.note}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="ui-badge" style={{ ...s.style, fontSize: 11 }}>{s.rotulo}</span>
                  {l.link && (
                    <>
                      <button onClick={() => void copiar(l)} className="ui-btn ui-btn-secondary ui-btn-sm">
                        {copiado === l.id ? 'Copiado' : 'Copiar'}
                      </button>
                      <button onClick={() => void cancelar(l)} className="ui-btn ui-btn-danger ui-btn-sm">Cancelar</button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
