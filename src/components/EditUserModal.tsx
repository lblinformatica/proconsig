import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Edit2, X } from 'lucide-react';
import { adminUpdateUser } from '@/app/actions/admin';

interface EditUserModalProps {
  isOpen: boolean;
  user: any;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditUserModal({ isOpen, user, onClose, onSuccess }: EditUserModalProps) {
  const [mounted, setMounted] = useState(false);
  const [nome, setNome] = useState('');
  const [conta, setConta] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (user) {
      setNome(user.nome);
      setConta(user.conta || '');
      setEmail(user.email);
    }
    setError('');
  }, [user, isOpen]);

  if (!isOpen || !mounted || !user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const res = await adminUpdateUser(user.id, { nome, conta, email });

    setLoading(false);
    if (res.error) {
      setError(res.error);
    } else {
      onSuccess();
      onClose();
    }
  };

  return createPortal(
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999,
      backdropFilter: 'blur(2px)'
    }}>
      <div className="card animate-fade-in" style={{ width: '100%', maxWidth: '400px', backgroundColor: 'var(--color-bg-surface)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.75rem' }}>
          <h2 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0, color: 'var(--color-text-main)' }}>
            <Edit2 size={20} color="var(--color-primary)" /> Editar Usuário
          </h2>
          <button type="button" onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {error && (
          <div style={{ marginBottom: '1rem', padding: '0.75rem', backgroundColor: 'var(--color-danger-bg)', color: 'var(--color-danger)', borderRadius: 'var(--radius-sm)', fontSize: '0.875rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '1rem' }}>
            <label>Nome Completo</label>
            <input type="text" value={nome} onChange={e => setNome(e.target.value)} required />
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label>Conta de Acesso (Username)</label>
            <input type="text" value={conta} onChange={e => setConta(e.target.value)} required />
            <div style={{ marginTop: '0.25rem', fontSize: '0.75rem', color: 'var(--color-warning)' }}>
              * Alterar a conta mudará instantaneamente a credencial de login deste usuário.
            </div>
          </div>
          <div style={{ marginBottom: '1.5rem' }}>
            <label>E-mail (Contato)</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
