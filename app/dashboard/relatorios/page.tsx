'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '@/context/AuthContext';
import { apiService } from '@/lib/api';
import type { ReportSchedule, ReportConfig, ChannelType, ReportFrequency, AlertConfig, AnomalyRuleId } from '@/types';

// ─── WhatsApp status badge ────────────────────────────────────────────────────

function WhatsAppStatusBadge() {
  const [status, setStatus] = useState<'loading' | 'connected' | 'disconnected'>('loading');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    apiService.getWhatsAppStatus()
      .then(({ data }) => {
        setStatus(data.connected ? 'connected' : 'disconnected');
        if (data.phone) setPhone(data.phone);
      })
      .catch(() => setStatus('disconnected'));
  }, []);

  if (status === 'loading') return (
    <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
      <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      Verificando...
    </span>
  );

  if (status === 'connected') return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs"
      style={{ backgroundColor: 'rgba(34,197,94,0.12)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.25)' }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#4ade80' }} />
      Conectado{phone ? ` · ${phone}` : ''}
    </span>
  );

  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs"
      style={{ backgroundColor: 'rgba(248,113,113,0.1)', color: '#f87171', border: '1px solid rgba(248,113,113,0.2)' }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#f87171' }} />
      Desconectado
    </span>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const FREQ_LABELS: Record<ReportFrequency, string> = {
  DAILY: 'Diário', WEEKLY: 'Semanal', BIWEEKLY: 'Quinzenal', MONTHLY: 'Mensal',
};
const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

function describeSchedule(s: ReportSchedule): string {
  const h = `${String(s.hour).padStart(2, '0')}:00`;
  if (s.frequency === 'DAILY') return `Todo dia às ${h}`;
  if (s.frequency === 'WEEKLY') return `Toda ${DAY_NAMES[s.dayOfWeek ?? 1]} às ${h}`;
  if (s.frequency === 'BIWEEKLY') return `Dias ${s.dayOfMonth} e ${Math.min((s.dayOfMonth ?? 1) + 15, 28)} às ${h}`;
  if (s.frequency === 'MONTHLY') return `Dia ${s.dayOfMonth} de cada mês às ${h}`;
  return h;
}

const card = { backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' };

const DEFAULT_REPORT_CONFIG: ReportConfig = {
  includeSpend: true,
  includeLeads: true,
  includeCtr: true,
  includeCpl: true,
  includeRevenue: true,
  includeRoas: true,
  includeConv: true,
  includeImpressions: false,
  notes: '',
};

const CONFIG_FIELD_LABELS: { key: keyof ReportConfig; label: string }[] = [
  { key: 'includeSpend',       label: 'Investimento (R$)' },
  { key: 'includeImpressions', label: 'Impressões' },
  { key: 'includeLeads',       label: 'Leads gerados' },
  { key: 'includeCtr',         label: 'CTR' },
  { key: 'includeCpl',         label: 'CPL' },
  { key: 'includeRevenue',     label: 'Receita e vendas' },
  { key: 'includeRoas',        label: 'ROAS Meta' },
  { key: 'includeConv',        label: 'Taxa de conversão' },
];

// ─── Modal QR Code Telegram ────────────────────────────────────────────────────

function TelegramQRModal({ onConnected, onClose }: {
  onConnected: (chatId: string, chatName: string) => void;
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<'loading' | 'ready' | 'connected' | 'error'>('loading');
  const [deepLink, setDeepLink] = useState('');
  const [token, setToken] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    apiService.createTelegramInvite()
      .then(({ data }) => { setToken(data.token); setDeepLink(data.deepLink); setPhase('ready'); })
      .catch(() => setPhase('error'));
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  useEffect(() => {
    if (phase !== 'ready' || !token) return;
    pollRef.current = setInterval(async () => {
      try {
        const { data } = await apiService.getTelegramInviteStatus(token);
        if (data.expired) { setPhase('error'); clearInterval(pollRef.current!); return; }
        if (data.connected && data.chatId && data.chatName) {
          setPhase('connected');
          clearInterval(pollRef.current!);
          setTimeout(() => onConnected(data.chatId!, data.chatName!), 1200);
        }
      } catch { /* ignora falhas de polling */ }
    }, 3000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [phase, token, onConnected]);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}>
      <div className="w-full max-w-sm rounded-2xl p-6 text-center space-y-4" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-md)' }}>
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Conectar Telegram</p>
          <button onClick={onClose} style={{ color: 'var(--text-muted)' }}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {phase === 'loading' && (
          <div className="py-10 flex flex-col items-center gap-3">
            <svg className="animate-spin h-6 w-6" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="#3b82f6" strokeWidth="4" />
              <path className="opacity-75" fill="#3b82f6" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Gerando link seguro...</p>
          </div>
        )}

        {phase === 'ready' && (
          <>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Escaneie o QR Code com o Telegram para conectar este chat ao agendamento.
            </p>
            <div className="flex justify-center py-2">
              <div className="p-3 rounded-xl" style={{ backgroundColor: '#fff' }}>
                <QRCodeSVG value={deepLink} size={180} />
              </div>
            </div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Ou abra o link diretamente no Telegram:
            </p>
            <a href={deepLink} target="_blank" rel="noreferrer"
              className="block text-xs truncate px-3 py-2 rounded-lg"
              style={{ backgroundColor: 'rgba(59,130,246,0.1)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.2)' }}>
              {deepLink}
            </a>
            <div className="flex items-center gap-2 justify-center pt-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: '#3b82f6' }} />
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Aguardando conexão... (expira em 24h)</p>
            </div>
          </>
        )}

        {phase === 'connected' && (
          <div className="py-8 flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(34,197,94,0.15)' }}>
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="#4ade80" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm font-medium" style={{ color: '#4ade80' }}>Conectado com sucesso!</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Fechando automaticamente...</p>
          </div>
        )}

        {phase === 'error' && (
          <div className="py-8 flex flex-col items-center gap-3">
            <p className="text-sm" style={{ color: '#f87171' }}>Link expirado ou inválido.</p>
            <button onClick={() => setPhase('loading')} className="text-xs px-4 py-2 rounded-lg"
              style={{ backgroundColor: 'rgba(59,130,246,0.15)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.3)' }}>
              Gerar novo link
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Modal de criação ──────────────────────────────────────────────────────────

interface CreateModalProps {
  onClose: () => void;
  onCreated: () => void;
}

function CreateModal({ onClose, onCreated }: CreateModalProps) {
  const [channel, setChannel] = useState<ChannelType>('TELEGRAM');
  const [destination, setDestination] = useState('');
  const [destinationName, setDestinationName] = useState('');
  const [frequency, setFrequency] = useState<ReportFrequency>('WEEKLY');
  const [hour, setHour] = useState(9);
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showQR, setShowQR] = useState(false);
  const [preview, setPreview] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [reportConfig, setReportConfig] = useState<ReportConfig>({ ...DEFAULT_REPORT_CONFIG });
  const [loadingPreview, setLoadingPreview] = useState(false);

  const loadPreview = async () => {
    setLoadingPreview(true);
    try {
      const { data } = await apiService.getReportPreviewWithConfig(frequency, reportConfig);
      setPreview(data.text);
      setShowPreview(true);
    } catch { setPreview('Erro ao gerar prévia.'); setShowPreview(true); }
    finally { setLoadingPreview(false); }
  };

  const handleSubmit = async () => {
    if (!destination.trim()) { setError('Informe o destino'); return; }
    if (!destinationName.trim()) { setError('Informe um nome para o destino'); return; }
    setLoading(true); setError('');
    try {
      await apiService.createReportSchedule({
        channelType: channel, destination: destination.trim(), destinationName: destinationName.trim(),
        frequency, hour,
        ...(frequency === 'WEEKLY' ? { dayOfWeek } : {}),
        ...(frequency === 'BIWEEKLY' || frequency === 'MONTHLY' ? { dayOfMonth } : {}),
        reportConfig,
      });
      onCreated();
      onClose();
    } catch { setError('Erro ao criar agendamento'); } finally { setLoading(false); }
  };

  const inputStyle = { backgroundColor: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)', borderRadius: 8, padding: '8px 12px', width: '100%', fontSize: 13 };
  const labelStyle = { color: 'var(--text-muted)', fontSize: 12, marginBottom: 4, display: 'block' as const };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
      <div className="w-full max-w-lg rounded-2xl flex flex-col" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-md)', maxHeight: '90vh' }}>

        {/* Header fixo */}
        <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Novo agendamento de relatório</p>
          <button onClick={onClose} style={{ color: 'var(--text-muted)' }}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Conteúdo scrollável */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

        {/* Canal */}
        <div>
          <span style={labelStyle}>Canal de envio</span>
          <div className="flex gap-2">
            {(['TELEGRAM', 'WHATSAPP'] as ChannelType[]).map(c => (
              <button
                key={c}
                onClick={() => { setChannel(c); setDestination(''); setDestinationName(''); }}
                className="flex-1 py-2 rounded-lg text-xs font-medium transition-all"
                style={{ backgroundColor: channel === c ? (c === 'TELEGRAM' ? 'rgba(59,130,246,0.2)' : 'rgba(34,197,94,0.15)') : 'rgba(255,255,255,0.04)', color: channel === c ? (c === 'TELEGRAM' ? '#60a5fa' : '#4ade80') : '#64748b', border: `1px solid ${channel === c ? (c === 'TELEGRAM' ? 'rgba(59,130,246,0.4)' : 'rgba(34,197,94,0.3)') : 'rgba(255,255,255,0.06)'}` }}
              >
                {c === 'TELEGRAM' ? '✈️ Telegram' : '📱 WhatsApp'}
              </button>
            ))}
          </div>
        </div>

        {/* Destino Telegram */}
        {channel === 'TELEGRAM' && (
          <div className="space-y-2">
            <span style={labelStyle}>Chat / Grupo do Telegram</span>
            {destination ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
                <span className="text-xs flex-1" style={{ color: '#4ade80' }}>✓ {destinationName} <span style={{ color: 'var(--text-muted)' }}>({destination})</span></span>
                <button onClick={() => { setDestination(''); setDestinationName(''); }} className="text-xs" style={{ color: 'var(--text-muted)' }}>Trocar</button>
              </div>
            ) : (
              <button onClick={() => setShowQR(true)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-xs font-medium transition-colors"
                style={{ backgroundColor: 'rgba(59,130,246,0.1)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.25)', borderStyle: 'dashed' }}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75v-.75zM16.5 6.75h.75v.75h-.75v-.75z" />
                </svg>
                Conectar via QR Code
              </button>
            )}
            {showQR && (
              <TelegramQRModal
                onConnected={(chatId, chatName) => { setDestination(chatId); setDestinationName(chatName); setShowQR(false); }}
                onClose={() => setShowQR(false)}
              />
            )}
          </div>
        )}

        {/* Destino WhatsApp */}
        {channel === 'WHATSAPP' && (
          <div>
            <span style={labelStyle}>Número ou ID do grupo</span>
            <input style={inputStyle} placeholder="Ex: 5511999999999" value={destination} onChange={e => setDestination(e.target.value)} />
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Formato: DDI + DDD + número, sem espaços ou símbolos</p>
          </div>
        )}

        {/* Nome do destino — oculto no Telegram quando conectado via QR (nome vem automático) */}
        {!(channel === 'TELEGRAM' && destination) && (
          <div>
            <span style={labelStyle}>Nome do destino</span>
            <input style={inputStyle} placeholder="Ex: Grupo Relatórios Galpão" value={destinationName} onChange={e => setDestinationName(e.target.value)} />
          </div>
        )}

        {/* Frequência */}
        <div>
          <span style={labelStyle}>Frequência</span>
          <div className="grid grid-cols-2 gap-2">
            {(Object.entries(FREQ_LABELS) as [ReportFrequency, string][]).map(([k, v]) => (
              <button key={k} onClick={() => setFrequency(k)}
                className="py-2 rounded-lg text-xs font-medium transition-all"
                style={{ backgroundColor: frequency === k ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.04)', color: frequency === k ? '#60a5fa' : '#64748b', border: `1px solid ${frequency === k ? 'rgba(59,130,246,0.4)' : 'rgba(255,255,255,0.06)'}` }}
              >
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Opções condicionais */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span style={labelStyle}>Horário</span>
            <select style={{ ...inputStyle, cursor: 'pointer' }} value={hour} onChange={e => setHour(Number(e.target.value))}>
              {HOURS.map(h => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}
            </select>
          </div>
          {frequency === 'WEEKLY' && (
            <div>
              <span style={labelStyle}>Dia da semana</span>
              <select style={{ ...inputStyle, cursor: 'pointer' }} value={dayOfWeek} onChange={e => setDayOfWeek(Number(e.target.value))}>
                {DAY_NAMES.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
            </div>
          )}
          {(frequency === 'MONTHLY' || frequency === 'BIWEEKLY') && (
            <div>
              <span style={labelStyle}>{frequency === 'BIWEEKLY' ? 'Dia inicial' : 'Dia do mês'}</span>
              <select style={{ ...inputStyle, cursor: 'pointer' }} value={dayOfMonth} onChange={e => setDayOfMonth(Number(e.target.value))}>
                {Array.from({ length: 28 }, (_, i) => i + 1).map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          )}
        </div>

        {/* Campos do relatório */}
        <div>
            <span style={labelStyle}>Campos do relatório</span>
            <div className="grid grid-cols-2 gap-1.5 mt-1">
              {CONFIG_FIELD_LABELS.map(({ key, label }) => (
                <label key={key} className="flex items-center gap-2 text-xs cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={!!reportConfig[key]}
                    onChange={e => setReportConfig(prev => ({ ...prev, [key]: e.target.checked }))}
                    style={{ accentColor: '#3b82f6', width: 13, height: 13 }}
                  />
                  <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                </label>
              ))}
            </div>
            <div className="mt-3">
              <span style={labelStyle}>Observações (opcional)</span>
              <textarea
                style={{ ...inputStyle, minHeight: 56, resize: 'vertical' as const }}
                placeholder="Texto extra ao final do relatório..."
                maxLength={300}
                value={reportConfig.notes ?? ''}
                onChange={e => setReportConfig(prev => ({ ...prev, notes: e.target.value }))}
              />
            </div>
        </div>

        {/* Preview editável */}
        <button
          onClick={loadPreview}
          disabled={loadingPreview}
          className="text-xs transition-colors"
          style={{ color: 'var(--text-muted)', opacity: loadingPreview ? 0.6 : 1 }}
        >
          {loadingPreview ? 'Gerando prévia...' : 'Ver prévia do relatório →'}
        </button>
        {showPreview && (
          <>
            <textarea
              className="rounded-lg p-3 text-xs whitespace-pre-wrap"
              style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)', maxHeight: 220, width: '100%', resize: 'vertical' as const, fontFamily: 'monospace', minHeight: 100, lineHeight: 1.5 }}
              value={preview}
              onChange={e => setPreview(e.target.value)}
            />
            <p className="text-xs" style={{ color: 'var(--text-muted)', marginTop: -8 }}>
              Prévia editável — o conteúdo enviado pelo agendador usa os campos selecionados acima, atualizado a cada envio.
            </p>
          </>
        )}

        {error && <p className="text-xs" style={{ color: '#f87171' }}>{error}</p>}

        </div>{/* fim conteúdo scrollável */}

        {/* Footer fixo */}
        <div className="flex gap-2 px-6 py-4 shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
          <button onClick={onClose} className="flex-1 py-2 rounded-lg text-xs font-medium" style={{ backgroundColor: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.06)' }}>
            Cancelar
          </button>
          <button onClick={handleSubmit} disabled={loading} className="flex-1 py-2 rounded-lg text-xs font-medium transition-colors"
            style={{ backgroundColor: '#3b82f6', color: '#fff', opacity: loading ? 0.6 : 1 }}>
            {loading ? 'Criando...' : 'Criar agendamento'}
          </button>
        </div>

      </div>
    </div>
  );
}

// ─── Modal de configuração de campos (para schedules existentes) ───────────────

function ReportConfigModal({ schedule, onClose, onSaved }: {
  schedule: ReportSchedule;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [config, setConfig] = useState<ReportConfig>({ ...DEFAULT_REPORT_CONFIG, ...schedule.reportConfig });
  const [preview, setPreview] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const inputStyle = { backgroundColor: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)', borderRadius: 8, padding: '8px 12px', width: '100%', fontSize: 13 };
  const labelStyle = { color: 'var(--text-muted)', fontSize: 12, marginBottom: 4, display: 'block' as const };

  const loadPreview = async () => {
    setLoadingPreview(true);
    try {
      const { data } = await apiService.getReportPreviewWithConfig(schedule.frequency, config);
      setPreview(data.text);
      setShowPreview(true);
    } catch { setPreview('Erro ao gerar prévia.'); setShowPreview(true); }
    finally { setLoadingPreview(false); }
  };

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      await apiService.updateReportSchedule(schedule.id, { reportConfig: config });
      onSaved();
      onClose();
    } catch { setError('Erro ao salvar'); } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
      <div className="w-full max-w-md rounded-2xl p-6 space-y-5" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-md)' }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Campos do relatório</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{schedule.destinationName}</p>
          </div>
          <button onClick={onClose} style={{ color: 'var(--text-muted)' }}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div>
          <span style={labelStyle}>Campos incluídos</span>
          <div className="grid grid-cols-2 gap-1.5 mt-1">
            {CONFIG_FIELD_LABELS.map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 text-xs cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={!!config[key]}
                  onChange={e => setConfig(prev => ({ ...prev, [key]: e.target.checked }))}
                  style={{ accentColor: '#3b82f6', width: 13, height: 13 }}
                />
                <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <span style={labelStyle}>Observações (opcional)</span>
          <textarea
            style={{ ...inputStyle, minHeight: 56, resize: 'vertical' as const }}
            placeholder="Texto extra ao final do relatório..."
            maxLength={300}
            value={config.notes ?? ''}
            onChange={e => setConfig(prev => ({ ...prev, notes: e.target.value }))}
          />
        </div>

        <button
          onClick={loadPreview}
          disabled={loadingPreview}
          className="text-xs transition-colors"
          style={{ color: 'var(--text-muted)', opacity: loadingPreview ? 0.6 : 1 }}
        >
          {loadingPreview ? 'Gerando...' : 'Ver prévia →'}
        </button>
        {showPreview && (
          <textarea
            style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)', borderRadius: 8, padding: '12px', fontSize: 12, width: '100%', minHeight: 100, maxHeight: 200, resize: 'vertical' as const, fontFamily: 'monospace', lineHeight: 1.5 }}
            value={preview}
            onChange={e => setPreview(e.target.value)}
          />
        )}

        {error && <p className="text-xs" style={{ color: '#f87171' }}>{error}</p>}

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg text-xs font-medium" style={{ backgroundColor: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.06)' }}>
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving} className="flex-1 py-2 rounded-lg text-xs font-medium" style={{ backgroundColor: '#3b82f6', color: '#fff', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Salvando...' : 'Salvar configuração'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Card de schedule ──────────────────────────────────────────────────────────

function ScheduleCard({ schedule, onToggle, onDelete, onSendNow, onRefresh }: {
  schedule: ReportSchedule;
  onToggle: () => void;
  onDelete: () => void;
  onSendNow: () => void;
  onRefresh: () => void;
}) {
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<'ok' | 'err' | null>(null);
  const [showConfig, setShowConfig] = useState(false);

  const handleSend = async () => {
    setSending(true); setSendResult(null);
    try { await onSendNow(); setSendResult('ok'); } catch { setSendResult('err'); }
    finally { setSending(false); setTimeout(() => setSendResult(null), 3000); }
  };

  const lastLog = schedule.logs[0];
  const channelIcon = schedule.channelType === 'TELEGRAM' ? '✈️' : '📱';
  const channelColor = schedule.channelType === 'TELEGRAM' ? '#60a5fa' : '#4ade80';

  return (
    <div className="rounded-xl p-4 space-y-3" style={card}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-base">{channelIcon}</span>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{schedule.destinationName}</p>
            <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{schedule.destination}</p>
          </div>
        </div>

        {/* Toggle ativo */}
        <button onClick={onToggle} className="shrink-0 rounded-full transition-colors"
          style={{ width: 36, height: 20, backgroundColor: schedule.isActive ? '#3b82f6' : '#94a3b8', position: 'relative' }}>
          <span style={{ position: 'absolute', top: 3, left: schedule.isActive ? 18 : 3, width: 14, height: 14, borderRadius: '50%', backgroundColor: '#fff', transition: 'left 0.15s' }} />
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs" style={{ backgroundColor: 'rgba(59,130,246,0.1)', color: channelColor }}>
          {FREQ_LABELS[schedule.frequency]}
        </span>
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs" style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)' }}>
          {describeSchedule(schedule)}
        </span>
        {lastLog && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs" style={{
            backgroundColor: lastLog.status === 'SUCCESS' ? 'rgba(34,197,94,0.1)' : 'rgba(248,113,113,0.1)',
            color: lastLog.status === 'SUCCESS' ? '#4ade80' : '#f87171',
          }}>
            {lastLog.status === 'SUCCESS' ? '✓' : '✗'} Último: {new Date(lastLog.sentAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      <div className="flex gap-2 pt-1" style={{ borderTop: '1px solid var(--border)' }}>
        <button onClick={handleSend} disabled={sending}
          className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors"
          style={{ backgroundColor: sendResult === 'ok' ? 'rgba(34,197,94,0.15)' : sendResult === 'err' ? 'rgba(248,113,113,0.15)' : 'rgba(59,130,246,0.1)', color: sendResult === 'ok' ? '#4ade80' : sendResult === 'err' ? '#f87171' : '#60a5fa', border: '1px solid rgba(59,130,246,0.2)' }}
        >
          {sending ? 'Enviando...' : sendResult === 'ok' ? '✓ Enviado' : sendResult === 'err' ? '✗ Erro' : 'Enviar agora'}
        </button>
        {schedule.channelType === 'TELEGRAM' && (
          <button onClick={() => setShowConfig(true)} className="px-3 py-1.5 rounded-lg text-xs transition-colors"
            style={{ backgroundColor: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.08)' }}>
            Campos
          </button>
        )}
        <button onClick={onDelete} className="px-3 py-1.5 rounded-lg text-xs transition-colors"
          style={{ backgroundColor: 'rgba(248,113,113,0.08)', color: '#f87171', border: '1px solid rgba(248,113,113,0.15)' }}>
          Remover
        </button>
      </div>

      {showConfig && (
        <ReportConfigModal
          schedule={schedule}
          onClose={() => setShowConfig(false)}
          onSaved={() => { setShowConfig(false); onRefresh(); }}
        />
      )}
    </div>
  );
}

// ─── Configuração de Alertas de Anomalia ──────────────────────────────────────

const RULE_META: Record<AnomalyRuleId, { label: string; description: string; fields: { key: string; label: string; unit: string; min: number; max: number; step: number }[] }> = {
  SPEND_NO_LEADS: {
    label: 'Spend sem leads',
    description: 'Gasto do dia sem nenhum lead gerado',
    fields: [{ key: 'minSpend', label: 'Gasto mínimo', unit: 'R$', min: 1, max: 10000, step: 10 }],
  },
  CPL_HIGH: {
    label: 'CPL alto',
    description: 'CPL de hoje muito acima da média dos últimos 7 dias',
    fields: [
      { key: 'pctAboveAvg', label: 'Acima da média em', unit: '%', min: 5, max: 200, step: 5 },
      { key: 'minSpend',    label: 'Gasto mínimo',       unit: 'R$', min: 1, max: 10000, step: 10 },
    ],
  },
  ROAS_LOW: {
    label: 'ROAS < 1x',
    description: 'Receita do mês menor que o gasto total',
    fields: [{ key: 'minMonthSpend', label: 'Gasto mínimo no mês', unit: 'R$', min: 1, max: 50000, step: 50 }],
  },
  CTR_DROP: {
    label: 'CTR colapsado',
    description: 'CTR de alguma campanha caiu muito vs ontem',
    fields: [
      { key: 'dropPct',        label: 'Queda mínima',         unit: '%',  min: 5,  max: 90,    step: 5 },
      { key: 'minImpressions', label: 'Impressões mínimas',   unit: 'imp', min: 10, max: 10000, step: 50 },
    ],
  },
  LEAD_SILENCE: {
    label: 'Silêncio de leads',
    description: 'Nenhum lead novo com campanha ativa',
    fields: [
      { key: 'hoursWindow', label: 'Janela de tempo', unit: 'horas', min: 12, max: 168, step: 12 },
      { key: 'minSpend7d',  label: 'Gasto mínimo 7d', unit: 'R$',   min: 1,  max: 10000, step: 10 },
    ],
  },
  BUDGET_LOW: {
    label: 'Saldo restante baixo',
    description: 'Avisa quando saldo Meta cair abaixo do mínimo ou campanha Google esgotar orçamento diário',
    fields: [
      { key: 'budgetMinBalance',   label: 'Saldo mínimo Meta',          unit: 'R$', min: 50,  max: 50000, step: 50 },
      { key: 'budgetPctThreshold', label: '% orçamento diário Google',  unit: '%',  min: 50,  max: 99,    step: 5  },
    ],
  },
  CRM_UNANSWERED: {
    label: 'CRM: WhatsApp sem resposta',
    description: 'Cliente do CRM Cortex com mensagem de WhatsApp aguardando resposta há muitas horas',
    fields: [{ key: 'hoursUnanswered', label: 'Horas sem resposta', unit: 'horas', min: 1, max: 168, step: 1 }],
  },
  CRM_FOLLOWUP_DIGEST: {
    label: 'CRM: digest de follow-ups',
    description: 'Resumo diário às 08h com os follow-ups vencidos e os agendados para hoje',
    fields: [],
  },
};

const ALL_RULES = Object.keys(RULE_META) as AnomalyRuleId[];

// Defaults espelhando o backend — usados quando a regra ainda não tem config salva no banco
const RULE_DEFAULTS: Record<AnomalyRuleId, Record<string, number>> = {
  SPEND_NO_LEADS: { minSpend: 50 },
  CPL_HIGH:       { pctAboveAvg: 30, minSpend: 50 },
  ROAS_LOW:       { minMonthSpend: 100 },
  CTR_DROP:       { dropPct: 40, minImpressions: 100 },
  LEAD_SILENCE:   { hoursWindow: 48, minSpend7d: 50 },
  BUDGET_LOW:     { budgetMinBalance: 200, budgetPctThreshold: 80 },
  CRM_UNANSWERED: { hoursUnanswered: 12 },
  CRM_FOLLOWUP_DIGEST: {},
};

function AlertConfigSection() {
  const [config, setConfig]     = useState<AlertConfig | null>(null);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const [error, setError]       = useState('');

  // local editable state
  const [enabled, setEnabled]         = useState<Set<AnomalyRuleId>>(new Set(ALL_RULES));
  const [thresholds, setThresholds]   = useState<AlertConfig['thresholds'] | null>(null);

  useEffect(() => {
    apiService.getAlertConfig()
      .then(({ data }) => {
        setConfig(data);
        setEnabled(new Set(data.enabledRules as AnomalyRuleId[]));
        setThresholds(data.thresholds);
      })
      .catch(() => setError('Erro ao carregar configuração de alertas'))
      .finally(() => setLoading(false));
  }, []);

  const toggleRule = (rule: AnomalyRuleId) => {
    setEnabled(prev => {
      const next = new Set(prev);
      next.has(rule) ? next.delete(rule) : next.add(rule);
      return next;
    });
  };

  const setThresholdField = (rule: AnomalyRuleId, key: string, value: number) => {
    setThresholds(prev => {
      if (!prev) return prev;
      return { ...prev, [rule]: { ...(prev[rule] as Record<string, number>), [key]: value } };
    });
  };

  const handleSave = async () => {
    if (!thresholds) return;
    setSaving(true); setError('');
    try {
      const { data } = await apiService.updateAlertConfig({
        enabledRules: [...enabled],
        thresholds,
      });
      setConfig(data);
      setEnabled(new Set(data.enabledRules as AnomalyRuleId[]));
      setThresholds(data.thresholds);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError('Erro ao salvar configuração');
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    backgroundColor: 'var(--input-bg)',
    border: '1px solid var(--input-border)',
    color: 'var(--text-primary)',
    borderRadius: 6,
    padding: '3px 8px',
    fontSize: 12,
    width: 80,
  };

  if (loading) return (
    <div className="rounded-xl p-4 flex items-center gap-2" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
      <svg className="animate-spin h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="#3b82f6" strokeWidth="4" />
        <path className="opacity-75" fill="#3b82f6" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Carregando alertas...</span>
    </div>
  );

  return (
    <div className="rounded-xl p-4 space-y-4" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Alertas de Anomalia</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Verificado a cada 4h — enviado nos chats Telegram ativos acima
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !thresholds}
          className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
          style={{
            backgroundColor: saved ? 'rgba(34,197,94,0.15)' : '#3b82f6',
            color: saved ? '#4ade80' : '#fff',
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? 'Salvando...' : saved ? '✓ Salvo' : 'Salvar'}
        </button>
      </div>

      {error && <p className="text-xs" style={{ color: '#f87171' }}>{error}</p>}

      {/* Regras */}
      <div className="space-y-2">
        {ALL_RULES.map(rule => {
          const meta = RULE_META[rule];
          const isOn = enabled.has(rule);
          return (
            <div
              key={rule}
              className="rounded-lg p-3 transition-all"
              style={{
                backgroundColor: isOn ? 'rgba(59,130,246,0.05)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${isOn ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.06)'}`,
              }}
            >
              <div className="flex items-start gap-3">
                {/* Toggle */}
                <button
                  onClick={() => toggleRule(rule)}
                  className="shrink-0 mt-0.5 rounded-full transition-colors"
                  style={{ width: 32, height: 18, backgroundColor: isOn ? '#3b82f6' : '#94a3b8', position: 'relative' }}
                >
                  <span style={{
                    position: 'absolute', top: 2,
                    left: isOn ? 16 : 2,
                    width: 14, height: 14, borderRadius: '50%',
                    backgroundColor: '#fff', transition: 'left 0.15s',
                  }} />
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium" style={{ color: isOn ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                      {meta.label}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>— {meta.description}</span>
                  </div>

                  {/* Thresholds (só quando ativo) */}
                  {isOn && thresholds && (
                    <div className="flex flex-wrap gap-3 mt-2">
                      {meta.fields.map(field => (
                        <label key={field.key} className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                          {field.label}:
                          <input
                            type="number"
                            min={field.min}
                            max={field.max}
                            step={field.step}
                            style={inputStyle}
                            value={((thresholds[rule] as Record<string, number> | undefined)?.[field.key]) ?? RULE_DEFAULTS[rule][field.key] ?? 0}
                            onChange={e => setThresholdField(rule, field.key, Number(e.target.value))}
                          />
                          <span style={{ color: 'var(--text-muted)' }}>{field.unit}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                {/* Badge status */}
                <span
                  className="shrink-0 text-xs px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor: isOn ? 'rgba(59,130,246,0.1)' : 'rgba(255,255,255,0.05)',
                    color: isOn ? '#60a5fa' : '#64748b',
                  }}
                >
                  {isOn ? 'Ativo' : 'Off'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {config && (
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          {enabled.size === 0
            ? 'Nenhuma regra ativa — alertas suprimidos.'
            : `${enabled.size} de ${ALL_RULES.length} regras ativas.`}
        </p>
      )}
    </div>
  );
}

// ─── Página principal ──────────────────────────────────────────────────────────

export default function RelatoriosPage() {
  const { organization, user } = useAuth();
  const router = useRouter();
  const [schedules, setSchedules] = useState<ReportSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const isGestorContext = typeof window !== 'undefined' && !!sessionStorage.getItem('traffic_manager_org_id') && user?.role === 'TRAFFIC_MANAGER';
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [registeringWebhook, setRegisteringWebhook] = useState(false);

  const showToast = (msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 4000); };

  const handleRegisterWebhook = async () => {
    setRegisteringWebhook(true);
    try {
      const { message } = await apiService.registerTelegramWebhook();
      showToast(message, true);
    } catch {
      showToast('Erro ao registrar webhook. Verifique BACKEND_URL no Render.', false);
    } finally { setRegisteringWebhook(false); }
  };

  const fetchSchedules = useCallback(async () => {
    try {
      const { data } = await apiService.getReportSchedules();
      setSchedules(data);
    } catch { /* mantém vazio */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchSchedules(); }, [fetchSchedules]);

  const handleToggle = async (s: ReportSchedule) => {
    await apiService.updateReportSchedule(s.id, { isActive: !s.isActive });
    setSchedules(prev => prev.map(x => x.id === s.id ? { ...x, isActive: !x.isActive } : x));
  };

  const handleDelete = async (id: string) => {
    await apiService.deleteReportSchedule(id);
    setSchedules(prev => prev.filter(x => x.id !== id));
    showToast('Agendamento removido');
  };

  const handleSendNow = async (id: string) => {
    await apiService.sendReportNow(id);
    showToast('Relatório enviado!');
    fetchSchedules();
  };

  return (
    <div className="space-y-6">

      {/* Banner gestor */}
      {isGestorContext && (
        <div className="rounded-xl px-4 py-2.5 flex items-center justify-between gap-3"
          style={{ backgroundColor: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.2)' }}>
          <p className="text-xs" style={{ color: '#c084fc' }}>
            Gerenciando relatórios de <strong>{organization?.name}</strong>
          </p>
          <button onClick={() => { apiService.setSelectedClientOrgId(''); router.push('/dashboard/gestor'); }}
            className="text-xs px-2.5 py-1 rounded-lg transition-colors"
            style={{ backgroundColor: 'rgba(168,85,247,0.12)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.2)' }}>
            ← Voltar ao Gestor
          </button>
        </div>
      )}

      {/* Header */}
      <div className="rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3" style={card}>
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Relatórios Automatizados</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {organization?.name} · envio automático via Telegram ou WhatsApp
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
          style={{ backgroundColor: '#3b82f6', color: '#fff' }}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
          Novo agendamento
        </button>
      </div>

      {/* Instruções de configuração */}
      <div className="rounded-xl p-4 space-y-3" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid rgba(59,130,246,0.2)' }}>
        <p className="text-xs font-medium" style={{ color: '#60a5fa' }}>Como configurar</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
          <div>
            <p className="font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>✈️ Telegram</p>
            <ol className="space-y-0.5 list-decimal list-inside mb-2">
              <li>Clique em <strong style={{ color: 'var(--text-primary)' }}>"Registrar Webhook"</strong> abaixo (uma vez só)</li>
              <li>Adicione o bot <code style={{ color: '#818cf8' }}>@CortexGrowthBot</code> ao grupo desejado</li>
              <li>Ao criar um agendamento, clique em <strong style={{ color: 'var(--text-primary)' }}>"Conectar via QR Code"</strong></li>
              <li>Escaneie o QR Code com o Telegram — a conexão é automática</li>
            </ol>
            <button onClick={handleRegisterWebhook} disabled={registeringWebhook}
              className="text-xs px-3 py-1.5 rounded-lg transition-colors"
              style={{ backgroundColor: 'rgba(129,140,248,0.12)', color: '#818cf8', border: '1px solid rgba(129,140,248,0.25)', opacity: registeringWebhook ? 0.6 : 1 }}>
              {registeringWebhook ? 'Registrando...' : '⚡ Registrar Webhook'}
            </button>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <p className="font-medium" style={{ color: 'var(--text-secondary)' }}>📱 WhatsApp</p>
              <WhatsAppStatusBadge />
            </div>
            <ol className="space-y-0.5 list-decimal list-inside">
              <li>Número conectado pelo administrador via Evolution API</li>
              <li>Ao criar agendamento, informe o número do destinatário</li>
              <li>Formato: DDI + DDD + número, sem espaços (ex: <code style={{ color: '#818cf8' }}>5511999999999</code>)</li>
              <li>O número conectado acima envia para todos os destinos configurados</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Lista de schedules */}
      {loading ? (
        <div className="flex items-center justify-center py-20" style={{ color: 'var(--text-muted)' }}>
          <svg className="animate-spin h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="#3b82f6" strokeWidth="4" />
            <path className="opacity-75" fill="#3b82f6" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Carregando agendamentos...
        </div>
      ) : schedules.length === 0 ? (
        <div className="rounded-xl p-10 flex flex-col items-center justify-center text-center" style={card}>
          <svg className="w-10 h-10 mb-3 opacity-20" fill="none" viewBox="0 0 24 24" stroke="#94a3b8" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Nenhum agendamento criado</p>
          <p className="text-xs mt-1 mb-4" style={{ color: 'var(--text-muted)' }}>Configure o envio automático do relatório de KPIs para o Telegram ou WhatsApp.</p>
          <button onClick={() => setShowCreate(true)} className="px-4 py-2 rounded-lg text-xs font-medium" style={{ backgroundColor: '#3b82f6', color: '#fff' }}>
            Criar primeiro agendamento
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {schedules.map(s => (
            <ScheduleCard
              key={s.id}
              schedule={s}
              onToggle={() => handleToggle(s)}
              onDelete={() => handleDelete(s.id)}
              onSendNow={async () => { await handleSendNow(s.id); }}
              onRefresh={fetchSchedules}
            />
          ))}
        </div>
      )}

      {showCreate && <CreateModal onClose={() => setShowCreate(false)} onCreated={fetchSchedules} />}

      {/* Alertas de Anomalia */}
      <AlertConfigSection />

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg" style={toast.ok
  ? { backgroundColor: 'var(--badge-success-bg)', color: 'var(--badge-success-text)', border: '1px solid var(--badge-success-text)' }
  : { backgroundColor: 'var(--badge-error-bg)', color: 'var(--badge-error-text)', border: '1px solid var(--badge-error-text)' }
}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}
