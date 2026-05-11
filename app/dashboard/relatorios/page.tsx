'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '@/context/AuthContext';
import { apiService } from '@/lib/api';
import type { ReportSchedule, ChannelType, ReportFrequency } from '@/types';

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

const card = { backgroundColor: '#0f1629', border: '1px solid rgba(255,255,255,0.06)' };

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
      <div className="w-full max-w-sm rounded-2xl p-6 text-center space-y-4" style={{ backgroundColor: '#0f1629', border: '1px solid rgba(255,255,255,0.1)' }}>
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm font-semibold" style={{ color: '#f1f5f9' }}>Conectar Telegram</p>
          <button onClick={onClose} style={{ color: '#475569' }}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {phase === 'loading' && (
          <div className="py-10 flex flex-col items-center gap-3">
            <svg className="animate-spin h-6 w-6" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="#3b82f6" strokeWidth="4" />
              <path className="opacity-75" fill="#3b82f6" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-xs" style={{ color: '#64748b' }}>Gerando link seguro...</p>
          </div>
        )}

        {phase === 'ready' && (
          <>
            <p className="text-xs" style={{ color: '#64748b' }}>
              Escaneie o QR Code com o Telegram para conectar este chat ao agendamento.
            </p>
            <div className="flex justify-center py-2">
              <div className="p-3 rounded-xl" style={{ backgroundColor: '#fff' }}>
                <QRCodeSVG value={deepLink} size={180} />
              </div>
            </div>
            <p className="text-xs" style={{ color: '#475569' }}>
              Ou abra o link diretamente no Telegram:
            </p>
            <a href={deepLink} target="_blank" rel="noreferrer"
              className="block text-xs truncate px-3 py-2 rounded-lg"
              style={{ backgroundColor: 'rgba(59,130,246,0.1)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.2)' }}>
              {deepLink}
            </a>
            <div className="flex items-center gap-2 justify-center pt-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: '#3b82f6' }} />
              <p className="text-xs" style={{ color: '#475569' }}>Aguardando conexão... (expira em 24h)</p>
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
            <p className="text-xs" style={{ color: '#64748b' }}>Fechando automaticamente...</p>
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

  const loadPreview = async () => {
    try {
      const { data } = await apiService.getReportPreview();
      setPreview(data.text);
      setShowPreview(true);
    } catch { setPreview('Erro ao gerar prévia.'); setShowPreview(true); }
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
      });
      onCreated();
      onClose();
    } catch { setError('Erro ao criar agendamento'); } finally { setLoading(false); }
  };

  const inputStyle = { backgroundColor: '#060c1a', border: '1px solid rgba(255,255,255,0.1)', color: '#e2e8f0', borderRadius: 8, padding: '8px 12px', width: '100%', fontSize: 13 };
  const labelStyle = { color: '#64748b', fontSize: 12, marginBottom: 4, display: 'block' as const };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
      <div className="w-full max-w-lg rounded-2xl p-6 space-y-5" style={{ backgroundColor: '#0f1629', border: '1px solid rgba(255,255,255,0.1)' }}>
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold" style={{ color: '#f1f5f9' }}>Novo agendamento de relatório</p>
          <button onClick={onClose} style={{ color: '#475569' }}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

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
                <span className="text-xs flex-1" style={{ color: '#4ade80' }}>✓ {destinationName} <span style={{ color: '#475569' }}>({destination})</span></span>
                <button onClick={() => { setDestination(''); setDestinationName(''); }} className="text-xs" style={{ color: '#475569' }}>Trocar</button>
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
            <p className="text-xs mt-1" style={{ color: '#475569' }}>Formato: DDI + DDD + número, sem espaços ou símbolos</p>
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

        {/* Preview */}
        <button onClick={loadPreview} className="text-xs transition-colors" style={{ color: '#475569' }}>
          Ver prévia do relatório →
        </button>
        {showPreview && (
          <pre className="rounded-lg p-3 text-xs overflow-x-auto whitespace-pre-wrap" style={{ backgroundColor: '#060c1a', border: '1px solid rgba(255,255,255,0.06)', color: '#94a3b8', maxHeight: 200 }}>
            {preview}
          </pre>
        )}

        {error && <p className="text-xs" style={{ color: '#f87171' }}>{error}</p>}

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg text-xs font-medium" style={{ backgroundColor: 'rgba(255,255,255,0.04)', color: '#64748b', border: '1px solid rgba(255,255,255,0.06)' }}>
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

// ─── Card de schedule ──────────────────────────────────────────────────────────

function ScheduleCard({ schedule, onToggle, onDelete, onSendNow }: {
  schedule: ReportSchedule;
  onToggle: () => void;
  onDelete: () => void;
  onSendNow: () => void;
}) {
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<'ok' | 'err' | null>(null);

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
            <p className="text-sm font-medium truncate" style={{ color: '#f1f5f9' }}>{schedule.destinationName}</p>
            <p className="text-xs truncate" style={{ color: '#475569' }}>{schedule.destination}</p>
          </div>
        </div>

        {/* Toggle ativo */}
        <button onClick={onToggle} className="flex-shrink-0 rounded-full transition-colors"
          style={{ width: 36, height: 20, backgroundColor: schedule.isActive ? '#3b82f6' : 'rgba(255,255,255,0.1)', position: 'relative' }}>
          <span style={{ position: 'absolute', top: 3, left: schedule.isActive ? 18 : 3, width: 14, height: 14, borderRadius: '50%', backgroundColor: '#fff', transition: 'left 0.15s' }} />
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs" style={{ backgroundColor: 'rgba(59,130,246,0.1)', color: channelColor }}>
          {FREQ_LABELS[schedule.frequency]}
        </span>
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs" style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: '#64748b' }}>
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

      <div className="flex gap-2 pt-1" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <button onClick={handleSend} disabled={sending}
          className="flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors"
          style={{ backgroundColor: sendResult === 'ok' ? 'rgba(34,197,94,0.15)' : sendResult === 'err' ? 'rgba(248,113,113,0.15)' : 'rgba(59,130,246,0.1)', color: sendResult === 'ok' ? '#4ade80' : sendResult === 'err' ? '#f87171' : '#60a5fa', border: '1px solid rgba(59,130,246,0.2)' }}
        >
          {sending ? 'Enviando...' : sendResult === 'ok' ? '✓ Enviado' : sendResult === 'err' ? '✗ Erro' : 'Enviar agora'}
        </button>
        <button onClick={onDelete} className="px-3 py-1.5 rounded-lg text-xs transition-colors"
          style={{ backgroundColor: 'rgba(248,113,113,0.08)', color: '#f87171', border: '1px solid rgba(248,113,113,0.15)' }}>
          Remover
        </button>
      </div>
    </div>
  );
}

// ─── Página principal ──────────────────────────────────────────────────────────

export default function RelatoriosPage() {
  const { organization } = useAuth();
  const [schedules, setSchedules] = useState<ReportSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

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

      {/* Header */}
      <div className="rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3" style={card}>
        <div>
          <p className="text-sm font-semibold" style={{ color: '#f1f5f9' }}>Relatórios Automatizados</p>
          <p className="text-xs mt-0.5" style={{ color: '#475569' }}>
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
      <div className="rounded-xl p-4 space-y-3" style={{ backgroundColor: '#060c1a', border: '1px solid rgba(59,130,246,0.15)' }}>
        <p className="text-xs font-medium" style={{ color: '#60a5fa' }}>Como configurar</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs" style={{ color: '#64748b' }}>
          <div>
            <p className="font-medium mb-1" style={{ color: '#94a3b8' }}>✈️ Telegram</p>
            <ol className="space-y-0.5 list-decimal list-inside">
              <li>Adicione o bot <code style={{ color: '#818cf8' }}>@CortexGrowthBot</code> ao grupo desejado</li>
              <li>Ao criar um agendamento, clique em <strong style={{ color: '#e2e8f0' }}>"Conectar via QR Code"</strong></li>
              <li>Escaneie o QR Code com o Telegram — a conexão é automática</li>
            </ol>
          </div>
          <div>
            <p className="font-medium mb-1" style={{ color: '#94a3b8' }}>📱 WhatsApp (Z-API)</p>
            <ol className="space-y-0.5 list-decimal list-inside">
              <li>Crie uma instância em <code style={{ color: '#818cf8' }}>z-api.io</code></li>
              <li>Configure <code style={{ color: '#818cf8' }}>ZAPI_INSTANCE_ID</code>, <code style={{ color: '#818cf8' }}>ZAPI_TOKEN</code> e <code style={{ color: '#818cf8' }}>ZAPI_CLIENT_TOKEN</code></li>
              <li>Conecte o WhatsApp escaneando o QR code na Z-API</li>
              <li>Use o número do destinatário: DDI + DDD + número</li>
            </ol>
          </div>
        </div>
      </div>

      {/* Lista de schedules */}
      {loading ? (
        <div className="flex items-center justify-center py-20" style={{ color: '#475569' }}>
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
          <p className="text-sm font-medium" style={{ color: '#94a3b8' }}>Nenhum agendamento criado</p>
          <p className="text-xs mt-1 mb-4" style={{ color: '#475569' }}>Configure o envio automático do relatório de KPIs para o Telegram ou WhatsApp.</p>
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
            />
          ))}
        </div>
      )}

      {showCreate && <CreateModal onClose={() => setShowCreate(false)} onCreated={fetchSchedules} />}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg" style={{ backgroundColor: '#1D9E75', color: '#fff' }}>
          {toast}
        </div>
      )}
    </div>
  );
}
