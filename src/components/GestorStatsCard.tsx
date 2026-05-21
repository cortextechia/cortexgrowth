'use client';

import { useState, useEffect, useCallback } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { apiService } from '@/lib/api';
import type { ManagerStats } from '@/types';

const PLAN_LABELS: Record<string, string> = { STARTER: 'Starter', PROFESSIONAL: 'Pro', ENTERPRISE: 'Enterprise' };
const PLAN_COLORS: Record<string, string> = { STARTER: '#64748b', PROFESSIONAL: '#3b82f6', ENTERPRISE: '#a855f7' };

function fmtMoney(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export default function GestorStatsCard() {
  const [stats, setStats] = useState<ManagerStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiService.getManagerStats();
      setStats(res.data);
    } catch {
      // não bloqueia a página se falhar
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchStats(); }, [fetchStats]);

  const card: React.CSSProperties = { backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' };

  if (loading) {
    return (
      <div className="rounded-xl p-5" style={card}>
        <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
          <Spinner /> Carregando painel...
        </div>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="rounded-xl p-5 space-y-5" style={card}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Meu Painel</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Comissões e performance como gestor</p>
        </div>
        <span
          className="text-xs px-2 py-0.5 rounded-full"
          style={{ backgroundColor: 'var(--accent-dim)', color: 'var(--accent)' }}
        >
          10% por cliente
        </span>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4">
        <div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>MRR Comissão</p>
          <p className="text-xl font-bold tabular-nums mt-0.5" style={{ color: 'var(--text-primary)' }}>
            {fmtMoney(stats.mrr)}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {stats.linkClientCount ?? 0} via link · {stats.codeClientCount ?? 0} via código
          </p>
        </div>

        <div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Projeção Anual</p>
          <p className="text-xl font-bold tabular-nums mt-0.5" style={{ color: 'var(--text-primary)' }}>
            {fmtMoney(stats.annualProjection)}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{stats.clientCount} clientes total</p>
        </div>

        <div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Ticket Médio</p>
          <p className="text-xl font-bold tabular-nums mt-0.5" style={{ color: 'var(--text-primary)' }}>
            {(stats.linkClientCount ?? 0) > 0 ? fmtMoney(stats.averageTicket) : '—'}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>por cliente comissionável</p>
        </div>

        <div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Relatórios</p>
          <p className="text-xl font-bold tabular-nums mt-0.5" style={{ color: 'var(--text-primary)' }}>
            {stats.reportsThisMonth}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            enviados este mês · {stats.activeSchedules} agendado{stats.activeSchedules !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <div style={{ height: 1, backgroundColor: 'var(--border)' }} />

      {/* Gráfico de crescimento + Breakdown */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <p className="text-xs font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>
            Crescimento de clientes (6 meses)
          </p>
          <ResponsiveContainer width="100%" height={90}>
            <AreaChart data={stats.growthHistory} margin={{ top: 4, right: 4, bottom: 0, left: -22 }}>
              <defs>
                <linearGradient id="gestorAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="var(--accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="month"
                tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
                width={28}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelStyle={{ color: 'var(--text-secondary)' }}
                itemStyle={{ color: 'var(--text-primary)' }}
                formatter={(v) => [v, 'Clientes']}
              />
              <Area
                type="monotone"
                dataKey="cumulative"
                stroke="var(--accent)"
                fill="url(#gestorAreaGrad)"
                strokeWidth={2}
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div>
          <p className="text-xs font-medium mb-3" style={{ color: 'var(--text-secondary)' }}>
            Breakdown por plano
          </p>
          {stats.planBreakdown.length === 0 ? (
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Nenhum cliente via link ainda.</p>
          ) : (
            <div className="space-y-2">
              {stats.planBreakdown.map(item => (
                <div key={item.plan} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-xs px-1.5 py-0.5 rounded font-medium"
                      style={{
                        backgroundColor: `${PLAN_COLORS[item.plan] ?? '#64748b'}20`,
                        color: PLAN_COLORS[item.plan] ?? '#64748b',
                      }}
                    >
                      {PLAN_LABELS[item.plan] ?? item.plan}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>× {item.count}</span>
                  </div>
                  <span className="text-xs font-medium tabular-nums" style={{ color: 'var(--text-primary)' }}>
                    {fmtMoney(item.totalCommission)}/mês
                  </span>
                </div>
              ))}
              <div
                className="flex items-center justify-between pt-1.5"
                style={{ borderTop: '1px solid var(--border)' }}
              >
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Total</span>
                <span className="text-xs font-bold tabular-nums" style={{ color: 'var(--accent)' }}>
                  {fmtMoney(stats.mrr)}/mês
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
