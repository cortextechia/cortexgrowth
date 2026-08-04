'use client';

import { useState } from 'react';
import { apiService } from '@/lib/api';

// Confirmação de senha para ações sensíveis de cobrança (cancelar, trocar cartão).
// Protege contra sessão sequestrada: quem roubou o acesso não sabe a senha.
//
// O backend responde 403 com `code: STEP_UP_REQUIRED` quando falta o token; a tela
// abre este modal, troca a senha por um token de 5 min e refaz a ação com ele.
export default function ConfirmarSenha({
  titulo, aviso, rotuloConfirmar, onConfirmado, onCancelar,
}: {
  titulo: string;
  aviso?: string;
  rotuloConfirmar: string;
  onConfirmado: (stepUpToken: string) => void | Promise<void>;
  onCancelar: () => void;
}) {
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const confirmar = async () => {
    setEnviando(true);
    setErro(null);
    try {
      const r = await apiService.stepUp(senha);
      setSenha(''); // não deixar a senha no estado depois de usada
      await onConfirmado(r.data.stepUpToken);
    } catch (e) {
      const status = (e as { response?: { status?: number } })?.response?.status;
      setErro(status === 429
        ? 'Muitas tentativas. Aguarde alguns minutos.'
        : status === 401 ? 'Senha incorreta.'
        : 'Não foi possível confirmar agora. Tente de novo.');
      setEnviando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
      onClick={onCancelar}>
      <div className="w-full max-w-sm rounded-2xl p-6"
        style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
        onClick={(e) => e.stopPropagation()}>
        <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>{titulo}</h2>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Confirme sua senha para continuar.
        </p>
        {aviso && (
          <p className="mt-3 rounded-lg px-3 py-2 text-xs"
            style={{ backgroundColor: 'var(--badge-warn-bg)', color: 'var(--badge-warn-text)' }}>
            {aviso}
          </p>
        )}

        <form onSubmit={(e) => { e.preventDefault(); if (senha && !enviando) void confirmar(); }}>
          <input
            type="password"
            value={senha}
            autoFocus
            autoComplete="current-password"
            onChange={(e) => setSenha(e.target.value)}
            placeholder="Sua senha"
            className="mt-4 w-full rounded-lg px-3 py-2 text-sm outline-none"
            style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          />
          {erro && <p className="mt-2 text-sm" style={{ color: 'var(--badge-error-text)' }}>{erro}</p>}

          <div className="mt-5 flex gap-2">
            <button type="button" onClick={onCancelar}
              className="flex-1 rounded-lg py-2.5 text-sm font-medium"
              style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
              Voltar
            </button>
            <button type="submit" disabled={!senha || enviando}
              className="flex-1 rounded-lg py-2.5 text-sm font-semibold disabled:opacity-50"
              style={{ backgroundColor: 'var(--badge-error-text)', color: '#fff' }}>
              {enviando ? 'Confirmando…' : rotuloConfirmar}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
