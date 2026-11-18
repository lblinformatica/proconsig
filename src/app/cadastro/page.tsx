'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { User, AtSign, Mail, Lock, ArrowRight, Eye, EyeOff, CheckCircle, CheckCircle2, Sun, Moon } from 'lucide-react';

export default function Cadastro() {
  const router = useRouter();
  const [nome, setNome] = useState('');
  const [conta, setConta] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('theme');
    const dark = saved === 'dark' || saved === null;
    setIsDark(dark);
    if (dark) {
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }, []);

  const toggleDarkMode = () => {
    const newMode = !isDark;
    setIsDark(newMode);
    if (newMode) {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('theme', 'light');
    }
  };

  const handleCadastro = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      setLoading(false);
      return;
    }

    try {
      const resp = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, conta, email, password }),
      });

      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Erro ao realizar o cadastro.');
      setSuccess(true);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const theme = isDark ? 'is-dark' : 'is-light';

  const styles = `
    .reg-page {
      position: fixed;
      inset: 0;
      display: flex;
      font-family: 'Inter', sans-serif;
    }

    /* ─── DARK ─── */
    .reg-page.is-dark { background: #0f172a; }
    .reg-page.is-dark .reg-right { background: #0f172a; }
    .reg-page.is-dark .reg-heading { color: #f8fafc; }
    .reg-page.is-dark .reg-subheading { color: #64748b; }
    .reg-page.is-dark .reg-label { color: #94a3b8; }
    .reg-page.is-dark .reg-input {
      background: rgba(255,255,255,0.06) !important;
      border: 1px solid rgba(255,255,255,0.1) !important;
      color: #f8fafc !important;
    }
    .reg-page.is-dark .reg-input::placeholder { color: #475569 !important; }
    .reg-page.is-dark .reg-input:focus {
      border-color: #f97316 !important;
      background: rgba(249,115,22,0.1) !important;
      box-shadow: 0 0 0 3px rgba(249,115,22,0.2) !important;
    }
    .reg-page.is-dark .reg-input-icon { color: #475569; }
    .reg-page.is-dark .reg-input-wrap:focus-within .reg-input-icon { color: #f97316; }
    .reg-page.is-dark .reg-toggle { color: #475569; }
    .reg-page.is-dark .reg-toggle:hover { color: #f97316; }
    .reg-page.is-dark .reg-login { color: #475569; }
    .reg-page.is-dark .reg-login a { color: #fb923c; }
    .reg-page.is-dark .reg-login a:hover { color: #fdba74; }
    .reg-page.is-dark .reg-right::before { background: radial-gradient(circle, rgba(249,115,22,0.22) 0%, transparent 70%); }
    .reg-page.is-dark .reg-right::after  { background: radial-gradient(circle, rgba(234,88,12,0.15) 0%, transparent 70%); }
    .reg-page.is-dark .reg-mobile-name { color: #fff; }
    .reg-page.is-dark .reg-success-card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); }
    .reg-page.is-dark .reg-success-card h2 { color: #f8fafc; }
    .reg-page.is-dark .reg-success-card p { color: #94a3b8; }

    /* ─── LIGHT ─── */
    .reg-page.is-light { background: #f1f5f9; }
    .reg-page.is-light .reg-right { background: #ffffff; box-shadow: -4px 0 24px rgba(0,0,0,0.06); }
    .reg-page.is-light .reg-heading { color: #0f172a; }
    .reg-page.is-light .reg-subheading { color: #64748b; }
    .reg-page.is-light .reg-label { color: #475569; }
    .reg-page.is-light .reg-input {
      background: #f8fafc !important;
      border: 1px solid #e2e8f0 !important;
      color: #0f172a !important;
    }
    .reg-page.is-light .reg-input::placeholder { color: #94a3b8 !important; }
    .reg-page.is-light .reg-input:focus {
      border-color: #ea580c !important;
      background: #fff !important;
      box-shadow: 0 0 0 3px rgba(234,88,12,0.15) !important;
    }
    .reg-page.is-light .reg-input-icon { color: #94a3b8; }
    .reg-page.is-light .reg-input-wrap:focus-within .reg-input-icon { color: #ea580c; }
    .reg-page.is-light .reg-toggle { color: #94a3b8; }
    .reg-page.is-light .reg-toggle:hover { color: #ea580c; }
    .reg-page.is-light .reg-login { color: #475569; }
    .reg-page.is-light .reg-login a { color: #ea580c; }
    .reg-page.is-light .reg-login a:hover { color: #c2410c; }
    .reg-page.is-light .reg-right::before { background: radial-gradient(circle, rgba(249,115,22,0.08) 0%, transparent 70%); }
    .reg-page.is-light .reg-right::after  { background: radial-gradient(circle, rgba(234,88,12,0.06) 0%, transparent 70%); }
    .reg-page.is-light .reg-mobile-name { color: #0f172a; }
    .reg-page.is-light .reg-error {
      background: rgba(239,68,68,0.08);
      border: 1px solid rgba(239,68,68,0.25);
      color: #b91c1c;
    }
    .reg-page.is-light .reg-success-card { background: #fff; border: 1px solid #e2e8f0; }
    .reg-page.is-light .reg-success-card h2 { color: #0f172a; }
    .reg-page.is-light .reg-success-card p { color: #475569; }

    /* ─── LEFT PANEL ─── */
    .reg-left {
      flex: 0 0 50%;
      position: relative;
      display: none;
      overflow: hidden;
      background: #f8fafc;
      border-right: 1px solid rgba(226, 232, 240, 0.8);
      height: 100%;
    }
    @media (min-width: 900px) { .reg-left { display: block; } }

    .reg-left-bg {
      position: absolute; inset: 0;
      object-fit: cover; object-position: center;
      width: 100%; height: 100%;
      filter: grayscale(100%);
      opacity: 0.20;
    }
    .reg-left-overlay {
      position: absolute; inset: 0;
      background: linear-gradient(
        135deg,
        rgba(248, 250, 252, 0.65) 0%,
        rgba(248, 250, 252, 0.30) 50%,
        rgba(248, 250, 252, 0.60) 100%
      );
      pointer-events: none;
    }
    .reg-left-content {
      position: relative; z-index: 2;
      height: 100%; display: flex; flex-direction: column;
      justify-content: space-between; padding: 3.5rem 3.5rem; color: #0f172a;
    }
    .reg-brand {
      display: flex;
      align-items: center;
      gap: 1.5rem;
      flex-wrap: wrap;
    }
    .reg-brand-title {
      font-family: 'Outfit', sans-serif;
      font-size: 2.35rem;
      font-weight: 800;
      letter-spacing: -0.03em;
      line-height: 1;
      white-space: nowrap;
    }
    .reg-brand-orange { color: #ea580c; }
    .reg-brand-blue { color: #1e3a8a; }

    .reg-left-tagline {
      min-height: 220px;
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
    }
    .reg-left-tagline h2 {
      font-family: 'Outfit', sans-serif;
      font-size: 2.35rem;
      font-weight: 600;
      line-height: 1.25;
      color: #1e293b;
      letter-spacing: -0.02em;
      margin-bottom: 2.95rem;
    }
    .reg-left-tagline p {
      font-size: 1.05rem;
      color: #475569;
      line-height: 1.7;
      max-width: 480px;
    }
    .reg-left-pills { display: flex; gap: 0.75rem; flex-wrap: wrap; }
    .reg-pill {
      background: rgba(255, 255, 255, 0.92);
      border: 1px solid rgba(203, 213, 225, 0.85);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
      backdrop-filter: blur(8px);
      color: #1e293b;
      padding: 0.45rem 1rem;
      border-radius: 9999px;
      font-size: 0.82rem;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 0.45rem;
    }

    /* ─── RIGHT PANEL ─── */
    .reg-right {
      flex: 0 0 50%;
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: 3rem 2rem;
      position: relative;
      overflow-y: auto;
    }
    @media (max-width: 899px) { .reg-right { flex: 0 0 100%; } }
    @media (min-width: 900px) { .reg-right { padding: 3rem; } }

    .reg-right::before {
      content: ''; position: absolute; top: -100px; right: -80px;
      width: 300px; height: 300px; border-radius: 50%; pointer-events: none;
      animation: blobFloat 8s ease-in-out infinite alternate;
    }
    .reg-right::after {
      content: ''; position: absolute; bottom: -80px; left: -60px;
      width: 240px; height: 240px; border-radius: 50%; pointer-events: none;
      animation: blobFloat 10s ease-in-out infinite alternate-reverse;
    }
    @keyframes blobFloat { from { transform: translateY(0) scale(1); } to { transform: translateY(25px) scale(1.07); } }

    .reg-form-wrapper {
      position: relative;
      z-index: 2;
      width: 100%;
      max-width: 420px;
      margin: auto;
    }

    .reg-mobile-brand { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.5rem; }
    @media (min-width: 900px) { .reg-mobile-brand { display: none; } }
    .reg-mobile-logo { width: 40px; height: 40px; border-radius: 10px; object-fit: cover; }

    .reg-heading { font-family: 'Outfit', sans-serif; font-size: 2rem; font-weight: 700; letter-spacing: -0.02em; margin-bottom: 0.5rem; }
    .reg-subheading { font-size: 0.95rem; margin-bottom: 1.5rem; color: #64748b; }

    .reg-error {
      background: rgba(239,68,68,0.12); border: 1px solid rgba(239,68,68,0.35);
      color: #fca5a5; padding: 0.6rem 1rem; border-radius: 0.625rem;
      font-size: 0.82rem; margin-bottom: 1rem;
      animation: fadeErr 0.3s ease;
    }
    @keyframes fadeErr { from { opacity:0; transform: translateY(-6px); } to { opacity:1; transform: translateY(0); } }

    .reg-field { margin-bottom: 0.65rem; }
    .reg-label { display: block; font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 0.3rem; }
    .reg-input-wrap { position: relative; display: flex; align-items: center; }
    .reg-input-icon { position: absolute; left: 0.875rem; top: 50%; transform: translateY(-50%); pointer-events: none; transition: color 0.2s; z-index: 1; display: flex; align-items: center; }
    .reg-input {
      width: 100% !important; padding: 0.65rem 1rem 0.65rem 2.6rem !important;
      border-radius: 0.575rem !important; font-size: 0.875rem !important;
      transition: border-color 0.2s, background 0.2s, box-shadow 0.2s !important;
      outline: none !important; box-shadow: none !important;
    }
    .reg-input::-webkit-credentials-auto-fill-button,
    .reg-input::-webkit-contacts-auto-fill-button { visibility: hidden; }
    .reg-toggle {
      position: absolute; right: 0.875rem; background: transparent; border: none;
      cursor: pointer; display: flex; align-items: center; padding: 0; transition: color 0.2s;
    }

    .reg-submit {
      width: 100%; margin-top: 1rem; padding: 0.8rem;
      background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
      color: #fff; border: none; border-radius: 0.625rem;
      font-size: 0.9rem; font-weight: 600; cursor: pointer;
      display: flex; align-items: center; justify-content: center; gap: 0.625rem;
      transition: all 0.25s ease; box-shadow: 0 4px 20px rgba(234,88,12,0.35);
      position: relative; overflow: hidden;
    }
    .reg-submit::before { content: ''; position: absolute; inset: 0; background: linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 100%); opacity: 0; transition: opacity 0.25s; }
    .reg-submit:hover:not(:disabled)::before { opacity: 1; }
    .reg-submit:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(234,88,12,0.5); }
    .reg-submit:active:not(:disabled) { transform: translateY(0); }
    .reg-submit:disabled { opacity: 0.65; cursor: not-allowed; }

    .reg-spinner { width: 18px; height: 18px; border: 2px solid rgba(255,255,255,0.4); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    .reg-login { margin-top: 1rem; text-align: center; font-size: 0.85rem; }
    .reg-login a { font-weight: 600; margin-left: 0.25rem; transition: color 0.2s; }

    .theme-toggle-btn {
      position: absolute;
      top: 1.5rem;
      right: 1.5rem;
      z-index: 10;
      padding: 0.5rem;
      border-radius: 50%;
      background: transparent;
      border: none;
      box-shadow: none;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
    }
    .is-dark .theme-toggle-btn { color: #94a3b8; }
    .is-dark .theme-toggle-btn:hover { color: #f8fafc; background: rgba(255,255,255,0.06); }
    .is-light .theme-toggle-btn { color: #475569; }
    .is-light .theme-toggle-btn:hover { color: #0f172a; background: rgba(0,0,0,0.05); }

    /* Success screen */
    .reg-success-card {
      border-radius: 1rem; padding: 2.5rem 2rem; text-align: center;
      animation: fadeErr 0.4s ease;
    }
    .reg-success-icon { color: #10b981; margin-bottom: 1rem; }
    .reg-success-card h2 { font-family: 'Outfit', sans-serif; font-size: 1.5rem; font-weight: 700; margin-bottom: 0.75rem; }
    .reg-success-card p { font-size: 0.9rem; line-height: 1.7; margin-bottom: 2rem; }
  `;

  if (success) {
    return (
      <>
        <style>{styles}</style>
        <div className={`reg-page ${theme}`}>
          <button onClick={toggleDarkMode} className="theme-toggle-btn" title="Alternar Tema" type="button">
            {isDark ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <div className="reg-left">
            <Image src="/branding.png" alt="CentralPagamentos background" fill sizes="50vw" className="reg-left-bg" priority />
            <div className="reg-left-overlay" />
            <div className="reg-left-content">
              <div className="reg-brand">
                <Image src="/branding.png" alt="Logo" width={48} height={48} className="reg-brand-logo" />
                <span className="reg-brand-name">CentralPagamentos</span>
              </div>
              <div className="reg-left-tagline">
                <h2>Gestão de Pagamentos com eficiência e segurança</h2>
                <p>
                  Plataforma completa para gerenciamento de clientes, pagamentos e solicitações, com controle total de acesso e auditoria.
                </p>
              </div>
              <div className="reg-left-pills">
                <span className="reg-pill">Pagamentos</span>
                <span className="reg-pill">Clientes</span>
                <span className="reg-pill">Relatórios</span>
                <span className="reg-pill">Controle de Acesso</span>
              </div>
            </div>
          </div>
          <div className="reg-right">
            <div className="reg-form-wrapper">
              <div className="reg-success-card">
                <div className="reg-success-icon"><CheckCircle size={56} /></div>
                <h2>Cadastro Realizado!</h2>
                <p>
                  Sua conta está <strong>pendente de aprovação</strong> pelo administrador.
                  Você receberá um e-mail assim que for aprovada.
                </p>
                <Link href="/login" className="reg-submit" style={{ textDecoration: 'none', display: 'inline-flex', width: 'auto', padding: '0.75rem 2rem' }}>
                  Ir para o Login <ArrowRight size={18} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <style>{styles}</style>
      <div className={`reg-page ${theme}`}>
        <button onClick={toggleDarkMode} className="theme-toggle-btn" title="Alternar Tema" type="button">
          {isDark ? <Sun size={20} /> : <Moon size={20} />}
        </button>
        {/* Left panel — identical to login page to avoid layout shift on navigation */}
        <div className="reg-left">
          <Image src="/fundo_ovale_calculadora.jpg" alt="Fundo Grupo Ovale" fill sizes="50vw" className="reg-left-bg" priority />
          <div className="reg-left-overlay" />
          <div className="reg-left-content">
            <div className="reg-brand">
              <Image
                src="/logotipo_ovale_transparente.png"
                alt="Grupo Ovale"
                width={300}
                height={20}
                style={{ height: '150px', width: 'auto', objectFit: 'contain' }}
                priority
              />
              <span className="reg-brand-title">
                <span className="reg-brand-orange">Central</span>
                <span className="reg-brand-blue">Pagamentos</span>
              </span>
            </div>

            <div className="reg-left-tagline">
              <h2>Crie sua conta e comece a usar agora mesmo</h2>
              <p>
                Plataforma completa para gerenciamento de clientes, pagamentos e solicitações, com controle total de acesso e auditoria.
              </p>
            </div>

            <div style={{ height: '38px', minHeight: '38px' }} aria-hidden="true" />
          </div>
        </div>

        {/* Right panel */}
        <div className="reg-right">
          <div className="reg-form-wrapper">

            <div className="reg-mobile-brand">
              <div style={{ background: '#fff', padding: '0.35rem 0.65rem', borderRadius: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)', display: 'inline-flex' }}>
                <Image src="/ovale_icon.png" alt="Grupo Ovale" width={32} height={32} style={{ height: '32px', width: 'auto' }} />
              </div>
              <div>
                <span className="reg-mobile-name" style={{ display: 'block', fontSize: '1.25rem', lineHeight: 1.1 }}>Central de Pagamentos</span>
                <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>Grupo Ovale</span>
              </div>
            </div>

            <h1 className="reg-heading">Criar Conta</h1>
            <p className="reg-subheading">Preencha os dados abaixo para solicitar acesso</p>

            {error && <div className="reg-error" role="alert">{error}</div>}

            <form onSubmit={handleCadastro} noValidate>
              {/* Nome */}
              <div className="reg-field">
                <label htmlFor="nome" >Nome Completo</label>
                <div className="reg-input-wrap">
                  <User size={16} className="reg-input-icon" />
                  <input id="nome" type="text" className="reg-input" value={nome} onChange={e => setNome(e.target.value)} placeholder="Seu nome completo" required autoFocus />
                </div>
              </div>

              {/* Conta */}
              <div className="reg-field">
                <label htmlFor="conta" >Nome de Usuário (Conta)</label>
                <div className="reg-input-wrap">
                  <AtSign size={16} className="reg-input-icon" />
                  <input id="conta" type="text" className="reg-input" value={conta} onChange={e => setConta(e.target.value.replace(/\s+/g, ''))} placeholder="ex: seunome" required autoComplete="username" />
                </div>
              </div>

              {/* Email */}
              <div className="reg-field">
                <label htmlFor="email" >E-mail</label>
                <div className="reg-input-wrap">
                  <Mail size={16} className="reg-input-icon" />
                  <input id="email" type="email" className="reg-input" value={email} onChange={e => setEmail(e.target.value.toLowerCase())} placeholder="seu@email.com" required autoComplete="email" />
                </div>
              </div>

              {/* Senha */}
              <div className="reg-field">
                <label htmlFor="password" >Senha</label>
                <div className="reg-input-wrap">
                  <Lock size={16} className="reg-input-icon" />
                  <input id="password" type={showPassword ? 'text' : 'password'} className="reg-input" value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" required minLength={6} autoComplete="new-password" />
                  <button type="button" className="reg-toggle" onClick={() => setShowPassword(!showPassword)} tabIndex={-1} aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}>
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Confirmar Senha */}
              <div className="reg-field">
                <label htmlFor="confirmPassword" >Confirmar Senha</label>
                <div className="reg-input-wrap">
                  <Lock size={16} className="reg-input-icon" />
                  <input id="confirmPassword" type={showConfirm ? 'text' : 'password'} className="reg-input" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Repita a senha" required autoComplete="new-password" />
                  <button type="button" className="reg-toggle" onClick={() => setShowConfirm(!showConfirm)} tabIndex={-1} aria-label={showConfirm ? 'Ocultar' : 'Mostrar'}>
                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button type="submit" className="reg-submit" disabled={loading}>
                {loading ? <><div className="reg-spinner" /> Cadastrando...</> : <>Criar Conta <ArrowRight size={18} /></>}
              </button>
            </form>

            <div className="reg-login">
              Já possui conta?
              <Link href="/login">Fazer Login</Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
