'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { apiService } from '@/lib/api';
import { UserRole, type TrafficManagerClient } from '@/types';
import ClientReportsModal from '@/components/ClientReportsModal';
import GestorStatsCard from '@/components/GestorStatsCard';
import { QRCodeSVG } from 'qrcode.react';

const PLAN_LABELS: Record<string, string> = { STARTER: 'Starter', PROFESSIONAL: 'Pro', ENTERPRISE: 'Enterprise' };
const PLAN_COLORS: Record<string, string> = { STARTER: '#64748b', PROFESSIONAL: '#3b82f6', ENTERPRISE: '#a855f7' };

function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function formatDate(d: string) {
  return new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const card = { backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' };

export default function GestorPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [invite, setInvite] = useState<{ code: string; expiresAt: string } | null>(null);
  const [loadingInvite, setLoadingInvite] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const [clients, setClients] = useState<TrafficManagerClient[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [reportClient, setReportClient] = useState<TrafficManagerClient | null>(null);

  const [briefing, setBriefing] = useState({ enabled: false, chatId: '', chatName: '', hour: 7 });
  const [loadingBriefing, setLoadingBriefing] = useState(true);
  const [savingBriefing, setSavingBriefing] = useState(false);
  const [testingBriefing, setTestingBriefing] = useState(false);
  const [telegramPhase, setTelegramPhase] = useState<'idle' | 'connecting' | 'connected'>('idle');
  const [briefingDeepLink, setBriefingDeepLink] = useState('');
  const briefingPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchInvite = useCallback(async () => {
    setLoadingInvite(true);
    try {
      const res = await apiService.getMyInvite();
      setInvite(res.data);
    } catch {
      showToast('Erro ao carregar código de convite.', 'error');
    } finally {
      setLoadingInvite(false);
    }
  }, []);

  const fetchClients = useCallback(async () => {
    setLoadingClients(true);
    try {
      const res = await apiService.getMyClients();
      setClients(res.data);
    } catch {
      /* mantém vazio */
    } finally {
      setLoadingClients(false);
    }
  }, []);

  const fetchBriefingConfig = useCallback(async () => {
    setLoadingBriefing(true);
    try {
      const res = await apiService.getBriefingConfig();
      setBriefing(res.data);
      setTelegramPhase(res.data.chatId ? 'connected' : 'idle');
    } catch {
      /* mantém default */
    } finally {
      setLoadingBriefing(false);
    }
  }, []);

  useEffect(() => {
    if (user?.role !== UserRole.TRAFFIC_MANAGER) {
      router.replace('/dashboard');
      return;
    }
    void fetchInvite();
    void fetchClients();
    void fetchBriefingConfig();
  }, [user, router, fetchInvite, fetchClients, fetchBriefingConfig]);

  const handleSaveBriefing = async () => {
    setSavingBriefing(true);
    try {
      await apiService.saveBriefingConfig({ enabled: briefing.enabled, hour: briefing.hour });
      showToast('Configuração de briefing salva!');
    } catch {
      showToast('Erro ao salvar configuração.', 'error');
    } finally {
      setSavingBriefing(false);
    }
  };

  const handleTestBriefing = async () => {
    if (telegramPhase !== 'connected') {
      showToast('Conecte o Telegram antes de testar.', 'error');
      return;
    }
    setTestingBriefing(true);
    try {
      await apiService.testBriefing();
      showToast('Briefing de teste enviado! Verifique seu Telegram.');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      showToast(msg ?? 'Erro ao enviar briefing de teste.', 'error');
    } finally {
      setTestingBriefing(false);
    }
  };

  const handleConnectTelegram = async () => {
    setTelegramPhase('connecting');
    try {
      const res = await apiService.generateBriefingInvite();
      setBriefingDeepLink(res.data.deepLink);
      briefingPollRef.current = setInterval(async () => {
        try {
          const cfg = await apiService.getBriefingConfig();
          if (cfg.data.chatId) {
            setBriefing(cfg.data);
            setTelegramPhase('connected');
            if (briefingPollRef.current) clearInterval(briefingPollRef.current);
          }
        } catch { /* ignora */ }
      }, 3000);
    } catch {
      showToast('Erro ao gerar link de conexão.', 'error');
      setTelegramPhase('idle');
    }
  };

  const handleDisconnectTelegram = async () => {
    try {
      await apiService.disconnectBriefingTelegram();
      setBriefing(b => ({ ...b, chatId: '', chatName: '' }));
      setTelegramPhase('idle');
      setBriefingDeepLink('');
      showToast('Telegram desconectado.');
    } catch {
      showToast('Erro ao desconectar.', 'error');
    }
  };

  useEffect(() => {
    return () => { if (briefingPollRef.current) clearInterval(briefingPollRef.current); };
  }, []);

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      const res = await apiService.regenerateInvite();
      setInvite(res.data);
      showToast('Código regenerado com sucesso.');
    } catch {
      showToast('Erro ao regenerar código.', 'error');
    } finally {
      setRegenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!invite) return;
    await navigator.clipboard.writeText(invite.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleManageReports = (client: TrafficManagerClient) => {
    apiService.setSelectedClientOrgId(client.id);
    setReportClient(client);
  };

  const handleViewDashboard = (client: TrafficManagerClient) => {
    apiService.setSelectedClientOrgId(client.id);
    router.push('/dashboard');
  };

  if (user?.role !== UserRole.TRAFFIC_MANAGER) return null;

  return (
    <>
    <div className="space-y-6">
      {toast && (
        <div
          className="fixed top-5 right-5 z-50 flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium shadow-lg text-white"
          style={{ backgroundColor: toast.type === 'success' ? 'var(--bg-elevated)' : '#dc2626', border: '1px solid var(--border-md)' }}
        >
          {toast.message}
        </div>
      )}

      <GestorStatsCard />

      {/* ─── Seção: Código de Convite ─────────────────────────────────────── */}
      <div className="rounded-xl p-5 space-y-4" style={card}>
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Meu Código de Convite</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Compartilhe com seus clientes para que conectem você à conta deles.
          </p>
        </div>

        {loadingInvite ? (
          <div className="flex items-center gap-2 py-4 text-sm" style={{ color: 'var(--text-muted)' }}>
            <Spinner /> Carregando...
          </div>
        ) : invite ? (
          <div className="space-y-3">
            <div
              className="inline-flex items-center gap-4 rounded-xl px-6 py-4 cursor-pointer w-full justify-between"
              style={{ backgroundColor: 'rgba(59,130,246,0.06)', border: '1.5px dashed rgba(59,130,246,0.3)' }}
              onClick={handleCopy}
            >
              <span className="text-3xl font-bold tracking-[0.25em] font-mono" style={{ color: '#60a5fa' }}>
                {invite.code}
              </span>
              <button
                onClick={e => { e.stopPropagation(); handleCopy(); }}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors shrink-0"
                style={copied
                  ? { backgroundColor: 'rgba(34,197,94,0.1)', color: '#4ade80' }
                  : { backgroundColor: 'rgba(59,130,246,0.1)', color: '#60a5fa' }}
              >
                {copied ? '✓ Copiado!' : 'Copiar'}
              </button>
            </div>

            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Expira em {formatDate(invite.expiresAt)}
            </p>

            <button
              onClick={handleRegenerate}
              disabled={regenerating}
              className="flex items-center gap-2 text-xs transition-colors"
              style={{ color: 'var(--text-muted)' }}
            >
              {regenerating ? <Spinner className="h-3 w-3" /> : null}
              {regenerating ? 'Regenerando...' : '↻ Gerar novo código'}
            </button>
          </div>
        ) : (
          <button onClick={fetchInvite} className="text-xs px-4 py-2 rounded-lg" style={{ backgroundColor: '#3b82f6', color: '#fff' }}>
            Gerar código
          </button>
        )}
      </div>

      {/* ─── Seção: Briefing Semanal ──────────────────────────────────────── */}
      <div className="rounded-xl p-5 space-y-4" style={card}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Briefing Semanal Automático</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Receba todo domingo às {briefing.hour}h um resumo de todos os seus clientes direto no Telegram — sem abrir a plataforma.
            </p>
          </div>
          <button
            onClick={() => setBriefing(b => ({ ...b, enabled: !b.enabled }))}
            className="shrink-0 relative inline-flex h-5 w-9 items-center rounded-full transition-colors"
            style={{ backgroundColor: briefing.enabled ? '#3b82f6' : 'var(--border-md)' }}
            aria-label="Toggle briefing"
          >
            <span
              className="inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform"
              style={{ transform: briefing.enabled ? 'translateX(18px)' : 'translateX(2px)' }}
            />
          </button>
        </div>

        {loadingBriefing ? (
          <div className="flex items-center gap-2 py-2 text-xs" style={{ color: 'var(--text-muted)' }}>
            <Spinner className="h-3 w-3" /> Carregando...
          </div>
        ) : (
          <div className="space-y-3">
            {/* Telegram connection */}
            {telegramPhase === 'idle' && (
              <button
                onClick={handleConnectTelegram}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-medium transition-opacity"
                style={{ backgroundColor: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.3)', color: '#60a5fa' }}
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.28 13.04l-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.868.519z"/></svg>
                Conectar Telegram
              </button>
            )}

            {telegramPhase === 'connecting' && briefingDeepLink && (
              <div className="space-y-3 text-center">
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Escaneie o QR Code com o Telegram para conectar.
                </p>
                <div className="flex justify-center">
                  <div className="p-3 rounded-xl" style={{ backgroundColor: '#fff' }}>
                    <QRCodeSVG value={briefingDeepLink} size={160} />
                  </div>
                </div>
                <a href={briefingDeepLink} target="_blank" rel="noreferrer"
                  className="block text-xs truncate px-3 py-2 rounded-lg"
                  style={{ backgroundColor: 'var(--bg-elevated)', color: '#60a5fa', border: '1px solid var(--border-md)' }}>
                  {briefingDeepLink}
                </a>
                <div className="flex items-center gap-2 justify-center">
                  <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: '#3b82f6' }} />
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Aguardando conexão...</p>
                </div>
              </div>
            )}

            {telegramPhase === 'connected' && (
              <div className="flex items-center justify-between px-3 py-2.5 rounded-lg" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-md)' }}>
                <div className="flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: '#22c55e' }} />
                  <span className="text-xs" style={{ color: 'var(--text-primary)' }}>
                    {briefing.chatName || 'Telegram conectado'}
                  </span>
                </div>
                <button
                  onClick={handleDisconnectTelegram}
                  className="text-xs px-2 py-1 rounded"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Desconectar
                </button>
              </div>
            )}

            {/* Hour selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Horário (BRT)</label>
              <select
                value={briefing.hour}
                onChange={e => setBriefing(b => ({ ...b, hour: Number(e.target.value) }))}
                className="w-full rounded-lg px-3 py-2 text-xs"
                style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-md)', color: 'var(--text-primary)' }}
              >
                {[6, 7, 8, 9, 10, 11, 12].map(h => (
                  <option key={h} value={h}>{h}:00</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={handleSaveBriefing}
                disabled={savingBriefing}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-opacity"
                style={{ backgroundColor: '#3b82f6', color: '#fff', opacity: savingBriefing ? 0.6 : 1 }}
              >
                {savingBriefing ? <><Spinner className="h-3 w-3" /> Salvando...</> : 'Salvar'}
              </button>
              <button
                onClick={handleTestBriefing}
                disabled={testingBriefing || telegramPhase !== 'connected'}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-opacity"
                style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-md)', color: 'var(--text-secondary)', opacity: (testingBriefing || telegramPhase !== 'connected') ? 0.4 : 1 }}
              >
                {testingBriefing ? <><Spinner className="h-3 w-3" /> Enviando...</> : '⚡ Testar agora'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ─── Seção: Clientes ──────────────────────────────────────────────── */}
      <div className="rounded-xl p-5 space-y-4" style={card}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Meus Clientes</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Gerencie os relatórios automatizados de cada cliente.
            </p>
          </div>
          {!loadingClients && (
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(59,130,246,0.1)', color: '#60a5fa' }}>
              {clients.length} {clients.length === 1 ? 'cliente' : 'clientes'}
            </span>
          )}
        </div>

        {loadingClients ? (
          <div className="flex items-center gap-2 py-6 text-sm" style={{ color: 'var(--text-muted)' }}>
            <Spinner /> Carregando clientes...
          </div>
        ) : clients.length === 0 ? (
          <div className="rounded-xl p-8 flex flex-col items-center text-center" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Nenhum cliente conectado ainda.</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              Compartilhe seu código de convite para que clientes te conectem.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {clients.map(client => (
              <div key={client.id}
                className="flex items-center justify-between gap-3 rounded-xl px-4 py-3"
                style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: 'rgba(59,130,246,0.1)' }}>
                    <span className="text-sm font-bold" style={{ color: '#60a5fa' }}>
                      {client.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{client.name}</p>
                    <span className="text-xs" style={{ color: PLAN_COLORS[client.plan] ?? '#64748b' }}>
                      {PLAN_LABELS[client.plan] ?? client.plan}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleViewDashboard(client)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                    style={{ color: 'var(--accent)', border: '1px solid var(--border-md)', backgroundColor: 'transparent' }}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
                    </svg>
                    Ver Dashboard
                  </button>
                  <button
                    onClick={() => handleManageReports(client)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                    style={{ backgroundColor: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid rgba(59,130,246,0.2)' }}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Relatórios
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Instruções de uso ────────────────────────────────────────────── */}
      <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid rgba(59,130,246,0.2)' }}>
        <p className="text-xs font-medium mb-2" style={{ color: '#60a5fa' }}>Como funciona</p>
        <ol className="space-y-1 text-xs list-decimal list-inside" style={{ color: 'var(--text-muted)' }}>
          <li>Copie o código de convite e envie ao cliente (WhatsApp, email etc.)</li>
          <li>O cliente ADMIN acessa <strong style={{ color: 'var(--text-secondary)' }}>Usuários → Conectar Gestor</strong> e digita o código</li>
          <li>O cliente aparece na lista acima — clique em <strong style={{ color: 'var(--text-secondary)' }}>Relatórios</strong> para gerenciar</li>
          <li>Configure Telegram ou WhatsApp e defina a frequência de envio para cada cliente</li>
        </ol>
      </div>
    </div>

    {reportClient && (
      <ClientReportsModal
        clientName={reportClient.name}
        onClose={() => { setReportClient(null); apiService.clearSelectedClientOrgId(); }}
      />
    )}
    </>
  );
}
