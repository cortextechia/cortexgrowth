'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { apiService } from '@/lib/api';
import { UserRole } from '@/types';

function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function formatDate(d: string) {
  return new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function GestorPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [invite, setInvite] = useState<{ code: string; expiresAt: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchInvite = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiService.getMyInvite();
      setInvite(res.data);
    } catch {
      showToast('Erro ao carregar código de convite.', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user?.role !== UserRole.TRAFFIC_MANAGER) {
      router.replace('/dashboard');
      return;
    }
    void fetchInvite();
  }, [user, router, fetchInvite]);

  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      const res = await apiService.regenerateInvite();
      setInvite(res.data);
      showToast('Código regenerado com sucesso.');
    } catch {
      showToast('Erro ao regenerar código.', 'error');
    } finally {
      setRegenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!invite) return;
    await navigator.clipboard.writeText(invite.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (user?.role !== UserRole.TRAFFIC_MANAGER) return null;

  return (
    <div className="w-full max-w-2xl">
      {toast && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${
          toast.type === 'success' ? 'bg-gray-900 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.message}
        </div>
      )}

      <div className="mb-8">
        <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Meu Código de Convite</h1>
        <p className="mt-1 text-sm text-gray-500">
          Compartilhe este código com seus clientes para que conectem você à conta deles.
        </p>
      </div>

      {/* Invite card */}
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-8">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-400">
            <Spinner /> Carregando...
          </div>
        ) : invite ? (
          <div className="space-y-6">
            {/* Code display */}
            <div className="text-center">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Seu código</p>
              <div
                className="inline-flex items-center gap-4 rounded-2xl px-8 py-5 cursor-pointer select-all"
                style={{ backgroundColor: 'rgba(59,130,246,0.06)', border: '1.5px dashed rgba(59,130,246,0.3)' }}
                onClick={handleCopy}
                title="Clique para copiar"
              >
                <span className="text-4xl font-bold tracking-[0.25em] font-mono" style={{ color: '#1d4ed8' }}>
                  {invite.code}
                </span>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                  style={copied
                    ? { backgroundColor: 'rgba(34,197,94,0.1)', color: '#16a34a' }
                    : { backgroundColor: 'rgba(59,130,246,0.1)', color: '#3b82f6' }
                  }
                >
                  {copied ? (
                    <>
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                      Copiado!
                    </>
                  ) : (
                    <>
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                      </svg>
                      Copiar
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Expiry info */}
            <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Expira em {formatDate(invite.expiresAt)}
            </div>

            {/* Instructions */}
            <div className="rounded-xl p-4 text-sm" style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <p className="font-medium text-gray-700 mb-2">Como usar:</p>
              <ol className="space-y-1 text-gray-500 list-decimal list-inside">
                <li>Copie o código acima</li>
                <li>Envie ao seu cliente (WhatsApp, email, etc.)</li>
                <li>O cliente ADMIN acessa a aba <strong>Usuários</strong> no dashboard deles</li>
                <li>Clica em <strong>"Conectar Gestor"</strong> e digita o código</li>
                <li>Você terá acesso imediato ao dashboard do cliente</li>
              </ol>
            </div>

            {/* Regenerate button */}
            <div className="flex justify-center pt-2">
              <button
                onClick={handleRegenerate}
                disabled={regenerating}
                className="flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-500 hover:bg-gray-50 hover:border-gray-300 disabled:opacity-50 transition-colors"
              >
                {regenerating ? <Spinner className="h-3.5 w-3.5" /> : (
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                  </svg>
                )}
                {regenerating ? 'Regenerando...' : 'Gerar novo código'}
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-sm text-gray-400 mb-4">Nenhum código ativo.</p>
            <button
              onClick={fetchInvite}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              Gerar código
            </button>
          </div>
        )}
      </div>
    </div>
  );
}