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
// cadastro. À esquerda, o que o produto É e um card de exemplo do lead que chega.
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
    backgroundColor: 'var(--bg-base)',
    border: '1px solid var(--input-border)',
    color: 'var(--text-primary)',
  };

  const onFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = 'var(--accent)';
    e.target.style.boxShadow = '0 0 0 1px var(--accent)';
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
            Sem promessa e sem depoimento inventado: o nome do produto, uma frase
            factual do que ele É e um card de exemplo (marcado como exemplo). */}
        <div className="hidden lg:block">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--accent-fill)' }}>
              <svg className="w-5 h-5 text-[var(--on-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="font-semibold text-xl" style={{ color: 'var(--text-primary)' }}>Cortex Growth</span>
            <BetaBadge />
          </div>

          <p className="eyebrow mt-10">META ADS · GOOGLE ADS · CRM</p>
          <h2 className="cromo mt-4 text-5xl font-extrabold leading-[1.04]" style={{ letterSpacing: '-0.04em' }}>
            Meta Ads, Google Ads e CRM no mesmo painel.
          </h2>
          <p className="mt-5 max-w-md text-base leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            Cada lead chega com o anúncio que o trouxe. Você vê o que vende, não só o que gera clique.
          </p>

          <div className="mt-10 max-w-md rounded-[22px] p-[18px]" aria-hidden style={{
            background: 'linear-gradient(180deg, var(--bg-elevated), var(--bg-surface))',
            border: '1px solid var(--border-md)',
          }}>
            <div className="flex items-center justify-between gap-3 text-[11px] font-medium" style={{ fontFamily: 'var(--font-mono-cx), monospace', color: 'var(--text-muted)' }}>
              <span>EXEMPLO · NOVO LEAD</span>
              <span className="rounded-full px-2 py-0.5" style={{ backgroundColor: 'var(--accent-fill)', color: 'var(--on-accent)' }}>VEIO DO ANÚNCIO</span>
            </div>
            <div className="mt-3 flex items-center gap-3">
              <div className="h-10 w-10 shrink-0 rounded-full" style={{ backgroundColor: 'var(--border-md)' }} />
              <div>
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Lead novo</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Anúncio “Vídeo do produto” · campanha Engajamento</p>
              </div>
            </div>
            <p className="mt-3 rounded-xl px-3.5 py-3 text-sm" style={{ backgroundColor: 'var(--bg-base)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
              Oi! Vi o anúncio de vocês e queria um orçamento.
            </p>
          </div>
        </div>

        {/* Marca compacta só no mobile, onde o painel da esquerda não aparece */}
        <div className="flex items-center justify-center gap-2 lg:hidden">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--accent-fill)' }}>
            <svg className="w-5 h-5 text-[var(--on-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <span className="font-semibold text-lg" style={{ color: 'var(--text-primary)' }}>Cortex Growth</span>
          <BetaBadge />
        </div>

        <div className="overflow-hidden rounded-3xl" style={{
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-md)',
        }}>
          <div className="p-9">
            <h1 className="text-[28px] font-extrabold" style={{ color: 'var(--text-primary)' }}>Entrar</h1>
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
                className="flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold text-[var(--on-accent)] transition-all disabled:opacity-60 disabled:cursor-not-allowed mt-1"
                style={{ backgroundColor: 'var(--accent-fill)' }}
                onMouseEnter={(e) => { if (!isLoading) e.currentTarget.style.backgroundColor = 'var(--accent-dark)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--accent-fill)'; }}
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
          <Link href="/privacy" className="transition-colors hover:text-[var(--text-primary)]">Privacidade</Link>
        </p>
      </div>

    </div>
  );
}
