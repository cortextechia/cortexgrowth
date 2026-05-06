import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { User, Organization, Integration, RegisterRequest, LoginRequest, AuthResponse, AiAnalysis, AdminMetrics, AttributionSummary } from '@/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

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

  async register(data: RegisterRequest): Promise<AuthResponse> {
    const response = await this.client.post<AuthResponse>('/auth/register', data);
    if (response.data.accessToken) {
      this.setTokens(response.data.accessToken, response.data.refreshToken);
    }
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
    const endpointMap: Record<string, string> = {
      META_ADS: '/ads/meta/sync',
      FACEBOOK: '/ads/meta/sync',
      GOOGLE_ADS: '/ads/google/sync',
      KOMMO: '/ads/kommo/sync',
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

  async getAttributionSummary(days: number): Promise<{ success: boolean; data: AttributionSummary }> {
    const response = await this.client.get('/ads/attribution/summary', { params: { days } });
    return response.data;
  }

  async getKommoLeads(): Promise<any[]> {
    const response = await this.client.get('/kommo/leads');
    const payload = response.data;
    return Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
  }

  // ─── AI Insights ─────────────────────────────────────────────────────────

  async generateInsights(): Promise<{ success: boolean; message: string; data: { analysisId: string } }> {
    const response = await this.client.post('/ai/insights/generate');
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
}

export const apiService = new ApiService();
