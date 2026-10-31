'use client';

// Peças compartilhadas da tela de automações: catálogo de blocos, receitas
// prontas, campos de cada bloco, frases em português e a checagem ao vivo.
// Ficam fora do page.tsx porque a página do App Router não pode exportar
// nada além do componente, e o editor em canvas (FluxoCanvas) usa as mesmas.

import type {
  CrmAutomationStep, CrmAutomationStepType, CrmAutomationTrigger, CrmStage,
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
  grip:  'M9 6h.01M9 12h.01M9 18h.01M15 6h.01M15 12h.01M15 18h.01',
  x:     'M6 6l12 12M18 6L6 18',
  bolt:  'M13 3L5 14h6l-1 7 8-11h-6z',
  send:  'M21 3L10.5 13.5M21 3l-6.5 18-4-7.5L3 9.5z',
  quiet: 'M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.2A8 8 0 1 1 20 12zM9 12h.01M12 12h.01M15 12h.01',
  back:  'M15 6l-6 6 6 6',
};
const CIRCLED = new Set(['plus', 'clock', 'check', 'cross', 'ban']);

export function Icon({ name, size = 16, strokeWidth = 1.6 }: { name: string; size?: number; strokeWidth?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', flex: 'none' }}>
      {CIRCLED.has(name) && <circle cx="12" cy="12" r="9" />}
      <path d={ICON[name] ?? ''} />
    </svg>
  );
}

// ── Catálogo de blocos ─────────────────────────────────────────────────────

export type Kind = 'trigger' | 'action' | 'control';
interface BlockDef { kind: Kind; icon: string; label: string }

export const BLOCKS: Record<string, BlockDef> = {
  NEW_LEAD:      { kind: 'trigger', icon: 'plus',  label: 'Lead novo chegou' },
  STAGE_ENTERED: { kind: 'trigger', icon: 'arrow', label: 'Entrou numa etapa' },
  STAGE_IDLE:    { kind: 'trigger', icon: 'clock', label: 'Parado numa etapa' },
  NO_REPLY:      { kind: 'trigger', icon: 'mute',  label: 'Sem resposta' },
  LEAD_SILENT:   { kind: 'trigger', icon: 'quiet', label: 'Lead não respondeu' },
  SALE_WON:      { kind: 'trigger', icon: 'check', label: 'Venda ganha' },
  SALE_LOST:     { kind: 'trigger', icon: 'cross', label: 'Venda perdida' },

  MOVE_STAGE:    { kind: 'action',  icon: 'cols',  label: 'Mover para etapa' },
  ASSIGN:        { kind: 'action',  icon: 'user',  label: 'Atribuir responsável' },
  ADD_TAG:       { kind: 'action',  icon: 'tag',   label: 'Adicionar tag' },
  CREATE_TASK:   { kind: 'action',  icon: 'task',  label: 'Criar tarefa' },
  SET_FOLLOWUP:  { kind: 'action',  icon: 'cal',   label: 'Marcar follow-up' },
  ADD_NOTE:      { kind: 'action',  icon: 'note',  label: 'Registrar nota' },
  DISCARD:       { kind: 'action',  icon: 'ban',   label: 'Descartar lead' },
  SEND_MESSAGE:  { kind: 'action',  icon: 'send',  label: 'Enviar mensagem' },

  WAIT:          { kind: 'control', icon: 'hour',  label: 'Esperar' },
};
export const KIND_LABEL: Record<Kind, string> = { trigger: 'QUANDO', action: 'AÇÃO', control: 'ESPERA' };

export const TRIGGER_IDS: CrmAutomationTrigger[] = ['NEW_LEAD', 'STAGE_ENTERED', 'STAGE_IDLE', 'NO_REPLY', 'LEAD_SILENT', 'SALE_WON', 'SALE_LOST'];
export const ACTION_IDS: CrmAutomationStepType[] = ['SEND_MESSAGE', 'MOVE_STAGE', 'ASSIGN', 'ADD_TAG', 'CREATE_TASK', 'SET_FOLLOWUP', 'ADD_NOTE', 'DISCARD'];
// Mesma regra do backend: nos outros gatilhos o robô falaria no meio de uma
// conversa que um vendedor está tocando.
export const MESSAGE_TRIGGERS: CrmAutomationTrigger[] = ['NEW_LEAD', 'LEAD_SILENT'];

// ── Editor (o que está sendo montado) ──────────────────────────────────────

export interface Editor {
  id: string | null;
  name: string;
  trigger: CrmAutomationTrigger;
  cfg: Record<string, unknown>;
  steps: CrmAutomationStep[];
  stopOnReply: boolean;
}

// ── Receitas prontas ───────────────────────────────────────────────────────

export interface Receita {
  nome: string;
  descricao: string;
  trigger: CrmAutomationTrigger;
  cfg: (stages: CrmStage[]) => Record<string, unknown>;
  steps: (stages: CrmStage[]) => CrmAutomationStep[];
}

export const RECEITAS: Receita[] = [
  {
    nome: 'Boas-vindas no WhatsApp',
    descricao: 'Quem chega (ou volta a falar) recebe resposta na hora, com o nome do vendedor que vai atender.',
    trigger: 'NEW_LEAD',
    cfg: () => ({ includeReturning: true }),
    steps: () => [
      { type: 'ASSIGN', mode: 'ROUND_ROBIN' },
      { type: 'SEND_MESSAGE', message: 'Oi {nome}, aqui é {vendedor}! Recebi sua mensagem e já te respondo.' },
      { type: 'CREATE_TASK', title: 'Atender lead', dueInDays: 0, taskType: 'WHATSAPP' },
    ],
  },
  {
    nome: 'Cobrança de lead que sumiu',
    descricao: 'Lead não respondeu em 24h: uma mensagem de retomada, uma vez só até ele voltar a falar.',
    trigger: 'LEAD_SILENT',
    cfg: () => ({ hours: 24 }),
    steps: () => [
      { type: 'SEND_MESSAGE', message: 'Oi {nome}, conseguiu ver minha mensagem? Fico à disposição.' },
    ],
  },
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

// ── Miniatura do fluxo (cards da tela inicial e das receitas) ──────────────

export function Miniatura({ trigger, steps }: { trigger: CrmAutomationTrigger; steps: CrmAutomationStep[] }) {
  const blocos: { key: string; bg: string; borda: string }[] = [
    { key: trigger, bg: 'var(--accent-fill)', borda: 'var(--accent-fill)' },
    ...steps.map((s) => (
      s.type === 'WAIT' ? { key: s.type, bg: 'var(--tint-bg)', borda: 'var(--tint-ink)' }
      : s.type === 'DISCARD' ? { key: s.type, bg: 'var(--bg-elevated)', borda: 'var(--badge-error-text)' }
      : { key: s.type, bg: 'var(--bg-elevated)', borda: 'var(--border-control)' }
    )),
  ];
  return (
    <div aria-hidden="true" className="flex items-center justify-center px-3"
      style={{
        height: 96, borderBottom: '1px solid var(--border)', backgroundColor: 'var(--bg-base)',
        backgroundImage: 'radial-gradient(var(--border-md) 1px, transparent 1px)', backgroundSize: '14px 14px',
      }}>
      {blocos.map((b, i) => (
        <span key={i} className="flex items-center">
          {i > 0 && <span style={{ width: 12, height: 2, background: 'var(--border-control)' }} />}
          <span style={{ width: 34, height: 18, borderRadius: 6, background: b.bg, border: `1px solid ${b.borda}`, boxSizing: 'border-box' }} />
        </span>
      ))}
    </div>
  );
}

// ── Campos ─────────────────────────────────────────────────────────────────

export function Switch({ on, onClick, label }: { on: boolean; onClick: () => void; label?: string }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={onClick} className="ui-switch" />;
}

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
      {rotulo}{children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  backgroundColor: 'var(--input-bg)', border: '1px solid var(--input-border)', borderRadius: 10,
  color: 'var(--text-primary)', fontSize: 14, padding: '8px 10px', outline: 'none', width: '100%',
};

export function ParamsGatilho({ trigger, cfg, stages, onChange }: {
  trigger: CrmAutomationTrigger; cfg: Record<string, unknown>; stages: CrmStage[];
  onChange: (cfg: Record<string, unknown>) => void;
}) {
  const set = (patch: Record<string, unknown>) => onChange({ ...cfg, ...patch });
  return (
    <>
      {(trigger === 'STAGE_ENTERED' || trigger === 'STAGE_IDLE') && (
        <Campo rotulo="Etapa">
          <select value={(cfg.stageId as string) ?? ''} onChange={(e) => set({ stageId: e.target.value })} style={inputStyle}>
            <option value="">selecione…</option>
            {stages.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </Campo>
      )}
      {trigger === 'STAGE_IDLE' && (
        <Campo rotulo="Dias parado">
          <input type="number" min={1} max={365} value={Number(cfg.days ?? 7)}
            onChange={(e) => set({ days: Number(e.target.value) })} style={{ ...inputStyle, width: 96 }} />
        </Campo>
      )}
      {trigger === 'NO_REPLY' && (
        <Campo rotulo="Horas sem resposta do vendedor">
          <input type="number" min={1} max={720} value={Number(cfg.hours ?? 4)}
            onChange={(e) => set({ hours: Number(e.target.value) })} style={{ ...inputStyle, width: 96 }} />
        </Campo>
      )}
      {trigger === 'LEAD_SILENT' && (
        <Campo rotulo="Horas sem o lead responder">
          <input type="number" min={1} max={720} value={Number(cfg.hours ?? 24)}
            onChange={(e) => set({ hours: Number(e.target.value) })} style={{ ...inputStyle, width: 96 }} />
        </Campo>
      )}
      {trigger === 'NEW_LEAD' && (
        <label className="flex items-center gap-2.5 text-[13px]" style={{ color: 'var(--text-secondary)' }}>
          <Switch on={cfg.includeReturning === true} onClick={() => set({ includeReturning: cfg.includeReturning !== true })}
            label="Também quem volta a falar" />
          Também quem volta a falar (fora do funil, 7+ dias calado)
        </label>
      )}
      {trigger === 'SALE_LOST' && (
        <Campo rotulo="Motivo (vazio = qualquer)">
          <input type="text" value={(cfg.reason as string) ?? ''} maxLength={60}
            onChange={(e) => set({ reason: e.target.value })} style={inputStyle} />
        </Campo>
      )}
    </>
  );
}

export function ParamsPasso({ passo, stages, motivos, onChange }: {
  passo: CrmAutomationStep; stages: CrmStage[]; motivos: string[];
  onChange: (patch: Partial<CrmAutomationStep>) => void;
}) {
  switch (passo.type) {
    case 'MOVE_STAGE':
      return (
        <Campo rotulo="Etapa">
          <select value={passo.stageId ?? ''} onChange={(e) => onChange({ stageId: e.target.value })} style={inputStyle}>
            <option value="">selecione…</option>
            {stages.map((s) => <option key={s.id} value={s.id}>{s.name}{s.requiresValue ? ' (exige valor)' : ''}</option>)}
          </select>
        </Campo>
      );
    case 'ASSIGN':
      return (
        <Campo rotulo="Quem">
          <select value={passo.mode ?? 'ROUND_ROBIN'} onChange={(e) => onChange({ mode: e.target.value as 'ROUND_ROBIN' })} style={inputStyle}>
            <option value="ROUND_ROBIN">Próximo da fila (quem tem menos cards)</option>
          </select>
        </Campo>
      );
    case 'ADD_TAG':
      return (
        <Campo rotulo="Tag">
          <input value={passo.tag ?? ''} maxLength={30} onChange={(e) => onChange({ tag: e.target.value })} style={inputStyle} />
        </Campo>
      );
    case 'CREATE_TASK':
      return (
        <>
          <Campo rotulo="Título">
            <input value={passo.title ?? ''} maxLength={200} onChange={(e) => onChange({ title: e.target.value })} style={inputStyle} />
          </Campo>
          <Campo rotulo="Tipo">
            <select value={passo.taskType ?? 'OUTRO'} onChange={(e) => onChange({ taskType: e.target.value })} style={inputStyle}>
              {['LIGAR', 'WHATSAPP', 'REUNIAO', 'EMAIL', 'OUTRO'].map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Campo>
          <Campo rotulo="Vence em (dias)">
            <input type="number" min={0} max={365} value={passo.dueInDays ?? 1}
              onChange={(e) => onChange({ dueInDays: Number(e.target.value) })} style={{ ...inputStyle, width: 96 }} />
          </Campo>
        </>
      );
    case 'SET_FOLLOWUP':
    case 'WAIT':
      return (
        <Campo rotulo="Dias">
          <input type="number" min={passo.type === 'WAIT' ? 1 : 0} max={passo.type === 'WAIT' ? 180 : 365}
            value={passo.days ?? (passo.type === 'WAIT' ? 3 : 0)}
            onChange={(e) => onChange({ days: Number(e.target.value) })} style={{ ...inputStyle, width: 96 }} />
        </Campo>
      );
    case 'ADD_NOTE':
      return (
        <Campo rotulo="Texto">
          <textarea value={passo.text ?? ''} maxLength={2000} rows={3} onChange={(e) => onChange({ text: e.target.value })}
            style={{ ...inputStyle, resize: 'vertical' }} />
        </Campo>
      );
    case 'SEND_MESSAGE':
      return (
        <div className="flex flex-col gap-1.5">
          <Campo rotulo="Mensagem">
            <textarea value={passo.message ?? ''} maxLength={4000} rows={4}
              onChange={(e) => onChange({ message: e.target.value })} style={{ ...inputStyle, resize: 'vertical' }} />
          </Campo>
          <p className="text-[12px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {'{nome}'} = primeiro nome do contato · {'{vendedor}'} = responsável pelo card (sem responsável: &quot;nossa equipe&quot;)
            <span className="float-right tabular-nums">{(passo.message ?? '').length}/4000</span>
          </p>
        </div>
      );
    case 'DISCARD':
      return (
        <Campo rotulo="Motivo">
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

export function novoPasso(tipo: CrmAutomationStepType, stages: CrmStage[], motivos: string[]): CrmAutomationStep {
  switch (tipo) {
    case 'MOVE_STAGE':   return { type: tipo, stageId: stages[0]?.id ?? '' };
    case 'ASSIGN':       return { type: tipo, mode: 'ROUND_ROBIN' };
    case 'ADD_TAG':      return { type: tipo, tag: 'Novo' };
    case 'CREATE_TASK':  return { type: tipo, title: 'Ligar para o cliente', dueInDays: 1, taskType: 'LIGAR' };
    case 'SET_FOLLOWUP': return { type: tipo, days: 3 };
    case 'ADD_NOTE':     return { type: tipo, text: '' };
    case 'DISCARD':      return { type: tipo, reason: motivos[0] ?? '' };
    case 'WAIT':         return { type: tipo, days: 3 };
    case 'SEND_MESSAGE': return { type: tipo, message: 'Oi {nome}, aqui é {vendedor}! ' };
  }
}

export function cfgPadrao(t: CrmAutomationTrigger, stages: CrmStage[]): Record<string, unknown> {
  if (t === 'STAGE_ENTERED') return { stageId: stages[0]?.id };
  if (t === 'STAGE_IDLE') return { stageId: stages[0]?.id, days: 7 };
  if (t === 'NO_REPLY') return { hours: 4 };
  if (t === 'LEAD_SILENT') return { hours: 24 };
  return {};
}

const nomeEtapa = (id: string | undefined, stages: CrmStage[]) => stages.find((s) => s.id === id)?.name ?? '…';

export function fraseGatilho(t: CrmAutomationTrigger, cfg: Record<string, unknown>, stages: CrmStage[]): string {
  switch (t) {
    case 'NEW_LEAD':      return cfg.includeReturning ? 'um lead novo chegar (ou um contato voltar a falar)' : 'um lead novo chegar';
    case 'STAGE_ENTERED': return `um card entrar em ${nomeEtapa(cfg.stageId as string, stages)}`;
    case 'STAGE_IDLE':    return `um card ficar ${Number(cfg.days ?? 7)} dia(s) parado em ${nomeEtapa(cfg.stageId as string, stages)}`;
    case 'NO_REPLY':      return `um lead ficar ${Number(cfg.hours ?? 4)}h sem resposta`;
    case 'LEAD_SILENT':   return `o lead ficar ${Number(cfg.hours ?? 24)}h sem responder a nossa mensagem`;
    case 'SALE_WON':      return 'uma venda for ganha';
    case 'SALE_LOST':     return cfg.reason ? `uma venda for perdida por ${cfg.reason}` : 'uma venda for perdida';
  }
}

/** Resumo curto do gatilho para o rótulo em caixa alta do card. */
export function rotuloGatilho(t: CrmAutomationTrigger, cfg: Record<string, unknown>): string {
  switch (t) {
    case 'STAGE_IDLE':  return `${BLOCKS[t]!.label} · ${Number(cfg.days ?? 7)} dias`;
    case 'NO_REPLY':    return `${BLOCKS[t]!.label} · ${Number(cfg.hours ?? 4)}h`;
    case 'LEAD_SILENT': return `${BLOCKS[t]!.label} · ${Number(cfg.hours ?? 24)}h`;
    default:            return BLOCKS[t]!.label;
  }
}

/** Linha de baixo do bloco do gatilho no canvas. */
export function resumoGatilho(t: CrmAutomationTrigger, cfg: Record<string, unknown>, stages: CrmStage[]): string {
  switch (t) {
    case 'NEW_LEAD':      return cfg.includeReturning ? 'Inclui contato que volta a falar' : 'Primeira mensagem do contato';
    case 'STAGE_ENTERED': return nomeEtapa(cfg.stageId as string, stages);
    case 'STAGE_IDLE':    return `${nomeEtapa(cfg.stageId as string, stages)} · ${Number(cfg.days ?? 7)} dias`;
    case 'NO_REPLY':      return `Vendedor sem responder · ${Number(cfg.hours ?? 4)}h`;
    case 'LEAD_SILENT':   return `Lead calado · ${Number(cfg.hours ?? 24)}h`;
    case 'SALE_WON':      return 'Em qualquer etapa';
    case 'SALE_LOST':     return cfg.reason ? `Motivo: ${cfg.reason}` : 'Qualquer motivo';
  }
}

/** Uma linha que cabe no bloco do canvas. */
export function resumoPasso(s: CrmAutomationStep, stages: CrmStage[]): string {
  switch (s.type) {
    case 'MOVE_STAGE':   return nomeEtapa(s.stageId, stages);
    case 'ASSIGN':       return 'Rodízio entre os vendedores';
    case 'ADD_TAG':      return s.tag ? `“${s.tag}”` : 'sem tag';
    case 'CREATE_TASK':  return `${s.title ?? ''} · ${s.dueInDays === 0 ? 'hoje' : `em ${s.dueInDays} dia(s)`}`;
    case 'SET_FOLLOWUP': return `Daqui a ${s.days ?? 0} dia(s)`;
    case 'ADD_NOTE':     return s.text?.trim() || 'sem texto';
    case 'DISCARD':      return s.reason || 'escolha o motivo';
    case 'WAIT':         return `${s.days ?? 0} dia(s)`;
    case 'SEND_MESSAGE': return s.message?.trim() || 'escreva a mensagem';
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
    case 'SEND_MESSAGE': return `enviar pelo WhatsApp "${(s.message ?? '').trim() || '…'}"`;
  }
}

export function frasear(e: Editor, stages: CrmStage[]): string {
  const acoes = e.steps.map((s) => frasePasso(s, stages));
  const base = `Quando ${fraseGatilho(e.trigger, e.cfg, stages)}, ${acoes.length ? acoes.join('; ') + '.' : 'não fazer nada.'}`;
  return e.stopOnReply ? `${base} A sequência para se o lead responder.` : base;
}

export const statusLabel = (s: string) => ({
  PENDING: 'AGUARDANDO', RUNNING: 'RODANDO', DONE: 'CONCLUÍDA',
  FAILED: 'FALHOU', CANCELED: 'CANCELADA', STOPPED_BY_REPLY: 'PAROU (RESPONDEU)',
}[s] ?? s);

export function statusStyle(s: string): React.CSSProperties {
  if (s === 'FAILED') return { backgroundColor: 'var(--badge-error-bg)', color: 'var(--badge-error-text)' };
  if (s === 'DONE') return { backgroundColor: 'var(--badge-success-bg)', color: 'var(--badge-success-text)' };
  if (s === 'PENDING' || s === 'RUNNING') return { backgroundColor: 'var(--tint-bg)', color: 'var(--tint-ink)' };
  return { backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)' };
}

export function avisoStyle(n: 'err' | 'warn' | 'info'): React.CSSProperties {
  if (n === 'err') return { backgroundColor: 'var(--badge-error-bg)', color: 'var(--badge-error-text)' };
  if (n === 'warn') return { backgroundColor: 'var(--badge-warn-bg)', color: 'var(--badge-warn-text)' };
  return { backgroundColor: 'var(--tint-bg)', color: 'var(--tint-ink)' };
}

export type Aviso = { nivel: 'err' | 'warn' | 'info'; texto: string };

// Avisos ao vivo: o laço e a trava do funil o backend também recusa/registra,
// mas descobrir na tela é muito mais barato que descobrir numa run FAILED.
export function checarFluxo(editor: Editor, stages: CrmStage[]): Aviso[] {
  const out: Aviso[] = [];
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
      texto: `A etapa "${st.name}" exige venda aberta com valor. Card sem isso faz o passo falhar e a sequência parar — a falha aparece em Execuções com o motivo.`,
    });
  });
  if (editor.steps.some((s) => s.type === 'DISCARD')) out.push({
    nivel: 'warn',
    texto: 'Descarte automático tira o lead do funil e conta no histórico de descartes dele. Sem revisão humana.',
  });
  if ((editor.steps.some((s) => s.type === 'WAIT') || editor.trigger === 'STAGE_IDLE') && !editor.stopOnReply) {
    out.push({ nivel: 'info', texto: 'A sequência vai continuar mesmo se o cliente já tiver voltado a falar. Ligue "parar se o lead responder".' });
  }
  const msgs = editor.steps.filter((s) => s.type === 'SEND_MESSAGE');
  if (msgs.length > 0 && !MESSAGE_TRIGGERS.includes(editor.trigger)) out.push({
    nivel: 'err',
    texto: 'Enviar mensagem só vale nos gatilhos "Lead novo chegou" e "Lead não respondeu". Nos outros, o robô falaria no meio de uma conversa que um vendedor está tocando.',
  });
  if (msgs.length > 1) out.push({
    nivel: 'err',
    texto: 'Uma mensagem por automação. Para outra mensagem, crie outra automação (ex.: "Lead não respondeu em 24h").',
  });
  if (msgs.some((s) => !s.message?.trim())) out.push({ nivel: 'err', texto: 'Escreva o texto da mensagem.' });
  if (msgs.length > 0 && editor.trigger === 'NEW_LEAD') out.push({
    nivel: 'info',
    texto: 'Não sai se alguém responder o contato antes, nem para card criado à mão (o contato nunca escreveu). O motivo fica no histórico do card.',
  });
  if (msgs.length > 0 && editor.trigger === 'LEAD_SILENT') out.push({
    nivel: 'info',
    texto: 'Uma cobrança por vez: depois de enviada, só volta a cobrar quando o lead falar de novo. Promoção de Disparos não conta como conversa.',
  });
  if (editor.steps.some((s) => s.type === 'DISCARD' && !s.reason)) {
    out.push({ nivel: 'err', texto: 'O descarte exige um motivo — escolha na lista da sua organização.' });
  }
  if (out.length === 0) out.push({ nivel: 'info', texto: 'Fluxo íntegro: sem laço e sem passo que a trava do funil recusaria.' });
  return out;
}
