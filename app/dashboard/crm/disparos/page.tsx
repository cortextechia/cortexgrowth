'use client';

// CRM · Disparos — envio em massa (promoção) segmentado por tag e/ou tipo de
// cliente. As mensagens saem do WhatsApp do vendedor RESPONSÁVEL de cada cliente
// (instância crm-{userId}); quem não tiver WhatsApp conectado é pulado. Agenda
// para uma data/hora ou dispara na hora. Só ADMIN/gestor.

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { apiService } from '@/lib/api';
import type { CrmStatus, CrmTagOption, CrmClientTypeOption, CrmBroadcast, CrmBroadcastPreview } from '@/types';

const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN', 'TRAFFIC_MANAGER'];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB (base64 ~+33% cabe no limite de 12mb do body)

const card = { backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' };
const input = { backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-md)', color: 'var(--text-primary)' } as const;

function fmtDateTime(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function statusBadge(s: CrmBroadcast['status']): { label: string; color: string; bg: string; pulse?: boolean } {
  switch (s) {
    case 'SCHEDULED': return { label: 'Agendado', color: 'var(--badge-warn-text)', bg: 'var(--badge-warn-bg)' };
    case 'QUEUED':    return { label: 'Na fila', color: 'var(--accent)', bg: 'var(--accent-dim)' };
    case 'SENDING':   return { label: 'Enviando', color: 'var(--accent)', bg: 'var(--accent-dim)', pulse: true };
    case 'DONE':      return { label: 'Concluído', color: 'var(--badge-success-text)', bg: 'var(--badge-success-bg)' };
    case 'CANCELED':  return { label: 'Cancelado', color: 'var(--text-muted)', bg: 'var(--bg-elevated)' };
  }
}

// Lê o arquivo como base64 (sem o prefixo data:...;base64,) para enviar à Evolution
function readImage(file: File): Promise<{ base64: string; type: string; fileName: string }> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error('Falha ao ler a imagem.'));
    r.onload = () => {
      const s = String(r.result);
      const base64 = s.includes(',') ? s.slice(s.indexOf(',') + 1) : s;
      resolve({ base64, type: file.type || 'image/jpeg', fileName: file.name });
    };
    r.readAsDataURL(file);
  });
}

// Data/hora local -> valor mínimo do input datetime-local (agora, sem segundos)
function nowLocalInput(): string {
  const d = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
}

export default function CrmDisparosPage() {
  const { user } = useAuth();
  const isAdmin = !!user && ADMIN_ROLES.includes(user.role);

  const [status, setStatus] = useState<CrmStatus | null>(null);
  const [tags, setTags] = useState<CrmTagOption[]>([]);
  const [types, setTypes] = useState<CrmClientTypeOption[]>([]);
  const [list, setList] = useState<CrmBroadcast[]>([]);
  const [loading, setLoading] = useState(true);

  // Composer
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [selTags, setSelTags] = useState<string[]>([]);
  const [selTypes, setSelTypes] = useState<string[]>([]);
  const [combine, setCombine] = useState<'AND' | 'OR'>('OR');
  const [image, setImage] = useState<{ base64: string; type: string; fileName: string } | null>(null);
  const [imageErr, setImageErr] = useState('');
  const [mode, setMode] = useState<'now' | 'schedule'>('now');
  const [when, setWhen] = useState('');
  const [preview, setPreview] = useState<CrmBroadcastPreview | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  const loadList = useCallback(async () => {
    try {
      const res = await apiService.listCrmBroadcasts();
      setList(res.data);
    } catch { /* silencioso no polling */ }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [st, tg, ty] = await Promise.all([
          apiService.getCrmStatus(),
          apiService.getCrmTags().catch(() => ({ data: [] as CrmTagOption[] })),
          apiService.getCrmClientTypes().catch(() => ({ data: [] as CrmClientTypeOption[] })),
        ]);
        setStatus(st.data);
        setTags(tg.data);
        setTypes(ty.data);
        if (st.data.enabled) await loadList();
      } finally {
        setLoading(false);
      }
    })();
  }, [loadList]);

  // Poll da lista a cada 6s (status/contadores atualizam enquanto envia)
  useEffect(() => {
    if (!status?.enabled) return;
    const t = setInterval(loadList, 6000);
    return () => clearInterval(t);
  }, [status?.enabled, loadList]);

  // Prévia da audiência (debounce) sempre que os filtros mudam
  const combineActive = selTags.length > 0 && selTypes.length > 0;
  useEffect(() => {
    if (selTags.length === 0 && selTypes.length === 0) { setPreview(null); return; }
    setPreviewing(true);
    const t = setTimeout(async () => {
      try {
        const res = await apiService.previewCrmBroadcast({ tags: selTags, types: selTypes, combine });
        setPreview(res.data);
      } catch {
        setPreview(null);
      } finally {
        setPreviewing(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [selTags, selTypes, combine]);

  const toggle = (arr: string[], set: (v: string[]) => void, v: string) =>
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const onPickImage = async (file: File | null) => {
    setImageErr('');
    if (!file) { setImage(null); return; }
    if (!file.type.startsWith('image/')) { setImageErr('Só imagem é aceita.'); return; }
    if (file.size > MAX_IMAGE_BYTES) { setImageErr('Imagem muito grande (máx 5MB).'); return; }
    try {
      setImage(await readImage(file));
    } catch {
      setImageErr('Falha ao ler a imagem.');
    }
  };

  const canSubmit =
    isAdmin && message.trim().length > 0 && !!preview && preview.total > 0 &&
    (mode === 'now' || (mode === 'schedule' && !!when)) && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const res = await apiService.createCrmBroadcast({
        ...(title.trim() ? { title: title.trim() } : {}),
        message: message.trim(),
        tags: selTags,
        types: selTypes,
        combine,
        scheduledAt: mode === 'schedule' ? new Date(when).toISOString() : null,
        media: image,
      });
      showToast('success', res.message);
      // limpa o compositor
      setTitle(''); setMessage(''); setSelTags([]); setSelTypes([]); setImage(null);
      setMode('now'); setWhen(''); setPreview(null);
      await loadList();
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Erro ao criar o disparo.';
      showToast('error', msg);
    } finally {
      setSubmitting(false);
    }
  };

  const cancel = async (id: string) => {
    try {
      await apiService.cancelCrmBroadcast(id);
      await loadList();
    } catch (err) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Erro ao cancelar.';
      showToast('error', msg);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-24"><span className="text-sm" style={{ color: 'var(--text-muted)' }}>Carregando...</span></div>;
  }
  if (status && !status.enabled) {
    return (
      <div className="max-w-lg mx-auto mt-16 rounded-xl p-8 text-center" style={card}>
        <h1 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Disparos do CRM</h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {status.kommoConnected ? 'Esta organização usa o Kommo como CRM.' : 'Ative o CRM Cortex na página do funil para usar os disparos.'}
        </p>
      </div>
    );
  }
  if (!isAdmin) {
    return (
      <div className="max-w-lg mx-auto mt-16 rounded-xl p-8 text-center" style={card}>
        <h1 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Disparos</h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Apenas administradores podem criar disparos em massa.</p>
      </div>
    );
  }

  const inputCls = 'w-full rounded-lg px-3 py-2 text-sm';

  return (
    <div>
      <div className="mb-5">
        <div className="flex items-center gap-3">
          <a href="/dashboard/crm" className="px-3 py-2 rounded-lg text-sm font-medium shrink-0" style={{ ...card, color: 'var(--text-secondary)' }}>← Funil</a>
          <div>
            <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>Disparos</h1>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Promoção para a carteira, segmentada por tag/tipo. Sai do WhatsApp do vendedor de cada cliente.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Compositor */}
        <div className="rounded-xl p-5 space-y-4" style={card}>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Novo disparo</h2>

          <div>
            <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Nome (só pra você identificar)</label>
            <input className={inputCls} style={input} value={title} maxLength={120} placeholder="Ex: Promoção de portões — julho" onChange={(e) => setTitle(e.target.value)} />
          </div>

          <div>
            <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Mensagem</label>
            <textarea
              className={`${inputCls} min-h-[110px] resize-y`}
              style={input}
              value={message}
              maxLength={4000}
              placeholder="Escreva a mensagem. Use {nome} para o primeiro nome do cliente."
              onChange={(e) => setMessage(e.target.value)}
            />
            <div className="flex items-center justify-between mt-1">
              <button type="button" onClick={() => setMessage((m) => m + '{nome}')} className="text-xs" style={{ color: 'var(--accent)' }}>+ inserir {'{nome}'}</button>
              <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{message.length}/4000</span>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Imagem (opcional)</label>
            <div className="flex items-center gap-3 mt-1">
              <label className="px-3 py-2 rounded-lg text-sm cursor-pointer" style={{ ...input }}>
                {image ? 'Trocar imagem' : 'Escolher imagem'}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => onPickImage(e.target.files?.[0] ?? null)} />
              </label>
              {image && (
                <div className="flex items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`data:${image.type};base64,${image.base64}`} alt="" className="w-10 h-10 rounded object-cover" />
                  <button onClick={() => setImage(null)} className="text-xs" style={{ color: 'var(--badge-error-text)' }}>remover</button>
                </div>
              )}
            </div>
            {imageErr && <p className="text-xs mt-1" style={{ color: 'var(--badge-error-text)' }}>{imageErr}</p>}
          </div>

          {/* Segmentação */}
          <div>
            <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Enviar para clientes com…</label>
            <div className="mt-1.5">
              <p className="text-[11px] mb-1" style={{ color: 'var(--text-muted)' }}>Tags</p>
              {tags.length === 0 ? (
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Nenhuma tag configurada.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((t) => {
                    const on = selTags.includes(t.label);
                    return (
                      <button key={t.id} onClick={() => toggle(selTags, setSelTags, t.label)}
                        className="text-xs px-2.5 py-1 rounded-full"
                        style={on ? { backgroundColor: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid var(--accent)' } : { ...input }}>
                        {t.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="mt-2.5">
              <p className="text-[11px] mb-1" style={{ color: 'var(--text-muted)' }}>Tipo de cliente</p>
              {types.length === 0 ? (
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Nenhum tipo configurado.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {types.map((t) => {
                    const on = selTypes.includes(t.label);
                    return (
                      <button key={t.id} onClick={() => toggle(selTypes, setSelTypes, t.label)}
                        className="text-xs px-2.5 py-1 rounded-full"
                        style={on ? { backgroundColor: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid var(--accent)' } : { ...input }}>
                        {t.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            {combineActive && (
              <div className="flex items-center gap-2 mt-3">
                <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Combinar tag e tipo:</span>
                <div className="inline-flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-md)' }}>
                  {(['AND', 'OR'] as const).map((c) => (
                    <button key={c} onClick={() => setCombine(c)} className="text-xs px-3 py-1.5"
                      style={combine === c ? { backgroundColor: 'var(--accent)', color: '#fff' } : { color: 'var(--text-muted)' }}>
                      {c === 'AND' ? 'E (os dois)' : 'OU (qualquer)'}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Prévia da audiência */}
          <div className="rounded-lg p-3 text-sm" style={{ backgroundColor: 'var(--bg-elevated)' }}>
            {selTags.length === 0 && selTypes.length === 0 ? (
              <span style={{ color: 'var(--text-muted)' }}>Escolha ao menos uma tag ou tipo para ver o alcance.</span>
            ) : previewing ? (
              <span style={{ color: 'var(--text-muted)' }}>Calculando alcance…</span>
            ) : preview ? (
              <span style={{ color: 'var(--text-secondary)' }}>
                <strong style={{ color: 'var(--text-primary)' }}>{preview.total}</strong> cliente(s) ·{' '}
                <strong style={{ color: 'var(--badge-success-text)' }}>{preview.sendable}</strong> vão receber
                {preview.skipped > 0 && <> · <strong style={{ color: 'var(--badge-warn-text)' }}>{preview.skipped}</strong> pulado(s) (vendedor sem WhatsApp)</>}
              </span>
            ) : null}
          </div>

          {/* Agendamento */}
          <div>
            <label className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Quando</label>
            <div className="flex items-center gap-4 mt-1.5">
              <label className="flex items-center gap-1.5 text-sm cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
                <input type="radio" checked={mode === 'now'} onChange={() => setMode('now')} /> Enviar agora
              </label>
              <label className="flex items-center gap-1.5 text-sm cursor-pointer" style={{ color: 'var(--text-secondary)' }}>
                <input type="radio" checked={mode === 'schedule'} onChange={() => setMode('schedule')} /> Agendar
              </label>
            </div>
            {mode === 'schedule' && (
              <input type="datetime-local" className={`${inputCls} mt-2`} style={input} value={when} min={nowLocalInput()} onChange={(e) => setWhen(e.target.value)} />
            )}
          </div>

          <button
            onClick={submit}
            disabled={!canSubmit}
            className="w-full py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-50"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            {submitting ? 'Enviando…' : mode === 'schedule' ? 'Agendar disparo' : `Disparar agora${preview ? ` (${preview.sendable})` : ''}`}
          </button>
        </div>

        {/* Histórico */}
        <div className="rounded-xl p-5" style={card}>
          <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Disparos</h2>
          {list.length === 0 ? (
            <p className="text-sm py-6 text-center" style={{ color: 'var(--text-muted)' }}>Nenhum disparo ainda.</p>
          ) : (
            <div className="space-y-2.5">
              {list.map((b) => {
                const badge = statusBadge(b.status);
                const canCancel = ['SCHEDULED', 'QUEUED', 'SENDING'].includes(b.status);
                return (
                  <div key={b.id} className="rounded-lg p-3" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{b.title || b.message}</p>
                        <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                          {b.mediaType ? '🖼️ ' : ''}{b.message}
                        </p>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${badge.pulse ? 'animate-pulse' : ''}`} style={{ backgroundColor: badge.bg, color: badge.color }}>
                        {badge.label}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      <span>Total {b.totalRecipients}</span>
                      <span style={{ color: 'var(--badge-success-text)' }}>✓ {b.sentCount}</span>
                      {b.failedCount > 0 && <span style={{ color: 'var(--badge-error-text)' }}>✗ {b.failedCount}</span>}
                      {b.skippedCount > 0 && <span style={{ color: 'var(--badge-warn-text)' }}>pulados {b.skippedCount}</span>}
                      {b.scheduledAt && b.status === 'SCHEDULED' && <span>📅 {fmtDateTime(b.scheduledAt)}</span>}
                      {b.finishedAt && <span>fim {fmtDateTime(b.finishedAt)}</span>}
                      {[...b.filterTags, ...b.filterTypes].length > 0 && (
                        <span className="truncate">🎯 {[...b.filterTags, ...b.filterTypes].join(', ')}</span>
                      )}
                      {canCancel && (
                        <button onClick={() => cancel(b.id)} className="ml-auto" style={{ color: 'var(--badge-error-text)' }}>Cancelar</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-5 right-5 z-50 rounded-lg px-4 py-3 text-sm shadow-lg"
          style={{ backgroundColor: 'var(--bg-surface)', border: `1px solid ${toast.type === 'success' ? 'var(--badge-success-text)' : 'var(--badge-error-text)'}`, color: 'var(--text-primary)' }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
