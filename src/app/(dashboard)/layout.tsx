'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import Link from 'next/link';
import Image from 'next/image';
import { LogOut, Home, Users, FileText, CheckSquare, BarChart, Menu, Moon, Sun, Bell, CheckCheck } from 'lucide-react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<any>(null);

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
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

        // Redirect financeiro to reports by default
        if (profile.nivel === 'financeiro' && (pathname === '/dashboard' || pathname === '/')) {
          router.push('/relatorios');
        }
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
    padding: isSidebarCollapsed ? '0.625rem' : '0.625rem 1.25rem'
  });

  return (
    <div className="dashboard-layout">
      {/* Sidebar */}
      <aside className="dashboard-sidebar" style={{ width: isSidebarCollapsed ? '80px' : '280px' }}>
        <div style={{ padding: isSidebarCollapsed ? '1rem 0.5rem' : '1.5rem', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexDirection: isSidebarCollapsed ? 'column' : 'row', gap: '0.5rem' }}>
          <div style={{ overflow: 'hidden', display: 'flex', flexDirection: isSidebarCollapsed ? 'column' : 'row', alignItems: 'center', gap: '0.75rem' }}>
            <Image
              src="/branding.png"
              alt="Logo"
              width={isSidebarCollapsed ? 32 : 40}
              height={isSidebarCollapsed ? 32 : 40}
              style={{ borderRadius: '8px', objectFit: 'cover' }}
            />
            {!isSidebarCollapsed && (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <h2 style={{ color: 'var(--color-primary)', margin: 0, fontSize: '0.9rem', whiteSpace: 'nowrap' }}>
                  CentralPagamentos
                </h2>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.1rem', whiteSpace: 'nowrap' }}>
                  Nível: <span style={{ textTransform: 'capitalize', fontWeight: 'bold' }}>{userProfile?.nivel}</span>
                </div>
              </div>
            )}
          </div>
          <button onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)} className="btn btn-secondary" style={{ padding: '0.25rem', border: 'none', boxShadow: 'none', background: 'transparent', color: 'var(--color-text-main)' }} title="Menu">
            <Menu size={20} />
          </button>
        </div>

        <nav style={{ flexGrow: 1, padding: isSidebarCollapsed ? '1rem 0.5rem' : '1rem', display: 'flex', flexDirection: 'column', gap: '0.25rem', overflowY: 'auto' }}>
          {userProfile?.nivel !== 'financeiro' && (
            <>
              <Link href="/dashboard" className={`btn ${pathname === '/dashboard' ? 'btn-primary' : 'btn-secondary'}`} style={navItemStyle(pathname === '/dashboard')} title="Início">
                <Home size={18} style={{ flexShrink: 0 }} /> {!isSidebarCollapsed && <span style={{ whiteSpace: 'nowrap' }}>Início</span>}
              </Link>
              <Link href="/clientes" className={`btn ${pathname.includes('/clientes') ? 'btn-primary' : 'btn-secondary'}`} style={navItemStyle(pathname.includes('/clientes'))} title="Clientes">
                <Users size={18} style={{ flexShrink: 0 }} /> {!isSidebarCollapsed && <span style={{ whiteSpace: 'nowrap' }}>Clientes</span>}
              </Link>
              <Link href="/vendas" className={`btn ${pathname.includes('/vendas') ? 'btn-primary' : 'btn-secondary'}`} style={navItemStyle(pathname.includes('/vendas'))} title="Vendas">
                <FileText size={18} style={{ flexShrink: 0 }} /> {!isSidebarCollapsed && <span style={{ whiteSpace: 'nowrap' }}>Vendas</span>}
              </Link>
            </>
          )}
          {userProfile?.nivel === 'admin' && (
            <Link href="/solicitacoes" className={`btn ${pathname.includes('/solicitacoes') ? 'btn-primary' : 'btn-secondary'}`} style={navItemStyle(pathname.includes('/solicitacoes'))} title="Solicitações">
              <CheckSquare size={18} style={{ flexShrink: 0 }} /> {!isSidebarCollapsed && <span style={{ whiteSpace: 'nowrap' }}>Solicitações</span>}
            </Link>
          )}
          {userProfile?.nivel === 'admin' && (
            <Link href="/usuarios" className={`btn ${pathname.includes('/usuarios') ? 'btn-primary' : 'btn-secondary'}`} style={navItemStyle(pathname.includes('/usuarios'))} title="Gerenciar Usuários">
              <Users size={18} style={{ flexShrink: 0 }} /> {!isSidebarCollapsed && <span style={{ whiteSpace: 'nowrap' }}>Gerenciar Usuários</span>}
            </Link>
          )}
          {(userProfile?.nivel === 'admin' || userProfile?.nivel === 'financeiro') && (
            <Link href="/relatorios" className={`btn ${pathname.includes('/relatorios') ? 'btn-primary' : 'btn-secondary'}`} style={navItemStyle(pathname.includes('/relatorios'))} title="Relatórios">
              <BarChart size={18} style={{ flexShrink: 0 }} /> {!isSidebarCollapsed && <span style={{ whiteSpace: 'nowrap' }}>Relatórios</span>}
            </Link>
          )}
        </nav>

        <div style={{ padding: isSidebarCollapsed ? '1rem 0.5rem' : '1rem', borderTop: '1px solid var(--color-border)', display: 'flex', flexDirection: 'column', alignItems: isSidebarCollapsed ? 'center' : 'stretch' }}>
          {!isSidebarCollapsed && (
            <div style={{ marginBottom: '1rem', fontSize: '0.875rem', overflow: 'hidden' }}>
              <strong style={{ display: 'block', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{userProfile?.nome}</strong>
              <span style={{ color: 'var(--color-text-muted)', display: 'block', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{userProfile?.email}</span>
            </div>
          )}
          <button onClick={handleLogout} className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center', padding: isSidebarCollapsed ? '0.625rem' : '0.625rem 1.25rem' }} title="Sair">
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
