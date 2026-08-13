'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuth } from '@/context/AuthContext';
import { apiService } from '@/lib/api';
import { IntegrationStatus, type SetupScore } from '@/types';

// ─── Steps ────────────────────────────────────────────────────────────────────

const STEPS = [
  { id: 'welcome', label: 'Início' },
  { id: 'meta', label: 'Meta' },
  { id: 'google', label: 'Google' },
  { id: 'business', label: 'Negócio' },
  { id: 'website', label: 'Site' },
  { id: 'done', label: 'Fim' },
] as const;

type StepId = (typeof STEPS)[number]['id'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function CheckIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

// ─── Progress bar ─────────────────────────────────────────────────────────────

function ProgressBar({ currentIndex }: { currentIndex: number }) {
  return (
    <div className="w-full max-w-sm mx-auto mb-8">
      <div className="flex items-center justify-between mb-2">
        {STEPS.map((step, i) => (
          <div key={step.id} className="flex items-center flex-1 last:flex-none">
            <div
              className="flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold shrink-0 transition-all"
              style={
                i < currentIndex
                  ? { backgroundColor: 'var(--accent)', color: '#fff' }
                  : i === currentIndex
                  ? { backgroundColor: 'var(--accent-dim)', border: '2px solid var(--accent)', color: 'var(--accent)' }
                  : { backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-md)', color: 'var(--text-muted)' }
              }
            >
              {i < currentIndex ? <CheckIcon className="h-3.5 w-3.5" /> : i + 1}
            </div>
            {i < STEPS.length - 1 && (
              <div
                className="flex-1 h-px mx-1 transition-all"
                style={{ backgroundColor: i < currentIndex ? 'var(--accent)' : 'var(--border-md)' }}
              />
            )}
          </div>
        ))}
      </div>
      <div className="flex justify-between">
        {STEPS.map((step, i) => (
          <span
            key={step.id}
            className="text-xs"
            style={{ color: i === currentIndex ? 'var(--text-secondary)' : 'var(--text-muted)', minWidth: 0 }}
          >
            {step.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Step: Welcome ────────────────────────────────────────────────────────────

function StepWelcome({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  const { user, organization } = useAuth();
  const [orgName, setOrgName] = useState(organization?.name ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleNext = async () => {
    const trimmed = orgName.trim();
    if (!trimmed) { setError('Informe o nome da empresa.'); return; }
    setError(null);
    if (trimmed !== organization?.name && organization?.id) {
      setIsSaving(true);
      try {
        await apiService.updateOrganization(organization.id, { name: trimmed });
      } catch {
        setError('Erro ao salvar o nome. Tente novamente.');
        setIsSaving(false);
        return;
      }
      setIsSaving(false);
    }
    onNext();
  };

  const inputStyle: React.CSSProperties = {
    backgroundColor: 'var(--input-bg)',
    border: '1px solid var(--input-border)',
    color: 'var(--text-primary)',
    outline: 'none',
  };

  return (
    <div className="text-center">
      <div className="mb-6 flex items-center justify-center">
        <div
          className="h-16 w-16 rounded-2xl flex items-center justify-center"
          style={{ backgroundColor: 'var(--accent-dim)', border: '1px solid var(--accent-dim)' }}
        >
          <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} style={{ color: 'var(--accent)' }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
          </svg>
        </div>
      </div>

      <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
        Bem-vindo, {user?.name?.split(' ')[0]}!
      </h1>
      <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
        Vamos configurar sua conta em menos de 5 minutos.
      </p>

      <div className="text-left mb-6">
        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
          Nome da empresa / workspace
        </label>
        <input
          type="text"
          value={orgName}
          onChange={e => { setOrgName(e.target.value); setError(null); }}
          placeholder="Minha Agência"
          className="w-full rounded-lg px-3 py-2.5 text-sm placeholder-slate-600 transition-all"
          style={inputStyle}
          onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 3px var(--accent-dim)'; }}
          onBlur={e => { e.target.style.borderColor = 'var(--input-border)'; e.target.style.boxShadow = 'none'; }}
        />
        {error && (
          <p className="mt-1.5 text-xs" style={{ color: 'var(--badge-error-text)' }}>{error}</p>
        )}
      </div>

      <div className="space-y-3 text-left mb-8 rounded-xl p-4" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
        {[
          { label: 'Conectar Meta Ads', desc: 'Sincronize campanhas e gastos' },
          { label: 'Conectar Google Ads', desc: 'Unifique métricas de performance' },
          { label: 'Contar o que sua empresa faz', desc: 'O que vende, para quem e por que te escolhem' },
          { label: 'Informar site e Instagram', desc: 'Liga o diagnóstico de presença digital' },
        ].map((item, i) => (
          <div key={i} className="flex items-start gap-3">
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold mt-0.5"
              style={{ backgroundColor: 'var(--accent-dim)', border: '1px solid var(--accent-dim)', color: 'var(--accent)' }}
            >
              {i + 1}
            </div>
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{item.label}</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{item.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <button
          onClick={() => void handleNext()}
          disabled={isSaving}
          className="w-full flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium text-white transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          style={{ backgroundColor: 'var(--accent)' }}
          onMouseEnter={e => { if (!isSaving) e.currentTarget.style.backgroundColor = 'var(--accent-dark)'; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'var(--accent)'; }}
        >
          {isSaving && <Spinner />}
          {isSaving ? 'Salvando...' : 'Começar configuração'}
        </button>
        <button
          onClick={onSkip}
          className="w-full rounded-lg py-2.5 text-sm transition-all"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-muted)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; }}
        >
          Pular e ir para o dashboard
        </button>
      </div>
    </div>
  );
}

// ─── Step: OAuth (Meta / Google) ──────────────────────────────────────────────

type OAuthProvider = 'meta' | 'google_ads';

const PROVIDER_META = {
  key: 'META_ADS' as const,
  label: 'Meta Ads',
  desc: 'Facebook & Instagram Ads',
  color: '#1877F2',
  dimColor: 'rgba(24,119,242,0.12)',
  borderColor: 'rgba(24,119,242,0.3)',
  icon: (
    <svg className="h-7 w-7" viewBox="0 0 24 24" fill="#1877F2">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  ),
};

const PROVIDER_GOOGLE = {
  key: 'GOOGLE_ADS' as const,
  label: 'Google Ads',
  desc: 'Search, Display & YouTube',
  color: '#4285F4',
  dimColor: 'rgba(66,133,244,0.12)',
  borderColor: 'rgba(66,133,244,0.3)',
  icon: (
    <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  ),
};

function StepOAuth({
  provider,
  onNext,
  onSkip,
}: {
  provider: OAuthProvider;
  onNext: () => void;
  onSkip: () => void;
}) {
  const cfg = provider === 'meta' ? PROVIDER_META : PROVIDER_GOOGLE;
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);

  const checkStatus = useCallback(async () => {
    try {
      const res = await apiService.getIntegrations();
      const match = res.integrations.find((i) => i.type === cfg.key);
      setIsConnected(match?.status === IntegrationStatus.CONNECTED);
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, [cfg.key]);

  useEffect(() => {
    void checkStatus();
  }, [checkStatus]);

  // When user returns from OAuth, recheck status
  useEffect(() => {
    const onFocus = () => void checkStatus();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [checkStatus]);

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('onboarding_active', 'true');
      }
      const url = await apiService.getOAuthUrl(provider);
      window.location.href = url;
    } catch {
      setIsConnecting(false);
    }
  };

  return (
    <div className="text-center">
      <div className="mb-6 flex items-center justify-center">
        <div
          className="h-16 w-16 rounded-2xl flex items-center justify-center"
          style={{ backgroundColor: cfg.dimColor, border: `1px solid ${cfg.borderColor}` }}
        >
          {cfg.icon}
        </div>
      </div>

      <h1 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
        Conectar {cfg.label}
      </h1>
      <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
        {cfg.desc} — sincronize gastos, leads e conversões automaticamente.
      </p>

      {isLoading ? (
        <div className="flex justify-center py-4">
          <Spinner />
        </div>
      ) : isConnected ? (
        <div
          className="flex items-center gap-3 rounded-xl p-4 mb-6"
          style={{ backgroundColor: 'var(--badge-success-bg)', border: '1px solid var(--badge-success-text)' }}
        >
          <div className="flex items-center justify-center h-8 w-8 rounded-full" style={{ backgroundColor: 'var(--badge-success-bg)' }}>
            <CheckIcon className="h-4 w-4" />
          </div>
          <div className="text-left">
            <p className="text-sm font-medium" style={{ color: 'var(--badge-success-text)' }}>{cfg.label} conectado</p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Integração ativa e sincronizando dados</p>
          </div>
        </div>
      ) : (
        <button
          onClick={() => void handleConnect()}
          disabled={isConnecting}
          className="w-full flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium text-white mb-4 transition-all disabled:opacity-60"
          style={{ backgroundColor: cfg.color }}
        >
          {isConnecting && <Spinner />}
          {isConnecting ? 'Redirecionando...' : `Conectar ${cfg.label}`}
        </button>
      )}

      <div className="flex flex-col gap-3 mt-4">
        <button
          onClick={onNext}
          className="w-full rounded-lg py-2.5 text-sm font-medium text-white transition-all"
          style={{ backgroundColor: isConnected ? 'var(--accent)' : 'var(--accent-dim)', color: isConnected ? '#fff' : 'var(--accent)' }}
          onMouseEnter={e => { if (isConnected) e.currentTarget.style.backgroundColor = 'var(--accent-dark)'; }}
          onMouseLeave={e => { if (isConnected) e.currentTarget.style.backgroundColor = 'var(--accent)'; }}
        >
          {isConnected ? 'Continuar' : 'Continuar assim mesmo'}
        </button>
        <button
          onClick={onSkip}
          className="w-full rounded-lg py-2.5 text-sm transition-all"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-muted)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; }}
        >
          Pular por agora
        </button>
      </div>
    </div>
  );
}

// ─── Step: Sobre o negócio ────────────────────────────────────────────────────
//
// Três perguntas que só o cliente sabe responder (feedback Ruan, 12/08): antes elas
// existiam apenas em /dashboard/perfil, e quem nunca abria aquela tela deixava a IA
// escrevendo sobre a empresa sem saber o que ela vende. Grava nos MESMOS campos do
// perfil (PUT /api/profile) — nada de segunda cópia do dado.
//
// O backend valida a resposta e devolve 422 com uma repergunta por campo; nada é gravado
// nesse caso. A repergunta aparece embaixo do campo e o passo continua pulável: onboarding
// que trava não é onboarding.

const PERGUNTAS = [
  {
    campo: 'productDescription' as const,
    label: 'O que a sua empresa vende, exatamente?',
    placeholder: 'Ex: corte e dobra de aço para construção civil, com entrega na obra',
  },
  {
    campo: 'idealCustomer' as const,
    label: 'Quem é o cliente que mais compra de você?',
    placeholder: 'Ex: construtoras de médio porte que tocam de 3 a 10 obras por ano',
  },
  {
    campo: 'differentiator' as const,
    label: 'Por que ele escolhe você e não o concorrente?',
    placeholder: 'Ex: entrega em 48h e corte sob medida sem custo extra',
  },
];

function StepBusiness({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [rejeitados, setRejeitados] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    const preenchidos = Object.fromEntries(
      Object.entries(respostas).filter(([, v]) => v.trim().length > 0)
    );
    if (Object.keys(preenchidos).length === 0) { onNext(); return; }

    setError(null);
    setRejeitados({});
    setIsSaving(true);
    try {
      await apiService.updateCompanyProfile(preenchidos);
      onNext();
    } catch (err: unknown) {
      const resp = (err as { response?: { status?: number; data?: { data?: { rejected?: Record<string, string> } } } }).response;
      if (resp?.status === 422 && resp.data?.data?.rejected) {
        setRejeitados(resp.data.data.rejected);
      } else {
        setError('Não consegui salvar agora. Tente de novo ou siga em frente — dá para responder depois no seu perfil.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    backgroundColor: 'var(--input-bg)',
    border: '1px solid var(--input-border)',
    color: 'var(--text-primary)',
    outline: 'none',
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-center">
        <div
          className="h-16 w-16 rounded-2xl flex items-center justify-center"
          style={{ backgroundColor: 'var(--accent-dim)', border: '1px solid var(--accent-dim)' }}
        >
          <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} style={{ color: 'var(--accent)' }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5A.75.75 0 0114.25 12h3a.75.75 0 01.75.75V21m-9 0V6.75A.75.75 0 016.75 6h3a.75.75 0 01.75.75V21m-9 0h18M3 21h18M6 12h.008v.008H6V12zm0 3h.008v.008H6V15z" />
          </svg>
        </div>
      </div>

      <h1 className="text-xl font-bold mb-2 text-center" style={{ color: 'var(--text-primary)' }}>
        Sobre o seu negócio
      </h1>
      <p className="text-sm mb-6 text-center" style={{ color: 'var(--text-muted)' }}>
        A parte que nenhuma integração descobre sozinha. É o que a IA lê antes de escrever
        qualquer análise ou anúncio sobre a sua empresa.
      </p>

      {error && (
        <div className="mb-4 rounded-lg px-3 py-2.5 text-xs" style={{ backgroundColor: 'var(--badge-error-bg)', border: '1px solid var(--badge-error-text)', color: 'var(--badge-error-text)' }}>
          {error}
        </div>
      )}

      <div className="space-y-4">
        {PERGUNTAS.map(({ campo, label, placeholder }) => (
          <div key={campo}>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              {label}
            </label>
            <textarea
              rows={2}
              value={respostas[campo] ?? ''}
              onChange={(e) => {
                setRespostas((r) => ({ ...r, [campo]: e.target.value }));
                // Digitou de novo? A repergunta daquele campo some (os outros ficam).
                setRejeitados((r) => {
                  if (!(campo in r)) return r;
                  const resto = { ...r };
                  delete resto[campo];
                  return resto;
                });
              }}
              placeholder={placeholder}
              className="w-full rounded-lg px-3 py-2.5 text-sm placeholder-slate-600 transition-all resize-none"
              // `border` inteiro, não `borderColor` por cima: misturar shorthand com longhand
              // faz o React avisar no console e pode deixar a borda presa na cor de erro.
              style={{ ...inputStyle, border: `1px solid ${rejeitados[campo] ? 'var(--badge-warn-text)' : 'var(--input-border)'}` }}
              onFocus={e => { if (!rejeitados[campo]) { e.target.style.border = '1px solid var(--accent)'; e.target.style.boxShadow = '0 0 0 3px var(--accent-dim)'; } }}
              onBlur={e => { if (!rejeitados[campo]) { e.target.style.border = '1px solid var(--input-border)'; } e.target.style.boxShadow = 'none'; }}
            />
            {rejeitados[campo] && (
              <p className="mt-1.5 text-xs" style={{ color: 'var(--badge-warn-text)' }}>{rejeitados[campo]}</p>
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 mt-6">
        <button
          onClick={() => void handleSave()}
          disabled={isSaving}
          className="w-full flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium text-white transition-all disabled:opacity-60"
          style={{ backgroundColor: 'var(--accent)' }}
          onMouseEnter={e => { if (!isSaving) e.currentTarget.style.backgroundColor = 'var(--accent-dark)'; }}
          onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'var(--accent)'; }}
        >
          {isSaving && <Spinner />}
          {isSaving ? 'Salvando...' : 'Salvar e continuar'}
        </button>
        <button
          onClick={onSkip}
          className="w-full rounded-lg py-2.5 text-sm transition-all"
          style={{ color: 'var(--text-muted)' }}
        >
          Pular por agora
        </button>
      </div>
    </div>
  );
}

// ─── Step: Website URL ────────────────────────────────────────────────────────

function StepWebsite({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [instagram, setInstagram] = useState('');
  // 5 = mesmo teto do backend (MAX_COMPETITORS) e da tela de SEO
  const [competitors, setCompetitors] = useState(['', '', '', '', '']);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    const site = websiteUrl.trim();
    const insta = instagram.trim();
    // Instagram vive no perfil da empresa e o site na config de SEO — quem preencheu só um
    // dos dois salva só um dos dois, em vez de perder a resposta que deu.
    if (!site && !insta) { onNext(); return; }
    setError(null);
    setIsSaving(true);
    try {
      if (site) {
        const validCompetitors = competitors.filter((u) => u.trim().length > 0);
        await apiService.updateSeoConfig({
          websiteUrl: site,
          competitorUrls: validCompetitors,
        });
      }
      if (insta) {
        await apiService.updateCompanyProfile({ instagramUrl: insta });
      }
      setSaved(true);
      setTimeout(onNext, 500);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
      setError(msg ?? (err instanceof Error ? err.message : 'Erro ao salvar. Tente novamente.'));
    } finally {
      setIsSaving(false);
    }
  };

  const inputStyle = {
    backgroundColor: 'var(--input-bg)',
    border: '1px solid var(--input-border)',
    color: 'var(--text-primary)',
    outline: 'none',
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-center">
        <div
          className="h-16 w-16 rounded-2xl flex items-center justify-center"
          style={{ backgroundColor: 'var(--creative-accent-bg)', border: '1px solid var(--creative-accent-border)' }}
        >
          <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} style={{ color: 'var(--creative-accent-text)' }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
          </svg>
        </div>
      </div>

      <h1 className="text-xl font-bold mb-2 text-center" style={{ color: 'var(--text-primary)' }}>
        Onde a sua empresa está na internet
      </h1>
      <p className="text-sm mb-6 text-center" style={{ color: 'var(--text-muted)' }}>
        Com o site geramos o diagnóstico de como você aparece no Google e para as IAs.
        Não tem site? Deixe em branco e informe só o Instagram.
      </p>

      {error && (
        <div className="mb-4 rounded-lg px-3 py-2.5 text-xs" style={{ backgroundColor: 'var(--badge-error-bg)', border: '1px solid var(--badge-error-text)', color: 'var(--badge-error-text)' }}>
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
            URL do seu site <span style={{ color: 'var(--text-muted)' }}>(necessário para o diagnóstico)</span>
          </label>
          <input
            type="url"
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            placeholder="https://www.seusite.com.br"
            className="w-full rounded-lg px-3 py-2.5 text-sm placeholder-slate-600 transition-all"
            style={inputStyle}
            onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 3px var(--accent-dim)'; }}
            onBlur={e => { e.target.style.borderColor = 'var(--input-border)'; e.target.style.boxShadow = 'none'; }}
          />
        </div>

        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
            Instagram da empresa <span style={{ color: 'var(--text-muted)' }}>(opcional)</span>
          </label>
          <input
            type="text"
            value={instagram}
            onChange={(e) => setInstagram(e.target.value)}
            placeholder="@suaempresa"
            className="w-full rounded-lg px-3 py-2.5 text-sm placeholder-slate-600 transition-all"
            style={inputStyle}
            onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 3px var(--accent-dim)'; }}
            onBlur={e => { e.target.style.borderColor = 'var(--input-border)'; e.target.style.boxShadow = 'none'; }}
          />
        </div>

        <div>
          <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
            Concorrentes <span style={{ color: 'var(--text-muted)' }}>(opcional, até 5)</span>
          </label>
          <div className="space-y-2">
            {competitors.map((url, i) => (
              <input
                key={i}
                type="url"
                value={url}
                onChange={(e) => {
                  const next = [...competitors];
                  next[i] = e.target.value;
                  setCompetitors(next);
                }}
                placeholder={`https://concorrente${i + 1}.com.br`}
                className="w-full rounded-lg px-3 py-2.5 text-sm placeholder-slate-600 transition-all"
                style={inputStyle}
                onFocus={e => { e.target.style.borderColor = 'var(--accent)'; e.target.style.boxShadow = '0 0 0 3px var(--accent-dim)'; }}
                onBlur={e => { e.target.style.borderColor = 'var(--input-border)'; e.target.style.boxShadow = 'none'; }}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 mt-6">
        <button
          onClick={() => void handleSave()}
          disabled={isSaving}
          className="w-full flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium text-white transition-all disabled:opacity-60"
          style={{ backgroundColor: saved ? 'var(--badge-success-text)' : 'var(--accent)' }}
          onMouseEnter={e => { if (!isSaving && !saved) e.currentTarget.style.backgroundColor = 'var(--accent-dark)'; }}
          onMouseLeave={e => { if (!isSaving && !saved) e.currentTarget.style.backgroundColor = 'var(--accent)'; }}
        >
          {isSaving && <Spinner />}
          {saved ? <><CheckIcon className="h-4 w-4" /> Salvo!</> : isSaving ? 'Salvando...' : (websiteUrl.trim() || instagram.trim()) ? 'Salvar e continuar' : 'Continuar sem informar'}
        </button>
        <button
          onClick={onSkip}
          className="w-full rounded-lg py-2.5 text-sm transition-all"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-muted)'; }}
          onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; }}
        >
          Pular por agora
        </button>
      </div>
    </div>
  );
}

// ─── Step: Done ───────────────────────────────────────────────────────────────

/**
 * Passo final do wizard.
 *
 * NÃO diz mais "Tudo pronto!". O wizard cobre só as conexões (Meta, Google, site),
 * que valem 40 dos 100 pontos do Setup Score — declarar a conta configurada aqui
 * fazia a plataforma dizer "pronto" com o cliente pela metade, e o item sumia do menu.
 * Agora mostra a nota real e entrega para o Perfil da conta, que é permanente.
 */
function StepDone({ onFinish }: { onFinish: (destino: string) => void }) {
  const [isFinishing, setIsFinishing] = useState(false);
  const [score, setScore] = useState<SetupScore | null>(null);

  useEffect(() => {
    // Falha silenciosa: a nota é um bônus na tela, não pode segurar a saída do wizard.
    apiService
      .getCompanyProfile()
      .then((r) => setScore(r.data.setupScore))
      .catch(() => setScore(null));
  }, []);

  const handleFinish = async (destino: string) => {
    setIsFinishing(true);
    try {
      await apiService.completeOnboarding();
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('onboarding_active');
        sessionStorage.removeItem('onboarding_new_account');
      }
    } catch {
      // Non-blocking — proceed even if endpoint fails
    }
    onFinish(destino);
  };

  const faltando = score ? 100 - score.score : null;

  return (
    <div className="text-center">
      <div className="mb-6 flex items-center justify-center">
        <div
          className="h-16 w-16 rounded-full flex items-center justify-center"
          style={{ backgroundColor: 'var(--badge-success-bg)', border: '1px solid var(--badge-success-text)' }}
        >
          <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: 'var(--badge-success-text)' }}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
      </div>

      <h1 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
        Conexões prontas!
      </h1>
      <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
        {score
          ? `A plataforma já consegue fazer ${score.score}% do que ela faz por você. O que falta não é técnico — é o que só você sabe sobre o seu negócio.`
          : 'O diagnóstico de SEO/AIO será gerado automaticamente em breve.'}
      </p>

      {score && (
        <div
          className="rounded-xl p-4 mb-6 text-left"
          style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
        >
          <div className="flex justify-between items-baseline mb-2">
            <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>Perfil da conta</span>
            <span className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>{score.score} de 100</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden mb-3" style={{ backgroundColor: 'var(--bg-surface)' }}>
            <div style={{ width: `${score.score}%`, height: '100%', backgroundColor: 'var(--accent)' }} />
          </div>
          <p className="text-[11px] leading-snug" style={{ color: 'var(--text-muted)' }}>
            Faltam <b style={{ color: 'var(--text-primary)' }}>{faltando} pontos</b> — perguntas sobre o que você
            vende, quem compra e o que é um lead bom. São elas que a IA lê antes de escrever o seu relatório.
            Leva uns 3 minutos e <b style={{ color: 'var(--text-primary)' }}>nada trava se você deixar para depois</b>.
          </p>
        </div>
      )}

      <button
        onClick={() => void handleFinish('/dashboard/perfil')}
        disabled={isFinishing}
        className="w-full flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium text-white transition-all disabled:opacity-60"
        style={{ backgroundColor: 'var(--accent)' }}
        onMouseEnter={e => { if (!isFinishing) e.currentTarget.style.backgroundColor = 'var(--accent-dark)'; }}
        onMouseLeave={e => { if (!isFinishing) e.currentTarget.style.backgroundColor = 'var(--accent)'; }}
      >
        {isFinishing && <Spinner />}
        {isFinishing ? 'Abrindo...' : 'Completar meu perfil'}
      </button>

      <button
        onClick={() => void handleFinish('/dashboard')}
        disabled={isFinishing}
        className="w-full mt-2 rounded-lg py-2 text-xs transition-colors disabled:opacity-60"
        style={{ color: 'var(--text-muted)' }}
      >
        Ir direto para o dashboard
      </button>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

function OnboardingContent() {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);

  const next = () => setStepIndex((i) => Math.min(i + 1, STEPS.length - 1));
  const skip = () => {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('onboarding_active');
      sessionStorage.removeItem('onboarding_new_account');
    }
    router.push('/dashboard');
  };
  const finish = (destino: string) => router.push(destino);

  const currentStep = STEPS[stepIndex].id;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4" style={{ backgroundColor: 'var(--bg-base)' }}>
      {/* Background gradient */}
      <div className="fixed inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse at 50% 0%, var(--auth-glow-1) 0%, transparent 60%)',
      }} />

      <div className="relative z-10 w-full" style={{ maxWidth: '420px' }}>
        {/* Logo */}
        <div className="flex items-center gap-2 mb-8 justify-center">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--accent)' }}>
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>Cortex Growth</span>
        </div>

        <ProgressBar currentIndex={stepIndex} />

        {/* Card */}
        <div
          className="rounded-2xl p-8"
          style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border)',
            backdropFilter: 'blur(12px)',
          }}
        >
          {currentStep === 'welcome' && <StepWelcome onNext={next} onSkip={skip} />}
          {currentStep === 'meta' && <StepOAuth provider="meta" onNext={next} onSkip={skip} />}
          {currentStep === 'google' && <StepOAuth provider="google_ads" onNext={next} onSkip={skip} />}
          {currentStep === 'business' && <StepBusiness onNext={next} onSkip={skip} />}
          {currentStep === 'website' && <StepWebsite onNext={next} onSkip={skip} />}
          {currentStep === 'done' && <StepDone onFinish={finish} />}
        </div>
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <ProtectedRoute>
      <OnboardingContent />
    </ProtectedRoute>
  );
}
