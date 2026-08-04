'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import BetaBadge from '@/components/BetaBadge';

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// Quem chega aqui já é cliente e quer entrar — esta tela não repete o pitch do
// cadastro. A única continuidade visual com a tela de planos é a régua tricolor
// (ciano/violeta/âmbar, as cores dos três planos) no topo do cartão.
export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({ email: '', password: '' });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const response = await login(formData);
      if (response.success) router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao fazer login. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const inputStyle = {
    backgroundColor: 'var(--input-bg)',
    border: '1px solid var(--input-border)',
    color: 'var(--text-primary)',
  };

  const onFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = 'var(--accent)';
    e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.1)';
  };

  const onBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = 'var(--input-border)';
    e.target.style.boxShadow = 'none';
  };

  return (
    <div className="min-h-screen relative flex items-center overflow-hidden px-6 py-10"
      style={{ backgroundColor: 'var(--bg-base)' }}>

      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse at 28% 42%, var(--auth-glow-1) 0%, transparent 55%), radial-gradient(ellipse at 80% 90%, var(--auth-glow-2) 0%, transparent 45%)'
      }} />
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: 'linear-gradient(var(--auth-grid) 1px, transparent 1px), linear-gradient(90deg, var(--auth-grid) 1px, transparent 1px)',
        backgroundSize: '40px 40px'
      }} />

      <div className="relative z-10 mx-auto grid w-full max-w-5xl items-center gap-12 lg:grid-cols-[1fr_400px]">

        {/* ── Lado esquerdo ────────────────────────────────────────────────
            Sem promessa e sem depoimento inventado: só o nome do produto, uma
            frase factual do que ele É, e o espectro das três cores dos planos
            como massa visual — é o que dá peso à composição sem virar pitch. */}
        <div className="hidden lg:block">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--accent)' }}>
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="font-semibold text-xl" style={{ color: 'var(--text-primary)' }}>Cortex Growth</span>
            <BetaBadge />
          </div>

          <h2 className="mt-8 text-4xl font-bold leading-[1.15]" style={{ color: 'var(--text-primary)' }}>
            Meta Ads, Google Ads<br />e CRM no{' '}
            <span style={{
              background: 'linear-gradient(120deg, var(--plano-starter), var(--plano-pro) 55%, var(--plano-enterprise))',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}>
              mesmo painel.
            </span>
          </h2>

          <div className="espectro mt-10" aria-hidden>
            <span style={{ backgroundColor: 'var(--plano-starter)' }} />
            <span style={{ backgroundColor: 'var(--plano-pro)' }} />
            <span style={{ backgroundColor: 'var(--plano-enterprise)' }} />
          </div>
        </div>

        {/* Marca compacta só no mobile, onde o painel da esquerda não aparece */}
        <div className="flex items-center justify-center gap-2 lg:hidden">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--accent)' }}>
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <span className="font-semibold text-lg" style={{ color: 'var(--text-primary)' }}>Cortex Growth</span>
          <BetaBadge />
        </div>

        <div className="overflow-hidden rounded-2xl" style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          backdropFilter: 'blur(12px)',
        }}>
          {/* Sem régua tricolor aqui: o espectro já aparece no título e nas barras
              à esquerda. Repetir pela terceira vez viraria maneirismo. */}
          <div className="p-8">
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Entrar</h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>Acesse o painel da sua operação.</p>

            {error && (
              <div className="mt-5 flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm"
                style={{ backgroundColor: 'var(--badge-error-bg)', border: '1px solid var(--badge-error-text)', color: 'var(--badge-error-text)' }}>
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01" />
                </svg>
                {error}
              </div>
            )}

            <form onSubmit={(e) => { e.preventDefault(); void handleSubmit(); }} className="mt-5 space-y-4">
              <div>
                <label htmlFor="email" className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                  Email
                </label>
                <input
                  type="email" id="email" name="email" required autoComplete="email"
                  value={formData.email} onChange={handleChange}
                  placeholder="seu@email.com"
                  className="w-full rounded-lg px-3 py-2.5 text-sm transition-all outline-none placeholder-slate-600"
                  style={inputStyle} onFocus={onFocus} onBlur={onBlur}
                />
              </div>

              <div>
                <div className="flex items-baseline justify-between mb-1.5">
                  <label htmlFor="password" className="block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                    Senha
                  </label>
                  <Link href="/auth/esqueci-senha" className="text-xs transition-colors" style={{ color: 'var(--accent)' }}>
                    Esqueci minha senha
                  </Link>
                </div>
                <input
                  type="password" id="password" name="password" required autoComplete="current-password"
                  value={formData.password} onChange={handleChange}
                  placeholder="••••••••"
                  className="w-full rounded-lg px-3 py-2.5 text-sm transition-all outline-none placeholder-slate-600"
                  style={inputStyle} onFocus={onFocus} onBlur={onBlur}
                />
              </div>

              <button
                type="submit" disabled={isLoading}
                className="flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold text-white transition-all disabled:opacity-60 disabled:cursor-not-allowed mt-1"
                style={{ backgroundColor: 'var(--accent)' }}
                onMouseEnter={(e) => { if (!isLoading) e.currentTarget.style.backgroundColor = 'var(--accent-dark)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--accent)'; }}
              >
                {isLoading && <Spinner />}
                {isLoading ? 'Entrando...' : 'Entrar'}
              </button>
            </form>

            <p className="mt-6 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
              Não tem conta?{' '}
              <Link href="/auth/register" className="font-medium transition-colors" style={{ color: 'var(--accent)' }}>
                Ver planos
              </Link>
            </p>
          </div>
        </div>

        <p className="text-center text-xs lg:col-start-2" style={{ color: 'var(--text-muted)' }}>
          © 2026 IA Cortex Tech ·{' '}
          <Link href="/privacy" className="hover:text-blue-400 transition-colors">Privacidade</Link>
        </p>
      </div>

      <style jsx>{`
        /* Três faixas de luz nas cores dos planos — massa visual que equilibra o
           formulário sem inventar conteúdo. A respiração é lenta e quase imperceptível. */
        .espectro {
          display: flex;
          gap: 14px;
          max-width: 420px;
        }
        .espectro span {
          height: 5px;
          flex: 1;
          border-radius: 999px;
          filter: blur(0.3px);
          opacity: 0.85;
          animation: respirar 7s ease-in-out infinite;
        }
        .espectro span:nth-child(2) { animation-delay: 1.1s; }
        .espectro span:nth-child(3) { animation-delay: 2.2s; }

        @keyframes respirar {
          0%, 100% { opacity: 0.32; transform: scaleX(0.94); }
          50%      { opacity: 0.9;  transform: scaleX(1); }
        }

        @media (prefers-reduced-motion: reduce) {
          .espectro span { animation: none; opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}
