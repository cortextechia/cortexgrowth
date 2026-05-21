'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiService } from '@/lib/api';
import type { SeoAnalysis, SeoConfig } from '@/types';
import { useAuth } from '@/context/AuthContext';
import { UserRole } from '@/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ScoreBadge({ score, size = 'md' }: { score: number | null; size?: 'sm' | 'md' | 'lg' }) {
  const s = score ?? 0;
  const color = s >= 80 ? '#22c55e' : s >= 55 ? '#f59e0b' : '#ef4444';
  const sizeClass = size === 'lg' ? 'text-3xl w-16 h-16' : size === 'sm' ? 'text-sm w-9 h-9' : 'text-lg w-12 h-12';
  return (
    <div
      className={`${sizeClass} rounded-full flex items-center justify-center font-bold shrink-0`}
      style={{ border: `2px solid ${color}`, color, backgroundColor: `${color}18` }}
    >
      {score !== null ? s : '—'}
    </div>
  );
}

function ScoreBar({ label, score }: { label: string; score: number | null }) {
  const s = score ?? 0;
  const color = s >= 80 ? '#22c55e' : s >= 55 ? '#f59e0b' : '#ef4444';
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{label}</span>
        <span className="text-xs font-semibold" style={{ color }}>{score !== null ? `${s}/100` : '—'}</span>
      </div>
      <div className="h-1.5 rounded-full" style={{ backgroundColor: 'var(--border-default)' }}>
        <div
          className="h-1.5 rounded-full transition-all duration-500"
          style={{ width: `${s}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

const card = { backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-default)' };

// ─── Modal de configuração ─────────────────────────────────────────────────────

function ConfigModal({ config, onClose, onSaved }: {
  config: SeoConfig;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [websiteUrl, setWebsiteUrl] = useState(config.websiteUrl ?? '');
  const [competitors, setCompetitors] = useState(config.competitorUrls.join('\n'));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    setError('');
    const urls = competitors.split('\n').map(s => s.trim()).filter(Boolean);
    if (!websiteUrl.startsWith('http')) {
      setError('URL deve começar com http:// ou https://');
      return;
    }
    setLoading(true);
    try {
      await apiService.updateSeoConfig({ websiteUrl, competitorUrls: urls });
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e?.response?.data?.message ?? 'Erro ao salvar configuração');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}>
      <div className="w-full max-w-md rounded-2xl p-6 space-y-4" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}>
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Configurar URLs</p>
          <button onClick={onClose} style={{ color: 'var(--text-muted)' }}>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>URL do seu site</label>
            <input
              value={websiteUrl}
              onChange={e => setWebsiteUrl(e.target.value)}
              placeholder="https://seusite.com.br"
              className="w-full rounded-lg px-3 py-2 text-sm outline-none"
              style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
            />
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>
              Concorrentes <span style={{ color: 'var(--text-muted)' }}>(uma URL por linha, máx 5)</span>
            </label>
            <textarea
              value={competitors}
              onChange={e => setCompetitors(e.target.value)}
              placeholder={'https://concorrente1.com.br\nhttps://concorrente2.com.br'}
              rows={4}
              className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none"
              style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}
            />
          </div>
          {error && <p className="text-xs" style={{ color: 'var(--error)' }}>{error}</p>}
        </div>

        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-sm"
            style={{ color: 'var(--text-muted)', backgroundColor: 'var(--bg-elevated)' }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg text-sm font-medium"
            style={{ backgroundColor: 'var(--accent)', color: '#fff', opacity: loading ? 0.6 : 1 }}
          >
            {loading ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Card de snapshot ──────────────────────────────────────────────────────────

function SnapshotCard({ analysis, isSelected, onClick }: {
  analysis: SeoAnalysis;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-xl p-3 transition-all"
      style={{
        backgroundColor: isSelected ? 'var(--accent-muted)' : 'var(--bg-elevated)',
        border: `1px solid ${isSelected ? 'var(--accent-border)' : 'var(--border-default)'}`,
      }}
    >
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5">
          {analysis.isBaseline && (
            <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: 'rgba(168,85,247,0.15)', color: '#c084fc' }}>
              BASELINE
            </span>
          )}
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{fmtDate(analysis.analyzedAt)}</span>
        </div>
        <ScoreBadge score={analysis.overallScore} size="sm" />
      </div>
      <div className="grid grid-cols-3 gap-1">
        {[
          { label: 'Perf.', score: analysis.pageSpeedScore },
          { label: 'SEO', score: analysis.seoScore },
          { label: 'AIO', score: analysis.aioScore },
        ].map(({ label, score }) => {
          const s = score ?? 0;
          const color = s >= 80 ? '#22c55e' : s >= 55 ? '#f59e0b' : '#ef4444';
          return (
            <div key={label} className="text-center">
              <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{label}</div>
              <div className="text-xs font-semibold" style={{ color }}>{score ?? '—'}</div>
            </div>
          );
        })}
      </div>
    </button>
  );
}

// ─── Detalhe de snapshot ───────────────────────────────────────────────────────

function SnapshotDetail({ analysis, baseline }: { analysis: SeoAnalysis; baseline: SeoAnalysis | null }) {
  const delta = (current: number | null, base: number | null): string => {
    if (current === null || base === null) return '';
    const d = current - base;
    if (d === 0) return '';
    return d > 0 ? `+${d}` : `${d}`;
  };

  const deltaColor = (d: string) => {
    if (d.startsWith('+')) return '#22c55e';
    if (d.startsWith('-')) return '#ef4444';
    return 'var(--text-muted)';
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{fmtDate(analysis.analyzedAt)}</p>
          <p className="text-sm truncate max-w-xs" style={{ color: 'var(--text-secondary)' }}>{analysis.siteUrl}</p>
          {analysis.isBaseline && (
            <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: 'rgba(168,85,247,0.15)', color: '#c084fc' }}>
              BASELINE — estado de entrada
            </span>
          )}
        </div>
        <ScoreBadge score={analysis.overallScore} size="lg" />
      </div>

      {/* Scores com delta vs baseline */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Performance', score: analysis.pageSpeedScore, base: baseline?.pageSpeedScore ?? null },
          { label: 'SEO Técnico', score: analysis.seoScore, base: baseline?.seoScore ?? null },
          { label: 'AIO', score: analysis.aioScore, base: baseline?.aioScore ?? null },
        ].map(({ label, score, base }) => {
          const d = !analysis.isBaseline ? delta(score, base) : '';
          return (
            <div key={label} className="rounded-xl p-3 text-center" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-default)' }}>
              <p className="text-[10px] mb-1" style={{ color: 'var(--text-muted)' }}>{label}</p>
              <ScoreBadge score={score} size="sm" />
              {d && (
                <p className="text-xs font-semibold mt-1" style={{ color: deltaColor(d) }}>{d} pts</p>
              )}
            </div>
          );
        })}
      </div>

      {/* SEO Issues */}
      {(analysis.seoData?.issues?.length ?? 0) > 0 && (
        <div className="rounded-xl p-4 space-y-2" style={card}>
          <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Problemas SEO detectados</p>
          {analysis.seoData!.issues.map((issue, i) => (
            <div key={i} className="flex items-start gap-2">
              <span style={{ color: '#f59e0b' }}>⚠</span>
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{issue}</span>
            </div>
          ))}
        </div>
      )}

      {/* AIO */}
      {analysis.aioData && (
        <div className="rounded-xl p-4 space-y-3" style={card}>
          <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Análise AIO (visibilidade para agentes de IA)</p>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{analysis.aioData.summary}</p>
          {analysis.aioData.criticalPoints.length > 0 && (
            <div>
              <p className="text-[10px] font-medium mb-1.5" style={{ color: '#ef4444' }}>Pontos críticos</p>
              {analysis.aioData.criticalPoints.map((p, i) => (
                <div key={i} className="flex items-start gap-2 mb-1">
                  <span className="text-xs shrink-0" style={{ color: '#ef4444' }}>✕</span>
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{p}</span>
                </div>
              ))}
            </div>
          )}
          {analysis.aioData.recommendations.length > 0 && (
            <div>
              <p className="text-[10px] font-medium mb-1.5" style={{ color: '#22c55e' }}>Recomendações</p>
              {analysis.aioData.recommendations.map((r, i) => (
                <div key={i} className="flex items-start gap-2 mb-1">
                  <span className="text-xs shrink-0" style={{ color: '#22c55e' }}>→</span>
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{r}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Concorrentes */}
      {(analysis.competitorData?.length ?? 0) > 0 && (
        <div className="rounded-xl p-4 space-y-3" style={card}>
          <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Comparativo com concorrentes</p>
          {/* Seu site */}
          <div className="flex items-center gap-3 py-1.5 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
            <div className="flex-1 min-w-0">
              <p className="text-xs truncate" style={{ color: '#60a5fa' }}>{analysis.siteUrl} <span className="opacity-60">(seu site)</span></p>
            </div>
            <div className="flex gap-3 shrink-0">
              <ScoreBar label="Perf" score={analysis.pageSpeedScore} />
            </div>
            <ScoreBadge score={analysis.overallScore} size="sm" />
          </div>
          {analysis.competitorData!.map((comp, i) => (
            <div key={i} className="flex items-center gap-3 py-1">
              <div className="flex-1 min-w-0">
                <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{comp.url}</p>
                {comp.error && <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Erro: {comp.error}</p>}
              </div>
              <ScoreBadge score={comp.error ? null : comp.overallScore} size="sm" />
            </div>
          ))}
        </div>
      )}

      {/* Infraestrutura para IA */}
      {analysis.seoData && (
        <div className="rounded-xl p-4 space-y-3" style={card}>
          <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Infraestrutura para agentes de IA</p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2">
            {[
              {
                label: 'robots.txt',
                ok: analysis.seoData.robots?.present ?? false,
                detail: !analysis.seoData.robots?.present
                  ? 'ausente'
                  : (analysis.seoData.robots.blocksGPTBot || analysis.seoData.robots.blocksClaudeBot || analysis.seoData.robots.blocksPerplexityBot)
                    ? 'bloqueia AI crawlers'
                    : 'OK',
                warn: analysis.seoData.robots?.present && (analysis.seoData.robots.blocksGPTBot || analysis.seoData.robots.blocksClaudeBot || analysis.seoData.robots.blocksPerplexityBot),
              },
              {
                label: 'Sitemap',
                ok: analysis.seoData.hasSitemap,
                detail: analysis.seoData.hasSitemap ? 'detectado' : 'não encontrado',
                warn: false,
              },
              {
                label: 'llms.txt',
                ok: analysis.seoData.hasLlmsTxt,
                detail: analysis.seoData.hasLlmsTxt ? 'presente' : 'não encontrado',
                warn: false,
              },
              {
                label: 'Schema.org',
                ok: (analysis.seoData.schemaTypes?.length ?? 0) > 0,
                detail: (analysis.seoData.schemaTypes?.length ?? 0) > 0
                  ? analysis.seoData.schemaTypes!.slice(0, 2).join(', ')
                  : 'ausente',
                warn: false,
              },
              {
                label: 'OG tags',
                ok: !!(analysis.seoData.ogTags?.title && analysis.seoData.ogTags?.description && analysis.seoData.ogTags?.image),
                detail: analysis.seoData.ogTags
                  ? [
                      analysis.seoData.ogTags.title && 'title',
                      analysis.seoData.ogTags.description && 'description',
                      analysis.seoData.ogTags.image && 'image',
                    ].filter(Boolean).join(', ') || 'nenhuma'
                  : 'nenhuma',
                warn: false,
              },
              {
                label: 'Indexável',
                ok: analysis.seoData.isIndexable,
                detail: analysis.seoData.isIndexable ? 'sim' : 'noindex ativo',
                warn: !analysis.seoData.isIndexable,
              },
            ].map(({ label, ok, detail, warn }) => (
              <div key={label} className="flex items-center gap-2">
                <span className="text-sm shrink-0" style={{ color: warn ? '#f59e0b' : ok ? '#22c55e' : '#ef4444' }}>
                  {warn ? '⚠' : ok ? '✓' : '✕'}
                </span>
                <div className="min-w-0">
                  <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</span>
                  <span className="text-[10px] ml-1" style={{ color: 'var(--text-muted)' }}>{detail}</span>
                </div>
              </div>
            ))}
          </div>
          {/* AI Crawlers detail */}
          {analysis.seoData.robots?.present && (
            <div className="flex gap-3 pt-1 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
              {[
                { bot: 'GPTBot', blocked: analysis.seoData.robots.blocksGPTBot },
                { bot: 'ClaudeBot', blocked: analysis.seoData.robots.blocksClaudeBot },
                { bot: 'PerplexityBot', blocked: analysis.seoData.robots.blocksPerplexityBot },
              ].map(({ bot, blocked }) => (
                <div key={bot} className="flex items-center gap-1">
                  <span className="text-[10px]" style={{ color: blocked ? '#ef4444' : '#22c55e' }}>{blocked ? '✕' : '✓'}</span>
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{bot}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* PageSpeed técnico */}
      {analysis.pageSpeedData && (
        <div className="rounded-xl p-4 space-y-2" style={card}>
          <p className="text-xs font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Core Web Vitals (mobile)</p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2">
            {[
              { label: 'FCP', val: analysis.pageSpeedData.fcp, unit: 'ms' },
              { label: 'LCP', val: analysis.pageSpeedData.lcp, unit: 'ms' },
              { label: 'TBT', val: analysis.pageSpeedData.tbt, unit: 'ms' },
              { label: 'CLS', val: analysis.pageSpeedData.cls !== null ? Number(analysis.pageSpeedData.cls).toFixed(3) : null, unit: '' },
            ].map(({ label, val, unit }) => (
              <div key={label} className="flex justify-between">
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</span>
                <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                  {val !== null ? `${val}${unit}` : '—'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Página principal ──────────────────────────────────────────────────────────

export default function SeoPage() {
  const { user } = useAuth();
  const canEdit = user?.role === UserRole.ADMIN || user?.role === UserRole.SUPER_ADMIN;

  const [history, setHistory] = useState<SeoAnalysis[]>([]);
  const [selected, setSelected] = useState<SeoAnalysis | null>(null);
  const [config, setConfig] = useState<SeoConfig>({ websiteUrl: null, competitorUrls: [] });
  const [canAnalyze, setCanAnalyze] = useState(true);
  const [lastAnalysis, setLastAnalysis] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [toast, setToast] = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [histRes, latestRes, cfgRes] = await Promise.all([
        apiService.getSeoHistory({ limit: 24 }),
        apiService.getSeoLatest(),
        apiService.getSeoConfig(),
      ]);
      if (histRes.success) {
        setHistory(histRes.data);
        if (histRes.data.length > 0 && !selected) {
          setSelected(histRes.data[histRes.data.length - 1]);
        }
      }
      if (latestRes.success) {
        setCanAnalyze(latestRes.meta.canAnalyzeThisMonth);
        setLastAnalysis(latestRes.meta.lastAnalysis);
      }
      if (cfgRes.success) setConfig(cfgRes.data);
    } catch {
      // silencioso — sem URL configurada retorna vazio
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      await apiService.triggerSeoAnalysis();
      showToast('Análise concluída!');
      await load();
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? 'Erro ao executar análise';
      showToast(msg);
    } finally {
      setAnalyzing(false);
    }
  };

  const baseline = history.find(a => a.isBaseline) ?? null;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <svg className="animate-spin h-6 w-6" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="#3b82f6" strokeWidth="4" />
          <path className="opacity-75" fill="#3b82f6" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 px-4 py-2 rounded-lg text-sm shadow-lg" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-primary)' }}>
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>SEO / AIO</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            Diagnóstico de presença digital — performance, SEO técnico e visibilidade para agentes de IA
          </p>
          {lastAnalysis && (
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              Última análise: {fmtDate(lastAnalysis)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {canEdit && (
            <button
              onClick={() => setShowConfig(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors"
              style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-default)', color: 'var(--text-secondary)' }}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Configurar URLs
            </button>
          )}
          {canEdit && config.websiteUrl && (
            <button
              onClick={handleAnalyze}
              disabled={analyzing || !canAnalyze}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
              style={{
                backgroundColor: canAnalyze ? 'var(--accent)' : 'var(--bg-elevated)',
                color: canAnalyze ? '#fff' : 'var(--text-muted)',
                opacity: analyzing ? 0.7 : 1,
                border: canAnalyze ? 'none' : '1px solid var(--border-default)',
                cursor: !canAnalyze ? 'not-allowed' : 'pointer',
              }}
              title={!canAnalyze ? 'Análise já realizada neste mês' : undefined}
            >
              {analyzing ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Analisando...
                </>
              ) : (
                <>
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                  </svg>
                  {!canAnalyze ? 'Analisado este mês' : 'Analisar agora'}
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Estado vazio — sem URL configurada */}
      {!config.websiteUrl && (
        <div className="rounded-2xl p-10 text-center space-y-3" style={card}>
          <div className="flex justify-center">
            <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1} style={{ color: 'var(--text-muted)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0H3" />
            </svg>
          </div>
          <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>Diagnóstico não configurado</p>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Configure a URL do seu site para iniciar o diagnóstico automático de SEO e presença para agentes de IA.
          </p>
          {canEdit && (
            <button
              onClick={() => setShowConfig(true)}
              className="mt-2 px-4 py-2 rounded-lg text-sm font-medium"
              style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
            >
              Configurar agora
            </button>
          )}
        </div>
      )}

      {/* Estado vazio — URL configurada mas sem análises */}
      {config.websiteUrl && history.length === 0 && (
        <div className="rounded-2xl p-10 text-center space-y-3" style={card}>
          <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>Nenhuma análise ainda</p>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Site configurado: <span style={{ color: '#60a5fa' }}>{config.websiteUrl}</span>
            <br />A primeira análise (baseline) é gerada automaticamente. Ou clique em "Analisar agora".
          </p>
        </div>
      )}

      {/* Layout principal — histórico + detalhe */}
      {history.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Coluna esquerda — linha do tempo */}
          <div className="space-y-2">
            <p className="text-xs font-semibold px-1" style={{ color: 'var(--text-muted)' }}>HISTÓRICO ({history.length})</p>
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {history.map((a) => (
                <SnapshotCard
                  key={a.id}
                  analysis={a}
                  isSelected={selected?.id === a.id}
                  onClick={() => setSelected(a)}
                />
              ))}
            </div>
          </div>

          {/* Coluna direita — detalhe */}
          <div className="lg:col-span-2 rounded-2xl p-5" style={card}>
            {selected ? (
              <SnapshotDetail analysis={selected} baseline={baseline} />
            ) : (
              <p className="text-sm text-center py-10" style={{ color: 'var(--text-muted)' }}>
                Selecione um snapshot para ver o detalhe
              </p>
            )}
          </div>
        </div>
      )}

      {/* Evolução dos scores — mini gráfico de linha com barras */}
      {history.length > 1 && (
        <div className="rounded-2xl p-5 space-y-4" style={card}>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Evolução dos scores</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ color: 'var(--text-muted)' }}>
                  <th className="text-left pb-2 font-medium">Data</th>
                  <th className="text-center pb-2 font-medium">Geral</th>
                  <th className="text-center pb-2 font-medium">Performance</th>
                  <th className="text-center pb-2 font-medium">SEO</th>
                  <th className="text-center pb-2 font-medium">AIO</th>
                </tr>
              </thead>
              <tbody>
                {history.map((a, i) => {
                  const prev = i > 0 ? history[i - 1] : null;
                  const arrow = (cur: number | null, p: number | null) => {
                    if (cur === null || p === null) return null;
                    if (cur > p) return <span style={{ color: '#22c55e' }}>↑</span>;
                    if (cur < p) return <span style={{ color: '#ef4444' }}>↓</span>;
                    return null;
                  };
                  return (
                    <tr
                      key={a.id}
                      className="cursor-pointer transition-colors"
                      style={{ borderTop: '1px solid var(--border-subtle)', color: selected?.id === a.id ? '#60a5fa' : 'var(--text-secondary)' }}
                      onClick={() => setSelected(a)}
                    >
                      <td className="py-1.5">
                        {fmtDate(a.analyzedAt)}
                        {a.isBaseline && <span className="ml-1 text-[10px] opacity-60">(base)</span>}
                      </td>
                      <td className="text-center py-1.5">{a.overallScore ?? '—'} {arrow(a.overallScore, prev?.overallScore ?? null)}</td>
                      <td className="text-center py-1.5">{a.pageSpeedScore ?? '—'} {arrow(a.pageSpeedScore, prev?.pageSpeedScore ?? null)}</td>
                      <td className="text-center py-1.5">{a.seoScore ?? '—'} {arrow(a.seoScore, prev?.seoScore ?? null)}</td>
                      <td className="text-center py-1.5">{a.aioScore ?? '—'} {arrow(a.aioScore, prev?.aioScore ?? null)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showConfig && (
        <ConfigModal
          config={config}
          onClose={() => setShowConfig(false)}
          onSaved={() => { load(); showToast('URLs salvas! Análise baseline iniciada em background.'); }}
        />
      )}
    </div>
  );
}
