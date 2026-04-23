'use client';

import {
  BarChart, Bar, PieChart, Pie,
  XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts';

interface ConsolidatedChartProps {
  metaInsights: { campaignName: string; spend: number; impressions: number; clicks: number }[];
  googleAdsMetrics: { campaignName: string; cost: number; impressions: number; clicks: number }[];
}

const SURFACE = { backgroundColor: '#0f1629', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px' };
const TOOLTIP_STYLE = { backgroundColor: '#0f1629', border: '1px solid rgba(255,255,255,0.10)', borderRadius: '8px', color: '#f1f5f9', fontSize: 12 };
const AXIS_PROPS = { tick: { fill: '#475569', fontSize: 11 }, axisLine: false, tickLine: false };
const GRID_PROPS = { strokeDasharray: '3 3', stroke: 'rgba(255,255,255,0.04)', vertical: false };

const PLATFORM_COLORS = { meta: '#3b82f6', google: '#60a5fa' };

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-6" style={SURFACE}>
      <h3 className="text-sm font-medium uppercase tracking-wider mb-5" style={{ color: '#475569' }}>{title}</h3>
      {children}
    </div>
  );
}

function SummaryCard({ title, value, highlight = false }: { title: string; value: string; highlight?: boolean }) {
  return (
    <div
      className="rounded-xl p-5"
      style={
        highlight
          ? { backgroundColor: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.20)', borderRadius: '12px' }
          : SURFACE
      }
    >
      <p className="text-xs font-medium uppercase tracking-wider" style={{ color: '#475569' }}>{title}</p>
      <p className="mt-2 text-2xl font-semibold" style={{ color: '#f1f5f9' }}>{value}</p>
    </div>
  );
}

export default function ConsolidatedChart({ metaInsights, googleAdsMetrics }: ConsolidatedChartProps) {
  const metaTotals = {
    spend: metaInsights.reduce((s, i) => s + (i.spend || 0), 0),
    impressions: metaInsights.reduce((s, i) => s + (i.impressions || 0), 0),
    clicks: metaInsights.reduce((s, i) => s + (i.clicks || 0), 0),
  };
  const googleTotals = {
    cost: googleAdsMetrics.reduce((s, i) => s + (i.cost || 0), 0),
    impressions: googleAdsMetrics.reduce((s, i) => s + (i.impressions || 0), 0),
    clicks: googleAdsMetrics.reduce((s, i) => s + (i.clicks || 0), 0),
  };

  const totalSpend = metaTotals.spend + googleTotals.cost;
  const totalImpressions = metaTotals.impressions + googleTotals.impressions;
  const totalClicks = metaTotals.clicks + googleTotals.clicks;
  const cpc = totalClicks > 0 ? totalSpend / totalClicks : 0;

  const comparisonData = [
    { plataforma: 'Meta Ads',    gasto: parseFloat(metaTotals.spend.toFixed(2)),       cliques: metaTotals.clicks,    impressoes: metaTotals.impressions },
    { plataforma: 'Google Ads',  gasto: parseFloat(googleTotals.cost.toFixed(2)),       cliques: googleTotals.clicks,  impressoes: googleTotals.impressions },
  ];

  const pieData = comparisonData
    .map((p, i) => ({ name: p.plataforma, value: p.gasto, fill: i === 0 ? PLATFORM_COLORS.meta : PLATFORM_COLORS.google }))
    .filter((p) => p.value > 0);

  const allCampaigns = [
    ...metaInsights.map((i) => ({ nome: i.campaignName.substring(0, 15), impressoes: i.impressions, cliques: i.clicks, tipo: 'Meta' })),
    ...googleAdsMetrics.map((i) => ({ nome: i.campaignName.substring(0, 15), impressoes: i.impressions, cliques: i.clicks, tipo: 'Google' })),
  ];

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard title="Gasto Total" value={`$${totalSpend.toFixed(2)}`} highlight />
        <SummaryCard title="Impressões" value={totalImpressions.toLocaleString()} />
        <SummaryCard title="Cliques" value={totalClicks.toLocaleString()} />
        <SummaryCard title="CPC Médio" value={`$${cpc.toFixed(2)}`} />
      </div>

      {/* Comparação por plataforma */}
      <ChartCard title="Gasto e Cliques por Plataforma">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={comparisonData} barCategoryGap="40%">
            <CartesianGrid {...GRID_PROPS} />
            <XAxis dataKey="plataforma" {...AXIS_PROPS} />
            <YAxis yAxisId="left" {...AXIS_PROPS} />
            <YAxis yAxisId="right" orientation="right" {...AXIS_PROPS} />
            <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
            <Legend wrapperStyle={{ color: '#64748b', fontSize: 12 }} />
            <Bar yAxisId="left"  dataKey="gasto"   name="Gasto ($)"  fill={PLATFORM_COLORS.meta}   radius={[4, 4, 0, 0]} activeBar={{ fill: '#2563eb', stroke: 'none' }} />
            <Bar yAxisId="right" dataKey="cliques"  name="Cliques"    fill={PLATFORM_COLORS.google} radius={[4, 4, 0, 0]} activeBar={{ fill: '#93c5fd', stroke: 'none' }} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Distribuição + tabela comparativa */}
      {pieData.length > 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartCard title="Distribuição de Gasto">
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  innerRadius={50}
                  dataKey="value"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                >
                </Pie>
                <Tooltip contentStyle={TOOLTIP_STYLE} formatter={(v) => [`$${Number(v).toFixed(2)}`]} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Métricas por Plataforma">
            <div className="space-y-3">
              {comparisonData.map((platform, i) => (
                <div
                  key={platform.plataforma}
                  className="rounded-lg p-4"
                  style={{ backgroundColor: '#162036', border: '1px solid rgba(255,255,255,0.06)' }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: i === 0 ? PLATFORM_COLORS.meta : PLATFORM_COLORS.google }} />
                      <h4 className="text-sm font-medium" style={{ color: '#e2e8f0' }}>{platform.plataforma}</h4>
                    </div>
                    <span
                      className="text-xs font-medium px-2 py-0.5 rounded"
                      style={{ backgroundColor: 'rgba(255,255,255,0.06)', color: '#94a3b8' }}
                    >
                      {totalSpend > 0 ? ((platform.gasto / totalSpend) * 100).toFixed(0) : 0}% do orçamento
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: 'Gasto', val: `$${platform.gasto.toFixed(2)}` },
                      { label: 'Cliques', val: platform.cliques.toLocaleString() },
                      { label: 'Impressões', val: `${(platform.impressoes / 1000).toFixed(0)}K` },
                    ].map(({ label, val }) => (
                      <div key={label} className="rounded p-2" style={{ backgroundColor: 'rgba(255,255,255,0.03)' }}>
                        <p className="text-xs" style={{ color: '#475569' }}>{label}</p>
                        <p className="text-sm font-semibold mt-0.5" style={{ color: '#f1f5f9' }}>{val}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 flex gap-4 text-xs" style={{ color: '#475569' }}>
                    <span>CPM: ${platform.impressoes > 0 ? ((platform.gasto / platform.impressoes) * 1000).toFixed(2) : '—'}</span>
                    <span>CPC: ${platform.cliques > 0 ? (platform.gasto / platform.cliques).toFixed(2) : '—'}</span>
                  </div>
                </div>
              ))}
            </div>
          </ChartCard>
        </div>
      )}

      {/* Todas as campanhas */}
      {allCampaigns.length > 0 && (
        <ChartCard title="Impressões vs Cliques — Todas as Campanhas">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={allCampaigns} barCategoryGap="30%">
              <CartesianGrid {...GRID_PROPS} />
              <XAxis dataKey="nome" angle={-30} textAnchor="end" height={60} {...AXIS_PROPS} />
              <YAxis {...AXIS_PROPS} />
              <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(255,255,255,0.03)' }} formatter={(v) => [Number(v).toLocaleString()]} />
              <Legend wrapperStyle={{ color: '#64748b', fontSize: 12 }} />
              <Bar dataKey="impressoes" name="Impressões" fill={PLATFORM_COLORS.meta}   radius={[4, 4, 0, 0]} activeBar={{ fill: '#2563eb', stroke: 'none' }} />
              <Bar dataKey="cliques"    name="Cliques"    fill={PLATFORM_COLORS.google} radius={[4, 4, 0, 0]} activeBar={{ fill: '#93c5fd', stroke: 'none' }} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
    </div>
  );
}