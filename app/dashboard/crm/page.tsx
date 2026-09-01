'use client';

// CRM Próprio (CRM Cortex) — card = cliente, venda = registro à parte.
// Kanban do funil (vendas abertas) + drawer do cliente (vendas, LTV, histórico).
// Visível apenas para orgs sem Kommo conectado (o layout já esconde o menu;
// esta página também trata o acesso direto por URL).

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { apiService, API_BASE_URL } from '@/lib/api';
import type {
  CrmStatus, CrmStage, CrmSummary, CrmClientSummary, CrmClientDetail,
  CrmSale, CrmOrigin, CrmLostReasonOption, CrmDiscardReasonOption, CrmClientTypeOption, CrmTagOption, CrmQuickReply, User, CrmWaStatus, CrmWaMessage,
  CrmTask, CrmTaskType, CrmReport, CrmEvent,
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
  TRIAGE_ACCEPTED: 'Contato aceito no funil',
  TRIAGE_REJECTED: 'Contato arquivado',
  RESPONSIBLE_CHANGED: 'Troca de responsável',
  SALE_WON: 'Venda ganha',
  SALE_LOST: 'Venda perdida',
  SALE_DELETED: 'Venda removida',
  NOTE: 'Nota',
  FOLLOWUP_SET: 'Follow-up agendado',
  FOLLOWUP_CLEARED: 'Follow-up removido',
  TASK_CREATED: 'Tarefa criada',
  TASK_DONE: 'Tarefa concluída',
};

// Evento de tarefa carrega o nome que a pessoa deu (payload.title) — sem ele o
// histórico só dizia "Tarefa concluída", sem qual.
const eventTitle = (e: CrmEvent): string =>
  (e.type === 'TASK_CREATED' || e.type === 'TASK_DONE') && typeof e.payload.title === 'string'
    ? `: ${e.payload.title}`
    : '';

const TASK_TYPE_OPTIONS: { key: CrmTaskType; label: string; icon: string }[] = [
  { key: 'LIGAR',    label: 'Ligar',    icon: '📞' },
  { key: 'WHATSAPP', label: 'WhatsApp', icon: '💬' },
  { key: 'REUNIAO',  label: 'Reunião',  icon: '📅' },
  { key: 'EMAIL',    label: 'E-mail',   icon: '✉️' },
  { key: 'OUTRO',    label: 'Outro',    icon: '📌' },
];

const taskIcon = (t: CrmTaskType) => TASK_TYPE_OPTIONS.find((o) => o.key === t)?.icon ?? '📌';

function fmtMoney(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Máscara de dinheiro ao digitar: reais com ponto de milhar ao vivo, vírgula
// opcional para os centavos (máx 2 casas). Ex: "1980" → "1.980", "1980,5" → "1.980,5".
function maskMoney(raw: string): string {
  let s = raw.replace(/[^\d,]/g, '');
  const firstComma = s.indexOf(',');
  if (firstComma !== -1) {
    // só a primeira vírgula conta — o resto é descartado
    s = s.slice(0, firstComma + 1) + s.slice(firstComma + 1).replace(/,/g, '');
  }
  const hasComma = s.includes(',');
  const [intRaw = '', decRaw = ''] = s.split(',');
  const intDigits = intRaw.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  const intFmt = intDigits === '' ? '' : Number(intDigits).toLocaleString('pt-BR');
  if (!hasComma) return intFmt;
  return `${intFmt === '' ? '0' : intFmt},${decRaw.replace(/\D/g, '').slice(0, 2)}`;
}

// "1.980,50" → 1980.5 (desfaz a máscara para o número enviado ao backend)
function parseMoney(masked: string): number {
  const n = parseFloat(masked.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
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

// Paleta de cores das etapas do funil (kanban). Cada etapa pode escolher uma no
// "Editar funil"; sem escolha, cai na cor por ordem (stageColor).
const STAGE_COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#ef4444', '#64748b'];

// Cor efetiva da etapa: a escolhida, ou a padrão pela ordem no funil.
function stageColor(stage: { color?: string | null; order: number }): string {
  return stage.color ?? STAGE_COLORS[stage.order % STAGE_COLORS.length]!;
}

// Larguras do drawer ajustadas pelo mouse — preferência de quem usa, fica local
const DRAWER_W_KEY = 'crm_drawer_width';
const WA_PANEL_W_KEY = 'crm_wa_panel_width';
// Largura mínima da coluna do card (grid 130px + dropdown 160px + respiro)
const CARD_COL_MIN = 440;

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

const readStoredWidth = (key: string, fallback: number): number => {
  if (typeof window === 'undefined') return fallback; // SSR
  const raw = Number(window.localStorage.getItem(key));
  return Number.isFinite(raw) && raw > 0 ? raw : fallback;
};

const writeStoredWidth = (key: string, value: number) => {
  try { window.localStorage.setItem(key, String(value)); } catch { /* quota/privado — ignora */ }
};

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

/**
 * Há quanto tempo a pessoa espera resposta. A mesma régua do alerta
 * CRM_UNANSWERED (12h) do Telegram, para a tela não contar história diferente
 * do que chega no celular do gestor.
 */
function waitTone(lastInboundAt: string | null): { color: string; label: string } {
  const horas = lastInboundAt ? (Date.now() - new Date(lastInboundAt).getTime()) / 3_600_000 : 0;
  if (horas >= 12) return { color: '#ef4444', label: `esperando há ${Math.floor(horas / 24) >= 1 ? `${Math.floor(horas / 24)}d` : `${Math.floor(horas)}h`}` };
  if (horas >= 4) return { color: '#f59e0b', label: `esperando há ${Math.floor(horas)}h` };
  return { color: '#22c55e', label: horas >= 1 ? `esperando há ${Math.floor(horas)}h` : 'chegou agora há pouco' };
}

function UnreadDot({ lastInboundAt = null }: { lastInboundAt?: string | null }) {
  // Balão de mensagem (não bolinha — bolinha parece status "online").
  // A cor conta a espera: verde recente, âmbar 4h+, vermelho 12h+.
  const tone = waitTone(lastInboundAt);
  const titulo = `Sem resposta — ${tone.label}`;
  return (
    <span
      className="inline-flex items-center justify-center h-4 w-4 rounded-full shrink-0 animate-pulse"
      style={{ backgroundColor: tone.color }}
      title={titulo}
      aria-label={titulo}
    >
      <svg viewBox="0 0 20 20" fill="#ffffff" className="h-2.5 w-2.5">
        <path d="M10 2.5c-4.4 0-8 2.8-8 6.3 0 2 1.2 3.8 3 4.9L4.4 17a.4.4 0 0 0 .6.5l3.2-1.8c.6.1 1.2.2 1.8.2 4.4 0 8-2.8 8-6.3s-3.6-6.3-8-6.3z" />
      </svg>
    </span>
  );
}

// Lead descartado como não qualificado, visível no card sem abrir a timeline.
// O contador denuncia o contato que volta sempre e nunca qualifica ("faz hora",
// "pergunta a mesma coisa"). Aceitar de volta limpa o motivo → o badge some,
// porque o lead voltou a valer; só o contador sobrevive para o próximo descarte.
function DiscardBadge({ client, className = '' }: {
  client: { discardReason: string | null; discardCount: number };
  className?: string;
}) {
  if (!client.discardReason) return null;
  const times = client.discardCount > 1 ? ` ${client.discardCount}x` : '';
  const reason = client.discardReason;
  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded max-w-full truncate ${className}`}
      style={{ backgroundColor: 'var(--badge-error-bg)', color: 'var(--badge-error-text)' }}
      title={`Lead descartado${times} como não qualificado — ${reason}`}
    >
      🚫 Não qualificado{times} · {reason}
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

// ─── Dropdown do design system (substitui <select> nativo) ────────────────────
// variant "pill" = filtros do topo · "field" = campos de formulário/drawer

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      className={`h-3 w-3 shrink-0 transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
      style={{ color: 'var(--text-muted)' }}
      aria-hidden
    >
      <path d="M5.5 7.5 10 12l4.5-4.5" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Fecha ao clicar fora ou apertar Escape. */
function usePopover(): { open: boolean; setOpen: (v: boolean) => void; ref: React.RefObject<HTMLDivElement | null> } {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);
  return { open, setOpen, ref };
}

const popoverPanel = {
  backgroundColor: 'var(--bg-surface)',
  border: '1px solid var(--border-md)',
  boxShadow: '0 10px 28px rgba(2, 12, 27, 0.22)',
} as const;

function Dropdown({ label, value, options, onChange, onOpen, variant = 'field', className = '' }: {
  label?: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  onOpen?: () => void;
  variant?: 'pill' | 'field';
  className?: string;
}) {
  const { open, setOpen, ref } = usePopover();
  const selected = options.find((o) => o.value === value);
  const isPill = variant === 'pill';

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => { const next = !open; setOpen(next); if (next) onOpen?.(); }}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={isPill
          ? 'text-xs rounded-full pl-3 pr-2 py-1.5 inline-flex items-center gap-1.5 max-w-full'
          : 'text-sm rounded-md pl-2.5 pr-2 py-1.5 inline-flex items-center justify-between gap-1.5 w-full text-left'}
        style={{
          backgroundColor: isPill ? 'var(--bg-surface)' : 'var(--bg-elevated)',
          border: `1px solid ${open ? 'var(--accent)' : 'var(--border-md)'}`,
          color: 'var(--text-primary)',
        }}
      >
        <span className="truncate">
          {label && <span style={{ color: 'var(--text-muted)' }}>{label}: </span>}
          {selected?.label ?? '—'}
        </span>
        <Chevron open={open} />
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute z-30 mt-1 min-w-full w-max max-w-[280px] max-h-64 overflow-y-auto rounded-lg py-1"
          style={popoverPanel}
        >
          {options.map((o) => {
            const sel = o.value === value;
            return (
              <button
                key={o.value || '_empty'}
                type="button"
                role="option"
                aria-selected={sel}
                onClick={() => { setOpen(false); if (o.value !== value) onChange(o.value); }}
                className="w-full text-left text-xs px-3 py-2 flex items-center justify-between gap-3 hover:bg-[var(--bg-elevated)]"
                style={{ color: sel ? 'var(--accent)' : 'var(--text-primary)', backgroundColor: sel ? 'var(--accent-dim)' : undefined }}
              >
                <span className="truncate">{o.label}</span>
                {sel && <span aria-hidden>✓</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Menu de ações (header) — itens executam, não selecionam. */
function ActionsMenu({ label, items }: {
  label: string;
  items: { label: string; onClick: () => void }[];
}) {
  const { open, setOpen, ref } = usePopover();
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="px-3 py-2 rounded-lg text-sm inline-flex items-center gap-1.5"
        style={{
          backgroundColor: 'var(--bg-surface)',
          border: `1px solid ${open ? 'var(--accent)' : 'var(--border)'}`,
          color: 'var(--text-secondary)',
        }}
      >
        {label}
        <Chevron open={open} />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-30 mt-1 w-max min-w-[180px] rounded-lg py-1" style={popoverPanel}>
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={() => { setOpen(false); item.onClick(); }}
              className="w-full text-left text-xs px-3 py-2 hover:bg-[var(--bg-elevated)]"
              style={{ color: 'var(--text-primary)' }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
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

  // Filtros client-side (os dados já vêm na lista)
  const [filterUnread, setFilterUnread] = useState(false);
  // Total REAL de não respondidos (contado no banco). O número antigo saía dos
  // 100 cards carregados: no Galpão mostrava 10 de 15, escondendo 5 pessoas.
  const [unreadTotal, setUnreadTotal] = useState(0);
  // Ref porque o loadAll é useCallback e não pode depender do filtro sem recriar
  const filterUnreadRef = useRef(false);
  const [filterResponsible, setFilterResponsible] = useState('');
  const [filterTag, setFilterTag] = useState('');
  const [filterOrigin, setFilterOrigin] = useState('');
  const [filterClientType, setFilterClientType] = useState('');
  const [filterSale, setFilterSale] = useState<'' | 'won' | 'lost'>('');

  // Drawer + modais
  const [detail, setDetail] = useState<CrmClientDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showNewClient, setShowNewClient] = useState(false);
  // Aceita detail (drawer) ou summary (coluna Recorrente) — o modal só usa esses campos
  const [saleModalClient, setSaleModalClient] = useState<Pick<CrmClientSummary, 'id' | 'name' | 'origin' | 'stageId'> | null>(null);
  // id+value bastam para os modais de desfecho — permite abrir tanto do drawer quanto do kanban
  const [winSaleTarget, setWinSaleTarget] = useState<Pick<CrmSale, 'id' | 'value'> | null>(null);
  const [loseSaleTarget, setLoseSaleTarget] = useState<Pick<CrmSale, 'id' | 'value'> | null>(null);
  const [showStagesEditor, setShowStagesEditor] = useState(false);
  const [showLostReasonsEditor, setShowLostReasonsEditor] = useState(false);
  const [showDiscardReasonsEditor, setShowDiscardReasonsEditor] = useState(false);
  const [showClientTypesEditor, setShowClientTypesEditor] = useState(false);
  const [showTagsEditor, setShowTagsEditor] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [orgUsers, setOrgUsers] = useState<User[]>([]);
  const [tasks, setTasks] = useState<CrmTask[]>([]);
  // Listas configuráveis da org — alimentam os seletores no card e os filtros
  const [clientTypes, setClientTypes] = useState<CrmClientTypeOption[]>([]);
  const [crmTags, setCrmTags] = useState<CrmTagOption[]>([]);

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

      const [sum, cl, tk, un] = await Promise.all([
        apiService.getCrmSummary(),
        apiService.getCrmClients({
          take: 100,
          ...(searchTerm ? { search: searchTerm } : {}),
          // Filtro no servidor: os não respondidos podem estar fora dos 100
          // cards mais recentes, e o filtro client-side não os enxergava.
          ...(filterUnreadRef.current ? { unread: true } : {}),
        }),
        apiService.getCrmTasks('open'),
        apiService.getCrmUnreadCount(),
      ]);
      if (seq !== reqSeqRef.current) return; // resposta velha — chegou outra depois
      if (movingRef.current > 0 && !opts?.force) return; // drag em andamento — preserva o otimista
      if (sum.success) setSummary(sum.data);
      if (tk.success) setTasks(tk.data);
      if (un.success) setUnreadTotal(un.data.count);
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

  // Listas configuráveis da org (tipos de cliente + tags): carrega quando o CRM
  // está ativo e após editar cada lista.
  const loadClientTypes = useCallback(async () => {
    try {
      const res = await apiService.getCrmClientTypes();
      if (res.success) setClientTypes(res.data);
    } catch { /* seletor/filtro apenas degradam para vazio */ }
  }, []);

  const loadTags = useCallback(async () => {
    try {
      const res = await apiService.getCrmTags();
      if (res.success) setCrmTags(res.data);
    } catch { /* seletor/filtro apenas degradam para vazio */ }
  }, []);

  useEffect(() => {
    if (!status?.enabled) return;
    void loadClientTypes();
    void loadTags();
  }, [status?.enabled, loadClientTypes, loadTags]);

  // Deep-link: /dashboard/crm?client=<id> abre o drawer direto (link compartilhável)
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('client');
    if (id) void openClient(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Polling leve: cards criados via WhatsApp aparecem sem F5 (e ao voltar o foco).
  // Continua existindo como FALLBACK do stream SSE abaixo (stream fora do ar =
  // comportamento antigo) e é o que mantém o access token renovando via axios.
  useEffect(() => {
    const tick = () => loadAll(searchRef.current.trim() || undefined);
    const interval = setInterval(tick, 15000);
    window.addEventListener('focus', tick);
    return () => { clearInterval(interval); window.removeEventListener('focus', tick); };
  }, [loadAll]);

  // ─── Tempo real (SSE) ────────────────────────────────────────────────
  // A Evolution avisa o backend via webhook a cada mensagem; o backend
  // retransmite { clientId } em /crm/whatsapp/stream. O sinal elimina o delay
  // do polling: lista/kanban recarregam na hora e a conversa aberta refaz o
  // fetch. fetch manual (não EventSource) p/ mandar o Authorization no header.
  const [waSignal, setWaSignal] = useState<{ clientId: string; seq: number } | null>(null);

  useEffect(() => {
    if (!status?.enabled) return;
    let stopped = false;
    let listTimer: ReturnType<typeof setTimeout> | null = null;
    const ctrl = new AbortController();

    const handleEvent = (data: string) => {
      try {
        const ev = JSON.parse(data) as { type?: string; clientId?: string };
        if (ev.type !== 'wa_message' || !ev.clientId) return;
        const clientId = ev.clientId;
        setWaSignal((prev) => ({ clientId, seq: (prev?.seq ?? 0) + 1 }));
        // Coalesce: rajada de mensagens gera UM reload da lista
        if (listTimer) clearTimeout(listTimer);
        listTimer = setTimeout(() => { void loadAll(searchRef.current.trim() || undefined); }, 300);
      } catch { /* linha não-JSON (comentário/heartbeat) — ignora */ }
    };

    const connect = async () => {
      let retryMs = 2000;
      while (!stopped) {
        try {
          const token = localStorage.getItem('auth_token');
          if (!token) throw new Error('sem token');
          const res = await fetch(`${API_BASE_URL}/crm/whatsapp/stream`, {
            headers: { Authorization: `Bearer ${token}` },
            signal: ctrl.signal,
          });
          if (!res.ok || !res.body) throw new Error(`stream ${res.status}`);
          retryMs = 2000; // conectou — zera o backoff
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buf = '';
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            const lines = buf.split('\n');
            buf = lines.pop() ?? ''; // última linha pode estar incompleta
            for (const line of lines) {
              if (line.startsWith('data: ')) handleEvent(line.slice(6));
            }
          }
        } catch {
          if (stopped) return;
        }
        // Conexão caiu (proxy, deploy, token vencido) — reconecta com backoff
        await new Promise((r) => setTimeout(r, retryMs));
        retryMs = Math.min(retryMs * 2, 30000);
      }
    };
    void connect();
    return () => {
      stopped = true;
      ctrl.abort();
      if (listTimer) clearTimeout(listTimer);
    };
  }, [status?.enabled, loadAll]);

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
      if (res.success) {
        setDetail(res.data);
        window.history.replaceState(null, '', `?client=${clientId}`);
      }
    } catch (err) {
      showToast('error', apiErrorMsg(err, 'Erro ao abrir o cliente.'));
    } finally {
      setDetailLoading(false);
    }
  };

  const closeClient = () => {
    setDetail(null);
    window.history.replaceState(null, '', window.location.pathname);
  };

  const refreshDetail = async () => {
    // Sem drawer aberto (ação veio do kanban), atualiza só a lista
    if (!detail) { await loadAll(searchRef.current.trim() || undefined); return; }
    await Promise.all([openClient(detail.id), loadAll(searchRef.current.trim() || undefined)]);
  };

  const handleEnable = async () => {
    // Porta de mão única: nenhum caminho do código desconecta o CRM_CORTEX (não
    // existe disableCrm). Desfazer exige UPDATE manual na integração, e enquanto
    // isso o relatório do cliente passa a mostrar "Leads: 0".
    if (!confirm('Ativar o CRM Cortex? Depois de ativado não dá para desativar pela tela — o dashboard passa a contar leads e vendas por aqui.')) return;
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

  // ─── Tarefas ─────────────────────────────────────────────────────────

  const reloadTasks = async () => {
    try {
      const res = await apiService.getCrmTasks('open');
      if (res.success) setTasks(res.data);
    } catch { /* painel mantém o estado anterior */ }
  };

  const handleAddTask = async (clientId: string, data: { title: string; type: string; dueAt: string }) => {
    try {
      await apiService.createCrmTask(clientId, data);
      await reloadTasks();
    } catch (err) {
      showToast('error', apiErrorMsg(err, 'Erro ao criar a tarefa.'));
    }
  };

  const handleToggleTask = async (task: CrmTask, done: boolean) => {
    // Otimista: concluir some da lista de abertas na hora
    setTasks((prev) => (done ? prev.filter((t) => t.id !== task.id) : prev));
    try {
      await apiService.updateCrmTask(task.id, { done });
      await reloadTasks();
      if (done && detail && task.clientId === detail.id) await openClient(detail.id); // timeline ganha TASK_DONE
    } catch (err) {
      showToast('error', apiErrorMsg(err, 'Erro ao atualizar a tarefa.'));
      await reloadTasks();
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    try {
      await apiService.deleteCrmTask(taskId);
    } catch (err) {
      showToast('error', apiErrorMsg(err, 'Erro ao remover a tarefa.'));
      await reloadTasks();
    }
  };

  // ─── Export CSV ──────────────────────────────────────────────────────

  const handleExport = async () => {
    try {
      const blob = await apiService.exportCrmClients();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `clientes-crm-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      showToast('error', apiErrorMsg(err, 'Erro ao exportar os clientes.'));
    }
  };

  // ─── Drag and drop no kanban ──────────────────────────────────────────

  const [draggingClientId, setDraggingClientId] = useState<string | null>(null);
  const [dropStageId, setDropStageId] = useState<string | null>(null);
  const [dropOutcome, setDropOutcome] = useState<'win' | 'lose' | null>(null);
  const justDraggedRef = useRef(false); // evita o click de abrir o drawer logo após soltar

  // Soltar o card em Ganhar/Perder age na venda aberta do cliente. Sem venda
  // aberta, avisa pra criar uma antes (não reintroduz a venda-zerada).
  const handleOutcomeDrop = (kind: 'win' | 'lose', clientId: string) => {
    setDraggingClientId(null);
    setDropStageId(null);
    setDropOutcome(null);
    const client = clients.find((c) => c.id === clientId);
    const openSale = client?.sales.find((s) => s.status === 'OPEN');
    if (!openSale) {
      showToast('error', 'Crie uma venda no card antes de marcar como ganha/perdida.');
      void openClient(clientId);
      return;
    }
    if (kind === 'win') setWinSaleTarget({ id: openSale.id, value: openSale.value });
    else setLoseSaleTarget({ id: openSale.id, value: openSale.value });
  };

  const handleDropOnClientStage = async (stageId: string, clientId: string, fromStageId: string | null) => {
    setDraggingClientId(null);
    setDropStageId(null);
    if (!clientId || stageId === fromStageId) return;

    // Trava: entrar numa etapa com marco exige venda aberta com valor > 0.
    // Barra aqui para o card não "pular e voltar"; o backend valida de novo.
    const target = status?.stages.find((st) => st.id === stageId);
    const client = clients.find((c) => c.id === clientId);
    if (target && client && stageLocksValue(target) && !hasValuedOpenSale(client)) {
      showToast('error', `"${target.name}" exige uma venda aberta com valor. Abra o card e crie a venda primeiro.`);
      return;
    }

    // Otimista: move o card na UI antes da API responder
    setClients((prev) => prev.map((c) => (c.id === clientId ? { ...c, stageId } : c)));
    movingRef.current++;
    try {
      await apiService.moveCrmClientStage(clientId, stageId);
    } catch (err) {
      showToast('error', apiErrorMsg(err, 'Erro ao mover o card.'));
    } finally {
      movingRef.current--;
      // Reconcilia só quando o último movimento em voo terminar (drags rápidos em sequência)
      if (movingRef.current === 0) await loadAll(searchRef.current.trim() || undefined, { force: true });
    }
  };

  // Triagem: aceitar põe o contato no funil (sem venda, na 1ª etapa).
  const [triaging, setTriaging] = useState<Set<string>>(new Set());

  // Descarte: card escolhido abre o modal de motivo (obrigatório). É a saída do
  // funil para o lead que nunca qualificou — antes disso o jeito era criar venda
  // de R$0 e marcar como perdida, o que virava "venda perdida" no dashboard.
  const [discardTarget, setDiscardTarget] = useState<{ id: string; name: string } | null>(null);

  const handleAccept = async (clientId: string) => {
    setTriaging((prev) => new Set(prev).add(clientId));
    try {
      await apiService.acceptCrmClient(clientId);
      showToast('success', 'Contato aceito no funil.');
      await loadAll(searchRef.current.trim() || undefined, { force: true });
    } catch (err) {
      showToast('error', apiErrorMsg(err, 'Erro ao processar o contato.'));
    } finally {
      setTriaging((prev) => { const next = new Set(prev); next.delete(clientId); return next; });
    }
  };

  const handleDiscard = async (clientId: string, reason: string) => {
    setTriaging((prev) => new Set(prev).add(clientId));
    try {
      await apiService.rejectCrmClient(clientId, reason);
      showToast('success', `Lead descartado — ${reason}.`);
      await loadAll(searchRef.current.trim() || undefined, { force: true });
    } catch (err) {
      showToast('error', apiErrorMsg(err, 'Erro ao descartar o lead.'));
    } finally {
      setTriaging((prev) => { const next = new Set(prev); next.delete(clientId); return next; });
    }
  };

  // Recorrente: "Aceitar" devolve o card fechado pro funil no Novo Lead, SEM
  // exigir venda/valor (igual aceitar um contato novo). A recompra vem depois.
  const handleReopen = async (clientId: string) => {
    const first = status?.stages[0];
    if (!first) return;
    setTriaging((prev) => new Set(prev).add(clientId));
    try {
      await apiService.moveCrmClientStage(clientId, first.id);
      showToast('success', 'Card de volta no funil (Novo Lead).');
      await loadAll(searchRef.current.trim() || undefined, { force: true });
    } catch (err) {
      showToast('error', apiErrorMsg(err, 'Erro ao reabrir o card.'));
    } finally {
      setTriaging((prev) => { const next = new Set(prev); next.delete(clientId); return next; });
    }
  };

  // Recorrente: "Dispensar" marca a conversa como lida (só dúvida, não é recompra)
  // → sai da coluna SEM arquivar o cliente. Se voltar a falar depois, reaparece.
  const handleDismissReturning = async (clientId: string) => {
    setTriaging((prev) => new Set(prev).add(clientId));
    try {
      await apiService.markCrmClientRead(clientId);
      await loadAll(searchRef.current.trim() || undefined, { force: true });
    } catch (err) {
      showToast('error', apiErrorMsg(err, 'Erro ao dispensar o contato.'));
    } finally {
      setTriaging((prev) => { const next = new Set(prev); next.delete(clientId); return next; });
    }
  };

  // ─── Navegação horizontal do kanban ──────────────────────────────────
  // Funil com muitas etapas passa da largura da tela e nada indicava que havia
  // mais colunas: setas nas bordas, arrastar o fundo pra rolar e auto-scroll
  // quando um card é arrastado até a borda.

  const boardRef = useRef<HTMLDivElement | null>(null);
  const boardPanRef = useRef<{ startX: number; startScroll: number } | null>(null);
  const [boardNav, setBoardNav] = useState({ left: false, right: false });

  const updateBoardNav = useCallback(() => {
    const el = boardRef.current;
    if (!el) return;
    const left = el.scrollLeft > 4;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
    setBoardNav((prev) => (prev.left === left && prev.right === right ? prev : { left, right }));
  }, []);

  // Sem deps de propósito: colunas/cards mudam a largura do board a cada load
  // e o guard do setState evita re-render quando nada mudou.
  useEffect(() => {
    updateBoardNav();
    window.addEventListener('resize', updateBoardNav);
    return () => window.removeEventListener('resize', updateBoardNav);
  });

  // Coluna w-64 (256px) + gap-3 (12px) — as setas pulam duas colunas
  const scrollBoard = (dir: -1 | 1) => {
    boardRef.current?.scrollBy({ left: dir * 536, behavior: 'smooth' });
  };

  // Arrastar o fundo do board (não os cards) rola o funil
  const onBoardMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = boardRef.current;
    if (!el || e.button !== 0) return;
    if ((e.target as HTMLElement).closest('button')) return; // card: mantém drag&drop e clique
    // Clique na barra de rolagem nativa (abaixo do clientHeight): deixa o browser cuidar
    if (e.clientY - el.getBoundingClientRect().top > el.clientHeight) return;
    boardPanRef.current = { startX: e.clientX, startScroll: el.scrollLeft };
    const onMove = (ev: MouseEvent) => {
      const pan = boardPanRef.current;
      if (!pan) return;
      el.scrollLeft = pan.startScroll - (ev.clientX - pan.startX);
    };
    const onUp = () => {
      boardPanRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    e.preventDefault(); // sem seleção de texto durante o pan
  };

  // Card arrastado até a borda rola o funil — o auto-scroll nativo do HTML5
  // drag&drop não é confiável entre navegadores
  const onBoardDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    const el = boardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (e.clientX < rect.left + 80) el.scrollLeft -= 24;
    else if (e.clientX > rect.right - 80) el.scrollLeft += 24;
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

  // Filtros client-side sobre a lista carregada
  const filtered = clients.filter((c) =>
    (!filterUnread || hasUnread(c)) &&
    (!filterResponsible || c.responsibleId === filterResponsible ||
      (filterResponsible === '_none' && !c.responsibleId)) &&
    (!filterTag || c.tags.includes(filterTag)) &&
    (!filterOrigin || c.origin === filterOrigin) &&
    (!filterClientType || c.clientType === filterClientType) &&
    (!filterSale ||
      (filterSale === 'won' && c.sales.some((s) => s.status === 'WON')) ||
      (filterSale === 'lost' && c.sales.some((s) => s.status === 'LOST')))
  );
  const hasActiveFilter = filterUnread || !!filterResponsible || !!filterTag || !!filterOrigin || !!filterClientType || !!filterSale;
  // Vem do banco (não de clients.filter): card não respondido pode estar fora
  // dos 100 carregados, e o chip mostraria menos gente esperando do que existe.
  const unreadCount = unreadTotal;
  const responsibleOptions = [...new Map(
    clients.filter((c) => c.responsible).map((c) => [c.responsible!.id, c.responsible!.name])
  ).entries()];
  const tagOptions = crmTags.map((t) => t.label);

  // Triagem: contato novo do WhatsApp espera Aceitar/Rejeitar antes de entrar
  // no funil. Rejeitado sai do board (o card e a conversa continuam existindo).
  const pendingClients = filtered.filter((c) => c.triageStatus === 'PENDING');

  // "Recorrente": cliente já RESOLVIDO (comprou/fechou) que voltou a falar no
  // WhatsApp DEPOIS do fechamento (mensagem não lida após a última venda fechada).
  // Coluna temporária, como "Novos contatos" — some ao reabrir (recompra) ou ao ler.
  const lastClosedAt = (c: CrmClientSummary): string | null =>
    c.sales.filter((s) => s.status !== 'OPEN' && s.closedAt).map((s) => s.closedAt as string).sort().at(-1) ?? null;
  const returningClients = filtered.filter((c) => {
    // Só quem JÁ COMPROU (tem venda ganha → ltv > 0), está FORA do funil (fechou,
    // stageId null) e voltou a falar após o fechamento (não lida depois da última venda).
    if (c.triageStatus !== 'ACCEPTED' || c.stageId || c.ltv <= 0 || !hasUnread(c)) return false;
    const closed = lastClosedAt(c);
    return !!(closed && c.lastInboundAt && c.lastInboundAt > closed);
  });

  // Kanban client-based: o card é o LEAD, agrupado por client.stageId. A venda
  // (dinheiro) é opcional — o valor do card é a soma das vendas abertas.
  // Card sai do funil quando RESOLVIDO: tem venda(s) e todas estão fechadas
  // (ganha/perdida) → vai pra tabela/LTV. Fica quem tem venda aberta ou ainda
  // não tem venda (lead em trabalho). Uma venda nova reabre o card no funil.
  // No funil ATIVO = aceito e com etapa (stageId). Ganhar/perder limpa a etapa
  // (stageId null) → o card sai do funil. Reabre via Aceitar ou nova venda.
  const clientsByStage = new Map<string, CrmClientSummary[]>();
  for (const c of filtered) {
    if (c.triageStatus !== 'ACCEPTED' || !c.stageId) continue;
    if (!clientsByStage.has(c.stageId)) clientsByStage.set(c.stageId, []);
    clientsByStage.get(c.stageId)!.push(c);
  }
  const noStage = clientsByStage.get('_none') ?? [];

  const openValue = (c: CrmClientSummary) =>
    c.sales.reduce((acc, s) => acc + (s.status === 'OPEN' ? s.value : 0), 0);
  const hasValuedOpenSale = (c: CrmClientSummary) =>
    c.sales.some((s) => s.status === 'OPEN' && s.value > 0);
  const oldestOpenSaleAt = (c: CrmClientSummary): string | null =>
    c.sales.filter((s) => s.status === 'OPEN').map((s) => s.createdAt).sort()[0] ?? null;

  // Marco "daqui pra frente exige valor" — o menor order marcado no funil.
  // Espelha stageValueThreshold() do backend; aqui é só para avisar antes.
  const markedOrders = (status?.stages ?? []).filter((s) => s.requiresValue).map((s) => s.order);
  const valueThreshold = markedOrders.length > 0 ? Math.min(...markedOrders) : null;
  const stageLocksValue = (stage: { order: number }) =>
    valueThreshold !== null && stage.order >= valueThreshold;

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
        <button
          onClick={() => setShowReport(true)}
          className="px-3 py-2 rounded-lg text-sm font-medium"
          style={{ ...card, color: 'var(--text-secondary)' }}
        >
          📊 Relatório
        </button>
        {isAdmin && (
          <ActionsMenu
            label="⚙ Configurar"
            items={[
              { label: 'Editar funil', onClick: () => setShowStagesEditor(true) },
              { label: 'Motivos de perda (venda)', onClick: () => setShowLostReasonsEditor(true) },
              { label: 'Motivos de descarte (lead)', onClick: () => setShowDiscardReasonsEditor(true) },
              { label: 'Tipos de cliente', onClick: () => setShowClientTypesEditor(true) },
              { label: 'Tags', onClick: () => setShowTagsEditor(true) },
              { label: 'Importar clientes (CSV)', onClick: () => setShowImport(true) },
              { label: 'Exportar clientes (CSV)', onClick: () => void handleExport() },
            ]}
          />
        )}
        <button
          onClick={() => setShowNewClient(true)}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          + Novo cliente
        </button>
        {/* Manual do CRM — guia de uso completo (serve de /public, vai junto no deploy) */}
        <a
          href="/manual-crm.html"
          target="_blank"
          rel="noopener noreferrer"
          title="Manual do CRM — dúvidas e como usar"
          aria-label="Abrir o manual do CRM"
          className="w-8 h-8 rounded-full text-sm font-bold flex items-center justify-center shrink-0"
          style={{ ...card, color: 'var(--text-muted)' }}
        >
          ?
        </a>
      </div>

      {/* Filtros — aplicam no kanban e na tabela */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button
          onClick={() => {
            const proximo = !filterUnread;
            setFilterUnread(proximo);
            // O filtro é do SERVIDOR: recarrega para trazer também os não
            // respondidos que estavam fora dos 100 cards da tela.
            filterUnreadRef.current = proximo;
            void loadAll(searchRef.current.trim() || undefined, { force: true });
          }}
          className="text-xs px-3 py-1.5 rounded-full font-medium"
          style={filterUnread
            ? { backgroundColor: '#22c55e', color: '#ffffff' }
            : { ...card, color: 'var(--text-secondary)' }}
          title="Conversas com mensagem recebida e ainda sem resposta"
        >
          💬 Não respondidos{unreadCount > 0 ? ` (${unreadCount})` : ''}
        </button>
        {/* O contador é da org inteira, mas o funil só desenha quem está em
            alguma etapa (ou na triagem/recorrente). Card fora do funil existe
            só em Contatos — sem este aviso, some sem explicação. */}
        {filterUnread && unreadCount > 0 && (
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            o funil mostra quem está em alguma etapa —{' '}
            <a href="/dashboard/crm/contatos" style={{ color: 'var(--accent)' }}>ver todos em Contatos</a>
          </span>
        )}
        {isAdmin && (
          <Dropdown
            variant="pill"
            label="Responsável"
            value={filterResponsible}
            onChange={setFilterResponsible}
            options={[
              { value: '', label: 'todos' },
              ...responsibleOptions.map(([id, name]) => ({ value: id, label: name })),
              { value: '_none', label: 'Não atribuído' },
            ]}
          />
        )}
        {tagOptions.length > 0 && (
          <Dropdown
            variant="pill"
            label="Tag"
            value={filterTag}
            onChange={setFilterTag}
            options={[{ value: '', label: 'todas' }, ...tagOptions.map((t) => ({ value: t, label: t }))]}
          />
        )}
        <Dropdown
          variant="pill"
          label="Origem"
          value={filterOrigin}
          onChange={setFilterOrigin}
          options={[{ value: '', label: 'todas' }, ...ORIGIN_OPTIONS.map((o) => ({ value: o.key, label: o.label }))]}
        />
        {clientTypes.length > 0 && (
          <Dropdown
            variant="pill"
            label="Tipo de cliente"
            value={filterClientType}
            onChange={setFilterClientType}
            options={[{ value: '', label: 'todos' }, ...clientTypes.map((t) => ({ value: t.label, label: t.label }))]}
          />
        )}
        <Dropdown
          variant="pill"
          label="Venda"
          value={filterSale}
          onChange={(v) => setFilterSale(v as '' | 'won' | 'lost')}
          options={[
            { value: '', label: 'todas' },
            { value: 'won', label: 'Ganha' },
            { value: 'lost', label: 'Perdida' },
          ]}
        />
        {hasActiveFilter && (
          <button
            onClick={() => { setFilterUnread(false); setFilterResponsible(''); setFilterTag(''); setFilterOrigin(''); setFilterClientType(''); setFilterSale(''); }}
            className="text-xs px-2 py-1.5"
            style={{ color: 'var(--text-muted)' }}
          >
            ✕ limpar ({filtered.length} de {clients.length})
          </button>
        )}
      </div>

      {/* Tarefas do dia — a rotina do vendedor (vencidas + hoje em destaque) */}
      <TasksPanel
        tasks={tasks}
        onToggle={handleToggleTask}
        onOpenClient={openClient}
      />

      {/* Kanban do funil */}
      <div className="relative">
      <div
        ref={boardRef}
        className="flex gap-3 overflow-x-auto pb-3 cursor-grab active:cursor-grabbing"
        onScroll={updateBoardNav}
        onMouseDown={onBoardMouseDown}
        onDragOver={onBoardDragOver}
      >
        {/* Triagem — só aparece quando há contato esperando decisão */}
        {pendingClients.length > 0 && (
          <div
            className="w-64 shrink-0 rounded-xl p-3"
            style={{ ...card, border: '1px dashed var(--accent)' }}
          >
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                Novos contatos
              </span>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{pendingClients.length}</span>
            </div>
            <div className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
              Aceite para entrar no funil
            </div>
            <div className="space-y-2">
              {pendingClients.map((client) => (
                <div
                  key={client.id}
                  className="rounded-lg p-2.5"
                  style={{ backgroundColor: 'var(--bg-elevated)' }}
                >
                  <button
                    onClick={() => openClient(client.id)}
                    className="w-full text-left"
                    title="Abrir a conversa antes de decidir"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <WaAvatar url={client.waAvatarUrl} name={client.name} className="w-6 h-6 text-[10px]" />
                      <div className="text-sm font-medium truncate flex-1 flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                        <span className="truncate">{client.name}</span>
                        {hasUnread(client) && <UnreadDot lastInboundAt={client.lastInboundAt} />}
                      </div>
                    </div>
                    <div className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
                      {fmtPhone(client.phone)}
                    </div>
                    <DiscardBadge client={client} />
                  </button>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => void handleAccept(client.id)}
                      disabled={triaging.has(client.id)}
                      className="flex-1 rounded-md py-1.5 text-xs font-medium transition-opacity disabled:opacity-50"
                      style={{ backgroundColor: 'var(--badge-success-bg)', color: 'var(--badge-success-text)' }}
                    >
                      Aceitar
                    </button>
                    <button
                      onClick={() => setDiscardTarget({ id: client.id, name: client.name })}
                      disabled={triaging.has(client.id)}
                      title="Lead não qualificado — pede o motivo e não cria venda nenhuma"
                      className="flex-1 rounded-md py-1.5 text-xs font-medium transition-opacity disabled:opacity-50"
                      style={{ backgroundColor: 'var(--badge-error-bg)', color: 'var(--badge-error-text)' }}
                    >
                      Descartar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recorrente — quem já comprou e voltou a falar. Temporária como "Novos
            contatos": some ao Reabrir venda (recompra) ou ao abrir/ler a conversa. */}
        {returningClients.length > 0 && (
          <div
            className="w-64 shrink-0 rounded-xl p-3"
            style={{ ...card, border: '1px dashed var(--badge-warn-text)' }}
          >
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                Recorrente
              </span>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{returningClients.length}</span>
            </div>
            <div className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
              Já comprou e voltou a falar
            </div>
            <div className="space-y-2">
              {returningClients.map((client) => (
                <div
                  key={client.id}
                  className="rounded-lg p-2.5"
                  style={{ backgroundColor: 'var(--bg-elevated)' }}
                >
                  <button
                    onClick={() => openClient(client.id)}
                    className="w-full text-left"
                    title="Abrir a conversa"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <WaAvatar url={client.waAvatarUrl} name={client.name} className="w-6 h-6 text-[10px]" />
                      <div className="text-sm font-medium truncate flex-1 flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                        <span className="truncate">{client.name}</span>
                        {hasUnread(client) && <UnreadDot lastInboundAt={client.lastInboundAt} />}
                      </div>
                    </div>
                    <div className="text-xs mb-2 flex items-center justify-between gap-2" style={{ color: 'var(--text-muted)' }}>
                      <span className="truncate">{fmtPhone(client.phone)}</span>
                      <span className="whitespace-nowrap" title="Total já comprado (LTV)">{fmtMoney(client.ltv)}</span>
                    </div>
                  </button>
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => void handleReopen(client.id)}
                      disabled={triaging.has(client.id)}
                      title="Devolve o card pro Novo Lead (recompra)"
                      className="flex-1 rounded-md py-1.5 text-xs font-medium transition-opacity disabled:opacity-50"
                      style={{ backgroundColor: 'var(--badge-success-bg)', color: 'var(--badge-success-text)' }}
                    >
                      Aceitar
                    </button>
                    <button
                      onClick={() => void handleDismissReturning(client.id)}
                      disabled={triaging.has(client.id)}
                      title="Só dúvida do pedido anterior — dispensa da lista (não arquiva)"
                      className="flex-1 rounded-md py-1.5 text-xs font-medium transition-opacity disabled:opacity-50"
                      style={{ backgroundColor: 'var(--badge-error-bg)', color: 'var(--badge-error-text)' }}
                    >
                      Dispensar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {status.stages.map((stage) => {
          const items = clientsByStage.get(stage.id) ?? [];
          const total = items.reduce((acc, c) => acc + openValue(c), 0);
          const isDropTarget = dropStageId === stage.id && draggingClientId !== null;
          const stColor = stageColor(stage);
          return (
            <div
              key={stage.id}
              className="w-64 shrink-0 rounded-xl p-3 transition-colors"
              style={{
                ...card,
                borderTop: `3px solid ${stColor}`,
                ...(isDropTarget ? { border: '1px dashed var(--accent)', backgroundColor: 'var(--accent-dim)' } : {}),
              }}
              onDragOver={(e) => { e.preventDefault(); if (dropStageId !== stage.id) setDropStageId(stage.id); }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node) && dropStageId === stage.id) setDropStageId(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                const payload = e.dataTransfer.getData('text/plain');
                const [clientId, fromStageId] = payload.split('|');
                void handleDropOnClientStage(stage.id, clientId ?? '', fromStageId || null);
              }}
            >
              <div className="flex items-baseline justify-between mb-1">
                <span className="text-sm font-semibold flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: stColor }} aria-hidden />
                  {stage.name}
                  {stageLocksValue(stage) && (
                    <span
                      className="text-xs"
                      style={{ color: 'var(--text-muted)' }}
                      title="Desta etapa em diante o card precisa de uma venda aberta com valor"
                    >
                      🔒
                    </span>
                  )}
                </span>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{items.length}</span>
              </div>
              <div className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>{fmtMoney(total)}</div>
              <div className="space-y-2">
                {items.map((client) => {
                  const val = openValue(client);
                  const refDate = oldestOpenSaleAt(client) ?? client.updatedAt;
                  const days = daysSince(refDate);
                  return (
                  <button
                    key={client.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', `${client.id}|${client.stageId ?? ''}`);
                      e.dataTransfer.effectAllowed = 'move';
                      setDraggingClientId(client.id);
                    }}
                    onDragEnd={() => {
                      setDraggingClientId(null);
                      setDropStageId(null);
                      justDraggedRef.current = true;
                      setTimeout(() => { justDraggedRef.current = false; }, 200);
                    }}
                    onClick={() => { if (!justDraggedRef.current) openClient(client.id); }}
                    className="w-full text-left rounded-lg p-2.5 transition-colors cursor-grab active:cursor-grabbing"
                    style={{
                      backgroundColor: 'var(--bg-elevated)',
                      border: '1px solid var(--border)',
                      opacity: draggingClientId === client.id ? 0.4 : 1,
                    }}
                  >
                    {/* Linha 1: quem é + dias parado. Linha 2: o valor em aberto,
                        sozinho e legível (só quando há venda). Linha 3: os chips. */}
                    <div className="flex items-center gap-2">
                      <WaAvatar url={client.waAvatarUrl} name={client.name} className="w-6 h-6 text-[10px] shrink-0" />
                      <div className="text-sm font-medium truncate flex-1 min-w-0 flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                        <span className="truncate">{client.name}</span>
                        {hasUnread(client) && <UnreadDot lastInboundAt={client.lastInboundAt} />}
                      </div>
                      {days >= STALE_SALE_DAYS ? (
                        <span
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0"
                          style={{ backgroundColor: 'var(--badge-warn-bg)', color: 'var(--badge-warn-text)' }}
                          title={`Card parado há ${days} dias — atenção`}
                        >
                          {days}d
                        </span>
                      ) : (
                        <span className="text-[10px] shrink-0" style={{ color: 'var(--text-muted)' }} title="Dias parado no funil">
                          {days}d
                        </span>
                      )}
                    </div>

                    {val > 0 && (
                      <div className="mt-1.5 text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                        {fmtMoney(val)}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                      <OriginPill origin={client.origin} />
                      <FollowUpChip iso={client.nextFollowUpAt} />
                      <DiscardBadge client={client} />
                      {client.tags.slice(0, 2).map((tag) => {
                        const tc = tagColor(tag);
                        return (
                          <span
                            key={tag}
                            className="inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded max-w-[88px] truncate"
                            style={{ backgroundColor: tc.bg, color: tc.text, border: `1px solid ${tc.border}` }}
                            title={tag}
                          >
                            {tag}
                          </span>
                        );
                      })}
                      {client.tags.length > 2 && (
                        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }} title={client.tags.slice(2).join(', ')}>
                          +{client.tags.length - 2}
                        </span>
                      )}
                    </div>
                  </button>
                  );
                })}
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
      {/* Setas de navegação — só quando há funil fora da tela; escondidas durante
          o arrasto de card (a borda já rola sozinha) */}
      {!draggingClientId && boardNav.left && (
        <button
          onClick={() => scrollBoard(-1)}
          aria-label="Rolar funil para a esquerda"
          className="absolute left-1 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full flex items-center justify-center text-lg shadow-md"
          style={{ ...card, color: 'var(--text-primary)' }}
        >
          ‹
        </button>
      )}
      {!draggingClientId && boardNav.right && (
        <button
          onClick={() => scrollBoard(1)}
          aria-label="Rolar funil para a direita"
          className="absolute right-1 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full flex items-center justify-center text-lg shadow-md"
          style={{ ...card, color: 'var(--text-primary)' }}
        >
          ›
        </button>
      )}
      </div>

      {/* Zonas de desfecho — etapa é caminho, ganho/perda é destino. Só existem durante o arrasto. */}
      {draggingClientId && (
        <div className="flex gap-3 mt-3">
          <div
            onDragOver={(e) => { e.preventDefault(); if (dropOutcome !== 'win') setDropOutcome('win'); }}
            onDragLeave={() => dropOutcome === 'win' && setDropOutcome(null)}
            onDrop={(e) => { e.preventDefault(); handleOutcomeDrop('win', e.dataTransfer.getData('text/plain').split('|')[0] ?? ''); }}
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
            onDrop={(e) => { e.preventDefault(); handleOutcomeDrop('lose', e.dataTransfer.getData('text/plain').split('|')[0] ?? ''); }}
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
          {noStage.length} card(s) sem etapa (a etapa foi removida do funil) — abra o cliente para reposicionar.
        </p>
      )}

      {/* A lista completa de clientes virou a página Contatos (menu lateral) —
          o funil aqui fica enxuto; busca e filtros da carteira inteira ficam lá. */}
      <div className="mt-6 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3" style={card}>
        <div>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Todos os clientes</h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {totalClients} cliente{totalClients === 1 ? '' : 's'} — a lista completa, com busca e filtros, fica em Contatos.
          </p>
        </div>
        <a
          href="/dashboard/crm/contatos"
          className="px-3 py-2 rounded-lg text-sm font-medium shrink-0"
          style={{ backgroundColor: 'var(--accent-dim)', color: 'var(--accent)' }}
        >
          Ver contatos →
        </a>
      </div>

      {/* Drawer do cliente */}
      {(detail || detailLoading) && (
        <ClientDrawer
          detail={detail}
          loading={detailLoading}
          stages={status.stages}
          clientTypes={clientTypes}
          crmTags={crmTags}
          isAdmin={isAdmin}
          currentUserId={user?.id ?? null}
          liveSignal={waSignal}
          orgUsers={orgUsers}
          tasks={detail ? tasks.filter((t) => t.clientId === detail.id) : []}
          onAddTask={handleAddTask}
          onToggleTask={handleToggleTask}
          onDeleteTask={handleDeleteTask}
          onLoadUsers={loadUsersOnce}
          onClose={closeClient}
          onNewSale={() => detail && setSaleModalClient(detail)}
          onWin={(s) => setWinSaleTarget(s)}
          onLose={(s) => setLoseSaleTarget(s)}
          onChangeClientStage={async (stageId) => {
            if (!detail) return;
            try {
              await apiService.moveCrmClientStage(detail.id, stageId);
              await refreshDetail();
              await loadAll(searchRef.current.trim() || undefined, { force: true });
            } catch (err) { showToast('error', apiErrorMsg(err, 'Erro ao mover o card.')); }
          }}
          // Aceitar/dispensar pelo BANNER do drawer não fecha mais o card: quem
          // clica ali está no meio da conversa com a pessoa, e fechar obrigava a
          // procurar o card no Novo Lead e reabrir para continuar respondendo.
          // Só refresca — o banner some sozinho e a etapa aparece atualizada.
          // Descartar continua fechando: ali a intenção é tirar da frente.
          onAcceptTriage={async () => {
            if (!detail) return;
            await handleAccept(detail.id);
            await refreshDetail();
          }}
          onDiscard={() => detail && setDiscardTarget({ id: detail.id, name: detail.name })}
          onReopen={async () => {
            if (!detail) return;
            await handleReopen(detail.id);
            await refreshDetail();
          }}
          onDismissReturning={async () => {
            if (!detail) return;
            await handleDismissReturning(detail.id);
            await refreshDetail();
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
          onUpdateSaleValue={async (saleId, value) => {
            try {
              await apiService.updateCrmSale(saleId, { value });
              showToast('success', 'Valor atualizado.');
              await refreshDetail();
            } catch (err) { showToast('error', apiErrorMsg(err, 'Erro ao atualizar o valor.')); }
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
          onPinNote={async (eventId, pinned) => {
            try {
              await apiService.pinCrmNote(eventId, pinned);
              await refreshDetail();
            } catch (err) { showToast('error', apiErrorMsg(err, 'Erro ao fixar a nota.')); }
          }}
          onEditNote={async (eventId, text) => {
            try {
              await apiService.editCrmNote(eventId, text);
              await refreshDetail();
            } catch (err) { showToast('error', apiErrorMsg(err, 'Erro ao editar a nota.')); }
          }}
          onDeleteNote={async (eventId) => {
            // Nota apagada não volta: confirmação antes, mesmo padrão do "Ativar CRM".
            if (!confirm('Excluir esta nota? Não dá para desfazer.')) return;
            try {
              await apiService.deleteCrmNote(eventId);
              await refreshDetail();
              showToast('success', 'Nota excluída.');
            } catch (err) { showToast('error', apiErrorMsg(err, 'Erro ao excluir a nota.')); }
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
            await loadAll(searchRef.current.trim() || undefined, { force: true });
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

      {discardTarget && (
        <DiscardModal
          clientName={discardTarget.name}
          onClose={() => setDiscardTarget(null)}
          onConfirm={async (reason) => {
            const target = discardTarget;
            setDiscardTarget(null);
            await handleDiscard(target.id, reason);
            // Descartou o card que está aberto → some da frente (a intenção do descarte)
            if (detail?.id === target.id) closeClient();
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

      {showDiscardReasonsEditor && (
        <DiscardReasonsEditorModal
          onClose={() => setShowDiscardReasonsEditor(false)}
          onSaved={(msg) => {
            setShowDiscardReasonsEditor(false);
            showToast('success', msg);
          }}
          onError={(msg) => showToast('error', msg)}
        />
      )}

      {showClientTypesEditor && (
        <ClientTypesEditorModal
          onClose={() => setShowClientTypesEditor(false)}
          onSaved={async (msg) => {
            setShowClientTypesEditor(false);
            showToast('success', msg);
            await loadClientTypes();
          }}
          onError={(msg) => showToast('error', msg)}
        />
      )}

      {showTagsEditor && (
        <TagsEditorModal
          onClose={() => setShowTagsEditor(false)}
          onSaved={async (msg) => {
            setShowTagsEditor(false);
            showToast('success', msg);
            await loadTags();
            if (detail) await refreshDetail();
          }}
          onError={(msg) => showToast('error', msg)}
        />
      )}

      {showImport && (
        <ImportClientsModal
          onClose={() => setShowImport(false)}
          onDone={async (msg) => {
            setShowImport(false);
            showToast('success', msg);
            await loadAll(search.trim() || undefined);
          }}
        />
      )}

      {showReport && <ReportModal onClose={() => setShowReport(false)} />}

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
// ─── Tarefas ──────────────────────────────────────────────────────────────────

// Vencida / hoje / futura — mesma régua de urgência do follow-up
function taskTone(dueAt: string): 'overdue' | 'today' | 'future' {
  const day = new Date(dueAt); day.setHours(0, 0, 0, 0);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return day < today ? 'overdue' : day.getTime() === today.getTime() ? 'today' : 'future';
}

function TaskRow({ task, showClient, onToggle, onOpenClient, onDelete }: {
  task: CrmTask;
  showClient: boolean;
  onToggle: (task: CrmTask, done: boolean) => void;
  onOpenClient?: (clientId: string) => void;
  onDelete?: (taskId: string) => void;
}) {
  const tone = FOLLOWUP_TONE[taskTone(task.dueAt)];
  return (
    <div className="flex items-center gap-2 py-1.5" style={{ borderTop: '1px solid var(--border)' }}>
      <button
        onClick={() => onToggle(task, true)}
        className="w-4 h-4 rounded-full shrink-0 transition-colors"
        style={{ border: '2px solid var(--text-muted)' }}
        title="Concluir tarefa"
        aria-label={`Concluir tarefa ${task.title}`}
      />
      <span className="text-sm shrink-0">{taskIcon(task.type)}</span>
      {/* Sem truncate: título longo quebra linha em vez de virar "verificar o orça..." */}
      <span className="text-sm break-words" title={task.title} style={{ color: 'var(--text-primary)' }}>{task.title}</span>
      {showClient && task.client && (
        <button
          onClick={() => onOpenClient?.(task.client!.id)}
          className="text-xs truncate shrink-0 max-w-[160px] underline-offset-2 hover:underline"
          style={{ color: 'var(--accent)' }}
        >
          {task.client.name}
        </button>
      )}
      <span className="flex-1" />
      {task.responsible && (
        <span className="text-[11px] shrink-0 hidden sm:inline" style={{ color: 'var(--text-muted)' }}>{task.responsible.name}</span>
      )}
      <span
        className="text-[11px] font-medium px-1.5 py-0.5 rounded shrink-0 tabular-nums"
        style={{ color: tone.color, backgroundColor: tone.bg }}
      >
        {new Date(task.dueAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
      </span>
      {onDelete && (
        <button
          onClick={() => onDelete(task.id)}
          className="text-xs shrink-0 px-1"
          style={{ color: 'var(--text-muted)' }}
          title="Remover tarefa"
        >
          ×
        </button>
      )}
    </div>
  );
}

// Painel "Tarefas" no topo do CRM — vencidas + de hoje em destaque (rotina do vendedor)
function TasksPanel({ tasks, onToggle, onOpenClient }: {
  tasks: CrmTask[];
  onToggle: (task: CrmTask, done: boolean) => void;
  onOpenClient: (clientId: string) => void;
}) {
  const [showAll, setShowAll] = useState(false);
  if (tasks.length === 0) return null;

  const overdue = tasks.filter((t) => taskTone(t.dueAt) === 'overdue');
  const today = tasks.filter((t) => taskTone(t.dueAt) === 'today');
  const future = tasks.filter((t) => taskTone(t.dueAt) === 'future');
  const visible = showAll ? tasks : [...overdue, ...today];

  return (
    <div className="rounded-xl p-4 mb-4" style={card}>
      <div className="flex flex-wrap items-center gap-2 mb-1">
        <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Tarefas</h2>
        {overdue.length > 0 && (
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ color: 'var(--badge-error-text)', backgroundColor: 'var(--badge-error-bg)' }}>
            {overdue.length} vencida{overdue.length === 1 ? '' : 's'}
          </span>
        )}
        {today.length > 0 && (
          <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ color: 'var(--badge-warn-text)', backgroundColor: 'var(--badge-warn-bg)' }}>
            {today.length} hoje
          </span>
        )}
        <span className="flex-1" />
        {future.length > 0 && (
          <button onClick={() => setShowAll((v) => !v)} className="text-xs" style={{ color: 'var(--accent)' }}>
            {showAll ? 'só vencidas e de hoje' : `ver todas (${tasks.length})`}
          </button>
        )}
      </div>
      {visible.length === 0 ? (
        <p className="text-xs py-2" style={{ color: 'var(--text-muted)' }}>
          Nada vencido nem para hoje. {future.length} tarefa{future.length === 1 ? '' : 's'} futura{future.length === 1 ? '' : 's'}.
        </p>
      ) : (
        <div>
          {visible.map((t) => (
            <TaskRow key={t.id} task={t} showClient onToggle={onToggle} onOpenClient={onOpenClient} />
          ))}
        </div>
      )}
    </div>
  );
}

// Seção "Tarefas" do drawer — lista pendentes do card + criação inline
function DrawerTasks({ clientId, tasks, onAdd, onToggle, onDelete }: {
  clientId: string;
  tasks: CrmTask[];
  onAdd: (clientId: string, data: { title: string; type: string; dueAt: string }) => Promise<void>;
  onToggle: (task: CrmTask, done: boolean) => void;
  onDelete: (taskId: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [type, setType] = useState<CrmTaskType>('LIGAR');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const t = title.trim();
    if (!t || !date) return;
    setSaving(true);
    try {
      // Fim do dia local — mesma semântica do follow-up (data sem hora = até o fim do dia)
      await onAdd(clientId, { title: t, type, dueAt: new Date(`${date}T23:59:00`).toISOString() });
      setTitle('');
      setAdding(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          Tarefas ({tasks.length})
        </h3>
        <button
          onClick={() => setAdding((v) => !v)}
          className="text-xs px-2.5 py-1.5 rounded-md font-medium"
          style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
        >
          {adding ? 'Cancelar' : '+ Nova tarefa'}
        </button>
      </div>

      {adding && (
        <div className="rounded-lg p-2.5 mb-2 space-y-2" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
          <input
            autoFocus
            className="rounded-md px-2.5 py-1.5 text-sm w-full"
            style={input}
            maxLength={160}
            placeholder="ex: Ligar para confirmar o orçamento"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void submit(); }}
          />
          <div className="flex items-center gap-2">
            <Dropdown
              className="w-fit min-w-[130px]"
              value={type}
              onChange={(v) => setType(v as CrmTaskType)}
              options={TASK_TYPE_OPTIONS.map((o) => ({ value: o.key, label: `${o.icon} ${o.label}` }))}
            />
            <input
              type="date"
              className="rounded-md px-2 py-1.5 text-sm"
              style={input}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            <span className="flex-1" />
            <button
              onClick={() => void submit()}
              disabled={saving || !title.trim() || !date}
              className="text-xs px-3 py-1.5 rounded-md font-medium text-white disabled:opacity-60"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              {saving ? '...' : 'Salvar'}
            </button>
          </div>
        </div>
      )}

      {tasks.length === 0 && !adding ? (
        <p className="text-xs py-1" style={{ color: 'var(--text-muted)' }}>Nenhuma tarefa pendente.</p>
      ) : (
        <div>
          {tasks.map((t) => (
            <TaskRow key={t.id} task={t} showClient={false} onToggle={onToggle} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Relatório de vendas ──────────────────────────────────────────────────────

const REPORT_PERIODS = [
  { value: '1', label: 'Este mês' },
  { value: '3', label: 'Últimos 3 meses' },
  { value: '6', label: 'Últimos 6 meses' },
  { value: '12', label: 'Últimos 12 meses' },
];

function ReportBar({ pct }: { pct: number }) {
  return (
    <div className="h-2 rounded-full flex-1 overflow-hidden" style={{ backgroundColor: 'var(--bg-elevated)' }}>
      <div className="h-full rounded-full" style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: 'var(--accent)' }} />
    </div>
  );
}

function ReportKpi({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
      <p className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p className="text-lg font-bold mt-0.5" style={{ color: accent ?? 'var(--text-primary)' }}>{value}</p>
    </div>
  );
}

function ReportModal({ onClose }: { onClose: () => void }) {
  const [months, setMonths] = useState('3');
  const [report, setReport] = useState<CrmReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    apiService.getCrmReport(Number(months))
      .then((res) => { if (alive && res.success) setReport(res.data); })
      .catch(() => { /* mantém o último resultado */ })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [months]);

  const t = report?.totals;
  const maxReached = Math.max(1, ...(report?.stageFlow.map((s) => s.reached) ?? [1]));
  const maxLost = Math.max(1, ...(report?.lostReasons.map((r) => r.count) ?? [1]));
  const maxDiscard = Math.max(1, ...(report?.discards.reasons.map((r) => r.count) ?? [1]));
  // Cidades: mostra as 10 melhores e abre a lista inteira sob demanda
  const [cityRows, setCityRows] = useState(10);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 sm:p-8 bg-black/50 overflow-y-auto" onClick={onClose}>
      <div
        className="rounded-xl p-5 w-full max-w-3xl"
        style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <h2 className="text-base font-semibold flex-1" style={{ color: 'var(--text-primary)' }}>📊 Relatório de vendas</h2>
          <Dropdown
            className="w-fit min-w-[170px]"
            value={months}
            onChange={setMonths}
            options={REPORT_PERIODS}
          />
          <button onClick={onClose} className="p-1.5 rounded-md" style={{ color: 'var(--text-muted)' }} aria-label="Fechar">✕</button>
        </div>

        {loading && !report ? (
          <p className="text-sm py-10 text-center" style={{ color: 'var(--text-muted)' }}>Calculando...</p>
        ) : !report ? (
          <p className="text-sm py-10 text-center" style={{ color: 'var(--text-muted)' }}>Não foi possível carregar o relatório.</p>
        ) : (
          <div className="space-y-6" style={{ opacity: loading ? 0.6 : 1 }}>
            {/* KPIs do período */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              <ReportKpi label="Vendas ganhas" value={String(t!.wonCount)} accent="var(--badge-success-text)" />
              <ReportKpi label="Receita fechada" value={fmtMoney(t!.wonValue)} accent="var(--badge-success-text)" />
              <ReportKpi label="Perdidas" value={String(t!.lostCount)} accent={t!.lostCount > 0 ? 'var(--badge-error-text)' : undefined} />
              <ReportKpi label="Win rate" value={t!.winRate !== null ? `${t!.winRate}%` : '—'} />
              <ReportKpi label="Ticket médio" value={t!.wonCount > 0 ? fmtMoney(t!.avgTicket) : '—'} />
              <ReportKpi label="Ciclo médio" value={t!.avgCycleDays !== null ? `${t!.avgCycleDays} dias` : '—'} />
            </div>

            {/* Conversão por etapa (coorte: vendas criadas no período) */}
            <div>
              <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Conversão por etapa</h3>
              <p className="text-[11px] mb-2" style={{ color: 'var(--text-muted)' }}>
                {t!.createdCount} venda{t!.createdCount === 1 ? '' : 's'} criada{t!.createdCount === 1 ? '' : 's'} no período · quantas passaram por cada etapa
              </p>
              <div className="space-y-1.5">
                {report.stageFlow.map((s) => (
                  <div key={s.id} className="flex items-center gap-2 text-xs">
                    <span className="w-36 truncate shrink-0" style={{ color: 'var(--text-secondary)' }}>{s.name}</span>
                    <ReportBar pct={(s.reached / maxReached) * 100} />
                    <span className="w-8 text-right tabular-nums shrink-0" style={{ color: 'var(--text-primary)' }}>{s.reached}</span>
                    <span className="w-12 text-right tabular-nums shrink-0" style={{ color: 'var(--text-muted)' }}>
                      {s.conversionFromPrev !== null ? `${s.conversionFromPrev}%` : '—'}
                    </span>
                  </div>
                ))}
                <div className="flex items-center gap-2 text-xs pt-1" style={{ borderTop: '1px solid var(--border)' }}>
                  <span
                    className="w-36 shrink-0 font-semibold leading-tight"
                    style={{ color: 'var(--badge-success-text)' }}
                    title="Das vendas criadas no período, quantas foram ganhas. Diferente do card 'Vendas ganhas' do topo, que conta as FECHADAS no período. Pode passar do número da última etapa: ganhar não exige percorrer o funil inteiro."
                  >
                    Ganhas (das criadas no período)
                  </span>
                  <ReportBar pct={(t!.cohortWon / maxReached) * 100} />
                  <span className="w-8 text-right tabular-nums shrink-0 font-semibold" style={{ color: 'var(--badge-success-text)' }}>{t!.cohortWon}</span>
                  <span className="w-12 shrink-0" />
                </div>
              </div>
            </div>

            {/* Tempo médio por etapa */}
            <div>
              <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Tempo médio em cada etapa</h3>
              <div className="flex flex-wrap gap-2">
                {report.stageDurations.map((s) => (
                  <span
                    key={s.id}
                    className="text-xs px-2.5 py-1.5 rounded-lg"
                    style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
                    title={s.samples > 0 ? `${s.samples} passagem(ns) pela etapa` : 'Sem passagens no período'}
                  >
                    {s.name}: <strong style={{ color: 'var(--text-primary)' }}>{s.avgDays !== null ? `${s.avgDays}d` : '—'}</strong>
                  </span>
                ))}
              </div>
            </div>

            {/* Motivos de perda */}
            {report.lostReasons.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Motivos de perda</h3>
                <div className="space-y-1.5">
                  {report.lostReasons.map((r) => (
                    <div key={r.reason} className="flex items-center gap-2 text-xs">
                      <span className="w-44 truncate shrink-0" style={{ color: 'var(--text-secondary)' }}>{r.reason}</span>
                      <div className="h-2 rounded-full flex-1 overflow-hidden" style={{ backgroundColor: 'var(--bg-elevated)' }}>
                        <div className="h-full rounded-full" style={{ width: `${(r.count / maxLost) * 100}%`, backgroundColor: 'var(--badge-error-text)' }} />
                      </div>
                      <span className="w-8 text-right tabular-nums shrink-0" style={{ color: 'var(--text-primary)' }}>{r.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Leads descartados — separado das vendas de propósito: aqui não
                houve venda nenhuma, é o contato que nunca virou conversa. */}
            {report.discards.total > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                  Leads descartados: {report.discards.total}
                </h3>
                <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
                  Lead que não qualificou — não entra em venda perdida nem no win rate.
                  Muito &quot;clique errado no anúncio&quot; aqui é sinal de mídia, não de vendedor.
                </p>
                <div className="space-y-1.5">
                  {report.discards.reasons.map((r) => (
                    <div key={r.reason} className="flex items-center gap-2 text-xs">
                      <span className="w-44 truncate shrink-0" style={{ color: 'var(--text-secondary)' }}>{r.reason}</span>
                      <div className="h-2 rounded-full flex-1 overflow-hidden" style={{ backgroundColor: 'var(--bg-elevated)' }}>
                        <div className="h-full rounded-full" style={{ width: `${(r.count / maxDiscard) * 100}%`, backgroundColor: 'var(--badge-warn-text)' }} />
                      </div>
                      <span className="w-8 text-right tabular-nums shrink-0" style={{ color: 'var(--text-primary)' }}>{r.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Por cidade — de onde vem quem chega e onde o dinheiro fecha */}
            {report.cities.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Por cidade</h3>
                <p className="text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
                  Leads = cards criados no período · Receita = vendas ganhas. Só conta card com cidade preenchida.
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ color: 'var(--text-muted)' }}>
                        <th className="text-left font-medium py-1.5 pr-3">Cidade</th>
                        <th className="text-right font-medium py-1.5 pr-3">Leads</th>
                        <th className="text-right font-medium py-1.5 pr-3">Vendas</th>
                        <th className="text-right font-medium py-1.5">Receita</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.cities.slice(0, cityRows).map((c) => (
                        <tr key={c.label} style={{ borderTop: '1px solid var(--border)' }}>
                          <td className="py-1.5 pr-3" style={{ color: 'var(--text-primary)' }}>{c.label}</td>
                          <td className="py-1.5 pr-3 text-right tabular-nums" style={{ color: 'var(--text-secondary)' }}>{c.leads}</td>
                          <td className="py-1.5 pr-3 text-right tabular-nums" style={{ color: 'var(--text-secondary)' }}>{c.wonCount}</td>
                          <td className="py-1.5 text-right tabular-nums font-semibold" style={{ color: c.wonValue > 0 ? 'var(--badge-success-text)' : 'var(--text-muted)' }}>
                            {fmtMoney(c.wonValue)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {report.cities.length > cityRows && (
                  <button
                    onClick={() => setCityRows(report.cities.length)}
                    className="text-xs mt-2"
                    style={{ color: 'var(--accent)' }}
                  >
                    ver todas as {report.cities.length} cidades
                  </button>
                )}
              </div>
            )}

            {/* Por vendedor */}
            {report.sellers.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>Por vendedor</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr style={{ color: 'var(--text-muted)' }}>
                        <th className="text-left font-medium py-1.5 pr-3">Vendedor</th>
                        <th className="text-right font-medium py-1.5 pr-3">Ganhas</th>
                        <th className="text-right font-medium py-1.5 pr-3">Receita</th>
                        <th className="text-right font-medium py-1.5 pr-3">Ticket médio</th>
                        <th className="text-right font-medium py-1.5">Win rate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.sellers.map((s) => (
                        <tr key={s.id ?? '_none'} style={{ borderTop: '1px solid var(--border)' }}>
                          <td className="py-1.5 pr-3 font-medium" style={{ color: 'var(--text-primary)' }}>{s.name}</td>
                          <td className="py-1.5 pr-3 text-right tabular-nums" style={{ color: 'var(--text-secondary)' }}>{s.wonCount}</td>
                          <td className="py-1.5 pr-3 text-right tabular-nums font-semibold" style={{ color: 'var(--badge-success-text)' }}>{fmtMoney(s.wonValue)}</td>
                          <td className="py-1.5 pr-3 text-right tabular-nums" style={{ color: 'var(--text-secondary)' }}>{s.wonCount > 0 ? fmtMoney(s.avgTicket) : '—'}</td>
                          <td className="py-1.5 text-right tabular-nums" style={{ color: 'var(--text-secondary)' }}>{s.winRate !== null ? `${s.winRate}%` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

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

// ─── Cidade do card ──────────────────────────────────────────────────────
// Os 5.571 municípios do IBGE vivem em /cidades.json (164 KB). O arquivo só é
// baixado quando alguém abre o campo, e uma vez por sessão — a página do CRM
// já é pesada e a maioria das visitas não edita cidade.

type Cidade = { n: string; u: string };
let cidadesCache: Cidade[] | null = null;
let cidadesReq: Promise<Cidade[]> | null = null;

function loadCidades(): Promise<Cidade[]> {
  if (cidadesCache) return Promise.resolve(cidadesCache);
  if (!cidadesReq) {
    cidadesReq = fetch('/cidades.json')
      .then((r) => r.json())
      .then((d: Cidade[]) => { cidadesCache = d; return d; })
      .catch(() => { cidadesReq = null; return []; }); // deixa tentar de novo
  }
  return cidadesReq;
}

// A busca ignora acento e caixa ("sao goncalo" acha "São Gonçalo") — reusa o
// `norm` que o import de CSV já usa para casar cabeçalho.

// Campo com autocomplete. Guarda a UF junto (nunca exibida no card) porque 232
// nomes de município se repetem em outro estado — sem ela o relatório somaria
// "Bom Jesus" do Piauí com o da Paraíba.
function CityField({ city, state, onSave }: {
  city: string | null;
  state: string | null;
  onSave: (city: string | null, state: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [options, setOptions] = useState<Cidade[]>([]);
  const [loading, setLoading] = useState(false);

  const open = () => {
    setDraft(city ?? '');
    setEditing(true);
    if (!cidadesCache) setLoading(true);
    void loadCidades().then((d) => { setOptions(d); setLoading(false); });
  };

  if (!editing) {
    return (
      <button
        onClick={open}
        className="text-sm text-left truncate max-w-full"
        style={{ color: city ? 'var(--text-primary)' : 'var(--text-muted)' }}
        title={city && state ? `${city} · ${state}` : 'Clique para editar'}
      >
        {city || 'adicionar cidade'} <span style={{ color: 'var(--text-muted)' }}>✎</span>
      </button>
    );
  }

  const termo = norm(draft);
  // Quem começa com o termo vem primeiro — digitar "for" mostra Fortaleza antes
  // de Belo Horizonte. Teto de 8 para a lista não virar uma parede.
  const matches = termo.length < 2 ? [] : (() => {
    const comeca: Cidade[] = [];
    const contem: Cidade[] = [];
    for (const c of options) {
      const nome = norm(c.n);
      if (nome.startsWith(termo)) comeca.push(c);
      else if (nome.includes(termo)) contem.push(c);
      if (comeca.length >= 8) break;
    }
    return [...comeca, ...contem].slice(0, 8);
  })();

  const escolher = (c: Cidade) => { setEditing(false); onSave(c.n, c.u); };

  return (
    <div className="relative">
      <div className="flex items-center gap-1.5">
        <input
          autoFocus
          className="rounded-md px-2 py-1 text-sm w-full"
          style={input}
          value={draft}
          maxLength={80}
          placeholder="digite a cidade..."
          onChange={(e) => setDraft(e.target.value)}
          // Blur atrasado: sem isso o clique na sugestão fecha a lista antes de registrar
          onBlur={() => setTimeout(() => setEditing(false), 150)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setEditing(false);
            if (e.key === 'Enter' && matches.length > 0) escolher(matches[0]!);
          }}
        />
        {city && (
          <button
            onMouseDown={(e) => { e.preventDefault(); setEditing(false); onSave(null, null); }}
            className="text-xs px-1.5 shrink-0"
            style={{ color: 'var(--badge-error-text)' }}
            title="Limpar cidade"
          >
            ✕
          </button>
        )}
      </div>
      {(loading || matches.length > 0 || termo.length >= 2) && (
        <div
          className="absolute z-20 mt-1 w-full rounded-lg overflow-hidden"
          style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
        >
          {loading ? (
            <div className="px-2.5 py-2 text-xs" style={{ color: 'var(--text-muted)' }}>Carregando cidades...</div>
          ) : matches.length === 0 ? (
            <div className="px-2.5 py-2 text-xs" style={{ color: 'var(--text-muted)' }}>Nenhuma cidade encontrada.</div>
          ) : (
            matches.map((c) => (
              <button
                key={`${c.n}|${c.u}`}
                // mouseDown vem antes do blur do input — click puro não dispararia
                onMouseDown={(e) => { e.preventDefault(); escolher(c); }}
                className="w-full text-left px-2.5 py-1.5 text-sm hover:opacity-80"
                style={{ color: 'var(--text-primary)' }}
              >
                {c.n} <span style={{ color: 'var(--text-muted)' }}>· {c.u}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
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
  clientTypes: CrmClientTypeOption[];
  crmTags: CrmTagOption[];
  isAdmin: boolean;
  currentUserId: string | null;
  liveSignal: { clientId: string; seq: number } | null;
  orgUsers: User[];
  tasks: CrmTask[];
  onAddTask: (clientId: string, data: { title: string; type: string; dueAt: string }) => Promise<void>;
  onToggleTask: (task: CrmTask, done: boolean) => void;
  onDeleteTask: (taskId: string) => void;
  onLoadUsers: () => void;
  onClose: () => void;
  onNewSale: () => void;
  onWin: (s: CrmSale) => void;
  onLose: (s: CrmSale) => void;
  onChangeClientStage: (stageId: string) => void;
  onAcceptTriage: () => Promise<void>;
  /** Abre o modal de motivo — o descarte só acontece com motivo escolhido. */
  onDiscard: () => void;
  onReopen: () => Promise<void>;
  onDismissReturning: () => Promise<void>;
  onTransfer: (responsibleId: string | null) => void;
  onDeleteSale: (saleId: string) => void;
  onUpdateSaleValue: (saleId: string, value: number) => Promise<void>;
  onUpdateClient: (data: { name?: string; company?: string | null; clientType?: string | null; email?: string | null; city?: string | null; state?: string | null; nextFollowUpAt?: string | null; origin?: CrmOrigin; tags?: string[] }) => Promise<void>;
  onAddNote: (text: string) => Promise<void>;
  onPinNote: (eventId: string, pinned: boolean) => Promise<void>;
  onEditNote: (eventId: string, text: string) => Promise<void>;
  onDeleteNote: (eventId: string) => Promise<void>;
}) {
  const { detail, loading, stages, isAdmin, orgUsers, tasks } = props;
  const isDesktop = useIsDesktop();
  // Sinal do stream só interessa se for do cliente aberto neste drawer
  const waRefresh =
    props.liveSignal && detail && props.liveSignal.clientId === detail.id ? props.liveSignal.seq : 0;
  const [showEvents, setShowEvents] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  // Editar o valor de uma venda aberta sem recriar o card: contato novo entra na
  // triagem com valor 0 e, ao cair numa etapa de orçamento, precisa informar o valor.
  const [editingValueSale, setEditingValueSale] = useState<string | null>(null);
  const [valueDraft, setValueDraft] = useState('');
  const [savingValue, setSavingValue] = useState(false);
  const [addingTag, setAddingTag] = useState(false);
  // Ação de recorrência (Aceitar/Dispensar) em andamento — desabilita os botões do banner
  const [returningBusy, setReturningBusy] = useState(false);
  // Ação de triagem (Aceitar/Rejeitar do contato novo) em andamento
  const [triageBusy, setTriageBusy] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  // Nome do card: vem do pushName do WhatsApp (o que a pessoa pôs no perfil),
  // então precisa ser corrigível. Editado no banner, que tem cor fixa — o
  // InlineField usa vars de tema e sumiria no fundo escuro.
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');

  // Larguras ajustáveis pelo mouse (pedido da chefe: definir o tamanho da aba).
  // Duas alças: a borda esquerda do drawer (área total) e a divisória entre o
  // card e a conversa. Ficam no localStorage — do jeito que ela deixou.
  const [drawerWidth, setDrawerWidth] = useState(() => readStoredWidth(DRAWER_W_KEY, 896));
  const [waWidth, setWaWidth] = useState(() => readStoredWidth(WA_PANEL_W_KEY, 380));
  const [dragging, setDragging] = useState<null | 'drawer' | 'wa'>(null);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      if (dragging === 'drawer') {
        // Drawer é ancorado à direita: largura = quanto sobra do cursor até a borda
        const w = clamp(window.innerWidth - e.clientX, 560, Math.max(560, window.innerWidth - 80));
        setDrawerWidth(w);
        // Estreitar o drawer não pode deixar a conversa comendo a coluna do card
        setWaWidth((prev) => clamp(prev, 300, Math.max(300, w - CARD_COL_MIN)));
      } else {
        // A coluna do card não comprime abaixo de 440px: o grid é label 130px +
        // dropdown 160px + padding, então em 320px o conteúdo cortava na borda.
        // Para uma conversa maior que isso, arrasta-se a borda do drawer também.
        const w = clamp(window.innerWidth - e.clientX, 300, Math.max(300, drawerWidth - CARD_COL_MIN));
        setWaWidth(w);
      }
    };
    const onUp = () => setDragging(null);
    // Sem isso o arrasto seleciona texto da página inteira
    const prevSelect = document.body.style.userSelect;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      document.body.style.userSelect = prevSelect;
      document.body.style.cursor = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [dragging, drawerWidth]);

  // Persiste só ao soltar — gravar a cada pixel do arrasto é desperdício
  useEffect(() => {
    if (dragging) return;
    writeStoredWidth(DRAWER_W_KEY, drawerWidth);
    writeStoredWidth(WA_PANEL_W_KEY, waWidth);
  }, [dragging, drawerWidth, waWidth]);
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

  const addTag = (label: string) => {
    setAddingTag(false);
    if (!detail) return;
    if (detail.tags.some((x) => x.toLowerCase() === label.toLowerCase())) return;
    void props.onUpdateClient({ tags: [...detail.tags, label] });
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

  const saveSaleValue = async (s: CrmSale) => {
    const parsed = parseMoney(valueDraft);
    if (parsed < 0) return;
    if (parsed === s.value) { setEditingValueSale(null); return; }
    setSavingValue(true);
    try {
      await props.onUpdateSaleValue(s.id, parsed);
      setEditingValueSale(null);
    } finally {
      setSavingValue(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50" onClick={props.onClose} />
      <aside
        className="fixed inset-y-0 right-0 z-50 w-full max-w-lg lg:max-w-none flex flex-col overflow-hidden"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderLeft: '1px solid var(--border)',
          ...(isDesktop ? { width: drawerWidth } : {}),
        }}
      >
        {/* Alça: arrastar a borda esquerda define a largura total do drawer */}
        {isDesktop && (
          <div
            onMouseDown={(e) => { e.preventDefault(); setDragging('drawer'); }}
            onDoubleClick={() => setDrawerWidth(896)}
            className="absolute inset-y-0 left-0 w-1.5 z-10 cursor-col-resize"
            style={{ backgroundColor: dragging === 'drawer' ? 'var(--accent)' : 'transparent' }}
            title="Arraste para redimensionar · duplo clique volta ao padrão"
          />
        )}
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
                    {editingName ? (
                      <input
                        autoFocus
                        className="text-xl font-semibold mt-0.5 w-full rounded px-1.5 py-0.5 outline-none"
                        style={{
                          color: '#ffffff',
                          backgroundColor: 'rgba(255,255,255,0.14)',
                          border: '1px solid rgba(255,255,255,0.35)',
                        }}
                        value={nameDraft}
                        maxLength={120}
                        onChange={(e) => setNameDraft(e.target.value)}
                        onBlur={() => setEditingName(false)}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') { setEditingName(false); return; }
                          if (e.key !== 'Enter') return;
                          const novo = nameDraft.trim();
                          setEditingName(false);
                          if (!novo || novo === detail.name) return;
                          void props.onUpdateClient({ name: novo });
                        }}
                      />
                    ) : (
                      <button
                        onClick={() => { setNameDraft(detail.name); setEditingName(true); }}
                        className="group flex items-center gap-1.5 max-w-full text-left"
                        title="Clique para renomear o contato"
                      >
                        <h2 className="text-xl font-semibold truncate mt-0.5" style={{ color: '#ffffff' }}>{detail.name}</h2>
                        <span
                          className="text-xs opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                          style={{ color: 'rgba(255,255,255,0.7)' }}
                          aria-hidden
                        >
                          ✎
                        </span>
                      </button>
                    )}
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
                {props.crmTags.length > 0 ? (
                  <div className="relative">
                    <button
                      onClick={() => setAddingTag((v) => !v)}
                      className="text-[11px] px-2 py-0.5 rounded-md"
                      style={{ border: '1px dashed rgba(255,255,255,0.4)', color: 'rgba(255,255,255,0.75)' }}
                    >
                      + tag
                    </button>
                    {addingTag && (() => {
                      const available = props.crmTags.filter(
                        (t) => !detail.tags.some((x) => x.toLowerCase() === t.label.toLowerCase())
                      );
                      return (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setAddingTag(false)} />
                          <div className="absolute z-20 mt-1 left-0 w-44 max-h-56 overflow-y-auto rounded-lg p-1" style={popoverPanel}>
                            {available.length === 0 ? (
                              <p className="text-[11px] px-2 py-1.5" style={{ color: 'var(--text-muted)' }}>Todas as tags já foram atribuídas.</p>
                            ) : available.map((t) => (
                              <button
                                key={t.id}
                                onClick={() => addTag(t.label)}
                                className="w-full text-left text-xs px-2 py-1.5 rounded-md"
                                style={{ color: 'var(--text-primary)' }}
                              >
                                {t.label}
                              </button>
                            ))}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                ) : (
                  <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.55)' }}>
                    Configure em ⚙ Configurar → Tags
                  </span>
                )}
              </div>

              {/* Funil — posição do CARD, ou o desfecho quando resolvido (ganho/perdido) */}
              {(() => {
                const resolved = !detail.stageId; // fora do funil (ganho/perdido)
                const lastClosed = resolved
                  ? [...detail.sales].sort((a, b) => (b.closedAt ?? '').localeCompare(a.closedAt ?? ''))[0]
                  : null;
                const outcome = lastClosed?.status ?? null; // 'WON' | 'LOST'
                const activeIdx = stages.findIndex((st) => st.id === detail.stageId);
                const stageName = outcome === 'WON' ? 'Venda ganha'
                  : outcome === 'LOST' ? 'Venda perdida'
                  : (stages.find((st) => st.id === detail.stageId)?.name ?? 'Sem etapa');
                // Nome da etapa ativa segue a cor da própria etapa (mesma do kanban)
                const activeColor = activeIdx >= 0 ? stageColor(stages[activeIdx]!) : null;
                const nameColor = outcome === 'WON' ? '#4ade80'
                  : outcome === 'LOST' ? '#f87171'
                  : activeColor ?? 'rgba(255,255,255,0.6)';
                return (
                  <div className="mt-3">
                    <p className="text-[10px] uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.55)' }}>Funil de Vendas</p>
                    <p className="text-sm font-semibold mt-0.5" style={{ color: nameColor }}>{stageName}</p>
                    <div className="flex gap-1 mt-1.5">
                      {stages.map((st, i) => {
                        // Cada segmento preenchido usa a cor da SUA etapa (segue o dashboard)
                        const filled = outcome === 'WON' ? '#4ade80'
                          : outcome === 'LOST' ? '#f87171'
                          : activeIdx >= 0 && i <= activeIdx ? stageColor(st)
                          : 'rgba(255,255,255,0.22)';
                        return <span key={st.id} title={st.name} className="h-1.5 flex-1 rounded-full" style={{ backgroundColor: filled }} />;
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Triagem — mesmo Aceitar/Rejeitar da coluna "Novos contatos", agora dentro
                do card: contato novo do WhatsApp aguardando decisão antes de entrar no funil. */}
            {detail.triageStatus === 'PENDING' && (
              <div className="mt-4 rounded-lg p-3" style={{ backgroundColor: 'var(--accent-dim)', border: '1px solid var(--accent)' }}>
                <p className="text-sm font-semibold" style={{ color: 'var(--accent)' }}>Contato novo do WhatsApp</p>
                <p className="text-xs mt-0.5 mb-2.5" style={{ color: 'var(--text-secondary)' }}>
                  Aceite para entrar no funil (Novo Lead) ou descarte informando por que o lead não qualificou.
                </p>
                {/* Lead que já foi descartado antes e voltou a mandar mensagem —
                    o histórico evita gastar atendimento de novo com o mesmo caso. */}
                <DiscardBadge client={detail} className="mb-2.5" />
                <div className="flex gap-2">
                  <button
                    onClick={async () => { setTriageBusy(true); try { await props.onAcceptTriage(); } finally { setTriageBusy(false); } }}
                    disabled={triageBusy}
                    className="flex-1 rounded-md py-1.5 text-xs font-medium transition-opacity disabled:opacity-50"
                    style={{ backgroundColor: 'var(--badge-success-bg)', color: 'var(--badge-success-text)' }}
                    title="Coloca o contato no funil, na primeira etapa"
                  >
                    Aceitar
                  </button>
                  <button
                    onClick={props.onDiscard}
                    disabled={triageBusy}
                    className="flex-1 rounded-md py-1.5 text-xs font-medium transition-opacity disabled:opacity-50"
                    style={{ backgroundColor: 'var(--badge-error-bg)', color: 'var(--badge-error-text)' }}
                    title="Lead não qualificado — pede o motivo e não cria venda nenhuma"
                  >
                    Descartar
                  </button>
                </div>
              </div>
            )}

            {/* Descarte do lead já aceito: até então a única saída do funil era
                fechar uma venda, e quem nunca conversou virava venda de R$0
                perdida — venda que não existiu, contada no dashboard. */}
            {detail.triageStatus === 'ACCEPTED' && (
              <div className="mt-3 flex items-center justify-between gap-2">
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Lead não qualificou (não responde, clique errado...)?
                </span>
                <button
                  onClick={props.onDiscard}
                  className="text-xs font-medium px-2.5 py-1.5 rounded-md whitespace-nowrap"
                  style={{ backgroundColor: 'var(--badge-error-bg)', color: 'var(--badge-error-text)' }}
                  title="Tira o card do funil informando o motivo — sem criar venda, sem contar como venda perdida"
                >
                  Descartar lead
                </button>
              </div>
            )}

            {/* Recorrente — mesmo Aceitar/Dispensar da coluna do kanban, agora dentro do
                card: cliente que já comprou (fora do funil) e mandou nova mensagem. */}
            {(() => {
              const lastClosed = detail.sales
                .filter((s) => s.status !== 'OPEN' && s.closedAt)
                .map((s) => s.closedAt as string).sort().at(-1) ?? null;
              const isReturning =
                detail.triageStatus === 'ACCEPTED' && !detail.stageId && detail.ltv > 0 &&
                hasUnread(detail) && !!lastClosed && !!detail.lastInboundAt && detail.lastInboundAt > lastClosed;
              if (!isReturning) return null;
              return (
                <div className="mt-4 rounded-lg p-3" style={{ backgroundColor: 'var(--badge-warn-bg)', border: '1px solid var(--badge-warn-text)' }}>
                  <p className="text-sm font-semibold" style={{ color: 'var(--badge-warn-text)' }}>Cliente recorrente voltou a falar</p>
                  <p className="text-xs mt-0.5 mb-2.5" style={{ color: 'var(--text-secondary)' }}>
                    Já comprou (LTV {fmtMoney(detail.ltv)}) e mandou uma nova mensagem. É recompra ou só dúvida do pedido anterior?
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={async () => { setReturningBusy(true); try { await props.onReopen(); } finally { setReturningBusy(false); } }}
                      disabled={returningBusy}
                      className="flex-1 rounded-md py-1.5 text-xs font-medium transition-opacity disabled:opacity-50"
                      style={{ backgroundColor: 'var(--badge-success-bg)', color: 'var(--badge-success-text)' }}
                      title="Devolve o card pro Novo Lead (recompra)"
                    >
                      Aceitar no funil
                    </button>
                    <button
                      onClick={async () => { setReturningBusy(true); try { await props.onDismissReturning(); } finally { setReturningBusy(false); } }}
                      disabled={returningBusy}
                      className="flex-1 rounded-md py-1.5 text-xs font-medium transition-opacity disabled:opacity-50"
                      style={{ backgroundColor: 'var(--badge-error-bg)', color: 'var(--badge-error-text)' }}
                      title="Só dúvida do pedido anterior — dispensa da lista (não arquiva)"
                    >
                      Dispensar
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* Nota fixada — no TOPO do card, não só no topo da timeline.
                Fixar já ordenava a lista certo, mas "Notas e histórico" fica no
                fim do drawer: conforme o atendimento gera tarefas e vendas, a
                nota era empurrada para fora da tela e quem abria o card não a
                via — justamente o oposto de "lembrete que não pode sumir". */}
            {(() => {
              const fixadas = detail.events.filter((e) => e.type === 'NOTE' && e.pinnedAt);
              if (fixadas.length === 0) return null;
              return (
                <div className="mt-4 space-y-2">
                  {fixadas.map((e) => (
                    <div
                      key={`pin-${e.id}`}
                      className="rounded-lg p-3"
                      style={{ backgroundColor: 'var(--accent-dim)', border: '1px solid var(--accent)' }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm whitespace-pre-wrap flex-1" style={{ color: 'var(--text-primary)' }}>
                          📌 {String(e.payload?.text ?? '')}
                        </p>
                        {/* Excluir também aqui: a nota fixada é a mais visível do card, e sem
                            isso apagá-la exigia desafixar, rolar até a timeline e só então excluir. */}
                        <button
                          onClick={() => void props.onDeleteNote(e.id)}
                          className="text-xs shrink-0"
                          style={{ color: 'var(--badge-error-text)' }}
                          title="Excluir nota"
                          aria-label="Excluir nota"
                        >
                          🗑
                        </button>
                        <button
                          onClick={() => void props.onPinNote(e.id, false)}
                          className="text-xs shrink-0"
                          style={{ color: 'var(--text-muted)' }}
                          title="Desafixar nota"
                          aria-label="Desafixar nota"
                        >
                          ✕
                        </button>
                      </div>
                      <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                        {e.actor?.name ?? 'Nota'} · {fmtDate(e.createdAt)}
                      </p>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Principal — campos do card (espelha a aba "Principal" do Kommo) */}
            <div className="mt-4 space-y-2.5">
              <div className="grid grid-cols-[130px_1fr] items-center gap-2">
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Responsável</span>
                {isAdmin ? (
                  <Dropdown
                    className="w-fit min-w-[180px]"
                    value={detail.responsibleId ?? ''}
                    onOpen={props.onLoadUsers}
                    onChange={(v) => props.onTransfer(v || null)}
                    options={[
                      // Antes da lista carregar, mostra ao menos o atual
                      ...(orgUsers.length === 0 && detail.responsible
                        ? [{ value: detail.responsible.id, label: detail.responsible.name }]
                        : []),
                      { value: '', label: 'Não atribuído' },
                      ...orgUsers.map((u) => ({ value: u.id, label: u.name })),
                    ]}
                  />
                ) : (
                  <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{detail.responsible?.name ?? 'Não atribuído'}</span>
                )}
              </div>

              {detail.triageStatus === 'ACCEPTED' && detail.stageId && (
                <div className="grid grid-cols-[130px_1fr] items-center gap-2">
                  <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Etapa</span>
                  <Dropdown
                    className="w-fit min-w-[160px]"
                    value={detail.stageId ?? ''}
                    onChange={(v) => v && props.onChangeClientStage(v)}
                    options={[
                      ...(!detail.stageId ? [{ value: '', label: 'Sem etapa' }] : []),
                      ...stages.map((st) => ({ value: st.id, label: st.name })),
                    ]}
                  />
                </div>
              )}

              <div className="grid grid-cols-[130px_1fr] items-center gap-2">
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>LTV</span>
                <span className="text-sm font-bold" style={{ color: 'var(--badge-success-text)' }} title="Soma automática das vendas ganhas">
                  {fmtMoney(detail.ltv)}
                </span>
              </div>

              <div className="grid grid-cols-[130px_1fr] items-center gap-2">
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Tipo de cliente</span>
                <Dropdown
                  className="w-fit min-w-[160px]"
                  value={detail.clientType ?? ''}
                  onChange={(v) => void props.onUpdateClient({ clientType: v || null })}
                  options={[
                    { value: '', label: '—' },
                    ...props.clientTypes.map((t) => ({ value: t.label, label: t.label })),
                    // valor antigo (texto livre) que não está mais na lista: mantém visível
                    ...(detail.clientType && !props.clientTypes.some((t) => t.label === detail.clientType)
                      ? [{ value: detail.clientType, label: `${detail.clientType} (fora da lista)` }]
                      : []),
                  ]}
                />
              </div>

              <div className="grid grid-cols-[130px_1fr] items-center gap-2">
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Origem</span>
                <Dropdown
                  className="w-fit min-w-[160px]"
                  value={detail.origin}
                  onChange={(v) => void props.onUpdateClient({ origin: v as CrmOrigin })}
                  options={ORIGIN_OPTIONS.map((o) => ({ value: o.key, label: o.label }))}
                />
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

              <div className="grid grid-cols-[130px_1fr] items-start gap-2">
                <span className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Cidade</span>
                <CityField
                  city={detail.city}
                  state={detail.state}
                  onSave={(city, state) => void props.onUpdateClient({ city, state })}
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

            {/* Tarefas do card */}
            <DrawerTasks
              clientId={detail.id}
              tasks={tasks}
              onAdd={props.onAddTask}
              onToggle={props.onToggleTask}
              onDelete={props.onDeleteTask}
            />

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
                      {editingValueSale === s.id ? (
                        <span className="flex items-center gap-1">
                          <input
                            className="w-24 rounded-md px-2 py-1 text-sm text-right"
                            style={input}
                            inputMode="decimal"
                            placeholder="0,00"
                            value={valueDraft}
                            autoFocus
                            onChange={(e) => setValueDraft(maskMoney(e.target.value))}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') void saveSaleValue(s);
                              if (e.key === 'Escape') setEditingValueSale(null);
                            }}
                          />
                          <button
                            disabled={savingValue}
                            onClick={() => void saveSaleValue(s)}
                            className="text-xs px-1.5 py-1 rounded-md font-bold"
                            style={{ backgroundColor: 'var(--badge-success-bg)', color: 'var(--badge-success-text)' }}
                            aria-label="Salvar valor"
                          >✓</button>
                          <button
                            onClick={() => setEditingValueSale(null)}
                            className="text-xs px-1.5 py-1"
                            style={{ color: 'var(--text-muted)' }}
                            aria-label="Cancelar edição do valor"
                          >✕</button>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5">
                          <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{fmtMoney(s.value)}</span>
                          {s.status === 'OPEN' && (s.segments?.length ?? 0) === 0 && (
                            <button
                              onClick={() => { setEditingValueSale(s.id); setValueDraft(s.value > 0 ? maskMoney(String(s.value).replace('.', ',')) : ''); }}
                              className="text-xs"
                              style={{ color: 'var(--text-muted)' }}
                              aria-label="Editar valor da venda"
                              title="Editar valor"
                            >✏️</button>
                          )}
                        </span>
                      )}
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
                        <button
                          onClick={() => props.onWin(s)}
                          className="flex-1 text-xs px-2.5 py-1 rounded-md font-medium"
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
                      className="group rounded-lg p-2.5 text-xs"
                      style={{
                        backgroundColor: e.pinnedAt ? 'var(--accent-dim)' : 'var(--bg-elevated)',
                        borderLeft: '2px solid var(--accent)',
                      }}
                    >
                      {editingNote === e.id ? (
                        <NoteEditor
                          initial={String(e.payload?.text ?? '')}
                          onCancel={() => setEditingNote(null)}
                          onSave={async (texto) => {
                            await props.onEditNote(e.id, texto);
                            setEditingNote(null);
                          }}
                        />
                      ) : (
                        <div className="flex items-start gap-2">
                          <p className="whitespace-pre-wrap flex-1 min-w-0" style={{ color: 'var(--text-primary)' }}>
                            {String(e.payload?.text ?? '')}
                          </p>
                          <button
                            onClick={() => setEditingNote(e.id)}
                            className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            style={{ color: 'var(--text-muted)' }}
                            title="Editar nota"
                            aria-label="Editar nota"
                          >
                            ✎
                          </button>
                          <button
                            onClick={() => void props.onPinNote(e.id, !e.pinnedAt)}
                            className={`shrink-0 transition-opacity ${e.pinnedAt ? '' : 'opacity-0 group-hover:opacity-100'}`}
                            style={{ color: e.pinnedAt ? 'var(--accent)' : 'var(--text-muted)' }}
                            title={e.pinnedAt ? 'Desafixar nota' : 'Fixar no topo'}
                            aria-label={e.pinnedAt ? 'Desafixar nota' : 'Fixar no topo'}
                          >
                            📌
                          </button>
                          <button
                            onClick={() => void props.onDeleteNote(e.id)}
                            className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            style={{ color: 'var(--badge-error-text)' }}
                            title="Excluir nota"
                            aria-label="Excluir nota"
                          >
                            🗑
                          </button>
                        </div>
                      )}
                      <p className="mt-1" style={{ color: 'var(--text-muted)' }}>
                        {e.pinnedAt && <span style={{ color: 'var(--accent)' }}>Fixada · </span>}
                        {e.actor?.name ?? 'Nota'} · {fmtDate(e.createdAt)}
                        {e.payload?.editedAt ? ' · editada' : ''}
                      </p>
                    </div>
                  ) : (
                    <div key={e.id} className="text-xs flex items-baseline gap-2" style={{ color: 'var(--text-muted)' }}>
                      <span className="shrink-0 tabular-nums">{fmtDate(e.createdAt)}</span>
                      <span className="break-words" style={{ color: 'var(--text-secondary)' }}>
                        {EVENT_LABELS[e.type] ?? e.type}{eventTitle(e)}
                      </span>
                      {e.actor?.name && <span>· {e.actor.name}</span>}
                    </div>
                  )
                )}
              </div>
            )}

            {/* Conversa WhatsApp no fluxo — só no mobile (desktop usa o painel lateral) */}
            {!isDesktop && (
              <WaConversation
                clientId={detail.id}
                clientName={detail.name}
                canEdit={isAdmin}
                canSend={detail.responsibleId !== null && detail.responsibleId === props.currentUserId}
                responsibleName={detail.responsible?.name ?? null}
                onAssumir={() => props.onTransfer(props.currentUserId)}
                refreshSignal={waRefresh}
              />
            )}
          </div>
          </div>

          {/* Painel lateral da conversa (desktop) — como no Kommo */}
          {isDesktop && (
            <>
            {/* Divisória card ↔ conversa */}
            <div
              onMouseDown={(e) => { e.preventDefault(); setDragging('wa'); }}
              onDoubleClick={() => setWaWidth(380)}
              className="w-1.5 shrink-0 cursor-col-resize transition-colors"
              style={{ backgroundColor: dragging === 'wa' ? 'var(--accent)' : 'var(--border)' }}
              title="Arraste para dar mais espaço à conversa · duplo clique volta ao padrão"
            />
            <div
              className="shrink-0 flex flex-col min-h-0"
              style={{ width: waWidth, backgroundColor: 'var(--bg-elevated)' }}
            >
              <WaConversation
                clientId={detail.id}
                clientName={detail.name}
                canEdit={isAdmin}
                canSend={detail.responsibleId !== null && detail.responsibleId === props.currentUserId}
                responsibleName={detail.responsible?.name ?? null}
                onAssumir={() => props.onTransfer(props.currentUserId)}
                refreshSignal={waRefresh}
                variant="panel"
              />
            </div>
            </>
          )}
          </div>
        )}
      </aside>
    </>
  );
}

// ─── WhatsApp do vendedor ─────────────────────────────────────────────────────

// Só ADMIN/SUPER_ADMIN conectam o número da organização — TRAFFIC_MANAGER está
// no ADMIN_ROLES da página mas o backend recusa, então teria botão dando 403.
const WA_ORG_ROLES = ['ADMIN', 'SUPER_ADMIN'];

function WhatsappConnectButton({ showToast }: { showToast: (type: 'success' | 'error', msg: string) => void }) {
  const { user } = useAuth();
  const podeGerirOrg = WA_ORG_ROLES.includes(user?.role ?? '');

  const [waStatus, setWaStatus] = useState<CrmWaStatus | null>(null);
  const [orgStatus, setOrgStatus] = useState<CrmWaStatus | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  // Qual número está sendo pareado agora — null = ninguém, só mostrando o estado
  const [pareando, setPareando] = useState<'user' | 'org' | null>(null);
  const [working, setWorking] = useState(false);

  const refreshStatus = useCallback(async (scope?: 'org') => {
    try {
      const res = await apiService.getCrmWhatsappStatus(scope);
      if (res.success) (scope === 'org' ? setOrgStatus : setWaStatus)(res.data);
      return res.data;
    } catch { return null; }
  }, []);

  useEffect(() => {
    void refreshStatus();
    // O número da empresa é informação de todo mundo: o vendedor sem número
    // próprio precisa saber por qual número os cards dele são respondidos.
    void refreshStatus('org');
  }, [refreshStatus]);

  // Pareamento: renova o QR a cada 25s e verifica conexão a cada 3s
  useEffect(() => {
    if (!showModal || !pareando) return;
    const scope = pareando === 'org' ? ('org' as const) : undefined;
    const poll = setInterval(async () => {
      const st = await refreshStatus(scope);
      if (st?.connected) {
        setQr(null);
        setPareando(null);
        showToast('success', `WhatsApp conectado${st.phone ? ` (${fmtPhone(st.phone)})` : ''}.`);
      }
    }, 3000);
    const renewQr = setInterval(async () => {
      try {
        const res = await apiService.connectCrmWhatsapp(scope);
        if (res.data.qrcode) setQr(res.data.qrcode);
      } catch { /* mantém o QR atual */ }
    }, 25000);
    return () => { clearInterval(poll); clearInterval(renewQr); };
  }, [showModal, pareando, refreshStatus, showToast]);

  const iniciarPareamento = async (alvo: 'user' | 'org') => {
    const scope = alvo === 'org' ? ('org' as const) : undefined;
    setWorking(true);
    setQr(null);
    try {
      const res = await apiService.connectCrmWhatsapp(scope);
      if (res.data.connected) {
        await refreshStatus(scope);
        setPareando(null);
      } else {
        setQr(res.data.qrcode);
        setPareando(alvo);
      }
    } catch (err) {
      showToast('error', apiErrorMsg(err, 'Erro ao iniciar conexão do WhatsApp.'));
      setPareando(null);
    } finally {
      setWorking(false);
    }
  };

  const handleOpen = async () => {
    setShowModal(true);
    setQr(null);
    setPareando(null);
    void refreshStatus();
    void refreshStatus('org');
    // Vendedor sem número próprio: o caminho é sempre parear o dele, então já
    // abre no QR — é o fluxo que a operação usa hoje, sem clique a mais.
    if (!podeGerirOrg && !waStatus?.connected) await iniciarPareamento('user');
  };

  const handleDisconnect = async (alvo: 'user' | 'org') => {
    const msg = alvo === 'org'
      ? 'Desconectar o WhatsApp da EMPRESA? As conversas que saem por ele param de ser rastreadas.'
      : 'Desconectar seu WhatsApp do CRM? O rastreio de conversas para.';
    if (!confirm(msg)) return;
    setWorking(true);
    try {
      await apiService.disconnectCrmWhatsapp(alvo === 'org' ? 'org' : undefined);
      (alvo === 'org' ? setOrgStatus : setWaStatus)({ configured: false, connected: false });
      setQr(null);
      setPareando(null);
      showToast('success', 'WhatsApp desconectado.');
    } catch (err) {
      showToast('error', apiErrorMsg(err, 'Erro ao desconectar.'));
    } finally {
      setWorking(false);
    }
  };

  const connected = waStatus?.connected ?? false;
  const orgConectado = orgStatus?.connected ?? false;
  // Modos exclusivos: o backend recusa com 409, então a tela desabilita antes e diz o motivo
  const orgBloqueado = !orgConectado && orgStatus?.blockedBy === 'individual';
  const meuBloqueado = !connected && waStatus?.blockedBy === 'org';
  const quemTrava = orgStatus?.blockedNames ?? [];

  return (
    <>
      {/* Verde quando HÁ um número atendendo — o próprio ou o da empresa: com o
          número da empresa conectado o CRM já funciona para quem não tem o seu. */}
      <button
        onClick={handleOpen}
        className="px-3 py-2 rounded-lg text-sm flex items-center gap-1.5"
        style={connected || orgConectado
          ? { backgroundColor: 'var(--badge-success-bg)', color: 'var(--badge-success-text)' }
          : { ...card, color: 'var(--text-secondary)' }}
        title={
          connected
            ? `Seu WhatsApp conectado${waStatus?.phone ? `: ${fmtPhone(waStatus.phone)}` : ''}`
            : orgConectado
              ? `Atendendo pelo número da empresa${orgStatus?.phone ? `: ${fmtPhone(orgStatus.phone)}` : ''}`
              : 'Conectar um WhatsApp ao CRM'
        }
      >
        {connected || orgConectado ? '✓ WhatsApp' : 'Conectar WhatsApp'}
      </button>

      {showModal && (
        <ModalShell title="WhatsApp do CRM" onClose={() => setShowModal(false)}>
          {pareando ? (
            <div className="space-y-3 text-center">
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                {pareando === 'org' ? 'Número da empresa. ' : ''}
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
              <button
                onClick={() => { setPareando(null); setQr(null); }}
                className="text-xs underline-offset-2"
                style={{ color: 'var(--text-muted)' }}
              >
                Voltar
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Meu número */}
              <section className="rounded-lg p-3" style={{ backgroundColor: 'var(--bg-elevated)' }}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Meu número</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {connected
                        ? `Conectado${waStatus?.phone ? ` como ${fmtPhone(waStatus.phone)}` : ''} — seus cards são respondidos por ele.`
                        : meuBloqueado
                          ? 'A empresa atende por um número único. Peça a um administrador para desconectá-lo antes de conectar o seu.'
                          : 'Não conectado. Contato novo vira card atribuído a você.'}
                    </p>
                  </div>
                  <button
                    onClick={() => (connected ? handleDisconnect('user') : iniciarPareamento('user'))}
                    disabled={working || meuBloqueado}
                    title={meuBloqueado ? 'A empresa usa um número único' : undefined}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap disabled:opacity-60"
                    style={connected
                      ? { backgroundColor: 'var(--badge-error-bg)', color: 'var(--badge-error-text)' }
                      : { backgroundColor: 'var(--accent)', color: '#fff' }}
                  >
                    {connected ? 'Desconectar' : 'Conectar'}
                  </button>
                </div>
              </section>

              {/* Número da empresa (compartilhado) */}
              <section className="rounded-lg p-3" style={{ backgroundColor: 'var(--bg-elevated)' }}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Número da empresa</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {orgConectado
                        ? `Conectado${orgStatus?.phone ? ` (${fmtPhone(orgStatus.phone)})` : ''} — atende quem não tem número próprio.`
                        : orgBloqueado
                          ? `Desconecte primeiro o WhatsApp de ${quemTrava.slice(0, 3).join(', ')}${quemTrava.length > 3 ? ` e mais ${quemTrava.length - 3}` : ''} — é um número único OU números por vendedor, nunca os dois.`
                          : 'Não conectado. Um número só para a equipe inteira: quem atende muda trocando o responsável do card.'}
                    </p>
                  </div>
                  {podeGerirOrg ? (
                    <button
                      onClick={() => (orgConectado ? handleDisconnect('org') : iniciarPareamento('org'))}
                      disabled={working || orgBloqueado}
                      title={orgBloqueado ? 'Desconecte os números individuais antes' : undefined}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap disabled:opacity-60"
                      style={orgConectado
                        ? { backgroundColor: 'var(--badge-error-bg)', color: 'var(--badge-error-text)' }
                        : { backgroundColor: 'var(--accent)', color: '#fff' }}
                    >
                      {orgConectado ? 'Desconectar' : 'Conectar'}
                    </button>
                  ) : (
                    <span className="text-xs whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                      Só administrador
                    </span>
                  )}
                </div>
              </section>

              {connected && orgConectado && (
                <p className="text-xs rounded-lg p-2.5" style={{ backgroundColor: 'var(--bg-surface)', color: 'var(--text-muted)' }}>
                  Os dois estão conectados: seus cards saem pelo <strong>seu</strong> número; os demais, pelo número da empresa.
                </p>
              )}
              <p className="text-xs rounded-lg p-2.5" style={{ backgroundColor: 'var(--bg-surface)', color: 'var(--text-muted)' }}>
                Nos primeiros minutos após conectar, o WhatsApp sincroniza os dados em segundo plano —
                o rastreio de mensagens novas já está ativo desde agora.
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

// Localização recebida: o WhatsApp manda só lat/lng (nome/endereço quase nunca
// vêm), então o que resolve pro vendedor é o link do mapa + a coordenada pra
// copiar. Sem mapa embutido: exigiria chave de API e uma chamada a terceiro
// direto do navegador do cliente.
function WaLocationBubble({ location }: { location: NonNullable<CrmWaMessage['location']> }) {
  const coords = `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`;
  const mapa = `https://www.google.com/maps/search/?api=1&query=${location.lat},${location.lng}`;
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
        📍 {location.live ? 'Localização em tempo real' : 'Localização'}
      </span>
      {location.name && (
        <span className="text-xs" style={{ color: 'var(--text-primary)' }}>{location.name}</span>
      )}
      {location.address && (
        <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>{location.address}</span>
      )}
      {/* --text-secondary, não --text-muted: medido na tela, muted dá 2.06:1 na bolha
          enviada em dark (é cinza ESCURO sobre fundo escuro). A coordenada existe
          pra ser lida e copiada — não é enfeite como o horário. */}
      <span className="text-[10px] tabular-nums" style={{ color: 'var(--text-secondary)' }}>{coords}</span>
      <a
        href={mapa}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center justify-center rounded-md px-2 py-1 text-[11px] font-medium no-underline"
        style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
      >
        Abrir no mapa
      </a>
    </div>
  );
}

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

/**
 * Baixa um Blob com o nome escolhido.
 * ⚠️ O <a> PRECISA estar no documento: fora dele o Firefox/Edge ignoram o
 * atributo `download` e o arquivo é salvo com o UUID do blob, sem extensão
 * (reportado pelo Benny em 22/07 ao baixar uma imagem). O export CSV já fazia
 * certo; os downloads de mídia não — este helper unifica os três.
 */
function baixarBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
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
// Imagem em tela cheia com download. O drawer é z-50, então o overlay precisa
// vir acima; o Esc para aqui (stopPropagation) senão fecharia o card junto.
function WaImageLightbox({ src, raw, fileName, onClose }: {
  src: string;
  raw: { base64: string; mimetype: string };
  fileName?: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onClose();
    };
    // capture: chega antes do handler do drawer
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  const baixar = () => {
    // Imagem do WhatsApp não traz fileName (só documento traz) — sem isso o
    // arquivo salvo sairia como "documento.jpg"
    baixarBlob(
      base64ToBlob(raw.base64, raw.mimetype),
      downloadFileName(fileName ?? 'imagem-whatsapp', raw.mimetype),
    );
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col"
      style={{ backgroundColor: 'rgba(0,0,0,0.9)' }}
      onClick={onClose}
    >
      <div className="flex justify-end gap-2 p-3 shrink-0" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={baixar}
          className="text-sm font-medium rounded-lg px-3 py-2"
          style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: '#ffffff' }}
        >
          ⬇ Baixar
        </button>
        <button
          onClick={onClose}
          className="text-sm font-medium rounded-lg px-3 py-2"
          style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: '#ffffff' }}
          aria-label="Fechar"
        >
          ✕
        </button>
      </div>
      {/* Clicar na imagem não fecha — só no fundo, como no WhatsApp Web */}
      <div className="flex-1 min-h-0 flex items-center justify-center p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt="Imagem em tamanho real"
          className="max-w-full max-h-full object-contain"
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    </div>
  );
}

function WaMediaBubble({ clientId, msg }: { clientId: string; msg: CrmWaMessage }) {
  const [src, setSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const mediaType = msg.mediaType!;
  // Guarda o base64 cru: o download usa Blob (data URI grande baixa corrompido
  // no Chrome — mesmo motivo do documento) e a lupa reusa a mídia já baixada.
  const [raw, setRaw] = useState<{ base64: string; mimetype: string } | null>(null);
  const [zoom, setZoom] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await apiService.getCrmWaMedia(clientId, msg.id);
      if (mediaType === 'document') {
        // Documento não tem preview — baixa via Blob (nome/extensão confiáveis)
        baixarBlob(
          base64ToBlob(res.data.base64, res.data.mimetype),
          downloadFileName(msg.fileName, res.data.mimetype),
        );
      } else {
        setSrc(`data:${res.data.mimetype};base64,${res.data.base64}`);
        setRaw({ base64: res.data.base64, mimetype: res.data.mimetype });
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
    // Figurinha não precisa de lupa; imagem sim — comprovante/orçamento chega
    // por foto e no tamanho da bolha é ilegível.
    if (mediaType === 'sticker') {
      // eslint-disable-next-line @next/next/no-img-element
      return <img src={src} alt="" className="max-w-full rounded-md" style={{ maxHeight: 120 }} />;
    }
    return (
      <>
        <button
          onClick={() => setZoom(true)}
          className="block w-full cursor-zoom-in"
          title="Clique para ampliar"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="Imagem recebida no WhatsApp" className="max-w-full rounded-md" style={{ maxHeight: 240 }} />
        </button>
        {zoom && raw && (
          <WaImageLightbox
            src={src}
            raw={raw}
            fileName={msg.fileName}
            onClose={() => setZoom(false)}
          />
        )}
      </>
    );
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

function WaConversation({ clientId, clientName, canEdit, canSend, responsibleName, onAssumir, refreshSignal = 0, variant = 'inline' }: {
  clientId: string;
  clientName: string;
  canEdit: boolean;
  canSend: boolean;      // só o responsável do card responde (regra 16/07)
  responsibleName: string | null;
  /** Assume o card (vira responsável) e libera o composer — sem isso o lead novo
   *  do número da empresa exige passar pelo seletor de responsável antes de responder. */
  onAssumir?: () => void | Promise<void>;
  refreshSignal?: number; // incrementa quando o stream SSE avisa mensagem deste cliente
  variant?: 'inline' | 'panel';
}) {
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
  const fileRef = useRef<HTMLInputElement>(null);
  const [sendingFile, setSendingFile] = useState(false);
  const [showReplies, setShowReplies] = useState(false);
  const [replies, setReplies] = useState<CrmQuickReply[] | null>(null);
  const [showRepliesEditor, setShowRepliesEditor] = useState(false);
  const [highlightIdx, setHighlightIdx] = useState(0);
  // Mensagem sendo respondida (citação estilo WhatsApp)
  const [replyTo, setReplyTo] = useState<CrmWaMessage | null>(null);
  const draftRef = useRef<HTMLTextAreaElement | null>(null);

  // Escolher "responder" leva o foco pro composer, como no WhatsApp
  useEffect(() => {
    if (replyTo) draftRef.current?.focus();
  }, [replyTo]);

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
  // (fallback do stream SSE — quando o stream está de pé a atualização
  // instantânea vem pelo refreshSignal abaixo)
  useEffect(() => {
    if (!open || !available) return;
    const id = setInterval(() => {
      if (!document.hidden) void load(true);
    }, 5000);
    return () => clearInterval(id);
  }, [open, available, load]);

  // Sinal do stream: mensagem nova deste cliente → refetch imediato
  useEffect(() => {
    if (refreshSignal > 0 && open) void load(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshSignal]);

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
      await apiService.sendCrmWhatsappMessage(clientId, text, replyTo?.id);
      setDraft('');
      setReplyTo(null);
      await load();
    } catch (err) {
      setSendError(apiErrorMsg(err, 'Erro ao enviar a mensagem.'));
    } finally {
      setSending(false);
    }
  };

  const toggleReplies = async () => {
    const next = !showReplies;
    setShowReplies(next);
    if (next && replies === null) {
      try {
        const res = await apiService.getCrmQuickReplies();
        setReplies(res.data);
      } catch {
        setReplies([]);
      }
    }
  };

  const insertReply = (text: string) => {
    // {nome} = primeiro nome do cliente
    const firstName = clientName.trim().split(/\s+/)[0] ?? '';
    setDraft(text.replace(/\{nome\}/gi, firstName));
    setShowReplies(false);
  };

  // Atalho "/" — digitar /saudacao filtra as respostas rápidas pelo título;
  // ↑/↓ navega, Enter/Tab aplica, Esc limpa. Sem match, Enter envia normal.
  const slashQuery = draft.startsWith('/') ? draft.slice(1) : null;
  useEffect(() => {
    if (slashQuery !== null && replies === null) {
      apiService.getCrmQuickReplies().then((res) => setReplies(res.data)).catch(() => setReplies([]));
    }
  }, [slashQuery, replies]);
  const slashMatches = slashQuery !== null && replies
    ? replies.filter((r) => norm(r.title).includes(norm(slashQuery)))
    : null;
  useEffect(() => { setHighlightIdx(0); }, [slashQuery]);

  const composerKeyDown = (e: React.KeyboardEvent) => {
    // Esc cancela a citação antes de mexer no texto (comportamento do WhatsApp).
    // Só quando o painel de respostas rápidas não está capturando o Esc.
    if (e.key === 'Escape' && replyTo && !slashMatches?.length) {
      setReplyTo(null);
      return;
    }
    if (!slashMatches || slashMatches.length === 0) {
      // Composer é textarea (aceita quebra de linha), então o Enter não envia
      // sozinho: Enter manda, Shift+Enter quebra a linha — igual WhatsApp Web.
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        void send();
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIdx((i) => Math.min(i + 1, slashMatches.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      insertReply(slashMatches[Math.min(highlightIdx, slashMatches.length - 1)]!.text);
    } else if (e.key === 'Escape') {
      setDraft('');
    }
  };

  // Painel aberto pelo ⚡ ou pelo atalho "/" (com match)
  const slashActive = slashMatches !== null && slashMatches.length > 0;
  const panelList = slashActive ? slashMatches : replies;
  const panelOpen = showReplies || slashActive;

  const sendFile = async (file: File) => {
    if (file.size > 8 * 1024 * 1024) {
      setSendError('Arquivo acima de 8MB — envie um menor.');
      return;
    }
    setSendingFile(true);
    setSendError(null);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
        r.onerror = () => reject(r.error);
        r.readAsDataURL(file);
      });
      const mediatype = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'document';
      await apiService.sendCrmWhatsappMedia(clientId, {
        mediatype,
        mimetype: file.type || 'application/octet-stream',
        base64,
        fileName: file.name,
      });
      await load();
    } catch (err) {
      setSendError(apiErrorMsg(err, 'Erro ao enviar o anexo.'));
    } finally {
      setSendingFile(false);
      if (fileRef.current) fileRef.current.value = '';
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
                <div key={m.id} id={`wa-msg-${m.id}`} className={`group flex items-center gap-1 ${m.fromMe ? 'justify-end' : 'justify-start'}`}>
                  {/* Botão responder: à esquerda nas minhas, à direita nas dela —
                      sempre do lado de fora da bolha, como no WhatsApp */}
                  {canSend && m.fromMe && <WaReplyButton onClick={() => setReplyTo(m)} />}
                  <div
                    className="max-w-[85%] rounded-lg px-2.5 py-1.5"
                    style={m.fromMe
                      ? { backgroundColor: 'var(--accent-dim)', border: '1px solid var(--border)' }
                      : { backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
                  >
                    {m.quoted && (
                      <button
                        onClick={() => {
                          const alvo = document.getElementById(`wa-msg-${m.quoted!.id}`);
                          alvo?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                          alvo?.animate([{ opacity: 0.35 }, { opacity: 1 }], { duration: 700 });
                        }}
                        className="w-full text-left rounded px-2 py-1 mb-1"
                        style={{ backgroundColor: 'var(--bg-elevated)', borderLeft: '3px solid var(--accent)' }}
                        title="Ir para a mensagem citada"
                      >
                        <span className="text-[10px] font-semibold block" style={{ color: 'var(--accent)' }}>
                          {m.quoted.fromMe ? 'Você' : clientName}
                        </span>
                        <span className="text-[10px] block truncate" style={{ color: 'var(--text-muted)' }}>
                          {m.quoted.text}
                        </span>
                      </button>
                    )}
                    {m.mediaType && <WaMediaBubble clientId={clientId} msg={m} />}
                    {m.location && <WaLocationBubble location={m.location} />}
                    {((!m.mediaType && !m.location) || !isMediaPlaceholder(m.text)) && (
                      <p className="text-xs whitespace-pre-wrap break-words" style={{ color: 'var(--text-primary)' }}>{m.text}</p>
                    )}
                    {/* Reação fica pendurada no rodapé da bolha, como no WhatsApp */}
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      {m.reactions?.length ? (
                        <span
                          className="text-[11px] leading-none rounded-full px-1.5 py-0.5"
                          style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
                          title={`Reagiu: ${m.reactions.map((r) => (r.fromMe ? 'Você' : clientName)).join(', ')}`}
                        >
                          {m.reactions.map((r) => r.emoji).join(' ')}
                        </span>
                      ) : (
                        <span />
                      )}
                      <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{fmtTs(m.timestamp)}</span>
                    </div>
                  </div>
                  {canSend && !m.fromMe && <WaReplyButton onClick={() => setReplyTo(m)} />}
                </div>
              ))}
            </div>
          )}
          {/* Painel de respostas rápidas — aberto pelo ⚡ ou digitando "/" */}
          {available && panelOpen && (
            <div className="mt-2 rounded-lg p-1.5 max-h-44 overflow-y-auto" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
              {panelList === null && <p className="text-xs p-2" style={{ color: 'var(--text-muted)' }}>Carregando...</p>}
              {panelList?.length === 0 && (
                <p className="text-xs p-2" style={{ color: 'var(--text-muted)' }}>
                  Nenhuma resposta rápida ainda.{canEdit ? ' Crie a primeira em "Editar".' : ' Peça a um administrador para criar.'}
                </p>
              )}
              {panelList?.map((r, i) => (
                <button
                  key={r.id}
                  onClick={() => insertReply(r.text)}
                  className="w-full text-left rounded-md px-2 py-1.5 hover:opacity-80"
                  style={slashActive && i === highlightIdx ? { backgroundColor: 'var(--accent-dim)' } : undefined}
                  title={r.text}
                >
                  <span className="text-xs font-semibold block" style={{ color: 'var(--text-primary)' }}>{r.title}</span>
                  <span className="text-[10px] block truncate" style={{ color: 'var(--text-muted)' }}>{r.text}</span>
                </button>
              ))}
              {slashActive ? (
                <p className="text-[10px] px-2 py-1" style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}>
                  ↑↓ navegar · Enter aplicar · Esc limpar
                </p>
              ) : (
                <>
                  {(replies?.length ?? 0) > 0 && (
                    <p className="text-[10px] px-2 py-1" style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--border)' }}>
                      Dica: digite <strong>/</strong> na mensagem para buscar pelo título
                    </p>
                  )}
                  {canEdit && (
                    <button
                      onClick={() => { setShowReplies(false); setShowRepliesEditor(true); }}
                      className="w-full text-left text-[11px] px-2 py-1.5 mt-0.5"
                      style={{ color: 'var(--accent)', borderTop: '1px solid var(--border)' }}
                    >
                      ⚙ Editar respostas rápidas
                    </button>
                  )}
                </>
              )}
            </div>
          )}
          {available && !canSend && (
            <div className="text-xs mt-2 rounded-lg px-2.5 py-2 flex items-center justify-between gap-2" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
              <span>
                Só o responsável pelo card responde esta conversa
                {responsibleName ? ` (${responsibleName})` : ''}.
                {!onAssumir && ' Para assumir, transfira o responsável para você.'}
              </span>
              {onAssumir && (
                <button
                  onClick={() => { void onAssumir(); }}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap"
                  style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
                  title={responsibleName ? `Assumir de ${responsibleName} e responder` : 'Assumir este card e responder'}
                >
                  Assumir e responder
                </button>
              )}
            </div>
          )}
          {/* Barra de citação — aparece acima do composer, como no WhatsApp */}
          {available && canSend && replyTo && (
            <div
              className="mt-2 flex items-start gap-2 rounded-lg px-2.5 py-1.5"
              style={{ backgroundColor: 'var(--bg-surface)', borderLeft: '3px solid var(--accent)' }}
            >
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-semibold block" style={{ color: 'var(--accent)' }}>
                  Respondendo {replyTo.fromMe ? 'você mesmo' : clientName}
                </span>
                <span className="text-[11px] block truncate" style={{ color: 'var(--text-muted)' }}>
                  {replyTo.text}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setReplyTo(null)}
                className="shrink-0 text-xs px-1"
                style={{ color: 'var(--text-muted)' }}
                aria-label="Cancelar resposta"
                title="Cancelar resposta (Esc)"
              >
                ✕
              </button>
            </div>
          )}
          {available && canSend && (
            <form
              // items-end: com o textarea crescendo, os botões ficam alinhados embaixo
              className="mt-2 flex items-end gap-2"
              onSubmit={(e) => { e.preventDefault(); void send(); }}
            >
              <input
                ref={fileRef}
                type="file"
                accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void sendFile(f); }}
              />
              <button
                type="button"
                onClick={() => void toggleReplies()}
                aria-label="Respostas rápidas"
                title="Respostas rápidas"
                className="text-sm px-2 py-2 rounded-lg shrink-0"
                style={{
                  backgroundColor: showReplies ? 'var(--accent-dim)' : 'var(--bg-surface)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-secondary)',
                }}
              >
                ⚡
              </button>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={sendingFile}
                aria-label="Enviar anexo"
                title="Enviar anexo (imagem, vídeo ou documento)"
                className="text-sm px-2 py-2 rounded-lg shrink-0 disabled:opacity-50"
                style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
              >
                {sendingFile ? '⏳' : '📎'}
              </button>
              <textarea
                ref={draftRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={composerKeyDown}
                placeholder={replyTo ? 'Escreva a resposta...' : 'Responder... ( / = respostas rápidas · Shift+Enter = nova linha)'}
                maxLength={4096}
                disabled={sending}
                rows={Math.min(5, draft.split('\n').length)}
                className="flex-1 text-xs rounded-lg px-2.5 py-2 outline-none resize-none"
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
      {showRepliesEditor && (
        <QuickRepliesEditorModal
          onClose={() => setShowRepliesEditor(false)}
          onSaved={() => { setShowRepliesEditor(false); setReplies(null); }}
        />
      )}
    </div>
  );
}

// Edição inline de nota da timeline. Ctrl+Enter salva, Esc cancela.
function NoteEditor({ initial, onSave, onCancel }: {
  initial: string;
  onSave: (text: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [texto, setTexto] = useState(initial);
  const [salvando, setSalvando] = useState(false);

  const salvar = async () => {
    const v = texto.trim();
    if (!v || v === initial.trim()) { onCancel(); return; }
    setSalvando(true);
    try { await onSave(v); } finally { setSalvando(false); }
  };

  return (
    <div>
      <textarea
        autoFocus
        rows={3}
        maxLength={2000}
        aria-label="Editar texto da nota"
        className="w-full rounded-md px-2 py-1.5 text-xs outline-none"
        style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--accent)', color: 'var(--text-primary)' }}
        value={texto}
        onChange={(ev) => setTexto(ev.target.value)}
        onKeyDown={(ev) => {
          if (ev.key === 'Escape') { ev.stopPropagation(); onCancel(); }
          if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) { ev.preventDefault(); void salvar(); }
        }}
      />
      <div className="flex gap-1.5 mt-1">
        <button
          onClick={() => void salvar()}
          disabled={salvando}
          className="text-[10px] font-medium rounded px-2 py-1 text-white disabled:opacity-60"
          style={{ backgroundColor: 'var(--accent)' }}
        >
          {salvando ? '...' : 'Salvar'}
        </button>
        <button
          onClick={onCancel}
          className="text-[10px] rounded px-2 py-1"
          style={{ color: 'var(--text-muted)' }}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

// Seta de responder ao lado da bolha — só aparece no hover, como no WhatsApp Web
function WaReplyButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity rounded p-1"
      style={{ color: 'var(--text-muted)' }}
      aria-label="Responder esta mensagem"
      title="Responder esta mensagem"
    >
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a5 5 0 015 5v3m-15-8l4-4m-4 4l4 4" />
      </svg>
    </button>
  );
}

function QuickRepliesEditorModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [draft, setDraft] = useState<{ id?: string; title: string; text: string }[] | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiService.getCrmQuickReplies()
      .then((res) => setDraft(res.data.map((r) => ({ id: r.id, title: r.title, text: r.text }))))
      .catch(() => setError('Erro ao carregar as respostas rápidas.'));
  }, []);

  const save = async () => {
    if (!draft) return;
    const valid = draft.filter((r) => r.title.trim() && r.text.trim());
    setSaving(true);
    setError(null);
    try {
      await apiService.saveCrmQuickReplies(valid);
      onSaved();
    } catch (err) {
      setError(apiErrorMsg(err, 'Erro ao salvar as respostas.'));
      setSaving(false);
    }
  };

  return (
    <ModalShell title="Respostas rápidas" onClose={onClose}>
      <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
        Templates que a equipe usa no composer da conversa. Use <code>{'{nome}'}</code> para
        inserir o primeiro nome do cliente automaticamente.
      </p>
      {draft === null ? (
        <p className="text-xs py-4 text-center" style={{ color: 'var(--text-muted)' }}>{error ?? 'Carregando...'}</p>
      ) : (
        <>
          <div className="space-y-3 mb-3">
            {draft.map((r, i) => (
              <div key={r.id ?? `new-${i}`} className="rounded-lg p-2 space-y-1.5" style={{ border: '1px solid var(--border)' }}>
                <div className="flex items-center gap-1.5">
                  <input
                    className="flex-1 rounded-lg px-2.5 py-1.5 text-sm font-medium"
                    style={input}
                    placeholder="Título (ex: Saudação)"
                    value={r.title}
                    maxLength={40}
                    onChange={(e) => setDraft((p) => p!.map((x, j) => j === i ? { ...x, title: e.target.value } : x))}
                  />
                  <button onClick={() => setDraft((p) => p!.filter((_, j) => j !== i))} className="px-1.5" style={{ color: 'var(--badge-error-text)' }} aria-label="Remover">✕</button>
                </div>
                <textarea
                  className="w-full rounded-lg px-2.5 py-1.5 text-xs resize-none"
                  style={input}
                  rows={2}
                  maxLength={1000}
                  placeholder="Texto da mensagem... (ex: Olá {nome}, tudo bem?)"
                  value={r.text}
                  onChange={(e) => setDraft((p) => p!.map((x, j) => j === i ? { ...x, text: e.target.value } : x))}
                />
              </div>
            ))}
            {draft.length === 0 && (
              <p className="text-xs py-2 text-center" style={{ color: 'var(--text-muted)' }}>Nenhuma resposta ainda — adicione a primeira.</p>
            )}
          </div>
          <button onClick={() => setDraft((p) => [...(p ?? []), { title: '', text: '' }])} className="text-xs mb-4" style={{ color: 'var(--accent)' }}>
            + adicionar resposta
          </button>
          {error && <p className="text-xs mb-2" style={{ color: 'var(--badge-error-text)' }}>{error}</p>}
          <button
            onClick={save}
            disabled={saving}
            className="w-full py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-60"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            {saving ? 'Salvando...' : 'Salvar respostas'}
          </button>
        </>
      )}
    </ModalShell>
  );
}

// ─── Import CSV ───────────────────────────────────────────────────────────────

// Parser CSV mínimo com suporte a aspas (campo com delimitador/quebra dentro).
// Delimitador autodetectado: Excel BR exporta com ";".
function parseCsv(text: string): string[][] {
  const firstLine = text.slice(0, text.indexOf('\n') >= 0 ? text.indexOf('\n') : text.length);
  const delim = (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else { inQuotes = false; }
      } else field += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delim) {
      row.push(field); field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((c) => c.trim())) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((c) => c.trim())) rows.push(row);
  return rows;
}

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

// Cabeçalho → campo do cliente (aceita variações comuns de planilha BR)
const CSV_FIELD_BY_HEADER: Record<string, string> = {
  nome: 'name', name: 'name', cliente: 'name', contato: 'name',
  telefone: 'phone', phone: 'phone', celular: 'phone', whatsapp: 'phone', fone: 'phone',
  email: 'email', 'e-mail': 'email',
  empresa: 'company', company: 'company',
  tipo: 'clientType', 'tipo de cliente': 'clientType', cargo: 'clientType',
  tags: 'tags', etiquetas: 'tags',
  origem: 'origin', origin: 'origin', fonte: 'origin',
};

const ORIGIN_BY_TEXT: Record<string, CrmOrigin> = {
  meta: 'META', facebook: 'META', instagram: 'META', 'meta ads': 'META',
  google: 'GOOGLE', 'google ads': 'GOOGLE',
  whatsapp: 'WHATSAPP', indicacao: 'INDICACAO', fachada: 'FACHADA',
  organico: 'ORGANICO', outro: 'OUTRO',
};

interface CsvRow { name: string; phone: string; email?: string; company?: string; clientType?: string; tags?: string[]; origin?: CrmOrigin }

function csvToRows(text: string): { rows: CsvRow[]; skipped: number; headersFound: string[] } {
  const table = parseCsv(text);
  if (table.length < 2) return { rows: [], skipped: 0, headersFound: [] };

  const headers = table[0]!.map((h) => CSV_FIELD_BY_HEADER[norm(h)] ?? '');
  const headersFound = headers.filter(Boolean);
  const rows: CsvRow[] = [];
  let skipped = 0;

  for (const line of table.slice(1)) {
    const rec: Record<string, string> = {};
    headers.forEach((field, i) => { if (field && line[i]?.trim()) rec[field] = line[i]!.trim(); });
    if (!rec.name || !rec.phone) { skipped++; continue; }
    rows.push({
      name: rec.name.slice(0, 120),
      phone: rec.phone.slice(0, 25),
      ...(rec.email ? { email: rec.email.slice(0, 160) } : {}),
      ...(rec.company ? { company: rec.company.slice(0, 120) } : {}),
      ...(rec.clientType ? { clientType: rec.clientType.slice(0, 60) } : {}),
      ...(rec.tags ? { tags: rec.tags.split(/[,|]/).map((t) => t.trim().slice(0, 30)).filter(Boolean).slice(0, 10) } : {}),
      ...(rec.origin && ORIGIN_BY_TEXT[norm(rec.origin)] ? { origin: ORIGIN_BY_TEXT[norm(rec.origin)] } : {}),
    });
  }
  return { rows: rows.slice(0, 2000), skipped, headersFound };
}

function ImportClientsModal({ onClose, onDone }: {
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const [parsed, setParsed] = useState<{ rows: CsvRow[]; skipped: number; headersFound: string[] } | null>(null);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onFile = async (f: File) => {
    setError(null);
    setFileName(f.name);
    try {
      const text = await f.text();
      const result = csvToRows(text);
      if (result.rows.length === 0) {
        setParsed(null);
        setError('Nenhuma linha válida — o CSV precisa de colunas "nome" e "telefone" no cabeçalho.');
        return;
      }
      setParsed(result);
    } catch {
      setError('Não foi possível ler o arquivo.');
    }
  };

  const doImport = async () => {
    if (!parsed) return;
    setImporting(true);
    setError(null);
    try {
      const res = await apiService.importCrmClients(parsed.rows);
      onDone(res.message);
    } catch (err) {
      setError(apiErrorMsg(err, 'Erro ao importar os clientes.'));
      setImporting(false);
    }
  };

  return (
    <ModalShell title="Importar clientes (CSV)" onClose={onClose}>
      <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
        Planilha CSV com cabeçalho. Colunas reconhecidas: <strong>nome</strong> e <strong>telefone</strong> (obrigatórias),
        email, empresa, tipo, tags (separadas por vírgula) e origem. Números repetidos não criam card duplicado.
      </p>
      <label
        className="block rounded-lg p-4 text-center text-sm cursor-pointer mb-3"
        style={{ border: '1px dashed var(--border-md)', color: 'var(--text-secondary)' }}
      >
        {fileName || 'Escolher arquivo .csv'}
        <input
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); }}
        />
      </label>

      {parsed && (
        <div className="mb-3">
          <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>
            <strong>{parsed.rows.length}</strong> cliente(s) prontos para importar
            {parsed.skipped > 0 ? ` · ${parsed.skipped} linha(s) sem nome/telefone ignoradas` : ''} ·
            colunas: {parsed.headersFound.join(', ')}
          </p>
          <div className="rounded-lg p-2 max-h-36 overflow-y-auto text-[11px] space-y-1" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
            {parsed.rows.slice(0, 6).map((r, i) => (
              <p key={i} style={{ color: 'var(--text-muted)' }} className="truncate">
                {r.name} · {r.phone}{r.email ? ` · ${r.email}` : ''}{r.company ? ` · ${r.company}` : ''}
              </p>
            ))}
            {parsed.rows.length > 6 && <p style={{ color: 'var(--text-muted)' }}>… e mais {parsed.rows.length - 6}</p>}
          </div>
        </div>
      )}

      {error && <p className="text-xs mb-2" style={{ color: 'var(--badge-error-text)' }}>{error}</p>}
      <button
        onClick={() => void doImport()}
        disabled={!parsed || importing}
        className="w-full py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-60"
        style={{ backgroundColor: 'var(--accent)' }}
      >
        {importing ? 'Importando...' : `Importar${parsed ? ` ${parsed.rows.length} cliente(s)` : ''}`}
      </button>
    </ModalShell>
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
          <Dropdown
            value={origin}
            onChange={(v) => setOrigin(v as CrmOrigin)}
            options={ORIGIN_OPTIONS.map((o) => ({ value: o.key, label: o.label }))}
          />
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
  client: Pick<CrmClientSummary, 'id' | 'name' | 'origin' | 'stageId'>;
  stages: CrmStage[];
  onClose: () => void;
  onSaved: () => void;
  onError: (msg: string) => void;
}) {
  const [title, setTitle] = useState('');
  const [value, setValue] = useState('');
  // A venda herda a etapa do CARD (o card é quem anda no funil).
  const stageId = client.stageId ?? stages[0]?.id ?? '';
  const [origin, setOrigin] = useState<CrmOrigin>(client.origin);
  const [segments, setSegments] = useState<{ name: string; value: string }[]>([]);
  const [saving, setSaving] = useState(false);

  const parsedValue = parseMoney(value);
  const segSum = segments.reduce((acc, s) => acc + parseMoney(s.value), 0);
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
          ? { segments: segments.filter((s) => s.name.trim()).map((s) => ({ name: s.name.trim(), value: parseMoney(s.value) })) }
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
        <div>
          <label className="text-xs block mb-1" style={label}>Valor (R$) *</label>
          <input className="w-full rounded-lg px-3 py-2 text-sm" style={input} inputMode="decimal" placeholder="0,00" value={value} onChange={(e) => setValue(maskMoney(e.target.value))} />
        </div>
        <div>
          <label className="text-xs block mb-1" style={label}>Origem desta venda</label>
          <Dropdown
            value={origin}
            onChange={(v) => setOrigin(v as CrmOrigin)}
            options={ORIGIN_OPTIONS.map((o) => ({ value: o.key, label: o.label }))}
          />
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
              <input className="w-24 rounded-lg px-2.5 py-1.5 text-xs" style={input} inputMode="decimal" placeholder="0,00" value={seg.value}
                onChange={(e) => setSegments((p) => p.map((s, j) => j === i ? { ...s, value: maskMoney(e.target.value) } : s))} />
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
  const [value, setValue] = useState(sale.value > 0 ? maskMoney(String(sale.value).replace('.', ',')) : '');
  const parsed = parseMoney(value);

  return (
    <ModalShell title="Marcar como ganha" onClose={onClose}>
      <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
        Confirme o valor final da venda — ele entra no dashboard, na Meta do Mês e no LTV do cliente.
      </p>
      <label className="text-xs block mb-1" style={label}>Valor final (R$) *</label>
      <input className="w-full rounded-lg px-3 py-2 text-sm mb-1" style={input} inputMode="decimal" placeholder="0,00" value={value} onChange={(e) => setValue(maskMoney(e.target.value))} autoFocus />
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
        <div className="mb-3">
          <Dropdown
            value={reason}
            onChange={setReason}
            options={options.map((r) => ({ value: r.label, label: r.label }))}
          />
        </div>
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

// Descarte do LEAD — não confundir com perda de VENDA. Aqui não existe venda:
// o contato não qualificou (não respondeu, clicou sem querer no anúncio...).
// Motivo obrigatório: é ele que vira a estatística "leads descartados".
function DiscardModal({ clientName, onClose, onConfirm }: {
  clientName: string;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [options, setOptions] = useState<CrmDiscardReasonOption[] | null>(null);
  const [reason, setReason] = useState('');

  useEffect(() => {
    apiService.getCrmDiscardReasons()
      .then((res) => {
        setOptions(res.data);
        setReason(res.data[0]?.label ?? '');
      })
      .catch(() => setOptions([]));
  }, []);

  return (
    <ModalShell title="Descartar lead" onClose={onClose}>
      <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>
        <strong style={{ color: 'var(--text-primary)' }}>{clientName}</strong> sai do funil sem
        virar venda — não conta como venda perdida. O motivo alimenta o relatório de leads descartados.
      </p>
      <label className="text-xs block mb-1" style={label}>Motivo *</label>
      {options === null ? (
        <p className="text-xs py-2 mb-3" style={{ color: 'var(--text-muted)' }}>Carregando motivos...</p>
      ) : options.length === 0 ? (
        <p className="text-xs py-2 mb-3" style={{ color: 'var(--badge-error-text)' }}>
          Não foi possível carregar os motivos. Feche e tente novamente.
        </p>
      ) : (
        <div className="mb-3">
          <Dropdown
            value={reason}
            onChange={setReason}
            options={options.map((r) => ({ value: r.label, label: r.label }))}
          />
        </div>
      )}
      <button
        onClick={() => onConfirm(reason)}
        disabled={!reason}
        className="w-full py-2.5 rounded-lg text-sm font-medium disabled:opacity-60"
        style={{ backgroundColor: 'var(--badge-error-bg)', color: 'var(--badge-error-text)', border: '1px solid var(--border-md)' }}
      >
        Confirmar descarte
      </button>
      <p className="text-xs mt-2.5" style={{ color: 'var(--text-muted)' }}>
        O card e a conversa continuam existindo. Se a pessoa mandar mensagem de novo,
        ela volta para &quot;Novos contatos&quot; com esse histórico à vista.
      </p>
    </ModalShell>
  );
}

function DiscardReasonsEditorModal({ onClose, onSaved, onError }: {
  onClose: () => void;
  onSaved: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [draft, setDraft] = useState<{ id?: string; label: string }[] | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiService.getCrmDiscardReasons()
      .then((res) => setDraft(res.data.map((o) => ({ id: o.id, label: o.label }))))
      .catch(() => onError('Erro ao carregar os motivos de descarte.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    if (!draft) return;
    const valid = draft.filter((s) => s.label.trim());
    if (valid.length === 0) { onError('Informe ao menos 1 motivo de descarte.'); return; }
    setSaving(true);
    try {
      const res = await apiService.saveCrmDiscardReasons(valid);
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
    <ModalShell title="Motivos de descarte" onClose={onClose}>
      <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
        Por que um LEAD é descartado — não responde, clicou sem querer no anúncio,
        só pergunta e não avança. Diferente dos motivos de perda, que encerram uma
        venda. Remover um motivo não altera os descartes antigos.
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

function ClientTypesEditorModal({ onClose, onSaved, onError }: {
  onClose: () => void;
  onSaved: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [draft, setDraft] = useState<{ id?: string; label: string }[] | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiService.getCrmClientTypes()
      .then((res) => setDraft(res.data.map((o) => ({ id: o.id, label: o.label }))))
      .catch(() => onError('Erro ao carregar os tipos de cliente.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    if (!draft) return;
    const valid = draft.filter((s) => s.label.trim());
    if (valid.length === 0) { onError('Informe ao menos 1 tipo de cliente.'); return; }
    setSaving(true);
    try {
      const res = await apiService.saveCrmClientTypes(valid);
      onSaved(res.message);
    } catch (err) {
      onError(apiErrorMsg(err, 'Erro ao salvar os tipos.'));
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
    <ModalShell title="Tipos de cliente" onClose={onClose}>
      <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
        Opções oferecidas no card e no filtro, na ordem. Remover um tipo não altera
        os cards antigos — eles guardam o texto da época.
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
            + adicionar tipo
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="w-full py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-60"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            {saving ? 'Salvando...' : 'Salvar tipos'}
          </button>
        </>
      )}
    </ModalShell>
  );
}

function TagsEditorModal({ onClose, onSaved, onError }: {
  onClose: () => void;
  onSaved: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const [draft, setDraft] = useState<{ id?: string; label: string }[] | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiService.getCrmTags()
      .then((res) => setDraft(res.data.map((o) => ({ id: o.id, label: o.label }))))
      .catch(() => onError('Erro ao carregar as tags.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async () => {
    if (!draft) return;
    const valid = draft.filter((s) => s.label.trim());
    if (valid.length === 0) { onError('Informe ao menos 1 tag.'); return; }
    setSaving(true);
    try {
      const res = await apiService.saveCrmTags(valid);
      onSaved(res.message);
    } catch (err) {
      onError(apiErrorMsg(err, 'Erro ao salvar as tags.'));
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
    <ModalShell title="Tags" onClose={onClose}>
      <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
        Tags oferecidas no card e no filtro, na ordem. Só se atribui tag da lista.
        Remover uma tag não altera os cards antigos — eles guardam a tag da época.
        A tag <strong>Carteira</strong> marca cliente recorrente no dashboard.
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
                  maxLength={30}
                  onChange={(e) => setDraft((p) => p!.map((x, j) => j === i ? { ...x, label: e.target.value } : x))}
                />
                <button onClick={() => move(i, -1)} disabled={i === 0} className="px-1.5 disabled:opacity-30" style={{ color: 'var(--text-muted)' }} aria-label="Subir">↑</button>
                <button onClick={() => move(i, 1)} disabled={i === draft.length - 1} className="px-1.5 disabled:opacity-30" style={{ color: 'var(--text-muted)' }} aria-label="Descer">↓</button>
                <button onClick={() => setDraft((p) => p!.filter((_, j) => j !== i))} className="px-1.5" style={{ color: 'var(--badge-error-text)' }} aria-label="Remover">✕</button>
              </div>
            ))}
          </div>
          <button onClick={() => setDraft((p) => [...(p ?? []), { label: '' }])} className="text-xs mb-4" style={{ color: 'var(--accent)' }}>
            + adicionar tag
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="w-full py-2.5 rounded-lg text-sm font-medium text-white disabled:opacity-60"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            {saving ? 'Salvando...' : 'Salvar tags'}
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
  const [draft, setDraft] = useState<{ id?: string; name: string; requiresValue?: boolean; color?: string | null }[]>(
    stages.map((s) => ({ id: s.id, name: s.name, requiresValue: s.requiresValue, color: s.color }))
  );
  const [saving, setSaving] = useState(false);

  // Marco único: marcar uma etapa desmarca as outras — daquela em diante o
  // valor passa a ser obrigatório. Clicar na marcada de novo remove a trava.
  const markValueFrom = (i: number) => {
    setDraft((p) => p.map((x, j) => ({ ...x, requiresValue: j === i ? !p[i]!.requiresValue : false })));
  };
  const markedIndex = draft.findIndex((s) => s.requiresValue);

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
      <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
        🔒 marca a partir de onde o card <strong>precisa de uma venda aberta com valor</strong> — normalmente
        a etapa de orçamento. As etapas antes dela ficam livres para qualificar o contato sem venda ainda.
        {markedIndex !== -1 && draft[markedIndex]?.name.trim() && (
          <> Hoje: <strong style={{ color: 'var(--accent)' }}>{draft[markedIndex]!.name}</strong> em diante.</>
        )}
      </p>
      <div className="space-y-2 mb-3">
        {draft.map((s, i) => (
          <div key={s.id ?? `new-${i}`} className="flex items-center gap-1.5">
            <input
              type="color"
              className="w-8 h-8 shrink-0 rounded cursor-pointer bg-transparent p-0.5"
              style={{ border: '1px solid var(--border)' }}
              value={s.color ?? STAGE_COLORS[i % STAGE_COLORS.length]}
              onChange={(e) => setDraft((p) => p.map((x, j) => j === i ? { ...x, color: e.target.value } : x))}
              title="Cor da etapa no kanban"
              aria-label="Cor da etapa"
            />
            <input
              className="flex-1 rounded-lg px-3 py-2 text-sm"
              style={input}
              value={s.name}
              onChange={(e) => setDraft((p) => p.map((x, j) => j === i ? { ...x, name: e.target.value } : x))}
            />
            <button
              onClick={() => markValueFrom(i)}
              className="px-1.5"
              style={{
                color: markedIndex !== -1 && i >= markedIndex ? 'var(--accent)' : 'var(--text-muted)',
                opacity: markedIndex !== -1 && i >= markedIndex ? 1 : 0.4,
              }}
              title={
                s.requiresValue
                  ? 'Marco do orçamento — clique para remover a trava'
                  : 'Exigir valor da venda a partir desta etapa'
              }
              aria-label="Exigir valor a partir desta etapa"
            >
              🔒
            </button>
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
