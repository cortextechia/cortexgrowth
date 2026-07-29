'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { apiService } from '@/lib/api';

// Cartão de primeiros passos: aparece só enquanto a org não concluiu a configuração
// e some sozinho depois. Substitui o item fixo "Configuração Inicial" na sidebar, que
// ficava lá para sempre sugerindo pendência mesmo em conta já configurada.
//
// Cada passo aponta para onde a coisa se resolve DE VERDADE (Integrações, SEO), não
// para um wizard paralelo — assim o cliente aprende onde as coisas moram.

interface Passo {
  titulo: string;
  descricao: string;
  href: string;
  feito: boolean;
}

export function PrimeirosPassos() {
  const { organization, user } = useAuth();
  const [passos, setPassos] = useState<Passo[] | null>(null);
  // Quem pulou o wizard nunca passou pelo botão final, então `onboardingCompletedAt`
  // ficava null para sempre — o cartão seguia na tela mesmo com tudo 100% feito.
  // Concluir por dedução: se os passos estão todos prontos, a configuração acabou.
  const [concluidoAgora, setConcluidoAgora] = useState(false);
  const jaMarcou = useRef(false);

  const concluido = Boolean(organization?.onboardingCompletedAt);

  useEffect(() => {
    if (concluido) return;

    Promise.all([
      apiService.getIntegrations().catch(() => ({ integrations: [] as { type: string; status: string }[] })),
      apiService.getSeoConfig().catch(() => ({ data: { websiteUrl: null } })),
    ]).then(([integ, seo]) => {
      const conectado = (tipo: string) =>
        integ.integrations.some((i) => i.type === tipo && i.status === 'CONNECTED');

      const lista: Passo[] = [
        {
          titulo: 'Conecte o Meta Ads',
          descricao: 'Traz gasto, impressões e leads das campanhas.',
          href: '/dashboard/integrations',
          feito: conectado('META_ADS'),
        },
        {
          titulo: 'Conecte o Google Ads',
          descricao: 'Completa o comparativo entre os dois canais.',
          href: '/dashboard/integrations',
          feito: conectado('GOOGLE_ADS'),
        },
        {
          titulo: 'Informe o site da empresa',
          descricao: 'Libera o diagnóstico de SEO e a comparação com concorrentes.',
          href: '/dashboard/seo',
          feito: Boolean(seo.data?.websiteUrl),
        },
      ];
      setPassos(lista);

      if (!lista.every((p) => p.feito)) return;

      // Não há mais o que fazer: esconde para todos, mesmo que a marcação não persista.
      setConcluidoAgora(true);

      // Só ADMIN/SUPER_ADMIN pode marcar (a rota exige). Sem esta guarda, um vendedor
      // dispararia um 403 a cada visita ao dashboard.
      const podeMarcar = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
      // `jaMarcou` guarda contra o duplo-invoke do useEffect em Strict Mode (dev).
      if (podeMarcar && !jaMarcou.current) {
        jaMarcou.current = true;
        // Falha aqui não pode tirar o dashboard do ar — no pior caso não persiste
        // e o cartão reaparece no próximo carregamento.
        void apiService.completeOnboarding().catch(() => {});
      }
    });
  }, [concluido, user?.role]);

  if (concluido || concluidoAgora || !passos) return null;

  const prontos = passos.filter((p) => p.feito).length;
  const pct = Math.round((prontos / passos.length) * 100);

  return (
    <div className="rounded-xl p-5" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>Comece por aqui</p>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
            {prontos} de {passos.length} concluídos — o painel fica completo quando os dados chegarem.
          </p>
        </div>
        <span className="text-2xl font-extrabold tabular-nums" style={{ color: 'var(--accent)' }}>{pct}%</span>
      </div>

      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full" style={{ backgroundColor: 'var(--border-md)' }}>
        <div className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${pct}%`, backgroundColor: 'var(--accent)' }} />
      </div>

      <div className="mt-4 space-y-2">
        {passos.map((p) => (
          <Link key={p.titulo} href={p.href}
            className="flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors"
            style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold"
              style={p.feito
                ? { backgroundColor: 'var(--badge-success-bg)', color: 'var(--badge-success-text)' }
                : { border: '1.5px solid var(--border-md)', color: 'var(--text-muted)' }}>
              {p.feito ? '✓' : ''}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium"
                style={{ color: p.feito ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: p.feito ? 'line-through' : 'none' }}>
                {p.titulo}
              </span>
              {!p.feito && (
                <span className="block text-xs" style={{ color: 'var(--text-muted)' }}>{p.descricao}</span>
              )}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
