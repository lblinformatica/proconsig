'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Mail, ArrowLeft, CheckCircle, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';

export default function RecuperarSenha() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('theme');
    setIsDark(saved === 'dark' || saved === null);
  }, []);

  const handleRecover = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const resp = await fetch('/api/auth/recuperar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.toLowerCase() }),
      });

      if (!resp.ok) {
        const data = await resp.json();
        throw new Error(data.error || 'Erro ao processar solicitação.');
      }

      setSubmitted(true);
    } catch (err: any) {
      setError(err.message);
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
          border-radius: 99px;
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

        .login-heading {
          font-family: 'Outfit', sans-serif;
          font-size: 2rem;
          font-weight: 700;
          letter-spacing: -0.02em;
          margin-bottom: 0.5rem;
        }
        .login-subheading {
          font-size: 0.95rem;
          margin-bottom: 2.25rem;
          color: #64748b;
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
          z-index: 1;
          display: flex;
          align-items: center;
        }
        .login-input {
          width: 100% !important;
          padding: 0.875rem 1rem 0.875rem 2.75rem !important;
          border-radius: 0.625rem !important;
          font-size: 0.95rem !important;
          outline: none !important;
          transition: all 0.2s !important;
        }
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
          box-shadow: 0 4px 20px rgba(99,102,241,0.35);
        }
        .login-error {
          background: rgba(239,68,68,0.12);
          border: 1px solid rgba(239,68,68,0.35);
          color: #fca5a5;
          padding: 0.75rem 1rem;
          border-radius: 0.625rem;
          font-size: 0.875rem;
          margin-bottom: 1.5rem;
        }
      `}</style>

      <div className={`login-page ${isDark ? 'is-dark' : 'is-light'}`}>
        <div className="login-left">
          <Image src="/branding.png" alt="Background" fill className="login-left-bg" priority />
          <div className="login-left-overlay" />
          <div className="login-left-content">
            <div className="login-brand">
              <Image src="/branding.png" alt="Logo" width={48} height={48} className="login-brand-logo" />
              <span className="login-brand-name">CentralPagamentos</span>
            </div>
            <div className="login-left-tagline">
              <h2>Recuperação de Acesso</h2>
              <p>
                Não se preocupe! Acontece com os melhores. Siga os passos para redefinir sua senha com segurança.
              </p>
            </div>
            <div className="login-left-pills">
              <span className="login-pill">Segurança</span>
              <span className="login-pill">Privacidade</span>
              <span className="login-pill">Criptografia</span>
            </div>
          </div>
        </div>

        <div className="login-right">
          <div className="login-form-wrapper">
            {submitted ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ background: 'rgba(34,197,94,0.1)', color: '#22c55e', width: '64px', height: '64px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                  <CheckCircle size={32} />
                </div>
                <h1 className="login-heading">E-mail Enviado!</h1>
                <p className="login-subheading" style={{ marginBottom: '2rem' }}>
                  Se o endereço <strong>{email}</strong> estiver em nossa base, você receberá um link em instantes.
                </p>
                <Link href="/login" className="login-submit">
                  Voltar para o Login
                </Link>
              </div>
            ) : (
              <>
                <h1 className="login-heading">Esqueceu a senha?</h1>
                <p className="login-subheading">Informe seu e-mail para receber as instruções de redefinição.</p>

                {error && <div className="login-error">{error}</div>}

                <form onSubmit={handleRecover}>
                  <div style={{ marginBottom: '1.25rem' }}>
                    <label className="login-label" style={{ display: 'block', marginBottom: '0.5rem' }}>E-mail de Cadastro</label>
                    <div className="login-input-wrap">
                      <Mail size={17} className="login-input-icon" />
                      <input
                        type="email"
                        className="login-input"
                        placeholder="seu@email.com"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        required
                        autoFocus
                      />
                    </div>
                  </div>

                  <button type="submit" className="login-submit" disabled={loading}>
                    {loading ? 'Enviando...' : (<>Enviar Link <ArrowRight size={18} /></>)}
                  </button>
                </form>

                <div style={{ marginTop: '2rem', textAlign: 'center' }}>
                  <Link href="/login" style={{ color: '#818cf8', fontSize: '0.875rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                    <ArrowLeft size={16} /> Voltar para o Login
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
