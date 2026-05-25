'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { apiService } from '@/lib/api';
import type { ReportSchedule, ChannelType, ReportFrequency } from '@/types';

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

function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// ─── Telegram QR Modal ─────────────────────────────────────────────────────────

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
    <div className="fixed inset-0 z-70 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.85)' }}>
      <div className="w-full max-w-sm rounded-2xl p-6 text-center space-y-4" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-md)' }}>
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Conectar Telegram</p>
          <button onClick={onClose} style={{ color: 'var(--text-muted)' }}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {phase === 'loading' && (
          <div className="py-10 flex flex-col items-center gap-3" style={{ color: 'var(--text-muted)' }}>
            <Spinner className="h-6 w-6" />
            <p className="text-xs">Gerando link seguro...</p>
          </div>
        )}

        {phase === 'ready' && (
          <>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Escaneie o QR Code com o Telegram para conectar este chat ao agendamento.
            </p>
            <div className="flex justify-center py-2">
              {/* QR code sempre tem fundo branco — requisito do padrão QR */}
              <div className="p-3 rounded-xl" style={{ backgroundColor: '#fff' }}>
                <QRCodeSVG value={deepLink} size={180} />
              </div>
            </div>
            <a href={deepLink} target="_blank" rel="noreferrer"
              className="block text-xs truncate px-3 py-2 rounded-lg"
              style={{ backgroundColor: 'var(--accent-dim)', color: 'var(--chart-tertiary)', border: '1px solid var(--border-md)' }}>
              {deepLink}
            </a>
            <div className="flex items-center gap-2 justify-center pt-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: 'var(--accent)' }} />
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Aguardando conexão... (expira em 24h)</p>
            </div>
          </>
        )}

        {phase === 'connected' && (
          <div className="py-8 flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--badge-success-bg)' }}>
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} style={{ stroke: 'var(--badge-success-text)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-sm font-medium" style={{ color: 'var(--badge-success-text)' }}>Conectado!</p>
          </div>
        )}

        {phase === 'error' && (
          <div className="py-8 flex flex-col items-center gap-3">
            <p className="text-sm" style={{ color: 'var(--badge-error-text)' }}>Link expirado ou inválido.</p>
            <button onClick={() => setPhase('loading')} className="text-xs px-4 py-2 rounded-lg"
              style={{ backgroundColor: 'var(--accent-dim)', color: 'var(--chart-tertiary)', border: '1px solid var(--border-md)' }}>
              Gerar novo link
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Modal de criação ──────────────────────────────────────────────────────────

function CreateScheduleModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
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
    } catch { setError('Erro ao criar agendamento'); }
    finally { setLoading(false); }
  };

  const inputStyle = {
    backgroundColor: 'var(--input-bg)', border: '1px solid var(--input-border)',
    color: 'var(--text-primary)', borderRadius: 8, padding: '8px 12px', width: '100%', fontSize: 13,
  };
  const labelStyle = { color: 'var(--text-muted)', fontSize: 12, marginBottom: 4, display: 'block' as const };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}>
      <div className="w-full max-w-md rounded-2xl p-6 space-y-4" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-md)' }}>
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Novo agendamento</p>
          <button onClick={onClose} style={{ color: 'var(--text-muted)' }}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Canal */}
        <div>
          <span style={labelStyle}>Canal de envio</span>
          <div className="flex gap-2">
            {(['TELEGRAM', 'WHATSAPP'] as ChannelType[]).map(c => (
              <button key={c} onClick={() => { setChannel(c); setDestination(''); setDestinationName(''); }}
                className="flex-1 py-2 rounded-lg text-xs font-medium transition-all"
                style={{
                  backgroundColor: channel === c
                    ? (c === 'TELEGRAM' ? 'var(--accent-dim)' : 'var(--badge-success-bg)')
                    : 'var(--input-bg)',
                  color: channel === c
                    ? (c === 'TELEGRAM' ? 'var(--chart-tertiary)' : 'var(--badge-success-text)')
                    : 'var(--text-muted)',
                  border: `1px solid ${channel === c ? 'var(--border-md)' : 'var(--border)'}`,
                }}>
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
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg"
                style={{ backgroundColor: 'var(--badge-success-bg)', border: '1px solid var(--border-md)' }}>
                <span className="text-xs flex-1" style={{ color: 'var(--badge-success-text)' }}>
                  ✓ {destinationName} <span style={{ color: 'var(--text-muted)' }}>({destination})</span>
                </span>
                <button onClick={() => { setDestination(''); setDestinationName(''); }} className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Trocar
                </button>
              </div>
            ) : (
              <button onClick={() => setShowQR(true)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-lg text-xs font-medium"
                style={{ backgroundColor: 'var(--accent-dim)', color: 'var(--chart-tertiary)', border: '1px dashed var(--border-md)' }}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
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
            <span style={labelStyle}>Número (DDI+DDD+número)</span>
            <input style={inputStyle} placeholder="Ex: 5511999999999" value={destination} onChange={e => setDestination(e.target.value)} />
          </div>
        )}

        {/* Nome do destino — oculto no Telegram quando conectado via QR */}
        {!(channel === 'TELEGRAM' && destination) && (
          <div>
            <span style={labelStyle}>Nome do destino</span>
            <input style={inputStyle} placeholder="Ex: Grupo Relatórios Cliente" value={destinationName} onChange={e => setDestinationName(e.target.value)} />
          </div>
        )}

        {/* Frequência */}
        <div>
          <span style={labelStyle}>Frequência</span>
          <div className="grid grid-cols-2 gap-2">
            {(Object.entries(FREQ_LABELS) as [ReportFrequency, string][]).map(([k, v]) => (
              <button key={k} onClick={() => setFrequency(k)}
                className="py-2 rounded-lg text-xs font-medium transition-all"
                style={{
                  backgroundColor: frequency === k ? 'var(--accent-dim)' : 'var(--input-bg)',
                  color: frequency === k ? 'var(--chart-tertiary)' : 'var(--text-muted)',
                  border: `1px solid ${frequency === k ? 'var(--border-md)' : 'var(--border)'}`,
                }}>
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Horário e dia */}
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

        {error && <p className="text-xs" style={{ color: 'var(--badge-error-text)' }}>{error}</p>}

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg text-xs font-medium"
            style={{ backgroundColor: 'var(--input-bg)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
            Cancelar
          </button>
          <button onClick={handleSubmit} disabled={loading} className="flex-1 py-2 rounded-lg text-xs font-medium transition-colors"
            style={{ backgroundColor: 'var(--accent)', color: '#fff', opacity: loading ? 0.6 : 1 }}>
            {loading ? 'Criando...' : 'Criar agendamento'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Linha de schedule ─────────────────────────────────────────────────────────

function ScheduleRow({ schedule, onToggle, onDelete, onSendNow }: {
  schedule: ReportSchedule;
  onToggle: () => void;
  onDelete: () => void;
  onSendNow: () => Promise<void>;
}) {
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<'ok' | 'err' | null>(null);

  const handleSend = async () => {
    setSending(true); setSendResult(null);
    try { await onSendNow(); setSendResult('ok'); }
    catch { setSendResult('err'); }
    finally { setSending(false); setTimeout(() => setSendResult(null), 3000); }
  };

  const channelIcon = schedule.channelType === 'TELEGRAM' ? '✈️' : '📱';
  const lastLog = schedule.logs[0];

  return (
    <div className="rounded-xl p-3 space-y-2" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm shrink-0">{channelIcon}</span>
          <div className="min-w-0">
            <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>{schedule.destinationName}</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{describeSchedule(schedule)}</p>
          </div>
        </div>
        {/* Toggle: knob branco funciona em ambos os temas */}
        <button onClick={onToggle} className="shrink-0 rounded-full transition-colors relative"
          style={{ width: 32, height: 18, backgroundColor: schedule.isActive ? 'var(--accent)' : 'var(--border-md)' }}>
          <span style={{ position: 'absolute', top: 2, left: schedule.isActive ? 16 : 2, width: 14, height: 14, borderRadius: '50%', backgroundColor: '#fff', transition: 'left 0.15s' }} />
        </button>
      </div>

      {lastLog && (
        <p className="text-xs" style={{ color: lastLog.status === 'SUCCESS' ? 'var(--badge-success-text)' : 'var(--badge-error-text)' }}>
          {lastLog.status === 'SUCCESS' ? '✓' : '✗'} Último: {new Date(lastLog.sentAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
        </p>
      )}

      <div className="flex gap-2" style={{ borderTop: '1px solid var(--border)', paddingTop: 8 }}>
        <button onClick={handleSend} disabled={sending}
          className="flex-1 py-1 rounded-lg text-xs font-medium transition-colors"
          style={{
            backgroundColor: sendResult === 'ok' ? 'var(--badge-success-bg)' : sendResult === 'err' ? 'var(--badge-error-bg)' : 'var(--accent-dim)',
            color: sendResult === 'ok' ? 'var(--badge-success-text)' : sendResult === 'err' ? 'var(--badge-error-text)' : 'var(--chart-tertiary)',
            border: '1px solid var(--border-md)',
          }}>
          {sending ? 'Enviando...' : sendResult === 'ok' ? '✓ Enviado' : sendResult === 'err' ? '✗ Erro' : 'Enviar agora'}
        </button>
        <button onClick={onDelete} className="px-2.5 py-1 rounded-lg text-xs transition-colors"
          style={{ backgroundColor: 'var(--badge-error-bg)', color: 'var(--badge-error-text)', border: '1px solid var(--border)' }}>
          Remover
        </button>
      </div>
    </div>
  );
}

// ─── Modal principal ───────────────────────────────────────────────────────────

export default function ClientReportsModal({ clientName, onClose }: {
  clientName: string;
  onClose: () => void;
}) {
  const [schedules, setSchedules] = useState<ReportSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchSchedules = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await apiService.getReportSchedules();
      setSchedules(data);
    } catch { /* mantém vazio */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchSchedules(); }, [fetchSchedules]);

  const handleToggle = async (s: ReportSchedule) => {
    try {
      await apiService.updateReportSchedule(s.id, { isActive: !s.isActive });
      setSchedules(prev => prev.map(x => x.id === s.id ? { ...x, isActive: !x.isActive } : x));
    } catch { showToast('Erro ao atualizar agendamento', false); }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiService.deleteReportSchedule(id);
      setSchedules(prev => prev.filter(x => x.id !== id));
      showToast('Agendamento removido');
    } catch { showToast('Erro ao remover agendamento', false); }
  };

  const handleSendNow = async (id: string) => {
    await apiService.sendReportNow(id);
    showToast('Relatório enviado!');
    fetchSchedules();
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
        <div className="w-full max-w-lg rounded-2xl flex flex-col" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-md)', maxHeight: '85vh' }}>

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Relatórios Automatizados</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--chart-tertiary)' }}>{clientName}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowCreate(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" /></svg>
                Novo
              </button>
              <button onClick={onClose} className="p-1.5 rounded-lg transition-colors" style={{ color: 'var(--text-muted)' }}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="overflow-y-auto flex-1 p-4 space-y-3">
            {loading ? (
              <div className="flex items-center justify-center py-12 gap-2" style={{ color: 'var(--text-muted)' }}>
                <Spinner /> <span className="text-sm">Carregando...</span>
              </div>
            ) : schedules.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
                <svg className="w-10 h-10 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} style={{ color: 'var(--text-secondary)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Nenhum agendamento configurado</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Clique em "+ Novo" para criar o primeiro envio automático.</p>
              </div>
            ) : (
              schedules.map(s => (
                <ScheduleRow
                  key={s.id}
                  schedule={s}
                  onToggle={() => handleToggle(s)}
                  onDelete={() => handleDelete(s.id)}
                  onSendNow={async () => { await handleSendNow(s.id); }}
                />
              ))
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-3" style={{ borderTop: '1px solid var(--border)' }}>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Telegram: adicione <strong style={{ color: 'var(--accent)' }}>@CortexGrowthBot</strong> ao grupo antes de conectar.
              WhatsApp: informe o número no formato DDI+DDD+número.
            </p>
          </div>
        </div>
      </div>

      {showCreate && (
        <CreateScheduleModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); fetchSchedules(); }}
        />
      )}

      {/* Toast: sempre colorido independente do tema */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-80 px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg"
          style={{ backgroundColor: toast.ok ? '#1D9E75' : '#dc2626', color: '#fff' }}>
          {toast.msg}
        </div>
      )}
    </>
  );
}
