'use client';

// CRM Próprio (CRM Cortex) — card = cliente, venda = registro à parte.
// Kanban do funil (vendas abertas) + drawer do cliente (vendas, LTV, histórico).
// Visível apenas para orgs sem Kommo conectado (o layout já esconde o menu;
// esta página também trata o acesso direto por URL).

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { apiService } from '@/lib/api';
import type {
  CrmStatus, CrmStage, CrmSummary, CrmClientSummary, CrmClientDetail,
  CrmSale, CrmOrigin, CrmLostReason, User, CrmWaStatus, CrmWaMessage,
} from '@/types';

// ─── Constantes ───────────────────────────────────────────────────────────────

const ORIGIN_OPTIONS: { key: CrmOrigin; label: string }[] = [
  { key: 'META',      label: 'Meta Ads' },
  { key: 'GOOGLE',    label: 'Google Ads' },
  { key: 'WHATSAPP',  label: 'WhatsApp' },
  { key: 'INDICACAO', label: 'Indicação' },
  { key: 'FACHADA',   label: 'Fachada da loja' },
  { key: 'ORGANICO',  label: 'Orgânico' },
  { key: 'OUTRO',     label: 'Outro' },
];

const LOST_REASON_OPTIONS: { key: CrmLostReason; label: string }[] = [
  { key: 'INATIVIDADE',  label: 'Inatividade (cliente sumiu)' },
  { key: 'PRECO',        label: 'Preço' },
  { key: 'CONCORRENCIA', label: 'Concorrência' },
  { key: 'SEM_RESPOSTA', label: 'Proposta sem resposta' },
  { key: 'DESISTENCIA',  label: 'Desistência' },
  { key: 'OUTRO',        label: 'Outro' },
];

const EVENT_LABELS: Record<string, string> = {
  CLIENT_CREATED: 'Cliente criado',
  SALE_CREATED: 'Venda aberta',
  SALE_UPDATED: 'Venda editada',
  STAGE_CHANGED: 'Mudou de etapa',
  RESPONSIBLE_CHANGED: 'Troca de responsável',
  SALE_WON: 'Venda ganha',
  SALE_LOST: 'Venda perdida',
  SALE_DELETED: 'Venda removida',
};

function fmtMoney(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtPhone(p: string): string {
  // 5585999998888 → (85) 99999-8888
  const d = p.startsWith('55') ? p.slice(2) : p;
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return p;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function originLabel(o: CrmOrigin): string {
  return ORIGIN_OPTIONS.find((x) => x.key === o)?.label ?? o;
}

function initials(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0] ?? '').join('').toUpperCase();
}

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

// Mesmo threshold da regra de cards parados do CRM_HYGIENE (30d)
const STALE_SALE_DAYS = 30;

function OriginPill({ origin }: { origin: CrmOrigin }) {
  return (
    <span
      className="text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}
    >
      {originLabel(origin)}
    </span>
  );
}

function apiErrorMsg(err: unknown, fallback: string): string {
  const anyErr = err as { response?: { data?: { message?: string } } };
  return anyErr?.response?.data?.message ?? fallback;
}

const card = { backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' };
const input = {
  backgroundColor: 'var(--bg-elevated)',
  border: '1px solid var(--border-md)',
  color: 'var(--text-primary)',
} as const;

const ADMIN_ROLES = ['ADMIN', 'SUPER_ADMIN', 'TRAFFIC_MANAGER'];

// ─── Página ───────────────────────────────────────────────────────────────────

export default function CrmPage() {
  const { user } = useAuth();
  const isAdmin = ADMIN_ROLES.includes(user?.role ?? '');

  const [status, setStatus] = useState<CrmStatus | null>(null);
  const [summary, setSummary] = useState<CrmSummary | null>(null);
  const [clients, setClients] = useState<CrmClientSummary[]>([]);
  const [totalClients, setTotalClients] = useState(0);
  const [loading, setLoading] = useState(true);
  const [enabling, setEnabling] = useState(false);
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  // Drawer + modais
  const [detail, setDetail] = useState<CrmClientDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showNewClient, setShowNewClient] = useState(false);
  const [saleModalClient, setSaleModalClient] = useState<CrmClientDetail | null>(null);
  // id+value bastam para os modais de desfecho — permite abrir tanto do drawer quanto do kanban
  const [winSaleTarget, setWinSaleTarget] = useState<Pick<CrmSale, 'id' | 'value'> | null>(null);
  const [loseSaleTarget, setLoseSaleTarget] = useState<Pick<CrmSale, 'id' | 'value'> | null>(null);
  const [showStagesEditor, setShowStagesEditor] = useState(false);
  const [orgUsers, setOrgUsers] = useState<User[]>([]);

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  // Auto-refresh: ids já vistos (p/ avisar card novo) e busca atual (p/ o polling)
  const knownIdsRef = useRef<Set<string> | null>(null);
  const searchRef = useRef('');
  // Anti-corrida do drag and drop: respostas fora de ordem são descartadas e
  // nenhum refresh sobrescreve a lista enquanto um movimento está em andamento
  const reqSeqRef = useRef(0);
  const movingRef = useRef(0);

  const loadAll = useCallback(async (searchTerm?: string, opts?: { force?: boolean }) => {
    const seq = ++reqSeqRef.current;
    try {
      const st = await apiService.getCrmStatus();
      if (!st.success || seq !== reqSeqRef.current) return;
      setStatus(st.data);
      if (!st.data.enabled) { setLoading(false); return; }

      const [sum, cl] = await Promise.all([
        apiService.getCrmSummary(),
        apiService.getCrmClients({ take: 100, ...(searchTerm ? { search: searchTerm } : {}) }),
      ]);
      if (seq !== reqSeqRef.current) return; // resposta velha — chegou outra depois
      if (movingRef.current > 0 && !opts?.force) return; // drag em andamento — preserva o otimista
      if (sum.success) setSummary(sum.data);
      if (cl.success) {
        setClients(cl.data.clients);
        setTotalClients(cl.data.total);
        // Aviso de card novo — só em lista completa (busca filtrada reintroduz ids e geraria falso positivo)
        if (!searchTerm) {
          const ids = new Set(cl.data.clients.map((c) => c.id));
          if (knownIdsRef.current) {
            const novos = cl.data.clients.filter((c) => !knownIdsRef.current!.has(c.id));
            if (novos.length === 1) {
              const n = novos[0]!;
              showToast('success', n.origin === 'WHATSAPP' ? `💬 Novo lead do WhatsApp: ${n.name}` : `Novo cliente: ${n.name}`);
            } else if (novos.length > 1) {
              showToast('success', `${novos.length} novos clientes chegaram.`);
            }
          }
          knownIdsRef.current = ids;
        }
      }
    } catch {
      showToast('error', 'Erro ao carregar o CRM.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Polling leve: cards criados via WhatsApp aparecem sem F5 (e ao voltar o foco)
  useEffect(() => {
    const tick = () => loadAll(searchRef.current.trim() || undefined);
    const interval = setInterval(tick, 15000);
    window.addEventListener('focus', tick);
    return () => { clearInterval(interval); window.removeEventListener('focus', tick); };
  }, [loadAll]);

  // Busca com debounce
  useEffect(() => {
    searchRef.current = search;
    if (!status?.enabled) return;
    const t = setTimeout(() => { loadAll(search.trim() || undefined); }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const openClient = async (clientId: string) => {
    setDetailLoading(true);
    try {
      const res = await apiService.getCrmClient(clientId);
      if (res.success) setDetail(res.data);
    } catch (err) {
      showToast('error', apiErrorMsg(err, 'Erro ao abrir o cliente.'));
    } finally {
      setDetailLoading(false);
    }
  };

  const refreshDetail = async () => {
    // Sem drawer aberto (ação veio do kanban), atualiza só a lista
    if (!detail) { await loadAll(searchRef.current.trim() || undefined); return; }
    await Promise.all([openClient(detail.id), loadAll(searchRef.current.trim() || undefined)]);
  };

  const handleEnable = async () => {
    setEnabling(true);
    try {
      const res = await apiService.enableCrm();
      showToast('success', res.message);
      await loadAll();
    } catch (err) {
      showToast('error', apiErrorMsg(err, 'Não foi possível ativar o CRM.'));
    } finally {
      setEnabling(false);
    }
  };

  const loadUsersOnce = async () => {
    if (orgUsers.length > 0) return;
    try {
      const res = await apiService.getUsers();
      if (res.success) setOrgUsers(res.users);
    } catch { /* transferência fica indisponível, sem quebrar o drawer */ }
  };

  // ─── Drag and drop no kanban ──────────────────────────────────────────

  const [draggingSaleId, setDraggingSaleId] = useState<string | null>(null);
  const [dropStageId, setDropStageId] = useState<string | null>(null);
  const [dropOutcome, setDropOutcome] = useState<'win' | 'lose' | null>(null);
  const justDraggedRef = useRef(false); // evita o click de abrir o drawer logo após soltar

  // Soltar o card em Ganhar/Perder abre o modal de desfecho correspondente
  const handleOutcomeDrop = (kind: 'win' | 'lose', payload: string) => {
    const saleId = payload.split('|')[0];
    setDraggingSaleId(null);
    setDropStageId(null);
    setDropOutcome(null);
    const sale = clients.flatMap((c) => c.sales).find((s) => s.id === saleId);
    if (!sale) return;
    if (kind === 'win') setWinSaleTarget({ id: sale.id, value: sale.value });
    else setLoseSaleTarget({ id: sale.id, value: sale.value });
  };

  const handleDropOnStage = async (stageId: string, saleId: string, fromStageId: string | null) => {
    setDraggingSaleId(null);
    setDropStageId(null);
    if (!saleId || stageId === fromStageId) return;
    // Otimista: move na UI antes da API responder
    setClients((prev) => prev.map((c) => ({
      ...c,
      sales: c.sales.map((s) => (s.id === saleId ? { ...s, stageId } : s)),
    })));
    movingRef.current++;
    try {
      await apiService.changeCrmSaleStage(saleId, stageId);
    } catch (err) {
      showToast('error', apiErrorMsg(err, 'Erro ao mover a venda.'));
    } finally {
      movingRef.current--;
      // Reconcilia só quando o último movimento em voo terminar (drags rápidos em sequência)
      if (movingRef.current === 0) await loadAll(searchRef.current.trim() || undefined, { force: true });
    }
  };

  // ─── Estados de página ───────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Carregando CRM...</span>
      </div>
    );
  }

  // Acesso direto por URL numa org com Kommo
  if (status && !status.enabled && status.kommoConnected) {
    return (
      <div className="max-w-lg mx-auto mt-16 rounded-xl p-8 text-center" style={card}>
        <h1 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>CRM Cortex indisponível</h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Esta organização já usa o <strong>Kommo</strong> como CRM. O CRM Cortex é uma alternativa
          para quem não tem CRM — usar os dois ao mesmo tempo contaria as vendas em dobro.
        </p>
      </div>
    );
  }

  // Não ativado: convite
  if (status && !status.enabled) {
    return (
      <div className="max-w-2xl mx-auto mt-12">
        <div className="rounded-xl p-8" style={card}>
          <span className="text-xs font-bold tracking-widest uppercase" style={{ color: 'var(--accent)' }}>Novo</span>
          <h1 className="text-2xl font-semibold mt-2 mb-3" style={{ color: 'var(--text-primary)' }}>CRM Cortex</h1>
          <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
            Um CRM simples, nativo da plataforma. O card é o <strong>cliente</strong> (identificado pelo
            telefone, sem duplicar) e cada compra vira uma <strong>venda própria</strong> — a recompra nunca
            sobrescreve a anterior, e o valor total do cliente (LTV) é somado automaticamente.
          </p>
          <ul className="text-sm space-y-1.5 mb-6" style={{ color: 'var(--text-muted)' }}>
            <li>✓ Funil configurável para o seu negócio</li>
            <li>✓ Origem de cada venda: Meta, Google, WhatsApp, indicação...</li>
            <li>✓ Vendas aparecem direto no dashboard, na Meta do Mês e nos relatórios</li>
            <li>✓ Cada vendedor vê os próprios clientes; o gestor vê tudo</li>
          </ul>
          {isAdmin ? (
            <button
              onClick={handleEnable}
              disabled={enabling}
              className="px-5 py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-60"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              {enabling ? 'Ativando...' : 'Ativar CRM Cortex'}
            </button>
          ) : (
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Peça a um administrador para ativar o CRM.</p>
          )}
        </div>
        {toast && <Toast toast={toast} />}
      </div>
    );
  }

  if (!status) return null;

  // ─── CRM ativo: board ────────────────────────────────────────────────

  const openSalesByStage = new Map<string, { sale: CrmClientSummary['sales'][number]; client: CrmClientSummary }[]>();
  for (const c of clients) {
    for (const s of c.sales) {
      if (s.status !== 'OPEN') continue;
      const key = s.stageId ?? '_none';
      if (!openSalesByStage.has(key)) openSalesByStage.set(key, []);
      openSalesByStage.get(key)!.push({ sale: s, client: c });
    }
  }
  const noStage = openSalesByStage.get('_none') ?? [];

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="flex-1 min-w-[200px]">
          <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>CRM</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {totalClients} cliente{totalClients === 1 ? '' : 's'}
            {status.maxClients ? ` · limite do plano: ${status.maxClients}` : ''}
            {summary ? ` · pipeline aberto: ${fmtMoney(summary.pipeline.value)} (${summary.pipeline.count})` : ''}
          </p>
        </div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome ou telefone..."
          className="rounded-lg px-3 py-2 text-sm w-56"
          style={input}
        />
        <WhatsappConnectButton showToast={showToast} />
        {isAdmin && (
          <button
            onClick={() => setShowStagesEditor(true)}
            className="px-3 py-2 rounded-lg text-sm"
            style={{ ...card, color: 'var(--text-secondary)' }}
          >
            Editar funil
          </button>
        )}
        <button
          onClick={() => setShowNewClient(true)}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          + Novo cliente
        </button>
      </div>

      {/* Kanban do funil */}
      <div className="flex gap-3 overflow-x-auto pb-3">
        {status.stages.map((stage) => {
          const items = openSalesByStage.get(stage.id) ?? [];
          const total = items.reduce((acc, i) => acc + i.sale.value, 0);
          const isDropTarget = dropStageId === stage.id && draggingSaleId !== null;
          return (
            <div
              key={stage.id}
              className="w-64 shrink-0 rounded-xl p-3 transition-colors"
              style={{
                ...card,
                ...(isDropTarget ? { border: '1px dashed var(--accent)', backgroundColor: 'var(--accent-dim)' } : {}),
              }}
              onDragOver={(e) => { e.preventDefault(); if (dropStageId !== stage.id) setDropStageId(stage.id); }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node) && dropStageId === stage.id) setDropStageId(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                const payload = e.dataTransfer.getData('text/plain');
                const [saleId, fromStageId] = payload.split('|');
                void handleDropOnStage(stage.id, saleId ?? '', fromStageId || null);
              }}
            >
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{stage.name}</span>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{items.length}</span>
              </div>
              <div className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>{fmtMoney(total)}</div>
              <div className="space-y-2">
                {items.map(({ sale, client }) => (
                  <button
                    key={sale.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', `${sale.id}|${sale.stageId ?? ''}`);
                      e.dataTransfer.effectAllowed = 'move';
                      setDraggingSaleId(sale.id);
                    }}
                    onDragEnd={() => {
                      setDraggingSaleId(null);
                      setDropStageId(null);
                      justDraggedRef.current = true;
                      setTimeout(() => { justDraggedRef.current = false; }, 200);
                    }}
                    onClick={() => { if (!justDraggedRef.current) openClient(client.id); }}
                    className="w-full text-left rounded-lg p-2.5 transition-colors cursor-grab active:cursor-grabbing"
                    style={{
                      backgroundColor: 'var(--bg-elevated)',
                      border: '1px solid var(--border)',
                      opacity: draggingSaleId === sale.id ? 0.4 : 1,
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                        style={{ backgroundColor: 'var(--accent-dim)', color: 'var(--accent)' }}
                        aria-hidden
                      >
                        {initials(client.name)}
                      </div>
                      <div className="text-sm font-medium truncate flex-1" style={{ color: 'var(--text-primary)' }}>{client.name}</div>
                      {daysSince(sale.createdAt) >= STALE_SALE_DAYS ? (
                        <span
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
                          style={{ backgroundColor: 'var(--badge-warn-bg)', color: 'var(--badge-warn-text)' }}
                          title={`Venda aberta há ${daysSince(sale.createdAt)} dias — atenção`}
                        >
                          {daysSince(sale.createdAt)}d
                        </span>
                      ) : (
                        <span className="text-[10px] shrink-0" style={{ color: 'var(--text-muted)' }} title="Dias desde a abertura da venda">
                          {daysSince(sale.createdAt)}d
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-1.5 pl-8">
                      <OriginPill origin={client.origin} />
                      <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>{fmtMoney(sale.value)}</span>
                    </div>
                  </button>
                ))}
                {items.length === 0 && (
                  <div className="text-xs text-center py-4" style={{ color: 'var(--text-muted)' }}>
                    {isDropTarget ? 'Solte aqui' : '—'}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Zonas de desfecho — etapa é caminho, ganho/perda é destino. Só existem durante o arrasto. */}
      {draggingSaleId && (
        <div className="flex gap-3 mt-3">
          <div
            onDragOver={(e) => { e.preventDefault(); if (dropOutcome !== 'win') setDropOutcome('win'); }}
            onDragLeave={() => dropOutcome === 'win' && setDropOutcome(null)}
            onDrop={(e) => { e.preventDefault(); handleOutcomeDrop('win', e.dataTransfer.getData('text/plain')); }}
            className="flex-1 rounded-xl py-4 text-center text-sm font-semibold transition-all"
            style={{
              border: `2px dashed var(--badge-success-text)`,
              color: 'var(--badge-success-text)',
              backgroundColor: dropOutcome === 'win' ? 'var(--badge-success-bg)' : 'transparent',
              transform: dropOutcome === 'win' ? 'scale(1.01)' : 'none',
            }}
          >
            ✓ Soltar aqui para GANHAR
          </div>
          <div
            onDragOver={(e) => { e.preventDefault(); if (dropOutcome !== 'lose') setDropOutcome('lose'); }}
            onDragLeave={() => dropOutcome === 'lose' && setDropOutcome(null)}
            onDrop={(e) => { e.preventDefault(); handleOutcomeDrop('lose', e.dataTransfer.getData('text/plain')); }}
            className="flex-1 rounded-xl py-4 text-center text-sm font-semibold transition-all"
            style={{
              border: `2px dashed var(--badge-error-text)`,
              color: 'var(--badge-error-text)',
              backgroundColor: dropOutcome === 'lose' ? 'var(--badge-error-bg)' : 'transparent',
              transform: dropOutcome === 'lose' ? 'scale(1.01)' : 'none',
            }}
          >
            ✗ Soltar aqui para PERDER
          </div>
        </div>
      )}

      {noStage.length > 0 && (
        <p className="text-xs mt-1" style={{ color: 'var(--badge-warn-text)' }}>
          {noStage.length} venda(s) sem etapa (a etapa original foi removida do funil) — abra o cliente para reposicionar.
        </p>
      )}

      {/* Lista de clientes (inclui quem não tem venda aberta) */}
      <div className="mt-6 rounded-xl p-4" style={card}>
        <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Todos os clientes</h2>
        {clients.length === 0 ? (
          <p className="text-sm py-4 text-center" style={{ color: 'var(--text-muted)' }}>
            Nenhum cliente ainda. Crie o primeiro com o botão acima.
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
                  <th className="text-right font-medium py-2 pr-4">Em aberto</th>
                  <th className="text-right font-medium py-2">LTV</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => openClient(c.id)}
                    className="cursor-pointer"
                    style={{ borderTop: '1px solid var(--border)' }}
                  >
                    <td className="py-2.5 pr-4 font-medium" style={{ color: 'var(--text-primary)' }}>{c.name}</td>
                    <td className="py-2.5 pr-4" style={{ color: 'var(--text-secondary)' }}>{fmtPhone(c.phone)}</td>
                    <td className="py-2.5 pr-4"><OriginPill origin={c.origin} /></td>
                    <td className="py-2.5 pr-4" style={{ color: 'var(--text-muted)' }}>{c.responsible?.name ?? '—'}</td>
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
      </div>

      {/* Drawer do cliente */}
      {(detail || detailLoading) && (
        <ClientDrawer
          detail={detail}
          loading={detailLoading}
          stages={status.stages}
          isAdmin={isAdmin}
          orgUsers={orgUsers}
          onLoadUsers={loadUsersOnce}
          onClose={() => setDetail(null)}
          onNewSale={() => detail && setSaleModalClient(detail)}
          onWin={(s) => setWinSaleTarget(s)}
          onLose={(s) => setLoseSaleTarget(s)}
          onChangeStage={async (saleId, stageId) => {
            try {
              await apiService.changeCrmSaleStage(saleId, stageId);
              await refreshDetail();
            } catch (err) { showToast('error', apiErrorMsg(err, 'Erro ao mover etapa.')); }
          }}
          onTransfer={async (responsibleId) => {
            if (!detail) return;
            try {
              await apiService.transferCrmResponsible(detail.id, responsibleId);
              showToast('success', 'Responsável atualizado.');
              await refreshDetail();
            } catch (err) { showToast('error', apiErrorMsg(err, 'Erro ao transferir responsável.')); }
          }}
          onDeleteSale={async (saleId) => {
            try {
              await apiService.deleteCrmSale(saleId);
              showToast('success', 'Venda removida.');
              await refreshDetail();
            } catch (err) { showToast('error', apiErrorMsg(err, 'Erro ao remover venda.')); }
          }}
        />
      )}

      {/* Modais */}
      {showNewClient && (
        <NewClientModal
          onClose={() => setShowNewClient(false)}
          onSaved={async (created, msg) => {
            setShowNewClient(false);
            showToast(created ? 'success' : 'error', msg);
            await loadAll(search.trim() || undefined);
          }}
        />
      )}

      {saleModalClient && (
        <NewSaleModal
          client={saleModalClient}
          stages={status.stages}
          onClose={() => setSaleModalClient(null)}
          onSaved={async () => {
            setSaleModalClient(null);
            showToast('success', 'Venda registrada.');
            await refreshDetail();
          }}
          onError={(msg) => showToast('error', msg)}
        />
      )}

      {winSaleTarget && (
        <WinModal
          sale={winSaleTarget}
          onClose={() => setWinSaleTarget(null)}
          onConfirm={async (value) => {
            try {
              await apiService.winCrmSale(winSaleTarget.id, value !== undefined ? { value } : undefined);
              setWinSaleTarget(null);
              showToast('success', 'Venda ganha! 🎉');
              await refreshDetail();
            } catch (err) { showToast('error', apiErrorMsg(err, 'Erro ao registrar ganho.')); }
          }}
        />
      )}

      {loseSaleTarget && (
        <LoseModal
          onClose={() => setLoseSaleTarget(null)}
          onConfirm={async (reason) => {
            try {
              await apiService.loseCrmSale(loseSaleTarget.id, reason);
              setLoseSaleTarget(null);
              showToast('success', 'Venda marcada como perdida.');
              await refreshDetail();
            } catch (err) { showToast('error', apiErrorMsg(err, 'Erro ao registrar perda.')); }
          }}
        />
      )}

      {showStagesEditor && (
        <StagesEditorModal
          stages={status.stages}
          onClose={() => setShowStagesEditor(false)}
          onSaved={async (msg) => {
            setShowStagesEditor(false);
            showToast('success', msg);
            await loadAll(search.trim() || undefined);
          }}
          onError={(msg) => showToast('error', msg)}
        />
      )}

      {toast && <Toast toast={toast} />}
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ toast }: { toast: { type: 'success' | 'error'; msg: string } }) {
  return (
    <div
      className="fixed bottom-6 right-6 z-[80] px-4 py-2.5 rounded-lg text-sm shadow-lg"
      style={{
        backgroundColor: toast.type === 'success' ? 'var(--badge-success-bg)' : 'var(--badge-error-bg)',
        color: toast.type === 'success' ? 'var(--badge-success-text)' : 'var(--badge-error-text)',
        border: '1px solid var(--border-md)',
      }}
    >
      {toast.msg}
    </div>
  );
}

// ─── Drawer do cliente ────────────────────────────────────────────────────────

function ClientDrawer(props: {
  detail: CrmClientDetail | null;
  loading: boolean;
  stages: CrmStage[];
  isAdmin: boolean;
  orgUsers: User[];
  onLoadUsers: () => void;
  onClose: () => void;
  onNewSale: () => void;
  onWin: (s: CrmSale) => void;
  onLose: (s: CrmSale) => void;
  onChangeStage: (saleId: string, stageId: string) => void;
  onTransfer: (responsibleId: string | null) => void;
  onDeleteSale: (saleId: string) => void;
}) {
  const { detail, loading, stages, isAdmin, orgUsers } = props;
  const [showEvents, setShowEvents] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const statusPill = (s: CrmSale) => {
    if (s.status === 'WON') return { label: 'Ganha', color: 'var(--badge-success-text)', bg: 'var(--badge-success-bg)' };
    if (s.status === 'LOST') return { label: 'Perdida', color: 'var(--badge-error-text)', bg: 'var(--badge-error-bg)' };
    return { label: s.stage?.name ?? 'Sem etapa', color: 'var(--accent)', bg: 'var(--accent-dim)' };
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={props.onClose} />
      <aside
        className="fixed inset-y-0 right-0 z-50 w-full max-w-md flex flex-col overflow-y-auto"
        style={{ backgroundColor: 'var(--bg-surface)', borderLeft: '1px solid var(--border)' }}
      >
        {loading || !detail ? (
          <div className="flex-1 flex items-center justify-center">
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Carregando...</span>
          </div>
        ) : (
          <div className="p-5">
            {/* Cabeçalho do card */}
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: 'var(--accent)' }}>
                  Card permanente · Cliente
                </span>
                <h2 className="text-lg font-semibold truncate mt-0.5" style={{ color: 'var(--text-primary)' }}>{detail.name}</h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  📞 {fmtPhone(detail.phone)} · origem: {originLabel(detail.origin)}
                </p>
              </div>
              <button onClick={props.onClose} className="p-1.5 rounded-md shrink-0" style={{ color: 'var(--text-muted)' }} aria-label="Fechar">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* LTV */}
            <div
              className="inline-block mt-3 px-3 py-1.5 rounded-lg text-sm font-bold"
              style={{ backgroundColor: 'var(--badge-success-bg)', color: 'var(--badge-success-text)' }}
            >
              LTV {fmtMoney(detail.ltv)} · soma automática das vendas ganhas
            </div>

            {/* Responsável */}
            <div className="mt-4 flex items-center gap-2 text-sm">
              <span style={{ color: 'var(--text-muted)' }}>Responsável:</span>
              {isAdmin ? (
                transferring ? (
                  <select
                    autoFocus
                    className="rounded-md px-2 py-1 text-sm"
                    style={input}
                    defaultValue={detail.responsibleId ?? ''}
                    onBlur={() => setTransferring(false)}
                    onChange={(e) => { setTransferring(false); props.onTransfer(e.target.value || null); }}
                  >
                    <option value="">Não atribuído</option>
                    {orgUsers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                ) : (
                  <button
                    onClick={() => { props.onLoadUsers(); setTransferring(true); }}
                    className="underline decoration-dotted"
                    style={{ color: 'var(--text-secondary)' }}
                    title="Transferir responsável"
                  >
                    {detail.responsible?.name ?? 'Não atribuído'} ✎
                  </button>
                )
              ) : (
                <span style={{ color: 'var(--text-secondary)' }}>{detail.responsible?.name ?? 'Não atribuído'}</span>
              )}
            </div>

            {detail.notes && (
              <p className="mt-3 text-xs rounded-lg p-2.5" style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
                {detail.notes}
              </p>
            )}

            {/* Vendas */}
            <div className="flex items-center justify-between mt-6 mb-2">
              <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                Vendas ({detail.sales.length})
              </h3>
              <button
                onClick={props.onNewSale}
                className="text-xs px-2.5 py-1.5 rounded-md font-medium text-white"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                + Nova venda
              </button>
            </div>

            <div className="space-y-2.5">
              {detail.sales.length === 0 && (
                <p className="text-xs py-3 text-center" style={{ color: 'var(--text-muted)' }}>Nenhuma venda ainda.</p>
              )}
              {detail.sales.map((s) => {
                const pill = statusPill(s);
                return (
                  <div key={s.id} className="rounded-lg p-3" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap" style={{ color: pill.color, backgroundColor: pill.bg }}>
                        {pill.label}
                      </span>
                      <span className="text-xs truncate flex-1" style={{ color: 'var(--text-muted)' }}>
                        {s.title ?? `Venda #${s.seq}`} · {fmtDate(s.createdAt)}
                        {s.closedAt ? ` → ${fmtDate(s.closedAt)}` : ''}
                      </span>
                      <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{fmtMoney(s.value)}</span>
                    </div>

                    {(s.segments?.length ?? 0) > 0 && (
                      <div className="text-[11px] mt-1.5 ml-1" style={{ color: 'var(--text-muted)' }}>
                        ↳ {s.segments!.map((seg) => `${seg.name} ${fmtMoney(seg.value)}`).join(' · ')}
                      </div>
                    )}

                    {s.status === 'LOST' && s.lostReason && (
                      <div className="text-[11px] mt-1.5" style={{ color: 'var(--badge-error-text)' }}>
                        Motivo: {LOST_REASON_OPTIONS.find((r) => r.key === s.lostReason)?.label ?? s.lostReason}
                      </div>
                    )}

                    {s.status === 'OPEN' && (
                      <div className="flex items-center gap-2 mt-2.5">
                        <select
                          className="rounded-md px-2 py-1 text-xs flex-1"
                          style={input}
                          value={s.stageId ?? ''}
                          onChange={(e) => e.target.value && props.onChangeStage(s.id, e.target.value)}
                        >
                          {!s.stageId && <option value="">Sem etapa</option>}
                          {stages.map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}
                        </select>
                        <button
                          onClick={() => props.onWin(s)}
                          className="text-xs px-2.5 py-1 rounded-md font-medium"
                          style={{ backgroundColor: 'var(--badge-success-bg)', color: 'var(--badge-success-text)' }}
                        >
                          Ganhar
                        </button>
                        <button
                          onClick={() => props.onLose(s)}
                          className="text-xs px-2.5 py-1 rounded-md font-medium"
                          style={{ backgroundColor: 'var(--badge-error-bg)', color: 'var(--badge-error-text)' }}
                        >
                          Perder
                        </button>
                      </div>
                    )}

                    {isAdmin && (
                      confirmDelete === s.id ? (
                        <div className="flex items-center gap-2 mt-2 text-[11px]">
                          <span style={{ color: 'var(--badge-error-text)' }}>Remover esta venda?</span>
                          <button onClick={() => { setConfirmDelete(null); props.onDeleteSale(s.id); }} className="font-bold" style={{ color: 'var(--badge-error-text)' }}>Sim</button>
                          <button onClick={() => setConfirmDelete(null)} style={{ color: 'var(--text-muted)' }}>Não</button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmDelete(s.id)} className="text-[11px] mt-2" style={{ color: 'var(--text-muted)' }}>
                          Remover
                        </button>
                      )
                    )}
                  </div>
                );
              })}
            </div>

            {/* Histórico */}
            <button
              onClick={() => setShowEvents((v) => !v)}
              className="mt-6 text-sm font-semibold flex items-center gap-1"
              style={{ color: 'var(--text-primary)' }}
            >
              Histórico {showEvents ? '▾' : '▸'}
            </button>
            {showEvents && (
              <div className="mt-2 space-y-1.5">
                {detail.events.map((e) => (
                  <div key={e.id} className="text-xs flex items-baseline gap-2" style={{ color: 'var(--text-muted)' }}>
                    <span className="shrink-0 tabular-nums">{fmtDate(e.createdAt)}</span>
                    <span style={{ color: 'var(--text-secondary)' }}>{EVENT_LABELS[e.type] ?? e.type}</span>
                    {e.actor?.name && <span>· {e.actor.name}</span>}
                  </div>
                ))}
              </div>
            )}

            {/* Conversa WhatsApp (busca on-demand na Evolution) */}
            <WaConversation clientId={detail.id} />
          </div>
        )}
      </aside>
    </>
  );
}

// ─── WhatsApp do vendedor ─────────────────────────────────────────────────────

function WhatsappConnectButton({ showToast }: { showToast: (type: 'success' | 'error', msg: string) => void }) {
  const [waStatus, setWaStatus] = useState<CrmWaStatus | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const refreshStatus = useCallback(async () => {
    try {
      const res = await apiService.getCrmWhatsappStatus();
      if (res.success) setWaStatus(res.data);
      return res.data;
    } catch { return null; }
  }, []);

  useEffect(() => { void refreshStatus(); }, [refreshStatus]);

  // Pareamento: renova o QR a cada 25s e verifica conexão a cada 3s
  useEffect(() => {
    if (!showModal || waStatus?.connected) return;
    const poll = setInterval(async () => {
      const st = await refreshStatus();
      if (st?.connected) {
        setQr(null);
        showToast('success', `WhatsApp conectado${st.phone ? ` (${fmtPhone(st.phone)})` : ''}.`);
      }
    }, 3000);
    const renewQr = setInterval(async () => {
      try {
        const res = await apiService.connectCrmWhatsapp();
        if (res.data.qrcode) setQr(res.data.qrcode);
      } catch { /* mantém o QR atual */ }
    }, 25000);
    return () => { clearInterval(poll); clearInterval(renewQr); };
  }, [showModal, waStatus?.connected, refreshStatus, showToast]);

  const handleOpen = async () => {
    setShowModal(true);
    if (waStatus?.connected) return;
    setWorking(true);
    try {
      const res = await apiService.connectCrmWhatsapp();
      if (res.data.connected) { await refreshStatus(); }
      else setQr(res.data.qrcode);
    } catch (err) {
      showToast('error', apiErrorMsg(err, 'Erro ao iniciar conexão do WhatsApp.'));
      setShowModal(false);
    } finally {
      setWorking(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm('Desconectar seu WhatsApp do CRM? O rastreio de conversas para.')) return;
    setWorking(true);
    try {
      await apiService.disconnectCrmWhatsapp();
      setWaStatus({ configured: false, connected: false });
      setQr(null);
      setShowModal(false);
      showToast('success', 'WhatsApp desconectado.');
    } catch (err) {
      showToast('error', apiErrorMsg(err, 'Erro ao desconectar.'));
    } finally {
      setWorking(false);
    }
  };

  const connected = waStatus?.connected ?? false;

  return (
    <>
      <button
        onClick={handleOpen}
        className="px-3 py-2 rounded-lg text-sm flex items-center gap-1.5"
        style={connected
          ? { backgroundColor: 'var(--badge-success-bg)', color: 'var(--badge-success-text)' }
          : { ...card, color: 'var(--text-secondary)' }}
        title={connected ? `WhatsApp conectado${waStatus?.phone ? `: ${fmtPhone(waStatus.phone)}` : ''}` : 'Conectar seu WhatsApp ao CRM'}
      >
        {connected ? '✓ WhatsApp' : 'Conectar WhatsApp'}
      </button>

      {showModal && (
        <ModalShell title="WhatsApp do vendedor" onClose={() => setShowModal(false)}>
          {connected ? (
            <div className="space-y-4">
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Conectado{waStatus?.phone ? ` como ${fmtPhone(waStatus.phone)}` : ''}. Mensagens recebidas de
                números novos criam cards automaticamente atribuídos a você, e as conversas aparecem no card do cliente.
              </p>
              <p className="text-xs rounded-lg p-2.5" style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
                Nos primeiros minutos após conectar, o WhatsApp sincroniza seus dados em segundo plano —
                o rastreio de mensagens novas já está ativo desde agora.
              </p>
              <button
                onClick={handleDisconnect}
                disabled={working}
                className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60"
                style={{ backgroundColor: 'var(--badge-error-bg)', color: 'var(--badge-error-text)' }}
              >
                {working ? 'Desconectando...' : 'Desconectar'}
              </button>
            </div>
          ) : (
            <div className="space-y-3 text-center">
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                Abra o WhatsApp no celular → <strong>Dispositivos conectados</strong> → <strong>Conectar dispositivo</strong> e escaneie:
              </p>
              {working && <p className="text-sm py-10" style={{ color: 'var(--text-muted)' }}>Gerando QR code...</p>}
              {!working && qr && (
                <img
                  src={qr.startsWith('data:') ? qr : `data:image/png;base64,${qr}`}
                  alt="QR code do WhatsApp"
                  className="mx-auto rounded-lg"
                  style={{ width: 240, height: 240, backgroundColor: '#fff', padding: 8 }}
                />
              )}
              {!working && !qr && (
                <p className="text-sm py-10" style={{ color: 'var(--badge-warn-text)' }}>
                  QR indisponível — verifique se a Evolution API está no ar e tente de novo.
                </p>
              )}
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                O QR renova sozinho. Assim que o pareamento concluir, esta janela confirma.
              </p>
            </div>
          )}
        </ModalShell>
      )}
    </>
  );
}

function WaConversation({ clientId }: { clientId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [messages, setMessages] = useState<CrmWaMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiService.getCrmWhatsappMessages(clientId);
      setAvailable(res.data.available);
      setMessages(res.data.messages);
    } catch {
      setAvailable(false);
      setMessages([]);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setSending(true);
    setSendError(null);
    try {
      await apiService.sendCrmWhatsappMessage(clientId, text);
      setDraft('');
      await load();
    } catch (err) {
      setSendError(apiErrorMsg(err, 'Erro ao enviar a mensagem.'));
    } finally {
      setSending(false);
    }
  };

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && available === null) void load();
  };

  const fmtTs = (ts: number) =>
    new Date(ts * 1000).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

  return (
    <div>
      <div className="flex items-center justify-between mt-6">
        <button onClick={toggle} className="text-sm font-semibold flex items-center gap-1" style={{ color: 'var(--text-primary)' }}>
          Conversa WhatsApp {open ? '▾' : '▸'}
        </button>
        {open && (
          <button onClick={() => void load()} className="text-xs" style={{ color: 'var(--text-muted)' }} disabled={loading}>
            {loading ? 'Carregando...' : 'Atualizar'}
          </button>
        )}
      </div>
      {open && (
        <div className="mt-2">
          {loading && messages.length === 0 && (
            <p className="text-xs py-3 text-center" style={{ color: 'var(--text-muted)' }}>Buscando conversa...</p>
          )}
          {!loading && available === false && (
            <p className="text-xs py-3 text-center" style={{ color: 'var(--text-muted)' }}>
              Nenhum WhatsApp conectado para este cliente — conecte o seu no botão do topo da página.
            </p>
          )}
          {available && messages.length === 0 && !loading && (
            <p className="text-xs py-3 text-center" style={{ color: 'var(--text-muted)' }}>Nenhuma mensagem com este número ainda.</p>
          )}
          {messages.length > 0 && (
            <div
              className="space-y-1.5 max-h-72 overflow-y-auto rounded-lg p-2.5"
              style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
            >
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.fromMe ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className="max-w-[85%] rounded-lg px-2.5 py-1.5"
                    style={m.fromMe
                      ? { backgroundColor: 'var(--accent-dim)', border: '1px solid var(--border)' }
                      : { backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
                  >
                    <p className="text-xs whitespace-pre-wrap break-words" style={{ color: 'var(--text-primary)' }}>{m.text}</p>
                    <p className="text-[10px] mt-0.5 text-right" style={{ color: 'var(--text-muted)' }}>{fmtTs(m.timestamp)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          {available && (
            <form
              className="mt-2 flex items-center gap-2"
              onSubmit={(e) => { e.preventDefault(); void send(); }}
            >
              <input
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Responder no WhatsApp..."
                maxLength={4096}
                disabled={sending}
                className="flex-1 text-xs rounded-lg px-2.5 py-2 outline-none"
                style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
              />
              <button
                type="submit"
                disabled={sending || !draft.trim()}
                className="text-xs font-semibold rounded-lg px-3 py-2 disabled:opacity-50"
                style={{ backgroundColor: 'var(--accent-dim)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
              >
                {sending ? 'Enviando...' : 'Enviar'}
              </button>
            </form>
          )}
          {sendError && (
            <p className="text-xs mt-1" style={{ color: 'var(--badge-error-text)' }}>{sendError}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Modais ───────────────────────────────────────────────────────────────────

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/60" onClick={onClose} />
      <div
        className="fixed z-[70] top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[92vw] max-w-md rounded-xl p-5 max-h-[85vh] overflow-y-auto"
        style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-md)' }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>{title}</h3>
          <button onClick={onClose} className="p-1 rounded-md" style={{ color: 'var(--text-muted)' }} aria-label="Fechar">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </>
  );
}

const label = { color: 'var(--text-muted)' } as const;

function NewClientModal({ onClose, onSaved }: {
  onClose: () => void;
  onSaved: (created: boolean, msg: string) => void;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [origin, setOrigin] = useState<CrmOrigin>('OUTRO');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!name.trim() || !phone.trim()) { setError('Nome e telefone são obrigatórios.'); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await apiService.createCrmClient({ name: name.trim(), phone: phone.trim(), origin, ...(notes.trim() ? { notes: notes.trim() } : {}) });
      onSaved(res.data.created, res.message);
    } catch (err) {
      setError(apiErrorMsg(err, 'Erro ao criar cliente.'));
      setSaving(false);
    }
  };

  return (
    <ModalShell title="Novo cliente" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="text-xs block mb-1" style={label}>Nome *</label>
          <input className="w-full rounded-lg px-3 py-2 text-sm" style={input} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="text-xs block mb-1" style={label}>Telefone * (chave única — não duplica cliente)</label>
          <input className="w-full rounded-lg px-3 py-2 text-sm" style={input} placeholder="(85) 99999-8888" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div>
          <label className="text-xs block mb-1" style={label}>Origem</label>
          <select className="w-full rounded-lg px-3 py-2 text-sm" style={input} value={origin} onChange={(e) => setOrigin(e.target.value as CrmOrigin)}>
            {ORIGIN_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs block mb-1" style={label}>Observações</label>
          <textarea className="w-full rounded-lg px-3 py-2 text-sm" style={input} rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        {error && <p className="text-xs" style={{ color: 'var(--badge-error-text)' }}>{error}</p>}
        <button
          onClick={save}
          disabled={saving}
          className="w-full py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-60"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          {saving ? 'Salvando...' : 'Criar cliente'}
        </button>
      </div>
    </ModalShell>
  );
}

function NewSaleModal({ client, stages, onClose, onSaved, onError }: {
  client: CrmClientDetail;
  stages: CrmStage[];
  onClose: () => void;
  onSaved: () => void;
  onError: (msg: string) => void;
}) {
  const [title, setTitle] = useState('');
  const [value, setValue] = useState('');
  const [stageId, setStageId] = useState(stages[0]?.id ?? '');
  const [origin, setOrigin] = useState<CrmOrigin>(client.origin);
  const [segments, setSegments] = useState<{ name: string; value: string }[]>([]);
  const [saving, setSaving] = useState(false);

  const parsedValue = parseFloat(value.replace(',', '.')) || 0;
  const segSum = segments.reduce((acc, s) => acc + (parseFloat(s.value.replace(',', '.')) || 0), 0);
  const segMismatch = segments.length > 0 && Math.abs(segSum - parsedValue) > 0.01;

  const save = async () => {
    if (parsedValue < 0 || value.trim() === '') { onError('Informe o valor da venda.'); return; }
    if (segMismatch) { onError(`Soma dos segmentos (${fmtMoney(segSum)}) difere do valor (${fmtMoney(parsedValue)}).`); return; }
    setSaving(true);
    try {
      await apiService.createCrmSale(client.id, {
        value: parsedValue,
        ...(title.trim() ? { title: title.trim() } : {}),
        ...(stageId ? { stageId } : {}),
        origin,
        ...(segments.length > 0
          ? { segments: segments.filter((s) => s.name.trim()).map((s) => ({ name: s.name.trim(), value: parseFloat(s.value.replace(',', '.')) || 0 })) }
          : {}),
      });
      onSaved();
    } catch (err) {
      onError(apiErrorMsg(err, 'Erro ao registrar a venda.'));
      setSaving(false);
    }
  };

  return (
    <ModalShell title={`Nova venda — ${client.name}`} onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="text-xs block mb-1" style={label}>Título (opcional)</label>
          <input className="w-full rounded-lg px-3 py-2 text-sm" style={input} placeholder="Ex: Corte e Dobra galpão" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs block mb-1" style={label}>Valor (R$) *</label>
            <input className="w-full rounded-lg px-3 py-2 text-sm" style={input} placeholder="0,00" value={value} onChange={(e) => setValue(e.target.value)} />
          </div>
          <div>
            <label className="text-xs block mb-1" style={label}>Etapa</label>
            <select className="w-full rounded-lg px-3 py-2 text-sm" style={input} value={stageId} onChange={(e) => setStageId(e.target.value)}>
              {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="text-xs block mb-1" style={label}>Origem desta venda</label>
          <select className="w-full rounded-lg px-3 py-2 text-sm" style={input} value={origin} onChange={(e) => setOrigin(e.target.value as CrmOrigin)}>
            {ORIGIN_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        </div>

        {/* Segmentos */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs" style={label}>Segmentos (divisão do valor, opcional)</label>
            <button onClick={() => setSegments((p) => [...p, { name: '', value: '' }])} className="text-xs" style={{ color: 'var(--accent)' }}>+ adicionar</button>
          </div>
          {segments.map((seg, i) => (
            <div key={i} className="flex gap-2 mb-1.5">
              <input className="flex-1 rounded-lg px-2.5 py-1.5 text-xs" style={input} placeholder="Ex: Laje" value={seg.name}
                onChange={(e) => setSegments((p) => p.map((s, j) => j === i ? { ...s, name: e.target.value } : s))} />
              <input className="w-24 rounded-lg px-2.5 py-1.5 text-xs" style={input} placeholder="0,00" value={seg.value}
                onChange={(e) => setSegments((p) => p.map((s, j) => j === i ? { ...s, value: e.target.value } : s))} />
              <button onClick={() => setSegments((p) => p.filter((_, j) => j !== i))} className="text-xs px-1" style={{ color: 'var(--text-muted)' }}>✕</button>
            </div>
          ))}
          {segments.length > 0 && (
            <p className="text-[11px]" style={{ color: segMismatch ? 'var(--badge-error-text)' : 'var(--badge-success-text)' }}>
              Soma: {fmtMoney(segSum)} {segMismatch ? `≠ ${fmtMoney(parsedValue)} (precisa conferir)` : '✓ confere'}
            </p>
          )}
        </div>

        <button
          onClick={save}
          disabled={saving || segMismatch}
          className="w-full py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-60"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          {saving ? 'Salvando...' : 'Registrar venda'}
        </button>
      </div>
    </ModalShell>
  );
}

function WinModal({ sale, onClose, onConfirm }: {
  sale: Pick<CrmSale, 'id' | 'value'>;
  onClose: () => void;
  onConfirm: (value?: number) => void;
}) {
  const [value, setValue] = useState(sale.value > 0 ? String(sale.value).replace('.', ',') : '');
  const parsed = parseFloat(value.replace(',', '.')) || 0;

  return (
    <ModalShell title="Marcar como ganha" onClose={onClose}>
      <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
        Confirme o valor final da venda — ele entra no dashboard, na Meta do Mês e no LTV do cliente.
      </p>
      <label className="text-xs block mb-1" style={label}>Valor final (R$) *</label>
      <input className="w-full rounded-lg px-3 py-2 text-sm mb-1" style={input} placeholder="0,00" value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
      {parsed <= 0 && <p className="text-[11px] mb-2" style={{ color: 'var(--badge-warn-text)' }}>Venda ganha precisa de valor maior que zero.</p>}
      <button
        onClick={() => onConfirm(parsed !== sale.value ? parsed : undefined)}
        disabled={parsed <= 0}
        className="w-full py-2.5 rounded-lg text-sm font-medium mt-2 disabled:opacity-60"
        style={{ backgroundColor: 'var(--badge-success-bg)', color: 'var(--badge-success-text)', border: '1px solid var(--border-md)' }}
      >
        Confirmar venda ganha
      </button>
    </ModalShell>
  );
}

function LoseModal({ onClose, onConfirm }: {
  onClose: () => void;
  onConfirm: (reason: CrmLostReason) => void;
}) {
  const [reason, setReason] = useState<CrmLostReason>('INATIVIDADE');
  return (
    <ModalShell title="Marcar como perdida" onClose={onClose}>
      <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
        O motivo vira dado — alimenta o relatório de causas de perda.
      </p>
      <label className="text-xs block mb-1" style={label}>Motivo *</label>
      <select className="w-full rounded-lg px-3 py-2 text-sm mb-3" style={input} value={reason} onChange={(e) => setReason(e.target.value as CrmLostReason)}>
        {LOST_REASON_OPTIONS.map((r) => <option key={r.key} value={r.key}>{r.label}</option>)}
      </select>
      <button
        onClick={() => onConfirm(reason)}
        className="w-full py-2.5 rounded-lg text-sm font-medium"
        style={{ backgroundColor: 'var(--badge-error-bg)', color: 'var(--badge-error-text)', border: '1px solid var(--border-md)' }}
      >
        Confirmar perda
      </button>
    </ModalShell>
  );
}

function StagesEditorModal({ stages, onClose, onSaved, onError }: {
  stages: CrmStage[];
  onClose: () => void;
  onSaved: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [draft, setDraft] = useState<{ id?: string; name: string }[]>(
    stages.map((s) => ({ id: s.id, name: s.name }))
  );
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const valid = draft.filter((s) => s.name.trim());
    if (valid.length === 0) { onError('O funil precisa de ao menos 1 etapa.'); return; }
    setSaving(true);
    try {
      const res = await apiService.saveCrmStages(valid);
      onSaved(res.message);
    } catch (err) {
      onError(apiErrorMsg(err, 'Erro ao salvar o funil.'));
      setSaving(false);
    }
  };

  const move = (i: number, dir: -1 | 1) => {
    setDraft((p) => {
      const n = [...p];
      const j = i + dir;
      if (j < 0 || j >= n.length) return p;
      [n[i], n[j]] = [n[j]!, n[i]!];
      return n;
    });
  };

  return (
    <ModalShell title="Editar funil" onClose={onClose}>
      <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
        Etapas do meio do funil, na ordem. Ganho e perda não são etapas — são o desfecho de cada venda.
        Remover uma etapa solta as vendas abertas dela (ficam &quot;sem etapa&quot;).
      </p>
      <div className="space-y-2 mb-3">
        {draft.map((s, i) => (
          <div key={s.id ?? `new-${i}`} className="flex items-center gap-1.5">
            <input
              className="flex-1 rounded-lg px-3 py-2 text-sm"
              style={input}
              value={s.name}
              onChange={(e) => setDraft((p) => p.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
            />
            <button onClick={() => move(i, -1)} disabled={i === 0} className="px-1.5 disabled:opacity-30" style={{ color: 'var(--text-muted)' }} aria-label="Subir">↑</button>
            <button onClick={() => move(i, 1)} disabled={i === draft.length - 1} className="px-1.5 disabled:opacity-30" style={{ color: 'var(--text-muted)' }} aria-label="Descer">↓</button>
            <button onClick={() => setDraft((p) => p.filter((_, j) => j !== i))} className="px-1.5" style={{ color: 'var(--badge-error-text)' }} aria-label="Remover">✕</button>
          </div>
        ))}
      </div>
      <button onClick={() => setDraft((p) => [...p, { name: '' }])} className="text-xs mb-4" style={{ color: 'var(--accent)' }}>
        + adicionar etapa
      </button>
      <button
        onClick={save}
        disabled={saving}
        className="w-full py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-60"
        style={{ backgroundColor: 'var(--accent)' }}
      >
        {saving ? 'Salvando...' : 'Salvar funil'}
      </button>
    </ModalShell>
  );
}
