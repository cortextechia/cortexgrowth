'use client';

// O que os clientes acharam dos artigos da Central de ajuda (11/11/2026) — só SUPER_ADMIN.
// Votos de todas as orgs; artigo com mais "não" primeiro, e os comentários mais recentes.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { apiService } from '@/lib/api';
import { ARTIGOS } from '../artigos';

type Resumo = Awaited<ReturnType<typeof apiService.getHelpFeedbackSummary>>['data'];

const tituloDe = (id: string) => ARTIGOS.find((a) => a.id === id)?.titulo ?? `${id} (artigo removido)`;
const fmtData = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

export default function AjudaFeedbackPage() {
  const { user } = useAuth();
  const [dados, setDados] = useState<Resumo | null>(null);
  const [erro, setErro] = useState('');

  const pode = user?.role === 'SUPER_ADMIN';

  useEffect(() => {
    if (!pode) return;
    apiService.getHelpFeedbackSummary()
      .then((r) => setDados(r.data))
      .catch(() => setErro('Não deu para carregar os feedbacks agora. Recarregue a página em instantes.'));
  }, [pode]);

  if (!pode) {
    return <p className="ui-sub">Esta tela é só do administrador da plataforma.</p>;
  }

  return (
    <div className="max-w-5xl space-y-6">
      <header>
        <Link href="/dashboard/ajuda" className="ui-btn ui-btn-secondary ui-btn-sm mb-4">Central de ajuda</Link>
        <h1 className="ui-h1">O que acharam dos artigos</h1>
        <p className="ui-sub">Respostas do &quot;Este artigo ajudou?&quot; de todas as empresas. Artigo com mais &quot;não&quot; aparece primeiro: é o que precisa de revisão.</p>
      </header>

      {erro && <p role="alert" className="text-sm" style={{ color: 'var(--badge-error-text)' }}>{erro}</p>}
      {!dados && !erro && <p className="ui-sub">Carregando…</p>}

      {dados && (
        <>
          <section className="ui-card !p-0 overflow-x-auto" aria-label="Votos por artigo">
            {dados.articles.length === 0 ? (
              <p className="p-5 text-sm" style={{ color: 'var(--text-secondary)' }}>Ninguém avaliou um artigo ainda.</p>
            ) : (
              <table className="ui-table">
                <thead>
                  <tr><th className="text-left px-4 py-3">Artigo</th><th className="ui-num px-4 py-3">Sim</th><th className="ui-num px-4 py-3">Não</th><th className="ui-num px-4 py-3">Ajudou</th></tr>
                </thead>
                <tbody>
                  {dados.articles.map((a) => {
                    const total = a.yes + a.no;
                    return (
                      <tr key={a.articleId} style={{ borderTop: '1px solid var(--border)' }}>
                        <td className="px-4 py-3">
                          <Link href={`/dashboard/ajuda#${a.articleId}`} className="font-semibold" style={{ color: 'var(--text-primary)' }}>{tituloDe(a.articleId)}</Link>
                        </td>
                        <td className="ui-num px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{a.yes}</td>
                        <td className="ui-num px-4 py-3" style={{ color: a.no ? 'var(--badge-error-text)' : 'var(--text-secondary)', fontWeight: a.no ? 700 : 400 }}>{a.no}</td>
                        <td className="ui-num px-4 py-3" style={{ color: 'var(--text-primary)' }}>{Math.round((a.yes / total) * 100)}% <span style={{ color: 'var(--text-secondary)' }}>({a.yes} de {total})</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </section>

          <section className="space-y-3" aria-labelledby="comentarios">
            <h2 id="comentarios" className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>O que faltou</h2>
            {dados.comments.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Nenhum comentário ainda.</p>
            ) : (
              <ul className="space-y-3">
                {dados.comments.map((c, i) => (
                  <li key={i} className="ui-card !p-4 space-y-1.5">
                    <p className="text-[15px] leading-relaxed whitespace-pre-wrap" style={{ color: 'var(--text-primary)' }}>{c.comment}</p>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {tituloDe(c.articleId)} · {c.userName} ({c.organizationName}) · {fmtData(c.updatedAt)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
