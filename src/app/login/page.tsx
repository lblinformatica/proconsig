'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { ConfirmModal } from '@/components/ConfirmModal';
import { User, Lock, ArrowRight, Eye, EyeOff } from 'lucide-react';

export default function Login() {
  const router = useRouter();
  const [conta, setConta] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isDark, setIsDark] = useState(true); // default dark until localStorage is read

  useEffect(() => {
    const saved = localStorage.getItem('theme');
    setIsDark(saved === 'dark' || saved === null); // default to dark if never set
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const pseudoEmail = `${conta.toLowerCase()}@proconsig.system`;
      const { data, error: authError } = await supabase.auth.signInWithPassword({
        email: pseudoEmail,
        password,
      });

      if (authError) {
        setError('Usuário ou senha inválidos.');
        return;
      }

      if (data.user) {
        const { data: profile } = await supabase
          .from('usuarios')
          .select('status')
          .eq('supabase_user_id', data.user.id)
          .single();

        let isActive = profile?.status === 'ativo';

        if (!profile) {
          const resp = await fetch('/api/auth/me', {
            headers: { 'authorization': `Bearer ${data.session.access_token}` }
          });
          if (resp.ok) {
            const apiProfile = await resp.json();
            isActive = apiProfile.status === 'ativo';
          }
        }

        if (!isActive) {
          await supabase.auth.signOut();
          setShowPendingModal(true);
          setLoading(false);
          return;
        }

        router.push('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Erro inesperado ao fazer login.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        .login-page {
          min-height: 100vh;
          display: flex;
          font-family: 'Inter', sans-serif;
        }
        /* ─── DARK THEME ─── */
        .login-page.is-dark { background: #0f172a; }
        .login-page.is-dark .login-right {
          background: #0f172a;
        }
        .login-page.is-dark .login-heading { color: #f8fafc; }
        .login-page.is-dark .login-subheading { color: #64748b; }
        .login-page.is-dark .login-label { color: #94a3b8; }
        .login-page.is-dark .login-input {
          background: rgba(255,255,255,0.06) !important;
          border: 1px solid rgba(255,255,255,0.1) !important;
          color: #f8fafc !important;
        }
        .login-page.is-dark .login-input::placeholder { color: #475569 !important; }
        .login-page.is-dark .login-input:focus {
          border-color: #6366f1 !important;
          background: rgba(99,102,241,0.1) !important;
          box-shadow: 0 0 0 3px rgba(99,102,241,0.2) !important;
        }
        .login-page.is-dark .login-input-icon { color: #475569; }
        .login-page.is-dark .login-input-wrap:focus-within .login-input-icon { color: #818cf8; }
        .login-page.is-dark .login-toggle-pw { color: #475569; }
        .login-page.is-dark .login-toggle-pw:hover { color: #818cf8; }
        .login-page.is-dark .login-register { color: #475569; }
        .login-page.is-dark .login-register a { color: #818cf8; }
        .login-page.is-dark .login-register a:hover { color: #a5b4fc; }
        .login-page.is-dark .login-forgot { color: #6366f1; }
        .login-page.is-dark .login-divider { color: #334155; }
        .login-page.is-dark .login-divider::before,
        .login-page.is-dark .login-divider::after { background: rgba(255,255,255,0.07); }
        .login-page.is-dark .login-right::before {
          background: radial-gradient(circle, rgba(99,102,241,0.25) 0%, transparent 70%);
        }
        .login-page.is-dark .login-right::after {
          background: radial-gradient(circle, rgba(14,165,233,0.18) 0%, transparent 70%);
        }
        .login-page.is-dark .login-mobile-name { color: #fff; }

        /* ─── LIGHT THEME ─── */
        .login-page.is-light { background: #f1f5f9; }
        .login-page.is-light .login-right {
          background: #ffffff;
          box-shadow: -4px 0 24px rgba(0,0,0,0.06);
        }
        .login-page.is-light .login-heading { color: #0f172a; }
        .login-page.is-light .login-subheading { color: #64748b; }
        .login-page.is-light .login-label { color: #475569; }
        .login-page.is-light .login-input {
          background: #f8fafc !important;
          border: 1px solid #e2e8f0 !important;
          color: #0f172a !important;
        }
        .login-page.is-light .login-input::placeholder { color: #94a3b8 !important; }
        .login-page.is-light .login-input:focus {
          border-color: #6366f1 !important;
          background: #fff !important;
          box-shadow: 0 0 0 3px rgba(99,102,241,0.15) !important;
        }
        .login-page.is-light .login-input-icon { color: #94a3b8; }
        .login-page.is-light .login-input-wrap:focus-within .login-input-icon { color: #6366f1; }
        .login-page.is-light .login-toggle-pw { color: #94a3b8; }
        .login-page.is-light .login-toggle-pw:hover { color: #6366f1; }
        .login-page.is-light .login-register { color: #475569; }
        .login-page.is-light .login-register a { color: #4f46e5; }
        .login-page.is-light .login-register a:hover { color: #4338ca; }
        .login-page.is-light .login-forgot { color: #4f46e5; }
        .login-page.is-light .login-divider { color: #cbd5e1; }
        .login-page.is-light .login-divider::before,
        .login-page.is-light .login-divider::after { background: #e2e8f0; }
        .login-page.is-light .login-right::before {
          background: radial-gradient(circle, rgba(99,102,241,0.1) 0%, transparent 70%);
        }
        .login-page.is-light .login-right::after {
          background: radial-gradient(circle, rgba(14,165,233,0.08) 0%, transparent 70%);
        }
        .login-page.is-light .login-mobile-name { color: #0f172a; }
        .login-page.is-light .login-error {
          background: rgba(239,68,68,0.08);
          border: 1px solid rgba(239,68,68,0.25);
          color: #b91c1c;
        }

        /* ── LEFT PANEL ── */
        .login-left {
          flex: 0 0 50%;
          position: relative;
          display: none;
          overflow: hidden;
        }
        @media (min-width: 900px) {
          .login-left { display: block; }
        }
        .login-left-bg {
          position: absolute;
          inset: 0;
          object-fit: cover;
          width: 100%;
          height: 100%;
          filter: brightness(0.45) saturate(1.2);
        }
        .login-left-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            135deg,
            rgba(79,70,229,0.55) 0%,
            rgba(15,23,42,0.7) 100%
          );
        }
        .login-left-content {
          position: relative;
          z-index: 2;
          height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 3rem;
          color: #fff;
        }
        .login-brand {
          display: flex;
          align-items: center;
          gap: 0.875rem;
        }
        .login-brand-logo {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          object-fit: cover;
          box-shadow: 0 4px 20px rgba(0,0,0,0.4);
        }
        .login-brand-name {
          font-family: 'Outfit', sans-serif;
          font-size: 1.75rem;
          font-weight: 700;
          letter-spacing: -0.02em;
          color: #fff;
        }
        .login-left-tagline {
          margin-bottom: 4rem;
        }
        .login-left-tagline h2 {
          font-family: 'Outfit', sans-serif;
          font-size: 2.5rem;
          font-weight: 700;
          line-height: 1.2;
          color: #fff;
          margin-bottom: 1rem;
        }
        .login-left-tagline p {
          font-size: 1.05rem;
          color: rgba(255,255,255,0.75);
          line-height: 1.7;
          max-width: 380px;
        }
        .login-left-pills {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
        }
        .login-pill {
          background: rgba(255,255,255,0.12);
          border: 1px solid rgba(255,255,255,0.2);
          backdrop-filter: blur(8px);
          color: #fff;
          padding: 0.4rem 1rem;
          border-radius: 9999px;
          font-size: 0.8rem;
          font-weight: 500;
        }

        /* ── RIGHT PANEL ── */
        .login-right {
          flex: 0 0 50%;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 3rem 2rem;
          background: #0f172a;
          position: relative;
          overflow: hidden;
        }
        @media (max-width: 899px) {
          .login-right { flex: 0 0 100%; }
        }
        @media (min-width: 900px) {
          .login-right { padding: 3rem; }
        }

        /* animated glow blobs */
        .login-right::before {
          content: '';
          position: absolute;
          top: -120px; right: -80px;
          width: 340px; height: 340px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(99,102,241,0.25) 0%, transparent 70%);
          pointer-events: none;
          animation: blobFloat 8s ease-in-out infinite alternate;
        }
        .login-right::after {
          content: '';
          position: absolute;
          bottom: -100px; left: -60px;
          width: 280px; height: 280px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(14,165,233,0.18) 0%, transparent 70%);
          pointer-events: none;
          animation: blobFloat 10s ease-in-out infinite alternate-reverse;
        }
        @keyframes blobFloat {
          from { transform: translateY(0) scale(1); }
          to   { transform: translateY(30px) scale(1.08); }
        }

        .login-form-wrapper {
          position: relative;
          z-index: 2;
          width: 100%;
          max-width: 420px;
          margin: 0 auto;
        }

        /* mobile brand */
        .login-mobile-brand {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 2.5rem;
        }
        @media (min-width: 900px) {
          .login-mobile-brand { display: none; }
        }
        .login-mobile-logo {
          width: 40px; height: 40px;
          border-radius: 10px;
          object-fit: cover;
        }
        .login-mobile-name {
          font-family: 'Outfit', sans-serif;
          font-size: 1.5rem;
          font-weight: 700;
          color: #fff;
        }

        .login-heading {
          font-family: 'Outfit', sans-serif;
          font-size: 2rem;
          font-weight: 700;
          color: #f8fafc;
          letter-spacing: -0.02em;
          margin-bottom: 0.5rem;
        }
        .login-subheading {
          color: #64748b;
          font-size: 0.95rem;
          margin-bottom: 2.25rem;
        }

        .login-error {
          background: rgba(239,68,68,0.12);
          border: 1px solid rgba(239,68,68,0.35);
          color: #fca5a5;
          padding: 0.75rem 1rem;
          border-radius: 0.625rem;
          font-size: 0.875rem;
          margin-bottom: 1.5rem;
          animation: fadeIn 0.3s ease;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .login-field {
          margin-bottom: 1.25rem;
        }
        .login-label {
          display: block;
          font-size: 0.8rem;
          font-weight: 600;
          color: #94a3b8;
          text-transform: uppercase;
          letter-spacing: 0.07em;
          margin-bottom: 0.5rem;
        }
        .login-input-wrap {
          position: relative;
          display: flex;
          align-items: center;
        }
        .login-input-icon {
          position: absolute;
          left: 0.875rem;
          top: 50%;
          transform: translateY(-50%);
          color: #475569;
          pointer-events: none;
          transition: color 0.2s;
          z-index: 1;
          display: flex;
          align-items: center;
        }
        .login-input {
          width: 100% !important;
          padding: 0.875rem 1rem 0.875rem 2.75rem !important;
          background: rgba(255,255,255,0.06) !important;
          border: 1px solid rgba(255,255,255,0.1) !important;
          border-radius: 0.625rem !important;
          color: #f8fafc !important;
          font-size: 0.95rem !important;
          transition: border-color 0.2s, background 0.2s, box-shadow 0.2s !important;
          outline: none !important;
          box-shadow: none !important;
        }
        .login-input::placeholder { color: #475569 !important; }
        .login-input:focus {
          border-color: #6366f1 !important;
          background: rgba(99,102,241,0.1) !important;
          box-shadow: 0 0 0 3px rgba(99,102,241,0.2) !important;
        }
        /* hide browser credential/autofill icons that can overlap */
        .login-input::-webkit-credentials-auto-fill-button,
        .login-input::-webkit-contacts-auto-fill-button { visibility: hidden; }
        .login-input-wrap:focus-within .login-input-icon {
          color: #818cf8;
        }
        .login-toggle-pw {
          position: absolute;
          right: 1rem;
          background: transparent;
          border: none;
          cursor: pointer;
          color: #475569;
          display: flex;
          align-items: center;
          padding: 0;
          transition: color 0.2s;
        }
        .login-toggle-pw:hover { color: #818cf8; }

        .login-forgot {
          display: block;
          text-align: right;
          margin-top: 0.5rem;
          font-size: 0.8rem;
          color: #6366f1;
          font-weight: 500;
          transition: color 0.2s;
        }
        .login-forgot:hover { color: #818cf8; }

        .login-submit {
          width: 100%;
          margin-top: 1.75rem;
          padding: 0.95rem;
          background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
          color: #fff;
          border: none;
          border-radius: 0.625rem;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.625rem;
          transition: all 0.25s ease;
          box-shadow: 0 4px 20px rgba(99,102,241,0.35);
          letter-spacing: 0.01em;
          position: relative;
          overflow: hidden;
        }
        .login-submit::before {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(135deg, rgba(255,255,255,0.15) 0%, transparent 100%);
          opacity: 0;
          transition: opacity 0.25s;
        }
        .login-submit:hover:not(:disabled)::before { opacity: 1; }
        .login-submit:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 8px 28px rgba(99,102,241,0.5);
        }
        .login-submit:active:not(:disabled) { transform: translateY(0); }
        .login-submit:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        .login-spinner {
          width: 18px; height: 18px;
          border: 2px solid rgba(255,255,255,0.4);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .login-register {
          margin-top: 2rem;
          text-align: center;
          font-size: 0.875rem;
          color: #475569;
        }
        .login-register a {
          color: #818cf8;
          font-weight: 600;
          margin-left: 0.25rem;
          transition: color 0.2s;
        }
        .login-register a:hover { color: #a5b4fc; }

        .login-divider {
          display: flex;
          align-items: center;
          gap: 1rem;
          margin: 1.75rem 0;
          color: #334155;
          font-size: 0.75rem;
        }
        .login-divider::before, .login-divider::after {
          content: '';
          flex: 1;
          height: 1px;
          background: rgba(255,255,255,0.07);
        }
      `}</style>

      <ConfirmModal
        isOpen={showPendingModal}
        title="Conta Pendente"
        message="Sua conta ainda não foi aprovada pelo administrador. Aguarde o contato da equipe."
        onConfirm={() => setShowPendingModal(false)}
        confirmText="Entendi"
        confirmType="primary"
      />

      <div className={`login-page ${isDark ? 'is-dark' : 'is-light'}`}>
        {/* ── Left panel ── */}
        <div className="login-left">
          <Image
            src="/branding.png"
            alt="ProConsig background"
            fill
            sizes="50vw"
            className="login-left-bg"
            priority
          />
          <div className="login-left-overlay" />
          <div className="login-left-content">
            <div className="login-brand">
              <Image src="/branding.png" alt="Logo" width={48} height={48} className="login-brand-logo" />
              <span className="login-brand-name">ProConsig</span>
            </div>

            <div className="login-left-tagline">
              <h2>Gestão de Borderôs com eficiência e segurança</h2>
              <p>
                Plataforma completa para gerenciamento de clientes, borderôs e solicitações, com controle total de acesso e auditoria.
              </p>
            </div>

            <div className="login-left-pills">
              <span className="login-pill">Borderôs</span>
              <span className="login-pill">Clientes</span>
              <span className="login-pill">Relatórios</span>
              <span className="login-pill">Controle de Acesso</span>
            </div>
          </div>
        </div>

        {/* ── Right panel ── */}
        <div className="login-right">
          <div className="login-form-wrapper">

            {/* Mobile brand */}
            <div className="login-mobile-brand">
              <Image src="/branding.png" alt="Logo" width={40} height={40} className="login-mobile-logo" />
              <span className="login-mobile-name">ProConsig</span>
            </div>

            <h1 className="login-heading">Bem-vindo de volta</h1>
            <p className="login-subheading">Entre com suas credenciais para acessar o painel</p>

            {error && (
              <div className="login-error" role="alert">{error}</div>
            )}

            <form onSubmit={handleLogin} noValidate>
              {/* Conta */}
              <div className="login-field">
                <label htmlFor="conta">Nome de Usuário</label>
                <div className="login-input-wrap">
                  <User size={17} className="login-input-icon" />
                  <input
                    id="conta"
                    type="text"
                    className="login-input"
                    value={conta}
                    onChange={(e) => setConta(e.target.value)}
                    placeholder="ex: seunome"
                    required
                    autoComplete="username"
                    autoFocus
                  />
                </div>
              </div>

              {/* Senha */}
              <div className="login-field">
                <label htmlFor="password">Senha</label>
                <div className="login-input-wrap">
                  <Lock size={17} className="login-input-icon" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    className="login-input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="login-toggle-pw"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </div>
                <Link href="/recuperar" className="login-forgot">Esqueceu a senha?</Link>
              </div>

              <button type="submit" className="login-submit" disabled={loading}>
                {loading ? (
                  <><div className="login-spinner" /> Entrando...</>
                ) : (
                  <>Entrar <ArrowRight size={18} /></>
                )}
              </button>
            </form>

            <div className="login-divider">ou</div>

            <div className="login-register">
              Não tem uma conta?
              <Link href="/cadastro">Criar conta</Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
