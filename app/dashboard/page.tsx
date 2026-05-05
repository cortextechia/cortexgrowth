'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useUsers, useIntegrations, useDashboard, useAiInsights } from '@/hooks/useApi';
import Sparkline from '@/components/charts/Sparkline';
import SpendAreaChart from '@/components/charts/AreaChart';
import DonutChart from '@/components/charts/DonutChart';
import AdminDashboard from '@/components/AdminDashboard';
import { UserRole } from '@/types';
import type { MetaInsight, GoogleAdsMetric } from '@/components/DashboardAnalytics';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface KommoLead {
  id: string;
  externalId: number;
  name: string | null;
  status: string;
  price: number | null;
  utmSource: string | null;
  utmCampaign: string | null;
  rawData: { created_at?: number; [key: string]: unknown };
  createdAt: string;
}

type Range = '7D' | '30D' | '90D' | 'CUSTOM';
const PRESETS: Record<Exclude<Range, 'CUSTOM'>, { days: number; label: string }> = {
  '7D':  { days: 7,  label: 'Últimos 7 dias'  },
  '30D': { days: 30, label: 'Últimos 30 dias' },
  '90D': { days: 90, label: 'Últimos 90 dias' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function filterByDateRange<T extends { date: string }>(items: T[], start: Date, end: Date): T[] {
  return items.filter((i) => {
    const d = new Date(i.date);
    return d >= start && d <= end;
  });
}

function prevPeriodRange<T extends { date: string }>(items: T[], start: Date, end: Date): T[] {
  const duration = end.getTime() - start.getTime();
  const prevEnd = new Date(start.getTime());
  const prevStart = new Date(start.getTime() - duration);
  return items.filter((i) => {
    const d = new Date(i.date);
    return d >= prevStart && d < prevEnd;
  });
}

function calcDelta(cur: number, prev: number): number {
  if (prev === 0) return 0;
  return ((cur - prev) / prev) * 100;
}

function fmtMoney(v: number): string {
  if (v >= 1_000_000) return `R$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `R$${(v / 1_000).toFixed(1)}k`;
  return `R$${Math.round(v)}`;
}

function fmtNum(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `${(v / 1_000).toFixed(1)}k`;
  return `${Math.round(v)}`;
}

function fmtPct(v: number): string {
  return `${v.toFixed(2)}%`;
}

// Aggregates daily spend by date label
function buildSpendSeries(
  meta: MetaInsight[],
  google: GoogleAdsMetric[],
  start: Date,
  end: Date,
) {
  const metaFiltered   = filterByDateRange(meta, start, end);
  const googleFiltered = filterByDateRange(google, start, end);

  const map = new Map<string, { meta: number; google: number }>();

  metaFiltered.forEach((d) => {
    const key = d.date.slice(0, 10);
    const prev = map.get(key) ?? { meta: 0, google: 0 };
    map.set(key, { ...prev, meta: prev.meta + d.spend });
  });

  googleFiltered.forEach((d) => {
    const key = d.date.slice(0, 10);
    const prev = map.get(key) ?? { meta: 0, google: 0 };
    map.set(key, { ...prev, google: prev.google + d.cost });
  });

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, vals]) => ({
      label: new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
      meta: Math.round(vals.meta),
      google: Math.round(vals.google),
    }));
}

// Daily values for sparklines
function dailyValues(
  meta: MetaInsight[],
  google: GoogleAdsMetric[],
  getValue: (m: MetaInsight) => number,
  getCost: (g: GoogleAdsMetric) => number,
): number[] {
  const map = new Map<string, number>();
  meta.forEach((d) => {
    const k = d.date.slice(0, 10);
    map.set(k, (map.get(k) ?? 0) + getValue(d));
  });
  google.forEach((d) => {
    const k = d.date.slice(0, 10);
    map.set(k, (map.get(k) ?? 0) + getCost(d));
  });
  return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
}

// Kommo date: rawData.created_at (after fix) or rawData.rawData.created_at (legacy data)
function getKommoDate(lead: KommoLead): Date {
  const raw = lead.rawData as Record<string, unknown>;
  const ts =
    (raw?.created_at as number | undefined) ??
    ((raw?.rawData as Record<string, unknown> | undefined)?.created_at as number | undefined);
  if (ts) return new Date(ts * 1000);
  return new Date(lead.createdAt);
}

function filterKommoByRange(leads: KommoLead[], start: Date, end: Date): KommoLead[] {
  return leads.filter((l) => {
    const d = getKommoDate(l);
    return d >= start && d <= end;
  });
}

const STATUS_COLORS: Record<string, string> = {
  'Novo Lead':          '#60a5fa',
  'Contato Feito':      '#fbbf24',
  'Contato inicial':    '#fbbf24',
  'Contato Inicial':    '#fbbf24',
  'Proposta Enviada':   '#a78bfa',
  'Orçamento Enviado':  '#a78bfa',
  'Aguardando Orçamento': '#fb923c',
  'Negociando':         '#fb923c',
  'Follow- Up 1':       '#38bdf8',
  'Follow - Up 1':      '#38bdf8',
  'Follow - Up 2':      '#22d3ee',
  'Follow - Up 3':      '#06b6d4',
  'Qualificado':        '#34d399',
  'Inicial B2B':        '#818cf8',
  'Fechado':            '#4ade80',
  'Venda ganha':        '#4ade80',
  'Ganho':              '#4ade80',
  'Perdido':            '#f87171',
  'Venda perdida':      '#f87171',
  'Não Qualificado':    '#94a3b8',
};
const FALLBACK_PALETTE = ['#60a5fa', '#a78bfa', '#fb923c', '#fbbf24', '#38bdf8', '#f472b6', '#818cf8'];

function statusColor(status: string, idx: number): string {
  return STATUS_COLORS[status] ?? FALLBACK_PALETTE[idx % FALLBACK_PALETTE.length];
}

// Top campaigns grouped by name
interface Campaign {
  name: string;
  platform: 'Meta' | 'Google';
  spend: number;
  clicks: number;
  impressions: number;
  conversions: number;
}

function buildCampaigns(meta: MetaInsight[], google: GoogleAdsMetric[]): Campaign[] {
  const map = new Map<string, Campaign>();

  meta.forEach((d) => {
    const prev = map.get(d.campaignName) ?? { name: d.campaignName, platform: 'Meta', spend: 0, clicks: 0, impressions: 0, conversions: 0 };
    map.set(d.campaignName, {
      ...prev,
      spend: prev.spend + d.spend,
      clicks: prev.clicks + d.clicks,
      impressions: prev.impressions + d.impressions,
      conversions: prev.conversions + (d.conversions ?? 0),
    });
  });

  google.forEach((d) => {
    const key = `[G] ${d.campaignName}`;
    const prev = map.get(key) ?? { name: d.campaignName, platform: 'Google', spend: 0, clicks: 0, impressions: 0, conversions: 0 };
    map.set(key, {
      ...prev,
      spend: prev.spend + d.cost,
      clicks: prev.clicks + d.clicks,
      impressions: prev.impressions + d.impressions,
      conversions: prev.conversions + (d.conversions ?? 0),
    });
  });

  return Array.from(map.values())
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 8);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="#3b82f6" strokeWidth="4" />
      <path className="opacity-75" fill="#3b82f6" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

interface KpiCardProps {
  title: string;
  value: string;
  delta: number;
  invertDelta?: boolean;
  sparkData: number[];
  color: string;
  animKey: number;
}

function KpiCard({ title, value, delta, invertDelta = false, sparkData, color, animKey }: KpiCardProps) {
  const positive = invertDelta ? delta <= 0 : delta >= 0;
  const arrow = delta >= 0 ? '↑' : '↓';
  return (
    <div
      className="rounded-xl p-4 sm:p-5 flex flex-col gap-2"
      style={{ backgroundColor: '#0f1629', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wider" style={{ color: '#475569' }}>{title}</span>
        {delta !== 0 && (
          <span
            className="text-xs font-semibold px-1.5 py-0.5 rounded"
            style={{
              backgroundColor: positive ? 'rgba(34,197,94,0.10)' : 'rgba(248,113,113,0.10)',
              color: positive ? '#4ade80' : '#f87171',
            }}
          >
            {arrow} {Math.abs(delta).toFixed(1)}%
          </span>
        )}
      </div>
      <p className="text-2xl sm:text-3xl font-semibold" style={{ color: '#f1f5f9' }}>{value}</p>
      <Sparkline data={sparkData} color={color} height={36} animKey={animKey} />
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 75 ? '#4ade80' : score >= 50 ? '#fbbf24' : '#f87171';
  const bg    = score >= 75 ? 'rgba(34,197,94,0.10)' : score >= 50 ? 'rgba(251,191,36,0.10)' : 'rgba(248,113,113,0.10)';
  const label = score >= 75 ? 'Saudável' : score >= 50 ? 'Atenção' : 'Crítico';
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold" style={{ backgroundColor: bg, color }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      {score}/100 · {label}
    </span>
  );
}

const PLATFORM_COLORS: Record<string, { dot: string; bg: string; text: string }> = {
  Meta:   { dot: '#818cf8', bg: 'rgba(129,140,248,0.12)', text: '#a5b4fc' },
  Google: { dot: '#34d399', bg: 'rgba(52,211,153,0.12)',  text: '#6ee7b7' },
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user, organization } = useAuth();
  const { users, fetchUsers } = useUsers();
  const { integrations, fetchIntegrations } = useIntegrations();
  const { metaInsights, googleAdsMetrics, kommoLeads: rawKommoLeads, fetchAllDashboardData, isLoading: dashLoading } = useDashboard();
  const kommoLeads = rawKommoLeads as KommoLead[];
  const { latestInsight, isLoading: insightLoading, isGenerating, error: insightError, fetchLatestInsight, generateInsights } = useAiInsights();

  const [range, setRange]             = useState<Range>('30D');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd]     = useState('');
  const [animKey, setAnimKey]         = useState(0);
  const [generateToast, setGenerateToast] = useState<string | null>(null);

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';

  useEffect(() => {
    fetchUsers();
    fetchIntegrations();
    fetchAllDashboardData();
    fetchLatestInsight();
  }, []);

  const changeRange = (r: Range) => {
    if (r === range) return;
    if (r === 'CUSTOM' && !customStart) {
      const e = new Date();
      const s = new Date();
      s.setDate(s.getDate() - 30);
      setCustomEnd(e.toISOString().slice(0, 10));
      setCustomStart(s.toISOString().slice(0, 10));
    }
    setRange(r);
    setAnimKey((k) => k + 1);
  };

  const handleGenerateInsights = async () => {
    const ok = await generateInsights();
    setGenerateToast(ok ? 'Relatório gerado com sucesso!' : (insightError ?? 'Erro ao gerar relatório'));
    setTimeout(() => setGenerateToast(null), 4000);
  };

  // ── Active period ──────────────────────────────────────────────────────────
  const activePeriod = useMemo(() => {
    if (range === 'CUSTOM' && customStart && customEnd) {
      const s = new Date(customStart); s.setHours(0, 0, 0, 0);
      const e = new Date(customEnd);   e.setHours(23, 59, 59, 999);
      return { start: s, end: e };
    }
    const days = PRESETS[range as Exclude<Range, 'CUSTOM'>]?.days ?? 30;
    const e = new Date();
    const s = new Date();
    s.setDate(s.getDate() - days);
    s.setHours(0, 0, 0, 0);
    return { start: s, end: e };
  }, [range, customStart, customEnd]);

  const rangeLabel = useMemo(() => {
    if (range === 'CUSTOM') {
      if (!customStart || !customEnd) return 'Personalizado';
      const fmt = (d: string) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
      return `${fmt(customStart)} – ${fmt(customEnd)}`;
    }
    return PRESETS[range].label;
  }, [range, customStart, customEnd]);

  // ── Filtered data ──────────────────────────────────────────────────────────
  const metaCur    = useMemo(() => filterByDateRange(metaInsights,     activePeriod.start, activePeriod.end), [metaInsights,     activePeriod]);
  const googleCur  = useMemo(() => filterByDateRange(googleAdsMetrics, activePeriod.start, activePeriod.end), [googleAdsMetrics, activePeriod]);
  const metaPrev   = useMemo(() => prevPeriodRange(metaInsights,       activePeriod.start, activePeriod.end), [metaInsights,     activePeriod]);
  const googlePrev = useMemo(() => prevPeriodRange(googleAdsMetrics,   activePeriod.start, activePeriod.end), [googleAdsMetrics, activePeriod]);

  const hasData = metaCur.length > 0 || googleCur.length > 0;

  // ── KPIs ───────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const curSpend    = metaCur.reduce((s, d) => s + d.spend, 0) + googleCur.reduce((s, d) => s + d.cost, 0);
    const prevSpend   = metaPrev.reduce((s, d) => s + d.spend, 0) + googlePrev.reduce((s, d) => s + d.cost, 0);
    const curImpr     = metaCur.reduce((s, d) => s + d.impressions, 0) + googleCur.reduce((s, d) => s + d.impressions, 0);
    const prevImpr    = metaPrev.reduce((s, d) => s + d.impressions, 0) + googlePrev.reduce((s, d) => s + d.impressions, 0);
    const curClicks   = metaCur.reduce((s, d) => s + d.clicks, 0) + googleCur.reduce((s, d) => s + d.clicks, 0);
    const prevClicks  = metaPrev.reduce((s, d) => s + d.clicks, 0) + googlePrev.reduce((s, d) => s + d.clicks, 0);
    const curCtr      = curImpr  > 0 ? (curClicks  / curImpr)  * 100 : 0;
    const prevCtr     = prevImpr > 0 ? (prevClicks / prevImpr) * 100 : 0;

    return {
      spend:  { value: fmtMoney(curSpend),   delta: calcDelta(curSpend,  prevSpend),  invertDelta: true  },
      impr:   { value: fmtNum(curImpr),       delta: calcDelta(curImpr,   prevImpr),   invertDelta: false },
      clicks: { value: fmtNum(curClicks),     delta: calcDelta(curClicks, prevClicks), invertDelta: false },
      ctr:    { value: fmtPct(curCtr),        delta: calcDelta(curCtr,    prevCtr),    invertDelta: false },
    };
  }, [metaCur, googleCur, metaPrev, googlePrev]);

  // ── Sparkline data ─────────────────────────────────────────────────────────
  const sparkSpend  = useMemo(() => dailyValues(metaCur, googleCur, (m) => m.spend, (g) => g.cost),   [metaCur, googleCur]);
  const sparkImpr   = useMemo(() => dailyValues(metaCur, googleCur, (m) => m.impressions, (g) => g.impressions), [metaCur, googleCur]);
  const sparkClicks = useMemo(() => dailyValues(metaCur, googleCur, (m) => m.clicks, (g) => g.clicks), [metaCur, googleCur]);
  const sparkCtr    = useMemo(() => {
    const imprArr  = dailyValues(metaCur, googleCur, (m) => m.impressions, (g) => g.impressions);
    const clickArr = dailyValues(metaCur, googleCur, (m) => m.clicks, (g) => g.clicks);
    return imprArr.map((imp, i) => imp > 0 ? (clickArr[i] / imp) * 100 : 0);
  }, [metaCur, googleCur]);

  // ── Spend chart series ─────────────────────────────────────────────────────
  const spendSeries = useMemo(() => buildSpendSeries(metaInsights, googleAdsMetrics, activePeriod.start, activePeriod.end), [metaInsights, googleAdsMetrics, activePeriod]);

  // ── Channel donut ──────────────────────────────────────────────────────────
  const channelData = useMemo(() => {
    const metaSpend   = metaCur.reduce((s, d) => s + d.spend, 0);
    const googleSpend = googleCur.reduce((s, d) => s + d.cost, 0);
    const total = metaSpend + googleSpend;
    if (total === 0) return [];
    return [
      { label: 'Meta Ads',   value: metaSpend,   color: '#818cf8', displayValue: fmtMoney(metaSpend)   },
      { label: 'Google Ads', value: googleSpend, color: '#34d399', displayValue: fmtMoney(googleSpend) },
    ];
  }, [metaCur, googleCur]);

  // ── Campaigns ──────────────────────────────────────────────────────────────
  const campaigns = useMemo(() => buildCampaigns(metaCur, googleCur), [metaCur, googleCur]);
  const maxCampaignSpend = campaigns[0]?.spend ?? 1;

  // ── Kommo CRM ──────────────────────────────────────────────────────────────
  const kommoCur = useMemo(() => filterKommoByRange(kommoLeads, activePeriod.start, activePeriod.end), [kommoLeads, activePeriod]);

  const statusBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    kommoCur.forEach((l) => map.set(l.status, (map.get(l.status) ?? 0) + 1));
    return Array.from(map.entries())
      .sort(([, a], [, b]) => b - a)
      .map(([status, count], idx) => ({ status, count, color: statusColor(status, idx) }));
  }, [kommoCur]);

  const { pipeline, closedValue } = useMemo(() => {
    const WON_STATUSES  = ['Fechado', 'Venda ganha', 'Ganho', 'Fechado Ganho', 'Won'];
    const LOST_STATUSES = ['Perdido', 'Venda perdida', 'Perdida', 'Fechado Perdido', 'Lost'];
    let pipeline = 0;
    let closedValue = 0;
    kommoCur.forEach((l) => {
      if (l.price == null || l.price === 0) return;
      if (WON_STATUSES.includes(l.status)) closedValue += l.price;
      else if (!LOST_STATUSES.includes(l.status)) pipeline += l.price;
      // leads perdidos são ignorados — não entram em nenhum total
    });
    return { pipeline, closedValue };
  }, [kommoCur]);

  const recentKommo = useMemo(
    () => [...kommoLeads].sort((a, b) => getKommoDate(b).getTime() - getKommoDate(a).getTime()).slice(0, 6),
    [kommoLeads],
  );

  // ── Integrations status ────────────────────────────────────────────────────
  const activeCount = integrations.filter((i) => i.status === 'CONNECTED').length;

  if (user?.role === UserRole.SUPER_ADMIN) {
    return <AdminDashboard />;
  }

  return (
    <div>
      {/* ── Page header ──────────────────────────────────────────────────────── */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-lg sm:text-xl font-semibold" style={{ color: '#f1f5f9' }}>
            Marketing <em style={{ color: '#60a5fa', fontStyle: 'italic' }}>performance</em>
          </h1>
          <p className="mt-0.5 text-xs uppercase tracking-wider" style={{ color: '#334155' }}>
            {rangeLabel.toUpperCase()} · {organization?.name ?? ''}
            {organization?.plan && (
              <span className="ml-2 px-1.5 py-0.5 rounded text-xs font-medium normal-case"
                style={{ backgroundColor: 'rgba(59,130,246,0.12)', color: '#60a5fa', letterSpacing: 0 }}>
                {organization.plan}
              </span>
            )}
          </p>
        </div>

        {/* Range picker */}
        <div className="flex flex-col items-end gap-2">
          <div
            className="flex rounded-lg p-0.5 gap-0.5"
            style={{ backgroundColor: '#0f1629', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            {(['7D', '30D', '90D'] as Exclude<Range, 'CUSTOM'>[]).map((r) => (
              <button
                key={r}
                onClick={() => changeRange(r)}
                className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
                style={
                  range === r
                    ? { backgroundColor: '#3b82f6', color: '#ffffff' }
                    : { color: '#64748b', backgroundColor: 'transparent' }
                }
              >
                {r}
              </button>
            ))}
            <button
              onClick={() => changeRange('CUSTOM')}
              className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
              style={
                range === 'CUSTOM'
                  ? { backgroundColor: '#3b82f6', color: '#ffffff' }
                  : { color: '#64748b', backgroundColor: 'transparent' }
              }
            >
              Personalizado
            </button>
          </div>

          {range === 'CUSTOM' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customStart}
                max={customEnd || undefined}
                onChange={(e) => { setCustomStart(e.target.value); setAnimKey((k) => k + 1); }}
                className="rounded-lg px-2.5 py-1.5 text-xs font-medium"
                style={{
                  backgroundColor: '#0f1629',
                  border: '1px solid rgba(255,255,255,0.10)',
                  color: '#94a3b8',
                  colorScheme: 'dark',
                }}
              />
              <span className="text-xs" style={{ color: '#334155' }}>–</span>
              <input
                type="date"
                value={customEnd}
                min={customStart || undefined}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => { setCustomEnd(e.target.value); setAnimKey((k) => k + 1); }}
                className="rounded-lg px-2.5 py-1.5 text-xs font-medium"
                style={{
                  backgroundColor: '#0f1629',
                  border: '1px solid rgba(255,255,255,0.10)',
                  color: '#94a3b8',
                  colorScheme: 'dark',
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* ── KPI strip ────────────────────────────────────────────────────────── */}
      {dashLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-xl p-5 animate-pulse" style={{ backgroundColor: '#0f1629', border: '1px solid rgba(255,255,255,0.06)', height: 120 }} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <KpiCard title="Gasto total"   value={kpis.spend.value}  delta={kpis.spend.delta}  invertDelta sparkData={sparkSpend}  color="#f87171" animKey={animKey} />
          <KpiCard title="Impressões"    value={kpis.impr.value}   delta={kpis.impr.delta}   sparkData={sparkImpr}               color="#60a5fa" animKey={animKey} />
          <KpiCard title="Cliques"       value={kpis.clicks.value} delta={kpis.clicks.delta} sparkData={sparkClicks}             color="#4ade80" animKey={animKey} />
          <KpiCard title="CTR"           value={kpis.ctr.value}    delta={kpis.ctr.delta}    sparkData={sparkCtr}                color="#fbbf24" animKey={animKey} />
        </div>
      )}

      {/* ── Charts row ───────────────────────────────────────────────────────── */}
      {hasData && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          {/* Spend over time */}
          <div className="lg:col-span-2 rounded-xl p-4 sm:p-5" style={{ backgroundColor: '#0f1629', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold" style={{ color: '#f1f5f9' }}>Gasto por canal</h3>
                <p className="text-xs mt-0.5" style={{ color: '#475569' }}>{rangeLabel} · diário</p>
              </div>
            </div>
            <SpendAreaChart
              data={spendSeries}
              series={[
                { key: 'meta',   label: 'Meta Ads',   color: '#818cf8' },
                { key: 'google', label: 'Google Ads', color: '#34d399' },
              ]}
              height={220}
            />
          </div>

          {/* Channel split donut */}
          <div className="rounded-xl p-4 sm:p-5" style={{ backgroundColor: '#0f1629', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="mb-4">
              <h3 className="text-sm font-semibold" style={{ color: '#f1f5f9' }}>Distribuição</h3>
              <p className="text-xs mt-0.5" style={{ color: '#475569' }}>% do gasto por plataforma</p>
            </div>
            {channelData.length > 0 ? (
              <DonutChart
                data={channelData}
                size={160}
                thickness={26}
                centerLabel="Total"
                centerValue={(() => {
                  const t = metaCur.reduce((s, d) => s + d.spend, 0) + googleCur.reduce((s, d) => s + d.cost, 0);
                  return fmtMoney(t);
                })()}
                animKey={animKey}
              />
            ) : (
              <div className="flex items-center justify-center h-40 text-sm" style={{ color: '#334155' }}>
                Sem dados
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Campaigns + AI Insights row ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {/* Top campaigns */}
        {campaigns.length > 0 && (
          <div className="lg:col-span-2 rounded-xl overflow-hidden" style={{ backgroundColor: '#0f1629', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="px-4 sm:px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <h3 className="text-sm font-semibold" style={{ color: '#f1f5f9' }}>Top campanhas</h3>
              <p className="text-xs mt-0.5" style={{ color: '#475569' }}>por gasto · {rangeLabel.toLowerCase()}</p>
            </div>

            {/* Mobile: cards */}
            <div className="sm:hidden divide-y" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
              {campaigns.map((c, i) => {
                const plt = PLATFORM_COLORS[c.platform] ?? PLATFORM_COLORS.Meta;
                const ctr = c.impressions > 0 ? ((c.clicks / c.impressions) * 100).toFixed(2) + '%' : '—';
                return (
                  <div key={i} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="text-sm font-medium truncate" style={{ color: '#e2e8f0' }}>{c.name}</p>
                      <span className="shrink-0 text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: plt.bg, color: plt.text }}>
                        {c.platform}
                      </span>
                    </div>
                    <div className="flex gap-4 text-xs" style={{ color: '#64748b' }}>
                      <span>Gasto: <span style={{ color: '#94a3b8' }}>{fmtMoney(c.spend)}</span></span>
                      <span>Cliques: <span style={{ color: '#94a3b8' }}>{fmtNum(c.clicks)}</span></span>
                      <span>CTR: <span style={{ color: '#94a3b8' }}>{ctr}</span></span>
                    </div>
                    <div className="mt-2 h-1 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.04)' }}>
                      <div className="h-full rounded-full" style={{ width: `${(c.spend / maxCampaignSpend) * 100}%`, backgroundColor: plt.dot, opacity: 0.6 }} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop: table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ backgroundColor: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    {['Campanha', 'Plataforma', 'Gasto', 'Cliques', 'CTR'].map((h) => (
                      <th key={h} className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider" style={{ color: '#475569' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c, i) => {
                    const plt = PLATFORM_COLORS[c.platform] ?? PLATFORM_COLORS.Meta;
                    const ctr = c.impressions > 0 ? ((c.clicks / c.impressions) * 100).toFixed(2) + '%' : '—';
                    return (
                      <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td className="px-5 py-3" style={{ color: '#e2e8f0', maxWidth: 220 }}>
                          <span className="block truncate">{c.name}</span>
                        </td>
                        <td className="px-5 py-3">
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: plt.bg, color: plt.text }}>
                            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: plt.dot }} />
                            {c.platform}
                          </span>
                        </td>
                        <td className="px-5 py-3 tabular-nums" style={{ color: '#94a3b8' }}>{fmtMoney(c.spend)}</td>
                        <td className="px-5 py-3 tabular-nums" style={{ color: '#94a3b8' }}>{fmtNum(c.clicks)}</td>
                        <td className="px-5 py-3 tabular-nums" style={{ color: '#94a3b8' }}>{ctr}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* AI Insights compact */}
        <div
          className={`rounded-xl overflow-hidden ${campaigns.length === 0 ? 'lg:col-span-3' : ''}`}
          style={{ backgroundColor: '#0f1629', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className="px-4 sm:px-5 py-4 flex flex-wrap items-start gap-3 justify-between"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold" style={{ color: '#f1f5f9' }}>Inteligência de IA</h3>
              {latestInsight && (
                <p className="text-xs mt-0.5" style={{ color: '#475569' }}>
                  {latestInsight.period} · {new Date(latestInsight.createdAt).toLocaleDateString('pt-BR')}
                </p>
              )}
            </div>
            {isAdmin && (
              <button
                onClick={handleGenerateInsights}
                disabled={isGenerating}
                className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-opacity"
                style={{
                  backgroundColor: 'rgba(59,130,246,0.15)',
                  border: '1px solid rgba(59,130,246,0.30)',
                  color: '#60a5fa',
                  opacity: isGenerating ? 0.6 : 1,
                  cursor: isGenerating ? 'not-allowed' : 'pointer',
                }}
              >
                {isGenerating ? <><Spinner className="h-3 w-3" /> Gerando...</> : '⚡ Gerar'}
              </button>
            )}
          </div>

          {insightLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm" style={{ color: '#475569' }}>
              <Spinner /> Carregando...
            </div>
          ) : latestInsight?.content?.orchestrator ? (
            <div className="p-4 sm:p-5 space-y-4">
              {/* Score */}
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium uppercase tracking-wider" style={{ color: '#475569' }}>Score geral</span>
                <ScoreBadge score={latestInsight.content.orchestrator.overallScore} />
              </div>

              {/* Summary */}
              {latestInsight.content.orchestrator.executiveSummary && (
                <p className="text-xs leading-relaxed" style={{ color: '#94a3b8' }}>
                  {latestInsight.content.orchestrator.executiveSummary}
                </p>
              )}

              {/* Priority alerts */}
              {latestInsight.content.orchestrator.priorityAlerts.length > 0 && (
                <div className="rounded-lg p-3" style={{ backgroundColor: 'rgba(248,113,113,0.05)', border: '1px solid rgba(248,113,113,0.12)' }}>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#f87171' }}>Alertas</p>
                  <ul className="space-y-1.5">
                    {latestInsight.content.orchestrator.priorityAlerts.slice(0, 3).map((alert, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs" style={{ color: '#fca5a5' }}>
                        <span className="mt-1.5 h-1 w-1 flex-shrink-0 rounded-full" style={{ backgroundColor: '#f87171' }} />
                        {alert}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Recommendations */}
              {latestInsight.content.orchestrator.topRecommendations.length > 0 && (
                <div className="rounded-lg p-3" style={{ backgroundColor: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.12)' }}>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: '#60a5fa' }}>Recomendações</p>
                  <ul className="space-y-1.5">
                    {latestInsight.content.orchestrator.topRecommendations.slice(0, 3).map((rec, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs" style={{ color: '#93c5fd' }}>
                        <span className="mt-0.5 text-xs font-bold shrink-0" style={{ color: '#3b82f6' }}>{i + 1}.</span>
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Agent scores */}
              {(latestInsight.content.marketing || latestInsight.content.sales || latestInsight.content.roas) && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {latestInsight.content.marketing && (
                    <div className="rounded-lg p-2.5 text-center" style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <p className="text-xs mb-1" style={{ color: '#475569' }}>Marketing</p>
                      <ScoreBadge score={latestInsight.content.marketing.score} />
                    </div>
                  )}
                  {latestInsight.content.sales && (
                    <div className="rounded-lg p-2.5 text-center" style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <p className="text-xs mb-1" style={{ color: '#475569' }}>Vendas</p>
                      <ScoreBadge score={latestInsight.content.sales.score} />
                    </div>
                  )}
                  {latestInsight.content.roas && (
                    <div className="rounded-lg p-2.5 text-center" style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <p className="text-xs mb-1" style={{ color: '#475569' }}>ROAS</p>
                      <ScoreBadge score={latestInsight.content.roas.score} />
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 text-center px-4">
              <p className="text-sm font-medium" style={{ color: '#94a3b8' }}>Nenhum relatório</p>
              <p className="mt-1 text-xs" style={{ color: '#475569' }}>
                {isAdmin ? 'Clique em "⚡ Gerar" para criar o primeiro.' : 'Aguarde o relatório diário.'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── CRM Funil ────────────────────────────────────────────────────────── */}
      {kommoLeads.length > 0 && (
        <div className="mb-6 rounded-xl overflow-hidden" style={{ backgroundColor: '#0f1629', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="px-4 sm:px-5 py-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <h3 className="text-sm font-semibold" style={{ color: '#f1f5f9' }}>Funil de Leads CRM</h3>
            <p className="text-xs mt-0.5" style={{ color: '#475569' }}>
              {kommoCur.length} leads · {rangeLabel.toLowerCase()} · Kommo
            </p>
          </div>

          <div className="p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-2 gap-6">
            {/* Status breakdown */}
            <div>
              <p className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: '#475569' }}>Por status</p>
              {statusBreakdown.length > 0 ? (
                <div className="space-y-2.5">
                  {statusBreakdown.map((s) => (
                    <div key={s.status} className="flex items-center gap-3">
                      <span
                        className="text-xs truncate"
                        style={{ color: '#94a3b8', minWidth: 120, maxWidth: 140 }}
                        title={s.status}
                      >
                        {s.status}
                      </span>
                      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}>
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${(s.count / (statusBreakdown[0]?.count || 1)) * 100}%`, backgroundColor: s.color, transition: 'width 0.5s ease' }}
                        />
                      </div>
                      <span className="text-xs tabular-nums font-medium" style={{ color: '#f1f5f9', minWidth: 28, textAlign: 'right' }}>{s.count}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs" style={{ color: '#334155' }}>Nenhum lead no período</p>
              )}
            </div>

            {/* Recent leads */}
            <div>
              <p className="text-xs font-medium uppercase tracking-wider mb-3" style={{ color: '#475569' }}>Leads recentes</p>
              <div className="space-y-2">
                {recentKommo.map((lead) => {
                  const color = STATUS_COLORS[lead.status] ?? '#475569';
                  const dealName = (lead.rawData as any)?.name as string | undefined;
                  const displayName = lead.name ?? dealName ?? `#${lead.externalId}`;
                  const hasValue = lead.price != null && lead.price > 0;
                  return (
                    <div key={lead.id} className="flex items-center gap-2 text-xs">
                      <span className="flex-1 truncate" style={{ color: '#94a3b8' }} title={displayName}>
                        {displayName}
                      </span>
                      <span
                        className="shrink-0 px-1.5 py-0.5 rounded text-xs"
                        style={{ backgroundColor: `${color}18`, color }}
                      >
                        {lead.status}
                      </span>
                      {hasValue && (
                        <span className="shrink-0 tabular-nums" style={{ color: '#64748b' }}>
                          {fmtMoney(lead.price!)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Summary bar */}
          <div
            className="px-4 sm:px-5 py-3 flex flex-wrap gap-6"
            style={{ borderTop: '1px solid rgba(255,255,255,0.04)', backgroundColor: 'rgba(255,255,255,0.01)' }}
          >
            <div>
              <p className="text-xs" style={{ color: '#475569' }}>Total no período</p>
              <p className="text-sm font-semibold tabular-nums" style={{ color: '#f1f5f9' }}>{kommoCur.length} leads</p>
            </div>
            {pipeline > 0 && (
              <div>
                <p className="text-xs" style={{ color: '#475569' }}>Em negociação</p>
                <p className="text-sm font-semibold tabular-nums" style={{ color: '#fbbf24' }}>{fmtMoney(pipeline)}</p>
              </div>
            )}
            {closedValue > 0 && (
              <div>
                <p className="text-xs" style={{ color: '#475569' }}>Fechados</p>
                <p className="text-sm font-semibold tabular-nums" style={{ color: '#4ade80' }}>{fmtMoney(closedValue)}</p>
              </div>
            )}
            <div>
              <p className="text-xs" style={{ color: '#475569' }}>Total sincronizado</p>
              <p className="text-sm font-semibold tabular-nums" style={{ color: '#60a5fa' }}>{kommoLeads.length}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Quick stats footer ────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Usuários',     value: users.length,        accent: false },
          { label: 'Integrações',  value: integrations.length, accent: false },
          { label: 'Ativas',       value: activeCount,         accent: activeCount > 0 },
          { label: 'Função',       value: user?.role ?? '—',   accent: false },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-xl px-4 py-3"
            style={{
              backgroundColor: s.accent ? 'rgba(59,130,246,0.07)' : '#0f1629',
              border: s.accent ? '1px solid rgba(59,130,246,0.20)' : '1px solid rgba(255,255,255,0.05)',
            }}
          >
            <p className="text-xs uppercase tracking-wider" style={{ color: '#475569' }}>{s.label}</p>
            <p className="mt-1 text-xl font-semibold" style={{ color: s.accent ? '#60a5fa' : '#f1f5f9' }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* ── Toast ────────────────────────────────────────────────────────────── */}
      {generateToast && (
        <div
          className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-xs z-50 px-4 py-3 rounded-xl text-sm font-medium shadow-lg"
          style={{
            backgroundColor: generateToast.includes('sucesso') ? 'rgba(34,197,94,0.15)' : 'rgba(248,113,113,0.15)',
            border: generateToast.includes('sucesso') ? '1px solid rgba(34,197,94,0.30)' : '1px solid rgba(248,113,113,0.30)',
            color: generateToast.includes('sucesso') ? '#4ade80' : '#f87171',
          }}
        >
          {generateToast}
        </div>
      )}
    </div>
  );
}