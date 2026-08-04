'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { apiService } from '@/lib/api';
import PlanoCheckout from '@/components/PlanoCheckout';
import type { BillingStatus } from '@/types';

// Tela de assinatura inativa. Fica FORA de /dashboard de propósito: o layout do
// dashboard chama a API no mount, o backend devolve 402 e o interceptor redireciona
// para cá — se esta página vivesse lá dentro, viraria loop de redirecionamento.
const COPY: Record<string, { titulo: string; texto: string }> = {
  // Org recém-criada nasce vencida (é assim que o gate funciona), mas dizer "seu
  // período terminou" para quem acabou de chegar é mentira. Quem nunca pagou vê isto.
  PRIMEIRA: {
    titulo: 'Falta só o pagamento',
    texto: 'Sua conta foi criada. Escolha o plano e finalize o pagamento para liberar o acesso ao painel, aos relatórios e ao CRM.',
  },
  SUSPENDED: {
    titulo: 'Assinatura suspensa',
    texto: 'O acesso à plataforma está suspenso por pendência no pagamento. Assim que a mensalidade for regularizada, tudo volta exatamente como estava — nenhum dado foi apagado.',
  },
  CANCELLED: {
    titulo: 'Assinatura cancelada',
    texto: 'Esta conta foi cancelada. Os dados continuam guardados e a reativação pode ser feita a qualquer momento pelo suporte.',
  },
  EXPIRED: {
    titulo: 'Assinatura vencida',
    texto: 'O período contratado terminou. Renove para voltar a acessar os painéis, relatórios e o CRM — seus dados seguem intactos.',
  },
};

function Conteudo() {
  const params = useSearchParams();
  const router = useRouter();
  const motivo = params.get('motivo') ?? 'EXPIRED';

  // /api/billing/* é isento do bloqueio (BILLING_EXEMPT_PREFIXES no backend), então
  // quem está barrado consegue carregar o próprio status e pagar daqui mesmo.
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const carregar = () => apiService.getBillingStatus().then((r) => setStatus(r.data));
  useEffect(() => { carregar().catch(() => setStatus(null)); }, []);

  const sair = () => {
    apiService.clearTokens();
    router.push('/auth/login');
  };

  // CANCELLED depende de ação do suporte (reativação manual) — pagar sozinho não
  // resolve, então essa é a única razão que não mostra o checkout.
  const podePagar = status !== null && motivo !== 'CANCELLED';

  // Nunca pagou = está entrando agora, não venceu nada.
  const primeiraAssinatura = status !== null && status.paymentsCount === 0 && motivo === 'EXPIRED';
  const { titulo, texto } = primeiraAssinatura ? COPY.PRIMEIRA! : (COPY[motivo] ?? COPY.EXPIRED!);

  return (
    <div className="min-h-screen flex items-start justify-center px-6 py-10" style={{ backgroundColor: 'var(--bg-base)' }}>
      {/* max-w-5xl com o checkout: em 3xl os 3 cards ficam com ~240px e o preço
          colide com o nome do plano. Sem o checkout, o card de aviso sozinho fica
          melhor estreito. */}
      <div className={`w-full ${podePagar ? 'max-w-5xl space-y-5' : 'max-w-md'}`}>
      <div
        className="w-full rounded-2xl p-8 text-center"
        style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
      >
        {/* Triângulo de alerta em cima de "bem-vindo" se contradiz — quem está
            chegando vê o ícone de cartão, não o de problema. */}
        <div
          className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full"
          style={{ backgroundColor: primeiraAssinatura ? 'var(--accent-dim)' : 'var(--badge-warn-bg)' }}
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24"
            stroke={primeiraAssinatura ? 'var(--accent)' : 'var(--badge-warn-text)'} strokeWidth={2}>
            {primeiraAssinatura ? (
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M3 10a2 2 0 012-2h14a2 2 0 012 2M3 10v8a2 2 0 002 2h14a2 2 0 002-2v-8M7 15h4" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            )}
          </svg>
        </div>

        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{titulo}</h1>
        <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{texto}</p>

        {!podePagar && (
          <p className="mt-6 text-xs" style={{ color: 'var(--text-muted)' }}>
            Para regularizar, fale com o time da Cortex Tech pelo canal de atendimento que você já usa.
          </p>
        )}

        <button
          onClick={sair}
          className="mt-6 w-full rounded-lg py-2.5 text-sm font-medium transition-colors"
          style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
        >
          Sair
        </button>
      </div>

      {/* Sem isto a tela é um beco sem saída: o cliente é barrado e não tem como pagar. */}
      {podePagar && (
        <PlanoCheckout
          status={status}
          titulo="Escolha seu plano para liberar o acesso"
          onAtualizado={() => carregar().catch(() => undefined)}
        />
      )}
      </div>
    </div>
  );
}

export default function AssinaturaPage() {
  return (
    <Suspense fallback={null}>
      <Conteudo />
    </Suspense>
  );
}
