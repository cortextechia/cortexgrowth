'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '@/context/AuthContext';
import { apiService } from '@/lib/api';
import { usePlano } from '@/hooks/useApi';
import { IconeCadeado } from '@/components/RecursoBloqueado';
import type { ReportSchedule, ReportConfig, ChannelType, ReportFrequency, AlertConfig, AnomalyRuleId } from '@/types';

// ─── Ícones (traço fino, herdam a cor do texto) ───────────────────────────────

type IconName = 'telegram' | 'whatsapp' | 'plus' | 'send' | 'edit' | 'trash' | 'qr' | 'check' | 'close' | 'clock'
  | 'calendar' | 'bell' | 'wallet' | 'pulse' | 'moon' | 'chat' | 'list' | 'zap' | 'spinner' | 'alert' | 'group' | 'user';

const ICON_PATHS: Record<Exclude<IconName, 'spinner'>, string> = {
  telegram: 'M21.5 4.5 2.8 11.7c-.9.4-.9 1.6.1 1.9l4.6 1.4 1.8 5.6c.2.7 1.1.9 1.6.4l2.6-2.4 4.7 3.5c.6.4 1.4.1 1.6-.6L22.9 5.8c.2-.9-.6-1.6-1.4-1.3ZM9.5 14.6l8.3-7.2-6.6 8.4',
  whatsapp: 'M3.5 20.5 4.8 16A8.5 8.5 0 1 1 8 19.2L3.5 20.5Zm5.6-12.3c-.3 1.6.5 3.4 2 4.9s3.3 2.3 4.9 2l.8-1.6-2-1.1-1 .9a5 5 0 0 1-2.6-2.6l.9-1-1.1-2-1.9.5Z',
  plus: 'M12 5v14M5 12h14',
  send: 'M5 12h11M12 5l7 7-7 7',
  edit: 'M4 20h4L19 9l-4-4L4 16v4ZM13.5 6.5l4 4',
  trash: 'M5 7h14M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  qr: 'M4 4h6v6H4V4Zm10 0h6v6h-6V4ZM4 14h6v6H4v-6Zm10 0h2v2h-2v-2Zm4 0h2v2h-2v-2Zm-4 4h2v2h-2v-2Zm4 0h2v2h-2v-2Z',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  close: 'M6 6l12 12M18 6 6 18',
  clock: 'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  calendar: 'M4 8h16M8 3v4M16 3v4M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z',
  bell: 'M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16Zm4 4h4',
  wallet: 'M4 7h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a1 1 0 0 1-1-1V7Zm0 0 11-3v3M16 13.5h.01',
  pulse: 'M3 12h4l2-5 4 10 2-5h6',
  moon: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z',
  chat: 'M5 5h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-4 3V6a1 1 0 0 1 1-1Z',
  list: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',
  zap: 'M13 3 5 13.5h6L10 21l8-10.5h-6L13 3Z',
  alert: 'M12 9v4M12 16.5h.01M10.3 4.2 2.7 17.5A2 2 0 0 0 4.4 20.5h15.2a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0Z',
  group: 'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-6 9a6 6 0 0 1 12 0M16 5.2a3 3 0 0 1 0 5.6M18.5 20a5.5 5.5 0 0 0-3-4.9',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0',
};

function Icon({ name, size = 16, className = '' }: { name: IconName; size?: number; className?: string }) {
  if (name === 'spinner') {
    return (
      <svg className={`animate-spin ${className}`} width={size} height={size} fill="none" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
        <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg className={className} width={size} height={size} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.7}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICON_PATHS[name]} />
    </svg>
  );
}

// ─── Peças visuais locais ─────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  backgroundColor: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)',
  borderRadius: 10, padding: '9px 12px', width: '100%', fontSize: 13, outline: 'none',
};
const labelStyle: React.CSSProperties = {
  color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, marginBottom: 6, display: 'block',
};

/** Quadradinho com o ícone — marca o canal/regra sem depender de emoji. */
function IconTile({ name, tone = 'neutral', size = 36 }: { name: IconName; tone?: 'neutral' | 'lime' | 'tg' | 'wa' | 'warn'; size?: number }) {
  const tones = {
    neutral: { background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border)' },
    lime:    { background: 'var(--tint-bg)', color: 'var(--tint-ink)', border: '1px solid var(--highlight-border)' },
    tg:      { background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid var(--accent-line)' },
    wa:      { background: 'var(--badge-success-bg)', color: 'var(--badge-success-text)', border: '1px solid var(--border)' },
    warn:    { background: 'var(--badge-warn-bg)', color: 'var(--badge-warn-text)', border: '1px solid var(--border)' },
  }[tone];
  return (
    <span className="inline-flex items-center justify-center shrink-0" style={{ width: size, height: size, borderRadius: 10, ...tones }}>
      <Icon name={name} size={Math.round(size * 0.5)} />
    </span>
  );
}

/** Ponto de status com halo — verde ok, vermelho falha, cinza neutro. */
function StatusDot({ tone }: { tone: 'ok' | 'err' | 'idle' | 'warn' }) {
  const cor = { ok: 'var(--badge-success-text)', err: 'var(--badge-error-text)', warn: 'var(--badge-warn-text)', idle: 'var(--border-control)' }[tone];
  return <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cor, boxShadow: `0 0 0 3px color-mix(in srgb, ${cor} 22%, transparent)` }} />;
}

function SectionHead({ eyebrow, title, sub, right }: { eyebrow: string; title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
      <div className="min-w-0">
        <span className="eyebrow" style={{ color: 'var(--text-secondary)' }}>{eyebrow}</span>
        <h2 className="ui-h2 mt-1">{title}</h2>
        {sub && <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{sub}</p>}
      </div>
      {right}
    </div>
  );
}

// Pilha dos modais abertos: o Esc fecha só o de cima (o QR abre por cima do "Novo agendamento").
const modalStack: symbol[] = [];

function Modal({ title, sub, onClose, children, footer, width = 560, z = 50 }: {
  title: string; sub?: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; width?: number; z?: number;
}) {
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => {
    const id = Symbol('modal');
    modalStack.push(id);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && modalStack[modalStack.length - 1] === id) closeRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      modalStack.splice(modalStack.indexOf(id), 1);
    };
  }, []);
  return (
    <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: z, backgroundColor: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(3px)' }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={title} className="w-full flex flex-col"
        style={{ maxWidth: width, maxHeight: '90vh', backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-md)', borderRadius: 20, boxShadow: '0 24px 60px rgba(0,0,0,0.35)' }}>
        <div className="flex items-start justify-between gap-3 px-6 pt-5 pb-4 shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="min-w-0">
            <p className="text-base font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>{title}</p>
            {sub && <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-secondary)' }}>{sub}</p>}
          </div>
          <button onClick={onClose} aria-label="Fechar" className="p-1.5 rounded-lg" style={{ color: 'var(--text-secondary)' }}>
            <Icon name="close" />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-5">{children}</div>
        {footer && <div className="flex gap-2 px-6 py-4 shrink-0" style={{ borderTop: '1px solid var(--border)' }}>{footer}</div>}
      </div>
    </div>
  );
}

// ─── WhatsApp status badge ────────────────────────────────────────────────────

type WaStatus = 'loading' | 'connected' | 'disconnected';

function WhatsAppStatusBadge({ status, phone }: { status: WaStatus; phone: string }) {
  if (status === 'loading') return (
    <span className="ui-chip"><Icon name="spinner" size={11} /> verificando</span>
  );
  if (status === 'connected') return (
    <span className="ui-chip" style={{ color: 'var(--text-primary)' }}><StatusDot tone="ok" /> conectado{phone ? ` · ${phone}` : ''}</span>
  );
  return <span className="ui-chip"><StatusDot tone="err" /> desconectado</span>;
}

/** Status do WhatsApp de relatórios da org (um número por empresa). */
function useReportWaStatus() {
  const [status, setStatus] = useState<WaStatus>('loading');
  const [phone, setPhone] = useState('');
  const refresh = useCallback(async () => {
    try {
      const { data } = await apiService.getWhatsAppStatus();
      setStatus(data.connected ? 'connected' : 'disconnected');
      setPhone(data.phone ?? '');
      return data.connected;
    } catch {
      setStatus('disconnected');
      return false;
    }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);
  return { status, phone, refresh, setStatus };
}

// ─── Modal QR Code WhatsApp (número de relatórios da empresa) ─────────────────

function ReportWaQrModal({ onConnected, onClose }: { onConnected: () => void; onClose: () => void }) {
  const [phase, setPhase] = useState<'loading' | 'qr' | 'connected' | 'error'>('loading');
  const [qr, setQr] = useState<string | null>(null);

  const gerar = useCallback(async () => {
    try {
      const { data } = await apiService.connectReportWhatsapp();
      if (data.connected) { setPhase('connected'); return; }
      if (!data.qrcode) { setPhase('error'); return; }
      setQr(data.qrcode);
      setPhase('qr');
    } catch { setPhase('error'); }
  }, []);

  useEffect(() => { void gerar(); }, [gerar]);

  // Pareamento: confere a conexão a cada 3s e renova o QR a cada 25s
  useEffect(() => {
    if (phase !== 'qr') return;
    const poll = setInterval(async () => {
      try {
        const { data } = await apiService.getWhatsAppStatus();
        if (data.connected) setPhase('connected');
      } catch { /* ignora falhas de polling */ }
    }, 3000);
    const renew = setInterval(async () => {
      try {
        const { data } = await apiService.connectReportWhatsapp();
        if (data.qrcode) setQr(data.qrcode);
      } catch { /* mantém o QR atual */ }
    }, 25000);
    return () => { clearInterval(poll); clearInterval(renew); };
  }, [phase]);

  useEffect(() => {
    if (phase !== 'connected') return;
    const t = setTimeout(onConnected, 1200);
    return () => clearTimeout(t);
  }, [phase, onConnected]);

  return (
    <Modal title="Conectar WhatsApp de relatórios" onClose={onClose} width={400} z={60}>
      <div className="text-center space-y-4">
        {phase === 'loading' && (
          <div className="py-12 flex flex-col items-center gap-3" style={{ color: 'var(--text-secondary)' }}>
            <Icon name="spinner" size={22} />
            <p className="text-xs">Gerando QR code...</p>
          </div>
        )}

        {phase === 'qr' && qr && (
          <>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              No celular que está nos grupos: WhatsApp → <strong style={{ color: 'var(--text-primary)' }}>Dispositivos conectados</strong> → <strong style={{ color: 'var(--text-primary)' }}>Conectar dispositivo</strong> e escaneie.
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={qr.startsWith('data:') ? qr : `data:image/png;base64,${qr}`}
              alt="QR code do WhatsApp"
              className="mx-auto"
              style={{ width: 240, height: 240, backgroundColor: '#fff', padding: 10, borderRadius: 14 }}
            />
            <p className="eyebrow inline-flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
              <StatusDot tone="warn" /> AGUARDANDO LEITURA · O QR RENOVA SOZINHO
            </p>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Este número só envia relatórios. As conversas dele não entram no CRM.
            </p>
          </>
        )}

        {phase === 'connected' && (
          <div className="py-10 flex flex-col items-center gap-3">
            <IconTile name="check" tone="wa" size={48} />
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>WhatsApp conectado</p>
          </div>
        )}

        {phase === 'error' && (
          <div className="py-8 flex flex-col items-center gap-3">
            <p className="text-sm" style={{ color: 'var(--badge-error-text)' }}>Não foi possível gerar o QR code.</p>
            <button onClick={() => { setPhase('loading'); void gerar(); }} className="ui-btn ui-btn-primary ui-btn-sm">Tentar de novo</button>
          </div>
        )}
      </div>
    </Modal>
  );
}

/** Passos numerados em mono (no lugar da lista com números do navegador). */
function Steps({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="space-y-2">
      {items.map((it, i) => (
        <li key={i} className="flex gap-2.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
          <span className="eyebrow shrink-0" style={{ color: 'var(--text-secondary)', fontSize: 11, paddingTop: 1 }}>{String(i + 1).padStart(2, '0')}</span>
          <span>{it}</span>
        </li>
      ))}
    </ol>
  );
}

// Card do canal Telegram: passos + registrar o webhook do bot
function TelegramChannelCard({ showToast }: { showToast: (msg: string, ok?: boolean) => void }) {
  const [registering, setRegistering] = useState(false);
  const handleRegister = async () => {
    setRegistering(true);
    try {
      const { message } = await apiService.registerTelegramWebhook();
      showToast(message, true);
    } catch {
      showToast('Erro ao registrar webhook. Verifique BACKEND_URL no Render.', false);
    } finally { setRegistering(false); }
  };

  return (
    <div className="ui-card flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <IconTile name="telegram" tone="tg" />
        <div className="min-w-0">
          <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Telegram</p>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Bot da plataforma no grupo do cliente</p>
        </div>
      </div>
      <Steps items={[
        <>Registre o webhook <strong style={{ color: 'var(--text-primary)' }}>uma vez só</strong></>,
        <>Adicione <code className="eyebrow" style={{ fontSize: 12 }}>@CortexGrowthBot</code> ao grupo</>,
        <>No agendamento, conecte o chat pelo QR Code</>,
      ]} />
      <div className="mt-auto">
        <button onClick={handleRegister} disabled={registering} className="ui-btn ui-btn-secondary ui-btn-sm">
          {registering ? <Icon name="spinner" size={14} /> : <Icon name="zap" size={14} />}
          {registering ? 'Registrando...' : 'Registrar webhook'}
        </button>
      </div>
    </div>
  );
}

// Card do canal WhatsApp: status + conectar/desconectar o número da empresa
function WhatsappChannelCard({ showToast, refreshSignal }: { showToast: (msg: string, ok?: boolean) => void; refreshSignal: boolean }) {
  const { status, phone, refresh, setStatus } = useReportWaStatus();
  const [showQr, setShowQr] = useState(false);
  const [working, setWorking] = useState(false);
  // O número também pode ser conectado de dentro do "Novo agendamento" — ao fechar, reconfere
  useEffect(() => { if (!refreshSignal) void refresh(); }, [refreshSignal, refresh]);

  const handleDisconnect = async () => {
    if (!confirm('Desconectar o WhatsApp de relatórios? Os agendamentos por WhatsApp param de ser enviados até conectar de novo.')) return;
    setWorking(true);
    try {
      await apiService.disconnectReportWhatsapp();
      setStatus('disconnected');
      showToast('WhatsApp de relatórios desconectado.');
    } catch { showToast('Erro ao desconectar o WhatsApp.', false); }
    finally { setWorking(false); }
  };

  return (
    <div className="ui-card flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <IconTile name="whatsapp" tone="wa" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>WhatsApp</p>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Um número da empresa envia tudo</p>
        </div>
        <WhatsAppStatusBadge status={status} phone={phone} />
      </div>
      <Steps items={[
        <>Conecte <strong style={{ color: 'var(--text-primary)' }}>um número da empresa</strong> pelo QR Code</>,
        <>No agendamento, escolha o grupo na lista ou informe um número</>,
        <>Esse número envia os relatórios e os alertas desta empresa</>,
      ]} />
      <div className="mt-auto">
        {status === 'connected' ? (
          <button onClick={handleDisconnect} disabled={working} className="ui-btn ui-btn-danger ui-btn-sm">Desconectar</button>
        ) : status === 'disconnected' ? (
          <button onClick={() => setShowQr(true)} className="ui-btn ui-btn-primary ui-btn-sm"><Icon name="qr" size={14} /> Conectar via QR Code</button>
        ) : null}
      </div>
      {showQr && (
        <ReportWaQrModal
          onConnected={() => { setShowQr(false); void refresh(); showToast('WhatsApp de relatórios conectado.'); }}
          onClose={() => { setShowQr(false); void refresh(); }}
        />
      )}
    </div>
  );
}

// Destino do agendamento por WhatsApp: grupo da lista (padrão) ou número avulso
function WhatsappDestination({ destination, destinationName, onChange }: {
  destination: string;
  destinationName: string;
  onChange: (destination: string, destinationName: string) => void;
}) {
  const { status, refresh } = useReportWaStatus();
  const [showQr, setShowQr] = useState(false);
  const [mode, setMode] = useState<'group' | 'number'>('group');
  const [groups, setGroups] = useState<{ id: string; name: string; size?: number }[] | null>(null);
  const [groupsError, setGroupsError] = useState(false);
  const [search, setSearch] = useState('');

  const loadGroups = useCallback(async () => {
    setGroups(null); setGroupsError(false);
    try {
      const { data } = await apiService.getReportWhatsappGroups();
      setGroups(data);
    } catch { setGroupsError(true); }
  }, []);

  useEffect(() => {
    if (status === 'connected' && mode === 'group') void loadGroups();
  }, [status, mode, loadGroups]);

  if (status === 'loading') {
    return <p className="text-xs inline-flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}><Icon name="spinner" size={12} /> Verificando o WhatsApp da empresa...</p>;
  }

  if (status === 'disconnected') {
    return (
      <div className="space-y-2">
        <span style={labelStyle}>WhatsApp de relatórios da empresa</span>
        <button onClick={() => setShowQr(true)}
          className="w-full flex items-center justify-center gap-2 py-4 text-xs font-semibold"
          style={{ borderRadius: 12, backgroundColor: 'var(--highlight)', color: 'var(--accent)', border: '1px dashed var(--accent-line)' }}>
          <Icon name="qr" size={15} /> Conectar via QR Code
        </button>
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          Conecte o número que está no grupo. Depois é só escolher o grupo na lista.
        </p>
        {showQr && (
          <ReportWaQrModal
            onConnected={() => { setShowQr(false); void refresh(); }}
            onClose={() => { setShowQr(false); void refresh(); }}
          />
        )}
      </div>
    );
  }

  const isGroup = destination.endsWith('@g.us');
  const termo = search.trim().toLowerCase();
  const filtrados = (groups ?? []).filter((g) => g.name.toLowerCase().includes(termo));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span style={{ ...labelStyle, marginBottom: 0 }}>Enviar para</span>
        <div className="ui-seg" role="group" aria-label="Tipo de destino">
          <button aria-pressed={mode === 'group'} onClick={() => { if (mode !== 'group') { setMode('group'); onChange('', ''); } }}>Grupo</button>
          <button aria-pressed={mode === 'number'} onClick={() => { if (mode !== 'number') { setMode('number'); onChange('', ''); } }}>Número</button>
        </div>
      </div>

      {mode === 'group' && isGroup && (
        <div className="flex items-center gap-3 px-3 py-2.5" style={{ borderRadius: 12, backgroundColor: 'var(--highlight)', border: '1px solid var(--highlight-border)' }}>
          <IconTile name="group" tone="lime" size={28} />
          <span className="text-xs font-semibold flex-1 truncate" style={{ color: 'var(--text-primary)' }}>{destinationName}</span>
          <button onClick={() => onChange('', '')} className="ui-btn ui-btn-secondary ui-btn-sm" style={{ padding: '5px 10px', fontSize: 12 }}>Trocar</button>
        </div>
      )}

      {mode === 'group' && !isGroup && (
        <>
          {groups === null && !groupsError && (
            <p className="text-xs py-3 inline-flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}><Icon name="spinner" size={12} /> Carregando os grupos... (pode levar alguns segundos)</p>
          )}
          {groupsError && (
            <div className="flex items-center gap-3">
              <p className="text-xs" style={{ color: 'var(--badge-error-text)' }}>Não foi possível listar os grupos.</p>
              <button onClick={() => void loadGroups()} className="ui-btn ui-btn-secondary ui-btn-sm" style={{ padding: '5px 10px', fontSize: 12 }}>Tentar de novo</button>
            </div>
          )}
          {groups !== null && groups.length === 0 && (
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Este número não participa de nenhum grupo.</p>
          )}
          {groups !== null && groups.length > 0 && (
            <div className="ui-inset overflow-hidden">
              <input style={{ ...inputStyle, border: 0, borderBottom: '1px solid var(--border)', borderRadius: 0, backgroundColor: 'transparent' }}
                placeholder={`Buscar entre ${groups.length} grupos`} value={search} onChange={(e) => setSearch(e.target.value)} />
              <div className="overflow-y-auto" style={{ maxHeight: 190 }}>
                {filtrados.length === 0 && (
                  <p className="text-xs px-3 py-3" style={{ color: 'var(--text-secondary)' }}>Nenhum grupo com esse nome.</p>
                )}
                {filtrados.slice(0, 100).map((g) => (
                  <button key={g.id} onClick={() => onChange(g.id, g.name)}
                    className="w-full text-left px-3 py-2 text-xs flex items-center justify-between gap-2 hover:bg-[var(--bg-elevated)]"
                    style={{ color: 'var(--text-primary)', borderBottom: '1px solid var(--border)' }}>
                    <span className="truncate">{g.name}</span>
                    {g.size != null && <span className="eyebrow shrink-0" style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{g.size} pessoas</span>}
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {mode === 'number' && (
        <>
          <input style={inputStyle} placeholder="Ex: 5511999999999" inputMode="numeric" value={destination}
            onChange={(e) => onChange(e.target.value.replace(/\D/g, ''), destinationName)} />
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Formato: DDI + DDD + número, só dígitos</p>
        </>
      )}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const FREQ_LABELS: Record<ReportFrequency, string> = {
  DAILY: 'Diário', WEEKLY: 'Semanal', BIWEEKLY: 'Quinzenal', MONTHLY: 'Mensal',
};
const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const pad2 = (n: number) => String(n).padStart(2, '0');

function describeSchedule(s: ReportSchedule): string {
  const h = `${pad2(s.hour)}:00`;
  if (s.frequency === 'DAILY') return `Todo dia às ${h}`;
  if (s.frequency === 'WEEKLY') return `Toda ${DAY_NAMES[s.dayOfWeek ?? 1]} às ${h}`;
  if (s.frequency === 'BIWEEKLY') return `Dias ${s.dayOfMonth} e ${Math.min((s.dayOfMonth ?? 1) + 15, 28)} às ${h}`;
  if (s.frequency === 'MONTHLY') return `Dia ${s.dayOfMonth} de cada mês às ${h}`;
  return h;
}

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

const errMsg = (err: unknown, fallback: string) =>
  (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback;

// WhatsApp: id de grupo termina em @g.us. Telegram: chat de grupo tem id negativo.
function destinationKind(s: Pick<ReportSchedule, 'channelType' | 'destination'>): 'Grupo' | 'Individual' {
  const grupo = s.channelType === 'WHATSAPP' ? s.destination.endsWith('@g.us') : s.destination.startsWith('-');
  return grupo ? 'Grupo' : 'Individual';
}

/** Mesma regra do agendador (`shouldRunNow` em reportScheduler.ts) — se mudar lá, muda aqui. */
function runsOnDay(s: ReportSchedule, d: Date): boolean {
  switch (s.frequency) {
    case 'DAILY': return true;
    case 'WEEKLY': return d.getDay() === (s.dayOfWeek ?? 1);
    case 'BIWEEKLY': {
      const a = s.dayOfMonth ?? 1;
      const b = a + 15 > 28 ? 28 : a + 15;
      return d.getDate() === a || d.getDate() === b;
    }
    case 'MONTHLY': return d.getDate() === (s.dayOfMonth ?? 1);
    default: return false;
  }
}

/** Próximo envio de um agendamento ativo (até 62 dias à frente), pela mesma regra do calendário. */
function nextRun(s: ReportSchedule, now: Date): Date | null {
  if (!s.isActive) return null;
  for (let i = 0; i <= 62; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, s.hour, 0, 0, 0);
    if (d > now && runsOnDay(s, d)) return d;
  }
  return null;
}

function fmtWhen(d: Date, now: Date): string {
  const hoje = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dia = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((dia.getTime() - hoje.getTime()) / 86_400_000);
  const hora = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  if (diff === 0) return `Hoje, ${hora}`;
  if (diff === 1) return `Amanhã, ${hora}`;
  if (diff === -1) return `Ontem, ${hora}`;
  return `${DAY_NAMES[d.getDay()]} ${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}, ${hora}`;
}

// ─── Faixa de números do topo ─────────────────────────────────────────────────

function StatStrip({ schedules }: { schedules: ReportSchedule[] }) {
  const now = new Date();
  const ativos = schedules.filter((s) => s.isActive).length;
  const proximos = schedules
    .map((s) => ({ s, at: nextRun(s, now) }))
    .filter((x): x is { s: ReportSchedule; at: Date } => x.at !== null)
    .sort((a, b) => a.at.getTime() - b.at.getTime());
  const proximo = proximos[0];
  const logs = schedules.flatMap((s) => s.logs.slice(0, 1).map((l) => ({ ...l, name: s.destinationName })))
    .sort((a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime());
  const ultimo = logs[0];
  const falhando = schedules.filter((s) => s.logs[0]?.status === 'FAILED').length;

  const tile = (eyebrow: string, value: React.ReactNode, foot: React.ReactNode, icon: IconName) => (
    <div className="ui-card flex items-start gap-3" style={{ padding: 18 }}>
      <IconTile name={icon} />
      <div className="min-w-0">
        <span className="eyebrow" style={{ color: 'var(--text-secondary)' }}>{eyebrow}</span>
        <div className="ui-big mt-1" style={{ fontSize: 22 }}>{value}</div>
        <div className="text-xs mt-1 truncate" style={{ color: 'var(--text-secondary)' }}>{foot}</div>
      </div>
    </div>
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {tile('AGENDAMENTOS', <>{ativos}<span style={{ color: 'var(--text-secondary)', fontSize: 16 }}> / {schedules.length}</span></>,
        ativos === schedules.length ? 'todos ativos' : `${schedules.length - ativos} pausado${schedules.length - ativos > 1 ? 's' : ''}`, 'list')}
      {tile('PRÓXIMO ENVIO', proximo ? fmtWhen(proximo.at, now) : '—',
        proximo ? proximo.s.destinationName : 'nenhum agendamento ativo', 'clock')}
      {tile('ÚLTIMO ENVIO', ultimo ? fmtWhen(new Date(ultimo.sentAt), now) : '—',
        ultimo
          ? <span className="inline-flex items-center gap-1.5"><StatusDot tone={ultimo.status === 'SUCCESS' ? 'ok' : 'err'} />
              {ultimo.status === 'SUCCESS' ? 'entregue' : 'falhou'} · {ultimo.name}
              {falhando > 0 && ultimo.status === 'SUCCESS' ? ` · ${falhando} com falha` : ''}</span>
          : 'nenhum envio ainda', 'send')}
    </div>
  );
}

// ─── Calendário dos envios ────────────────────────────────────────────────────

const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const MAX_CHIPS_PER_DAY = 3;

function ScheduleCalendar({ schedules }: { schedules: ReportSchedule[] }) {
  const today = new Date();
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));

  // 6 semanas fixas a partir do domingo anterior ao dia 1 — a grade não pula de altura entre meses
  const first = new Date(month.getFullYear(), month.getMonth(), 1 - month.getDay());
  const days = Array.from({ length: 42 }, (_, i) => new Date(first.getFullYear(), first.getMonth(), first.getDate() + i));
  const ordered = [...schedules].sort((a, b) => a.hour - b.hour);
  const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

  return (
    <div className="ui-card">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <p className="text-sm font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
          {MONTH_NAMES[month.getMonth()]} <span style={{ color: 'var(--text-secondary)' }}>{month.getFullYear()}</span>
        </p>
        <div className="ui-seg" role="group" aria-label="Navegar meses">
          <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="Mês anterior">‹</button>
          <button onClick={() => setMonth(new Date(today.getFullYear(), today.getMonth(), 1))}>Hoje</button>
          <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="Próximo mês">›</button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div style={{ minWidth: 640 }}>
          <div className="grid grid-cols-7 mb-1.5">
            {DAY_NAMES.map((d) => (
              <div key={d} className="eyebrow text-center" style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{d.toUpperCase()}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((d) => {
              const inMonth = d.getMonth() === month.getMonth();
              const isToday = sameDay(d, today);
              const events = ordered.filter((s) => runsOnDay(s, d));
              return (
                <div key={d.toISOString()} className="p-1.5 space-y-1"
                  style={{
                    minHeight: 88, borderRadius: 10,
                    backgroundColor: isToday ? 'var(--highlight)' : 'var(--bg-base)',
                    border: `1px solid ${isToday ? 'var(--highlight-border)' : 'var(--border)'}`,
                    opacity: inMonth ? 1 : 0.4,
                  }}>
                  <div className="flex">
                    <span className="eyebrow flex items-center justify-center rounded-md"
                      style={{ minWidth: 22, height: 20, fontSize: 11, ...(isToday ? { backgroundColor: 'var(--accent-fill)', color: 'var(--on-accent)', fontWeight: 700 } : { color: 'var(--text-secondary)' }) }}>
                      {pad2(d.getDate())}
                    </span>
                  </div>
                  {events.slice(0, MAX_CHIPS_PER_DAY).map((s) => {
                    const wa = s.channelType === 'WHATSAPP';
                    const hora = `${pad2(s.hour)}:00`;
                    return (
                      <div key={s.id}
                        title={`${hora} · ${s.destinationName} · ${destinationKind(s)} · ${wa ? 'WhatsApp' : 'Telegram'} · ${FREQ_LABELS[s.frequency]}${s.isActive ? '' : ' · pausado'}`}
                        className="text-[10px] leading-tight px-1.5 py-1 truncate"
                        style={{
                          borderRadius: 6,
                          // Verde/azul do canal não dá contraste de leitura em letra de 10px:
                          // a cor vai na barra lateral e o texto fica na cor de leitura.
                          backgroundColor: 'var(--bg-surface)',
                          borderLeft: `3px solid ${wa ? 'var(--badge-success-text)' : 'var(--accent)'}`,
                          color: 'var(--text-primary)',
                          ...(s.isActive ? {} : { opacity: 0.6, textDecoration: 'line-through' }),
                        }}>
                        <strong style={{ fontFamily: 'var(--font-mono-cx), ui-monospace, monospace' }}>{hora}</strong> {s.destinationName}
                      </div>
                    );
                  })}
                  {events.length > MAX_CHIPS_PER_DAY && (
                    <div className="text-[10px] px-1.5" style={{ color: 'var(--text-secondary)' }}
                      title={events.slice(MAX_CHIPS_PER_DAY).map((s) => `${pad2(s.hour)}:00 ${s.destinationName}`).join('\n')}>
                      +{events.length - MAX_CHIPS_PER_DAY} mais
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4 mt-4 text-[11px] flex-wrap" style={{ color: 'var(--text-secondary)' }}>
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: 'var(--accent)' }} /> Telegram</span>
        <span className="inline-flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: 'var(--badge-success-text)' }} /> WhatsApp</span>
        <span><span style={{ textDecoration: 'line-through' }}>riscado</span> = agendamento pausado</span>
      </div>
    </div>
  );
}

// ─── Editor da mensagem ───────────────────────────────────────────────────────

const TEMPLATE_VAR_RE = /\{([^{}\s]+)\}/g;
const TEMPLATE_MAX = 3000;

// *negrito* e _itálico_ como o WhatsApp mostra — em nós React, sem innerHTML
function WaText({ text }: { text: string }) {
  return (
    <>
      {text.split('\n').map((line, i) => (
        <div key={i} style={{ minHeight: '1.45em' }}>
          {line.split(/(\*[^*\n]+\*|_[^_\n]+_)/g).map((part, j) => {
            if (/^\*[^*]+\*$/.test(part)) return <strong key={j}>{part.slice(1, -1)}</strong>;
            if (/^_[^_]+_$/.test(part)) return <em key={j}>{part.slice(1, -1)}</em>;
            return <span key={j}>{part}</span>;
          })}
        </div>
      ))}
    </>
  );
}

// ─── Editor do texto personalizado: variáveis viram chips com ícone ──────────
//
// O que é salvo continua sendo texto puro com {chave} (backend, validação e prévia não mudaram).
// O editor só desenha cada {chave} conhecida como um chip e devolve o texto ao digitar.

type TemplateVar = { key: string; label: string; value: string };
type VarKind = 'meta' | 'google' | 'money' | 'people' | 'chart' | 'info';

/** Plataforma pela chave (investimento_meta, receita_meta, investimento_google…); o resto, pelo tipo do número. */
function varKind(key: string): VarKind {
  if (/(^|_)meta($|_)/.test(key)) return 'meta';
  if (/(^|_)google($|_)/.test(key)) return 'google';
  if (/investimento|receita|cpl|vendas|ticket|custo/.test(key)) return 'money';
  if (/leads|contatos|oportunidades|conversas/.test(key)) return 'people';
  if (/impress|clique|ctr|conversao|roas|alcance|cpc/.test(key)) return 'chart';
  return 'info';
}

const KIND_ICON: Record<Exclude<VarKind, 'meta' | 'google'>, Exclude<IconName, 'spinner'>> = {
  money: 'wallet', people: 'group', chart: 'pulse', info: 'calendar',
};

// Mesmas marcas da tela de Integrações (o "f" da Meta e o G do Google)
const META_SVG = '<svg width="14" height="14" viewBox="0 0 36 36" aria-hidden="true"><path d="M18 3C9.716 3 3 9.716 3 18s6.716 15 15 15 15-6.716 15-15S26.284 3 18 3z" fill="#1877F2"/><path d="M22.162 11H20.05c-.808 0-1.703.338-2.29 1.157-.547.768-.66 1.703-.66 2.546v1.547H15v2.75h2.1V25h2.9v-6h2.1l.3-2.75h-2.4v-1.375c0-.792.22-1.125.9-1.125h1.262V11z" fill="#fff"/></svg>';
const GOOGLE_SVG = '<svg width="13" height="13" viewBox="0 0 36 36" aria-hidden="true"><path d="M33.12 18.37c0-1.16-.1-2.27-.29-3.34H18v6.32h8.49a7.26 7.26 0 01-3.15 4.76v3.95h5.1c2.99-2.75 4.68-6.8 4.68-11.69z" fill="#4285F4"/><path d="M18 34c4.26 0 7.83-1.41 10.44-3.84l-5.1-3.95c-1.41.95-3.22 1.5-5.34 1.5-4.11 0-7.59-2.77-8.83-6.5H3.9v4.08A15.98 15.98 0 0018 34z" fill="#34A853"/><path d="M9.17 21.21A9.64 9.64 0 018.67 18c0-1.11.19-2.19.5-3.21V10.71H3.9A15.98 15.98 0 002 18c0 2.58.62 5.02 1.9 7.29l5.27-4.08z" fill="#FBBC05"/><path d="M18 8.29c2.32 0 4.4.8 6.04 2.37l4.53-4.53A15.94 15.94 0 0018 2 15.98 15.98 0 003.9 10.71l5.27 4.08C10.41 11.06 13.89 8.29 18 8.29z" fill="#EA4335"/></svg>';

function glyphSvg(key: string): string {
  const k = varKind(key);
  if (k === 'meta') return META_SVG;
  if (k === 'google') return GOOGLE_SVG;
  return `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICON_PATHS[KIND_ICON[k]]}"/></svg>`;
}

/** Cor do chip por origem do número. Texto sempre em cor de leitura (a cor vai no fundo/borda). */
function chipStyle(key: string): string {
  const base = 'display:inline-flex;align-items:center;gap:4px;padding:0 7px 0 5px;margin:0 1px;border-radius:7px;'
    + 'font:600 12px/1.75 var(--font-sans),system-ui,sans-serif;white-space:nowrap;user-select:none;cursor:default;vertical-align:baseline;';
  const k = varKind(key);
  if (k === 'meta') return base + 'background:color-mix(in srgb,#1877F2 13%,transparent);border:1px solid color-mix(in srgb,#1877F2 40%,transparent);color:var(--text-primary);';
  if (k === 'google') return base + 'background:var(--bg-elevated);border:1px solid var(--border-md);color:var(--text-primary);';
  return base + 'background:var(--tint-bg);border:1px solid var(--highlight-border);color:var(--tint-ink);';
}

const VAR_GROUP_LABEL: Record<'geral' | 'meta' | 'google', string> = { geral: 'Geral · Meta + Google', meta: 'Meta Ads', google: 'Google Ads' };
const varGroup = (key: string): 'geral' | 'meta' | 'google' => {
  const k = varKind(key);
  return k === 'meta' || k === 'google' ? k : 'geral';
};
const normTxt = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

function filterVars(vars: TemplateVar[], query: string): TemplateVar[] {
  const q = normTxt(query.trim());
  const list = q
    ? vars.filter((v) => normTxt(v.label).includes(q) || v.key.includes(q.replace(/\s+/g, '_')))
    : vars;
  // Ordem estável por grupo (Geral, Meta, Google); quem começa com o termo vem antes dentro do grupo
  const ordem = { geral: 0, meta: 1, google: 2 } as const;
  return [...list].sort((a, b) => {
    const g = ordem[varGroup(a.key)] - ordem[varGroup(b.key)];
    if (g !== 0) return g;
    if (!q) return 0;
    const sa = normTxt(a.label).startsWith(q) || a.key.startsWith(q) ? 0 : 1;
    const sb = normTxt(b.label).startsWith(q) || b.key.startsWith(q) ? 0 : 1;
    return sa - sb;
  });
}

function VarGlyph({ k }: { k: string }) {
  return <span className="inline-flex shrink-0" dangerouslySetInnerHTML={{ __html: glyphSvg(k) }} />;
}

/** Lista de variáveis agrupada — usada no "/" e no botão "Inserir variável". */
function VarMenu({ items, active, onPick, onHover, header }: {
  items: TemplateVar[]; active: number; onPick: (v: TemplateVar) => void; onHover: (i: number) => void; header?: React.ReactNode;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);
  // Cabeçalho do grupo na primeira variável de cada grupo
  const heads = items.map((v, i) => i === 0 || varGroup(v.key) !== varGroup(items[i - 1]!.key));
  return (
    <div className="flex flex-col" style={{
      width: 300, maxHeight: 320, backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-md)', borderRadius: 14,
      boxShadow: '0 18px 44px rgba(0,0,0,0.28)', overflow: 'hidden',
    }}>
      {header}
      <div ref={listRef} className="overflow-y-auto py-1" role="listbox">
        {items.length === 0 && <p className="text-xs px-3 py-3" style={{ color: 'var(--text-secondary)' }}>Nenhuma variável com esse nome.</p>}
        {items.map((v, i) => {
          const g = varGroup(v.key);
          const showHead = heads[i];
          return (
            <div key={v.key}>
              {showHead && (
                <div className="eyebrow px-3 pt-2.5 pb-1" style={{ color: 'var(--text-secondary)', fontSize: 10.5 }}>{VAR_GROUP_LABEL[g].toUpperCase()}</div>
              )}
              <button type="button" role="option" aria-selected={i === active} data-idx={i}
                onMouseDown={(e) => { e.preventDefault(); onPick(v); }}
                onMouseEnter={() => onHover(i)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-left"
                style={{ backgroundColor: i === active ? 'var(--bg-elevated)' : 'transparent' }}>
                <span className="inline-flex items-center justify-center shrink-0"
                  style={{ width: 24, height: 24, borderRadius: 7, color: 'var(--tint-ink)',
                    backgroundColor: g === 'geral' ? 'var(--tint-bg)' : 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                  <VarGlyph k={v.key} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{v.label}</span>
                  <span className="block eyebrow truncate" style={{ color: 'var(--text-secondary)', fontSize: 10.5 }}>/{v.key}</span>
                </span>
                <span className="eyebrow shrink-0 truncate" style={{ color: 'var(--text-secondary)', fontSize: 10.5, maxWidth: 96 }} title={`hoje: ${v.value}`}>{v.value}</span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function makeChip(key: string, label: string): HTMLSpanElement {
  const s = document.createElement('span');
  s.contentEditable = 'false';
  s.dataset.var = key;
  s.title = `{${key}}`;
  s.style.cssText = chipStyle(key);
  s.innerHTML = glyphSvg(key);
  const t = document.createElement('span');
  t.textContent = label;
  s.appendChild(t);
  return s;
}

/** Texto → nós (chips para variável conhecida, <br> para quebra de linha). */
function textToNodes(text: string, labels: Map<string, string>): Node[] {
  const nodes: Node[] = [];
  text.split('\n').forEach((line, i) => {
    if (i > 0) nodes.push(document.createElement('br'));
    let last = 0;
    for (const m of line.matchAll(TEMPLATE_VAR_RE)) {
      const key = m[1]!;
      const label = labels.get(key);
      if (!label) continue; // variável desconhecida fica como texto (o aviso abaixo do campo aponta)
      if (m.index! > last) nodes.push(document.createTextNode(line.slice(last, m.index)));
      nodes.push(makeChip(key, label));
      last = m.index! + m[0].length;
    }
    if (last < line.length) nodes.push(document.createTextNode(line.slice(last)));
  });
  return nodes;
}

/** Nós → texto com {chave}. O <br data-end> do fim existe só para a última linha vazia aparecer. */
function nodesToText(root: HTMLElement): string {
  let out = '';
  const walk = (n: Node) => {
    // Espaço especial (colado ou do navegador) vira espaço comum no texto salvo
    if (n.nodeType === Node.TEXT_NODE) { out += (n.textContent ?? '').replace(/\u200B/g, '').replace(/\u00A0/g, ' '); return; }
    if (!(n instanceof HTMLElement)) return;
    if (n.dataset.var) { out += `{${n.dataset.var}}`; return; }
    if (n.dataset.end) return;
    if (n.tagName === 'BR') { out += '\n'; return; }
    // Bloco que o navegador cria sozinho (colar, ditado): vira quebra de linha
    if ((n.tagName === 'DIV' || n.tagName === 'P') && out && !out.endsWith('\n')) out += '\n';
    n.childNodes.forEach(walk);
  };
  root.childNodes.forEach(walk);
  return out;
}

function TemplateEditor({ value, onChange, vars, minHeight, maxLength, toolbar }: {
  value: string; onChange: (v: string) => void; vars: TemplateVar[]; minHeight: number; maxLength: number;
  /** Botões extras na barra do campo (ex.: "Usar texto pronto") */
  toolbar?: React.ReactNode;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const lastText = useRef<string | null>(null);
  const savedRange = useRef<Range | null>(null);
  const labels = useMemo(() => new Map(vars.map((v) => [v.key, v.label])), [vars]);
  const labelsKey = vars.map((v) => v.key).join(',');

  // Menu do "/": posição na tela + termo digitado depois da barra
  const [slash, setSlash] = useState<{ x: number; y: number; query: string } | null>(null);
  const [active, setActive] = useState(0);
  // Menu do botão "Inserir variável"
  // Posição fixa na tela: dentro do modal (área com rolagem) o menu seria cortado pelo rodapé
  const [picker, setPicker] = useState<{ x: number; y: number } | null>(null);
  const [pickerQuery, setPickerQuery] = useState('');
  const pickerRef = useRef<HTMLDivElement>(null);

  const ensureEnd = (root: HTMLElement) => {
    root.querySelectorAll('br[data-end]').forEach((b) => { if (b !== root.lastChild) b.remove(); });
    const lc = root.lastChild;
    if (!(lc instanceof HTMLElement && lc.dataset.end)) {
      const br = document.createElement('br');
      br.dataset.end = '1';
      root.appendChild(br);
    }
  };

  // Redesenha só quando o texto mudou por FORA (texto pronto, troca de modo) ou a lista de variáveis chegou;
  // redesenhar a cada tecla jogaria o cursor para o começo.
  const drawnKeys = useRef('');
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (value === lastText.current && drawnKeys.current === labelsKey) return;
    root.replaceChildren(...textToNodes(value, labels));
    ensureEnd(root);
    lastText.current = value;
    drawnKeys.current = labelsKey;
  }, [value, labels, labelsKey]);

  // Guarda onde o cursor estava no campo — o botão "Inserir variável" insere ali
  useEffect(() => {
    const onSel = () => {
      const sel = window.getSelection();
      const root = rootRef.current;
      if (sel && sel.rangeCount && root && root.contains(sel.anchorNode)) savedRange.current = sel.getRangeAt(0).cloneRange();
    };
    document.addEventListener('selectionchange', onSel);
    return () => document.removeEventListener('selectionchange', onSel);
  }, []);

  // Fecha o menu do botão ao clicar fora
  useEffect(() => {
    if (!picker) return;
    const onDown = (e: MouseEvent) => { if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setPicker(null); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [picker]);

  const emit = () => {
    const root = rootRef.current;
    if (!root) return;
    ensureEnd(root);
    const t = nodesToText(root);
    lastText.current = t;
    onChange(t);
  };

  const placeCaretAfter = (node: Node) => {
    const sel = window.getSelection();
    if (!sel) return;
    const r = document.createRange();
    r.setStartAfter(node);
    r.collapse(true);
    sel.removeAllRanges();
    sel.addRange(r);
    savedRange.current = r.cloneRange();
  };

  const insertNodes = (nodes: Node[], range: Range) => {
    if (nodes.length === 0) return;
    range.deleteContents();
    const frag = document.createDocumentFragment();
    nodes.forEach((n) => frag.appendChild(n));
    const last = nodes[nodes.length - 1]!;
    range.insertNode(frag);
    placeCaretAfter(last);
    emit();
  };

  /** Range válido dentro do campo: o último cursor guardado, senão o fim do texto. */
  const workingRange = (): Range => {
    const root = rootRef.current!;
    const r = savedRange.current;
    if (r && root.contains(r.startContainer)) return r;
    const end = document.createRange();
    const lc = root.lastChild;
    if (lc instanceof HTMLElement && lc.dataset.end) end.setStartBefore(lc); else end.selectNodeContents(root);
    end.collapse(lc instanceof HTMLElement && lc.dataset.end ? true : false);
    return end;
  };

  const chipWithSpace = (v: TemplateVar) => [makeChip(v.key, v.label), document.createTextNode(' ')];

  /** Termo depois de uma "/" logo antes do cursor (início de linha, depois de espaço ou parêntese). */
  const readSlash = (): { node: Text; start: number; query: string } | null => {
    const sel = window.getSelection();
    const root = rootRef.current;
    if (!sel || !sel.rangeCount || !sel.isCollapsed || !root) return null;
    const { startContainer: n, startOffset: o } = sel.getRangeAt(0);
    if (n.nodeType !== Node.TEXT_NODE || !root.contains(n)) return null;
    const before = (n.textContent ?? '').slice(0, o);
    const m = before.match(/(^|[\s(\u00A0])\/([\p{L}\p{N}_]{0,30})$/u);
    if (!m) return null;
    return { node: n as Text, start: o - m[2]!.length - 1, query: m[2]! };
  };

  const updateSlash = () => {
    const s = readSlash();
    if (!s) { setSlash(null); return; }
    const sel = window.getSelection()!;
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    const box = rootRef.current!.getBoundingClientRect();
    // Caret em linha vazia não tem retângulo: cai no canto do campo
    const x = rect.left || box.left + 12;
    const y = (rect.bottom || box.top + 28) + 6;
    if (!slash || slash.query !== s.query) setActive(0);
    setSlash({ x: Math.min(x, window.innerWidth - 316), y: Math.min(y, window.innerHeight - 330), query: s.query });
  };

  const slashItems = slash ? filterVars(vars, slash.query) : [];

  const pickFromSlash = (v: TemplateVar) => {
    const s = readSlash();
    setSlash(null);
    if (!s) return;
    const r = document.createRange();
    r.setStart(s.node, s.start);
    r.setEnd(s.node, s.start + 1 + s.query.length);
    insertNodes(chipWithSpace(v), r);
  };

  const pickFromButton = (v: TemplateVar) => {
    setPicker(null);
    setPickerQuery('');
    rootRef.current?.focus();
    insertNodes(chipWithSpace(v), workingRange());
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (slash) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, Math.max(slashItems.length - 1, 0))); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); return; }
      if ((e.key === 'Enter' || e.key === 'Tab') && slashItems[active]) { e.preventDefault(); pickFromSlash(slashItems[active]!); return; }
      // Esc fecha só o menu, não o modal de agendamento
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setSlash(null); return; }
    }
    if (e.key === 'Enter') {
      // Quebra de linha como <br> (sem o <div> que o navegador criaria)
      e.preventDefault();
      const sel = window.getSelection();
      if (sel && sel.rangeCount) insertNodes([document.createElement('br')], sel.getRangeAt(0));
    }
  };

  const onPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    const sel = window.getSelection();
    if (text && sel && sel.rangeCount) insertNodes(textToNodes(text, labels), sel.getRangeAt(0));
  };

  const pickerItems = filterVars(vars, pickerQuery);
  const [pickerActive, setPickerActive] = useState(0);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span style={{ ...labelStyle, marginBottom: 0 }}>Seu texto</span>
        <div className="flex items-center gap-2">
        {toolbar}
        <div className="relative" ref={pickerRef}>
          <button type="button" onClick={(e) => {
              if (picker) { setPicker(null); return; }
              const r = e.currentTarget.getBoundingClientRect();
              const MENU_H = 380; // busca + lista
              const y = r.bottom + 6 + MENU_H > window.innerHeight ? Math.max(8, r.top - 6 - MENU_H) : r.bottom + 6;
              setPicker({ x: Math.max(8, Math.min(r.right - 300, window.innerWidth - 308)), y });
              setPickerQuery(''); setPickerActive(0);
            }}
            disabled={vars.length === 0} className="ui-btn ui-btn-secondary ui-btn-sm" style={{ padding: '5px 11px', fontSize: 12 }}
            aria-expanded={!!picker} aria-haspopup="listbox">
            <Icon name="plus" size={13} /> Inserir variável
          </button>
          {picker && (
            <div className="fixed z-[70]" style={{ left: picker.x, top: picker.y }}>
              <VarMenu items={pickerItems} active={pickerActive} onHover={setPickerActive} onPick={pickFromButton}
                header={
                  <div className="p-2" style={{ borderBottom: '1px solid var(--border)' }}>
                    <input autoFocus value={pickerQuery} placeholder="Buscar variável..."
                      onChange={(e) => { setPickerQuery(e.target.value); setPickerActive(0); }}
                      onKeyDown={(e) => {
                        if (e.key === 'ArrowDown') { e.preventDefault(); setPickerActive((a) => Math.min(a + 1, Math.max(pickerItems.length - 1, 0))); }
                        if (e.key === 'ArrowUp') { e.preventDefault(); setPickerActive((a) => Math.max(a - 1, 0)); }
                        if (e.key === 'Enter' && pickerItems[pickerActive]) { e.preventDefault(); pickFromButton(pickerItems[pickerActive]!); }
                        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setPicker(null); }
                      }}
                      style={{ ...inputStyle, padding: '7px 10px', fontSize: 12.5 }} />
                  </div>
                } />
            </div>
          )}
        </div>
        </div>
      </div>

      <div className="relative">
        {value === '' && (
          <span className="absolute left-3.5 top-2.5 text-[13px] pointer-events-none" style={{ color: 'var(--text-secondary)' }}>
            Escreva a mensagem. Digite / para encaixar um número.
          </span>
        )}
        <div
          ref={rootRef}
          role="textbox"
          aria-multiline="true"
          aria-label="Texto da mensagem"
          contentEditable
          suppressContentEditableWarning
          spellCheck
          onInput={() => { emit(); updateSlash(); }}
          onKeyDown={onKeyDown}
          onKeyUp={(e) => { if (e.key.startsWith('Arrow') || e.key === 'Home' || e.key === 'End') updateSlash(); }}
          onClick={updateSlash}
          onPaste={onPaste}
          onBlur={() => setTimeout(() => setSlash(null), 120)}
          className="outline-none overflow-y-auto"
          style={{
            ...inputStyle, minHeight, maxHeight: minHeight * 2.2, lineHeight: 1.95, fontSize: 13,
            whiteSpace: 'pre-wrap', wordBreak: 'break-word', cursor: 'text',
            borderColor: value.length > maxLength ? 'var(--badge-error-text)' : 'var(--input-border)',
          }}
        />
      </div>

      {slash && (
        <div className="fixed z-[70]" style={{ left: slash.x, top: slash.y }}>
          <VarMenu items={slashItems} active={active} onHover={setActive} onPick={pickFromSlash}
            header={
              <div className="px-3 py-2 eyebrow" style={{ color: 'var(--text-secondary)', fontSize: 10.5, borderBottom: '1px solid var(--border)' }}>
                {slash.query ? <>BUSCANDO <span style={{ color: 'var(--text-primary)' }}>/{slash.query}</span></> : 'ESCOLHA UMA VARIÁVEL'} · ↑↓ ENTER
              </div>
            } />
        </div>
      )}
    </div>
  );
}

function MessageEditor({ frequency, config, onChange, wide = false }: {
  frequency: ReportFrequency;
  config: ReportConfig;
  onChange: (config: ReportConfig) => void;
  wide?: boolean;
}) {
  const [meta, setMeta] = useState<{ preset: string; variables: { key: string; label: string; value: string }[] } | null>(null);
  const [stdPreview, setStdPreview] = useState<string | null>(null);
  // Texto digitado sobrevive à ida e volta entre "padrão" e "personalizado"
  const lastCustom = useRef<string | null>(null);

  const custom = typeof config.template === 'string';
  const template = config.template ?? '';

  useEffect(() => {
    let alive = true;
    apiService.getReportMessageTemplate(frequency)
      .then(({ data }) => { if (alive) setMeta(data); })
      .catch(() => { /* sem as variáveis o modelo padrão continua funcionando */ });
    return () => { alive = false; };
  }, [frequency]);

  // Modelo padrão: quem monta o texto é o backend — prévia com espera curta entre cliques
  const stdKey = custom ? '' : JSON.stringify(config);
  useEffect(() => {
    if (!stdKey) return;
    let alive = true;
    const t = setTimeout(() => {
      apiService.getReportPreviewWithConfig(frequency, JSON.parse(stdKey) as ReportConfig)
        .then(({ data }) => { if (alive) setStdPreview(data.text); })
        .catch(() => { if (alive) setStdPreview('Não foi possível gerar a prévia.'); });
    }, 400);
    return () => { alive = false; clearTimeout(t); };
  }, [stdKey, frequency]);

  const values = new Map((meta?.variables ?? []).map((v) => [v.key, v.value]));
  const unknown = meta
    ? [...new Set([...template.matchAll(TEMPLATE_VAR_RE)].map((m) => m[1]!).filter((k) => !values.has(k)))]
    : [];
  const previewText = custom
    ? template.replace(TEMPLATE_VAR_RE, (whole, key: string) => values.get(key) ?? whole)
    : stdPreview;

  const setMode = (toCustom: boolean) => {
    if (toCustom === custom) return;
    if (toCustom) {
      onChange({ ...config, template: lastCustom.current ?? meta?.preset ?? '' });
    } else {
      lastCustom.current = template;
      const rest = { ...config };
      delete rest.template;
      onChange(rest);
    }
  };

  const usePreset = () => {
    if (!meta) return;
    if (template.trim() && template !== meta.preset && !confirm('Trocar o texto atual pelo texto pronto?')) return;
    onChange({ ...config, template: meta.preset });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span style={{ ...labelStyle, marginBottom: 0 }}>Mensagem do relatório</span>
        <div className="ui-seg" role="group" aria-label="Tipo de mensagem">
          <button aria-pressed={!custom} onClick={() => setMode(false)}>Modelo padrão</button>
          <button aria-pressed={custom} onClick={() => setMode(true)} disabled={!meta && !custom}
            style={!meta && !custom ? { opacity: 0.6, cursor: 'wait' } : undefined}>
            {!meta && !custom ? 'Carregando...' : 'Texto personalizado'}
          </button>
        </div>
      </div>

      <div className={wide ? 'grid grid-cols-1 md:grid-cols-2 gap-5' : 'space-y-4'}>
        <div className="space-y-4 min-w-0">
          {!custom && (
            <>
              <div>
                <span style={labelStyle}>Campos incluídos</span>
                <div className="flex flex-wrap gap-1.5">
                  {CONFIG_FIELD_LABELS.map(({ key, label }) => {
                    const on = !!config[key];
                    return (
                      <button key={key} type="button" aria-pressed={on}
                        onClick={() => onChange({ ...config, [key]: !on })}
                        className={`ui-chip !text-[12px] !px-3 !py-1.5 ${on ? 'ui-chip-on' : ''}`}>
                        {on && <Icon name="check" size={12} />}{label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <span style={labelStyle}>Observações (opcional)</span>
                <textarea
                  style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }}
                  placeholder="Texto extra ao final do relatório..."
                  maxLength={300}
                  value={config.notes ?? ''}
                  onChange={(e) => onChange({ ...config, notes: e.target.value })}
                />
              </div>
            </>
          )}

          {custom && (
            <>
              <div>
                <TemplateEditor
                  toolbar={<button onClick={usePreset} disabled={!meta} className="ui-btn ui-btn-secondary ui-btn-sm" style={{ padding: '5px 11px', fontSize: 12 }}>Usar texto pronto</button>}
                  value={template}
                  onChange={(t) => onChange({ ...config, template: t })}
                  vars={meta?.variables ?? []}
                  minHeight={wide ? 240 : 170}
                  maxLength={TEMPLATE_MAX}
                />
                <div className="flex items-center justify-between mt-1.5">
                  <span className="eyebrow" style={{ color: 'var(--text-secondary)', fontSize: 11 }}>/ VARIÁVEL · *NEGRITO* · _ITÁLICO_</span>
                  <span className="eyebrow" style={{ color: template.length > TEMPLATE_MAX * 0.9 ? 'var(--badge-warn-text)' : 'var(--text-secondary)', fontSize: 11 }}>{template.length} / {TEMPLATE_MAX}</span>
                </div>
              </div>

              {unknown.length > 0 && (
                <p className="text-xs" style={{ color: 'var(--badge-error-text)' }}>
                  Variável que não existe: {unknown.map((u) => `{${u}}`).join(', ')}. Apague e insira pelo botão ou digitando /.
                </p>
              )}
              {custom && !template.trim() && (
                <p className="text-xs inline-flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}><StatusDot tone="warn" /> O texto está vazio.</p>
              )}

            </>
          )}
        </div>

        <div className="min-w-0">
          <span style={labelStyle}>Prévia com os números de hoje</span>
          <div className="ui-inset p-3">
            <div className="flex items-center gap-2 mb-2.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--badge-success-text)' }} />
              <span className="eyebrow" style={{ color: 'var(--text-secondary)', fontSize: 11 }}>COMO CHEGA NO GRUPO</span>
            </div>
            <div className="px-3.5 py-2.5 text-xs overflow-y-auto"
              style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-primary)', lineHeight: 1.5, maxHeight: wide ? 380 : 240, wordBreak: 'break-word', borderRadius: 14, borderTopLeftRadius: 4 }}>
              {previewText === null
                ? <span className="inline-flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}><Icon name="spinner" size={12} /> Gerando prévia...</span>
                : previewText.trim()
                  ? <WaText text={previewText} />
                  : <span style={{ color: 'var(--text-secondary)' }}>A mensagem aparece aqui.</span>}
            </div>
          </div>
          <p className="text-[11px] mt-1.5" style={{ color: 'var(--text-secondary)' }}>
            Os números são recalculados a cada envio. “—” aparece quando a empresa não tem aquele dado.
          </p>
        </div>
      </div>
    </div>
  );
}

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
    if (phase !== 'loading') return;
    apiService.createTelegramInvite()
      .then(({ data }) => { setToken(data.token); setDeepLink(data.deepLink); setPhase('ready'); })
      .catch(() => setPhase('error'));
  }, [phase]);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

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
    <Modal title="Conectar Telegram" onClose={onClose} width={400} z={60}>
      <div className="text-center space-y-4">
        {phase === 'loading' && (
          <div className="py-10 flex flex-col items-center gap-3" style={{ color: 'var(--text-secondary)' }}>
            <Icon name="spinner" size={22} />
            <p className="text-xs">Gerando link seguro...</p>
          </div>
        )}

        {phase === 'ready' && (
          <>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Escaneie o QR Code com o Telegram para conectar este chat ao agendamento.
            </p>
            <div className="flex justify-center py-1">
              <div className="p-3" style={{ backgroundColor: '#fff', borderRadius: 14 }}>
                <QRCodeSVG value={deepLink} size={180} />
              </div>
            </div>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Ou abra o link direto no Telegram:</p>
            <a href={deepLink} target="_blank" rel="noreferrer"
              className="block text-xs truncate px-3 py-2.5 eyebrow"
              style={{ borderRadius: 10, backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-md)' }}>
              {deepLink}
            </a>
            <p className="eyebrow inline-flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
              <StatusDot tone="warn" /> AGUARDANDO CONEXÃO · EXPIRA EM 24H
            </p>
          </>
        )}

        {phase === 'connected' && (
          <div className="py-8 flex flex-col items-center gap-3">
            <IconTile name="check" tone="wa" size={48} />
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Conectado com sucesso</p>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Fechando automaticamente...</p>
          </div>
        )}

        {phase === 'error' && (
          <div className="py-8 flex flex-col items-center gap-3">
            <p className="text-sm" style={{ color: 'var(--badge-error-text)' }}>Link expirado ou inválido.</p>
            <button onClick={() => setPhase('loading')} className="ui-btn ui-btn-primary ui-btn-sm">Gerar novo link</button>
          </div>
        )}
      </div>
    </Modal>
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
  const [reportConfig, setReportConfig] = useState<ReportConfig>({ ...DEFAULT_REPORT_CONFIG });

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
    } catch (err) { setError(errMsg(err, 'Erro ao criar agendamento')); } finally { setLoading(false); }
  };

  const step = (n: string, title: string) => (
    <div className="flex items-center gap-2 mb-3">
      <span className="eyebrow" style={{ color: 'var(--accent)' }}>{n}</span>
      <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{title}</span>
    </div>
  );

  const channelOption = (c: ChannelType) => {
    const on = channel === c;
    const tg = c === 'TELEGRAM';
    return (
      <button key={c} type="button" aria-pressed={on}
        onClick={() => { if (!on) { setChannel(c); setDestination(''); setDestinationName(''); } }}
        className="flex-1 flex items-center gap-3 p-3 text-left transition-colors"
        style={{
          borderRadius: 14,
          backgroundColor: on ? 'var(--highlight)' : 'var(--bg-base)',
          border: `1px solid ${on ? 'var(--highlight-border)' : 'var(--border)'}`,
          boxShadow: on ? 'inset 0 0 0 1px var(--accent-line)' : 'none',
        }}>
        <IconTile name={tg ? 'telegram' : 'whatsapp'} tone={tg ? 'tg' : 'wa'} size={32} />
        <span className="min-w-0">
          <span className="block text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{tg ? 'Telegram' : 'WhatsApp'}</span>
          <span className="block text-[11px]" style={{ color: 'var(--text-secondary)' }}>{tg ? 'Bot no grupo' : 'Número da empresa'}</span>
        </span>
        {on && <span className="ml-auto" style={{ color: 'var(--accent)' }}><Icon name="check" size={16} /></span>}
      </button>
    );
  };

  return (
    <Modal title="Novo agendamento" sub="Relatório automático com os números do período" onClose={onClose} width={620}
      footer={<>
        <button onClick={onClose} className="ui-btn ui-btn-secondary ui-btn-sm flex-1">Cancelar</button>
        <button onClick={handleSubmit} disabled={loading} className="ui-btn ui-btn-primary ui-btn-sm flex-1">
          {loading ? <><Icon name="spinner" size={14} /> Criando...</> : 'Criar agendamento'}
        </button>
      </>}>
      <div className="space-y-6">
        <section>
          {step('01', 'Para onde vai')}
          <div className="flex gap-2 mb-4">{(['TELEGRAM', 'WHATSAPP'] as ChannelType[]).map(channelOption)}</div>

          {channel === 'TELEGRAM' && (
            <div className="space-y-2">
              <span style={labelStyle}>Chat ou grupo do Telegram</span>
              {destination ? (
                <div className="flex items-center gap-3 px-3 py-2.5" style={{ borderRadius: 12, backgroundColor: 'var(--highlight)', border: '1px solid var(--highlight-border)' }}>
                  <IconTile name="check" tone="lime" size={28} />
                  <span className="text-xs flex-1 min-w-0 truncate" style={{ color: 'var(--text-primary)' }}>
                    <strong>{destinationName}</strong> <span className="eyebrow" style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{destination}</span>
                  </span>
                  <button onClick={() => { setDestination(''); setDestinationName(''); }} className="ui-btn ui-btn-secondary ui-btn-sm" style={{ padding: '5px 10px', fontSize: 12 }}>Trocar</button>
                </div>
              ) : (
                <button onClick={() => setShowQR(true)}
                  className="w-full flex items-center justify-center gap-2 py-4 text-xs font-semibold"
                  style={{ borderRadius: 12, backgroundColor: 'var(--highlight)', color: 'var(--accent)', border: '1px dashed var(--accent-line)' }}>
                  <Icon name="qr" size={15} /> Conectar via QR Code
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

          {channel === 'WHATSAPP' && (
            <WhatsappDestination
              destination={destination}
              destinationName={destinationName}
              onChange={(d, n) => { setDestination(d); setDestinationName(n); }}
            />
          )}

          {/* Nome do destino — só quando não vem automático: Telegram ainda sem chat, ou WhatsApp para número avulso */}
          {(channel === 'TELEGRAM' ? !destination : destination !== '' && !destination.endsWith('@g.us')) && (
            <div className="mt-3">
              <span style={labelStyle}>Nome do destino</span>
              <input style={inputStyle} placeholder="Ex: Grupo Relatórios Galpão" value={destinationName} onChange={e => setDestinationName(e.target.value)} />
            </div>
          )}
        </section>

        <section>
          {step('02', 'Quando')}
          <div className="ui-seg w-full mb-3" role="group" aria-label="Frequência" style={{ display: 'flex' }}>
            {(Object.entries(FREQ_LABELS) as [ReportFrequency, string][]).map(([k, v]) => (
              <button key={k} aria-pressed={frequency === k} onClick={() => setFrequency(k)} style={{ flex: 1 }}>{v}</button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span style={labelStyle}>Horário</span>
              <select style={{ ...inputStyle, cursor: 'pointer' }} value={hour} onChange={e => setHour(Number(e.target.value))}>
                {HOURS.map(h => <option key={h} value={h}>{pad2(h)}:00</option>)}
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
        </section>

        <section>
          {step('03', 'O que vai na mensagem')}
          <MessageEditor frequency={frequency} config={reportConfig} onChange={setReportConfig} />
        </section>

        {error && <p className="text-xs" style={{ color: 'var(--badge-error-text)' }}>{error}</p>}
      </div>
    </Modal>
  );
}

// ─── Modal da mensagem (para agendamentos existentes) ──────────────────────────

function ReportConfigModal({ schedule, onClose, onSaved }: {
  schedule: ReportSchedule;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [config, setConfig] = useState<ReportConfig>({ ...DEFAULT_REPORT_CONFIG, ...schedule.reportConfig });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      await apiService.updateReportSchedule(schedule.id, { reportConfig: config });
      onSaved();
      onClose();
    } catch (err) { setError(errMsg(err, 'Erro ao salvar')); } finally { setSaving(false); }
  };

  return (
    <Modal title="Mensagem do relatório" width={880}
      sub={`${schedule.destinationName} · ${destinationKind(schedule)} · ${FREQ_LABELS[schedule.frequency]}`}
      onClose={onClose}
      footer={<>
        <button onClick={onClose} className="ui-btn ui-btn-secondary ui-btn-sm flex-1">Cancelar</button>
        <button onClick={handleSave} disabled={saving} className="ui-btn ui-btn-primary ui-btn-sm flex-1">{saving ? 'Salvando...' : 'Salvar mensagem'}</button>
      </>}>
      <MessageEditor frequency={schedule.frequency} config={config} onChange={setConfig} wide />
      {error && <p className="text-xs mt-3" style={{ color: 'var(--badge-error-text)' }}>{error}</p>}
    </Modal>
  );
}

// ─── Card de agendamento ───────────────────────────────────────────────────────

function ScheduleCard({ schedule, onToggle, onDelete, onSendNow, onRefresh }: {
  schedule: ReportSchedule;
  onToggle: () => void;
  onDelete: () => void;
  onSendNow: () => Promise<void>;
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

  const handleDelete = () => {
    if (!confirm(`Remover o agendamento de "${schedule.destinationName}"?`)) return;
    onDelete();
  };

  const lastLog = schedule.logs[0];
  const wa = schedule.channelType === 'WHATSAPP';
  const kind = destinationKind(schedule);
  const custom = typeof schedule.reportConfig?.template === 'string';

  return (
    <div className="ui-card flex flex-col gap-4 transition-opacity" style={{ padding: 18, opacity: schedule.isActive ? 1 : 0.72 }}>
      <div className="flex items-start gap-3">
        <IconTile name={wa ? 'whatsapp' : 'telegram'} tone={wa ? 'wa' : 'tg'} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>{schedule.destinationName}</p>
          <p className="text-xs truncate inline-flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
            <Icon name={kind === 'Grupo' ? 'group' : 'user'} size={12} />
            {kind} · {wa ? 'WhatsApp' : 'Telegram'}
            {wa && kind === 'Individual' ? ` · ${schedule.destination}` : ''}
          </p>
        </div>
        <button type="button" role="switch" aria-checked={schedule.isActive} aria-label="Agendamento ativo" onClick={onToggle} className="ui-switch" />
      </div>

      <div className="ui-inset px-3 py-2.5 flex items-center gap-2.5">
        <span style={{ color: 'var(--text-secondary)' }}><Icon name="calendar" size={14} /></span>
        <span className="text-xs font-semibold flex-1 min-w-0 truncate" style={{ color: 'var(--text-primary)' }}>{describeSchedule(schedule)}</span>
        <span className="ui-badge ui-badge-tint">{FREQ_LABELS[schedule.frequency].toUpperCase()}</span>
      </div>

      <div className="flex items-center justify-between gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
        <span className="inline-flex items-center gap-1.5 min-w-0 truncate"
          title={lastLog?.status === 'FAILED' && lastLog.error ? lastLog.error : undefined}>
          <StatusDot tone={!lastLog ? 'idle' : lastLog.status === 'SUCCESS' ? 'ok' : 'err'} />
          {!lastLog ? 'Ainda não enviou'
            : `${lastLog.status === 'SUCCESS' ? 'Enviado' : 'Falhou'} ${fmtWhen(new Date(lastLog.sentAt), new Date()).toLowerCase()}`}
        </span>
        <span className="eyebrow shrink-0" style={{ color: 'var(--text-secondary)', fontSize: 11 }}>{custom ? 'TEXTO PRÓPRIO' : 'MODELO PADRÃO'}</span>
      </div>

      <div className="flex gap-2 mt-auto">
        <button onClick={handleSend} disabled={sending} className="ui-btn ui-btn-tint ui-btn-sm flex-1"
          style={sendResult === 'err' ? { background: 'var(--badge-error-bg)', color: 'var(--badge-error-text)' } : undefined}>
          {sending ? <Icon name="spinner" size={14} /> : sendResult === 'ok' ? <Icon name="check" size={14} /> : <Icon name="send" size={14} />}
          {sending ? 'Enviando...' : sendResult === 'ok' ? 'Enviado' : sendResult === 'err' ? 'Erro ao enviar' : 'Enviar agora'}
        </button>
        <button onClick={() => setShowConfig(true)} className="ui-btn ui-btn-secondary ui-btn-sm" title="Editar a mensagem">
          <Icon name="edit" size={14} /> Mensagem
        </button>
        <button onClick={handleDelete} className="ui-btn ui-btn-danger ui-btn-sm" aria-label="Remover agendamento" title="Remover">
          <Icon name="trash" size={14} />
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

type RuleField = { key: string; label: string; unit: 'R$' | 'horas' | '%'; min: number; max: number; step: number };

const RULE_META: Record<AnomalyRuleId, { label: string; description: string; icon: IconName; fields: RuleField[] }> = {
  SPEND_NO_LEADS: {
    label: 'Gasto sem leads',
    description: 'Investiu no dia e não chegou nenhum lead',
    icon: 'wallet',
    fields: [{ key: 'minSpend', label: 'A partir de', unit: 'R$', min: 1, max: 10000, step: 10 }],
  },
  LEAD_SILENCE: {
    label: 'Silêncio de leads',
    description: 'Nenhum lead novo com campanha rodando',
    icon: 'moon',
    fields: [
      { key: 'hoursWindow', label: 'Sem lead por', unit: 'horas', min: 12, max: 168, step: 12 },
      { key: 'minSpend7d',  label: 'Gasto mínimo em 7 dias', unit: 'R$', min: 1, max: 10000, step: 10 },
    ],
  },
  BUDGET_LOW: {
    label: 'Saldo baixo',
    description: 'Avisa antes de a conta de anúncios ficar sem saldo, com o saldo atual na mensagem',
    icon: 'pulse',
    fields: [], // campos próprios (Meta + Google com modo % ou R$) — ver BudgetFields
  },
  CRM_UNANSWERED: {
    label: 'WhatsApp sem resposta',
    description: 'Cliente do CRM esperando resposta há muitas horas',
    icon: 'chat',
    fields: [{ key: 'hoursUnanswered', label: 'Esperando há', unit: 'horas', min: 1, max: 168, step: 1 }],
  },
  CRM_FOLLOWUP_DIGEST: {
    label: 'Resumo de follow-ups',
    description: 'Seg a sex, 9h: follow-ups vencidos e os de hoje',
    icon: 'list',
    fields: [],
  },
};

const RULES_ANUNCIOS: AnomalyRuleId[] = ['SPEND_NO_LEADS', 'LEAD_SILENCE', 'BUDGET_LOW'];
const RULES_CRM: AnomalyRuleId[] = ['CRM_UNANSWERED', 'CRM_FOLLOWUP_DIGEST'];
const ALL_RULES: AnomalyRuleId[] = [...RULES_ANUNCIOS, ...RULES_CRM];
// As únicas que não dependem de anúncio — no plano CRM as outras aparecem com cadeado
// (o backend também só roda estas para o plano CRM).
const REGRAS_DO_CRM: AnomalyRuleId[] = RULES_CRM;

// Defaults espelhando o backend — usados quando a regra ainda não tem config salva no banco
const RULE_DEFAULTS: Record<AnomalyRuleId, Record<string, number>> = {
  SPEND_NO_LEADS: { minSpend: 50 },
  LEAD_SILENCE:   { hoursWindow: 48, minSpend7d: 50 },
  BUDGET_LOW:     { budgetMinBalance: 200, budgetPctThreshold: 80, googleUseBalance: 0, googleMinBalance: 200 },
  CRM_UNANSWERED: { hoursUnanswered: 12 },
  CRM_FOLLOWUP_DIGEST: {},
};

/** Campo numérico com a unidade grudada (R$ antes, % e horas depois). */
function NumField({ field, value, onChange, disabled }: { field: RuleField; value: number; onChange: (v: number) => void; disabled?: boolean }) {
  const prefix = field.unit === 'R$';
  return (
    <label className="flex flex-col gap-1.5 min-w-0" style={{ flex: '1 1 150px' }}>
      <span className="text-[11px] font-semibold" style={{ color: 'var(--text-secondary)' }}>{field.label}</span>
      <span className="flex items-center gap-1.5 px-3"
        style={{ height: 38, borderRadius: 10, backgroundColor: 'var(--input-bg)', border: '1px solid var(--input-border)', opacity: disabled ? 0.5 : 1 }}>
        {prefix && <span className="eyebrow" style={{ color: 'var(--text-secondary)', fontSize: 12 }}>R$</span>}
        <input type="number" min={field.min} max={field.max} step={field.step} disabled={disabled}
          className="flex-1 min-w-0 bg-transparent outline-none text-sm font-semibold"
          style={{ color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}
          value={value} onChange={(e) => onChange(Number(e.target.value))} />
        {!prefix && <span className="eyebrow" style={{ color: 'var(--text-secondary)', fontSize: 12 }}>{field.unit === '%' ? '%' : 'h'}</span>}
      </span>
    </label>
  );
}

function BudgetFields({ values, onChange, disabled }: { values: Record<string, number>; onChange: (key: string, v: number) => void; disabled?: boolean }) {
  const useBalance = values.googleUseBalance === 1;
  return (
    <div className="space-y-3">
      <div className="ui-inset p-3 space-y-2">
        <span className="eyebrow" style={{ color: 'var(--text-secondary)', fontSize: 11 }}>META ADS</span>
        <NumField disabled={disabled} field={{ key: 'budgetMinBalance', label: 'Avisar com saldo abaixo de', unit: 'R$', min: 50, max: 50000, step: 50 }}
          value={values.budgetMinBalance ?? 200} onChange={(v) => onChange('budgetMinBalance', v)} />
      </div>
      <div className="ui-inset p-3 space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="eyebrow" style={{ color: 'var(--text-secondary)', fontSize: 11 }}>GOOGLE ADS</span>
          <div className="ui-seg" role="group" aria-label="Como medir o Google" style={{ padding: 3 }}>
            <button aria-pressed={useBalance} disabled={disabled} onClick={() => onChange('googleUseBalance', 1)} style={{ padding: '5px 10px', fontSize: 12 }}>Saldo em R$</button>
            <button aria-pressed={!useBalance} disabled={disabled} onClick={() => onChange('googleUseBalance', 0)} style={{ padding: '5px 10px', fontSize: 12 }}>% do orçamento diário</button>
          </div>
        </div>
        {useBalance ? (
          <>
            <NumField disabled={disabled} field={{ key: 'googleMinBalance', label: 'Avisar com saldo abaixo de', unit: 'R$', min: 50, max: 50000, step: 50 }}
              value={values.googleMinBalance ?? 200} onChange={(v) => onChange('googleMinBalance', v)} />
            <p className="text-[11px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Só existe saldo em conta Google <strong style={{ color: 'var(--text-primary)' }}>pré-paga ou com faturamento mensal</strong>.
              Conta paga no cartão não tem saldo para vigiar: nesse caso use o modo %.
            </p>
          </>
        ) : (
          <NumField disabled={disabled} field={{ key: 'budgetPctThreshold', label: 'Avisar quando a campanha gastar', unit: '%', min: 50, max: 99, step: 5 }}
            value={values.budgetPctThreshold ?? 80} onChange={(v) => onChange('budgetPctThreshold', v)} />
        )}
      </div>
    </div>
  );
}

function AlertConfigSection() {
  const { temGrowth } = usePlano();
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
      if (next.has(rule)) next.delete(rule); else next.add(rule);
      return next;
    });
  };

  const setThresholdField = (rule: AnomalyRuleId, key: string, value: number) => {
    setThresholds(prev => {
      if (!prev) return prev;
      return { ...prev, [rule]: { ...(prev[rule] as Record<string, number>), [key]: value } };
    });
  };

  // Só habilita "Salvar" quando algo mudou em relação ao que veio do servidor
  const dirty = useMemo(() => {
    if (!config || !thresholds) return false;
    const sorted = (rules: Iterable<string>) => [...rules].filter((r) => ALL_RULES.includes(r as AnomalyRuleId)).sort().join(',');
    return sorted(enabled) !== sorted(config.enabledRules) || JSON.stringify(thresholds) !== JSON.stringify(config.thresholds);
  }, [config, thresholds, enabled]);

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

  // No plano CRM só as regras do CRM contam: as de anúncio não rodam, mesmo ligadas no banco.
  const disponiveis = temGrowth ? ALL_RULES : REGRAS_DO_CRM;
  const ativas = disponiveis.filter((r) => enabled.has(r)).length;

  const header = (
    <SectionHead eyebrow="ALERTAS" title="Alertas de anomalia"
      sub="Verificado de segunda a sexta, às 9h. O alerta vai para todos os agendamentos ativos acima, no Telegram e no WhatsApp."
      right={config ? (
        <div className="flex items-center gap-2">
          <span className="ui-chip">{ativas === 0 ? 'nenhuma ativa' : `${ativas} de ${disponiveis.length} ativas`}</span>
          {dirty && <span className="ui-chip" style={{ color: 'var(--text-primary)' }}><StatusDot tone="warn" /> não salvo</span>}
          <button onClick={handleSave} disabled={saving || !thresholds || (!dirty && !saved)} className="ui-btn ui-btn-primary ui-btn-sm">
            {saving ? <><Icon name="spinner" size={14} /> Salvando...</> : saved ? <><Icon name="check" size={14} /> Salvo</> : 'Salvar alertas'}
          </button>
        </div>
      ) : undefined} />
  );

  if (loading) return (
    <section>
      {header}
      <div className="ui-card flex items-center gap-2" style={{ color: 'var(--text-secondary)' }}>
        <Icon name="spinner" size={14} /> <span className="text-xs">Carregando alertas...</span>
      </div>
    </section>
  );

  const renderRule = (rule: AnomalyRuleId) => {
    const meta = RULE_META[rule];
    const travada = !temGrowth && !REGRAS_DO_CRM.includes(rule);
    const isOn = enabled.has(rule) && !travada;
    const values = { ...RULE_DEFAULTS[rule], ...((thresholds?.[rule] as Record<string, number> | undefined) ?? {}) };
    const temCampos = rule === 'BUDGET_LOW' || meta.fields.length > 0;
    return (
      <div key={rule} className={`ui-card flex flex-col gap-4 transition-colors ${isOn ? 'ui-card-hl' : ''}`} style={{ padding: 18 }}>
        <div className="flex items-start gap-3">
          <IconTile name={meta.icon} tone={isOn ? 'lime' : 'neutral'} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{meta.label}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{meta.description}</p>
          </div>
          {travada ? (
            <span className="ui-chip shrink-0"><IconeCadeado className="h-3 w-3" /> Growth + CRM</span>
          ) : (
            <button type="button" role="switch" aria-checked={isOn} aria-label={`${meta.label} ativo`} onClick={() => toggleRule(rule)} className="ui-switch" />
          )}
        </div>
        {temCampos && thresholds && !travada && (
          <div style={isOn ? undefined : { opacity: 0.55 }}>
            {rule === 'BUDGET_LOW' ? (
              <BudgetFields values={values} disabled={!isOn} onChange={(k, v) => setThresholdField(rule, k, v)} />
            ) : (
              <div className="flex flex-wrap gap-3">
                {meta.fields.map((field) => (
                  <NumField key={field.key} field={field} disabled={!isOn} value={values[field.key] ?? 0}
                    onChange={(v) => setThresholdField(rule, field.key, v)} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const group = (eyebrow: string, rules: AnomalyRuleId[]) => (
    <div className="space-y-2.5">
      <span className="eyebrow" style={{ color: 'var(--text-secondary)' }}>{eyebrow}</span>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">{rules.map(renderRule)}</div>
    </div>
  );

  return (
    <section>
      {header}
      {error && <p className="text-xs mb-3" style={{ color: 'var(--badge-error-text)' }}>{error}</p>}
      <div className="space-y-5">
        {group('ANÚNCIOS', RULES_ANUNCIOS)}
        {group('CRM', RULES_CRM)}
      </div>
    </section>
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

  const showToast = useCallback((msg: string, ok = true) => { setToast({ msg, ok }); setTimeout(() => setToast(null), 4000); }, []);

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
    <div className="space-y-8">

      {/* Banner gestor */}
      {isGestorContext && (
        <div className="ui-card ui-card-hl flex items-center justify-between gap-3" style={{ padding: '12px 16px' }}>
          <p className="text-xs" style={{ color: 'var(--text-primary)' }}>
            Gerenciando relatórios de <strong>{organization?.name}</strong>
          </p>
          <button onClick={() => { apiService.setSelectedClientOrgId(''); router.push('/dashboard/gestor'); }}
            className="ui-btn ui-btn-secondary ui-btn-sm">
            Voltar ao Gestor
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="eyebrow">RELATÓRIOS · ENVIO AUTOMÁTICO</span>
          <h1 className="ui-h1 mt-2">Relatórios automáticos</h1>
          <p className="ui-sub">
            {organization?.name ? `${organization.name} · ` : ''}os números do período chegam sozinhos no grupo, pelo Telegram ou pelo WhatsApp.
          </p>
        </div>
        <button onClick={() => setShowCreate(true)} className="ui-btn ui-btn-primary">
          <Icon name="plus" size={16} /> Novo agendamento
        </button>
      </div>

      {!loading && schedules.length > 0 && <StatStrip schedules={schedules} />}

      {/* Canais */}
      <section>
        <SectionHead eyebrow="CANAIS" title="Por onde os relatórios saem" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <TelegramChannelCard showToast={showToast} />
          <WhatsappChannelCard showToast={showToast} refreshSignal={showCreate} />
        </div>
      </section>

      {/* Agendamentos */}
      <section>
        <SectionHead eyebrow="AGENDAMENTOS" title="O que está programado"
          sub={schedules.length > 0 ? `${schedules.length} agendamento${schedules.length > 1 ? 's' : ''}` : undefined} />
        {loading ? (
          <div className="ui-card flex items-center justify-center gap-2 py-16" style={{ color: 'var(--text-secondary)' }}>
            <Icon name="spinner" size={18} /> <span className="text-sm">Carregando agendamentos...</span>
          </div>
        ) : schedules.length === 0 ? (
          <div className="ui-card flex flex-col items-center justify-center text-center py-14"
            style={{ backgroundImage: 'radial-gradient(circle at 50% 0%, var(--highlight), transparent 60%)' }}>
            <IconTile name="calendar" tone="lime" size={52} />
            <p className="text-base font-bold mt-4" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>Nenhum agendamento ainda</p>
            <p className="text-xs mt-1 mb-5 max-w-sm" style={{ color: 'var(--text-secondary)' }}>
              Escolha o grupo, o dia e o horário. O relatório com os números do período sai sozinho, sem ninguém precisar montar.
            </p>
            <button onClick={() => setShowCreate(true)} className="ui-btn ui-btn-primary ui-btn-sm">
              <Icon name="plus" size={14} /> Criar primeiro agendamento
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
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
      </section>

      {!loading && schedules.length > 0 && (
        <section>
          <SectionHead eyebrow="CALENDÁRIO" title="Quando cada envio acontece" />
          <ScheduleCalendar schedules={schedules} />
        </section>
      )}

      {showCreate && <CreateModal onClose={() => setShowCreate(false)} onCreated={fetchSchedules} />}

      {/* Alertas de Anomalia */}
      <AlertConfigSection />

      {/* Toast */}
      {toast && (
        <div role="status" className="fixed bottom-6 right-6 z-50 px-4 py-3 text-sm font-semibold inline-flex items-center gap-2.5"
          style={{ borderRadius: 12, backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)', border: '1px solid var(--border-md)', boxShadow: '0 12px 32px rgba(0,0,0,0.3)' }}>
          <StatusDot tone={toast.ok ? 'ok' : 'err'} />
          {toast.msg}
        </div>
      )}
    </div>
  );
}
