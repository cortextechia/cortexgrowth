'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

const PROVIDER_LABELS: Record<string, string> = {
  meta: 'Meta Ads',
  google_ads: 'Google Ads',
  google_analytics: 'Google Analytics',
  kommo: 'Kommo CRM',
  google: 'Google',
};

export default function OAuthCallbackPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [countdown, setCountdown] = useState(4);

  const provider = searchParams.get('provider') ?? 'unknown';
  const status = searchParams.get('status') as 'success' | 'error' | null;
  const message = searchParams.get('message');

  const providerLabel = PROVIDER_LABELS[provider] ?? provider;
  const isSuccess = status === 'success';

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown((n) => {
        if (n <= 1) {
          clearInterval(interval);
          router.push('/dashboard/integrations');
        }
        return n - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-10 max-w-md w-full text-center">

        {/* Ícone */}
        <div className={`mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full ${
          isSuccess ? 'bg-green-50' : 'bg-red-50'
        }`}>
          {isSuccess ? (
            <svg className="h-8 w-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
        </div>

        {/* Título */}
        <h1 className="text-xl font-semibold text-gray-900 mb-2">
          {isSuccess ? `${providerLabel} conectado` : 'Falha na conexão'}
        </h1>

        {/* Mensagem */}
        <p className="text-sm text-gray-500 mb-1">
          {isSuccess
            ? `Sua conta ${providerLabel} foi autorizada com sucesso.`
            : `Não foi possível conectar o ${providerLabel}.`}
        </p>

        {!isSuccess && message && (
          <p className="mt-2 text-xs text-red-600 bg-red-50 rounded-lg px-4 py-2 break-words">
            {decodeURIComponent(message)}
          </p>
        )}

        {/* Contador */}
        <p className="mt-6 text-xs text-gray-400">
          Redirecionando para integrações em{' '}
          <span className="font-medium text-gray-600">{countdown}s</span>...
        </p>

        {/* Botão manual */}
        <button
          onClick={() => router.push('/dashboard/integrations')}
          className="mt-4 w-full rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-700 transition-colors"
        >
          Ir para Integrações
        </button>
      </div>
    </div>
  );
}
