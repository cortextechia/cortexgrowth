'use client';

import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';
import type { AiAnalysis, AgentOutput } from '@/types';

const scoreColor = (s: number) => (s >= 75 ? '#22c55e' : s >= 50 ? '#f59e0b' : '#ef4444');

const styles = StyleSheet.create({
  page: {
    backgroundColor: '#080d19',
    paddingHorizontal: 40,
    paddingVertical: 36,
    fontFamily: 'Helvetica',
  },

  // ── Header ──────────────────────────────────────────
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  logoBlock: { flexDirection: 'column' },
  logoMain: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#f1f5f9' },
  logoAccent: { fontSize: 16, fontFamily: 'Helvetica-Bold', color: '#3b82f6' },
  logoTagline: { fontSize: 8, color: '#475569', marginTop: 2 },
  headerRight: { alignItems: 'flex-end' },
  headerLabel: { fontSize: 8, color: '#475569' },
  headerValue: { fontSize: 9, color: '#94a3b8', marginTop: 1 },

  divider: { height: 1, backgroundColor: '#1e293b', marginBottom: 20 },

  // ── Score hero ───────────────────────────────────────
  scoreHero: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0f1629',
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
  },
  scoreDisk: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#131d35',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    borderWidth: 2,
  },
  scoreNumber: { fontSize: 24, fontFamily: 'Helvetica-Bold' },
  scoreInfo: { flex: 1 },
  scoreTitle: { fontSize: 13, fontFamily: 'Helvetica-Bold', color: '#f1f5f9', marginBottom: 4 },
  scorePeriod: { fontSize: 9, color: '#475569', marginBottom: 8 },
  miniChips: { flexDirection: 'row', gap: 8 },
  miniChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#131d35',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    gap: 4,
  },
  miniChipLabel: { fontSize: 8, color: '#64748b' },
  miniChipScore: { fontSize: 8, fontFamily: 'Helvetica-Bold' },

  // ── Section title ────────────────────────────────────
  sectionTitle: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: '#475569',
    marginBottom: 6,
  },

  // ── Executive summary ────────────────────────────────
  summaryBox: {
    backgroundColor: '#0f1629',
    borderRadius: 8,
    padding: 12,
    marginBottom: 14,
    borderLeftWidth: 2,
    borderLeftColor: '#3b82f6',
    borderLeftStyle: 'solid',
  },
  summaryText: { fontSize: 9, color: '#94a3b8', lineHeight: 1.6 },

  // ── Two-column grid ──────────────────────────────────
  twoCol: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  alertsBox: {
    flex: 1,
    backgroundColor: '#0f1629',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 2,
    borderLeftColor: '#ef4444',
    borderLeftStyle: 'solid',
  },
  recsBox: {
    flex: 1,
    backgroundColor: '#0f1629',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 2,
    borderLeftColor: '#3b82f6',
    borderLeftStyle: 'solid',
  },
  boxTitle: { fontSize: 8, fontFamily: 'Helvetica-Bold', marginBottom: 6 },
  listRow: { flexDirection: 'row', gap: 4, marginBottom: 3 },
  listBullet: { fontSize: 8, width: 8 },
  listText: { fontSize: 8, color: '#94a3b8', flex: 1, lineHeight: 1.5 },

  // ── Agent grid ───────────────────────────────────────
  agentGrid: { flexDirection: 'row', gap: 8 },
  agentBox: {
    flex: 1,
    backgroundColor: '#0f1629',
    borderRadius: 8,
    padding: 10,
  },
  agentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  agentLabel: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#f1f5f9' },
  agentPill: {
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: '#131d35',
  },
  agentPillText: { fontSize: 8, fontFamily: 'Helvetica-Bold' },
  agentSummary: { fontSize: 7.5, color: '#64748b', lineHeight: 1.5, marginBottom: 6 },
  agentSubtitle: { fontSize: 7, fontFamily: 'Helvetica-Bold', marginBottom: 3 },
  agentItem: { flexDirection: 'row', gap: 3, marginBottom: 2 },
  agentBullet: { fontSize: 7, width: 7 },
  agentText: { fontSize: 7, color: '#64748b', flex: 1, lineHeight: 1.4 },

  // ── Footer ───────────────────────────────────────────
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    borderTopStyle: 'solid',
    paddingTop: 6,
  },
  footerText: { fontSize: 7, color: '#334155' },
});

function AgentCard({ label, data }: { label: string; data: AgentOutput }) {
  const color = scoreColor(data.score);
  return (
    <View style={styles.agentBox}>
      <View style={styles.agentHeader}>
        <Text style={styles.agentLabel}>{label}</Text>
        <View style={styles.agentPill}>
          <Text style={[styles.agentPillText, { color }]}>{data.score}</Text>
        </View>
      </View>
      {data.summary ? (
        <Text style={styles.agentSummary}>{data.summary}</Text>
      ) : null}
      {data.alerts.length > 0 && (
        <View style={{ marginBottom: 4 }}>
          <Text style={[styles.agentSubtitle, { color: '#f59e0b' }]}>Alertas</Text>
          {data.alerts.slice(0, 3).map((a, i) => (
            <View key={i} style={styles.agentItem}>
              <Text style={[styles.agentBullet, { color: '#f59e0b' }]}>•</Text>
              <Text style={styles.agentText}>{a}</Text>
            </View>
          ))}
        </View>
      )}
      {data.recommendations.length > 0 && (
        <View>
          <Text style={[styles.agentSubtitle, { color: '#3b82f6' }]}>Recomendações</Text>
          {data.recommendations.slice(0, 3).map((r, i) => (
            <View key={i} style={styles.agentItem}>
              <Text style={[styles.agentBullet, { color: '#3b82f6' }]}>→</Text>
              <Text style={styles.agentText}>{r}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

interface Props {
  report: AiAnalysis;
}

export function ReportPdfDocument({ report }: Props) {
  const { content, period, createdAt } = report;
  const orch = content.orchestrator;
  const overall = orch?.overallScore ?? 0;
  const overallColor = scoreColor(overall);

  const dateLabel = new Date(createdAt).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  const generatedAt = new Date(createdAt).toLocaleString('pt-BR');

  return (
    <Document>
      <Page size="A4" style={styles.page}>

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoBlock}>
            <Text>
              <Text style={styles.logoMain}>CÓRTEX </Text>
              <Text style={styles.logoAccent}>GROWTH</Text>
            </Text>
            <Text style={styles.logoTagline}>Plataforma de Analytics para Agências</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.headerLabel}>RELATÓRIO DE PERFORMANCE</Text>
            <Text style={styles.headerValue}>Período: {period}</Text>
            <Text style={styles.headerValue}>{dateLabel}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Score hero */}
        <View style={styles.scoreHero}>
          <View style={[styles.scoreDisk, { borderColor: overallColor }]}>
            <Text style={[styles.scoreNumber, { color: overallColor }]}>{overall}</Text>
          </View>
          <View style={styles.scoreInfo}>
            <Text style={styles.scoreTitle}>Score Geral de Performance</Text>
            <Text style={styles.scorePeriod}>Gerado em {generatedAt}</Text>
            <View style={styles.miniChips}>
              {content.marketing && (
                <View style={styles.miniChip}>
                  <Text style={styles.miniChipLabel}>Marketing</Text>
                  <Text style={[styles.miniChipScore, { color: scoreColor(content.marketing.score) }]}>
                    {content.marketing.score}
                  </Text>
                </View>
              )}
              {content.sales && (
                <View style={styles.miniChip}>
                  <Text style={styles.miniChipLabel}>Vendas</Text>
                  <Text style={[styles.miniChipScore, { color: scoreColor(content.sales.score) }]}>
                    {content.sales.score}
                  </Text>
                </View>
              )}
              {content.roas && (
                <View style={styles.miniChip}>
                  <Text style={styles.miniChipLabel}>ROAS</Text>
                  <Text style={[styles.miniChipScore, { color: scoreColor(content.roas.score) }]}>
                    {content.roas.score}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Executive Summary */}
        {orch?.executiveSummary && (
          <View style={{ marginBottom: 4 }}>
            <Text style={styles.sectionTitle}>RESUMO EXECUTIVO</Text>
            <View style={styles.summaryBox}>
              <Text style={styles.summaryText}>{orch.executiveSummary}</Text>
            </View>
          </View>
        )}

        {/* Priority alerts + top recommendations */}
        {((orch?.priorityAlerts?.length ?? 0) > 0 || (orch?.topRecommendations?.length ?? 0) > 0) && (
          <View style={styles.twoCol}>
            {(orch?.priorityAlerts?.length ?? 0) > 0 && (
              <View style={styles.alertsBox}>
                <Text style={[styles.boxTitle, { color: '#ef4444' }]}>ALERTAS PRIORITÁRIOS</Text>
                {orch!.priorityAlerts.map((a, i) => (
                  <View key={i} style={styles.listRow}>
                    <Text style={[styles.listBullet, { color: '#ef4444' }]}>!</Text>
                    <Text style={styles.listText}>{a}</Text>
                  </View>
                ))}
              </View>
            )}
            {(orch?.topRecommendations?.length ?? 0) > 0 && (
              <View style={styles.recsBox}>
                <Text style={[styles.boxTitle, { color: '#60a5fa' }]}>TOP RECOMENDAÇÕES</Text>
                {orch!.topRecommendations.map((r, i) => (
                  <View key={i} style={styles.listRow}>
                    <Text style={[styles.listBullet, { color: '#60a5fa' }]}>{i + 1}.</Text>
                    <Text style={styles.listText}>{r}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Agent breakdown */}
        {(content.marketing || content.sales || content.roas) && (
          <View>
            <Text style={[styles.sectionTitle, { marginBottom: 8 }]}>ANÁLISE POR AGENTE</Text>
            <View style={styles.agentGrid}>
              {content.marketing && <AgentCard label="Marketing" data={content.marketing} />}
              {content.sales && <AgentCard label="Vendas" data={content.sales} />}
              {content.roas && <AgentCard label="ROAS" data={content.roas} />}
            </View>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Córtex Growth — cortexgrowth.com.br</Text>
          <Text style={styles.footerText}>Gerado automaticamente por IA · {generatedAt}</Text>
        </View>

      </Page>
    </Document>
  );
}