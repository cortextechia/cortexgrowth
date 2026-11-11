'use client';

// Demonstrações clicáveis da Central de ajuda (11/11/2026). Versão "de brinquedo" da tela:
// nada aqui fala com a API nem muda o CRM. Rótulos de botão/tela iguais aos do artigo e do
// app — mudou a tela, muda a demo junto (o texto do artigo é a referência).
//
// Nunca nome de pessoa inventado: "Lead novo", "Novo contato", "Cliente da loja".

import { useEffect, useState, type ReactNode } from 'react';

// ─── Peças comuns ─────────────────────────────────────────────────────────────

function Moldura({ tela, dica, onRecomecar, children, rodape }: {
  tela: string;
  dica: string;
  onRecomecar: () => void;
  children: ReactNode;
  rodape?: ReactNode;
}) {
  return (
    <figure className="ajuda-demo mx-0 mt-0 rounded-3xl overflow-hidden" aria-label={`Demonstração: ${tela}`}
      style={{ background: 'linear-gradient(180deg, var(--bg-elevated), var(--bg-surface))', border: '1px solid var(--border-md)', boxShadow: '0 30px 70px rgba(0,0,0,0.22)' }}>
      <div className="flex flex-wrap items-center gap-3 px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
        <span className="eyebrow" style={{ color: 'var(--text-secondary)' }}>VEJA FUNCIONANDO · {tela.toUpperCase()}</span>
        <span className="flex-1" />
        <span className="text-sm" style={{ color: 'var(--text-secondary)' }} aria-live="polite">{dica}</span>
        <button onClick={onRecomecar} className="ui-btn ui-btn-secondary ui-btn-sm">Recomeçar</button>
      </div>
      <div className="p-4 sm:p-5">{children}</div>
      {rodape && <div className="px-4 sm:px-5 py-3.5" style={{ borderTop: '1px solid var(--border)' }}>{rodape}</div>}
      <figcaption className="px-4 sm:px-5 pb-3 text-xs" style={{ color: 'var(--text-secondary)' }}>Demonstração: mexa à vontade, nada aqui muda o seu CRM.</figcaption>
    </figure>
  );
}

function Coluna({ titulo, n, children }: { titulo: string; n?: number; children?: ReactNode }) {
  return (
    <div className="ui-inset p-3 flex flex-col gap-2.5 min-h-[220px]">
      <div className="flex justify-between text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
        <span>{titulo}</span>
        {n !== undefined && <span className="eyebrow" style={{ color: 'var(--text-secondary)' }}>{n}</span>}
      </div>
      {children}
    </div>
  );
}

type Espera = 'verde' | 'ambar' | 'vermelha';
const COR_ESPERA: Record<Espera, string> = { verde: 'var(--badge-success-text)', ambar: 'var(--badge-warn-text)', vermelha: 'var(--badge-error-text)' };

function CardMini({ nome, linha, espera, destaque, children }: { nome: string; linha?: string; espera?: Espera; destaque?: boolean; children?: ReactNode }) {
  return (
    <div className="ajuda-entra rounded-xl p-3 flex flex-col gap-1.5"
      style={destaque
        ? { background: 'linear-gradient(160deg, var(--highlight), var(--bg-surface))', border: '1px solid var(--highlight-border)' }
        : { background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
      <div className="flex items-center gap-2">
        {espera && <span aria-hidden className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: COR_ESPERA[espera] }} />}
        <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{nome}</span>
      </div>
      {linha && <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{linha}</span>}
      {children}
    </div>
  );
}

const Selo = ({ children, forte }: { children: ReactNode; forte?: boolean }) => (
  <span className={`ui-badge ${forte ? 'ui-badge-lime' : 'ui-badge-tint'} self-start`}>{children}</span>
);

function Passos({ passo, total, texto, onVoltar, onAvancar, ultimo }: { passo: number; total: number; texto: string; onVoltar: () => void; onAvancar: () => void; ultimo: string }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="eyebrow">PASSO {passo + 1} DE {total}</span>
      <span className="flex-1 min-w-[220px] text-[15px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{texto}</span>
      <button onClick={onVoltar} disabled={passo === 0} className="ui-btn ui-btn-secondary ui-btn-sm">Voltar</button>
      <button onClick={onAvancar} className="ui-btn ui-btn-primary ui-btn-sm">{passo < total - 1 ? 'Próximo passo' : ultimo}</button>
    </div>
  );
}

function Opcoes<T extends string>({ rotulo, opcoes, valor, onEscolher }: { rotulo: string; opcoes: readonly T[]; valor: T | null; onEscolher: (v: T) => void }) {
  return (
    <div className="ui-seg" role="group" aria-label={rotulo}>
      {opcoes.map((o) => <button key={o} aria-pressed={valor === o} onClick={() => onEscolher(o)}>{o}</button>)}
    </div>
  );
}

const dinheiro = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// ─── 1. Novos contatos: aceitar ou descartar ──────────────────────────────────

const MOTIVOS_DESCARTE = ['Não responde', 'Clique errado no anúncio', 'Fora da área de atendimento'] as const;

function DemoTriagem() {
  const [estado, setEstado] = useState<'novo' | 'motivo' | 'aceito' | 'descartado'>('novo');
  const [motivo, setMotivo] = useState('');
  const dicas = { novo: 'Clique em Aceitar ou Descartar', motivo: 'Escolha o motivo', aceito: 'Aceito: o card entrou na primeira etapa', descartado: 'Descartado, sem criar venda perdida' };
  const naTriagem = estado === 'novo' || estado === 'motivo';
  return (
    <Moldura tela="CRM" dica={dicas[estado]} onRecomecar={() => { setEstado('novo'); setMotivo(''); }}>
      <div className="overflow-x-auto"><div className="grid grid-cols-3 gap-3 min-w-[640px]">
        <Coluna titulo="Novos contatos" n={naTriagem ? 1 : 0}>
          {naTriagem && (
            <CardMini nome="Novo contato" espera="verde" destaque>
              <span className="ui-inset px-2.5 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>&quot;Olá, vi o anúncio e queria um orçamento.&quot;</span>
              <Selo forte>VEIO DO ANÚNCIO</Selo>
              {estado === 'novo' ? (
                <div className="flex gap-2 pt-1">
                  <button onClick={() => setEstado('aceito')} className="ui-btn ui-btn-primary ui-btn-sm flex-1">Aceitar</button>
                  <button onClick={() => setEstado('motivo')} className="ui-btn ui-btn-secondary ui-btn-sm flex-1">Descartar</button>
                </div>
              ) : (
                <div className="ajuda-entra flex flex-col gap-2 pt-2" style={{ borderTop: '1px solid var(--border)' }}>
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Motivo do descarte</span>
                  {MOTIVOS_DESCARTE.map((m) => (
                    <button key={m} onClick={() => { setMotivo(m); setEstado('descartado'); }} className="ui-filtro w-full !justify-start text-left">{m}</button>
                  ))}
                </div>
              )}
            </CardMini>
          )}
          {estado === 'descartado' && (
            <div className="ajuda-entra rounded-xl p-3 text-sm leading-relaxed" style={{ border: '1px dashed var(--border-control)', color: 'var(--text-secondary)' }}>
              <strong style={{ color: 'var(--text-primary)' }}>Descartado: {motivo}.</strong> O card saiu do funil sem criar venda perdida. O motivo entra no relatório.
            </div>
          )}
        </Coluna>
        <Coluna titulo="Novo Lead" n={estado === 'aceito' ? 2 : 1}>
          <CardMini nome="Lead novo" linha="Esperando resposta há 5 h" espera="ambar" />
          {estado === 'aceito' && (
            <CardMini nome="Novo contato" espera="verde" destaque>
              <Selo forte>VEIO DO ANÚNCIO</Selo>
              <span className="text-xs rounded-lg px-2.5 py-2" style={{ background: 'var(--tint-bg)', color: 'var(--tint-ink)' }}>Entrou na primeira etapa, com o anúncio que o trouxe.</span>
            </CardMini>
          )}
        </Coluna>
        <Coluna titulo="Em contato" n={1}>
          <CardMini nome="Cliente da loja" linha="Esperando resposta há 13 h" espera="vermelha" />
        </Coluna>
      </div></div>
    </Moldura>
  );
}

// ─── 2. O funil no dia a dia: fechar venda arrastando + sinais ───────────────

const PASSOS_FECHAR = [
  'Clique e segure o card que você quer fechar. Ele fica marcado enquanto você arrasta.',
  'Durante o arraste aparecem GANHAR e PERDER no rodapé. Leve o card até GANHAR.',
  'Informe o valor final (maior que zero) e confirme. Em PERDER, o CRM pede o motivo no lugar do valor.',
];

function DemoFunil() {
  // fase 0–2 = os três passos; 3 = venda confirmada (ainda no passo 3).
  const [fase, setFase] = useState(0);
  const [sozinho, setSozinho] = useState(false);
  const passo = Math.min(fase, 2);
  const fechou = fase === 3;
  const setFechou = () => setFase(3);

  useEffect(() => {
    if (!sozinho) return;
    const t = setInterval(() => setFase((f) => (f + 1) % 4), 2400);
    return () => clearInterval(t);
  }, [sozinho]);

  return (
    <Moldura tela="CRM" dica={sozinho ? 'Passando sozinho' : 'Use os passos abaixo'} onRecomecar={() => { setFase(0); setSozinho(false); }}
      rodape={<Passos passo={passo} total={3} texto={PASSOS_FECHAR[passo]!} ultimo="Ver de novo"
        onVoltar={() => setFase(Math.max(0, passo - 1))}
        onAvancar={() => setFase(passo < 2 ? passo + 1 : 0)} />}>
      <div className="flex justify-end mb-3">
        <button onClick={() => setSozinho(!sozinho)} className="ui-btn ui-btn-secondary ui-btn-sm" aria-pressed={sozinho}>{sozinho ? 'Pausar' : 'Reproduzir sozinho'}</button>
      </div>
      <div className="relative overflow-x-auto">
        <div className="grid grid-cols-3 gap-3 min-w-[600px]">
          <Coluna titulo="Orçamento enviado">
            {passo < 2 && (
              <div className={passo === 1 ? 'ajuda-arrasta' : ''} style={{ outline: '2px solid var(--accent)', outlineOffset: 2, borderRadius: 12 }}>
                <CardMini nome="Lead novo" linha="Venda aberta · R$ 1.850,00" />
              </div>
            )}
            <CardMini nome="Cliente da loja" linha="Venda aberta · R$ 640,00" />
          </Coluna>
          <Coluna titulo="Negociando"><CardMini nome="Novo contato" linha="Venda aberta · R$ 3.200,00" /></Coluna>
          <Coluna titulo="Visita marcada" />
        </div>
        {passo >= 1 && (
          <div className="ajuda-entra grid grid-cols-2 gap-3 mt-3 min-w-[600px]">
            <div className="rounded-xl py-4 text-center eyebrow" style={{ border: '2px dashed var(--accent)', background: 'var(--highlight)', color: 'var(--accent)' }}>GANHAR</div>
            <div className="rounded-xl py-4 text-center eyebrow" style={{ border: '2px dashed var(--border-control)', color: 'var(--text-secondary)' }}>PERDER</div>
          </div>
        )}
        {passo === 2 && (
          <div className="ajuda-entra absolute inset-0 flex items-center justify-center p-4" style={{ background: 'rgba(12,13,15,0.55)' }}>
            <div role="dialog" aria-label="Ganhar venda" className="w-full max-w-sm rounded-2xl p-5 flex flex-col gap-3" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-md)' }}>
              <span className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Ganhar venda</span>
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Valor final</span>
              <span className="ui-inset px-3 py-2.5 ui-big !text-xl">R$ 1.850,00</span>
              {fechou
                ? <span className="ajuda-entra rounded-lg px-3 py-2 text-sm" style={{ background: 'var(--tint-bg)', color: 'var(--tint-ink)' }}>Venda ganha. Ela entra no LTV e nos números da empresa.</span>
                : <button onClick={setFechou} className="ui-btn ui-btn-primary">Confirmar</button>}
            </div>
          </div>
        )}
      </div>
    </Moldura>
  );
}

const SINAIS = [
  { nome: 'Bolinha verde', quer: 'Esperando resposta há menos de 4 horas', espera: 'verde' as Espera, linha: 'Esperando resposta há 1 h' },
  { nome: 'Bolinha âmbar', quer: 'Esperando há 4 horas ou mais', espera: 'ambar' as Espera, linha: 'Esperando resposta há 5 h' },
  { nome: 'Bolinha vermelha', quer: 'Esperando há 12 horas ou mais', espera: 'vermelha' as Espera, linha: 'Esperando resposta há 13 h' },
  { nome: 'Follow-up de hoje', quer: 'Próximo contato marcado para hoje', linha: 'Follow-up hoje' },
  { nome: 'Selo de origem e tags', quer: 'De onde veio e até 2 tags; o resto vira "+N"', linha: 'Esperando resposta há 1 h', espera: 'verde' as Espera, tags: true },
];

function DemoSinais() {
  const [i, setI] = useState(0);
  const s = SINAIS[i]!;
  return (
    <Moldura tela="Sinais do card" dica="Escolha um sinal" onRecomecar={() => setI(0)}>
      <div className="grid gap-4 md:grid-cols-2 items-start">
        <div role="group" aria-label="Sinais" className="flex flex-col gap-2">
          {SINAIS.map((x, k) => (
            <button key={x.nome} onClick={() => setI(k)} aria-pressed={k === i} className="flex items-center gap-3 text-left rounded-xl px-3.5 py-2.5"
              style={{ background: k === i ? 'var(--bg-surface)' : 'transparent', border: `1px solid ${k === i ? 'var(--border-control)' : 'var(--border)'}` }}>
              <span aria-hidden className="h-3 w-3 rounded-full shrink-0" style={{ background: x.espera ? COR_ESPERA[x.espera] : 'var(--accent)' }} />
              <span className="flex flex-col">
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{x.nome}</span>
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{x.quer}</span>
              </span>
            </button>
          ))}
        </div>
        <div className="ui-inset p-6 flex justify-center">
          <div key={i} className="w-full max-w-[280px]">
            <CardMini nome="Novo contato" linha={s.linha} espera={s.espera}>
              <div className="flex flex-wrap gap-1.5 pt-1">
                <Selo forte={!!s.tags}>META ADS</Selo>
                <span className="ui-chip">Orçamento</span>
                <span className="ui-chip">Retorno</span>
                {s.tags && <span className="text-xs self-center" style={{ color: 'var(--text-secondary)' }}>+3</span>}
              </div>
            </CardMini>
          </div>
        </div>
      </div>
    </Moldura>
  );
}

function DemoFunilCompleto() {
  return <div className="space-y-5"><DemoFunil /><DemoSinais /></div>;
}

// ─── 3. Conectar o WhatsApp ───────────────────────────────────────────────────

const PASSOS_WA = [
  'Na página do CRM, clique em Conectar WhatsApp. O QR Code aparece na tela.',
  'No celular, abra o WhatsApp › Dispositivos conectados › Conectar dispositivo.',
  'Leia o QR Code. Pronto: mensagem de número novo cria o card sozinho em Novos contatos.',
];

function QrFalso() {
  // Desenho decorativo: não é um QR Code de verdade.
  const cel = Array.from({ length: 81 }, (_, k) => ((k * 37) % 7 < 3) || [0, 1, 2, 9, 18, 19, 20, 6, 7, 8, 15, 24, 25, 26, 60, 61, 62, 69, 78, 79, 80].includes(k));
  return (
    <div aria-hidden className="grid grid-cols-9 gap-[3px] p-3 rounded-xl" style={{ background: '#ffffff', width: 150 }}>
      {cel.map((on, k) => <span key={k} className="aspect-square rounded-[2px]" style={{ background: on ? '#0c0d0f' : 'transparent' }} />)}
    </div>
  );
}

function DemoWhatsapp() {
  const [passo, setPasso] = useState(0);
  return (
    <Moldura tela="CRM" dica={passo === 2 ? 'Conectado' : 'Siga os passos'} onRecomecar={() => setPasso(0)}
      rodape={<Passos passo={passo} total={3} texto={PASSOS_WA[passo]!} ultimo="Ver de novo" onVoltar={() => setPasso(Math.max(0, passo - 1))} onAvancar={() => setPasso(passo < 2 ? passo + 1 : 0)} />}>
      <div className="grid gap-4 md:grid-cols-[1fr_220px] items-center">
        <div className="ui-inset p-5 flex flex-col items-center gap-3 min-h-[250px] justify-center">
          {passo < 2 ? (
            <>
              <span className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>WhatsApp do CRM</span>
              <QrFalso />
              <span className="text-xs text-center max-w-[260px]" style={{ color: 'var(--text-secondary)' }}>Leia este código com o celular do vendedor. Ele se renova sozinho.</span>
            </>
          ) : (
            <div className="ajuda-entra w-full max-w-[300px] flex flex-col gap-3">
              <span className="ui-badge ui-badge-lime self-center">CONECTADO</span>
              <span className="text-sm text-center" style={{ color: 'var(--text-secondary)' }}>Chegou mensagem de um número novo:</span>
              <CardMini nome="Novo contato" linha="Em Novos contatos, com nome e foto" espera="verde" destaque />
            </div>
          )}
        </div>
        <div className="mx-auto rounded-[28px] p-2.5 w-[200px]" style={{ background: 'var(--bg-base)', border: '1px solid var(--border-md)' }} aria-label="Celular">
          <div className="rounded-[20px] p-3 min-h-[260px] flex flex-col gap-2" style={{ background: 'var(--bg-surface)' }}>
            <span className="eyebrow" style={{ color: 'var(--text-secondary)' }}>WHATSAPP</span>
            {passo === 0 && <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Conversas</span>}
            {passo >= 1 && (
              <div className="ajuda-entra flex flex-col gap-2">
                <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Dispositivos conectados</span>
                <span className="rounded-lg px-3 py-2 text-sm font-bold text-center" style={{ background: 'var(--accent-fill)', color: 'var(--on-accent)' }}>Conectar dispositivo</span>
                {passo === 2 && <span className="ajuda-entra text-xs" style={{ color: 'var(--badge-success-text)' }}>✓ Navegador conectado</span>}
              </div>
            )}
          </div>
        </div>
      </div>
    </Moldura>
  );
}

// ─── 4. A conversa dentro do card: respostas rápidas ──────────────────────────

const RESPOSTAS = [
  { titulo: 'orcamento', texto: 'Oi {nome}! Para montar o orçamento, me diz a quantidade e a cidade da entrega?' },
  { titulo: 'horario', texto: 'Oi {nome}, atendemos de segunda a sexta. Já te respondo por aqui!' },
];

function DemoConversa() {
  const [texto, setTexto] = useState('');
  const [enviadas, setEnviadas] = useState<string[]>([]);
  const sugestoes = texto.startsWith('/') ? RESPOSTAS.filter((r) => r.titulo.startsWith(texto.slice(1).toLowerCase())) : [];
  const aplicar = (t: string) => setTexto(t.replace('{nome}', '[primeiro nome do cliente]'));
  const enviar = () => { if (!texto.trim() || texto.startsWith('/')) return; setEnviadas((e) => [...e, texto]); setTexto(''); };
  return (
    <Moldura tela="Conversa do card" dica='Digite "/" no campo' onRecomecar={() => { setTexto(''); setEnviadas([]); }}>
      <div className="ui-inset p-4 flex flex-col gap-2.5 min-h-[260px]">
        <div className="self-start max-w-[75%] rounded-2xl rounded-bl-md px-3.5 py-2 text-sm" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>Olá, quero um orçamento.</div>
        {enviadas.map((m, k) => (
          <div key={k} className="ajuda-entra self-end max-w-[75%] rounded-2xl rounded-br-md px-3.5 py-2 text-sm whitespace-pre-wrap" style={{ background: 'var(--tint-bg)', color: 'var(--tint-ink)' }}>{m}</div>
        ))}
        <div className="flex-1" />
        <div className="relative">
          {sugestoes.length > 0 && (
            <ul className="ajuda-entra absolute bottom-full mb-2 left-0 right-0 ui-menu" role="listbox" aria-label="Respostas rápidas">
              {sugestoes.map((r) => (
                <li key={r.titulo}>
                  <button className="ui-menu-item" onClick={() => aplicar(r.texto)}>
                    <span><strong>/{r.titulo}</strong> <span style={{ color: 'var(--text-secondary)' }}>{r.texto.slice(0, 48)}…</span></span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2 items-end">
            <label htmlFor="demo-msg" className="sr-only">Mensagem</label>
            <textarea id="demo-msg" rows={2} value={texto} onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (sugestoes[0]) aplicar(sugestoes[0].texto); else enviar();
                }
              }}
              placeholder="Escreva ou digite / para respostas rápidas"
              className="flex-1 rounded-xl px-3 py-2 text-sm resize-none"
              style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }} />
            <button onClick={enviar} disabled={!texto.trim() || texto.startsWith('/')} className="ui-btn ui-btn-primary ui-btn-sm">Enviar</button>
          </div>
          <p className="text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>Enter envia · Shift + Enter quebra a linha · {'{nome}'} vira o primeiro nome do cliente</p>
        </div>
      </div>
    </Moldura>
  );
}

// ─── 5. Vendas: abrir, ganhar e perder ────────────────────────────────────────

// Três dos motivos padrão (DEFAULT_LOST_REASONS no backend); cada empresa edita a própria lista.
const MOTIVOS_PERDA = ['Preço', 'Concorrência', 'Desistência'] as const;

function DemoVendas() {
  const [etapa, setEtapa] = useState<'sem' | 'aberta' | 'ganhar' | 'perder' | 'ganha' | 'perdida'>('sem');
  const [valor, setValor] = useState<number | null>(null);
  const [motivo, setMotivo] = useState('');
  const dica = { sem: 'Clique em + Nova venda', aberta: 'Ganhe ou perca a venda', ganhar: 'Confira o valor final', perder: 'Escolha o motivo', ganha: 'O card saiu do funil e fica em Contatos', perdida: 'O card saiu do funil e fica em Contatos' }[etapa];
  return (
    <Moldura tela="Card do cliente" dica={dica} onRecomecar={() => { setEtapa('sem'); setValor(null); setMotivo(''); }}>
      <div className="ui-inset p-4 flex flex-col gap-3 max-w-xl mx-auto">
        <div className="flex items-center justify-between">
          <span className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Vendas</span>
          {etapa === 'sem' && <button onClick={() => setEtapa('aberta')} className="ui-btn ui-btn-primary ui-btn-sm">+ Nova venda</button>}
        </div>
        {etapa === 'sem' && <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Nenhuma venda neste card ainda.</span>}
        {etapa !== 'sem' && (
          <div className="ajuda-entra rounded-xl p-3.5 flex flex-col gap-3" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Venda · origem Meta Ads</span>
              <span className="flex-1" />
              {etapa === 'ganha' && <span className="ui-badge ui-badge-lime">GANHA · {dinheiro(valor ?? 0)}</span>}
              {etapa === 'perdida' && <span className="ui-badge ui-badge-tint">PERDIDA · {motivo}</span>}
              {(etapa === 'aberta' || etapa === 'ganhar' || etapa === 'perder') && <span className="ui-chip">ABERTA</span>}
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Valor</span>
              <div className="flex flex-wrap gap-2">
                {[640, 1850, 3200].map((v) => (
                  <button key={v} disabled={etapa === 'ganha' || etapa === 'perdida'} onClick={() => setValor(v)} aria-pressed={valor === v} className={`ui-filtro ${valor === v ? '!bg-[var(--accent-fill)] !text-[var(--on-accent)]' : ''}`}>{dinheiro(v)}</button>
                ))}
              </div>
            </div>
            {etapa === 'aberta' && (
              <div className="flex gap-2">
                <button onClick={() => setEtapa('ganhar')} className="ui-btn ui-btn-primary ui-btn-sm">Ganhar</button>
                <button onClick={() => setEtapa('perder')} className="ui-btn ui-btn-secondary ui-btn-sm">Perder</button>
              </div>
            )}
            {etapa === 'ganhar' && (
              <div className="ajuda-entra flex flex-col gap-2">
                {!valor && <span className="text-sm" style={{ color: 'var(--badge-warn-text)' }}>Escolha um valor acima: Ganhar pede valor maior que zero.</span>}
                <button disabled={!valor} onClick={() => setEtapa('ganha')} className="ui-btn ui-btn-primary ui-btn-sm self-start">Confirmar {valor ? dinheiro(valor) : ''}</button>
              </div>
            )}
            {etapa === 'perder' && (
              <div className="ajuda-entra flex flex-wrap gap-2">
                {MOTIVOS_PERDA.map((m) => <button key={m} onClick={() => { setMotivo(m); setEtapa('perdida'); }} className="ui-filtro">{m}</button>)}
              </div>
            )}
            {(etapa === 'ganha' || etapa === 'perdida') && (
              <span className="ajuda-entra text-sm rounded-lg px-3 py-2" style={{ background: 'var(--tint-bg)', color: 'var(--tint-ink)' }}>
                Era a última venda aberta: o card sai do funil e fica em Contatos. Comprou de novo? Abra outra venda no mesmo card.
              </span>
            )}
          </div>
        )}
      </div>
    </Moldura>
  );
}

// ─── 6. Tarefas e follow-up ───────────────────────────────────────────────────

const TIPOS_TAREFA = ['Ligar', 'WhatsApp', 'Reunião', 'E-mail', 'Outro'] as const;
const QUANDO = ['Ontem', 'Hoje', 'Amanhã'] as const;

function DemoTarefas() {
  const [tipo, setTipo] = useState<(typeof TIPOS_TAREFA)[number] | null>('Ligar');
  const [quando, setQuando] = useState<(typeof QUANDO)[number] | null>('Hoje');
  const [tarefas, setTarefas] = useState<{ id: number; titulo: string; quando: string; feita: boolean }[]>([
    { id: 1, titulo: 'WhatsApp · Mandar fotos do produto', quando: 'Ontem', feita: false },
  ]);
  const pendentes = tarefas.filter((t) => !t.feita);
  const cor = (q: string) => (q === 'Ontem' ? 'var(--badge-error-text)' : q === 'Hoje' ? 'var(--badge-warn-text)' : 'var(--text-secondary)');
  const rotulo = (q: string) => (q === 'Ontem' ? 'Vencida' : q === 'Hoje' ? 'Hoje' : 'Amanhã');
  return (
    <Moldura tela="CRM" dica="Crie uma tarefa e conclua" onRecomecar={() => { setTarefas([{ id: 1, titulo: 'WhatsApp · Mandar fotos do produto', quando: 'Ontem', feita: false }]); setTipo('Ligar'); setQuando('Hoje'); }}>
      <div className="grid gap-4 md:grid-cols-2 items-start">
        <div className="ui-inset p-4 flex flex-col gap-3">
          <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>No card · + Nova tarefa</span>
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Tipo</span>
          <Opcoes rotulo="Tipo da tarefa" opcoes={TIPOS_TAREFA} valor={tipo} onEscolher={setTipo} />
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Data</span>
          <Opcoes rotulo="Data da tarefa" opcoes={QUANDO} valor={quando} onEscolher={setQuando} />
          <button disabled={!tipo || !quando} onClick={() => setTarefas((t) => [...t, { id: Date.now(), titulo: `${tipo} · Retornar orçamento`, quando: quando!, feita: false }])} className="ui-btn ui-btn-primary ui-btn-sm self-start">Criar tarefa</button>
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>A tarefa nasce para o responsável do card.</span>
        </div>
        <div className="ui-inset p-4 flex flex-col gap-2 min-h-[200px]">
          <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Painel Tarefas <span className="eyebrow" style={{ color: 'var(--text-secondary)' }}>· {pendentes.length} PENDENTES</span></span>
          {pendentes.length === 0 && <span className="ajuda-entra text-sm" style={{ color: 'var(--text-secondary)' }}>Sem nada pendente, o painel some do CRM.</span>}
          {pendentes.map((t) => (
            <div key={t.id} className="ajuda-entra flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
              <button aria-label={`Concluir: ${t.titulo}`} onClick={() => setTarefas((ts) => ts.map((x) => (x.id === t.id ? { ...x, feita: true } : x)))}
                className="h-5 w-5 rounded-full shrink-0" style={{ border: '2px solid var(--border-control)' }} />
              <span className="flex-1 text-sm" style={{ color: 'var(--text-primary)' }}>{t.titulo}<span className="block text-xs" style={{ color: 'var(--text-secondary)' }}>Novo contato</span></span>
              <span className="text-xs font-bold" style={{ color: cor(t.quando) }}>{rotulo(t.quando)}</span>
            </div>
          ))}
        </div>
      </div>
    </Moldura>
  );
}

// ─── 7. Disparos em massa ─────────────────────────────────────────────────────

const BASE_DISPARO = [
  { tags: ['Carteira'], etapa: 'Novo Lead', vendedorOn: true },
  { tags: ['Carteira', 'VIP'], etapa: 'Negociando', vendedorOn: true },
  { tags: ['VIP'], etapa: 'Novo Lead', vendedorOn: false },
  { tags: [], etapa: 'Negociando', vendedorOn: true },
  { tags: ['Carteira'], etapa: 'Orçamento enviado', vendedorOn: false },
  { tags: ['Carteira'], etapa: 'Novo Lead', vendedorOn: true },
  { tags: ['VIP'], etapa: 'Orçamento enviado', vendedorOn: true },
  { tags: [], etapa: 'Novo Lead', vendedorOn: true },
];
const TAGS_D = ['Carteira', 'VIP'];
const ETAPAS_D = ['Novo Lead', 'Orçamento enviado', 'Negociando'];

function DemoDisparos() {
  const [tags, setTags] = useState<string[]>(['Carteira']);
  const [etapas, setEtapas] = useState<string[]>([]);
  const [modo, setModo] = useState<'Todos (E)' | 'Qualquer um (OU)'>('Todos (E)');
  const [lotes, setLotes] = useState(false);
  const alterna = (lista: string[], v: string) => (lista.includes(v) ? lista.filter((x) => x !== v) : [...lista, v]);
  const grupos = [tags.length ? (c: (typeof BASE_DISPARO)[number]) => c.tags.some((t) => tags.includes(t)) : null, etapas.length ? (c: (typeof BASE_DISPARO)[number]) => etapas.includes(c.etapa) : null].filter(Boolean) as ((c: (typeof BASE_DISPARO)[number]) => boolean)[];
  const publico = grupos.length === 0 ? [] : BASE_DISPARO.filter((c) => (modo === 'Todos (E)' ? grupos.every((g) => g(c)) : grupos.some((g) => g(c))));
  const vao = publico.filter((c) => c.vendedorOn).length;
  return (
    <Moldura tela="CRM › Disparos" dica="Mude os filtros e veja o alcance" onRecomecar={() => { setTags(['Carteira']); setEtapas([]); setModo('Todos (E)'); setLotes(false); }}>
      <div className="grid gap-4 md:grid-cols-[1fr_260px] items-start">
        <div className="ui-inset p-4 flex flex-col gap-3">
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Tag</span>
          <div className="flex flex-wrap gap-2">{TAGS_D.map((t) => <button key={t} aria-pressed={tags.includes(t)} onClick={() => setTags(alterna(tags, t))} className={`ui-chip !text-[12px] !px-3 !py-1.5 ${tags.includes(t) ? 'ui-chip-on' : ''}`}>{t}</button>)}</div>
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Etapa</span>
          <div className="flex flex-wrap gap-2">{ETAPAS_D.map((t) => <button key={t} aria-pressed={etapas.includes(t)} onClick={() => setEtapas(alterna(etapas, t))} className={`ui-chip !text-[12px] !px-3 !py-1.5 ${etapas.includes(t) ? 'ui-chip-on' : ''}`}>{t}</button>)}</div>
          {grupos.length > 1 && <Opcoes rotulo="Como combinar os filtros" opcoes={['Todos (E)', 'Qualquer um (OU)'] as const} valor={modo} onEscolher={setModo} />}
          <label className="flex items-center gap-3 text-sm pt-1" style={{ color: 'var(--text-primary)' }}>
            <button type="button" role="switch" aria-checked={lotes} onClick={() => setLotes(!lotes)} className="ui-switch" />
            Enviar em lotes com pausa
          </label>
          {lotes && <span className="ajuda-entra text-xs" style={{ color: 'var(--text-secondary)' }}>Ex.: 50 a cada 2 minutos. Dentro do lote as mensagens já saem espaçadas, para o número não ser bloqueado.</span>}
        </div>
        <div className="ui-card ui-card-hl flex flex-col gap-2">
          <span className="eyebrow">ALCANCE</span>
          <span className="ui-big" aria-live="polite">{vao}</span>
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Vão receber</span>
          <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{publico.length - vao} {publico.length - vao === 1 ? 'pulado' : 'pulados'}</span>
          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Pulado = vendedor responsável sem WhatsApp conectado. Base de exemplo com {BASE_DISPARO.length} contatos.</span>
        </div>
      </div>
    </Moldura>
  );
}

// ─── 8. Automações: modelos prontos ───────────────────────────────────────────

const MODELOS = [
  { nome: 'Boas-vindas no WhatsApp', gatilho: 'Lead novo chegou', passos: ['Atribuir responsável (rodízio)', 'Enviar mensagem', 'Criar tarefa'], frase: 'Quando um lead novo chegar, distribui no rodízio, manda a boas-vindas pelo WhatsApp do responsável e cria uma tarefa para ele.' },
  { nome: 'Cobrança de lead que sumiu', gatilho: 'Lead não respondeu', passos: ['Enviar mensagem', 'Esperar', 'Adicionar tag'], frase: 'Quando vocês escrevem e o cliente some por X horas, manda uma cobrança, espera e marca uma tag se ele seguir calado.' },
  { nome: 'SLA de primeira resposta', gatilho: 'Sem resposta', passos: ['Criar tarefa', 'Registrar nota'], frase: 'Quando o cliente escreve e ninguém responde em X horas, cria uma tarefa para o responsável e registra uma nota no card.' },
];

function DemoAutomacoes() {
  const [i, setI] = useState(0);
  const m = MODELOS[i]!;
  return (
    <Moldura tela="CRM › Automações" dica="Escolha um modelo pronto" onRecomecar={() => setI(0)}>
      <div className="flex flex-wrap gap-2 mb-4" role="group" aria-label="Modelos prontos">
        {MODELOS.map((x, k) => <button key={x.nome} aria-pressed={k === i} onClick={() => setI(k)} className={`ui-btn ui-btn-sm ${k === i ? 'ui-btn-primary' : 'ui-btn-secondary'}`}>{x.nome}</button>)}
      </div>
      <div key={i} className="ui-inset p-4 overflow-x-auto">
        <div className="flex items-center gap-2 min-w-max">
          <div className="ajuda-entra rounded-xl px-3.5 py-3 text-sm" style={{ background: 'var(--accent-fill)', color: 'var(--on-accent)' }}>
            <span className="block eyebrow" style={{ color: 'var(--on-accent)' }}>QUANDO</span><strong>{m.gatilho}</strong>
          </div>
          {m.passos.map((p, k) => (
            <div key={p} className="flex items-center gap-2">
              <span aria-hidden className="h-[2px] w-6" style={{ background: 'var(--border-control)' }} />
              <div className="ajuda-entra rounded-xl px-3.5 py-3 text-sm" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-md)', color: 'var(--text-primary)', animationDelay: `${(k + 1) * 120}ms` }}>
                <span className="block eyebrow" style={{ color: 'var(--text-secondary)' }}>PASSO {k + 1}</span>{p}
              </div>
            </div>
          ))}
        </div>
      </div>
      <p className="mt-3 text-[15px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}><strong style={{ color: 'var(--text-primary)' }}>Em português:</strong> {m.frase}</p>
    </Moldura>
  );
}

// ─── 9. Rastreio: de qual anúncio veio o lead ─────────────────────────────────

const CHEGADAS = [
  { como: 'Anúncio de mensagem da Meta', msg: 'Olá! Quero saber mais sobre isso.', origem: 'META ADS', detalhe: 'O WhatsApp trouxe o anúncio junto: ele aparece em Rastreio sozinho.' },
  { como: 'Frase cadastrada (link do site)', msg: 'Olá, vim pelo site', origem: 'GOOGLE ADS', detalhe: 'A frase pronta do link está cadastrada em Rastreio com a plataforma Google.' },
  { como: 'Convenção de canal', msg: 'vim pelo link da bio', origem: 'LINK DA BIO', detalhe: '"vim pelo google" vira Google Ads e "vim pelo link da bio" vira Link da bio, sem cadastro.' },
  { como: 'Sem pista nenhuma', msg: 'Bom dia, tem disponível?', origem: 'WHATSAPP', detalhe: 'Sem anúncio nem frase reconhecida, a origem fica WhatsApp. O vendedor pode corrigir no card.' },
];

function DemoRastreio() {
  const [i, setI] = useState<number | null>(null);
  const c = i === null ? null : CHEGADAS[i]!;
  return (
    <Moldura tela="Rastreio" dica={c ? 'Veja a origem do card' : 'Escolha como o lead chegou'} onRecomecar={() => setI(null)}>
      <div className="grid gap-4 md:grid-cols-2 items-start">
        <div className="flex flex-col gap-2" role="group" aria-label="Como o lead chegou">
          {CHEGADAS.map((x, k) => (
            <button key={x.como} onClick={() => setI(k)} aria-pressed={k === i} className="text-left rounded-xl px-3.5 py-2.5"
              style={{ background: k === i ? 'var(--bg-surface)' : 'transparent', border: `1px solid ${k === i ? 'var(--border-control)' : 'var(--border)'}` }}>
              <span className="block text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{x.como}</span>
              <span className="block text-xs" style={{ color: 'var(--text-secondary)' }}>&quot;{x.msg}&quot;</span>
            </button>
          ))}
        </div>
        <div className="ui-inset p-5 min-h-[220px] flex flex-col gap-3 justify-center">
          {!c ? <span className="text-sm text-center" style={{ color: 'var(--text-secondary)' }}>O card do lead aparece aqui.</span> : (
            <div key={i} className="flex flex-col gap-3">
              <CardMini nome="Novo contato" linha="Em Novos contatos" espera="verde" destaque>
                <span className="ui-inset px-2.5 py-2 text-sm" style={{ color: 'var(--text-secondary)' }}>&quot;{c.msg}&quot;</span>
                <Selo forte={c.origem !== 'WHATSAPP'}>{c.origem}</Selo>
              </CardMini>
              <span className="ajuda-entra text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{c.detalhe}</span>
            </div>
          )}
        </div>
      </div>
    </Moldura>
  );
}

// ─── 10. Vendas e CRM no dashboard: a cadeia do funil ─────────────────────────

const CADEIA = [
  { nome: 'Contatos', conta: 'Todo mundo que chegou no período.', v: 120 },
  { nome: 'Leads', conta: 'Contatos aceitos na triagem (descartados não contam).', v: 84 },
  { nome: 'Oportunidades', conta: 'Leads com venda aberta.', v: 31 },
  { nome: 'Vendas', conta: 'Vendas ganhas que fecharam no período.', v: 9 },
];

function DemoCadeia() {
  const [i, setI] = useState(0);
  const max = CADEIA[0]!.v;
  return (
    <Moldura tela="Dashboard › Vendas e CRM" dica="Clique numa etapa" onRecomecar={() => setI(0)}>
      <div className="flex flex-col gap-2.5">
        {CADEIA.map((e, k) => {
          const taxa = k > 0 ? Math.round((e.v / CADEIA[k - 1]!.v) * 100) : null;
          return (
            <button key={e.nome} onClick={() => setI(k)} aria-pressed={k === i} className="text-left rounded-xl p-3 flex flex-col gap-2"
              style={{ background: k === i ? 'var(--bg-surface)' : 'transparent', border: `1px solid ${k === i ? 'var(--border-control)' : 'var(--border)'}` }}>
              <span className="flex items-center gap-3">
                <span className="text-sm font-bold w-32" style={{ color: 'var(--text-primary)' }}>{e.nome}</span>
                <span className="flex-1 ui-bar"><span className="block h-full rounded-full" style={{ width: `${(e.v / max) * 100}%`, background: 'var(--accent-fill)', transition: 'width .5s ease' }} /></span>
                <span className="ui-big !text-lg w-12 text-right">{e.v}</span>
                <span className="text-xs w-24 text-right" style={{ color: 'var(--text-secondary)' }}>{taxa === null ? '' : `${taxa}% da anterior`}</span>
              </span>
              {k === i && <span className="ajuda-entra text-sm" style={{ color: 'var(--text-secondary)' }}>{e.conta}</span>}
            </button>
          );
        })}
      </div>
      <p className="text-xs mt-3" style={{ color: 'var(--text-secondary)' }}>Números de exemplo, só para mostrar como a cadeia se lê.</p>
    </Moldura>
  );
}

// ─── Registro: id do artigo → demonstração ───────────────────────────────────

export const DEMOS: Record<string, () => ReactNode> = {
  'crm-whatsapp': DemoWhatsapp,
  'crm-novos-contatos': DemoTriagem,
  'crm-funil': DemoFunilCompleto,
  'crm-conversa': DemoConversa,
  'crm-vendas': DemoVendas,
  'crm-tarefas': DemoTarefas,
  'crm-disparos': DemoDisparos,
  'crm-automacoes': DemoAutomacoes,
  'crm-rastreio': DemoRastreio,
  'dashboard-vendas': DemoCadeia,
};
