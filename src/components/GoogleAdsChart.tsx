'use client';

import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts';

interface GoogleAdsMetric {
  id: string;
  campaignName: string;
  cost: number;
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

export default function GoogleAdsChart({ data }: { data: GoogleAdsMetric[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 rounded-xl" style={SURFACE}>
        <p className="text-sm" style={{ color: '#475569' }}>Nenhum dado disponível</p>
      </div>
    );
  }

  const chartData = data.map((metric) => ({
    name: metric.campaignName.substring(0, 15),
    cost: parseFloat(String(metric.cost)),
    impressions: metric.impressions,
    clicks: metric.clicks,
  }));

  const dailyMap: Record<string, { date: string; cost: number; impressions: number; clicks: number }> = {};
  data.forEach((metric) => {
    const date = new Date(metric.date).toLocaleDateString('pt-BR');
    if (!dailyMap[date]) dailyMap[date] = { date, cost: 0, impressions: 0, clicks: 0 };
    dailyMap[date].cost += parseFloat(String(metric.cost));
    dailyMap[date].impressions += metric.impressions;
    dailyMap[date].clicks += metric.clicks;
  });
  const dailyData = Object.values(dailyMap);

  const totalCost = chartData.reduce((s, i) => s + i.cost, 0);
  const totalClicks = chartData.reduce((s, i) => s + i.clicks, 0);
  const cpc = totalClicks > 0 ? totalCost / totalClicks : 0;

  return (
    <div className="space-y-6">
      {/* Metric cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard title="Custo Total" value={`$${totalCost.toFixed(2)}`} />
        <MetricCard title="Total Cliques" value={totalClicks.toLocaleString()} />
        <MetricCard title="CPC Médio" value={`$${cpc.toFixed(2)}`} />
      </div>

      {/* Custo por campanha */}
      <ChartCard title="Custo por Campanha">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData} barCategoryGap="30%">
            <CartesianGrid {...GRID_PROPS} />
            <XAxis dataKey="name" angle={-30} textAnchor="end" height={60} {...AXIS_PROPS} />
            <YAxis {...AXIS_PROPS} />
            <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(255,255,255,0.03)' }} formatter={(v) => [`$${Number(v).toFixed(2)}`, 'Custo']} />
            <Bar dataKey="cost" fill="#60a5fa" radius={[4, 4, 0, 0]} activeBar={{ fill: '#93c5fd', stroke: 'none' }} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Cliques por campanha */}
      <ChartCard title="Cliques por Campanha">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={chartData} barCategoryGap="30%">
            <CartesianGrid {...GRID_PROPS} />
            <XAxis dataKey="name" angle={-30} textAnchor="end" height={60} {...AXIS_PROPS} />
            <YAxis {...AXIS_PROPS} />
            <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ fill: 'rgba(255,255,255,0.03)' }} formatter={(v) => [Number(v).toLocaleString(), 'Cliques']} />
            <Legend wrapperStyle={{ color: '#64748b', fontSize: 12 }} />
            <Bar dataKey="clicks" name="Cliques" fill="#3b82f6" radius={[4, 4, 0, 0]} activeBar={{ fill: '#2563eb', stroke: 'none' }} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Custo ao longo do tempo */}
      <ChartCard title="Custo ao Longo do Tempo">
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={dailyData}>
            <CartesianGrid {...GRID_PROPS} />
            <XAxis dataKey="date" {...AXIS_PROPS} />
            <YAxis {...AXIS_PROPS} />
            <Tooltip contentStyle={TOOLTIP_STYLE} cursor={{ stroke: 'rgba(255,255,255,0.08)', strokeWidth: 1 }} formatter={(v) => [`$${Number(v).toFixed(2)}`, 'Custo']} />
            <Line type="monotone" dataKey="cost" stroke="#60a5fa" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#60a5fa' }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}