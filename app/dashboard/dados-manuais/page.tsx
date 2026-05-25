'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiService } from '@/lib/api';
import type { ManualRevenuePeriod, ManualRevenueSource } from '@/types';

// ─── Constantes ───────────────────────────────────────────────────────────────

const SOURCES: { key: ManualRevenueSource; label: string; color: string }[] = [
  { key: 'META',    label: 'Meta Ads',    color: '#1877F2' },
  { key: 'GOOGLE',  label: 'Google Ads',  color: '#EA4335' },
  { key: 'ORGANIC', label: 'Orgânico',    color: '#22c55e' },
  { key: 'DIRECT',  label: 'Direto',      color: '#a855f7' },
  { key: 'OTHER',   label: 'Outro',       color: '#64748b' },
];

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

type EntryDraft = { leads: string; sales: string; revenue: string; spend: string };
type EntriesMap = Record<ManualRevenueSource, EntryDraft>;

function emptyEntries(): EntriesMap {
  return {
    META:    { leads: '', sales: '', revenue: '', spend: '' },
    GOOGLE:  { leads: '', sales: '', revenue: '', spend: '' },
    ORGANIC: { leads: '', sales: '', revenue: '', spend: '' },
    DIRECT:  { leads: '', sales: '', revenue: '', spend: '' },
    OTHER:   { leads: '', sales: '', revenue: '', spend: '' },
  };
}

function fmtMoney(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function parseFloat2(s: string): number {
  return parseFloat(s.replace(',', '.')) || 0;
}

const card = { backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' };

// ─── Componente principal ─────────────────────────────────────────────────────

export default function DadosManuaisPage() {
  const router = useRouter();
  const now = new Date();

  const [periods, setPeriods] = useState<ManualRevenuePeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Formulário
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [isIncomplete, setIsIncomplete] = useState(false);
  const [notes, setNotes] = useState('');
  const [entries, setEntries] = useState<EntriesMap>(emptyEntries());

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  const loadPeriods = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiService.getManualRevenuePeriods();
      if (res.success) setPeriods(res.data);
    } catch {
      showToast('error', 'Erro ao carregar períodos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPeriods(); }, [loadPeriods]);

  // Ao mudar mês/ano, pré-preenche com dados existentes
  useEffect(() => {
    const existing = periods.find(
      (p) => p.month === selectedMonth && p.year === selectedYear
    );
    if (existing) {
      setIsIncomplete(existing.isIncomplete);
      setNotes(existing.notes ?? '');
      const draft = emptyEntries();
      for (const e of existing.entries) {
        draft[e.source as ManualRevenueSource] = {
          leads: e.leads > 0 ? String(e.leads) : '',
          sales: e.sales > 0 ? String(e.sales) : '',
          revenue: e.revenue > 0 ? e.revenue.toFixed(2).replace('.', ',') : '',
          spend: e.spend > 0 ? e.spend.toFixed(2).replace('.', ',') : '',
        };
      }
      setEntries(draft);
    } else {
      setIsIncomplete(false);
      setNotes('');
      setEntries(emptyEntries());
    }
  }, [selectedMonth, selectedYear, periods]);

  const handleEntryChange = (
    source: ManualRevenueSource,
    field: keyof EntryDraft,
    value: string
  ) => {
    setEntries((prev) => ({
      ...prev,
      [source]: { ...prev[source], [field]: value },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = SOURCES.map(({ key }) => ({
        source: key,
        leads: parseInt(entries[key].leads) || 0,
        sales: parseInt(entries[key].sales) || 0,
        revenue: parseFloat2(entries[key].revenue),
        spend: parseFloat2(entries[key].spend),
      })).filter((e) => e.leads > 0 || e.sales > 0 || e.revenue > 0 || e.spend > 0);

      if (payload.length === 0) {
        showToast('error', 'Preencha pelo menos um campo antes de salvar.');
        return;
      }

      await apiService.saveManualRevenuePeriod({
        month: selectedMonth,
        year: selectedYear,
        isIncomplete,
        notes: notes.trim() || undefined,
        entries: payload,
      });
      showToast('success', 'Dados salvos com sucesso!');
      await loadPeriods();
    } catch {
      showToast('error', 'Erro ao salvar dados.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (year: number, month: number) => {
    const key = `${year}-${month}`;
    setDeleting(key);
    try {
      await apiService.deleteManualRevenuePeriod(year, month);
      showToast('success', 'Período removido.');
      await loadPeriods();
      // Se deletou o mês selecionado, limpa o formulário
      if (year === selectedYear && month === selectedMonth) {
        setEntries(emptyEntries());
        setIsIncomplete(false);
        setNotes('');
      }
    } catch {
      showToast('error', 'Erro ao remover período.');
    } finally {
      setDeleting(null);
    }
  };

  // Anos disponíveis no seletor
  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - i);
  const existingKeys = new Set(periods.map((p) => `${p.year}-${p.month}`));
  const isEditing = existingKeys.has(`${selectedYear}-${selectedMonth}`);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Toast */}
      {toast && (
        <div
          className="fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-medium shadow-lg"
          style={{
            backgroundColor: toast.type === 'success' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
            color: toast.type === 'success' ? '#4ade80' : '#f87171',
            border: `1px solid ${toast.type === 'success' ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
          }}
        >
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push('/dashboard/integrations')}
          className="p-1.5 rounded-lg transition-colors"
          style={{ color: 'var(--text-muted)', backgroundColor: 'var(--bg-elevated)' }}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
            Dados Manuais de Receita
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Insira seus dados de conversão mensais por canal quando não há CRM conectado.
          </p>
        </div>
      </div>

      {/* Banner de orientação */}
      <div
        className="flex items-start gap-3 p-4 rounded-xl"
        style={{ backgroundColor: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)' }}
      >
        <svg className="h-5 w-5 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="#3b82f6" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
        </svg>
        <div>
          <p className="text-sm font-medium" style={{ color: '#60a5fa' }}>
            Insira pelo menos os últimos 3 meses de dados para análises mais precisas.
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Conecte o Kommo CRM para análise completa de funil com dados por lead. Os dados manuais permitem métricas de ROAS e CAC por canal.
          </p>
        </div>
      </div>

      {/* Formulário de entrada */}
      <div className="rounded-xl p-5 space-y-5" style={card}>
        {/* Seletor de mês/ano */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Mês</label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                className="text-sm rounded-lg px-3 py-1.5 outline-none"
                style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
              >
                {MONTH_NAMES.map((m, i) => (
                  <option key={i + 1} value={i + 1}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Ano</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="text-sm rounded-lg px-3 py-1.5 outline-none"
                style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
              >
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>
          {isEditing && (
            <span
              className="text-xs px-2 py-0.5 rounded-full"
              style={{ backgroundColor: 'rgba(59,130,246,0.1)', color: '#60a5fa' }}
            >
              Editando período existente
            </span>
          )}
        </div>

        {/* Tabela de entrada */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th className="text-left pb-2 pr-4 font-medium" style={{ color: 'var(--text-muted)' }}>Canal</th>
                <th className="text-right pb-2 px-2 font-medium" style={{ color: 'var(--text-muted)' }}>Leads</th>
                <th className="text-right pb-2 px-2 font-medium" style={{ color: 'var(--text-muted)' }}>Vendas</th>
                <th className="text-right pb-2 px-2 font-medium" style={{ color: 'var(--text-muted)' }}>Receita (R$)</th>
                <th className="text-right pb-2 pl-2 font-medium" style={{ color: 'var(--text-muted)' }}>
                  Gasto (R$)
                  <span className="ml-1 text-xs font-normal opacity-60">opcional</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {SOURCES.map(({ key, label, color }) => (
                <tr key={key} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td className="py-2.5 pr-4">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
                    </div>
                  </td>
                  {(['leads', 'sales', 'revenue', 'spend'] as const).map((field) => (
                    <td key={field} className="py-2.5 px-2">
                      <input
                        type="text"
                        inputMode={field === 'revenue' || field === 'spend' ? 'decimal' : 'numeric'}
                        value={entries[key][field]}
                        onChange={(e) => handleEntryChange(key, field, e.target.value)}
                        placeholder="0"
                        className="w-full text-right text-sm rounded-lg px-2 py-1 outline-none"
                        style={{
                          backgroundColor: 'var(--bg-elevated)',
                          color: 'var(--text-primary)',
                          border: '1px solid var(--border)',
                          minWidth: '80px',
                        }}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Checkbox dados incompletos */}
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={isIncomplete}
            onChange={(e) => setIsIncomplete(e.target.checked)}
            className="w-4 h-4 rounded"
            style={{ accentColor: '#f59e0b' }}
          />
          <span className="text-sm" style={{ color: isIncomplete ? '#fbbf24' : 'var(--text-muted)' }}>
            Dados incompletos — este mês tem informações parciais
          </span>
        </label>

        {/* Observações */}
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
            Observações (opcional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="Ex: Google pausado na segunda semana, campanha sazonal de Carnaval..."
            className="w-full text-sm rounded-lg px-3 py-2 outline-none resize-none"
            style={{
              backgroundColor: 'var(--bg-elevated)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)',
            }}
          />
        </div>

        {/* Botão salvar */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 rounded-lg text-sm font-medium transition-opacity"
            style={{ backgroundColor: '#3b82f6', color: '#fff', opacity: saving ? 0.6 : 1 }}
          >
            {saving ? 'Salvando...' : isEditing ? 'Atualizar período' : 'Salvar período'}
          </button>
        </div>
      </div>

      {/* Lista de períodos salvos */}
      <div className="rounded-xl p-5 space-y-3" style={card}>
        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          Histórico inserido
          {periods.length > 0 && (
            <span className="ml-2 text-xs font-normal" style={{ color: 'var(--text-muted)' }}>
              {periods.length} {periods.length === 1 ? 'período' : 'períodos'}
            </span>
          )}
        </p>

        {loading ? (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Carregando...</p>
        ) : periods.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Nenhum período inserido ainda. Preencha o formulário acima.
          </p>
        ) : (
          <div className="space-y-2">
            {periods.map((p) => {
              const totalLeads = p.entries.reduce((s, e) => s + e.leads, 0);
              const totalSales = p.entries.reduce((s, e) => s + e.sales, 0);
              const totalRevenue = p.entries.reduce((s, e) => s + e.revenue, 0);
              const dKey = `${p.year}-${p.month}`;
              const isSelected = p.year === selectedYear && p.month === selectedMonth;

              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl"
                  style={{
                    border: isSelected ? '1px solid rgba(59,130,246,0.4)' : '1px solid var(--border)',
                    backgroundColor: isSelected ? 'rgba(59,130,246,0.05)' : 'transparent',
                  }}
                >
                  <button
                    onClick={() => { setSelectedMonth(p.month); setSelectedYear(p.year); }}
                    className="flex-1 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                        {MONTH_NAMES[p.month - 1]} / {p.year}
                      </span>
                      {p.isIncomplete && (
                        <span
                          className="text-xs px-1.5 py-0.5 rounded"
                          style={{ backgroundColor: 'rgba(245,158,11,0.1)', color: '#fbbf24' }}
                        >
                          Incompleto
                        </span>
                      )}
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {totalLeads} leads · {totalSales} vendas · {fmtMoney(totalRevenue)}
                    </p>
                  </button>
                  <button
                    onClick={() => handleDelete(p.year, p.month)}
                    disabled={deleting === dKey}
                    className="p-1.5 rounded-lg transition-colors"
                    style={{ color: 'var(--text-muted)' }}
                    title="Remover período"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
