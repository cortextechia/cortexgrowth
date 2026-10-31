'use client';

// Automações do CRM — tela inicial (fluxos da org + modelos prontos) e o editor
// em canvas (FluxoCanvas). Visual escolhido pelo Benny em 30/10 ("estilo D").
//
// As ações mexem no estado do card (mover, atribuir, tag, tarefa, follow-up,
// descartar). A exceção é "Enviar mensagem": ela põe a mensagem na mesma fila
// dos Disparos (freio anti-ban) e só vale em "Lead novo" e "Lead não respondeu".

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { apiService } from '@/lib/api';
import type {
  CrmAutomation, CrmAutomationActivity, CrmAutomationTrigger, CrmStage, CrmDiscardReasonOption,
} from '@/types';
import {
  Miniatura, RECEITAS, Switch, resumoLista, rotuloGatilho, statusLabel, statusStyle,
  type Editor, type Receita,
} from './blocos';
import FluxoCanvas from './FluxoCanvas';

type Grupo = 'todos' | 'novo' | 'etapa' | 'silencio' | 'venda';
const GRUPOS: { id: Grupo; label: string; triggers: CrmAutomationTrigger[] }[] = [
  { id: 'todos',    label: 'Todos',        triggers: [] },
  { id: 'novo',     label: 'Lead novo',    triggers: ['NEW_LEAD'] },
  { id: 'etapa',    label: 'Etapa',        triggers: ['STAGE_ENTERED', 'STAGE_IDLE'] },
  { id: 'silencio', label: 'Sem resposta', triggers: ['NO_REPLY', 'LEAD_SILENT'] },
  { id: 'venda',    label: 'Venda',        triggers: ['SALE_WON', 'SALE_LOST'] },
];
type Estado = 'todas' | 'ligadas' | 'desligadas';

export default function AutomacoesPage() {
  const { user } = useAuth();
  const podeConfigurar = !!user && ['ADMIN', 'SUPER_ADMIN', 'TRAFFIC_MANAGER'].includes(user.role);

  const [stages, setStages] = useState<CrmStage[]>([]);
  const [motivos, setMotivos] = useState<string[]>([]);
  const [lista, setLista] = useState<CrmAutomation[]>([]);
  const [atividade, setAtividade] = useState<CrmAutomationActivity | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [modoInicial, setModoInicial] = useState<'editar' | 'execucoes'>('editar');
  const [salvando, setSalvando] = useState(false);
  const [toast, setToast] = useState<{ texto: string; erro: boolean } | null>(null);
  const [grupo, setGrupo] = useState<Grupo>('todos');
  const [estado, setEstado] = useState<Estado>('todas');

  const aviso = useCallback((texto: string, erro = false) => {
    setToast({ texto, erro });
    setTimeout(() => setToast(null), 5000);
  }, []);

  const recarregar = useCallback(async () => {
    const [r, a] = await Promise.all([
      apiService.getCrmAutomations().catch(() => null),
      apiService.getCrmAutomationActivity(12).catch(() => null),
    ]);
    if (r?.data) setLista(r.data);
    if (a?.data) setAtividade(a.data);
  }, []);

  useEffect(() => {
    if (!podeConfigurar) { setCarregando(false); return; }
    Promise.all([
      apiService.getCrmStages().catch(() => ({ data: [] as CrmStage[] })),
      apiService.getCrmDiscardReasons().catch(() => ({ data: [] as CrmDiscardReasonOption[] })),
      apiService.getCrmAutomations().catch(() => ({ data: [] as CrmAutomation[] })),
      apiService.getCrmAutomationActivity(12).catch(() => null),
    ]).then(([s, m, a, at]) => {
      setStages(s.data ?? []);
      setMotivos((m.data ?? []).map((x) => x.label));
      setLista(a.data ?? []);
      setAtividade(at?.data ?? null);
    }).finally(() => setCarregando(false));
  }, [podeConfigurar]);

  const abrirReceita = (r: Receita) => {
    setModoInicial('editar');
    setEditor({ id: null, name: r.nome, trigger: r.trigger, cfg: r.cfg(stages), steps: r.steps(stages), stopOnReply: true });
  };

  const abrirExistente = (a: CrmAutomation, modo: 'editar' | 'execucoes' = 'editar') => {
    setModoInicial(modo);
    setEditor({
      id: a.id, name: a.name, trigger: a.triggerType,
      cfg: (a.triggerConfig ?? {}) as Record<string, unknown>,
      steps: a.steps ?? [], stopOnReply: a.stopOnReply,
    });
  };

  const abrirVazio = () => {
    setModoInicial('editar');
    setEditor({ id: null, name: 'Novo fluxo', trigger: 'NEW_LEAD', cfg: {}, steps: [], stopOnReply: true });
  };

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
      aviso(editor.id ? 'Automação atualizada.' : 'Automação criada e já ligada.');
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

  const visiveis = useMemo(() => {
    const g = GRUPOS.find((x) => x.id === grupo)!;
    return lista.filter((a) =>
      (grupo === 'todos' || g.triggers.includes(a.triggerType)) &&
      (estado === 'todas' || (estado === 'ligadas') === a.enabled));
  }, [lista, grupo, estado]);

  const falhas = useMemo(() => {
    const porId = new Map(lista.map((a) => [a.id, a]));
    return (atividade?.failed ?? [])
      .map((f) => ({ auto: porId.get(f.automationId), count: f.count }))
      .filter((f): f is { auto: CrmAutomation; count: number } => !!f.auto);
  }, [atividade, lista]);

  if (!podeConfigurar) {
    return (
      <div className="p-6">
        <div className="ui-card">
          <p style={{ color: 'var(--text-primary)', fontWeight: 600 }}>Acesso restrito</p>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Automações são configuradas pelo administrador — elas agem sobre os cards de toda a operação.
            Quando uma delas mexer num card seu, o histórico dele mostra qual foi.
          </p>
        </div>
      </div>
    );
  }

  const toastEl = toast && (
    <div role="status" className="mb-4 rounded-lg px-4 py-3 text-sm" style={{
      backgroundColor: toast.erro ? 'var(--badge-error-bg)' : 'var(--badge-success-bg)',
      color: toast.erro ? 'var(--badge-error-text)' : 'var(--badge-success-text)',
    }}>{toast.texto}</div>
  );

  if (editor) {
    return (
      <div className="p-3 sm:p-4">
        {toastEl}
        <FluxoCanvas
          editor={editor} setEditor={setEditor} stages={stages} motivos={motivos}
          salvando={salvando} modoInicial={modoInicial} onSalvar={salvar} onVoltar={() => setEditor(null)}
        />
      </div>
    );
  }

  const mono: React.CSSProperties = { font: '500 11px/1.4 var(--font-mono-cx), ui-monospace, monospace', letterSpacing: '0.06em' };

  return (
    <div className="p-4 sm:p-6" style={{ maxWidth: 1240, margin: '0 auto' }}>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-2" style={{ maxWidth: 640 }}>
          <span style={{ ...mono, fontSize: 12.5, color: 'var(--accent)' }}>CRM · AUTOMAÇÕES</span>
          <h1 className="ui-h1">Seus fluxos</h1>
          <p className="ui-sub">
            Cada fluxo é um desenho: o gatilho primeiro, as ações em seguida. O CRM faz sozinho o que hoje depende de
            alguém lembrar. Mensagem automática só existe em boas-vindas e lead que não respondeu, e sai pela fila dos Disparos.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href="#modelos" className="ui-btn ui-btn-secondary">Ver modelos prontos</a>
          <button type="button" onClick={abrirVazio} className="ui-btn ui-btn-primary">Novo fluxo</button>
        </div>
      </header>

      {toastEl}

      {falhas.map((f) => (
        <div key={f.auto.id} className="mb-3 flex flex-wrap items-center gap-3 rounded-2xl px-4 py-3"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
          <span aria-hidden="true" style={{ color: 'var(--badge-error-text)', fontWeight: 800 }}>✕</span>
          <span className="text-sm" style={{ flex: '1 1 280px', color: 'var(--text-secondary)' }}>
            <b style={{ color: 'var(--text-primary)' }}>{f.auto.name}</b> falhou em {f.count} {f.count === 1 ? 'card' : 'cards'} nos
            últimos {atividade?.failedWindowDays ?? 7} dias.
          </span>
          <button type="button" onClick={() => abrirExistente(f.auto, 'execucoes')} className="ui-btn ui-btn-secondary ui-btn-sm">Ver execuções</button>
        </div>
      ))}

      {lista.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div role="group" aria-label="Filtrar por gatilho" className="flex flex-wrap gap-2">
            {GRUPOS.map((g) => (
              <button key={g.id} type="button" aria-pressed={grupo === g.id} onClick={() => setGrupo(g.id)}
                className="ui-filtro" data-ativo={grupo === g.id}>{g.label}</button>
            ))}
          </div>
          <div className="ui-seg" role="group" aria-label="Filtrar por estado">
            {(['todas', 'ligadas', 'desligadas'] as Estado[]).map((e) => (
              <button key={e} type="button" aria-pressed={estado === e} onClick={() => setEstado(e)}>
                {e === 'todas' ? 'Todas' : e === 'ligadas' ? 'Ligadas' : 'Desligadas'}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mb-10 flex flex-wrap items-start gap-6">
        <div style={{ flex: '999 1 560px', minWidth: 0 }}>
          {carregando ? (
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Carregando…</p>
          ) : lista.length === 0 ? (
            <div className="rounded-2xl px-5 py-10 text-center text-sm" style={{ border: '1px dashed var(--border-md)', color: 'var(--text-secondary)' }}>
              Nenhum fluxo ainda. Comece por um dos modelos prontos abaixo ou monte do zero.
            </div>
          ) : visiveis.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Nenhum fluxo com esse filtro.</p>
          ) : (
            <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 280px), 1fr))' }}>
              {visiveis.map((a) => {
                const nFalhas = falhas.find((f) => f.auto.id === a.id)?.count ?? 0;
                return (
                  <article key={a.id} className="ui-card flex flex-col !p-0 overflow-hidden">
                    <button type="button" onClick={() => abrirExistente(a)} aria-label={`Abrir ${a.name}`} className="block w-full cursor-pointer text-left">
                      <Miniatura trigger={a.triggerType} steps={a.steps} />
                    </button>
                    <div className="flex flex-1 flex-col gap-2 px-4 pb-4 pt-3.5">
                      <span style={{ ...mono, color: 'var(--accent)' }}>{rotuloGatilho(a.triggerType, a.triggerConfig as Record<string, unknown>).toUpperCase()}</span>
                      <h2 className="ui-h2">{a.name}</h2>
                      <p className="flex-1 text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                        {resumoLista(a.steps)}
                      </p>
                      <p className="text-xs" style={{ color: nFalhas ? 'var(--badge-error-text)' : 'var(--text-secondary)' }}>
                        {nFalhas ? `✕ ${nFalhas} ${nFalhas === 1 ? 'falha' : 'falhas'} na semana · ` : ''}
                        {a.runCount === 0 ? 'Ainda não concluiu em nenhum card' : `Concluiu em ${a.runCount} ${a.runCount === 1 ? 'card' : 'cards'}`}
                      </p>
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                        <label className="flex items-center gap-2 text-[13px] font-medium" style={{ color: a.enabled ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                          <Switch on={a.enabled} onClick={() => alternar(a)} label={`${a.enabled ? 'Desligar' : 'Ligar'} ${a.name}`} />
                          {a.enabled ? 'Ligada' : 'Desligada'}
                        </label>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => remover(a)} className="ui-btn ui-btn-danger ui-btn-sm">Remover</button>
                          <button type="button" onClick={() => abrirExistente(a)} className="ui-btn ui-btn-secondary ui-btn-sm">Abrir</button>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        {lista.length > 0 && (
          <aside aria-label="Atividade recente" className="ui-card" style={{ flex: '1 1 280px', maxWidth: 360 }}>
            <div className="flex items-baseline justify-between gap-2 pb-2">
              <span style={{ ...mono, color: 'var(--text-secondary)' }}>ATIVIDADE RECENTE</span>
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {lista.filter((a) => a.enabled).length} {lista.filter((a) => a.enabled).length === 1 ? 'ligada' : 'ligadas'} de {lista.length}
              </span>
            </div>
            {!atividade || atividade.runs.length === 0 ? (
              <p className="pt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>Nenhum fluxo rodou ainda.</p>
            ) : atividade.runs.map((r) => (
              <a key={r.id} href={`/dashboard/crm?client=${r.client?.id ?? ''}`} className="flex flex-col gap-1 py-2.5 hover:opacity-80"
                style={{ borderTop: '1px solid var(--border)', textDecoration: 'none' }}>
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{r.client?.name ?? '—'}</span>
                  <span className="ui-badge" style={statusStyle(r.status)}>{statusLabel(r.status)}</span>
                </span>
                <span className="truncate text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {r.automation.name} · {new Date(r.startedAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </span>
              </a>
            ))}
          </aside>
        )}
      </div>

      <section id="modelos" className="ui-card ui-card-hl">
        <h2 className="ui-h2 mb-1">Modelos prontos</h2>
        <p className="mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Abra um, ajuste os prazos e salve. Ele começa a rodar assim que for criado — dá para desligar no card.
        </p>
        <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 260px), 1fr))' }}>
          {RECEITAS.map((r) => (
            <button key={r.nome} type="button" onClick={() => abrirReceita(r)}
              className="ui-card flex flex-col !p-0 overflow-hidden text-left transition-transform hover:-translate-y-0.5">
              <Miniatura trigger={r.trigger} steps={r.steps(stages)} />
              <span className="flex flex-col gap-1.5 px-4 pb-4 pt-3">
                <span style={{ ...mono, color: 'var(--accent)' }}>{rotuloGatilho(r.trigger, r.cfg(stages)).toUpperCase()}</span>
                <span className="text-[15px] font-bold" style={{ color: 'var(--text-primary)' }}>{r.nome}</span>
                <span className="text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{r.descricao}</span>
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
