'use client';

// Central de ajuda (10/11/2026; visual novo 11/11/2026): tudo o que a plataforma faz,
// para quem quer configurar sozinho. Substitui o /manual-crm.html (estático, só do CRM).
//
// Duas telas: o INÍCIO (busca, "Seu primeiro dia", suporte, assuntos) e o ARTIGO
// (aberto por #id na URL — link de outra tela ou compartilhado).
//
// Plano CRM vê só o que é do CRM: artigo/bloco com `soGrowth` some inteiro,
// inclusive da busca. A regra do plano é a do menu (`usePlano`).

import { Fragment, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePlano } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { apiService } from '@/lib/api';
import { ARTIGOS, MODULOS, type Artigo, type Bloco, type Modulo } from './artigos';

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// `**negrito**` é o único marcador do conteúdo.
function Texto({ children }: { children: string }) {
  const partes = children.split(/\*\*(.+?)\*\*/g);
  return <>{partes.map((p, i) => (i % 2 === 1 ? <strong key={i} style={{ color: 'var(--text-primary)' }}>{p}</strong> : <Fragment key={i}>{p}</Fragment>))}</>;
}

// Só o que a pessoa vê entra na busca: bloco do plano completo não pode ser achado no plano CRM.
function textoDoArtigo(a: Artigo, temGrowth: boolean): string {
  const blocos = a.blocos.filter((b) => temGrowth || !b.soGrowth).map((b) => {
    if (b.tipo === 'texto' || b.tipo === 'dica' || b.tipo === 'atencao') return `${b.titulo ?? ''} ${b.texto}`;
    if (b.tipo === 'tabela') return `${b.titulo ?? ''} ${b.colunas.join(' ')} ${b.linhas.flat().join(' ')}`;
    return `${b.titulo ?? ''} ${b.itens.join(' ')}`;
  });
  return norm([a.titulo, a.resumo, ...(a.termos ?? []), ...blocos].join(' ').replace(/\*\*/g, ''));
}

// Passos marcados ficam só neste navegador: é conveniência, não progresso oficial.
// A mesma chave vale no artigo e no "Seu primeiro dia" do início — marcar num marca no outro.
const CHAVE_FEITOS = 'ajuda_passos_feitos';
function lerFeitos(): Record<string, boolean> {
  try { return JSON.parse(localStorage.getItem(CHAVE_FEITOS) ?? '{}') as Record<string, boolean>; } catch { return {}; }
}
function gravarFeitos(v: Record<string, boolean>) {
  try { localStorage.setItem(CHAVE_FEITOS, JSON.stringify(v)); } catch { /* navegador sem armazenamento: só não lembra */ }
}
function useFeitos() {
  const [feitos, setFeitos] = useState<Record<string, boolean>>(() => (typeof window === 'undefined' ? {} : lerFeitos()));
  const marcar = (k: string) => setFeitos((p) => {
    const n = { ...p, [k]: !p[k] };
    if (!n[k]) delete n[k];
    gravarFeitos(n);
    return n;
  });
  return { feitos, marcar };
}

function BolinhaPasso({ n, feito, onClick, rotulo }: { n: number; feito: boolean; onClick: () => void; rotulo: string }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={feito}
      aria-label={feito ? `${rotulo} feito — desmarcar` : `Marcar ${rotulo.toLowerCase()} como feito`}
      className="mt-0.5 h-6 w-6 shrink-0 rounded-full text-xs font-bold flex items-center justify-center transition-colors"
      style={feito
        ? { backgroundColor: 'var(--accent-fill)', color: 'var(--on-accent)' }
        : { backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-md)' }}
    >
      {feito ? '✓' : n}
    </button>
  );
}

function BlocoView({ bloco, chave, feitos, onFeito }: {
  bloco: Bloco;
  chave: string;
  feitos: Record<string, boolean>;
  onFeito: (k: string) => void;
}) {
  const titulo = 'titulo' in bloco && bloco.titulo
    ? <h3 className="text-base font-bold mb-3" style={{ color: 'var(--text-primary)' }}>{bloco.titulo}</h3>
    : null;

  if (bloco.tipo === 'texto') {
    return <p className="text-[15px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}><Texto>{bloco.texto}</Texto></p>;
  }
  if (bloco.tipo === 'dica' || bloco.tipo === 'atencao') {
    const atencao = bloco.tipo === 'atencao';
    return (
      <div className="rounded-2xl px-4 py-3.5 flex gap-3" style={atencao
        ? { backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }
        : { backgroundColor: 'var(--tint-bg)' }}>
        <span className="eyebrow shrink-0 pt-0.5" style={{ color: atencao ? 'var(--badge-warn-text)' : 'var(--tint-ink)' }}>
          {(bloco.titulo ?? (atencao ? 'Atenção' : 'Dica')).toUpperCase()}
        </span>
        <p className="text-[15px] leading-relaxed" style={{ color: atencao ? 'var(--text-secondary)' : 'var(--tint-ink)' }}><Texto>{bloco.texto}</Texto></p>
      </div>
    );
  }
  if (bloco.tipo === 'passos') {
    return (
      <div>
        {titulo}
        <ol className="space-y-2.5">
          {bloco.itens.map((item, i) => {
            const k = `${chave}:${i}`;
            const feito = !!feitos[k];
            return (
              <li key={k} className="flex items-start gap-3">
                <BolinhaPasso n={i + 1} feito={feito} onClick={() => onFeito(k)} rotulo={`Passo ${i + 1}`} />
                <span className="text-[15px] leading-relaxed" style={{ color: feito ? 'var(--text-secondary)' : 'var(--text-primary)', textDecoration: feito ? 'line-through' : 'none' }}>
                  <Texto>{item}</Texto>
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    );
  }
  if (bloco.tipo === 'lista') {
    return (
      <div>
        {titulo}
        <ul className="space-y-2">
          {bloco.itens.map((item, i) => (
            <li key={i} className="flex items-start gap-2.5 text-[15px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              <span aria-hidden className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: 'var(--accent)' }} />
              <span><Texto>{item}</Texto></span>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  return (
    <div>
      {titulo}
      <div className="overflow-x-auto ui-inset">
        <table className="w-full text-sm">
          <thead>
            <tr>
              {bloco.colunas.map((c) => (
                <th key={c} className="text-left text-xs font-semibold px-3 py-2" style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border)' }}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bloco.linhas.map((linha, i) => (
              <tr key={i}>
                {linha.map((cel, j) => (
                  <td key={j} className="px-3 py-2 align-top leading-relaxed"
                    style={{ color: j === 0 ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: j === 0 ? 600 : 400, borderTop: i ? '1px solid var(--border)' : 'none', minWidth: j === 0 ? 130 : 160 }}>
                    <Texto>{cel}</Texto>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// "Este artigo ajudou?" — o voto é da pessoa e pode ser trocado. "Não" pede o que faltou.
function FeedbackArtigo({ artigoId }: { artigoId: string }) {
  const [voto, setVoto] = useState<boolean | null>(null);
  const [carregado, setCarregado] = useState(false);
  const [comentario, setComentario] = useState('');
  const [comentarioEnviado, setComentarioEnviado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    let vivo = true;
    apiService.getHelpFeedback(artigoId)
      .then((r) => {
        if (!vivo) return;
        setVoto(r.data?.helpful ?? null);
        setComentario(r.data?.comment ?? '');
        setComentarioEnviado(!!r.data?.comment);
      })
      .catch(() => { /* sem o voto anterior a pessoa ainda pode votar; o erro aparece se o envio falhar */ })
      .finally(() => { if (vivo) setCarregado(true); });
    return () => { vivo = false; };
  }, [artigoId]);

  const enviar = async (helpful: boolean, texto?: string) => {
    setEnviando(true);
    setErro('');
    try {
      const r = await apiService.putHelpFeedback(artigoId, helpful, texto);
      setVoto(r.data.helpful);
      if (helpful) { setComentario(''); setComentarioEnviado(false); }
      if (texto !== undefined) setComentarioEnviado(!!r.data.comment);
    } catch {
      setErro('Não deu para registrar agora. Tente de novo em instantes.');
    } finally {
      setEnviando(false);
    }
  };

  const botao = (helpful: boolean, rotulo: string) => {
    const ativo = voto === helpful;
    return (
      <button
        onClick={() => enviar(helpful)}
        disabled={enviando || !carregado}
        aria-pressed={ativo}
        className={`ui-btn ui-btn-sm ${ativo ? 'ui-btn-primary' : 'ui-btn-secondary'}`}
      >
        {rotulo}
      </button>
    );
  };

  return (
    <section aria-label="Avaliar este artigo" className="pt-6 space-y-3" style={{ borderTop: '1px solid var(--border)' }}>
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Este artigo ajudou?</span>
        <div className="flex gap-2">
          {botao(true, 'Sim')}
          {botao(false, 'Não')}
        </div>
        {voto === true && <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Obrigado! Isso mostra o que está funcionando.</span>}
      </div>
      {voto === false && (
        comentarioEnviado ? (
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Obrigado. A gente lê cada resposta para melhorar o artigo.{' '}
            <button onClick={() => setComentarioEnviado(false)} className="font-semibold underline" style={{ color: 'var(--text-primary)' }}>Editar</button>
          </p>
        ) : (
          <div className="space-y-2 max-w-xl">
            <label htmlFor={`fb-${artigoId}`} className="text-sm" style={{ color: 'var(--text-secondary)' }}>O que faltou? (opcional)</label>
            <textarea
              id={`fb-${artigoId}`}
              value={comentario}
              onChange={(e) => setComentario(e.target.value.slice(0, 1000))}
              rows={3}
              placeholder="Ex.: não encontrei o botão, o passo 2 não bate com a minha tela"
              className="w-full rounded-xl px-3 py-2.5 text-sm"
              style={{ backgroundColor: 'var(--input-bg)', border: '1px solid var(--input-border)', color: 'var(--text-primary)' }}
            />
            <button onClick={() => enviar(false, comentario)} disabled={enviando || !comentario.trim()} className="ui-btn ui-btn-secondary ui-btn-sm">
              Enviar
            </button>
          </div>
        )
      )}
      {erro && <p role="alert" className="text-sm" style={{ color: 'var(--badge-error-text)' }}>{erro}</p>}
    </section>
  );
}

function ArtigoView({ artigo, temGrowth, ehGestor, anterior, proximo, doModulo, onAbrir, onVoltar }: {
  artigo: Artigo;
  temGrowth: boolean;
  ehGestor: boolean;
  anterior: Artigo | null;
  proximo: Artigo | null;
  doModulo: Artigo[];
  onAbrir: (id: string) => void;
  onVoltar: () => void;
}) {
  const { feitos, marcar } = useFeitos();
  const modulo = MODULOS.find((m) => m.key === artigo.modulo)!.label;
  const blocos = artigo.blocos.filter((b) => temGrowth || !b.soGrowth);

  return (
    <div className="grid gap-8 lg:grid-cols-[240px_1fr] items-start">
      <nav aria-label={`Artigos de ${modulo}`} className="hidden lg:block lg:sticky lg:top-4 space-y-3">
        <button onClick={onVoltar} className="ui-btn ui-btn-secondary ui-btn-sm">Central de ajuda</button>
        <p className="eyebrow pt-2" style={{ color: 'var(--text-secondary)' }}>{modulo.toUpperCase()}</p>
        <ul className="space-y-0.5">
          {doModulo.map((a) => {
            const ativo = a.id === artigo.id;
            return (
              <li key={a.id}>
                <button
                  onClick={() => onAbrir(a.id)}
                  aria-current={ativo ? 'page' : undefined}
                  className="w-full text-left rounded-lg px-2.5 py-1.5 text-sm transition-colors"
                  style={ativo
                    ? { backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)', fontWeight: 700, boxShadow: 'inset 0 0 0 1px var(--border-md)' }
                    : { color: 'var(--text-secondary)' }}
                >
                  {a.titulo}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <article className="min-w-0 max-w-3xl space-y-6">
        <button onClick={onVoltar} className="lg:hidden ui-btn ui-btn-secondary ui-btn-sm">Central de ajuda</button>
        <header className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="eyebrow">{modulo.toUpperCase()}</span>
            {artigo.soGestor && <span className="ui-chip">GESTOR</span>}
          </div>
          <h1 className="font-extrabold tracking-tight text-[clamp(30px,4vw,44px)] leading-[1.05]" style={{ color: 'var(--text-primary)', textWrap: 'balance' }}>{artigo.titulo}</h1>
          <p className="text-[17px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{artigo.resumo}</p>
        </header>

        {artigo.soGestor && !ehGestor && (
          <p className="text-sm ui-inset px-3 py-2" style={{ color: 'var(--text-secondary)' }}>
            Isto é feito pelo gestor da empresa. Se precisar, peça para ele.
          </p>
        )}

        {blocos.map((b, i) => (
          <BlocoView key={i} bloco={b} chave={`${artigo.id}:${artigo.blocos.indexOf(b)}`} feitos={feitos} onFeito={marcar} />
        ))}

        {artigo.tela && (
          <div>
            <Link href={artigo.tela.href} className="ui-btn ui-btn-primary">Abrir {artigo.tela.nome}</Link>
          </div>
        )}

        <FeedbackArtigo artigoId={artigo.id} />

        {(anterior || proximo) && (
          <nav className="grid gap-3 sm:grid-cols-2" aria-label="Outros artigos">
            {anterior ? (
              <button onClick={() => onAbrir(anterior.id)} className="ui-card !p-4 text-left">
                <span className="block text-xs" style={{ color: 'var(--text-secondary)' }}>Anterior</span>
                <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{anterior.titulo}</span>
              </button>
            ) : <span />}
            {proximo && (
              <button onClick={() => onAbrir(proximo.id)} className="ui-card !p-4 text-left sm:text-right">
                <span className="block text-xs" style={{ color: 'var(--text-secondary)' }}>Próximo</span>
                <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{proximo.titulo}</span>
              </button>
            )}
          </nav>
        )}
      </article>
    </div>
  );
}

// "Seu primeiro dia": os passos do artigo Primeiros passos (mesmas chaves de marcação).
function PrimeiroDia({ artigo, temGrowth, onAbrir }: { artigo: Artigo; temGrowth: boolean; onAbrir: (id: string) => void }) {
  const { feitos, marcar } = useFeitos();
  const passos = artigo.blocos.flatMap((b, bi) =>
    b.tipo === 'passos' && (temGrowth || !b.soGrowth) ? b.itens.map((item, i) => ({ k: `${artigo.id}:${bi}:${i}`, item })) : []);
  const feitosN = passos.filter((p) => feitos[p.k]).length;
  const pct = passos.length ? Math.round((feitosN / passos.length) * 100) : 0;

  return (
    <section className="ui-card ui-card-hl !p-6 sm:!p-8 space-y-5" aria-labelledby="primeiro-dia">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">SEU PRIMEIRO DIA</p>
          <h2 id="primeiro-dia" className="text-2xl font-extrabold mt-1.5" style={{ color: 'var(--text-primary)' }}>Deixe a plataforma trabalhando por você</h2>
        </div>
        <p className="ui-big">{feitosN} <span className="text-base font-semibold" style={{ color: 'var(--text-secondary)' }}>de {passos.length}</span></p>
      </div>
      <div className="ui-bar" role="progressbar" aria-label="Passos do primeiro dia" aria-valuemin={0} aria-valuemax={passos.length} aria-valuenow={feitosN}>
        <div style={{ width: `${pct}%`, height: '100%', background: 'var(--accent-fill)', borderRadius: 999, transition: 'width .5s ease' }} />
      </div>
      <ol className="space-y-2">
        {passos.map((p, i) => {
          const feito = !!feitos[p.k];
          return (
            <li key={p.k} className="ui-inset flex items-start gap-3 px-4 py-3">
              <BolinhaPasso n={i + 1} feito={feito} onClick={() => marcar(p.k)} rotulo={`Passo ${i + 1}`} />
              <span className="text-[15px] leading-relaxed" style={{ color: feito ? 'var(--text-secondary)' : 'var(--text-primary)', textDecoration: feito ? 'line-through' : 'none' }}>
                <Texto>{p.item}</Texto>
              </span>
            </li>
          );
        })}
      </ol>
      <button onClick={() => onAbrir(artigo.id)} className="ui-btn ui-btn-secondary ui-btn-sm">Ler o artigo completo</button>
    </section>
  );
}

// Suporte: o card fica no lugar, mas desligado até o atendimento existir (decisão de 11/11/2026).
function SuporteCard() {
  return (
    <section className="ui-card !p-6 flex flex-col gap-3" aria-labelledby="suporte">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="eyebrow" style={{ color: 'var(--text-secondary)' }}>AINDA PRECISA DE GENTE?</p>
        <span className="ui-chip" style={{ color: 'var(--badge-warn-text)', boxShadow: 'inset 0 0 0 1px var(--badge-warn-text)' }}>EM MANUTENÇÃO</span>
      </div>
      <h2 id="suporte" className="text-lg font-bold" style={{ color: 'var(--text-secondary)' }}>Fale com o suporte pelo WhatsApp</h2>
      <p className="text-[15px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        O atendimento por aqui volta em breve. Enquanto isso, a busca acima cobre as dúvidas mais comuns.
      </p>
      <div className="flex-1" />
      <button disabled aria-disabled="true" className="ui-btn ui-btn-secondary w-full" style={{ cursor: 'not-allowed', opacity: 0.6 }}>Chamar o suporte</button>
    </section>
  );
}

const SUGESTOES = ['descartar', 'whatsapp', 'venda', 'meta do mês'];

export default function AjudaPage() {
  const { temGrowth } = usePlano();
  const { user } = useAuth();
  const ehGestor = ['ADMIN', 'SUPER_ADMIN', 'TRAFFIC_MANAGER'].includes(user?.role ?? '');
  const ehSuperAdmin = user?.role === 'SUPER_ADMIN';

  const papel = user?.role ?? '';
  const visiveis = useMemo(
    // Na ordem dos assuntos: é a ordem do índice e do Anterior/Próximo.
    () => ARTIGOS
      .filter((a) => (temGrowth || !a.soGrowth) && (!a.soPapel || a.soPapel === papel || papel === 'SUPER_ADMIN'))
      .sort((x, y) => MODULOS.findIndex((m) => m.key === x.modulo) - MODULOS.findIndex((m) => m.key === y.modulo)),
    [temGrowth, papel],
  );
  const indiceBusca = useMemo(() => new Map(visiveis.map((a) => [a.id, textoDoArtigo(a, temGrowth)])), [visiveis, temGrowth]);

  const [busca, setBusca] = useState('');
  const [modulo, setModulo] = useState<Modulo | ''>('');
  const [aberto, setAberto] = useState<string | null>(null);

  // #id na URL abre o artigo; sem # fica no início.
  useEffect(() => {
    const ler = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      setAberto(id && ARTIGOS.some((a) => a.id === id) ? id : null);
    };
    ler();
    window.addEventListener('hashchange', ler);
    return () => window.removeEventListener('hashchange', ler);
  }, []);

  const termo = norm(busca.trim());
  const filtrados = visiveis.filter((a) =>
    (!modulo || a.modulo === modulo) &&
    // Cada palavra buscada casa pelo COMEÇO de uma palavra do texto: "ia" acha "IA", não "dia".
    (!termo || termo.split(/\s+/).every((t) => ` ${indiceBusca.get(a.id)!}`.replace(/[^a-z0-9]+/g, ' ').includes(` ${t.replace(/[^a-z0-9]+/g, ' ').trim()}`))));

  // Artigo do plano completo aberto por link num plano CRM: volta para o início.
  const atual = aberto ? visiveis.find((a) => a.id === aberto) ?? null : null;
  const posicao = atual ? visiveis.indexOf(atual) : -1;

  const abrir = (id: string) => {
    setAberto(id);
    history.pushState(null, '', `#${id}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const voltar = () => {
    setAberto(null);
    history.pushState(null, '', window.location.pathname + window.location.search);
    window.scrollTo({ top: 0 });
  };

  if (atual) {
    return (
      <div className="max-w-6xl">
        <ArtigoView
          key={atual.id}
          artigo={atual}
          temGrowth={temGrowth}
          ehGestor={ehGestor}
          anterior={posicao > 0 ? visiveis[posicao - 1]! : null}
          proximo={posicao >= 0 && posicao < visiveis.length - 1 ? visiveis[posicao + 1]! : null}
          doModulo={visiveis.filter((a) => a.modulo === atual.modulo)}
          onAbrir={abrir}
          onVoltar={voltar}
        />
      </div>
    );
  }

  const modulosComArtigo = MODULOS.filter((m) => visiveis.some((a) => a.modulo === m.key));
  const primeiros = visiveis.find((a) => a.id === 'primeiros-passos');
  const labelModulo = (k: Modulo) => MODULOS.find((m) => m.key === k)!.label.toUpperCase();

  return (
    <div className="max-w-6xl space-y-14">
      <header className="relative text-center pt-6 pb-2 flex flex-col items-center gap-4">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-24 h-80" style={{ background: 'radial-gradient(closest-side, var(--highlight), transparent)' }} />
        <p className="eyebrow relative">{visiveis.length} ARTIGOS{!temGrowth && ' · PLANO CRM'}</p>
        <h1 className="relative cromo font-extrabold tracking-tight leading-none text-[clamp(38px,6vw,64px)]" style={{ textWrap: 'balance' }}>Como podemos ajudar?</h1>
        <p className="relative max-w-xl text-[17px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          Busque pelo que você quer fazer. Cada artigo traz o passo a passo, igual à tela do app.
        </p>
        <div className="relative w-full max-w-2xl mt-2">
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Ex.: descartar lead, conectar WhatsApp, meta do mês"
            aria-label="Buscar na ajuda"
            className="w-full rounded-2xl px-5 py-4 text-base"
            style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-md)', color: 'var(--text-primary)', boxShadow: '0 30px 70px rgba(0,0,0,0.18)' }}
          />
          <div className="flex flex-wrap justify-center items-center gap-2 mt-3">
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Mais buscados:</span>
            {SUGESTOES.map((s) => (
              <button key={s} onClick={() => { setBusca(s); setModulo(''); }} className="ui-filtro">{s}</button>
            ))}
          </div>
        </div>
        {ehSuperAdmin && (
          <Link href="/dashboard/ajuda/feedback" className="relative ui-btn ui-btn-secondary ui-btn-sm">Ver o que os clientes acharam dos artigos</Link>
        )}
      </header>

      {!termo && (
        <div className="grid gap-5 lg:grid-cols-[1fr_340px] items-stretch">
          {primeiros ? <PrimeiroDia artigo={primeiros} temGrowth={temGrowth} onAbrir={abrir} /> : <span />}
          <SuporteCard />
        </div>
      )}

      <section aria-labelledby="assuntos" className="space-y-5 pb-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">TODOS OS ASSUNTOS</p>
            <h2 id="assuntos" className="font-extrabold tracking-tight text-[clamp(26px,3vw,36px)] mt-1.5" style={{ color: 'var(--text-primary)' }}>
              {termo ? `${filtrados.length} ${filtrados.length === 1 ? 'artigo encontrado' : 'artigos encontrados'}` : 'Escolha o assunto'}
            </h2>
          </div>
          {modulosComArtigo.length > 1 && (
            <div className="ui-seg" role="group" aria-label="Filtrar por assunto">
              <button aria-pressed={modulo === ''} onClick={() => setModulo('')}>Tudo</button>
              {modulosComArtigo.map((m) => (
                <button key={m.key} aria-pressed={modulo === m.key} onClick={() => setModulo(m.key)}>{m.label}</button>
              ))}
            </div>
          )}
        </div>

        {filtrados.length === 0 ? (
          <div className="rounded-2xl p-10 text-center space-y-3" style={{ border: '1px dashed var(--border-control)' }}>
            <p className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Nada encontrado para &quot;{busca.trim()}&quot;</p>
            <p className="text-[15px]" style={{ color: 'var(--text-secondary)' }}>Tente outra palavra ou outro assunto.</p>
            <button onClick={() => { setBusca(''); setModulo(''); }} className="ui-btn ui-btn-secondary ui-btn-sm">Limpar busca</button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtrados.map((a) => (
              <button key={a.id} onClick={() => abrir(a.id)} className="ui-card text-left flex flex-col gap-2.5 transition-transform hover:-translate-y-0.5">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="eyebrow" style={{ color: 'var(--text-secondary)' }}>{labelModulo(a.modulo)}</span>
                  {a.soGestor && <span className="ui-chip">GESTOR</span>}
                </span>
                <span className="text-lg font-bold leading-snug" style={{ color: 'var(--text-primary)' }}>{a.titulo}</span>
                <span className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{a.resumo}</span>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
