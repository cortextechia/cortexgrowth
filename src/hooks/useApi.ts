import { useState, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import { apiService } from '@/lib/api';
import type { AiAnalysis, AttributionSummary } from '@/types';

// Hook para gerenciar usuários
export function useUsers() {
  const { user, organization, isAuthenticated } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoading(true);
    try {
      const response = await apiService.getUsers();
      if (response.success) {
        setUsers(response.users);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao buscar usuários');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  const createUser = useCallback(
    async (data: { email: string; password: string; name: string; role: string }) => {
      try {
        const response = await apiService.createUser(data);
        if (response.success) {
          setUsers([...users, response.user]);
          return response.user;
        }
      } catch (err) {
        throw err;
      }
    },
    [users]
  );

  const updateUser = useCallback(
    async (id: string, data: any) => {
      try {
        const response = await apiService.updateUser(id, data);
        if (response.success) {
          setUsers(users.map((u) => (u.id === id ? response.user : u)));
          return response.user;
        }
      } catch (err) {
        throw err;
      }
    },
    [users]
  );

  const deleteUser = useCallback(
    async (id: string) => {
      try {
        const response = await apiService.deleteUser(id);
        if (response.success) {
          setUsers(users.filter((u) => u.id !== id));
        }
      } catch (err) {
        throw err;
      }
    },
    [users]
  );

  return {
    users,
    isLoading,
    error,
    fetchUsers,
    createUser,
    updateUser,
    deleteUser,
  };
}

// Hook para gerenciar integrações
export function useIntegrations() {
  const { isAuthenticated } = useAuth();
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchIntegrations = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoading(true);
    try {
      const response = await apiService.getIntegrations();
      if (response.success) {
        setIntegrations(response.integrations);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao buscar integrações');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  const createIntegration = useCallback(
    async (data: { type: string; name: string; accessToken?: string; refreshToken?: string }) => {
      try {
        const response = await apiService.createIntegration(data);
        if (response.success) {
          setIntegrations([...integrations, response.integration]);
          return response.integration;
        }
      } catch (err) {
        throw err;
      }
    },
    [integrations]
  );

  const updateIntegration = useCallback(
    async (id: string, data: any) => {
      try {
        const response = await apiService.updateIntegration(id, data);
        if (response.success) {
          setIntegrations(
            integrations.map((i) => (i.id === id ? response.integration : i))
          );
          return response.integration;
        }
      } catch (err) {
        throw err;
      }
    },
    [integrations]
  );

  const deleteIntegration = useCallback(
    async (id: string) => {
      try {
        const response = await apiService.deleteIntegration(id);
        if (response.success) {
          setIntegrations(integrations.filter((i) => i.id !== id));
        }
      } catch (err) {
        throw err;
      }
    },
    [integrations]
  );

  const testIntegration = useCallback(async (id: string) => {
    try {
      const response = await apiService.testIntegration(id);
      return response.testResult;
    } catch (err) {
      throw err;
    }
  }, []);

  const generateMockData = useCallback(async (id: string) => {
    try {
      const response = await apiService.generateMockData(id);
      return response.data;
    } catch (err) {
      throw err;
    }
  }, []);

  const syncIntegration = useCallback(async (type: string) => {
    return apiService.syncIntegration(type);
  }, []);

  return {
    integrations,
    isLoading,
    error,
    fetchIntegrations,
    createIntegration,
    updateIntegration,
    deleteIntegration,
    testIntegration,
    generateMockData,
    syncIntegration,
  };
}

// Hook para gerenciar dados do dashboard
export function useDashboard() {
  const { isAuthenticated } = useAuth();
  const [metaInsights, setMetaInsights] = useState<any[]>([]);
  const [googleAdsMetrics, setGoogleAdsMetrics] = useState<any[]>([]);
  const [kommoLeads, setKommoLeads] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [attributionSummary, setAttributionSummary] = useState<AttributionSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMetaInsights = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoading(true);
    try {
      const response = await apiService.getMetaInsights();
      if (response.success) {
        setMetaInsights(response.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao buscar insights do Meta');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  const fetchGoogleAdsMetrics = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoading(true);
    try {
      const response = await apiService.getGoogleAdsMetrics();
      if (response.success) {
        setGoogleAdsMetrics(response.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao buscar métricas do Google Ads');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  const fetchStats = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoading(true);
    try {
      const response = await apiService.getStats();
      if (response.success) {
        setStats(response.stats ?? null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao buscar estatísticas');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  const fetchKommoLeads = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const data = await apiService.getKommoLeads();
      setKommoLeads(data);
    } catch {
      // silently ignore — Kommo may not be connected
    }
  }, [isAuthenticated]);

  const fetchAttributionSummary = useCallback(async (days: number) => {
    if (!isAuthenticated) return;
    try {
      const response = await apiService.getAttributionSummary(days);
      if (response.success) setAttributionSummary(response.data);
    } catch {
      // silently ignore — attribution depends on Kommo being connected
    }
  }, [isAuthenticated]);

  const fetchAllDashboardData = useCallback(async (days = 30) => {
    await Promise.all([fetchMetaInsights(), fetchGoogleAdsMetrics(), fetchStats(), fetchKommoLeads(), fetchAttributionSummary(days)]);
  }, [fetchMetaInsights, fetchGoogleAdsMetrics, fetchStats, fetchKommoLeads, fetchAttributionSummary]);

  return {
    metaInsights,
    googleAdsMetrics,
    kommoLeads,
    stats,
    attributionSummary,
    isLoading,
    error,
    fetchMetaInsights,
    fetchGoogleAdsMetrics,
    fetchKommoLeads,
    fetchStats,
    fetchAttributionSummary,
    fetchAllDashboardData,
  };
}

// Hook para gerenciar AI Insights
export function useAiInsights() {
  const { isAuthenticated } = useAuth();
  const [latestInsight, setLatestInsight] = useState<AiAnalysis | null>(null);
  const [insights, setInsights] = useState<AiAnalysis[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLatestInsight = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoading(true);
    try {
      const response = await apiService.getLatestInsight();
      if (response.success) {
        setLatestInsight(response.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao buscar insight');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  const fetchInsights = useCallback(async (params?: { limit?: number; page?: number }) => {
    if (!isAuthenticated) return;
    setIsLoading(true);
    try {
      const response = await apiService.getInsights(params);
      if (response.success) {
        setInsights(response.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao buscar insights');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  const generateInsights = useCallback(async (): Promise<boolean> => {
    if (!isAuthenticated) return false;
    setIsGenerating(true);
    setError(null);
    try {
      const response = await apiService.generateInsights();
      if (response.success) {
        await fetchLatestInsight();
        return true;
      }
      return false;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao gerar relatório');
      return false;
    } finally {
      setIsGenerating(false);
    }
  }, [isAuthenticated, fetchLatestInsight]);

  return {
    latestInsight,
    insights,
    isLoading,
    isGenerating,
    error,
    fetchLatestInsight,
    fetchInsights,
    generateInsights,
  };
}