'use client';

import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts';

interface MetaInsight {
  id: string;
  campaignName: string;
  spend: number;
  impressions: number;
  clicks: number;
  date: string;
}

const SURFACE = { backgroundColor: '#0f1629', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '12px' };
const TOOLTIP_STYLE = { backgroundColor: '#0f1629', border: '1px solid rgba(255,255,255,0.10)', borderRadius: '8px', color: '#f1f5f9', fontSize: 12 };
const AXIS_PROPS = { tick: { fill: '#475569', fontSize: 11 }, axisLine: false, tickLine: false };
const GRID_PROPS = { strokeDasharray: '3 3', stroke: 'rgba(255,255,255,0.04)', vertical: false };

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="p-6" style={SURFACE}>
      <h3 className="text-sm font-medium uppercase tracking-wider mb-5" style={{ color: '#475569' }}>{title}</h3>
      {children}
    </div>
  );
}

function MetricCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-xl p-5" style={SURFACE}>
      <p className="text-xs font-medium uppercase tracking-wider" style={{ color: '#475569' }}>{title}</p>
      <p className="mt-2 text-2xl font-semibold" style={{ color: '#f1f5f9' }}>{value}</p>
    </div>
  );
}

export default function MetaAdsChart({ data }: { data: MetaInsight[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 rounded-xl" style={SURFACE}>
        <p className="text-sm" style={{ color: '#475569' }}>Nenhum dado disponível</p>
      </div>
    );
  }

  const chartData = data.map((insight) => ({
    name: insight.campaignName.substring(0, 15),
    spend: parseFloat(String(insight.spend)),
    impressions: insight.impressions,
    clicks: insight.clicks,
  }));

  const dailyMap: Record<string, { date: string; spend: number; impressions: number; clicks: number }> = {};
  data.forEach((insight) => {
    const date = new Date(insight.date).toLocaleDateString('pt-BR');
    if (!dailyMap[date]) dailyMap[date] = { date, spend: 0, impressions: 0, clicks: 0 };
    dailyMap[date].spend += parseFloat(String(insight.spend));
    dailyMap[date].impressions += insight.impressions;
    dailyMap[date].clicks += insight.clicks;
  });
  const dailyData = Object.values(dailyMap);

  const totalSpend = chartData.reduce((s, i) => s + i.spend, 0);
  const totalImpressions = chartData.reduce((s, i) => s + i.impressions, 0);
  const totalClicks = chartData.reduce((s, i) => s + i.clicks, 0);
  const cpm = totalImpressions > 0 ? (totalSpend / totalImpressions) * 1000 : 0;

  return (
    <div className="space-y-6">
      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Gasto Total" value={`$${totalSpend.toFixed(2)}`} />
        <MetricCard title="Impressões" value={totalImpressions.toLocaleString()} />
        <MetricCard title="Cliques" value={totalClicks.toLocaleString()} />
        <MetricCard title="CPM Médio" value={`$${cpm.toFixed(2)}`} />
      </div>

      {/* Gasto por campanha */}
      <ChartCard title="Gasto por Campanha">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData} barCategoryGap="30%">
            <CartesianGrid {...GRID_PROPS} />
            <XAxis dataKey="name" angle={-30} textAnchor="end" height={60} {...AXIS_PROPS} />
            <YAxis {...AXIS_PROPS} />
            <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(255,255,255,0.03)' }} formatter={(v) => [`$${Number(v).toFixed(2)}`, 'Gasto']} />
            <Bar dataKey="spend" fill="#3b82f6" radius={[4, 4, 0, 0]} activeBar={{ fill: '#2563eb', stroke: 'none' }} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Impressões vs Cliques */}
      <ChartCard title="Impressões vs Cliques por Campanha">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData} barCategoryGap="30%">
            <CartesianGrid {...GRID_PROPS} />
            <XAxis dataKey="name" angle={-30} textAnchor="end" height={60} {...AXIS_PROPS} />
            <YAxis {...AXIS_PROPS} />
            <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(255,255,255,0.03)' }} formatter={(v) => [Number(v).toLocaleString()]} />
            <Legend wrapperStyle={{ color: '#64748b', fontSize: 12 }} />
            <Bar dataKey="impressions" name="Impressões" fill="#1e40af" radius={[4, 4, 0, 0]} activeBar={{ fill: '#1e3a8a', stroke: 'none' }} />
            <Bar dataKey="clicks" name="Cliques" fill="#60a5fa" radius={[4, 4, 0, 0]} activeBar={{ fill: '#93c5fd', stroke: 'none' }} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Gasto ao longo do tempo */}
      <ChartCard title="Gasto ao Longo do Tempo">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={dailyData}>
            <CartesianGrid {...GRID_PROPS} />
            <XAxis dataKey="date" {...AXIS_PROPS} />
            <YAxis {...AXIS_PROPS} />
            <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ stroke: 'rgba(255,255,255,0.08)', strokeWidth: 1 }} formatter={(v) => [`$${Number(v).toFixed(2)}`, 'Gasto']} />
            <Line type="monotone" dataKey="spend" stroke="#3b82f6" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#3b82f6' }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}