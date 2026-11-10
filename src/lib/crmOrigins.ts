// Origem do card do CRM — ponto único das telas (funil, Contatos).
//
// Desde 10/11/2026 (pedido do Ruan): o seletor oferece os canais padrão + "Outro",
// e dentro de "Outro" as origens próprias da org (Loja, Landing page...).
// FACHADA ("Na loja") e ORGANICO saíram do seletor: ficam só para os cards antigos.
// No Dropdown, a origem própria viaja como "OUTRO:<rótulo>".

import type { CrmOrigin } from '@/types';

/** Rótulo de todas as origens, inclusive as que só existem em card antigo. */
export const ORIGIN_LABELS: Record<CrmOrigin, string> = {
  META: 'Meta Ads',
  GOOGLE: 'Google Ads',
  WHATSAPP: 'WhatsApp',
  INDICACAO: 'Indicação',
  LINK_BIO: 'Link da bio',
  INSTAGRAM: 'Direct do Instagram',
  OUTRO: 'Outro',
  FACHADA: 'Na loja',
  ORGANICO: 'Orgânico',
};

/** O que o seletor oferece (antes de "Outro"). */
export const STANDARD_ORIGINS: CrmOrigin[] = ['META', 'GOOGLE', 'WHATSAPP', 'INDICACAO', 'LINK_BIO', 'INSTAGRAM'];

const LEGACY: CrmOrigin[] = ['FACHADA', 'ORGANICO'];

const PREFIXO = 'OUTRO:';

export function originLabel(origin: CrmOrigin, customOrigin?: string | null): string {
  if (origin === 'OUTRO' && customOrigin) return customOrigin;
  return ORIGIN_LABELS[origin] ?? origin;
}

/** Valor do Dropdown para a origem do card. */
export function originValue(origin: CrmOrigin, customOrigin?: string | null): string {
  return origin === 'OUTRO' && customOrigin ? `${PREFIXO}${customOrigin}` : origin;
}

export function parseOriginValue(value: string): { origin: CrmOrigin; customOrigin: string | null } {
  if (value.startsWith(PREFIXO)) return { origin: 'OUTRO', customOrigin: value.slice(PREFIXO.length) };
  return { origin: value as CrmOrigin, customOrigin: null };
}

/**
 * Opções do seletor: canais padrão, depois as origens próprias como "Outro · X".
 * "Outro" sem especificar só aparece quando a org não tem lista ou o card já está nele.
 * A origem atual do card sempre aparece, mesmo antiga ou fora da lista.
 */
export function originOptions(
  customOrigins: string[],
  atual?: { origin: CrmOrigin; customOrigin?: string | null },
): { value: string; label: string }[] {
  const opcoes: { value: string; label: string }[] = STANDARD_ORIGINS.map((o) => ({ value: o, label: ORIGIN_LABELS[o] }));
  for (const c of customOrigins) opcoes.push({ value: `${PREFIXO}${c}`, label: `Outro · ${c}` });

  const atualOutroSolto = atual?.origin === 'OUTRO' && !atual.customOrigin;
  if (customOrigins.length === 0 || atualOutroSolto) opcoes.push({ value: 'OUTRO', label: 'Outro' });

  if (atual) {
    const v = originValue(atual.origin, atual.customOrigin);
    if (!opcoes.some((o) => o.value === v)) {
      const rotulo = atual.origin === 'OUTRO' ? `Outro · ${atual.customOrigin}` : ORIGIN_LABELS[atual.origin];
      opcoes.push({ value: v, label: LEGACY.includes(atual.origin) || atual.origin === 'OUTRO' ? `${rotulo} (antiga)` : rotulo });
    }
  }
  return opcoes;
}

/** Opções do filtro: todos os canais (inclusive os antigos, para achar os cards de antes) + origens próprias. */
export function originFilterOptions(customOrigins: string[]): { value: string; label: string }[] {
  return [
    ...STANDARD_ORIGINS.map((o) => ({ value: o, label: ORIGIN_LABELS[o] })),
    ...customOrigins.map((c) => ({ value: `${PREFIXO}${c}`, label: `Outro · ${c}` })),
    { value: 'OUTRO', label: 'Outro (todos)' },
    ...LEGACY.map((o) => ({ value: o, label: `${ORIGIN_LABELS[o]} (antiga)` })),
  ];
}

/** O card passa no filtro? "OUTRO" pega todos os de Outro; "OUTRO:X" só os de X. */
export function matchesOriginFilter(filter: string, origin: CrmOrigin, customOrigin?: string | null): boolean {
  if (!filter) return true;
  if (filter.startsWith(PREFIXO)) return origin === 'OUTRO' && customOrigin === filter.slice(PREFIXO.length);
  return origin === filter;
}
