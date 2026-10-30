import { useId } from 'react';

// Marca Cromalex: arco cromado + bloco limão (mesmo desenho da landing).
// O id do gradiente é único por instância — o menu desenha o logo duas vezes (mobile e desktop).
export default function LogoCromalex({ size = 28 }: { size?: number }) {
  const gradId = `logo-cromalex-${useId().replace(/:/g, '')}`;
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" className="shrink-0">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--logo-1)' }} />
          <stop offset="0.45" style={{ stopColor: 'var(--logo-2)' }} />
          <stop offset="0.6" style={{ stopColor: 'var(--logo-3)' }} />
          <stop offset="1" style={{ stopColor: 'var(--logo-4)' }} />
        </linearGradient>
      </defs>
      <path d="M31 11 A14 14 0 1 0 31 29" fill="none" stroke={`url(#${gradId})`} strokeWidth="7" strokeLinecap="round" />
      <rect x="27" y="16.5" width="9" height="7" rx="2" style={{ fill: 'var(--accent-fill)' }} />
    </svg>
  );
}
