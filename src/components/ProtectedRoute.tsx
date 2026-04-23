'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, ReactNode } from 'react';

interface ProtectedProps {
  children: ReactNode;
  requiredRoles?: string[];
  loading?: ReactNode;
}

export function ProtectedRoute({
  children,
  requiredRoles,
  loading,
}: ProtectedProps) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/auth/login');
    }

    if (
      !isLoading &&
      isAuthenticated &&
      requiredRoles &&
      user &&
      !requiredRoles.includes(user.role)
    ) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, isLoading, router, requiredRoles, user]);

  if (isLoading) {
    return (
      loading || (
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      )
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (requiredRoles && user && !requiredRoles.includes(user.role)) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600">Acesso Negado</h1>
          <p className="text-gray-600 mt-2">Você não tem permissão para acessar esta página</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export function PermissionGuard({
  children,
  requiredRoles,
  fallback,
}: {
  children: ReactNode;
  requiredRoles: string[];
  fallback?: ReactNode;
}) {
  const { user } = useAuth();

  if (!user || !requiredRoles.includes(user.role)) {
    return fallback || null;
  }

  return <>{children}</>;
}