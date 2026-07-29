'use client';

import { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { apiService } from '@/lib/api';

// Tela de assinatura inativa. Fica FORA de /dashboard de propósito: o layout do
// dashboard chama a API no mount, o backend devolve 402 e o interceptor redireciona
// para cá — se esta página vivesse lá dentro, viraria loop de redirecionamento.
const COPY: Record<string, { titulo: string; texto: string }> = {
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
  const { titulo, texto } = COPY[motivo] ?? COPY.EXPIRED!;

  const sair = () => {
    apiService.clearTokens();
    router.push('/auth/login');
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ backgroundColor: 'var(--bg-base)' }}>
      <div
        className="w-full max-w-md rounded-2xl p-8 text-center"
        style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
      >
        <div
          className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-full"
          style={{ backgroundColor: 'var(--badge-warn-bg)' }}
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="var(--badge-warn-text)" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
        </div>

        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{titulo}</h1>
        <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{texto}</p>

        {/* TODO(Asaas): quando o checkout existir, o CTA principal daqui vira "Pagar agora"
            apontando para a cobrança PIX/boleto da org. */}
        <p className="mt-6 text-xs" style={{ color: 'var(--text-muted)' }}>
          Para regularizar, fale com o time da Cortex Tech pelo canal de atendimento que você já usa.
        </p>

        <button
          onClick={sair}
          className="mt-6 w-full rounded-lg py-2.5 text-sm font-medium transition-colors"
          style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
        >
          Sair
        </button>
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
