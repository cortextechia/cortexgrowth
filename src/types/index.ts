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

export interface SeoHtmlData {
  score: number;
  title: string | null;
  metaDescription: string | null;
  h1Count: number;
  h1Text: string | null;
  imagesTotal: number;
  imagesWithAlt: number;
  hasSchemaOrg: boolean;
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
  createdAt: string;
  createdBy: { name: string; email: string };
  logs: ReportLog[];
}
