'use client';

import { useEffect, useState, useMemo } from 'react';
import { useTheme } from 'next-themes';
import { useAuth } from '@/context/AuthContext';
import { useIntegrations, useDashboard, useAiInsights } from '@/hooks/useApi';
import { apiService } from '@/lib/api';
import Sparkline from '@/components/charts/Sparkline';
import AdminDashboard from '@/components/AdminDashboard';
import { UserRole } from '@/types';
import type { MetaInsight, GoogleAdsMetric } from '@/components/DashboardAnalytics';
import Link from 'next/link';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

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
const LOST_STATUSES = ['Perdido', 'Venda perdida', 'Perdida', 'Fechado Perdido', 'Lost', 'Não Qualificado', 'Status 74023059'];
const NEGOTIATION_STATUSES = ['Negociando', 'Em negociação', 'Inicial B2B'];
const QUOTE_STATUSES = ['Proposta Enviada', 'Orçamento Enviado', 'Aguardando Orçamento'];
const CONTACT_STATUSES = [
  'Contato Feito', 'Contato inicial', 'Contato Inicial',
  'Follow- Up 1', 'Follow - Up 1', 'Follow - Up 2', 'Follow - Up 3',
  'Qualificado', 'Aguardando Informações',
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
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const fmtBRL = fmtMoney;

function fmtNum(v: number): string {
  return Math.round(v).toLocaleString('pt-BR');
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
    <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
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
    <div className="rounded-xl p-4 flex flex-col gap-2" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{title}</span>
        {delta !== 0 && (
          <span
            className="text-xs font-semibold px-1.5 py-0.5 rounded"
            style={neutralDelta
              ? { backgroundColor: 'rgba(148,163,184,0.10)', color: 'var(--text-secondary)' }
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
      <p className="text-2xl font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>{value}</p>
      <Sparkline data={sparkData} color="#60a5fa" height={32} animKey={animKey} />
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{sub}</p>
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

function BottomKpiCard({ title, value, sub, badge, badgeColor, accent = 'var(--text-primary)' }: BottomKpiProps) {
  return (
    <div className="rounded-xl p-4 flex flex-col gap-1.5" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
      <span className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{title}</span>
      {badge && (
        <span
          className="self-start text-xs px-2 py-0.5 rounded font-medium"
          style={{ backgroundColor: badgeColor ? `${badgeColor}18` : 'rgba(59,130,246,0.12)', color: badgeColor ?? '#60a5fa' }}
        >
          {badge}
        </span>
      )}
      <p className="text-2xl font-semibold tabular-nums" style={{ color: accent }}>{value}</p>
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{sub}</p>
    </div>
  );
}

function RichText({ html, className, style }: { html: string; className?: string; style?: React.CSSProperties }) {
  const parts = html.split(/(<strong>.*?<\/strong>)/g);
  return (
    <p className={className} style={style}>
      {parts.map((part, i) => {
        const match = part.match(/^<strong>(.*?)<\/strong>$/);
        return match ? <strong key={i}>{match[1]}</strong> : part;
      })}
    </p>
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
      <RichText html={alert.title} className="text-xs leading-relaxed" style={{ color: 'var(--text-primary)' }} />
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

function FunnelSVG({ counts, isDark }: { counts: FunnelCounts; isDark: boolean }) {
  const W = 260;
  const H = 340;
  const cx = W / 2;
  const maxHalf = 88;
  const stageH = 50;
  const gap = 12;
  const curveOff = 26;

  const stages = isDark ? [
    { label: 'Leads gerados',    count: counts.generated,   color: '#1e3a5f', textColor: '#93c5fd' },
    { label: 'Em atendimento',   count: counts.contacted,   color: '#1e3a4a', textColor: '#67e8f9' },
    { label: 'Orç. enviado',     count: counts.quoted,      color: '#14432a', textColor: '#6ee7b7' },
    { label: 'Em negociação',    count: counts.negotiating, color: '#1a3d20', textColor: '#86efac' },
    { label: 'Venda ganha',      count: counts.won,         color: '#0d2e14', textColor: '#4ade80' },
  ] : [
    { label: 'Leads gerados',    count: counts.generated,   color: 'rgba(59,130,246,0.18)',  textColor: '#1d4ed8' },
    { label: 'Em atendimento',   count: counts.contacted,   color: 'rgba(6,182,212,0.18)',   textColor: '#0e7490' },
    { label: 'Orç. enviado',     count: counts.quoted,      color: 'rgba(16,185,129,0.18)',  textColor: '#047857' },
    { label: 'Em negociação',    count: counts.negotiating, color: 'rgba(34,197,94,0.18)',   textColor: '#15803d' },
    { label: 'Venda ganha',      count: counts.won,         color: 'rgba(74,222,128,0.22)',  textColor: '#166534' },
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

        // Ponto médio exato da curva bezier (t=0.5):
        // x = cx + (hw0+hw1)/2 + 0.75*curveOff  (derivado da fórmula cúbica)
        // y = (yConnStart + yConnEnd) / 2
        const yConnStart = yTop + stageH / 2;
        const yConnEnd   = yBot + gap / 2;
        const labelX     = cx + (hw0 + hw1) / 2 + curveOff * 0.75;
        const labelY     = (yConnStart + yConnEnd) / 2;

        return (
          <g key={i}>
            <polygon points={pts} fill={s.color} />
            <text x={cx} y={yTop + stageH * 0.38} textAnchor="middle" fontSize="9" fill={s.textColor} fontFamily="Inter,sans-serif">
              {s.label}
            </text>
            <text x={cx} y={yTop + stageH * 0.72} textAnchor="middle" fontSize="15" fontWeight="500" fill="var(--text-primary)" fontFamily="Inter,sans-serif">
              {s.count}
            </text>

            {i < stages.length - 1 && (
              <>
                <path
                  d={`M ${cx + hw0} ${yConnStart} C ${cx + hw0 + curveOff} ${yConnStart}, ${cx + hw1 + curveOff} ${yConnEnd}, ${cx + hw1} ${yConnEnd}`}
                  stroke="var(--border-md)" strokeWidth="1" fill="none"
                />
                <text
                  x={labelX}
                  y={labelY + 4}
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
          <line x1={6} y1={H - 38} x2={W - 6} y2={H - 38} stroke="var(--border)" strokeWidth="0.5" />
          <rect x={6} y={H - 28} width={W - 12} height={22} rx={4} fill="rgba(248,113,113,0.12)" stroke="rgba(248,113,113,0.2)" strokeWidth="0.5" />
          <text x={cx} y={H - 13} textAnchor="middle" fontSize="10" fill="#f87171" fontFamily="Inter,sans-serif">
            {`${counts.lost} perdidos · ${counts.generated > 0 ? fmtPct1((counts.lost / counts.generated) * 100) : '0%'} do total`}
          </text>
        </>
      )}
    </svg>
  );
}

// ─── Campaign Drill-down Drawer ───────────────────────────────────────────────

interface CampaignDrawerProps {
  campaign: { name: string; platform: 'Meta' | 'Google'; spend: number; clicks: number; impressions: number; leads: number } | null;
  campaignRows: MetaInsight[];
  adsetRows: MetaInsight[];
  googleCampaignRows?: GoogleAdsMetric[];
  onClose: () => void;
}

function CampaignDrawer({ campaign, campaignRows, adsetRows, googleCampaignRows, onClose }: CampaignDrawerProps) {
  const daily = useMemo(() => {
    const map = new Map<string, { date: string; spend: number; clicks: number; impressions: number }>();
    if (campaign?.platform === 'Google' && googleCampaignRows?.length) {
      googleCampaignRows.forEach((d) => {
        const k = d.date.slice(0, 10);
        const prev = map.get(k) ?? { date: k, spend: 0, clicks: 0, impressions: 0 };
        map.set(k, { ...prev, spend: prev.spend + d.cost, clicks: prev.clicks + d.clicks, impressions: prev.impressions + d.impressions });
      });
    } else {
      campaignRows.forEach((d) => {
        const k = d.date.slice(0, 10);
        const prev = map.get(k) ?? { date: k, spend: 0, clicks: 0, impressions: 0 };
        map.set(k, { ...prev, spend: prev.spend + d.spend, clicks: prev.clicks + d.clicks, impressions: prev.impressions + d.impressions });
      });
    }
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [campaignRows, googleCampaignRows, campaign?.platform]);

  const adsets = useMemo(() => {
    const map = new Map<string, { name: string; spend: number; clicks: number; impressions: number }>();
    adsetRows.forEach((d) => {
      const key = d.adsetName ?? 'Sem nome';
      const prev = map.get(key) ?? { name: key, spend: 0, clicks: 0, impressions: 0 };
      map.set(key, { ...prev, spend: prev.spend + d.spend, clicks: prev.clicks + d.clicks, impressions: prev.impressions + d.impressions });
    });
    return Array.from(map.values()).sort((a, b) => b.spend - a.spend);
  }, [adsetRows]);

  if (!campaign) return null;

  const totalSpend = campaign.spend;
  const totalImpr  = campaign.impressions;
  const totalClicks = campaign.clicks;
  const ctr  = totalImpr  > 0 ? (totalClicks / totalImpr)  * 100 : 0;
  const cpc  = totalClicks > 0 ? totalSpend / totalClicks : 0;
  const cpm  = totalImpr  > 0 ? (totalSpend / totalImpr)  * 1000 : 0;

  const fmtDate = (s: string) => new Date(s + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

  const platformColor = campaign.platform === 'Meta' ? '#818cf8' : '#34d399';

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div
        className="fixed right-0 top-0 h-full z-50 flex flex-col overflow-y-auto"
        style={{ width: 'min(680px, 95vw)', backgroundColor: 'var(--bg-base)', borderLeft: '1px solid var(--border-md)' }}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 px-6 py-4"
          style={{ backgroundColor: 'var(--bg-base)', borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-3 min-w-0">
            <span className="inline-flex items-center gap-1.5 shrink-0 text-xs font-medium px-2 py-0.5 rounded-full"
              style={{ backgroundColor: `${platformColor}18`, color: platformColor }}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: platformColor }} />
              {campaign.platform}
            </span>
            <h2 className="font-semibold text-sm truncate" style={{ color: 'var(--text-primary)' }}>{campaign.name}</h2>
          </div>
          <button onClick={onClose} className="shrink-0 rounded-lg p-1.5 transition-colors hover:bg-white/5" style={{ color: 'var(--text-muted)' }}>
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 px-6 py-5 space-y-6">

          {/* KPI row */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Gasto total',   value: fmtMoney(totalSpend) },
              { label: 'Impressões',    value: fmtNum(totalImpr) },
              { label: 'Cliques',       value: fmtNum(totalClicks) },
              { label: 'CTR',           value: fmtPct(ctr) },
              { label: 'CPC',           value: fmtMoney(cpc) },
              { label: 'CPM',           value: fmtMoney(cpm) },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-xl p-3" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                <p className="text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>{label}</p>
                <p className="text-base font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>{value}</p>
              </div>
            ))}
          </div>

          {/* Trend chart */}
          {daily.length > 1 && (
            <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
              <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--text-muted)' }}>Evolução diária</p>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={daily} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
                  <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fontSize: 10, fill: 'var(--chart-axis)' }} tickLine={false} axisLine={false} />
                  <YAxis yAxisId="left"  tick={{ fontSize: 10, fill: 'var(--chart-axis)' }} tickLine={false} axisLine={false} tickFormatter={(v) => `R$${v}`} width={48} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: 'var(--chart-axis)' }} tickLine={false} axisLine={false} width={36} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-md)', borderRadius: 8, fontSize: 11 }}
                    labelStyle={{ color: 'var(--text-secondary)' }}
                    labelFormatter={(label: unknown) => fmtDate(String(label))}
                    formatter={(value: unknown, name: unknown) => [
                      name === 'spend' ? fmtMoney(Number(value)) : fmtNum(Number(value)),
                      name === 'spend' ? 'Gasto' : 'Cliques',
                    ]}
                  />
                  <Line yAxisId="left"  type="monotone" dataKey="spend"  stroke={platformColor} strokeWidth={2} dot={false} />
                  <Line yAxisId="right" type="monotone" dataKey="clicks" stroke="#fbbf24" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
                </LineChart>
              </ResponsiveContainer>
              <div className="flex items-center gap-4 mt-2">
                <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                  <span className="h-0.5 w-4 rounded" style={{ backgroundColor: platformColor }} /> Gasto
                </span>
                <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                  <span className="h-0.5 w-4 rounded border-t border-dashed" style={{ borderColor: '#fbbf24' }} /> Cliques
                </span>
              </div>
            </div>
          )}

          {/* Adset breakdown */}
          {adsets.length > 0 && (
            <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
              <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  Conjuntos de anúncios ({adsets.length})
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ backgroundColor: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
                      {['Conjunto', 'Gasto', 'Impressões', 'Cliques', 'CTR', 'CPC'].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-left font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {adsets.map((a) => {
                      const aCtr = a.impressions > 0 ? (a.clicks / a.impressions) * 100 : 0;
                      const aCpc = a.clicks > 0 ? a.spend / a.clicks : 0;
                      return (
                        <tr key={a.name} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td className="px-4 py-2.5 max-w-[180px]" style={{ color: 'var(--text-primary)' }}>
                            <span className="block truncate">{a.name}</span>
                          </td>
                          <td className="px-4 py-2.5 tabular-nums" style={{ color: 'var(--text-secondary)' }}>{fmtMoney(a.spend)}</td>
                          <td className="px-4 py-2.5 tabular-nums" style={{ color: 'var(--text-secondary)' }}>{fmtNum(a.impressions)}</td>
                          <td className="px-4 py-2.5 tabular-nums" style={{ color: 'var(--text-secondary)' }}>{fmtNum(a.clicks)}</td>
                          <td className="px-4 py-2.5 tabular-nums" style={{ color: aCtr >= 2 ? '#4ade80' : aCtr >= 1 ? '#fbbf24' : '#f87171' }}>{fmtPct(aCtr)}</td>
                          <td className="px-4 py-2.5 tabular-nums" style={{ color: 'var(--text-secondary)' }}>{fmtMoney(aCpc)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Daily breakdown table */}
          {daily.length > 0 && (
            <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
              <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Detalhamento diário</p>
              </div>
              <div className="overflow-x-auto max-h-72 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0" style={{ backgroundColor: 'var(--bg-surface)' }}>
                    <tr style={{ backgroundColor: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
                      {['Data', 'Gasto', 'Impressões', 'Cliques', 'CTR', 'CPC'].map((h) => (
                        <th key={h} className="px-4 py-2.5 text-left font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...daily].reverse().map((d) => {
                      const dCtr = d.impressions > 0 ? (d.clicks / d.impressions) * 100 : 0;
                      const dCpc = d.clicks > 0 ? d.spend / d.clicks : 0;
                      return (
                        <tr key={d.date} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td className="px-4 py-2.5 tabular-nums" style={{ color: 'var(--text-secondary)' }}>{fmtDate(d.date)}</td>
                          <td className="px-4 py-2.5 tabular-nums" style={{ color: 'var(--text-primary)' }}>{fmtMoney(d.spend)}</td>
                          <td className="px-4 py-2.5 tabular-nums" style={{ color: 'var(--text-secondary)' }}>{fmtNum(d.impressions)}</td>
                          <td className="px-4 py-2.5 tabular-nums" style={{ color: 'var(--text-secondary)' }}>{fmtNum(d.clicks)}</td>
                          <td className="px-4 py-2.5 tabular-nums" style={{ color: dCtr >= 2 ? '#4ade80' : dCtr >= 1 ? '#fbbf24' : '#f87171' }}>{fmtPct(dCtr)}</td>
                          <td className="px-4 py-2.5 tabular-nums" style={{ color: 'var(--text-secondary)' }}>{fmtMoney(dCpc)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user, organization } = useAuth();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme !== 'light';
  const { integrations, fetchIntegrations } = useIntegrations();
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
  const [manualRevenueSummary, setManualRevenueSummary] = useState<import('@/types').ManualRevenueSummary | null>(null);
  const [lastUpdate]                  = useState(() => new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }));
  const [funnelTab, setFunnelTab]     = useState<'total' | 'meta' | 'google'>('total');
  const [selectedCampaign, setSelectedCampaign] = useState<typeof campaigns[0] | null>(null);
  const [colPickerOpen, setColPickerOpen] = useState(false);
  const OPTIONAL_COLS = [
    { key: 'spend',       label: 'Gasto'       },
    { key: 'leads',       label: 'Leads'       },
    { key: 'ctr',         label: 'CTR'         },
    { key: 'cpc',         label: 'CPC'         },
    { key: 'cpl',         label: 'CPL'         },
    { key: 'impressions', label: 'Impressões'  },
    { key: 'clicks',      label: 'Cliques'     },
  ] as const;
  type ColKey = typeof OPTIONAL_COLS[number]['key'];
  const DEFAULT_COLS: ColKey[] = ['spend', 'leads', 'ctr'];
  const [visibleCols, setVisibleCols] = useState<ColKey[]>(() => {
    if (typeof window === 'undefined') return DEFAULT_COLS;
    try {
      const saved = localStorage.getItem('campaign_table_cols');
      if (saved) return JSON.parse(saved) as ColKey[];
    } catch { /* ignore */ }
    return DEFAULT_COLS;
  });
  const toggleCol = (key: ColKey) => {
    setVisibleCols((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
      localStorage.setItem('campaign_table_cols', JSON.stringify(next));
      return next;
    });
  };

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';

  useEffect(() => {
    fetchIntegrations();
    fetchAllDashboardData(30);
    fetchLatestInsight();
    apiService.getManualRevenueSummary(3).then((r) => { if (r.success) setManualRevenueSummary(r.data); }).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const metaAll    = useMemo(() => filterByDateRange(metaInsights,     activePeriod.start, activePeriod.end), [metaInsights,     activePeriod]);
  // Apenas linhas de campanha para KPIs/totais — adset seria double-count
  const metaCur    = useMemo(() => metaAll.filter((d) => !d.level || d.level === 'campaign'), [metaAll]);
  const googleCur  = useMemo(() => filterByDateRange(googleAdsMetrics, activePeriod.start, activePeriod.end), [googleAdsMetrics, activePeriod]);
  const metaPrev   = useMemo(() => prevPeriodRange(metaInsights,       activePeriod.start, activePeriod.end).filter((d) => !d.level || d.level === 'campaign'), [metaInsights, activePeriod]);
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

  // ── Funnel leads filtered by channel tab ──────────────────────────────────
  const funnelLeads = useMemo(() => {
    if (funnelTab === 'meta')   return kommoCur.filter((l) => l.utmSource === 'meta');
    if (funnelTab === 'google') return kommoCur.filter((l) => l.utmSource === 'google');
    return kommoCur;
  }, [kommoCur, funnelTab]);

  // ── Lead distribution by UTM source ─────────────────────────────────────
  const leadsByOrigin = useMemo(() => {
    const meta      = kommoCur.filter((l) => l.utmSource === 'meta').length;
    const google    = kommoCur.filter((l) => l.utmSource === 'google').length;
    const whatsapp  = kommoCur.filter((l) => l.utmSource === 'WhatsApp').length;
    const noUtm     = kommoCur.filter((l) => !l.utmSource).length;
    const total     = kommoCur.length || 1;
    return [
      { label: 'Meta Ads',  count: meta,     color: '#818cf8', pct: (meta     / total) * 100 },
      { label: 'Google Ads',count: google,   color: '#34d399', pct: (google   / total) * 100 },
      { label: 'WhatsApp',  count: whatsapp, color: '#4ade80', pct: (whatsapp / total) * 100 },
      { label: 'Sem UTM',   count: noUtm,    color: 'var(--text-muted)', pct: (noUtm    / total) * 100 },
    ];
  }, [kommoCur]);

  // ── Funnel counts (cumulative — how many reached or passed each stage) ─────
  const funnelCounts = useMemo<FunnelCounts>(() => {
    const contactedOrBeyond = [...CONTACT_STATUSES, ...QUOTE_STATUSES, ...NEGOTIATION_STATUSES, ...WON_STATUSES];
    const quotedOrBeyond    = [...QUOTE_STATUSES, ...NEGOTIATION_STATUSES, ...WON_STATUSES];
    const negOrBeyond       = [...NEGOTIATION_STATUSES, ...WON_STATUSES];
    return {
      generated:   funnelLeads.length,
      contacted:   funnelLeads.filter((l) => contactedOrBeyond.includes(l.status)).length,
      quoted:      funnelLeads.filter((l) => quotedOrBeyond.includes(l.status)).length,
      negotiating: funnelLeads.filter((l) => negOrBeyond.includes(l.status)).length,
      won:         funnelLeads.filter((l) => WON_STATUSES.includes(l.status)).length,
      lost:        funnelLeads.filter((l) => LOST_STATUSES.includes(l.status)).length,
    };
  }, [funnelLeads]);

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

  // ── Channel comparison (for funnel tab comparativo panel) ─────────────────
  const canalComparativo = useMemo(() => {
    const metaSpend   = metaCur.reduce((s, d) => s + d.spend, 0);
    const googleSpend = googleCur.reduce((s, d) => s + d.cost, 0);
    const metaLeads   = kommoCur.filter((l) => l.utmSource === 'meta');
    const googleLeads = kommoCur.filter((l) => l.utmSource === 'google');
    const metaWon     = metaLeads.filter((l) => WON_STATUSES.includes(l.status));
    const googleWon   = googleLeads.filter((l) => WON_STATUSES.includes(l.status));
    const metaRev     = metaWon.reduce((s, l) => s + (l.price ?? 0), 0);
    const googleRev   = googleWon.reduce((s, l) => s + (l.price ?? 0), 0);
    return {
      meta: {
        leads: metaLeads.length,
        cpl:   metaLeads.length > 0 ? metaSpend / metaLeads.length : null,
        won:   metaWon.length,
        conv:  metaLeads.length > 0 ? (metaWon.length / metaLeads.length) * 100 : 0,
        roas:  metaSpend > 0 ? metaRev / metaSpend : null,
        spend: metaSpend,
      },
      google: {
        leads: googleLeads.length,
        cpl:   googleLeads.length > 0 ? googleSpend / googleLeads.length : null,
        won:   googleWon.length,
        conv:  googleLeads.length > 0 ? (googleWon.length / googleLeads.length) * 100 : 0,
        roas:  googleSpend > 0 ? googleRev / googleSpend : null,
        spend: googleSpend,
      },
    };
  }, [metaCur, googleCur, kommoCur]);

  // ── Campaign health scores A/B/C/D (fixed 30-day window, independent of range selector) ─
  const campaignHealthScores = useMemo(() => {
    const now    = new Date();
    const d30ago = new Date(now.getTime() - 30 * 86400000);
    const d7ago  = new Date(now.getTime() -  7 * 86400000);
    const d14ago = new Date(now.getTime() - 14 * 86400000);

    // All meta campaign rows for the last 30 days
    const meta30 = metaInsights.filter(
      d => new Date(d.date) >= d30ago && (!d.level || d.level === 'campaign')
    );

    type CampData = { spend: number; clicks: number; impressions: number; spend7: number; spend14: number };
    const byName = new Map<string, CampData>();
    for (const d of meta30) {
      const date = new Date(d.date);
      const prev = byName.get(d.campaignName) ?? { spend: 0, clicks: 0, impressions: 0, spend7: 0, spend14: 0 };
      byName.set(d.campaignName, {
        spend:       prev.spend + d.spend,
        clicks:      prev.clicks + d.clicks,
        impressions: prev.impressions + d.impressions,
        spend7:      date >= d7ago  ? prev.spend7  + d.spend : prev.spend7,
        spend14:     date >= d14ago && date < d7ago ? prev.spend14 + d.spend : prev.spend14,
      });
    }

    // WON revenue and lead counts per utmCampaign for last 30d / last 7d / prev 7d
    const rev30   = new Map<string, number>();
    const leads7  = new Map<string, number>();
    const leads14 = new Map<string, number>();
    for (const l of kommoLeads as KommoLead[]) {
      if (!l.utmCampaign) continue;
      const d = getKommoDate(l);
      if (d < d30ago) continue;
      if (WON_STATUSES.includes(l.status) && l.price) {
        rev30.set(l.utmCampaign, (rev30.get(l.utmCampaign) ?? 0) + l.price);
      }
      if (d >= d7ago)                      leads7.set( l.utmCampaign, (leads7.get(l.utmCampaign)  ?? 0) + 1);
      if (d >= d14ago && d < d7ago)        leads14.set(l.utmCampaign, (leads14.get(l.utmCampaign) ?? 0) + 1);
    }

    const scores = new Map<string, 'A' | 'B' | 'C' | 'D'>();
    for (const [name, data] of byName) {
      let pts = 0;

      // ROAS (35pts)
      const rev  = rev30.get(name) ?? 0;
      const roas = data.spend > 0 ? rev / data.spend : null;
      pts += roas === null ? 10 : roas >= 3 ? 35 : roas >= 2 ? 25 : roas >= 1 ? 15 : 5;

      // CPL trend this week vs last week (25pts)
      const l7  = leads7.get(name)  ?? 0;
      const l14 = leads14.get(name) ?? 0;
      const cpl7  = l7  > 0 && data.spend7  > 0 ? data.spend7  / l7  : null;
      const cpl14 = l14 > 0 && data.spend14 > 0 ? data.spend14 / l14 : null;
      if (cpl7 !== null && cpl14 !== null && cpl14 > 0) {
        const d = (cpl7 - cpl14) / cpl14;
        pts += d < -0.1 ? 25 : d <= 0.1 ? 15 : 5;
      } else {
        pts += 10;
      }

      // Lead volume trend (25pts)
      if (l7 > 0 || l14 > 0) {
        const d = l14 > 0 ? (l7 - l14) / l14 : 1;
        pts += d > 0.1 ? 25 : d >= -0.1 ? 15 : 5;
      } else {
        pts += 5;
      }

      // CTR (15pts)
      const ctr = data.impressions > 0 ? (data.clicks / data.impressions) * 100 : 0;
      pts += ctr >= 2 ? 15 : ctr >= 1 ? 10 : ctr >= 0.5 ? 5 : 0;

      scores.set(name, pts >= 75 ? 'A' : pts >= 50 ? 'B' : pts >= 25 ? 'C' : 'D');
    }

    // Google campaigns — CTR (40pts) + CPC trend 7d vs prev 7d (30pts) + impressions trend (30pts)
    type GData = { cost: number; clicks: number; impressions: number; cost7: number; cost14: number; clicks7: number; clicks14: number; impr7: number; impr14: number };
    const gByName = new Map<string, GData>();
    const google30 = googleAdsMetrics.filter(d => new Date(d.date) >= d30ago);
    for (const d of google30) {
      const date = new Date(d.date);
      const prev = gByName.get(d.campaignName) ?? { cost: 0, clicks: 0, impressions: 0, cost7: 0, cost14: 0, clicks7: 0, clicks14: 0, impr7: 0, impr14: 0 };
      const in7  = date >= d7ago;
      const in14 = date >= d14ago && date < d7ago;
      gByName.set(d.campaignName, {
        cost: prev.cost + d.cost, clicks: prev.clicks + d.clicks, impressions: prev.impressions + d.impressions,
        cost7:   in7  ? prev.cost7   + d.cost        : prev.cost7,
        cost14:  in14 ? prev.cost14  + d.cost        : prev.cost14,
        clicks7: in7  ? prev.clicks7 + d.clicks      : prev.clicks7,
        clicks14:in14 ? prev.clicks14+ d.clicks      : prev.clicks14,
        impr7:   in7  ? prev.impr7   + d.impressions : prev.impr7,
        impr14:  in14 ? prev.impr14  + d.impressions : prev.impr14,
      });
    }
    for (const [name, d] of gByName) {
      let pts = 0;
      // CTR 30d (40pts) — Search: ≥5% excelente, ≥3% bom, ≥1% ok
      const ctr = d.impressions > 0 ? (d.clicks / d.impressions) * 100 : 0;
      pts += ctr >= 5 ? 40 : ctr >= 3 ? 28 : ctr >= 1 ? 15 : 5;
      // CPC trend (30pts) — menor é melhor
      const cpc7  = d.clicks7  > 0 ? d.cost7  / d.clicks7  : null;
      const cpc14 = d.clicks14 > 0 ? d.cost14 / d.clicks14 : null;
      if (cpc7 !== null && cpc14 !== null && cpc14 > 0) {
        const delta = (cpc7 - cpc14) / cpc14;
        pts += delta < -0.1 ? 30 : delta <= 0.1 ? 20 : 5;
      } else { pts += 15; }
      // Impressions trend (30pts) — mais impressões = mais alcance
      if (d.impr7 > 0 || d.impr14 > 0) {
        const delta = d.impr14 > 0 ? (d.impr7 - d.impr14) / d.impr14 : 1;
        pts += delta > 0.1 ? 30 : delta >= -0.1 ? 20 : 5;
      } else { pts += 15; }
      scores.set(name, pts >= 75 ? 'A' : pts >= 50 ? 'B' : pts >= 25 ? 'C' : 'D');
    }

    return scores;
  }, [metaInsights, googleAdsMetrics, kommoLeads]);

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
    // Sempre usa kommoCur (todos os canais) — independente da aba do funil selecionada.
    // wonWithPrice: vendas com valor registrado (base do ticket médio)
    const wonWithPrice = kommoCur.filter(
      (l) => WON_STATUSES.includes(l.status) && l.price != null && (l.price as number) > 0,
    );
    const wonTotal = kommoCur.filter((l) => WON_STATUSES.includes(l.status)).length;
    const wonCount = wonWithPrice.length;
    const ticketMedio = wonCount > 0 ? closedValue / wonCount : null;
    // Cap de 1.0 (100%) no repeat rate — evita LTV inflado quando há mais tags Carteira
    // do que vendas fechadas no período (clientes recorrentes que ainda não fecharam)
    const repeatRate = wonCount > 0 ? Math.min(recurrentCount / wonCount, 1.0) : 0.2;
    const ltv = ticketMedio ? ticketMedio * (1 + repeatRate) : null;

    // CAC real = gasto em anúncios / clientes efetivamente adquiridos via Meta ou Google.
    // Dividir LTV por CPL (gasto/leads) produziria um ratio sem sentido — um lead não é
    // um cliente. O custo real por cliente inclui todos os leads que não converteram.
    const wonFromPaid = kommoCur.filter(
      (l) => WON_STATUSES.includes(l.status) &&
             (l.utmSource === 'meta' || l.utmSource === 'google'),
    );
    const totalAdSpend = attributionSummary?.spend ?? 0;
    const cacReal = wonFromPaid.length > 0 && totalAdSpend > 0
      ? totalAdSpend / wonFromPaid.length
      : null;

    const ltvCacRatio = ltv && cacReal && cacReal > 0 ? ltv / cacReal : null;
    return { ticketMedio, ltv, ltvCacRatio, wonTotal, wonCount, cacReal, wonFromPaidCount: wonFromPaid.length };
  }, [kommoCur, closedValue, recurrentCount, attributionSummary]);

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

  const hasKommo = integrations.some(
    (i) => i.type === 'KOMMO' && i.status === 'CONNECTED'
  );

  if (user?.role === UserRole.SUPER_ADMIN) {
    return <AdminDashboard />;
  }

  const HEALTH_SCORE_CFG: Record<'A' | 'B' | 'C' | 'D', { bg: string; color: string }> = {
    A: { bg: 'rgba(74,222,128,0.12)',  color: '#4ade80' },
    B: { bg: 'rgba(96,165,250,0.12)',  color: '#60a5fa' },
    C: { bg: 'rgba(251,191,36,0.12)',  color: '#fbbf24' },
    D: { bg: 'rgba(248,113,113,0.12)', color: '#f87171' },
  };

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
        style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-7 w-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: '#3b82f6' }}>
            <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
            </svg>
          </div>
          <span className="text-sm font-semibold" style={{ color: '#60a5fa' }}>Córtex Growth</span>
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{organization?.name ?? '—'}</span>
          {organization?.plan && (
            <span className="text-xs px-2 py-0.5 rounded font-medium" style={{ backgroundColor: 'rgba(59,130,246,0.12)', color: '#60a5fa' }}>
              {organization.plan}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Period tabs */}
          <div className="flex rounded-lg p-0.5 gap-0.5" style={{ backgroundColor: 'var(--bg-base)', border: '1px solid var(--border)' }}>
            {(['7D', '30D', '90D'] as Exclude<Range, 'CUSTOM'>[]).map((r) => (
              <button
                key={r}
                onClick={() => changeRange(r)}
                className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
                style={range === r ? { backgroundColor: '#3b82f6', color: '#fff' } : { color: 'var(--text-muted)' }}
              >
                {r}
              </button>
            ))}
            <button
              onClick={() => changeRange('CUSTOM')}
              className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
              style={range === 'CUSTOM' ? { backgroundColor: '#3b82f6', color: '#fff' } : { color: 'var(--text-muted)' }}
            >
              Personalizado
            </button>
          </div>

          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Atualizado {lastUpdate}</span>
        </div>
      </div>

      {/* Custom date range */}
      {range === 'CUSTOM' && (
        <div className="flex items-center gap-2">
          <input type="date" value={customStart} max={customEnd || undefined}
            onChange={(e) => { setCustomStart(e.target.value); setAnimKey((k) => k + 1); }}
            className="rounded-lg px-2.5 py-1.5 text-xs font-medium"
            style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--input-border)', color: 'var(--text-secondary)', colorScheme: isDark ? 'dark' : 'light' }}
          />
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>–</span>
          <input type="date" value={customEnd} min={customStart || undefined} max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => { setCustomEnd(e.target.value); setAnimKey((k) => k + 1); }}
            className="rounded-lg px-2.5 py-1.5 text-xs font-medium"
            style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--input-border)', color: 'var(--text-secondary)', colorScheme: isDark ? 'dark' : 'light' }}
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
              <div key={i} className="rounded-xl p-4 animate-pulse" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', height: 140 }} />
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

      {/* ── DADOS MANUAIS — banner quando sem CRM ───────────────────────────── */}
      {!hasKommo && (
        <>
          {manualRevenueSummary?.hasData ? (
            <div>
              <SectionLabel>resultado manual — sem crm conectado</SectionLabel>
              <div
                className="mb-3 flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl"
                style={{ backgroundColor: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.25)' }}
              >
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="#fbbf24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                  <span className="text-xs" style={{ color: '#fbbf24' }}>
                    Métricas de CRM baseadas em dados inseridos manualmente — conecte o Kommo para análise completa por lead.
                  </span>
                </div>
                <Link href="/dashboard/dados-manuais" className="text-xs font-medium shrink-0" style={{ color: '#fbbf24' }}>
                  Editar dados →
                </Link>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <BottomKpiCard
                  title="ROAS (Meta)"
                  value={manualRevenueSummary.totals.roasMeta != null ? `${manualRevenueSummary.totals.roasMeta.toFixed(2).replace('.', ',')}x` : '—'}
                  sub={`Meta: ${manualRevenueSummary.totals.metaLeads} leads`}
                  accent={manualRevenueSummary.totals.roasMeta != null ? (manualRevenueSummary.totals.roasMeta >= 4 ? '#4ade80' : manualRevenueSummary.totals.roasMeta >= 2 ? '#fbbf24' : '#f87171') : '#475569'}
                />
                <BottomKpiCard
                  title="ROAS (Google)"
                  value={manualRevenueSummary.totals.roasGoogle != null ? `${manualRevenueSummary.totals.roasGoogle.toFixed(2).replace('.', ',')}x` : '—'}
                  sub={`Google: ${manualRevenueSummary.totals.googleLeads} leads`}
                  accent={manualRevenueSummary.totals.roasGoogle != null ? (manualRevenueSummary.totals.roasGoogle >= 4 ? '#4ade80' : manualRevenueSummary.totals.roasGoogle >= 2 ? '#fbbf24' : '#f87171') : '#475569'}
                />
                <BottomKpiCard
                  title="Receita total"
                  value={manualRevenueSummary.totals.revenue > 0 ? fmtMoney(manualRevenueSummary.totals.revenue) : '—'}
                  sub={`${manualRevenueSummary.totals.sales} vendas · ${manualRevenueSummary.totals.leads} leads`}
                />
                <BottomKpiCard
                  title="CAC"
                  value={manualRevenueSummary.totals.cac != null ? fmtBRL(manualRevenueSummary.totals.cac) : '—'}
                  sub="Gasto / leads pagos (Meta + Google)"
                  accent="#60a5fa"
                />
              </div>
            </div>
          ) : (
            <div
              className="flex items-center justify-between gap-4 px-5 py-4 rounded-xl"
              style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
            >
              <div className="flex items-start gap-3">
                <svg className="h-5 w-5 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="var(--text-muted)" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V19.5a2.25 2.25 0 002.25 2.25h.75m0-12H12m-3 3h3" />
                </svg>
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Sem dados de CRM ou receita manual</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    Conecte o Kommo CRM ou insira dados manuais para ver ROAS, CAC e funil de vendas.
                  </p>
                </div>
              </div>
              <Link
                href="/dashboard/dados-manuais"
                className="shrink-0 px-4 py-2 rounded-lg text-xs font-medium transition-colors"
                style={{ backgroundColor: 'rgba(59,130,246,0.1)', color: '#60a5fa' }}
              >
                Inserir dados →
              </Link>
            </div>
          )}
        </>
      )}

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
              sub={ltvData.wonTotal > 0 ? `${ltvData.wonTotal} vendas · ticket médio ${ltvData.ticketMedio ? fmtBRL(ltvData.ticketMedio) : '—'}` : 'Nenhuma venda fechada'}
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
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)', letterSpacing: '0.1em' }}>funil de vendas · {funnelLeads.length} leads{funnelTab !== 'total' ? ` · ${funnelTab === 'meta' ? 'Meta Ads' : 'Google Ads'}` : ' · todos os canais'} · Kommo</p>
            <div className="flex rounded-lg p-0.5 gap-0.5" style={{ backgroundColor: 'var(--bg-base)', border: '1px solid var(--border)' }}>
              {([['total', 'Total'], ['meta', 'Meta Ads'], ['google', 'Google Ads']] as const).map(([tab, label]) => (
                <button
                  key={tab}
                  onClick={() => setFunnelTab(tab)}
                  className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
                  style={funnelTab === tab ? { backgroundColor: '#3b82f6', color: '#fff' } : { color: 'var(--text-muted)' }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-3 grid-cols-1 lg:grid-cols-[3fr_1fr]">

            {/* Left: funnel SVG + right info panel */}
            <div className="rounded-xl p-5 flex gap-6 h-full" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
              <div className="flex flex-col justify-center">
                <FunnelSVG counts={funnelCounts} isDark={isDark} />
              </div>

              <div className="flex-1 flex flex-col gap-3 min-w-0">
                {/* Conversão final */}
                <div className="rounded-xl p-4 text-center" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                  <p className="text-xs font-medium uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>Conversão final — lead → venda</p>
                  <p className="text-4xl font-semibold tabular-nums" style={{ color: funnelCounts.generated > 0 && funnelCounts.won / funnelCounts.generated >= 0.1 ? '#4ade80' : '#f87171' }}>
                    {funnelCounts.generated > 0 ? fmtPct1((funnelCounts.won / funnelCounts.generated) * 100) : '—'}
                  </p>
                  <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                    <strong style={{ color: 'var(--text-primary)' }}>{funnelCounts.won} vendas</strong> em <strong style={{ color: 'var(--text-primary)' }}>{funnelCounts.generated} leads</strong>
                  </p>
                </div>

                {/* Alertas do funil */}
                <div className="rounded-xl p-3" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                  <p className="text-xs font-medium uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>Onde prestar atenção</p>
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
                    <div key={i} className="rounded-lg p-2.5" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                      <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>{item.label}</p>
                      <p className="text-base font-semibold" style={{ color: item.color }}>
                        {item.val !== null ? fmtPct1(item.val * 100) : item.display}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Distribuição por origem */}
                <div className="flex-1 flex flex-col rounded-xl p-3" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                  <p className="text-xs font-medium uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>Origem dos leads</p>
                  <div className="flex-1 flex gap-4 items-center">
                    {/* Donut chart */}
                    {(() => {
                      const R = 44; const r = 28; const cx = 52; const cy = 52;
                      const active = leadsByOrigin.filter((o) => o.count > 0);
                      const total = active.reduce((s, o) => s + o.count, 0) || 1;
                      let cumAngle = -90;
                      const slices = active.map((o) => {
                        const angle = (o.count / total) * 360;
                        const start = cumAngle;
                        cumAngle += angle;
                        return { ...o, start, angle };
                      });
                      function arc(startDeg: number, angleDeg: number, outerR: number, innerR: number) {
                        const toRad = (d: number) => (d * Math.PI) / 180;
                        const a1 = toRad(startDeg), a2 = toRad(startDeg + angleDeg - 0.5);
                        const x1o = cx + outerR * Math.cos(a1), y1o = cy + outerR * Math.sin(a1);
                        const x2o = cx + outerR * Math.cos(a2), y2o = cy + outerR * Math.sin(a2);
                        const x1i = cx + innerR * Math.cos(a2), y1i = cy + innerR * Math.sin(a2);
                        const x2i = cx + innerR * Math.cos(a1), y2i = cy + innerR * Math.sin(a1);
                        const lg = angleDeg > 180 ? 1 : 0;
                        return `M ${x1o} ${y1o} A ${outerR} ${outerR} 0 ${lg} 1 ${x2o} ${y2o} L ${x1i} ${y1i} A ${innerR} ${innerR} 0 ${lg} 0 ${x2i} ${y2i} Z`;
                      }
                      return (
                        <svg width={104} height={104} className="shrink-0">
                          {slices.map((s) => (
                            <path key={s.label} d={arc(s.start, s.angle, R, r)} fill={s.color} opacity={0.85} />
                          ))}
                          <text x={cx} y={cy - 6} textAnchor="middle" fontSize="13" fontWeight="600" fill="var(--text-primary)" fontFamily="Inter,sans-serif">
                            {total}
                          </text>
                          <text x={cx} y={cy + 9} textAnchor="middle" fontSize="8" fill="var(--text-muted)" fontFamily="Inter,sans-serif">
                            leads
                          </text>
                        </svg>
                      );
                    })()}
                    {/* Bars */}
                    <div className="flex-1 space-y-2.5">
                      {leadsByOrigin.filter((o) => o.count > 0).map((o) => (
                        <div key={o.label}>
                          <div className="flex justify-between items-center mb-1">
                            <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                              <span className="h-1.5 w-1.5 rounded-full shrink-0" style={{ backgroundColor: o.color }} />
                              {o.label}
                            </span>
                            <span className="text-xs font-semibold tabular-nums" style={{ color: o.color }}>
                              {o.count} · {fmtPct1(o.pct)}
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--border-md)' }}>
                            <div className="h-full rounded-full" style={{ width: `${o.pct}%`, backgroundColor: o.color, opacity: 0.7 }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right column: motivos de perda + ciclo */}
            <div className="flex flex-col gap-3">
              {/* Motivos de perda */}
              <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Motivos de perda</p>
                <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>{funnelCounts.lost} perdidos no período</p>
                {funnelCounts.lost === 0 ? (
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Nenhum lead perdido</p>
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
                        <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--border-md)' }}>
                          <div className="h-full rounded-full" style={{ width: `${m.pct * 100}%`, backgroundColor: m.warn ? 'rgba(248,113,113,0.5)' : '#f87171', opacity: 0.65 }} />
                        </div>
                        <span className="text-xs tabular-nums" style={{ color: m.warn ? '#f87171' : '#64748b', width: 28, textAlign: 'right' }}>
                          {Math.round(funnelCounts.lost * m.pct)}
                        </span>
                      </div>
                    ))}
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>* Estimativa — configure motivos de perda no Kommo para dados exatos</p>
                  </div>
                )}
              </div>

              {/* Ciclo médio de venda */}
              <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                <p className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Ciclo médio de venda</p>
                {[
                  { label: 'Lead → Atendimento', val: '—' },
                  { label: 'Atend. → Orçamento', val: '—' },
                  { label: 'Orç. → Fechamento',  val: '—' },
                  { label: 'Ciclo total médio',   val: '—', highlight: true },
                ].map((row, i) => (
                  <div key={i} className="flex justify-between items-center py-2" style={{ borderBottom: i < 3 ? '1px solid var(--border)' : 'none' }}>
                    <span className="text-xs" style={{ color: row.highlight ? '#60a5fa' : '#64748b', fontWeight: row.highlight ? 500 : 400 }}>{row.label}</span>
                    <span className="text-xs font-semibold" style={{ color: row.highlight ? '#60a5fa' : '#94a3b8' }}>{row.val}</span>
                  </div>
                ))}
                <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>Requer rastreamento de movimentações no CRM</p>
              </div>

              {/* Comparativo de canais */}
              <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                <p className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Comparativo de canais</p>
                <div className="space-y-0">
                  {/* Header */}
                  <div className="flex items-center py-1.5 mb-1">
                    <span className="flex-1 text-xs" style={{ color: 'var(--text-muted)' }}></span>
                    <span className="w-20 text-center text-xs font-medium" style={{ color: '#818cf8' }}>Meta</span>
                    <span className="w-20 text-center text-xs font-medium" style={{ color: '#34d399' }}>Google</span>
                  </div>
                  {[
                    {
                      label: 'Leads',
                      meta:   String(canalComparativo.meta.leads),
                      google: String(canalComparativo.google.leads),
                    },
                    {
                      label: 'CPL',
                      meta:   canalComparativo.meta.cpl != null ? fmtMoney(canalComparativo.meta.cpl) : '—',
                      google: canalComparativo.google.cpl != null ? fmtMoney(canalComparativo.google.cpl) : '—',
                    },
                    {
                      label: 'Vendas',
                      meta:   String(canalComparativo.meta.won),
                      google: String(canalComparativo.google.won),
                    },
                    {
                      label: 'Conversão',
                      meta:   canalComparativo.meta.leads > 0 ? fmtPct1(canalComparativo.meta.conv) : '—',
                      google: canalComparativo.google.leads > 0 ? fmtPct1(canalComparativo.google.conv) : '—',
                    },
                    {
                      label: 'ROAS',
                      meta:   canalComparativo.meta.roas != null ? `${canalComparativo.meta.roas.toFixed(1).replace('.', ',')}x` : '—',
                      google: canalComparativo.google.roas != null ? `${canalComparativo.google.roas.toFixed(1).replace('.', ',')}x` : '—',
                    },
                  ].map((row, i, arr) => (
                    <div
                      key={i}
                      className="flex items-center py-2"
                      style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none' }}
                    >
                      <span className="flex-1 text-xs" style={{ color: 'var(--text-muted)' }}>{row.label}</span>
                      <span className="w-20 text-center text-xs font-semibold tabular-nums" style={{ color: '#a5b4fc' }}>{row.meta}</span>
                      <span className="w-20 text-center text-xs font-semibold tabular-nums" style={{ color: '#6ee7b7' }}>{row.google}</span>
                    </div>
                  ))}
                </div>
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
            <div className="rounded-xl" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
              <div className="px-4 py-3 flex items-center justify-between gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Top campanhas por gasto</p>
                <div className="flex items-center gap-2">
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Clique para detalhes</span>
                  {/* Column picker */}
                  <div className="relative" onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setColPickerOpen(false); }}>
                    <button
                      onClick={() => setColPickerOpen((o) => !o)}
                      title="Configurar colunas"
                      className="flex items-center justify-center rounded-md transition-colors"
                      style={{ width: 26, height: 26, backgroundColor: colPickerOpen ? 'rgba(59,130,246,0.15)' : 'var(--border)', color: colPickerOpen ? '#3b82f6' : 'var(--text-muted)' }}
                    >
                      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" style={{ width: 13, height: 13 }}>
                        <rect x="1" y="3" width="14" height="1.5" rx="0.75" />
                        <rect x="1" y="7.25" width="14" height="1.5" rx="0.75" />
                        <rect x="1" y="11.5" width="14" height="1.5" rx="0.75" />
                        <circle cx="5"  cy="3.75"  r="1.5" fill="currentColor" stroke="none" />
                        <circle cx="11" cy="8"     r="1.5" fill="currentColor" stroke="none" />
                        <circle cx="7"  cy="12.25" r="1.5" fill="currentColor" stroke="none" />
                      </svg>
                    </button>
                    {colPickerOpen && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setColPickerOpen(false)} />
                        <div
                          className="absolute right-0 z-50 rounded-xl py-2 shadow-xl"
                          style={{ top: 32, minWidth: 160, backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-md)' }}
                        >
                        <p className="px-3 pb-1.5 text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border)' }}>Colunas visíveis</p>
                        {OPTIONAL_COLS.map(({ key, label }) => (
                          <button
                            key={key}
                            onClick={() => toggleCol(key)}
                            className="w-full flex items-center gap-2.5 px-3 py-1.5 text-xs transition-colors text-left"
                            style={{ color: visibleCols.includes(key) ? 'var(--text-primary)' : 'var(--text-muted)' }}
                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-elevated)')}
                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '')}
                          >
                            <span
                              className="flex-shrink-0 rounded"
                              style={{ width: 13, height: 13, border: '1px solid', borderColor: visibleCols.includes(key) ? '#3b82f6' : '#334155', backgroundColor: visibleCols.includes(key) ? '#3b82f6' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              {visibleCols.includes(key) && (
                                <svg viewBox="0 0 10 10" fill="none" stroke="#fff" strokeWidth="1.8" style={{ width: 8, height: 8 }}>
                                  <polyline points="1.5,5 4,7.5 8.5,2" />
                                </svg>
                              )}
                            </span>
                            {label}
                          </button>
                        ))}
                      </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
              {campaigns.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-sm" style={{ color: 'var(--text-muted)' }}>Sem dados de campanha</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ backgroundColor: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
                        <th className="px-4 py-2.5 text-left font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Campanha</th>
                        <th className="px-4 py-2.5 text-left font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Plat.</th>
                        <th className="px-4 py-2.5 text-left font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Saúde</th>
                        {OPTIONAL_COLS.filter(({ key }) => visibleCols.includes(key)).map(({ key, label }) => (
                          <th key={key} className="px-4 py-2.5 text-left font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{label}</th>
                        ))}
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {campaigns.map((c, i) => {
                        const plt = PLATFORM_COLORS[c.platform] ?? PLATFORM_COLORS.Meta;
                        const ctr = c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0;
                        const cpc = c.clicks > 0 ? c.spend / c.clicks : 0;
                        const cpl = c.leads > 0 ? c.spend / c.leads : 0;
                        const cellVal: Record<ColKey, React.ReactNode> = {
                          spend:       <span style={{ color: 'var(--text-secondary)' }}>{fmtMoney(c.spend)}</span>,
                          leads:       <span style={{ color: 'var(--text-secondary)' }}>{c.leads > 0 ? c.leads : '—'}</span>,
                          ctr:         <span style={{ color: ctr >= 2 ? '#4ade80' : ctr >= 1 ? '#fbbf24' : '#f87171' }}>{fmtPct(ctr)}</span>,
                          cpc:         <span style={{ color: 'var(--text-secondary)' }}>{cpc > 0 ? fmtMoney(cpc) : '—'}</span>,
                          cpl:         <span style={{ color: 'var(--text-secondary)' }}>{cpl > 0 ? fmtMoney(cpl) : '—'}</span>,
                          impressions: <span style={{ color: 'var(--text-secondary)' }}>{c.impressions > 0 ? c.impressions.toLocaleString('pt-BR') : '—'}</span>,
                          clicks:      <span style={{ color: 'var(--text-secondary)' }}>{c.clicks > 0 ? c.clicks.toLocaleString('pt-BR') : '—'}</span>,
                        };
                        return (
                          <tr
                            key={i}
                            onClick={() => setSelectedCampaign(c)}
                            className="cursor-pointer transition-colors"
                            style={{ borderBottom: '1px solid var(--border)' }}
                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-elevated)')}
                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '')}
                          >
                            <td className="px-4 py-2.5" style={{ color: 'var(--text-primary)', maxWidth: 180 }}>
                              <span className="block truncate">{c.name}</span>
                            </td>
                            <td className="px-4 py-2.5">
                              <span className="inline-flex items-center gap-1 text-xs font-medium px-1.5 py-0.5 rounded-full" style={{ backgroundColor: plt.bg, color: plt.text }}>
                                <span className="h-1 w-1 rounded-full" style={{ backgroundColor: plt.dot }} />
                                {c.platform}
                              </span>
                            </td>
                            <td className="px-4 py-2.5">
                              {(() => {
                                const score = campaignHealthScores.get(c.name);
                                if (!score) return <span style={{ color: 'var(--text-muted)' }}>—</span>;
                                const cfg = HEALTH_SCORE_CFG[score];
                                return (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold" style={{ backgroundColor: cfg.bg, color: cfg.color }}>
                                    {score}
                                  </span>
                                );
                              })()}
                            </td>
                            {OPTIONAL_COLS.filter(({ key }) => visibleCols.includes(key)).map(({ key }) => (
                              <td key={key} className="px-4 py-2.5 tabular-nums">{cellVal[key]}</td>
                            ))}
                            <td className="px-4 py-2.5">
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: 'var(--text-muted)' }}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                              </svg>
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
            <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
              <p className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>CPL e distribuição por canal</p>
              <div className="space-y-4">
                {[
                  { label: 'Meta Ads',   data: cplByChannel.meta,   color: '#818cf8' },
                  { label: 'Google Ads', data: cplByChannel.google, color: '#34d399' },
                ].map(({ label, data, color }) => (
                  data.spend > 0 && (
                    <div key={label}>
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</span>
                        <span className="text-xs font-semibold" style={{ color }}>
                          {data.cpl ? `CPL ${fmtBRL(data.cpl)}` : `${data.leads} leads`}
                        </span>
                      </div>
                      <div className="h-2.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--border-md)' }}>
                        <div className="h-full rounded-full" style={{ width: `${data.pct}%`, backgroundColor: color, opacity: 0.7 }} />
                      </div>
                      <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
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
            <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
              <p className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>LTV & relação LTV/CAC</p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  {
                    label: 'LTV estimado',
                    value: ltvData.ltv ? fmtMoney(ltvData.ltv) : '—',
                    color: '#4ade80',
                    sub: `ticket × freq. (${ltvData.wonCount} vendas com valor)`,
                  },
                  {
                    label: 'CAC real',
                    value: ltvData.cacReal ? fmtBRL(ltvData.cacReal) : '—',
                    color: '#60a5fa',
                    sub: ltvData.wonFromPaidCount > 0
                      ? `gasto ÷ ${ltvData.wonFromPaidCount} vendas pagas`
                      : 'sem vendas via anúncio no período',
                  },
                  {
                    label: 'Relação LTV/CAC',
                    value: ltvData.ltvCacRatio
                      ? `${ltvData.ltvCacRatio.toFixed(1)}x`
                      : '—',
                    color: ltvData.ltvCacRatio && ltvData.ltvCacRatio >= 3 ? '#4ade80' : '#fbbf24',
                    sub: 'meta saudável ≥ 3x',
                  },
                  {
                    label: 'Clientes recorr.',
                    value: String(recurrentCount),
                    color: '#fbbf24',
                    sub: 'tag carteira no período',
                  },
                ].map((item, i) => (
                  <div key={i} className="rounded-lg p-2.5" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                    <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>{item.label}</p>
                    <p className="text-base font-semibold tabular-nums" style={{ color: item.color }}>{item.value}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{item.sub}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Projeção do mês */}
            <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
              <p className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Projeção do mês</p>
              {projection ? (
                <>
                  <p className="text-2xl font-semibold tabular-nums mt-2" style={{ color: '#4ade80' }}>{fmtMoney(projection.projected)}</p>
                  <p className="text-xs mt-1 mb-4" style={{ color: 'var(--text-muted)' }}>baseado no ritmo atual + pipeline ativo</p>
                  <div className="h-2 rounded-full overflow-hidden mb-2" style={{ backgroundColor: 'var(--border-md)' }}>
                    <div className="h-full rounded-full" style={{ width: `${(projection.dayOfMonth / projection.daysInMonth) * 100}%`, backgroundColor: '#4ade80', opacity: 0.7 }} />
                  </div>
                  <div className="flex justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
                    <span>Dia {projection.dayOfMonth}</span>
                    <span>Fim do mês: dia {projection.daysInMonth}</span>
                  </div>
                  <div className="mt-3 h-px" style={{ backgroundColor: 'var(--border)' }} />
                  <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                    Se 30% do pipeline fechar: <strong style={{ color: '#4ade80' }}>+ {fmtMoney(pipeline * 0.3)}</strong>
                  </p>
                </>
              ) : (
                <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>Sem receitas fechadas no período para projetar</p>
              )}
            </div>

            {/* ROAS por canal */}
            <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
              <p className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>ROAS por canal</p>
              <div className="space-y-4">
                {([
                  { label: 'Meta Ads',   roas: attributionSummary.roasMeta,   spend: attributionSummary.spendMeta,   color: '#818cf8', accent: 'rgba(129,140,248,0.12)' },
                  { label: 'Google Ads', roas: attributionSummary.roasGoogle, spend: attributionSummary.spendGoogle, color: '#34d399', accent: 'rgba(52,211,153,0.12)'  },
                ] as const).map(({ label, roas, spend, color }) => {
                  const hasSpend  = spend > 0;
                  const roasColor = roas != null && roas >= 2 ? '#4ade80' : roas != null ? '#f87171' : '#475569';
                  const roasLabel = roas != null
                    ? `${roas.toFixed(1).replace('.', ',')}x`
                    : hasSpend ? '—' : 'Sem dados';
                  return (
                    <div key={label}>
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</span>
                        <span className="text-xs font-semibold" style={{ color: roasColor }}>{roasLabel}</span>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--border-md)' }}>
                        {hasSpend && roas != null && roas > 0
                          ? <div className="h-full rounded-full" style={{ width: `${Math.min((roas / 10) * 100, 100)}%`, backgroundColor: color, opacity: 0.7 }} />
                          : !hasSpend
                            ? <div className="h-full rounded-full" style={{ width: '100%', backgroundColor: 'var(--bg-elevated)' }} />
                            : null
                        }
                      </div>
                      {!hasSpend && (
                        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                          {label === 'Google Ads' ? 'Integração não conectada — leads rastreados via UTM do Kommo' : 'Nenhum gasto no período'}
                        </p>
                      )}
                    </div>
                  );
                })}
                {attributionSummary.roasMeta != null && attributionSummary.roasMeta > 5 && (
                  <div className="rounded-lg p-2.5" style={{ backgroundColor: 'rgba(129,140,248,0.06)', border: '1px solid rgba(129,140,248,0.12)' }}>
                    <p className="text-xs" style={{ color: '#a5b4fc' }}>
                      ✦ Meta com ROAS {attributionSummary.roasMeta.toFixed(1).replace('.', ',')}x — considerar escalar verba
                    </p>
                  </div>
                )}
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

        <div className="grid grid-cols-1 gap-3">

          {/* Análise gerada */}
          <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-start justify-between mb-4">
              <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Análise gerada automaticamente</p>
              {latestInsight && (
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{new Date(latestInsight.createdAt).toLocaleDateString('pt-BR')}</span>
              )}
            </div>

            {insightLoading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm" style={{ color: 'var(--text-muted)' }}><Spinner /> Carregando...</div>
            ) : latestInsight?.content?.orchestrator ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Score geral</span>
                  <ScoreBadge score={latestInsight.content.orchestrator.overallScore} />
                </div>

                {latestInsight.content.orchestrator.executiveSummary && (
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{latestInsight.content.orchestrator.executiveSummary}</p>
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
                <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Nenhum relatório gerado</p>
                <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                  {isAdmin ? 'Clique em "⚡ Gerar relatório" acima.' : 'Aguarde o relatório diário.'}
                </p>
              </div>
            )}
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

      {/* ── Campaign Drawer ──────────────────────────────────────────────────── */}
      {selectedCampaign && (
        <CampaignDrawer
          campaign={selectedCampaign}
          campaignRows={metaAll.filter(
            (d) => (!d.level || d.level === 'campaign') && d.campaignName === selectedCampaign.name
          )}
          adsetRows={metaAll.filter(
            (d) => d.level === 'adset' && d.campaignName === selectedCampaign.name
          )}
          googleCampaignRows={
            selectedCampaign.platform === 'Google'
              ? googleAdsMetrics.filter((d) => d.campaignName === selectedCampaign.name)
              : undefined
          }
          onClose={() => setSelectedCampaign(null)}
        />
      )}
    </div>
  );
}