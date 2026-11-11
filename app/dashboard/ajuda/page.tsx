'use client';

// Central de ajuda (10/11/2026): tudo o que a plataforma faz, para quem quer
// configurar sozinho. Substitui o /manual-crm.html (estático, só do CRM).
//
// Plano CRM vê só o que é do CRM: artigo/bloco com `soGrowth` some inteiro,
// inclusive da busca. A regra do plano é a do menu (`usePlano`).

import { Fragment, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePlano } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
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
const CHAVE_FEITOS = 'ajuda_passos_feitos';
function lerFeitos(): Record<string, boolean> {
  try { return JSON.parse(localStorage.getItem(CHAVE_FEITOS) ?? '{}') as Record<string, boolean>; } catch { return {}; }
}
function gravarFeitos(v: Record<string, boolean>) {
  try { localStorage.setItem(CHAVE_FEITOS, JSON.stringify(v)); } catch { /* navegador sem armazenamento: só não lembra */ }
}

function BlocoView({ bloco, chave, feitos, onFeito }: {
  bloco: Bloco;
  chave: string;
  feitos: Record<string, boolean>;
  onFeito: (k: string) => void;
}) {
  const titulo = 'titulo' in bloco && bloco.titulo
    ? <h3 className="text-sm font-bold mb-2" style={{ color: 'var(--text-primary)' }}>{bloco.titulo}</h3>
    : null;

  if (bloco.tipo === 'texto') {
    return <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}><Texto>{bloco.texto}</Texto></p>;
  }
  if (bloco.tipo === 'dica' || bloco.tipo === 'atencao') {
    const atencao = bloco.tipo === 'atencao';
    return (
      <div className="ui-inset px-4 py-3" style={{ borderLeft: `3px solid ${atencao ? 'var(--warn-mark)' : 'var(--accent)'}` }}>
        <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: atencao ? 'var(--badge-warn-text)' : 'var(--accent)' }}>
          {bloco.titulo ?? (atencao ? 'Atenção' : 'Dica')}
        </p>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}><Texto>{bloco.texto}</Texto></p>
      </div>
    );
  }
  if (bloco.tipo === 'passos') {
    return (
      <div>
        {titulo}
        <ol className="space-y-2">
          {bloco.itens.map((item, i) => {
            const k = `${chave}:${i}`;
            const feito = !!feitos[k];
            return (
              <li key={k} className="flex items-start gap-3">
                <button
                  onClick={() => onFeito(k)}
                  aria-pressed={feito}
                  aria-label={feito ? `Passo ${i + 1} feito — desmarcar` : `Marcar passo ${i + 1} como feito`}
                  className="mt-0.5 h-6 w-6 shrink-0 rounded-full text-xs font-bold flex items-center justify-center transition-colors"
                  style={feito
                    ? { backgroundColor: 'var(--accent-fill)', color: 'var(--on-accent)' }
                    : { backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-md)' }}
                >
                  {feito ? '✓' : i + 1}
                </button>
                <span className="text-sm leading-relaxed" style={{ color: feito ? 'var(--text-secondary)' : 'var(--text-primary)', textDecoration: feito ? 'line-through' : 'none' }}>
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
            <li key={i} className="flex items-start gap-2.5 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: 'var(--accent)' }} />
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

function ArtigoView({ artigo, temGrowth, ehGestor, anterior, proximo, onAbrir, onVoltar }: {
  artigo: Artigo;
  temGrowth: boolean;
  ehGestor: boolean;
  anterior: Artigo | null;
  proximo: Artigo | null;
  onAbrir: (id: string) => void;
  onVoltar: () => void;
}) {
  // A tela só monta depois do login (no navegador), então ler o armazenamento aqui é seguro.
  const [feitos, setFeitos] = useState<Record<string, boolean>>(() => (typeof window === 'undefined' ? {} : lerFeitos()));
  const marcar = (k: string) => setFeitos((p) => {
    const n = { ...p, [k]: !p[k] };
    if (!n[k]) delete n[k];
    gravarFeitos(n);
    return n;
  });
  const modulo = MODULOS.find((m) => m.key === artigo.modulo)!.label;
  const blocos = artigo.blocos.filter((b) => temGrowth || !b.soGrowth);

  return (
    <article className="ui-card space-y-5">
      <button onClick={onVoltar} className="lg:hidden text-sm font-semibold" style={{ color: 'var(--text-secondary)' }}>← Voltar ao índice</button>
      <header>
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <span className="ui-badge ui-badge-tint">{modulo.toUpperCase()}</span>
          {artigo.soGestor && !ehGestor && <span className="ui-badge ui-badge-tint">SÓ GESTOR</span>}
        </div>
        <h2 className="text-xl font-bold tracking-tight" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display), system-ui, sans-serif' }}>{artigo.titulo}</h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{artigo.resumo}</p>
      </header>

      {artigo.soGestor && !ehGestor && (
        <p className="text-xs ui-inset px-3 py-2" style={{ color: 'var(--text-secondary)' }}>
          Isto é feito pelo gestor da empresa. Se precisar, peça para ele.
        </p>
      )}

      {blocos.map((b, i) => (
        <BlocoView key={i} bloco={b} chave={`${artigo.id}:${i}`} feitos={feitos} onFeito={marcar} />
      ))}

      {artigo.tela && (
        <div>
          <Link href={artigo.tela.href} className="ui-btn ui-btn-secondary ui-btn-sm">Abrir {artigo.tela.nome}</Link>
        </div>
      )}

      {(anterior || proximo) && (
        <nav className="flex flex-wrap gap-2 justify-between pt-4" style={{ borderTop: '1px solid var(--border)' }} aria-label="Outros artigos">
          {anterior ? (
            <button onClick={() => onAbrir(anterior.id)} className="text-left text-sm" style={{ color: 'var(--text-secondary)' }}>
              <span className="block text-xs">Anterior</span>
              <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{anterior.titulo}</span>
            </button>
          ) : <span />}
          {proximo && (
            <button onClick={() => onAbrir(proximo.id)} className="text-right text-sm" style={{ color: 'var(--text-secondary)' }}>
              <span className="block text-xs">Próximo</span>
              <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{proximo.titulo}</span>
            </button>
          )}
        </nav>
      )}
    </article>
  );
}

export default function AjudaPage() {
  const { temGrowth } = usePlano();
  const { user } = useAuth();
  const ehGestor = ['ADMIN', 'SUPER_ADMIN', 'TRAFFIC_MANAGER'].includes(user?.role ?? '');

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
  // Celular: índice e artigo não cabem lado a lado; abre um de cada vez.
  const [verArtigoNoCelular, setVerArtigoNoCelular] = useState(false);

  // #id na URL abre o artigo (link de outra tela ou compartilhado).
  useEffect(() => {
    const ler = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (id && ARTIGOS.some((a) => a.id === id)) { setAberto(id); setVerArtigoNoCelular(true); }
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

  // Artigo do plano completo aberto por link num plano CRM: cai no primeiro visível.
  const atual = visiveis.find((a) => a.id === aberto) ?? filtrados[0] ?? visiveis[0] ?? null;
  const posicao = atual ? visiveis.indexOf(atual) : -1;

  const abrir = (id: string) => {
    setAberto(id);
    setVerArtigoNoCelular(true);
    history.replaceState(null, '', `#${id}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const modulosComArtigo = MODULOS.filter((m) => visiveis.some((a) => a.modulo === m.key));

  return (
    <div className="max-w-6xl">
      <header className="mb-5">
        <h1 className="ui-h1">Central de ajuda</h1>
        <p className="ui-sub">
          Tudo o que a plataforma faz, com passo a passo para configurar sozinho.
          {!temGrowth && ' Aqui aparece só o que faz parte do plano CRM.'}
        </p>
      </header>

      <div className="flex flex-col gap-3 mb-5">
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar: ex. conectar WhatsApp, descartar lead, disparo"
          aria-label="Buscar na ajuda"
          className="w-full rounded-xl px-4 py-3 text-sm"
          style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-md)', color: 'var(--text-primary)' }}
        />
        {modulosComArtigo.length > 1 && (
          <div className="ui-seg self-start" role="group" aria-label="Filtrar por assunto">
            <button aria-pressed={modulo === ''} onClick={() => setModulo('')}>Tudo</button>
            {modulosComArtigo.map((m) => (
              <button key={m.key} aria-pressed={modulo === m.key} onClick={() => setModulo(m.key)}>{m.label}</button>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-[280px_1fr] items-start">
        <nav aria-label="Índice da ajuda" className={`ui-card !p-3 lg:sticky lg:top-4 ${verArtigoNoCelular ? 'hidden lg:block' : ''}`}>
          {filtrados.length === 0 ? (
            <p className="text-sm px-2 py-3" style={{ color: 'var(--text-secondary)' }}>
              Nada encontrado para &quot;{busca.trim()}&quot;. Tente outra palavra.
            </p>
          ) : (
            modulosComArtigo.map((m) => {
              const doModulo = filtrados.filter((a) => a.modulo === m.key);
              if (doModulo.length === 0) return null;
              return (
                <div key={m.key} className="mb-3 last:mb-0">
                  <p className="text-[11px] font-bold uppercase tracking-wide px-2 mb-1" style={{ color: 'var(--text-secondary)' }}>{m.label}</p>
                  <ul>
                    {doModulo.map((a) => {
                      const ativo = atual?.id === a.id;
                      return (
                        <li key={a.id}>
                          <button
                            onClick={() => abrir(a.id)}
                            aria-current={ativo ? 'page' : undefined}
                            className="w-full text-left rounded-lg px-2 py-1.5 text-sm transition-colors"
                            style={ativo
                              ? { backgroundColor: 'var(--accent-fill)', color: 'var(--on-accent)', fontWeight: 700 }
                              : { color: 'var(--text-primary)' }}
                          >
                            {a.titulo}
                            {termo && <span className="block text-xs font-normal" style={{ color: ativo ? 'var(--on-accent)' : 'var(--text-secondary)' }}>{a.resumo}</span>}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })
          )}
        </nav>

        <div className={verArtigoNoCelular ? '' : 'hidden lg:block'}>
          {atual && (
            <ArtigoView
              key={atual.id}
              artigo={atual}
              temGrowth={temGrowth}
              ehGestor={ehGestor}
              anterior={posicao > 0 ? visiveis[posicao - 1]! : null}
              proximo={posicao >= 0 && posicao < visiveis.length - 1 ? visiveis[posicao + 1]! : null}
              onAbrir={abrir}
              onVoltar={() => setVerArtigoNoCelular(false)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
