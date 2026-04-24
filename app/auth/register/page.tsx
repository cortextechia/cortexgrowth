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

const steps = [
  { label: 'Conecte Meta Ads e Google Ads' },
  { label: 'Sincronize seus dados de campanha' },
  { label: 'Receba insights gerados por IA' },
];

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
    organizationName: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    setError(null);
    if (formData.password.length < 8) {
      setError('Senha deve ter no mínimo 8 caracteres');
      return;
    }
    setIsLoading(true);
    try {
      const response = await register(formData);
      if (response.success) router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar conta. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const inputStyle = {
    backgroundColor: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.08)',
    color: '#f1f5f9',
  };

  const inputFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = '#3b82f6';
    e.target.style.boxShadow = '0 0 0 3px rgba(59,130,246,0.1)';
  };

  const inputBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    e.target.style.borderColor = 'rgba(255,255,255,0.08)';
    e.target.style.boxShadow = 'none';
  };

  return (
    <div className="min-h-screen flex" style={{ backgroundColor: '#080d19' }}>

      {/* Painel esquerdo — branding */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col justify-between p-12 overflow-hidden">
        <div className="absolute inset-0" style={{
          background: 'radial-gradient(ellipse at 30% 60%, rgba(59,130,246,0.12) 0%, transparent 55%), radial-gradient(ellipse at 70% 10%, rgba(139,92,246,0.08) 0%, transparent 50%)'
        }} />
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
          backgroundSize: '40px 40px'
        }} />

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

        <div className="relative z-10 space-y-8">
          <div>
            <h2 className="text-4xl font-bold leading-tight" style={{ color: '#f1f5f9' }}>
              Comece em{' '}
              <span style={{
                background: 'linear-gradient(135deg, #60a5fa, #a78bfa)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}>
                minutos.
              </span>
            </h2>
            <p className="mt-3 text-base leading-relaxed" style={{ color: '#64748b' }}>
              Crie sua conta e conecte suas plataformas de marketing em poucos passos.
            </p>
          </div>

          <div className="space-y-5">
            {steps.map((step, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
                  style={{ backgroundColor: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', color: '#60a5fa' }}>
                  {i + 1}
                </div>
                <span className="text-sm" style={{ color: '#94a3b8' }}>{step.label}</span>
              </div>
            ))}
          </div>

          {/* Card de prova social */}
          <div className="rounded-xl p-4" style={{
            backgroundColor: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.06)'
          }}>
            <p className="text-sm italic" style={{ color: '#64748b' }}>
              "Reduzi em 3h por semana o tempo gasto em relatórios de campanha."
            </p>
            <p className="mt-2 text-xs font-medium" style={{ color: '#475569' }}>— Gestor de tráfego</p>
          </div>
        </div>

        <div className="relative z-10">
          <p className="text-xs" style={{ color: '#334155' }}>
            © 2026 IA Cortex Tech · <Link href="/privacy" className="hover:text-blue-400 transition-colors">Privacidade</Link>
          </p>
        </div>
      </div>

      {/* Painel direito — formulário */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">

          <div className="lg:hidden flex items-center gap-2 mb-8 justify-center">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#3b82f6' }}>
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="text-white font-semibold">Cortex Growth</span>
          </div>

          <div className="mb-8">
            <h1 className="text-2xl font-bold" style={{ color: '#f1f5f9' }}>Criar conta</h1>
            <p className="mt-1 text-sm" style={{ color: '#64748b' }}>Comece gratuitamente, sem cartão de crédito</p>
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
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label htmlFor="name" className="block text-xs font-medium mb-1.5" style={{ color: '#94a3b8' }}>
                  Nome completo
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  placeholder="Seu nome"
                  className="w-full rounded-lg px-3 py-2.5 text-sm transition-all outline-none"
                  style={inputStyle}
                  onFocus={inputFocus}
                  onBlur={inputBlur}
                />
              </div>

              <div>
                <label htmlFor="organizationName" className="block text-xs font-medium mb-1.5" style={{ color: '#94a3b8' }}>
                  Nome da empresa
                </label>
                <input
                  type="text"
                  id="organizationName"
                  name="organizationName"
                  value={formData.organizationName}
                  onChange={handleChange}
                  required
                  placeholder="Minha Agência"
                  className="w-full rounded-lg px-3 py-2.5 text-sm transition-all outline-none"
                  style={inputStyle}
                  onFocus={inputFocus}
                  onBlur={inputBlur}
                />
              </div>

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
                  style={inputStyle}
                  onFocus={inputFocus}
                  onBlur={inputBlur}
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
                  placeholder="Mínimo 8 caracteres"
                  className="w-full rounded-lg px-3 py-2.5 text-sm transition-all outline-none"
                  style={inputStyle}
                  onFocus={inputFocus}
                  onBlur={inputBlur}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium text-white transition-all disabled:opacity-60 disabled:cursor-not-allowed mt-2"
              style={{ backgroundColor: '#3b82f6' }}
              onMouseEnter={(e) => { if (!isLoading) (e.target as HTMLElement).style.backgroundColor = '#2563eb'; }}
              onMouseLeave={(e) => { (e.target as HTMLElement).style.backgroundColor = '#3b82f6'; }}
            >
              {isLoading && <Spinner />}
              {isLoading ? 'Criando conta...' : 'Criar conta grátis'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm" style={{ color: '#475569' }}>
            Já tem conta?{' '}
            <Link href="/auth/login" className="font-medium transition-colors" style={{ color: '#60a5fa' }}>
              Entrar
            </Link>
          </p>

          <p className="mt-4 text-center text-xs" style={{ color: '#334155' }}>
            Ao criar uma conta, você concorda com nossa{' '}
            <Link href="/privacy" className="hover:text-blue-400 transition-colors">política de privacidade</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}