'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useUsers, useIntegrations, useDashboard, useAiInsights } from '@/hooks/useApi';
import DashboardAnalytics from '@/components/DashboardAnalytics';

const SURFACE = { backgroundColor: '#0f1629', border: '1px solid rgba(255,255,255,0.06)' };
const SURFACE_HOVER = 'rgba(255,255,255,0.03)';

function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="#3b82f6" strokeWidth="4" />
      <path className="opacity-75" fill="#3b82f6" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function StatCard({ title, value, accent = false }: { title: string; value: number | string; accent?: boolean }) {
  return (
    <div
      className="rounded-xl p-6"
      style={{
        backgroundColor: accent ? 'rgba(59,130,246,0.07)' : '#0f1629',
        border: accent ? '1px solid rgba(59,130,246,0.25)' : '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <p className="text-xs font-medium uppercase tracking-wider" style={{ color: '#475569' }}>{title}</p>
      <p className="mt-2 text-3xl font-semibold" style={{ color: '#f1f5f9' }}>{value}</p>
    </div>
  );
}

const ROLE_BADGE: Record<string, { bg: string; color: string }> = {
  SUPER_ADMIN: { bg: 'rgba(59,130,246,0.15)', color: '#60a5fa' },
  ADMIN:       { bg: 'rgba(59,130,246,0.10)', color: '#93c5fd' },
  USER:        { bg: 'rgba(255,255,255,0.08)', color: '#94a3b8' },
  VIEWER:      { bg: 'rgba(255,255,255,0.05)', color: '#64748b' },
};

const STATUS_BADGE: Record<string, { bg: string; color: string }> = {
  ACTIVE:   { bg: 'rgba(34,197,94,0.12)', color: '#4ade80' },
  INACTIVE: { bg: 'rgba(255,255,255,0.05)', color: '#475569' },
};

const INTEGRATION_STATUS: Record<string, { dotColor: string; textColor: string; label: string }> = {
  CONNECTED:    { dotColor: '#4ade80', textColor: '#4ade80',  label: 'Conectado'    },
  DISCONNECTED: { dotColor: '#475569', textColor: '#475569',  label: 'Desconectado' },
  ERROR:        { dotColor: '#f87171', textColor: '#f87171',  label: 'Erro'         },
  EXPIRED:      { dotColor: '#fbbf24', textColor: '#fbbf24',  label: 'Expirado'     },
};

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 75 ? '#4ade80' : score >= 50 ? '#fbbf24' : '#f87171';
  const bg = score >= 75 ? 'rgba(34,197,94,0.10)' : score >= 50 ? 'rgba(251,191,36,0.10)' : 'rgba(248,113,113,0.10)';
  const label = score >= 75 ? 'Saudável' : score >= 50 ? 'Atenção' : 'Crítico';
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
      style={{ backgroundColor: bg, color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      {score}/100 · {label}
    </span>
  );
}

export default function DashboardPage() {
  const { user, organization } = useAuth();
  const { users, fetchUsers, isLoading: usersLoading } = useUsers();
  const { integrations, fetchIntegrations, isLoading: integrationsLoading } = useIntegrations();
  const { metaInsights, googleAdsMetrics, fetchAllDashboardData, isLoading: dashboardLoading } = useDashboard();
  const { latestInsight, isLoading: insightLoading, isGenerating, error: insightError, fetchLatestInsight, generateInsights } = useAiInsights();
  const [generateToast, setGenerateToast] = useState<string | null>(null);

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';

  useEffect(() => {
    fetchUsers();
    fetchIntegrations();
    fetchAllDashboardData();
    fetchLatestInsight();
  }, []);

  const handleGenerateInsights = async () => {
    const ok = await generateInsights();
    setGenerateToast(ok ? 'Relatório gerado com sucesso!' : insightError ?? 'Erro ao gerar relatório');
    setTimeout(() => setGenerateToast(null), 4000);
  };

  const activeCount = integrations.filter((i) => i.status === 'CONNECTED').length;

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold" style={{ color: '#f1f5f9' }}>
          Bem-vindo, {user?.name}
        </h1>
        <p className="mt-1 text-sm" style={{ color: '#475569' }}>
          {organization?.name}
          {organization?.plan && (
            <>
              {' · '}
              <span style={{ color: '#64748b' }}>Plano </span>
              <span
                className="text-xs px-1.5 py-0.5 rounded font-medium"
                style={{ backgroundColor: 'rgba(59,130,246,0.12)', color: '#60a5fa' }}
              >
                {organization.plan}
              </span>
            </>
          )}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard title="Usuários" value={users.length} />
        <StatCard title="Integrações" value={integrations.length} />
        <StatCard title="Ativas" value={activeCount} accent={activeCount > 0} />
        <StatCard title="Função" value={user?.role ?? 'USER'} />
      </div>

      {/* Analytics */}
      {(metaInsights.length > 0 || googleAdsMetrics.length > 0) && (
        <div className="mb-8">
          <DashboardAnalytics
            metaInsights={metaInsights}
            googleAdsMetrics={googleAdsMetrics}
            isLoading={dashboardLoading}
          />
        </div>
      )}

      {/* Toast */}
      {generateToast && (
        <div
          className="fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl text-sm font-medium shadow-lg"
          style={{
            backgroundColor: generateToast.includes('sucesso') ? 'rgba(34,197,94,0.15)' : 'rgba(248,113,113,0.15)',
            border: generateToast.includes('sucesso') ? '1px solid rgba(34,197,94,0.30)' : '1px solid rgba(248,113,113,0.30)',
            color: generateToast.includes('sucesso') ? '#4ade80' : '#f87171',
          }}
        >
          {generateToast}
        </div>
      )}

      {/* AI Insights */}
      <div className="mb-8 rounded-xl overflow-hidden" style={SURFACE}>
        <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div>
            <h2 className="text-sm font-semibold" style={{ color: '#f1f5f9' }}>Inteligência de IA</h2>
            {latestInsight && (
              <p className="text-xs mt-0.5" style={{ color: '#475569' }}>
                Relatório de {latestInsight.period} · gerado em {new Date(latestInsight.createdAt).toLocaleString('pt-BR')}
              </p>
            )}
          </div>
          {isAdmin && (
            <button
              onClick={handleGenerateInsights}
              disabled={isGenerating}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-opacity"
              style={{
                backgroundColor: 'rgba(59,130,246,0.15)',
                border: '1px solid rgba(59,130,246,0.30)',
                color: '#60a5fa',
                opacity: isGenerating ? 0.6 : 1,
                cursor: isGenerating ? 'not-allowed' : 'pointer',
              }}
            >
              {isGenerating ? <><Spinner className="h-3 w-3" /> Gerando...</> : '⚡ Gerar relatório'}
            </button>
          )}
        </div>

        {insightLoading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm" style={{ color: '#475569' }}>
            <Spinner /> Carregando...
          </div>
        ) : latestInsight?.content?.orchestrator ? (
          <div className="p-6">
            {/* Score geral */}
            <div className="mb-6 flex items-center gap-3">
              <span className="text-xs font-medium uppercase tracking-wider" style={{ color: '#475569' }}>Score geral</span>
              <ScoreBadge score={latestInsight.content.orchestrator.overallScore} />
            </div>

            {/* Sumário executivo */}
            {latestInsight.content.orchestrator.executiveSummary && (
              <p className="mb-6 text-sm leading-relaxed" style={{ color: '#94a3b8' }}>
                {latestInsight.content.orchestrator.executiveSummary}
              </p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Alertas */}
              {latestInsight.content.orchestrator.priorityAlerts.length > 0 && (
                <div className="rounded-xl p-4" style={{ backgroundColor: 'rgba(248,113,113,0.05)', border: '1px solid rgba(248,113,113,0.15)' }}>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#f87171' }}>Alertas prioritários</p>
                  <ul className="space-y-2">
                    {latestInsight.content.orchestrator.priorityAlerts.map((alert, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm" style={{ color: '#fca5a5' }}>
                        <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ backgroundColor: '#f87171' }} />
                        {alert}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Recomendações */}
              {latestInsight.content.orchestrator.topRecommendations.length > 0 && (
                <div className="rounded-xl p-4" style={{ backgroundColor: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.15)' }}>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: '#60a5fa' }}>Recomendações</p>
                  <ul className="space-y-2">
                    {latestInsight.content.orchestrator.topRecommendations.map((rec, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm" style={{ color: '#93c5fd' }}>
                        <span className="mt-0.5 text-xs font-bold" style={{ color: '#3b82f6' }}>{i + 1}.</span>
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Scores por agente */}
            {(latestInsight.content.marketing || latestInsight.content.sales || latestInsight.content.roas) && (
              <div className="mt-4 grid grid-cols-3 gap-3">
                {latestInsight.content.marketing && (
                  <div className="rounded-lg p-3 text-center" style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <p className="text-xs" style={{ color: '#475569' }}>Marketing</p>
                    <ScoreBadge score={latestInsight.content.marketing.score} />
                  </div>
                )}
                {latestInsight.content.sales && (
                  <div className="rounded-lg p-3 text-center" style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <p className="text-xs mb-1" style={{ color: '#475569' }}>Vendas</p>
                    <ScoreBadge score={latestInsight.content.sales.score} />
                  </div>
                )}
                {latestInsight.content.roas && (
                  <div className="rounded-lg p-3 text-center" style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <p className="text-xs mb-1" style={{ color: '#475569' }}>ROAS</p>
                    <ScoreBadge score={latestInsight.content.roas.score} />
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-sm font-medium" style={{ color: '#94a3b8' }}>Nenhum relatório gerado</p>
            <p className="mt-1 text-xs" style={{ color: '#475569' }}>
              {isAdmin ? 'Clique em "Gerar relatório" para criar o primeiro.' : 'Aguarde o relatório diário.'}
            </p>
          </div>
        )}
      </div>

      {/* Recent Users */}
      <div className="mb-6 rounded-xl overflow-hidden" style={SURFACE}>
        <div className="px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <h2 className="text-sm font-semibold" style={{ color: '#f1f5f9' }}>Usuários Recentes</h2>
        </div>
        {usersLoading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm" style={{ color: '#475569' }}>
            <Spinner /> Carregando...
          </div>
        ) : users.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  {['Nome', 'Email', 'Função', 'Status'].map((h) => (
                    <th key={h} className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#475569' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.slice(0, 5).map((u) => {
                  const role = ROLE_BADGE[u.role] ?? ROLE_BADGE.USER;
                  const status = STATUS_BADGE[u.status] ?? STATUS_BADGE.INACTIVE;
                  return (
                    <tr
                      key={u.id}
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = SURFACE_HOVER)}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <td className="px-6 py-3 font-medium" style={{ color: '#e2e8f0' }}>{u.name}</td>
                      <td className="px-6 py-3" style={{ color: '#64748b' }}>{u.email}</td>
                      <td className="px-6 py-3">
                        <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: role.bg, color: role.color }}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-6 py-3">
                        <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: status.bg, color: status.color }}>
                          {u.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-sm font-medium" style={{ color: '#94a3b8' }}>Nenhum usuário</p>
            <p className="mt-1 text-xs" style={{ color: '#475569' }}>Adicione membros na página de Usuários.</p>
          </div>
        )}
      </div>

      {/* Integrations */}
      <div className="rounded-xl overflow-hidden" style={SURFACE}>
        <div className="px-6 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <h2 className="text-sm font-semibold" style={{ color: '#f1f5f9' }}>Integrações</h2>
        </div>
        {integrationsLoading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm" style={{ color: '#475569' }}>
            <Spinner /> Carregando...
          </div>
        ) : integrations.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-6">
            {integrations.slice(0, 6).map((integration) => {
              const st = INTEGRATION_STATUS[integration.status] ?? INTEGRATION_STATUS.DISCONNECTED;
              return (
                <div
                  key={integration.id}
                  className="rounded-xl p-4 transition-colors"
                  style={{ backgroundColor: '#162036', border: '1px solid rgba(255,255,255,0.06)' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)')}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium" style={{ color: '#e2e8f0' }}>{integration.name}</p>
                      <p className="text-xs mt-0.5" style={{ color: '#475569' }}>{integration.type}</p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium" style={{ color: st.textColor }}>
                      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: st.dotColor }} />
                      {st.label}
                    </span>
                  </div>
                  {integration.externalName && (
                    <p className="mt-2 text-xs" style={{ color: '#475569' }}>
                      Conta: <span className="font-medium" style={{ color: '#64748b' }}>{integration.externalName}</span>
                    </p>
                  )}
                  <p className="mt-1 text-xs" style={{ color: '#334155' }}>
                    Desde {new Date(integration.createdAt).toLocaleDateString('pt-BR')}
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-sm font-medium" style={{ color: '#94a3b8' }}>Nenhuma integração</p>
            <p className="mt-1 text-xs" style={{ color: '#475569' }}>Conecte em Integrações.</p>
          </div>
        )}
      </div>
    </div>
  );
}