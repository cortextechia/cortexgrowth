'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { apiService } from '@/lib/api';
import { AuthShell, Caixa } from '../_shell';

// Link da troca de e-mail (Minha conta). Pública: o link pode ser aberto em outro aparelho,
// sem login — o token é a prova.
function Conteudo() {
  const token = useSearchParams().get('token');
  const [estado, setEstado] = useState<'verificando' | 'ok' | 'erro'>(token ? 'verificando' : 'erro');
  const [mensagem, setMensagem] = useState(token ? '' : 'Link sem token. Abra o link exatamente como veio no e-mail.');
  // Strict Mode chama o effect 2× em dev: a 2ª chamada usaria o token já consumido
  const jaRodou = useRef(false);
  // Lido depois da resposta (não no render): ler o localStorage no render diverge do HTML do servidor
  const [logado, setLogado] = useState(false);

  useEffect(() => {
    if (jaRodou.current) return;
    jaRodou.current = true;
    if (!token) return;
    apiService.confirmEmailChange(token)
      .then((r) => { setEstado('ok'); setMensagem(r.message); setLogado(!!apiService.getAccessToken()); })
      .catch((e) => {
        setEstado('erro');
        setLogado(!!apiService.getAccessToken());
        setMensagem(e?.response?.data?.message ?? 'Não foi possível confirmar o novo e-mail.');
      });
  }, [token]);

  return (
    <Caixa
      titulo={estado === 'verificando' ? 'Confirmando…' : estado === 'ok' ? 'E-mail alterado' : 'Não deu certo'}
      tom={estado === 'ok' ? 'sucesso' : estado === 'erro' ? 'erro' : 'neutro'}
    >
      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
        {estado === 'verificando' ? 'Validando seu link…' : mensagem}
      </p>

      {estado !== 'verificando' && (
        <Link href={logado ? '/dashboard/conta' : '/auth/login'}
          className="mt-6 block w-full rounded-lg py-2.5 text-center text-sm font-medium text-[var(--on-accent)]"
          style={{ backgroundColor: 'var(--accent-fill)' }}>
          {logado ? 'Voltar para Minha conta' : 'Ir para o login'}
        </Link>
      )}
    </Caixa>
  );
}

export default function ConfirmarEmailPage() {
  return (
    <AuthShell>
      <Suspense fallback={null}>
        <Conteudo />
      </Suspense>
    </AuthShell>
  );
}
