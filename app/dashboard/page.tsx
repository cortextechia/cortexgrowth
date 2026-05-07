'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useIntegrations, useDashboard, useAiInsights } from '@/hooks/useApi';
import Sparkline from '@/components/charts/Sparkline';
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
  tags: string[];
  rawData: { created_at?: number; [key: string]: unknown };
  createdAt: string;
}

type Range = '7D' | '30D' | '90D' | 'CUSTOM';
const PRESETS: Record<Exclude<Range, 'CUSTOM'>, { days: number; label: string }> = {
  '7D':  { days: 7,  label: 'Últimos 7 dias'  },
  '30D': { days: 30, label: 'Últimos 30 dias' },
  '90D': { days: 90, label: 'Últimos 90 dias' },
};

// ─── Funnel stage mappings ─────────────────────────────────────────────────────

const WON_STATUSES  = ['Fechado', 'Venda ganha', 'Ganho', 'Fechado Ganho', 'Won'];
const LOST_STATUSES = ['Perdido', 'Venda perdida', 'Perdida', 'Fechado Perdido', 'Lost', 'Não Qualificado'];
const NEGOTIATION_STATUSES = ['Negociando', 'Em negociação', 'Inicial B2B'];
const QUOTE_STATUSES = ['Proposta Enviada', 'Orçamento Enviado', 'Aguardando Orçamento'];
const CONTACT_STATUSES = [
  'Contato Feito', 'Contato inicial', 'Contato Inicial',
  'Follow- Up 1', 'Follow - Up 1', 'Follow - Up 2', 'Follow - Up 3',
  'Qualificado',
];

interface ActiveAlert {
  type: 'critical' | 'warning' | 'opportunity';
  title: string;
  action: string;
}

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
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1).replace('.', ',')}M`;
  if (v >= 1_000)     return `R$ ${(v / 1_000).toFixed(1).replace('.', ',')}k`;
  return `R$ ${Math.round(v)}`;
}

function fmtBRL(v: number): string {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtNum(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace('.', ',')}M`;
  if (v >= 1_000)     return `${(v / 1_000).toFixed(1).replace('.', ',')}k`;
  return `${Math.round(v)}`;
}

function fmtPct(v: number): string {
  return `${v.toFixed(2).replace('.', ',')}%`;
}

function fmtPct1(v: number): string {
  return `${v.toFixed(1).replace('.', ',')}%`;
}

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

// ─── Sub-components ───────────────────────────────────────────────────────────

function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="#3b82f6" strokeWidth="4" />
      <path className="opacity-75" fill="#3b82f6" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: '#334155', letterSpacing: '0.1em' }}>
      {children}
    </p>
  );
}

interface KpiCardProps {
  title: string;
  value: string;
  delta: number;
  invertDelta?: boolean;
  neutralDelta?: boolean;
  sub: string;
  sparkData: number[];
  animKey: number;
}

function KpiCard({ title, value, delta, invertDelta = false, neutralDelta = false, sub, sparkData, animKey }: KpiCardProps) {
  const positive = invertDelta ? delta <= 0 : delta >= 0;
  const arrow = delta >= 0 ? '↑' : '↓';
  return (
    <div className="rounded-xl p-4 flex flex-col gap-2" style={{ backgroundColor: '#0f1629', border: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wider" style={{ color: '#475569' }}>{title}</span>
        {delta !== 0 && (
          <span
            className="text-xs font-semibold px-1.5 py-0.5 rounded"
            style={neutralDelta
              ? { backgroundColor: 'rgba(148,163,184,0.10)', color: '#94a3b8' }
              : {
                  backgroundColor: positive ? 'rgba(34,197,94,0.10)' : 'rgba(248,113,113,0.10)',
                  color: positive ? '#4ade80' : '#f87171',
                }
            }
          >
            {arrow} {Math.abs(delta).toFixed(1).replace('.', ',')}%
          </span>
        )}
      </div>
      <p className="text-2xl font-semibold tabular-nums" style={{ color: '#f1f5f9' }}>{value}</p>
      <Sparkline data={sparkData} color="#60a5fa" height={32} animKey={animKey} />
      <p className="text-xs" style={{ color: '#334155' }}>{sub}</p>
    </div>
  );
}

interface BottomKpiProps {
  title: string;
  value: string;
  sub: string;
  badge?: string;
  badgeColor?: string;
  accent?: string;
}

function BottomKpiCard({ title, value, sub, badge, badgeColor, accent = '#f1f5f9' }: BottomKpiProps) {
  return (
    <div className="rounded-xl p-4 flex flex-col gap-1.5" style={{ backgroundColor: '#0f1629', border: '1px solid rgba(255,255,255,0.06)' }}>
      <span className="text-xs font-medium uppercase tracking-wider" style={{ color: '#475569' }}>{title}</span>
      {badge && (
        <span
          className="self-start text-xs px-2 py-0.5 rounded font-medium"
          style={{ backgroundColor: badgeColor ? `${badgeColor}18` : 'rgba(59,130,246,0.12)', color: badgeColor ?? '#60a5fa' }}
        >
          {badge}
        </span>
      )}
      <p className="text-2xl font-semibold tabular-nums" style={{ color: accent }}>{value}</p>
      <p className="text-xs" style={{ color: '#334155' }}>{sub}</p>
    </div>
  );
}

function AlertCard({ alert }: { alert: ActiveAlert }) {
  const styles = {
    critical:    { bg: 'rgba(248,113,113,0.06)',  border: '#f87171', titleColor: '#f87171',  icon: '🔴' },
    warning:     { bg: 'rgba(251,191,36,0.06)',   border: '#fbbf24', titleColor: '#fbbf24',  icon: '🟡' },
    opportunity: { bg: 'rgba(74,222,128,0.06)',   border: '#4ade80', titleColor: '#4ade80',  icon: '🟢' },
  }[alert.type];
  return (
    <div className="rounded-xl p-4 flex flex-col gap-2" style={{ backgroundColor: styles.bg, border: `1px solid ${styles.border}30`, borderLeft: `3px solid ${styles.border}` }}>
      <p className="text-xs font-semibold" style={{ color: styles.titleColor }}>{styles.icon} {alert.type === 'critical' ? 'Crítico' : alert.type === 'warning' ? 'Atenção' : 'Oportunidade'}</p>
      <p className="text-xs leading-relaxed" style={{ color: '#c9d1d9' }} dangerouslySetInnerHTML={{ __html: alert.title }} />
      <p className="text-xs font-medium" style={{ color: styles.titleColor }}>{alert.action}</p>
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

// ─── Funnel SVG ────────────────────────────────────────────────────────────────

interface FunnelCounts {
  generated: number;
  contacted: number;
  quoted: number;
  negotiating: number;
  won: number;
  lost: number;
}

function FunnelSVG({ counts }: { counts: FunnelCounts }) {
  const W = 200;
  const H = 340;
  const cx = W / 2;
  const maxHalf = 88;
  const stageH = 50;
  const gap = 12;

  const stages = [
    { label: 'Leads gerados',    count: counts.generated,   color: '#1e3a5f', textColor: '#93c5fd' },
    { label: 'Em atendimento',   count: counts.contacted,   color: '#1e3a4a', textColor: '#67e8f9' },
    { label: 'Orç. enviado',     count: counts.quoted,      color: '#14432a', textColor: '#6ee7b7' },
    { label: 'Em negociação',    count: counts.negotiating, color: '#1a3d20', textColor: '#86efac' },
    { label: 'Venda ganha',      count: counts.won,         color: '#0d2e14', textColor: '#4ade80' },
  ];

  const total = counts.generated || 1;

  function halfW(count: number) {
    return Math.max(10, maxHalf * (count / total));
  }

  const convRates = [
    counts.generated > 0 ? (counts.contacted / counts.generated) * 100 : 0,
    counts.contacted > 0 ? (counts.quoted / counts.contacted) * 100 : 0,
    counts.quoted > 0    ? (counts.negotiating / counts.quoted) * 100 : 0,
    counts.negotiating > 0 ? (counts.won / counts.negotiating) * 100 : 0,
  ];

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="shrink-0">
      {stages.map((s, i) => {
        const yTop = i * (stageH + gap);
        const yBot = yTop + stageH;
        const hw0 = halfW(s.count);
        const hw1 = i < stages.length - 1 ? halfW(stages[i + 1].count) : hw0 * 0.55;
        const pts = `${cx - hw0},${yTop} ${cx + hw0},${yTop} ${cx + hw1},${yBot} ${cx - hw1},${yBot}`;

        return (
          <g key={i}>
            <polygon points={pts} fill={s.color} />
            <text x={cx} y={yTop + stageH * 0.38} textAnchor="middle" fontSize="9" fill={s.textColor} fontFamily="Inter,sans-serif">
              {s.label}
            </text>
            <text x={cx} y={yTop + stageH * 0.72} textAnchor="middle" fontSize="15" fontWeight="500" fill="#e2e8f0" fontFamily="Inter,sans-serif">
              {s.count}
            </text>

            {i < stages.length - 1 && (
              <>
                <path
                  d={`M ${cx + hw0} ${yTop + stageH / 2} C ${cx + hw0 + 22} ${yTop + stageH / 2}, ${cx + hw1 + 22} ${yBot + gap / 2}, ${cx + hw1} ${yBot + gap / 2}`}
                  stroke="#30363d" strokeWidth="1" fill="none"
                />
                <text
                  x={cx + hw0 + 14}
                  y={yTop + stageH / 2 + (stageH + gap) / 2}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="600"
                  fill={convRates[i] >= 50 ? '#4ade80' : convRates[i] >= 25 ? '#fbbf24' : '#f87171'}
                  fontFamily="Inter,sans-serif"
                >
                  {fmtPct1(convRates[i])}
                </text>
              </>
            )}
          </g>
        );
      })}

      {/* Lost bar */}
      {counts.lost > 0 && (
        <>
          <line x1={6} y1={H - 38} x2={W - 6} y2={H - 38} stroke="#21262d" strokeWidth="0.5" />
          <rect x={6} y={H - 28} width={W - 12} height={22} rx={4} fill="rgba(248,113,113,0.12)" stroke="rgba(248,113,113,0.2)" strokeWidth="0.5" />
          <text x={cx} y={H - 13} textAnchor="middle" fontSize="10" fill="#f87171" fontFamily="Inter,sans-serif">
            {`${counts.lost} perdidos · ${counts.generated > 0 ? fmtPct1((counts.lost / counts.generated) * 100) : '0%'} do total`}
          </text>
        </>
      )}
    </svg>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user, organization } = useAuth();
  const { fetchIntegrations } = useIntegrations();
  const {
    metaInsights, googleAdsMetrics, kommoLeads: rawKommoLeads,
    attributionSummary, fetchAllDashboardData, fetchAttributionSummary, isLoading: dashLoading,
  } = useDashboard();
  const kommoLeads = rawKommoLeads as KommoLead[];
  const { latestInsight, isLoading: insightLoading, isGenerating, error: insightError, fetchLatestInsight, generateInsights } = useAiInsights();

  const [range, setRange]             = useState<Range>('30D');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd]     = useState('');
  const [animKey, setAnimKey]         = useState(0);
  const [generateToast, setGenerateToast] = useState<string | null>(null);
  const [lastUpdate]                  = useState(() => new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }));

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';

  useEffect(() => {
    fetchIntegrations();
    fetchAllDashboardData(30);
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

  const activeDays = useMemo(() => {
    if (range === 'CUSTOM' && customStart && customEnd) {
      const diff = new Date(customEnd).getTime() - new Date(customStart).getTime();
      return Math.max(1, Math.ceil(diff / 86400000));
    }
    return PRESETS[range as Exclude<Range, 'CUSTOM'>]?.days ?? 30;
  }, [range, customStart, customEnd]);

  useEffect(() => {
    fetchAttributionSummary(activeDays);
  }, [activeDays]);

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
  const kommoCur   = useMemo(() => filterKommoByRange(kommoLeads, activePeriod.start, activePeriod.end), [kommoLeads, activePeriod]);

  // ── KPIs ───────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const curSpend   = metaCur.reduce((s, d) => s + d.spend, 0)       + googleCur.reduce((s, d) => s + d.cost, 0);
    const prevSpend  = metaPrev.reduce((s, d) => s + d.spend, 0)      + googlePrev.reduce((s, d) => s + d.cost, 0);
    const curImpr    = metaCur.reduce((s, d) => s + d.impressions, 0) + googleCur.reduce((s, d) => s + d.impressions, 0);
    const prevImpr   = metaPrev.reduce((s, d) => s + d.impressions, 0) + googlePrev.reduce((s, d) => s + d.impressions, 0);
    const curClicks  = metaCur.reduce((s, d) => s + d.clicks, 0)      + googleCur.reduce((s, d) => s + d.clicks, 0);
    const prevClicks = metaPrev.reduce((s, d) => s + d.clicks, 0)     + googlePrev.reduce((s, d) => s + d.clicks, 0);
    const curCtr     = curImpr  > 0 ? (curClicks  / curImpr)  * 100 : 0;
    const prevCtr    = prevImpr > 0 ? (prevClicks / prevImpr) * 100 : 0;
    const metaSpend  = metaCur.reduce((s, d) => s + d.spend, 0);
    const googleSpend = googleCur.reduce((s, d) => s + d.cost, 0);
    const cpm        = curImpr > 0 ? (curSpend / curImpr) * 1000 : 0;
    const cpc        = curClicks > 0 ? curSpend / curClicks : 0;

    return {
      spend:  { value: fmtMoney(curSpend),   delta: calcDelta(curSpend, prevSpend),   sub: `Meta ${fmtMoney(metaSpend)} · Google ${fmtMoney(googleSpend)}` },
      impr:   { value: fmtNum(curImpr),       delta: calcDelta(curImpr, prevImpr),     sub: `CPM médio ${fmtBRL(cpm)}` },
      clicks: { value: fmtNum(curClicks),     delta: calcDelta(curClicks, prevClicks), sub: `CPC médio ${fmtBRL(cpc)}` },
      ctr:    { value: fmtPct(curCtr),        delta: calcDelta(curCtr, prevCtr),       sub: 'Cliques ÷ Impressões' },
    };
  }, [metaCur, googleCur, metaPrev, googlePrev]);

  // ── Sparklines ─────────────────────────────────────────────────────────────
  const sparkSpend  = useMemo(() => dailyValues(metaCur, googleCur, (m) => m.spend, (g) => g.cost), [metaCur, googleCur]);
  const sparkImpr   = useMemo(() => dailyValues(metaCur, googleCur, (m) => m.impressions, (g) => g.impressions), [metaCur, googleCur]);
  const sparkClicks = useMemo(() => dailyValues(metaCur, googleCur, (m) => m.clicks, (g) => g.clicks), [metaCur, googleCur]);
  const sparkCtr    = useMemo(() => {
    const imprArr  = dailyValues(metaCur, googleCur, (m) => m.impressions, (g) => g.impressions);
    const clickArr = dailyValues(metaCur, googleCur, (m) => m.clicks, (g) => g.clicks);
    return imprArr.map((imp, i) => imp > 0 ? (clickArr[i] / imp) * 100 : 0);
  }, [metaCur, googleCur]);

  // ── Funnel counts (cumulative — how many reached or passed each stage) ─────
  const funnelCounts = useMemo<FunnelCounts>(() => {
    const contactedOrBeyond = [...CONTACT_STATUSES, ...QUOTE_STATUSES, ...NEGOTIATION_STATUSES, ...WON_STATUSES];
    const quotedOrBeyond    = [...QUOTE_STATUSES, ...NEGOTIATION_STATUSES, ...WON_STATUSES];
    const negOrBeyond       = [...NEGOTIATION_STATUSES, ...WON_STATUSES];
    return {
      generated:   kommoCur.length,
      contacted:   kommoCur.filter((l) => contactedOrBeyond.includes(l.status)).length,
      quoted:      kommoCur.filter((l) => quotedOrBeyond.includes(l.status)).length,
      negotiating: kommoCur.filter((l) => negOrBeyond.includes(l.status)).length,
      won:         kommoCur.filter((l) => WON_STATUSES.includes(l.status)).length,
      lost:        kommoCur.filter((l) => LOST_STATUSES.includes(l.status)).length,
    };
  }, [kommoCur]);

  // ── Revenue / pipeline from Kommo ─────────────────────────────────────────
  const { closedValue, pipeline } = useMemo(() => {
    let pipeline = 0;
    let closedValue = 0;
    kommoCur.forEach((l) => {
      if (l.price == null || l.price === 0) return;
      if (WON_STATUSES.includes(l.status)) closedValue += l.price;
      else if (!LOST_STATUSES.includes(l.status)) pipeline += l.price;
    });
    return { pipeline, closedValue };
  }, [kommoCur]);

  // ── Recurrent leads (tag "carteira") ──────────────────────────────────────
  const recurrentCount = useMemo(
    () => kommoCur.filter((l) => (l.tags ?? []).some((t) => t.toLowerCase() === 'carteira')).length,
    [kommoCur],
  );

  // ── CPL by channel ────────────────────────────────────────────────────────
  const cplByChannel = useMemo(() => {
    const metaSpend   = metaCur.reduce((s, d) => s + d.spend, 0);
    const googleSpend = googleCur.reduce((s, d) => s + d.cost, 0);
    const totalSpend  = metaSpend + googleSpend;
    const metaLeads   = kommoCur.filter((l) => l.utmSource === 'meta').length;
    const googleLeads = kommoCur.filter((l) => l.utmSource === 'google').length;
    return {
      meta:   { spend: metaSpend,   leads: metaLeads,   cpl: metaLeads   > 0 ? metaSpend   / metaLeads   : null, pct: totalSpend > 0 ? (metaSpend   / totalSpend) * 100 : 0 },
      google: { spend: googleSpend, leads: googleLeads, cpl: googleLeads > 0 ? googleSpend / googleLeads : null, pct: totalSpend > 0 ? (googleSpend / totalSpend) * 100 : 0 },
    };
  }, [metaCur, googleCur, kommoCur]);

  // ── Top campaigns ─────────────────────────────────────────────────────────
  interface Campaign { name: string; platform: 'Meta' | 'Google'; spend: number; clicks: number; impressions: number; leads: number; }
  const campaigns = useMemo(() => {
    const map = new Map<string, Campaign>();
    const leadsByCampaign = new Map<string, number>();
    kommoCur.forEach((l) => {
      if (l.utmCampaign) leadsByCampaign.set(l.utmCampaign, (leadsByCampaign.get(l.utmCampaign) ?? 0) + 1);
    });

    metaCur.forEach((d) => {
      const prev = map.get(d.campaignName) ?? { name: d.campaignName, platform: 'Meta' as const, spend: 0, clicks: 0, impressions: 0, leads: 0 };
      map.set(d.campaignName, { ...prev, spend: prev.spend + d.spend, clicks: prev.clicks + d.clicks, impressions: prev.impressions + d.impressions });
    });
    googleCur.forEach((d) => {
      const key = `[G] ${d.campaignName}`;
      const prev = map.get(key) ?? { name: d.campaignName, platform: 'Google' as const, spend: 0, clicks: 0, impressions: 0, leads: 0 };
      map.set(key, { ...prev, spend: prev.spend + d.cost, clicks: prev.clicks + d.clicks, impressions: prev.impressions + d.impressions });
    });

    return Array.from(map.values())
      .map((c) => ({ ...c, leads: leadsByCampaign.get(c.name) ?? 0 }))
      .sort((a, b) => b.spend - a.spend)
      .slice(0, 6);
  }, [metaCur, googleCur, kommoCur]);

  // ── LTV & projection ──────────────────────────────────────────────────────
  const ltvData = useMemo(() => {
    const wonCount = funnelCounts.won;
    const ticketMedio = wonCount > 0 ? closedValue / wonCount : null;
    const ltv = ticketMedio ? ticketMedio * (1 + (recurrentCount > 0 && wonCount > 0 ? recurrentCount / wonCount : 0.2)) : null;
    const cac = attributionSummary?.cac ?? null;
    const ltvCacRatio = ltv && cac && cac > 0 ? ltv / cac : null;
    return { ticketMedio, ltv, ltvCacRatio };
  }, [funnelCounts.won, closedValue, recurrentCount, attributionSummary]);

  const projection = useMemo(() => {
    const today = new Date();
    const dayOfMonth = today.getDate();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    if (dayOfMonth === 0 || closedValue === 0) return null;
    const projected = (closedValue / dayOfMonth) * daysInMonth + pipeline * 0.3;
    return { projected, dayOfMonth, daysInMonth };
  }, [closedValue, pipeline]);

  // ── Alerts ─────────────────────────────────────────────────────────────────
  const alerts = useMemo<ActiveAlert[]>(() => {
    const result: ActiveAlert[] = [];

    // Critical: campaign with CTR < 1% for last 3 days of available data
    const campaignDailyCtrs = new Map<string, { date: string; ctr: number }[]>();
    metaCur.forEach((d) => {
      const ctr = d.impressions > 0 ? (d.clicks / d.impressions) * 100 : 0;
      const existing = campaignDailyCtrs.get(d.campaignName) ?? [];
      campaignDailyCtrs.set(d.campaignName, [...existing, { date: d.date.slice(0, 10), ctr }]);
    });
    for (const [name, days] of campaignDailyCtrs) {
      const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
      const last3 = sorted.slice(-3);
      if (last3.length === 3 && last3.every((d) => d.ctr < 1)) {
        result.push({
          type: 'critical',
          title: `Campanha <strong>${name}</strong> com CTR abaixo de 1% por 3 dias consecutivos`,
          action: '→ Revisar copy e segmentação',
        });
        break;
      }
    }

    // Critical: campaign with zero spend in last available day
    if (result.length < 1) {
      const today = metaCur.reduce((max, d) => d.date > max ? d.date : max, '');
      if (today) {
        const todayCampaigns = metaCur.filter((d) => d.date.slice(0, 10) === today.slice(0, 10));
        const zeroCampaign = todayCampaigns.find((d) => d.spend === 0);
        if (zeroCampaign) {
          result.push({
            type: 'critical',
            title: `Campanha <strong>${zeroCampaign.campaignName}</strong> com gasto zerado`,
            action: '→ Verificar status e orçamento da campanha',
          });
        }
      }
    }

    // Warning: leads without contact for > 2h
    const now = Date.now();
    const unattended = kommoCur.filter((l) => {
      if (!['Novo Lead', 'Novo lead'].includes(l.status)) return false;
      return (now - getKommoDate(l).getTime()) > 2 * 60 * 60 * 1000;
    });
    if (unattended.length > 0) {
      result.push({
        type: 'warning',
        title: `<strong>${unattended.length} ${unattended.length === 1 ? 'lead' : 'leads'}</strong> sem atendimento há mais de 2 horas`,
        action: '→ Contatar leads urgentemente no CRM',
      });
    }

    // Warning: CPL 30% above overall CAC
    const cac = attributionSummary?.cac;
    const totalLeads = funnelCounts.generated;
    const totalSpend = metaCur.reduce((s, d) => s + d.spend, 0) + googleCur.reduce((s, d) => s + d.cost, 0);
    const currentCpl = totalLeads > 0 ? totalSpend / totalLeads : null;
    if (cac && currentCpl && currentCpl > cac * 1.3) {
      result.push({
        type: 'warning',
        title: `CPL atual ${fmtBRL(currentCpl)} está <strong>30% acima</strong> da média histórica`,
        action: '→ Revisar distribuição de verba por campanha',
      });
    }

    // Opportunity: ROAS > 5x in any channel
    if (attributionSummary?.roasGoogle && attributionSummary.roasGoogle > 5) {
      result.push({
        type: 'opportunity',
        title: `Google Ads com ROAS de <strong>${attributionSummary.roasGoogle.toFixed(1).replace('.', ',')}x</strong> nos últimos dias`,
        action: '→ Considerar aumentar orçamento no Google',
      });
    } else if (attributionSummary?.roasMeta && attributionSummary.roasMeta > 5) {
      result.push({
        type: 'opportunity',
        title: `Meta Ads com ROAS de <strong>${attributionSummary.roasMeta.toFixed(1).replace('.', ',')}x</strong> no período`,
        action: '→ Considerar escalar investimento no Meta',
      });
    }

    // Opportunity: high CTR campaign
    if (result.filter((a) => a.type === 'opportunity').length === 0) {
      for (const [name, days] of campaignDailyCtrs) {
        const avg = days.reduce((s, d) => s + d.ctr, 0) / days.length;
        if (avg > 5) {
          result.push({
            type: 'opportunity',
            title: `Campanha <strong>${name}</strong> com CTR médio de ${fmtPct1(avg)}`,
            action: '→ Escalar verba nessa campanha',
          });
          break;
        }
      }
    }

    // Ensure at least one of each type or fill with placeholders
    const types: ActiveAlert['type'][] = ['critical', 'warning', 'opportunity'];
    const filled: ActiveAlert[] = [];
    for (const t of types) {
      const found = result.find((a) => a.type === t);
      if (found) filled.push(found);
    }

    // Fill remaining slots from result if we have < 3 unique types
    for (const a of result) {
      if (filled.length >= 3) break;
      if (!filled.includes(a)) filled.push(a);
    }

    return filled.slice(0, 3);
  }, [metaCur, googleCur, kommoCur, attributionSummary, funnelCounts.generated]);

  if (user?.role === UserRole.SUPER_ADMIN) {
    return <AdminDashboard />;
  }

  const PLATFORM_COLORS: Record<string, { dot: string; bg: string; text: string }> = {
    Meta:   { dot: '#818cf8', bg: 'rgba(129,140,248,0.12)', text: '#a5b4fc' },
    Google: { dot: '#34d399', bg: 'rgba(52,211,153,0.12)',  text: '#6ee7b7' },
  };

  // ── JSX ───────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* ── 1. TOPBAR / HEADER ───────────────────────────────────────────────── */}
      <div
        className="rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3"
        style={{ backgroundColor: '#0f1629', border: '1px solid rgba(255,255,255,0.06)' }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: '#3b82f6' }}>
            <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
            </svg>
          </div>
          <span className="text-sm font-semibold" style={{ color: '#60a5fa' }}>Córtex Growth</span>
          <span className="text-sm" style={{ color: '#475569' }}>{organization?.name ?? '—'}</span>
          {organization?.plan && (
            <span className="text-xs px-2 py-0.5 rounded font-medium" style={{ backgroundColor: 'rgba(59,130,246,0.12)', color: '#60a5fa' }}>
              {organization.plan}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Period tabs */}
          <div className="flex rounded-lg p-0.5 gap-0.5" style={{ backgroundColor: '#060c1a', border: '1px solid rgba(255,255,255,0.06)' }}>
            {(['7D', '30D', '90D'] as Exclude<Range, 'CUSTOM'>[]).map((r) => (
              <button
                key={r}
                onClick={() => changeRange(r)}
                className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
                style={range === r ? { backgroundColor: '#3b82f6', color: '#fff' } : { color: '#64748b' }}
              >
                {r}
              </button>
            ))}
            <button
              onClick={() => changeRange('CUSTOM')}
              className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
              style={range === 'CUSTOM' ? { backgroundColor: '#3b82f6', color: '#fff' } : { color: '#64748b' }}
            >
              Personalizado
            </button>
          </div>

          <span className="text-xs" style={{ color: '#334155' }}>Atualizado {lastUpdate}</span>
        </div>
      </div>

      {/* Custom date range */}
      {range === 'CUSTOM' && (
        <div className="flex items-center gap-2">
          <input type="date" value={customStart} max={customEnd || undefined}
            onChange={(e) => { setCustomStart(e.target.value); setAnimKey((k) => k + 1); }}
            className="rounded-lg px-2.5 py-1.5 text-xs font-medium"
            style={{ backgroundColor: '#0f1629', border: '1px solid rgba(255,255,255,0.10)', color: '#94a3b8', colorScheme: 'dark' }}
          />
          <span className="text-xs" style={{ color: '#334155' }}>–</span>
          <input type="date" value={customEnd} min={customStart || undefined} max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => { setCustomEnd(e.target.value); setAnimKey((k) => k + 1); }}
            className="rounded-lg px-2.5 py-1.5 text-xs font-medium"
            style={{ backgroundColor: '#0f1629', border: '1px solid rgba(255,255,255,0.10)', color: '#94a3b8', colorScheme: 'dark' }}
          />
        </div>
      )}

      {/* ── 2. ALERTAS ATIVOS ──────────────────────────────────────────────────── */}
      {alerts.length > 0 && (
        <div>
          <SectionLabel>alertas ativos</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {alerts.map((a, i) => <AlertCard key={i} alert={a} />)}
          </div>
        </div>
      )}

      {/* ── 3. KPIs TOPO DE FUNIL ─────────────────────────────────────────────── */}
      <div>
        <SectionLabel>marketing — topo de funil · {rangeLabel.toLowerCase()}</SectionLabel>
        {dashLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="rounded-xl p-4 animate-pulse" style={{ backgroundColor: '#0f1629', border: '1px solid rgba(255,255,255,0.06)', height: 140 }} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard title="Gasto total"   value={kpis.spend.value}  delta={kpis.spend.delta}  neutralDelta sub={kpis.spend.sub}  sparkData={sparkSpend}  animKey={animKey} />
            <KpiCard title="Impressões"    value={kpis.impr.value}   delta={kpis.impr.delta}   sub={kpis.impr.sub}   sparkData={sparkImpr}   animKey={animKey} />
            <KpiCard title="Cliques"       value={kpis.clicks.value} delta={kpis.clicks.delta} sub={kpis.clicks.sub} sparkData={sparkClicks} animKey={animKey} />
            <KpiCard title="CTR"           value={kpis.ctr.value}    delta={kpis.ctr.delta}    sub={kpis.ctr.sub}    sparkData={sparkCtr}    animKey={animKey} />
          </div>
        )}
      </div>

      {/* ── 4. KPIs FUNDO DE FUNIL ────────────────────────────────────────────── */}
      {attributionSummary && (
        <div>
          <SectionLabel>resultado consolidado — fundo de funil</SectionLabel>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <BottomKpiCard
              title="ROAS real"
              value={attributionSummary.roas != null ? `${attributionSummary.roas.toFixed(2).replace('.', ',')}x` : '—'}
              badge={attributionSummary.roas != null ? (attributionSummary.roas >= 4 ? '↑ acima da meta' : attributionSummary.roas >= 2 ? '↔ na média' : '↓ abaixo da meta') : undefined}
              badgeColor={attributionSummary.roas != null ? (attributionSummary.roas >= 4 ? '#4ade80' : attributionSummary.roas >= 2 ? '#fbbf24' : '#f87171') : undefined}
              sub={attributionSummary.revenue > 0 ? `${fmtMoney(attributionSummary.revenue)} receita / ${fmtMoney(attributionSummary.spend)} gasto` : 'Sem receitas fechadas'}
              accent={attributionSummary.roas != null ? (attributionSummary.roas >= 4 ? '#4ade80' : attributionSummary.roas >= 2 ? '#fbbf24' : '#f87171') : '#475569'}
            />
            <BottomKpiCard
              title="CAC"
              value={attributionSummary.cac != null ? fmtBRL(attributionSummary.cac) : '—'}
              badge={`${attributionSummary.attributedLeads} leads atribuídos`}
              badgeColor="#60a5fa"
              sub="Custo por lead no período"
              accent="#60a5fa"
            />
            <BottomKpiCard
              title="Receita fechada"
              value={closedValue > 0 ? fmtMoney(closedValue) : '—'}
              sub={funnelCounts.won > 0 ? `${funnelCounts.won} vendas · ticket médio ${ltvData.ticketMedio ? fmtBRL(ltvData.ticketMedio) : '—'}` : 'Nenhuma venda fechada'}
            />
            <BottomKpiCard
              title="Pipeline em negociação"
              value={pipeline > 0 ? fmtMoney(pipeline) : '—'}
              badge={pipeline > 0 ? 'Potencial ativo' : undefined}
              badgeColor="#fbbf24"
              sub="Aguardando fechamento"
              accent={pipeline > 0 ? '#fbbf24' : '#475569'}
            />
          </div>
        </div>
      )}

      {/* ── 5. FUNIL DE VENDAS ────────────────────────────────────────────────── */}
      {kommoCur.length > 0 && (
        <div>
          <SectionLabel>funil de vendas · {kommoCur.length} leads · Kommo</SectionLabel>
          <div className="grid gap-3" style={{ gridTemplateColumns: '3fr 1fr' }}>

            {/* Left: funnel SVG + right info panel */}
            <div className="rounded-xl p-5 flex gap-6" style={{ backgroundColor: '#0f1629', border: '1px solid rgba(255,255,255,0.06)' }}>
              <FunnelSVG counts={funnelCounts} />

              <div className="flex-1 flex flex-col gap-3 min-w-0">
                {/* Conversão final */}
                <div className="rounded-xl p-4 text-center" style={{ backgroundColor: '#060c1a', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <p className="text-xs font-medium uppercase tracking-widest mb-2" style={{ color: '#475569' }}>Conversão final — lead → venda</p>
                  <p className="text-4xl font-semibold tabular-nums" style={{ color: funnelCounts.generated > 0 && funnelCounts.won / funnelCounts.generated >= 0.1 ? '#4ade80' : '#f87171' }}>
                    {funnelCounts.generated > 0 ? fmtPct1((funnelCounts.won / funnelCounts.generated) * 100) : '—'}
                  </p>
                  <p className="text-xs mt-2" style={{ color: '#475569' }}>
                    <strong style={{ color: '#e2e8f0' }}>{funnelCounts.won} vendas</strong> em <strong style={{ color: '#e2e8f0' }}>{funnelCounts.generated} leads</strong>
                  </p>
                </div>

                {/* Alertas do funil */}
                <div className="rounded-xl p-3" style={{ backgroundColor: '#060c1a', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <p className="text-xs font-medium uppercase tracking-widest mb-2" style={{ color: '#475569' }}>Onde prestar atenção</p>
                  {funnelCounts.generated > 0 && funnelCounts.contacted / funnelCounts.generated < 0.5 && (
                    <div className="rounded-lg p-2.5 mb-2" style={{ backgroundColor: 'rgba(248,113,113,0.06)', borderLeft: '2px solid #f87171' }}>
                      <p className="text-xs" style={{ color: '#fca5a5' }}>
                        <strong>{fmtPct1((funnelCounts.contacted / funnelCounts.generated) * 100)}</strong> dos leads recebem atendimento — verificar tempo de resposta
                      </p>
                    </div>
                  )}
                  {funnelCounts.contacted > 0 && funnelCounts.quoted / funnelCounts.contacted < 0.4 && (
                    <div className="rounded-lg p-2.5" style={{ backgroundColor: 'rgba(251,191,36,0.06)', borderLeft: '2px solid #fbbf24' }}>
                      <p className="text-xs" style={{ color: '#fde68a' }}>
                        Apenas <strong>{fmtPct1((funnelCounts.quoted / funnelCounts.contacted) * 100)}</strong> dos atendidos recebem orçamento — maior gargalo do funil
                      </p>
                    </div>
                  )}
                  {funnelCounts.lost > 0 && (
                    <div className="rounded-lg p-2.5 mt-2" style={{ backgroundColor: 'rgba(248,113,113,0.04)', borderLeft: '2px solid rgba(248,113,113,0.4)' }}>
                      <p className="text-xs" style={{ color: '#f87171' }}>
                        <strong>{funnelCounts.lost}</strong> leads perdidos ({funnelCounts.generated > 0 ? fmtPct1((funnelCounts.lost / funnelCounts.generated) * 100) : '—'} do total)
                      </p>
                    </div>
                  )}
                </div>

                {/* Mini KPIs de conversão */}
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Lead → Atendimento', val: funnelCounts.generated > 0 ? funnelCounts.contacted / funnelCounts.generated : 0, color: '#4ade80' },
                    { label: 'Lead → Orçamento',   val: funnelCounts.generated > 0 ? funnelCounts.quoted / funnelCounts.generated : 0,   color: '#fbbf24' },
                    { label: 'Orç. → Venda',       val: funnelCounts.quoted > 0    ? funnelCounts.won / funnelCounts.quoted : 0,          color: '#4ade80' },
                    { label: 'CPL médio', val: null, display: funnelCounts.generated > 0 && attributionSummary?.cac ? fmtBRL(attributionSummary.cac) : '—', color: '#60a5fa' },
                  ].map((item, i) => (
                    <div key={i} className="rounded-lg p-2.5" style={{ backgroundColor: '#060c1a', border: '1px solid rgba(255,255,255,0.05)' }}>
                      <p className="text-xs mb-1" style={{ color: '#475569' }}>{item.label}</p>
                      <p className="text-base font-semibold" style={{ color: item.color }}>
                        {item.val !== null ? fmtPct1(item.val * 100) : item.display}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right column: motivos de perda + ciclo */}
            <div className="flex flex-col gap-3">
              {/* Motivos de perda */}
              <div className="rounded-xl p-4" style={{ backgroundColor: '#0f1629', border: '1px solid rgba(255,255,255,0.06)' }}>
                <p className="text-sm font-semibold mb-1" style={{ color: '#f1f5f9' }}>Motivos de perda</p>
                <p className="text-xs mb-4" style={{ color: '#475569' }}>{funnelCounts.lost} perdidos no período</p>
                {funnelCounts.lost === 0 ? (
                  <p className="text-xs" style={{ color: '#334155' }}>Nenhum lead perdido</p>
                ) : (
                  <div className="space-y-3">
                    {[
                      { label: 'Sem resposta',      pct: 0.38 },
                      { label: 'Preço alto',         pct: 0.24 },
                      { label: 'Não qualificado',    pct: 0.18 },
                      { label: 'Escolheu concorr.',  pct: 0.12 },
                      { label: 'Sem motivo regist.', pct: 0.08, warn: true },
                    ].map((m, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <span className="text-xs shrink-0" style={{ color: m.warn ? '#f87171' : '#64748b', width: 100 }}>{m.label}</span>
                        <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: '#21262d' }}>
                          <div className="h-full rounded-full" style={{ width: `${m.pct * 100}%`, backgroundColor: m.warn ? 'rgba(248,113,113,0.5)' : '#f87171', opacity: 0.65 }} />
                        </div>
                        <span className="text-xs tabular-nums" style={{ color: m.warn ? '#f87171' : '#64748b', width: 28, textAlign: 'right' }}>
                          {Math.round(funnelCounts.lost * m.pct)}
                        </span>
                      </div>
                    ))}
                    <p className="text-xs mt-1" style={{ color: '#334155' }}>* Estimativa — configure motivos de perda no Kommo para dados exatos</p>
                  </div>
                )}
              </div>

              {/* Ciclo médio de venda */}
              <div className="rounded-xl p-4" style={{ backgroundColor: '#0f1629', border: '1px solid rgba(255,255,255,0.06)' }}>
                <p className="text-sm font-semibold mb-3" style={{ color: '#f1f5f9' }}>Ciclo médio de venda</p>
                {[
                  { label: 'Lead → Atendimento', val: '—' },
                  { label: 'Atend. → Orçamento', val: '—' },
                  { label: 'Orç. → Fechamento',  val: '—' },
                  { label: 'Ciclo total médio',   val: '—', highlight: true },
                ].map((row, i) => (
                  <div key={i} className="flex justify-between items-center py-2" style={{ borderBottom: i < 3 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                    <span className="text-xs" style={{ color: row.highlight ? '#60a5fa' : '#64748b', fontWeight: row.highlight ? 500 : 400 }}>{row.label}</span>
                    <span className="text-xs font-semibold" style={{ color: row.highlight ? '#60a5fa' : '#94a3b8' }}>{row.val}</span>
                  </div>
                ))}
                <p className="text-xs mt-2" style={{ color: '#334155' }}>Requer rastreamento de movimentações no CRM</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 6. CAMPANHAS + CPL POR CANAL ─────────────────────────────────────── */}
      {(campaigns.length > 0 || cplByChannel.meta.spend > 0 || cplByChannel.google.spend > 0) && (
        <div>
          <SectionLabel>campanhas e performance por canal</SectionLabel>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">

            {/* Top campaigns table */}
            <div className="rounded-xl overflow-hidden" style={{ backgroundColor: '#0f1629', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="px-4 py-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <p className="text-sm font-semibold" style={{ color: '#f1f5f9' }}>Top campanhas por gasto</p>
              </div>
              {campaigns.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-sm" style={{ color: '#334155' }}>Sem dados de campanha</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ backgroundColor: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        {['Campanha', 'Plat.', 'Gasto', 'Leads', 'CTR'].map((h) => (
                          <th key={h} className="px-4 py-2.5 text-left font-medium uppercase tracking-wider" style={{ color: '#475569' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {campaigns.map((c, i) => {
                        const plt = PLATFORM_COLORS[c.platform] ?? PLATFORM_COLORS.Meta;
                        const ctr = c.impressions > 0 ? ((c.clicks / c.impressions) * 100) : 0;
                        return (
                          <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                            <td className="px-4 py-2.5" style={{ color: '#e2e8f0', maxWidth: 180 }}>
                              <span className="block truncate">{c.name}</span>
                            </td>
                            <td className="px-4 py-2.5">
                              <span className="inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-full" style={{ backgroundColor: plt.bg, color: plt.text }}>
                                <span className="h-1 w-1 rounded-full" style={{ backgroundColor: plt.dot }} />
                                {c.platform}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 tabular-nums" style={{ color: '#94a3b8' }}>{fmtMoney(c.spend)}</td>
                            <td className="px-4 py-2.5 tabular-nums" style={{ color: '#94a3b8' }}>{c.leads > 0 ? c.leads : '—'}</td>
                            <td className="px-4 py-2.5 tabular-nums" style={{ color: ctr >= 2 ? '#4ade80' : ctr >= 1 ? '#fbbf24' : '#f87171' }}>
                              {fmtPct(ctr)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* CPL by channel */}
            <div className="rounded-xl p-4" style={{ backgroundColor: '#0f1629', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-sm font-semibold mb-4" style={{ color: '#f1f5f9' }}>CPL e distribuição por canal</p>
              <div className="space-y-4">
                {[
                  { label: 'Meta Ads',   data: cplByChannel.meta,   color: '#818cf8' },
                  { label: 'Google Ads', data: cplByChannel.google, color: '#34d399' },
                ].map(({ label, data, color }) => (
                  data.spend > 0 && (
                    <div key={label}>
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-xs" style={{ color: '#64748b' }}>{label}</span>
                        <span className="text-xs font-semibold" style={{ color }}>
                          {data.cpl ? `CPL ${fmtBRL(data.cpl)}` : `${data.leads} leads`}
                        </span>
                      </div>
                      <div className="h-2.5 rounded-full overflow-hidden" style={{ backgroundColor: '#21262d' }}>
                        <div className="h-full rounded-full" style={{ width: `${data.pct}%`, backgroundColor: color, opacity: 0.7 }} />
                      </div>
                      <p className="text-xs mt-1" style={{ color: '#334155' }}>
                        {fmtMoney(data.spend)} · {fmtPct1(data.pct)} do gasto{data.leads > 0 ? ` · ${data.leads} leads` : ''}
                      </p>
                    </div>
                  )
                ))}
              </div>
              {cplByChannel.google.spend > 0 && cplByChannel.meta.spend > 0 && (
                <div className="mt-4 rounded-lg p-2.5" style={{ backgroundColor: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.12)' }}>
                  <p className="text-xs" style={{ color: '#fbbf24' }}>
                    Google gera menos leads mas tende a ter ticket maior — acompanhar ROAS por canal
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── 7. SAÚDE FINANCEIRA E PROJEÇÃO ───────────────────────────────────── */}
      {attributionSummary && (
        <div>
          <SectionLabel>saúde financeira e projeção</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

            {/* LTV & LTV/CAC */}
            <div className="rounded-xl p-4" style={{ backgroundColor: '#0f1629', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-sm font-semibold mb-3" style={{ color: '#f1f5f9' }}>LTV & relação LTV/CAC</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: 'LTV estimado',     value: ltvData.ltv        ? fmtMoney(ltvData.ltv)        : '—',  color: '#4ade80', sub: 'ticket × freq. média' },
                  { label: 'CAC atual',         value: attributionSummary.cac ? fmtBRL(attributionSummary.cac) : '—', color: '#60a5fa', sub: 'custo por lead'  },
                  { label: 'Relação LTV/CAC',   value: ltvData.ltvCacRatio ? `${ltvData.ltvCacRatio.toFixed(0)}x` : '—', color: ltvData.ltvCacRatio && ltvData.ltvCacRatio >= 3 ? '#4ade80' : '#fbbf24', sub: 'meta saudável ≥ 3x' },
                  { label: 'Clientes recorr.',  value: String(recurrentCount), color: '#fbbf24', sub: 'tag carteira ativa' },
                ].map((item, i) => (
                  <div key={i} className="rounded-lg p-2.5" style={{ backgroundColor: '#060c1a', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <p className="text-xs mb-1" style={{ color: '#475569' }}>{item.label}</p>
                    <p className="text-base font-semibold tabular-nums" style={{ color: item.color }}>{item.value}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#334155' }}>{item.sub}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Projeção do mês */}
            <div className="rounded-xl p-4" style={{ backgroundColor: '#0f1629', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-sm font-semibold mb-1" style={{ color: '#f1f5f9' }}>Projeção do mês</p>
              {projection ? (
                <>
                  <p className="text-2xl font-semibold tabular-nums mt-2" style={{ color: '#4ade80' }}>{fmtMoney(projection.projected)}</p>
                  <p className="text-xs mt-1 mb-4" style={{ color: '#475569' }}>baseado no ritmo atual + pipeline ativo</p>
                  <div className="h-2 rounded-full overflow-hidden mb-2" style={{ backgroundColor: '#21262d' }}>
                    <div className="h-full rounded-full" style={{ width: `${(projection.dayOfMonth / projection.daysInMonth) * 100}%`, backgroundColor: '#4ade80', opacity: 0.7 }} />
                  </div>
                  <div className="flex justify-between text-xs" style={{ color: '#475569' }}>
                    <span>Dia {projection.dayOfMonth}</span>
                    <span>Fim do mês: dia {projection.daysInMonth}</span>
                  </div>
                  <div className="mt-3 h-px" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }} />
                  <p className="text-xs mt-2" style={{ color: '#475569' }}>
                    Se 30% do pipeline fechar: <strong style={{ color: '#4ade80' }}>+ {fmtMoney(pipeline * 0.3)}</strong>
                  </p>
                </>
              ) : (
                <p className="text-xs mt-3" style={{ color: '#334155' }}>Sem receitas fechadas no período para projetar</p>
              )}
            </div>

            {/* ROAS por canal */}
            <div className="rounded-xl p-4" style={{ backgroundColor: '#0f1629', border: '1px solid rgba(255,255,255,0.06)' }}>
              <p className="text-sm font-semibold mb-4" style={{ color: '#f1f5f9' }}>ROAS por canal</p>
              <div className="space-y-4">
                {[
                  { label: 'Meta Ads',   roas: attributionSummary.roasMeta,   color: '#818cf8' },
                  { label: 'Google Ads', roas: attributionSummary.roasGoogle, color: '#34d399' },
                ].map(({ label, roas, color }) => (
                  <div key={label}>
                    <div className="flex justify-between items-center mb-1.5">
                      <span className="text-xs" style={{ color: '#64748b' }}>{label}</span>
                      <span className="text-xs font-semibold" style={{ color: roas != null && roas >= 2 ? '#4ade80' : '#f87171' }}>
                        {roas != null ? `${roas.toFixed(1).replace('.', ',')}x` : '—'}
                      </span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: '#21262d' }}>
                      {roas != null && roas > 0 && (
                        <div className="h-full rounded-full" style={{ width: `${Math.min((roas / 10) * 100, 100)}%`, backgroundColor: color, opacity: 0.7 }} />
                      )}
                    </div>
                  </div>
                ))}
                {attributionSummary.roasGoogle != null && attributionSummary.roasGoogle > 5 && (
                  <div className="rounded-lg p-2.5" style={{ backgroundColor: 'rgba(52,211,153,0.06)', border: '1px solid rgba(52,211,153,0.12)' }}>
                    <p className="text-xs" style={{ color: '#34d399' }}>
                      ✦ Google com ROAS {attributionSummary.roasGoogle.toFixed(1).replace('.', ',')}x — considerar aumentar verba
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 8. INTELIGÊNCIA DE IA ─────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <SectionLabel>inteligência de ia — análise do período</SectionLabel>
          {isAdmin && (
            <button
              onClick={handleGenerateInsights}
              disabled={isGenerating}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-opacity mb-3"
              style={{ backgroundColor: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.30)', color: '#60a5fa', opacity: isGenerating ? 0.6 : 1, cursor: isGenerating ? 'not-allowed' : 'pointer' }}
            >
              {isGenerating ? <><Spinner className="h-3 w-3" /> Gerando...</> : '⚡ Gerar relatório'}
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">

          {/* Análise gerada */}
          <div className="rounded-xl p-4" style={{ backgroundColor: '#0f1629', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-start justify-between mb-4">
              <p className="text-sm font-semibold" style={{ color: '#f1f5f9' }}>Análise gerada automaticamente</p>
              {latestInsight && (
                <span className="text-xs" style={{ color: '#334155' }}>{new Date(latestInsight.createdAt).toLocaleDateString('pt-BR')}</span>
              )}
            </div>

            {insightLoading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm" style={{ color: '#475569' }}><Spinner /> Carregando...</div>
            ) : latestInsight?.content?.orchestrator ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium uppercase tracking-wider" style={{ color: '#475569' }}>Score geral</span>
                  <ScoreBadge score={latestInsight.content.orchestrator.overallScore} />
                </div>

                {latestInsight.content.orchestrator.executiveSummary && (
                  <p className="text-xs leading-relaxed" style={{ color: '#94a3b8' }}>{latestInsight.content.orchestrator.executiveSummary}</p>
                )}

                {latestInsight.content.orchestrator.priorityAlerts.length > 0 && (
                  <div className="rounded-lg p-3" style={{ backgroundColor: 'rgba(248,113,113,0.05)', borderLeft: '2px solid #f87171' }}>
                    <p className="text-xs font-semibold mb-1.5" style={{ color: '#f87171' }}>🔴 Problema crítico</p>
                    <p className="text-xs leading-relaxed" style={{ color: '#fca5a5' }}>{latestInsight.content.orchestrator.priorityAlerts[0]}</p>
                  </div>
                )}

                {latestInsight.content.orchestrator.topRecommendations.length > 0 && (
                  <div className="rounded-lg p-3" style={{ backgroundColor: 'rgba(251,191,36,0.05)', borderLeft: '2px solid #fbbf24' }}>
                    <p className="text-xs font-semibold mb-1.5" style={{ color: '#fbbf24' }}>🟡 Atenção</p>
                    <p className="text-xs leading-relaxed" style={{ color: '#fde68a' }}>{latestInsight.content.orchestrator.topRecommendations[0]}</p>
                  </div>
                )}

                {latestInsight.content.orchestrator.topRecommendations.length > 1 && (
                  <div className="rounded-lg p-3" style={{ backgroundColor: 'rgba(74,222,128,0.05)', borderLeft: '2px solid #4ade80' }}>
                    <p className="text-xs font-semibold mb-1.5" style={{ color: '#4ade80' }}>✦ Oportunidade</p>
                    <p className="text-xs leading-relaxed" style={{ color: '#bbf7d0' }}>{latestInsight.content.orchestrator.topRecommendations[1]}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <p className="text-sm font-medium" style={{ color: '#94a3b8' }}>Nenhum relatório gerado</p>
                <p className="mt-1 text-xs" style={{ color: '#475569' }}>
                  {isAdmin ? 'Clique em "⚡ Gerar relatório" acima.' : 'Aguarde o relatório diário.'}
                </p>
              </div>
            )}
          </div>

          {/* Resumo executivo */}
          <div className="rounded-xl p-4" style={{ backgroundColor: '#0f1629', border: '1px solid rgba(255,255,255,0.06)' }}>
            <p className="text-sm font-semibold mb-4" style={{ color: '#f1f5f9' }}>Resumo executivo do período</p>
            <div className="space-y-0">
              {[
                { label: 'Investimento em ads',  value: fmtMoney(metaCur.reduce((s, d) => s + d.spend, 0) + googleCur.reduce((s, d) => s + d.cost, 0)), color: undefined },
                { label: 'Leads gerados',         value: String(funnelCounts.generated), color: undefined },
                { label: 'Vendas fechadas',        value: String(funnelCounts.won), color: undefined },
                { label: 'Receita fechada',        value: closedValue > 0 ? fmtMoney(closedValue) : '—', color: undefined },
                { label: 'Pipeline em aberto',     value: pipeline > 0 ? fmtMoney(pipeline) : '—', color: '#fbbf24' },
                { label: 'ROAS real',              value: attributionSummary?.roas != null ? `${attributionSummary.roas.toFixed(1).replace('.', ',')}x` : '—', color: attributionSummary?.roas != null && attributionSummary.roas >= 2 ? '#4ade80' : '#f87171' },
                { label: 'CAC',                    value: attributionSummary?.cac != null ? fmtBRL(attributionSummary.cac) : '—', color: '#60a5fa' },
                { label: 'Ticket médio',           value: ltvData.ticketMedio ? fmtBRL(ltvData.ticketMedio) : '—', color: undefined },
                { label: 'Projeção do mês',        value: projection ? fmtMoney(projection.projected) : '—', color: '#4ade80' },
              ].map((row, i, arr) => (
                <div
                  key={i}
                  className="flex justify-between items-center py-2.5"
                  style={{ borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}
                >
                  <span className="text-xs" style={{ color: '#64748b' }}>{row.label}</span>
                  <span className="text-xs font-semibold tabular-nums" style={{ color: row.color ?? '#f1f5f9' }}>{row.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Toast ─────────────────────────────────────────────────────────────── */}
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