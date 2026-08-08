'use client';

// Automações do CRM — construtor em blocos arrastáveis.
//
// Formato: sequência LINEAR, não canvas de nós com fios. O público é gestor de
// tráfego e dono de loja, não engenheiro — "quando isto, faça aquilo" numa
// coluna só é o que eles leem sem treinamento.
//
// As ações só mexem no estado do card (mover, atribuir, tag, tarefa, follow-up,
// descartar). Enviar mensagem é o módulo de Disparos, que tem freio anti-ban
// próprio — juntar os dois exigiria uma fila única de saída por instância.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { apiService } from '@/lib/api';
import type {
  CrmAutomation, CrmAutomationRun, CrmAutomationStep, CrmAutomationStepType,
  CrmAutomationTrigger, CrmStage, CrmDiscardReasonOption,
} from '@/types';

// ── Ícones (line icons, herdam currentColor) ───────────────────────────────

const ICON: Record<string, string> = {
  plus:  'M12 8.5v7M8.5 12h7',
  arrow: 'M4 12h15M13.5 6.5L20 12l-6.5 5.5',
  clock: 'M12 7.5V12l3 1.8',
  mute:  'M20 14.5a2 2 0 0 1-2 2H8l-4 3.5V5.5a2 2 0 0 1 2-2h6M15.5 3.5l6 6M21.5 3.5l-6 6',
  check: 'M8.2 12.2l2.6 2.6 5-5.4',
  cross: 'M9.2 9.2l5.6 5.6M14.8 9.2l-5.6 5.6',
  cols:  'M3.5 6.5h6v11h-6zM14.5 6.5h6v11h-6zM10.2 12h3.6',
  user:  'M19.5 20v-1.5a4 4 0 0 0-4-4h-7a4 4 0 0 0-4 4V20M15.5 7.5a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0z',
  tag:   'M20.2 13.2l-7.4 7.4a1.8 1.8 0 0 1-2.6 0l-6.4-6.4V4.4H13l7.2 7.2a1.8 1.8 0 0 1 0 1.6zM9 8.2a1 1 0 1 1-2 0 1 1 0 0 1 2 0z',
  task:  'M20.5 12.5V19a1.8 1.8 0 0 1-1.8 1.8H5.3A1.8 1.8 0 0 1 3.5 19V5.3a1.8 1.8 0 0 1 1.8-1.8h10M8.5 11.5l3 3 8-8.4',
  cal:   'M3.5 7a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2zM16 3.2v3.6M8 3.2v3.6M3.5 10.2h17',
  note:  'M13.5 3.5H6.8A1.8 1.8 0 0 0 5 5.3v13.4a1.8 1.8 0 0 0 1.8 1.8h10.4a1.8 1.8 0 0 0 1.8-1.8V8.5zM13.5 3.5v5h5M8.5 13h7M8.5 16.5h4.5',
  ban:   'M5.6 5.6l12.8 12.8',
  hour:  'M8 3.5h8M8 20.5h8M8.5 3.5v3.2c0 2 3.5 3.4 3.5 5.3s-3.5 3.3-3.5 5.3v3M15.5 3.5v3.2c0 2-3.5 3.4-3.5 5.3s3.5 3.3 3.5 5.3v3',
  pause: 'M9.5 4.5v15M14.5 4.5v15',
  grip:  'M9 6h.01M9 12h.01M9 18h.01M15 6h.01M15 12h.01M15 18h.01',
  x:     'M6 6l12 12M18 6L6 18',
  bolt:  'M13 3L5 14h6l-1 7 8-11h-6z',
};
const CIRCLED = new Set(['plus', 'clock', 'check', 'cross', 'ban']);

function Icon({ name, size = 16, strokeWidth = 1.6 }: { name: string; size?: number; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', flex: 'none' }}>
      {CIRCLED.has(name) && <circle cx="12" cy="12" r="9" />}
      <path d={ICON[name] ?? ''} />
    </svg>
  );
}

// ── Catálogo de blocos ─────────────────────────────────────────────────────

type Kind = 'trigger' | 'action' | 'control';
interface BlockDef { kind: Kind; icon: string; label: string; color: string }

// Cor por bloco: o pedido foi "mais colorido e intuitivo". Cada família tem
// matiz própria e cada bloco varia dentro dela, então o olho acha o bloco pela
// cor antes de ler o texto. Hex é proibido no JSX — tudo sai de CSS var.
const BLOCKS: Record<string, BlockDef> = {
  NEW_LEAD:      { kind: 'trigger', icon: 'plus',  label: 'Lead novo chegou',     color: 'var(--auto-cyan)' },
  STAGE_ENTERED: { kind: 'trigger', icon: 'arrow', label: 'Entrou numa etapa',    color: 'var(--auto-blue)' },
  STAGE_IDLE:    { kind: 'trigger', icon: 'clock', label: 'Parado numa etapa',    color: 'var(--auto-amber)' },
  NO_REPLY:      { kind: 'trigger', icon: 'mute',  label: 'Sem resposta',         color: 'var(--auto-rose)' },
  SALE_WON:      { kind: 'trigger', icon: 'check', label: 'Venda ganha',          color: 'var(--auto-green)' },
  SALE_LOST:     { kind: 'trigger', icon: 'cross', label: 'Venda perdida',        color: 'var(--auto-red)' },

  MOVE_STAGE:    { kind: 'action',  icon: 'cols',  label: 'Mover para etapa',     color: 'var(--auto-blue)' },
  ASSIGN:        { kind: 'action',  icon: 'user',  label: 'Atribuir responsável', color: 'var(--auto-indigo)' },
  ADD_TAG:       { kind: 'action',  icon: 'tag',   label: 'Adicionar tag',        color: 'var(--auto-teal)' },
  CREATE_TASK:   { kind: 'action',  icon: 'task',  label: 'Criar tarefa',         color: 'var(--auto-green)' },
  SET_FOLLOWUP:  { kind: 'action',  icon: 'cal',   label: 'Marcar follow-up',     color: 'var(--auto-cyan)' },
  ADD_NOTE:      { kind: 'action',  icon: 'note',  label: 'Registrar nota',       color: 'var(--auto-slate)' },
  DISCARD:       { kind: 'action',  icon: 'ban',   label: 'Descartar lead',       color: 'var(--auto-red)' },

  WAIT:          { kind: 'control', icon: 'hour',  label: 'Esperar',              color: 'var(--auto-purple)' },
};
const KIND_LABEL: Record<Kind, string> = { trigger: 'QUANDO', action: 'FAÇA', control: 'CONTROLE' };

const TRIGGER_IDS: CrmAutomationTrigger[] = ['NEW_LEAD', 'STAGE_ENTERED', 'STAGE_IDLE', 'NO_REPLY', 'SALE_WON', 'SALE_LOST'];
const ACTION_IDS: CrmAutomationStepType[] = ['MOVE_STAGE', 'ASSIGN', 'ADD_TAG', 'CREATE_TASK', 'SET_FOLLOWUP', 'ADD_NOTE', 'DISCARD'];

// ── Receitas prontas ───────────────────────────────────────────────────────

interface Receita {
  nome: string;
  descricao: string;
  trigger: CrmAutomationTrigger;
  cfg: (stages: CrmStage[]) => Record<string, unknown>;
  steps: (stages: CrmStage[]) => CrmAutomationStep[];
}

const RECEITAS: Receita[] = [
  {
    nome: 'Esfriamento automático',
    descricao: 'Card parado no meio do funil sai da frente do vendedor e vira tarefa de resgate.',
    trigger: 'STAGE_IDLE',
    cfg: (s) => ({ stageId: s[Math.min(2, s.length - 1)]?.id, days: 7 }),
    steps: (s) => [
      { type: 'MOVE_STAGE', stageId: s[0]?.id },
      { type: 'CREATE_TASK', title: 'Ligar — proposta parada', dueInDays: 1, taskType: 'LIGAR' },
      { type: 'SET_FOLLOWUP', days: 3 },
    ],
  },
  {
    nome: 'Chegada de lead novo',
    descricao: 'Distribui o lead, marca de onde veio e cobra o primeiro contato no mesmo dia.',
    trigger: 'NEW_LEAD',
    cfg: () => ({}),
    steps: () => [
      { type: 'ASSIGN', mode: 'ROUND_ROBIN' },
      { type: 'ADD_TAG', tag: 'Novo' },
      { type: 'CREATE_TASK', title: 'Primeiro contato', dueInDays: 0, taskType: 'WHATSAPP' },
    ],
  },
  {
    nome: 'Resgate de lead perdido',
    descricao: 'Quem sumiu volta para a fila 30 dias depois, sem ocupar o funil enquanto isso.',
    trigger: 'SALE_LOST',
    cfg: () => ({}),
    steps: (s) => [
      { type: 'WAIT', days: 30 },
      { type: 'ADD_TAG', tag: 'Resgate' },
      { type: 'MOVE_STAGE', stageId: s[0]?.id },
      { type: 'CREATE_TASK', title: 'Retomar contato', dueInDays: 2, taskType: 'LIGAR' },
    ],
  },
  {
    nome: 'Pós-venda e indicação',
    descricao: 'Uma semana depois da venda ganha, cobra o follow-up que ninguém lembra de fazer.',
    trigger: 'SALE_WON',
    cfg: () => ({}),
    steps: () => [
      { type: 'WAIT', days: 7 },
      { type: 'ADD_TAG', tag: 'Cliente' },
      { type: 'CREATE_TASK', title: 'Pedir indicação', dueInDays: 1, taskType: 'LIGAR' },
    ],
  },
  {
    nome: 'SLA de primeira resposta',
    descricao: 'Lead esperando há 4 horas vira problema visível, não um card parado no board.',
    trigger: 'NO_REPLY',
    cfg: () => ({ hours: 4 }),
    steps: () => [
      { type: 'ADD_NOTE', text: 'SLA estourado — sem resposta há 4h' },
      { type: 'ADD_TAG', tag: 'Urgente' },
      { type: 'CREATE_TASK', title: 'Responder agora', dueInDays: 0, taskType: 'WHATSAPP' },
    ],
  },
  {
    nome: 'Limpeza de não qualificado',
    descricao: 'Lead parado na triagem há 15 dias sai do funil com motivo, sem virar venda fantasma.',
    trigger: 'STAGE_IDLE',
    cfg: (s) => ({ stageId: s[0]?.id, days: 15 }),
    steps: () => [
      { type: 'ADD_NOTE', text: 'Sem qualificação em 15 dias' },
      { type: 'DISCARD', reason: '' },
    ],
  },
];

// ── Página ─────────────────────────────────────────────────────────────────

interface Editor {
  id: string | null;
  name: string;
  trigger: CrmAutomationTrigger;
  cfg: Record<string, unknown>;
  steps: CrmAutomationStep[];
  stopOnReply: boolean;
}

export default function AutomacoesPage() {
  const { user } = useAuth();
  const podeConfigurar = !!user && ['ADMIN', 'SUPER_ADMIN', 'TRAFFIC_MANAGER'].includes(user.role);

  const [stages, setStages] = useState<CrmStage[]>([]);
  const [motivos, setMotivos] = useState<string[]>([]);
  const [lista, setLista] = useState<CrmAutomation[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [toast, setToast] = useState<{ texto: string; erro: boolean } | null>(null);
  const [runsDe, setRunsDe] = useState<string | null>(null);
  const [runs, setRuns] = useState<CrmAutomationRun[]>([]);

  const aviso = useCallback((texto: string, erro = false) => {
    setToast({ texto, erro });
    setTimeout(() => setToast(null), 5000);
  }, []);

  const recarregar = useCallback(async () => {
    const r = await apiService.getCrmAutomations().catch(() => null);
    if (r?.data) setLista(r.data);
  }, []);

  useEffect(() => {
    if (!podeConfigurar) { setCarregando(false); return; }
    Promise.all([
      apiService.getCrmStages().catch(() => ({ data: [] as CrmStage[] })),
      apiService.getCrmDiscardReasons().catch(() => ({ data: [] as CrmDiscardReasonOption[] })),
      apiService.getCrmAutomations().catch(() => ({ data: [] as CrmAutomation[] })),
    ]).then(([s, m, a]) => {
      setStages(s.data ?? []);
      setMotivos((m.data ?? []).map((x) => x.label));
      setLista(a.data ?? []);
    }).finally(() => setCarregando(false));
  }, [podeConfigurar]);

  const abrirReceita = (r: Receita) => setEditor({
    id: null, name: r.nome, trigger: r.trigger,
    cfg: r.cfg(stages), steps: r.steps(stages), stopOnReply: true,
  });

  const abrirExistente = (a: CrmAutomation) => setEditor({
    id: a.id, name: a.name, trigger: a.triggerType,
    cfg: (a.triggerConfig ?? {}) as Record<string, unknown>,
    steps: a.steps ?? [], stopOnReply: a.stopOnReply,
  });

  const abrirVazio = () => setEditor({
    id: null, name: 'Nova automação', trigger: 'NEW_LEAD', cfg: {}, steps: [], stopOnReply: true,
  });

  const salvar = async () => {
    if (!editor) return;
    setSalvando(true);
    try {
      const body = {
        name: editor.name, triggerType: editor.trigger,
        triggerConfig: editor.cfg, steps: editor.steps, stopOnReply: editor.stopOnReply,
      };
      if (editor.id) await apiService.updateCrmAutomation(editor.id, body);
      else await apiService.createCrmAutomation(body);
      await recarregar();
      setEditor(null);
      aviso(editor.id ? 'Automação atualizada.' : 'Automação criada.');
    } catch (err: unknown) {
      // A mensagem do backend é a que explica o laço / a trava — mostrar ela crua.
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      aviso(msg ?? 'Não foi possível salvar.', true);
    } finally {
      setSalvando(false);
    }
  };

  const alternar = async (a: CrmAutomation) => {
    try {
      await apiService.updateCrmAutomation(a.id, { enabled: !a.enabled });
      await recarregar();
    } catch { aviso('Não foi possível alterar.', true); }
  };

  const remover = async (a: CrmAutomation) => {
    if (!confirm(`Remover "${a.name}"? O histórico dos cards continua intacto.`)) return;
    try {
      await apiService.deleteCrmAutomation(a.id);
      await recarregar();
      aviso('Automação removida.');
    } catch { aviso('Não foi possível remover.', true); }
  };

  const verRuns = async (a: CrmAutomation) => {
    if (runsDe === a.id) { setRunsDe(null); return; }
    setRunsDe(a.id);
    const r = await apiService.getCrmAutomationRuns(a.id, 20).catch(() => null);
    setRuns(r?.data ?? []);
  };

  if (!podeConfigurar) {
    return (
      <div className="p-6">
        <div className="rounded-xl p-5" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <p style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Acesso restrito</p>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
            Automações são configuradas pelo administrador — elas agem sobre os cards de toda a operação.
            Quando uma delas mexer num card seu, o histórico dele mostra qual foi.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6" style={{ maxWidth: 1180, margin: '0 auto' }}>
      <style>{VARS}</style>

      <header className="mb-5">
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Automações do CRM</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)', maxWidth: '78ch' }}>
          O CRM faz sozinho o que hoje depende de alguém lembrar: mover card parado, distribuir lead novo,
          cobrar follow-up. <b style={{ color: 'var(--text-primary)' }}>Não envia mensagem</b> — para isso existe
          Disparos, que tem controle de envio próprio.
        </p>
      </header>

      {toast && (
        <div className="mb-4 rounded-lg px-4 py-3 text-sm" style={{
          backgroundColor: toast.erro ? 'var(--badge-error-bg)' : 'var(--badge-success-bg)',
          color: toast.erro ? 'var(--badge-error-text)' : 'var(--badge-success-text)',
        }}>{toast.texto}</div>
      )}

      {editor ? (
        <Construtor
          editor={editor} setEditor={setEditor} stages={stages} motivos={motivos}
          salvando={salvando} onSalvar={salvar} onCancelar={() => setEditor(null)}
        />
      ) : (
        <>
          {/* Automações da org */}
          <section className="mb-8">
            <div className="mb-3 flex items-center justify-between gap-3 flex-wrap">
              <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>
                Suas automações {lista.length > 0 && <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>({lista.length})</span>}
              </h2>
              <button onClick={abrirVazio} className="rounded-lg px-3 py-2 text-xs font-semibold"
                style={{ backgroundColor: 'var(--accent)', color: '#fff' }}>+ Criar do zero</button>
            </div>

            {carregando ? (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Carregando…</p>
            ) : lista.length === 0 ? (
              <div className="rounded-xl px-5 py-8 text-center text-sm"
                style={{ border: '1px dashed var(--border-md)', color: 'var(--text-muted)' }}>
                Nenhuma automação ainda. Escolha uma receita abaixo para começar.
              </div>
            ) : (
              <div className="space-y-2">
                {lista.map((a) => (
                  <div key={a.id} className="rounded-xl" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                    <div className="flex items-center gap-3 px-4 py-3 flex-wrap">
                      <span style={{ color: BLOCKS[a.triggerType]?.color ?? 'var(--accent)' }}>
                        <Icon name={BLOCKS[a.triggerType]?.icon ?? 'bolt'} size={18} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{a.name}</p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {resumo(a.triggerType, a.triggerConfig, a.steps, stages)}
                        </p>
                      </div>
                      <span className="text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>
                        {a.runCount} execuç{a.runCount === 1 ? 'ão' : 'ões'}
                      </span>
                      <button onClick={() => verRuns(a)} className="rounded-md px-2 py-1 text-xs font-semibold"
                        style={{ border: '1px solid var(--border-md)', color: 'var(--text-secondary)' }}>
                        {runsDe === a.id ? 'Fechar' : 'Histórico'}
                      </button>
                      <button onClick={() => abrirExistente(a)} className="rounded-md px-2 py-1 text-xs font-semibold"
                        style={{ border: '1px solid var(--border-md)', color: 'var(--text-secondary)' }}>Editar</button>
                      <button onClick={() => remover(a)} className="rounded-md px-2 py-1 text-xs font-semibold"
                        style={{ border: '1px solid var(--border-md)', color: 'var(--badge-error-text)' }}>Remover</button>
                      <Switch on={a.enabled} onClick={() => alternar(a)} />
                    </div>

                    {runsDe === a.id && (
                      <div className="px-4 pb-3" style={{ borderTop: '1px solid var(--border)' }}>
                        {runs.length === 0 ? (
                          <p className="pt-3 text-xs" style={{ color: 'var(--text-muted)' }}>Ainda não rodou em nenhum card.</p>
                        ) : runs.map((r) => (
                          <div key={r.id} className="flex items-start gap-3 py-2 text-xs" style={{ borderBottom: '1px solid var(--border)' }}>
                            <span className="rounded px-1.5 py-0.5 font-bold" style={statusStyle(r.status)}>{statusLabel(r.status)}</span>
                            <span className="min-w-0 flex-1">
                              <span style={{ color: 'var(--text-primary)' }}>{r.client?.name ?? '—'}</span>
                              {r.error && (
                                <span className="mt-0.5 block" style={{ color: 'var(--badge-error-text)' }}>{r.error}</span>
                              )}
                              {r.status === 'PENDING' && (
                                <span className="mt-0.5 block" style={{ color: 'var(--text-muted)' }}>
                                  próximo passo em {new Date(r.dueAt).toLocaleString('pt-BR')}
                                </span>
                              )}
                            </span>
                            <span className="tabular-nums" style={{ color: 'var(--text-muted)' }}>
                              {new Date(r.startedAt).toLocaleDateString('pt-BR')}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Receitas */}
          <section>
            <h2 className="mb-1 text-base font-bold" style={{ color: 'var(--text-primary)' }}>Receitas prontas</h2>
            <p className="mb-3 text-sm" style={{ color: 'var(--text-secondary)' }}>
              Escolha uma, ajuste os prazos e ligue. Dá para mudar tudo depois.
            </p>
            <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
              {RECEITAS.map((r) => (
                <button key={r.nome} onClick={() => abrirReceita(r)}
                  className="rounded-xl p-4 text-left transition-transform hover:-translate-y-0.5"
                  style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                  <div className="mb-2 flex items-center gap-2">
                    <span style={{ color: BLOCKS[r.trigger].color }}><Icon name={BLOCKS[r.trigger].icon} size={17} /></span>
                    <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{r.nome}</span>
                  </div>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)', minHeight: 34 }}>{r.descricao}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-1.5 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                    {r.steps(stages).map((s, i) => (
                      <span key={i} className="inline-flex items-center gap-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                        {i > 0 && <span style={{ opacity: 0.5 }}>→</span>}
                        <span style={{ color: BLOCKS[s.type]?.color }}><Icon name={BLOCKS[s.type]?.icon ?? 'bolt'} size={12} /></span>
                        {BLOCKS[s.type]?.label}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

// ── Construtor ─────────────────────────────────────────────────────────────

function Construtor({ editor, setEditor, stages, motivos, salvando, onSalvar, onCancelar }: {
  editor: Editor;
  setEditor: (e: Editor) => void;
  stages: CrmStage[];
  motivos: string[];
  salvando: boolean;
  onSalvar: () => void;
  onCancelar: () => void;
}) {
  const [dropPos, setDropPos] = useState<number | null>(null);
  const arrastando = useRef<{ tipo: 'novo' | 'move'; valor: string | number } | null>(null);
  const seqRef = useRef<HTMLDivElement>(null);

  const set = (patch: Partial<Editor>) => setEditor({ ...editor, ...patch });

  const posPeloY = (y: number) => {
    const cards = Array.from(seqRef.current?.querySelectorAll('[data-step]') ?? []);
    for (let i = 0; i < cards.length; i++) {
      const r = cards[i]!.getBoundingClientRect();
      if (y < r.top + r.height / 2) return i;
    }
    return cards.length;
  };

  const soltar = (e: React.DragEvent) => {
    e.preventDefault();
    const info = arrastando.current;
    const pos = dropPos ?? editor.steps.length;
    setDropPos(null); arrastando.current = null;
    if (!info) return;

    const steps = [...editor.steps];
    if (info.tipo === 'novo') {
      steps.splice(pos, 0, novoPasso(info.valor as CrmAutomationStepType, stages, motivos));
    } else {
      const de = info.valor as number;
      let para = pos; if (para > de) para--;
      if (para === de) return;
      const [it] = steps.splice(de, 1);
      if (it) steps.splice(para, 0, it);
    }
    set({ steps });
  };

  const addFim = (tipo: CrmAutomationStepType) =>
    set({ steps: [...editor.steps, novoPasso(tipo, stages, motivos)] });

  const alterarPasso = (i: number, patch: Partial<CrmAutomationStep>) => {
    const steps = [...editor.steps];
    steps[i] = { ...steps[i]!, ...patch };
    set({ steps });
  };

  const removerPasso = (i: number) => set({ steps: editor.steps.filter((_, j) => j !== i) });

  // Avisos ao vivo: o laço e a trava do funil o backend também recusa/registra,
  // mas descobrir na tela é muito mais barato que descobrir numa run FAILED.
  const avisos = useMemo(() => {
    const out: { nivel: 'err' | 'warn' | 'info'; texto: string }[] = [];
    const etapaGatilho = editor.cfg.stageId as string | undefined;
    const moves = editor.steps.filter((s) => s.type === 'MOVE_STAGE');

    if (editor.steps.length === 0) out.push({ nivel: 'err', texto: 'A automação precisa de pelo menos um passo.' });

    if ((editor.trigger === 'STAGE_ENTERED' || editor.trigger === 'STAGE_IDLE') && etapaGatilho) {
      if (moves.some((m) => m.stageId === etapaGatilho)) {
        const nome = stages.find((s) => s.id === etapaGatilho)?.name ?? 'a etapa';
        out.push({
          nivel: 'err',
          texto: editor.trigger === 'STAGE_ENTERED'
            ? `Laço: o gatilho é "entrou em ${nome}" e um passo move o card para ${nome} — a automação dispararia a si mesma.`
            : `Laço: mover para ${nome}, a mesma etapa que o gatilho vigia, reiniciaria a contagem para sempre.`,
        });
      }
    }
    if (moves.length > 1) out.push({
      nivel: 'warn',
      texto: 'Dois movimentos na mesma receita. Cada um grava um evento de mudança de etapa e conta no relatório de conversão.',
    });
    moves.forEach((m) => {
      const st = stages.find((s) => s.id === m.stageId);
      if (st?.requiresValue) out.push({
        nivel: 'warn',
        texto: `A etapa "${st.name}" exige venda aberta com valor. Card sem isso faz o passo falhar e a sequência parar — a falha aparece no Histórico com o motivo.`,
      });
    });
    if (editor.steps.some((s) => s.type === 'DISCARD')) out.push({
      nivel: 'warn',
      texto: 'Descarte automático tira o lead do funil e conta no histórico de descartes dele. Sem revisão humana.',
    });
    if ((editor.steps.some((s) => s.type === 'WAIT') || editor.trigger === 'STAGE_IDLE') && !editor.stopOnReply) {
      out.push({ nivel: 'info', texto: 'A sequência vai continuar mesmo se o cliente já tiver voltado a falar. Ligue "parar se o lead responder".' });
    }
    if (editor.steps.some((s) => s.type === 'DISCARD' && !s.reason)) {
      out.push({ nivel: 'err', texto: 'O descarte exige um motivo — escolha na lista da sua organização.' });
    }
    if (out.length === 0) out.push({ nivel: 'info', texto: 'Receita íntegra: sem laço e sem passo que a trava do funil recusaria.' });
    return out;
  }, [editor, stages]);

  const temErro = avisos.some((a) => a.nivel === 'err');

  return (
    <div className="grid gap-4" style={{ gridTemplateColumns: 'minmax(0,1fr)' }}>
      <div className="grid gap-4" style={{ gridTemplateColumns: 'var(--builder-cols)' }}>
        {/* Paleta */}
        <div>
          <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', position: 'sticky', top: 12 }}>
            <PaletaGrupo titulo="QUANDO" ids={TRIGGER_IDS as unknown as string[]}
              onClick={(id) => set({ trigger: id as CrmAutomationTrigger, cfg: cfgPadrao(id as CrmAutomationTrigger, stages) })}
              arrastavel={false} />
            <PaletaGrupo titulo="FAÇA" ids={ACTION_IDS as unknown as string[]}
              onClick={(id) => addFim(id as CrmAutomationStepType)}
              onDragStart={(id) => { arrastando.current = { tipo: 'novo', valor: id }; }} />
            <PaletaGrupo titulo="CONTROLE" ids={['WAIT']}
              onClick={() => addFim('WAIT')}
              onDragStart={(id) => { arrastando.current = { tipo: 'novo', valor: id }; }} />
            <p className="mt-3 pt-3 text-[11px] leading-relaxed" style={{ borderTop: '1px solid var(--border)', color: 'var(--text-muted)' }}>
              Arraste para a receita, ou clique para adicionar no fim. Clique num gatilho para trocá-lo.
            </p>
          </div>
        </div>

        {/* Sequência */}
        <div>
          <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <div className="mb-4 flex items-center justify-between gap-3 flex-wrap pb-3" style={{ borderBottom: '1px solid var(--border)' }}>
              <input value={editor.name} onChange={(e) => set({ name: e.target.value })} maxLength={80}
                className="min-w-[200px] flex-1 bg-transparent text-base font-bold outline-none"
                style={{ color: 'var(--text-primary)', borderBottom: '1px dashed var(--border-md)' }} />
              <label className="flex items-center gap-2 text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                <Switch on={editor.stopOnReply} onClick={() => set({ stopOnReply: !editor.stopOnReply })} />
                Parar se o lead responder
              </label>
            </div>

            <div ref={seqRef}
              onDragOver={(e) => { e.preventDefault(); setDropPos(posPeloY(e.clientY)); }}
              onDragLeave={(e) => { if (!seqRef.current?.contains(e.relatedTarget as Node)) setDropPos(null); }}
              onDrop={soltar}>

              {/* Gatilho — fixo no topo, não arrasta */}
              <PassoCard cor={BLOCKS[editor.trigger].color} icone={BLOCKS[editor.trigger].icon}
                titulo={BLOCKS[editor.trigger].label} kind="QUANDO" destaque>
                <ParamsGatilho trigger={editor.trigger} cfg={editor.cfg} stages={stages}
                  onChange={(cfg) => set({ cfg })} />
              </PassoCard>

              {editor.steps.map((s, i) => (
                <div key={i}>
                  <Conector />
                  <DropLine ativo={dropPos === i} />
                  <div data-step draggable
                    onDragStart={() => { arrastando.current = { tipo: 'move', valor: i }; }}
                    onDragEnd={() => { arrastando.current = null; setDropPos(null); }}>
                    <PassoCard cor={BLOCKS[s.type]?.color ?? 'var(--accent)'} icone={BLOCKS[s.type]?.icon ?? 'bolt'}
                      titulo={BLOCKS[s.type]?.label ?? s.type} kind={KIND_LABEL[BLOCKS[s.type]?.kind ?? 'action']}
                      onRemover={() => removerPasso(i)} arrastavel>
                      <ParamsPasso passo={s} stages={stages} motivos={motivos}
                        onChange={(patch) => alterarPasso(i, patch)} />
                    </PassoCard>
                  </div>
                </div>
              ))}
              <DropLine ativo={dropPos === editor.steps.length} />

              {editor.steps.length === 0 && (
                <div className="mt-3 rounded-xl px-4 py-8 text-center text-xs"
                  style={{ border: '1px dashed var(--border-md)', color: 'var(--text-muted)' }}>
                  Arraste uma ação da paleta, ou clique nela para adicionar.
                </div>
              )}
            </div>

            {/* Resumo em português */}
            <div className="mt-4 pt-4 text-sm leading-relaxed" style={{ borderTop: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
              <span className="mb-1.5 block text-[10px] font-bold tracking-widest" style={{ color: 'var(--text-muted)' }}>EM PORTUGUÊS</span>
              {frasear(editor, stages)}
            </div>
          </div>

          {avisos.map((a, i) => (
            <div key={i} className="mt-2 rounded-lg px-3 py-2.5 text-xs leading-relaxed" style={avisoStyle(a.nivel)}>{a.texto}</div>
          ))}

          <div className="mt-4 flex items-center gap-2">
            <button onClick={onSalvar} disabled={salvando || temErro}
              className="rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50"
              style={{ backgroundColor: 'var(--accent)', color: '#fff' }}>
              {salvando ? 'Salvando…' : editor.id ? 'Salvar alterações' : 'Criar automação'}
            </button>
            <button onClick={onCancelar} className="rounded-lg px-4 py-2 text-sm font-semibold"
              style={{ border: '1px solid var(--border-md)', color: 'var(--text-secondary)' }}>Cancelar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Peças ──────────────────────────────────────────────────────────────────

function PaletaGrupo({ titulo, ids, onClick, onDragStart, arrastavel = true }: {
  titulo: string; ids: string[];
  onClick: (id: string) => void;
  onDragStart?: (id: string) => void;
  arrastavel?: boolean;
}) {
  return (
    <div className="mb-3 last:mb-0">
      <p className="mb-2 text-[10px] font-bold tracking-widest" style={{ color: 'var(--text-muted)' }}>{titulo}</p>
      {ids.map((id) => {
        const b = BLOCKS[id]!;
        return (
          <div key={id} draggable={arrastavel}
            onDragStart={() => onDragStart?.(id)}
            onClick={() => onClick(id)}
            className="mb-1 flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 text-xs font-medium transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'var(--bg-elevated)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}>
            <span style={{ color: b.color }}><Icon name={b.icon} /></span>
            {b.label}
          </div>
        );
      })}
    </div>
  );
}

function PassoCard({ cor, icone, titulo, kind, children, onRemover, arrastavel, destaque }: {
  cor: string; icone: string; titulo: string; kind: string;
  children?: React.ReactNode; onRemover?: () => void; arrastavel?: boolean; destaque?: boolean;
}) {
  return (
    <div className="rounded-lg px-3 py-2.5" style={{
      backgroundColor: 'var(--bg-elevated)',
      border: '1px solid var(--border)',
      borderLeft: `3px solid ${cor}`,
      cursor: arrastavel ? 'grab' : 'default',
      boxShadow: destaque ? `0 0 0 1px ${cor} inset` : undefined,
    }}>
      <div className="flex items-center gap-2.5">
        {arrastavel && <span style={{ color: 'var(--text-muted)', opacity: 0.55 }}><Icon name="grip" size={14} strokeWidth={2.4} /></span>}
        <span style={{ color: cor }}><Icon name={icone} size={17} /></span>
        <span className="flex-1 truncate text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
          {titulo}
          <span className="ml-2 text-[9.5px] font-bold tracking-widest" style={{ color: cor, opacity: 0.85 }}>{kind}</span>
        </span>
        {onRemover && (
          <button onClick={onRemover} className="rounded p-1" style={{ color: 'var(--text-muted)' }} title="remover">
            <Icon name="x" size={14} />
          </button>
        )}
      </div>
      {children && <div className="ml-[26px] mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">{children}</div>}
    </div>
  );
}

const Conector = () => <div style={{ height: 14, marginLeft: 20, borderLeft: '1px solid var(--border-md)' }} />;
const DropLine = ({ ativo }: { ativo: boolean }) => (
  <div style={{ height: 2, margin: '2px 0', borderRadius: 1, backgroundColor: ativo ? 'var(--accent)' : 'transparent' }} />
);

function Switch({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <span onClick={onClick} className="relative inline-block shrink-0 cursor-pointer rounded-full transition-colors"
      style={{ width: 32, height: 18, backgroundColor: on ? 'var(--accent)' : '#94a3b8' }}>
      <span className="absolute rounded-full bg-white transition-all"
        style={{ width: 14, height: 14, top: 2, left: on ? 16 : 2 }} />
    </span>
  );
}

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <label className="inline-flex items-center gap-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>
      {rotulo}{children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  backgroundColor: 'transparent', border: 'none', borderBottom: '1px solid var(--border-md)',
  color: 'var(--text-primary)', fontSize: 12, fontWeight: 600, padding: '2px 2px', outline: 'none',
};

function ParamsGatilho({ trigger, cfg, stages, onChange }: {
  trigger: CrmAutomationTrigger; cfg: Record<string, unknown>; stages: CrmStage[];
  onChange: (cfg: Record<string, unknown>) => void;
}) {
  const set = (patch: Record<string, unknown>) => onChange({ ...cfg, ...patch });
  return (
    <>
      {(trigger === 'STAGE_ENTERED' || trigger === 'STAGE_IDLE') && (
        <Campo rotulo="etapa">
          <select value={(cfg.stageId as string) ?? ''} onChange={(e) => set({ stageId: e.target.value })} style={inputStyle}>
            <option value="">selecione…</option>
            {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Campo>
      )}
      {trigger === 'STAGE_IDLE' && (
        <Campo rotulo="dias parado">
          <input type="number" min={1} max={365} value={Number(cfg.days ?? 7)}
            onChange={(e) => set({ days: Number(e.target.value) })} style={{ ...inputStyle, width: 54 }} />
        </Campo>
      )}
      {trigger === 'NO_REPLY' && (
        <Campo rotulo="horas sem resposta">
          <input type="number" min={1} max={720} value={Number(cfg.hours ?? 4)}
            onChange={(e) => set({ hours: Number(e.target.value) })} style={{ ...inputStyle, width: 54 }} />
        </Campo>
      )}
      {trigger === 'SALE_LOST' && (
        <Campo rotulo="motivo (vazio = qualquer)">
          <input type="text" value={(cfg.reason as string) ?? ''} maxLength={60}
            onChange={(e) => set({ reason: e.target.value })} style={{ ...inputStyle, width: 180 }} />
        </Campo>
      )}
    </>
  );
}

function ParamsPasso({ passo, stages, motivos, onChange }: {
  passo: CrmAutomationStep; stages: CrmStage[]; motivos: string[];
  onChange: (patch: Partial<CrmAutomationStep>) => void;
}) {
  switch (passo.type) {
    case 'MOVE_STAGE':
      return (
        <Campo rotulo="etapa">
          <select value={passo.stageId ?? ''} onChange={(e) => onChange({ stageId: e.target.value })} style={inputStyle}>
            <option value="">selecione…</option>
            {stages.map((s) => <option key={s.id} value={s.id}>{s.name}{s.requiresValue ? ' (exige valor)' : ''}</option>)}
          </select>
        </Campo>
      );
    case 'ASSIGN':
      return (
        <Campo rotulo="quem">
          <select value={passo.mode ?? 'ROUND_ROBIN'} onChange={(e) => onChange({ mode: e.target.value as 'ROUND_ROBIN' })} style={inputStyle}>
            <option value="ROUND_ROBIN">Próximo da fila (quem tem menos cards)</option>
          </select>
        </Campo>
      );
    case 'ADD_TAG':
      return (
        <Campo rotulo="tag">
          <input value={passo.tag ?? ''} maxLength={30} onChange={(e) => onChange({ tag: e.target.value })}
            style={{ ...inputStyle, width: 150 }} />
        </Campo>
      );
    case 'CREATE_TASK':
      return (
        <>
          <Campo rotulo="título">
            <input value={passo.title ?? ''} maxLength={200} onChange={(e) => onChange({ title: e.target.value })}
              style={{ ...inputStyle, width: 220 }} />
          </Campo>
          <Campo rotulo="tipo">
            <select value={passo.taskType ?? 'OUTRO'} onChange={(e) => onChange({ taskType: e.target.value })} style={inputStyle}>
              {['LIGAR', 'WHATSAPP', 'REUNIAO', 'EMAIL', 'OUTRO'].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Campo>
          <Campo rotulo="vence em (dias)">
            <input type="number" min={0} max={365} value={passo.dueInDays ?? 1}
              onChange={(e) => onChange({ dueInDays: Number(e.target.value) })} style={{ ...inputStyle, width: 54 }} />
          </Campo>
        </>
      );
    case 'SET_FOLLOWUP':
    case 'WAIT':
      return (
        <Campo rotulo="dias">
          <input type="number" min={passo.type === 'WAIT' ? 1 : 0} max={passo.type === 'WAIT' ? 180 : 365}
            value={passo.days ?? (passo.type === 'WAIT' ? 3 : 0)}
            onChange={(e) => onChange({ days: Number(e.target.value) })} style={{ ...inputStyle, width: 54 }} />
        </Campo>
      );
    case 'ADD_NOTE':
      return (
        <Campo rotulo="texto">
          <input value={passo.text ?? ''} maxLength={2000} onChange={(e) => onChange({ text: e.target.value })}
            style={{ ...inputStyle, width: 320 }} />
        </Campo>
      );
    case 'DISCARD':
      return (
        <Campo rotulo="motivo">
          <select value={passo.reason ?? ''} onChange={(e) => onChange({ reason: e.target.value })} style={inputStyle}>
            <option value="">selecione…</option>
            {motivos.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </Campo>
      );
    default:
      return null;
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function novoPasso(tipo: CrmAutomationStepType, stages: CrmStage[], motivos: string[]): CrmAutomationStep {
  switch (tipo) {
    case 'MOVE_STAGE':   return { type: tipo, stageId: stages[0]?.id ?? '' };
    case 'ASSIGN':       return { type: tipo, mode: 'ROUND_ROBIN' };
    case 'ADD_TAG':      return { type: tipo, tag: 'Novo' };
    case 'CREATE_TASK':  return { type: tipo, title: 'Ligar para o cliente', dueInDays: 1, taskType: 'LIGAR' };
    case 'SET_FOLLOWUP': return { type: tipo, days: 3 };
    case 'ADD_NOTE':     return { type: tipo, text: '' };
    case 'DISCARD':      return { type: tipo, reason: motivos[0] ?? '' };
    case 'WAIT':         return { type: tipo, days: 3 };
  }
}

function cfgPadrao(t: CrmAutomationTrigger, stages: CrmStage[]): Record<string, unknown> {
  if (t === 'STAGE_ENTERED') return { stageId: stages[0]?.id };
  if (t === 'STAGE_IDLE') return { stageId: stages[0]?.id, days: 7 };
  if (t === 'NO_REPLY') return { hours: 4 };
  return {};
}

const nomeEtapa = (id: string | undefined, stages: CrmStage[]) => stages.find((s) => s.id === id)?.name ?? '…';

function fraseGatilho(t: CrmAutomationTrigger, cfg: Record<string, unknown>, stages: CrmStage[]): string {
  switch (t) {
    case 'NEW_LEAD':      return 'um lead novo chegar';
    case 'STAGE_ENTERED': return `um card entrar em ${nomeEtapa(cfg.stageId as string, stages)}`;
    case 'STAGE_IDLE':    return `um card ficar ${Number(cfg.days ?? 7)} dia(s) parado em ${nomeEtapa(cfg.stageId as string, stages)}`;
    case 'NO_REPLY':      return `um lead ficar ${Number(cfg.hours ?? 4)}h sem resposta`;
    case 'SALE_WON':      return 'uma venda for ganha';
    case 'SALE_LOST':     return cfg.reason ? `uma venda for perdida por ${cfg.reason}` : 'uma venda for perdida';
  }
}

function frasePasso(s: CrmAutomationStep, stages: CrmStage[]): string {
  switch (s.type) {
    case 'MOVE_STAGE':   return `mover o card para ${nomeEtapa(s.stageId, stages)}`;
    case 'ASSIGN':       return 'atribuir ao próximo vendedor da fila';
    case 'ADD_TAG':      return `adicionar a tag ${s.tag}`;
    case 'CREATE_TASK':  return `criar a tarefa "${s.title}" vencendo em ${s.dueInDays} dia(s)`;
    case 'SET_FOLLOWUP': return `marcar follow-up para +${s.days} dias`;
    case 'ADD_NOTE':     return `registrar a nota "${s.text}"`;
    case 'DISCARD':      return `descartar o lead com o motivo ${s.reason || '…'}`;
    case 'WAIT':         return `esperar ${s.days} dias`;
  }
}

function frasear(e: Editor, stages: CrmStage[]): string {
  const acoes = e.steps.map((s) => frasePasso(s, stages));
  const base = `Quando ${fraseGatilho(e.trigger, e.cfg, stages)}, ${acoes.length ? acoes.join('; ') + '.' : 'não fazer nada.'}`;
  return e.stopOnReply ? `${base} A sequência para se o lead responder.` : base;
}

function resumo(t: CrmAutomationTrigger, cfg: CrmAutomation['triggerConfig'], steps: CrmAutomationStep[], stages: CrmStage[]) {
  return `${fraseGatilho(t, cfg as Record<string, unknown>, stages)} → ${steps.map((s) => BLOCKS[s.type]?.label ?? s.type).join(' · ')}`;
}

const statusLabel = (s: string) => ({
  PENDING: 'AGUARDANDO', RUNNING: 'RODANDO', DONE: 'CONCLUÍDA',
  FAILED: 'FALHOU', CANCELED: 'CANCELADA', STOPPED_BY_REPLY: 'PAROU (RESPONDEU)',
}[s] ?? s);

function statusStyle(s: string): React.CSSProperties {
  if (s === 'FAILED') return { backgroundColor: 'var(--badge-error-bg)', color: 'var(--badge-error-text)' };
  if (s === 'DONE') return { backgroundColor: 'var(--badge-success-bg)', color: 'var(--badge-success-text)' };
  if (s === 'PENDING' || s === 'RUNNING') return { backgroundColor: 'var(--accent-dim)', color: 'var(--accent)' };
  return { backgroundColor: 'var(--bg-elevated)', color: 'var(--text-muted)' };
}

function avisoStyle(n: 'err' | 'warn' | 'info'): React.CSSProperties {
  if (n === 'err') return { backgroundColor: 'var(--badge-error-bg)', color: 'var(--badge-error-text)' };
  if (n === 'warn') return { backgroundColor: 'var(--badge-warn-bg)', color: 'var(--badge-warn-text)' };
  return { backgroundColor: 'var(--accent-dim)', color: 'var(--accent)' };
}

// Cores dos blocos e layout do construtor. Ficam aqui (e não no globals.css)
// porque só esta tela usa — mas continuam sendo CSS vars, com valor próprio por
// tema: os tons claros do dark ficam ilegíveis em fundo branco.
const VARS = `
  [data-theme="dark"] {
    --auto-cyan:#22d3ee; --auto-blue:#60a5fa; --auto-amber:#fbbf24; --auto-rose:#fb7185;
    --auto-green:#4ade80; --auto-red:#f87171; --auto-indigo:#a5b4fc; --auto-teal:#2dd4bf;
    --auto-slate:#94a3b8; --auto-purple:#c084fc;
  }
  [data-theme="light"] {
    --auto-cyan:#0891b2; --auto-blue:#2563eb; --auto-amber:#b45309; --auto-rose:#be123c;
    --auto-green:#16a34a; --auto-red:#dc2626; --auto-indigo:#4338ca; --auto-teal:#0d9488;
    --auto-slate:#475569; --auto-purple:#7c3aed;
  }
  :root { --builder-cols: 232px minmax(0, 1fr); }
  @media (max-width: 900px) { :root { --builder-cols: minmax(0, 1fr); } }
`;
