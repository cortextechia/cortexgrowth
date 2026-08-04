// Selo de versão beta. Fica junto da marca (login e sidebar) para o cliente saber que
// o produto ainda está em testes sem que isso vire um aviso constante na tela.
export default function BetaBadge({ className = '' }: { className?: string }) {
  return (
    <span
      className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none tracking-wider ${className}`}
      style={{ backgroundColor: 'var(--accent-dim)', color: 'var(--accent)' }}
      title="Versão beta — em testes"
    >
      Beta
    </span>
  );
}
