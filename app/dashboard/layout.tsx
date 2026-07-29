'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { ProtectedRoute, PermissionGuard } from '@/components/ProtectedRoute';
import { ThemeToggle } from '@/components/ThemeToggle';
import { apiService } from '@/lib/api';
import { TrafficManagerClient, UserRole } from '@/types';

// Classificação visual de cada cliente no seletor do gestor
function clientDot(c: TrafficManagerClient): { color: string; label: string } {
  if (c.isSelf) return { color: '#a855f7', label: 'Sua conta' };
  if (c.claimed) return { color: '#22c55e', label: 'Cliente ativo (acesso próprio)' };
  if (c.source === 'MANAGER') return { color: '#3b82f6', label: 'Dashboard criado por você' };
  return { color: '#64748b', label: 'Cliente conectado' };
}

function platformBadges(c: TrafficManagerClient): { label: string; color: string; bg: string }[] {
  const b: { label: string; color: string; bg: string }[] = [];
  if (c.hasGoogle) b.push({ label: 'G', color: '#16a34a', bg: 'rgba(34,197,94,0.14)' });
  if (c.hasMeta) b.push({ label: 'M', color: '#2563eb', bg: 'rgba(59,130,246,0.14)' });
  if (c.hasKommo) b.push({ label: 'CRM', color: '#d97706', bg: 'rgba(245,158,11,0.14)' });
  return b;
}

function ClientSelector({ clients, selectedOrgId, onChange }: { clients: TrafficManagerClient[]; selectedOrgId: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selected = clients.find((c) => c.id === selectedOrgId) ?? clients[0];
  if (!selected) return null;
  const selDot = clientDot(selected);

  return (
    <div ref={ref} className="relative flex-1 min-w-0 max-w-[280px]">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 w-full rounded-md px-2.5 py-1.5 text-sm"
        style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-md)' }}
      >
        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: selDot.color }} />
        <span className="truncate font-medium" style={{ color: 'var(--text-primary)' }}>
          {selected.isSelf ? `${selected.name} (Eu)` : selected.name}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {platformBadges(selected).map((b) => (
            <span key={b.label} className="text-[10px] font-bold px-1 rounded" style={{ color: b.color, backgroundColor: b.bg }}>{b.label}</span>
          ))}
        </div>
        <svg className="w-4 h-4 shrink-0 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} style={{ color: 'var(--text-muted)' }}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-[300px] max-h-[60vh] overflow-y-auto rounded-lg py-1 shadow-lg" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-md)' }}>
          {clients.map((c) => {
            const dot = clientDot(c);
            const active = c.id === selectedOrgId;
            return (
              <button
                key={c.id}
                onClick={() => { setOpen(false); if (c.id !== selectedOrgId) onChange(c.id); }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-left"
                style={{ backgroundColor: active ? 'var(--accent-dim)' : 'transparent' }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.backgroundColor = 'var(--bg-elevated)'; }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: dot.color }} />
                <div className="min-w-0 flex-1">
                  <span className="block truncate" style={{ color: 'var(--text-primary)' }}>{c.isSelf ? `${c.name} (Eu)` : c.name}</span>
                  {dot.label && <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{dot.label}</span>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {platformBadges(c).map((b) => (
                    <span key={b.label} className="text-[10px] font-bold px-1 rounded" style={{ color: b.color, backgroundColor: b.bg }}>{b.label}</span>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

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
    label: 'Gestão',
    icon: (
      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
      </svg>
    ),
    roles: ['TRAFFIC_MANAGER'] as string[],
  },
  {
    // Só aparece quando a org NÃO usa Kommo (visibilidade controlada no layout via /crm/status)
    // exact: sem isso, ficaria ativo junto com o subitem /dashboard/crm/contatos.
    // children: submenu recolhível (a lista de contatos aninha aqui, estilo dropdown).
    href: '/dashboard/crm',
    label: 'CRM',
    exact: true,
    icon: (
      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
      </svg>
    ),
    roles: null,
    children: [
      { href: '/dashboard/crm/contatos', label: 'Contatos' },
      { href: '/dashboard/crm/disparos', label: 'Disparos', adminOnly: true },
    ],
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
    href: '/dashboard/criativo',
    label: 'Criativos',
    icon: (
      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
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
    href: '/dashboard/assinatura',
    label: 'Assinatura',
    icon: (
      <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
      </svg>
    ),
    roles: ['ADMIN', 'SUPER_ADMIN', 'TRAFFIC_MANAGER'] as string[],
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

// Faixa de confirmação de e-mail. Sem ela, quem não recebeu o e-mail (spam, endereço
// digitado errado) não tem como pedir outro nem sabe que está pendente — a verificação
// vira um recurso invisível. Não bloqueia o uso do produto: só avisa e oferece o reenvio.
function AvisoEmailNaoConfirmado() {
  const { user } = useAuth();
  const [estado, setEstado] = useState<'idle' | 'enviando' | 'enviado' | 'erro'>('idle');
  const [mensagem, setMensagem] = useState('');

  if (user?.emailVerified !== false) return null;

  const reenviar = async () => {
    setEstado('enviando');
    try {
      const r = await apiService.resendVerification();
      setEstado('enviado');
      setMensagem(r.message);
    } catch (e: any) {
      setEstado('erro');
      setMensagem(e?.response?.data?.message ?? 'Não foi possível reenviar agora.');
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 sm:px-6"
      style={{ backgroundColor: 'var(--badge-warn-bg)', borderBottom: '1px solid var(--border)' }}>
      <span className="text-sm" style={{ color: 'var(--badge-warn-text)' }}>
        {estado === 'enviado'
          ? mensagem
          : <>Confirme seu e-mail <strong>{user.email}</strong> para garantir o acesso à conta.</>}
      </span>

      {estado !== 'enviado' && (
        <button onClick={() => void reenviar()} disabled={estado === 'enviando'}
          className="text-sm font-semibold underline underline-offset-2 disabled:opacity-60"
          style={{ color: 'var(--badge-warn-text)' }}>
          {estado === 'enviando' ? 'Enviando…' : 'Reenviar e-mail'}
        </button>
      )}

      {estado === 'erro' && (
        <span className="text-xs" style={{ color: 'var(--badge-error-text)' }}>{mensagem}</span>
      )}
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, organization, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Estado para TRAFFIC_MANAGER: lista de clientes e org selecionada
  const isTrafficManager = user?.role === UserRole.TRAFFIC_MANAGER;
  // Subitens só-admin do menu (ex: Disparos)
  const canBroadcast = !!user && [UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.TRAFFIC_MANAGER].includes(user.role);
  const [clientOrgs, setClientOrgs] = useState<TrafficManagerClient[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>('');

  // CRM Cortex no menu: só para orgs SEM Kommo conectado (ativado ou disponível pra ativar)
  const [crmVisible, setCrmVisible] = useState(false);
  useEffect(() => {
    apiService.getCrmStatus().then((res) => {
      if (res.success) setCrmVisible(res.data.enabled || !res.data.kommoConnected);
    }).catch(() => {});
  }, []);

  // Submenu do CRM (dropdown p/ Contatos): por padrão segue a rota (aberto quando
  // se está na seção CRM); ao clicar na seta, a escolha do usuário passa a valer.
  const [crmMenuToggled, setCrmMenuToggled] = useState<boolean | null>(null);
  const crmMenuOpen = crmMenuToggled ?? pathname.startsWith('/dashboard/crm');

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

  // A "Configuração Inicial" é tarefa de uma vez só: depois de concluída, um item
  // fixo no menu para "primeiros passos" vira ruído — e sugere que ainda falta algo.
  // Nada se perde ao escondê-la: site/concorrentes ficam em SEO, integrações em
  // Integrações e o nome da empresa em Organizações.
  const onboardingConcluido = Boolean(organization?.onboardingCompletedAt);

  const renderNavLinks = (expanded: boolean) =>
    NAV_ITEMS
      .filter((item) => !item.href.startsWith('/dashboard/crm') || crmVisible)
      .filter((item) => item.href !== '/onboarding' || !onboardingConcluido)
      .map((item) => {
      const exact = 'exact' in item && item.exact;
      const isActive = exact
        ? pathname === item.href
        : (pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href)));
      const childItems = (('children' in item ? item.children : undefined) as { href: string; label: string; adminOnly?: boolean }[] | undefined)
        ?.filter((c) => !c.adminOnly || canBroadcast);

      // Item com submenu (CRM) e sidebar expandida → linha com seta + filhos indentados.
      // Recolhida (só ícone): cai no render padrão (submenu não faz sentido sem rótulo).
      if (childItems && childItems.length > 0 && expanded) {
        const node = (
          <div key={item.href}>
            <div
              className="flex items-center rounded-lg"
              style={isActive ? { backgroundColor: 'var(--accent-dim)', borderLeft: '2px solid var(--accent)' } : undefined}
            >
              <Link
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 flex-1 min-w-0 px-2.5 py-2 text-sm transition-colors"
                style={{ color: isActive ? 'var(--accent)' : 'var(--text-muted)', ...(isActive ? { paddingLeft: '8px' } : {}) }}
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
              <button
                onClick={() => setCrmMenuToggled(!crmMenuOpen)}
                className="px-2 py-2 shrink-0 transition-transform"
                style={{ color: 'var(--text-muted)' }}
                aria-label={crmMenuOpen ? 'Recolher submenu do CRM' : 'Expandir submenu do CRM'}
                aria-expanded={crmMenuOpen}
              >
                <svg className={`h-4 w-4 transition-transform duration-150 ${crmMenuOpen ? 'rotate-180' : ''}`} viewBox="0 0 20 20" fill="none">
                  <path d="M5.5 7.5 10 12l4.5-4.5" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
            {crmMenuOpen && childItems.map((child) => {
              const childActive = pathname === child.href || pathname.startsWith(child.href + '/');
              return (
                <Link
                  key={child.href}
                  href={child.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center rounded-lg py-2 pr-2.5 text-sm transition-colors"
                  style={childActive
                    ? { backgroundColor: 'var(--accent-dim)', color: 'var(--accent)', borderLeft: '2px solid var(--accent)', paddingLeft: '42px' }
                    : { color: 'var(--text-muted)', paddingLeft: '44px' }}
                  onMouseEnter={e => { if (!childActive) { e.currentTarget.style.backgroundColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)'; } }}
                  onMouseLeave={e => { if (!childActive) { e.currentTarget.style.backgroundColor = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; } }}
                >
                  {child.label}
                </Link>
              );
            })}
          </div>
        );
        return item.roles ? (
          <PermissionGuard key={item.href} requiredRoles={item.roles}>{node}</PermissionGuard>
        ) : node;
      }

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

  // min-w-0: sem ele o <main> (flex item) estica até a largura do conteúdo e a
  // PÁGINA inteira ganha scroll horizontal — o kanban do CRM depende de o
  // overflow-x-auto interno agir (o default de flex item é min-width:auto)
  const mainClass = sidebarOpen
    ? 'flex-1 min-w-0 transition-all duration-200 min-h-screen md:ml-56'
    : 'flex-1 min-w-0 transition-all duration-200 min-h-screen md:ml-16';

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
              onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--border)')}
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

              {/* TRAFFIC_MANAGER: seletor de cliente — oculto na aba Gestão (visão geral de todos os clientes) */}
              {isTrafficManager && pathname !== '/dashboard/gestor' ? (
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} style={{ color: '#60a5fa' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
                  </svg>
                  <span className="text-xs shrink-0" style={{ color: 'var(--text-muted)' }}>Cliente:</span>
                  {clientOrgs.length === 0 ? (
                    <span className="text-sm" style={{ color: 'var(--text-muted)' }}>Carregando...</span>
                  ) : (
                    <ClientSelector clients={clientOrgs} selectedOrgId={selectedOrgId} onChange={handleClientChange} />
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

          <AvisoEmailNaoConfirmado />

          <div className="p-4 sm:p-6">{children}</div>
        </main>
      </div>
    </ProtectedRoute>
  );
}