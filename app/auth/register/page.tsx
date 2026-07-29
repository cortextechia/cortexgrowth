'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { apiService } from '@/lib/api';
import type { BillingCycle, PlanOption } from '@/types';
import Link from 'next/link';

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// Identidade visual por plano. As cores são deliberadamente distintas entre si
// (ciano → violeta → âmbar) para o banner ser reconhecido pela cor, não pelo texto.
// O conteúdo de `inclui` vem do que os planos REALMENTE entregam (planLimits.ts):
// limite de usuários, cap de clientes no CRM e integração Kommo.
const IDENTIDADE: Record<string, {
  cor: string;
  corSuave: string;
  chamada: string;
  publico: string;
  inclui: string[];
}> = {
  STARTER: {
    cor: 'var(--plano-starter)',
    corSuave: 'var(--plano-starter-soft)',
    chamada: 'Para quem toca sozinho',
    publico: '1 usuário',
    inclui: ['Meta Ads e Google Ads no mesmo painel', 'CRM Cortex até 100 clientes', 'Relatórios e insights de IA'],
  },
  PROFESSIONAL: {
    cor: 'var(--plano-pro)',
    corSuave: 'var(--plano-pro-soft)',
    chamada: 'Para equipe pequena',
    publico: 'até 3 usuários',
    inclui: ['Tudo do Starter', 'CRM Cortex sem limite de clientes', 'Integração com o Kommo'],
  },
  ENTERPRISE: {
    cor: 'var(--plano-enterprise)',
    corSuave: 'var(--plano-enterprise-soft)',
    chamada: 'Para agência',
    publico: 'usuários ilimitados',
    inclui: ['Tudo do Professional', 'Usuários sem limite', 'Vários clientes na mesma conta'],
  },
};

const ROTULO_CICLO: Record<BillingCycle, string> = {
  MONTHLY: 'Mensal',
  SEMIANNUAL: 'Semestral',
  ANNUAL: 'Anual',
};

const brl = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function BannerPlano({
  opcao, ciclo, selecionado, onSelect,
}: {
  opcao: PlanOption;
  ciclo: BillingCycle;
  selecionado: boolean;
  onSelect: () => void;
}) {
  const id = IDENTIDADE[opcao.plan] ?? IDENTIDADE.STARTER!;
  const info = opcao.cycles.find((c) => c.cycle === ciclo) ?? opcao.cycles[0]!;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selecionado}
      className="banner-plano group relative w-full overflow-hidden rounded-2xl px-5 py-4 text-left"
      style={{
        background: selecionado
          ? `linear-gradient(100deg, ${id.corSuave} 0%, rgba(255,255,255,0.02) 62%)`
          : 'rgba(255,255,255,0.025)',
        border: `1px solid ${selecionado ? id.cor : 'var(--border)'}`,
        boxShadow: selecionado ? `0 0 0 1px ${id.cor}22, 0 14px 40px -22px ${id.cor}` : 'none',
      }}
    >
      {/* Barra de cor: identidade do plano mesmo quando não selecionado */}
      <span className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: id.cor, opacity: selecionado ? 1 : 0.45 }} />

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="text-sm font-bold tracking-wide" style={{ color: selecionado ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
              {opcao.plan}
            </span>
            {opcao.plan === 'PROFESSIONAL' && (
              <span className="whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                style={{ backgroundColor: id.cor, color: 'var(--bg-base)' }}>
                Mais escolhido
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
            {id.chamada} · {id.publico}
          </p>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-2xl font-extrabold leading-none tabular-nums tracking-tight"
            style={{ color: selecionado ? id.cor : 'var(--text-secondary)' }}>
            {brl(info.monthlyEquivalent)}
          </p>
          <p className="mt-1 text-[11px]" style={{ color: 'var(--text-muted)' }}>por mês</p>
        </div>
      </div>

      {/* A economia é o argumento do ciclo longo — precisa ser legível SEM precisar
          selecionar o plano, por isso mantém o verde nos dois estados. */}
      {ciclo !== 'MONTHLY' && (
        <p className="mt-2 text-[11px]" style={{ color: 'var(--badge-success-text)' }}>
          {brl(info.total)} a cada {info.months} meses · você economiza <strong>{brl(info.savings)}</strong>
        </p>
      )}

      {/* Só o plano escolhido abre a lista: mantém a coluna respirando */}
      <div className="grid transition-[grid-template-rows] duration-300"
        style={{ gridTemplateRows: selecionado ? '1fr' : '0fr' }}>
        <ul className="overflow-hidden">
          {id.inclui.map((item) => (
            <li key={item} className="mt-2 flex items-start gap-2 text-xs first:mt-3" style={{ color: 'var(--text-secondary)' }}>
              <span aria-hidden style={{ color: id.cor }}>✓</span>
              {item}
            </li>
          ))}
        </ul>
      </div>
    </button>
  );
}

function RegisterContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { register } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({ email: '', password: '', name: '', organizationName: '' });
  const [refCode, setRefCode] = useState<string | null>(null);
  const [claimToken, setClaimToken] = useState<string | null>(null);
  const [claimInfo, setClaimInfo] = useState<{ valid: boolean; organizationName?: string; managerName?: string | null } | null>(null);
  const [planos, setPlanos] = useState<PlanOption[]>([]);
  const [plano, setPlano] = useState('PROFESSIONAL');
  const [ciclo, setCiclo] = useState<BillingCycle>('MONTHLY');

  // Quem chega por claim assume uma org que já existe (e já tem plano) — não escolhe nada.
  const escolhePlano = !claimInfo?.valid;

  useEffect(() => {
    apiService.getPlans().then((r) => setPlanos(r.data)).catch(() => setPlanos([]));
  }, []);

  // Lê ref= (link de registro do gestor) e claim= (link para assumir um dashboard) da URL
  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref) setRefCode(ref);

    const claim = searchParams.get('claim');
    if (claim) {
      setClaimToken(claim);
      apiService.getClaimInfo(claim).then((res) => {
        setClaimInfo(res.data);
        if (res.data.valid && res.data.organizationName) {
          setFormData((prev) => ({ ...prev, organizationName: res.data.organizationName! }));
        }
      }).catch(() => setClaimInfo({ valid: false }));
    }
  }, [searchParams]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    setError(null);
    if (formData.password.length < 8) { setError('Senha deve ter no mínimo 8 caracteres'); return; }
    setIsLoading(true);
    try {
      const response = await register({
        ...formData,
        ...(escolhePlano ? { plan: plano, billingCycle: ciclo } : {}),
        ...(refCode ? { ref: refCode } : {}),
        ...(claimToken && claimInfo?.valid ? { claim: claimToken } : {}),
      });
      if (response.success) {
        // Quem entra por claim assume uma org que o gestor JÁ configurou — inclusive as
        // integrações, que são copiadas na criação do cliente. Mandar essa pessoa para o
        // wizard seria pedir que conectasse o que já está conectado.
        if (claimToken && claimInfo?.valid) {
          router.push('/dashboard');
          return;
        }
        sessionStorage.setItem('onboarding_new_account', 'true');
        router.push('/onboarding');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar conta. Tente novamente.');
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

  const planoAtual = planos.find((p) => p.plan === plano);
  const infoAtual = planoAtual?.cycles.find((c) => c.cycle === ciclo);

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ backgroundColor: 'var(--bg-base)' }}>
      {/* Foco de luz atrás dos banners — dá profundidade sem competir com as cores dos planos */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse at 22% 35%, var(--auth-glow-1) 0%, transparent 58%), radial-gradient(ellipse at 78% 80%, var(--auth-glow-2) 0%, transparent 50%)'
      }} />
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: 'linear-gradient(var(--auth-grid) 1px, transparent 1px), linear-gradient(90deg, var(--auth-grid) 1px, transparent 1px)',
        backgroundSize: '40px 40px'
      }} />

      <div className="relative z-10 mx-auto w-full max-w-6xl px-6 py-10 lg:py-14">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--accent)' }}>
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <span className="font-semibold text-lg" style={{ color: 'var(--text-primary)' }}>Cortex Growth</span>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1fr_400px] lg:gap-12 lg:items-start">

          {/* ── Planos ─────────────────────────────────────────────────── */}
          {escolhePlano ? (
            <div>
              <h1 className="text-3xl lg:text-4xl font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>
                Escolha o tamanho da{' '}
                <span style={{ background: 'linear-gradient(135deg, var(--plano-starter), var(--plano-pro) 55%, var(--plano-enterprise))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                  sua operação.
                </span>
              </h1>
              <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                Meta Ads, Google Ads e CRM no mesmo painel. Você troca de plano quando a operação crescer.
              </p>

              <div className="mt-6 inline-flex rounded-xl p-1" style={{ backgroundColor: 'var(--input-bg)', border: '1px solid var(--border)' }}>
                {(['MONTHLY', 'SEMIANNUAL', 'ANNUAL'] as const).map((c) => {
                  const ativo = ciclo === c;
                  const desconto = c === 'SEMIANNUAL' ? '−10%' : c === 'ANNUAL' ? '−20%' : null;
                  return (
                    <button key={c} type="button" onClick={() => setCiclo(c)}
                      aria-pressed={ativo}
                      className="rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors"
                      style={{
                        backgroundColor: ativo ? 'var(--input-border)' : 'transparent',
                        color: ativo ? 'var(--text-primary)' : 'var(--text-muted)',
                      }}>
                      {ROTULO_CICLO[c]}
                      {desconto && (
                        <span className="ml-1.5 font-bold" style={{ color: ativo ? 'var(--badge-success-text)' : 'var(--text-muted)' }}>{desconto}</span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 space-y-2.5">
                {planos.length === 0 ? (
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Carregando planos…</p>
                ) : (
                  planos.map((p) => (
                    <BannerPlano key={p.plan} opcao={p} ciclo={ciclo}
                      selecionado={plano === p.plan} onSelect={() => setPlano(p.plan)} />
                  ))
                )}
              </div>
            </div>
          ) : (
            <div>
              <h1 className="text-3xl font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>
                Seu painel está pronto.
              </h1>
              <p className="mt-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                Crie sua conta para assumir o painel <strong style={{ color: 'var(--text-secondary)' }}>{claimInfo?.organizationName}</strong>
                {claimInfo?.managerName ? <> , configurado por {claimInfo.managerName}</> : null}.
              </p>
            </div>
          )}

          {/* ── Formulário ─────────────────────────────────────────────── */}
          <div className="rounded-2xl p-7" style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            backdropFilter: 'blur(12px)',
          }}>
            <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Criar conta</h2>
            {escolhePlano && infoAtual && (
              <p className="mt-1 text-sm" style={{ color: 'var(--text-muted)' }}>
                {plano} · {ROTULO_CICLO[ciclo].toLowerCase()} ·{' '}
                <strong style={{ color: IDENTIDADE[plano]?.cor ?? 'var(--accent)' }}>
                  {brl(infoAtual.total)}
                </strong>
                {ciclo !== 'MONTHLY' && <> a cada {infoAtual.months} meses</>}
              </p>
            )}

            {refCode && !claimToken && (
              <div className="mt-4 flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs"
                style={{ backgroundColor: 'var(--accent-dim)', border: '1px solid var(--accent)', color: 'var(--accent)' }}>
                Você foi convidado por um gestor de tráfego.
              </div>
            )}

            {claimInfo && !claimInfo.valid && (
              <div className="mt-4 flex items-center gap-2 rounded-lg px-3 py-2.5 text-xs"
                style={{ backgroundColor: 'var(--badge-error-bg)', border: '1px solid var(--badge-error-text)', color: 'var(--badge-error-text)' }}>
                Convite inválido ou expirado. Você ainda pode criar uma conta normal.
              </div>
            )}

            {error && (
              <div className="mt-4 flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm"
                style={{ backgroundColor: 'var(--badge-error-bg)', border: '1px solid var(--badge-error-text)', color: 'var(--badge-error-text)' }}>
                {error}
              </div>
            )}

            <form onSubmit={(e) => { e.preventDefault(); void handleSubmit(); }} className="mt-5 space-y-4">
              <div>
                <label htmlFor="name" className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Nome completo</label>
                <input type="text" id="name" name="name" value={formData.name} onChange={handleChange} required
                  placeholder="Seu nome" className="w-full rounded-lg px-3 py-2.5 text-sm transition-all outline-none placeholder-slate-600"
                  style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
              </div>

              <div>
                <label htmlFor="organizationName" className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Nome da empresa</label>
                <input type="text" id="organizationName" name="organizationName" value={formData.organizationName} onChange={handleChange} required
                  readOnly={!!claimInfo?.valid}
                  placeholder="Minha Agência" className="w-full rounded-lg px-3 py-2.5 text-sm transition-all outline-none placeholder-slate-600"
                  style={claimInfo?.valid ? { ...inputStyle, opacity: 0.65, cursor: 'not-allowed' } : inputStyle}
                  onFocus={claimInfo?.valid ? undefined : onFocus} onBlur={claimInfo?.valid ? undefined : onBlur} />
                {claimInfo?.valid && (
                  <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>Definido pelo convite do gestor.</p>
                )}
              </div>

              <div>
                <label htmlFor="email" className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Email</label>
                <input type="email" id="email" name="email" value={formData.email} onChange={handleChange} required
                  placeholder="seu@email.com" className="w-full rounded-lg px-3 py-2.5 text-sm transition-all outline-none placeholder-slate-600"
                  style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
              </div>

              <div>
                <label htmlFor="password" className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Senha</label>
                <input type="password" id="password" name="password" value={formData.password} onChange={handleChange} required
                  placeholder="Mínimo 8 caracteres" className="w-full rounded-lg px-3 py-2.5 text-sm transition-all outline-none placeholder-slate-600"
                  style={inputStyle} onFocus={onFocus} onBlur={onBlur} />
              </div>

              <button type="submit" disabled={isLoading}
                className="flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold text-white transition-all disabled:opacity-60 disabled:cursor-not-allowed mt-1"
                style={{ backgroundColor: 'var(--accent)' }}
                onMouseEnter={(e) => { if (!isLoading) e.currentTarget.style.backgroundColor = 'var(--accent-dark)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'var(--accent)'; }}>
                {isLoading && <Spinner />}
                {isLoading ? 'Criando conta...' : 'Criar conta'}
              </button>
            </form>

            <p className="mt-5 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
              Já tem conta?{' '}
              <Link href="/auth/login" className="font-medium" style={{ color: 'var(--accent)' }}>Entrar</Link>
            </p>

            <p className="mt-3 text-center text-xs" style={{ color: 'var(--text-muted)' }}>
              Ao criar uma conta, você concorda com nossa{' '}
              <Link href="/privacy" className="hover:text-blue-400 transition-colors">política de privacidade</Link>.
            </p>
          </div>
        </div>

        <p className="mt-10 text-xs" style={{ color: 'var(--text-muted)' }}>
          © 2026 IA Cortex Tech ·{' '}
          <Link href="/privacy" className="hover:text-blue-400 transition-colors">Privacidade</Link>
        </p>
      </div>

      <style jsx>{`
        .banner-plano {
          transition: transform 180ms ease, border-color 180ms ease, box-shadow 180ms ease;
        }
        .banner-plano:hover {
          transform: translateY(-2px);
        }
        .banner-plano:focus-visible {
          outline: 2px solid var(--accent);
          outline-offset: 3px;
        }
        @media (prefers-reduced-motion: reduce) {
          .banner-plano,
          .banner-plano:hover {
            transition: none;
            transform: none;
          }
        }
      `}</style>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg-base)' }}><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" /></div>}>
      <RegisterContent />
    </Suspense>
  );
}
