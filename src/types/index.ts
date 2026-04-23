// ===== ENUMS =====
export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  USER = 'USER',
  VIEWER = 'VIEWER',
}

export enum UserStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  SUSPENDED = 'SUSPENDED',
}

export enum Plan {
  FREE = 'FREE',
  STARTER = 'STARTER',
  PROFESSIONAL = 'PROFESSIONAL',
  ENTERPRISE = 'ENTERPRISE',
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
  stripeCustomerId?: string;
  subscriptionEnds?: Date;
  createdAt: Date;
  updatedAt: Date;
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
  organization?: Organization;
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