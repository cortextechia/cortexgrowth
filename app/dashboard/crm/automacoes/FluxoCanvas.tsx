'use client';

// Editor de automação em canvas (estilo escolhido pelo Benny em 30/10, no
// lugar da coluna de blocos). Tela de nós com fios sobre o MOTOR de lista:
// um gatilho e uma sequência de passos. A ordem é a posição da esquerda para a
// direita, e arrastar um bloco para outra coluna reordena a sequência.
// Desde 31/10 pode haver UMA condição (horário comercial): depois dela o fluxo
// abre em dois caminhos — "Sim" na faixa de cima, "Não" na de baixo. Na lista
// salva os dois ficam em sequência (ver `separar`/`juntar` em blocos.tsx).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow, ReactFlowProvider, Background, BackgroundVariant, Controls, ControlButton,
  Handle, Position, useReactFlow,
  type Node, type Edge, type NodeProps, type NodeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { apiService } from '@/lib/api';
import type {
  CrmAutomationRun, CrmAutomationStep, CrmAutomationStepStats, CrmAutomationStepType,
  CrmAutomationTrigger, CrmStage,
} from '@/types';
import {
  ACTION_IDS, BLOCKS, Icon, KIND_LABEL, ParamsGatilho, ParamsPasso, Switch, TRIGGER_IDS,
  avisoStyle, cfgPadrao, checarFluxo, frasear, indiceDe, juntar, novoPasso, ondeFica,
  resumoGatilho, resumoPasso, separar, statusLabel, statusStyle,
  type Caminho, type Editor, type Partes,
} from './blocos';

// ── Geometria ──────────────────────────────────────────────────────────────

const W = 224;          // largura do bloco
const H = 112;          // altura do bloco
const GAP = 64;         // fio entre blocos
const X0 = 40;
const Y0 = 120;
const DY = 100;         // quanto os caminhos Sim/Não sobem e descem da linha principal
const xDaColuna = (col: number) => X0 + col * (W + GAP);
const DRAG_MIME = 'application/x-cromalex-bloco';
// Tamanho fixo e conhecido: os nós são recriados a cada render (a posição é a
// ordem), então o React Flow precisa receber a medida em vez de medir de novo.
const MEDIDA = { width: W, height: H };
// Abaixo de 0,8 o texto do bloco fica ilegível: fluxo longo rola para o lado.
const ENQUADRAR = { maxZoom: 1, minZoom: 0.8 };

const yDo = (c: Caminho | 'cond') => (c === 'sim' ? Y0 - DY : c === 'nao' ? Y0 + DY : Y0);
function colunaDe(p: Partes, c: Caminho | 'cond', k: number) {
  if (c === 'main') return k + 1;
  if (c === 'cond') return p.main.length + 1;
  return p.main.length + 2 + k;
}
const NOME_CAMINHO: Record<Caminho, string> = { main: 'antes da condição', sim: 'Sim', nao: 'Não' };

// ── Execuções → selos em cima de cada bloco ────────────────────────────────

type Tom = 'ok' | 'wait' | 'err' | 'muted';
interface Selo { texto: string; tom: Tom }
type Linha = CrmAutomationStepStats['rows'][number];

/**
 * `stepIndex` da run é o PRÓXIMO passo a rodar. Uma run parada (PENDING,
 * STOPPED, CANCELED) com `stepIndex = k` está depois do passo k-1 — no motor
 * isso só acontece no começo (k = 0, gatilho) ou depois de um WAIT. Uma FAILED
 * quebrou no passo k. DONE passou por todos os do caminho dela.
 * Com condição, a run que terminou o "Sim" para em `fimSim` (onde o "Não"
 * começa) — por isso passar de um bloco do "Sim" é estar em (i, fimSim], sem
 * ser a falha no 1º passo do "Não".
 */
function selosPorBloco(stats: CrmAutomationStepStats, steps: CrmAutomationStep[]): Map<string, Selo[]> {
  const out = new Map<string, Selo[]>();
  const add = (id: string, s: Selo) => out.set(id, [...(out.get(id) ?? []), s]);
  const blocoAntes = (k: number) => (k <= 0 ? 't' : `s${Math.min(k, steps.length) - 1}`);
  const p = separar(steps);
  const c = p.cond ? p.main.length : -1;
  const fimSim = c + 1 + p.sim.length;

  const total = stats.rows.reduce((t, r) => t + r.count, 0);
  if (total === 0) return out;
  add('t', { texto: `${total} ${total === 1 ? 'entrou' : 'entraram'}`, tom: 'ok' });

  const soma = (f: (r: Linha) => boolean) => stats.rows.filter(f).reduce((t, r) => t + r.count, 0);
  const falhouNoNao = (r: Linha) => r.status === 'FAILED' && r.stepIndex === fimSim;
  const noSim = (r: Linha) => c >= 0 && r.stepIndex > c && r.stepIndex <= fimSim && !falhouNoNao(r);

  steps.forEach((s, i) => {
    const parado = (r: Linha) => r.stepIndex === i + 1 && r.status !== 'DONE' && r.status !== 'FAILED' && s.type === 'WAIT';
    const lugar = ondeFica(p, i).caminho;
    const passou = soma((r) => r.stepIndex > i && !parado(r) && (lugar !== 'sim' || noSim(r)));
    if (s.type === 'CONDITION') {
      // "Não" vazio: quem terminou pelo Sim e quem só passou pela condição param
      // no mesmo número, então só dá para mostrar o total.
      const sim = soma(noSim);
      if (p.nao.length > 0 && passou > 0) {
        add(`s${i}`, { texto: `Sim ${sim} · Não ${passou - sim}`, tom: 'ok' });
      } else if (passou > 0) {
        add(`s${i}`, { texto: `✓ ${passou} ${passou === 1 ? 'passou' : 'passaram'}`, tom: 'ok' });
      }
    } else if (passou > 0) {
      add(`s${i}`, { texto: `✓ ${passou} ${s.type === 'WAIT' ? (passou === 1 ? 'seguiu' : 'seguiram') : (passou === 1 ? 'feito' : 'feitos')}`, tom: 'ok' });
    }
    const falhas = soma((r) => r.status === 'FAILED' && r.stepIndex === i);
    if (falhas > 0) add(`s${i}`, { texto: `✕ ${falhas} ${falhas === 1 ? 'falhou' : 'falharam'}`, tom: 'err' });
  });

  const porParada = new Map<string, { esperando: number; respondeu: number; cancelada: number }>();
  stats.rows.forEach((r) => {
    if (r.status !== 'PENDING' && r.status !== 'RUNNING' && r.status !== 'STOPPED_BY_REPLY' && r.status !== 'CANCELED') return;
    const id = blocoAntes(r.stepIndex);
    const acc = porParada.get(id) ?? { esperando: 0, respondeu: 0, cancelada: 0 };
    if (r.status === 'STOPPED_BY_REPLY') acc.respondeu += r.count;
    else if (r.status === 'CANCELED') acc.cancelada += r.count;
    else acc.esperando += r.count;
    porParada.set(id, acc);
  });
  porParada.forEach((v, id) => {
    if (v.esperando) add(id, { texto: `${v.esperando} esperando agora`, tom: 'wait' });
    if (v.respondeu) add(id, { texto: `${v.respondeu} ${v.respondeu === 1 ? 'parou' : 'pararam'}: lead respondeu`, tom: 'muted' });
    if (v.cancelada) add(id, { texto: `${v.cancelada} ${v.cancelada === 1 ? 'cancelado' : 'cancelados'}`, tom: 'muted' });
  });
  return out;
}

const SELO_STYLE: Record<Tom, React.CSSProperties> = {
  ok:    { background: 'var(--bg-surface)', color: 'var(--badge-success-text)', boxShadow: 'inset 0 0 0 1px var(--border-md)' },
  wait:  { background: 'var(--tint-bg)', color: 'var(--tint-ink)' },
  err:   { background: 'var(--bg-surface)', color: 'var(--badge-error-text)', boxShadow: 'inset 0 0 0 1px var(--badge-error-text)' },
  muted: { background: 'var(--bg-surface)', color: 'var(--text-secondary)', boxShadow: 'inset 0 0 0 1px var(--border-md)' },
};

// ── Nó ─────────────────────────────────────────────────────────────────────

interface BlocoData extends Record<string, unknown> {
  tipo: string;
  rotulo: string;      // QUANDO / AÇÃO / ESPERA / SE
  titulo: string;
  resumo: string;
  ehGatilho: boolean;
  selos: Selo[];
  falhou: boolean;
}
type BlocoNode = Node<BlocoData, 'bloco'>;

function BlocoNo({ data, selected }: NodeProps<BlocoNode>) {
  const espera = data.tipo === 'WAIT';
  const condicao = data.tipo === 'CONDITION';
  const borda = selected ? '2px solid var(--accent)' : data.falhou ? '2px solid var(--badge-error-text)' : condicao ? '1px solid var(--accent)' : '1px solid var(--border-md)';
  return (
    <div style={{
      width: W, height: H, boxSizing: 'border-box', padding: '12px 14px', borderRadius: 16, border: borda,
      background: 'var(--bg-surface)', display: 'flex', flexDirection: 'column', gap: 6, position: 'relative',
      boxShadow: selected ? '0 18px 44px rgba(0,0,0,0.18)' : undefined,
    }}>
      {data.selos.length > 0 && (
        <div style={{ position: 'absolute', left: 0, bottom: H + 6, display: 'flex', flexWrap: 'wrap-reverse', gap: 4, width: W + 40 }}>
          {data.selos.map((s, i) => (
            <span key={i} style={{ ...SELO_STYLE[s.tom], fontSize: 11.5, fontWeight: 600, padding: '2px 8px', borderRadius: 999, whiteSpace: 'nowrap' }}>{s.texto}</span>
          ))}
        </div>
      )}
      {!data.ehGatilho && <Handle type="target" position={Position.Left} isConnectable={false} />}
      <Handle type="source" position={Position.Right} isConnectable={false} />
      <div className="flex items-center gap-2">
        <span className="flex items-center justify-center" style={{
          width: 28, height: 28, borderRadius: 9,
          background: data.ehGatilho ? 'var(--accent-fill)' : espera ? 'var(--tint-bg)' : 'var(--bg-base)',
          color: data.ehGatilho ? 'var(--on-accent)' : espera ? 'var(--tint-ink)' : condicao ? 'var(--accent)' : 'var(--text-primary)',
          border: data.ehGatilho || espera ? 'none' : condicao ? '1px solid var(--accent)' : '1px solid var(--border)',
        }}>
          <Icon name={BLOCKS[data.tipo]?.icon ?? 'bolt'} size={15} strokeWidth={2} />
        </span>
        <span style={{
          font: '500 10.5px/1.4 var(--font-mono-cx), ui-monospace, monospace', letterSpacing: '0.06em',
          color: data.ehGatilho || condicao ? 'var(--accent)' : espera ? 'var(--tint-ink)' : 'var(--text-secondary)',
        }}>{data.rotulo}</span>
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.25, color: 'var(--text-primary)' }}>{data.titulo}</div>
      <div style={{ fontSize: 12, lineHeight: 1.35, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{data.resumo}</div>
    </div>
  );
}

function VazioNo({ data, selected }: NodeProps<Node<{ texto: string }, 'vazio'>>) {
  return (
    <div style={{
      width: W, height: H, boxSizing: 'border-box', borderRadius: 16,
      border: `2px dashed ${selected ? 'var(--accent)' : 'var(--border-control)'}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 12,
      fontSize: 12.5, color: 'var(--text-secondary)', background: 'transparent',
    }}>
      <Handle type="target" position={Position.Left} isConnectable={false} />
      {data.texto}
    </div>
  );
}

const NODE_TYPES = { bloco: BlocoNo, vazio: VazioNo };

const FIO = { stroke: 'var(--border-control)', strokeWidth: 2 };
const ROTULO_SIM = {
  label: 'Sim', labelStyle: { fill: 'var(--on-accent)', fontWeight: 700, fontSize: 12 },
  labelBgStyle: { fill: 'var(--accent-fill)' }, labelBgPadding: [8, 3] as [number, number], labelBgBorderRadius: 999,
};
const ROTULO_NAO = {
  label: 'Não', labelStyle: { fill: 'var(--text-secondary)', fontWeight: 700, fontSize: 12 },
  labelBgStyle: { fill: 'var(--bg-surface)', stroke: 'var(--border-control)' }, labelBgPadding: [8, 3] as [number, number], labelBgBorderRadius: 999,
};

// ── Editor ─────────────────────────────────────────────────────────────────

type Sel = 't' | number | null;
type Modo = 'editar' | 'execucoes';

interface Props {
  editor: Editor;
  setEditor: (e: Editor) => void;
  stages: CrmStage[];
  motivos: string[];
  salvando: boolean;
  modoInicial?: Modo;
  onSalvar: () => void;
  onVoltar: () => void;
}

export default function FluxoCanvas(props: Props) {
  return (
    <ReactFlowProvider>
      <FluxoCanvasInner {...props} />
    </ReactFlowProvider>
  );
}

function FluxoCanvasInner({ editor, setEditor, stages, motivos, salvando, modoInicial = 'editar', onSalvar, onVoltar }: Props) {
  const rf = useReactFlow();
  const [sel, setSel] = useState<Sel>('t');
  // Para onde vai o bloco clicado na lista quando há condição
  const [alvo, setAlvo] = useState<Caminho>('sim');
  const [modo, setModo] = useState<Modo>(editor.id ? modoInicial : 'editar');
  const [arrasto, setArrasto] = useState<{ id: string; x: number; y: number } | null>(null);
  const [stats, setStats] = useState<CrmAutomationStepStats | null>(null);
  const [runs, setRuns] = useState<CrmAutomationRun[] | null>(null);
  const [original] = useState(() => JSON.stringify(editor));

  const set = useCallback((patch: Partial<Editor>) => setEditor({ ...editor, ...patch }), [editor, setEditor]);
  const n = editor.steps.length;
  const partes = useMemo(() => separar(editor.steps), [editor.steps]);
  const alvoEf: Caminho = partes.cond ? alvo : 'main';

  // Lido também no modo Editar: é o que diz se há card no meio do fluxo.
  useEffect(() => {
    if (!editor.id) return;
    let vivo = true;
    apiService.getCrmAutomationStepStats(editor.id).catch(() => null).then((s) => {
      if (vivo) setStats(s?.data ?? { windowDays: 90, rows: [] });
    });
    return () => { vivo = false; };
  }, [editor.id]);

  useEffect(() => {
    if (modo !== 'execucoes' || !editor.id) return;
    let vivo = true;
    apiService.getCrmAutomationRuns(editor.id, 30).catch(() => null).then((r) => {
      if (vivo) setRuns(r?.data ?? []);
    });
    return () => { vivo = false; };
  }, [modo, editor.id]);

  // A execução guarda só o NÚMERO do próximo passo: quem está esperando no meio
  // do fluxo continua do mesmo número na sequência nova.
  const noMeio = (stats?.rows ?? [])
    .filter((r) => (r.status === 'PENDING' || r.status === 'RUNNING') && r.stepIndex > 0)
    .reduce((t, r) => t + r.count, 0);
  const passosMudaram = JSON.stringify(editor.steps) !== JSON.stringify((JSON.parse(original) as Editor).steps);
  const avisos = useMemo(() => {
    const base = checarFluxo(editor, stages);
    if (noMeio === 0 || !passosMudaram) return base;
    return [{
      nivel: 'warn' as const,
      texto: `${noMeio} ${noMeio === 1 ? 'card está' : 'cards estão'} no meio deste fluxo. Ao salvar, ${noMeio === 1 ? 'ele continua' : 'eles continuam'} do mesmo número de passo na sequência nova — se você mudou a ordem ou os caminhos, pode pular ou repetir passos.`,
    }, ...base.filter((a) => !a.texto.startsWith('Fluxo íntegro'))];
  }, [editor, stages, noMeio, passosMudaram]);
  const temErro = avisos.some((a) => a.nivel === 'err');

  const selos = useMemo(
    () => (modo === 'execucoes' && stats ? selosPorBloco(stats, editor.steps) : new Map<string, Selo[]>()),
    [modo, stats, editor.steps],
  );

  // ── nós e fios (derivados do editor: a posição É a ordem) ──
  const nodes = useMemo<Node[]>(() => {
    const out: Node[] = [{
      id: 't', type: 'bloco', position: { x: xDaColuna(0), y: Y0 }, measured: MEDIDA, draggable: false, deletable: false,
      selected: sel === 't',
      data: {
        tipo: editor.trigger, rotulo: KIND_LABEL.trigger, titulo: BLOCKS[editor.trigger]!.label,
        resumo: resumoGatilho(editor.trigger, editor.cfg, stages),
        ehGatilho: true, selos: selos.get('t') ?? [], falhou: false,
      } satisfies BlocoData,
    }];
    editor.steps.forEach((s, i) => {
      const id = `s${i}`;
      const kind = BLOCKS[s.type]?.kind ?? 'action';
      const { caminho, k } = ondeFica(partes, i);
      const ehCond = caminho === 'cond';
      out.push({
        id, type: 'bloco', measured: MEDIDA,
        position: arrasto?.id === id ? { x: arrasto.x, y: arrasto.y } : { x: xDaColuna(colunaDe(partes, caminho, k)), y: yDo(caminho) },
        draggable: modo === 'editar' && !ehCond, deletable: modo === 'editar', selected: sel === i,
        data: {
          tipo: s.type, rotulo: KIND_LABEL[kind], titulo: BLOCKS[s.type]?.label ?? s.type,
          resumo: resumoPasso(s, stages), ehGatilho: false, selos: selos.get(id) ?? [],
          falhou: (selos.get(id) ?? []).some((x) => x.tom === 'err'),
        } satisfies BlocoData,
      });
    });
    const vazio = (id: string, caminho: Caminho | 'cond', col: number, texto: string): Node => ({
      id, type: 'vazio', position: { x: xDaColuna(col), y: yDo(caminho) }, measured: MEDIDA,
      draggable: false, selectable: modo === 'editar' && id !== 'vazio', deletable: false,
      selected: id === 'vsim' ? alvoEf === 'sim' && sel === null : id === 'vnao' ? alvoEf === 'nao' && sel === null : false,
      data: { texto },
    });
    if (n === 0) out.push(vazio('vazio', 'main', 1, 'Arraste uma ação para cá, ou clique nela na lista'));
    if (partes.cond && partes.sim.length === 0) out.push(vazio('vsim', 'sim', colunaDe(partes, 'sim', 0), 'Caminho Sim vazio: arraste uma ação para cá'));
    if (partes.cond && partes.nao.length === 0) out.push(vazio('vnao', 'nao', colunaDe(partes, 'nao', 0), 'Caminho Não vazio: arraste uma ação para cá'));
    return out;
  }, [editor, partes, stages, sel, alvoEf, arrasto, modo, selos, n]);

  const edges = useMemo<Edge[]>(() => {
    const out: Edge[] = [];
    const fio = (de: string, para: string, extra: Partial<Edge> = {}) => out.push({
      id: `e-${de}-${para}`, source: de, target: para, type: 'smoothstep',
      style: { ...FIO, ...(para.startsWith('v') ? { strokeDasharray: '6 6' } : {}) }, ...extra,
    });
    const cadeia = (ids: string[], primeiro: Partial<Edge> = {}) => ids.slice(1).forEach((id, i) => fio(ids[i]!, id, i === 0 ? primeiro : {}));
    const ids = (c: Caminho) => partes[c].map((_, k) => `s${indiceDe(partes, c, k)}`);
    if (!partes.cond) {
      cadeia(['t', ...ids('main'), ...(n === 0 ? ['vazio'] : [])]);
      return out;
    }
    const cond = `s${partes.main.length}`;
    cadeia(['t', ...ids('main'), cond]);
    cadeia([cond, ...(partes.sim.length ? ids('sim') : ['vsim'])], ROTULO_SIM);
    cadeia([cond, ...(partes.nao.length ? ids('nao') : ['vnao'])], ROTULO_NAO);
    return out;
  }, [partes, n]);

  // Enquadra alinhado à esquerda: o fluxo sempre começa pelo gatilho. O fitView
  // do React Flow centraliza, e com zoom mínimo o gatilho sumia pela esquerda.
  const telaRef = useRef<HTMLElement>(null);
  const colunas = partes.cond
    ? partes.main.length + 2 + Math.max(partes.sim.length, partes.nao.length, 1)
    : Math.max(n, 1) + 1;
  const temCond = !!partes.cond;
  const enquadrar = useCallback((duration = 0) => {
    const el = telaRef.current;
    if (!el) return;
    const largura = xDaColuna(colunas) - GAP + X0;
    const altura = temCond ? 2 * DY + H + 80 : H + 80;
    const zoom = Math.max(ENQUADRAR.minZoom, Math.min(ENQUADRAR.maxZoom, el.clientWidth / largura, el.clientHeight / altura));
    // Fluxo maior que a tela: o bloco selecionado (o que acabou de entrar) não
    // pode ficar escondido à direita com o painel aberto para ele.
    let x = 32 - X0 * zoom;
    const selecionado = rf.getNodes().find((nd) => nd.selected);
    if (selecionado) {
      const direita = (selecionado.position.x + W) * zoom + x;
      if (direita > el.clientWidth - 32) x -= direita - (el.clientWidth - 32);
    }
    rf.setViewport({ x, y: el.clientHeight / 2 - (Y0 + H / 2) * zoom, zoom }, { duration });
  }, [colunas, temCond, rf]);

  useEffect(() => {
    // Reenquadra quando a quantidade de blocos muda (adicionar/remover)
    const t = setTimeout(() => enquadrar(200), 30);
    return () => clearTimeout(t);
    // `n`: bloco novo num caminho que não alarga o fluxo também reenquadra
  }, [enquadrar, n]);

  // ── edição (sempre em partes e de volta para a lista com `juntar`) ──
  const aplicar = useCallback((p: Partes, selNovo: Sel) => {
    set({ steps: juntar(p) });
    setSel(selNovo);
  }, [set]);

  const copia = (p: Partes): Partes => ({ main: [...p.main], cond: p.cond, sim: [...p.sim], nao: [...p.nao] });

  const moverPasso = useCallback((de: number, para: Caminho, pos: number) => {
    const o = ondeFica(partes, de);
    if (o.caminho === 'cond') return;
    const p = copia(partes);
    const [it] = p[o.caminho].splice(o.k, 1);
    if (!it) return;
    const destino: Caminho = p.cond ? para : 'main';
    const k = Math.max(0, Math.min(pos, p[destino].length));
    if (destino === o.caminho && k === o.k) return;
    p[destino].splice(k, 0, it);
    setAlvo(destino);
    aplicar(p, indiceDe(p, destino, k));
  }, [partes, aplicar]);

  const removerPasso = useCallback((i: number) => {
    const o = ondeFica(partes, i);
    if (o.caminho === 'cond') {
      // O "Sim" vira a continuação normal (é o fluxo de antes da condição); o "Não" sai junto.
      if (partes.nao.length > 0 && !confirm(`Remover a condição? O caminho Sim continua como sequência normal e ${partes.nao.length === 1 ? 'o passo do caminho Não é apagado' : `os ${partes.nao.length} passos do caminho Não são apagados`}.`)) return;
      aplicar({ main: [...partes.main, ...partes.sim], cond: null, sim: [], nao: [] }, null);
      return;
    }
    const p = copia(partes);
    p[o.caminho].splice(o.k, 1);
    aplicar(p, null);
  }, [partes, aplicar]);

  const inserir = useCallback((tipo: string, caminho?: Caminho, pos?: number) => {
    if (BLOCKS[tipo]?.kind === 'trigger') {
      set({ trigger: tipo as CrmAutomationTrigger, cfg: cfgPadrao(tipo as CrmAutomationTrigger, stages) });
      setSel('t');
      return;
    }
    const novo = novoPasso(tipo as CrmAutomationStepType, stages, motivos);
    if (tipo === 'CONDITION') {
      if (partes.cond) return;
      // Entra na linha principal; o que estava depois dela vira o caminho "Sim".
      const k = caminho === 'main' && pos !== undefined ? Math.max(0, Math.min(pos, partes.main.length)) : partes.main.length;
      setAlvo(k === partes.main.length ? 'sim' : 'nao');
      aplicar({ main: partes.main.slice(0, k), cond: novo, sim: partes.main.slice(k), nao: [] }, k);
      return;
    }
    const p = copia(partes);
    const cam: Caminho = p.cond ? (caminho ?? alvoEf) : 'main';
    const k = pos === undefined ? p[cam].length : Math.max(0, Math.min(pos, p[cam].length));
    p[cam].splice(k, 0, novo);
    aplicar(p, indiceDe(p, cam, k));
  }, [partes, alvoEf, stages, motivos, set, aplicar]);

  /** Caminho e posição de um ponto da tela (centro do bloco arrastado, ou onde soltou). */
  const posicaoEm = useCallback((x: number, y: number, ignorar?: number): { caminho: Caminho; k: number } => {
    let caminho: Caminho = 'main';
    if (partes.cond && x > xDaColuna(colunaDe(partes, 'cond', 0)) + W) caminho = y < Y0 + H / 2 ? 'sim' : 'nao';
    const k = partes[caminho]
      .map((_, j) => j)
      .filter((j) => indiceDe(partes, caminho, j) !== ignorar && xDaColuna(colunaDe(partes, caminho, j)) + W / 2 < x)
      .length;
    return { caminho, k };
  }, [partes]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    for (const c of changes) {
      if (c.type === 'position' && c.position && c.dragging) setArrasto({ id: c.id, x: c.position.x, y: c.position.y });
      if (c.type === 'select' && c.selected) {
        if (c.id === 't') setSel('t');
        else if (c.id === 'vsim' || c.id === 'vnao') { setSel(null); setAlvo(c.id === 'vsim' ? 'sim' : 'nao'); }
        else if (c.id.startsWith('s')) {
          const i = Number(c.id.slice(1));
          const o = ondeFica(partes, i).caminho;
          setSel(i);
          setAlvo(o === 'cond' ? 'sim' : o);
        }
      }
      if (c.type === 'remove' && /^s\d+$/.test(c.id)) removerPasso(Number(c.id.slice(1)));
    }
  }, [removerPasso, partes]);

  const onNodeDragStop = useCallback((_: unknown, node: Node) => {
    setArrasto(null);
    if (!/^s\d+$/.test(node.id)) return;
    const de = Number(node.id.slice(1));
    const { caminho, k } = posicaoEm(node.position.x + W / 2, node.position.y + H / 2, de);
    moverPasso(de, caminho, k);
  }, [moverPasso, posicaoEm]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const tipo = e.dataTransfer.getData(DRAG_MIME);
    if (!tipo || modo !== 'editar') return;
    const pt = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
    const { caminho, k } = posicaoEm(pt.x, pt.y);
    if (tipo === 'CONDITION' && caminho !== 'main') return;
    inserir(tipo, caminho, k);
  }, [rf, inserir, modo, posicaoEm]);

  const voltar = () => {
    if (JSON.stringify(editor) !== original && !confirm('Sair sem salvar? As mudanças deste fluxo serão perdidas.')) return;
    onVoltar();
  };

  const passoSel = typeof sel === 'number' ? editor.steps[sel] : undefined;
  const lugarSel = typeof sel === 'number' ? ondeFica(partes, sel) : null;
  const rotuloPasso = (() => {
    if (!passoSel || !lugarSel) return '';
    if (lugarSel.caminho === 'cond') return 'CONDIÇÃO · SE';
    const tipo = KIND_LABEL[BLOCKS[passoSel.type]?.kind ?? 'action'];
    if (lugarSel.caminho === 'main') return `PASSO ${lugarSel.k + 1} · ${tipo}`;
    return `CAMINHO ${lugarSel.caminho === 'sim' ? 'SIM' : 'NÃO'} · PASSO ${lugarSel.k + 1} · ${tipo}`;
  })();
  const tamanhoDoCaminho = lugarSel && lugarSel.caminho !== 'cond' ? partes[lugarSel.caminho].length : 0;

  return (
    <div className="flex flex-col" style={{ minHeight: 'calc(100vh - 120px)' }}>
      <style>{RF_VARS}</style>

      {/* Barra do fluxo */}
      <header className="flex flex-col gap-3 px-4 py-3 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between"
        style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)', borderRadius: '18px 18px 0 0', border: '1px solid var(--border)' }}>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
          <button type="button" onClick={voltar} className="ui-btn ui-btn-secondary ui-btn-sm">
            <Icon name="back" size={15} strokeWidth={2} /> Automações
          </button>
          <div className="flex min-w-0 flex-1 flex-col" style={{ flexBasis: 200 }}>
            <label htmlFor="nome-fluxo" style={{ font: '500 10.5px/1.4 var(--font-mono-cx), ui-monospace, monospace', letterSpacing: '0.06em', color: 'var(--accent)' }}>
              NOME DO FLUXO
            </label>
            <input id="nome-fluxo" value={editor.name} onChange={(e) => set({ name: e.target.value })} maxLength={80}
              className="bg-transparent outline-none"
              style={{ font: '800 20px/1.25 var(--font-display), system-ui, sans-serif', letterSpacing: '-0.02em', color: 'var(--text-primary)', borderBottom: '1px dashed var(--border-md)' }} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {editor.id && (
            <div className="ui-seg" role="group" aria-label="Modo da tela">
              <button type="button" aria-pressed={modo === 'editar'} onClick={() => setModo('editar')}>Editar</button>
              <button type="button" aria-pressed={modo === 'execucoes'} onClick={() => setModo('execucoes')}>Execuções</button>
            </div>
          )}
          <button type="button" onClick={onSalvar} disabled={salvando || temErro} className="ui-btn ui-btn-primary ui-btn-sm"
            title={temErro ? 'Resolva os itens marcados na checagem' : undefined}>
            {salvando ? 'Salvando…' : editor.id ? 'Salvar alterações' : 'Criar automação'}
          </button>
        </div>
      </header>

      <div className="flex flex-1 flex-wrap" style={{ border: '1px solid var(--border)', borderTop: 0, borderRadius: '0 0 18px 18px', overflow: 'hidden' }}>
        {/* Lista de blocos */}
        {modo === 'editar' && (
          <aside aria-label="Blocos" className="flex flex-col gap-1 p-3 lg:max-w-[250px]" style={{ flex: '1 1 220px', background: 'var(--bg-surface)', borderRight: '1px solid var(--border)' }}>
            <p className="px-1 pb-1 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {partes.cond
                ? <>Arraste para a tela, ou clique para adicionar no fim do caminho <strong style={{ color: 'var(--text-primary)' }}>{NOME_CAMINHO[alvoEf]}</strong>.</>
                : 'Arraste para a tela ou clique para adicionar no fim. Gatilho troca o atual.'}
            </p>
            <Grupo titulo="GATILHO · QUANDO" ids={TRIGGER_IDS} atual={editor.trigger} onAdd={inserir} />
            <Grupo titulo="AÇÕES · FAÇA" ids={ACTION_IDS} onAdd={inserir} />
            <Grupo titulo="CONTROLE" ids={['WAIT', 'CONDITION']} desligados={partes.cond ? ['CONDITION'] : []} onAdd={inserir} />
          </aside>
        )}

        {/* Tela */}
        <section ref={telaRef} aria-label="Tela do fluxo" className="fluxo-rf relative" style={{ flex: '999 1 480px', minWidth: 0, minHeight: 520 }}
          onDragOver={(e) => { if (modo === 'editar') { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } }}
          onDrop={onDrop}>
          <ReactFlow
            nodes={nodes} edges={edges} nodeTypes={NODE_TYPES}
            onNodesChange={onNodesChange} onNodeDragStop={onNodeDragStop}
            onPaneClick={() => setSel(null)}
            nodesConnectable={false} elementsSelectable
            // Um bloco por vez: o painel edita um só, e apagar vários de uma vez
            // aplicaria cada remoção sobre a mesma lista antiga.
            multiSelectionKeyCode={null} selectionKeyCode={null}
            deleteKeyCode={modo === 'editar' ? ['Delete', 'Backspace'] : null}
            onInit={() => enquadrar()}
            minZoom={0.3} maxZoom={1.5}
            style={{ background: 'var(--bg-base)' }}
          >
            <Background variant={BackgroundVariant.Dots} gap={22} size={1.4} color="var(--border-md)" />
            <Controls showInteractive={false} showFitView={false} position="bottom-right">
              <ControlButton onClick={() => enquadrar(200)} title="Enquadrar o fluxo" aria-label="Enquadrar o fluxo">
                <Icon name="cols" size={14} strokeWidth={2} />
              </ControlButton>
            </Controls>
          </ReactFlow>

          <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap gap-2" style={{ maxWidth: 'calc(100% - 190px)' }}>
            {modo === 'execucoes' ? (
              <span className="ui-chip" style={{ background: 'var(--bg-surface)' }}>
                Últimos {stats?.windowDays ?? 90} dias{JSON.stringify(editor) !== original ? ' · contagem da versão salva' : ''}
              </span>
            ) : (
              <span className="ui-chip" style={{ background: 'var(--bg-surface)' }}>
                {editor.stopOnReply ? '✓ Para quando o lead responde' : 'Continua mesmo se o lead responder'}
              </span>
            )}
          </div>
        </section>

        {/* Painel */}
        <aside aria-label="Bloco selecionado" className="flex flex-col gap-4 p-4 lg:max-w-[380px]" style={{ flex: '1 1 300px', background: 'var(--bg-surface)', borderLeft: '1px solid var(--border)' }}>
          {modo === 'execucoes' ? (
            <PainelExecucoes runs={runs} steps={editor.steps} />
          ) : sel === 't' ? (
            <>
              <Cabeca rotulo="GATILHO · QUANDO" titulo={BLOCKS[editor.trigger]!.label} />
              <label className="flex flex-col gap-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                Tipo de gatilho
                <select value={editor.trigger} onChange={(e) => inserir(e.target.value)}
                  style={{ backgroundColor: 'var(--input-bg)', border: '1px solid var(--input-border)', borderRadius: 10, color: 'var(--text-primary)', fontSize: 14, padding: '8px 10px' }}>
                  {TRIGGER_IDS.map((t) => <option key={t} value={t}>{BLOCKS[t]!.label}</option>)}
                </select>
              </label>
              <ParamsGatilho trigger={editor.trigger} cfg={editor.cfg} stages={stages} onChange={(cfg) => set({ cfg })} />
              <label className="flex items-center gap-2.5 text-[13px]" style={{ color: 'var(--text-secondary)' }}>
                <Switch on={editor.stopOnReply} onClick={() => set({ stopOnReply: !editor.stopOnReply })} label="Parar se o lead responder" />
                Parar a sequência se o lead responder
              </label>
            </>
          ) : passoSel && lugarSel && typeof sel === 'number' ? (
            <>
              <Cabeca rotulo={rotuloPasso} titulo={BLOCKS[passoSel.type]?.label ?? passoSel.type} />
              {lugarSel.caminho === 'cond' && (
                <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  Na hora em que o card chega aqui, segue pelo caminho <strong style={{ color: 'var(--text-primary)' }}>Sim</strong> se
                  a empresa estiver aberta, ou pelo <strong style={{ color: 'var(--text-primary)' }}>Não</strong> se estiver fechada.
                  Quem acorda de uma espera dentro de um caminho continua nele.
                </p>
              )}
              <ParamsPasso passo={passoSel} stages={stages} motivos={motivos}
                onChange={(patch) => {
                  const steps = [...editor.steps];
                  steps[sel] = { ...steps[sel]!, ...patch };
                  set({ steps });
                }} />
              {lugarSel.caminho === 'cond' ? (
                <>
                  <div className="flex flex-col gap-1.5">
                    <span style={{ font: '500 10.5px/1.4 var(--font-mono-cx), ui-monospace, monospace', letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>CAMINHOS</span>
                    <CaminhoTxt nome="Sim" passos={partes.sim} />
                    <CaminhoTxt nome="Não" passos={partes.nao} />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className="ui-btn ui-btn-danger ui-btn-sm" onClick={() => removerPasso(sel)}>Remover condição</button>
                  </div>
                </>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="ui-btn ui-btn-secondary ui-btn-sm" disabled={lugarSel.k === 0}
                    onClick={() => moverPasso(sel, lugarSel.caminho as Caminho, lugarSel.k - 1)}>Mover para antes</button>
                  <button type="button" className="ui-btn ui-btn-secondary ui-btn-sm" disabled={lugarSel.k === tamanhoDoCaminho - 1}
                    onClick={() => moverPasso(sel, lugarSel.caminho as Caminho, lugarSel.k + 1)}>Mover para depois</button>
                  <button type="button" className="ui-btn ui-btn-danger ui-btn-sm" onClick={() => removerPasso(sel)}>Remover bloco</button>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col gap-2">
              <span style={{ font: '500 10.5px/1.4 var(--font-mono-cx), ui-monospace, monospace', letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>EM PORTUGUÊS</span>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>{frasear(editor, stages)}</p>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>Clique num bloco para configurar.</p>
            </div>
          )}

          {modo === 'editar' && (
            <div className="mt-auto flex flex-col gap-2 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
              <span style={{ font: '500 10.5px/1.4 var(--font-mono-cx), ui-monospace, monospace', letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>CHECAGEM</span>
              {avisos.map((a, i) => (
                <div key={i} className="rounded-lg px-3 py-2 text-xs leading-relaxed" style={avisoStyle(a.nivel)}>{a.texto}</div>
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

// ── Peças do editor ────────────────────────────────────────────────────────

function Cabeca({ rotulo, titulo }: { rotulo: string; titulo: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span style={{ font: '500 10.5px/1.4 var(--font-mono-cx), ui-monospace, monospace', letterSpacing: '0.06em', color: 'var(--accent)' }}>{rotulo}</span>
      <h2 className="ui-h2" style={{ fontSize: 18 }}>{titulo}</h2>
    </div>
  );
}

function CaminhoTxt({ nome, passos }: { nome: string; passos: CrmAutomationStep[] }) {
  return (
    <div className="text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
      <strong style={{ color: 'var(--text-primary)' }}>{nome}</strong> · {passos.length ? passos.map((s) => BLOCKS[s.type]?.label ?? s.type).join(', ') : 'nada (o fluxo termina)'}
    </div>
  );
}

function Grupo({ titulo, ids, atual, desligados = [], onAdd }: {
  titulo: string; ids: readonly string[]; atual?: string; desligados?: string[]; onAdd: (id: string) => void;
}) {
  return (
    <div className="mb-2">
      <p className="px-1 pb-1.5 pt-2" style={{ font: '500 10.5px/1.4 var(--font-mono-cx), ui-monospace, monospace', letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>{titulo}</p>
      <div className="flex flex-col gap-1">
        {ids.map((id) => {
          const off = desligados.includes(id);
          return (
            <button key={id} type="button" draggable={!off} disabled={off}
              title={off ? 'Uma condição por fluxo' : undefined}
              onDragStart={(e) => { e.dataTransfer.setData(DRAG_MIME, id); e.dataTransfer.effectAllowed = 'copy'; }}
              onClick={() => onAdd(id)}
              className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13px] font-medium transition-colors hover:bg-[var(--bg-elevated)] disabled:opacity-50"
              style={{
                color: 'var(--text-primary)', cursor: off ? 'not-allowed' : 'grab',
                border: `1px solid ${atual === id ? 'var(--accent)' : 'var(--border)'}`,
                background: atual === id ? 'var(--accent-dim)' : 'transparent',
              }}>
              <span style={{ color: 'var(--text-secondary)' }}><Icon name={BLOCKS[id]?.icon ?? 'bolt'} size={15} /></span>
              {id === 'CONDITION' ? 'Condição: horário comercial' : BLOCKS[id]?.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PainelExecucoes({ runs, steps }: { runs: CrmAutomationRun[] | null; steps: CrmAutomationStep[] }) {
  const p = separar(steps);
  const fimSim = p.main.length + 1 + p.sim.length;
  const ondeParou = (r: CrmAutomationRun): string => {
    const nome = (k: number) => BLOCKS[steps[k]?.type ?? '']?.label ?? `passo ${k + 1}`;
    switch (r.status) {
      case 'FAILED':           return `Falhou no passo ${r.stepIndex + 1} (${nome(r.stepIndex)})`;
      case 'PENDING':          return r.stepIndex === 0 ? `Começa em ${new Date(r.dueAt).toLocaleString('pt-BR')}` : `Esperando · volta em ${new Date(r.dueAt).toLocaleString('pt-BR')}`;
      case 'RUNNING':          return 'Rodando agora';
      case 'DONE':
        // Só dá para saber o caminho quando o "Não" tem passos (ver selosPorBloco)
        if (p.cond && p.nao.length > 0) return r.stepIndex === fimSim ? 'Terminou pelo caminho Sim' : 'Terminou pelo caminho Não';
        return 'Passou por todos os passos';
      case 'STOPPED_BY_REPLY': return 'Parou: o lead respondeu';
      case 'CANCELED':         return 'Cancelada: a condição do gatilho deixou de valer';
      default:                 return r.status;
    }
  };
  return (
    <>
      <Cabeca rotulo="EXECUÇÕES" titulo="Cards neste fluxo" />
      <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        Os números em cima de cada bloco mostram onde os cards estão e o que já passou. Abaixo, os últimos 30.
      </p>
      {runs === null ? (
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Carregando…</p>
      ) : runs.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Ainda não rodou em nenhum card.</p>
      ) : (
        <div className="flex flex-col">
          {runs.map((r) => (
            <a key={r.id} href={`/dashboard/crm?client=${r.client?.id ?? ''}`}
              className="flex flex-col gap-1 py-2.5 hover:opacity-80" style={{ borderTop: '1px solid var(--border)', textDecoration: 'none' }}>
              <span className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{r.client?.name ?? '—'}</span>
                <span className="ui-badge" style={statusStyle(r.status)}>{statusLabel(r.status)}</span>
              </span>
              <span className="text-xs" style={{ color: r.status === 'FAILED' ? 'var(--badge-error-text)' : 'var(--text-secondary)' }}>{ondeParou(r)}</span>
              {r.error && <span className="text-xs" style={{ color: 'var(--badge-error-text)' }}>{r.error}</span>}
            </a>
          ))}
        </div>
      )}
    </>
  );
}

// Tema do React Flow pelos tokens do Cromalex (os controles vêm brancos de fábrica)
const RF_VARS = `
  .fluxo-rf .react-flow {
    --xy-background-color: var(--bg-base);
    --xy-edge-stroke: var(--border-control);
    --xy-handle-background-color: var(--bg-surface);
    --xy-handle-border-color: var(--border-control);
    --xy-controls-button-background-color: var(--bg-surface);
    --xy-controls-button-background-color-hover: var(--bg-elevated);
    --xy-controls-button-color: var(--text-primary);
    --xy-controls-button-color-hover: var(--text-primary);
    --xy-controls-button-border-color: var(--border);
    --xy-attribution-background-color: transparent;
  }
  .fluxo-rf .react-flow__node { cursor: pointer; }
  .fluxo-rf .react-flow__node.draggable { cursor: grab; }
  .fluxo-rf .react-flow__node:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; border-radius: 16px; }
  .fluxo-rf .react-flow__handle { width: 10px; height: 10px; border-width: 2px; }
  .fluxo-rf .react-flow__controls { box-shadow: none; border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
  .fluxo-rf .react-flow__attribution a { color: var(--text-secondary); }
`;
