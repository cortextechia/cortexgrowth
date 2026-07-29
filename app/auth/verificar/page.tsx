'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { apiService } from '@/lib/api';
import { AuthShell, Caixa } from '../_shell';

function Conteudo() {
  const token = useSearchParams().get('token');
  const [estado, setEstado] = useState<'verificando' | 'ok' | 'erro'>('verificando');
  const [mensagem, setMensagem] = useState('');
  // Strict Mode chama o effect 2× em dev: sem a trava, a 2ª chamada usa um token
  // já consumido e o usuário vê "link inválido" depois de ter dado certo.
  const jaRodou = useRef(false);

  useEffect(() => {
    if (jaRodou.current) return;
    jaRodou.current = true;

    if (!token) {
      setEstado('erro');
      setMensagem('Link sem token. Abra o link exatamente como veio no e-mail.');
      return;
    }
    apiService.verifyEmail(token)
      .then((r) => { setEstado('ok'); setMensagem(r.message); })
      .catch((e) => {
        setEstado('erro');
        setMensagem(e?.response?.data?.message ?? 'Não foi possível confirmar seu e-mail.');
      });
  }, [token]);

  return (
    <Caixa
      titulo={estado === 'verificando' ? 'Confirmando…' : estado === 'ok' ? 'E-mail confirmado' : 'Não deu certo'}
      tom={estado === 'ok' ? 'sucesso' : estado === 'erro' ? 'erro' : 'neutro'}
    >
      <p className="text-sm" style={{ color: '#94a3b8' }}>
        {estado === 'verificando' ? 'Validando seu link…' : mensagem}
      </p>

      {estado !== 'verificando' && (
        <Link href="/auth/login"
          className="mt-6 block w-full rounded-lg py-2.5 text-center text-sm font-medium text-white"
          style={{ backgroundColor: '#3b82f6' }}>
          Ir para o login
        </Link>
      )}
    </Caixa>
  );
}

export default function VerificarPage() {
  return (
    <AuthShell>
      <Suspense fallback={null}>
        <Conteudo />
      </Suspense>
    </AuthShell>
  );
}
