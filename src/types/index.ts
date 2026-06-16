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
}

export interface AioData {
  score: number;
  criticalPoints: string[];
  recommendations: string[];
  summary: string;
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

export type AnomalyRuleId = 'SPEND_NO_LEADS' | 'CPL_HIGH' | 'ROAS_LOW' | 'CTR_DROP' | 'LEAD_SILENCE' | 'BUDGET_LOW';

export interface AlertThresholds {
  SPEND_NO_LEADS: { minSpend: number };
  CPL_HIGH:       { pctAboveAvg: number; minSpend: number };
  ROAS_LOW:       { minMonthSpend: number };
  CTR_DROP:       { dropPct: number; minImpressions: number };
  LEAD_SILENCE:   { hoursWindow: number; minSpend7d: number };
  BUDGET_LOW:     { budgetMinBalance: number; budgetPctThreshold: number };
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

export interface FatigueCampaign {
  name: string;
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

