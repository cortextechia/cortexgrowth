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
  CrmSale, CrmOrigin, CrmLostReasonOption, User, CrmWaStatus, CrmWaMessage,
} from '@/types';

// Foto de perfil do WhatsApp com fallback nas iniciais (URL assinada pode expirar)
function WaAvatar({ url, name, className }: { url: string | null; name: string; className: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [url]);
  if (url && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt="" onError={() => setFailed(true)} className={`${className} rounded-full object-cover shrink-0`} />
    );
  }
  return (
    <div
      className={`${className} rounded-full flex items-center justify-center font-bold shrink-0`}
      style={{ backgroundColor: 'var(--accent-dim)', color: 'var(--accent)' }}
      aria-hidden
    >
      {initials(name)}
    </div>
  );
}

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

const EVENT_LABELS: Record<string, string> = {
  CLIENT_CREATED: 'Cliente criado',
  SALE_CREATED: 'Venda aberta',
  SALE_UPDATED: 'Venda editada',
  STAGE_CHANGED: 'Mudou de etapa',
  RESPONSIBLE_CHANGED: 'Troca de responsável',
  SALE_WON: 'Venda ganha',
  SALE_LOST: 'Venda perdida',
  SALE_DELETED: 'Venda removida',
  NOTE: 'Nota',
  FOLLOWUP_SET: 'Follow-up agendado',
  FOLLOWUP_CLEARED: 'Follow-up removido',
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

// Follow-up agendado: vencido (dia passou), hoje, ou futuro — cor por urgência
function followUpInfo(iso: string | null): { label: string; tone: 'overdue' | 'today' | 'future' } | null {
  if (!iso) return null;
  const day = new Date(iso); day.setHours(0, 0, 0, 0);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tone = day < today ? 'overdue' : day.getTime() === today.getTime() ? 'today' : 'future';
  return { label: new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), tone };
}

const FOLLOWUP_TONE: Record<'overdue' | 'today' | 'future', { color: string; bg: string }> = {
  overdue: { color: 'var(--badge-error-text)', bg: 'var(--badge-error-bg)' },
  today:   { color: 'var(--badge-warn-text)',  bg: 'var(--badge-warn-bg)' },
  future:  { color: 'var(--text-muted)',       bg: 'var(--bg-elevated)' },
};

function FollowUpChip({ iso }: { iso: string | null }) {
  const info = followUpInfo(iso);
  if (!info) return null;
  const tone = FOLLOWUP_TONE[info.tone];
  return (
    <span
      className="text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 whitespace-nowrap"
      style={{ backgroundColor: tone.bg, color: tone.color }}
      title={info.tone === 'overdue' ? 'Follow-up vencido' : info.tone === 'today' ? 'Follow-up hoje' : 'Follow-up agendado'}
    >
      📅 {info.label}
    </span>
  );
}

// Mensagem WhatsApp não lida — recebida depois da última abertura da conversa.
// Comparação lexicográfica funciona: as datas vêm como ISO-8601 UTC.
function hasUnread(c: { lastInboundAt: string | null; lastReadAt: string | null }): boolean {
  return !!c.lastInboundAt && (!c.lastReadAt || c.lastInboundAt > c.lastReadAt);
}

function UnreadDot() {
  // Balão de mensagem (não bolinha — bolinha parece status "online")
  return (
    <span
      className="inline-flex items-center justify-center h-4 w-4 rounded-full shrink-0 animate-pulse"
      style={{ backgroundColor: '#22c55e' }}
      title="Mensagem não respondida no WhatsApp"
      aria-label="Mensagem não respondida no WhatsApp"
    >
      <svg viewBox="0 0 20 20" fill="#ffffff" className="h-2.5 w-2.5">
        <path d="M10 2.5c-4.4 0-8 2.8-8 6.3 0 2 1.2 3.8 3 4.9L4.4 17a.4.4 0 0 0 .6.5l3.2-1.8c.6.1 1.2.2 1.8.2 4.4 0 8-2.8 8-6.3s-3.6-6.3-8-6.3z" />
      </svg>
    </span>
  );
}

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

// Desktop = drawer em duas colunas (card + conversa lateral); mobile empilha.
// Hook único evita montar a conversa duas vezes (o polling de 5s duplicaria).
function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = () => setIsDesktop(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return isDesktop;
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
  const [showLostReasonsEditor, setShowLostReasonsEditor] = useState(false);
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
          <>
            <button
              onClick={() => setShowStagesEditor(true)}
              className="px-3 py-2 rounded-lg text-sm"
              style={{ ...card, color: 'var(--text-secondary)' }}
            >
              Editar funil
            </button>
            <button
              onClick={() => setShowLostReasonsEditor(true)}
              className="px-3 py-2 rounded-lg text-sm"
              style={{ ...card, color: 'var(--text-secondary)' }}
            >
              Motivos de perda
            </button>
          </>
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
                      <WaAvatar url={client.waAvatarUrl} name={client.name} className="w-6 h-6 text-[10px]" />
                      <div className="text-sm font-medium truncate flex-1 flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                        <span className="truncate">{client.name}</span>
                        {hasUnread(client) && <UnreadDot />}
                      </div>
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
                    <div className="flex items-center justify-between gap-1.5 mt-1.5 pl-8">
                      <span className="inline-flex items-center gap-1.5 min-w-0">
                        <OriginPill origin={client.origin} />
                        <FollowUpChip iso={client.nextFollowUpAt} />
                      </span>
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
                  <th className="text-left font-medium py-2 pr-4">Follow-up</th>
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
                    <td className="py-2.5 pr-4 font-medium" style={{ color: 'var(--text-primary)' }}>
                      <span className="inline-flex items-center gap-1.5">
                        <WaAvatar url={c.waAvatarUrl} name={c.name} className="w-5 h-5 text-[9px]" />
                        {c.name}
                        {hasUnread(c) && <UnreadDot />}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4" style={{ color: 'var(--text-secondary)' }}>{fmtPhone(c.phone)}</td>
                    <td className="py-2.5 pr-4"><OriginPill origin={c.origin} /></td>
                    <td className="py-2.5 pr-4" style={{ color: 'var(--text-muted)' }}>{c.responsible?.name ?? '—'}</td>
                    <td className="py-2.5 pr-4">
                      {c.nextFollowUpAt ? <FollowUpChip iso={c.nextFollowUpAt} /> : <span style={{ color: 'var(--text-muted)' }}>—</span>}
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
          onUpdateClient={async (data) => {
            if (!detail) return;
            try {
              await apiService.updateCrmClient(detail.id, data);
              await refreshDetail();
            } catch (err) { showToast('error', apiErrorMsg(err, 'Erro ao atualizar o cliente.')); }
          }}
          onAddNote={async (text) => {
            if (!detail) return;
            try {
              await apiService.addCrmNote(detail.id, text);
              await refreshDetail();
            } catch (err) { showToast('error', apiErrorMsg(err, 'Erro ao adicionar a nota.')); }
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

      {showLostReasonsEditor && (
        <LostReasonsEditorModal
          onClose={() => setShowLostReasonsEditor(false)}
          onSaved={(msg) => {
            setShowLostReasonsEditor(false);
            showToast('success', msg);
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

// ─── Header do card (banner estilo Kommo) ─────────────────────────────────────
// O banner tem fundo escuro FIXO nos dois temas (como o Kommo faz mesmo no light).
// Por isso as cores de texto/chips daqui são hardcoded de propósito — a regra
// "sem hex no JSX" vale para superfícies que trocam com o tema; aqui o contraste
// é garantido porque o fundo nunca muda (mesma exceção do Chart.js).
const CARD_HEADER_BG = 'linear-gradient(135deg, #0e2f4b 0%, #14536e 100%)';

const TAG_COLORS = [
  { bg: 'rgba(74,222,128,0.16)',  border: 'rgba(74,222,128,0.5)',  text: '#86efac' }, // verde
  { bg: 'rgba(251,191,36,0.16)',  border: 'rgba(251,191,36,0.5)',  text: '#fcd34d' }, // âmbar
  { bg: 'rgba(244,114,182,0.16)', border: 'rgba(244,114,182,0.5)', text: '#f9a8d4' }, // rosa
  { bg: 'rgba(167,139,250,0.18)', border: 'rgba(167,139,250,0.5)', text: '#c4b5fd' }, // violeta
  { bg: 'rgba(34,211,238,0.16)',  border: 'rgba(34,211,238,0.5)',  text: '#67e8f9' }, // ciano
];

// Cor determinística por nome — a mesma tag tem sempre a mesma cor em qualquer card
function tagColor(tag: string) {
  let h = 0;
  for (const c of tag.toLowerCase()) h = (h * 31 + c.charCodeAt(0)) | 0;
  return TAG_COLORS[Math.abs(h) % TAG_COLORS.length]!;
}

// Valor editável inline da seção "Principal" (clique → input → Enter/blur salva)
function InlineField({ value, placeholder, maxLength, onSave }: {
  value: string | null;
  placeholder: string;
  maxLength: number;
  onSave: (v: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  if (!editing) {
    return (
      <button
        onClick={() => { setDraft(value ?? ''); setEditing(true); }}
        className="text-sm text-left truncate max-w-full"
        style={{ color: value ? 'var(--text-primary)' : 'var(--text-muted)' }}
        title="Clique para editar"
      >
        {value || placeholder} <span style={{ color: 'var(--text-muted)' }}>✎</span>
      </button>
    );
  }
  const save = () => { setEditing(false); const v = draft.trim(); if (v !== (value ?? '')) onSave(v || null); };
  return (
    <input
      autoFocus
      className="rounded-md px-2 py-1 text-sm w-full"
      style={input}
      value={draft}
      maxLength={maxLength}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={save}
      onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
    />
  );
}

// Follow-up do card: data agendada com atalhos (padrão "Próximo agendamento" do
// Kommo). Guarda 23:59 local do dia escolhido — só vence quando o dia passa.
function FollowUpField({ value, onSave }: {
  value: string | null;
  onSave: (iso: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const info = followUpInfo(value);

  const saveDay = (d: Date) => {
    setEditing(false);
    d.setHours(23, 59, 59, 0);
    onSave(d.toISOString());
  };
  const fromInput = (v: string) => {
    if (!v) return;
    const [y, m, day] = v.split('-').map(Number);
    saveDay(new Date(y!, (m ?? 1) - 1, day ?? 1));
  };
  const plusDays = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    saveDay(d);
  };

  if (!editing) {
    const tone = info ? FOLLOWUP_TONE[info.tone] : null;
    return (
      <button onClick={() => setEditing(true)} className="text-sm text-left" title="Clique para agendar">
        {info && tone ? (
          <span className="font-semibold" style={{ color: tone.color }}>
            {new Date(value!).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
            {info.tone === 'overdue' ? ' · vencido' : info.tone === 'today' ? ' · hoje' : ''}
          </span>
        ) : (
          <span style={{ color: 'var(--text-muted)' }}>agendar follow-up</span>
        )}
        {' '}<span style={{ color: 'var(--text-muted)' }}>✎</span>
      </button>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button onClick={() => plusDays(0)} className="text-[11px] px-2 py-1 rounded-md" style={input}>Hoje</button>
      <button onClick={() => plusDays(1)} className="text-[11px] px-2 py-1 rounded-md" style={input}>Amanhã</button>
      <button onClick={() => plusDays(3)} className="text-[11px] px-2 py-1 rounded-md" style={input}>+3 dias</button>
      <input
        type="date"
        className="text-[11px] rounded-md px-2 py-1"
        style={input}
        onChange={(e) => fromInput(e.target.value)}
      />
      {value && (
        <button
          onClick={() => { setEditing(false); onSave(null); }}
          className="text-[11px] px-2 py-1"
          style={{ color: 'var(--badge-error-text)' }}
        >
          Limpar
        </button>
      )}
      <button onClick={() => setEditing(false)} className="text-[11px] px-1" style={{ color: 'var(--text-muted)' }}>✕</button>
    </div>
  );
}

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
  onUpdateClient: (data: { name?: string; company?: string | null; clientType?: string | null; email?: string | null; nextFollowUpAt?: string | null; origin?: CrmOrigin; tags?: string[] }) => Promise<void>;
  onAddNote: (text: string) => Promise<void>;
}) {
  const { detail, loading, stages, isAdmin, orgUsers } = props;
  const isDesktop = useIsDesktop();
  const [showEvents, setShowEvents] = useState(true);
  const [transferring, setTransferring] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [addingTag, setAddingTag] = useState(false);
  const [tagDraft, setTagDraft] = useState('');
  const [noteDraft, setNoteDraft] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(detail?.waAvatarUrl ?? null);

  // Foto de perfil do WhatsApp: usa o cache do card e pede refresh ao backend
  // (que renova na Evolution quando a URL assinada passa de 24h)
  const detailId = detail?.id;
  useEffect(() => {
    if (!detailId) return;
    apiService.getCrmClientAvatar(detailId)
      .then((res) => setAvatarUrl(res.data.avatarUrl))
      .catch(() => { /* mantém o cache/iniciais */ });
  }, [detailId]);

  // Trava a rolagem da página enquanto o drawer está aberto — sem isso o wheel
  // "vaza" pro kanban atrás quando o gesto cai numa área sem rolagem própria.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  const addTag = () => {
    const t = tagDraft.trim();
    setAddingTag(false);
    setTagDraft('');
    if (!detail || !t) return;
    if (detail.tags.some((x) => x.toLowerCase() === t.toLowerCase())) return;
    void props.onUpdateClient({ tags: [...detail.tags, t] });
  };

  const removeTag = (tag: string) => {
    if (!detail) return;
    void props.onUpdateClient({ tags: detail.tags.filter((t) => t !== tag) });
  };

  const submitNote = async () => {
    const text = noteDraft.trim();
    if (!text) return;
    setSavingNote(true);
    try {
      await props.onAddNote(text);
      setNoteDraft('');
    } finally {
      setSavingNote(false);
    }
  };

  const statusPill = (s: CrmSale) => {
    if (s.status === 'WON') return { label: 'Ganha', color: 'var(--badge-success-text)', bg: 'var(--badge-success-bg)' };
    if (s.status === 'LOST') return { label: 'Perdida', color: 'var(--badge-error-text)', bg: 'var(--badge-error-bg)' };
    return { label: s.stage?.name ?? 'Sem etapa', color: 'var(--accent)', bg: 'var(--accent-dim)' };
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={props.onClose} />
      <aside
        className="fixed inset-y-0 right-0 z-50 w-full max-w-lg lg:max-w-4xl flex flex-col overflow-hidden"
        style={{ backgroundColor: 'var(--bg-surface)', borderLeft: '1px solid var(--border)' }}
      >
        {loading || !detail ? (
          <div className="flex-1 flex items-center justify-center">
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Carregando...</span>
          </div>
        ) : (
          // Desktop: card à esquerda + conversa lateral (como no Kommo). Mobile: empilhado.
          <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden overscroll-contain">
          <div className="flex-1 min-w-0 lg:overflow-y-auto overscroll-contain">
          <div className="p-5">
            {/* Cabeçalho do card — banner escuro estilo Kommo (fundo fixo nos 2 temas) */}
            <div className="-m-5 mb-0 p-5 pb-4" style={{ background: CARD_HEADER_BG, borderBottom: '1px solid var(--border)' }}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex items-center gap-3">
                  <WaAvatar url={avatarUrl} name={detail.name} className="w-11 h-11 text-sm" />
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold tracking-widest uppercase" style={{ color: '#7dd3fc' }}>
                      Card permanente · Cliente
                    </span>
                    <h2 className="text-xl font-semibold truncate mt-0.5" style={{ color: '#ffffff' }}>{detail.name}</h2>
                  </div>
                </div>
                <button onClick={props.onClose} className="p-1.5 rounded-md shrink-0" style={{ color: 'rgba(255,255,255,0.7)' }} aria-label="Fechar">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Tags — chips coloridos (cor determinística por nome, como no Kommo) */}
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
                {detail.tags.map((tag) => {
                  const c = tagColor(tag);
                  return (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md"
                      style={{ backgroundColor: c.bg, color: c.text, border: `1px solid ${c.border}` }}
                    >
                      {tag}
                      <button onClick={() => removeTag(tag)} aria-label={`Remover tag ${tag}`} style={{ color: 'rgba(255,255,255,0.55)' }}>×</button>
                    </span>
                  );
                })}
                {addingTag ? (
                  <input
                    autoFocus
                    className="rounded-md px-2 py-0.5 text-[11px] w-28 outline-none"
                    style={{ backgroundColor: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.35)', color: '#ffffff' }}
                    value={tagDraft}
                    maxLength={30}
                    placeholder="nova tag"
                    onChange={(e) => setTagDraft(e.target.value)}
                    onBlur={addTag}
                    onKeyDown={(e) => { if (e.key === 'Enter') addTag(); if (e.key === 'Escape') { setAddingTag(false); setTagDraft(''); } }}
                  />
                ) : (
                  <button
                    onClick={() => setAddingTag(true)}
                    className="text-[11px] px-2 py-0.5 rounded-md"
                    style={{ border: '1px dashed rgba(255,255,255,0.4)', color: 'rgba(255,255,255,0.75)' }}
                  >
                    + tag
                  </button>
                )}
              </div>

              {/* Funil de vendas — etapa atual + barra de progresso (como no Kommo) */}
              {(() => {
                const openSale = detail.sales.find((s) => s.status === 'OPEN');
                const lastSale = detail.sales[0];
                const activeIdx = openSale ? stages.findIndex((st) => st.id === openSale.stageId) : -1;
                const outcome = !openSale && lastSale ? lastSale.status : null;
                const stageName = openSale
                  ? (openSale.stage?.name ?? stages.find((st) => st.id === openSale.stageId)?.name ?? 'Sem etapa')
                  : outcome === 'WON' ? 'Venda ganha'
                  : outcome === 'LOST' ? 'Venda perdida'
                  : 'Sem venda aberta';
                // Cores fixas — o banner tem fundo escuro nos dois temas
                const stageColor = outcome === 'WON' ? '#4ade80'
                  : outcome === 'LOST' ? '#f87171'
                  : openSale ? '#ffffff' : 'rgba(255,255,255,0.6)';
                return (
                  <div className="mt-3">
                    <p className="text-[10px] uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.55)' }}>Funil de Vendas</p>
                    <p className="text-sm font-semibold mt-0.5" style={{ color: stageColor }}>{stageName}</p>
                    <div className="flex gap-1 mt-1.5">
                      {stages.map((st, i) => {
                        const filled = outcome === 'WON' ? '#4ade80'
                          : outcome === 'LOST' ? '#f87171'
                          : openSale && i <= activeIdx ? '#60a5fa'
                          : 'rgba(255,255,255,0.22)';
                        return <span key={st.id} title={st.name} className="h-1.5 flex-1 rounded-full" style={{ backgroundColor: filled }} />;
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Principal — campos do card (espelha a aba "Principal" do Kommo) */}
            <div className="mt-4 space-y-2.5">
              <div className="grid grid-cols-[130px_1fr] items-center gap-2">
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Responsável</span>
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
                      className="text-sm text-left"
                      style={{ color: 'var(--text-primary)' }}
                      title="Transferir responsável"
                    >
                      {detail.responsible?.name ?? 'Não atribuído'} <span style={{ color: 'var(--text-muted)' }}>✎</span>
                    </button>
                  )
                ) : (
                  <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{detail.responsible?.name ?? 'Não atribuído'}</span>
                )}
              </div>

              <div className="grid grid-cols-[130px_1fr] items-center gap-2">
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>LTV</span>
                <span className="text-sm font-bold" style={{ color: 'var(--badge-success-text)' }} title="Soma automática das vendas ganhas">
                  {fmtMoney(detail.ltv)}
                </span>
              </div>

              <div className="grid grid-cols-[130px_1fr] items-center gap-2">
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Tipo de cliente</span>
                <InlineField
                  value={detail.clientType}
                  placeholder="ex: Engenheiro"
                  maxLength={60}
                  onSave={(v) => void props.onUpdateClient({ clientType: v })}
                />
              </div>

              <div className="grid grid-cols-[130px_1fr] items-center gap-2">
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Origem</span>
                <select
                  className="rounded-md px-2 py-1 text-sm w-fit"
                  style={input}
                  value={detail.origin}
                  onChange={(e) => void props.onUpdateClient({ origin: e.target.value as CrmOrigin })}
                >
                  {ORIGIN_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-[130px_1fr] items-center gap-2">
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Empresa</span>
                <InlineField
                  value={detail.company}
                  placeholder="adicionar empresa"
                  maxLength={120}
                  onSave={(v) => void props.onUpdateClient({ company: v })}
                />
              </div>

              <div className="grid grid-cols-[130px_1fr] items-center gap-2">
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Telefone</span>
                <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{fmtPhone(detail.phone)}</span>
              </div>

              <div className="grid grid-cols-[130px_1fr] items-center gap-2">
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>E-mail</span>
                <InlineField
                  value={detail.email}
                  placeholder="adicionar e-mail"
                  maxLength={160}
                  onSave={(v) => void props.onUpdateClient({ email: v })}
                />
              </div>

              <div className="grid grid-cols-[130px_1fr] items-center gap-2">
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Follow-up</span>
                <FollowUpField
                  value={detail.nextFollowUpAt}
                  onSave={(iso) => void props.onUpdateClient({ nextFollowUpAt: iso })}
                />
              </div>
            </div>

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
                        Motivo: {s.lostReason}
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

            {/* Notas e histórico */}
            <button
              onClick={() => setShowEvents((v) => !v)}
              className="mt-6 text-sm font-semibold flex items-center gap-1"
              style={{ color: 'var(--text-primary)' }}
            >
              Notas e histórico {showEvents ? '▾' : '▸'}
            </button>

            {/* Composer de nota */}
            <div className="mt-2 flex gap-2">
              <textarea
                className="rounded-md px-2.5 py-1.5 text-sm flex-1 resize-none"
                style={input}
                rows={noteDraft ? 3 : 1}
                maxLength={2000}
                placeholder="Escrever nota..."
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
              />
              {noteDraft.trim() && (
                <button
                  onClick={() => void submitNote()}
                  disabled={savingNote}
                  className="text-xs px-3 py-1.5 rounded-md font-medium text-white self-end disabled:opacity-60"
                  style={{ backgroundColor: 'var(--accent)' }}
                >
                  {savingNote ? '...' : 'Salvar'}
                </button>
              )}
            </div>

            {showEvents && (
              <div className="mt-3 space-y-2">
                {detail.events.length === 0 && (
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Nenhum registro ainda.</p>
                )}
                {detail.events.map((e) =>
                  e.type === 'NOTE' ? (
                    <div
                      key={e.id}
                      className="rounded-lg p-2.5 text-xs"
                      style={{ backgroundColor: 'var(--bg-elevated)', borderLeft: '2px solid var(--accent)' }}
                    >
                      <p className="whitespace-pre-wrap" style={{ color: 'var(--text-primary)' }}>{String(e.payload?.text ?? '')}</p>
                      <p className="mt-1" style={{ color: 'var(--text-muted)' }}>
                        {e.actor?.name ?? 'Nota'} · {fmtDate(e.createdAt)}
                      </p>
                    </div>
                  ) : (
                    <div key={e.id} className="text-xs flex items-baseline gap-2" style={{ color: 'var(--text-muted)' }}>
                      <span className="shrink-0 tabular-nums">{fmtDate(e.createdAt)}</span>
                      <span style={{ color: 'var(--text-secondary)' }}>{EVENT_LABELS[e.type] ?? e.type}</span>
                      {e.actor?.name && <span>· {e.actor.name}</span>}
                    </div>
                  )
                )}
              </div>
            )}

            {/* Conversa WhatsApp no fluxo — só no mobile (desktop usa o painel lateral) */}
            {!isDesktop && <WaConversation clientId={detail.id} />}
          </div>
          </div>

          {/* Painel lateral da conversa (desktop) — como no Kommo */}
          {isDesktop && (
            <div
              className="w-[380px] shrink-0 flex flex-col min-h-0"
              style={{ borderLeft: '1px solid var(--border)', backgroundColor: 'var(--bg-elevated)' }}
            >
              <WaConversation clientId={detail.id} variant="panel" />
            </div>
          )}
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

// Placeholder de mídia sem caption ("[imagem]", "[áudio]"...) — não repete o
// texto quando a mídia em si é renderizada
const isMediaPlaceholder = (text: string) => /^\[.+\]$/.test(text);

const MEDIA_BUTTON_LABEL: Record<NonNullable<CrmWaMessage['mediaType']>, string> = {
  image: '📷 Ver imagem',
  video: '🎬 Ver vídeo',
  audio: '▶ Ouvir áudio',
  document: '📎 Baixar documento',
  sticker: '📷 Ver figurinha',
};

// Extensão pelo mimetype quando o nome do arquivo vem sem ela — sem isso o
// Windows não sabe abrir o download
const EXT_BY_MIME: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'audio/ogg': '.ogg',
  'audio/mpeg': '.mp3',
  'video/mp4': '.mp4',
  'text/plain': '.txt',
  'application/zip': '.zip',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
};

function downloadFileName(fileName: string | undefined, mimetype: string): string {
  const base = (fileName ?? '').trim() || 'documento';
  if (/\.[a-z0-9]{2,5}$/i.test(base)) return base;
  return base + (EXT_BY_MIME[mimetype.split(';')[0]!.trim()] ?? '');
}

function base64ToBlob(base64: string, mimetype: string): Blob {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mimetype });
}

// Player de áudio estilo WhatsApp: play redondo + forma de onda real (o áudio
// é decodificado e amostrado em 32 barras) + velocidade 1x/1.5x/2x.
// O <audio controls> nativo destoa do design system.
const WAVE_BARS = 32;

function fmtAudioTime(s: number): string {
  if (!isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}

function WaAudioPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const waveRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1
  const [duration, setDuration] = useState(0);
  const [rate, setRate] = useState(1);
  const [bars, setBars] = useState<number[] | null>(null);

  // Forma de onda + duração exata via WebAudio (data URI de ogg/opus reporta
  // duration Infinity no <audio> — o buffer decodificado é a fonte confiável)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const buf = await (await fetch(src)).arrayBuffer();
        const ctx = new AudioContext();
        const decoded = await ctx.decodeAudioData(buf);
        const data = decoded.getChannelData(0);
        const block = Math.max(1, Math.floor(data.length / WAVE_BARS));
        const peaks = Array.from({ length: WAVE_BARS }, (_, i) => {
          let sum = 0;
          let n = 0;
          for (let j = 0; j < block; j += 32) { sum += Math.abs(data[i * block + j] ?? 0); n++; }
          return n ? sum / n : 0;
        });
        const max = Math.max(...peaks, 0.001);
        if (!cancelled) {
          setBars(peaks.map((p) => Math.max(0.18, p / max)));
          setDuration(decoded.duration);
        }
        void ctx.close();
      } catch {
        // Decodificação falhou — barras neutras (player continua funcional)
        if (!cancelled) setBars(Array.from({ length: WAVE_BARS }, (_, i) => 0.3 + 0.45 * Math.abs(Math.sin(i * 1.7))));
      }
    })();
    return () => { cancelled = true; };
  }, [src]);

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playing) { el.pause(); } else { el.playbackRate = rate; void el.play(); }
  };

  const cycleRate = () => {
    const next = rate === 1 ? 1.5 : rate === 1.5 ? 2 : 1;
    setRate(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  };

  const seek = (e: React.MouseEvent) => {
    const el = audioRef.current;
    const wave = waveRef.current;
    if (!el || !wave || !duration) return;
    const rect = wave.getBoundingClientRect();
    const frac = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    el.currentTime = frac * duration;
    setProgress(frac);
  };

  return (
    <div className="flex items-center gap-2 py-0.5" style={{ minWidth: 210 }}>
      <audio
        ref={audioRef}
        src={src}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setProgress(0); }}
        onTimeUpdate={(e) => duration && setProgress(e.currentTarget.currentTime / duration)}
      />
      <button
        onClick={toggle}
        aria-label={playing ? 'Pausar áudio' : 'Ouvir áudio'}
        className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-white"
        style={{ backgroundColor: 'var(--accent)' }}
      >
        {playing ? (
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z" /></svg>
        ) : (
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-3.5 w-3.5 ml-0.5"><path d="M8 5.5v13l10-6.5z" /></svg>
        )}
      </button>
      <div ref={waveRef} onClick={seek} className="flex-1 h-8 flex items-center gap-[2px] cursor-pointer" role="slider" aria-label="Posição do áudio">
        {(bars ?? Array.from({ length: WAVE_BARS }, () => 0.25)).map((b, i) => (
          <span
            key={i}
            className="flex-1 rounded-full"
            style={{
              height: `${Math.round(b * 100)}%`,
              minWidth: 2,
              backgroundColor: i / WAVE_BARS <= progress ? 'var(--accent)' : 'var(--border-md)',
            }}
          />
        ))}
      </div>
      <span className="text-[10px] tabular-nums shrink-0" style={{ color: 'var(--text-muted)' }}>
        {fmtAudioTime(playing || progress > 0 ? progress * duration : duration)}
      </span>
      <button
        onClick={cycleRate}
        className="text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
        style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
        aria-label="Velocidade de reprodução"
      >
        {rate}x
      </button>
    </div>
  );
}

// Mídia sob demanda: o clique baixa o base64 da Evolution (via backend) e
// renderiza imagem/áudio/vídeo inline; documento dispara download. O estado
// sobrevive ao polling de 5s porque o React reconcilia por key={m.id}.
function WaMediaBubble({ clientId, msg }: { clientId: string; msg: CrmWaMessage }) {
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const mediaType = msg.mediaType!;

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await apiService.getCrmWaMedia(clientId, msg.id);
      if (mediaType === 'document') {
        // Documento não tem preview — baixa via Blob (nome/extensão confiáveis)
        const blobUrl = URL.createObjectURL(base64ToBlob(res.data.base64, res.data.mimetype));
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = downloadFileName(msg.fileName, res.data.mimetype);
        a.click();
        setTimeout(() => URL.revokeObjectURL(blobUrl), 10_000);
      } else {
        setSrc(`data:${res.data.mimetype};base64,${res.data.base64}`);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [clientId, msg.id, msg.fileName, mediaType]);

  // Mídia leve (figurinha/imagem/áudio — o WhatsApp comprime) carrega sozinha;
  // vídeo fica por clique (pesado) e documento também (senão baixaria sozinho)
  const autoLoad = mediaType === 'sticker' || mediaType === 'image' || mediaType === 'audio';
  useEffect(() => {
    if (autoLoad) void load();
  }, [autoLoad, load]);

  if (src) {
    if (mediaType === 'audio') return <WaAudioPlayer src={src} />;
    if (mediaType === 'video') return <video controls src={src} className="max-w-full rounded-md" style={{ maxHeight: 240 }} />;
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" className="max-w-full rounded-md" style={{ maxHeight: mediaType === 'sticker' ? 120 : 240 }} />;
  }
  if (autoLoad && !error) {
    return <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Carregando mídia...</p>;
  }
  return (
    <div>
      <button
        onClick={() => void load()}
        disabled={loading}
        className="text-xs underline underline-offset-2 disabled:opacity-60"
        style={{ color: 'var(--accent)' }}
      >
        {loading ? 'Carregando...' : mediaType === 'document' && msg.fileName ? `📎 ${msg.fileName}` : MEDIA_BUTTON_LABEL[mediaType]}
      </button>
      {error && <p className="text-[10px] mt-0.5" style={{ color: 'var(--badge-error-text)' }}>Mídia indisponível (pode ter expirado).</p>}
    </div>
  );
}

function WaConversation({ clientId, variant = 'inline' }: { clientId: string; variant?: 'inline' | 'panel' }) {
  // 'panel' = coluna lateral do drawer (desktop): sempre aberta, ocupa a altura
  // toda e rola pro fim como um chat. 'inline' = seção colapsável (mobile).
  const isPanel = variant === 'panel';
  const [open, setOpen] = useState(isPanel);
  const [loading, setLoading] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [messages, setMessages] = useState<CrmWaMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await apiService.getCrmWhatsappMessages(clientId);
      setAvailable(res.data.available);
      setMessages(res.data.messages);
    } catch {
      if (!silent) {
        setAvailable(false);
        setMessages([]);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [clientId]);

  // Painel lateral já abre carregado (o inline carrega ao expandir)
  useEffect(() => {
    if (isPanel) void load();
  }, [isPanel, load]);

  // Conversa ao vivo: refresh silencioso enquanto a seção está aberta
  useEffect(() => {
    if (!open || !available) return;
    const id = setInterval(() => {
      if (!document.hidden) void load(true);
    }, 5000);
    return () => clearInterval(id);
  }, [open, available, load]);

  // Comportamento de chat: rola pro fim quando a conversa muda
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

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
    <div className={isPanel ? 'flex flex-col h-full min-h-0 p-4' : ''}>
      <div className={`flex items-center justify-between ${isPanel ? 'mb-1' : 'mt-6'}`}>
        {isPanel ? (
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Conversa WhatsApp</p>
        ) : (
          <button onClick={toggle} className="text-sm font-semibold flex items-center gap-1" style={{ color: 'var(--text-primary)' }}>
            Conversa WhatsApp {open ? '▾' : '▸'}
          </button>
        )}
        {open && (
          <button onClick={() => void load()} className="text-xs" style={{ color: 'var(--text-muted)' }} disabled={loading}>
            {loading ? 'Carregando...' : 'Atualizar'}
          </button>
        )}
      </div>
      {open && (
        <div className={isPanel ? 'mt-2 flex-1 min-h-0 flex flex-col' : 'mt-2'}>
          {loading && messages.length === 0 && (
            <p className="text-xs py-3 text-center" style={{ color: 'var(--text-muted)' }}>Buscando conversa...</p>
          )}
          {!loading && available === false && (
            <div className={isPanel ? 'flex-1 flex items-center justify-center px-4' : ''}>
              <p className="text-xs py-3 text-center max-w-[260px] mx-auto" style={{ color: 'var(--text-muted)' }}>
                Sem WhatsApp disponível neste card — a conversa usa o WhatsApp de quem aparece
                em &quot;Responsável&quot;. Conecte um WhatsApp no botão do topo da página para
                conversar e responder por aqui.
              </p>
            </div>
          )}
          {available && messages.length === 0 && !loading && (
            <p className="text-xs py-3 text-center" style={{ color: 'var(--text-muted)' }}>Nenhuma mensagem com este número ainda.</p>
          )}
          {/* No painel, empurra o composer pro rodapé quando não há mensagens */}
          {isPanel && messages.length === 0 && <div className="flex-1" />}
          {messages.length > 0 && (
            <div
              ref={listRef}
              className={`space-y-1.5 overflow-y-auto overscroll-contain rounded-lg p-2.5 ${isPanel ? 'flex-1 min-h-0 flex flex-col' : 'max-h-72'}`}
              style={{ backgroundColor: isPanel ? 'var(--bg-base)' : 'var(--bg-elevated)', border: '1px solid var(--border)' }}
            >
              {/* Conversa curta fica junto do composer (chat cresce de baixo pra cima) */}
              {isPanel && <div className="flex-1" />}
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.fromMe ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className="max-w-[85%] rounded-lg px-2.5 py-1.5"
                    style={m.fromMe
                      ? { backgroundColor: 'var(--accent-dim)', border: '1px solid var(--border)' }
                      : { backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
                  >
                    {m.mediaType && <WaMediaBubble clientId={clientId} msg={m} />}
                    {(!m.mediaType || !isMediaPlaceholder(m.text)) && (
                      <p className="text-xs whitespace-pre-wrap break-words" style={{ color: 'var(--text-primary)' }}>{m.text}</p>
                    )}
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
  onConfirm: (reason: string) => void;
}) {
  // Motivos são da org (configuráveis) — busca ao abrir, sempre atualizados
  const [options, setOptions] = useState<CrmLostReasonOption[] | null>(null);
  const [reason, setReason] = useState('');

  useEffect(() => {
    apiService.getCrmLostReasons()
      .then((res) => {
        setOptions(res.data);
        setReason(res.data[0]?.label ?? '');
      })
      .catch(() => setOptions([]));
  }, []);

  return (
    <ModalShell title="Marcar como perdida" onClose={onClose}>
      <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
        O motivo vira dado — alimenta o relatório de causas de perda.
      </p>
      <label className="text-xs block mb-1" style={label}>Motivo *</label>
      {options === null ? (
        <p className="text-xs py-2 mb-3" style={{ color: 'var(--text-muted)' }}>Carregando motivos...</p>
      ) : options.length === 0 ? (
        <p className="text-xs py-2 mb-3" style={{ color: 'var(--badge-error-text)' }}>
          Não foi possível carregar os motivos. Feche e tente novamente.
        </p>
      ) : (
        <select className="w-full rounded-lg px-3 py-2 text-sm mb-3" style={input} value={reason} onChange={(e) => setReason(e.target.value)}>
          {options.map((r) => <option key={r.id} value={r.label}>{r.label}</option>)}
        </select>
      )}
      <button
        onClick={() => onConfirm(reason)}
        disabled={!reason}
        className="w-full py-2.5 rounded-lg text-sm font-medium disabled:opacity-60"
        style={{ backgroundColor: 'var(--badge-error-bg)', color: 'var(--badge-error-text)', border: '1px solid var(--border-md)' }}
      >
        Confirmar perda
      </button>
    </ModalShell>
  );
}

function LostReasonsEditorModal({ onClose, onSaved, onError }: {
  onClose: () => void;
  onSaved: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [draft, setDraft] = useState<{ id?: string; label: string }[] | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiService.getCrmLostReasons()
      .then((res) => setDraft(res.data.map((o) => ({ id: o.id, label: o.label }))))
      .catch(() => onError('Erro ao carregar os motivos de perda.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    if (!draft) return;
    const valid = draft.filter((s) => s.label.trim());
    if (valid.length === 0) { onError('Informe ao menos 1 motivo de perda.'); return; }
    setSaving(true);
    try {
      const res = await apiService.saveCrmLostReasons(valid);
      onSaved(res.message);
    } catch (err) {
      onError(apiErrorMsg(err, 'Erro ao salvar os motivos.'));
      setSaving(false);
    }
  };

  const move = (i: number, dir: -1 | 1) => {
    setDraft((p) => {
      if (!p) return p;
      const n = [...p];
      const j = i + dir;
      if (j < 0 || j >= n.length) return p;
      [n[i], n[j]] = [n[j]!, n[i]!];
      return n;
    });
  };

  return (
    <ModalShell title="Motivos de perda" onClose={onClose}>
      <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
        Motivos oferecidos ao marcar uma venda como perdida, na ordem. Remover um
        motivo não altera as vendas antigas — elas guardam o texto da época.
      </p>
      {draft === null ? (
        <p className="text-xs py-4 text-center" style={{ color: 'var(--text-muted)' }}>Carregando...</p>
      ) : (
        <>
          <div className="space-y-2 mb-3">
            {draft.map((s, i) => (
              <div key={s.id ?? `new-${i}`} className="flex items-center gap-1.5">
                <input
                  className="flex-1 rounded-lg px-3 py-2 text-sm"
                  style={input}
                  value={s.label}
                  maxLength={60}
                  onChange={(e) => setDraft((p) => p!.map((x, j) => j === i ? { ...x, label: e.target.value } : x))}
                />
                <button onClick={() => move(i, -1)} disabled={i === 0} className="px-1.5 disabled:opacity-30" style={{ color: 'var(--text-muted)' }} aria-label="Subir">↑</button>
                <button onClick={() => move(i, 1)} disabled={i === draft.length - 1} className="px-1.5 disabled:opacity-30" style={{ color: 'var(--text-muted)' }} aria-label="Descer">↓</button>
                <button onClick={() => setDraft((p) => p!.filter((_, j) => j !== i))} className="px-1.5" style={{ color: 'var(--badge-error-text)' }} aria-label="Remover">✕</button>
              </div>
            ))}
          </div>
          <button onClick={() => setDraft((p) => [...(p ?? []), { label: '' }])} className="text-xs mb-4" style={{ color: 'var(--accent)' }}>
            + adicionar motivo
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="w-full py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-60"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            {saving ? 'Salvando...' : 'Salvar motivos'}
          </button>
        </>
      )}
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
