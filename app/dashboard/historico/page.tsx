'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useTheme } from 'next-themes';
import { useAuth } from '@/context/AuthContext';
import { useHistorico } from '@/hooks/useApi';
import { apiService } from '@/lib/api';
import {
  Chart,
  CategoryScale,
  LinearScale,
  BarController,
  BarElement,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
  type ChartConfiguration,
} from 'chart.js';
import type { HistoricoPoint } from '@/types';

Chart.register(CategoryScale, LinearScale, BarController, BarElement, LineController, LineElement, PointElement, Tooltip);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmtK = (v: number) => `R$${(v / 1000).toFixed(0)}k`;

// O Chart.js desenha em canvas e não entende var(--x): as cores saem dos tokens do tema
// (globals.css) lidos na hora, então a paleta continua tendo uma fonte só.
interface Cores { principal: string; comparacao: string; eixo: string; grade: string; fundo: string; ok: string; atencao: string; ruim: string }
function lerCores(): Cores {
  const cs = getComputedStyle(document.documentElement);
  const v = (n: string) => cs.getPropertyValue(n).trim();
  return {
    principal: v('--chart-primary'), comparacao: v('--chart-secondary'), eixo: v('--chart-axis'), grade: v('--chart-grid'),
    fundo: v('--bg-surface'), ok: v('--badge-success-text'), atencao: v('--badge-warn-text'), ruim: v('--badge-error-text'),
  };
}
const rcol = (v: number, c: Cores) => (v >= 4.5 ? c.ok : v >= 3 ? c.atencao : c.ruim);
const ccol = (v: number, c: Cores) => (v >= 15 ? c.ok : v >= 12 ? c.atencao : c.ruim);

// Plugin: labels sobrepostos nos gráficos Investimento vs Receita
function makeIRPlugin(c: Cores) {
  return {
    id: `ir_${Math.random()}`,
    afterDatasetsDraw(chart: Chart) {
      const { ctx, scales } = chart as any;
      const x = scales['x'];
      const y = scales['y'];
      const data = chart.data as any;
      if (!x || !y) return;

      data.datasets[0].data.forEach((rv: number, i: number) => {
        const inv = data.datasets[1].data[i] as number;
        const xPos = x.getPixelForValue(i);
        const roas = data.roasArr[i] as number;
        const col = rcol(roas, c);

        if (rv > 0) {
          const yBar = y.getPixelForValue(rv);
          ctx.save();
          ctx.font = '600 12px Inter,sans-serif';
          ctx.fillStyle = c.principal;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(fmtK(rv), xPos, yBar - 4);
          ctx.restore();
        }

        if (inv >= 50) {
          const yInv = y.getPixelForValue(inv);
          ctx.save();
          ctx.beginPath();
          ctx.arc(xPos, yInv, 16, 0, 2 * Math.PI);
          ctx.fillStyle = c.fundo;
          ctx.fill();
          ctx.strokeStyle = col;
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.fillStyle = col;
          ctx.font = '700 11px Inter,sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`${roas.toFixed(1)}x`, xPos, yInv);
          ctx.restore();
        }
      });
    },
  };
}

// Plugin: labels sobrepostos nos gráficos Leads vs Vendas
function makeLVPlugin(c: Cores) {
  return {
    id: `lv_${Math.random()}`,
    afterDatasetsDraw(chart: Chart) {
      const { ctx, scales } = chart as any;
      const x = scales['x'];
      const y = scales['y'];
      const data = chart.data as any;
      if (!x || !y) return;

      data.datasets[0].data.forEach((lv: number, i: number) => {
        const venda = data.datasets[1].data[i] as number;
        if (lv === 0 && venda === 0) return;

        const xPos = x.getPixelForValue(i);
        const conv = data.convArr[i] as number;
        const col = ccol(conv, c);

        if (lv > 0) {
          const yBar = y.getPixelForValue(lv);
          ctx.save();
          ctx.font = '600 12px Inter,sans-serif';
          ctx.fillStyle = c.comparacao;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(String(lv), xPos, yBar - 4);
          ctx.restore();
        }

        if (venda > 0) {
          const yVenda = y.getPixelForValue(venda);
          ctx.save();
          ctx.font = '600 12px Inter,sans-serif';
          ctx.fillStyle = c.principal;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          ctx.fillText(String(venda), xPos, yVenda - 21);
          ctx.restore();
        }

        if (lv > 0) {
          const yVenda = y.getPixelForValue(venda);
          ctx.save();
          ctx.beginPath();
          ctx.arc(xPos, yVenda, 16, 0, 2 * Math.PI);
          ctx.fillStyle = c.fundo;
          ctx.fill();
          ctx.strokeStyle = col;
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.fillStyle = col;
          ctx.font = '700 11px Inter,sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`${Math.round(conv)}%`, xPos, yVenda);
          ctx.restore();
        }
      });
    },
  };
}

// Constrói configuração de gráfico IR (Investimento vs Receita)
function buildIRConfig(d: HistoricoPoint[], c: Cores): ChartConfiguration {
  const maxVal = Math.max(...d.map((r) => Math.max(r.rec, r.inv))) * 1.35 || 10;
  return {
    type: 'bar',
    plugins: [makeIRPlugin(c)] as any,
    data: {
      labels: d.map((r) => r.m),
      roasArr: d.map((r) => r.roas),
      datasets: [
        { type: 'bar' as const, data: d.map((r) => r.rec), backgroundColor: c.principal, borderRadius: 4, barPercentage: 0.55, categoryPercentage: 0.8, maxBarThickness: 44, order: 2 },
        { type: 'line' as const, data: d.map((r) => r.inv), borderColor: c.comparacao, backgroundColor: 'transparent', tension: 0.3, pointRadius: 0, borderWidth: 1.75, order: 1 },
      ],
    } as any,
    options: {
      responsive: true, maintainAspectRatio: false,
      layout: { padding: { top: 34, left: 4, right: 4 } },
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: {
        y: { min: 0, max: maxVal, ticks: { callback: (v: any) => fmtK(v), font: { size: 11 }, color: c.eixo }, grid: { color: c.grade }, border: { display: false } },
        x: { ticks: { font: { size: 11 }, maxRotation: 40, autoSkip: false, color: c.eixo }, grid: { display: false }, border: { display: false } },
      },
    },
  };
}

// Constrói configuração de gráfico LV (Leads vs Vendas)
function buildLVConfig(d: HistoricoPoint[], c: Cores): ChartConfiguration {
  const maxVal = Math.max(...d.map((r) => r.leads)) * 1.35 || 10;
  return {
    type: 'bar',
    plugins: [makeLVPlugin(c)] as any,
    data: {
      labels: d.map((r) => r.m),
      convArr: d.map((r) => r.conv),
      datasets: [
        { type: 'bar' as const, data: d.map((r) => r.leads), backgroundColor: c.comparacao, borderRadius: 4, barPercentage: 0.55, categoryPercentage: 0.8, maxBarThickness: 44, order: 2 },
        { type: 'line' as const, data: d.map((r) => r.vendas), borderColor: c.principal, backgroundColor: 'transparent', tension: 0.3, pointRadius: 0, borderWidth: 1.75, order: 1 },
      ],
    } as any,
    options: {
      responsive: true, maintainAspectRatio: false,
      layout: { padding: { top: 34, left: 4, right: 4 } },
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: {
        y: { min: 0, max: maxVal, ticks: { font: { size: 11 }, color: c.eixo }, grid: { color: c.grade }, border: { display: false } },
        x: { ticks: { font: { size: 11 }, maxRotation: 40, autoSkip: false, color: c.eixo }, grid: { display: false }, border: { display: false } },
      },
    },
  };
}

// ─── Sub-componentes ───────────────────────────────────────────────────────────

function Badge({ type }: { type: 'total' | 'meta' | 'google' }) {
  const labels = { total: 'TOTAL', meta: 'META ADS', google: 'GOOGLE ADS' };
  return <span className={`ui-badge mb-2 ${type === 'total' ? 'ui-badge-tint' : 'ui-badge-lime'}`}>{labels[type]}</span>;
}

function Legend({ items }: { items: { color: string; label: string; line?: boolean }[] }) {
  return (
    <div className="flex flex-wrap gap-3 mb-2">
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
          {item.line
            ? <span className="inline-block h-0.5 w-4 rounded" style={{ backgroundColor: item.color }} />
            : <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: item.color }} />
          }
          {item.label}
        </span>
      ))}
    </div>
  );
}

// Hook para criar/destruir chart instances
function useChart(canvasRef: React.RefObject<HTMLCanvasElement | null>, config: ChartConfiguration | null) {
  const chartRef = useRef<Chart | null>(null);
  useEffect(() => {
    if (!canvasRef.current || !config) return;
    if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
    chartRef.current = new Chart(canvasRef.current, config);
    return () => { chartRef.current?.destroy(); chartRef.current = null; };
  }, [config]);
}

// ─── Página principal ──────────────────────────────────────────────────────────

type Period = 3 | 6 | 12;

function fmt(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function HistoricoPage() {
  const { organization } = useAuth();
  const { data, isLoading, fetchHistorico } = useHistorico();
  const [period, setPeriod] = useState<Period>(6);
  const { resolvedTheme } = useTheme();
  const [backfilling, setBackfilling] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const handleBackfill = useCallback(async () => {
    setBackfilling(true);
    try {
      const until = fmt(new Date());
      const sinceDate = new Date();
      sinceDate.setFullYear(sinceDate.getFullYear() - 1);
      const since = fmt(sinceDate);
      const res = await apiService.googleBackfill(since, until);
      showToast(res.message, 'success');
      fetchHistorico(period);
    } catch (err: any) {
      showToast(err?.response?.data?.message ?? 'Erro ao carregar histórico Google Ads', 'error');
    } finally {
      setBackfilling(false);
    }
  }, [period, fetchHistorico, showToast]);

  useEffect(() => { fetchHistorico(period); }, [period]);

  const slice = useCallback((arr: HistoricoPoint[]) => arr.slice(-period), [period]);

  // resolvedTheme na dependência: troca de tema relê os tokens e redesenha.
  const cores = useMemo(() => (resolvedTheme && typeof document !== 'undefined' ? lerCores() : null), [resolvedTheme]);

  // Refs dos 6 canvas
  const c1 = useRef<HTMLCanvasElement>(null);
  const c2 = useRef<HTMLCanvasElement>(null);
  const c3 = useRef<HTMLCanvasElement>(null);
  const c4 = useRef<HTMLCanvasElement>(null);
  const c5 = useRef<HTMLCanvasElement>(null);
  const c6 = useRef<HTMLCanvasElement>(null);

  // Configs derivadas dos dados
  const cfg1 = data && cores ? buildIRConfig(slice(data.total),  cores) : null;
  const cfg2 = data && cores ? buildIRConfig(slice(data.meta),   cores) : null;
  const cfg3 = data && cores ? buildIRConfig(slice(data.google), cores) : null;
  const cfg4 = data && cores ? buildLVConfig(slice(data.total),  cores) : null;
  const cfg5 = data && cores ? buildLVConfig(slice(data.meta),   cores) : null;
  const cfg6 = data && cores ? buildLVConfig(slice(data.google), cores) : null;

  useChart(c1, cfg1);
  useChart(c2, cfg2);
  useChart(c3, cfg3);
  useChart(c4, cfg4);
  useChart(c5, cfg5);
  useChart(c6, cfg6);


  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="ui-h1">Evolução</h1>
          <p className="ui-sub">{organization?.name} · evolução mensal por canal de aquisição</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Backfill Google */}
          <button
            onClick={handleBackfill}
            disabled={backfilling || isLoading}
            className="ui-btn ui-btn-secondary ui-btn-sm"
          >
            {backfilling ? (
              <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            )}
            {backfilling ? 'Carregando...' : 'Histórico Google (1 ano)'}
          </button>

          {/* Seletor de período */}
          <div className="ui-seg" role="group" aria-label="Período">
            {([3, 6, 12] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                aria-pressed={period === p}
              >
                {p} meses
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-4 left-4 right-4 sm:bottom-auto sm:top-5 sm:left-auto sm:right-5 sm:max-w-sm z-50 flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium shadow-lg"
          style={
            toast.type === 'success'
              ? { backgroundColor: 'var(--badge-success-bg)', color: 'var(--badge-success-text)', border: '1px solid var(--badge-success-text)' }
              : { backgroundColor: 'var(--badge-error-bg)', color: 'var(--badge-error-text)', border: '1px solid var(--badge-error-text)' }
          }
        >
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

      {isLoading && (
        <div className="flex items-center justify-center py-20" style={{ color: 'var(--text-muted)' }}>
          <svg className="animate-spin h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="var(--accent)" strokeWidth="4" />
            <path className="opacity-75" fill="var(--accent)" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Carregando histórico...
        </div>
      )}

      {!isLoading && data && (
        <>
          {/* ── Bloco 1: Investimento vs Receita ─────────────────────────────── */}
          <div className="ui-card">
            <h2 className="ui-h2 mb-4">Investimento vs receita — ROAS no cruzamento</h2>

            {/* Total — largura completa */}
            <div className="mb-6">
              <Badge type="total" />
              <Legend items={[
                { color: 'var(--chart-primary)', label: 'Receita fechada' },
                { color: 'var(--chart-secondary)', label: 'Investimento', line: true },
                { color: 'var(--text-muted)', label: 'ROAS', line: false },
              ]} />
              <div style={{ position: 'relative', height: 280 }}>
                <canvas ref={c1} />
              </div>
            </div>

            {/* Meta + Google — lado a lado */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <Badge type="meta" />
                <Legend items={[
                  { color: 'var(--chart-primary)', label: 'Receita' },
                  { color: 'var(--chart-secondary)', label: 'Investimento', line: true },
                ]} />
                <div style={{ position: 'relative', height: 220 }}>
                  <canvas ref={c2} />
                </div>
              </div>
              <div>
                <Badge type="google" />
                <Legend items={[
                  { color: 'var(--chart-primary)', label: 'Receita' },
                  { color: 'var(--chart-secondary)', label: 'Investimento', line: true },
                ]} />
                <div style={{ position: 'relative', height: 220 }}>
                  <canvas ref={c3} />
                </div>
              </div>
            </div>
          </div>

          {/* ── Bloco 2: Leads vs Vendas ──────────────────────────────────────── */}
          <div className="ui-card">
            <h2 className="ui-h2 mb-4">Leads gerados vs vendas fechadas — taxa de conversão no cruzamento</h2>

            {/* Total */}
            <div className="mb-6">
              <Badge type="total" />
              <Legend items={[
                { color: 'var(--chart-secondary)', label: 'Leads gerados' },
                { color: 'var(--chart-primary)', label: 'Vendas fechadas', line: true },
                { color: 'var(--text-muted)', label: 'Taxa de conversão' },
              ]} />
              <div style={{ position: 'relative', height: 280 }}>
                <canvas ref={c4} />
              </div>
            </div>

            {/* Meta + Google */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <Badge type="meta" />
                <Legend items={[
                  { color: 'var(--chart-secondary)', label: 'Leads' },
                  { color: 'var(--chart-primary)', label: 'Vendas', line: true },
                ]} />
                <div style={{ position: 'relative', height: 220 }}>
                  <canvas ref={c5} />
                </div>
              </div>
              <div>
                <Badge type="google" />
                <Legend items={[
                  { color: 'var(--chart-secondary)', label: 'Leads' },
                  { color: 'var(--chart-primary)', label: 'Vendas', line: true },
                ]} />
                <div style={{ position: 'relative', height: 220 }}>
                  <canvas ref={c6} />
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {!isLoading && !data && (
        <div className="ui-card !p-10 flex flex-col items-center justify-center text-center">
          <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Sem dados históricos</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Sincronize Meta Ads, Google Ads e Kommo para ver a evolução mensal.</p>
        </div>
      )}

    </div>
  );
}