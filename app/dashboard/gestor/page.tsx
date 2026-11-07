'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { apiService } from '@/lib/api';
import { UserRole, type TrafficManagerClient, type ManagerReferral, type AccessibleAccount } from '@/types';
import ClientReportsModal from '@/components/ClientReportsModal';
import GestorStatsCard from '@/components/GestorStatsCard';
import { QRCodeSVG } from 'qrcode.react';

const PLAN_LABELS: Record<string, string> = { DEMO: 'Demo', CRM: 'CRM', STARTER: 'Starter', PROFESSIONAL: 'Pro', ENTERPRISE: 'Enterprise' };
const PLAN_PRICES: Record<string, number> = { DEMO: 10, CRM: 149, STARTER: 297, PROFESSIONAL: 597, ENTERPRISE: 1497 };
const PLAN_COLORS: Record<string, string> = { STARTER: '#64748b', PROFESSIONAL: '#3b82f6', ENTERPRISE: '#a855f7' };

const BRIEFING_DAY_OPTIONS = [
  { value: -1,  label: 'Não incluir' },
  { value: 1,   label: 'Segunda' },
  { value: 2,   label: 'Terça' },
  { value: 3,   label: 'Quarta' },
  { value: 4,   label: 'Quinta' },
  { value: 5,   label: 'Sexta' },
  { value: 6,   label: 'Sábado' },
  { value: 0,   label: 'Domingo' },
];

const BRIEFING_HOUR_OPTIONS = [
  { value: -1, label: 'Horário padrão' },
  ...Array.from({ length: 13 }, (_, i) => ({ value: i + 6, label: `${String(i + 6).padStart(2, '0')}:00` })),
];

type MainTab = 'clientes' | 'comissao' | 'configuracoes';

function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function fmtMoney(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

const card = { backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' };

// ─── Aba: Financeiro ──────────────────────────────────────────────────────────

function TabFinanceiro({ clients, loading }: { clients: TrafficManagerClient[]; loading: boolean }) {
  const commissionableClients = clients.filter((c) => !c.isSelf && c.source === 'LINK');
  const codeClients = clients.filter((c) => !c.isSelf && c.source !== 'LINK');

  return (
    <div className="space-y-6">
      <GestorStatsCard />

      {/* Lista de clientes com comissão */}
      <div className="rounded-xl p-5 space-y-4" style={card}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Clientes Comissionáveis</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Apenas clientes que se cadastraram pelo seu link de registro.
            </p>
          </div>
          {!loading && (
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--badge-success-bg)', color: 'var(--badge-success-text)' }}>
              {commissionableClients.length} {commissionableClients.length === 1 ? 'cliente' : 'clientes'}
            </span>
          )}
        </div>

        {loading ? (
          <div className="flex items-center gap-2 py-4 text-sm" style={{ color: 'var(--text-muted)' }}>
            <Spinner /> Carregando...
          </div>
        ) : commissionableClients.length === 0 ? (
          <div className="rounded-xl p-6 text-center" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Nenhum cliente via link ainda.</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              Compartilhe seu link de registro para começar a gerar comissões.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {commissionableClients.map((client) => {
              const commission = (PLAN_PRICES[client.plan] ?? 0) * 0.1;
              return (
                <div key={client.id} className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl" style={{ border: '1px solid var(--border)' }}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--badge-success-bg)' }}>
                      <span className="text-sm font-bold" style={{ color: 'var(--badge-success-text)' }}>{client.name.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{client.name}</p>
                      <span className="text-xs" style={{ color: PLAN_COLORS[client.plan] ?? '#64748b' }}>
                        {PLAN_LABELS[client.plan] ?? client.plan} — {fmtMoney(PLAN_PRICES[client.plan] ?? 0)}/mês
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold tabular-nums" style={{ color: 'var(--badge-success-text)' }}>
                      {fmtMoney(commission)}<span className="text-xs font-normal">/mês</span>
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>comissão 10%</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Clientes sem comissão */}
      {!loading && codeClients.length > 0 && (
        <div className="rounded-xl p-5 space-y-3" style={card}>
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Clientes sem Comissão</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Criados por você ou vinculados por código — só gera comissão quem se cadastra pelo seu link.
            </p>
          </div>
          <div className="space-y-2">
            {codeClients.map((client) => (
              <div key={client.id} className="flex items-center justify-between gap-4 px-4 py-3 rounded-xl" style={{ border: '1px solid var(--border)' }}>
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'rgba(100,116,139,0.1)' }}>
                    <span className="text-sm font-bold" style={{ color: 'var(--text-muted)' }}>{client.name.charAt(0).toUpperCase()}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{client.name}</p>
                    <span className="text-xs" style={{ color: PLAN_COLORS[client.plan] ?? '#64748b' }}>
                      {PLAN_LABELS[client.plan] ?? client.plan}
                    </span>
                  </div>
                </div>
                <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>Sem comissão</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Aba: Clientes ────────────────────────────────────────────────────────────

const DIA_MS = 24 * 60 * 60 * 1000;

type SituacaoTipo = 'aguardando' | 'ativo' | 'vence_logo' | 'vencido' | 'suspenso' | 'sem_vencimento';
type Situacao = { tipo: SituacaoTipo; rotulo: string; dica: string };

// Situação da conta do cliente, lida do que a org tem no banco. Não diz "pagando":
// a tela não sabe se o acesso vigente veio de pagamento, teste ou cortesia.
function situacaoDoCliente(c: TrafficManagerClient, agora: number): Situacao {
  if (c.source === 'MANAGER' && !c.claimed) {
    return { tipo: 'aguardando', rotulo: 'Aguardando o cliente', dica: 'Você criou este painel e o cliente ainda não assumiu. Mande o convite.' };
  }
  if (c.status === 'SUSPENDED') return { tipo: 'suspenso', rotulo: 'Suspenso', dica: 'Conta suspensa: o cliente não consegue entrar.' };
  if (c.status === 'CANCELLED') return { tipo: 'suspenso', rotulo: 'Cancelado', dica: 'Conta cancelada: o cliente não consegue entrar.' };
  if (!c.subscriptionEnds) return { tipo: 'sem_vencimento', rotulo: 'Sem vencimento', dica: 'Conta sem data de vencimento (cobrança combinada à parte).' };
  const fim = new Date(c.subscriptionEnds).getTime();
  const data = new Date(fim).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  if (fim < agora) return { tipo: 'vencido', rotulo: `Vencido em ${data}`, dica: 'O cliente cai na tela de assinatura ao entrar.' };
  const dias = Math.ceil((fim - agora) / DIA_MS);
  if (dias <= 7) return { tipo: 'vence_logo', rotulo: dias <= 1 ? 'Vence amanhã' : `Vence em ${dias} dias`, dica: `Acesso liberado até ${data}.` };
  return { tipo: 'ativo', rotulo: `Ativo até ${data}`, dica: `Acesso liberado até ${data}.` };
}

const SITUACAO_COR: Record<SituacaoTipo, React.CSSProperties> = {
  aguardando: { backgroundColor: 'var(--tint-bg)', color: 'var(--tint-ink)' },
  ativo: { backgroundColor: 'var(--badge-success-bg)', color: 'var(--badge-success-text)' },
  vence_logo: { backgroundColor: 'var(--badge-warn-bg)', color: 'var(--badge-warn-text)' },
  vencido: { backgroundColor: 'var(--badge-error-bg)', color: 'var(--badge-error-text)' },
  suspenso: { backgroundColor: 'var(--badge-error-bg)', color: 'var(--badge-error-text)' },
  sem_vencimento: { backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)' },
};

type FiltroClientes = 'todos' | 'ativos' | 'atencao' | 'aguardando';
const FILTROS: { id: FiltroClientes; label: string; casa: (t: SituacaoTipo) => boolean }[] = [
  { id: 'todos', label: 'Todos', casa: () => true },
  { id: 'ativos', label: 'Ativos', casa: (t) => t === 'ativo' || t === 'vence_logo' || t === 'sem_vencimento' },
  { id: 'atencao', label: 'Vencidos', casa: (t) => t === 'vencido' || t === 'suspenso' },
  { id: 'aguardando', label: 'Aguardando', casa: (t) => t === 'aguardando' },
];

const comissaoDoCliente = (c: TrafficManagerClient) => (c.source === 'LINK' ? (PLAN_PRICES[c.plan] ?? 0) * 0.1 : null);

function ResumoGestor({ clients, loading }: { clients: TrafficManagerClient[]; loading: boolean }) {
  const [agora] = useState(() => Date.now());
  const reais = clients.filter((c) => !c.isSelf);
  const tipos = reais.map((c) => situacaoDoCliente(c, agora).tipo);
  const comissao = reais.reduce((soma, c) => soma + (comissaoDoCliente(c) ?? 0), 0);
  const itens = [
    { rotulo: 'Clientes', valor: String(reais.length), nota: `${reais.filter((c) => c.source === 'LINK').length} pelo seu link` },
    { rotulo: 'Ativos', valor: String(tipos.filter((t) => FILTROS[1].casa(t)).length), nota: `${tipos.filter((t) => t === 'vence_logo').length} vencem em até 7 dias` },
    { rotulo: 'Vencidos ou suspensos', valor: String(tipos.filter((t) => FILTROS[2].casa(t)).length), nota: `${tipos.filter((t) => t === 'aguardando').length} aguardando o cliente` },
    { rotulo: 'Comissão do mês', valor: fmtMoney(comissao), nota: '10% dos clientes pelo seu link' },
  ];
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {itens.map((i, idx) => (
        <div key={i.rotulo} className={`ui-card ${idx === 3 ? 'ui-card-hl' : ''}`} style={{ padding: 16 }}>
          <p className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>{i.rotulo}</p>
          <p className="ui-big mt-2" style={{ fontSize: 24 }}>{loading ? '…' : i.valor}</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{loading ? '' : i.nota}</p>
        </div>
      ))}
    </div>
  );
}

function TabClientes({
  clients,
  loading,
  selfEntry,
  onViewDashboard,
  onManageReports,
  onCreateClient,
  onInviteClient,
  onCopyReferral,
}: {
  clients: TrafficManagerClient[];
  loading: boolean;
  selfEntry: TrafficManagerClient | undefined;
  onViewDashboard: (c: TrafficManagerClient) => void;
  onManageReports: (c: TrafficManagerClient) => void;
  onCreateClient: () => void;
  onInviteClient: (c: TrafficManagerClient) => void;
  onCopyReferral: () => void;
}) {
  const [filtro, setFiltro] = useState<FiltroClientes>('todos');
  const [busca, setBusca] = useState('');
  const [agora] = useState(() => Date.now());

  const linhas = clients
    .filter((c) => !c.isSelf)
    .map((c) => ({ c, s: situacaoDoCliente(c, agora) }));
  const casaFiltro = FILTROS.find((f) => f.id === filtro)!.casa;
  const termo = busca.trim().toLowerCase();
  const visiveis = linhas.filter(({ c, s }) => casaFiltro(s.tipo) && (!termo || c.name.toLowerCase().includes(termo)));

  return (
    <div className="space-y-4">
      {/* Sua conta */}
      {selfEntry && (
        <div className="ui-card flex flex-wrap items-center justify-between gap-3" style={{ padding: 16 }}>
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--accent-dim)' }}>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: 'var(--accent)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{selfEntry.name}</p>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Sua conta — os anúncios que você mesmo gerencia</p>
            </div>
          </div>
          <button onClick={() => onViewDashboard(selfEntry)} className="ui-btn ui-btn-secondary ui-btn-sm">Abrir dashboard</button>
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="ui-seg" role="group" aria-label="Filtrar clientes">
          {FILTROS.map((f) => (
            <button key={f.id} aria-pressed={filtro === f.id} onClick={() => setFiltro(f.id)}>
              {f.label} <span style={{ opacity: 0.7 }}>{linhas.filter(({ s }) => f.casa(s.tipo)).length}</span>
            </button>
          ))}
        </div>
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar cliente"
          aria-label="Buscar cliente"
          className="rounded-xl px-3 py-2 text-sm outline-none w-full sm:w-60"
          style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-md)', color: 'var(--text-primary)' }}
        />
      </div>

      {/* Lista */}
      <div className="ui-card" style={{ padding: 0 }}>
        {loading ? (
          <div className="flex items-center gap-2 p-5 text-sm" style={{ color: 'var(--text-secondary)' }}>
            <Spinner /> Carregando clientes...
          </div>
        ) : linhas.length === 0 ? (
          <div className="p-8 text-center space-y-3">
            <p className="ui-h2">Nenhum cliente ainda</p>
            <p className="text-sm mx-auto" style={{ color: 'var(--text-secondary)', maxWidth: 440 }}>
              Mande seu link de indicação para o cliente se cadastrar (gera 10% de comissão) ou crie o dashboard dele com a sua conta de anúncio.
            </p>
            <div className="flex flex-wrap justify-center gap-2 pt-1">
              <button onClick={onCopyReferral} className="ui-btn ui-btn-primary ui-btn-sm">Copiar link de indicação</button>
              <button onClick={onCreateClient} className="ui-btn ui-btn-secondary ui-btn-sm">Criar dashboard</button>
            </div>
          </div>
        ) : visiveis.length === 0 ? (
          <p className="p-5 text-sm" style={{ color: 'var(--text-secondary)' }}>Nenhum cliente neste filtro.</p>
        ) : (
          <ul>
            {visiveis.map(({ c, s }, i) => {
              const comissao = comissaoDoCliente(c);
              return (
                <li
                  key={c.id}
                  className="flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-4 sm:px-5 lg:grid lg:grid-cols-[minmax(0,1fr)_11rem_7.5rem_21rem]"
                  style={i > 0 ? { borderTop: '1px solid var(--border)' } : undefined}
                >
                  {/* Nome + plano + plataformas */}
                  <div className="flex items-center gap-3 min-w-0 flex-1 basis-60">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--accent-dim)' }}>
                      <span className="text-sm font-bold" style={{ color: 'var(--accent)' }}>{c.name.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{c.name}</p>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        <span className="ui-chip">{PLAN_LABELS[c.plan] ?? c.plan}</span>
                        {c.hasMeta && <span className="ui-chip">Meta</span>}
                        {c.hasGoogle && <span className="ui-chip">Google</span>}
                        {c.hasKommo && <span className="ui-chip">Kommo</span>}
                      </div>
                    </div>
                  </div>

                  {/* Situação */}
                  <div className="basis-40 shrink-0">
                    <span className="ui-badge" style={{ ...SITUACAO_COR[s.tipo], fontSize: 11 }} title={s.dica}>{s.rotulo}</span>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                      {c.source === 'LINK' ? 'Veio pelo seu link' : c.source === 'MANAGER' ? 'Criado por você' : 'Vinculado por código'}
                    </p>
                  </div>

                  {/* Comissão */}
                  <div className="basis-28 shrink-0 text-left sm:text-right">
                    {comissao !== null ? (
                      <>
                        <p className="text-sm font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>{fmtMoney(comissao)}</p>
                        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>comissão/mês</p>
                      </>
                    ) : (
                      <p className="text-xs" style={{ color: 'var(--text-secondary)' }} title="Só gera comissão quem se cadastra pelo seu link de indicação.">Sem comissão</p>
                    )}
                  </div>

                  {/* Ações */}
                  <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto sm:ml-auto lg:ml-0 lg:justify-end">
                    {s.tipo === 'aguardando' && (
                      <button onClick={() => onInviteClient(c)} className="ui-btn ui-btn-tint ui-btn-sm">Convidar cliente</button>
                    )}
                    <button onClick={() => onViewDashboard(c)} className="ui-btn ui-btn-secondary ui-btn-sm">Dashboard</button>
                    <button onClick={() => onManageReports(c)} className="ui-btn ui-btn-secondary ui-btn-sm">Relatórios</button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

// ─── Card: Minha conta de anúncio (visão pessoal do gestor) ───────────────────

function MyAccountCard({ showToast }: { showToast: (m: string, t?: 'success' | 'error') => void }) {
  type AccData = { connected: boolean; accounts: AccessibleAccount[]; currentExternalId: string | null };
  const [google, setGoogle] = useState<AccData | null>(null);
  const [meta, setMeta] = useState<AccData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<'google_ads' | 'meta' | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [g, m] = await Promise.all([apiService.getAccessibleAccounts('google_ads'), apiService.getAccessibleAccounts('meta')]);
      setGoogle(g.data);
      setMeta(m.data);
    } catch { /* silencia */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleChange = async (platform: 'google_ads' | 'meta', externalId: string) => {
    if (!externalId) return;
    setSaving(platform);
    try {
      const res = await apiService.setMyAccount(platform, externalId);
      showToast(`${res.message} — ${res.data.count} registros sincronizados.`);
      await load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      showToast(msg ?? 'Erro ao vincular conta.', 'error');
    } finally { setSaving(null); }
  };

  return (
    <div className="rounded-xl p-5 space-y-4" style={card}>
      <div>
        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Minha conta de anúncio</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
          Escolha qual conta aparece no seu dashboard pessoal. Os dashboards dos clientes são configurados separadamente.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}><Spinner className="h-3 w-3" /> Carregando...</div>
      ) : (
        <div className="space-y-3">
          {([{ key: 'google_ads', label: 'Google Ads', data: google }, { key: 'meta', label: 'Meta Ads', data: meta }] as const).map(({ key, label, data }) => (
            <div key={key} className="space-y-1">
              <label className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</label>
              {data?.connected ? (
                <div className="flex items-center gap-2">
                  <select
                    value={data.currentExternalId ?? ''}
                    onChange={(e) => void handleChange(key, e.target.value)}
                    disabled={saving === key}
                    className="flex-1 rounded-lg px-3 py-2 text-sm"
                    style={{ backgroundColor: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }}
                  >
                    <option value="">Nenhuma conta selecionada</option>
                    {data.accounts.map((a) => (
                      <option key={a.externalId} value={a.externalId}>{a.name} ({a.externalId})</option>
                    ))}
                  </select>
                  {saving === key && <Spinner className="h-4 w-4" />}
                </div>
              ) : (
                <p className="text-xs px-3 py-2 rounded-lg" style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
                  Não conectado — conecte nas Integrações.
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Aba: Configurações ───────────────────────────────────────────────────────

function TabConfiguracoes({
  referral,
  loadingReferral,
  copiedReferral,
  regeneratingReferral,
  onCopyReferral,
  onRegenerateReferral,
  invite,
  loadingInvite,
  copied,
  regenerating,
  onCopy,
  onRegenerate,
  onFetchInvite,
  briefing,
  setBriefing,
  loadingBriefing,
  savingBriefing,
  testingBriefing,
  telegramPhase,
  briefingDeepLink,
  onSaveBriefing,
  onTestBriefing,
  onConnectTelegram,
  onDisconnectTelegram,
  clients,
  loadingClients,
  onDisconnect,
  onUpdateClientBriefing,
  showToast,
}: {
  referral: ManagerReferral | null;
  loadingReferral: boolean;
  copiedReferral: boolean;
  regeneratingReferral: boolean;
  onCopyReferral: () => void;
  onRegenerateReferral: () => void;
  invite: { code: string; expiresAt: string } | null;
  loadingInvite: boolean;
  copied: boolean;
  regenerating: boolean;
  onCopy: () => void;
  onRegenerate: () => void;
  onFetchInvite: () => void;
  briefing: { enabled: boolean; chatId: string; chatName: string; hour: number; dayOfWeek: number; notificationChannel: 'TELEGRAM' | 'WHATSAPP'; whatsappPhone: string };
  setBriefing: React.Dispatch<React.SetStateAction<{ enabled: boolean; chatId: string; chatName: string; hour: number; dayOfWeek: number; notificationChannel: 'TELEGRAM' | 'WHATSAPP'; whatsappPhone: string }>>;
  loadingBriefing: boolean;
  savingBriefing: boolean;
  testingBriefing: boolean;
  telegramPhase: 'idle' | 'connecting' | 'connected';
  briefingDeepLink: string;
  onSaveBriefing: () => void;
  onTestBriefing: () => void;
  onConnectTelegram: () => void;
  onDisconnectTelegram: () => void;
  clients: TrafficManagerClient[];
  loadingClients: boolean;
  onDisconnect: (c: TrafficManagerClient) => void;
  onUpdateClientBriefing: (orgId: string, day: number | null, hour: number | null) => void;
  showToast: (m: string, t?: 'success' | 'error') => void;
}) {
  const realClients = clients.filter((c) => !c.isSelf);

  return (
    <div className="space-y-6">

      {/* Minha conta de anúncio */}
      <MyAccountCard showToast={showToast} />

      {/* Link de Registro */}
      <div className="rounded-xl p-5 space-y-4" style={card}>
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Link de Registro</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Para novos clientes se cadastrarem — gera comissão de 10%.
          </p>
        </div>

        {loadingReferral ? (
          <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
            <Spinner className="h-3 w-3" /> Carregando...
          </div>
        ) : referral ? (
          <div className="space-y-2">
            <div
              className="flex items-center gap-3 rounded-xl px-4 py-3 cursor-pointer"
              style={{ backgroundColor: 'var(--badge-success-bg)', border: '1.5px dashed var(--badge-success-text)' }}
              onClick={onCopyReferral}
            >
              <span className="text-xs font-mono flex-1 truncate" style={{ color: 'var(--badge-success-text)' }}>
                {referral.referralLink}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); onCopyReferral(); }}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium shrink-0"
                style={copiedReferral
                  ? { backgroundColor: 'var(--badge-success-bg)', color: 'var(--badge-success-text)' }
                  : { backgroundColor: 'var(--badge-success-bg)', color: 'var(--badge-success-text)' }}
              >
                {copiedReferral ? '✓ Copiado!' : 'Copiar'}
              </button>
            </div>
            <button
              onClick={onRegenerateReferral}
              disabled={regeneratingReferral}
              className="flex items-center gap-1.5 text-xs"
              style={{ color: 'var(--text-muted)' }}
            >
              {regeneratingReferral ? <Spinner className="h-3 w-3" /> : null}
              {regeneratingReferral ? 'Regenerando...' : '↻ Gerar novo link'}
            </button>
          </div>
        ) : (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Link não disponível. Contate o administrador.</p>
        )}
      </div>

      {/* Código de Conexão */}
      <div className="rounded-xl p-5 space-y-4" style={card}>
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Código de Conexão</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Para clientes que já têm conta no Cromalex Growth — sem comissão.
          </p>
        </div>

        {loadingInvite ? (
          <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
            <Spinner className="h-3 w-3" /> Carregando...
          </div>
        ) : invite ? (
          <div className="space-y-2">
            <div
              className="inline-flex items-center gap-4 rounded-xl px-4 py-3 cursor-pointer w-full justify-between"
              style={{ backgroundColor: 'var(--accent-dim)', border: '1.5px dashed var(--accent-line)' }}
              onClick={onCopy}
            >
              <span className="text-2xl font-bold tracking-[0.25em] font-mono" style={{ color: 'var(--accent)' }}>
                {invite.code}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); onCopy(); }}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium shrink-0"
                style={copied
                  ? { backgroundColor: 'var(--badge-success-bg)', color: 'var(--badge-success-text)' }
                  : { backgroundColor: 'var(--accent-dim)', color: 'var(--accent)' }}
              >
                {copied ? '✓ Copiado!' : 'Copiar'}
              </button>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Expira em {new Date(invite.expiresAt).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
              </p>
              <button
                onClick={onRegenerate}
                disabled={regenerating}
                className="flex items-center gap-1.5 text-xs"
                style={{ color: 'var(--text-muted)' }}
              >
                {regenerating ? <Spinner className="h-3 w-3" /> : null}
                {regenerating ? 'Regenerando...' : '↻ Novo código'}
              </button>
            </div>
          </div>
        ) : (
          <button onClick={onFetchInvite} className="text-xs px-4 py-2 rounded-lg" style={{ backgroundColor: 'var(--accent-fill)', color: 'var(--on-accent)' }}>
            Gerar código
          </button>
        )}
      </div>

      {/* Briefing Semanal */}
      <div className="rounded-xl p-5 space-y-4" style={card}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Briefing Semanal Automático</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Receba resumos dos seus clientes via Telegram ou WhatsApp.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={briefing.enabled}
            aria-label="Briefing semanal ativo"
            onClick={() => setBriefing((b) => ({ ...b, enabled: !b.enabled }))}
            className="ui-switch"
          />
        </div>

        {loadingBriefing ? (
          <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
            <Spinner className="h-3 w-3" /> Carregando...
          </div>
        ) : (
          <div className="space-y-3">

            {/* Canal */}
            <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-md)' }}>
              {(['TELEGRAM', 'WHATSAPP'] as const).map((ch) => (
                <button
                  key={ch}
                  onClick={() => setBriefing((b) => ({ ...b, notificationChannel: ch }))}
                  className="flex-1 py-1.5 text-xs font-medium transition-colors"
                  style={briefing.notificationChannel === ch
                    ? { backgroundColor: 'var(--accent-fill)', color: 'var(--on-accent)' }
                    : { backgroundColor: 'transparent', color: 'var(--text-muted)' }}
                >
                  {ch === 'TELEGRAM' ? 'Telegram' : 'WhatsApp'}
                </button>
              ))}
            </div>

            {/* Telegram flow */}
            {briefing.notificationChannel === 'TELEGRAM' && (
              <>
                {telegramPhase === 'idle' && (
                  <button
                    onClick={onConnectTelegram}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-medium"
                    style={{ backgroundColor: 'var(--accent-dim)', border: '1px solid var(--accent-line)', color: 'var(--accent)' }}
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.894 8.221-1.97 9.28c-.145.658-.537.818-1.084.508l-3-2.21-1.447 1.394c-.16.16-.295.295-.605.295l.213-3.053 5.56-5.023c.242-.213-.054-.333-.373-.12L7.28 13.04l-2.96-.924c-.643-.204-.657-.643.136-.953l11.57-4.461c.537-.194 1.006.131.868.519z" /></svg>
                    Conectar Telegram
                  </button>
                )}

                {telegramPhase === 'connecting' && briefingDeepLink && (
                  <div className="space-y-3 text-center">
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Escaneie o QR Code com o Telegram.</p>
                    <div className="flex justify-center">
                      <div className="p-3 rounded-xl" style={{ backgroundColor: '#fff' }}>
                        <QRCodeSVG value={briefingDeepLink} size={140} />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 justify-center">
                      <span className="inline-block w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: 'var(--accent)' }} />
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Aguardando conexão...</p>
                    </div>
                  </div>
                )}

                {telegramPhase === 'connected' && (
                  <div className="flex items-center justify-between px-3 py-2.5 rounded-lg" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-md)' }}>
                    <div className="flex items-center gap-2">
                      <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--badge-success-text)' }} />
                      <span className="text-xs" style={{ color: 'var(--text-primary)' }}>{briefing.chatName || 'Telegram conectado'}</span>
                    </div>
                    <button onClick={onDisconnectTelegram} className="text-xs px-2 py-1 rounded" style={{ color: 'var(--text-muted)' }}>
                      Desconectar
                    </button>
                  </div>
                )}
              </>
            )}

            {/* WhatsApp flow */}
            {briefing.notificationChannel === 'WHATSAPP' && (
              <div className="space-y-1">
                <label className="text-xs" style={{ color: 'var(--text-muted)' }}>Número do WhatsApp (DDI+DDD+número)</label>
                <input
                  type="text"
                  placeholder="ex: 5511999999999"
                  value={briefing.whatsappPhone}
                  onChange={(e) => setBriefing((b) => ({ ...b, whatsappPhone: e.target.value.replace(/\D/g, '') }))}
                  className="w-full rounded-lg px-3 py-1.5 text-xs font-mono"
                  style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-md)', color: 'var(--text-primary)' }}
                />
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  O bot da Cortex enviará o briefing para este número.
                </p>
              </div>
            )}

            <div className="flex items-center gap-3">
              <div className="space-y-1 flex-1">
                <label className="text-xs" style={{ color: 'var(--text-muted)' }}>Horário (BRT)</label>
                <select
                  value={briefing.hour}
                  onChange={(e) => setBriefing((b) => ({ ...b, hour: Number(e.target.value) }))}
                  className="w-full rounded-lg px-3 py-1.5 text-xs"
                  style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-md)', color: 'var(--text-primary)' }}
                >
                  {[6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18].map((h) => (
                    <option key={h} value={h}>{h}:00</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2 pt-4">
                <button
                  onClick={onSaveBriefing}
                  disabled={savingBriefing}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                  style={{ backgroundColor: 'var(--accent-fill)', color: 'var(--on-accent)', opacity: savingBriefing ? 0.6 : 1 }}
                >
                  {savingBriefing ? <Spinner className="h-3 w-3" /> : null}
                  Salvar
                </button>
                <button
                  onClick={onTestBriefing}
                  disabled={testingBriefing || (briefing.notificationChannel === 'TELEGRAM' ? telegramPhase !== 'connected' : !briefing.whatsappPhone.trim())}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                  style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-md)', color: 'var(--text-secondary)', opacity: (testingBriefing || (briefing.notificationChannel === 'TELEGRAM' ? telegramPhase !== 'connected' : !briefing.whatsappPhone.trim())) ? 0.4 : 1 }}
                >
                  {testingBriefing ? <Spinner className="h-3 w-3" /> : '⚡'}
                  Testar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Gerenciar Clientes */}
      <div className="rounded-xl p-5 space-y-4" style={card}>
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Gerenciar Clientes</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Configure o dia do briefing semanal de cada cliente e remova quando necessário.
          </p>
        </div>

        {loadingClients ? (
          <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
            <Spinner /> Carregando...
          </div>
        ) : realClients.length === 0 ? (
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Nenhum cliente para gerenciar.</p>
        ) : (
          <div className="space-y-2">
            {realClients.map((client) => (
              <div key={client.id} className="rounded-xl px-4 py-3 space-y-2" style={{ border: '1px solid var(--border)' }}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--accent-dim)' }}>
                      <span className="text-sm font-bold" style={{ color: 'var(--accent)' }}>{client.name.charAt(0).toUpperCase()}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{client.name}</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {client.source === 'LINK' ? 'Via link' : client.source === 'CODE' ? 'Via código' : client.source === 'MANAGER' ? 'Dashboard criado por você' : 'Via admin'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => onDisconnect(client)}
                    className="shrink-0 text-xs px-3 py-1.5 rounded-lg"
                    style={{ backgroundColor: 'var(--badge-error-bg)', color: 'var(--badge-error-text)', border: '1px solid var(--badge-error-text)' }}
                  >
                    Remover
                  </button>
                </div>
                <div className="flex items-center gap-2 pt-0.5 flex-wrap">
                  <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>Briefing semanal:</span>
                  <select
                    value={client.briefingDayOfWeek ?? -1}
                    onChange={(e) => {
                      const day = Number(e.target.value) === -1 ? null : Number(e.target.value);
                      onUpdateClientBriefing(client.id, day, client.briefingHour ?? null);
                    }}
                    className="text-xs rounded-lg px-2 py-1"
                    style={{ backgroundColor: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)', cursor: 'pointer' }}
                  >
                    {BRIEFING_DAY_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  {client.briefingDayOfWeek != null && (
                    <select
                      value={client.briefingHour ?? -1}
                      onChange={(e) => {
                        const hour = Number(e.target.value) === -1 ? null : Number(e.target.value);
                        onUpdateClientBriefing(client.id, client.briefingDayOfWeek ?? null, hour);
                      }}
                      className="text-xs rounded-lg px-2 py-1"
                      style={{ backgroundColor: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)', cursor: 'pointer' }}
                    >
                      {BRIEFING_HOUR_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}

// ─── Modal: Criar Dashboard de Cliente ────────────────────────────────────────

function CreateDashboardModal({
  onClose,
  onCreated,
  showToast,
}: {
  onClose: () => void;
  onCreated: () => void;
  showToast: (message: string, type?: 'success' | 'error') => void;
}) {
  const [name, setName] = useState('');
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [google, setGoogle] = useState<{ connected: boolean; accounts: AccessibleAccount[] }>({ connected: false, accounts: [] });
  const [meta, setMeta] = useState<{ connected: boolean; accounts: AccessibleAccount[] }>({ connected: false, accounts: [] });
  const [selectedGoogle, setSelectedGoogle] = useState('');
  const [selectedMeta, setSelectedMeta] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      setLoadingAccounts(true);
      try {
        const [g, m] = await Promise.all([
          apiService.getAccessibleAccounts('google_ads'),
          apiService.getAccessibleAccounts('meta'),
        ]);
        if (!active) return;
        setGoogle(g.data);
        setMeta(m.data);
      } catch {
        if (active) showToast('Erro ao carregar suas contas de anúncio.', 'error');
      } finally {
        if (active) setLoadingAccounts(false);
      }
    })();
    return () => { active = false; };
  }, [showToast]);

  const canCreate = name.trim().length >= 2 && (selectedGoogle !== '' || selectedMeta !== '');

  const handleCreate = async () => {
    if (!canCreate) return;
    setCreating(true);
    try {
      const gAcc = google.accounts.find((a) => a.externalId === selectedGoogle);
      const mAcc = meta.accounts.find((a) => a.externalId === selectedMeta);
      const res = await apiService.createClientDashboard({
        name: name.trim(),
        google: gAcc ? { externalId: gAcc.externalId, externalName: gAcc.name } : null,
        meta: mAcc ? { externalId: mAcc.externalId, externalName: mAcc.name } : null,
      });
      onCreated();
      const sync = res.data.sync;
      const parts: string[] = [];
      if (sync?.google) parts.push(`Google: ${sync.google.ok ? `${sync.google.count} registros` : 'falha no sync'}`);
      if (sync?.meta) parts.push(`Meta: ${sync.meta.ok ? `${sync.meta.count} registros` : 'falha no sync'}`);
      const anyFail = (sync?.google && !sync.google.ok) || (sync?.meta && !sync.meta.ok);
      showToast(`Dashboard criado. ${parts.join(' · ')}`, anyFail ? 'error' : 'success');
      onClose();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      showToast(msg ?? 'Erro ao criar dashboard.', 'error');
    } finally {
      setCreating(false);
    }
  };

  const selectStyle = { backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-md)', color: 'var(--text-primary)' };
  const hintStyle = { backgroundColor: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border)' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl p-6 space-y-5"
        style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', maxHeight: '90vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <p className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Criar Dashboard de Cliente</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            Crie um painel para um cliente usando uma conta de anúncio que você gerencia.
          </p>
        </div>

        <div className="space-y-1">
          <label className="text-xs" style={{ color: 'var(--text-muted)' }}>Nome do cliente</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="ex: Casa do Vidro"
            className="w-full rounded-lg px-3 py-2 text-sm"
            style={selectStyle}
          />
        </div>

        {loadingAccounts ? (
          <div className="flex items-center gap-2 py-4 text-sm" style={{ color: 'var(--text-muted)' }}>
            <Spinner /> Carregando suas contas...
          </div>
        ) : (
          <>
            <div className="space-y-1">
              <label className="text-xs" style={{ color: 'var(--text-muted)' }}>Conta Google Ads</label>
              {google.connected ? (
                <select value={selectedGoogle} onChange={(e) => setSelectedGoogle(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm" style={selectStyle}>
                  <option value="">Não usar Google</option>
                  {google.accounts.map((a) => (
                    <option key={a.externalId} value={a.externalId}>{a.name} ({a.externalId})</option>
                  ))}
                </select>
              ) : (
                <p className="text-xs px-3 py-2 rounded-lg" style={hintStyle}>
                  Conecte sua conta Google nas Integrações para usar.
                </p>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs" style={{ color: 'var(--text-muted)' }}>Conta Meta Ads</label>
              {meta.connected ? (
                <select value={selectedMeta} onChange={(e) => setSelectedMeta(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm" style={selectStyle}>
                  <option value="">Não usar Meta</option>
                  {meta.accounts.map((a) => (
                    <option key={a.externalId} value={a.externalId}>{a.name} ({a.externalId})</option>
                  ))}
                </select>
              ) : (
                <p className="text-xs px-3 py-2 rounded-lg" style={hintStyle}>
                  Conecte sua conta Meta nas Integrações para usar.
                </p>
              )}
            </div>
          </>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm" style={{ color: 'var(--text-muted)' }}>Cancelar</button>
          <button
            onClick={() => void handleCreate()}
            disabled={!canCreate || creating}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
            style={{ backgroundColor: 'var(--accent-fill)', color: 'var(--on-accent)', opacity: (!canCreate || creating) ? 0.5 : 1 }}
          >
            {creating ? <Spinner className="h-4 w-4" /> : null}
            Criar Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal: Convidar cliente (claim) ──────────────────────────────────────────

function ClaimLinkModal({ client, onClose }: { client: TrafficManagerClient; onClose: () => void }) {
  const [link, setLink] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    let active = true;
    apiService.generateClaimLink(client.id)
      .then((res) => {
        if (!active) return;
        setLink(res.data.claimLink);
        setExpiresAt(res.data.expiresAt);
      })
      .catch((e: unknown) => {
        const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
        if (active) setErr(msg ?? 'Erro ao gerar link de convite.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [client.id]);

  const copy = async () => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl p-6 space-y-4" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }} onClick={(e) => e.stopPropagation()}>
        <div>
          <p className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Convidar {client.name}</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            Envie este link para o cliente criar a conta dele e assumir o painel — ele ganha acesso completo à plataforma. Você continua gerenciando.
          </p>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 py-4 text-sm" style={{ color: 'var(--text-muted)' }}><Spinner /> Gerando link...</div>
        ) : err ? (
          <p className="text-xs px-3 py-2 rounded-lg" style={{ backgroundColor: 'var(--badge-error-bg)', color: 'var(--badge-error-text)', border: '1px solid var(--badge-error-text)' }}>{err}</p>
        ) : (
          <>
            <div
              className="flex items-center gap-3 rounded-xl px-4 py-3 cursor-pointer"
              style={{ backgroundColor: 'var(--badge-success-bg)', border: '1.5px dashed var(--badge-success-text)' }}
              onClick={() => void copy()}
            >
              <span className="text-xs font-mono flex-1 truncate" style={{ color: 'var(--badge-success-text)' }}>{link}</span>
              <button
                onClick={(e) => { e.stopPropagation(); void copy(); }}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium shrink-0"
                style={{ backgroundColor: 'var(--badge-success-bg)', color: 'var(--badge-success-text)' }}
              >
                {copied ? '✓ Copiado!' : 'Copiar'}
              </button>
            </div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Expira em {new Date(expiresAt).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}.
            </p>
          </>
        )}

        <div className="flex justify-end pt-1">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm" style={{ color: 'var(--text-muted)' }}>Fechar</button>
        </div>
      </div>
    </div>
  );
}

// ─── Página Principal ─────────────────────────────────────────────────────────

export default function GestorPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<MainTab>('clientes');

  // ── Referral ───────────────────────────────────────────────────────────────
  const [referral, setReferral] = useState<ManagerReferral | null>(null);
  const [loadingReferral, setLoadingReferral] = useState(true);
  const [regeneratingReferral, setRegeneratingReferral] = useState(false);
  const [copiedReferral, setCopiedReferral] = useState(false);

  // ── Invite code ────────────────────────────────────────────────────────────
  const [invite, setInvite] = useState<{ code: string; expiresAt: string } | null>(null);
  const [loadingInvite, setLoadingInvite] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  // ── Clients ────────────────────────────────────────────────────────────────
  const [clients, setClients] = useState<TrafficManagerClient[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [reportClient, setReportClient] = useState<TrafficManagerClient | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [inviteClient, setInviteClient] = useState<TrafficManagerClient | null>(null);

  // ── Briefing ───────────────────────────────────────────────────────────────
  const [briefing, setBriefing] = useState({ enabled: false, chatId: '', chatName: '', hour: 7, dayOfWeek: 0, notificationChannel: 'TELEGRAM' as 'TELEGRAM' | 'WHATSAPP', whatsappPhone: '' });
  const [loadingBriefing, setLoadingBriefing] = useState(true);
  const [savingBriefing, setSavingBriefing] = useState(false);
  const [testingBriefing, setTestingBriefing] = useState(false);
  const [telegramPhase, setTelegramPhase] = useState<'idle' | 'connecting' | 'connected'>('idle');
  const [briefingDeepLink, setBriefingDeepLink] = useState('');
  const briefingPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Toast ──────────────────────────────────────────────────────────────────
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchReferral = useCallback(async () => {
    setLoadingReferral(true);
    try {
      const res = await apiService.getMyReferral();
      setReferral(res.data);
    } catch { /* silencia */ } finally { setLoadingReferral(false); }
  }, []);

  const fetchInvite = useCallback(async () => {
    setLoadingInvite(true);
    try {
      const res = await apiService.getMyInvite();
      setInvite(res.data);
    } catch {
      showToast('Erro ao carregar código de convite.', 'error');
    } finally { setLoadingInvite(false); }
  }, []);

  const fetchClients = useCallback(async () => {
    setLoadingClients(true);
    try {
      const res = await apiService.getMyClients();
      setClients(res.data);
    } catch { /* mantém vazio */ } finally { setLoadingClients(false); }
  }, []);

  const fetchBriefingConfig = useCallback(async () => {
    setLoadingBriefing(true);
    try {
      const res = await apiService.getBriefingConfig();
      setBriefing(prev => ({
        ...prev,
        ...res.data,
        notificationChannel: (res.data.notificationChannel as 'TELEGRAM' | 'WHATSAPP') ?? 'TELEGRAM',
        whatsappPhone: res.data.whatsappPhone ?? '',
      }));
      setTelegramPhase(res.data.chatId ? 'connected' : 'idle');
    } catch { /* mantém default */ } finally { setLoadingBriefing(false); }
  }, []);

  useEffect(() => {
    if (user?.role !== UserRole.TRAFFIC_MANAGER) {
      router.replace('/dashboard');
      return;
    }
    void fetchReferral();
    void fetchInvite();
    void fetchClients();
    void fetchBriefingConfig();
  }, [user, router, fetchReferral, fetchInvite, fetchClients, fetchBriefingConfig]);

  useEffect(() => {
    return () => { if (briefingPollRef.current) clearInterval(briefingPollRef.current); };
  }, []);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleRegenerateReferral = async () => {
    setRegeneratingReferral(true);
    try {
      const res = await apiService.regenerateReferral();
      setReferral(res.data);
      showToast('Link regenerado com sucesso.');
    } catch { showToast('Erro ao regenerar link.', 'error'); }
    finally { setRegeneratingReferral(false); }
  };

  const handleCopyReferral = async () => {
    if (!referral) return;
    await navigator.clipboard.writeText(referral.referralLink);
    setCopiedReferral(true);
    setTimeout(() => setCopiedReferral(false), 2000);
  };

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      const res = await apiService.regenerateInvite();
      setInvite(res.data);
      showToast('Código regenerado.');
    } catch { showToast('Erro ao regenerar código.', 'error'); }
    finally { setRegenerating(false); }
  };

  const handleCopy = async () => {
    if (!invite) return;
    await navigator.clipboard.writeText(invite.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleViewDashboard = (client: TrafficManagerClient) => {
    apiService.setSelectedClientOrgId(client.id);
    // Navegação completa (não router.push) para remontar o layout e sincronizar o
    // seletor de cliente com a org recém-selecionada — mesmo padrão do dropdown.
    window.location.href = '/dashboard';
  };

  const handleManageReports = (client: TrafficManagerClient) => {
    apiService.setSelectedClientOrgId(client.id);
    setReportClient(client);
  };

  const handleUpdateClientBriefing = async (orgId: string, day: number | null, hour: number | null) => {
    try {
      await apiService.updateClientBriefing(orgId, day, hour);
      setClients(prev => prev.map(c => c.id === orgId ? { ...c, briefingDayOfWeek: day, briefingHour: hour } : c));
    } catch { showToast('Erro ao salvar configuração de briefing.', 'error'); }
  };

  const handleDisconnect = async (client: TrafficManagerClient) => {
    if (!confirm(`Remover ${client.name} da sua lista?`)) return;
    try {
      await apiService.removeMyClient(client.id);
      setClients((prev) => prev.filter((c) => c.id !== client.id));
      showToast('Cliente removido.');
    } catch { showToast('Erro ao remover cliente.', 'error'); }
  };

  const handleSaveBriefing = async () => {
    setSavingBriefing(true);
    try {
      await apiService.saveBriefingConfig({ enabled: briefing.enabled, hour: briefing.hour, dayOfWeek: briefing.dayOfWeek, notificationChannel: briefing.notificationChannel, whatsappPhone: briefing.whatsappPhone });
      showToast('Configuração salva!');
    } catch { showToast('Erro ao salvar.', 'error'); }
    finally { setSavingBriefing(false); }
  };

  const handleTestBriefing = async () => {
    if (briefing.notificationChannel === 'TELEGRAM' && telegramPhase !== 'connected') {
      showToast('Conecte o Telegram antes de testar.', 'error'); return;
    }
    if (briefing.notificationChannel === 'WHATSAPP' && !briefing.whatsappPhone.trim()) {
      showToast('Informe o número de WhatsApp antes de testar.', 'error'); return;
    }
    setTestingBriefing(true);
    try {
      await apiService.testBriefing();
      showToast('Briefing de teste enviado!');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      showToast(msg ?? 'Erro ao enviar briefing.', 'error');
    } finally { setTestingBriefing(false); }
  };

  const handleConnectTelegram = async () => {
    setTelegramPhase('connecting');
    try {
      const res = await apiService.generateBriefingInvite();
      setBriefingDeepLink(res.data.deepLink);
      briefingPollRef.current = setInterval(async () => {
        try {
          const cfg = await apiService.getBriefingConfig();
          if (cfg.data.chatId) {
            setBriefing(prev => ({
              ...prev,
              ...cfg.data,
              notificationChannel: (cfg.data.notificationChannel as 'TELEGRAM' | 'WHATSAPP') ?? 'TELEGRAM',
              whatsappPhone: cfg.data.whatsappPhone ?? '',
            }));
            setTelegramPhase('connected');
            if (briefingPollRef.current) clearInterval(briefingPollRef.current);
          }
        } catch { /* ignora */ }
      }, 3000);
    } catch {
      showToast('Erro ao gerar link de conexão.', 'error');
      setTelegramPhase('idle');
    }
  };

  const handleDisconnectTelegram = async () => {
    try {
      await apiService.disconnectBriefingTelegram();
      setBriefing((b) => ({ ...b, chatId: '', chatName: '' }));
      setTelegramPhase('idle');
      setBriefingDeepLink('');
      showToast('Telegram desconectado.');
    } catch { showToast('Erro ao desconectar.', 'error'); }
  };

  if (user?.role !== UserRole.TRAFFIC_MANAGER) return null;

  const selfEntry = clients.find((c) => c.isSelf);

  const TABS: { id: MainTab; label: string }[] = [
    { id: 'clientes', label: 'Clientes' },
    { id: 'comissao', label: 'Comissão' },
    { id: 'configuracoes', label: 'Configurações' },
  ];

  return (
    <>
      {toast && (
        <div
          className="fixed top-5 right-5 z-50 flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium shadow-lg"
          style={toast.type === 'success'
            ? { backgroundColor: 'var(--badge-success-bg)', color: 'var(--badge-success-text)', border: '1px solid var(--badge-success-text)' }
            : { backgroundColor: 'var(--badge-error-bg)', color: 'var(--badge-error-text)', border: '1px solid var(--badge-error-text)' }}
        >
          {toast.message}
        </div>
      )}

      {/* ── Cabeçalho ───────────────────────────────────────────────────── */}
      <div className="mb-6 space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="ui-h1">Gestão</h1>
            <p className="ui-sub">Seus clientes, a situação da conta de cada um e a sua comissão.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => void handleCopyReferral()}
              disabled={!referral}
              className="ui-btn ui-btn-secondary ui-btn-sm"
            >
              {copiedReferral ? 'Link copiado' : 'Copiar link de indicação'}
            </button>
            <button onClick={() => setShowCreateModal(true)} className="ui-btn ui-btn-primary ui-btn-sm">
              Criar dashboard
            </button>
          </div>
        </div>

        <ResumoGestor clients={clients} loading={loadingClients} />

        <div className="ui-seg" role="group" aria-label="Seções da gestão">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              aria-pressed={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Conteúdo da aba ─────────────────────────────────────────────── */}
      {activeTab === 'clientes' && (
        <TabClientes
          clients={clients}
          loading={loadingClients}
          selfEntry={selfEntry}
          onViewDashboard={handleViewDashboard}
          onManageReports={handleManageReports}
          onCreateClient={() => setShowCreateModal(true)}
          onInviteClient={setInviteClient}
          onCopyReferral={() => void handleCopyReferral()}
        />
      )}

      {activeTab === 'comissao' && (
        <TabFinanceiro clients={clients} loading={loadingClients} />
      )}

      {activeTab === 'configuracoes' && (
        <TabConfiguracoes
          referral={referral}
          loadingReferral={loadingReferral}
          copiedReferral={copiedReferral}
          regeneratingReferral={regeneratingReferral}
          onCopyReferral={() => void handleCopyReferral()}
          onRegenerateReferral={() => void handleRegenerateReferral()}
          invite={invite}
          loadingInvite={loadingInvite}
          copied={copied}
          regenerating={regenerating}
          onCopy={() => void handleCopy()}
          onRegenerate={() => void handleRegenerate()}
          onFetchInvite={() => void fetchInvite()}
          briefing={briefing}
          setBriefing={setBriefing}
          loadingBriefing={loadingBriefing}
          savingBriefing={savingBriefing}
          testingBriefing={testingBriefing}
          telegramPhase={telegramPhase}
          briefingDeepLink={briefingDeepLink}
          onSaveBriefing={() => void handleSaveBriefing()}
          onTestBriefing={() => void handleTestBriefing()}
          onConnectTelegram={() => void handleConnectTelegram()}
          onDisconnectTelegram={() => void handleDisconnectTelegram()}
          clients={clients}
          loadingClients={loadingClients}
          onDisconnect={handleDisconnect}
          onUpdateClientBriefing={handleUpdateClientBriefing}
          showToast={showToast}
        />
      )}

      {reportClient && (
        <ClientReportsModal
          clientName={reportClient.name}
          onClose={() => { setReportClient(null); apiService.clearSelectedClientOrgId(); }}
        />
      )}

      {showCreateModal && (
        <CreateDashboardModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => void fetchClients()}
          showToast={showToast}
        />
      )}

      {inviteClient && (
        <ClaimLinkModal
          client={inviteClient}
          onClose={() => setInviteClient(null)}
        />
      )}
    </>
  );
}
