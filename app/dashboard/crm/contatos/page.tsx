'use client';

// CRM · Contatos — a lista completa da carteira, movida pra fora da página do
// funil (que ficava longa demais). Só tabela + busca + filtros; clicar num
// contato abre o card no funil via deep-link (/dashboard/crm?client=<id>), sem
// duplicar o drawer. Visível só para orgs sem Kommo (o menu já esconde).

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiService } from '@/lib/api';
import type { CrmClientSummary, CrmOrigin, CrmTagOption, CrmStatus } from '@/types';

// ── Helpers locais (espelham os do CRM; mantidos aqui para não acoplar esta
//    página à do funil, que tem 4k+ linhas) ──────────────────────────────────
const ORIGIN_OPTIONS: { key: CrmOrigin; label: string }[] = [
  { key: 'META',      label: 'Meta Ads' },
  { key: 'GOOGLE',    label: 'Google Ads' },
  { key: 'WHATSAPP',  label: 'WhatsApp' },
  { key: 'INDICACAO', label: 'Indicação' },
  { key: 'FACHADA',   label: 'Fachada da loja' },
  { key: 'ORGANICO',  label: 'Orgânico' },
  { key: 'OUTRO',     label: 'Outro' },
];
const originLabel = (o: CrmOrigin) => ORIGIN_OPTIONS.find((x) => x.key === o)?.label ?? o;

function fmtMoney(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function fmtPhone(p: string): string {
  const d = p.startsWith('55') ? p.slice(2) : p;
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return p;
}
function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0] ?? '').join('').toUpperCase();
}
// Não lida = mensagem recebida depois da última abertura (ISO-8601, comparação lexicográfica)
function hasUnread(c: { lastInboundAt: string | null; lastReadAt: string | null }): boolean {
  return !!c.lastInboundAt && (!c.lastReadAt || c.lastInboundAt > c.lastReadAt);
}
function startOfToday(): number {
  const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime();
}
function followUpTone(iso: string): { color: string; label: string } {
  const t = new Date(iso).getTime();
  const today = startOfToday();
  const label = new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  if (t < today) return { color: 'var(--badge-error-text)', label };
  if (t < today + 86_400_000) return { color: 'var(--badge-warn-text)', label };
  return { color: 'var(--text-muted)', label };
}

function Avatar({ url, name }: { url: string | null; name: string }) {
  // Rastreia qual URL falhou (em vez de resetar via effect quando `url` muda):
  // URL assinada do WhatsApp pode expirar → cai nas iniciais sem setState-in-effect.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  if (url && failedUrl !== url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" onError={() => setFailedUrl(url)} className="w-5 h-5 text-[9px] rounded-full object-cover shrink-0" />;
  }
  return (
    <div
      className="w-5 h-5 text-[9px] rounded-full flex items-center justify-center font-bold shrink-0"
      style={{ backgroundColor: 'var(--accent-dim)', color: 'var(--accent)' }}
      aria-hidden
    >
      {initials(name)}
    </div>
  );
}

const card = { backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' };
const input = {
  backgroundColor: 'var(--bg-elevated)',
  border: '1px solid var(--border-md)',
  color: 'var(--text-primary)',
} as const;

const PAGE = 100;

export default function CrmContatosPage() {
  const router = useRouter();
  const [status, setStatus] = useState<CrmStatus | null>(null);
  const [clients, setClients] = useState<CrmClientSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [tags, setTags] = useState<CrmTagOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [search, setSearch] = useState('');

  // Filtros client-side sobre o que já foi carregado
  const [fUnread, setFUnread] = useState(false);
  const [fResponsible, setFResponsible] = useState('');
  const [fTag, setFTag] = useState('');
  const [fOrigin, setFOrigin] = useState('');
  const [fClientType, setFClientType] = useState('');
  const [fSale, setFSale] = useState('');

  const load = useCallback(async (searchTerm?: string) => {
    setLoading(true);
    try {
      const [st, cl, tg] = await Promise.all([
        apiService.getCrmStatus(),
        apiService.getCrmClients({ take: PAGE, ...(searchTerm ? { search: searchTerm } : {}) }),
        apiService.getCrmTags().catch(() => ({ data: [] as CrmTagOption[] })),
      ]);
      setStatus(st.data);
      setClients(cl.data.clients);
      setTotal(cl.data.total);
      setTags(tg.data);
    } finally {
      setLoading(false);
    }
  }, []);

  // Única fonte de carga: dispara no mount (search vazio) e a cada digitação (debounce)
  useEffect(() => {
    const t = setTimeout(() => load(search.trim() || undefined), 350);
    return () => clearTimeout(t);
  }, [search, load]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const res = await apiService.getCrmClients({
        take: PAGE,
        skip: clients.length,
        ...(search.trim() ? { search: search.trim() } : {}),
      });
      setClients((prev) => [...prev, ...res.data.clients]);
      setTotal(res.data.total);
    } finally {
      setLoadingMore(false);
    }
  };

  const openClient = (id: string) => router.push(`/dashboard/crm?client=${id}`);

  // ── Estados de página ──
  if (loading && clients.length === 0) {
    return (
      <div className="flex items-center justify-center py-24">
        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Carregando contatos...</span>
      </div>
    );
  }

  if (status && !status.enabled) {
    return (
      <div className="max-w-lg mx-auto mt-16 rounded-xl p-8 text-center" style={card}>
        <h1 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Contatos do CRM</h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {status.kommoConnected
            ? 'Esta organização usa o Kommo como CRM. O CRM Cortex não está ativo aqui.'
            : 'Ative o CRM Cortex na página do funil para começar a cadastrar contatos.'}
        </p>
      </div>
    );
  }

  // Opções de filtro derivadas da lista carregada
  const responsibleOptions = [...new Map(
    clients.filter((c) => c.responsible).map((c) => [c.responsible!.id, c.responsible!.name])
  ).entries()];
  const clientTypeOptions = [...new Set(clients.map((c) => c.clientType).filter(Boolean) as string[])];

  const filtered = clients.filter((c) =>
    (!fUnread || hasUnread(c)) &&
    (!fResponsible || c.responsibleId === fResponsible || (fResponsible === '_none' && !c.responsibleId)) &&
    (!fTag || c.tags.includes(fTag)) &&
    (!fOrigin || c.origin === fOrigin) &&
    (!fClientType || c.clientType === fClientType) &&
    (!fSale ||
      (fSale === 'won' && c.sales.some((s) => s.status === 'WON')) ||
      (fSale === 'lost' && c.sales.some((s) => s.status === 'LOST')))
  );
  const hasActiveFilter = fUnread || !!fResponsible || !!fTag || !!fOrigin || !!fClientType || !!fSale;
  const unreadCount = clients.filter(hasUnread).length;
  const clearFilters = () => { setFUnread(false); setFResponsible(''); setFTag(''); setFOrigin(''); setFClientType(''); setFSale(''); };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex-1 min-w-[200px]">
          <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>Contatos</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {total} cliente{total === 1 ? '' : 's'} na carteira · mostrando {clients.length}
          </p>
        </div>
        <a
          href="/dashboard/crm"
          className="px-3 py-2 rounded-lg text-sm font-medium shrink-0"
          style={{ ...card, color: 'var(--text-secondary)' }}
        >
          ← Funil
        </a>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome ou telefone..."
          className="rounded-lg px-3 py-2 text-sm w-64"
          style={input}
        />
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button
          onClick={() => setFUnread((v) => !v)}
          className="rounded-lg px-3 py-1.5 text-sm"
          style={fUnread
            ? { backgroundColor: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid var(--accent)' }
            : { ...input }}
        >
          Não respondidos{unreadCount > 0 ? ` (${unreadCount})` : ''}
        </button>
        {responsibleOptions.length > 0 && (
          <select value={fResponsible} onChange={(e) => setFResponsible(e.target.value)} className="rounded-lg px-2.5 py-1.5 text-sm" style={input}>
            <option value="">Responsável: todos</option>
            <option value="_none">Sem responsável</option>
            {responsibleOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        )}
        {tags.length > 0 && (
          <select value={fTag} onChange={(e) => setFTag(e.target.value)} className="rounded-lg px-2.5 py-1.5 text-sm" style={input}>
            <option value="">Tag: todas</option>
            {tags.map((t) => <option key={t.id} value={t.label}>{t.label}</option>)}
          </select>
        )}
        <select value={fOrigin} onChange={(e) => setFOrigin(e.target.value)} className="rounded-lg px-2.5 py-1.5 text-sm" style={input}>
          <option value="">Origem: todas</option>
          {ORIGIN_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
        {clientTypeOptions.length > 0 && (
          <select value={fClientType} onChange={(e) => setFClientType(e.target.value)} className="rounded-lg px-2.5 py-1.5 text-sm" style={input}>
            <option value="">Tipo: todos</option>
            {clientTypeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
        <select value={fSale} onChange={(e) => setFSale(e.target.value)} className="rounded-lg px-2.5 py-1.5 text-sm" style={input}>
          <option value="">Venda: todas</option>
          <option value="won">Com venda ganha</option>
          <option value="lost">Com venda perdida</option>
        </select>
        {hasActiveFilter && (
          <button onClick={clearFilters} className="text-xs px-2 py-1.5" style={{ color: 'var(--text-muted)' }}>
            ✕ limpar ({filtered.length} de {clients.length})
          </button>
        )}
      </div>

      <div className="rounded-xl p-4" style={card}>
        {filtered.length === 0 ? (
          <p className="text-sm py-6 text-center" style={{ color: 'var(--text-muted)' }}>
            {hasActiveFilter || search.trim() ? 'Nenhum contato com esses filtros.' : 'Nenhum contato ainda.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ color: 'var(--text-muted)' }}>
                  <th className="text-left font-medium py-2 pr-4">Cliente</th>
                  <th className="text-left font-medium py-2 pr-4">Telefone</th>
                  <th className="text-left font-medium py-2 pr-4">Origem</th>
                  <th className="text-left font-medium py-2 pr-4">Responsável</th>
                  <th className="text-left font-medium py-2 pr-4">Follow-up</th>
                  <th className="text-right font-medium py-2 pr-4">Em aberto</th>
                  <th className="text-right font-medium py-2">LTV</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => openClient(c.id)}
                    className="cursor-pointer"
                    style={{ borderTop: '1px solid var(--border)' }}
                  >
                    <td className="py-2.5 pr-4 font-medium" style={{ color: 'var(--text-primary)' }}>
                      <span className="inline-flex items-center gap-1.5">
                        <Avatar url={c.waAvatarUrl} name={c.name} />
                        {c.name}
                        {hasUnread(c) && <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: '#22c55e' }} title="Mensagem não respondida" />}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4" style={{ color: 'var(--text-secondary)' }}>{fmtPhone(c.phone)}</td>
                    <td className="py-2.5 pr-4">
                      <span className="text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                        {originLabel(c.origin)}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4" style={{ color: 'var(--text-muted)' }}>{c.responsible?.name ?? '—'}</td>
                    <td className="py-2.5 pr-4">
                      {c.nextFollowUpAt
                        ? (() => { const t = followUpTone(c.nextFollowUpAt); return <span className="text-xs font-medium whitespace-nowrap" style={{ color: t.color }}>📅 {t.label}</span>; })()
                        : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td className="py-2.5 pr-4 text-right" style={{ color: 'var(--text-secondary)' }}>{c.openSales}</td>
                    <td className="py-2.5 text-right font-semibold" style={{ color: c.ltv > 0 ? 'var(--badge-success-text)' : 'var(--text-muted)' }}>
                      {fmtMoney(c.ltv)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginação: o endpoint entrega no máx 100 por vez */}
        {clients.length < total && !hasActiveFilter && (
          <div className="mt-4 text-center">
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60"
              style={{ ...input }}
            >
              {loadingMore ? 'Carregando...' : `Carregar mais (${clients.length} de ${total})`}
            </button>
          </div>
        )}
        {clients.length < total && hasActiveFilter && (
          <p className="mt-3 text-xs text-center" style={{ color: 'var(--text-muted)' }}>
            Filtrando só os {clients.length} contatos carregados. Limpe os filtros para carregar o restante.
          </p>
        )}
      </div>
    </div>
  );
}
