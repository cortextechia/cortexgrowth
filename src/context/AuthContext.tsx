'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AuthContextType, User, Organization, RegisterRequest, LoginRequest, AuthResponse } from '@/types';
import { apiService } from '@/lib/api';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Verificar token ao carregar app — com retry para tolerar restart do backend
  useEffect(() => {
    const initAuth = async () => {
      const storedToken = apiService.getAccessToken();
      if (!storedToken) {
        setIsLoading(false);
        return;
      }

      const MAX_RETRIES = 3;
      const RETRY_DELAY_MS = 2000;

      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
          const authResponse = await apiService.verifyToken();
          if (authResponse.success) {
            setToken(apiService.getAccessToken());
            setUser(authResponse.user);
            setOrganization(authResponse.organization || null);
          } else {
            apiService.clearTokens();
          }
          break; // sucesso — sai do loop
        } catch (error: any) {
          const isNetworkError = !error.response; // sem resposta HTTP = backend offline

          if (isNetworkError && attempt < MAX_RETRIES - 1) {
            // Backend provavelmente reiniciando — aguarda e tenta de novo
            await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
            continue;
          }

          if (!isNetworkError) {
            // 401 real ou token inválido — limpa tokens (interceptor já pode ter feito isso)
            apiService.clearTokens();
          }
          // Erro de rede após esgotar retries: mantém tokens no localStorage,
          // usuário verá tela de login mas poderá logar normalmente quando o backend voltar
          break;
        }
      }

      setIsLoading(false);
    };

    initAuth();
  }, []);

  const register = async (data: RegisterRequest): Promise<AuthResponse> => {
    try {
      const response = await apiService.register(data);
      if (response.success) {
        setToken(response.accessToken);
        setUser(response.user);
        setOrganization(response.organization || null);
      }
      return response;
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.message ||
        error.response?.data?.errors?.[0]?.msg ||
        error.message ||
        'Erro ao registrar';
      throw new Error(errorMessage);
    }
  };

  const login = async (data: LoginRequest): Promise<AuthResponse> => {
    try {
      const response = await apiService.login(data);
      if (response.success) {
        setToken(response.accessToken);
        setUser(response.user);
        setOrganization(response.organization || null);
      }
      return response;
    } catch (error: any) {
      throw error;
    }
  };

  const logout = async () => {
    setUser(null);
    setOrganization(null);
    setToken(null);
    await apiService.logout(); // invalida refresh token no servidor
  };

  const updateProfile = async (data: Partial<User>) => {
    if (!user) throw new Error('Usuário não autenticado');
    try {
      const response = await apiService.updateUser(user.id, data);
      if (response.success) {
        setUser(response.user);
      }
    } catch (error) {
      console.error('Erro ao atualizar perfil:', error);
      throw error;
    }
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    if (!user) throw new Error('Usuário não autenticado');
    try {
      await apiService.changePassword(user.id, currentPassword, newPassword);
    } catch (error) {
      console.error('Erro ao alterar senha:', error);
      throw error;
    }
  };

  const value: AuthContextType = {
    user,
    organization,
    token,
    isLoading,
    isAuthenticated: !!user && !!token,
    register,
    login,
    logout,
    updateProfile,
    changePassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
}