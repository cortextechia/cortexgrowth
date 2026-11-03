'use client';

// CRM · Disparos — envio em massa (promoção) segmentado por etapa do funil, tag
// e/ou tipo de cliente. As mensagens saem do WhatsApp do vendedor RESPONSÁVEL de
// cada cliente (instância crm-{userId}); quem não tiver WhatsApp conectado é
// pulado. Agenda para uma data/hora ou dispara na hora, no ritmo padrão ou em
// lotes com pausa (anti-bloqueio). Só ADMIN/gestor.

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { apiService } from '@/lib/api';
import type { CrmStatus, CrmTagOption, CrmClientTypeOption, CrmStage, CrmBroadcast, CrmBroadcastPreview } from '@/types';

const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN', 'TRAFFIC_MANAGER'];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5MB (base64 ~+33% cabe no limite de 12mb do body)

// Espelham os limites do backend (crmBroadcastService.ts)
const BATCH_SIZE_MAX = 500;
const BATCH_PAUSE_MAX = 240;
// O dispatcher manda no máximo ~10 por minuto (lote de 10 por tick, 4–9s entre envios).
const SENDS_PER_MIN = 10;

const input = {
  backgroundColor: 'var(--bg-elevated)',
  border: '1px solid var(--border-md)',
  color: 'var(--text-primary)',
} as const;
const fieldCls = 'mt-1 w-full rounded-lg px-3 py-2 text-sm';
const labelCls = 'block text-xs font-medium';

const STAGE_COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#ef4444', '#64748b'];
const stageColor = (s: { color: string | null; order: number }) => s.color ?? STAGE_COLORS[s.order % STAGE_COLORS.length]!;

function fmtDateTime(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function fmtDuration(min: number): string {
  if (min < 1) return 'menos de 1 min';
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`;
}

const statusBadge: Record<CrmBroadcast['status'], { label: string; style: React.CSSProperties; cls?: string }> = {
  SCHEDULED: { label: 'Agendado', style: { background: 'var(--badge-warn-bg)', color: 'var(--badge-warn-text)' } },
  QUEUED: { label: 'Na fila', style: {}, cls: 'ui-badge-tint' },
  SENDING: { label: 'Enviando', style: {}, cls: 'ui-badge-lime' },
  DONE: { label: 'Concluído', style: { background: 'var(--badge-success-bg)', color: 'var(--badge-success-text)' } },
  CANCELED: { label: 'Cancelado', style: { background: 'var(--bg-elevated)', color: 'var(--text-secondary)' } },
};

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

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 pt-5 first:pt-0" style={{ borderTop: n > 1 ? '1px solid var(--border)' : undefined }}>
      <h2 className="ui-h2 flex items-center gap-2">
        <span className="ui-badge ui-badge-tint tabular-nums">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function ChipGroup({ label, empty, options, selected, onToggle }: {
  label: string;
  empty: string;
  options: { key: string; label: string; color?: string }[];
  selected: string[];
  onToggle: (key: string) => void;
}) {
  return (
    <div>
      <p className={labelCls} style={{ color: 'var(--text-secondary)' }}>{label}</p>
      {options.length === 0 ? (
        <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{empty}</p>
      ) : (
        <div className="flex flex-wrap gap-1.5 mt-1.5">
          {options.map((o) => {
            const on = selected.includes(o.key);
            return (
              <button key={o.key} type="button" className="ui-filtro" data-ativo={on} aria-pressed={on} onClick={() => onToggle(o.key)}>
                {o.color && <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: o.color }} />}
                {o.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function CrmDisparosPage() {
  const { user } = useAuth();
  const isAdmin = !!user && ADMIN_ROLES.includes(user.role);

  const [status, setStatus] = useState<CrmStatus | null>(null);
  const [tags, setTags] = useState<CrmTagOption[]>([]);
  const [types, setTypes] = useState<CrmClientTypeOption[]>([]);
  const [stages, setStages] = useState<CrmStage[]>([]);
  const [list, setList] = useState<CrmBroadcast[]>([]);
  const [loading, setLoading] = useState(true);

  // Compositor
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [selStages, setSelStages] = useState<string[]>([]);
  const [selTags, setSelTags] = useState<string[]>([]);
  const [selTypes, setSelTypes] = useState<string[]>([]);
  const [combine, setCombine] = useState<'AND' | 'OR'>('OR');
  const [image, setImage] = useState<{ base64: string; type: string; fileName: string } | null>(null);
  const [imageErr, setImageErr] = useState('');
  const [mode, setMode] = useState<'now' | 'schedule'>('now');
  const [when, setWhen] = useState('');
  const [useBatches, setUseBatches] = useState(false);
  const [batchSize, setBatchSize] = useState('50');
  const [batchPause, setBatchPause] = useState('2');
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
        const [st, tg, ty, sg] = await Promise.all([
          apiService.getCrmStatus(),
          apiService.getCrmTags().catch(() => ({ data: [] as CrmTagOption[] })),
          apiService.getCrmClientTypes().catch(() => ({ data: [] as CrmClientTypeOption[] })),
          apiService.getCrmStages().catch(() => ({ data: [] as CrmStage[] })),
        ]);
        setStatus(st.data);
        setTags(tg.data);
        setTypes(ty.data);
        setStages([...sg.data].sort((a, b) => a.order - b.order));
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

  const groupsActive = [selStages, selTags, selTypes].filter((g) => g.length > 0).length;
  const hasFilter = groupsActive > 0;

  // Prévia da audiência (debounce) sempre que os filtros mudam
  useEffect(() => {
    if (!hasFilter) { setPreview(null); return; }
    setPreviewing(true);
    const t = setTimeout(async () => {
      try {
        const res = await apiService.previewCrmBroadcast({ tags: selTags, types: selTypes, stages: selStages, combine });
        setPreview(res.data);
      } catch {
        setPreview(null);
      } finally {
        setPreviewing(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [hasFilter, selTags, selTypes, selStages, combine]);

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

  const sizeN = Number(batchSize);
  const pauseN = Number(batchPause);
  const rhythmErr = !useBatches ? ''
    : !Number.isInteger(sizeN) || sizeN < 1 || sizeN > BATCH_SIZE_MAX ? `O lote precisa ter entre 1 e ${BATCH_SIZE_MAX} contatos.`
    : !Number.isInteger(pauseN) || pauseN < 1 || pauseN > BATCH_PAUSE_MAX ? `A pausa precisa ficar entre 1 e ${BATCH_PAUSE_MAX} minutos.`
    : '';

  // Estimativa de duração: o ritmo do dispatcher (~10/min) vale dentro do lote.
  const estimate = useMemo(() => {
    const n = preview?.sendable ?? 0;
    if (n === 0) return null;
    if (!useBatches || rhythmErr) return { batches: 1, minutes: n / SENDS_PER_MIN };
    const batches = Math.ceil(n / sizeN);
    return { batches, minutes: n / SENDS_PER_MIN + (batches - 1) * pauseN };
  }, [preview?.sendable, useBatches, rhythmErr, sizeN, pauseN]);

  const canSubmit =
    isAdmin && message.trim().length > 0 && !!preview && preview.total > 0 && !rhythmErr &&
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
        stages: selStages,
        combine,
        scheduledAt: mode === 'schedule' ? new Date(when).toISOString() : null,
        media: image,
        rhythm: useBatches ? { size: sizeN, pauseMin: pauseN } : null,
      });
      showToast('success', res.message);
      setTitle(''); setMessage(''); setSelStages([]); setSelTags([]); setSelTypes([]); setImage(null);
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

  const stageName = useMemo(() => new Map(stages.map((s) => [s.id, s.name])), [stages]);

  if (loading) {
    return <p className="py-24 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>Carregando…</p>;
  }
  if ((status && !status.enabled) || !isAdmin) {
    return (
      <div className="ui-card max-w-lg mx-auto mt-16 text-center space-y-2">
        <h1 className="ui-h2">Disparos</h1>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          {status && !status.enabled
            ? status.kommoConnected ? 'Esta organização usa o Kommo como CRM.' : 'Ative o CRM Cortex na página do funil para usar os disparos.'
            : 'Apenas administradores podem criar disparos em massa.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="ui-h1">Disparos</h1>
          <p className="ui-sub">Promoção para a carteira, segmentada por etapa, tag ou tipo. Sai do WhatsApp do vendedor de cada cliente.</p>
        </div>
        <a href="/dashboard/crm" className="ui-btn ui-btn-secondary ui-btn-sm">← Funil</a>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] gap-5 items-start">
        {/* Compositor */}
        <div className="ui-card space-y-5">
          <Section n={1} title="Mensagem">
            <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>
              Nome do disparo <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>(só para você identificar)</span>
              <input className={fieldCls} style={input} value={title} maxLength={120} placeholder="Ex: Promoção de portões — novembro" onChange={(e) => setTitle(e.target.value)} />
            </label>

            <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>
              Texto
              <textarea
                className={`${fieldCls} min-h-[120px] resize-y`}
                style={input}
                value={message}
                maxLength={4000}
                placeholder="Escreva a mensagem. Use {nome} para o primeiro nome do cliente."
                onChange={(e) => setMessage(e.target.value)}
              />
            </label>
            <div className="flex items-center justify-between gap-2">
              <button type="button" onClick={() => setMessage((m) => m + '{nome}')} className="ui-btn ui-btn-tint ui-btn-sm">+ {'{nome}'}</button>
              <span className="text-xs tabular-nums" style={{ color: 'var(--text-secondary)' }}>{message.length}/4000</span>
            </div>

            <div>
              <p className={labelCls} style={{ color: 'var(--text-secondary)' }}>Imagem <span style={{ fontWeight: 400 }}>(opcional, até 5MB)</span></p>
              <div className="flex items-center gap-3 mt-1.5">
                <label className="ui-btn ui-btn-secondary ui-btn-sm">
                  {image ? 'Trocar imagem' : 'Escolher imagem'}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => onPickImage(e.target.files?.[0] ?? null)} />
                </label>
                {image && (
                  <div className="flex items-center gap-2 min-w-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`data:${image.type};base64,${image.base64}`} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                    <span className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{image.fileName}</span>
                    <button type="button" onClick={() => setImage(null)} className="ui-btn ui-btn-danger ui-btn-sm">Remover</button>
                  </div>
                )}
              </div>
              {imageErr && <p className="text-xs mt-1" style={{ color: 'var(--badge-error-text)' }}>{imageErr}</p>}
            </div>
          </Section>

          <Section n={2} title="Quem recebe">
            <ChipGroup
              label="Etapa do funil"
              empty="Nenhuma etapa configurada."
              options={stages.map((s) => ({ key: s.id, label: s.name, color: stageColor(s) }))}
              selected={selStages}
              onToggle={(k) => toggle(selStages, setSelStages, k)}
            />
            <ChipGroup
              label="Tags"
              empty="Nenhuma tag configurada."
              options={tags.map((t) => ({ key: t.label, label: t.label }))}
              selected={selTags}
              onToggle={(k) => toggle(selTags, setSelTags, k)}
            />
            <ChipGroup
              label="Tipo de cliente"
              empty="Nenhum tipo configurado."
              options={types.map((t) => ({ key: t.label, label: t.label }))}
              selected={selTypes}
              onToggle={(k) => toggle(selTypes, setSelTypes, k)}
            />

            {groupsActive > 1 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Combinar os filtros:</span>
                <div className="ui-seg">
                  <button type="button" aria-pressed={combine === 'AND'} onClick={() => setCombine('AND')}>Todos (E)</button>
                  <button type="button" aria-pressed={combine === 'OR'} onClick={() => setCombine('OR')}>Qualquer um (OU)</button>
                </div>
              </div>
            )}

            <div className="ui-inset p-4">
              {!hasFilter ? (
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Escolha ao menos uma etapa, tag ou tipo para ver o alcance.</p>
              ) : previewing && !preview ? (
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Calculando alcance…</p>
              ) : preview ? (
                <div className="grid grid-cols-3 gap-3" style={{ opacity: previewing ? 0.6 : 1 }}>
                  <div>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Clientes no filtro</p>
                    <p className="ui-big">{preview.total}</p>
                  </div>
                  <div>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Vão receber</p>
                    <p className="ui-big">{preview.sendable}</p>
                  </div>
                  <div>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Pulados</p>
                    <p className="ui-big" style={preview.skipped > 0 ? { color: 'var(--badge-warn-text)' } : undefined}>{preview.skipped}</p>
                  </div>
                  {preview.skipped > 0 && (
                    <p className="col-span-3 text-xs" style={{ color: 'var(--text-secondary)' }}>Pulados = o vendedor responsável não tem WhatsApp conectado.</p>
                  )}
                </div>
              ) : (
                <p className="text-sm" style={{ color: 'var(--badge-error-text)' }}>Não foi possível calcular o alcance.</p>
              )}
            </div>
          </Section>

          <Section n={3} title="Ritmo de envio">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Enviar em lotes com pausa</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                  Ajuda a evitar bloqueio do WhatsApp em listas grandes. Desligado, segue o ritmo padrão (~{SENDS_PER_MIN} por minuto).
                </p>
              </div>
              <button type="button" className="ui-switch" role="switch" aria-checked={useBatches} aria-label="Enviar em lotes com pausa" onClick={() => setUseBatches((v) => !v)} />
            </div>

            {useBatches && (
              <div className="grid grid-cols-2 gap-3">
                <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>
                  Contatos por lote
                  <input className={`${fieldCls} tabular-nums`} style={input} type="number" inputMode="numeric" min={1} max={BATCH_SIZE_MAX}
                    value={batchSize} onChange={(e) => setBatchSize(e.target.value)} />
                </label>
                <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>
                  Pausa entre lotes (min)
                  <input className={`${fieldCls} tabular-nums`} style={input} type="number" inputMode="numeric" min={1} max={BATCH_PAUSE_MAX}
                    value={batchPause} onChange={(e) => setBatchPause(e.target.value)} />
                </label>
                <p className="col-span-2 text-xs" style={{ color: rhythmErr ? 'var(--badge-error-text)' : 'var(--text-secondary)' }}>
                  {rhythmErr || `Manda ${sizeN} contato${sizeN === 1 ? '' : 's'}, espera ${pauseN} min e continua. Dentro do lote as mensagens saem com 4 a 9 segundos de intervalo.`}
                </p>
              </div>
            )}

            {estimate && (
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Estimativa: <strong style={{ color: 'var(--text-primary)' }}>~{fmtDuration(estimate.minutes)}</strong>
                {estimate.batches > 1 && <> em {estimate.batches} lotes</>} para {preview?.sendable} contato{preview?.sendable === 1 ? '' : 's'}.
              </p>
            )}
          </Section>

          <Section n={4} title="Quando">
            <div className="ui-seg self-start">
              <button type="button" aria-pressed={mode === 'now'} onClick={() => setMode('now')}>Enviar agora</button>
              <button type="button" aria-pressed={mode === 'schedule'} onClick={() => setMode('schedule')}>Agendar</button>
            </div>
            {mode === 'schedule' && (
              <input type="datetime-local" className={`${fieldCls} max-w-xs`} style={input} value={when} min={nowLocalInput()} onChange={(e) => setWhen(e.target.value)} aria-label="Data e hora do disparo" />
            )}
          </Section>

          <button type="button" onClick={submit} disabled={!canSubmit} className="ui-btn ui-btn-primary w-full">
            {submitting ? 'Criando…' : mode === 'schedule' ? 'Agendar disparo' : `Disparar agora${preview ? ` para ${preview.sendable}` : ''}`}
          </button>
        </div>

        {/* Histórico */}
        <div className="ui-card !p-0 overflow-hidden">
          <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
            <h2 className="ui-h2">Histórico</h2>
          </div>
          {list.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>Nenhum disparo ainda.</p>
          ) : (
            <ul>
              {list.map((b, i) => {
                const badge = statusBadge[b.status];
                const canCancel = ['SCHEDULED', 'QUEUED', 'SENDING'].includes(b.status);
                const done = b.sentCount + b.failedCount + b.skippedCount;
                const pct = b.totalRecipients > 0 ? Math.round((done / b.totalRecipients) * 100) : 0;
                const paused = b.status === 'SENDING' && b.nextBatchAt && new Date(b.nextBatchAt).getTime() > Date.now();
                const filtros = [
                  ...b.filterStages.map((id) => stageName.get(id) ?? 'Etapa removida'),
                  ...b.filterTags,
                  ...b.filterTypes,
                ];
                return (
                  <li key={b.id} className="px-5 py-4 space-y-2.5" style={i > 0 ? { borderTop: '1px solid var(--border)' } : undefined}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{b.title || b.message}</p>
                        <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                          {b.mediaType ? 'Com imagem · ' : ''}{b.message}
                        </p>
                      </div>
                      <span className={`ui-badge shrink-0 ${badge.cls ?? ''}`} style={badge.style}>
                        {paused ? 'Em pausa' : badge.label}
                      </span>
                    </div>

                    {(b.status === 'SENDING' || b.status === 'DONE') && b.totalRecipients > 0 && (
                      <div className="ui-bar" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Progresso do envio">
                        <span style={{ width: `${pct}%` }} />
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                      <span><strong style={{ color: 'var(--text-primary)' }}>{b.sentCount}</strong>/{b.totalRecipients} enviados</span>
                      {b.failedCount > 0 && <span style={{ color: 'var(--badge-error-text)' }}>{b.failedCount} com falha</span>}
                      {b.skippedCount > 0 && <span style={{ color: 'var(--badge-warn-text)' }}>{b.skippedCount} pulados</span>}
                      {b.status === 'SCHEDULED' && b.scheduledAt && <span>Agendado para {fmtDateTime(b.scheduledAt)}</span>}
                      {paused && <span>Próximo lote às {fmtTime(b.nextBatchAt!)}</span>}
                      {b.finishedAt && <span>Fim {fmtDateTime(b.finishedAt)}</span>}
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {filtros.slice(0, 6).map((f, j) => <span key={j} className="ui-chip">{f}</span>)}
                      {filtros.length > 6 && <span className="ui-chip">+{filtros.length - 6}</span>}
                      {b.batchSize && b.batchPauseMin && (
                        <span className="ui-chip">lotes de {b.batchSize} · pausa {b.batchPauseMin} min</span>
                      )}
                      {canCancel && (
                        <button type="button" onClick={() => cancel(b.id)} className="ui-btn ui-btn-danger ui-btn-sm ml-auto">Cancelar</button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {toast && (
        <div role="status" className="ui-card fixed bottom-5 right-5 z-50 !py-3 !px-4 text-sm shadow-lg flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: toast.type === 'success' ? 'var(--badge-success-text)' : 'var(--badge-error-text)' }} />
          {toast.msg}
        </div>
      )}
    </div>
  );
}
