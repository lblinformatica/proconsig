'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Mail, ArrowLeft, CheckCircle, CheckCircle2, ArrowRight } from 'lucide-react';
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
          border-color: #f97316 !important;
          background: rgba(249,115,22,0.1) !important;
          box-shadow: 0 0 0 3px rgba(249,115,22,0.2) !important;
        }
        .login-page.is-dark .login-input-icon { color: #475569; }
        .login-page.is-dark .login-input-wrap:focus-within .login-input-icon { color: #f97316; }
        .login-page.is-dark .login-right::before {
          background: radial-gradient(circle, rgba(249,115,22,0.22) 0%, transparent 70%);
        }
        .login-page.is-dark .login-right::after {
          background: radial-gradient(circle, rgba(234,88,12,0.15) 0%, transparent 70%);
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
          border-color: #ea580c !important;
          background: #fff !important;
          box-shadow: 0 0 0 3px rgba(234,88,12,0.15) !important;
        }
        .login-page.is-light .login-input-icon { color: #94a3b8; }
        .login-page.is-light .login-input-wrap:focus-within .login-input-icon { color: #ea580c; }
        .login-page.is-light .login-right::before {
          background: radial-gradient(circle, rgba(249,115,22,0.08) 0%, transparent 70%);
        }
        .login-page.is-light .login-right::after {
          background: radial-gradient(circle, rgba(234,88,12,0.06) 0%, transparent 70%);
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
          background: #f8fafc;
          border-right: 1px solid rgba(226, 232, 240, 0.8);
        }
        @media (min-width: 900px) {
          .login-left { display: block; }
        }
        .login-left-bg {
          position: absolute;
          inset: 0;
          object-fit: cover;
          object-position: center;
          width: 100%;
          height: 100%;
          filter: grayscale(100%);
          opacity: 0.20;
        }
        .login-left-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(
            135deg,
            rgba(248, 250, 252, 0.65) 0%,
            rgba(248, 250, 252, 0.30) 50%,
            rgba(248, 250, 252, 0.60) 100%
          );
          pointer-events: none;
        }
        .login-left-content {
          position: relative;
          z-index: 2;
          height: 100%;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          padding: 3.5rem 3.5rem;
          color: #0f172a;
        }
        .login-brand {
          display: flex;
          align-items: center;
          gap: 1.5rem;
          flex-wrap: wrap;
        }
        .login-brand-title {
          font-family: 'Outfit', sans-serif;
          font-size: 2.35rem;
          font-weight: 800;
          letter-spacing: -0.03em;
          line-height: 1;
          white-space: nowrap;
        }
        .login-brand-orange {
          color: #ea580c;
        }
        .login-brand-blue {
          color: #1e3a8a;
        }

        .login-left-tagline {
          min-height: 220px;
          display: flex;
          flex-direction: column;
          justify-content: flex-start;
        }
        .login-left-tagline h2 {
          font-family: 'Outfit', sans-serif;
          font-size: 2.35rem;
          font-weight: 600;
          line-height: 1.25;
          color: #1e293b;
          letter-spacing: -0.02em;
          margin-bottom: 2.95rem;
        }
        .login-left-tagline p {
          font-size: 1.05rem;
          color: #475569;
          line-height: 1.7;
          max-width: 480px;
        }

        .login-left-pills {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
        }
        .login-pill {
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
          background: radial-gradient(circle, rgba(249,115,22,0.22) 0%, transparent 70%);
          pointer-events: none;
          animation: blobFloat 8s ease-in-out infinite alternate;
        }
        .login-right::after {
          content: '';
          position: absolute;
          bottom: -100px; left: -60px;
          width: 280px; height: 280px;
          border-radius: 50%;
          background: radial-gradient(circle, rgba(234,88,12,0.15) 0%, transparent 70%);
          pointer-events: none;
          animation: blobFloat 10s ease-in-out infinite alternate-reverse;
        }
        @keyframes blobFloat {
          from { transform: translateY(0) scale(1); }
          to   { transform: translateY(30px) scale(1.08); }
        }

        .login-mobile-brand {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 2.5rem;
        }
        @media (min-width: 900px) {
          .login-mobile-brand { display: none; }
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
          background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
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
          box-shadow: 0 4px 20px rgba(234,88,12,0.35);
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
          <Image src="/fundo_ovale_calculadora.jpg" alt="Fundo Grupo Ovale" fill sizes="50vw" className="login-left-bg" priority />
          <div className="login-left-overlay" />
          <div className="login-left-content">
            <div className="login-brand">
              <Image
                src="/logotipo_ovale_transparente.png"
                alt="Grupo Ovale"
                width={300}
                height={20}
                style={{ height: '150px', width: 'auto', objectFit: 'contain' }}
                priority
              />
              <span className="login-brand-title">
                <span className="login-brand-orange">Central</span>
                <span className="login-brand-blue">Pagamentos</span>
              </span>
            </div>
            <div className="login-left-tagline">
              <h2>Recuperação de Acesso</h2>
              <p>
                Não se preocupe! Acontece com os melhores. Siga os passos para redefinir sua senha com segurança.
              </p>
            </div>

            <div style={{ height: '38px', minHeight: '38px' }} aria-hidden="true" />
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
                {/* Mobile brand */}
                <div className="login-mobile-brand">
                  <div style={{ background: '#fff', padding: '0.35rem 0.65rem', borderRadius: '10px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)', display: 'inline-flex' }}>
                    <Image src="/ovale_icon.png" alt="Grupo Ovale" width={32} height={32} style={{ height: '32px', width: 'auto' }} />
                  </div>
                  <div>
                    <span className="login-mobile-name" style={{ display: 'block', fontSize: '1.25rem', lineHeight: 1.1 }}>Central de Pagamentos</span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>Grupo Ovale</span>
                  </div>
                </div>

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
                        onChange={e => setEmail(e.target.value.toLowerCase())}
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
