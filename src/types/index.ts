// ===== ENUMS =====
export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  USER = 'USER',
  VIEWER = 'VIEWER',
  TRAFFIC_MANAGER = 'TRAFFIC_MANAGER',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
}

export enum Plan {
  // Porta de entrada de R$ 10/mês, só no ciclo mensal (2026-08-05).
  DEMO = 'DEMO',
  STARTER = 'STARTER',
  PROFESSIONAL = 'PROFESSIONAL',
  ENTERPRISE = 'ENTERPRISE',
}

export enum OrgStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  CANCELLED = 'CANCELLED',
}

export enum IntegrationType {
  FACEBOOK = 'FACEBOOK',
  GOOGLE_ADS = 'GOOGLE_ADS',
  GOOGLE_ANALYTICS = 'GOOGLE_ANALYTICS',
  KOMMO = 'KOMMO',
  META_ADS = 'META_ADS',
  CRM_CORTEX = 'CRM_CORTEX',
}

export enum IntegrationStatus {
  CONNECTED = 'CONNECTED',
  DISCONNECTED = 'DISCONNECTED',
  ERROR = 'ERROR',
  EXPIRED = 'EXPIRED',
}

// ===== USUARIO =====
export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: UserRole;
  status: UserStatus;
  emailVerified: boolean;
  organizationId: string;
  organization?: Organization;
  integrations?: Integration[];
  createdAt: Date;
  updatedAt: Date;
}

// ===== ORGANIZAÇÃO =====
export interface Organization {
  id: string;
  name: string;
  slug: string;
  domain?: string;
  logo?: string;
  plan: Plan;
  status: OrgStatus;
  stripeCustomerId?: string;
  subscriptionEnds?: Date;
  websiteUrl?: string;
  onboardingCompletedAt?: string;
  createdAt: Date;
  updatedAt: Date;
  _count?: { users: number; integrations: number };
}

// ===== INTEGRAÇÃO =====
export interface Integration {
  id: string;
  type: IntegrationType;
  name: string;
  status: IntegrationStatus;
  externalId?: string;
  externalName?: string;
  tokenExpires?: Date;
  userId: string;
  organizationId: string;
  createdAt: Date;
  updatedAt: Date;
}

// ===== AUTENTICAÇÃO =====
export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  organizationName: string;
  // Escolhidos na tela de cadastro. Ausentes em quem entra por link de claim
  // (a org já existe e já tem plano).
  plan?: string;
  billingCycle?: BillingCycle;
  ref?: string;
  claim?: string;
}

export interface PlanOption {
  plan: string;
  monthlyListPrice: number;
  cycles: {
    cycle: BillingCycle;
    months: number;
    total: number;
    monthlyEquivalent: number;
    savings: number;
  }[];
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface AuthContextType {
  user: User | null;
  organization: Organization | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  register: (data: RegisterRequest) => Promise<AuthResponse>;
  login: (data: LoginRequest) => Promise<AuthResponse>;
  logout: () => Promise<void> | void;
  updateProfile: (data: Partial<User>) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

// ===== AI INSIGHTS =====
export interface AgentOutput {
  alerts: string[];
  recommendations: string[];
  score: number;
  summary: string;
}

export interface AiAnalysisContent {
  marketing?: AgentOutput;
  sales?: AgentOutput;
  roas?: AgentOutput;
  orchestrator?: {
    overallScore: number;
    priorityAlerts: string[];
    topRecommendations: string[];
    executiveSummary: string;
  };
  generatedAt?: string;
  period?: string;
}

export interface AiAnalysis {
  id: string;
  organizationId: string;
  type: string;
  period: string;
  content: AiAnalysisContent;
  tokensUsed?: number;
  createdAt: string;
}


export interface AttributionSummary {
  roas: number | null;
  roasMeta: number | null;
  roasGoogle: number | null;
  cac: number | null;
  revenue: number;
  revenueMeta: number;
  revenueGoogle: number;
  pipelineValue: number;
  spend: number;
  spendMeta: number;
  spendGoogle: number;
  attributedLeads: number;
  paidChannelLeads: number;
  totalLeads: number;
  recurringLeads: number;
}

// ===== CADEIA DO FUNIL =====
// contato → lead → oportunidade → venda.
//
// `KommoLeads` sempre foi OPORTUNIDADE (o card só ganha venda a partir do marco
// `requiresValue` do CRM), mas a tela chamava isso de "Lead" e o CPL dividia o gasto por
// esse número — inflando o CPL do Meta ~6x na Galpão. Ver `lib/leadCounts.ts` no backend.
export interface FunnelChannelCounts {
  meta: number;
  google: number;
  total: number;
}

export interface FunnelSummary {
  period: { start: string; end: string };
  /** `null` quando a org não tem camada de contato na janela — a faixa some. */
  contacts: FunnelChannelCounts | null;
  leads: FunnelChannelCounts | null;
  opportunities: FunnelChannelCounts;
  won: number;
  /** LEAD = dividiu por lead · OPPORTUNITY/PLATFORM_CONVERSION = base antiga. */
  cplBasis: 'LEAD' | 'OPPORTUNITY' | 'PLATFORM_CONVERSION';
  /** Desde quando existe contato — usado para explicar a faixa ausente. */
  contactLayerStartsAt: string | null;
  cpl: number | null;
  cplMeta: number | null;
  cplGoogle: number | null;
  costPerOpportunity: number | null;
  costPerOpportunityMeta: number | null;
  costPerOpportunityGoogle: number | null;
  spend: number;
  spendMeta: number;
  spendGoogle: number;
}

// ===== EVOLUÇÃO HISTÓRICA =====
export interface HistoricoPoint {
  m: string;
  inv: number;
  rec: number;
  roas: number;
  leads: number;
  vendas: number;
  conv: number;
}

export interface HistoricoData {
  months: string[];
  total: HistoricoPoint[];
  meta: HistoricoPoint[];
  google: HistoricoPoint[];
}


// ===== GESTOR DE TRAFEGO =====
export interface ManagerStats {
  mrr: number;
  annualProjection: number;
  averageTicket: number;
  clientCount: number;
  linkClientCount: number;
  codeClientCount: number;
  planBreakdown: { plan: string; count: number; unitCommission: number; totalCommission: number }[];
  growthHistory: { month: string; newClients: number; cumulative: number }[];
  reportsThisMonth: number;
  activeSchedules: number;
}

export interface TrafficManagerClient {
  id: string;
  name: string;
  plan: Plan;
  status: OrgStatus;
  slug: string;
  isSelf?: boolean;
  source?: 'LINK' | 'CODE' | 'ADMIN' | 'SELF' | 'MANAGER';
  claimed?: boolean;
  hasGoogle?: boolean;
  hasMeta?: boolean;
  hasKommo?: boolean;
  connectedAt?: string;
  briefingDayOfWeek?: number | null;
  briefingHour?: number | null;
  briefingNotes?: string | null;
}

// Conta de anúncio acessível pelo token do gestor (Google ou Meta)
export interface AccessibleAccount {
  externalId: string;
  name: string;
}

export interface ManagerReferral {
  referralCode: string;
  referralLink: string;
}

export interface TrafficManagerWithClients {
  id: string;
  name: string;
  email: string;
  status: string;
  createdAt: Date;
  managedOrgs: {
    id: string;
    createdAt: Date;
    organization: TrafficManagerClient;
  }[];
}

// ===== ADMIN METRICS =====
export interface AdminMetrics {
  mrr: number;
  arr: number;
  mrrByPlan: { plan: string; price: number; count: number; revenue: number }[];
  orgs: {
    total: number;
    ACTIVE: number;
    SUSPENDED: number;
    CANCELLED: number;
    newThisMonth: number;
    newLastMonth: number;
    growthPct: number;
    atRisk: number;
  };
  platform: {
    totalUsers: number;
    totalIntegrations: number;
    connectedIntegrations: number;
    totalLeads: number;
    totalAiReports: number;
  };
  recentOrgs: {
    id: string;
    name: string;
    slug: string;
    plan: string;
    status: string;
    createdAt: string;
    users: number;
    integrations: number;
    hasIntegration: boolean;
    internal: boolean;
  }[];
}

// ===== SEO / AIO =====

export interface SeoPageSpeedData {
  score: number;
  fcp: number | null;
  lcp: number | null;
  cls: number | null;
  tbt: number | null;
  speedIndex: number | null;
  mobile: boolean;
}

export interface SeoRobotsData {
  present: boolean;
  blocksGPTBot: boolean;
  blocksClaudeBot: boolean;
  blocksPerplexityBot: boolean;
}

export interface SeoOgTags {
  title: boolean;
  description: boolean;
  image: boolean;
}

/** Problema do site em duas linguagens: `titulo`/`impacto` para o cliente, `tecnico`
 *  para quem vai corrigir (só aparece dentro do "Saiba mais"). */
export interface SeoFinding {
  code: string;
  severity: 'critico' | 'atencao';
  titulo: string;
  impacto: string;
  tecnico: string;
}

export interface SeoHtmlData {
  score: number;
  title: string | null;
  metaDescription: string | null;
  h1Count: number;
  h1Text: string | null;
  imagesTotal: number;
  imagesWithAlt: number;
  hasSchemaOrg: boolean;
  schemaTypes: string[];
  ogTags: SeoOgTags | null;
  robots: SeoRobotsData | null;
  hasSitemap: boolean;
  hasLlmsTxt: boolean;
  isIndexable: boolean;
  issues: string[];
  /** Ausente nos snapshots anteriores a 12/08 — a tela cai em `issues` quando não vier. */
  findings?: SeoFinding[];
}

export interface AioData {
  score: number;
  criticalPoints: string[];
  recommendations: string[];
  summary: string;
  /** Ausente nos snapshots anteriores a 12/08. */
  technicalNotes?: string[];
}

export interface SeoCompetitorResult {
  url: string;
  pageSpeed: SeoPageSpeedData | null;
  seoHtml: SeoHtmlData | null;
  aio: AioData | null;
  overallScore: number;
  error?: string;
}

export interface SeoAnalysis {
  id: string;
  organizationId: string;
  isBaseline: boolean;
  siteUrl: string;
  pageSpeedScore: number | null;
  seoScore: number | null;
  aioScore: number | null;
  overallScore: number | null;
  pageSpeedData: SeoPageSpeedData | null;
  seoData: SeoHtmlData | null;
  aioData: AioData | null;
  competitorData: SeoCompetitorResult[] | null;
  analyzedAt: string;
  createdAt: string;
}

export interface SeoConfig {
  websiteUrl: string | null;
  competitorUrls: string[];
}

// ===== PERFIL DA EMPRESA + SETUP SCORE =====

export type ModuleKey = 'radar' | 'ads' | 'crm' | 'ia';

export interface ScoreItem {
  key: string;
  label: string;
  points: number;
  module: ModuleKey;
  done: boolean;
  /** O que a plataforma deixa de fazer sem este item. */
  unlock: string;
}

export interface SetupScore {
  score: number;
  tier: 'incompleto' | 'bronze' | 'prata' | 'ouro';
  modules: Record<ModuleKey, { earned: number; total: number; pct: number }>;
  blocks: { key: string; label: string; earned: number; total: number; items: ScoreItem[] }[];
  missing: ScoreItem[];
}

export interface CompanyProfile {
  name: string;
  websiteUrl: string | null;
  competitorUrls: string[];
  competitorPageIds: string[];
  productDescription: string | null;
  idealCustomer: string | null;
  differentiator: string | null;
  goodLeadCriteria: string | null;
  businessGoal: string | null;
  serviceRegion: string | null;
  instagramUrl: string | null;
}

// ===== BUDGET STATUS =====

export interface BudgetStatus {
  connected: boolean;
  remaining: number | null;
  remainingType: 'prepaid' | 'cap' | null;
  burnRate7d: number | null;
  daysLeft: number | null;
  currency?: string;
  error?: boolean;
}

export interface GoogleCampaignBudget {
  name: string;
  budgetBRL: number;
  spentBRL: number;
  pctUsed: number;
}

export interface GoogleBudgetStatus {
  connected: boolean;
  campaigns: GoogleCampaignBudget[];
  error?: boolean;
}

// ===== ALERTAS DE ANOMALIA =====

export type AnomalyRuleId = 'SPEND_NO_LEADS' | 'CPL_HIGH' | 'ROAS_LOW' | 'CTR_DROP' | 'LEAD_SILENCE' | 'BUDGET_LOW' | 'CRM_UNANSWERED' | 'CRM_FOLLOWUP_DIGEST';

export interface AlertThresholds {
  SPEND_NO_LEADS: { minSpend: number };
  CPL_HIGH:       { pctAboveAvg: number; minSpend: number };
  ROAS_LOW:       { minMonthSpend: number };
  CTR_DROP:       { dropPct: number; minImpressions: number };
  LEAD_SILENCE:   { hoursWindow: number; minSpend7d: number };
  BUDGET_LOW:     { budgetMinBalance: number; budgetPctThreshold: number };
  CRM_UNANSWERED: { hoursUnanswered: number };
  CRM_FOLLOWUP_DIGEST: Record<string, never>;
}

export interface AlertConfig {
  enabledRules: AnomalyRuleId[];
  thresholds: AlertThresholds;
  validRules?: AnomalyRuleId[];
}

// ===== FASE 4 — AGENTES CRIATIVOS =====

export interface CreativePattern {
  pattern: string;
  campaigns?: string[];
  metrics?: string;
  hypothesis?: string;
  evidence?: string;
}

export interface CreativeAnalysis {
  id: string;
  organizationId: string;
  patterns: {
    highPerformance: CreativePattern[];
    lowPerformance: CreativePattern[];
    creativeRecommendations: string[];
    bestAudiences: string[];
    bestFormats: string[];
    fatigueRisk: string[];
    summary: string;
  };
  tokensUsed?: number;
  analyzedAt: string;
  createdAt: string;
}

export interface CreativeIdea {
  angle: string;
  hook: string;
  format: string;
  duration?: string;
  rationale: string;
}

export interface CreativeIdeasOutput {
  campaignContext: string;
  ideas: CreativeIdea[];
  priorityOrder: number[];
  quickWins: string[];
  testingRecommendation: string;
}

export interface CreativeBriefingOutput {
  campaignTarget: string;
  objective: string;
  targetAudience: {
    profile: string;
    painPoints: string[];
    desiredOutcome: string;
    currentSituation: string;
  };
  creativeAngle: {
    main: string;
    rationale: string;
    conversionHypothesis: string;
    differentiationFromCurrent: string;
  };
  format: {
    recommended: string;
    alternativeFormat: string;
    duration?: string;
    aspectRatio: string;
    structure: string[];
  };
  copy: {
    headline: string;
    subheadline?: string;
    bodyPoints: string[];
    cta: string;
  };
  visualDirection: {
    toneAndFeel: string;
    colorGuidance: string;
    doList: string[];
    dontList: string[];
  };
  successMetrics: {
    primaryKPI: string;
    minimumImpressionsToJudge: string;
    cutCriteria: string;
  };
  references: string;
}

export interface CopyVariation {
  id: string;
  angle: string;
  headline: string;
  primaryText: string;
  description: string;
  cta: string;
  copyNotes: string;
}

export interface CopyOutput {
  variations: CopyVariation[];
  testingGuidance: {
    primaryMetric: string;
    minimumLeadsPerVariation: string;
    minimumImpressionsPerVariation: string;
    cutCriteria: string;
    rotationSetup: string;
  };
  angleStrategy: string;
  platformAdaptations?: {
    metaAds?: string;
    googleAds?: string;
  };
}

export interface CompetitorData {
  name: string;
  totalAdsFound: number;
  formats: { video: number; image: number; carousel: number };
  dominantAngles: string[];
  repeatedMessages: string[];
  estimatedActivity: 'ALTA' | 'MÉDIA' | 'BAIXA';
  longestRunningAds: string[];
  weakness: string;
}

export interface CompetitiveOutput {
  competitors: CompetitorData[];
  marketPatterns: {
    dominantFormats: string[];
    saturatedAngles: string[];
    commonMessages: string[];
    averageAdVolume: string;
  };
  positioningGaps: { gap: string; opportunity: string; priority: 'ALTA' | 'MÉDIA' | 'BAIXA' }[];
  weeklyHighlight: string;
  recommendations: string[];
  analyzedAt: string;
  /** Proveniência da rodada: o que foi lido de fato e o que falhou. Sem isso, o cliente não tem
   *  como saber que um concorrente não foi consultado — e leria a ausência como "não anuncia". */
  _fonte?: {
    origem: string;
    consultadoEm: string;
    consultados: { concorrente: string; pagina: string | null; anunciosAtivos: number; criativosUnicos?: number }[];
    naoConsultados: { concorrente: string; motivo: string }[];
  };
}

// ===== DADOS MANUAIS (clientes sem CRM) =====

export type ManualRevenueSource = 'META' | 'GOOGLE' | 'ORGANIC' | 'DIRECT' | 'OTHER';

export interface ManualRevenueEntry {
  id: string;
  periodId: string;
  source: ManualRevenueSource;
  leads: number;
  sales: number;
  revenue: number;
  spend: number;
}

export interface ManualRevenuePeriod {
  id: string;
  organizationId: string;
  month: number;
  year: number;
  isIncomplete: boolean;
  notes: string | null;
  entries: ManualRevenueEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface ManualRevenueSummary {
  periods: ManualRevenuePeriod[];
  totals: {
    leads: number;
    sales: number;
    revenue: number;
    spend: number;
    roasMeta: number | null;
    roasGoogle: number | null;
    cac: number | null;
    metaLeads: number;
    googleLeads: number;
  };
  hasData: boolean;
}

export interface RevenueGoal {
  id: string;
  organizationId: string;
  month: number;
  year: number;
  target: number;
  createdAt: string;
  updatedAt: string;
}

export interface RevenueGoalProgress {
  month: number;
  year: number;
  label: string;
  realized: number;
  target: number | null;
}

export interface WonLead {
  name: string | null;
  price: number;
  externalId: number;
  closedAt: string | null;
  kommoUrl: string | null;
  utmSource: string | null;
}

export interface CrmHygieneItem {
  externalId: number;
  name: string | null;
  status: string;
  price: number | null;
  utmSource: string | null;
  createdAt: string | null;
  lastActivityAt: string | null;
  closedAt: string | null;
  kommoUrl: string | null;
}

export interface CrmHygiene {
  hasData: boolean;
  stagnant: { count: number; thresholdDays: number; items: CrmHygieneItem[] };
  wonNoValue: { count: number; windowDays: number; items: CrmHygieneItem[] };
  noOrigin: { count: number; total: number; pct: number; windowDays: number; items: CrmHygieneItem[] };
}

// ===== ASSINATURA / COBRANÇA =====
export type BillingCycle = 'MONTHLY' | 'SEMIANNUAL' | 'ANNUAL';
export type PaymentStatus = 'PENDING' | 'CONFIRMED' | 'OVERDUE' | 'REFUNDED' | 'CANCELLED';
export type PaymentMethod = 'PIX' | 'BOLETO' | 'CREDIT_CARD' | 'MANUAL';

export interface BillingStatus {
  plan: string;
  billingCycle: BillingCycle;
  orgStatus: string;
  price: number;
  monthlyEquivalent: number;
  monthlyListPrice: number;
  subscriptionEnds: string | null;
  daysLeft: number | null;
  expired: boolean;
  monthsPaid: number;
  totalPaid: number;
  paymentsCount: number;
  lastPaymentAt: string | null;
  nextDueDate: string | null;
  hasTaxId: boolean;
  hasActiveSubscription: boolean;
  pendingCharge: {
    paymentId: string;
    invoiceUrl: string | null; // null = veio do cadastro, cobrança ainda não emitida
    amount: number;
    dueDate: string | null;
    plan: string;
    billingCycle: BillingCycle;
  } | null;
}

export interface CheckoutResult {
  paymentId: string;
  invoiceUrl: string;
  value: number;
  dueDate: string;
  plan: string;
  billingCycle: BillingCycle;
  reused: boolean; // true = link que já existia, nenhuma cobrança nova foi emitida
}

export interface PaymentRecord {
  id: string;
  amount: number;
  plan: string;
  billingCycle: BillingCycle;
  status: PaymentStatus;
  method: PaymentMethod;
  periodStart: string;
  periodEnd: string;
  dueDate: string | null;
  paidAt: string | null;
  invoiceUrl: string | null;
  notes: string | null;
}

export interface SellerRankingRow {
  // id do Kommo (numérico) ou UUID do User (CRM Cortex) — sempre string na resposta
  userId: string;
  name: string;
  sales: number;
  revenue: number;
  avgTicket: number;
  winRate: number | null;
  avgDaysToClose: number | null;
  openPipeline: number;
  prevRevenue: number;
}

export interface SellersRanking {
  ranking: SellerRankingRow[];
  totalRevenue: number;
  totalSales: number;
  hasData: boolean;
}

// ===== CRM PRÓPRIO (CRM CORTEX) =====
export type CrmOrigin = 'META' | 'GOOGLE' | 'WHATSAPP' | 'INDICACAO' | 'FACHADA' | 'ORGANICO' | 'OUTRO';
export type CrmSaleStatus = 'OPEN' | 'WON' | 'LOST';

// Motivo de perda configurável por org — a venda guarda o rótulo como texto
export interface CrmLostReasonOption {
  id: string;
  label: string;
  order: number;
}

// Motivo de descarte de LEAD configurável por org (não responde, clique errado
// no anúncio...). Não confundir com motivo de perda: perda encerra uma VENDA.
export interface CrmDiscardReasonOption {
  id: string;
  label: string;
  order: number;
}

// Tipo de cliente configurável por org (ex: Pessoa Física, Engenheiro PJ)
export interface CrmClientTypeOption {
  id: string;
  label: string;
  order: number;
}

// Tag configurável por org (ex: Carteira, Quente, Frio)
export interface CrmTagOption {
  id: string;
  label: string;
  order: number;
}

// Resposta rápida — template de mensagem da org ({nome} = primeiro nome do cliente)
export interface CrmQuickReply {
  id: string;
  title: string;
  text: string;
  order: number;
}

export type CrmTriageStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED';

export interface CrmStage {
  id: string;
  name: string;
  order: number;
  /** Cor da etapa no kanban (hex "#rrggbb"). Null = cor padrão por ordem (stageColor no front). */
  color: string | null;
  /** Marco "daqui pra frente exige valor": esta etapa e as seguintes pedem venda com valor. */
  requiresValue: boolean;
}

// ── Automações do CRM ──────────────────────────────────────────────────────
// As ações só mexem no ESTADO do card. Enviar mensagem é o módulo de disparos,
// que tem freio anti-ban próprio — os dois não se misturam.
export type CrmAutomationTrigger =
  | 'NEW_LEAD' | 'STAGE_ENTERED' | 'STAGE_IDLE' | 'NO_REPLY' | 'SALE_WON' | 'SALE_LOST';

export type CrmAutomationStepType =
  | 'MOVE_STAGE' | 'ASSIGN' | 'ADD_TAG' | 'CREATE_TASK'
  | 'SET_FOLLOWUP' | 'ADD_NOTE' | 'DISCARD' | 'WAIT';

export interface CrmAutomationStep {
  type: CrmAutomationStepType;
  stageId?: string;
  mode?: 'ROUND_ROBIN' | 'USER';
  userId?: string;
  tag?: string;
  title?: string;
  taskType?: string;
  dueInDays?: number;
  days?: number;
  text?: string;
  reason?: string;
}

export interface CrmAutomation {
  id: string;
  name: string;
  enabled: boolean;
  triggerType: CrmAutomationTrigger;
  triggerConfig: { stageId?: string; days?: number; hours?: number; reason?: string };
  steps: CrmAutomationStep[];
  stopOnReply: boolean;
  runCount: number;
  lastRunAt: string | null;
  createdAt: string;
}

export interface CrmAutomationRun {
  id: string;
  status: 'PENDING' | 'RUNNING' | 'DONE' | 'FAILED' | 'CANCELED' | 'STOPPED_BY_REPLY';
  stepIndex: number;
  dueAt: string;
  /** Motivo da falha — é aqui que aparece a trava do funil recusando o passo. */
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
  client: { id: string; name: string };
}

export interface CrmSaleSegment {
  id: string;
  name: string;
  value: number;
}

export interface CrmSale {
  id: string;
  seq: number;
  clientId: string;
  title: string | null;
  value: number;
  status: CrmSaleStatus;
  stageId: string | null;
  stage?: CrmStage | null;
  lostReason: string | null;
  origin: CrmOrigin;
  closedAt: string | null;
  createdAt: string;
  segments?: CrmSaleSegment[];
}

export interface CrmClientSummary {
  id: string;
  name: string;
  phone: string;
  origin: CrmOrigin;
  notes: string | null;
  company: string | null;
  clientType: string | null;
  email: string | null;
  /** Cidade do contato — só o nome ("Maranguape"). A UF fica em `state`. */
  city: string | null;
  /** UF da cidade. Não é exibida: existe para não somar cidades homônimas. */
  state: string | null;
  tags: string[];
  lastInboundAt: string | null;
  lastReadAt: string | null;
  nextFollowUpAt: string | null;
  waAvatarUrl: string | null;
  /** PENDING = na coluna "Novos contatos" aguardando Aceitar/Descartar. */
  triageStatus: CrmTriageStatus;
  /** Motivo do descarte vigente — null = lead não está descartado. */
  discardReason: string | null;
  /** Quantas vezes já foi descartado (histórico; não zera ao aceitar de volta). */
  discardCount: number;
  /** Posição do card no kanban (o card é o lead; anda sem precisar de venda). */
  stageId: string | null;
  responsibleId: string | null;
  responsible?: { id: string; name: string } | null;
  sales: Pick<CrmSale, 'id' | 'value' | 'status' | 'stageId' | 'closedAt' | 'createdAt'>[];
  ltv: number;
  openSales: number;
  updatedAt: string;
}

export interface CrmEvent {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  actor?: { id: string; name: string } | null;
  /** Nota fixada no topo da timeline — só eventos NOTE podem ser fixados. */
  pinnedAt: string | null;
  createdAt: string;
}

export interface CrmClientDetail extends Omit<CrmClientSummary, 'sales' | 'openSales'> {
  sales: CrmSale[];
  events: CrmEvent[];
}

export interface CrmStatus {
  enabled: boolean;
  kommoConnected: boolean;
  stages: CrmStage[];
  clientCount: number;
  maxClients: number | null;
}

export type CrmBroadcastStatus = 'SCHEDULED' | 'QUEUED' | 'SENDING' | 'DONE' | 'CANCELED';

// Disparo em massa (promoção) segmentado por tag/tipo, enviado pelo WhatsApp do
// vendedor responsável de cada cliente.
export interface CrmBroadcast {
  id: string;
  title: string | null;
  message: string;
  status: CrmBroadcastStatus;
  scheduledAt: string | null;    // null = enviado na hora
  combine: 'AND' | 'OR';
  filterTags: string[];
  filterTypes: string[];
  mediaType: string | null;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  skippedCount: number;          // sem telefone / vendedor sem WhatsApp conectado
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

// Prévia da audiência: quantos casam os filtros e quantos têm vendedor com WhatsApp
export interface CrmBroadcastPreview {
  total: number;
  sendable: number;
  skipped: number;
}

export type CrmAdPlatform = 'META' | 'GOOGLE';

// Criativo rastreável: a FRASE viaja no texto pré-preenchido do wa.me e volta na
// primeira mensagem do lead, que é como o card ganha origem Meta/Google.
export interface CrmAdCreative {
  id: string;
  code: string;                // identificador curto na tela (CX1) — não casa nada
  name: string;
  message: string | null;      // frase do wa.me — fallback quando não vem anúncio
  adMediaUrl: string | null;   // URL do vídeo do anúncio (externalAdReply.mediaUrl)
  adSourceId: string | null;   // ID do anúncio na Meta — chave canônica do rastreio
  autoCreated: boolean;        // descoberto pelo sistema, ainda sem nome real
  platform: CrmAdPlatform;
  campaignName: string | null;
  destPhone: string | null;
  active: boolean;
  leads: number;
  waLink: string | null;       // null sem número ou sem frase
  createdAt: string;
}

export interface CrmAdNumber {
  phone: string | null;
  sellerName: string;
}

export interface CrmSummary {
  funnel: { id: string; name: string; count: number; value: number }[];
  pipeline: { count: number; value: number };
  lostReasons: { reason: string | null; count: number }[];
}

export type CrmTaskType = 'LIGAR' | 'WHATSAPP' | 'REUNIAO' | 'EMAIL' | 'OUTRO';

export interface CrmTask {
  id: string;
  clientId: string;
  client?: { id: string; name: string };
  title: string;
  type: CrmTaskType;
  dueAt: string;
  completedAt: string | null;
  responsibleId: string | null;
  responsible?: { id: string; name: string } | null;
  createdAt: string;
}

export interface CrmReport {
  period: { months: number; since: string };
  totals: {
    createdCount: number;
    wonCount: number;
    wonValue: number;
    lostCount: number;
    winRate: number | null;
    avgTicket: number;
    avgCycleDays: number | null;
    cohortWon: number;
  };
  stageFlow: { id: string; name: string; reached: number; conversionFromPrev: number | null }[];
  stageDurations: { id: string; name: string; avgDays: number | null; samples: number }[];
  lostReasons: { reason: string; count: number }[];
  /** Leads descartados no período — não são venda perdida, são lead que nunca qualificou. */
  discards: { total: number; reasons: { reason: string; count: number }[] };
  /** De onde vêm os leads e onde se vende mais. `label` já traz a UF só em caso de homônimas. */
  cities: { label: string; leads: number; wonCount: number; wonValue: number }[];
  sellers: { id: string | null; name: string; wonCount: number; wonValue: number; lostCount: number; winRate: number | null; avgTicket: number }[];
}

// CRM — WhatsApp do vendedor (Evolution API)
export interface CrmWaStatus {
  configured: boolean;
  connected: boolean;
  phone?: string;
  stale?: boolean; // Evolution fora do ar — último estado conhecido
}

export type CrmWaMediaType = 'image' | 'video' | 'audio' | 'document' | 'sticker';

export interface CrmWaMessage {
  id: string;
  fromMe: boolean;
  text: string;
  timestamp: number; // Unix segundos
  mediaType?: CrmWaMediaType;
  mimetype?: string;
  fileName?: string; // só documentos
  /** Preenchido quando esta mensagem é resposta a outra */
  quoted?: { id: string; text: string; fromMe: boolean };
}

export interface CreativeBriefing {
  id: string;
  organizationId: string;
  agentType: 'IDEAS' | 'BRIEFING' | 'COPY';
  campaignName?: string;
  inputSummary?: string;
  outputData: CreativeIdeasOutput | CreativeBriefingOutput | CopyOutput;
  tokensUsed?: number;
  createdAt: string;
}

export type CreativePlatform = 'meta' | 'google';

export interface CreativeCampaign {
  name: string;
  platform: CreativePlatform;
  spend: number;
}

export interface FatigueCampaign {
  name: string;
  platform: CreativePlatform;
  ctrToday: number;
  ctr3dAgo: number;
  dropPct: number;
  spend7d: number;
  leads7d: number;
}

export interface CreativeProfile {
  productDescription: string | null;
  competitorPageIds: string[];
}

// ===== RESPOSTA GENÉRICA =====
export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: any[];
}

// ===== PAGINAÇÃO =====
export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

// ===== RELATÓRIOS AGENDADOS =====
export type ChannelType = 'TELEGRAM' | 'WHATSAPP';
export type ReportFrequency = 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY';

export interface ReportLog {
  id: string;
  status: 'SUCCESS' | 'FAILED';
  error?: string;
  sentAt: string;
}

export interface ReportConfig {
  includeSpend?: boolean;
  includeLeads?: boolean;
  includeCtr?: boolean;
  includeCpl?: boolean;
  includeRevenue?: boolean;
  includeRoas?: boolean;
  includeConv?: boolean;
  includeImpressions?: boolean;
  notes?: string;
}

export interface ReportSchedule {
  id: string;
  organizationId: string;
  channelType: ChannelType;
  destination: string;
  destinationName: string;
  frequency: ReportFrequency;
  hour: number;
  dayOfWeek?: number;
  dayOfMonth?: number;
  isActive: boolean;
  lastSentAt?: string;
  reportConfig: ReportConfig;
  createdAt: string;
  createdBy: { name: string; email: string };
  logs: ReportLog[];
}

