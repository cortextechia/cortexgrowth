'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { ProtectedRoute, PermissionGuard } from '@/components/ProtectedRoute';
import { ThemeToggle } from '@/components/ThemeToggle';
import { apiService } from '@/lib/api';
import { TrafficManagerClient, UserRole } from '@/types';

const NAV_ITEMS = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: (
      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
    roles: null,
  },
  {
    href: '/dashboard/integrations',
    label: 'Integrações',
    icon: (
      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
      </svg>
    ),
    roles: null,
  },
  {
    href: '/dashboard/users',
    label: 'Usuários',
    icon: (
      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    ),
    roles: ['ADMIN', 'SUPER_ADMIN'] as string[],
  },
  {
    href: '/dashboard/gestor',
    label: 'Meus Clientes',
    icon: (
      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
      </svg>
    ),
    roles: ['TRAFFIC_MANAGER'] as string[],
  },
  {
    href: '/dashboard/historico',
    label: 'Evolução',
    icon: (
      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
      </svg>
    ),
    roles: null,
  },
  {
    href: '/dashboard/reports',
    label: 'Relatórios',
    icon: (
      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
    roles: null,
  },
  {
    href: '/dashboard/relatorios',
    label: 'Relatórios Auto.',
    icon: (
      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
      </svg>
    ),
    roles: null,
  },
  {
    href: '/dashboard/seo',
    label: 'SEO / AIO',
    icon: (
      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0H3" />
      </svg>
    ),
    roles: null,
  },
  {
    href: '/dashboard/organizations',
    label: 'Organizações',
    icon: (
      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
      </svg>
    ),
    roles: ['SUPER_ADMIN'] as string[],
  },
  {
    href: '/onboarding',
    label: 'Configuração Inicial',
    icon: (
      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 011.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.56.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.893.149c-.425.07-.765.383-.93.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 01-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.397.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 01-.12-1.45l.527-.737c.25-.35.273-.806.108-1.204-.165-.397-.505-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.107-1.204l-.527-.738a1.125 1.125 0 01.12-1.45l.773-.773a1.125 1.125 0 011.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    roles: ['ADMIN', 'SUPER_ADMIN'] as string[],
  },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, organization, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Estado para TRAFFIC_MANAGER: lista de clientes e org selecionada
  const isTrafficManager = user?.role === UserRole.TRAFFIC_MANAGER;
  const [clientOrgs, setClientOrgs] = useState<TrafficManagerClient[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');

  useEffect(() => {
    if (!isTrafficManager) return;
    apiService.getMyClients().then((res) => {
      if (res.success && res.data.length > 0) {
        setClientOrgs(res.data);
        const saved = apiService.getSelectedClientOrgId();
        const valid = res.data.find((o) => o.id === saved);
        const initial = valid ? valid.id : res.data[0].id;
        setSelectedOrgId(initial);
        apiService.setSelectedClientOrgId(initial);
      }
    }).catch(() => {});
  }, [isTrafficManager]);

  const handleClientChange = (orgId: string) => {
    setSelectedOrgId(orgId);
    apiService.setSelectedClientOrgId(orgId);
    // Navegação completa para forçar remount de todos os hooks de dados
    window.location.href = window.location.pathname;
  };

  const handleLogout = () => {
    logout();
    router.push('/auth/login');
  };

  const renderNavLinks = (expanded: boolean) =>
    NAV_ITEMS.map((item) => {
      const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
      const link = (
        <Link
          key={item.href}
          href={item.href}
          onClick={() => setMobileMenuOpen(false)}
          className={`flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition-colors ${!expanded ? 'justify-center' : ''}`}
          style={
            isActive
              ? { backgroundColor: 'var(--accent-dim)', color: 'var(--accent)', borderLeft: '2px solid var(--accent)', paddingLeft: '8px' }
              : { color: 'var(--text-muted)' }
          }
          onMouseEnter={e => { if (!isActive) { e.currentTarget.style.backgroundColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; } }}
          onMouseLeave={e => { if (!isActive) { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; } }}
          title={!expanded ? item.label : undefined}
        >
          {item.icon}
          {expanded && <span>{item.label}</span>}
        </Link>
      );

      return item.roles ? (
        <PermissionGuard key={item.href} requiredRoles={item.roles}>
          {link}
        </PermissionGuard>
      ) : link;
    });

  const mainClass = sidebarOpen
    ? 'flex-1 transition-all duration-200 min-h-screen md:ml-56'
    : 'flex-1 transition-all duration-200 min-h-screen md:ml-16';

  return (
    <ProtectedRoute>
      <div className="min-h-screen flex">
        {/* Mobile backdrop */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/60 md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Mobile sidebar drawer */}
        <aside
          className={`fixed inset-y-0 left-0 z-50 w-64 flex flex-col md:hidden transition-transform duration-200 ${
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
          style={{ backgroundColor: 'var(--bg-sidebar)', borderRight: '1px solid var(--border)' }}
        >
          <div
            className="flex items-center justify-between px-4 h-14 shrink-0"
            style={{ borderBottom: '1px solid var(--border)' }}
          >
            <div className="flex items-center gap-2">
              <div className="h-6 w-6 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--accent)' }}>
                <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                </svg>
              </div>
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Córtex Growth</span>
            </div>
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="p-1.5 rounded-md transition-colors"
              style={{ color: 'var(--text-muted)' }}
              aria-label="Fechar menu"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <nav className="flex-1 py-4 space-y-0.5 px-2 overflow-y-auto">
            {renderNavLinks(true)}
          </nav>
          <div className="p-2 shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 w-full rounded-lg px-2.5 py-2 text-sm transition-colors"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
            >
              <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
              </svg>
              <span>Sair</span>
            </button>
          </div>
        </aside>

        {/* Desktop sidebar */}
        <aside
          className={`${sidebarOpen ? 'w-56' : 'w-16'} fixed h-screen flex flex-col transition-all duration-200 z-20 max-md:hidden`}
          style={{ backgroundColor: 'var(--bg-sidebar)', borderRight: '1px solid var(--border)' }}
        >
          <div
            className={`flex items-center h-14 shrink-0 ${sidebarOpen ? 'justify-between px-4' : 'justify-center'}`}
            style={{ borderBottom: '1px solid var(--border)' }}
          >
            {sidebarOpen && (
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--accent)' }}>
                  <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                  </svg>
                </div>
                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Córtex Growth</span>
              </div>
            )}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1.5 rounded-md transition-colors"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)')}
              onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
              aria-label="Toggle sidebar"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
              </svg>
            </button>
          </div>
          <nav className="flex-1 py-4 space-y-0.5 px-2 overflow-y-auto">
            {renderNavLinks(sidebarOpen)}
          </nav>
          <div className="p-2 shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
            <button
              onClick={handleLogout}
              className={`flex items-center gap-3 w-full rounded-lg px-2.5 py-2 text-sm transition-colors ${!sidebarOpen ? 'justify-center' : ''}`}
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
              onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; }}
              title={!sidebarOpen ? 'Sair' : undefined}
            >
              <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
              </svg>
              {sidebarOpen && <span>Sair</span>}
            </button>
          </div>
        </aside>

        {/* Main content */}
        <main className={mainClass}>
          {/* Topbar */}
          <div
            className="sticky top-0 z-10"
            style={{ backgroundColor: 'color-mix(in srgb, var(--bg-sidebar) 85%, transparent)', borderBottom: '1px solid var(--border)', backdropFilter: 'blur(12px)' }}
          >
            <div className="px-4 sm:px-6 h-14 flex items-center gap-3">
              {/* Mobile hamburger */}
              <button
                className="md:hidden p-1.5 rounded-md shrink-0"
                style={{ color: 'var(--text-muted)' }}
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Abrir menu"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5M3.75 17.25h16.5" />
                </svg>
              </button>

              {/* TRAFFIC_MANAGER: seletor de cliente — ocupa o espaço central */}
              {isTrafficManager ? (
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} style={{ color: '#60a5fa' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
                  </svg>
                  <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>Cliente:</span>
                  {clientOrgs.length === 0 ? (
                    <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Carregando...</span>
                  ) : (
                    <select
                      value={selectedOrgId}
                      onChange={(e) => handleClientChange(e.target.value)}
                      className="text-sm rounded-md px-2 py-1 border-0 outline-none cursor-pointer min-w-0 flex-1 max-w-[200px]"
                      style={{ backgroundColor: 'rgba(59,130,246,0.1)', color: '#60a5fa' }}
                    >
                      {clientOrgs.map((org) => (
                        <option key={org.id} value={org.id} style={{ backgroundColor: '#0f172a', color: '#f1f5f9' }}>
                          {org.isSelf ? `${org.name} (Eu)` : org.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              ) : (
                <span className="text-sm font-medium flex-1 truncate" style={{ color: 'var(--text-primary)' }}>
                  {organization?.name ?? 'Dashboard'}
                </span>
              )}

              <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                <span
                  className="hidden sm:inline text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{ backgroundColor: isTrafficManager ? 'rgba(168,85,247,0.12)' : 'var(--accent-dim)', color: isTrafficManager ? '#c084fc' : 'var(--accent)' }}
                >
                  {user?.role ?? 'USER'}
                </span>
                <span className="text-sm max-w-[120px] truncate" style={{ color: 'var(--text-secondary)' }}>{user?.name}</span>
                <ThemeToggle />
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-6">{children}</div>
        </main>
      </div>
    </ProtectedRoute>
  );
}