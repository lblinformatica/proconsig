'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Edit2, Trash2, Search, Plus, ChevronLeft, ChevronRight, Filter, User } from 'lucide-react';
import Link from 'next/link';
import { ConfirmModal } from '@/components/ConfirmModal';

const PAGE_SIZE = 50;

export default function VendedoresList() {
  const [vendedores, setVendedores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [nivel, setNivel] = useState('');

  const [notification, setNotification] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'success' | 'danger' | 'primary';
    confirmText?: string;
    onConfirm?: () => void;
    onCancel?: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'primary'
  });

  const showAlert = (title: string, message: string, type: 'success' | 'danger' | 'primary' = 'primary') => {
    setNotification({
      isOpen: true,
      title,
      message,
      type,
      onConfirm: () => setNotification(prev => ({ ...prev, isOpen: false }))
    });
  };

  const showConfirm = (title: string, message: string, onConfirm: () => void, type: 'danger' | 'primary' = 'primary') => {
    setNotification({
      isOpen: true,
      title,
      message,
      type,
      onConfirm: () => {
        onConfirm();
        setNotification(prev => ({ ...prev, isOpen: false }));
      },
      onCancel: () => setNotification(prev => ({ ...prev, isOpen: false }))
    });
  };

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: profile } = await supabase.from('usuarios').select('nivel').eq('supabase_user_id', session.user.id).single();
        if (profile) setNivel(profile.nivel);
      }
    };
    fetchProfile();
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(0);
  };

  const fetchVendedores = useCallback(async () => {
    setLoading(true);
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .schema('pro_consig')
      .from('vendedores')
      .select('*', { count: 'exact' })
      .order('codigo', { ascending: true })
      .range(from, to);

    if (search) {
      query = query.or(`nome.ilike.%${search}%,codigo.ilike.%${search}%`);
    }

    const { data, count, error } = await query;
    if (error) {
      console.error('Erro ao buscar vendedores:', error);
      showAlert('Erro', 'Não foi possível carregar os vendedores.', 'danger');
    } else {
      if (data) setVendedores(data);
      if (count !== null) setTotal(count);
    }
    setLoading(false);
  }, [page, search]);

  useEffect(() => {
    fetchVendedores();
  }, [page, search, fetchVendedores]);

  const handleDelete = async (id: string) => {
    const seller = vendedores.find(v => v.id === id);
    if (!seller) return;

    setLoading(true);
    // Check if the seller has registered sales
    const { count, error: countError } = await supabase
      .schema('pro_consig')
      .from('vendas')
      .select('*', { count: 'exact', head: true })
      .or(`corretor.eq."${seller.codigo}",carteira.eq."${seller.codigo}"`);

    setLoading(false);

    if (countError) {
      console.error('Erro ao verificar vendas:', countError);
      showAlert('Erro', 'Não foi possível verificar as vendas do vendedor.', 'danger');
      return;
    }

    if (count && count > 0) {
      // Show warning modal suggesting deactivation
      setNotification({
        isOpen: true,
        title: 'Não é possível excluir',
        message: `Este vendedor possui ${count} venda(s) cadastrada(s) no sistema e não pode ser excluído por segurança dos dados. Recomendamos desativar o vendedor. Deseja desativá-lo agora?`,
        type: 'primary',
        confirmText: 'Desativar Vendedor',
        onConfirm: async () => {
          setLoading(true);
          const { error: updateError } = await supabase
            .schema('pro_consig')
            .from('vendedores')
            .update({ ativo: false })
            .eq('id', id);

          setLoading(false);
          setNotification(prev => ({ ...prev, isOpen: false }));

          if (updateError) {
            showAlert('Erro', 'Erro ao desativar vendedor: ' + updateError.message, 'danger');
          } else {
            fetchVendedores();
            showAlert('Sucesso', 'Vendedor desativado com sucesso!', 'success');
          }
        },
        onCancel: () => setNotification(prev => ({ ...prev, isOpen: false }))
      });
      return;
    }

    // Show normal delete modal
    setNotification({
      isOpen: true,
      title: 'Excluir Vendedor',
      message: 'Tem certeza que deseja excluir este vendedor? Esta ação não pode ser desfeita.',
      type: 'danger',
      confirmText: 'Sim, Confirmar',
      onConfirm: async () => {
        setLoading(true);
        const { error } = await supabase
          .schema('pro_consig')
          .from('vendedores')
          .delete()
          .eq('id', id);

        setLoading(false);
        setNotification(prev => ({ ...prev, isOpen: false }));

        if (error) {
          showAlert('Erro', 'Erro ao excluir vendedor: ' + error.message, 'danger');
        } else {
          fetchVendedores();
          showAlert('Sucesso', 'Vendedor excluído com sucesso!', 'success');
        }
      },
      onCancel: () => setNotification(prev => ({ ...prev, isOpen: false }))
    });
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <>
      <ConfirmModal
        isOpen={notification.isOpen}
        title={notification.title}
        message={notification.message}
        confirmType={notification.type}
        onConfirm={notification.onConfirm || (() => { })}
        onCancel={notification.onCancel}
        confirmText={notification.confirmText || (notification.onCancel ? 'Sim, Confirmar' : 'Entendi')}
      />

      <div className="animate-fade-in">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ margin: 0 }}>Vendedores</h1>
            <p style={{ color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>Gerencie o cadastro de vendedores do sistema.</p>
          </div>
          <Link href="/vendedores/novo" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Plus size={18} /> Novo Vendedor
          </Link>
        </div>

        <div className="card" style={{ marginBottom: '2rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
            <input type="text" placeholder="Buscar por Código ou Nome..." value={search} onChange={handleSearchChange} style={{ paddingLeft: '2.75rem', width: '100%' }} />
          </div>
          <button className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={() => fetchVendedores()}>
            <Filter size={18} /> Filtrar
          </button>
        </div>

        <div className="card">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '4rem' }}>Carregando vendedores...</div>
          ) : vendedores.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--color-text-muted)' }}>Nenhum vendedor encontrado.</div>
          ) : (
            <>
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Código</th>
                      <th>Nome</th>
                      <th>Formatado (Código - Nome)</th>
                      <th>Meta Mensal</th>
                      <th>Meta Diária</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vendedores.map((v) => (
                      <tr key={v.id}>
                        <td style={{ fontWeight: 600 }}>{v.codigo}</td>
                        <td style={{ fontWeight: 500 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--color-bg-body)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)' }}>
                              <User size={16} />
                            </div>
                            {v.nome}
                          </div>
                        </td>
                        <td style={{ fontFamily: 'monospace', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                          {`${v.codigo} - ${v.nome}`}
                        </td>
                        <td style={{ fontWeight: 600 }}>
                           {v.meta ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v.meta) : 'R$ 0,00'}
                        </td>
                        <td style={{ fontWeight: 600 }}>
                           {v.meta_diaria ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v.meta_diaria) : 'R$ 0,00'}
                        </td>
                        <td>
                          <span className={`badge ${v.ativo ? 'badge-success' : 'badge-danger'}`} style={{
                            padding: '0.25rem 0.5rem',
                            borderRadius: '4px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            backgroundColor: v.ativo ? 'rgba(40, 199, 111, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                            color: v.ativo ? 'var(--color-success)' : 'var(--color-danger)'
                          }}>
                            {v.ativo ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                            <Link href={`/vendedores/${v.id}/editar`} className="btn btn-secondary" style={{ padding: '0.4rem' }} title="Editar">
                              <Edit2 size={16} />
                            </Link>
                            {nivel === 'admin' && (
                              <button className="btn btn-danger" style={{ padding: '0.4rem', background: 'transparent', color: 'var(--color-danger)', border: 'none' }} onClick={() => handleDelete(v.id)} title="Excluir">
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--color-border)' }}>
                  <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                    Total: {total} vendedores — Página {page + 1} de {totalPages}
                  </span>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-secondary" style={{ padding: '0.5rem' }} disabled={page === 0} onClick={() => setPage(p => p - 1)}><ChevronLeft size={18} /></button>
                    <button className="btn btn-secondary" style={{ padding: '0.5rem' }} disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}><ChevronRight size={18} /></button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
