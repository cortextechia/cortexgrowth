'use client';

import { useEffect, useState } from 'react';
import { apiService } from '@/lib/api';
import { AdminMetrics } from '@/types';

function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function fmt(n: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n);
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

const PLAN_COLOR: Record<string, string> = {
  FREE:         'text-gray-400',
  STARTER:      'text-blue-400',
  PROFESSIONAL: 'text-purple-400',
  ENTERPRISE:   'text-amber-400',
};

const STATUS_DOT: Record<string, string> = {
  ACTIVE:    'bg-green-400',
  SUSPENDED: 'bg-red-400',
  CANCELLED: 'bg-gray-500',
};

interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
  highlight?: string;
}

function KpiCard({ label, value, sub, accent, highlight }: KpiCardProps) {
  return (
    <div
      className="rounded-xl p-5 flex flex-col gap-1"
      style={{ backgroundColor: accent ? 'rgba(59,130,246,0.08)' : 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
    >
      <span className="text-xs font-medium uppercase tracking-wide" style={{ color: '#475569' }}>{label}</span>
      <span className="text-2xl font-semibold" style={{ color: accent ? '#60a5fa' : '#f1f5f9' }}>{value}</span>
      {sub && <span className="text-xs" style={{ color: highlight ?? '#475569' }}>{sub}</span>}
    </div>
  );
}

export default function AdminDashboard() {
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiService.getAdminMetrics()
      .then((res) => setMetrics(res.data))
      .catch(() => setError('Erro ao carregar métricas.'))
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-sm" style={{ color: '#475569' }}>
        <Spinner className="h-5 w-5" /> Carregando métricas...
      </div>
    );
  }

  if (error || !metrics) {
    return <p className="py-10 text-center text-sm" style={{ color: '#ef4444' }}>{error ?? 'Erro desconhecido.'}</p>;
  }

  const { orgs, platform, mrr, arr, mrrByPlan, recentOrgs } = metrics;
  const growthPositive = orgs.growthPct >= 0;

  return (
    <div className="space-y-6">
      {/* Título */}
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold" style={{ color: '#f1f5f9' }}>
          Cortex Growth — <span style={{ color: '#60a5fa', fontStyle: 'italic' }}>visão geral</span>
        </h1>
        <p className="mt-1 text-sm" style={{ color: '#475569' }}>Métricas do SaaS em tempo real.</p>
      </div>

      {/* KPIs principais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard
          label="MRR"
          value={fmt(mrr)}
          sub="receita mensal recorrente"
          accent
        />
        <KpiCard
          label="ARR"
          value={fmt(arr)}
          sub="projeção anual"
        />
        <KpiCard
          label="Clientes ativos"
          value={String(orgs.ACTIVE)}
          sub={`${orgs.SUSPENDED} suspenso(s) · ${orgs.CANCELLED} cancelado(s)`}
        />
        <KpiCard
          label="Crescimento (mês)"
          value={`${growthPositive ? '+' : ''}${orgs.growthPct}%`}
          sub={`${orgs.newThisMonth} novas · ${orgs.newLastMonth} no mês anterior`}
          highlight={growthPositive ? '#4ade80' : '#f87171'}
        />
      </div>

      {/* Plataforma + Planos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Uso da plataforma */}
        <div className="rounded-xl p-5 space-y-3" style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <h2 className="text-sm font-semibold" style={{ color: '#94a3b8' }}>Uso da plataforma</h2>
          {[
            { label: 'Usuários ativos',          value: platform.totalUsers },
            { label: 'Integrações conectadas',   value: `${platform.connectedIntegrations} / ${platform.totalIntegrations}` },
            { label: 'Leads sincronizados',      value: platform.totalLeads.toLocaleString('pt-BR') },
            { label: 'Relatórios de IA gerados', value: platform.totalAiReports.toLocaleString('pt-BR') },
            { label: 'Orgs sem integração',      value: orgs.atRisk, highlight: orgs.atRisk > 0 },
          ].map(({ label, value, highlight }) => (
            <div key={label} className="flex items-center justify-between">
              <span className="text-sm" style={{ color: '#64748b' }}>{label}</span>
              <span className="text-sm font-medium" style={{ color: highlight ? '#f87171' : '#e2e8f0' }}>{value}</span>
            </div>
          ))}
        </div>

        {/* MRR por plano */}
        <div className="rounded-xl p-5 space-y-3" style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <h2 className="text-sm font-semibold" style={{ color: '#94a3b8' }}>Receita por plano</h2>
          {mrrByPlan.map(({ plan, price, count, revenue }) => (
            <div key={plan} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`text-xs font-semibold w-24 shrink-0 ${PLAN_COLOR[plan] ?? 'text-gray-400'}`}>{plan}</span>
                <span className="text-xs" style={{ color: '#475569' }}>
                  {count} org{count !== 1 ? 's' : ''} · {fmt(price)}/mês
                </span>
              </div>
              <span className="text-sm font-medium shrink-0" style={{ color: revenue > 0 ? '#4ade80' : '#334155' }}>
                {fmt(revenue)}
              </span>
            </div>
          ))}
          <div className="pt-2 flex items-center justify-between border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <span className="text-xs font-semibold" style={{ color: '#94a3b8' }}>Total MRR</span>
            <span className="text-sm font-bold" style={{ color: '#60a5fa' }}>{fmt(mrr)}</span>
          </div>
        </div>
      </div>

      {/* Clientes recentes */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="px-5 py-3" style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <h2 className="text-sm font-semibold" style={{ color: '#94a3b8' }}>Clientes recentes</h2>
        </div>

        {/* Mobile */}
        <div className="sm:hidden divide-y" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
          {recentOrgs.map((org) => (
            <div key={org.id} className="px-4 py-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${STATUS_DOT[org.status] ?? 'bg-gray-500'}`} />
                  <p className="text-sm font-medium truncate" style={{ color: '#e2e8f0' }}>{org.name}</p>
                </div>
                <p className={`text-xs mt-0.5 ${PLAN_COLOR[org.plan] ?? 'text-gray-400'}`}>{org.plan}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs" style={{ color: '#475569' }}>{formatDate(org.createdAt)}</p>
                <p className="text-xs mt-0.5" style={{ color: org.hasIntegration ? '#4ade80' : '#f87171' }}>
                  {org.hasIntegration ? `${org.integrations} int.` : 'sem integração'}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                {['Cliente', 'Plano', 'Usuários', 'Integrações', 'Cadastro'].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide" style={{ color: '#475569' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentOrgs.map((org) => (
                <tr key={org.id} style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${STATUS_DOT[org.status] ?? 'bg-gray-500'}`} />
                      <span className="font-medium" style={{ color: '#e2e8f0' }}>{org.name}</span>
                    </div>
                  </td>
                  <td className={`px-5 py-3 text-xs font-semibold ${PLAN_COLOR[org.plan] ?? 'text-gray-400'}`}>{org.plan}</td>
                  <td className="px-5 py-3" style={{ color: '#64748b' }}>{org.users}</td>
                  <td className="px-5 py-3">
                    {org.internal ? (
                      <span className="text-xs px-2 py-0.5 rounded font-medium" style={{ backgroundColor: 'rgba(59,130,246,0.12)', color: '#60a5fa' }}>interno</span>
                    ) : (
                      <span style={{ color: org.hasIntegration ? '#4ade80' : '#f87171' }}>
                        {org.hasIntegration ? `${org.integrations} ativa${org.integrations !== 1 ? 's' : ''}` : 'nenhuma'}
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3" style={{ color: '#475569' }}>{formatDate(org.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}