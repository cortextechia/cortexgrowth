'use client';

import { useState, useCallback, useEffect } from 'react';
import { useUsers } from '@/hooks/useApi';
import { useAuth } from '@/context/AuthContext';
import { PermissionGuard } from '@/components/ProtectedRoute';
import { User, UserRole } from '@/types';
import { apiService } from '@/lib/api';
import { userLimitOf, fmtUserLimit, MAX_ADMINS_POR_ORG } from '@/lib/planLimits';

function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

const ROLE_BADGE_STYLE: Record<string, { backgroundColor: string; color: string }> = {
  SUPER_ADMIN: { backgroundColor: 'rgba(168,85,247,0.12)', color: '#a855f7' },
  ADMIN:       { backgroundColor: 'rgba(168,85,247,0.12)', color: '#a855f7' },
  USER:        { backgroundColor: 'var(--accent-dim)',      color: 'var(--accent)' },
  VIEWER:      { backgroundColor: 'var(--bg-elevated)',     color: 'var(--text-muted)' },
};

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN:       'Admin',
  USER:        'Usuário',
  VIEWER:      'Viewer',
};

const STATUS_BADGE_STYLE: Record<string, { backgroundColor: string; color: string }> = {
  ACTIVE:    { backgroundColor: 'var(--badge-success-bg)', color: 'var(--badge-success-text)' },
  SUSPENDED: { backgroundColor: 'var(--badge-error-bg)',   color: 'var(--badge-error-text)' },
  INACTIVE:  { backgroundColor: 'var(--bg-elevated)',      color: 'var(--text-muted)' },
};

const STATUS_LABEL: Record<string, string> = {
  ACTIVE:    'Ativo',
  SUSPENDED: 'Suspenso',
  INACTIVE:  'Inativo',
};

export default function UsersPage() {
  const { user: currentUser, organization } = useAuth();
  const { users, isLoading, error, fetchUsers, createUser, updateUser, deleteUser } = useUsers();
  const userLimit = userLimitOf(organization?.plan);
  const atLimit = userLimit !== Infinity && users.length >= userLimit;
  // O backend recusa o 3º admin; sem isto a opção ficaria no formulário só para dar erro.
  const adminsNoLimite = users.filter((u) => u.role === UserRole.ADMIN).length >= MAX_ADMINS_POR_ORG;
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [savingRoleId, setSavingRoleId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [formData, setFormData] = useState({ name: '', email: '', password: '', role: 'USER' });

  const isAdmin = currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.SUPER_ADMIN;
  const [connectedManagers, setConnectedManagers] = useState<{ id: string; name: string; email: string; status: string; connectedAt: string }[]>([]);
  const [connectCode, setConnectCode] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);

  const fetchManagers = useCallback(async () => {
    try {
      const res = await apiService.getConnectedManagers();
      setConnectedManagers(res.data);
    } catch { /* sem gestores ou sem permissão — ignora */ }
  }, []);

  useEffect(() => {
    fetchUsers();
    if (isAdmin) fetchManagers();
  }, [isAdmin]);

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = connectCode.trim().toUpperCase();
    if (code.length !== 8) return;
    setIsConnecting(true);
    try {
      const res = await apiService.connectManager(code);
      showToast(res.message);
      setConnectCode('');
      void fetchManagers();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Código inválido ou expirado.', 'error');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async (managerId: string, name: string) => {
    if (!confirm(`Desconectar gestor "${name}"?`)) return;
    setDisconnectingId(managerId);
    try {
      await apiService.disconnectManager(managerId);
      showToast('Gestor desconectado.');
      void fetchManagers();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao desconectar.', 'error');
    } finally {
      setDisconnectingId(null);
    }
  };

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

  const handleRoleChange = async (userId: string, role: string) => {
    setSavingRoleId(userId);
    try {
      await updateUser(userId, { role });
      showToast('Papel atualizado.');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao alterar papel', 'error');
      void fetchUsers(); // o select ja mudou na tela; recarrega para nao mentir
    } finally {
      setSavingRoleId(null);
    }
  };

  // Espelha as regras do backend. Fora delas o papel continua sendo so um selo.
  //  - ninguem muda o proprio papel (a API recusa)
  //  - SUPER_ADMIN nao se edita por aqui
  //  - "Admin" fecha quando a org ja tem 2 e o alvo nao e um deles
  const renderPapel = (user: User) => {
    const editavel = isAdmin && user.id !== currentUser?.id && user.role !== UserRole.SUPER_ADMIN;
    if (!editavel) {
      return (
        <span
          className="inline-flex px-2 py-0.5 rounded text-xs font-medium"
          style={ROLE_BADGE_STYLE[user.role] ?? { backgroundColor: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
        >
          {ROLE_LABEL[user.role] ?? user.role}
        </span>
      );
    }
    const semVagaDeAdmin = adminsNoLimite && user.role !== UserRole.ADMIN;
    return (
      <span className="inline-flex items-center gap-1.5">
        <select
          value={user.role}
          disabled={savingRoleId === user.id}
          onChange={(e) => handleRoleChange(user.id, e.target.value)}
          className="rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 disabled:opacity-50"
          style={inputStyle}
        >
          <option value="USER">Usuário</option>
          <option value="ADMIN" disabled={semVagaDeAdmin}>
            {semVagaDeAdmin ? `Admin — limite de ${MAX_ADMINS_POR_ORG}` : 'Admin'}
          </option>
          <option value="VIEWER">Viewer</option>
        </select>
        {savingRoleId === user.id && <Spinner className="h-3 w-3" />}
      </span>
    );
  };

  const inputStyle = {
    backgroundColor: 'var(--input-bg)',
    border: '1px solid var(--input-border)',
    color: 'var(--text-primary)',
  };

  return (
    <div className="w-full max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 sm:mb-8 gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-semibold" style={{ color: 'var(--text-primary)' }}>Usuários</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Gerencie os membros da equipe.
            {userLimit !== Infinity && (
              <span className="ml-2 font-medium" style={{ color: atLimit ? 'var(--badge-error-text)' : 'var(--text-muted)' }}>
                {users.length}/{fmtUserLimit(userLimit)} usuários
              </span>
            )}
          </p>
        </div>
        <PermissionGuard requiredRoles={['ADMIN', 'SUPER_ADMIN']}>
          <button
            onClick={() => !atLimit && setShowForm(!showForm)}
            disabled={atLimit && !showForm}
            title={atLimit ? `Limite de ${fmtUserLimit(userLimit)} usuário(s) atingido. Faça upgrade do plano.` : undefined}
            className="shrink-0 flex items-center gap-2 rounded-lg px-3 sm:px-4 py-2 text-sm font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: 'var(--accent)' }}
          >
            {showForm ? 'Cancelar' : '+ Novo Usuário'}
          </button>
        </PermissionGuard>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className="fixed top-5 right-5 z-50 flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium shadow-lg text-white"
          style={{ backgroundColor: toast.type === 'success' ? 'var(--bg-elevated)' : '#dc2626', border: '1px solid var(--border-md)' }}
        >
          {toast.message}
        </div>
      )}

      {/* Limit banner */}
      {atLimit && userLimit !== Infinity && (
        <div
          className="mb-4 flex items-center gap-3 rounded-xl px-4 py-3 text-sm"
          style={{ border: '1px solid var(--badge-warn-bg)', backgroundColor: 'var(--badge-warn-bg)', color: 'var(--badge-warn-text)' }}
        >
          <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          Limite de <strong className="mx-1">{fmtUserLimit(userLimit)} usuário(s)</strong> atingido no plano {organization?.plan}. Entre em contato para fazer upgrade.
        </div>
      )}

      {/* Create Form */}
      {showForm && (
        <div
          className="mb-6 rounded-xl p-6"
          style={{ border: '1px solid var(--border)', backgroundColor: 'var(--bg-surface)' }}
        >
          <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Novo Usuário</h2>
          <form onSubmit={(e) => { e.preventDefault(); void handleSubmit(); }} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Nome</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  placeholder="Nome completo"
                  className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
                  style={{ ...inputStyle, '--tw-ring-color': 'var(--accent)' } as React.CSSProperties}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Email</label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  placeholder="usuario@empresa.com"
                  className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
                  style={inputStyle}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Senha temporária</label>
                <input
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  placeholder="Mínimo 8 caracteres"
                  className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
                  style={inputStyle}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Função</label>
                <select
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
                  style={inputStyle}
                >
                  <option value="USER">Usuário — acesso ao dashboard</option>
                  <option value="ADMIN" disabled={adminsNoLimite}>
                    {adminsNoLimite
                      ? `Admin — limite de ${MAX_ADMINS_POR_ORG} atingido`
                      : 'Admin — gerencia usuários e integrações'}
                  </option>
                  <option value="VIEWER">Viewer — somente leitura</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-medium text-white disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                style={{ backgroundColor: 'var(--accent)' }}
              >
                {isSubmitting && <Spinner />}
                {isSubmitting ? 'Criando...' : 'Criar usuário'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Users Table */}
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)', backgroundColor: 'var(--bg-surface)' }}>
        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm" style={{ color: 'var(--text-muted)' }}>
            <Spinner /> Carregando...
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 px-6 py-4 text-sm" style={{ color: 'var(--badge-error-text)' }}>
            <span>{error}</span>
            <button onClick={fetchUsers} className="ml-auto text-xs underline">Tentar novamente</button>
          </div>
        ) : users.length > 0 ? (
          <>
            {/* Mobile card list */}
            <div className="sm:hidden" style={{ borderColor: 'var(--border)' }}>
              {users.map((user) => (
                <div key={user.id} className="px-4 py-3 flex items-center justify-between gap-3" style={{ borderBottom: '1px solid var(--border)' }}>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{user.name}</p>
                    <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>{user.email}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      {renderPapel(user)}
                      <span
                        className="inline-flex px-2 py-0.5 rounded text-xs font-medium"
                        style={STATUS_BADGE_STYLE[user.status] ?? { backgroundColor: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
                      >
                        {STATUS_LABEL[user.status] ?? user.status}
                      </span>
                    </div>
                  </div>
                  <PermissionGuard requiredRoles={['ADMIN', 'SUPER_ADMIN']}>
                    <button
                      onClick={() => handleDelete(user.id, user.name)}
                      disabled={deletingId === user.id}
                      className="shrink-0 flex items-center gap-1 text-xs disabled:opacity-50 transition-colors"
                      style={{ color: 'var(--text-muted)' }}
                      onMouseEnter={e => (e.currentTarget.style.color = 'var(--badge-error-text)')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
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
                  <tr style={{ backgroundColor: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Nome</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Função</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Status</th>
                    <th className="px-6 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr
                      key={user.id}
                      style={{ borderTop: '1px solid var(--border)' }}
                      onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--bg-elevated)')}
                      onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <td className="px-6 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>{user.name}</td>
                      <td className="px-6 py-3" style={{ color: 'var(--text-secondary)' }}>{user.email}</td>
                      <td className="px-6 py-3">
                        {renderPapel(user)}
                      </td>
                      <td className="px-6 py-3">
                        <span
                          className="inline-flex px-2 py-0.5 rounded text-xs font-medium"
                          style={STATUS_BADGE_STYLE[user.status] ?? { backgroundColor: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
                        >
                          {STATUS_LABEL[user.status] ?? user.status}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-right">
                        <PermissionGuard requiredRoles={['ADMIN', 'SUPER_ADMIN']}>
                          <button
                            onClick={() => handleDelete(user.id, user.name)}
                            disabled={deletingId === user.id}
                            className="flex items-center gap-1.5 ml-auto text-xs disabled:opacity-50 transition-colors"
                            style={{ color: 'var(--text-muted)' }}
                            onMouseEnter={e => (e.currentTarget.style.color = 'var(--badge-error-text)')}
                            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
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
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Nenhum usuário</p>
            <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>Crie o primeiro usuário acima.</p>
          </div>
        )}
      </div>

      {/* ─── Gestores de Tráfego Conectados (ADMIN/SUPER_ADMIN) ─── */}
      {isAdmin && (
        <div className="mt-8">
          <div className="mb-4">
            <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Gestores de Tráfego</h2>
            <p className="mt-0.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
              Conecte um gestor externo usando o código gerado por ele.
            </p>
          </div>

          {/* Connect form */}
          <form onSubmit={handleConnect} className="mb-4 flex items-center gap-3">
            <input
              type="text"
              value={connectCode}
              onChange={(e) => setConnectCode(e.target.value.toUpperCase())}
              maxLength={8}
              placeholder="CÓDIGO DO GESTOR"
              className="w-52 rounded-lg px-3 py-2 text-sm font-mono tracking-widest uppercase focus:outline-none focus:ring-2"
              style={inputStyle}
            />
            <button
              type="submit"
              disabled={isConnecting || connectCode.length !== 8}
              className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              {isConnecting && <Spinner className="h-3.5 w-3.5" />}
              {isConnecting ? 'Conectando...' : 'Conectar gestor'}
            </button>
          </form>

          {/* Connected managers list */}
          {connectedManagers.length === 0 ? (
            <p className="text-sm py-2" style={{ color: 'var(--text-muted)' }}>Nenhum gestor conectado ainda.</p>
          ) : (
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)', backgroundColor: 'var(--bg-surface)' }}>
              {connectedManagers.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between px-5 py-3"
                  style={{ borderBottom: '1px solid var(--border)' }}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{m.name}</p>
                    <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{m.email}</p>
                  </div>
                  <div className="flex items-center gap-4 shrink-0">
                    <span
                      className="hidden sm:inline-flex px-2 py-0.5 rounded text-xs font-medium"
                      style={{ backgroundColor: 'rgba(168,85,247,0.12)', color: '#a855f7' }}
                    >
                      Gestor
                    </span>
                    <button
                      onClick={() => void handleDisconnect(m.id, m.name)}
                      disabled={disconnectingId === m.id}
                      className="flex items-center gap-1 text-xs disabled:opacity-50 transition-colors"
                      style={{ color: 'var(--text-muted)' }}
                      onMouseEnter={e => (e.currentTarget.style.color = 'var(--badge-error-text)')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                    >
                      {disconnectingId === m.id ? <Spinner className="h-3 w-3" /> : 'Desconectar'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
