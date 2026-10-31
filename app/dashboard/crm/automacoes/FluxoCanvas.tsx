'use client';

// Editor de automação em canvas (estilo escolhido pelo Benny em 30/10, no
// lugar da coluna de blocos). Tela de nós com fios, mas o MOTOR continua
// linear: um gatilho e uma sequência de passos. O canvas é só a forma de
// montar — a ordem dos passos é a ordem dos blocos da esquerda para a direita,
// e arrastar um bloco para outra coluna reordena a sequência. Condição com
// ramos (Sim/Não) não existe no motor, então não existe aqui.

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
  avisoStyle, cfgPadrao, checarFluxo, frasear, novoPasso, resumoGatilho, resumoPasso,
  statusLabel, statusStyle, type Editor,
} from './blocos';

// ── Geometria ──────────────────────────────────────────────────────────────

const W = 224;          // largura do bloco
const H = 112;          // altura do bloco
const GAP = 64;         // fio entre blocos
const X0 = 40;
const Y0 = 120;
const xDaColuna = (col: number) => X0 + col * (W + GAP);
const DRAG_MIME = 'application/x-cromalex-bloco';
// Tamanho fixo e conhecido: os nós são recriados a cada render (a posição é a
// ordem), então o React Flow precisa receber a medida em vez de medir de novo.
const MEDIDA = { width: W, height: H };
// Abaixo de 0,8 o texto do bloco fica ilegível: fluxo longo rola para o lado.
const ENQUADRAR = { maxZoom: 1, minZoom: 0.8 };

// ── Execuções → selos em cima de cada bloco ────────────────────────────────

type Tom = 'ok' | 'wait' | 'err' | 'muted';
interface Selo { texto: string; tom: Tom }

/**
 * `stepIndex` da run é o PRÓXIMO passo a rodar. Uma run parada (PENDING,
 * STOPPED, CANCELED) com `stepIndex = k` está depois do passo k-1 — no motor
 * isso só acontece no começo (k = 0, gatilho) ou depois de um WAIT. Uma FAILED
 * quebrou no passo k. DONE passou por todos.
 */
function selosPorBloco(stats: CrmAutomationStepStats, steps: CrmAutomationStep[]): Map<string, Selo[]> {
  const out = new Map<string, Selo[]>();
  const add = (id: string, s: Selo) => out.set(id, [...(out.get(id) ?? []), s]);
  const blocoAntes = (k: number) => (k <= 0 ? 't' : `s${Math.min(k, steps.length) - 1}`);

  const total = stats.rows.reduce((t, r) => t + r.count, 0);
  if (total === 0) return out;
  add('t', { texto: `${total} ${total === 1 ? 'entrou' : 'entraram'}`, tom: 'ok' });

  const soma = (f: (r: CrmAutomationStepStats['rows'][number]) => boolean) =>
    stats.rows.filter(f).reduce((t, r) => t + r.count, 0);

  steps.forEach((s, i) => {
    // Passou do bloco i: run que já está além dele e não está parada nele.
    const passou = soma((r) => r.stepIndex > i && !(r.stepIndex === i + 1 && r.status !== 'DONE' && r.status !== 'FAILED' && s.type === 'WAIT'));
    if (passou > 0) add(`s${i}`, { texto: `✓ ${passou} ${s.type === 'WAIT' ? (passou === 1 ? 'seguiu' : 'seguiram') : (passou === 1 ? 'feito' : 'feitos')}`, tom: 'ok' });
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
  rotulo: string;      // QUANDO / AÇÃO / ESPERA
  titulo: string;
  resumo: string;
  ehGatilho: boolean;
  selos: Selo[];
  falhou: boolean;
}
type BlocoNode = Node<BlocoData, 'bloco'>;

function BlocoNo({ data, selected }: NodeProps<BlocoNode>) {
  const espera = data.tipo === 'WAIT';
  const borda = selected ? '2px solid var(--accent)' : data.falhou ? '2px solid var(--badge-error-text)' : '1px solid var(--border-md)';
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
          color: data.ehGatilho ? 'var(--on-accent)' : espera ? 'var(--tint-ink)' : 'var(--text-primary)',
          border: data.ehGatilho || espera ? 'none' : '1px solid var(--border)',
        }}>
          <Icon name={BLOCKS[data.tipo]?.icon ?? 'bolt'} size={15} strokeWidth={2} />
        </span>
        <span style={{
          font: '500 10.5px/1.4 var(--font-mono-cx), ui-monospace, monospace', letterSpacing: '0.06em',
          color: data.ehGatilho ? 'var(--accent)' : espera ? 'var(--tint-ink)' : 'var(--text-secondary)',
        }}>{data.rotulo}</span>
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.25, color: 'var(--text-primary)' }}>{data.titulo}</div>
      <div style={{ fontSize: 12, lineHeight: 1.35, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{data.resumo}</div>
    </div>
  );
}

function VazioNo() {
  return (
    <div style={{
      width: W, height: H, boxSizing: 'border-box', borderRadius: 16, border: '2px dashed var(--border-control)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 12,
      fontSize: 12.5, color: 'var(--text-secondary)', background: 'transparent',
    }}>
      <Handle type="target" position={Position.Left} isConnectable={false} />
      Arraste uma ação para cá, ou clique nela na lista
    </div>
  );
}

const NODE_TYPES = { bloco: BlocoNo, vazio: VazioNo };

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
  const [modo, setModo] = useState<Modo>(editor.id ? modoInicial : 'editar');
  const [arrasto, setArrasto] = useState<{ id: string; x: number; y: number } | null>(null);
  const [stats, setStats] = useState<CrmAutomationStepStats | null>(null);
  const [runs, setRuns] = useState<CrmAutomationRun[] | null>(null);
  const [original] = useState(() => JSON.stringify(editor));

  const set = useCallback((patch: Partial<Editor>) => setEditor({ ...editor, ...patch }), [editor, setEditor]);
  const n = editor.steps.length;

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
      texto: `${noMeio} ${noMeio === 1 ? 'card está' : 'cards estão'} no meio deste fluxo. Ao salvar, ${noMeio === 1 ? 'ele continua' : 'eles continuam'} do mesmo número de passo na sequência nova — se você mudou a ordem, pode pular ou repetir passos.`,
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
      out.push({
        id, type: 'bloco', measured: MEDIDA,
        position: arrasto?.id === id ? { x: arrasto.x, y: arrasto.y } : { x: xDaColuna(i + 1), y: Y0 },
        draggable: modo === 'editar', deletable: modo === 'editar', selected: sel === i,
        data: {
          tipo: s.type, rotulo: KIND_LABEL[kind], titulo: BLOCKS[s.type]?.label ?? s.type,
          resumo: resumoPasso(s, stages), ehGatilho: false, selos: selos.get(id) ?? [],
          falhou: (selos.get(id) ?? []).some((x) => x.tom === 'err'),
        } satisfies BlocoData,
      });
    });
    if (n === 0) out.push({ id: 'vazio', type: 'vazio', position: { x: xDaColuna(1), y: Y0 }, measured: MEDIDA, draggable: false, selectable: false, deletable: false, data: {} });
    return out;
  }, [editor, stages, sel, arrasto, modo, selos, n]);

  const edges = useMemo<Edge[]>(() => {
    const ids = ['t', ...editor.steps.map((_, i) => `s${i}`), ...(n === 0 ? ['vazio'] : [])];
    return ids.slice(1).map((id, i) => ({
      id: `e${i}`, source: ids[i]!, target: id, type: 'smoothstep',
      style: { stroke: 'var(--border-control)', strokeWidth: 2, ...(id === 'vazio' ? { strokeDasharray: '6 6' } : {}) },
    }));
  }, [editor.steps, n]);

  // Enquadra alinhado à esquerda: o fluxo sempre começa pelo gatilho. O fitView
  // do React Flow centraliza, e com zoom mínimo o gatilho sumia pela esquerda.
  const telaRef = useRef<HTMLElement>(null);
  const enquadrar = useCallback((duration = 0) => {
    const el = telaRef.current;
    if (!el) return;
    const largura = xDaColuna(Math.max(n, 1) + 1) - GAP + X0;
    const zoom = Math.max(ENQUADRAR.minZoom, Math.min(ENQUADRAR.maxZoom, el.clientWidth / largura));
    rf.setViewport({ x: 32 - X0 * zoom, y: el.clientHeight / 2 - (Y0 + H / 2) * zoom, zoom }, { duration });
  }, [n, rf]);

  useEffect(() => {
    // Reenquadra quando a quantidade de blocos muda (adicionar/remover)
    const t = setTimeout(() => enquadrar(200), 30);
    return () => clearTimeout(t);
  }, [enquadrar]);

  // ── edição ──
  const moverPasso = useCallback((de: number, para: number) => {
    if (para < 0 || para >= n || para === de) return;
    const steps = [...editor.steps];
    const [it] = steps.splice(de, 1);
    if (it) steps.splice(para, 0, it);
    set({ steps });
    setSel(para);
  }, [editor.steps, n, set]);

  const removerPasso = useCallback((i: number) => {
    set({ steps: editor.steps.filter((_, j) => j !== i) });
    setSel(null);
  }, [editor.steps, set]);

  const inserir = useCallback((tipo: string, pos?: number) => {
    if (BLOCKS[tipo]?.kind === 'trigger') {
      set({ trigger: tipo as CrmAutomationTrigger, cfg: cfgPadrao(tipo as CrmAutomationTrigger, stages) });
      setSel('t');
      return;
    }
    const steps = [...editor.steps];
    const k = pos === undefined ? steps.length : Math.max(0, Math.min(pos, steps.length));
    steps.splice(k, 0, novoPasso(tipo as CrmAutomationStepType, stages, motivos));
    set({ steps });
    setSel(k);
  }, [editor.steps, stages, motivos, set]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    for (const c of changes) {
      if (c.type === 'position' && c.position && c.dragging) setArrasto({ id: c.id, x: c.position.x, y: c.position.y });
      if (c.type === 'select' && c.selected) setSel(c.id === 't' ? 't' : c.id.startsWith('s') ? Number(c.id.slice(1)) : null);
      if (c.type === 'remove' && c.id.startsWith('s')) removerPasso(Number(c.id.slice(1)));
    }
  }, [removerPasso]);

  const onNodeDragStop = useCallback((_: unknown, node: Node) => {
    setArrasto(null);
    if (!node.id.startsWith('s')) return;
    const de = Number(node.id.slice(1));
    const col = Math.round((node.position.x - X0) / (W + GAP));
    moverPasso(de, Math.max(0, Math.min(n - 1, col - 1)));
  }, [moverPasso, n]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const tipo = e.dataTransfer.getData(DRAG_MIME);
    if (!tipo || modo !== 'editar') return;
    const p = rf.screenToFlowPosition({ x: e.clientX, y: e.clientY });
    // Entra depois de todo bloco cujo meio ficou à esquerda do ponto solto
    inserir(tipo, editor.steps.filter((_, i) => xDaColuna(i + 1) + W / 2 < p.x).length);
  }, [rf, inserir, modo, editor.steps]);

  const voltar = () => {
    if (JSON.stringify(editor) !== original && !confirm('Sair sem salvar? As mudanças deste fluxo serão perdidas.')) return;
    onVoltar();
  };

  const passoSel = typeof sel === 'number' ? editor.steps[sel] : undefined;

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
              Arraste para a tela ou clique para adicionar no fim. Gatilho troca o atual.
            </p>
            <Grupo titulo="GATILHO · QUANDO" ids={TRIGGER_IDS} atual={editor.trigger} onAdd={inserir} />
            <Grupo titulo="AÇÕES · FAÇA" ids={ACTION_IDS} onAdd={inserir} />
            <Grupo titulo="CONTROLE" ids={['WAIT']} onAdd={inserir} />
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
          ) : passoSel && typeof sel === 'number' ? (
            <>
              <Cabeca rotulo={`PASSO ${sel + 1} · ${KIND_LABEL[BLOCKS[passoSel.type]?.kind ?? 'action']}`} titulo={BLOCKS[passoSel.type]?.label ?? passoSel.type} />
              <ParamsPasso passo={passoSel} stages={stages} motivos={motivos}
                onChange={(patch) => {
                  const steps = [...editor.steps];
                  steps[sel] = { ...steps[sel]!, ...patch };
                  set({ steps });
                }} />
              <div className="flex flex-wrap gap-2">
                <button type="button" className="ui-btn ui-btn-secondary ui-btn-sm" disabled={sel === 0} onClick={() => moverPasso(sel, sel - 1)}>Mover para antes</button>
                <button type="button" className="ui-btn ui-btn-secondary ui-btn-sm" disabled={sel === n - 1} onClick={() => moverPasso(sel, sel + 1)}>Mover para depois</button>
                <button type="button" className="ui-btn ui-btn-danger ui-btn-sm" onClick={() => removerPasso(sel)}>Remover bloco</button>
              </div>
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

function Grupo({ titulo, ids, atual, onAdd }: { titulo: string; ids: readonly string[]; atual?: string; onAdd: (id: string) => void }) {
  return (
    <div className="mb-2">
      <p className="px-1 pb-1.5 pt-2" style={{ font: '500 10.5px/1.4 var(--font-mono-cx), ui-monospace, monospace', letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>{titulo}</p>
      <div className="flex flex-col gap-1">
        {ids.map((id) => (
          <button key={id} type="button" draggable
            onDragStart={(e) => { e.dataTransfer.setData(DRAG_MIME, id); e.dataTransfer.effectAllowed = 'copy'; }}
            onClick={() => onAdd(id)}
            className="flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13px] font-medium transition-colors hover:bg-[var(--bg-elevated)]"
            style={{
              color: 'var(--text-primary)', cursor: 'grab',
              border: `1px solid ${atual === id ? 'var(--accent)' : 'var(--border)'}`,
              background: atual === id ? 'var(--accent-dim)' : 'transparent',
            }}>
            <span style={{ color: 'var(--text-secondary)' }}><Icon name={BLOCKS[id]?.icon ?? 'bolt'} size={15} /></span>
            {BLOCKS[id]?.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function PainelExecucoes({ runs, steps }: { runs: CrmAutomationRun[] | null; steps: CrmAutomationStep[] }) {
  const ondeParou = (r: CrmAutomationRun): string => {
    const nome = (k: number) => BLOCKS[steps[k]?.type ?? '']?.label ?? `passo ${k + 1}`;
    switch (r.status) {
      case 'FAILED':           return `Falhou no passo ${r.stepIndex + 1} (${nome(r.stepIndex)})`;
      case 'PENDING':          return r.stepIndex === 0 ? `Começa em ${new Date(r.dueAt).toLocaleString('pt-BR')}` : `Esperando · volta em ${new Date(r.dueAt).toLocaleString('pt-BR')}`;
      case 'RUNNING':          return 'Rodando agora';
      case 'DONE':             return 'Passou por todos os passos';
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
