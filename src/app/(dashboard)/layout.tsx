'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';
import Image from 'next/image';
import { LogOut, Home, Users, FileText, CheckSquare, BarChart, Menu, Moon, Sun, Bell, CheckCheck, List, AlertCircle, User, History, Percent, ChevronDown, Landmark, Target } from 'lucide-react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<any>(null);

  const userProfileIdRef = useRef<string | null>(null);
  useEffect(() => {
    userProfileIdRef.current = userProfile?.id || null;
  }, [userProfile?.id]);

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isVendasOpen, setIsVendasOpen] = useState(false);
  const [isRelatoriosOpen, setIsRelatoriosOpen] = useState(false);
  const [activeSubItem, setActiveSubItem] = useState<string>('');
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Sincroniza a abertura dos submenus quando a rota muda
  useEffect(() => {
    if (pathname.includes('/vendas')) {
      setIsVendasOpen(true);
      setIsRelatoriosOpen(false);
      const isLoteQuery = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('tipo') === 'lote';
      if (pathname.includes('/vendas/lote') || isLoteQuery) {
        setActiveSubItem('vendas-lote');
      } else if (pathname === '/vendas/novo' || pathname === '/vendas') {
        setActiveSubItem('vendas-avulsa');
      }
    } else if (pathname.includes('/relatorios')) {
      setIsRelatoriosOpen(true);
      setIsVendasOpen(false);
      if (pathname.includes('/relatorios/vendedor')) {
        setActiveSubItem('rel-vendedor');
      } else {
        setActiveSubItem('rel-vendas');
      }
    } else {
      setIsVendasOpen(false);
      setIsRelatoriosOpen(false);
      setActiveSubItem('');
    }
  }, [pathname]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    // Theme check
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      setIsDarkMode(true);
      document.documentElement.setAttribute('data-theme', 'dark');
    }

    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        router.push('/login');
        return;
      }

      // Fetch user profile from public.usuarios
      const { data: profile, error } = await supabase
        .from('usuarios')
        .select('*')
        .eq('supabase_user_id', session.user.id)
        .single();

      if (error || !profile) {
        // Fallback check through API if RLS is fully blocking client querying
        const resp = await fetch('/api/auth/me', {
          headers: {
            'authorization': `Bearer ${session.access_token}`
          }
        });
        if (resp.ok) {
          const apiProfile = await resp.json();
          if (apiProfile.status !== 'ativo') {
            await supabase.auth.signOut();
            router.push('/login');
            return;
          }
          setUserProfile(apiProfile);
        } else {
          router.push('/login');
          return;
        }
      } else {
        if (profile.status !== 'ativo') {
          await supabase.auth.signOut();
          router.push('/login');
          return;
        }
        setUserProfile(profile);
        setCurrentUserId(profile.id);
        fetchNotifications(profile.id);

        // Redirecionamento inicial por nível será feito pelo outro useEffect de autorização
      }

      setLoading(false);
    };

    checkUser();

    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        router.push('/login');
      }
    });

    // ── Idle Timeout Logic (60 minutos) ─────────────────────────────────────
    let idleTimer: NodeJS.Timeout;
    const timeoutDuration = 60 * 60 * 1000; // 60 minutos em ms

    const logoutUser = async () => {
      console.log('Inatividade detectada. Deslogando...');
      const userId = userProfileIdRef.current;
      if (userId) {
        await supabase
          .from('usuarios')
          .update({ ultima_atividade: null })
          .eq('id', userId);
      }
      await supabase.auth.signOut();
      router.push('/login');
    };

    const resetTimer = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(logoutUser, timeoutDuration);
    };

    // Eventos que contam como "atividade"
    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];

    activityEvents.forEach(event => {
      document.addEventListener(event, resetTimer);
    });

    // Iniciar o cronômetro
    resetTimer();

    return () => {
      listener.subscription.unsubscribe();
      clearTimeout(idleTimer);
      activityEvents.forEach(event => {
        document.removeEventListener(event, resetTimer);
      });
    };
  }, [router]);

  // Activity and Online status tracking
  useEffect(() => {
    if (!userProfile?.id) return;

    // 1. Initial update of last login and last activity
    const updateInitialActivity = async () => {
      const now = new Date().toISOString();
      await supabase
        .from('usuarios')
        .update({
          ultimo_login: now,
          ultima_atividade: now
        })
        .eq('id', userProfile.id);
    };
    updateInitialActivity();

    // 2. Periodic update of last activity if the tab is visible
    const interval = setInterval(async () => {
      if (document.visibilityState === 'visible') {
        const now = new Date().toISOString();
        await supabase
          .from('usuarios')
          .update({ ultima_atividade: now })
          .eq('id', userProfile.id);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [userProfile?.id]);

  // Update activity immediately on route change
  useEffect(() => {
    if (!userProfile?.id) return;
    const updateNavActivity = async () => {
      const now = new Date().toISOString();
      await supabase
        .from('usuarios')
        .update({ ultima_atividade: now })
        .eq('id', userProfile.id);
    };
    updateNavActivity();
  }, [pathname, userProfile?.id]);


  // Redirecionamento por nível de acesso (Autorização client-side)
  useEffect(() => {
    if (!userProfile) return;

    const nivel = userProfile.nivel;

    // Admin tem acesso total
    if (nivel === 'admin') return;

    if (nivel === 'operacional') {
      const allowed = ['/clientes', '/vendas', '/relatorios', '/solicitacoes', '/contas', ...(userProfile.vendedor_vinculado ? ['/dashboard'] : [])];
      const isAllowed = allowed.some(path => pathname.startsWith(path));
      if (!isAllowed) {
        router.push('/vendas');
      }
    } else if (nivel === 'financeiro') {
      const allowed = ['/clientes', '/vendas', '/relatorios', '/contas', ...(userProfile.vendedor_vinculado ? ['/dashboard'] : [])];
      const isAllowed = allowed.some(path => pathname.startsWith(path));
      if (!isAllowed) {
        router.push('/relatorios');
      }
    } else if (nivel === 'vendedor') {
      const allowed = ['/dashboard', '/vendas', '/clientes', '/contas', '/relatorios/vendedor'];
      const isAllowed = allowed.some(path => pathname.startsWith(path) || pathname === '/');
      if (!isAllowed) {
        router.push('/vendas');
      }
    }
  }, [pathname, userProfile, router]);

  const fetchNotifications = async (userId: string) => {
    const { data } = await supabase
      .from('notificacoes')
      .select('*')
      .eq('usuario_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);
    if (data) setNotifications(data);
  };

  const handleBellClick = async () => {
    const wasOpen = showNotifDropdown;
    setShowNotifDropdown(!wasOpen);
    if (!wasOpen && currentUserId) {
      // Refresh notifications from DB (fallback for real-time)
      await fetchNotifications(currentUserId);
    }
  };

  const markAsRead = async (id: string) => {
    await supabase.from('notificacoes').update({ lida: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, lida: true } : n));
  };

  const markAllAsRead = async () => {
    const unread = notifications.filter(n => !n.lida).map(n => n.id);
    if (unread.length === 0) return;
    await supabase.from('notificacoes').update({ lida: true }).in('id', unread);
    setNotifications(prev => prev.map(n => ({ ...n, lida: true })));
  };

  // Real-time subscription: updates bell when new notifications arrive
  useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase
      .channel(`notificacoes_user_${currentUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'pro_consig',
          table: 'notificacoes',
          filter: `usuario_id=eq.${currentUserId}`
        },
        (payload) => {
          setNotifications(prev => [payload.new as any, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUserId]);

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: 'var(--color-bg-body)',
        color: 'var(--color-primary)',
        flexDirection: 'column',
        gap: '1rem'
      }}>
        <div className="spinner" style={{
          width: '40px',
          height: '40px',
          border: '3px solid var(--color-border)',
          borderTopColor: 'var(--color-primary)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <span style={{ fontSize: '0.875rem', fontWeight: 500, letterSpacing: '0.05em' }}>Carregando...</span>
        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  const handleLogout = async () => {
    if (userProfile?.id) {
      await supabase
        .from('usuarios')
        .update({ ultima_atividade: null })
        .eq('id', userProfile.id);
    }
    await supabase.auth.signOut();
    router.push('/login');
  };

  const toggleDarkMode = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    if (newMode) {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('theme', 'light');
    }
  };

  const navItemStyle = (isActive: boolean) => ({
    justifyContent: isSidebarCollapsed ? 'center' : 'flex-start',
    border: isActive ? 'none' : 'transparent',
    boxShadow: 'none',
    padding: isSidebarCollapsed ? '0.45rem' : '0.42rem 0.85rem',
    fontSize: '0.825rem'
  });

  return (
    <div className="dashboard-layout">
      <style>{`
        .sidebar-nav-no-scroll::-webkit-scrollbar {
          display: none;
        }
      `}</style>
      {/* Sidebar */}
      <aside className="dashboard-sidebar" style={{ width: isSidebarCollapsed ? '70px' : '210px' }}>
        <div style={{ padding: isSidebarCollapsed ? '0.75rem 0.5rem' : '0.75rem 0.5rem', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexDirection: isSidebarCollapsed ? 'column' : 'row', gap: '0.4rem' }}>
          <div style={{ overflow: 'hidden', display: 'flex', flexDirection: isSidebarCollapsed ? 'column' : 'row', alignItems: 'center', gap: '0.5rem' }}>
            <Image
              src="/branding.png"
              alt="Logo"
              width={isSidebarCollapsed ? 28 : 34}
              height={isSidebarCollapsed ? 28 : 34}
              style={{ borderRadius: '6px', objectFit: 'cover' }}
            />
            {!isSidebarCollapsed && (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <h1 style={{ color: 'var(--color-primary)', margin: 0, fontSize: '0.78rem', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                  Central Pagamentos
                </h1>
                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '0.05rem', whiteSpace: 'nowrap' }}>
                  Nível: <span style={{ textTransform: 'capitalize', fontWeight: 'bold' }}>{userProfile?.nivel}</span>
                </div>
              </div>
            )}
          </div>
          <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="btn btn-secondary" style={{ padding: '0.2rem', border: 'none', boxShadow: 'none', background: 'transparent', color: 'var(--color-text-main)' }} title="Menu">
            <Menu size={18} />
          </button>
        </div>

        <nav className="sidebar-nav-no-scroll" style={{ flexGrow: 1, padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.1rem', overflowY: 'auto', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {/* Início (Dashboard): Visible to Admin, Vendedor, or users with a linked seller */}
          {(userProfile?.nivel === 'admin' || userProfile?.nivel === 'vendedor' || Boolean(userProfile?.vendedor_vinculado)) && (
            <Link href="/dashboard" className={`btn ${pathname === '/dashboard' ? 'btn-primary' : 'btn-secondary'}`} style={navItemStyle(pathname === '/dashboard')} title="Início">
              <Home size={18} style={{ flexShrink: 0 }} /> {!isSidebarCollapsed && <span style={{ whiteSpace: 'nowrap' }}>Início</span>}
            </Link>
          )}

          {/* Clientes: Visible to Admin, Operacional, Financeiro, Vendedor */}
          {(userProfile?.nivel === 'admin' || userProfile?.nivel === 'operacional' || userProfile?.nivel === 'financeiro' || userProfile?.nivel === 'vendedor') && (
            <Link href="/clientes" className={`btn ${pathname.includes('/clientes') ? 'btn-primary' : 'btn-secondary'}`} style={navItemStyle(pathname.includes('/clientes'))} title="Clientes">
              <Users size={18} style={{ flexShrink: 0 }} /> {!isSidebarCollapsed && <span style={{ whiteSpace: 'nowrap' }}>Clientes</span>}
            </Link>
          )}

          {/* Vendedores: Visible to Admin only */}
          {userProfile?.nivel === 'admin' && (
            <Link href="/vendedores" className={`btn ${pathname.includes('/vendedores') ? 'btn-primary' : 'btn-secondary'}`} style={navItemStyle(pathname.includes('/vendedores'))} title="Vendedores">
              <User size={18} style={{ flexShrink: 0 }} /> {!isSidebarCollapsed && <span style={{ whiteSpace: 'nowrap' }}>Vendedores</span>}
            </Link>
          )}

          {/* Metas: Visible to Admin only */}
          {userProfile?.nivel === 'admin' && (
            <Link href="/metas" className={`btn ${pathname.includes('/metas') ? 'btn-primary' : 'btn-secondary'}`} style={navItemStyle(pathname.includes('/metas'))} title="Metas">
              <Target size={18} style={{ flexShrink: 0 }} /> {!isSidebarCollapsed && <span style={{ whiteSpace: 'nowrap' }}>Metas</span>}
            </Link>
          )}

          {/* Vendas: Visible to Admin, Operacional, Financeiro, Vendedor */}
          {(userProfile?.nivel === 'admin' || userProfile?.nivel === 'operacional' || userProfile?.nivel === 'financeiro' || userProfile?.nivel === 'vendedor') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
              <button
                type="button"
                onClick={() => {
                  if (isSidebarCollapsed) {
                    setIsSidebarCollapsed(false);
                    setIsVendasOpen(true);
                    setIsRelatoriosOpen(false);
                  } else {
                    setIsVendasOpen(prev => {
                      const next = !prev;
                      if (next) setIsRelatoriosOpen(false);
                      return next;
                    });
                  }
                }}
                className={`btn ${(pathname.includes('/vendas') && !isRelatoriosOpen) || isVendasOpen ? 'btn-primary' : 'btn-secondary'}`}
                style={{
                  ...navItemStyle((pathname.includes('/vendas') && !isRelatoriosOpen) || isVendasOpen),
                  width: '100%',
                  justifyContent: isSidebarCollapsed ? 'center' : 'space-between',
                  backgroundColor: isVendasOpen ? 'rgba(79, 70, 229, 0.14)' : undefined,
                  color: isVendasOpen ? 'var(--color-primary)' : undefined
                }}
                title="Vendas"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <FileText size={18} style={{ flexShrink: 0 }} />
                  {!isSidebarCollapsed && <span style={{ whiteSpace: 'nowrap' }}>Vendas</span>}
                </div>
                {!isSidebarCollapsed && (
                  <ChevronDown
                    size={15}
                    style={{
                      flexShrink: 0,
                      transition: 'transform 0.2s ease',
                      transform: isVendasOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                      opacity: 0.75
                    }}
                  />
                )}
              </button>

              {!isSidebarCollapsed && isVendasOpen && (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.1rem',
                  marginLeft: '1.35rem',
                  paddingLeft: '0.65rem',
                  borderLeft: '1.5px solid var(--color-border)',
                  marginTop: '0.1rem',
                  marginBottom: '0.15rem'
                }}>
                  <Link
                    href="/vendas"
                    onClick={() => setActiveSubItem('vendas-avulsa')}
                    className={`btn ${pathname.includes('/vendas') && activeSubItem === 'vendas-avulsa' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{
                      border: 'none',
                      boxShadow: 'none',
                      padding: '0.38rem 0.65rem',
                      fontSize: '0.78rem',
                      justifyContent: 'flex-start',
                      background: pathname.includes('/vendas') && activeSubItem === 'vendas-avulsa' ? 'var(--color-primary)' : 'transparent',
                      color: pathname.includes('/vendas') && activeSubItem === 'vendas-avulsa' ? '#fff' : 'var(--color-text-main)',
                      fontWeight: pathname.includes('/vendas') && activeSubItem === 'vendas-avulsa' ? 600 : 500
                    }}
                  >
                    <span style={{ whiteSpace: 'nowrap' }}>Avulsa</span>
                  </Link>
                  <Link
                    href="/vendas?tipo=lote"
                    onClick={() => setActiveSubItem('vendas-lote')}
                    className={`btn ${pathname.includes('/vendas') && activeSubItem === 'vendas-lote' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{
                      border: 'none',
                      boxShadow: 'none',
                      padding: '0.38rem 0.65rem',
                      fontSize: '0.78rem',
                      justifyContent: 'flex-start',
                      background: pathname.includes('/vendas') && activeSubItem === 'vendas-lote' ? 'var(--color-primary)' : 'transparent',
                      color: pathname.includes('/vendas') && activeSubItem === 'vendas-lote' ? '#fff' : 'var(--color-text-main)',
                      fontWeight: pathname.includes('/vendas') && activeSubItem === 'vendas-lote' ? 600 : 500
                    }}
                  >
                    <span style={{ whiteSpace: 'nowrap' }}>Lote</span>
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* Operações: Visible to Admin only */}
          {userProfile?.nivel === 'admin' && (
            <Link href="/operacoes" className={`btn ${pathname.includes('/operacoes') ? 'btn-primary' : 'btn-secondary'}`} style={navItemStyle(pathname.includes('/operacoes'))} title="Operações">
              <List size={18} style={{ flexShrink: 0 }} /> {!isSidebarCollapsed && <span style={{ whiteSpace: 'nowrap' }}>Operações</span>}
            </Link>
          )}

          {/* Inadimplentes: Visible to Admin only */}
          {userProfile?.nivel === 'admin' && (
            <Link href="/inadimplentes" className={`btn ${pathname.includes('/inadimplentes') ? 'btn-primary' : 'btn-secondary'}`} style={navItemStyle(pathname.includes('/inadimplentes'))} title="Inadimplentes">
              <AlertCircle size={18} style={{ flexShrink: 0 }} /> {!isSidebarCollapsed && <span style={{ whiteSpace: 'nowrap' }}>Inadimplentes</span>}
            </Link>
          )}

          {/* Baixas: Visible to Admin only */}
          {userProfile?.nivel === 'admin' && (
            <Link href="/baixas" className={`btn ${pathname.includes('/baixas') ? 'btn-primary' : 'btn-secondary'}`} style={navItemStyle(pathname.includes('/baixas'))} title="Baixas">
              <CheckSquare size={18} style={{ flexShrink: 0 }} /> {!isSidebarCollapsed && <span style={{ whiteSpace: 'nowrap' }}>Baixas</span>}
            </Link>
          )}

          {/* Usuários: Visible to Admin only */}
          {userProfile?.nivel === 'admin' && (
            <Link href="/usuarios" className={`btn ${pathname.includes('/usuarios') ? 'btn-primary' : 'btn-secondary'}`} style={navItemStyle(pathname.includes('/usuarios'))} title="Usuários">
              <Users size={18} style={{ flexShrink: 0 }} /> {!isSidebarCollapsed && <span style={{ whiteSpace: 'nowrap' }}>Usuários</span>}
            </Link>
          )}

          {/* Relatórios: Visible to Admin, Operacional, Financeiro, Vendedor */}
          {(userProfile?.nivel === 'admin' || userProfile?.nivel === 'operacional' || userProfile?.nivel === 'financeiro' || userProfile?.nivel === 'vendedor') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
              <button
                type="button"
                onClick={() => {
                  if (isSidebarCollapsed) {
                    setIsSidebarCollapsed(false);
                    setIsRelatoriosOpen(true);
                    setIsVendasOpen(false);
                  } else {
                    setIsRelatoriosOpen(prev => {
                      const next = !prev;
                      if (next) setIsVendasOpen(false);
                      return next;
                    });
                  }
                }}
                className={`btn ${(pathname.includes('/relatorios') && !isVendasOpen) || isRelatoriosOpen ? 'btn-primary' : 'btn-secondary'}`}
                style={{
                  ...navItemStyle((pathname.includes('/relatorios') && !isVendasOpen) || isRelatoriosOpen),
                  width: '100%',
                  justifyContent: isSidebarCollapsed ? 'center' : 'space-between',
                  backgroundColor: isRelatoriosOpen ? 'rgba(79, 70, 229, 0.14)' : undefined,
                  color: isRelatoriosOpen ? 'var(--color-primary)' : undefined
                }}
                title="Relatórios"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <BarChart size={18} style={{ flexShrink: 0 }} />
                  {!isSidebarCollapsed && <span style={{ whiteSpace: 'nowrap' }}>Relatórios</span>}
                </div>
                {!isSidebarCollapsed && (
                  <ChevronDown
                    size={15}
                    style={{
                      flexShrink: 0,
                      transition: 'transform 0.2s ease',
                      transform: isRelatoriosOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                      opacity: 0.75
                    }}
                  />
                )}
              </button>

              {!isSidebarCollapsed && isRelatoriosOpen && (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.1rem',
                  marginLeft: '1.35rem',
                  paddingLeft: '0.65rem',
                  borderLeft: '1.5px solid var(--color-border)',
                  marginTop: '0.1rem',
                  marginBottom: '0.15rem'
                }}>
                  {userProfile?.nivel !== 'vendedor' && (
                    <Link
                      href="/relatorios"
                      onClick={() => setActiveSubItem('rel-vendas')}
                      className={`btn ${pathname.includes('/relatorios') && activeSubItem === 'rel-vendas' ? 'btn-primary' : 'btn-secondary'}`}
                      style={{
                        border: 'none',
                        boxShadow: 'none',
                        padding: '0.38rem 0.65rem',
                        fontSize: '0.78rem',
                        justifyContent: 'flex-start',
                        background: pathname.includes('/relatorios') && activeSubItem === 'rel-vendas' ? 'var(--color-primary)' : 'transparent',
                        color: pathname.includes('/relatorios') && activeSubItem === 'rel-vendas' ? '#fff' : 'var(--color-text-main)',
                        fontWeight: pathname.includes('/relatorios') && activeSubItem === 'rel-vendas' ? 600 : 500
                      }}
                    >
                      <span style={{ whiteSpace: 'nowrap' }}>Vendas</span>
                    </Link>
                  )}
                  <Link
                    href="/relatorios/vendedor"
                    onClick={() => setActiveSubItem('rel-vendedor')}
                    className={`btn ${pathname.includes('/relatorios/vendedor') || (pathname.includes('/relatorios') && activeSubItem === 'rel-vendedor') ? 'btn-primary' : 'btn-secondary'}`}
                    style={{
                      border: 'none',
                      boxShadow: 'none',
                      padding: '0.38rem 0.65rem',
                      fontSize: '0.78rem',
                      justifyContent: 'flex-start',
                      background: pathname.includes('/relatorios/vendedor') || (pathname.includes('/relatorios') && activeSubItem === 'rel-vendedor') ? 'var(--color-primary)' : 'transparent',
                      color: pathname.includes('/relatorios/vendedor') || (pathname.includes('/relatorios') && activeSubItem === 'rel-vendedor') ? '#fff' : 'var(--color-text-main)',
                      fontWeight: pathname.includes('/relatorios/vendedor') || (pathname.includes('/relatorios') && activeSubItem === 'rel-vendedor') ? 600 : 500
                    }}
                  >
                    <span style={{ whiteSpace: 'nowrap' }}>Vendedor</span>
                  </Link>
                </div>
              )}
            </div>
          )}

          {/* Contas: Visible to all authenticated users */}
          {(userProfile?.nivel === 'admin' || userProfile?.nivel === 'operacional' || userProfile?.nivel === 'financeiro' || userProfile?.nivel === 'vendedor') && (
            <Link href="/contas" className={`btn ${pathname.includes('/contas') ? 'btn-primary' : 'btn-secondary'}`} style={navItemStyle(pathname.includes('/contas'))} title="Contas">
              <Landmark size={18} style={{ flexShrink: 0 }} /> {!isSidebarCollapsed && <span style={{ whiteSpace: 'nowrap' }}>Contas</span>}
            </Link>
          )}

          {/* Coeficientes: Visible to Admin only */}
          {userProfile?.nivel === 'admin' && (
            <Link href="/coeficientes" className={`btn ${pathname.includes('/coeficientes') ? 'btn-primary' : 'btn-secondary'}`} style={navItemStyle(pathname.includes('/coeficientes'))} title="Coeficientes">
              <Percent size={18} style={{ flexShrink: 0 }} /> {!isSidebarCollapsed && <span style={{ whiteSpace: 'nowrap' }}>Coeficientes</span>}
            </Link>
          )}

          {/* Histórico: Visible to Admin only */}
          {userProfile?.nivel === 'admin' && (
            <Link href="/historico" className={`btn ${pathname.includes('/historico') ? 'btn-primary' : 'btn-secondary'}`} style={navItemStyle(pathname.includes('/historico'))} title="Histórico">
              <History size={18} style={{ flexShrink: 0 }} /> {!isSidebarCollapsed && <span style={{ whiteSpace: 'nowrap' }}>Histórico</span>}
            </Link>
          )}
        </nav>

        <div style={{ padding: isSidebarCollapsed ? '0.75rem 0.5rem' : '0.75rem', borderTop: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', alignItems: isSidebarCollapsed ? 'center' : 'stretch' }}>
          {!isSidebarCollapsed && (
            <div style={{ marginBottom: '0.75rem', fontSize: '0.85rem', overflow: 'hidden' }}>
              <strong style={{ display: 'block', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{userProfile?.nome}</strong>
              <span style={{ color: 'var(--color-text-muted)', display: 'block', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{userProfile?.email}</span>
            </div>
          )}
          <button onClick={handleLogout} className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center', padding: isSidebarCollapsed ? '0.5rem' : '0.5rem 1rem' }} title="Sair">
            <LogOut size={18} style={{ flexShrink: 0 }} /> {!isSidebarCollapsed && <span style={{ whiteSpace: 'nowrap' }}>Sair</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="dashboard-main">
        <header className="dashboard-header">
          <div style={{ fontWeight: 600 }}>Bem-vindo de volta!</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {/* Theme Toggle */}
            <button onClick={toggleDarkMode} className="btn btn-secondary" style={{ padding: '0.5rem', borderRadius: '50%', background: 'transparent', border: 'none', boxShadow: 'none', color: 'var(--color-text-muted)' }} title="Alternar Tema">
              {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
            {/* Notification Bell */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={handleBellClick}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', position: 'relative', padding: '0.25rem', color: 'var(--color-text-muted)', display: 'flex', alignItems: 'center' }}
                title="Notificações"
              >
                <Bell size={22} />
                {notifications.filter(n => !n.lida).length > 0 && (
                  <span style={{
                    position: 'absolute', top: '-4px', right: '-4px',
                    background: 'var(--color-danger)', color: '#fff',
                    borderRadius: '50%', fontSize: '0.65rem', fontWeight: 700,
                    minWidth: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    padding: '0 3px'
                  }}>
                    {notifications.filter(n => !n.lida).length}
                  </span>
                )}
              </button>

              {showNotifDropdown && (
                <>
                  {/* Backdrop */}
                  <div onClick={() => setShowNotifDropdown(false)} style={{ position: 'fixed', inset: 0, zIndex: 998 }} />
                  {/* Dropdown */}
                  <div style={{
                    position: 'absolute', right: 0, top: 'calc(100% + 8px)',
                    width: '360px', background: 'var(--color-bg-surface)',
                    border: '1px solid var(--color-border)', borderRadius: 'var(--radius)',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.15)', zIndex: 999,
                    overflow: 'hidden'
                  }}>
                    <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Notificações</span>
                      {notifications.some(n => !n.lida) && (
                        <button
                          onClick={markAllAsRead}
                          style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '0.75rem', color: 'var(--color-primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem', padding: '0.2rem 0.4rem', borderRadius: '4px' }}
                          title="Marcar todas como lidas"
                        >
                          <CheckCheck size={14} /> Marcar tudo
                        </button>
                      )}
                    </div>
                    {notifications.length === 0 ? (
                      <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                        Nenhuma notificação ainda.
                      </div>
                    ) : (
                      <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
                        {notifications.map(n => (
                          <div key={n.id} style={{
                            padding: '0.75rem 1rem',
                            borderBottom: '1px solid var(--color-border)',
                            background: n.lida ? 'transparent' : 'rgba(79,70,229,0.06)',
                            transition: 'background 0.2s'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontWeight: 600, fontSize: '0.8rem', marginBottom: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                  {!n.lida && <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--color-primary)', flexShrink: 0, display: 'inline-block' }} />}
                                  {n.titulo}
                                </div>
                                <div style={{ fontSize: '0.775rem', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>{n.mensagem}</div>
                                <div style={{ fontSize: '0.7rem', color: 'var(--color-text-light)', marginTop: '0.3rem' }}>
                                  {new Date(n.created_at).toLocaleString('pt-BR')}
                                </div>
                              </div>
                              {!n.lida && (
                                <button
                                  onClick={() => markAsRead(n.id)}
                                  style={{ background: 'transparent', border: '1px solid var(--color-border)', borderRadius: '6px', cursor: 'pointer', padding: '0.3rem', color: 'var(--color-text-muted)', flexShrink: 0, display: 'flex', alignItems: 'center', transition: 'all 0.15s' }}
                                  title="Marcar como lida"
                                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-primary)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-primary)'; }}
                                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-muted)'; (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--color-border)'; }}
                                >
                                  <CheckCheck size={14} />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </header>
        <div className="dashboard-content">
          {children}
        </div>
      </main>
    </div>
  );
}
