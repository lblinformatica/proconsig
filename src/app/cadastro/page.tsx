'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { User, AtSign, Mail, Lock, ArrowRight, Eye, EyeOff, CheckCircle } from 'lucide-react';

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
    setIsDark(saved === 'dark' || saved === null);
  }, []);

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
      border-color: #6366f1 !important;
      background: rgba(99,102,241,0.1) !important;
      box-shadow: 0 0 0 3px rgba(99,102,241,0.2) !important;
    }
    .reg-page.is-dark .reg-input-icon { color: #475569; }
    .reg-page.is-dark .reg-input-wrap:focus-within .reg-input-icon { color: #818cf8; }
    .reg-page.is-dark .reg-toggle { color: #475569; }
    .reg-page.is-dark .reg-toggle:hover { color: #818cf8; }
    .reg-page.is-dark .reg-login { color: #475569; }
    .reg-page.is-dark .reg-login a { color: #818cf8; }
    .reg-page.is-dark .reg-right::before { background: radial-gradient(circle, rgba(99,102,241,0.25) 0%, transparent 70%); }
    .reg-page.is-dark .reg-right::after  { background: radial-gradient(circle, rgba(14,165,233,0.18) 0%, transparent 70%); }
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
      border-color: #6366f1 !important;
      background: #fff !important;
      box-shadow: 0 0 0 3px rgba(99,102,241,0.15) !important;
    }
    .reg-page.is-light .reg-input-icon { color: #94a3b8; }
    .reg-page.is-light .reg-input-wrap:focus-within .reg-input-icon { color: #6366f1; }
    .reg-page.is-light .reg-toggle { color: #94a3b8; }
    .reg-page.is-light .reg-toggle:hover { color: #6366f1; }
    .reg-page.is-light .reg-login { color: #475569; }
    .reg-page.is-light .reg-login a { color: #4f46e5; }
    .reg-page.is-light .reg-right::before { background: radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%); }
    .reg-page.is-light .reg-right::after  { background: radial-gradient(circle, rgba(14,165,233,0.06) 0%, transparent 70%); }
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
      height: 100%;
    }
    @media (min-width: 900px) { .reg-left { display: block; } }

    .reg-left-bg {
      position: absolute; inset: 0;
      object-fit: cover; width: 100%; height: 100%;
      filter: brightness(0.42) saturate(1.2);
    }
    .reg-left-overlay {
      position: absolute; inset: 0;
      background: linear-gradient(135deg, rgba(79,70,229,0.55) 0%, rgba(15,23,42,0.7) 100%);
    }
    .reg-left-content {
      position: relative; z-index: 2;
      height: 100%; display: flex; flex-direction: column;
      justify-content: space-between; padding: 3rem; color: #fff;
    }
    .reg-brand { display: flex; align-items: center; gap: 0.875rem; }
    .reg-brand-logo { width: 48px; height: 48px; border-radius: 12px; object-fit: cover; box-shadow: 0 4px 20px rgba(0,0,0,0.4); }
    .reg-brand-name { font-family: 'Outfit', sans-serif; font-size: 1.75rem; font-weight: 700; letter-spacing: -0.02em; color: #fff; }
    .reg-left-tagline { margin-bottom: 4rem; }
    .reg-left-tagline h2 { font-family: 'Outfit', sans-serif; font-size: 2.5rem; font-weight: 700; line-height: 1.2; color: #fff; margin-bottom: 1rem; }
    .reg-left-tagline p { font-size: 1.05rem; color: rgba(255,255,255,0.75); line-height: 1.7; max-width: 380px; }
    .reg-left-pills { display: flex; gap: 0.75rem; flex-wrap: wrap; }
    .reg-pill { background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.2); backdrop-filter: blur(8px); color: #fff; padding: 0.4rem 1rem; border-radius: 9999px; font-size: 0.8rem; font-weight: 500; }

    /* ─── RIGHT PANEL ─── */
    .reg-right {
      flex: 0 0 50%;
      position: relative;
      overflow: hidden;
    }
    @media (max-width: 899px) { .reg-right { flex: 0 0 100%; } }

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
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: calc(100% - 4rem);
      max-width: 420px;
      z-index: 2;
    }

    .reg-mobile-brand { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem; }
    @media (min-width: 900px) { .reg-mobile-brand { display: none; } }
    .reg-mobile-logo { width: 40px; height: 40px; border-radius: 10px; object-fit: cover; }

    .reg-heading { font-family: 'Outfit', sans-serif; font-size: 1.5rem; font-weight: 700; letter-spacing: -0.02em; margin-bottom: 0.2rem; }
    .reg-subheading { font-size: 0.85rem; margin-bottom: 1.25rem; }

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
      background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
      color: #fff; border: none; border-radius: 0.625rem;
      font-size: 0.9rem; font-weight: 600; cursor: pointer;
      display: flex; align-items: center; justify-content: center; gap: 0.625rem;
      transition: all 0.25s ease; box-shadow: 0 4px 20px rgba(99,102,241,0.35);
      position: relative; overflow: hidden;
    }
    .reg-submit::before { content: ''; position: absolute; inset: 0; background: linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 100%); opacity: 0; transition: opacity 0.25s; }
    .reg-submit:hover:not(:disabled)::before { opacity: 1; }
    .reg-submit:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 28px rgba(99,102,241,0.5); }
    .reg-submit:active:not(:disabled) { transform: translateY(0); }
    .reg-submit:disabled { opacity: 0.65; cursor: not-allowed; }

    .reg-spinner { width: 18px; height: 18px; border: 2px solid rgba(255,255,255,0.4); border-top-color: #fff; border-radius: 50%; animation: spin 0.7s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    .reg-login { margin-top: 1rem; text-align: center; font-size: 0.85rem; }
    .reg-login a { font-weight: 600; margin-left: 0.25rem; transition: color 0.2s; }

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
        {/* Left panel — identical to login page to avoid layout shift on navigation */}
        <div className="reg-left">
          <Image src="/branding.png" alt="CentralPagamentos background" fill sizes="50vw" className="reg-left-bg" priority />
          <div className="reg-left-overlay" />
          <div className="reg-left-content">
            <div className="reg-brand">
              <Image src="/branding.png" alt="Logo" width={48} height={48} className="reg-brand-logo" />
              <span className="reg-brand-name">CentralPagamentos</span>
            </div>

            <div className="reg-left-tagline">
              <h2>Crie sua conta e comece a usar agora mesmo</h2>
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

        {/* Right panel */}
        <div className="reg-right">
          <div className="reg-form-wrapper">

            <div className="reg-mobile-brand">
              <Image src="/branding.png" alt="Logo" width={40} height={40} className="reg-mobile-logo" />
              <span className="reg-mobile-name" style={{ fontFamily: 'Outfit, sans-serif', fontSize: '1.4rem', fontWeight: 700 }}>CentralPagamentos</span>
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
                  <input id="conta" type="text" className="reg-input" value={conta} onChange={e => setConta(e.target.value)} placeholder="ex: seunome" required autoComplete="username" />
                </div>
              </div>

              {/* Email */}
              <div className="reg-field">
                <label htmlFor="email" >E-mail</label>
                <div className="reg-input-wrap">
                  <Mail size={16} className="reg-input-icon" />
                  <input id="email" type="email" className="reg-input" value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com" required autoComplete="email" />
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
