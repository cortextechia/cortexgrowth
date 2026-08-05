'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { apiService } from '@/lib/api';
import { Organization, User, Plan, OrgStatus, UserRole, UserStatus, TrafficManagerWithClients } from '@/types';

function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

const PLAN_BADGE_STYLE: Record<Plan, React.CSSProperties> = {
  DEMO:         { backgroundColor: 'var(--plano-demo-soft)', color: 'var(--plano-demo)' },
  STARTER:      { backgroundColor: 'var(--accent-dim)',      color: 'var(--accent)' },
  PROFESSIONAL: { backgroundColor: 'rgba(139,92,246,0.12)',  color: '#8b5cf6' },
  ENTERPRISE:   { backgroundColor: 'var(--badge-warn-bg)',   color: 'var(--badge-warn-text)' },
};

const STATUS_BADGE_STYLE: Record<OrgStatus, React.CSSProperties> = {
  ACTIVE:    { backgroundColor: 'var(--badge-success-bg)', color: 'var(--badge-success-text)' },
  SUSPENDED: { backgroundColor: 'var(--badge-error-bg)',   color: 'var(--badge-error-text)' },
  CANCELLED: { backgroundColor: 'var(--bg-elevated)',      color: 'var(--text-muted)' },
};

const STATUS_LABEL: Record<OrgStatus, string> = {
  ACTIVE:    'Ativa',
  SUSPENDED: 'Suspensa',
  CANCELLED: 'Cancelada',
};

const ROLE_BADGE_STYLE: Record<UserRole, React.CSSProperties> = {
  SUPER_ADMIN:     { backgroundColor: 'rgba(139,92,246,0.12)', color: '#8b5cf6' },
  ADMIN:           { backgroundColor: 'var(--accent-dim)',      color: 'var(--accent)' },
  USER:            { backgroundColor: 'var(--bg-elevated)',     color: 'var(--text-secondary)' },
  VIEWER:          { backgroundColor: 'var(--bg-elevated)',     color: 'var(--text-muted)' },
  TRAFFIC_MANAGER: { backgroundColor: 'rgba(139,92,246,0.12)', color: '#8b5cf6' },
};

const USER_STATUS_BADGE_STYLE: Record<UserStatus, React.CSSProperties> = {
  ACTIVE:    { backgroundColor: 'var(--badge-success-bg)', color: 'var(--badge-success-text)' },
  INACTIVE:  { backgroundColor: 'var(--bg-elevated)',      color: 'var(--text-muted)' },
  SUSPENDED: { backgroundColor: 'var(--badge-error-bg)',   color: 'var(--badge-error-text)' },
};

function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function SubscriptionEndsCell({ value }: { value?: Date | string }) {
  if (!value) return <span style={{ color: 'var(--text-muted)' }}>{'—'}</span>;
  const d = new Date(value);
  const isExpired = d < new Date();
  return (
    <span style={{ color: isExpired ? 'var(--badge-error-text)' : 'var(--text-secondary)', fontWeight: isExpired ? 500 : undefined }}>
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
  subscriptionEnds: string;
}

interface UsersModal {
  org: Organization;
  users: User[];
  isLoading: boolean;
  showCreate: boolean;
  createForm: { name: string; email: string; password: string; role: UserRole };
  isCreating: boolean;
}

const inputStyle: React.CSSProperties = {
  border: '1px solid var(--input-border)',
  backgroundColor: 'var(--input-bg)',
  color: 'var(--text-primary)',
};

const selectStyle: React.CSSProperties = {
  border: '1px solid var(--input-border)',
  backgroundColor: 'var(--bg-surface)',
  color: 'var(--text-primary)',
};

export default function OrganizationsPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<'orgs' | 'managers'>('orgs');

  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', plan: Plan.STARTER });

  const [managers, setManagers] = useState<TrafficManagerWithClients[]>([]);
  const [managersLoading, setManagersLoading] = useState(false);
  const [showCreateManager, setShowCreateManager] = useState(false);
  const [isCreatingManager, setIsCreatingManager] = useState(false);
  const [managerForm, setManagerForm] = useState({ name: '', email: '', password: '' });
  const [deletingManagerId, setDeletingManagerId] = useState<string | null>(null);
  const [clientsModal, setClientsModal] = useState<{ manager: TrafficManagerWithClients } | null>(null);
  const [linkingOrgId, setLinkingOrgId] = useState<string | null>(null);

  const [editModal, setEditModal] = useState<EditModal | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [syncingMetaId, setSyncingMetaId] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const [backfillModal, setBackfillModal] = useState<{ org: Organization; since: string; until: string } | null>(null);
  const [isBackfilling, setIsBackfilling] = useState(false);

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
    const ends = org.subscriptionEnds ? new Date(org.subscriptionEnds).toISOString().slice(0, 10) : '';
    setEditModal({ org, name: org.name, plan: org.plan, status: org.status, subscriptionEnds: ends });
  };

  const handleSave = async () => {
    if (!editModal) return;
    setIsSaving(true);
    try {
      await apiService.updateOrganization(editModal.org.id, {
        name: editModal.name,
        plan: editModal.plan,
        status: editModal.status,
        subscriptionEnds: editModal.subscriptionEnds ? new Date(editModal.subscriptionEnds) : undefined,
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

  const handleBackfillMeta = async () => {
    if (!backfillModal) return;
    setIsBackfilling(true);
    try {
      const res = await apiService.backfillMetaForOrg(backfillModal.org.id, backfillModal.since, backfillModal.until);
      showToast(res.message, 'success');
      setBackfillModal(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro no backfill Meta Ads.', 'error');
    } finally {
      setIsBackfilling(false);
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
          <h1 className="text-xl sm:text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>Administração</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>Gerencie clientes e gestores de tráfego.</p>
        </div>
        {activeTab === 'orgs' && (
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="shrink-0 flex items-center gap-2 rounded-lg px-3 sm:px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-80"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            {showCreate ? 'Cancelar' : '+ Nova Org'}
          </button>
        )}
        {activeTab === 'managers' && (
          <button
            onClick={() => setShowCreateManager(!showCreateManager)}
            className="shrink-0 flex items-center gap-2 rounded-lg px-3 sm:px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-80"
            style={{ backgroundColor: 'rgba(139,92,246,0.9)' }}
          >
            {showCreateManager ? 'Cancelar' : '+ Novo Gestor'}
          </button>
        )}
      </div>

      {/* Tab switcher */}
      <div
        className="flex gap-1 mb-6 p-1 rounded-xl w-fit"
        style={{ backgroundColor: 'var(--bg-elevated)' }}
      >
        {(['orgs', 'managers'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="px-4 py-1.5 rounded-lg text-sm font-medium transition-all"
            style={activeTab === tab
              ? { backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)', boxShadow: '0 1px 3px rgba(0,0,0,0.15)' }
              : { color: 'var(--text-muted)' }
            }
          >
            {tab === 'orgs' ? 'Organizações' : 'Gestores de Tráfego'}
          </button>
        ))}
      </div>

      {/* Toast */}
      {toast && (
        <div
          className="fixed top-5 right-5 z-50 flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium shadow-lg"
          style={
            toast.type === 'success'
              ? { backgroundColor: 'var(--badge-success-bg)', color: 'var(--badge-success-text)', border: '1px solid var(--badge-success-text)' }
              : { backgroundColor: 'var(--badge-error-bg)', color: 'var(--badge-error-text)', border: '1px solid var(--badge-error-text)' }
          }
        >
          {toast.message}
        </div>
      )}

      {activeTab === 'orgs' && <>
      {/* Create Form */}
      {showCreate && (
        <div
          className="mb-6 rounded-xl p-6 shadow-sm"
          style={{ border: '1px solid var(--border)', backgroundColor: 'var(--bg-surface)' }}
        >
          <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Nova Organização</h2>
          <form onSubmit={(e) => { e.preventDefault(); void handleCreate(); }} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Nome</label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) => setCreateForm((p) => ({ ...p, name: e.target.value }))}
                  required
                  placeholder="Nome do cliente"
                  className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-(--accent)"
                  style={inputStyle}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Plano</label>
                <select
                  value={createForm.plan}
                  onChange={(e) => setCreateForm((p) => ({ ...p, plan: e.target.value as Plan }))}
                  className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-(--accent)"
                  style={selectStyle}
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
                className="flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-medium text-white disabled:opacity-60 disabled:cursor-not-allowed transition-opacity hover:opacity-80"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                {isCreating && <Spinner />}
                {isCreating ? 'Criando...' : 'Criar organização'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Table */}
      <div
        className="rounded-xl shadow-sm overflow-hidden"
        style={{ border: '1px solid var(--border)', backgroundColor: 'var(--bg-surface)' }}
      >
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm" style={{ color: 'var(--text-muted)' }}>
            <Spinner /> Carregando...
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 px-6 py-4 text-sm" style={{ color: 'var(--badge-error-text)' }}>
            {error}
            <button onClick={fetchOrgs} className="ml-auto text-xs underline">Tentar novamente</button>
          </div>
        ) : orgs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Nenhuma organização</p>
            <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>Crie a primeira organização acima.</p>
          </div>
        ) : (
          <>
            {/* Mobile */}
            <div className="sm:hidden divide-y" style={{ borderColor: 'var(--border)' }}>
              {orgs.map((org) => (
                <div key={org.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{org.name}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{org.slug}</p>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium" style={PLAN_BADGE_STYLE[org.plan]}>{org.plan}</span>
                        <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium" style={STATUS_BADGE_STYLE[org.status]}>{STATUS_LABEL[org.status]}</span>
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{org._count?.users ?? 0} usuários</span>
                      </div>
                      {org.subscriptionEnds && (
                        <p className="text-xs mt-1">
                          <span style={{ color: 'var(--text-muted)' }}>Expira: </span>
                          <SubscriptionEndsCell value={org.subscriptionEnds} />
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5 shrink-0 items-end">
                      <button onClick={() => void openUsers(org)} className="text-xs" style={{ color: 'var(--accent)' }}>Usuários</button>
                      <button
                        onClick={() => void handleSyncMeta(org)}
                        disabled={syncingMetaId === org.id}
                        className="flex items-center gap-1 text-xs disabled:opacity-50"
                        style={{ color: 'var(--badge-success-text)' }}
                      >
                        {syncingMetaId === org.id ? <Spinner className="h-3 w-3" /> : 'Sync Meta'}
                      </button>
                      <button
                        onClick={() => setBackfillModal({ org, since: '2025-01-01', until: today })}
                        className="text-xs"
                        style={{ color: 'var(--badge-warn-text)' }}
                      >
                        Backfill
                      </button>
                      <button onClick={() => openEdit(org)} className="text-xs" style={{ color: 'var(--accent)' }}>Editar</button>
                      <button
                        onClick={() => void handleDelete(org)}
                        disabled={deletingId === org.id}
                        className="text-xs disabled:opacity-50"
                        style={{ color: 'var(--text-muted)' }}
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
                  <tr style={{ backgroundColor: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Nome</th>
                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Plano</th>
                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Status</th>
                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Usuários</th>
                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Expira em</th>
                    <th className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Criada em</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {orgs.map((org) => (
                    <tr key={org.id} style={{ borderTop: '1px solid var(--border)' }}>
                      <td className="px-5 py-3">
                        <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{org.name}</p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{org.slug}</p>
                      </td>
                      <td className="px-5 py-3">
                        <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium" style={PLAN_BADGE_STYLE[org.plan]}>{org.plan}</span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium" style={STATUS_BADGE_STYLE[org.status]}>{STATUS_LABEL[org.status]}</span>
                      </td>
                      <td className="px-5 py-3" style={{ color: 'var(--text-secondary)' }}>
                        {org._count?.users ?? 0} / {org._count?.integrations ?? 0} int.
                      </td>
                      <td className="px-5 py-3 text-sm">
                        <SubscriptionEndsCell value={org.subscriptionEnds} />
                      </td>
                      <td className="px-5 py-3 text-xs" style={{ color: 'var(--text-muted)' }}>{formatDate(org.createdAt)}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-3">
                          <button onClick={() => void openUsers(org)} className="text-xs" style={{ color: 'var(--accent)' }}>
                            Usuários
                          </button>
                          <button
                            onClick={() => void handleSyncMeta(org)}
                            disabled={syncingMetaId === org.id}
                            className="flex items-center gap-1 text-xs disabled:opacity-50"
                            style={{ color: 'var(--badge-success-text)' }}
                          >
                            {syncingMetaId === org.id && <Spinner className="h-3 w-3" />}
                            Sync Meta
                          </button>
                          <button
                            onClick={() => setBackfillModal({ org, since: '2025-01-01', until: today })}
                            className="text-xs"
                            style={{ color: 'var(--badge-warn-text)' }}
                          >
                            Backfill
                          </button>
                          <button onClick={() => openEdit(org)} className="text-xs" style={{ color: 'var(--accent)' }}>
                            Editar
                          </button>
                          <button
                            onClick={() => void handleDelete(org)}
                            disabled={deletingId === org.id}
                            className="flex items-center gap-1 text-xs disabled:opacity-50"
                            style={{ color: 'var(--text-muted)' }}
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

      {/* Backfill Modal */}
      {backfillModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div
            className="w-full max-w-sm rounded-2xl p-6 shadow-xl"
            style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
          >
            <h2 className="text-base font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Backfill histórico Meta Ads</h2>
            <p className="text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>
              <span className="font-medium">{backfillModal.org.name}</span> — busca dados da API Meta para o período selecionado e substitui registros existentes no banco.
            </p>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>De (since)</label>
                  <input
                    type="date"
                    value={backfillModal.since}
                    onChange={(e) => setBackfillModal((p) => p ? { ...p, since: e.target.value } : p)}
                    className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-(--badge-warn-text)"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Até (until)</label>
                  <input
                    type="date"
                    value={backfillModal.until}
                    onChange={(e) => setBackfillModal((p) => p ? { ...p, until: e.target.value } : p)}
                    className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-(--badge-warn-text)"
                    style={inputStyle}
                  />
                </div>
              </div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>A Meta API suporta dados históricos de até ~37 meses.</p>
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button
                onClick={() => setBackfillModal(null)}
                disabled={isBackfilling}
                className="rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-50 transition-opacity hover:opacity-70"
                style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
              >
                Cancelar
              </button>
              <button
                onClick={() => void handleBackfillMeta()}
                disabled={isBackfilling || !backfillModal.since || !backfillModal.until}
                className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-60 disabled:cursor-not-allowed transition-opacity hover:opacity-80"
                style={{ backgroundColor: 'var(--badge-warn-text)' }}
              >
                {isBackfilling && <Spinner />}
                {isBackfilling ? 'Executando...' : 'Executar backfill'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div
            className="w-full max-w-md rounded-2xl p-6 shadow-xl"
            style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
          >
            <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Editar organização</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Nome</label>
                <input
                  type="text"
                  value={editModal.name}
                  onChange={(e) => setEditModal((p) => p ? { ...p, name: e.target.value } : p)}
                  className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-(--accent)"
                  style={inputStyle}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Plano</label>
                <select
                  value={editModal.plan}
                  onChange={(e) => setEditModal((p) => p ? { ...p, plan: e.target.value as Plan } : p)}
                  className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-(--accent)"
                  style={selectStyle}
                >
                  {Object.values(Plan).map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Status</label>
                <select
                  value={editModal.status}
                  onChange={(e) => setEditModal((p) => p ? { ...p, status: e.target.value as OrgStatus } : p)}
                  className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-(--accent)"
                  style={selectStyle}
                >
                  {Object.values(OrgStatus).map((s) => (
                    <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
                  Assinatura válida até
                  <span className="ml-1 font-normal" style={{ color: 'var(--text-muted)' }}>(deixe em branco para sem vencimento)</span>
                </label>
                <input
                  type="date"
                  value={editModal.subscriptionEnds}
                  onChange={(e) => setEditModal((p) => p ? { ...p, subscriptionEnds: e.target.value } : p)}
                  className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-(--accent)"
                  style={inputStyle}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setEditModal(null)}
                className="rounded-lg px-4 py-2 text-sm transition-opacity hover:opacity-70"
                style={{ color: 'var(--text-secondary)' }}
              >
                Cancelar
              </button>
              <button
                onClick={() => void handleSave()}
                disabled={isSaving}
                className="flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-medium text-white disabled:opacity-60 disabled:cursor-not-allowed transition-opacity hover:opacity-80"
                style={{ backgroundColor: 'var(--accent)' }}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div
            className="w-full max-w-lg rounded-2xl shadow-xl flex flex-col max-h-[85vh]"
            style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
          >
            <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
              <div>
                <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Usuários — {usersModal.org.name}</h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{usersModal.org.slug}</p>
              </div>
              <button onClick={() => setUsersModal(null)} style={{ color: 'var(--text-muted)' }}>
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4">
              {usersModal.isLoading ? (
                <div className="flex items-center justify-center gap-2 py-8 text-sm" style={{ color: 'var(--text-muted)' }}>
                  <Spinner /> Carregando...
                </div>
              ) : usersModal.users.length === 0 ? (
                <p className="text-center text-sm py-8" style={{ color: 'var(--text-muted)' }}>Nenhum usuário nesta organização.</p>
              ) : (
                <div className="space-y-2">
                  {usersModal.users.map((u) => (
                    <div
                      key={u.id}
                      className="flex items-center justify-between rounded-lg px-4 py-2.5"
                      style={{ border: '1px solid var(--border)' }}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{u.name}</p>
                        <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{u.email}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium" style={ROLE_BADGE_STYLE[u.role]}>{u.role}</span>
                        <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium" style={USER_STATUS_BADGE_STYLE[u.status]}>{u.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {usersModal.showCreate && (
                <form
                  onSubmit={(e) => { e.preventDefault(); void handleCreateOrgUser(); }}
                  className="mt-4 rounded-xl p-4 space-y-3"
                  style={{ border: '1px solid var(--border)', backgroundColor: 'var(--bg-elevated)' }}
                >
                  <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Novo usuário</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Nome</label>
                      <input
                        type="text"
                        required
                        value={usersModal.createForm.name}
                        onChange={(e) => setUsersModal((p) => p ? { ...p, createForm: { ...p.createForm, name: e.target.value } } : p)}
                        className="w-full rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-(--accent)"
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Papel</label>
                      <select
                        value={usersModal.createForm.role}
                        onChange={(e) => setUsersModal((p) => p ? { ...p, createForm: { ...p.createForm, role: e.target.value as UserRole } } : p)}
                        className="w-full rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-(--accent)"
                        style={selectStyle}
                      >
                        {[UserRole.ADMIN, UserRole.USER, UserRole.VIEWER].map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Email</label>
                    <input
                      type="email"
                      required
                      value={usersModal.createForm.email}
                      onChange={(e) => setUsersModal((p) => p ? { ...p, createForm: { ...p.createForm, email: e.target.value } } : p)}
                      className="w-full rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-(--accent)"
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Senha (mín. 8 caracteres)</label>
                    <input
                      type="password"
                      required
                      minLength={8}
                      value={usersModal.createForm.password}
                      onChange={(e) => setUsersModal((p) => p ? { ...p, createForm: { ...p.createForm, password: e.target.value } } : p)}
                      className="w-full rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-(--accent)"
                      style={inputStyle}
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setUsersModal((p) => p ? { ...p, showCreate: false } : p)}
                      className="rounded-lg px-3 py-1.5 text-xs transition-opacity hover:opacity-70"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={usersModal.isCreating}
                      className="flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-medium text-white disabled:opacity-60 transition-opacity hover:opacity-80"
                      style={{ backgroundColor: 'var(--accent)' }}
                    >
                      {usersModal.isCreating && <Spinner className="h-3 w-3" />}
                      {usersModal.isCreating ? 'Criando...' : 'Criar usuário'}
                    </button>
                  </div>
                </form>
              )}
            </div>

            <div className="px-6 py-4 flex justify-between items-center" style={{ borderTop: '1px solid var(--border)' }}>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{usersModal.users.length} usuário(s)</span>
              {!usersModal.showCreate && (
                <button
                  onClick={() => setUsersModal((p) => p ? { ...p, showCreate: true } : p)}
                  className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-medium text-white transition-opacity hover:opacity-80"
                  style={{ backgroundColor: 'var(--accent)' }}
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
          {showCreateManager && (
            <div
              className="mb-6 rounded-xl p-6 shadow-sm"
              style={{ border: '1px solid rgba(139,92,246,0.2)', backgroundColor: 'var(--bg-surface)' }}
            >
              <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Novo Gestor de Tráfego</h2>
              <form onSubmit={(e) => { e.preventDefault(); void handleCreateManager(); }} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Nome</label>
                    <input
                      type="text"
                      required
                      value={managerForm.name}
                      onChange={(e) => setManagerForm((p) => ({ ...p, name: e.target.value }))}
                      placeholder="Nome do gestor"
                      className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Email</label>
                    <input
                      type="email"
                      required
                      value={managerForm.email}
                      onChange={(e) => setManagerForm((p) => ({ ...p, email: e.target.value }))}
                      placeholder="email@gestor.com"
                      className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
                      style={inputStyle}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Senha (mín. 8 caracteres)</label>
                    <input
                      type="password"
                      required
                      minLength={8}
                      value={managerForm.password}
                      onChange={(e) => setManagerForm((p) => ({ ...p, password: e.target.value }))}
                      placeholder="••••••••"
                      className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
                      style={inputStyle}
                    />
                  </div>
                </div>
                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={isCreatingManager}
                    className="flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-medium text-white disabled:opacity-60 disabled:cursor-not-allowed transition-opacity hover:opacity-80"
                    style={{ backgroundColor: 'rgba(139,92,246,0.9)' }}
                  >
                    {isCreatingManager && <Spinner />}
                    {isCreatingManager ? 'Criando...' : 'Criar gestor'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {managersLoading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm" style={{ color: 'var(--text-muted)' }}>
              <Spinner /> Carregando gestores...
            </div>
          ) : managers.length === 0 ? (
            <div
              className="rounded-xl shadow-sm flex flex-col items-center justify-center py-14 text-center"
              style={{ border: '1px solid var(--border)', backgroundColor: 'var(--bg-surface)' }}
            >
              <div className="h-10 w-10 rounded-full flex items-center justify-center mb-3" style={{ backgroundColor: 'rgba(139,92,246,0.1)' }}>
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} style={{ color: '#8b5cf6' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                </svg>
              </div>
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Nenhum gestor cadastrado</p>
              <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>Crie o primeiro gestor de tráfego acima.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {managers.map((manager) => {
                const linkedOrgIds = new Set(manager.managedOrgs.map((mo) => mo.organization.id));
                const availableOrgs = orgs.filter((o) => !linkedOrgIds.has(o.id));
                const isOpen = clientsModal?.manager.id === manager.id;

                return (
                  <div
                    key={manager.id}
                    className="rounded-xl shadow-sm overflow-hidden"
                    style={{ border: '1px solid var(--border)', backgroundColor: 'var(--bg-surface)' }}
                  >
                    <div className="flex items-center justify-between px-5 py-4 gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="h-8 w-8 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold"
                          style={{ backgroundColor: 'rgba(139,92,246,0.12)', color: '#8b5cf6' }}
                        >
                          {manager.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{manager.name}</p>
                          <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{manager.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="hidden sm:inline text-xs" style={{ color: 'var(--text-muted)' }}>
                          {manager.managedOrgs.length} cliente(s)
                        </span>
                        <button
                          onClick={() => setClientsModal(isOpen ? null : { manager })}
                          className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
                          style={isOpen
                            ? { border: '1px solid #8b5cf6', color: '#8b5cf6', backgroundColor: 'rgba(139,92,246,0.06)' }
                            : { border: '1px solid var(--border)', color: 'var(--text-secondary)' }
                          }
                        >
                          {isOpen ? 'Fechar' : 'Gerenciar clientes'}
                        </button>
                        <button
                          onClick={() => void handleDeleteManager(manager.id, manager.name)}
                          disabled={deletingManagerId === manager.id}
                          className="flex items-center gap-1 text-xs disabled:opacity-50 transition-opacity hover:opacity-70"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          {deletingManagerId === manager.id ? <Spinner className="h-3 w-3" /> : 'Remover'}
                        </button>
                      </div>
                    </div>

                    {isOpen && (
                      <div
                        className="px-5 py-4"
                        style={{ borderTop: '1px solid var(--border)', backgroundColor: 'var(--bg-elevated)' }}
                      >
                        <p className="text-xs font-semibold mb-3 uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Clientes vinculados</p>

                        {manager.managedOrgs.length === 0 ? (
                          <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>Nenhum cliente vinculado ainda.</p>
                        ) : (
                          <div className="flex flex-wrap gap-2 mb-4">
                            {manager.managedOrgs.map((mo) => (
                              <span
                                key={mo.organization.id}
                                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium"
                                style={{ border: '1px solid var(--border)', backgroundColor: 'var(--bg-surface)', color: 'var(--text-secondary)' }}
                              >
                                {mo.organization.name}
                                <button
                                  onClick={() => void handleRemoveClient(manager.id, mo.organization.id)}
                                  disabled={linkingOrgId === mo.organization.id}
                                  className="disabled:opacity-50 transition-opacity hover:opacity-70"
                                  style={{ color: 'var(--text-muted)' }}
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
                            <span className="text-xs shrink-0" style={{ color: 'var(--text-secondary)' }}>Adicionar cliente:</span>
                            <div className="flex flex-wrap gap-2">
                              {availableOrgs.map((org) => (
                                <button
                                  key={org.id}
                                  onClick={() => void handleAddClient(manager.id, org.id)}
                                  disabled={linkingOrgId === org.id}
                                  className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs disabled:opacity-50 transition-opacity hover:opacity-70"
                                  style={{ border: '1px dashed var(--border-md)', color: 'var(--text-secondary)' }}
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
