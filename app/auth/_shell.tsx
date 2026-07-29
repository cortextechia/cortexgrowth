'use client';

// Casca visual compartilhada das telas de auth secundárias (verificar e-mail,
// esqueci a senha, nova senha). As telas de login e registro têm layout próprio
// com o painel de branding e não usam isto — não vale reescrevê-las agora.

const TOM = {
  neutro:  { cor: '#f1f5f9', fundo: 'rgba(59,130,246,0.15)',  borda: 'rgba(59,130,246,0.3)' },
  sucesso: { cor: '#86efac', fundo: 'rgba(34,197,94,0.12)',   borda: 'rgba(34,197,94,0.3)' },
  erro:    { cor: '#fca5a5', fundo: 'rgba(239,68,68,0.12)',   borda: 'rgba(239,68,68,0.3)' },
} as const;

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 relative overflow-hidden" style={{ backgroundColor: '#080d19' }}>
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse at 30% 40%, rgba(59,130,246,0.16) 0%, transparent 55%)'
      }} />
      <div className="relative z-10 w-full" style={{ maxWidth: '400px' }}>
        <div className="flex items-center gap-2 mb-6 justify-center">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: '#3b82f6' }}>
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
      backgroundColor: 'rgba(15,22,41,0.85)',
      border: '1px solid rgba(255,255,255,0.06)',
      backdropFilter: 'blur(12px)',
    }}>
      <div className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full"
        style={{ backgroundColor: t.fundo, border: `1px solid ${t.borda}` }}>
        <span className="text-lg" style={{ color: t.cor }}>
          {tom === 'sucesso' ? '✓' : tom === 'erro' ? '!' : '✉'}
        </span>
      </div>
      <h1 className="text-center text-xl font-bold mb-3" style={{ color: '#f1f5f9' }}>{titulo}</h1>
      {children}
    </div>
  );
}

export const inputStyle = {
  backgroundColor: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  color: '#f1f5f9',
};
