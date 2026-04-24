'use client';

import { useState, useCallback, useEffect } from 'react';
import { useUsers } from '@/hooks/useApi';
import { PermissionGuard } from '@/components/ProtectedRoute';

function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

const ROLE_BADGE: Record<string, string> = {
  SUPER_ADMIN: 'bg-purple-50 text-purple-700',
  ADMIN:       'bg-purple-50 text-purple-700',
  USER:        'bg-blue-50 text-blue-700',
  VIEWER:      'bg-gray-100 text-gray-500',
};

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN:       'Admin',
  USER:        'Usuário',
  VIEWER:      'Viewer',
};

const STATUS_BADGE: Record<string, string> = {
  ACTIVE:    'bg-green-50 text-green-700',
  SUSPENDED: 'bg-red-50 text-red-600',
  INACTIVE:  'bg-gray-100 text-gray-500',
};

const STATUS_LABEL: Record<string, string> = {
  ACTIVE:    'Ativo',
  SUSPENDED: 'Suspenso',
  INACTIVE:  'Inativo',
};

export default function UsersPage() {
  const { users, isLoading, error, fetchUsers, createUser, deleteUser } = useUsers();
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [formData, setFormData] = useState({ name: '', email: '', password: '', role: 'USER' });

  useEffect(() => { fetchUsers(); }, []);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await createUser(formData);
      setFormData({ name: '', email: '', password: '', role: 'USER' });
      setShowForm(false);
      showToast('Usuário criado com sucesso.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao criar usuário', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (userId: string, userName: string) => {
    if (!confirm(`Deletar ${userName}? Esta ação não pode ser desfeita.`)) return;
    setDeletingId(userId);
    try {
      await deleteUser(userId);
      showToast('Usuário removido.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao deletar usuário', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="w-full max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 sm:mb-8 gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Usuários</h1>
          <p className="mt-1 text-sm text-gray-500">Gerencie os membros da equipe.</p>
        </div>
        <PermissionGuard requiredRoles={['ADMIN', 'SUPER_ADMIN']}>
          <button
            onClick={() => setShowForm(!showForm)}
            className="shrink-0 flex items-center gap-2 rounded-lg bg-gray-900 px-3 sm:px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors"
          >
            {showForm ? 'Cancelar' : '+ Novo Usuário'}
          </button>
        </PermissionGuard>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${
          toast.type === 'success' ? 'bg-gray-900 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.message}
        </div>
      )}

      {/* Create Form */}
      {showForm && (
        <div className="mb-6 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Novo Usuário</h2>
          <form onSubmit={(e) => { e.preventDefault(); void handleSubmit(); }} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Nome</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  placeholder="Nome completo"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Email</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  placeholder="usuario@empresa.com"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Senha temporária</label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  placeholder="Mínimo 8 caracteres"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Função</label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                >
                  <option value="USER">Usuário — acesso ao dashboard</option>
                  <option value="ADMIN">Admin — gerencia usuários e integrações</option>
                  <option value="VIEWER">Viewer — somente leitura</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 rounded-lg bg-gray-900 px-5 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting && <Spinner />}
                {isSubmitting ? 'Criando...' : 'Criar usuário'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Users Table */}
      <div className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-400">
            <Spinner /> Carregando...
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 px-6 py-4 text-sm text-red-600">
            <span>{error}</span>
            <button onClick={fetchUsers} className="ml-auto text-xs underline">Tentar novamente</button>
          </div>
        ) : users.length > 0 ? (
          <>
            {/* Mobile card list */}
            <div className="sm:hidden divide-y divide-gray-100">
              {users.map((user) => (
                <div key={user.id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
                    <p className="text-xs text-gray-400 truncate mt-0.5">{user.email}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${ROLE_BADGE[user.role] ?? 'bg-gray-100 text-gray-600'}`}>
                        {ROLE_LABEL[user.role] ?? user.role}
                      </span>
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${STATUS_BADGE[user.status] ?? 'bg-gray-100 text-gray-500'}`}>
                        {STATUS_LABEL[user.status] ?? user.status}
                      </span>
                    </div>
                  </div>
                  <PermissionGuard requiredRoles={['ADMIN', 'SUPER_ADMIN']}>
                    <button
                      onClick={() => handleDelete(user.id, user.name)}
                      disabled={deletingId === user.id}
                      className="shrink-0 flex items-center gap-1 text-xs text-gray-400 hover:text-red-600 disabled:opacity-50 transition-colors"
                    >
                      {deletingId === user.id && <Spinner className="h-3 w-3" />}
                      Remover
                    </button>
                  </PermissionGuard>
                </div>
              ))}
            </div>
            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50/60 border-b border-gray-100">
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-400">Nome</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-400">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-400">Função</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-400">Status</th>
                    <th className="px-6 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-t border-gray-100 hover:bg-gray-50/60 transition-colors">
                      <td className="px-6 py-3 font-medium text-gray-900">{user.name}</td>
                      <td className="px-6 py-3 text-gray-500">{user.email}</td>
                      <td className="px-6 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${ROLE_BADGE[user.role] ?? 'bg-gray-100 text-gray-600'}`}>
                          {ROLE_LABEL[user.role] ?? user.role}
                        </span>
                      </td>
                      <td className="px-6 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${STATUS_BADGE[user.status] ?? 'bg-gray-100 text-gray-500'}`}>
                          {STATUS_LABEL[user.status] ?? user.status}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-right">
                        <PermissionGuard requiredRoles={['ADMIN', 'SUPER_ADMIN']}>
                          <button
                            onClick={() => handleDelete(user.id, user.name)}
                            disabled={deletingId === user.id}
                            className="flex items-center gap-1.5 ml-auto text-xs text-gray-400 hover:text-red-600 disabled:opacity-50 transition-colors"
                          >
                            {deletingId === user.id && <Spinner className="h-3 w-3" />}
                            Remover
                          </button>
                        </PermissionGuard>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-sm font-medium text-gray-900">Nenhum usuário</p>
            <p className="mt-1 text-xs text-gray-400">Crie o primeiro usuário acima.</p>
          </div>
        )}
      </div>
    </div>
  );
}