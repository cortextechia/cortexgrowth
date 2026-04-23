'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';

// ─── Icons ────────────────────────────────────────────────────────────────────

const MetaIcon = () => (
  <svg viewBox="0 0 36 36" fill="none" className="h-8 w-8">
    <path d="M18 3C9.716 3 3 9.716 3 18s6.716 15 15 15 15-6.716 15-15S26.284 3 18 3z" fill="#1877F2"/>
    <path d="M22.162 11H20.05c-.808 0-1.703.338-2.29 1.157-.547.768-.66 1.703-.66 2.546v1.547H15v2.75h2.1V25h2.9v-6h2.1l.3-2.75h-2.4v-1.375c0-.792.22-1.125.9-1.125h1.262V11z" fill="white"/>
  </svg>
);

const GoogleIcon = () => (
  <svg viewBox="0 0 36 36" className="h-8 w-8">
    <path d="M33.12 18.37c0-1.16-.1-2.27-.29-3.34H18v6.32h8.49a7.26 7.26 0 01-3.15 4.76v3.95h5.1c2.99-2.75 4.68-6.8 4.68-11.69z" fill="#4285F4"/>
    <path d="M18 34c4.26 0 7.83-1.41 10.44-3.84l-5.1-3.95c-1.41.95-3.22 1.5-5.34 1.5-4.11 0-7.59-2.77-8.83-6.5H3.9v4.08A15.98 15.98 0 0018 34z" fill="#34A853"/>
    <path d="M9.17 21.21A9.64 9.64 0 018.67 18c0-1.11.19-2.19.5-3.21V10.71H3.9A15.98 15.98 0 002 18c0 2.58.62 5.02 1.9 7.29l5.27-4.08z" fill="#FBBC05"/>
    <path d="M18 8.29c2.32 0 4.4.8 6.04 2.37l4.53-4.53A15.94 15.94 0 0018 2 15.98 15.98 0 003.9 10.71l5.27 4.08C10.41 11.06 13.89 8.29 18 8.29z" fill="#EA4335"/>
  </svg>
);

const KommoIcon = () => (
  <svg viewBox="0 0 36 36" className="h-8 w-8">
    <rect width="36" height="36" rx="18" fill="#2E2E2E"/>
    <text x="18" y="23" textAnchor="middle" fill="white" fontSize="13" fontWeight="bold" fontFamily="sans-serif">K</text>
  </svg>
);

const GAIcon = () => (
  <svg viewBox="0 0 36 36" className="h-8 w-8">
    <rect width="36" height="36" rx="18" fill="#F9AB00"/>
    <rect x="8" y="20" width="5" height="8" rx="1.5" fill="white"/>
    <rect x="15.5" y="14" width="5" height="14" rx="1.5" fill="white"/>
    <rect x="23" y="8" width="5" height="20" rx="1.5" fill="white"/>
  </svg>
);

const features = [
  {
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
    title: 'Dashboard Unificado',
    description: 'Visualize Meta Ads, Google Ads e Kommo CRM em um único painel. Sem abrir várias plataformas.',
  },
  {
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
      </svg>
    ),
    title: 'AI Insights',
    description: '4 agentes de IA analisam seus dados de marketing e vendas e geram recomendações automáticas.',
  },
  {
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
      </svg>
    ),
    title: 'Atribuição UTM',
    description: 'Rastreie a jornada completa do lead desde o primeiro clique até o fechamento no CRM.',
  },
  {
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
      </svg>
    ),
    title: 'Multi-tenant',
    description: 'Gerencie múltiplos clientes e contas em uma única plataforma. Ideal para agências de marketing.',
  },
];

const steps = [
  { number: '01', title: 'Conecte suas plataformas', description: 'OAuth seguro com Meta Ads, Google Ads e Kommo CRM em poucos cliques.' },
  { number: '02', title: 'Sincronize seus dados', description: 'Importe campanhas, métricas e leads automaticamente para o dashboard.' },
  { number: '03', title: 'Decida com inteligência', description: 'Agentes de IA analisam seus dados e geram insights acionáveis.' },
];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg, #080d19 0%, #0a1628 50%, #0d1f3c 100%)', color: '#f1f5f9' }}>

      {/* ── Navbar ── */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
        style={{
          background: scrolled ? 'rgba(8,13,25,0.9)' : 'transparent',
          backdropFilter: scrolled ? 'blur(12px)' : 'none',
          borderBottom: scrolled ? '1px solid rgba(255,255,255,0.06)' : 'none',
        }}
      >
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)' }}>
              <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
              </svg>
            </div>
            <span className="font-bold text-lg text-white">Cortex Growth</span>
          </div>

          <div className="hidden md:flex items-center gap-8">
            <a href="#funcionalidades" className="text-sm transition-colors" style={{ color: '#94a3b8' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#f1f5f9')}
              onMouseLeave={e => (e.currentTarget.style.color = '#94a3b8')}>
              Funcionalidades
            </a>
            <a href="#integracoes" className="text-sm transition-colors" style={{ color: '#94a3b8' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#f1f5f9')}
              onMouseLeave={e => (e.currentTarget.style.color = '#94a3b8')}>
              Integrações
            </a>
            <a href="#como-funciona" className="text-sm transition-colors" style={{ color: '#94a3b8' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#f1f5f9')}
              onMouseLeave={e => (e.currentTarget.style.color = '#94a3b8')}>
              Como funciona
            </a>
          </div>

          <div className="flex items-center gap-3">
            <Link href="/auth/login" className="text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              style={{ color: '#94a3b8' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#f1f5f9')}
              onMouseLeave={e => (e.currentTarget.style.color = '#94a3b8')}>
              Entrar
            </Link>
            <Link href="/auth/register"
              className="text-sm font-medium px-4 py-2 rounded-lg text-white transition-all"
              style={{ background: '#3b82f6' }}
              onMouseEnter={e => (e.currentTarget.style.background = '#2563eb')}
              onMouseLeave={e => (e.currentTarget.style.background = '#3b82f6')}>
              Começar grátis
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Grid background */}
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: `linear-gradient(rgba(59,130,246,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.15) 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
        }} />
        {/* Glow central */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #3b82f6 0%, transparent 70%)' }} />

        <div className="relative z-10 max-w-5xl mx-auto px-6 text-center pt-24">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-8"
            style={{ background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.3)', color: '#93c5fd' }}>
            <span className="h-1.5 w-1.5 rounded-full bg-blue-400 animate-pulse" />
            Powered by IA — 4 agentes de análise
          </div>

          <h1 className="text-5xl md:text-7xl font-bold leading-tight mb-6">
            <span style={{ color: '#f1f5f9' }}>Inteligência de</span>
            <br />
            <span style={{ background: 'linear-gradient(135deg, #60a5fa, #3b82f6, #93c5fd)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Marketing
            </span>
            <br />
            <span style={{ color: '#f1f5f9' }}>em um só lugar</span>
          </h1>

          <p className="text-lg md:text-xl max-w-2xl mx-auto mb-10 leading-relaxed" style={{ color: '#94a3b8' }}>
            Conecte Meta Ads, Google Ads e Kommo CRM. Visualize seus dados,
            entenda seu ROAS e tome decisões com IA.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/auth/register"
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 rounded-xl text-base font-semibold text-white transition-all"
              style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)', boxShadow: '0 0 30px rgba(59,130,246,0.4)' }}
              onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 0 40px rgba(59,130,246,0.6)')}
              onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 0 30px rgba(59,130,246,0.4)')}>
              Começar agora
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </Link>
            <Link href="/auth/login"
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-4 rounded-xl text-base font-medium transition-all"
              style={{ border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', background: 'rgba(255,255,255,0.03)' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#f1f5f9'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.color = '#94a3b8'; }}>
              Já tenho conta
            </Link>
          </div>

          {/* Stats */}
          <div className="mt-20 grid grid-cols-3 gap-8 max-w-lg mx-auto">
            {[
              { value: '4', label: 'Agentes de IA' },
              { value: '3+', label: 'Integrações' },
              { value: '100%', label: 'Dados seguros' },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-3xl font-bold mb-1" style={{ color: '#3b82f6' }}>{stat.value}</div>
                <div className="text-xs" style={{ color: '#475569' }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <svg className="h-5 w-5" style={{ color: '#475569' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </section>

      {/* ── Integrações ── */}
      <section id="integracoes" className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <p className="text-center text-sm font-medium mb-10 uppercase tracking-widest" style={{ color: '#475569' }}>
            Integre com as principais plataformas
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: <MetaIcon />, name: 'Meta Ads' },
              { icon: <GoogleIcon />, name: 'Google Ads' },
              { icon: <GAIcon />, name: 'Google Analytics' },
              { icon: <KommoIcon />, name: 'Kommo CRM' },
            ].map((item) => (
              <div key={item.name}
                className="flex flex-col items-center gap-3 p-6 rounded-2xl transition-all"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                onMouseEnter={e => { e.currentTarget.style.border = '1px solid rgba(59,130,246,0.3)'; e.currentTarget.style.boxShadow = '0 0 20px rgba(59,130,246,0.1)'; }}
                onMouseLeave={e => { e.currentTarget.style.border = '1px solid rgba(255,255,255,0.06)'; e.currentTarget.style.boxShadow = 'none'; }}>
                {item.icon}
                <span className="text-sm font-medium" style={{ color: '#94a3b8' }}>{item.name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Funcionalidades ── */}
      <section id="funcionalidades" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ color: '#f1f5f9' }}>
              Tudo que você precisa para escalar
            </h2>
            <p className="text-lg" style={{ color: '#94a3b8' }}>
              Do dado bruto à decisão estratégica, em uma única plataforma.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {features.map((feature) => (
              <div key={feature.title}
                className="p-8 rounded-2xl transition-all"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                onMouseEnter={e => { e.currentTarget.style.border = '1px solid rgba(59,130,246,0.2)'; e.currentTarget.style.background = 'rgba(59,130,246,0.05)'; }}
                onMouseLeave={e => { e.currentTarget.style.border = '1px solid rgba(255,255,255,0.06)'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}>
                <div className="h-12 w-12 rounded-xl flex items-center justify-center mb-5"
                  style={{ background: 'rgba(59,130,246,0.12)', color: '#3b82f6' }}>
                  {feature.icon}
                </div>
                <h3 className="text-lg font-semibold mb-2" style={{ color: '#f1f5f9' }}>{feature.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: '#94a3b8' }}>{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Como funciona ── */}
      <section id="como-funciona" className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ color: '#f1f5f9' }}>
              Como funciona
            </h2>
            <p className="text-lg" style={{ color: '#94a3b8' }}>
              Comece a usar em menos de 5 minutos.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((step, i) => (
              <div key={step.number} className="relative">
                {i < steps.length - 1 && (
                  <div className="hidden md:block absolute top-6 left-full w-full h-px -translate-x-8"
                    style={{ background: 'linear-gradient(90deg, rgba(59,130,246,0.4), transparent)' }} />
                )}
                <div className="text-4xl font-bold mb-4" style={{ color: 'rgba(59,130,246,0.3)' }}>{step.number}</div>
                <h3 className="text-lg font-semibold mb-2" style={{ color: '#f1f5f9' }}>{step.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: '#94a3b8' }}>{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Final ── */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="relative overflow-hidden rounded-3xl p-12 text-center"
            style={{ background: 'linear-gradient(135deg, rgba(29,78,216,0.4) 0%, rgba(59,130,246,0.2) 50%, rgba(29,78,216,0.4) 100%)', border: '1px solid rgba(59,130,246,0.3)' }}>
            <div className="absolute inset-0 opacity-30"
              style={{ background: 'radial-gradient(circle at 50% 50%, rgba(59,130,246,0.4) 0%, transparent 70%)' }} />
            <div className="relative z-10">
              <h2 className="text-3xl md:text-4xl font-bold mb-4" style={{ color: '#f1f5f9' }}>
                Pronto para escalar seu marketing?
              </h2>
              <p className="text-lg mb-8" style={{ color: '#93c5fd' }}>
                Junte-se a times que já tomam decisões com dados centralizados e IA.
              </p>
              <Link href="/auth/register"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-xl text-base font-semibold text-white transition-all"
                style={{ background: '#3b82f6', boxShadow: '0 0 30px rgba(59,130,246,0.5)' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#2563eb')}
                onMouseLeave={e => (e.currentTarget.style.background = '#3b82f6')}>
                Criar conta gratuita
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="py-10 px-6" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-md flex items-center justify-center" style={{ background: '#3b82f6' }}>
              <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
              </svg>
            </div>
            <span className="text-sm font-semibold" style={{ color: '#f1f5f9' }}>Cortex Growth</span>
          </div>

          <p className="text-xs" style={{ color: '#475569' }}>
            © {new Date().getFullYear()} IA Cortex Tech. Todos os direitos reservados.
          </p>

          <div className="flex items-center gap-6">
            <Link href="/privacy" className="text-xs transition-colors" style={{ color: '#475569' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#94a3b8')}
              onMouseLeave={e => (e.currentTarget.style.color = '#475569')}>
              Política de Privacidade
            </Link>
            <a href="mailto:contato@iacortextech.com.br" className="text-xs transition-colors" style={{ color: '#475569' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#94a3b8')}
              onMouseLeave={e => (e.currentTarget.style.color = '#475569')}>
              Contato
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}