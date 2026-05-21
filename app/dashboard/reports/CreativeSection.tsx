'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiService } from '@/lib/api';
import {
  CreativeAnalysis, FatigueCampaign, CreativeIdeasOutput,
  CreativeBriefingOutput, CopyOutput, CompetitiveOutput, CreativeProfile,
} from '@/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
    </svg>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs px-2 py-0.5 rounded-md" style={{ backgroundColor: 'rgba(168,85,247,0.07)', color: '#9d71cc', border: '1px solid rgba(168,85,247,0.12)' }}>
      {children}
    </span>
  );
}

function AgentCard({ icon, name, children }: { icon: React.ReactNode; name: string; children: React.ReactNode }) {
  return (
    <div className="relative rounded-xl overflow-hidden flex flex-col" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid rgba(168,85,247,0.12)' }}>
      <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at top left, rgba(168,85,247,0.04) 0%, transparent 65%)' }} />
      <div className="relative p-5 flex flex-col gap-4 flex-1">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.2)' }}>
            {icon}
          </div>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{name}</p>
        </div>
        {children}
      </div>
    </div>
  );
}

function RunButton({ onClick, loading, label }: { onClick: () => void; loading: boolean; label: string }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-medium transition-opacity disabled:opacity-60"
      style={{ backgroundColor: 'rgba(168,85,247,0.12)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.2)' }}
    >
      {loading ? <Spinner /> : null}
      {loading ? 'Processando…' : label}
    </button>
  );
}

function ErrorMsg({ msg }: { msg: string }) {
  return <p className="text-xs rounded-lg p-2.5" style={{ backgroundColor: 'rgba(239,68,68,0.06)', color: '#f87171', border: '1px solid rgba(239,68,68,0.15)' }}>{msg}</p>;
}

function CampaignInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder ?? 'Nome da campanha…'}
      className="w-full rounded-lg px-3 py-2 text-xs outline-none"
      style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
    />
  );
}

// ─── Análise Criativa ─────────────────────────────────────────────────────────

function AnaliseCard({ showToast }: { showToast: (m: string, t: 'ok' | 'err') => void }) {
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<CreativeAnalysis | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    apiService.getLatestCreativeAnalysis().then((r) => { if (r.data) setAnalysis(r.data); }).catch(() => {});
  }, []);

  const run = async () => {
    setLoading(true); setError('');
    try {
      await apiService.runCreativeAnalysis(90);
      const r = await apiService.getLatestCreativeAnalysis();
      if (r.data) { setAnalysis(r.data); setExpanded(true); }
      showToast('Análise criativa concluída!', 'ok');
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? 'Erro ao rodar análise';
      setError(msg); showToast(msg, 'err');
    } finally { setLoading(false); }
  };

  const dateLabel = analysis ? new Date(analysis.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : null;

  return (
    <AgentCard name="Análise Criativa" icon={
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="#c084fc" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    }>
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        Cruza 90 dias de Meta Ads com o Kommo para identificar quais padrões criativos convertem nesta conta.
      </p>
      {dateLabel && (
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Última análise: <span style={{ color: '#c084fc' }}>{dateLabel}</span></p>
      )}
      {error && <ErrorMsg msg={error} />}
      <RunButton onClick={run} loading={loading} label="Analisar padrões (90 dias)" />
      {analysis && (
        <button onClick={() => setExpanded(v => !v)} className="text-xs text-left" style={{ color: '#9d71cc' }}>
          {expanded ? '▲ Ocultar resultado' : '▼ Ver resultado'}
        </button>
      )}
      {expanded && analysis && (
        <div className="space-y-3 pt-1">
          <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{analysis.patterns.summary}</p>
          {analysis.patterns.highPerformance.length > 0 && (
            <div>
              <p className="text-xs font-medium mb-1.5" style={{ color: '#22c55e' }}>Alta performance</p>
              <div className="space-y-2">
                {analysis.patterns.highPerformance.slice(0, 3).map((p, i) => (
                  <div key={i} className="rounded-lg p-2.5 text-xs" style={{ backgroundColor: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.12)' }}>
                    <p className="font-medium mb-0.5" style={{ color: 'var(--text-primary)' }}>{p.pattern}</p>
                    <p style={{ color: 'var(--text-muted)' }}>{p.metrics}</p>
                    <p className="mt-1 italic" style={{ color: 'var(--text-muted)' }}>{p.hypothesis}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {analysis.patterns.creativeRecommendations.length > 0 && (
            <div>
              <p className="text-xs font-medium mb-1.5" style={{ color: '#60a5fa' }}>Recomendações</p>
              <ul className="space-y-1">
                {analysis.patterns.creativeRecommendations.map((r, i) => (
                  <li key={i} className="text-xs flex gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                    <span style={{ color: '#60a5fa' }}>→</span>{r}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </AgentCard>
  );
}

// ─── Geração de Ideias ────────────────────────────────────────────────────────

function IdeiasCard({ showToast }: { showToast: (m: string, t: 'ok' | 'err') => void }) {
  const [loading, setLoading] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [campaign, setCampaign] = useState('');
  const [fatigued, setFatigued] = useState<FatigueCampaign[]>([]);
  const [result, setResult] = useState<CreativeIdeasOutput | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState('');

  const detect = async () => {
    setDetecting(true); setError('');
    try {
      const r = await apiService.getCreativeFatigue();
      setFatigued(r.data);
      if (r.data.length === 0) showToast('Nenhuma campanha em fadiga detectada', 'ok');
    } catch { setError('Erro ao detectar fadiga'); }
    finally { setDetecting(false); }
  };

  const run = async () => {
    if (!campaign.trim()) { setError('Informe o nome da campanha'); return; }
    setLoading(true); setError('');
    try {
      const r = await apiService.generateCreativeIdeas(campaign.trim());
      setResult(r.data.ideas); setExpanded(true);
      showToast(`${r.data.ideas.ideas.length} ideias geradas!`, 'ok');
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? 'Erro ao gerar ideias';
      setError(msg); showToast(msg, 'err');
    } finally { setLoading(false); }
  };

  return (
    <AgentCard name="Geração de Ideias" icon={
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="#c084fc" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    }>
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Detecta fadiga de CTR e gera 10+ ângulos criativos com hooks prontos para usar.</p>
      <button onClick={detect} disabled={detecting} className="flex items-center gap-1.5 text-xs" style={{ color: '#9d71cc' }}>
        {detecting ? <Spinner /> : null}{detecting ? 'Detectando…' : '⚡ Detectar campanhas em fadiga'}
      </button>
      {fatigued.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {fatigued.map(c => (
            <button key={c.name} onClick={() => setCampaign(c.name)}
              className="text-xs px-2 py-1 rounded-lg transition-colors"
              style={{ backgroundColor: campaign === c.name ? 'rgba(168,85,247,0.2)' : 'rgba(239,68,68,0.07)', color: campaign === c.name ? '#c084fc' : '#f87171', border: `1px solid ${campaign === c.name ? 'rgba(168,85,247,0.3)' : 'rgba(239,68,68,0.15)'}` }}
            >
              {c.name.length > 28 ? c.name.slice(0, 28) + '…' : c.name} <span className="opacity-60">−{c.dropPct}%</span>
            </button>
          ))}
        </div>
      )}
      <CampaignInput value={campaign} onChange={setCampaign} />
      {error && <ErrorMsg msg={error} />}
      <RunButton onClick={run} loading={loading} label="Gerar ideias de ângulo" />
      {result && (
        <button onClick={() => setExpanded(v => !v)} className="text-xs text-left" style={{ color: '#9d71cc' }}>
          {expanded ? '▲ Ocultar ideias' : `▼ Ver ${result.ideas.length} ideias`}
        </button>
      )}
      {expanded && result && (
        <div className="space-y-2 pt-1">
          {result.ideas.map((idea, i) => (
            <div key={i} className="rounded-lg p-3 text-xs" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold" style={{ color: '#c084fc' }}>{i + 1}. {idea.angle}</span>
                <Tag>{idea.format}</Tag>
              </div>
              <p className="italic mb-1" style={{ color: 'var(--text-primary)' }}>"{idea.hook}"</p>
              <p style={{ color: 'var(--text-muted)' }}>{idea.rationale}</p>
            </div>
          ))}
          {result.testingRecommendation && (
            <p className="text-xs p-2.5 rounded-lg" style={{ backgroundColor: 'rgba(59,130,246,0.05)', color: 'var(--text-secondary)', border: '1px solid rgba(59,130,246,0.1)' }}>
              💡 {result.testingRecommendation}
            </p>
          )}
        </div>
      )}
    </AgentCard>
  );
}

// ─── Briefing Automatizado ────────────────────────────────────────────────────

function BriefingCard({ showToast }: { showToast: (m: string, t: 'ok' | 'err') => void }) {
  const [loading, setLoading] = useState(false);
  const [campaign, setCampaign] = useState('');
  const [result, setResult] = useState<CreativeBriefingOutput | null>(null);
  const [briefingId, setBriefingId] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState('');

  const run = async () => {
    if (!campaign.trim()) { setError('Informe o nome da campanha'); return; }
    setLoading(true); setError('');
    try {
      const r = await apiService.generateCreativeBriefing(campaign.trim());
      setResult(r.data.briefing as CreativeBriefingOutput);
      setBriefingId(r.data.briefingId);
      setExpanded(true);
      showToast('Briefing gerado!', 'ok');
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? 'Erro ao gerar briefing';
      setError(msg); showToast(msg, 'err');
    } finally { setLoading(false); }
  };

  return (
    <AgentCard name="Briefing Automatizado" icon={
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="#c084fc" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    }>
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Gera briefing completo: público, ângulo, formato, copy e critérios de sucesso.</p>
      <CampaignInput value={campaign} onChange={setCampaign} />
      {error && <ErrorMsg msg={error} />}
      <RunButton onClick={run} loading={loading} label="Gerar briefing" />
      {result && (
        <>
          <button onClick={() => setExpanded(v => !v)} className="text-xs text-left" style={{ color: '#9d71cc' }}>
            {expanded ? '▲ Ocultar briefing' : '▼ Ver briefing completo'}
          </button>
          {briefingId && (
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>ID: <code className="text-xs" style={{ color: '#9d71cc' }}>{briefingId}</code> — use no agente de Copy</p>
          )}
        </>
      )}
      {expanded && result && (
        <div className="space-y-3 pt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
          <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
            <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Objetivo</p>
            <p>{result.objective}</p>
          </div>
          <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
            <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Público-alvo</p>
            <p className="mb-1">{result.targetAudience?.profile}</p>
            {result.targetAudience?.painPoints?.length > 0 && (
              <ul className="space-y-0.5 mt-1">
                {result.targetAudience.painPoints.map((p, i) => <li key={i} className="flex gap-1.5"><span style={{ color: '#f59e0b' }}>•</span>{p}</li>)}
              </ul>
            )}
          </div>
          <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
            <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Ângulo criativo</p>
            <p className="font-medium mb-0.5" style={{ color: '#c084fc' }}>{result.creativeAngle?.main}</p>
            <p className="mb-1">{result.creativeAngle?.conversionHypothesis}</p>
            <p style={{ color: 'var(--text-muted)' }}>{result.creativeAngle?.rationale}</p>
          </div>
          <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
            <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Formato</p>
            <div className="flex items-center gap-2 mb-1">
              <Tag>{result.format?.recommended}</Tag>
              {result.format?.duration && <Tag>{result.format.duration}s</Tag>}
              {result.format?.aspectRatio && <Tag>{result.format.aspectRatio}</Tag>}
            </div>
            {result.format?.structure?.length > 0 && (
              <ol className="space-y-0.5 mt-1 list-decimal list-inside" style={{ color: 'var(--text-muted)' }}>
                {result.format.structure.map((s, i) => <li key={i}>{s}</li>)}
              </ol>
            )}
          </div>
          <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
            <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Copy</p>
            <p className="font-bold text-sm mb-0.5" style={{ color: 'var(--text-primary)' }}>{result.copy?.headline}</p>
            {result.copy?.subheadline && <p className="mb-1 italic" style={{ color: 'var(--text-muted)' }}>{result.copy.subheadline}</p>}
            {result.copy?.bodyPoints?.map((p, i) => <p key={i} className="flex gap-1.5"><span style={{ color: '#60a5fa' }}>→</span>{p}</p>)}
            <p className="mt-1 font-medium" style={{ color: '#22c55e' }}>CTA: {result.copy?.cta}</p>
          </div>
          <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
            <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Métricas de sucesso</p>
            <p><span style={{ color: 'var(--text-muted)' }}>KPI:</span> {result.successMetrics?.primaryKPI}</p>
            <p><span style={{ color: 'var(--text-muted)' }}>Corte:</span> {result.successMetrics?.cutCriteria}</p>
          </div>
        </div>
      )}
    </AgentCard>
  );
}

// ─── Copy & Variações ─────────────────────────────────────────────────────────

function CopyCard({ showToast }: { showToast: (m: string, t: 'ok' | 'err') => void }) {
  const [loading, setLoading] = useState(false);
  const [campaign, setCampaign] = useState('');
  const [briefingId, setBriefingId] = useState('');
  const [result, setResult] = useState<CopyOutput | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState('');

  const run = async () => {
    if (!campaign.trim()) { setError('Informe o nome da campanha'); return; }
    setLoading(true); setError('');
    try {
      const r = await apiService.generateCopy(campaign.trim(), briefingId.trim() || undefined);
      setResult(r.data.copy as CopyOutput); setExpanded(true);
      showToast('3 variações de copy geradas!', 'ok');
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? 'Erro ao gerar copy';
      setError(msg); showToast(msg, 'err');
    } finally { setLoading(false); }
  };

  const VARIATION_COLORS: Record<string, string> = { A: '#3b82f6', B: '#a855f7', C: '#22c55e' };

  return (
    <AgentCard name="Copy & Variações" icon={
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="#c084fc" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    }>
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Gera 3 variações A/B de headline, body copy e CTA com ângulos distintos.</p>
      <CampaignInput value={campaign} onChange={setCampaign} />
      <input
        type="text" value={briefingId} onChange={(e) => setBriefingId(e.target.value)}
        placeholder="ID do briefing (opcional — melhora a qualidade)"
        className="w-full rounded-lg px-3 py-2 text-xs outline-none"
        style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
      />
      {error && <ErrorMsg msg={error} />}
      <RunButton onClick={run} loading={loading} label="Gerar copy A/B" />
      {result && (
        <button onClick={() => setExpanded(v => !v)} className="text-xs text-left" style={{ color: '#9d71cc' }}>
          {expanded ? '▲ Ocultar variações' : '▼ Ver 3 variações'}
        </button>
      )}
      {expanded && result && (
        <div className="space-y-3 pt-1">
          {result.variations?.map((v) => {
            const color = VARIATION_COLORS[v.id] ?? '#c084fc';
            return (
              <div key={v.id} className="rounded-lg p-3 text-xs" style={{ backgroundColor: 'var(--bg-elevated)', border: `1px solid ${color}22` }}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-bold text-sm" style={{ color }}>Variação {v.id}</span>
                  <Tag>{v.angle}</Tag>
                </div>
                <p className="font-bold mb-1" style={{ color: 'var(--text-primary)' }}>{v.headline}</p>
                <p className="leading-relaxed mb-2 whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>{v.primaryText}</p>
                {v.description && <p className="mb-1 italic" style={{ color: 'var(--text-muted)' }}>{v.description}</p>}
                <p className="font-medium" style={{ color }}>{v.cta}</p>
                {v.copyNotes && <p className="mt-1.5 pt-1.5 italic" style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}>{v.copyNotes}</p>}
              </div>
            );
          })}
          {result.testingGuidance && (
            <div className="rounded-lg p-3 text-xs" style={{ backgroundColor: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.1)' }}>
              <p className="font-medium mb-1" style={{ color: '#60a5fa' }}>Guia de teste A/B</p>
              <p style={{ color: 'var(--text-secondary)' }}>Métrica: {result.testingGuidance.primaryMetric}</p>
              <p style={{ color: 'var(--text-secondary)' }}>Corte: {result.testingGuidance.cutCriteria}</p>
              <p style={{ color: 'var(--text-secondary)' }}>{result.testingGuidance.rotationSetup}</p>
            </div>
          )}
        </div>
      )}
    </AgentCard>
  );
}

// ─── Inteligência Competitiva ─────────────────────────────────────────────────

function CompetitiveCard({ profile, showToast }: { profile: CreativeProfile | null; showToast: (m: string, t: 'ok' | 'err') => void }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CompetitiveOutput | null>(null);
  const [weekOf, setWeekOf] = useState('');
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    apiService.getLatestCompetitiveInsight().then((r) => {
      if (r.data) { setResult(r.data.adsData as CompetitiveOutput); setWeekOf(r.data.weekOf); }
    }).catch(() => {});
  }, []);

  const run = async () => {
    setLoading(true); setError('');
    try {
      const r = await apiService.runCompetitiveAnalysis();
      setResult(r.data.data); setExpanded(true);
      showToast('Análise competitiva concluída!', 'ok');
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? 'Erro na análise competitiva';
      setError(msg); showToast(msg, 'err');
    } finally { setLoading(false); }
  };

  const hasCompetitors = profile && profile.competitorPageIds.length > 0;

  return (
    <AgentCard name="Inteligência Competitiva" icon={
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="#c084fc" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    }>
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Monitora anúncios ativos dos concorrentes via Meta Ad Library e identifica gaps de posicionamento.</p>
      {!hasCompetitors && (
        <p className="text-xs rounded-lg p-2.5" style={{ backgroundColor: 'rgba(245,158,11,0.06)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.15)' }}>
          Configure os concorrentes na seção de configuração acima para usar este agente.
        </p>
      )}
      {weekOf && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Semana de: <span style={{ color: '#c084fc' }}>{new Date(weekOf).toLocaleDateString('pt-BR')}</span></p>}
      {error && <ErrorMsg msg={error} />}
      <RunButton onClick={run} loading={loading} label="Analisar concorrentes" />
      {result && (
        <button onClick={() => setExpanded(v => !v)} className="text-xs text-left" style={{ color: '#9d71cc' }}>
          {expanded ? '▲ Ocultar análise' : '▼ Ver análise competitiva'}
        </button>
      )}
      {expanded && result && (
        <div className="space-y-3 pt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
          {result.weeklyHighlight && (
            <p className="rounded-lg p-2.5 leading-relaxed" style={{ backgroundColor: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.12)', color: 'var(--text-primary)' }}>
              💡 {result.weeklyHighlight}
            </p>
          )}
          {result.positioningGaps?.length > 0 && (
            <div>
              <p className="font-medium mb-1.5" style={{ color: '#22c55e' }}>Gaps de posicionamento</p>
              <div className="space-y-2">
                {result.positioningGaps.map((g, i) => (
                  <div key={i} className="rounded-lg p-2.5" style={{ backgroundColor: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.12)' }}>
                    <p className="font-medium mb-0.5" style={{ color: 'var(--text-primary)' }}>{g.gap}</p>
                    <p style={{ color: 'var(--text-muted)' }}>{g.opportunity}</p>
                    <Tag>{g.priority}</Tag>
                  </div>
                ))}
              </div>
            </div>
          )}
          {result.competitors?.map((c, i) => (
            <div key={i} className="rounded-lg p-3" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
              <div className="flex items-center gap-2 mb-1.5">
                <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{c.name}</p>
                <Tag>{c.estimatedActivity}</Tag>
                <span style={{ color: 'var(--text-muted)' }}>{c.totalAdsFound} anúncios</span>
              </div>
              {c.dominantAngles?.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-1">
                  {c.dominantAngles.map((a, j) => <Tag key={j}>{a}</Tag>)}
                </div>
              )}
              {c.weakness && <p className="italic" style={{ color: 'var(--text-muted)' }}>Fraqueza: {c.weakness}</p>}
            </div>
          ))}
        </div>
      )}
    </AgentCard>
  );
}

// ─── Config Panel ─────────────────────────────────────────────────────────────

function ConfigPanel({ profile, onSave }: { profile: CreativeProfile | null; onSave: (p: CreativeProfile) => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [desc, setDesc] = useState(profile?.productDescription ?? '');
  const [competitors, setCompetitors] = useState((profile?.competitorPageIds ?? []).join('\n'));

  useEffect(() => {
    setDesc(profile?.productDescription ?? '');
    setCompetitors((profile?.competitorPageIds ?? []).join('\n'));
  }, [profile]);

  const save = async () => {
    setSaving(true);
    try {
      const ids = competitors.split('\n').map(s => s.trim()).filter(Boolean).slice(0, 5);
      const r = await apiService.updateCreativeProfile({ productDescription: desc.trim() || undefined, competitorPageIds: ids });
      onSave(r.data);
      setOpen(false);
    } catch { /* silent */ }
    finally { setSaving(false); }
  };

  return (
    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid rgba(168,85,247,0.12)' }}>
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center justify-between px-5 py-3.5 text-left">
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="#9d71cc" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Configuração dos agentes</span>
          {profile?.productDescription && <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: 'rgba(34,197,94,0.1)', color: '#22c55e' }}>configurado</span>}
        </div>
        <svg className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} style={{ color: 'var(--text-muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && (
        <div className="px-5 pb-5 space-y-3" style={{ borderTop: '1px solid var(--border)' }}>
          <div className="pt-3">
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Produto / Serviço</label>
            <textarea
              value={desc} onChange={(e) => setDesc(e.target.value)}
              placeholder="Descreva brevemente o produto ou serviço desta conta (ex: 'Escritório de contabilidade para MEI e pequenas empresas em São Paulo')…"
              rows={2}
              className="w-full rounded-lg px-3 py-2 text-xs outline-none resize-none"
              style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
              maxLength={500}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              Concorrentes — Meta Ad Library (um por linha, máx 5)
            </label>
            <textarea
              value={competitors} onChange={(e) => setCompetitors(e.target.value)}
              placeholder={'Concorrente A\nConcorrente B\nConcorrente C'}
              rows={3}
              className="w-full rounded-lg px-3 py-2 text-xs outline-none resize-none font-mono"
              style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
            />
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Use o nome da marca ou página do Facebook. A Meta Ad Library vai buscar anúncios ativos.</p>
          </div>
          <button
            onClick={save} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium disabled:opacity-60"
            style={{ backgroundColor: 'rgba(168,85,247,0.15)', color: '#c084fc', border: '1px solid rgba(168,85,247,0.25)' }}
          >
            {saving ? <Spinner /> : null}{saving ? 'Salvando…' : 'Salvar configuração'}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Seção principal exportada ────────────────────────────────────────────────

export function CreativeSection({ showToast }: { showToast: (m: string, t: 'ok' | 'err') => void }) {
  const [profile, setProfile] = useState<CreativeProfile | null>(null);

  useEffect(() => {
    apiService.getCreativeProfile().then((r) => setProfile(r.data)).catch(() => {});
  }, []);

  return (
    <div className="space-y-4">
      {/* Banner explicativo */}
      <div className="relative rounded-2xl p-5 overflow-hidden" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid rgba(168,85,247,0.15)' }}>
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'radial-gradient(ellipse at top right, rgba(168,85,247,0.08) 0%, transparent 60%)' }} />
        <div className="relative flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(168,85,247,0.12)', border: '1px solid rgba(168,85,247,0.25)' }}>
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="#c084fc" strokeWidth={1.7}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.098 19.902a3.75 3.75 0 005.304 0l6.401-6.402M6.75 21A3.75 3.75 0 013 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 003.75-3.75V8.197M6.75 21h13.125c.621 0 1.125-.504 1.125-1.125v-5.25c0-.621-.504-1.125-1.125-1.125h-4.072M10.5 8.197l2.88-2.88c.438-.439 1.15-.439 1.59 0l3.712 3.713c.44.44.44 1.152 0 1.59l-2.879 2.88M6.75 17.25h.008v.008H6.75v-.008z" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold mb-0.5" style={{ color: 'var(--text-primary)' }}>Agentes de criação baseados em performance</p>
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
              Usa os dados reais da conta para gerar briefings, copy e ideias de criativo. Comece pela Análise Criativa — ela é a base que melhora todos os outros agentes.
            </p>
          </div>
        </div>
      </div>

      {/* Config */}
      <ConfigPanel profile={profile} onSave={setProfile} />

      {/* Grid de agentes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <AnaliseCard showToast={showToast} />
        <IdeiasCard showToast={showToast} />
        <BriefingCard showToast={showToast} />
        <CopyCard showToast={showToast} />
        <div className="sm:col-span-2">
          <CompetitiveCard profile={profile} showToast={showToast} />
        </div>
      </div>
    </div>
  );
}
