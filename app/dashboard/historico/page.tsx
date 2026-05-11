'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useHistorico } from '@/hooks/useApi';
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
const rcol = (v: number) => (v >= 4.5 ? '#1D9E75' : v >= 3 ? '#BA7517' : '#E24B4A');
const ccol = (v: number) => (v >= 15 ? '#1D9E75' : v >= 12 ? '#BA7517' : '#E24B4A');

// Plugin: labels sobrepostos nos gráficos Investimento vs Receita
function makeIRPlugin(invColor: string) {
  return {
    id: `ir_${invColor}`,
    afterDatasetsDraw(chart: Chart) {
      const { ctx, scales } = chart as any;
      const x = scales['x'];
      const y = scales['y'];
      const data = chart.data as any;
      if (!x || !y) return;

      data.datasets[0].data.forEach((rv: number, i: number) => {
        const inv = data.datasets[1].data[i] as number;
        const xPos = x.getPixelForValue(i);
        const yBar = y.getPixelForValue(rv);
        const yInv = y.getPixelForValue(inv);
        const roas = data.roasArr[i] as number;
        const col = rcol(roas);

        // Valor da barra (receita)
        ctx.save();
        ctx.font = '600 12px Inter,sans-serif';
        ctx.fillStyle = '#1D9E75';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(fmtK(rv), xPos, yBar - 4);
        ctx.restore();

        // Valor da linha (investimento) — acima do círculo
        ctx.save();
        ctx.font = '600 12px Inter,sans-serif';
        ctx.fillStyle = invColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(fmtK(inv), xPos, yInv - 21);
        ctx.restore();

        // Círculo com ROAS
        ctx.save();
        ctx.beginPath();
        ctx.arc(xPos, yInv, 16, 0, 2 * Math.PI);
        ctx.fillStyle = '#0f1629';
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
      });
    },
  };
}

// Plugin: labels sobrepostos nos gráficos Leads vs Vendas
function makeLVPlugin() {
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
        const xPos = x.getPixelForValue(i);
        const yBar = y.getPixelForValue(lv);
        const yVenda = y.getPixelForValue(venda);
        const conv = data.convArr[i] as number;
        const col = ccol(conv);

        // Valor da barra (leads)
        ctx.save();
        ctx.font = '600 12px Inter,sans-serif';
        ctx.fillStyle = '#7F77DD';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(String(lv), xPos, yBar - 4);
        ctx.restore();

        // Valor da linha (vendas) — acima do círculo
        ctx.save();
        ctx.font = '600 12px Inter,sans-serif';
        ctx.fillStyle = '#1D9E75';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(String(venda), xPos, yVenda - 21);
        ctx.restore();

        // Círculo com taxa de conversão
        ctx.save();
        ctx.beginPath();
        ctx.arc(xPos, yVenda, 16, 0, 2 * Math.PI);
        ctx.fillStyle = '#0f1629';
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
      });
    },
  };
}

// Constrói configuração de gráfico IR (Investimento vs Receita)
function buildIRConfig(d: HistoricoPoint[], invColor: string): ChartConfiguration {
  const maxVal = Math.max(...d.map((r) => Math.max(r.rec, r.inv))) * 1.35 || 10;
  return {
    type: 'bar',
    plugins: [makeIRPlugin(invColor)] as any,
    data: {
      labels: d.map((r) => r.m),
      roasArr: d.map((r) => r.roas),
      datasets: [
        { type: 'bar' as const, data: d.map((r) => r.rec), backgroundColor: 'rgba(29,158,117,0.7)', borderRadius: 4, barPercentage: 0.55, categoryPercentage: 0.8, order: 2 },
        { type: 'line' as const, data: d.map((r) => r.inv), borderColor: invColor, backgroundColor: 'transparent', tension: 0.3, pointRadius: 0, borderWidth: 2.5, order: 1 },
      ],
    } as any,
    options: {
      responsive: true, maintainAspectRatio: false,
      layout: { padding: { top: 34, left: 4, right: 4 } },
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: {
        y: { min: 0, max: maxVal, ticks: { callback: (v: any) => fmtK(v), font: { size: 11 }, color: '#475569' }, grid: { color: 'rgba(255,255,255,0.04)' }, border: { display: false } },
        x: { ticks: { font: { size: 11 }, maxRotation: 40, autoSkip: false, color: '#475569' }, grid: { display: false }, border: { display: false } },
      },
    },
  };
}

// Constrói configuração de gráfico LV (Leads vs Vendas)
function buildLVConfig(d: HistoricoPoint[]): ChartConfiguration {
  const maxVal = Math.max(...d.map((r) => r.leads)) * 1.35 || 10;
  return {
    type: 'bar',
    plugins: [makeLVPlugin()] as any,
    data: {
      labels: d.map((r) => r.m),
      convArr: d.map((r) => r.conv),
      datasets: [
        { type: 'bar' as const, data: d.map((r) => r.leads), backgroundColor: 'rgba(127,119,221,0.7)', borderRadius: 4, barPercentage: 0.55, categoryPercentage: 0.8, order: 2 },
        { type: 'line' as const, data: d.map((r) => r.vendas), borderColor: '#1D9E75', backgroundColor: 'transparent', tension: 0.3, pointRadius: 0, borderWidth: 2.5, order: 1 },
      ],
    } as any,
    options: {
      responsive: true, maintainAspectRatio: false,
      layout: { padding: { top: 34, left: 4, right: 4 } },
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: {
        y: { min: 0, max: maxVal, ticks: { font: { size: 11 }, color: '#475569' }, grid: { color: 'rgba(255,255,255,0.04)' }, border: { display: false } },
        x: { ticks: { font: { size: 11 }, maxRotation: 40, autoSkip: false, color: '#475569' }, grid: { display: false }, border: { display: false } },
      },
    },
  };
}

// ─── Sub-componentes ───────────────────────────────────────────────────────────

function Badge({ type }: { type: 'total' | 'meta' | 'google' }) {
  const styles = {
    total:  { bg: 'rgba(100,116,139,0.15)', color: '#94a3b8' },
    meta:   { bg: '#1a1428',                color: '#7F77DD'  },
    google: { bg: '#0d2218',                color: '#1D9E75'  },
  }[type];
  const labels = { total: 'Total', meta: 'Meta Ads', google: 'Google Ads' };
  return (
    <span className="inline-block text-xs font-medium px-2.5 py-1 rounded-md mb-2" style={{ backgroundColor: styles.bg, color: styles.color }}>
      {labels[type]}
    </span>
  );
}

function Legend({ items }: { items: { color: string; label: string; line?: boolean }[] }) {
  return (
    <div className="flex flex-wrap gap-3 mb-2">
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-1.5 text-xs" style={{ color: '#7d8590' }}>
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

export default function HistoricoPage() {
  const { organization } = useAuth();
  const { data, isLoading, fetchHistorico } = useHistorico();
  const [period, setPeriod] = useState<Period>(6);

  useEffect(() => { fetchHistorico(period); }, [period]);

  const slice = useCallback((arr: HistoricoPoint[]) => arr.slice(-period), [period]);

  // Refs dos 6 canvas
  const c1 = useRef<HTMLCanvasElement>(null);
  const c2 = useRef<HTMLCanvasElement>(null);
  const c3 = useRef<HTMLCanvasElement>(null);
  const c4 = useRef<HTMLCanvasElement>(null);
  const c5 = useRef<HTMLCanvasElement>(null);
  const c6 = useRef<HTMLCanvasElement>(null);

  // Configs derivadas dos dados
  const cfg1 = data ? buildIRConfig(slice(data.total),  '#378ADD') : null;
  const cfg2 = data ? buildIRConfig(slice(data.meta),   '#7F77DD') : null;
  const cfg3 = data ? buildIRConfig(slice(data.google), '#EF9F27') : null;
  const cfg4 = data ? buildLVConfig(slice(data.total))             : null;
  const cfg5 = data ? buildLVConfig(slice(data.meta))              : null;
  const cfg6 = data ? buildLVConfig(slice(data.google))            : null;

  useChart(c1, cfg1);
  useChart(c2, cfg2);
  useChart(c3, cfg3);
  useChart(c4, cfg4);
  useChart(c5, cfg5);
  useChart(c6, cfg6);

  const cardStyle = { backgroundColor: '#0f1629', border: '1px solid rgba(255,255,255,0.06)' };
  const divider   = { borderTop: '0.5px solid rgba(255,255,255,0.06)' };

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3" style={cardStyle}>
        <div>
          <p className="text-sm font-semibold" style={{ color: '#f1f5f9' }}>Evolução Histórica</p>
          <p className="text-xs mt-0.5" style={{ color: '#475569' }}>{organization?.name} · evolução mensal por canal de aquisição</p>
        </div>

        {/* Seletor de período */}
        <div className="flex rounded-lg p-0.5 gap-0.5" style={{ backgroundColor: '#060c1a', border: '1px solid rgba(255,255,255,0.06)' }}>
          {([3, 6, 12] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
              style={period === p ? { backgroundColor: '#3b82f6', color: '#fff' } : { color: '#64748b' }}
            >
              {p} meses
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-20" style={{ color: '#475569' }}>
          <svg className="animate-spin h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="#3b82f6" strokeWidth="4" />
            <path className="opacity-75" fill="#3b82f6" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Carregando histórico...
        </div>
      )}

      {!isLoading && data && (
        <>
          {/* ── Bloco 1: Investimento vs Receita ─────────────────────────────── */}
          <div className="rounded-xl p-5" style={cardStyle}>
            <p className="text-sm font-medium pb-3 mb-4" style={{ color: '#f1f5f9', borderBottom: '0.5px solid rgba(255,255,255,0.06)' }}>
              Investimento vs receita — ROAS no cruzamento
            </p>

            {/* Total — largura completa */}
            <div className="mb-6">
              <Badge type="total" />
              <Legend items={[
                { color: '#1D9E75', label: 'Receita fechada' },
                { color: '#378ADD', label: 'Investimento', line: true },
                { color: '#888', label: 'ROAS', line: false },
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
                  { color: '#1D9E75', label: 'Receita' },
                  { color: '#7F77DD', label: 'Investimento', line: true },
                ]} />
                <div style={{ position: 'relative', height: 220 }}>
                  <canvas ref={c2} />
                </div>
              </div>
              <div>
                <Badge type="google" />
                <Legend items={[
                  { color: '#1D9E75', label: 'Receita' },
                  { color: '#EF9F27', label: 'Investimento', line: true },
                ]} />
                <div style={{ position: 'relative', height: 220 }}>
                  <canvas ref={c3} />
                </div>
              </div>
            </div>
          </div>

          {/* ── Bloco 2: Leads vs Vendas ──────────────────────────────────────── */}
          <div className="rounded-xl p-5" style={cardStyle}>
            <p className="text-sm font-medium pb-3 mb-4" style={{ color: '#f1f5f9', borderBottom: '0.5px solid rgba(255,255,255,0.06)' }}>
              Leads gerados vs vendas fechadas — taxa de conversão no cruzamento
            </p>

            {/* Total */}
            <div className="mb-6">
              <Badge type="total" />
              <Legend items={[
                { color: '#7F77DD', label: 'Leads gerados' },
                { color: '#1D9E75', label: 'Vendas fechadas', line: true },
                { color: '#888', label: 'Taxa de conversão' },
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
                  { color: '#7F77DD', label: 'Leads' },
                  { color: '#1D9E75', label: 'Vendas', line: true },
                ]} />
                <div style={{ position: 'relative', height: 220 }}>
                  <canvas ref={c5} />
                </div>
              </div>
              <div>
                <Badge type="google" />
                <Legend items={[
                  { color: '#7F77DD', label: 'Leads' },
                  { color: '#1D9E75', label: 'Vendas', line: true },
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
        <div className="rounded-xl p-10 flex flex-col items-center justify-center text-center" style={cardStyle}>
          <p className="text-sm font-medium" style={{ color: '#94a3b8' }}>Sem dados históricos</p>
          <p className="text-xs mt-1" style={{ color: '#475569' }}>Sincronize Meta Ads, Google Ads e Kommo para ver a evolução mensal.</p>
        </div>
      )}

    </div>
  );
}