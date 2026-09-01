import { Plan } from '@/types';

// ⚠️ Cópia da tabela do backend (cortexgrowth-backend/src/lib/planLimits.ts).
// Quem barra de verdade é a API; isto só desenha o contador e desabilita o botão
// antes do 403. Mudou lá, muda aqui — era este espelho fora de sincronia que fazia
// a tela dizer "limite atingido" com a API já liberada.
export const PLAN_USER_LIMITS: Record<Plan, number> = {
  [Plan.DEMO]:         4,
  [Plan.STARTER]:      1,
  [Plan.PROFESSIONAL]: 3,
  [Plan.ENTERPRISE]:   Infinity,
};

export const userLimitOf = (plan?: Plan | null): number =>
  plan ? (PLAN_USER_LIMITS[plan] ?? Infinity) : Infinity;

export const fmtUserLimit = (limit: number): string => (limit === Infinity ? '∞' : String(limit));
