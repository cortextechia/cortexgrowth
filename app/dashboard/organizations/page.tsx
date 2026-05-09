'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { apiService } from '@/lib/api';
import { Organization, User, Plan, OrgStatus, UserRole, UserStatus, TrafficManagerWithClients, TrafficManagerClient } from '@/types';

function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

const PLAN_BADGE: Record<Plan, string> = {
  STARTER:      'bg-blue-50 text-blue-600',
  PROFESSIONAL: 'bg-purple-50 text-purple-700',
  ENTERPRISE:   'bg-amber-50 text-amber-700',
};

const STATUS_BADGE: Record<OrgStatus, string> = {
  ACTIVE:    'bg-green-50 text-green-700',
  SUSPENDED: 'bg-red-50 text-red-600',
  CANCELLED: 'bg-gray-100 text-gray-500',
};

const STATUS_LABEL: Record<OrgStatus, string> = {
  ACTIVE:    'Ativa',
  SUSPENDED: 'Suspensa',
  CANCELLED: 'Cancelada',
};

const ROLE_BADGE: Record<UserRole, string> = {
  SUPER_ADMIN:     'bg-purple-50 text-purple-700',
  ADMIN:           'bg-blue-50 text-blue-600',
  USER:            'bg-gray-100 text-gray-600',
  VIEWER:          'bg-gray-50 text-gray-400',
  TRAFFIC_MANAGER: 'bg-violet-50 text-violet-700',
};

const USER_STATUS_BADGE: Record<UserStatus, string> = {
  ACTIVE:    'bg-green-50 text-green-700',
  INACTIVE:  'bg-gray-100 text-gray-500',
  SUSPENDED: 'bg-red-50 text-red-600',
};

function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function SubscriptionEndsCell({ value }: { value?: Date | string }) {
  if (!value) return <span className="text-gray-300">—</span>;
  const d = new Date(value);
  const isExpired = d < new Date();
  return (
    <span className={isExpired ? 'text-red-500 font-medium' : 'text-gray-500'}>
      {formatDate(d)}
      {isExpired && <span className="ml-1 text-xs">(expirado)</span>}
    </span>
  );
}

interface EditModal {
  org: Organization;
  name: string;
  plan: Plan;
  status: OrgStatus;
}

interface UsersModal {
  org: Organization;
  users: User[];
  isLoading: boolean;
  showCreate: boolean;
  createForm: { name: string; email: string; password: string; role: UserRole };
  isCreating: boolean;
}

export default function OrganizationsPage() {
  const { user } = useAuth();
  const router = useRouter();

  // Aba ativa: organizações ou gestores de tráfego
  const [activeTab, setActiveTab] = useState<'orgs' | 'managers'>('orgs');

  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Create form
  const [showCreate, setShowCreate] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', plan: Plan.STARTER });

  // Gestores de tráfego
  const [managers, setManagers] = useState<TrafficManagerWithClients[]>([]);
  const [managersLoading, setManagersLoading] = useState(false);
  const [showCreateManager, setShowCreateManager] = useState(false);
  const [isCreatingManager, setIsCreatingManager] = useState(false);
  const [managerForm, setManagerForm] = useState({ name: '', email: '', password: '' });
  const [deletingManagerId, setDeletingManagerId] = useState<string | null>(null);
  // Modal para vincular clientes a um gestor
  const [clientsModal, setClientsModal] = useState<{ manager: TrafficManagerWithClients } | null>(null);
  const [linkingOrgId, setLinkingOrgId] = useState<string | null>(null);

  // Edit modal
  const [editModal, setEditModal] = useState<EditModal | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Delete
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Meta sync
  const [syncingMetaId, setSyncingMetaId] = useState<string | null>(null);

  // Users modal
  const [usersModal, setUsersModal] = useState<UsersModal | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const fetchOrgs = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiService.getOrganizations();
      setOrgs(res.organizations);
    } catch {
      setError('Erro ao carregar organizações.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchManagers = useCallback(async () => {
    setManagersLoading(true);
    try {
      const res = await apiService.getManagers();
      setManagers(res.data);
    } catch {
      showToast('Erro ao carregar gestores.', 'error');
    } finally {
      setManagersLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (user?.role !== UserRole.SUPER_ADMIN) {
      router.replace('/dashboard');
      return;
    }
    void fetchOrgs();
    void fetchManagers();
  }, [user, router, fetchOrgs, fetchManagers]);

  const handleCreateManager = async () => {
    if (!managerForm.name.trim() || !managerForm.email.trim() || !managerForm.password) return;
    setIsCreatingManager(true);
    try {
      await apiService.createManager(managerForm);
      setManagerForm({ name: '', email: '', password: '' });
      setShowCreateManager(false);
      showToast('Gestor criado com sucesso.');
      void fetchManagers();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao criar gestor.', 'error');
    } finally {
      setIsCreatingManager(false);
    }
  };

  const handleDeleteManager = async (id: string, name: string) => {
    if (!confirm(`Remover gestor "${name}"? Os vínculos com clientes serão desfeitos.`)) return;
    setDeletingManagerId(id);
    try {
      await apiService.deleteManager(id);
      showToast('Gestor removido.');
      void fetchManagers();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao remover gestor.', 'error');
    } finally {
      setDeletingManagerId(null);
    }
  };

  const handleAddClient = async (managerId: string, orgId: string) => {
    setLinkingOrgId(orgId);
    try {
      await apiService.addManagerClient(managerId, orgId);
      showToast('Cliente vinculado.');
      const res = await apiService.getManagers();
      setManagers(res.data);
      const updated = res.data.find((m) => m.id === managerId);
      if (updated) setClientsModal({ manager: updated });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao vincular.', 'error');
    } finally {
      setLinkingOrgId(null);
    }
  };

  const handleRemoveClient = async (managerId: string, orgId: string) => {
    setLinkingOrgId(orgId);
    try {
      await apiService.removeManagerClient(managerId, orgId);
      showToast('Cliente desvinculado.');
      const res = await apiService.getManagers();
      setManagers(res.data);
      const updated = res.data.find((m) => m.id === managerId);
      if (updated) setClientsModal({ manager: updated });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao desvincular.', 'error');
    } finally {
      setLinkingOrgId(null);
    }
  };

  const handleCreate = async () => {
    if (!createForm.name.trim()) return;
    setIsCreating(true);
    try {
      await apiService.createOrganization(createForm);
      setCreateForm({ name: '', plan: Plan.STARTER });
      setShowCreate(false);
      showToast('Organização criada com sucesso.');
      void fetchOrgs();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao criar organização.', 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const openEdit = (org: Organization) => {
    setEditModal({ org, name: org.name, plan: org.plan, status: org.status });
  };

  const handleSave = async () => {
    if (!editModal) return;
    setIsSaving(true);
    try {
      await apiService.updateOrganization(editModal.org.id, {
        name: editModal.name,
        plan: editModal.plan,
        status: editModal.status,
      });
      setEditModal(null);
      showToast('Organização atualizada.');
      void fetchOrgs();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao salvar.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (org: Organization) => {
    const userCount = org._count?.users ?? 0;
    if (userCount > 0) {
      showToast(`Remova os ${userCount} usuário(s) antes de deletar.`, 'error');
      return;
    }
    if (!confirm(`Deletar "${org.name}"? Esta ação não pode ser desfeita.`)) return;
    setDeletingId(org.id);
    try {
      await apiService.deleteOrganization(org.id);
      showToast('Organização deletada.');
      void fetchOrgs();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao deletar.', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const handleSyncMeta = async (org: Organization) => {
    setSyncingMetaId(org.id);
    try {
      const res = await apiService.syncMetaForOrg(org.id);
      showToast(res.message, 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao sincronizar Meta Ads.', 'error');
    } finally {
      setSyncingMetaId(null);
    }
  };

  const openUsers = async (org: Organization) => {
    setUsersModal({
      org,
      users: [],
      isLoading: true,
      showCreate: false,
      createForm: { name: '', email: '', password: '', role: UserRole.ADMIN },
      isCreating: false,
    });
    try {
      const res = await apiService.getOrgUsers(org.id);
      setUsersModal((prev) => prev ? { ...prev, users: res.users, isLoading: false } : prev);
    } catch {
      setUsersModal((prev) => prev ? { ...prev, isLoading: false } : prev);
      showToast('Erro ao carregar usuários.', 'error');
    }
  };

  const handleCreateOrgUser = async () => {
    if (!usersModal) return;
    setUsersModal((prev) => prev ? { ...prev, isCreating: true } : prev);
    try {
      await apiService.createOrgUser(usersModal.org.id, usersModal.createForm);
      showToast('Usuário criado com sucesso.');
      // Reload users list and close create form
      const res = await apiService.getOrgUsers(usersModal.org.id);
      setUsersModal((prev) => prev ? {
        ...prev,
        users: res.users,
        showCreate: false,
        isCreating: false,
        createForm: { name: '', email: '', password: '', role: UserRole.ADMIN },
      } : prev);
      void fetchOrgs();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao criar usuário.', 'error');
      setUsersModal((prev) => prev ? { ...prev, isCreating: false } : prev);
    }
  };

  if (user?.role !== UserRole.SUPER_ADMIN) return null;

  return (
    <div className="w-full max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-5 gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Administração</h1>
          <p className="mt-1 text-sm text-gray-500">Gerencie clientes e gestores de tráfego.</p>
        </div>
        {activeTab === 'orgs' && (
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="shrink-0 flex items-center gap-2 rounded-lg bg-gray-900 px-3 sm:px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 transition-colors"
          >
            {showCreate ? 'Cancelar' : '+ Nova Org'}
          </button>
        )}
        {activeTab === 'managers' && (
          <button
            onClick={() => setShowCreateManager(!showCreateManager)}
            className="shrink-0 flex items-center gap-2 rounded-lg bg-violet-700 px-3 sm:px-4 py-2 text-sm font-medium text-white hover:bg-violet-600 transition-colors"
          >
            {showCreateManager ? 'Cancelar' : '+ Novo Gestor'}
          </button>
        )}
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 mb-6 p-1 rounded-xl w-fit" style={{ backgroundColor: '#f1f5f9' }}>
        {(['orgs', 'managers'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
            style={activeTab === tab
              ? { backgroundColor: '#ffffff', color: '#111827', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }
              : { color: '#6b7280' }
            }
          >
            {tab === 'orgs' ? 'Organizações' : 'Gestores de Tráfego'}
          </button>
        ))}
      </div>

      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${
          toast.type === 'success' ? 'bg-gray-900 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.message}
        </div>
      )}

      {activeTab === 'orgs' && <>
      {/* Create Form */}
      {showCreate && (
        <div className="mb-6 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Nova Organização</h2>
          <form onSubmit={(e) => { e.preventDefault(); void handleCreate(); }} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Nome</label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))}
                  required
                  placeholder="Nome do cliente"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Plano</label>
                <select
                  value={createForm.plan}
                  onChange={(e) => setCreateForm((p) => ({ ...p, plan: e.target.value as Plan }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                >
                  {Object.values(Plan).map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isCreating}
                className="flex items-center gap-2 rounded-lg bg-gray-900 px-5 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {isCreating && <Spinner />}
                {isCreating ? 'Criando...' : 'Criar organização'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-400">
            <Spinner /> Carregando...
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 px-6 py-4 text-sm text-red-600">
            {error}
            <button onClick={fetchOrgs} className="ml-auto text-xs underline">Tentar novamente</button>
          </div>
        ) : orgs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-sm font-medium text-gray-900">Nenhuma organização</p>
            <p className="mt-1 text-xs text-gray-400">Crie a primeira organização acima.</p>
          </div>
        ) : (
          <>
            {/* Mobile */}
            <div className="sm:hidden divide-y divide-gray-100">
              {orgs.map((org) => (
                <div key={org.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{org.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{org.slug}</p>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${PLAN_BADGE[org.plan]}`}>{org.plan}</span>
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${STATUS_BADGE[org.status]}`}>{STATUS_LABEL[org.status]}</span>
                        <span className="text-xs text-gray-400">{org._count?.users ?? 0} usuários</span>
                      </div>
                      {org.subscriptionEnds && (
                        <p className="text-xs mt-1">
                          <span className="text-gray-400">Expira: </span>
                          <SubscriptionEndsCell value={org.subscriptionEnds} />
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5 shrink-0 items-end">
                      <button onClick={() => void openUsers(org)} className="text-xs text-indigo-600 hover:underline">Usuários</button>
                      <button
                        onClick={() => void handleSyncMeta(org)}
                        disabled={syncingMetaId === org.id}
                        className="flex items-center gap-1 text-xs text-emerald-600 hover:underline disabled:opacity-50"
                      >
                        {syncingMetaId === org.id ? <Spinner className="h-3 w-3" /> : 'Sync Meta'}
                      </button>
                      <button onClick={() => openEdit(org)} className="text-xs text-blue-600 hover:underline">Editar</button>
                      <button
                        onClick={() => void handleDelete(org)}
                        disabled={deletingId === org.id}
                        className="text-xs text-gray-400 hover:text-red-600 disabled:opacity-50 transition-colors"
                      >
                        {deletingId === org.id ? <Spinner className="h-3 w-3" /> : 'Deletar'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50/60 border-b border-gray-100">
                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-400">Nome</th>
                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-400">Plano</th>
                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-400">Status</th>
                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-400">Usuários</th>
                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-400">Expira em</th>
                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-400">Criada em</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {orgs.map((org) => (
                    <tr key={org.id} className="border-t border-gray-100 hover:bg-gray-50/60 transition-colors">
                      <td className="px-5 py-3">
                        <p className="font-medium text-gray-900">{org.name}</p>
                        <p className="text-xs text-gray-400">{org.slug}</p>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${PLAN_BADGE[org.plan]}`}>{org.plan}</span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${STATUS_BADGE[org.status]}`}>{STATUS_LABEL[org.status]}</span>
                      </td>
                      <td className="px-5 py-3 text-gray-500">
                        {org._count?.users ?? 0} / {org._count?.integrations ?? 0} int.
                      </td>
                      <td className="px-5 py-3 text-sm">
                        <SubscriptionEndsCell value={org.subscriptionEnds} />
                      </td>
                      <td className="px-5 py-3 text-gray-400 text-xs">{formatDate(org.createdAt)}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-3">
                          <button onClick={() => void openUsers(org)} className="text-xs text-indigo-600 hover:underline">
                            Usuários
                          </button>
                          <button
                            onClick={() => void handleSyncMeta(org)}
                            disabled={syncingMetaId === org.id}
                            className="flex items-center gap-1 text-xs text-emerald-600 hover:underline disabled:opacity-50"
                          >
                            {syncingMetaId === org.id && <Spinner className="h-3 w-3" />}
                            Sync Meta
                          </button>
                          <button onClick={() => openEdit(org)} className="text-xs text-blue-600 hover:underline">
                            Editar
                          </button>
                          <button
                            onClick={() => void handleDelete(org)}
                            disabled={deletingId === org.id}
                            className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-600 disabled:opacity-50 transition-colors"
                          >
                            {deletingId === org.id && <Spinner className="h-3 w-3" />}
                            Deletar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Edit Modal */}
      {editModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Editar organização</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Nome</label>
                <input
                  type="text"
                  value={editModal.name}
                  onChange={(e) => setEditModal((p) => p ? { ...p, name: e.target.value } : p)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Plano</label>
                <select
                  value={editModal.plan}
                  onChange={(e) => setEditModal((p) => p ? { ...p, plan: e.target.value as Plan } : p)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                >
                  {Object.values(Plan).map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Status</label>
                <select
                  value={editModal.status}
                  onChange={(e) => setEditModal((p) => p ? { ...p, status: e.target.value as OrgStatus } : p)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                >
                  {Object.values(OrgStatus).map((s) => (
                    <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setEditModal(null)}
                className="rounded-lg px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => void handleSave()}
                disabled={isSaving}
                className="flex items-center gap-2 rounded-lg bg-gray-900 px-5 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {isSaving && <Spinner />}
                {isSaving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Users Modal */}
      {usersModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl flex flex-col max-h-[85vh]">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-base font-semibold text-gray-900">Usuários — {usersModal.org.name}</h2>
                <p className="text-xs text-gray-400 mt-0.5">{usersModal.org.slug}</p>
              </div>
              <button
                onClick={() => setUsersModal(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* User list */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {usersModal.isLoading ? (
                <div className="flex items-center justify-center gap-2 py-8 text-sm text-gray-400">
                  <Spinner /> Carregando...
                </div>
              ) : usersModal.users.length === 0 ? (
                <p className="text-center text-sm text-gray-400 py-8">Nenhum usuário nesta organização.</p>
              ) : (
                <div className="space-y-2">
                  {usersModal.users.map((u) => (
                    <div key={u.id} className="flex items-center justify-between rounded-lg border border-gray-100 px-4 py-2.5">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{u.name}</p>
                        <p className="text-xs text-gray-400 truncate">{u.email}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${ROLE_BADGE[u.role]}`}>{u.role}</span>
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${USER_STATUS_BADGE[u.status]}`}>{u.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Create user form */}
              {usersModal.showCreate && (
                <form
                  onSubmit={(e) => { e.preventDefault(); void handleCreateOrgUser(); }}
                  className="mt-4 rounded-xl border border-gray-200 p-4 space-y-3 bg-gray-50"
                >
                  <p className="text-xs font-semibold text-gray-700">Novo usuário</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Nome</label>
                      <input
                        type="text"
                        required
                        value={usersModal.createForm.name}
                        onChange={(e) => setUsersModal((p) => p ? { ...p, createForm: { ...p.createForm, name: e.target.value } } : p)}
                        className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Papel</label>
                      <select
                        value={usersModal.createForm.role}
                        onChange={(e) => setUsersModal((p) => p ? { ...p, createForm: { ...p.createForm, role: e.target.value as UserRole } } : p)}
                        className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
                      >
                        {[UserRole.ADMIN, UserRole.USER, UserRole.VIEWER].map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Email</label>
                    <input
                      type="email"
                      required
                      value={usersModal.createForm.email}
                      onChange={(e) => setUsersModal((p) => p ? { ...p, createForm: { ...p.createForm, email: e.target.value } } : p)}
                      className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Senha (mín. 8 caracteres)</label>
                    <input
                      type="password"
                      required
                      minLength={8}
                      value={usersModal.createForm.password}
                      onChange={(e) => setUsersModal((p) => p ? { ...p, createForm: { ...p.createForm, password: e.target.value } } : p)}
                      className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setUsersModal((p) => p ? { ...p, showCreate: false } : p)}
                      className="rounded-lg px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-200 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={usersModal.isCreating}
                      className="flex items-center gap-1.5 rounded-lg bg-gray-900 px-4 py-1.5 text-xs font-medium text-white hover:bg-gray-700 disabled:opacity-60 transition-colors"
                    >
                      {usersModal.isCreating && <Spinner className="h-3 w-3" />}
                      {usersModal.isCreating ? 'Criando...' : 'Criar usuário'}
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* Modal footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex justify-between items-center">
              <span className="text-xs text-gray-400">{usersModal.users.length} usuário(s)</span>
              {!usersModal.showCreate && (
                <button
                  onClick={() => setUsersModal((p) => p ? { ...p, showCreate: true } : p)}
                  className="flex items-center gap-1.5 rounded-lg bg-gray-900 px-4 py-2 text-xs font-medium text-white hover:bg-gray-700 transition-colors"
                >
                  + Adicionar usuário
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      </> }

      {/* ===== ABA: GESTORES DE TRÁFEGO ===== */}
      {activeTab === 'managers' && (
        <>
          {/* Create manager form */}
          {showCreateManager && (
            <div className="mb-6 rounded-xl border border-violet-100 bg-white p-6 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">Novo Gestor de Tráfego</h2>
              <form onSubmit={(e) => { e.preventDefault(); void handleCreateManager(); }} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Nome</label>
                    <input
                      type="text"
                      required
                      value={managerForm.name}
                      onChange={(e) => setManagerForm((p) => ({ ...p, name: e.target.value }))}
                      placeholder="Nome do gestor"
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Email</label>
                    <input
                      type="email"
                      required
                      value={managerForm.email}
                      onChange={(e) => setManagerForm((p) => ({ ...p, email: e.target.value }))}
                      placeholder="email@gestor.com"
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">Senha (mín. 8 caracteres)</label>
                    <input
                      type="password"
                      required
                      minLength={8}
                      value={managerForm.password}
                      onChange={(e) => setManagerForm((p) => ({ ...p, password: e.target.value }))}
                      placeholder="••••••••"
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={isCreatingManager}
                    className="flex items-center gap-2 rounded-lg bg-violet-700 px-5 py-2 text-sm font-medium text-white hover:bg-violet-600 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                  >
                    {isCreatingManager && <Spinner />}
                    {isCreatingManager ? 'Criando...' : 'Criar gestor'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Managers list */}
          {managersLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-gray-400">
              <Spinner /> Carregando gestores...
            </div>
          ) : managers.length === 0 ? (
            <div className="rounded-xl border border-gray-100 bg-white shadow-sm flex flex-col items-center justify-center py-14 text-center">
              <div className="h-10 w-10 rounded-full flex items-center justify-center mb-3" style={{ backgroundColor: 'rgba(168,85,247,0.1)' }}>
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} style={{ color: '#a855f7' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-900">Nenhum gestor cadastrado</p>
              <p className="mt-1 text-xs text-gray-400">Crie o primeiro gestor de tráfego acima.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {managers.map((manager) => {
                const linkedOrgIds = new Set(manager.managedOrgs.map((mo) => mo.organization.id));
                const availableOrgs = orgs.filter((o) => !linkedOrgIds.has(o.id));
                const isOpen = clientsModal?.manager.id === manager.id;

                return (
                  <div key={manager.id} className="rounded-xl border border-gray-100 bg-white shadow-sm overflow-hidden">
                    {/* Manager row */}
                    <div className="flex items-center justify-between px-5 py-4 gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold" style={{ backgroundColor: 'rgba(168,85,247,0.12)', color: '#a855f7' }}>
                          {manager.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{manager.name}</p>
                          <p className="text-xs text-gray-400 truncate">{manager.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="hidden sm:inline text-xs text-gray-400">
                          {manager.managedOrgs.length} cliente(s)
                        </span>
                        <button
                          onClick={() => setClientsModal(isOpen ? null : { manager })}
                          className="text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors"
                          style={isOpen
                            ? { borderColor: '#a855f7', color: '#a855f7', backgroundColor: 'rgba(168,85,247,0.06)' }
                            : { borderColor: '#e5e7eb', color: '#6b7280' }
                          }
                        >
                          {isOpen ? 'Fechar' : 'Gerenciar clientes'}
                        </button>
                        <button
                          onClick={() => void handleDeleteManager(manager.id, manager.name)}
                          disabled={deletingManagerId === manager.id}
                          className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-600 disabled:opacity-50 transition-colors"
                        >
                          {deletingManagerId === manager.id ? <Spinner className="h-3 w-3" /> : 'Remover'}
                        </button>
                      </div>
                    </div>

                    {/* Clients panel (expandable) */}
                    {isOpen && (
                      <div className="border-t border-gray-100 px-5 py-4 bg-gray-50/60">
                        <p className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wide">Clientes vinculados</p>

                        {manager.managedOrgs.length === 0 ? (
                          <p className="text-xs text-gray-400 mb-4">Nenhum cliente vinculado ainda.</p>
                        ) : (
                          <div className="flex flex-wrap gap-2 mb-4">
                            {manager.managedOrgs.map((mo) => (
                              <span
                                key={mo.organization.id}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700"
                              >
                                {mo.organization.name}
                                <button
                                  onClick={() => void handleRemoveClient(manager.id, mo.organization.id)}
                                  disabled={linkingOrgId === mo.organization.id}
                                  className="text-gray-300 hover:text-red-500 transition-colors disabled:opacity-50"
                                  title="Desvincular"
                                >
                                  {linkingOrgId === mo.organization.id ? <Spinner className="h-2.5 w-2.5" /> : (
                                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  )}
                                </button>
                              </span>
                            ))}
                          </div>
                        )}

                        {availableOrgs.length > 0 && (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 shrink-0">Adicionar cliente:</span>
                            <div className="flex flex-wrap gap-2">
                              {availableOrgs.map((org) => (
                                <button
                                  key={org.id}
                                  onClick={() => void handleAddClient(manager.id, org.id)}
                                  disabled={linkingOrgId === org.id}
                                  className="inline-flex items-center gap-1 rounded-lg border border-dashed border-gray-300 px-3 py-1.5 text-xs text-gray-500 hover:border-violet-400 hover:text-violet-600 transition-colors disabled:opacity-50"
                                >
                                  {linkingOrgId === org.id ? <Spinner className="h-3 w-3" /> : '+'}
                                  {org.name}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}