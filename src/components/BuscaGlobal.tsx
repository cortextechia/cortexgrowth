'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { IconeCadeado } from '@/components/RecursoBloqueado';

// Busca do menu (pedido do Ruan, 28/10/2026, inspirada no Datacrazy): digita o que quer
// ver e vai direto para a tela — inclusive para a seção que mora dentro de uma aba.
// Só navegação: não busca contato nem dado. A lista vem pronta do layout, já filtrada
// pelo que o usuário enxerga no menu.

export interface DestinoBusca {
  titulo: string;
  caminho?: string;     // onde fica ("Dashboard", "CRM"), mostrado ao lado
  href: string;
  termos?: string[];    // o que existe lá dentro (seções, métricas)
  bloqueado?: boolean;  // cadeado do plano CRM: aparece, mas avisa
}

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

interface Resultado { destino: DestinoBusca; termo?: string; peso: number }

function buscar(destinos: DestinoBusca[], consulta: string): Resultado[] {
  const palavras = norm(consulta).split(/\s+/).filter(Boolean);
  if (palavras.length === 0) return destinos.slice(0, 8).map((destino) => ({ destino, peso: 0 }));
  // Folga no fim da palavra: "automacao" acha "Automações" e "relatorio" acha "Relatórios"
  // (singular × plural muda as últimas letras). Basta o começo bater, menos 2 letras.
  const casaPalavra = (p: string, texto: string) => {
    if (texto.includes(p)) return true;
    if (p.length < 6) return false;
    const raiz = p.slice(0, p.length - 2);
    return texto.split(/[^a-z0-9]+/).some((w) => w.startsWith(raiz));
  };
  const casa = (texto: string) => { const t = norm(texto); return palavras.every((p) => casaPalavra(p, t)); };
  const out: Resultado[] = [];
  for (const destino of destinos) {
    const titulo = norm(destino.titulo);
    if (casa(`${destino.titulo} ${destino.caminho ?? ''}`)) {
      out.push({ destino, peso: titulo.startsWith(palavras[0]!) ? 3 : 2 });
      continue;
    }
    // Achou pelo que está DENTRO da tela: mostra o termo, senão o usuário não entende
    // por que "ranking" levou para "Vendas e CRM".
    const termo = destino.termos?.find(casa);
    if (termo) out.push({ destino, termo, peso: 1 });
  }
  return out.sort((a, b) => b.peso - a.peso).slice(0, 8);
}

export function BuscaGlobal({ destinos }: { destinos: DestinoBusca[] }) {
  const router = useRouter();
  const [aberta, setAberta] = useState(false);
  const [consulta, setConsulta] = useState('');
  const [sel, setSel] = useState(0);

  // Abre sempre limpa: a busca anterior não serve para a próxima.
  const abrir = () => { setConsulta(''); setSel(0); setAberta(true); };

  // Ctrl+K / Cmd+K abre (e fecha) de qualquer tela.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (aberta) setAberta(false); else abrir();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [aberta]);

  const resultados = useMemo(() => buscar(destinos, consulta), [destinos, consulta]);

  const ir = (r: Resultado | undefined) => {
    if (!r) return;
    setAberta(false);
    router.push(r.destino.href);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { setAberta(false); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, resultados.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
    if (e.key === 'Enter') { e.preventDefault(); ir(resultados[sel]); }
  };

  return (
    <>
      <button
        onClick={abrir}
        className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm shrink-0"
        style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-md)', color: 'var(--text-secondary)' }}
        aria-label="Buscar no sistema"
      >
        <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
        </svg>
        <span className="hidden sm:inline">Buscar</span>
        <kbd className="hidden lg:inline text-[11px] font-semibold rounded px-1.5 py-0.5"
          style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-md)', color: 'var(--text-secondary)' }}>
          Ctrl K
        </kbd>
      </button>

      {aberta && createPortal(
        <div className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[12vh]"
          style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) setAberta(false); }}>
          <div role="dialog" aria-label="Buscar no sistema"
            className="w-full max-w-lg rounded-xl overflow-hidden shadow-2xl"
            style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-md)' }}>
            <div className="flex items-center gap-2 px-4" style={{ borderBottom: '1px solid var(--border)' }}>
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: 'var(--text-secondary)' }}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                autoFocus
                value={consulta}
                onChange={(e) => { setConsulta(e.target.value); setSel(0); }}
                onKeyDown={onKeyDown}
                placeholder="O que você quer ver? Ex.: ranking, campanhas, disparos"
                className="flex-1 bg-transparent py-3.5 text-sm outline-none"
                style={{ color: 'var(--text-primary)' }}
                role="combobox"
                aria-expanded="true"
                aria-controls="busca-resultados"
              />
              <kbd className="text-[11px] font-semibold rounded px-1.5 py-0.5"
                style={{ border: '1px solid var(--border-md)', color: 'var(--text-secondary)' }}>Esc</kbd>
            </div>

            <ul id="busca-resultados" role="listbox" className="max-h-[50vh] overflow-y-auto py-1.5">
              {resultados.length === 0 && (
                <li className="px-4 py-6 text-sm text-center" style={{ color: 'var(--text-secondary)' }}>
                  Nada encontrado para &ldquo;{consulta}&rdquo;.
                </li>
              )}
              {resultados.map((r, i) => (
                <li key={r.destino.href + r.destino.titulo} role="option" aria-selected={i === sel}>
                  <button
                    onMouseEnter={() => setSel(i)}
                    onClick={() => ir(r)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left"
                    style={{ backgroundColor: i === sel ? 'var(--bg-elevated)' : 'transparent' }}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                        {r.destino.titulo}
                        {r.destino.caminho && (
                          <span className="font-normal" style={{ color: 'var(--text-secondary)' }}> · {r.destino.caminho}</span>
                        )}
                      </p>
                      {r.termo && (
                        <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-secondary)' }}>Tem aqui: {r.termo}</p>
                      )}
                    </div>
                    {r.destino.bloqueado && (
                      <span className="flex items-center gap-1 text-xs shrink-0" style={{ color: 'var(--text-secondary)' }} title="Não faz parte do plano CRM">
                        <IconeCadeado className="h-3.5 w-3.5" />
                      </span>
                    )}
                    {i === sel && <span className="text-xs shrink-0" style={{ color: 'var(--text-secondary)' }}>Enter</span>}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
