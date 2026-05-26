'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { apiService } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';
import { Integration, IntegrationType, Plan, BudgetStatus, GoogleBudgetStatus } from '@/types';

// ─── Provider config ──────────────────────────────────────────────────────────

type OAuthProvider = 'meta' | 'google_ads' | 'google_analytics' | 'kommo';

interface ProviderConfig {
  type: IntegrationType;
  provider: OAuthProvider;
  label: string;
  description: string;
  icon: React.ReactNode;
  supportsSync: boolean;
}

const MetaIcon = () => (
  <svg viewBox="0 0 36 36" fill="none" className="h-7 w-7">
    <path d="M18 3C9.716 3 3 9.716 3 18s6.716 15 15 15 15-6.716 15-15S26.284 3 18 3z" fill="#1877F2"/>
    <path d="M22.162 11H20.05c-.808 0-1.703.338-2.29 1.157-.547.768-.66 1.703-.66 2.546v1.547H15v2.75h2.1V25h2.9v-6h2.1l.3-2.75h-2.4v-1.375c0-.792.22-1.125.9-1.125h1.262V11z" fill="white"/>
  </svg>
);

const GoogleIcon = () => (
  <svg viewBox="0 0 36 36" className="h-7 w-7">
    <path d="M33.12 18.37c0-1.16-.1-2.27-.29-3.34H18v6.32h8.49a7.26 7.26 0 01-3.15 4.76v3.95h5.1c2.99-2.75 4.68-6.8 4.68-11.69z" fill="#4285F4"/>
    <path d="M18 34c4.26 0 7.83-1.41 10.44-3.84l-5.1-3.95c-1.41.95-3.22 1.5-5.34 1.5-4.11 0-7.59-2.77-8.83-6.5H3.9v4.08A15.98 15.98 0 0018 34z" fill="#34A853"/>
    <path d="M9.17 21.21A9.64 9.64 0 018.67 18c0-1.11.19-2.19.5-3.21V10.71H3.9A15.98 15.98 0 002 18c0 2.58.62 5.02 1.9 7.29l5.27-4.08z" fill="#FBBC05"/>
    <path d="M18 8.29c2.32 0 4.4.8 6.04 2.37l4.53-4.53A15.94 15.94 0 0018 2 15.98 15.98 0 003.9 10.71l5.27 4.08C10.41 11.06 13.89 8.29 18 8.29z" fill="#EA4335"/>
  </svg>
);

const GoogleAnalyticsIcon = () => (
  <svg viewBox="0 0 36 36" className="h-7 w-7">
    <rect width="36" height="36" rx="18" fill="#F9AB00"/>
    <rect x="8" y="20" width="5" height="8" rx="1.5" fill="white"/>
    <rect x="15.5" y="14" width="5" height="14" rx="1.5" fill="white"/>
    <rect x="23" y="8" width="5" height="20" rx="1.5" fill="white"/>
  </svg>
);

const KommoIcon = () => (
  <svg viewBox="0 0 36 36" className="h-7 w-7">
    <rect width="36" height="36" rx="18" fill="#2E2E2E"/>
    <text x="18" y="23" textAnchor="middle" fill="white" fontSize="13" fontWeight="bold" fontFamily="sans-serif">K</text>
  </svg>
);

const PROVIDERS: ProviderConfig[] = [
  {
    type: IntegrationType.META_ADS,
    provider: 'meta',
    label: 'Meta Ads',
    description: 'Facebook e Instagram Ads — importe campanhas, gastos e métricas.',
    icon: <MetaIcon />,
    supportsSync: true,
  },
  {
    type: IntegrationType.GOOGLE_ADS,
    provider: 'google_ads',
    label: 'Google Ads',
    description: 'Search, Display e YouTube — dados de custo, cliques e conversões.',
    icon: <GoogleIcon />,
    supportsSync: true,
  },
  {
    type: IntegrationType.GOOGLE_ANALYTICS,
    provider: 'google_analytics',
    label: 'Google Analytics',
    description: 'Tráfego, sessões e comportamento do usuário no seu site.',
    icon: <GoogleAnalyticsIcon />,
    supportsSync: false,
  },
  {
    type: IntegrationType.KOMMO,
    provider: 'kommo',
    label: 'Kommo CRM',
    description: 'Leads, negociações e pipeline de vendas sincronizados automaticamente.',
    icon: <KommoIcon />,
    supportsSync: true,
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Integration['status'] }) {
  const map = {
    CONNECTED:    { dot: 'bg-green-400',  text: 'text-green-700',  label: 'Conectado'    },
    DISCONNECTED: { dot: 'bg-gray-300',   text: 'text-gray-500',   label: 'Desconectado' },
    ERROR:        { dot: 'bg-red-400',    text: 'text-red-600',    label: 'Erro'         },
    EXPIRED:      { dot: 'bg-yellow-400', text: 'text-yellow-700', label: 'Expirado'     },
  } as const;

  const cfg = map[status] ?? map.DISCONNECTED;

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${cfg.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// ─── Budget badges ────────────────────────────────────────────────────────────

function MetaBudgetBadge({ budget }: { budget: BudgetStatus }) {
  if (!budget.connected) return null;
  if (budget.remaining === null) return null;

  const days = budget.daysLeft ?? 0;
  const color = days < 1 ? 'text-red-600 bg-red-50' : days < 3 ? 'text-yellow-700 bg-yellow-50' : 'text-emerald-700 bg-emerald-50';
  const dot   = days < 1 ? 'bg-red-400' : days < 3 ? 'bg-yellow-400' : 'bg-emerald-400';

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${color}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      Saldo: R$ {budget.remaining.toFixed(2)}
      {budget.daysLeft !== null && (
        <span className="opacity-70">· ~{budget.daysLeft < 1 ? '<1' : budget.daysLeft.toFixed(1)} dia{budget.daysLeft !== 1 ? 's' : ''}</span>
      )}
    </span>
  );
}

function GoogleBudgetBadge({ budget }: { budget: GoogleBudgetStatus }) {
  if (!budget.connected || budget.campaigns.length === 0) return null;

  const highUsage = budget.campaigns.filter(c => c.pctUsed >= 80);
  if (highUsage.length === 0) return null;

  const worst = highUsage.reduce((a, b) => a.pctUsed > b.pctUsed ? a : b);
  const color = worst.pctUsed >= 95 ? 'text-red-600 bg-red-50' : 'text-yellow-700 bg-yellow-50';
  const dot   = worst.pctUsed >= 95 ? 'bg-red-400' : 'bg-yellow-400';

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full ${color}`} title={`${highUsage.length} campanha(s) com orçamento alto`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {highUsage.length === 1
        ? `"${worst.name}" ${worst.pctUsed}% do orçamento`
        : `${highUsage.length} campanhas acima de 80%`}
    </span>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function IntegrationsPage() {
  const { organization } = useAuth();
  const isStarter = organization?.plan === Plan.STARTER;
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [metaBudget, setMetaBudget]     = useState<BudgetStatus | null>(null);
  const [googleBudget, setGoogleBudget] = useState<GoogleBudgetStatus | null>(null);

  // Per-card loading states
  const [connectingProvider, setConnectingProvider] = useState<OAuthProvider | null>(null);
  const [syncingType, setSyncingType] = useState<IntegrationType | null>(null);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const loadIntegrations = useCallback(async () => {
    try {
      setError(null);
      const data = await apiService.getIntegrations();
      setIntegrations(data.integrations);
    } catch {
      setError('Não foi possível carregar as integrações.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadIntegrations();
    apiService.getBudgetStatus()
      .then(({ data }) => { setMetaBudget(data.meta); setGoogleBudget(data.google); })
      .catch(() => {/* silencia — budget é info extra, não crítico */});
  }, [loadIntegrations]);

  // ── Connect via OAuth ───────────────────────────────────────────────────────
  const handleConnect = async (provider: OAuthProvider) => {
    setConnectingProvider(provider);
    try {
      const authUrl = await apiService.getOAuthUrl(provider);
      // Abre em nova aba; o callback redireciona para /auth/oauth-callback
      window.open(authUrl, '_blank', 'width=600,height=700,noopener,noreferrer');
      // Recarrega integrações após 6s para capturar a nova conexão
      setTimeout(() => loadIntegrations(), 6000);
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? 'Erro ao iniciar autorização';
      showToast(msg, 'error');
    } finally {
      setConnectingProvider(null);
    }
  };

  // ── Sync ───────────────────────────────────────────────────────────────────
  const handleSync = async (type: IntegrationType) => {
    setSyncingType(type);
    try {
      const result = await apiService.syncIntegration(type);
      showToast(`Sincronização concluída — ${result.recordsProcessed} registros atualizados.`);
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? 'Erro ao sincronizar';
      showToast(msg, 'error');
    } finally {
      setSyncingType(null);
    }
  };

  // ── Disconnect ─────────────────────────────────────────────────────────────
  const handleDisconnect = async (integration: Integration) => {
    if (!confirm(`Desconectar ${integration.name}? Os dados já importados serão mantidos.`)) return;
    setDisconnectingId(integration.id);
    try {
      await apiService.deleteIntegration(integration.id);
      showToast(`${integration.name} desconectado.`);
      await loadIntegrations();
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? 'Erro ao desconectar';
      showToast(msg, 'error');
    } finally {
      setDisconnectingId(null);
    }
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="w-full max-w-4xl">

      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Integrações</h1>
        <p className="mt-1 text-sm text-gray-500">
          Conecte suas plataformas de marketing e CRM para centralizar todos os dados.
        </p>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-4 left-4 right-4 sm:bottom-auto sm:top-5 sm:left-auto sm:right-5 sm:max-w-sm z-50 flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium shadow-lg transition-all ${
          toast.type === 'success'
            ? 'bg-gray-900 text-white'
            : 'bg-red-600 text-white'
        }`}>
          {toast.type === 'success' ? (
            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          )}
          {toast.message}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01" />
          </svg>
          {error}
          <button onClick={loadIntegrations} className="ml-auto text-xs underline">Tentar novamente</button>
        </div>
      )}

      {/* Provider cards */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {PROVIDERS.map((p) => (
            <div key={p.type} className="animate-pulse rounded-2xl border border-gray-100 bg-white p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-10 w-10 rounded-full bg-gray-100" />
                <div className="space-y-1.5">
                  <div className="h-3.5 w-24 rounded bg-gray-100" />
                  <div className="h-3 w-16 rounded bg-gray-100" />
                </div>
              </div>
              <div className="h-3 w-full rounded bg-gray-100" />
              <div className="mt-4 h-9 w-full rounded-lg bg-gray-100" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {PROVIDERS.map((config) => {
            const integration = integrations.find((i) => i.type === config.type);
            const isConnected = integration?.status === 'CONNECTED';
            const isExpired   = integration?.status === 'EXPIRED';
            const isSyncing   = syncingType === config.type;
            const isConnecting = connectingProvider === config.provider;
            const isDisconnecting = disconnectingId === integration?.id;
            const isLocked = isStarter && config.type === IntegrationType.KOMMO;

            return (
              <div
                key={config.type}
                className={`flex flex-col rounded-2xl border p-6 shadow-sm transition-shadow ${isLocked ? 'border-gray-100 bg-gray-50 opacity-75' : 'border-gray-100 bg-white hover:shadow-md'}`}
              >
                {/* Card header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-50">
                      {config.icon}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{config.label}</p>
                      {integration ? (
                        <StatusBadge status={integration.status} />
                      ) : (
                        <span className="text-xs text-gray-400">Não conectado</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Locked badge */}
                {isLocked && (
                  <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded w-fit">
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Disponível no Professional ou superior
                  </span>
                )}

                {/* Description */}
                <p className="mt-3 text-xs text-gray-500 leading-relaxed">{config.description}</p>

                {/* Account name / token expiry */}
                {integration?.externalName && (
                  <p className="mt-2 text-xs text-gray-400">
                    Conta: <span className="font-medium text-gray-600">{integration.externalName}</span>
                  </p>
                )}
                {integration?.tokenExpires && (
                  <p className={`mt-1 text-xs ${
                    new Date(integration.tokenExpires) < new Date() ? 'text-red-500' : 'text-gray-400'
                  }`}>
                    Token expira: {new Date(integration.tokenExpires).toLocaleDateString('pt-BR')}
                  </p>
                )}

                {/* Budget badges — só quando conectado */}
                {config.type === IntegrationType.META_ADS && metaBudget?.connected && (
                  <div className="mt-2">
                    <MetaBudgetBadge budget={metaBudget} />
                  </div>
                )}
                {config.type === IntegrationType.GOOGLE_ADS && googleBudget?.connected && (
                  <div className="mt-2">
                    <GoogleBudgetBadge budget={googleBudget} />
                  </div>
                )}

                {/* Actions */}
                <div className="mt-4 flex gap-2">
                  {isLocked ? (
                    <button disabled className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-gray-100 px-4 py-2.5 text-xs font-medium text-gray-400 cursor-not-allowed">
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      Bloqueado no Starter
                    </button>
                  ) : !isConnected && !isExpired ? (
                    /* Not connected — show Connect button */
                    <button
                      onClick={() => handleConnect(config.provider)}
                      disabled={isConnecting}
                      className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 text-xs font-medium text-white transition-colors hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isConnecting ? (
                        <><Spinner /> Aguardando...</>
                      ) : (
                        <>
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.1-1.1m-.758-4.9a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                          </svg>
                          Conectar
                        </>
                      )}
                    </button>
                  ) : (
                    /* Connected — show Sync + Disconnect */
                    <>
                      {config.supportsSync && (
                        <button
                          onClick={() => handleSync(config.type)}
                          disabled={isSyncing}
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {isSyncing ? (
                            <><Spinner /> Sincronizando...</>
                          ) : (
                            <>
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                              Sincronizar
                            </>
                          )}
                        </button>
                      )}

                      {/* Reconnect if expired */}
                      {isExpired && (
                        <button
                          onClick={() => handleConnect(config.provider)}
                          disabled={isConnecting}
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-yellow-200 bg-yellow-50 px-3 py-2.5 text-xs font-medium text-yellow-700 transition-colors hover:bg-yellow-100 disabled:opacity-60"
                        >
                          {isConnecting ? <Spinner /> : (
                            <>
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9" />
                              </svg>
                              Reconectar
                            </>
                          )}
                        </button>
                      )}

                      <button
                        onClick={() => integration && handleDisconnect(integration)}
                        disabled={isDisconnecting}
                        className="flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2.5 text-xs font-medium text-gray-500 transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-60"
                        title="Desconectar"
                      >
                        {isDisconnecting ? <Spinner /> : (
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                          </svg>
                        )}
                      </button>
                    </>
                  )}
                </div>

                {/* Kommo webhook hint */}
                {config.type === IntegrationType.KOMMO && (
                  <p className="mt-3 text-xs text-gray-400">
                    Também suporta{' '}
                    <span className="font-medium text-gray-500">webhook push</span>
                    {' '}— configure a URL{' '}
                    <code className="rounded bg-gray-100 px-1 py-0.5 text-gray-600">
                      /api/kommo/leads
                    </code>{' '}
                    no painel do Kommo.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Dados Manuais — alternativa ao CRM */}
      {!loading && (
        <div className="mt-6">
          <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-muted)' }}>
            Alternativa sem CRM
          </p>
          <div className="flex items-center justify-between gap-4 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50">
                <svg className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V19.5a2.25 2.25 0 002.25 2.25h.75m0-12H12m-3 3h3m0 0h.375a1.125 1.125 0 010 2.25H12m-3 0h3" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">Dados Manuais de Receita</p>
                {integrations.find((i) => i.type === IntegrationType.KOMMO)?.status === 'CONNECTED' ? (
                  <p className="text-xs text-gray-500 mt-0.5">
                    CRM conectado — dados manuais são complementares ou para períodos sem sync.
                  </p>
                ) : (
                  <p className="text-xs text-emerald-700 mt-0.5 font-medium">
                    Sem Kommo conectado — insira dados de conversão manualmente para calcular ROAS e CAC.
                  </p>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  Insira leads, vendas e receita por canal (Meta, Google, Orgânico…) mês a mês.
                </p>
              </div>
            </div>
            <Link
              href="/dashboard/dados-manuais"
              className="shrink-0 flex items-center gap-1.5 rounded-lg bg-gray-900 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-gray-700"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
              </svg>
              Inserir dados
            </Link>
          </div>
        </div>
      )}

      {/* Info footer */}
      <div className="mt-6 flex items-start gap-3 rounded-xl border border-gray-100 bg-gray-50 p-4">
        <svg className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-xs text-gray-500 leading-relaxed">
          Todas as credenciais OAuth são trocadas pelo servidor e armazenadas criptografadas com{' '}
          <strong className="text-gray-700">AES-256-GCM</strong>. Nenhum token é exposto ao navegador.
          A conexão abrirá uma janela pop-up na plataforma escolhida — permita pop-ups se necessário.
        </p>
      </div>
    </div>
  );
}
