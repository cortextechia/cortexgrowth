'use client';

// Casca visual compartilhada das telas de auth secundárias (verificar e-mail,
// esqueci a senha, nova senha). As telas de login e registro têm layout próprio
// com o painel de branding e não usam isto — não vale reescrevê-las agora.

const TOM = {
  neutro:  { cor: 'var(--text-primary)', fundo: 'rgba(59,130,246,0.15)',  borda: 'rgba(59,130,246,0.3)' },
  sucesso: { cor: 'var(--badge-success-text)', fundo: 'rgba(34,197,94,0.12)',   borda: 'rgba(34,197,94,0.3)' },
  erro:    { cor: 'var(--badge-error-text)', fundo: 'rgba(239,68,68,0.12)',   borda: 'rgba(239,68,68,0.3)' },
} as const;

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 relative overflow-hidden" style={{ backgroundColor: 'var(--bg-base)' }}>
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse at 30% 40%, rgba(59,130,246,0.16) 0%, transparent 55%)'
      }} />
      <div className="relative z-10 w-full" style={{ maxWidth: '400px' }}>
        <div className="flex items-center gap-2 mb-6 justify-center">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--accent)' }}>
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <span className="text-white font-semibold">Cortex Growth</span>
        </div>
        {children}
      </div>
    </div>
  );
}

export function Caixa({
  titulo,
  children,
  tom = 'neutro',
}: {
  titulo: string;
  children: React.ReactNode;
  tom?: keyof typeof TOM;
}) {
  const t = TOM[tom];
  return (
    <div className="rounded-2xl p-8" style={{
      backgroundColor: 'var(--bg-surface)',
      border: '1px solid var(--border)',
      backdropFilter: 'blur(12px)',
    }}>
      <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full"
        style={{ backgroundColor: t.fundo, border: `1px solid ${t.borda}` }}>
        <span className="text-lg" style={{ color: t.cor }}>
          {tom === 'sucesso' ? '✓' : tom === 'erro' ? '!' : '✉'}
        </span>
      </div>
      <h1 className="text-center text-xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>{titulo}</h1>
      {children}
    </div>
  );
}

export const inputStyle = {
  backgroundColor: 'var(--input-bg)',
  border: '1px solid var(--input-border)',
  color: 'var(--text-primary)',
};
