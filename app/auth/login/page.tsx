'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

const features = [
  { icon: '⚡', text: 'Dados de Meta e Google Ads em tempo real' },
  { icon: '🤖', text: 'Insights gerados por IA automaticamente' },
  { icon: '📊', text: 'Dashboard unificado de todas as campanhas' },
];

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

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: '#080d19' }}>

      {/* Painel esquerdo — branding */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-12 overflow-hidden">
        {/* Gradient de fundo */}
        <div className="absolute inset-0" style={{
          background: 'radial-gradient(ellipse at 20% 50%, rgba(59,130,246,0.15) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(99,102,241,0.1) 0%, transparent 50%)'
        }} />

        {/* Grid sutil */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
          backgroundSize: '40px 40px'
        }} />

        {/* Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#3b82f6' }}>
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="text-white font-semibold text-lg">Cortex Growth</span>
          </div>
        </div>

        {/* Conteúdo central */}
        <div className="relative z-10 space-y-8">
          <div>
            <h2 className="text-4xl font-bold leading-tight" style={{ color: '#f1f5f9' }}>
              Seu marketing,{' '}
              <span style={{
                background: 'linear-gradient(135deg, #60a5fa, #a78bfa)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}>
                inteligente.
              </span>
            </h2>
            <p className="mt-3 text-base leading-relaxed" style={{ color: '#64748b' }}>
              Centralize campanhas, analise performance e tome decisões com dados reais.
            </p>
          </div>

          <div className="space-y-4">
            {features.map((f, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)' }}>
                  <span className="text-sm">{f.icon}</span>
                </div>
                <span className="text-sm" style={{ color: '#94a3b8' }}>{f.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Rodapé esquerdo */}
        <div className="relative z-10">
          <p className="text-xs" style={{ color: '#334155' }}>
            © 2026 IA Cortex Tech · <Link href="/privacy" className="hover:text-blue-400 transition-colors">Privacidade</Link>
          </p>
        </div>
      </div>

      {/* Painel direito — formulário */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">

          {/* Logo mobile */}
          <div className="lg:hidden flex items-center gap-2 mb-8 justify-center">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#3b82f6' }}>
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="text-white font-semibold">Cortex Growth</span>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold" style={{ color: '#f1f5f9' }}>Bem-vindo de volta</h1>
            <p className="mt-1 text-sm" style={{ color: '#64748b' }}>Entre na sua conta para continuar</p>
          </div>

          {error && (
            <div className="mb-5 flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm"
              style={{ backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01" />
              </svg>
              {error}
            </div>
          )}

          <form onSubmit={(e) => { e.preventDefault(); void handleSubmit(); }} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-xs font-medium mb-1.5" style={{ color: '#94a3b8' }}>
                Email
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                placeholder="seu@email.com"
                className="w-full rounded-lg px-3 py-2.5 text-sm transition-all outline-none"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: '#f1f5f9',
                }}
                onFocus={(e) => { e.target.style.borderColor = '#3b82f6'; e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.1)'; }}
                onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; e.target.style.boxShadow = 'none'; }}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-medium mb-1.5" style={{ color: '#94a3b8' }}>
                Senha
              </label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                placeholder="••••••••"
                className="w-full rounded-lg px-3 py-2.5 text-sm transition-all outline-none"
                style={{
                  backgroundColor: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: '#f1f5f9',
                }}
                onFocus={(e) => { e.target.style.borderColor = '#3b82f6'; e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.1)'; }}
                onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.08)'; e.target.style.boxShadow = 'none'; }}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium text-white transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ backgroundColor: '#3b82f6' }}
              onMouseEnter={(e) => { if (!isLoading) (e.target as HTMLElement).style.backgroundColor = '#2563eb'; }}
              onMouseLeave={(e) => { (e.target as HTMLElement).style.backgroundColor = '#3b82f6'; }}
            >
              {isLoading && <Spinner />}
              {isLoading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm" style={{ color: '#475569' }}>
            Não tem conta?{' '}
            <Link href="/auth/register" className="font-medium transition-colors" style={{ color: '#60a5fa' }}>
              Criar conta
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}