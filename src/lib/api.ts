import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { User, Organization, Integration, RegisterRequest, LoginRequest, AuthResponse, AiAnalysis, AdminMetrics, AttributionSummary, HistoricoData, TrafficManagerWithClients, TrafficManagerClient, ReportSchedule, ReportConfig, ManagerStats, ManagerReferral, SeoAnalysis, SeoConfig, AlertConfig, BudgetStatus, GoogleBudgetStatus, AccessibleAccount } from '@/types';

// Exportada p/ o stream SSE do CRM (fetch manual — axios não lê body em stream)
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

const ACCESS_TOKEN_KEY = 'auth_token';
const REFRESH_TOKEN_KEY = 'auth_refresh_token';

class ApiService {
  private client: AxiosInstance;
  private isRefreshing = false;
  private refreshQueue: Array<(token: string) => void> = [];

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: { 'Content-Type': 'application/json' },
    });

    this.client.interceptors.request.use((config) => {
      const token = this.getAccessToken();
      if (token) config.headers.Authorization = `Bearer ${token}`;

      // Para TRAFFIC_MANAGER: injeta org do cliente selecionado
      if (typeof window !== 'undefined') {
        const orgId = sessionStorage.getItem('traffic_manager_org_id');
        if (orgId) config.headers['X-Org-Id'] = orgId;
      }

      return config;
    });

    // Interceptor de resposta: tenta refresh automático em 401
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

        // Só tenta refresh em 401, e nunca na própria rota de refresh (evita loop)
        if (
          error.response?.status === 401 &&
          !original._retry &&
          original.url !== '/auth/refresh' &&
          original.url !== '/auth/login'
        ) {
          const refreshToken = this.getRefreshToken();
          if (!refreshToken) return Promise.reject(error);

          if (this.isRefreshing) {
            // Outras requisições aguardam o refresh terminar
            return new Promise((resolve) => {
              this.refreshQueue.push((newToken) => {
                original.headers.Authorization = `Bearer ${newToken}`;
                resolve(this.client(original));
              });
            });
          }

          original._retry = true;
          this.isRefreshing = true;

          try {
            const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });
            this.setTokens(data.accessToken, data.refreshToken);

            // Resolve todas as requisições que estavam esperando
            this.refreshQueue.forEach((cb) => cb(data.accessToken));
            this.refreshQueue = [];

            original.headers.Authorization = `Bearer ${data.accessToken}`;
            return this.client(original);
          } catch (refreshError: any) {
            const isNetworkError = !refreshError.response;
            if (!isNetworkError) {
              // Refresh token inválido/expirado — sessão encerrada de verdade
              this.clearTokens();
              if (typeof window !== 'undefined') window.location.href = '/auth/login';
            }
            // Erro de rede: não redireciona — backend pode estar reiniciando
            return Promise.reject(refreshError);
          } finally {
            this.isRefreshing = false;
          }
        }

        // 402 = assinatura suspensa/cancelada/vencida (checkOrgBilling no backend).
        // Manda para a tela de assinatura em vez de deixar a UI quebrada em pedaços.
        if (error.response?.status === 402 && typeof window !== 'undefined') {
          const data = error.response.data as { code?: string; reason?: string } | undefined;
          if (data?.code === 'SUBSCRIPTION_INACTIVE' && !window.location.pathname.startsWith('/assinatura')) {
            window.location.href = `/assinatura?motivo=${data.reason ?? 'EXPIRED'}`;
          }
        }

        return Promise.reject(error);
      }
    );
  }

  // ─── Token management ────────────────────────────────────────────────────────

  getAccessToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  }

  getRefreshToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  }

  setTokens(accessToken: string, refreshToken: string): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }

  clearTokens(): void {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  }

  // ─── Autenticação ────────────────────────────────────────────────────────────

  async register(data: RegisterRequest & { ref?: string; claim?: string }): Promise<AuthResponse> {
    const response = await this.client.post<AuthResponse>('/auth/register', data);
    if (response.data.accessToken) {
      this.setTokens(response.data.accessToken, response.data.refreshToken);
    }
    return response.data;
  }

  async getClaimInfo(token: string): Promise<{ success: boolean; data: { valid: boolean; organizationName?: string; managerName?: string | null } }> {
    const response = await this.client.get(`/auth/claim/${token}`);
    return response.data;
  }

  async login(data: LoginRequest): Promise<AuthResponse> {
    const response = await this.client.post<AuthResponse>('/auth/login', data);
    if (response.data.accessToken) {
      this.setTokens(response.data.accessToken, response.data.refreshToken);
    }
    return response.data;
  }

  async logout(): Promise<void> {
    try {
      await this.client.post('/auth/logout');
    } catch {
      // Mesmo com erro, limpa tokens locais
    } finally {
      this.clearTokens();
    }
  }

  async verifyToken(): Promise<AuthResponse> {
    const response = await this.client.get<AuthResponse>('/auth/verify');
    return response.data;
  }

  async getProfile(): Promise<{ success: boolean; user: User }> {
    const response = await this.client.get<{ success: boolean; user: User }>('/auth/profile');
    return response.data;
  }

  // ─── Organizações ────────────────────────────────────────────────────────────

  async getCurrentOrganization(): Promise<{ success: boolean; organization: Organization }> {
    const response = await this.client.get('/organizations/current');
    return response.data;
  }

  async getOrganizations(): Promise<{ success: boolean; organizations: Organization[] }> {
    const response = await this.client.get('/organizations');
    return response.data;
  }

  async createOrganization(data: { name: string; plan?: string }): Promise<{ success: boolean; organization: Organization }> {
    const response = await this.client.post('/organizations', data);
    return response.data;
  }

  async updateOrganization(id: string, data: Partial<Organization>): Promise<{ success: boolean; organization: Organization }> {
    const response = await this.client.put(`/organizations/${id}`, data);
    return response.data;
  }

  async deleteOrganization(id: string): Promise<{ success: boolean }> {
    const response = await this.client.delete(`/organizations/${id}`);
    return response.data;
  }

  async getAdminMetrics(): Promise<{ success: boolean; data: AdminMetrics }> {
    const response = await this.client.get('/admin/metrics');
    return response.data;
  }

  async getOrgUsers(orgId: string): Promise<{ success: boolean; users: User[] }> {
    const response = await this.client.get(`/organizations/${orgId}/users`);
    return response.data;
  }

  async createOrgUser(orgId: string, data: { email: string; password: string; name: string; role: string }): Promise<{ success: boolean; user: User }> {
    const response = await this.client.post(`/organizations/${orgId}/users`, data);
    return response.data;
  }

  async syncMetaForOrg(orgId: string): Promise<{ success: boolean; message: string; data?: { count: number } }> {
    const response = await this.client.post(`/admin/sync/meta/${orgId}`);
    return response.data;
  }

  async backfillMetaForOrg(orgId: string, since: string, until: string): Promise<{ success: boolean; message: string; data?: { count: number; since: string; until: string } }> {
    const response = await this.client.post(`/admin/backfill/meta/${orgId}`, null, { params: { since, until } });
    return response.data;
  }

  // ─── Usuários ────────────────────────────────────────────────────────────────

  async getUsers(): Promise<{ success: boolean; users: User[] }> {
    const response = await this.client.get('/users');
    return response.data;
  }

  async getUser(id: string): Promise<{ success: boolean; user: User }> {
    const response = await this.client.get(`/users/${id}`);
    return response.data;
  }

  async createUser(data: { email: string; password: string; name: string; role: string }): Promise<{ success: boolean; user: User }> {
    const response = await this.client.post('/users', data);
    return response.data;
  }

  async updateUser(id: string, data: Partial<User>): Promise<{ success: boolean; user: User }> {
    const response = await this.client.put(`/users/${id}`, data);
    return response.data;
  }

  async deleteUser(id: string): Promise<{ success: boolean }> {
    const response = await this.client.delete(`/users/${id}`);
    return response.data;
  }

  async changePassword(id: string, currentPassword: string, newPassword: string): Promise<{ success: boolean }> {
    const response = await this.client.put(`/users/${id}/password`, { currentPassword, newPassword });
    return response.data;
  }

  // ─── Integrações ────────────────────────────────────────────────────────────

  async getIntegrations(): Promise<{ success: boolean; integrations: Integration[] }> {
    const response = await this.client.get('/integrations');
    return response.data;
  }

  async getBudgetStatus(): Promise<{ success: boolean; data: { meta: BudgetStatus; google: GoogleBudgetStatus } }> {
    const response = await this.client.get('/integrations/budget');
    return response.data;
  }

  // Contas de anúncio Meta acessíveis (para escolher a conta quando o OAuth não auto-seleciona)
  async getMetaAccounts(): Promise<{ success: boolean; data: { connected: boolean; accounts: { externalId: string; name: string }[]; currentExternalId: string | null } }> {
    const response = await this.client.get('/integrations/meta/accounts');
    return response.data;
  }

  // Tabela de preços — rota pública, usada na tela de cadastro
  async getPlans(): Promise<{ success: boolean; data: import('@/types').PlanOption[] }> {
    const response = await this.client.get('/billing/plans');
    return response.data;
  }

  // ─── Verificação de e-mail e recuperação de senha ───────────────────────────
  async verifyEmail(token: string): Promise<{ success: boolean; message: string }> {
    const response = await this.client.post('/auth/verify-email', { token });
    return response.data;
  }

  async resendVerification(): Promise<{ success: boolean; message: string }> {
    const response = await this.client.post('/auth/resend-verification');
    return response.data;
  }

  async forgotPassword(email: string): Promise<{ success: boolean; message: string }> {
    const response = await this.client.post('/auth/forgot-password', { email });
    return response.data;
  }

  async resetPassword(token: string, password: string): Promise<{ success: boolean; message: string }> {
    const response = await this.client.post('/auth/reset-password', { token, password });
    return response.data;
  }

  // ─── Assinatura / cobrança ──────────────────────────────────────────────────
  async getBillingStatus(): Promise<{ success: boolean; data: import('@/types').BillingStatus }> {
    const response = await this.client.get('/billing/status');
    return response.data;
  }

  async getBillingPayments(): Promise<{ success: boolean; data: import('@/types').PaymentRecord[] }> {
    const response = await this.client.get('/billing/payments');
    return response.data;
  }

  // Confirma a senha e devolve um token curto que autoriza as ações sensíveis de
  // cobrança. O backend responde 403 com code STEP_UP_REQUIRED quando ele falta.
  async stepUp(password: string): Promise<{ success: boolean; data: { stepUpToken: string; expiresInSeconds: number } }> {
    const response = await this.client.post('/auth/step-up', { password });
    return response.data;
  }

  // Cancela a assinatura. O acesso continua até o fim do período já pago.
  async cancelSubscription(stepUpToken: string): Promise<{ success: boolean; message: string; data: { accessUntil: string | null } }> {
    const response = await this.client.post('/billing/cancel', undefined, {
      headers: { 'x-step-up-token': stepUpToken },
    });
    return response.data;
  }

  // Emite a cobrança do ciclo no Asaas e devolve o link da fatura (PIX ou boleto,
  // o cliente escolhe lá). taxId só é obrigatório na PRIMEIRA assinatura.
  async createCheckout(payload: { plan: string; billingCycle: import('@/types').BillingCycle; taxId?: string }):
    Promise<{ success: boolean; message: string; data: import('@/types').CheckoutResult }> {
    const response = await this.client.post('/billing/checkout', payload);
    return response.data;
  }

  // Contas de Google Ads acessíveis — só leitura, pro aviso quando o OAuth não vinculou conta
  async getGoogleAccounts(): Promise<{ success: boolean; data: { connected: boolean; accounts: { externalId: string; name: string }[]; currentExternalId: string | null } }> {
    const response = await this.client.get('/integrations/google/accounts');
    return response.data;
  }

  async setMetaAccount(externalId: string): Promise<{ success: boolean; message: string; data: { externalId: string; name: string; count: number } }> {
    const response = await this.client.put('/integrations/meta/account', { externalId });
    return response.data;
  }

  async getIntegration(id: string): Promise<{ success: boolean; integration: Integration }> {
    const response = await this.client.get(`/integrations/${id}`);
    return response.data;
  }

  async createIntegration(data: { type: string; name: string; accessToken?: string; refreshToken?: string }): Promise<{ success: boolean; integration: Integration }> {
    const response = await this.client.post('/integrations', data);
    return response.data;
  }

  async updateIntegration(id: string, data: Partial<Integration>): Promise<{ success: boolean; integration: Integration }> {
    const response = await this.client.put(`/integrations/${id}`, data);
    return response.data;
  }

  async deleteIntegration(id: string): Promise<{ success: boolean }> {
    const response = await this.client.delete(`/integrations/${id}`);
    return response.data;
  }

  async testIntegration(id: string): Promise<{ success: boolean; testResult: any }> {
    const response = await this.client.post(`/integrations/${id}/test`);
    return response.data;
  }

  async generateMockData(id: string): Promise<{ success: boolean; data: any }> {
    const response = await this.client.post(`/integrations/${id}/mock-data`);
    return response.data;
  }

  async syncIntegration(type: string): Promise<{ success: boolean; recordsProcessed: number }> {
    // ⚠️ Nunca usar "/ads/" no path: ad blockers cancelam a requisição no browser
    // (Network Error sem status, sem chegar no servidor). Prefixo canônico: /platforms.
    const endpointMap: Record<string, string> = {
      META_ADS: '/platforms/meta/sync',
      FACEBOOK: '/platforms/meta/sync',
      GOOGLE_ADS: '/platforms/google/sync',
      KOMMO: '/platforms/kommo/sync',
    };

    const endpoint = endpointMap[type] ?? null;
    if (!endpoint) throw new Error(`Sincronização não suportada para o tipo "${type}".`);

    const response = await this.client.post(endpoint);
    return response.data;
  }

  // ─── OAuth ───────────────────────────────────────────────────────────────────

  /**
   * Retorna a URL de autorização OAuth do provedor.
   * O backend gera o state JWT anti-CSRF e a URL completa.
   */
  async getOAuthUrl(provider: 'meta' | 'google_ads' | 'google_analytics' | 'kommo'): Promise<string> {
    const endpointMap: Record<string, string> = {
      meta: '/auth/meta/authorize',
      google_ads: '/auth/google/authorize?type=GOOGLE_ADS',
      google_analytics: '/auth/google/authorize?type=GOOGLE_ANALYTICS',
      kommo: '/auth/kommo/authorize',
    };

    const response = await this.client.get<{ success: boolean; authUrl: string }>(endpointMap[provider]);
    return response.data.authUrl;
  }

  // ─── Dashboard ───────────────────────────────────────────────────────────────

  async getMetaInsights(): Promise<{ success: boolean; data: any[] }> {
    const response = await this.client.get('/dashboard/meta-insights');
    return response.data;
  }

  async getGoogleAdsMetrics(): Promise<{ success: boolean; data: any[] }> {
    const response = await this.client.get('/dashboard/google-ads-metrics');
    return response.data;
  }

  async getStats(): Promise<{ success: boolean; stats: any }> {
    const response = await this.client.get('/dashboard/stats');
    return response.data;
  }

  async getAttributionSummary(days: number, start?: string, end?: string): Promise<{ success: boolean; data: AttributionSummary }> {
    // start/end (YYYY-MM-DD) definem janela explícita no range personalizado; sem eles o backend usa "últimos N dias"
    const params = start && end ? { days, start, end } : { days };
    const response = await this.client.get('/platforms/attribution/summary', { params });
    return response.data;
  }

  async getKommoLeads(): Promise<any[]> {
    const response = await this.client.get('/kommo/leads');
    const payload = response.data;
    return Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
  }

  // ─── AI Insights ─────────────────────────────────────────────────────────

  async getHistorico(months: number): Promise<{ success: boolean; data: HistoricoData }> {
    const response = await this.client.get('/platforms/historico', { params: { months } });
    return response.data;
  }

  async googleBackfill(since: string, until: string): Promise<{ success: boolean; message: string; data: { count: number } }> {
    const response = await this.client.post('/platforms/google/backfill', undefined, { params: { since, until } });
    return response.data;
  }

  async metaBackfill(since: string, until: string): Promise<{ success: boolean; message: string; data: { count: number } }> {
    const response = await this.client.post('/platforms/meta/backfill', undefined, { params: { since, until } });
    return response.data;
  }

  async generateInsights(daysBack = 30): Promise<{ success: boolean; message: string; data: { analysisId: string } }> {
    const response = await this.client.post('/ai/insights/generate', { daysBack });
    return response.data;
  }

  async getInsights(params?: { limit?: number; page?: number }): Promise<{ success: boolean; data: AiAnalysis[]; total: number; page: number; limit: number }> {
    const response = await this.client.get('/ai/insights', { params });
    return response.data;
  }

  async getLatestInsight(): Promise<{ success: boolean; data: AiAnalysis | null }> {
    const response = await this.client.get('/ai/insights/latest');
    return response.data;
  }

  async getInsight(id: string): Promise<{ success: boolean; data: AiAnalysis }> {
    const response = await this.client.get(`/ai/insights/${id}`);
    return response.data;
  }

  // ─── Gestores de Tráfego ────────────────────────────────────────────────────

  async getManagers(): Promise<{ success: boolean; data: TrafficManagerWithClients[] }> {
    const response = await this.client.get('/managers');
    return response.data;
  }

  async createManager(data: { email: string; password: string; name: string }): Promise<{ success: boolean; data: User }> {
    const response = await this.client.post('/managers', data);
    return response.data;
  }

  async deleteManager(id: string): Promise<{ success: boolean }> {
    const response = await this.client.delete(`/managers/${id}`);
    return response.data;
  }

  async addManagerClient(managerId: string, orgId: string): Promise<{ success: boolean }> {
    const response = await this.client.post(`/managers/${managerId}/clients/${orgId}`);
    return response.data;
  }

  async removeManagerClient(managerId: string, orgId: string): Promise<{ success: boolean }> {
    const response = await this.client.delete(`/managers/${managerId}/clients/${orgId}`);
    return response.data;
  }

  async getManagerStats(): Promise<{ success: boolean; data: ManagerStats }> {
    const response = await this.client.get('/managers/my-stats');
    return response.data;
  }

  async getMyClients(): Promise<{ success: boolean; data: TrafficManagerClient[] }> {
    const response = await this.client.get('/managers/my-clients');
    return response.data;
  }

  async getMyInvite(): Promise<{ success: boolean; data: { code: string; expiresAt: string } }> {
    const response = await this.client.get('/managers/my-invite');
    return response.data;
  }

  async regenerateInvite(): Promise<{ success: boolean; data: { code: string; expiresAt: string } }> {
    const response = await this.client.post('/managers/my-invite/regenerate');
    return response.data;
  }

  async removeMyClient(orgId: string): Promise<{ success: boolean }> {
    const response = await this.client.delete(`/managers/my-clients/${orgId}`);
    return response.data;
  }

  // Contas de anúncio acessíveis pelo token do gestor — para criar dashboards de clientes
  async getAccessibleAccounts(platform: 'google_ads' | 'meta'): Promise<{ success: boolean; data: { connected: boolean; accounts: AccessibleAccount[]; currentExternalId: string | null } }> {
    const response = await this.client.get('/managers/accessible-accounts', { params: { platform } });
    return response.data;
  }

  // Define qual conta de anúncio é a "própria" do gestor (org pessoal)
  async setMyAccount(platform: 'google_ads' | 'meta', externalId: string): Promise<{ success: boolean; message: string; data: { externalId: string; name: string; count: number } }> {
    const response = await this.client.put('/managers/my-account', { platform, externalId });
    return response.data;
  }

  async createClientDashboard(data: {
    name: string;
    google?: { externalId: string; externalName: string } | null;
    meta?: { externalId: string; externalName: string } | null;
  }): Promise<{ success: boolean; message: string; data: TrafficManagerClient & { sync?: { google?: { ok: boolean; count: number }; meta?: { ok: boolean; count: number } } } }> {
    const response = await this.client.post('/managers/clients', data);
    return response.data;
  }

  // Gera link para o cliente assumir (claim) um dashboard criado pelo gestor
  async generateClaimLink(orgId: string): Promise<{ success: boolean; data: { claimLink: string; expiresAt: string } }> {
    const response = await this.client.post(`/managers/clients/${orgId}/claim-link`);
    return response.data;
  }

  async updateClientBriefing(orgId: string, briefingDayOfWeek: number | null, briefingHour: number | null, briefingNotes?: string | null): Promise<{ success: boolean }> {
    const response = await this.client.put(`/managers/my-clients/${orgId}/briefing`, { briefingDayOfWeek, briefingHour, briefingNotes });
    return response.data;
  }

  async getMyReferral(): Promise<{ success: boolean; data: ManagerReferral }> {
    const response = await this.client.get('/managers/my-referral');
    return response.data;
  }

  async regenerateReferral(): Promise<{ success: boolean; data: ManagerReferral; message: string }> {
    const response = await this.client.post('/managers/my-referral/regenerate');
    return response.data;
  }

  async connectManager(code: string): Promise<{ success: boolean; message: string; data: { managerId: string; managerName: string; managerEmail: string } }> {
    const response = await this.client.post('/managers/connect', { code });
    return response.data;
  }

  async disconnectManager(managerId: string): Promise<{ success: boolean }> {
    const response = await this.client.delete(`/managers/disconnect/${managerId}`);
    return response.data;
  }

  async getConnectedManagers(): Promise<{ success: boolean; data: { id: string; name: string; email: string; status: string; connectedAt: string }[] }> {
    const response = await this.client.get('/managers/connected');
    return response.data;
  }

  // ─── Briefing Semanal do Gestor ─────────────────────────────────────────────

  async getBriefingConfig(): Promise<{ success: boolean; data: { enabled: boolean; chatId: string; chatName: string; hour: number; notificationChannel: string; whatsappPhone: string | null } }> {
    const response = await this.client.get('/managers/briefing-config');
    return response.data;
  }

  async saveBriefingConfig(data: { enabled: boolean; hour: number; dayOfWeek: number; notificationChannel: string; whatsappPhone?: string }): Promise<{ success: boolean; message: string }> {
    const response = await this.client.put('/managers/briefing-config', data);
    return response.data;
  }

  async generateBriefingInvite(): Promise<{ success: boolean; data: { deepLink: string; expiresAt: string } }> {
    const response = await this.client.post('/managers/briefing-config/invite');
    return response.data;
  }

  async disconnectBriefingTelegram(): Promise<{ success: boolean; message: string }> {
    const response = await this.client.delete('/managers/briefing-config/telegram');
    return response.data;
  }

  async testBriefing(): Promise<{ success: boolean; message: string }> {
    const response = await this.client.post('/managers/briefing-config/test');
    return response.data;
  }

  // ─── Relatórios Agendados ────────────────────────────────────────────────────

  async getReportSchedules(): Promise<{ success: boolean; data: ReportSchedule[] }> {
    const response = await this.client.get('/report-schedules');
    return response.data;
  }

  async createReportSchedule(data: {
    channelType: string; destination: string; destinationName: string;
    frequency: string; hour: number; dayOfWeek?: number; dayOfMonth?: number;
    reportConfig?: ReportConfig;
  }): Promise<{ success: boolean; data: ReportSchedule }> {
    const response = await this.client.post('/report-schedules', data);
    return response.data;
  }

  async updateReportSchedule(id: string, data: Partial<{
    isActive: boolean; hour: number; frequency: string;
    dayOfWeek: number; dayOfMonth: number; destination: string; destinationName: string;
    reportConfig: ReportConfig;
  }>): Promise<{ success: boolean }> {
    const response = await this.client.put(`/report-schedules/${id}`, data);
    return response.data;
  }

  async deleteReportSchedule(id: string): Promise<{ success: boolean }> {
    const response = await this.client.delete(`/report-schedules/${id}`);
    return response.data;
  }

  async sendReportNow(id: string): Promise<{ success: boolean; message: string }> {
    const response = await this.client.post(`/report-schedules/${id}/send`);
    return response.data;
  }

  async getReportPreview(): Promise<{ success: boolean; data: { text: string } }> {
    const response = await this.client.get('/report-schedules/preview');
    return response.data;
  }

  async getReportPreviewWithConfig(frequency?: string, config?: ReportConfig): Promise<{ success: boolean; data: { text: string } }> {
    const response = await this.client.post('/report-schedules/preview', { frequency, config });
    return response.data;
  }

  async createTelegramInvite(): Promise<{ success: boolean; data: { token: string; deepLink: string; expiresAt: string } }> {
    const response = await this.client.post('/report-schedules/telegram/invite');
    return response.data;
  }

  async getTelegramInviteStatus(token: string): Promise<{ success: boolean; data: { connected: boolean; chatId?: string; chatName?: string; expired: boolean } }> {
    const response = await this.client.get(`/report-schedules/telegram/invite/${token}/status`);
    return response.data;
  }

  async registerTelegramWebhook(): Promise<{ success: boolean; message: string }> {
    const response = await this.client.post('/report-schedules/telegram/webhook/register');
    return response.data;
  }

  async getTelegramChats(): Promise<{ success: boolean; data: { chatId: string; chatName: string; type: string }[] }> {
    const response = await this.client.get('/report-schedules/telegram/chats');
    return response.data;
  }

  async getTelegramBot(): Promise<{ success: boolean; data: { username: string; id: number } }> {
    const response = await this.client.get('/report-schedules/telegram/bot');
    return response.data;
  }

  async getWhatsAppStatus(): Promise<{ success: boolean; data: { connected: boolean; phone?: string } }> {
    const response = await this.client.get('/report-schedules/whatsapp/status');
    return response.data;
  }

  async getWhatsAppQrCode(): Promise<{ success: boolean; data: { connected: boolean; qrcode: string | null } }> {
    const response = await this.client.get('/report-schedules/whatsapp/qrcode');
    return response.data;
  }

  // ─── Onboarding ──────────────────────────────────────────────────────────────

  async completeOnboarding(): Promise<{ success: boolean; message: string }> {
    const response = await this.client.patch('/organizations/current/onboarding/complete');
    return response.data;
  }

  // ─── SEO / AIO ───────────────────────────────────────────────────────────────

  async getSeoConfig(): Promise<{ success: boolean; data: SeoConfig }> {
    const response = await this.client.get('/seo/config');
    return response.data;
  }

  async updateSeoConfig(data: { websiteUrl: string; competitorUrls?: string[] }): Promise<{ success: boolean; message: string; data: SeoConfig }> {
    const response = await this.client.put('/seo/config', data);
    return response.data;
  }

  async triggerSeoAnalysis(): Promise<{ success: boolean; message: string; data: { analysisId: string } }> {
    const response = await this.client.post('/seo/analyze');
    return response.data;
  }

  async getSeoHistory(params?: { limit?: number; page?: number }): Promise<{ success: boolean; data: SeoAnalysis[]; total: number; page: number; limit: number }> {
    const response = await this.client.get('/seo/history', { params });
    return response.data;
  }

  async getSeoLatest(): Promise<{ success: boolean; data: SeoAnalysis | null; meta: { canAnalyzeThisMonth: boolean; lastAnalysis: string | null } }> {
    const response = await this.client.get('/seo/latest');
    return response.data;
  }

  // ─── Configuração de Alertas de Anomalia ────────────────────────────────────

  async getAlertConfig(): Promise<{ success: boolean; data: AlertConfig }> {
    const response = await this.client.get('/alert-config');
    return response.data;
  }

  async updateAlertConfig(data: { enabledRules: string[]; thresholds: AlertConfig['thresholds'] }): Promise<{ success: boolean; message: string; data: AlertConfig }> {
    const response = await this.client.put('/alert-config', data);
    return response.data;
  }

  // ─── Agentes Criativos (Fase 4) ─────────────────────────────────────────────

  async getCreativeProfile(): Promise<{ success: boolean; data: import('@/types').CreativeProfile }> {
    const response = await this.client.get('/creative/profile');
    return response.data;
  }

  async updateCreativeProfile(data: { productDescription?: string; competitorPageIds?: string[] }): Promise<{ success: boolean; message: string; data: import('@/types').CreativeProfile }> {
    const response = await this.client.patch('/creative/profile', data);
    return response.data;
  }

  async runCreativeAnalysis(daysBack = 90): Promise<{ success: boolean; message: string; data: { analysisId: string; tokensUsed: number } }> {
    const response = await this.client.post('/creative/analysis/run', { daysBack });
    return response.data;
  }

  async getLatestCreativeAnalysis(): Promise<{ success: boolean; data: import('@/types').CreativeAnalysis | null }> {
    const response = await this.client.get('/creative/analysis/latest');
    return response.data;
  }

  async getCreativeFatigue(): Promise<{ success: boolean; data: import('@/types').FatigueCampaign[]; message: string }> {
    const response = await this.client.get('/creative/fatigue');
    return response.data;
  }

  async getCreativeCampaigns(): Promise<{ success: boolean; data: import('@/types').CreativeCampaign[] }> {
    const response = await this.client.get('/creative/campaigns');
    return response.data;
  }

  async generateCreativeIdeas(campaignName: string, platform: import('@/types').CreativePlatform = 'meta'): Promise<{ success: boolean; message: string; data: { briefingId: string; tokensUsed: number; ideas: import('@/types').CreativeIdeasOutput } }> {
    const response = await this.client.post('/creative/ideas', { campaignName, platform });
    return response.data;
  }

  async generateCreativeBriefing(campaignName: string, platform: import('@/types').CreativePlatform = 'meta'): Promise<{ success: boolean; message: string; data: { briefingId: string; tokensUsed: number; briefing: import('@/types').CreativeBriefingOutput } }> {
    const response = await this.client.post('/creative/briefing', { campaignName, platform });
    return response.data;
  }

  async generateCopy(campaignName: string, briefingId?: string): Promise<{ success: boolean; message: string; data: { briefingId: string; tokensUsed: number; copy: import('@/types').CopyOutput } }> {
    const response = await this.client.post('/creative/copy', { campaignName, briefingId });
    return response.data;
  }

  async getCreativeHistory(type?: 'IDEAS' | 'BRIEFING' | 'COPY'): Promise<{ success: boolean; data: Pick<import('@/types').CreativeBriefing, 'id' | 'agentType' | 'campaignName' | 'inputSummary' | 'tokensUsed' | 'createdAt'>[] }> {
    const response = await this.client.get('/creative/history', { params: type ? { type } : {} });
    return response.data;
  }

  async getCreativeHistoryItem(id: string): Promise<{ success: boolean; data: import('@/types').CreativeBriefing }> {
    const response = await this.client.get(`/creative/history/${id}`);
    return response.data;
  }

  async runCompetitiveAnalysis(): Promise<{ success: boolean; message: string; data: { insightId: string; tokensUsed: number; data: import('@/types').CompetitiveOutput } }> {
    const response = await this.client.post('/creative/competitive/run');
    return response.data;
  }

  async getLatestCompetitiveInsight(): Promise<{ success: boolean; data: { id: string; weekOf: string; adsData: import('@/types').CompetitiveOutput; tokensUsed?: number; createdAt: string } | null }> {
    const response = await this.client.get('/creative/competitive/latest');
    return response.data;
  }

  // ─── Dados Manuais (clientes sem CRM) ───────────────────────────────────────

  async getManualRevenuePeriods(): Promise<{ success: boolean; data: import('@/types').ManualRevenuePeriod[] }> {
    const response = await this.client.get('/manual-revenue');
    return response.data;
  }

  async getManualRevenueSummary(months = 3): Promise<{ success: boolean; data: import('@/types').ManualRevenueSummary }> {
    const response = await this.client.get('/manual-revenue/summary', { params: { months } });
    return response.data;
  }

  async saveManualRevenuePeriod(data: {
    month: number;
    year: number;
    isIncomplete?: boolean;
    notes?: string;
    entries: { source: string; leads: number; sales: number; revenue: number; spend: number }[];
  }): Promise<{ success: boolean; message: string; data: import('@/types').ManualRevenuePeriod }> {
    const response = await this.client.post('/manual-revenue/period', data);
    return response.data;
  }

  async deleteManualRevenuePeriod(year: number, month: number): Promise<{ success: boolean; message: string }> {
    const response = await this.client.delete(`/manual-revenue/period/${year}/${month}`);
    return response.data;
  }

  // ─── Meta de faturamento mensal ─────────────────────────────────────────────

  async getRevenueGoals(): Promise<{ success: boolean; data: import('@/types').RevenueGoal[] }> {
    const response = await this.client.get('/revenue-goals');
    return response.data;
  }

  async getRevenueGoalProgress(months = 6): Promise<{ success: boolean; data: import('@/types').RevenueGoalProgress[] }> {
    const response = await this.client.get('/revenue-goals/progress', { params: { months } });
    return response.data;
  }

  async getCrmHygiene(): Promise<{ success: boolean; data: import('@/types').CrmHygiene }> {
    const response = await this.client.get('/crm-hygiene');
    return response.data;
  }

  async saveRevenueGoal(data: { month: number; year: number; target: number }): Promise<{ success: boolean; message: string; data: import('@/types').RevenueGoal }> {
    const response = await this.client.put('/revenue-goals', data);
    return response.data;
  }

  async deleteRevenueGoal(year: number, month: number): Promise<{ success: boolean; message: string }> {
    const response = await this.client.delete(`/revenue-goals/${year}/${month}`);
    return response.data;
  }

  async getWonLeads(year: number, month: number): Promise<{ success: boolean; data: { leads: import('@/types').WonLead[]; total: number } }> {
    const response = await this.client.get('/revenue-goals/won-leads', { params: { year, month } });
    return response.data;
  }

  async getSellersRanking(year: number, month: number): Promise<{ success: boolean; data: import('@/types').SellersRanking }> {
    const response = await this.client.get('/revenue-goals/sellers-ranking', { params: { year, month } });
    return response.data;
  }

  // ─── CRM Próprio (CRM Cortex) ───────────────────────────────────────────────

  async getCrmStatus(): Promise<{ success: boolean; data: import('@/types').CrmStatus }> {
    const response = await this.client.get('/crm/status');
    return response.data;
  }

  async enableCrm(): Promise<{ success: boolean; message: string; data: { stages: import('@/types').CrmStage[] } }> {
    const response = await this.client.post('/crm/enable');
    return response.data;
  }

  async getCrmSummary(): Promise<{ success: boolean; data: import('@/types').CrmSummary }> {
    const response = await this.client.get('/crm/summary');
    return response.data;
  }

  async saveCrmStages(stages: { id?: string; name: string; requiresValue?: boolean; color?: string | null }[]): Promise<{ success: boolean; message: string; data: import('@/types').CrmStage[] }> {
    const response = await this.client.put('/crm/stages', { stages });
    return response.data;
  }

  async getCrmClients(params?: { search?: string; take?: number; skip?: number; unread?: boolean }): Promise<{ success: boolean; data: { clients: import('@/types').CrmClientSummary[]; total: number } }> {
    const response = await this.client.get('/crm/clients', { params });
    return response.data;
  }

  async createCrmClient(data: { name: string; phone: string; origin?: string; responsibleId?: string; notes?: string }): Promise<{ success: boolean; message: string; data: { client: import('@/types').CrmClientSummary; created: boolean } }> {
    const response = await this.client.post('/crm/clients', data);
    return response.data;
  }

  async getCrmClient(id: string): Promise<{ success: boolean; data: import('@/types').CrmClientDetail }> {
    const response = await this.client.get(`/crm/clients/${id}`);
    return response.data;
  }

  async updateCrmClient(id: string, data: { name?: string; origin?: string; notes?: string; company?: string | null; clientType?: string | null; email?: string | null; city?: string | null; state?: string | null; nextFollowUpAt?: string | null; tags?: string[] }): Promise<{ success: boolean; message: string }> {
    const response = await this.client.put(`/crm/clients/${id}`, data);
    return response.data;
  }

  async importCrmClients(rows: { name: string; phone: string; email?: string; company?: string; clientType?: string; tags?: string[]; origin?: string }[]): Promise<{ success: boolean; message: string; data: { created: number; duplicates: number; invalid: number; capSkipped: number } }> {
    const response = await this.client.post('/crm/clients/import', { rows });
    return response.data;
  }

  async getCrmQuickReplies(): Promise<{ success: boolean; data: import('@/types').CrmQuickReply[] }> {
    const response = await this.client.get('/crm/quick-replies');
    return response.data;
  }

  async saveCrmQuickReplies(replies: { id?: string; title: string; text: string }[]): Promise<{ success: boolean; message: string; data: import('@/types').CrmQuickReply[] }> {
    const response = await this.client.put('/crm/quick-replies', { replies });
    return response.data;
  }

  async getCrmLostReasons(): Promise<{ success: boolean; data: import('@/types').CrmLostReasonOption[] }> {
    const response = await this.client.get('/crm/lost-reasons');
    return response.data;
  }

  async saveCrmLostReasons(options: { id?: string; label: string }[]): Promise<{ success: boolean; message: string; data: import('@/types').CrmLostReasonOption[] }> {
    const response = await this.client.put('/crm/lost-reasons', { options });
    return response.data;
  }

  /** Total REAL de conversas não respondidas (contado no banco, respeita o escopo do vendedor). */
  async getCrmUnreadCount(): Promise<{ success: boolean; data: { count: number } }> {
    const response = await this.client.get('/crm/unread-count');
    return response.data;
  }

  async getCrmDiscardReasons(): Promise<{ success: boolean; data: import('@/types').CrmDiscardReasonOption[] }> {
    const response = await this.client.get('/crm/discard-reasons');
    return response.data;
  }

  async saveCrmDiscardReasons(options: { id?: string; label: string }[]): Promise<{ success: boolean; message: string; data: import('@/types').CrmDiscardReasonOption[] }> {
    const response = await this.client.put('/crm/discard-reasons', { options });
    return response.data;
  }

  async getCrmClientTypes(): Promise<{ success: boolean; data: import('@/types').CrmClientTypeOption[] }> {
    const response = await this.client.get('/crm/client-types');
    return response.data;
  }

  async saveCrmClientTypes(options: { id?: string; label: string }[]): Promise<{ success: boolean; message: string; data: import('@/types').CrmClientTypeOption[] }> {
    const response = await this.client.put('/crm/client-types', { options });
    return response.data;
  }

  async getCrmTags(): Promise<{ success: boolean; data: import('@/types').CrmTagOption[] }> {
    const response = await this.client.get('/crm/tags');
    return response.data;
  }

  async saveCrmTags(options: { id?: string; label: string }[]): Promise<{ success: boolean; message: string; data: import('@/types').CrmTagOption[] }> {
    const response = await this.client.put('/crm/tags', { options });
    return response.data;
  }

  // ── Disparos em massa ──
  async previewCrmBroadcast(body: { tags: string[]; types: string[]; combine: 'AND' | 'OR' }): Promise<{ success: boolean; data: import('@/types').CrmBroadcastPreview }> {
    const response = await this.client.post('/crm/broadcasts/preview', body);
    return response.data;
  }

  async createCrmBroadcast(body: {
    title?: string;
    message: string;
    tags: string[];
    types: string[];
    combine: 'AND' | 'OR';
    scheduledAt?: string | null;
    media?: { base64: string; type: string; fileName?: string } | null;
  }): Promise<{ success: boolean; message: string; data: import('@/types').CrmBroadcast }> {
    const response = await this.client.post('/crm/broadcasts', body);
    return response.data;
  }

  // ── Criativos rastreáveis ──────────────────────────────────────────────
  async listCrmAdCreatives(): Promise<{ success: boolean; data: import('@/types').CrmAdCreative[] }> {
    const response = await this.client.get('/crm/ad-creatives');
    return response.data;
  }

  async listCrmAdNumbers(): Promise<{ success: boolean; data: import('@/types').CrmAdNumber[] }> {
    const response = await this.client.get('/crm/ad-creatives/numbers');
    return response.data;
  }

  async createCrmAdCreative(payload: {
    name: string;
    message?: string;
    platform: import('@/types').CrmAdPlatform;
    campaignName?: string;
    destPhone?: string;
    adMediaUrl?: string;
  }): Promise<{ success: boolean; message: string }> {
    const response = await this.client.post('/crm/ad-creatives', payload);
    return response.data;
  }

  async updateCrmAdCreative(
    id: string,
    payload: Partial<{ name: string; message: string; platform: import('@/types').CrmAdPlatform; campaignName: string | null; destPhone: string | null; adMediaUrl: string | null; active: boolean }>
  ): Promise<{ success: boolean; message: string }> {
    const response = await this.client.put(`/crm/ad-creatives/${id}`, payload);
    return response.data;
  }

  async syncCrmAdCreativeNames(): Promise<{ success: boolean; message: string }> {
    const response = await this.client.post('/crm/ad-creatives/sync-names');
    return response.data;
  }

  async deleteCrmAdCreative(id: string): Promise<{ success: boolean; message: string }> {
    const response = await this.client.delete(`/crm/ad-creatives/${id}`);
    return response.data;
  }

  async listCrmBroadcasts(): Promise<{ success: boolean; data: import('@/types').CrmBroadcast[] }> {
    const response = await this.client.get('/crm/broadcasts');
    return response.data;
  }

  async cancelCrmBroadcast(id: string): Promise<{ success: boolean; message: string }> {
    const response = await this.client.post(`/crm/broadcasts/${id}/cancel`);
    return response.data;
  }

  async addCrmNote(clientId: string, text: string): Promise<{ success: boolean; message: string; data: import('@/types').CrmEvent }> {
    const response = await this.client.post(`/crm/clients/${clientId}/notes`, { text });
    return response.data;
  }

  async pinCrmNote(eventId: string, pinned: boolean): Promise<{ success: boolean; message: string }> {
    const response = await this.client.put(`/crm/events/${eventId}/pin`, { pinned });
    return response.data;
  }

  async editCrmNote(eventId: string, text: string): Promise<{ success: boolean; message: string }> {
    const response = await this.client.put(`/crm/events/${eventId}/note`, { text });
    return response.data;
  }

  async transferCrmResponsible(clientId: string, responsibleId: string | null): Promise<{ success: boolean; message: string }> {
    const response = await this.client.put(`/crm/clients/${clientId}/responsible`, { responsibleId });
    return response.data;
  }

  async createCrmSale(clientId: string, data: { value: number; title?: string; stageId?: string; origin?: string; segments?: { name: string; value: number }[] }): Promise<{ success: boolean; message: string; data: import('@/types').CrmSale }> {
    const response = await this.client.post(`/crm/clients/${clientId}/sales`, data);
    return response.data;
  }

  async changeCrmSaleStage(saleId: string, stageId: string): Promise<{ success: boolean; message: string }> {
    const response = await this.client.put(`/crm/sales/${saleId}/stage`, { stageId });
    return response.data;
  }

  async moveCrmClientStage(clientId: string, stageId: string): Promise<{ success: boolean; message: string }> {
    const response = await this.client.put(`/crm/clients/${clientId}/stage`, { stageId });
    return response.data;
  }

  async markCrmClientRead(clientId: string): Promise<{ success: boolean; message: string }> {
    const response = await this.client.post(`/crm/clients/${clientId}/read`);
    return response.data;
  }

  async updateCrmSale(saleId: string, data: { value?: number; title?: string }): Promise<{ success: boolean; message: string; data: import('@/types').CrmSale }> {
    const response = await this.client.put(`/crm/sales/${saleId}`, data);
    return response.data;
  }

  // Triagem do contato novo — aceitar põe no funil, rejeitar arquiva sem apagar
  async acceptCrmClient(clientId: string): Promise<{ success: boolean; message: string }> {
    const response = await this.client.post(`/crm/clients/${clientId}/accept`);
    return response.data;
  }

  /** Descarta o lead como não qualificado — motivo obrigatório (vira estatística). */
  async rejectCrmClient(clientId: string, reason: string): Promise<{ success: boolean; message: string }> {
    const response = await this.client.post(`/crm/clients/${clientId}/reject`, { reason });
    return response.data;
  }

  async winCrmSale(saleId: string, data?: { value?: number }): Promise<{ success: boolean; message: string }> {
    const response = await this.client.post(`/crm/sales/${saleId}/win`, data ?? {});
    return response.data;
  }

  async loseCrmSale(saleId: string, lostReason: string): Promise<{ success: boolean; message: string }> {
    const response = await this.client.post(`/crm/sales/${saleId}/lose`, { lostReason });
    return response.data;
  }

  async deleteCrmSale(saleId: string): Promise<{ success: boolean; message: string }> {
    const response = await this.client.delete(`/crm/sales/${saleId}`);
    return response.data;
  }

  // ─── CRM — Tarefas ──────────────────────────────────────────────────────────

  async getCrmTasks(view?: 'open' | 'done'): Promise<{ success: boolean; data: import('@/types').CrmTask[] }> {
    const response = await this.client.get('/crm/tasks', { params: view ? { view } : {} });
    return response.data;
  }

  async createCrmTask(clientId: string, data: { title: string; type?: string; dueAt: string; responsibleId?: string | null }): Promise<{ success: boolean; message: string; data: import('@/types').CrmTask }> {
    const response = await this.client.post(`/crm/clients/${clientId}/tasks`, data);
    return response.data;
  }

  async updateCrmTask(taskId: string, data: { title?: string; type?: string; dueAt?: string; done?: boolean }): Promise<{ success: boolean; message: string; data: import('@/types').CrmTask }> {
    const response = await this.client.put(`/crm/tasks/${taskId}`, data);
    return response.data;
  }

  async deleteCrmTask(taskId: string): Promise<{ success: boolean; message: string }> {
    const response = await this.client.delete(`/crm/tasks/${taskId}`);
    return response.data;
  }

  // ─── CRM — Relatório e export ───────────────────────────────────────────────

  async getCrmReport(months?: number): Promise<{ success: boolean; data: import('@/types').CrmReport }> {
    const response = await this.client.get('/crm/report', { params: months ? { months } : {} });
    return response.data;
  }

  async exportCrmClients(): Promise<Blob> {
    const response = await this.client.get('/crm/clients/export', { responseType: 'blob' });
    return response.data;
  }

  // ─── CRM — WhatsApp do vendedor (Evolution API) ─────────────────────────────

  async connectCrmWhatsapp(): Promise<{ success: boolean; message: string; data: { connected: boolean; qrcode: string | null } }> {
    const response = await this.client.post('/crm/whatsapp/connect');
    return response.data;
  }

  async getCrmWhatsappStatus(): Promise<{ success: boolean; data: import('@/types').CrmWaStatus }> {
    const response = await this.client.get('/crm/whatsapp/status');
    return response.data;
  }

  async disconnectCrmWhatsapp(): Promise<{ success: boolean; message: string }> {
    const response = await this.client.delete('/crm/whatsapp/disconnect');
    return response.data;
  }

  async getCrmWhatsappMessages(clientId: string): Promise<{ success: boolean; data: { available: boolean; messages: import('@/types').CrmWaMessage[] } }> {
    const response = await this.client.get(`/crm/whatsapp/clients/${clientId}/messages`);
    return response.data;
  }

  async getCrmWaMedia(clientId: string, messageId: string): Promise<{ success: boolean; data: { base64: string; mimetype: string } }> {
    const response = await this.client.get(`/crm/whatsapp/clients/${clientId}/media/${encodeURIComponent(messageId)}`);
    return response.data;
  }

  async getCrmClientAvatar(clientId: string): Promise<{ success: boolean; data: { avatarUrl: string | null } }> {
    const response = await this.client.get(`/crm/whatsapp/clients/${clientId}/avatar`);
    return response.data;
  }

  async sendCrmWhatsappMedia(clientId: string, data: { mediatype: 'image' | 'video' | 'document'; mimetype: string; base64: string; fileName?: string; caption?: string }): Promise<{ success: boolean; message: string }> {
    const response = await this.client.post(`/crm/whatsapp/clients/${clientId}/send-media`, data);
    return response.data;
  }

  // quotedId cita uma mensagem da conversa (resposta estilo WhatsApp) — o texto
  // da citação é resolvido no backend, não vai daqui
  async sendCrmWhatsappMessage(clientId: string, text: string, quotedId?: string): Promise<{ success: boolean; message: string }> {
    const response = await this.client.post(`/crm/whatsapp/clients/${clientId}/send`, {
      text,
      ...(quotedId ? { quotedId } : {}),
    });
    return response.data;
  }

  // Helpers para sessão do gestor
  getSelectedClientOrgId(): string | null {
    if (typeof window === 'undefined') return null;
    return sessionStorage.getItem('traffic_manager_org_id');
  }

  setSelectedClientOrgId(orgId: string): void {
    if (typeof window === 'undefined') return;
    sessionStorage.setItem('traffic_manager_org_id', orgId);
  }

  clearSelectedClientOrgId(): void {
    if (typeof window === 'undefined') return;
    sessionStorage.removeItem('traffic_manager_org_id');
  }
}

export const apiService = new ApiService();
