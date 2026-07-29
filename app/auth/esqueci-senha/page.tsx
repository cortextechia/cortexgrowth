'use client';

import { useState } from 'react';
import Link from 'next/link';
import { apiService } from '@/lib/api';
import { AuthShell, Caixa, inputStyle } from '../_shell';

export default function EsqueciSenhaPage() {
  const [email, setEmail] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setEnviando(true);
    try {
      await apiService.forgotPassword(email);
    } catch {
      // O backend responde igual existindo ou não a conta; se der erro de rede,
      // mostrar a mesma tela evita virar oráculo de "quem tem conta aqui".
    } finally {
      setEnviando(false);
      setEnviado(true);
    }
  };

  if (enviado) {
    return (
      <AuthShell>
        <Caixa titulo="Verifique seu e-mail" tom="sucesso">
          <p className="text-sm text-center" style={{ color: '#94a3b8' }}>
            Se existir uma conta com <strong style={{ color: '#cbd5e1' }}>{email}</strong>, o link de
            redefinição chegou na caixa de entrada. Ele vale por 1 hora.
          </p>
          <Link href="/auth/login"
            className="mt-6 block w-full rounded-lg py-2.5 text-center text-sm font-medium text-white"
            style={{ backgroundColor: '#3b82f6' }}>
            Voltar ao login
          </Link>
        </Caixa>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <Caixa titulo="Esqueceu a senha?">
        <p className="text-sm text-center mb-5" style={{ color: '#94a3b8' }}>
          Informe o e-mail da conta e enviaremos um link para criar uma nova senha.
        </p>
        <form onSubmit={enviar} className="space-y-4">
          <input
            type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com" autoFocus
            className="w-full rounded-lg px-3 py-2.5 text-sm outline-none placeholder-slate-600"
            style={inputStyle}
          />
          <button type="submit" disabled={enviando}
            className="w-full rounded-lg py-2.5 text-sm font-medium text-white disabled:opacity-60"
            style={{ backgroundColor: '#3b82f6' }}>
            {enviando ? 'Enviando…' : 'Enviar link'}
          </button>
        </form>
        <p className="mt-5 text-center text-sm" style={{ color: '#475569' }}>
          Lembrou? <Link href="/auth/login" style={{ color: '#60a5fa' }}>Entrar</Link>
        </p>
      </Caixa>
    </AuthShell>
  );
}
