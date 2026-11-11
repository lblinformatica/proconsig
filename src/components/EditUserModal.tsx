import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Edit2, X } from 'lucide-react';
import { adminUpdateUser } from '@/app/actions/admin';
import { supabase } from '@/lib/supabaseClient';

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
  const [nivel, setNivel] = useState('');
  const [vendedorVinculado, setVendedorVinculado] = useState('');
  const [vendedores, setVendedores] = useState<{ codigo: string; nome: string }[]>([]);
  const [grupos, setGrupos] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const loadVendedores = async () => {
      const { data } = await supabase
        .schema('pro_consig')
        .from('vendedores')
        .select('codigo, nome')
        .eq('ativo', true)
        .order('codigo', { ascending: true });
      if (data) setVendedores(data);
    };
    loadVendedores();
  }, [isOpen]);

  useEffect(() => {
    if (user) {
      setNome(user.nome);
      setConta(user.conta || '');
      setEmail(user.email);
      setNivel(user.nivel || 'operacional');
      setVendedorVinculado(user.vendedor_vinculado || '');
      setGrupos(user.grupos_permitidos ? user.grupos_permitidos.join(', ') : '');
    }
    setError('');
  }, [user, isOpen]);

  if (!isOpen || !mounted || !user) return null;

  const canLinkVendedor = nivel === 'vendedor' || nivel === 'operacional' || nivel === 'financeiro';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const gruposArray = grupos.split(',').map(g => g.trim()).filter(g => g !== '');
    const res = await adminUpdateUser(user.id, { 
      nome, 
      conta, 
      email, 
      nivel, 
      grupos_permitidos: gruposArray,
      vendedor_vinculado: canLinkVendedor ? (vendedorVinculado || null) : null
    });

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
      backdropFilter: 'blur(2px)',
      padding: '1rem'
    }}>
      <div className="card animate-fade-in" style={{ width: '100%', maxWidth: '520px', maxHeight: '92vh', overflowY: 'auto', padding: '1.25rem 1.5rem', backgroundColor: 'var(--color-bg-surface)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.6rem' }}>
          <h2 style={{ fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0, color: 'var(--color-text-main)' }}>
            <Edit2 size={18} color="var(--color-primary)" /> Editar Usuário
          </h2>
          <button type="button" onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        {error && (
          <div style={{ marginBottom: '0.75rem', padding: '0.6rem 0.75rem', backgroundColor: 'var(--color-danger-bg)', color: 'var(--color-danger)', borderRadius: 'var(--radius-sm)', fontSize: '0.825rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '0.75rem' }}>
            <label style={{ fontSize: '0.82rem' }}>Nome Completo</label>
            <input type="text" value={nome} onChange={e => setNome(e.target.value.toUpperCase())} style={{ fontSize: '0.85rem' }} required />
          </div>
          <div style={{ marginBottom: '0.75rem' }}>
            <label style={{ fontSize: '0.82rem' }}>Conta de Acesso (Username)</label>
            <input type="text" value={conta} onChange={e => setConta(e.target.value)} style={{ fontSize: '0.85rem' }} required />
            <div style={{ marginTop: '0.2rem', fontSize: '0.7rem', color: 'var(--color-warning)' }}>
              * Alterar a conta mudará instantaneamente a credencial de login deste usuário.
            </div>
          </div>
          <div style={{ marginBottom: '0.75rem' }}>
            <label style={{ fontSize: '0.82rem' }}>E-mail</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value.toUpperCase())} style={{ fontSize: '0.85rem' }} required />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', alignItems: 'end', marginBottom: '0.75rem' }}>
            <div>
              <label style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}>Nível de Acesso</label>
              <select
                value={nivel}
                onChange={e => {
                  const novoNivel = e.target.value;
                  setNivel(novoNivel);
                  if (novoNivel === 'admin') {
                    setVendedorVinculado('');
                  }
                }}
                style={{ fontSize: '0.85rem' }}
              >
                <option value="operacional">Operacional</option>
                <option value="admin">Administrador</option>
                <option value="financeiro">Financeiro</option>
                <option value="vendedor">Vendedor</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}>Grupos Permitidos (Financeiro)</label>
              <input 
                type="text" 
                value={grupos} 
                onChange={e => setGrupos(e.target.value)} 
                placeholder="Ex: 1, 2"
                disabled={nivel !== 'financeiro'}
                style={{ opacity: nivel === 'financeiro' ? 1 : 0.6, fontSize: '0.85rem' }}
              />
            </div>
          </div>
          <div style={{ marginBottom: '1.1rem' }}>
            <label style={{ fontSize: '0.82rem' }}>Vendedor Vinculado</label>
            <select
              value={canLinkVendedor ? vendedorVinculado : ''}
              onChange={e => setVendedorVinculado(e.target.value)}
              disabled={!canLinkVendedor}
              style={{ opacity: canLinkVendedor ? 1 : 0.6, cursor: canLinkVendedor ? 'pointer' : 'not-allowed', fontSize: '0.85rem' }}
            >
              <option value="">Nenhum vendedor vinculado</option>
              {vendedores.map(v => (
                <option key={v.codigo} value={v.codigo}>
                  {v.codigo} - {v.nome}
                </option>
              ))}
            </select>
            <div style={{ marginTop: '0.2rem', fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
              {canLinkVendedor
                ? 'Permite visualizar os dados deste vendedor na Produção e no Relatório de Vendedores.'
                : 'Disponível apenas para os níveis Vendedor, Operacional e Financeiro.'}
            </div>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid var(--color-border)' }}>
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
