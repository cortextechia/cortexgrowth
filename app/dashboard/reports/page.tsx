'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiService } from '@/lib/api';
import { AiAnalysis, AgentOutput } from '@/types';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

// ─── Score badge ─────────────────────────────────────────────────────────────

function ScoreBadge({ score, size = 'md' }: { score: number; size?: 'sm' | 'md' | 'lg' }) {
  const color =
    score >= 75 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444';
  const bg =
    score >= 75 ? 'rgba(34,197,94,0.1)' : score >= 50 ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)';
  const sizes = { sm: 'text-xs px-2 py-0.5', md: 'text-sm px-2.5 py-1', lg: 'text-xl font-bold px-3 py-1.5' };
  return (
    <span
      className={`rounded-full font-semibold tabular-nums ${sizes[size]}`}
      style={{ color, backgroundColor: bg }}
    >
      {score}
    </span>
  );
}

// ─── Agent section ────────────────────────────────────────────────────────────

function AgentSection({ label, data }: { label: string; data: AgentOutput }) {
  return (
    <div className="rounded-xl p-4" style={{ backgroundColor: '#0a1020', border: '1px solid rgba(255,255,255,0.05)' }}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium" style={{ color: '#94a3b8' }}>{label}</span>
        <ScoreBadge score={data.score} size="sm" />
      </div>
      {data.summary && (
        <p className="text-xs leading-relaxed mb-3" style={{ color: '#64748b' }}>{data.summary}</p>
      )}
      {data.alerts.length > 0 && (
        <div className="mb-2">
          <p className="text-xs font-medium mb-1" style={{ color: '#f59e0b' }}>Alertas</p>
          <ul className="space-y-1">
            {data.alerts.map((a, i) => (
              <li key={i} className="text-xs flex gap-1.5" style={{ color: '#94a3b8' }}>
                <span style={{ color: '#f59e0b' }}>•</span>{a}
              </li>
            ))}
          </ul>
        </div>
      )}
      {data.recommendations.length > 0 && (
        <div>
          <p className="text-xs font-medium mb-1" style={{ color: '#3b82f6' }}>Recomendações</p>
          <ul className="space-y-1">
            {data.recommendations.map((r, i) => (
              <li key={i} className="text-xs flex gap-1.5" style={{ color: '#94a3b8' }}>
                <span style={{ color: '#3b82f6' }}>→</span>{r}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── Report card ─────────────────────────────────────────────────────────────

function ReportCard({
  report,
  expanded,
  onToggle,
  onExport,
  exporting,
}: {
  report: AiAnalysis;
  expanded: boolean;
  onToggle: () => void;
  onExport: () => void;
  exporting: boolean;
}) {
  const content = report.content;
  const overall = content.orchestrator?.overallScore ?? 0;
  const marketing = content.marketing?.score ?? 0;
  const sales = content.sales?.score ?? 0;
  const roas = content.roas?.score ?? 0;

  const dateLabel = new Date(report.createdAt).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div
      className="rounded-xl overflow-hidden transition-all"
      style={{ backgroundColor: '#0f1629', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      {/* Header row — always visible */}
      <button
        onClick={onToggle}
        className="w-full text-left p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3 hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <ScoreBadge score={overall} size="lg" />
            <span className="text-sm font-medium" style={{ color: '#f1f5f9' }}>Score geral</span>
          </div>
          <p className="text-xs" style={{ color: '#475569' }}>{dateLabel} · período {report.period}</p>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="flex gap-2">
            {[
              { label: 'Mkt', score: marketing },
              { label: 'Vnd', score: sales },
              { label: 'ROAS', score: roas },
            ].map(({ label, score }) => (
              <div key={label} className="text-center">
                <ScoreBadge score={score} size="sm" />
                <p className="text-xs mt-0.5" style={{ color: '#334155' }}>{label}</p>
              </div>
            ))}
          </div>
          <svg
            className={`h-4 w-4 flex-shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
            style={{ color: '#475569' }}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 sm:px-5 pb-5 space-y-4" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
          {/* Executive summary */}
          {content.orchestrator?.executiveSummary && (
            <div className="pt-4">
              <p className="text-xs font-medium mb-2 uppercase tracking-wide" style={{ color: '#475569' }}>
                Resumo executivo
              </p>
              <p className="text-sm leading-relaxed" style={{ color: '#94a3b8' }}>
                {content.orchestrator.executiveSummary}
              </p>
            </div>
          )}

          {/* Priority alerts + top recommendations */}
          {(content.orchestrator?.priorityAlerts?.length || content.orchestrator?.topRecommendations?.length) ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {content.orchestrator.priorityAlerts.length > 0 && (
                <div className="rounded-lg p-3" style={{ backgroundColor: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)' }}>
                  <p className="text-xs font-medium mb-2" style={{ color: '#ef4444' }}>Alertas prioritários</p>
                  <ul className="space-y-1">
                    {content.orchestrator.priorityAlerts.map((a, i) => (
                      <li key={i} className="text-xs flex gap-1.5" style={{ color: '#94a3b8' }}>
                        <span style={{ color: '#ef4444' }}>!</span>{a}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {content.orchestrator.topRecommendations.length > 0 && (
                <div className="rounded-lg p-3" style={{ backgroundColor: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)' }}>
                  <p className="text-xs font-medium mb-2" style={{ color: '#60a5fa' }}>Top recomendações</p>
                  <ul className="space-y-1">
                    {content.orchestrator.topRecommendations.map((r, i) => (
                      <li key={i} className="text-xs flex gap-1.5" style={{ color: '#94a3b8' }}>
                        <span style={{ color: '#60a5fa' }}>{i + 1}.</span>{r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : null}

          {/* Per-agent breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {content.marketing && <AgentSection label="Marketing" data={content.marketing} />}
            {content.sales && <AgentSection label="Vendas" data={content.sales} />}
            {content.roas && <AgentSection label="ROAS" data={content.roas} />}
          </div>

          {/* Export button */}
          <div className="flex justify-end pt-1">
            <button
              onClick={(e) => { e.stopPropagation(); onExport(); }}
              disabled={exporting}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-opacity disabled:opacity-60"
              style={{ backgroundColor: 'rgba(59,130,246,0.12)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.2)' }}
            >
              {exporting ? (
                <>
                  <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Gerando PDF…
                </>
              ) : (
                <>
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                  </svg>
                  Exportar PDF
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Custom tooltip for chart ────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg px-3 py-2 text-xs space-y-1" style={{ backgroundColor: '#1e293b', border: '1px solid rgba(255,255,255,0.1)' }}>
      <p style={{ color: '#64748b' }}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [reports, setReports] = useState<AiAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'ok' | 'err' } | null>(null);

  const fetchReports = useCallback(async () => {
    try {
      const res = await apiService.getInsights({ limit: 30 });
      setReports(res.data ?? []);
    } catch {
      /* silently handled */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  const showToast = (msg: string, type: 'ok' | 'err') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await apiService.generateInsights();
      if (res.success) {
        showToast('Relatório gerado com sucesso!', 'ok');
        await fetchReports();
        setExpandedId(null); // collapse all so new one is visible at top
      } else {
        showToast(res.message ?? 'Erro ao gerar relatório', 'err');
      }
    } catch (e: any) {
      showToast(e?.response?.data?.message ?? 'Erro ao gerar relatório', 'err');
    } finally {
      setGenerating(false);
    }
  };

  const toggleExpanded = (id: string) =>
    setExpandedId((prev) => (prev === id ? null : id));

  const handleExportPdf = async (report: AiAnalysis) => {
    setExportingId(report.id);
    try {
      const [{ pdf }, { ReportPdfDocument }] = await Promise.all([
        import('@react-pdf/renderer'),
        import('@/components/ReportPdfDocument'),
      ]);
      const blob = await pdf(<ReportPdfDocument report={report} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `relatorio-cortex-${report.period}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      showToast('Erro ao gerar PDF. Tente novamente.', 'err');
    } finally {
      setExportingId(null);
    }
  };

  // Score trend chart data (cronológico: do mais antigo pro mais recente)
  const chartData = [...reports]
    .reverse()
    .slice(-10)
    .map((r) => ({
      date: r.period,
      Geral: r.content.orchestrator?.overallScore ?? 0,
      Marketing: r.content.marketing?.score ?? 0,
      Vendas: r.content.sales?.score ?? 0,
      ROAS: r.content.roas?.score ?? 0,
    }));

  return (
    <div className="w-full max-w-5xl space-y-6">
      {/* Toast */}
      {toast && (
        <div
          className="fixed top-4 right-4 z-50 rounded-xl px-4 py-3 text-sm font-medium shadow-lg"
          style={{
            backgroundColor: toast.type === 'ok' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
            border: `1px solid ${toast.type === 'ok' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
            color: toast.type === 'ok' ? '#22c55e' : '#ef4444',
          }}
        >
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold" style={{ color: '#f1f5f9' }}>Relatórios</h1>
          <p className="mt-1 text-sm" style={{ color: '#475569' }}>
            Histórico de análises geradas pelos agentes de IA.
          </p>
        </div>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-opacity disabled:opacity-60"
          style={{ backgroundColor: '#3b82f6', color: '#fff' }}
        >
          {generating ? (
            <>
              <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Gerando…
            </>
          ) : (
            <>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Gerar relatório
            </>
          )}
        </button>
      </div>

      {/* Score history chart */}
      {chartData.length > 1 && (
        <div
          className="rounded-2xl p-4 sm:p-6"
          style={{ backgroundColor: '#0f1629', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <p className="text-sm font-medium mb-4" style={{ color: '#94a3b8' }}>
            Histórico de scores (últimos {chartData.length} relatórios)
          </p>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: '#475569' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 10, fill: '#475569' }}
                tickLine={false}
                axisLine={false}
                width={28}
              />
              <Tooltip content={<ChartTooltip />} />
              <Line type="monotone" dataKey="Geral" stroke="#3b82f6" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Marketing" stroke="#a855f7" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
              <Line type="monotone" dataKey="Vendas" stroke="#22c55e" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
              <Line type="monotone" dataKey="ROAS" stroke="#f59e0b" strokeWidth={1.5} dot={false} strokeDasharray="4 2" />
            </LineChart>
          </ResponsiveContainer>
          {/* Legend */}
          <div className="flex flex-wrap gap-4 mt-3">
            {[
              { label: 'Geral', color: '#3b82f6' },
              { label: 'Marketing', color: '#a855f7' },
              { label: 'Vendas', color: '#22c55e' },
              { label: 'ROAS', color: '#f59e0b' },
            ].map(({ label, color }) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className="h-2 w-4 rounded-full" style={{ backgroundColor: color }} />
                <span className="text-xs" style={{ color: '#475569' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reports list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 rounded-xl animate-pulse"
              style={{ backgroundColor: '#0f1629' }}
            />
          ))}
        </div>
      ) : reports.length === 0 ? (
        <div
          className="rounded-2xl p-10 flex flex-col items-center text-center"
          style={{ backgroundColor: '#0f1629', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div
            className="h-12 w-12 rounded-xl flex items-center justify-center mb-4"
            style={{ backgroundColor: 'rgba(59,130,246,0.1)' }}
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="#60a5fa" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
            </svg>
          </div>
          <h2 className="text-base font-semibold mb-2" style={{ color: '#f1f5f9' }}>Nenhum relatório ainda</h2>
          <p className="text-sm mb-4" style={{ color: '#64748b' }}>
            Clique em "Gerar relatório" para criar sua primeira análise de IA.
          </p>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="px-4 py-2 rounded-xl text-sm font-medium disabled:opacity-60"
            style={{ backgroundColor: '#3b82f6', color: '#fff' }}
          >
            {generating ? 'Gerando…' : 'Gerar relatório'}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => (
            <ReportCard
              key={report.id}
              report={report}
              expanded={expandedId === report.id}
              onToggle={() => toggleExpanded(report.id)}
              onExport={() => handleExportPdf(report)}
              exporting={exportingId === report.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}