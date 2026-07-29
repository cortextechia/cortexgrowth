'use client';

import { Suspense, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiService } from '@/lib/api';
import { AuthShell, Caixa, inputStyle } from '../_shell';

function Conteudo() {
  const token = useSearchParams().get('token');
  const router = useRouter();
  const [senha, setSenha] = useState('');
  const [confirma, setConfirma] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [pronto, setPronto] = useState(false);

  if (!token) {
    return (
      <Caixa titulo="Link inválido" tom="erro">
        <p className="text-sm text-center" style={{ color: '#94a3b8' }}>
          Este link não tem token. Peça uma nova redefinição.
        </p>
        <Link href="/auth/esqueci-senha"
          className="mt-6 block w-full rounded-lg py-2.5 text-center text-sm font-medium text-white"
          style={{ backgroundColor: '#3b82f6' }}>
          Pedir novo link
        </Link>
      </Caixa>
    );
  }

  if (pronto) {
    return (
      <Caixa titulo="Senha alterada" tom="sucesso">
        <p className="text-sm text-center" style={{ color: '#94a3b8' }}>
          Sua senha foi trocada e as sessões antigas foram encerradas. Entre com a nova senha.
        </p>
        <button onClick={() => router.push('/auth/login')}
          className="mt-6 w-full rounded-lg py-2.5 text-sm font-medium text-white"
          style={{ backgroundColor: '#3b82f6' }}>
          Ir para o login
        </button>
      </Caixa>
    );
  }

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    if (senha.length < 8) { setErro('A senha precisa ter no mínimo 8 caracteres.'); return; }
    if (senha !== confirma) { setErro('As senhas não conferem.'); return; }

    setSalvando(true);
    try {
      await apiService.resetPassword(token, senha);
      setPronto(true);
    } catch (e2: any) {
      setErro(e2?.response?.data?.message ?? 'Não foi possível redefinir a senha.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Caixa titulo="Criar nova senha">
      {erro && (
        <div className="mb-4 rounded-lg px-3 py-2.5 text-sm"
          style={{ backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
          {erro}
        </div>
      )}
      <form onSubmit={salvar} className="space-y-4">
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: '#94a3b8' }}>Nova senha</label>
          <input type="password" required value={senha} onChange={(e) => setSenha(e.target.value)}
            placeholder="Mínimo 8 caracteres" autoFocus
            className="w-full rounded-lg px-3 py-2.5 text-sm outline-none placeholder-slate-600" style={inputStyle} />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: '#94a3b8' }}>Confirmar senha</label>
          <input type="password" required value={confirma} onChange={(e) => setConfirma(e.target.value)}
            placeholder="Repita a senha"
            className="w-full rounded-lg px-3 py-2.5 text-sm outline-none placeholder-slate-600" style={inputStyle} />
        </div>
        <button type="submit" disabled={salvando}
          className="w-full rounded-lg py-2.5 text-sm font-medium text-white disabled:opacity-60"
          style={{ backgroundColor: '#3b82f6' }}>
          {salvando ? 'Salvando…' : 'Salvar nova senha'}
        </button>
      </form>
    </Caixa>
  );
}

export default function NovaSenhaPage() {
  return (
    <AuthShell>
      <Suspense fallback={null}>
        <Conteudo />
      </Suspense>
    </AuthShell>
  );
}
