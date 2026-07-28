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
import { LineChart, Line, ComposedChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

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
// "Pipeline em negociação" considera negociação a partir do orçamento enviado (cliente já recebeu proposta)
const PIPELINE_NEGOTIATION_STATUSES = [...QUOTE_STATUSES, ...NEGOTIATION_STATUSES];

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

type OriginTag = { label: string; bg: string; text: string };

function originTagFor(utmSource: string | null, isDark: boolean): OriginTag {
  const ORIGIN_TAGS: Record<string, OriginTag> = isDark ? {
    meta:      { label: 'Meta',       bg: 'rgba(129,140,248,0.12)', text: '#a5b4fc' },
    google:    { label: 'Google',     bg: 'rgba(52,211,153,0.12)',  text: '#6ee7b7' },
    WhatsApp:  { label: 'WhatsApp',   bg: 'rgba(74,222,128,0.12)',  text: '#4ade80' },
    Prospeção: { label: 'Prospecção', bg: 'var(--bg-elevated)',     text: 'var(--text-muted)' },
  } : {
    meta:      { label: 'Meta',       bg: 'rgba(99,102,241,0.10)', text: '#4338ca' },
    google:    { label: 'Google',     bg: 'rgba(5,150,105,0.10)',  text: '#047857' },
    WhatsApp:  { label: 'WhatsApp',   bg: 'rgba(22,163,74,0.10)',  text: '#16a34a' },
    Prospeção: { label: 'Prospecção', bg: 'var(--bg-elevated)',    text: 'var(--text-muted)' },
  };
  const noTrackTag: OriginTag = { label: 'Sem rastreio', bg: 'var(--bg-elevated)', text: 'var(--text-muted)' };
  return utmSource ? (ORIGIN_TAGS[utmSource] ?? { label: utmSource, bg: 'var(--bg-elevated)', text: 'var(--text-muted)' }) : noTrackTag;
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

function getKommoClosedDate(lead: KommoLead): Date | null {
  const raw = lead.rawData as Record<string, unknown>;
  const ts =
    (raw?.closed_at as number | undefined) ??
    ((raw?.rawData as Record<string, unknown> | undefined)?.closed_at as number | undefined);
  return ts ? new Date(ts * 1000) : null;
}

// Vendas ganhas/perdidas são contadas pela data de FECHAMENTO (closed_at) — mesma base
// da Meta do Mês. Fallback para a data de criação quando o closed_at está ausente
// (mesma regra do backend em /api/revenue-goals/progress).
function filterKommoByClosedRange(leads: KommoLead[], start: Date, end: Date): KommoLead[] {
  return leads.filter((l) => {
    const d = getKommoClosedDate(l) ?? getKommoDate(l);
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

function InfoTip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span
      className="relative inline-flex shrink-0"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label="O que significa esta métrica?"
        onClick={() => setOpen((o) => !o)}
        onBlur={() => setOpen(false)}
        className="flex items-center justify-center cursor-help"
        style={{ color: 'var(--text-muted)' }}
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
        </svg>
      </button>
      {open && (
        <span
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-30 rounded-lg px-2.5 py-2 text-xs font-normal normal-case tracking-normal text-left"
          style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-md)', color: 'var(--text-secondary)', width: 'min(220px, 78vw)', boxShadow: '0 4px 24px rgba(0,0,0,0.18)', whiteSpace: 'normal', lineHeight: 1.45 }}
        >
          {text}
        </span>
      )}
    </span>
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
  info?: string;
}

function KpiCard({ title, value, delta, invertDelta = false, neutralDelta = false, sub, sparkData, animKey, info }: KpiCardProps) {
  const positive = invertDelta ? delta <= 0 : delta >= 0;
  const arrow = delta >= 0 ? '↑' : '↓';
  return (
    <div className="rounded-xl p-4 flex flex-col gap-2" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1 min-w-0">
          <span className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{title}</span>
          {info && <InfoTip text={info} />}
        </span>
        {delta !== 0 && (
          <span
            className="text-xs font-semibold px-1.5 py-0.5 rounded"
            style={neutralDelta
              ? { backgroundColor: 'rgba(148,163,184,0.10)', color: 'var(--text-secondary)' }
              : {
                  backgroundColor: positive ? 'var(--badge-success-bg)' : 'var(--badge-error-bg)',
                  color: positive ? 'var(--badge-success-text)' : 'var(--badge-error-text)',
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
  info?: string;
}

function BottomKpiCard({ title, value, sub, badge, badgeColor, accent = 'var(--text-primary)', info }: BottomKpiProps) {
  return (
    <div className="rounded-xl p-4 flex flex-col gap-1.5" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
      <span className="flex items-center gap-1 min-w-0">
        <span className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{title}</span>
        {info && <InfoTip text={info} />}
      </span>
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

// ─── Meta de faturamento do mês ────────────────────────────────────────────────

function MonthlyGoalCard({ progress, canEdit, onSaved, chartData, wonLeads }: {
  progress: import('@/types').RevenueGoalProgress;
  canEdit: boolean;
  onSaved: () => void;
  chartData?: import('@/types').RevenueGoalProgress[];
  wonLeads?: import('@/types').WonLead[];
}) {
  const [editing, setEditing]       = useState(false);
  const [value, setValue]           = useState('');
  const [saving, setSaving]         = useState(false);
  const [chartOpen, setChartOpen]   = useState(false);
  const [leadsOpen, setLeadsOpen]   = useState(false);
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme !== 'light';

  const originTag = (utmSource: string | null) => originTagFor(utmSource, isDark);

  const { realized, target } = progress;
  const pctRaw  = target && target > 0 ? (realized / target) * 100 : 0;
  const pct     = Math.min(pctRaw, 100);
  const reached = target != null && target > 0 && realized >= target;
  const barColor = reached
    ? 'var(--badge-success-text)'
    : pctRaw >= 70 ? 'var(--badge-warn-text)' : 'var(--badge-error-text)';

  const startEdit = () => {
    setValue(target != null ? String(target) : '');
    setEditing(true);
  };

  const save = async () => {
    const raw = value.trim();
    const normalized = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw;
    const num = parseFloat(normalized);
    if (!isFinite(num) || num < 0) return;
    setSaving(true);
    try {
      await apiService.saveRevenueGoal({ month: progress.month, year: progress.year, target: num });
      setEditing(false);
      onSaved();
    } finally {
      setSaving(false);
    }
  };

  const showChart = chartData && chartData.length > 1;

  return (
    <div className="rounded-xl p-4 flex flex-col gap-3" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1 text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          Meta do mês · {progress.label}
          <InfoTip text="Soma das vendas marcadas como ganhas no CRM em junho, pela data de fechamento do negócio — independente de quando o lead entrou. Pode ser maior que a Receita Fechada do funil, que conta só leads criados no período selecionado." />
        </span>
        <div className="flex items-center gap-2">
          {showChart && (
            <button
              onClick={() => setChartOpen((o) => !o)}
              className="flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded transition-colors"
              style={{ color: 'var(--text-secondary)', backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
            >
              Histórico
              <svg className="h-3 w-3 transition-transform" style={{ transform: chartOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          )}
          {canEdit && !editing && (
            <button onClick={startEdit} className="text-xs font-medium px-2 py-0.5 rounded transition-colors"
              style={{ color: '#60a5fa', backgroundColor: 'rgba(59,130,246,0.12)' }}>
              {target != null ? 'Editar' : 'Definir meta'}
            </button>
          )}
        </div>
      </div>

      {editing ? (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 flex-1 rounded-lg px-3 py-2" style={{ backgroundColor: 'var(--bg-base)', border: '1px solid var(--border)' }}>
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>R$</span>
            <input
              type="text" inputMode="decimal" autoFocus value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
              placeholder="0,00"
              className="flex-1 bg-transparent text-sm outline-none tabular-nums"
              style={{ color: 'var(--text-primary)' }}
            />
          </div>
          <button onClick={save} disabled={saving}
            className="text-xs font-semibold px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
            style={{ backgroundColor: '#3b82f6', color: '#fff' }}>
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
          <button onClick={() => setEditing(false)} className="text-xs font-medium px-2 py-2 rounded-lg" style={{ color: 'var(--text-muted)' }}>
            Cancelar
          </button>
        </div>
      ) : target == null ? (
        <div className="flex flex-col gap-1">
          <p className="text-2xl font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>{fmtMoney(realized)}</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {canEdit ? 'Nenhuma meta definida para o mês.' : 'Faturamento realizado · meta não definida.'}
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-end justify-between gap-2">
            <p className="text-2xl font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
              {fmtMoney(realized)}
              <span className="text-sm font-normal" style={{ color: 'var(--text-muted)' }}> / {fmtMoney(target)}</span>
            </p>
            <span className="text-sm font-semibold tabular-nums" style={{ color: barColor }}>{pctRaw.toFixed(0)}%</span>
          </div>
          <div className="h-2 w-full rounded-full overflow-hidden" style={{ backgroundColor: 'var(--border)' }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: barColor }} />
          </div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {reached
              ? `Meta atingida · ${fmtMoney(realized - target)} acima`
              : `Faltam ${fmtMoney(target - realized)} para a meta`}
          </p>
        </>
      )}

      {wonLeads && wonLeads.length > 0 && (
        <div className="pt-1" style={{ borderTop: '1px solid var(--border)' }}>
          <button
            onClick={() => setLeadsOpen((o) => !o)}
            className="flex items-center gap-1.5 w-full text-left py-1"
          >
            <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              Vendas no mês ({wonLeads.length})
            </span>
            <svg className="h-3 w-3 transition-transform" style={{ transform: leadsOpen ? 'rotate(180deg)' : 'rotate(0deg)', color: 'var(--text-muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {leadsOpen && (
            <div className="mt-1 flex flex-col gap-0.5">
              {wonLeads.map((l) => (
                <div key={l.externalId} className="flex items-center justify-between gap-2 py-1.5 px-2 rounded-lg" style={{ backgroundColor: 'var(--bg-elevated)' }}>
                  <div className="flex items-center gap-2 min-w-0">
                    {l.kommoUrl ? (
                      <a href={l.kommoUrl} target="_blank" rel="noopener noreferrer" className="text-xs truncate hover:underline" style={{ color: 'var(--text-primary)' }}>
                        {l.name ?? '(sem nome)'}
                      </a>
                    ) : (
                      <span className="text-xs truncate" style={{ color: 'var(--text-primary)' }}>{l.name ?? '(sem nome)'}</span>
                    )}
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded flex-shrink-0" style={{ backgroundColor: originTag(l.utmSource).bg, color: originTag(l.utmSource).text }}>
                      {originTag(l.utmSource).label}
                    </span>
                    {l.closedAt && (
                      <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
                        {new Date(l.closedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' })}
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-medium tabular-nums flex-shrink-0" style={{ color: l.price > 0 ? 'var(--badge-success-text)' : 'var(--text-muted)' }}>
                    {fmtMoney(l.price)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showChart && chartOpen && (
        <div className="pt-1" style={{ borderTop: '1px solid var(--border)' }}>
          <MonthlyRevenueChart data={chartData!} />
        </div>
      )}
    </div>
  );
}

// ─── Gráfico de faturamento mês a mês (Frente C) ───────────────────────────────

interface ChartTooltipItem { dataKey?: string; value?: number | null }

function RevenueChartTooltip({ active, payload, label }: { active?: boolean; payload?: ChartTooltipItem[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const realized = payload.find((p) => p.dataKey === 'realized')?.value;
  const target   = payload.find((p) => p.dataKey === 'target')?.value;
  return (
    <div style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-md)', borderRadius: 8, padding: '8px 10px' }}>
      <p className="text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>{label}</p>
      <p className="text-xs tabular-nums" style={{ color: 'var(--text-primary)' }}>Receita: {fmtMoney(Number(realized ?? 0))}</p>
      {target != null && (
        <p className="text-xs tabular-nums" style={{ color: 'var(--badge-warn-text)' }}>Meta: {fmtMoney(Number(target))}</p>
      )}
    </div>
  );
}

function MonthlyRevenueChart({ data }: { data: import('@/types').RevenueGoalProgress[] }) {
  const hasAnyTarget = data.some((d) => d.target != null && d.target > 0);
  return (
    <div className="pt-2">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <p className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Faturamento mês a mês</p>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
            <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: '#60a5fa' }} /> Receita fechada
          </span>
          {hasAnyTarget && (
            <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
              <span className="h-0 w-4 border-t-2 border-dashed" style={{ borderColor: 'var(--badge-warn-text)' }} /> Meta
            </span>
          )}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--chart-axis)' }} tickLine={false} axisLine={false} />
          <YAxis
            tick={{ fontSize: 11, fill: 'var(--chart-axis)' }} tickLine={false} axisLine={false} width={78}
            tickFormatter={(v: number) => `R$ ${Math.round(v).toLocaleString('pt-BR')}`}
          />
          <Tooltip content={<RevenueChartTooltip />} cursor={{ fill: 'var(--text-muted)', opacity: 0.08 }} />
          <Bar dataKey="realized" fill="#60a5fa" radius={[4, 4, 0, 0]} maxBarSize={48} />
          <Line
            dataKey="target" stroke="var(--badge-warn-text)" strokeWidth={2} strokeDasharray="5 4"
            connectNulls dot={{ r: 3, fill: 'var(--badge-warn-text)', strokeWidth: 0 }} activeDot={{ r: 4 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
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
    critical:    { bg: 'var(--badge-error-bg)',   borderColor: 'var(--badge-error-text)',   titleColor: 'var(--badge-error-text)',   icon: '🔴', label: 'Crítico' },
    warning:     { bg: 'var(--badge-warn-bg)',    borderColor: 'var(--badge-warn-text)',    titleColor: 'var(--badge-warn-text)',    icon: '🟡', label: 'Atenção' },
    opportunity: { bg: 'var(--badge-success-bg)', borderColor: 'var(--badge-success-text)', titleColor: 'var(--badge-success-text)', icon: '🟢', label: 'Oportunidade' },
  }[alert.type];
  return (
    <div className="rounded-xl p-4 flex flex-col gap-2" style={{ backgroundColor: styles.bg, border: '1px solid var(--border)', borderLeft: `3px solid ${styles.borderColor}` }}>
      <p className="text-xs font-semibold" style={{ color: styles.titleColor }}>{styles.icon} {styles.label}</p>
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
                          <td className="px-4 py-2.5 tabular-nums" style={{ color: aCtr >= 2 ? 'var(--badge-success-text)' : aCtr >= 1 ? 'var(--badge-warn-text)' : 'var(--badge-error-text)' }}>{fmtPct(aCtr)}</td>
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
                          <td className="px-4 py-2.5 tabular-nums" style={{ color: dCtr >= 2 ? 'var(--badge-success-text)' : dCtr >= 1 ? 'var(--badge-warn-text)' : 'var(--badge-error-text)' }}>{fmtPct(dCtr)}</td>
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
  const [goalProgress, setGoalProgress] = useState<import('@/types').RevenueGoalProgress[] | null>(null);
  const [wonLeads, setWonLeads] = useState<import('@/types').WonLead[] | null>(null);
  const [crmHygiene, setCrmHygiene] = useState<import('@/types').CrmHygiene | null>(null);
  const [hygieneOpen, setHygieneOpen] = useState<'stagnant' | 'wonNoValue' | 'noOrigin' | null>(null);
  const [sellersRanking, setSellersRanking] = useState<import('@/types').SellersRanking | null>(null);
  const [rankingMonth, setRankingMonth] = useState<{ year: number; month: number } | null>(null);
  const [negotiatingOpen, setNegotiatingOpen] = useState(false);
  const [lastUpdate]                  = useState(() => new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }));
  const [funnelTab, setFunnelTab]     = useState<'total' | 'meta' | 'google'>('total');
  const [mktTab, setMktTab]           = useState<'total' | 'meta' | 'google'>('total');
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

  const BOTTOM_KPI_OPTIONS = [
    { key: 'roas',      label: 'ROAS atribuído'  },
    { key: 'cac',       label: 'CPL'             },
    { key: 'receita',   label: 'Receita fechada' },
    { key: 'pipeline',  label: 'Pipeline'        },
    { key: 'leads',     label: 'Leads'           },
    { key: 'cpl',       label: 'CPL geral'       },
    { key: 'conversao', label: 'Conversão'       },
    { key: 'ticket',    label: 'Ticket médio'    },
  ] as const;
  type BottomKpiKey = typeof BOTTOM_KPI_OPTIONS[number]['key'];
  const DEFAULT_BOTTOM_KPIS: BottomKpiKey[] = ['roas', 'cac', 'receita', 'pipeline'];
  const [visibleBottomKpis, setVisibleBottomKpis] = useState<BottomKpiKey[]>(() => {
    if (typeof window === 'undefined') return DEFAULT_BOTTOM_KPIS;
    try {
      const saved = localStorage.getItem('dashboard_bottom_kpis');
      if (saved) return JSON.parse(saved) as BottomKpiKey[];
    } catch { /* ignore */ }
    return DEFAULT_BOTTOM_KPIS;
  });
  const [bottomKpiPickerOpen, setBottomKpiPickerOpen] = useState(false);
  const toggleBottomKpi = (key: BottomKpiKey) => {
    setVisibleBottomKpis((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
      localStorage.setItem('dashboard_bottom_kpis', JSON.stringify(next));
      return next;
    });
  };

  const TOPO_KPI_OPTIONS = [
    { key: 'reach',        label: 'Alcance (Meta)'       },
    { key: 'frequency',    label: 'Frequência (Meta)'     },
    { key: 'conv_meta',    label: 'Conversões Meta'       },
    { key: 'conv_google',  label: 'Conversões Google'     },
    { key: 'cpa',          label: 'Custo/Conversão'       },
    { key: 'leads_meta',   label: 'Leads Meta (Kommo)'    },
    { key: 'leads_google', label: 'Leads Google (Kommo)'  },
    { key: 'cpl_meta',     label: 'CPL Meta'              },
    { key: 'cpl_google',   label: 'CPL Google'            },
    { key: 'cpm',          label: 'CPM'                   },
    { key: 'cpc',          label: 'CPC'                   },
  ] as const;
  type TopoKpiKey = typeof TOPO_KPI_OPTIONS[number]['key'];
  const DEFAULT_TOPO_KPIS: TopoKpiKey[] = [];
  const [visibleTopoKpis, setVisibleTopoKpis] = useState<TopoKpiKey[]>(() => {
    if (typeof window === 'undefined') return DEFAULT_TOPO_KPIS;
    try {
      const saved = localStorage.getItem('dashboard_topo_kpis');
      if (saved) return JSON.parse(saved) as TopoKpiKey[];
    } catch { /* ignore */ }
    return DEFAULT_TOPO_KPIS;
  });
  const [topoKpiPickerOpen, setTopoKpiPickerOpen] = useState(false);
  const toggleTopoKpi = (key: TopoKpiKey) => {
    setVisibleTopoKpis((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
      localStorage.setItem('dashboard_topo_kpis', JSON.stringify(next));
      return next;
    });
  };

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
  const canEditGoal = isAdmin || user?.role === 'TRAFFIC_MANAGER';
  const currentGoal = goalProgress && goalProgress.length > 0 ? goalProgress[goalProgress.length - 1] : null;

  const loadSellersRanking = (year: number, month: number) => {
    setRankingMonth({ year, month });
    apiService.getSellersRanking(year, month)
      .then((sr) => { if (sr.success) setSellersRanking(sr.data); })
      .catch(() => {});
  };

  const navRankingMonth = (delta: number) => {
    if (!rankingMonth) return;
    const d = new Date(rankingMonth.year, rankingMonth.month - 1 + delta, 1);
    loadSellersRanking(d.getFullYear(), d.getMonth() + 1);
  };

  const loadGoalProgress = () => {
    apiService.getRevenueGoalProgress(6).then((r) => {
      if (r.success) {
        setGoalProgress(r.data);
        const current = r.data[r.data.length - 1];
        if (current) {
          apiService.getWonLeads(current.year, current.month)
            .then((wr) => { if (wr.success) setWonLeads(wr.data.leads); })
            .catch(() => {});
          loadSellersRanking(current.year, current.month);
        }
      }
    }).catch(() => {});
  };

  useEffect(() => {
    fetchIntegrations();
    fetchAllDashboardData(30);
    fetchLatestInsight();
    apiService.getManualRevenueSummary(3).then((r) => { if (r.success) setManualRevenueSummary(r.data); }).catch(() => {});
    loadGoalProgress();
    apiService.getCrmHygiene().then((r) => { if (r.success && r.data.hasData) setCrmHygiene(r.data); }).catch(() => {});
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
      const s = new Date(customStart); s.setUTCHours(0, 0, 0, 0);
      const e = new Date(customEnd);   e.setUTCHours(23, 59, 59, 999);
      return { start: s, end: e };
    }
    const days = PRESETS[range as Exclude<Range, 'CUSTOM'>]?.days ?? 30;
    const e = new Date();
    const s = new Date();
    s.setDate(s.getDate() - days);
    s.setUTCHours(0, 0, 0, 0);
    return { start: s, end: e };
  }, [range, customStart, customEnd]);

  const activeDays = useMemo(() => {
    if (range === 'CUSTOM' && customStart && customEnd) {
      const diff = new Date(customEnd).getTime() - new Date(customStart).getTime();
      // +1: janela inclusiva (01/06–11/06 são 11 dias, não 10)
      return Math.max(1, Math.round(diff / 86400000) + 1);
    }
    return PRESETS[range as Exclude<Range, 'CUSTOM'>]?.days ?? 30;
  }, [range, customStart, customEnd]);

  useEffect(() => {
    // Range personalizado manda a janela explícita — só "days" fazia o backend
    // calcular "últimos N dias" e ignorar as datas escolhidas
    if (range === 'CUSTOM' && customStart && customEnd) {
      fetchAttributionSummary(activeDays, customStart, customEnd);
    } else {
      fetchAttributionSummary(activeDays);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDays, range, customStart, customEnd]);

  const rangeLabel = useMemo(() => {
    if (range === 'CUSTOM') {
      if (!customStart || !customEnd) return 'Personalizado';
      // timeZone UTC: 'YYYY-MM-DD' é parseado como meia-noite UTC; formatar em BRT volta um dia
      const fmt = (d: string) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', timeZone: 'UTC' });
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
  // Vendas fechadas (ganhas/perdidas) DENTRO do período, por closed_at — inclui leads
  // criados antes do período. As etapas do funil (gerados/atendidos/orçamento) seguem
  // por data de criação (kommoCur).
  const kommoWonCur  = useMemo(() => filterKommoByClosedRange(kommoLeads.filter((l) => WON_STATUSES.includes(l.status)),  activePeriod.start, activePeriod.end), [kommoLeads, activePeriod]);
  const kommoLostCur = useMemo(() => filterKommoByClosedRange(kommoLeads.filter((l) => LOST_STATUSES.includes(l.status)), activePeriod.start, activePeriod.end), [kommoLeads, activePeriod]);

  // ── Filtered arrays for marketing platform tab ────────────────────────────
  const mktMetaCur    = useMemo(() => mktTab === 'google' ? ([] as typeof metaCur)    : metaCur,    [metaCur,    mktTab]);
  const mktGoogleCur  = useMemo(() => mktTab === 'meta'   ? ([] as typeof googleCur)  : googleCur,  [googleCur,  mktTab]);
  const mktMetaPrev   = useMemo(() => mktTab === 'google' ? ([] as typeof metaPrev)   : metaPrev,   [metaPrev,   mktTab]);
  const mktGooglePrev = useMemo(() => mktTab === 'meta'   ? ([] as typeof googlePrev) : googlePrev, [googlePrev, mktTab]);

  // ── KPIs ───────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const curSpend   = mktMetaCur.reduce((s, d) => s + d.spend, 0)       + mktGoogleCur.reduce((s, d) => s + d.cost, 0);
    const prevSpend  = mktMetaPrev.reduce((s, d) => s + d.spend, 0)      + mktGooglePrev.reduce((s, d) => s + d.cost, 0);
    const curImpr    = mktMetaCur.reduce((s, d) => s + d.impressions, 0) + mktGoogleCur.reduce((s, d) => s + d.impressions, 0);
    const prevImpr   = mktMetaPrev.reduce((s, d) => s + d.impressions, 0) + mktGooglePrev.reduce((s, d) => s + d.impressions, 0);
    const curClicks  = mktMetaCur.reduce((s, d) => s + d.clicks, 0)      + mktGoogleCur.reduce((s, d) => s + d.clicks, 0);
    const prevClicks = mktMetaPrev.reduce((s, d) => s + d.clicks, 0)     + mktGooglePrev.reduce((s, d) => s + d.clicks, 0);
    const curCtr     = curImpr  > 0 ? (curClicks  / curImpr)  * 100 : 0;
    const prevCtr    = prevImpr > 0 ? (prevClicks / prevImpr) * 100 : 0;
    const metaSpend  = metaCur.reduce((s, d) => s + d.spend, 0);
    const googleSpend = googleCur.reduce((s, d) => s + d.cost, 0);
    const cpm        = curImpr > 0 ? (curSpend / curImpr) * 1000 : 0;
    const cpc        = curClicks > 0 ? curSpend / curClicks : 0;

    return {
      spend:  { value: fmtMoney(curSpend),   delta: calcDelta(curSpend, prevSpend),   sub: mktTab === 'total' ? `Meta ${fmtMoney(metaSpend)} · Google ${fmtMoney(googleSpend)}` : `CPM médio ${fmtBRL(cpm)}` },
      impr:   { value: fmtNum(curImpr),       delta: calcDelta(curImpr, prevImpr),     sub: `CPM médio ${fmtBRL(cpm)}` },
      clicks: { value: fmtNum(curClicks),     delta: calcDelta(curClicks, prevClicks), sub: `CPC médio ${fmtBRL(cpc)}` },
      ctr:    { value: fmtPct(curCtr),        delta: calcDelta(curCtr, prevCtr),       sub: 'Cliques ÷ Impressões' },
    };
  }, [mktMetaCur, mktGoogleCur, mktMetaPrev, mktGooglePrev, metaCur, googleCur, mktTab]);

  // ── Conversões nativas das plataformas (Google/Meta) — base do dashboard sem CRM ──
  const platformConv = useMemo(() => {
    const sum = (arr: typeof metaCur, key: string) => arr.reduce((s, d) => s + (Number((d as Record<string, unknown>)[key]) || 0), 0);
    const metaConv    = sum(metaCur, 'conversions');
    const googleConv  = sum(googleCur, 'conversions');
    const metaValue   = sum(metaCur, 'conversionsValue');
    const googleValue = sum(googleCur, 'conversionsValue');
    const metaSpend   = sum(metaCur, 'spend');
    const googleSpend = sum(googleCur, 'cost');
    const totalConv   = metaConv + googleConv;
    const totalSpend  = metaSpend + googleSpend;
    const totalValue  = metaValue + googleValue;
    return {
      metaConv, googleConv, totalConv, totalValue,
      cpl:       totalConv  > 0 ? totalSpend  / totalConv  : null,
      metaCpl:   metaConv   > 0 ? metaSpend   / metaConv   : null,
      googleCpl: googleConv > 0 ? googleSpend / googleConv : null,
      roas:      totalValue > 0 && totalSpend > 0 ? totalValue / totalSpend : null,
    };
  }, [metaCur, googleCur]);

  // ── Topo de Funil — métricas extras para o painel Personalizar ─────────────
  const topoKpis = useMemo(() => {
    const metaSpend    = mktMetaCur.reduce((s, d) => s + d.spend, 0);
    const googleSpend  = mktGoogleCur.reduce((s, d) => s + d.cost, 0);
    const totalSpend   = metaSpend + googleSpend;
    const metaImpr     = mktMetaCur.reduce((s, d) => s + d.impressions, 0);
    const metaClicks   = mktMetaCur.reduce((s, d) => s + d.clicks, 0);
    const googleImpr   = mktGoogleCur.reduce((s, d) => s + d.impressions, 0);
    const googleClicks = mktGoogleCur.reduce((s, d) => s + d.clicks, 0);
    const totalImpr    = metaImpr + googleImpr;
    const totalClicks  = metaClicks + googleClicks;
    const reach        = mktMetaCur.reduce((s, d) => s + (d.reach ?? 0), 0);
    const frequency    = reach > 0 ? metaImpr / reach : null;
    const metaConv     = mktMetaCur.reduce((s, d) => s + (d.conversions ?? 0), 0);
    const googleConv   = mktGoogleCur.reduce((s, d) => s + (d.conversions ?? 0), 0);
    const totalConv    = metaConv + googleConv;
    const metaLeads    = kommoCur.filter((l) => l.utmSource === 'meta').length;
    const googleLeads  = kommoCur.filter((l) => l.utmSource === 'google').length;
    return {
      reach, frequency,
      metaConv, googleConv, totalConv,
      cpa:       totalConv  > 0 ? totalSpend  / totalConv   : null,
      cpm:       totalImpr  > 0 ? (totalSpend / totalImpr)  * 1000 : null,
      cpc:       totalClicks > 0 ? totalSpend / totalClicks  : null,
      metaLeads, googleLeads,
      cplMeta:   metaLeads   > 0 ? metaSpend   / metaLeads   : null,
      cplGoogle: googleLeads > 0 ? googleSpend / googleLeads : null,
    };
  }, [mktMetaCur, mktGoogleCur, kommoCur]);

  // ── Sparklines ─────────────────────────────────────────────────────────────
  const sparkSpend  = useMemo(() => dailyValues(mktMetaCur, mktGoogleCur, (m) => m.spend, (g) => g.cost), [mktMetaCur, mktGoogleCur]);
  const sparkImpr   = useMemo(() => dailyValues(mktMetaCur, mktGoogleCur, (m) => m.impressions, (g) => g.impressions), [mktMetaCur, mktGoogleCur]);
  const sparkClicks = useMemo(() => dailyValues(mktMetaCur, mktGoogleCur, (m) => m.clicks, (g) => g.clicks), [mktMetaCur, mktGoogleCur]);
  const sparkCtr    = useMemo(() => {
    const imprArr  = dailyValues(mktMetaCur, mktGoogleCur, (m) => m.impressions, (g) => g.impressions);
    const clickArr = dailyValues(mktMetaCur, mktGoogleCur, (m) => m.clicks, (g) => g.clicks);
    return imprArr.map((imp, i) => imp > 0 ? (clickArr[i] / imp) * 100 : 0);
  }, [mktMetaCur, mktGoogleCur]);

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
  // Etapas (gerados → negociando) são coorte por data de criação; ganho/perdido são
  // contados por data de FECHAMENTO no período (podem vir de leads criados antes).
  const funnelCounts = useMemo<FunnelCounts>(() => {
    const contactedOrBeyond = [...CONTACT_STATUSES, ...QUOTE_STATUSES, ...NEGOTIATION_STATUSES, ...WON_STATUSES];
    const quotedOrBeyond    = [...QUOTE_STATUSES, ...NEGOTIATION_STATUSES, ...WON_STATUSES];
    const negOrBeyond       = [...NEGOTIATION_STATUSES, ...WON_STATUSES];
    const byTab = (leads: KommoLead[]) =>
      funnelTab === 'meta'   ? leads.filter((l) => l.utmSource === 'meta')
    : funnelTab === 'google' ? leads.filter((l) => l.utmSource === 'google')
    : leads;
    return {
      generated:   funnelLeads.length,
      contacted:   funnelLeads.filter((l) => contactedOrBeyond.includes(l.status)).length,
      quoted:      funnelLeads.filter((l) => quotedOrBeyond.includes(l.status)).length,
      negotiating: funnelLeads.filter((l) => negOrBeyond.includes(l.status)).length,
      won:         byTab(kommoWonCur).length,
      lost:        byTab(kommoLostCur).length,
    };
  }, [funnelLeads, kommoWonCur, kommoLostCur, funnelTab]);

  // ── Revenue / pipeline from Kommo ─────────────────────────────────────────
  // closedValue: vendas fechadas no período (closed_at). Pipeline: leads abertos
  // criados no período (coorte — segue por created_at).
  const { closedValue, pipeline } = useMemo(() => {
    let pipeline = 0;
    kommoCur.forEach((l) => {
      if (l.price == null || l.price === 0) return;
      if (!WON_STATUSES.includes(l.status) && !LOST_STATUSES.includes(l.status)) pipeline += l.price;
    });
    const closedValue = kommoWonCur.reduce((s, l) => s + (l.price ?? 0), 0);
    return { pipeline, closedValue };
  }, [kommoCur, kommoWonCur]);

  // ── Revenue filtered by marketing platform tab ─────────────────────────────
  // Vendas fechadas no período (closed_at), filtradas pela aba de plataforma.
  const { mktClosedValue, mktWonCount } = useMemo(() => {
    const leads = mktTab === 'meta'   ? kommoWonCur.filter(l => l.utmSource === 'meta')
                : mktTab === 'google' ? kommoWonCur.filter(l => l.utmSource === 'google')
                : kommoWonCur;
    let mktClosedValue = 0, mktWonCount = 0;
    leads.forEach(l => {
      if (l.price == null || l.price === 0) return;
      mktClosedValue += l.price; mktWonCount++;
    });
    return { mktClosedValue, mktWonCount };
  }, [kommoWonCur, mktTab]);

  // ── Pipeline em negociação filtrado por canal — estado atual, sem filtro de período ──
  const mktPipeline = useMemo(() => {
    const leads = mktTab === 'meta'   ? kommoLeads.filter(l => l.utmSource === 'meta')
                : mktTab === 'google' ? kommoLeads.filter(l => l.utmSource === 'google')
                : kommoLeads;
    return leads.reduce((s, l) => (PIPELINE_NEGOTIATION_STATUSES.includes(l.status) ? s + (l.price ?? 0) : s), 0);
  }, [kommoLeads, mktTab]);

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
    // Todos os canais, independente da aba do funil. Vendas contadas por data de
    // FECHAMENTO no período (kommoWonCur) — mesma base do closedValue.
    // wonWithPrice: vendas com valor registrado (base do ticket médio)
    const wonWithPrice = kommoWonCur.filter(
      (l) => l.price != null && (l.price as number) > 0,
    );
    const wonTotal = kommoWonCur.length;
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
  }, [kommoCur, kommoWonCur, closedValue, recurrentCount, attributionSummary]);

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
  // CRM Cortex projeta as vendas no mesmo read model do Kommo — pra exibição de
  // receita/funil as duas fontes são equivalentes. O Ranking de Vendedores passou a
  // usar hasCrmSource (nome vem do rawData nas orgs CRM Cortex); só os deep-links
  // continuam exclusivos do Kommo, porque apontam pra URL do lead lá.
  const hasCrmSource = hasKommo || integrations.some(
    (i) => i.type === 'CRM_CORTEX' && i.status === 'CONNECTED'
  );

  const negotiatingLeads = useMemo(() => {
    const domain = integrations.find((i) => i.type === 'KOMMO' && i.status === 'CONNECTED')?.externalId ?? null;
    const kommoUrl = (id: number) => (domain ? `https://${domain}/leads/detail/${id}` : null);
    return kommoLeads
      .filter((l) => PIPELINE_NEGOTIATION_STATUSES.includes(l.status))
      .map((l) => ({ ...l, kommoUrl: kommoUrl(l.externalId) }))
      .sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
  }, [kommoLeads, integrations]);

  const negotiatingTotal = useMemo(
    () => negotiatingLeads.reduce((s, l) => s + (l.price ?? 0), 0),
    [negotiatingLeads]
  );

  if (user?.role === UserRole.SUPER_ADMIN) {
    return <AdminDashboard />;
  }

  const HEALTH_SCORE_CFG: Record<'A' | 'B' | 'C' | 'D', { bg: string; color: string }> = {
    A: { bg: 'var(--badge-success-bg)', color: 'var(--badge-success-text)' },
    B: { bg: 'var(--accent-dim)',        color: 'var(--accent)' },
    C: { bg: 'var(--badge-warn-bg)',     color: 'var(--badge-warn-text)' },
    D: { bg: 'var(--badge-error-bg)',    color: 'var(--badge-error-text)' },
  };

  const PLATFORM_COLORS: Record<string, { dot: string; bg: string; text: string }> = isDark ? {
    Meta:   { dot: '#818cf8', bg: 'rgba(129,140,248,0.12)', text: '#a5b4fc' },
    Google: { dot: '#34d399', bg: 'rgba(52,211,153,0.12)',  text: '#6ee7b7' },
  } : {
    Meta:   { dot: '#6366f1', bg: 'rgba(99,102,241,0.10)', text: '#4338ca' },
    Google: { dot: '#059669', bg: 'rgba(5,150,105,0.10)',   text: '#047857' },
  };

  // ── Derived mkt-tab values for bottom KPIs ───────────────────────────────
  const mktRoas       = mktTab === 'meta' ? attributionSummary?.roasMeta    : mktTab === 'google' ? attributionSummary?.roasGoogle    : attributionSummary?.roas    ?? null;
  const mktRevenue    = mktTab === 'meta' ? (attributionSummary?.revenueMeta ?? 0) : mktTab === 'google' ? (attributionSummary?.revenueGoogle ?? 0) : (attributionSummary?.revenue ?? 0);
  const mktSpend      = mktTab === 'meta' ? (attributionSummary?.spendMeta   ?? 0) : mktTab === 'google' ? (attributionSummary?.spendGoogle   ?? 0) : (attributionSummary?.spend   ?? 0);
  const mktCac        = mktTab === 'meta'   ? (canalComparativo.meta.leads   > 0 ? canalComparativo.meta.spend   / canalComparativo.meta.leads   : null)
                      : mktTab === 'google' ? (canalComparativo.google.leads > 0 ? canalComparativo.google.spend / canalComparativo.google.leads : null)
                      : (attributionSummary?.cac ?? null);
  const mktLeadsBadge = mktTab === 'meta'   ? `${canalComparativo.meta.leads} leads Meta`
                      : mktTab === 'google' ? `${canalComparativo.google.leads} leads Google`
                      : `${attributionSummary?.attributedLeads ?? 0} leads atribuídos`;
  const mktCpl      = funnelCounts.generated > 0 && mktSpend > 0 ? mktSpend / funnelCounts.generated : null;
  const mktConvRate = funnelCounts.generated > 0 ? (funnelCounts.won / funnelCounts.generated) * 100 : null;
  const mktTicket   = mktWonCount > 0 ? mktClosedValue / mktWonCount : null;
  // Cobertura de atribuição: % dos leads do período com UTM de canal pago — contexto
  // obrigatório do ROAS atribuído (sem isso o número parece o ROAS do negócio inteiro)
  const utmCovPct   = attributionSummary && attributionSummary.totalLeads > 0
    ? (attributionSummary.attributedLeads / attributionSummary.totalLeads) * 100
    : null;

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
          {/* min 90 dias: os endpoints de Meta/Google do dashboard só retornam 90d — antes disso os cards de marketing zeram */}
          <input type="date" value={customStart} max={customEnd || undefined}
            min={new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10)}
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
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)', letterSpacing: '0.1em' }}>marketing — topo de funil · {rangeLabel.toLowerCase()}</p>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                onClick={() => setTopoKpiPickerOpen((o) => !o)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Personalizar
              </button>
              {topoKpiPickerOpen && (
                <div
                  className="absolute right-0 top-full mt-1 z-20 rounded-xl p-3 flex flex-wrap gap-2"
                  style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-md)', minWidth: 280, boxShadow: '0 4px 24px rgba(0,0,0,0.18)' }}
                >
                  {TOPO_KPI_OPTIONS.map(({ key, label }) => {
                    const on = visibleTopoKpis.includes(key);
                    return (
                      <button
                        key={key}
                        onClick={() => toggleTopoKpi(key)}
                        className="px-2.5 py-1 rounded-lg text-xs font-medium transition-all"
                        style={on
                          ? { backgroundColor: '#3b82f6', color: '#fff' }
                          : { backgroundColor: 'var(--bg-surface)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="flex rounded-lg p-0.5 gap-0.5" style={{ backgroundColor: 'var(--bg-base)', border: '1px solid var(--border)' }}>
              {([['total', 'Total'], ['meta', 'Meta Ads'], ['google', 'Google Ads']] as const).map(([tab, label]) => (
                <button
                  key={tab}
                  onClick={() => setMktTab(tab)}
                  className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
                  style={mktTab === tab ? { backgroundColor: '#3b82f6', color: '#fff' } : { color: 'var(--text-muted)' }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
        {dashLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="rounded-xl p-4 animate-pulse" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', height: 140 }} />
            ))}
          </div>
        ) : (
          <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiCard title="Gasto total"   value={kpis.spend.value}  delta={kpis.spend.delta}  neutralDelta sub={kpis.spend.sub}  sparkData={sparkSpend}  animKey={animKey} info="Investimento somado em Meta Ads e Google Ads no período selecionado." />
            <KpiCard title="Impressões"    value={kpis.impr.value}   delta={kpis.impr.delta}   sub={kpis.impr.sub}   sparkData={sparkImpr}   animKey={animKey} info="Quantas vezes seus anúncios foram exibidos. Uma mesma pessoa pode gerar várias impressões." />
            <KpiCard title="Cliques"       value={kpis.clicks.value} delta={kpis.clicks.delta} sub={kpis.clicks.sub} sparkData={sparkClicks} animKey={animKey} info="Cliques nos anúncios no período. Nem todo clique vira lead — acompanhe junto com o CPL." />
            <KpiCard title="CTR"           value={kpis.ctr.value}    delta={kpis.ctr.delta}    sub={kpis.ctr.sub}    sparkData={sparkCtr}    animKey={animKey} info="Taxa de cliques: cliques ÷ impressões. Mede se o criativo chama atenção — queda forte costuma indicar fadiga do anúncio." />
          </div>
          {visibleTopoKpis.length > 0 && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
              {visibleTopoKpis.includes('reach') && (
                <BottomKpiCard title="Alcance" value={topoKpis.reach > 0 ? fmtNum(topoKpis.reach) : '—'} sub="Pessoas únicas · Meta Ads" accent={PLATFORM_COLORS.Meta.text} info="Número de pessoas únicas que viram pelo menos um anúncio no período. Disponível apenas para Meta Ads." />
              )}
              {visibleTopoKpis.includes('frequency') && (
                <BottomKpiCard title="Frequência" value={topoKpis.frequency != null ? topoKpis.frequency.toFixed(1).replace('.', ',') : '—'} sub="Impressões ÷ Alcance · Meta" accent={topoKpis.frequency != null && topoKpis.frequency > 3 ? 'var(--badge-warn-text)' : PLATFORM_COLORS.Meta.text} info="Média de vezes que cada pessoa viu seus anúncios. Acima de 3–4 costuma indicar fadiga criativa — hora de renovar os criativos." />
              )}
              {visibleTopoKpis.includes('conv_meta') && (
                <BottomKpiCard title="Conversões Meta" value={topoKpis.metaConv > 0 ? fmtNum(Math.round(topoKpis.metaConv)) : '—'} sub="Registradas pelo Meta" accent={PLATFORM_COLORS.Meta.text} info="Conversões contadas pela própria Meta (leads, mensagens, compras configurados no pixel). Pode não bater com o Kommo — muda conforme a janela de atribuição configurada no anúncio." />
              )}
              {visibleTopoKpis.includes('conv_google') && (
                <BottomKpiCard title="Conversões Google" value={topoKpis.googleConv > 0 ? fmtNum(Math.round(topoKpis.googleConv)) : '—'} sub="Registradas pelo Google" accent={PLATFORM_COLORS.Google.text} info="Conversões contadas pelo próprio Google Ads (cliques em chamada, preenchimento de formulário, etc). Pode não bater com o Kommo — depende do que está configurado no Google Ads." />
              )}
              {visibleTopoKpis.includes('cpa') && (
                <BottomKpiCard title="Custo/Conversão" value={topoKpis.cpa != null ? fmtMoney(topoKpis.cpa) : '—'} sub={`${fmtNum(Math.round(topoKpis.totalConv))} conversões totais`} accent="#60a5fa" info="Gasto total ÷ conversões reportadas pelas plataformas (Meta + Google). Baseado nas conversões das próprias plataformas, não nas vendas do CRM." />
              )}
              {visibleTopoKpis.includes('leads_meta') && (
                <BottomKpiCard title="Leads Meta (CRM)" value={topoKpis.metaLeads > 0 ? fmtNum(topoKpis.metaLeads) : '—'} sub="Com utm_source=meta no Kommo" accent={PLATFORM_COLORS.Meta.text} info="Leads no Kommo com origem atribuída ao Meta Ads no período selecionado. Depende do campo Origem estar preenchido corretamente." />
              )}
              {visibleTopoKpis.includes('leads_google') && (
                <BottomKpiCard title="Leads Google (CRM)" value={topoKpis.googleLeads > 0 ? fmtNum(topoKpis.googleLeads) : '—'} sub="Com utm_source=google no Kommo" accent={PLATFORM_COLORS.Google.text} info="Leads no Kommo com origem atribuída ao Google Ads no período selecionado. Depende do campo Origem estar preenchido corretamente." />
              )}
              {visibleTopoKpis.includes('cpl_meta') && (
                <BottomKpiCard title="CPL Meta" value={topoKpis.cplMeta != null ? fmtMoney(topoKpis.cplMeta) : '—'} sub={`${topoKpis.metaLeads} leads Kommo`} accent={PLATFORM_COLORS.Meta.text} info="Gasto no Meta Ads ÷ leads com origem Meta no Kommo. Diferente do CPL da própria Meta, que usa o pixel — este usa os leads reais no CRM." />
              )}
              {visibleTopoKpis.includes('cpl_google') && (
                <BottomKpiCard title="CPL Google" value={topoKpis.cplGoogle != null ? fmtMoney(topoKpis.cplGoogle) : '—'} sub={`${topoKpis.googleLeads} leads Kommo`} accent={PLATFORM_COLORS.Google.text} info="Gasto no Google Ads ÷ leads com origem Google no Kommo. Diferente do CPL do Google, que usa o pixel — este usa os leads reais no CRM." />
              )}
              {visibleTopoKpis.includes('cpm') && (
                <BottomKpiCard title="CPM" value={topoKpis.cpm != null ? fmtMoney(topoKpis.cpm) : '—'} sub="Custo por mil impressões" accent="#60a5fa" info="Custo por mil impressões: gasto ÷ impressões × 1000. Mede o custo de alcançar audiência — sobe quando a competição pelo público aumenta." />
              )}
              {visibleTopoKpis.includes('cpc') && (
                <BottomKpiCard title="CPC" value={topoKpis.cpc != null ? fmtMoney(topoKpis.cpc) : '—'} sub="Custo por clique" accent="#60a5fa" info="Custo por clique: gasto ÷ cliques totais. Combina CPC do Meta e do Google ponderado pelo gasto de cada plataforma." />
              )}
            </div>
          )}
          </>
        )}
      </div>

      {/* ── CONVERSÕES DAS PLATAFORMAS — preenche o vazio quando sem CRM ─────── */}
      {!hasCrmSource && platformConv.totalConv > 0 && (
        <div>
          <SectionLabel>conversões das plataformas · {rangeLabel.toLowerCase()}</SectionLabel>
          <div className="mb-3 flex items-start gap-2 px-4 py-2.5 rounded-xl" style={{ backgroundColor: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.2)' }}>
            <svg className="h-4 w-4 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="#60a5fa" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
            </svg>
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              Conversões atribuídas pelo próprio Google e Meta — disponíveis mesmo sem CRM. Para vendas fechadas e ROAS real do negócio, conecte o CRM ou insira dados manuais.
            </span>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <BottomKpiCard title="Conversões totais" value={fmtNum(Math.round(platformConv.totalConv))} sub={`Meta ${fmtNum(Math.round(platformConv.metaConv))} · Google ${fmtNum(Math.round(platformConv.googleConv))}`} accent="#60a5fa" info="Conversões contadas pelo próprio Meta e Google (leads, mensagens, compras configuradas na plataforma). Não são vendas confirmadas no CRM." />
            <BottomKpiCard title="CPL real" value={platformConv.cpl != null ? fmtBRL(platformConv.cpl) : '—'} sub="Gasto ÷ conversões" info="Custo por conversão: gasto total ÷ conversões reportadas pelas plataformas." />
            <BottomKpiCard title="CPL Meta" value={platformConv.metaCpl != null ? fmtBRL(platformConv.metaCpl) : '—'} sub={`${fmtNum(Math.round(platformConv.metaConv))} conversões`} accent={PLATFORM_COLORS.Meta.text} info="Gasto no Meta Ads ÷ conversões reportadas pelo Meta." />
            <BottomKpiCard title="CPL Google" value={platformConv.googleCpl != null ? fmtBRL(platformConv.googleCpl) : '—'} sub={`${fmtNum(Math.round(platformConv.googleConv))} conversões`} accent={PLATFORM_COLORS.Google.text} info="Gasto no Google Ads ÷ conversões reportadas pelo Google." />
          </div>
          {platformConv.roas != null && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
              <BottomKpiCard
                title="ROAS plataformas"
                value={`${platformConv.roas.toFixed(2).replace('.', ',')}x`}
                sub={`Valor de conversão ${fmtMoney(platformConv.totalValue)}`}
                info="Retorno calculado com o valor de conversão que o próprio Meta/Google reporta — não com vendas do CRM. Use como referência, não como faturamento."
                accent={platformConv.roas >= 4 ? 'var(--badge-success-text)' : platformConv.roas >= 2 ? 'var(--badge-warn-text)' : 'var(--badge-error-text)'}
              />
            </div>
          )}
        </div>
      )}

      {/* ── DADOS MANUAIS — banner quando sem CRM ───────────────────────────── */}
      {!hasCrmSource && (
        <>
          {manualRevenueSummary?.hasData ? (
            <div>
              <SectionLabel>resultado manual — sem crm conectado</SectionLabel>
              <div
                className="mb-3 flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl"
                style={{ backgroundColor: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.25)' }}
              >
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="var(--badge-warn-text)" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                  </svg>
                  <span className="text-xs" style={{ color: 'var(--badge-warn-text)' }}>
                    Métricas de CRM baseadas em dados inseridos manualmente — conecte o Kommo para análise completa por lead.
                  </span>
                </div>
                <Link href="/dashboard/dados-manuais" className="text-xs font-medium shrink-0" style={{ color: 'var(--badge-warn-text)' }}>
                  Editar dados →
                </Link>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <BottomKpiCard
                  title="ROAS (Meta)"
                  value={manualRevenueSummary.totals.roasMeta != null ? `${manualRevenueSummary.totals.roasMeta.toFixed(2).replace('.', ',')}x` : '—'}
                  sub={`Meta: ${manualRevenueSummary.totals.metaLeads} leads`}
                  info="Receita informada manualmente para o Meta ÷ gasto no Meta Ads no período."
                  accent={manualRevenueSummary.totals.roasMeta != null ? (manualRevenueSummary.totals.roasMeta >= 4 ? 'var(--badge-success-text)' : manualRevenueSummary.totals.roasMeta >= 2 ? 'var(--badge-warn-text)' : 'var(--badge-error-text)') : 'var(--text-muted)'}
                />
                <BottomKpiCard
                  title="ROAS (Google)"
                  value={manualRevenueSummary.totals.roasGoogle != null ? `${manualRevenueSummary.totals.roasGoogle.toFixed(2).replace('.', ',')}x` : '—'}
                  sub={`Google: ${manualRevenueSummary.totals.googleLeads} leads`}
                  info="Receita informada manualmente para o Google ÷ gasto no Google Ads no período."
                  accent={manualRevenueSummary.totals.roasGoogle != null ? (manualRevenueSummary.totals.roasGoogle >= 4 ? 'var(--badge-success-text)' : manualRevenueSummary.totals.roasGoogle >= 2 ? 'var(--badge-warn-text)' : 'var(--badge-error-text)') : 'var(--text-muted)'}
                />
                <BottomKpiCard
                  title="Receita total"
                  value={manualRevenueSummary.totals.revenue > 0 ? fmtMoney(manualRevenueSummary.totals.revenue) : '—'}
                  sub={`${manualRevenueSummary.totals.sales} vendas · ${manualRevenueSummary.totals.leads} leads`}
                  info="Soma da receita inserida manualmente no período."
                />
                <BottomKpiCard
                  title="CPL"
                  value={manualRevenueSummary.totals.cac != null ? fmtBRL(manualRevenueSummary.totals.cac) : '—'}
                  sub="Gasto / leads pagos (Meta + Google)"
                  accent="#60a5fa"
                  info="Custo por lead: gasto em anúncios ÷ leads de canais pagos informados manualmente. Não é custo por cliente (CAC)."
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
      {/* Fundo de funil (ROAS/CPL/receita/pipeline) precisa de receita — oculta sem CRM/dados manuais */}
      {attributionSummary && (hasCrmSource || manualRevenueSummary?.hasData) && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)', letterSpacing: '0.1em' }}>resultado consolidado — fundo de funil</p>
            <div className="relative">
              <button
                onClick={() => setBottomKpiPickerOpen((o) => !o)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{
                  backgroundColor: bottomKpiPickerOpen ? 'rgba(59,130,246,0.10)' : 'var(--bg-surface)',
                  border: '1px solid var(--border)',
                  color: bottomKpiPickerOpen ? '#60a5fa' : 'var(--text-muted)',
                }}
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Personalizar
              </button>
              {bottomKpiPickerOpen && (
                <div
                  className="absolute right-0 top-full mt-1 z-20 rounded-xl p-3 flex flex-wrap gap-2"
                  style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-md)', minWidth: 248, boxShadow: '0 4px 24px rgba(0,0,0,0.18)' }}
                >
                  {BOTTOM_KPI_OPTIONS.map(({ key, label }) => {
                    const on = visibleBottomKpis.includes(key);
                    return (
                      <button
                        key={key}
                        onClick={() => toggleBottomKpi(key)}
                        className="px-2.5 py-1 rounded-lg text-xs font-medium transition-all"
                        style={on
                          ? { backgroundColor: '#3b82f6', color: '#fff' }
                          : { backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }
                        }
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {visibleBottomKpis.includes('roas') && (
              <BottomKpiCard
                title="ROAS atribuído"
                value={mktRoas != null ? `${mktRoas.toFixed(2).replace('.', ',')}x` : '—'}
                badge={mktRoas != null ? (mktRoas >= 4 ? '↑ acima da meta' : mktRoas >= 2 ? '↔ na média' : '↓ abaixo da meta') : undefined}
                badgeColor={mktRoas != null ? (mktRoas >= 4 ? 'var(--badge-success-text)' : mktRoas >= 2 ? 'var(--badge-warn-text)' : 'var(--badge-error-text)') : undefined}
                sub={mktRevenue > 0
                  ? `${fmtMoney(mktRevenue)} receita / ${fmtMoney(mktSpend)} gasto${utmCovPct != null ? ` · cobre ${fmtPct1(utmCovPct)} dos leads` : ''}`
                  : 'Sem receitas fechadas'}
                accent={mktRoas != null ? (mktRoas >= 4 ? 'var(--badge-success-text)' : mktRoas >= 2 ? 'var(--badge-warn-text)' : 'var(--badge-error-text)') : 'var(--text-muted)'}
                info="Receita das vendas com origem identificada em canal pago (UTM Meta/Google) ÷ gasto em anúncios. Vendas sem origem (WhatsApp, orgânico) ficam de fora — não é o retorno do negócio inteiro."
              />
            )}
            {visibleBottomKpis.includes('cac') && (
              <BottomKpiCard
                title="CPL"
                value={mktCac != null ? fmtBRL(mktCac) : '—'}
                badge={mktLeadsBadge}
                badgeColor="#60a5fa"
                sub="Custo por lead no período"
                accent="#60a5fa"
                info="Custo por lead: gasto em anúncios ÷ leads atribuídos a canais pagos. Não confundir com CAC (custo por cliente conquistado) — esse está em Saúde Financeira como CAC real."
              />
            )}
            {visibleBottomKpis.includes('receita') && (
              <BottomKpiCard
                title="Receita fechada"
                value={mktClosedValue > 0 ? fmtMoney(mktClosedValue) : '—'}
                sub={mktWonCount > 0
                  ? mktTab === 'total'
                    ? `${mktWonCount} vendas · inclui leads sem UTM`
                    : `${mktWonCount} vendas · ticket médio ${fmtBRL(mktClosedValue / mktWonCount)}`
                  : 'Nenhuma venda fechada'}
                info="Vendas fechadas dentro do período selecionado, pela data de fechamento — mesma base da Meta do Mês. Inclui vendas de leads criados antes do período."
              />
            )}
            {visibleBottomKpis.includes('pipeline') && (
              <BottomKpiCard
                title="Pipeline em negociação"
                value={mktPipeline > 0 ? fmtMoney(mktPipeline) : '—'}
                badge={mktPipeline > 0 ? 'Potencial ativo' : undefined}
                badgeColor="var(--badge-warn-text)"
                sub={mktTab === 'total' ? 'Inclui leads sem UTM' : 'Aguardando fechamento'}
                accent={mktPipeline > 0 ? 'var(--badge-warn-text)' : 'var(--text-muted)'}
                info="Valor somado dos leads que já receberam orçamento/proposta ou estão negociando no CRM — estado atual, independente do período selecionado no filtro. Pode virar receita se fechar, mas não é receita garantida. Veja a lista completa na seção 'Pipeline em negociação' abaixo."
              />
            )}
            {visibleBottomKpis.includes('leads') && (
              <BottomKpiCard
                title="Leads"
                value={fmtNum(funnelCounts.generated)}
                sub={`${funnelCounts.won} vendas · ${funnelCounts.lost} perdidos`}
                accent="#60a5fa"
                info="Total de leads que entraram no CRM no período, de todos os canais (pago, WhatsApp, orgânico)."
              />
            )}
            {visibleBottomKpis.includes('cpl') && (
              <BottomKpiCard
                title="CPL geral"
                value={mktCpl != null ? fmtBRL(mktCpl) : '—'}
                sub={`Gasto / ${funnelCounts.generated} leads`}
                accent="#60a5fa"
                info="Gasto em anúncios ÷ todos os leads do período, inclusive os sem origem identificada. Tende a ser menor que o CPL atribuído."
              />
            )}
            {visibleBottomKpis.includes('conversao') && (
              <BottomKpiCard
                title="Conversão final"
                value={mktConvRate != null ? fmtPct1(mktConvRate) : '—'}
                sub={`${funnelCounts.won} vendas em ${funnelCounts.generated} leads`}
                accent={mktConvRate != null ? (mktConvRate >= 10 ? 'var(--badge-success-text)' : mktConvRate >= 5 ? 'var(--badge-warn-text)' : 'var(--badge-error-text)') : 'var(--text-muted)'}
                info="Vendas fechadas no período ÷ leads gerados no período. Como as vendas contam pela data de fechamento, podem incluir leads antigos — em janelas curtas a taxa pode passar de 100%."
              />
            )}
            {visibleBottomKpis.includes('ticket') && (
              <BottomKpiCard
                title="Ticket médio"
                value={mktTicket != null ? fmtBRL(mktTicket) : '—'}
                sub={`${mktWonCount} vendas fechadas`}
                info="Valor médio por venda: receita fechada ÷ número de vendas no período."
              />
            )}
          </div>
        </div>
      )}

      {/* ── META DO MÊS ───────────────────────────────────────────────────────── */}
      {currentGoal && (
        <div>
          <SectionLabel>meta do mês</SectionLabel>
          <MonthlyGoalCard
            progress={currentGoal}
            canEdit={canEditGoal}
            onSaved={loadGoalProgress}
            chartData={goalProgress ?? undefined}
            wonLeads={wonLeads ?? undefined}
          />
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
                  <p className="text-4xl font-semibold tabular-nums" style={{ color: funnelCounts.generated > 0 && funnelCounts.won / funnelCounts.generated >= 0.1 ? 'var(--badge-success-text)' : 'var(--badge-error-text)' }}>
                    {funnelCounts.generated > 0 ? fmtPct1((funnelCounts.won / funnelCounts.generated) * 100) : '—'}
                  </p>
                  <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                    <strong style={{ color: 'var(--text-primary)' }}>{funnelCounts.won} vendas</strong> em <strong style={{ color: 'var(--text-primary)' }}>{funnelCounts.generated} leads</strong>
                  </p>
                  {funnelCounts.won > funnelCounts.generated && (
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                      inclui vendas de leads criados antes do período
                    </p>
                  )}
                </div>

                {/* Alertas do funil */}
                <div className="rounded-xl p-3" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                  <p className="text-xs font-medium uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>Onde prestar atenção</p>
                  {funnelCounts.generated > 0 && funnelCounts.contacted / funnelCounts.generated < 0.5 && (
                    <div className="rounded-lg p-2.5 mb-2" style={{ backgroundColor: 'var(--badge-error-bg)', borderLeft: '2px solid var(--badge-error-text)' }}>
                      <p className="text-xs" style={{ color: 'var(--badge-error-text)' }}>
                        <strong>{fmtPct1((funnelCounts.contacted / funnelCounts.generated) * 100)}</strong> dos leads recebem atendimento — verificar tempo de resposta
                      </p>
                    </div>
                  )}
                  {funnelCounts.contacted > 0 && funnelCounts.quoted / funnelCounts.contacted < 0.4 && (
                    <div className="rounded-lg p-2.5" style={{ backgroundColor: 'var(--badge-warn-bg)', borderLeft: '2px solid var(--badge-warn-text)' }}>
                      <p className="text-xs" style={{ color: 'var(--badge-warn-text)' }}>
                        Apenas <strong>{fmtPct1((funnelCounts.quoted / funnelCounts.contacted) * 100)}</strong> dos atendidos recebem orçamento — maior gargalo do funil
                      </p>
                    </div>
                  )}
                  {funnelCounts.lost > 0 && (
                    <div className="rounded-lg p-2.5 mt-2" style={{ backgroundColor: 'var(--badge-error-bg)', borderLeft: '2px solid var(--badge-error-text)' }}>
                      <p className="text-xs" style={{ color: 'var(--badge-error-text)' }}>
                        <strong>{funnelCounts.lost}</strong> leads perdidos ({funnelCounts.generated > 0 ? fmtPct1((funnelCounts.lost / funnelCounts.generated) * 100) : '—'} do total)
                      </p>
                    </div>
                  )}
                </div>

                {/* Mini KPIs de conversão */}
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { label: 'Lead → Atendimento', val: funnelCounts.generated > 0 ? funnelCounts.contacted / funnelCounts.generated : 0, color: 'var(--badge-success-text)' },
                    { label: 'Lead → Orçamento',   val: funnelCounts.generated > 0 ? funnelCounts.quoted / funnelCounts.generated : 0,   color: 'var(--badge-warn-text)' },
                    { label: 'Orç. → Venda',       val: funnelCounts.quoted > 0    ? funnelCounts.won / funnelCounts.quoted : 0,          color: 'var(--badge-success-text)' },
                    { label: 'CPL médio', val: null, display: funnelCounts.generated > 0 && attributionSummary?.cac ? fmtBRL(attributionSummary.cac) : '—', color: 'var(--accent)' },
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
                        <span className="text-xs shrink-0" style={{ color: m.warn ? 'var(--badge-error-text)' : 'var(--text-muted)', width: 100 }}>{m.label}</span>
                        <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--border-md)' }}>
                          <div className="h-full rounded-full" style={{ width: `${m.pct * 100}%`, backgroundColor: m.warn ? 'rgba(248,113,113,0.5)' : '#f87171', opacity: 0.65 }} />
                        </div>
                        <span className="text-xs tabular-nums" style={{ color: m.warn ? 'var(--badge-error-text)' : 'var(--text-muted)', width: 28, textAlign: 'right' }}>
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
                    <span className="text-xs" style={{ color: row.highlight ? 'var(--accent)' : 'var(--text-muted)', fontWeight: row.highlight ? 500 : 400 }}>{row.label}</span>
                    <span className="text-xs font-semibold" style={{ color: row.highlight ? 'var(--accent)' : 'var(--text-secondary)' }}>{row.val}</span>
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
                    <span className="w-20 text-center text-xs font-medium" style={{ color: PLATFORM_COLORS.Meta.text }}>Meta</span>
                    <span className="w-20 text-center text-xs font-medium" style={{ color: PLATFORM_COLORS.Google.text }}>Google</span>
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
                      <span className="w-20 text-center text-xs font-semibold tabular-nums" style={{ color: PLATFORM_COLORS.Meta.text }}>{row.meta}</span>
                      <span className="w-20 text-center text-xs font-semibold tabular-nums" style={{ color: PLATFORM_COLORS.Google.text }}>{row.google}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── 5.1 SAÚDE DO CRM ──────────────────────────────────────────────────── */}
      {crmHygiene && kommoCur.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-3">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)', letterSpacing: '0.1em' }}>saúde do crm · preenchimento do Kommo</p>
            <InfoTip text="Problemas de preenchimento no Kommo distorcem receita, LTV e atribuição. Cards parados impedem o registro de recompras (conversa nova do cliente cai no card antigo); venda ganha sem valor entra como R$ 0 na receita; lead sem origem fica fora do ROAS atribuído." />
          </div>
          <div className="rounded-xl p-4 flex flex-col gap-2" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            {([
              {
                key: 'stagnant' as const,
                ok: crmHygiene.stagnant.count === 0,
                color: crmHygiene.stagnant.count === 0 ? 'var(--badge-success-text)' : 'var(--badge-warn-text)',
                label: <><strong>{crmHygiene.stagnant.count}</strong> cards parados há +{crmHygiene.stagnant.thresholdDays} dias em etapa intermediária</>,
                items: crmHygiene.stagnant.items,
                detail: (i: import('@/types').CrmHygieneItem) => `${i.status} · parado desde ${i.lastActivityAt ? new Date(i.lastActivityAt).toLocaleDateString('pt-BR') : '—'}`,
              },
              {
                key: 'wonNoValue' as const,
                ok: crmHygiene.wonNoValue.count === 0,
                color: crmHygiene.wonNoValue.count === 0 ? 'var(--badge-success-text)' : 'var(--badge-error-text)',
                label: <><strong>{crmHygiene.wonNoValue.count}</strong> vendas ganhas sem valor nos últimos {crmHygiene.wonNoValue.windowDays} dias</>,
                items: crmHygiene.wonNoValue.items,
                detail: (i: import('@/types').CrmHygieneItem) => `ganha em ${i.closedAt ? new Date(i.closedAt).toLocaleDateString('pt-BR') : '—'} · R$ 0`,
              },
              {
                key: 'noOrigin' as const,
                ok: crmHygiene.noOrigin.pct <= 30,
                color: crmHygiene.noOrigin.pct <= 30 ? 'var(--badge-success-text)' : 'var(--badge-warn-text)',
                label: <><strong>{crmHygiene.noOrigin.pct}%</strong> dos leads sem origem nos últimos {crmHygiene.noOrigin.windowDays} dias ({crmHygiene.noOrigin.count} de {crmHygiene.noOrigin.total})</>,
                items: crmHygiene.noOrigin.items,
                detail: (i: import('@/types').CrmHygieneItem) => `${i.status} · criado em ${i.createdAt ? new Date(i.createdAt).toLocaleDateString('pt-BR') : '—'}`,
              },
            ]).map((row) => (
              <div key={row.key} className="rounded-lg" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                <button
                  type="button"
                  onClick={() => row.items.length > 0 && setHygieneOpen((o) => (o === row.key ? null : row.key))}
                  className="w-full flex items-center gap-2.5 p-3 text-left"
                  style={{ cursor: row.items.length > 0 ? 'pointer' : 'default' }}
                >
                  <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: row.color }} />
                  <span className="flex-1 text-xs" style={{ color: 'var(--text-secondary)' }}>{row.label}</span>
                  {row.items.length > 0 && (
                    <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>
                      {hygieneOpen === row.key ? 'ocultar ⌃' : 'ver ⌄'}
                    </span>
                  )}
                </button>
                {hygieneOpen === row.key && (
                  <div className="px-3 pb-3 flex flex-col gap-1 max-h-56 overflow-y-auto">
                    {row.items.map((i) => (
                      <div key={i.externalId} className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                        <span className="font-medium truncate" style={{ color: 'var(--text-primary)', minWidth: 0, flexBasis: '38%' }}>{i.name ?? `Lead #${i.externalId}`}</span>
                        <span className="flex-1 truncate" style={{ color: 'var(--text-muted)' }}>{row.detail(i)}</span>
                        {i.kommoUrl && (
                          <a href={i.kommoUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 hover:underline" style={{ color: 'var(--accent)' }}>
                            abrir no Kommo →
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 5.1.5 RANKING DE VENDEDORES ───────────────────────────────────────── */}
      {hasCrmSource && kommoCur.length > 0 && rankingMonth && sellersRanking && (() => {
        const MES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        const label = `${MES[rankingMonth.month - 1]}/${String(rankingMonth.year).slice(2)}`;
        const now = new Date();
        const atCurrent = rankingMonth.year === now.getFullYear() && rankingMonth.month === now.getMonth() + 1;
        const rows = sellersRanking.ranking;
        return (
          <div>
            <div className="flex items-center gap-1.5 mb-3">
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)', letterSpacing: '0.1em' }}>ranking de vendedores</p>
              <InfoTip text="Vendas ganhas no Kommo por vendedor responsável, pela data de fechamento (closed_at) do mês. Conversão = ganhos ÷ (ganhos + perdidos) decididos no mês. 'Pipeline' é o valor em negociação atual do vendedor — do orçamento enviado em diante, mesma base da seção Pipeline em Negociação (independe do mês). 'Fecha em' = tempo médio entre criação e fechamento. A seta compara a receita com o mês anterior. Use ◀ ▶ para navegar entre os meses." />
              <div className="flex items-center gap-2 ml-auto">
                <button type="button" onClick={() => navRankingMonth(-1)} className="text-sm leading-none px-1" style={{ color: 'var(--text-muted)', cursor: 'pointer' }}>◀</button>
                <span className="text-xs tabular-nums" style={{ color: 'var(--text-secondary)' }}>{label}</span>
                <button type="button" onClick={() => !atCurrent && navRankingMonth(1)} disabled={atCurrent} className="text-sm leading-none px-1" style={{ color: atCurrent ? 'var(--border)' : 'var(--text-muted)', cursor: atCurrent ? 'default' : 'pointer' }}>▶</button>
              </div>
            </div>
            <div className="rounded-xl p-4 flex flex-col gap-2" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
              {rows.length === 0 ? (
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Nenhuma venda fechada em {label}.</p>
              ) : (
                <>
                  {rows.map((s, idx) => {
                    const metrics: { label: string; value: string; valueFirst?: boolean }[] = [];
                    metrics.push({ label: s.sales === 1 ? 'venda' : 'vendas', value: String(s.sales), valueFirst: true });
                    if (s.winRate !== null) metrics.push({ label: 'conv.', value: `${Math.round(s.winRate * 100)}%` });
                    metrics.push({ label: 'ticket', value: fmtMoney(s.avgTicket) });
                    if (s.avgDaysToClose !== null) metrics.push({ label: 'fecha em', value: `${s.avgDaysToClose}d` });
                    if (s.openPipeline > 0) metrics.push({ label: 'pipeline', value: fmtMoney(s.openPipeline) });
                    const deltaPct = s.prevRevenue > 0 ? Math.round(((s.revenue - s.prevRevenue) / s.prevRevenue) * 100) : null;
                    return (
                      <div key={s.userId} className="rounded-lg px-3.5 py-2.5" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                        <div className="flex items-center gap-3">
                          <span className="text-base font-bold tabular-nums shrink-0 w-6 text-center" style={{ color: idx === 0 ? 'var(--accent)' : 'var(--text-muted)' }}>{idx + 1}</span>
                          <span className="font-semibold truncate text-sm flex-1" style={{ color: 'var(--text-primary)', minWidth: 0 }}>{s.name}</span>
                          {deltaPct !== null && (
                            <span className="text-xs font-semibold shrink-0 tabular-nums" style={{ color: deltaPct >= 0 ? 'var(--badge-success-text)' : 'var(--badge-error-text)' }}>
                              {deltaPct >= 0 ? '↑' : '↓'}{Math.abs(deltaPct)}%
                            </span>
                          )}
                          <span className="text-base font-bold tabular-nums shrink-0" style={{ color: 'var(--text-primary)' }}>{fmtMoney(s.revenue)}</span>
                        </div>
                        <div className="text-xs mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-0.5" style={{ paddingLeft: '2.25rem' }}>
                          {metrics.map((m, i) => (
                            <span key={i} className="inline-flex items-baseline gap-1">
                              {i > 0 && <span className="mr-1" style={{ color: 'var(--text-muted)' }}>·</span>}
                              {m.valueFirst ? (
                                <>
                                  <span className="font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>{m.value}</span>
                                  <span style={{ color: 'var(--text-muted)' }}>{m.label}</span>
                                </>
                              ) : (
                                <>
                                  <span style={{ color: 'var(--text-muted)' }}>{m.label}</span>
                                  <span className="font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>{m.value}</span>
                                </>
                              )}
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  <div className="flex items-center justify-between pt-2 mt-0.5 text-sm" style={{ borderTop: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
                    <span>{sellersRanking.totalSales} {sellersRanking.totalSales === 1 ? 'venda' : 'vendas'} em {label}</span>
                    <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{fmtMoney(sellersRanking.totalRevenue)}</span>
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── 5.2 PIPELINE EM NEGOCIAÇÃO ────────────────────────────────────────── */}
      {hasKommo && negotiatingLeads.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-3">
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)', letterSpacing: '0.1em' }}>pipeline em negociação</p>
            <InfoTip text="Todos os leads do Kommo que já receberam orçamento/proposta ou estão negociando, independente do período selecionado no filtro acima. Ordenados por valor — priorize o tempo nas oportunidades de maior orçamento." />
          </div>
          <div className="rounded-xl" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <button
              type="button"
              onClick={() => setNegotiatingOpen((o) => !o)}
              className="w-full flex items-center gap-2.5 p-4 text-left"
            >
              <span className="flex-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                <strong>{negotiatingLeads.length}</strong> {negotiatingLeads.length === 1 ? 'lead' : 'leads'} em negociação · <strong>{fmtMoney(negotiatingTotal)}</strong> em jogo
              </span>
              <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>
                {negotiatingOpen ? 'ocultar ⌃' : 'ver ⌄'}
              </span>
            </button>
            {negotiatingOpen && (
              <div className="px-4 pb-4 flex flex-col gap-1 max-h-80 overflow-y-auto" style={{ borderTop: '1px solid var(--border)' }}>
                {negotiatingLeads.slice(0, 50).map((l) => (
                  <div key={l.externalId} className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs mt-1" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                    <span className="font-medium truncate" style={{ color: 'var(--text-primary)', minWidth: 0, flexBasis: '32%' }}>{l.name ?? `Lead #${l.externalId}`}</span>
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded flex-shrink-0" style={{ backgroundColor: originTagFor(l.utmSource, isDark).bg, color: originTagFor(l.utmSource, isDark).text }}>
                      {originTagFor(l.utmSource, isDark).label}
                    </span>
                    <span className="flex-1 truncate" style={{ color: 'var(--text-muted)' }}>{l.status}</span>
                    <span className="font-semibold tabular-nums shrink-0" style={{ color: l.price ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                      {l.price ? fmtMoney(l.price) : 'sem valor'}
                    </span>
                    {l.kommoUrl && (
                      <a href={l.kommoUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 hover:underline" style={{ color: 'var(--accent)' }}>
                        abrir no Kommo →
                      </a>
                    )}
                  </div>
                ))}
                {negotiatingLeads.length > 50 && (
                  <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>mostrando os 50 de maior valor de {negotiatingLeads.length} leads em negociação</p>
                )}
              </div>
            )}
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
                          ctr:         <span style={{ color: ctr >= 2 ? 'var(--badge-success-text)' : ctr >= 1 ? 'var(--badge-warn-text)' : 'var(--badge-error-text)' }}>{fmtPct(ctr)}</span>,
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
                <div className="mt-4 rounded-lg p-2.5" style={{ backgroundColor: 'var(--badge-warn-bg)', border: '1px solid var(--badge-warn-text)' }}>
                  <p className="text-xs" style={{ color: 'var(--badge-warn-text)' }}>
                    Google gera menos leads mas tende a ter ticket maior — acompanhar ROAS por canal
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── 7. SAÚDE FINANCEIRA E PROJEÇÃO ───────────────────────────────────── */}
      {/* Depende de receita (CRM ou dados manuais) — sem fonte de receita, todos os KPIs
          ficam "—", então oculta a seção e deixa as conversões das plataformas no lugar. */}
      {attributionSummary && (hasCrmSource || manualRevenueSummary?.hasData) && (
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
                    color: 'var(--badge-success-text)',
                    sub: `ticket × freq. (${ltvData.wonCount} vendas com valor)`,
                    info: 'Estimativa heurística: ticket médio × frequência de recompra (derivada da tag Carteira). É ordem de grandeza, não o LTV exato do negócio.',
                  },
                  {
                    label: 'CAC real',
                    value: ltvData.cacReal ? fmtBRL(ltvData.cacReal) : '—',
                    color: 'var(--accent)',
                    sub: ltvData.wonFromPaidCount > 0
                      ? `gasto ÷ ${ltvData.wonFromPaidCount} vendas pagas`
                      : 'sem vendas via anúncio no período',
                    info: 'Custo de aquisição por cliente: gasto em anúncios ÷ vendas ganhas vindas de canal pago. É diferente do CPL, que divide por leads.',
                  },
                  {
                    label: 'Relação LTV/CAC',
                    value: ltvData.ltvCacRatio
                      ? `${ltvData.ltvCacRatio.toFixed(1)}x`
                      : '—',
                    color: ltvData.ltvCacRatio && ltvData.ltvCacRatio >= 3 ? 'var(--badge-success-text)' : 'var(--badge-warn-text)',
                    sub: 'meta saudável ≥ 3x',
                    info: 'Quanto cada cliente devolve em relação ao que custou para adquirir. Como o LTV é estimado, trate como indicador direcional, não como número exato.',
                  },
                  {
                    label: 'Clientes recorr.',
                    value: String(recurrentCount),
                    color: 'var(--badge-warn-text)',
                    sub: 'tag carteira no período',
                    info: 'Leads marcados com a tag Carteira no Kommo — clientes que voltaram a comprar no período.',
                  },
                ].map((item, i) => (
                  <div key={i} className="rounded-lg p-2.5" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                    <div className="flex items-center gap-1 mb-1">
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{item.label}</p>
                      <InfoTip text={item.info} />
                    </div>
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
                  <p className="text-2xl font-semibold tabular-nums mt-2" style={{ color: 'var(--badge-success-text)' }}>{fmtMoney(projection.projected)}</p>
                  <p className="text-xs mt-1 mb-4" style={{ color: 'var(--text-muted)' }}>baseado no ritmo atual + pipeline ativo</p>
                  <div className="h-2 rounded-full overflow-hidden mb-2" style={{ backgroundColor: 'var(--border-md)' }}>
                    <div className="h-full rounded-full" style={{ width: `${(projection.dayOfMonth / projection.daysInMonth) * 100}%`, backgroundColor: 'var(--badge-success-text)', opacity: 0.7 }} />
                  </div>
                  <div className="flex justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
                    <span>Dia {projection.dayOfMonth}</span>
                    <span>Fim do mês: dia {projection.daysInMonth}</span>
                  </div>
                  <div className="mt-3 h-px" style={{ backgroundColor: 'var(--border)' }} />
                  <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                    Se 30% do pipeline fechar: <strong style={{ color: 'var(--badge-success-text)' }}>+ {fmtMoney(pipeline * 0.3)}</strong>
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
                  const roasColor = roas != null && roas >= 2 ? 'var(--badge-success-text)' : roas != null ? 'var(--badge-error-text)' : 'var(--text-muted)';
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
                  <div className="rounded-lg p-2.5" style={{ backgroundColor: 'var(--badge-success-bg)', border: '1px solid var(--badge-success-text)' }}>
                    <p className="text-xs" style={{ color: 'var(--badge-success-text)' }}>
                      ✦ Meta com ROAS {attributionSummary.roasMeta.toFixed(1).replace('.', ',')}x — considerar escalar verba
                    </p>
                  </div>
                )}
                {attributionSummary.roasGoogle != null && attributionSummary.roasGoogle > 5 && (
                  <div className="rounded-lg p-2.5" style={{ backgroundColor: 'var(--badge-success-bg)', border: '1px solid var(--badge-success-text)' }}>
                    <p className="text-xs" style={{ color: 'var(--badge-success-text)' }}>
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
                  <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--badge-error-bg)', borderLeft: '2px solid var(--badge-error-text)' }}>
                    <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--badge-error-text)' }}>🔴 Problema crítico</p>
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--badge-error-text)' }}>{latestInsight.content.orchestrator.priorityAlerts[0]}</p>
                  </div>
                )}

                {latestInsight.content.orchestrator.topRecommendations.length > 0 && (
                  <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--badge-warn-bg)', borderLeft: '2px solid var(--badge-warn-text)' }}>
                    <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--badge-warn-text)' }}>🟡 Atenção</p>
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--badge-warn-text)' }}>{latestInsight.content.orchestrator.topRecommendations[0]}</p>
                  </div>
                )}

                {latestInsight.content.orchestrator.topRecommendations.length > 1 && (
                  <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--badge-success-bg)', borderLeft: '2px solid var(--badge-success-text)' }}>
                    <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--badge-success-text)' }}>✦ Oportunidade</p>
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--badge-success-text)' }}>{latestInsight.content.orchestrator.topRecommendations[1]}</p>
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
            backgroundColor: generateToast.includes('sucesso') ? 'var(--badge-success-bg)' : 'var(--badge-error-bg)',
            border: generateToast.includes('sucesso') ? '1px solid var(--badge-success-text)' : '1px solid var(--badge-error-text)',
            color: generateToast.includes('sucesso') ? 'var(--badge-success-text)' : 'var(--badge-error-text)',
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