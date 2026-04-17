'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { UserPlus, Search, Edit2, Trash2, ChevronLeft, ChevronRight } from 'lucide-react';
import { ConfirmModal } from '@/components/ConfirmModal';

const PAGE_SIZE = 50;

export default function ClientesPage() {
  const router = useRouter();
  const [clientes, setClientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [nivel, setNivel] = useState('');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [clientToDelete, setClientToDelete] = useState<{ id: string; nome: string } | null>(null);

  useEffect(() => {
    verifyAccess();
  }, []);

  useEffect(() => {
    fetchClientes();
  }, [page]);

  const verifyAccess = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data: profile } = await supabase
      .from('usuarios')
      .select('nivel')
      .eq('supabase_user_id', session.user.id)
      .single();
    if (profile) setNivel(profile.nivel);
  };

  const fetchClientes = useCallback(async (searchOverride?: string) => {
    setLoading(true);
    const search = searchOverride !== undefined ? searchOverride : busca;
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from('clientes')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (search) {
      query = query.or(`nome.ilike.%${search}%,cpf.ilike.%${search}%`);
    }

    const { data, count } = await query;
    if (data) setClientes(data);
    if (count !== null) setTotal(count);
    setLoading(false);
  }, [page, busca]);

  const handleSearch = () => {
    setPage(0);
    fetchClientes(busca);
  };

  const confirmDelete = (id: string, nome: string) => {
    setClientToDelete({ id, nome });
    setDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!clientToDelete) return;
    const { error } = await supabase.from('clientes').delete().eq('id', clientToDelete.id);
    if (error) {
      alert('Erro ao excluir: ' + error.message);
    } else {
      setClientes(clientes.filter(c => c.id !== clientToDelete.id));
      setTotal(t => t - 1);
    }
    setDeleteModalOpen(false);
    setClientToDelete(null);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ margin: '0 0 1rem 0' }}>Clientes</h1>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div style={{ position: 'relative', minWidth: '320px' }}>
              <Search size={18} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
              <input
                type="text"
                placeholder="Buscar por nome ou CPF..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                style={{ paddingLeft: '2.5rem', width: '100%' }}
              />
            </div>
            <button className="btn btn-secondary" onClick={handleSearch}>Buscar</button>
          </div>
        </div>

        {(nivel === 'admin' || nivel === 'operacional') && (
          <Link href="/clientes/novo" className="btn btn-primary" style={{ whiteSpace: 'nowrap', marginTop: '0.5rem' }}>
            <UserPlus size={18} /> Novo Cliente
          </Link>
        )}
      </div>

      <div className="card" style={{ opacity: loading ? 0.6 : 1, transition: 'opacity 0.2s' }}>
        {loading && clientes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>Buscando clientes...</div>
        ) : clientes.length === 0 && !loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>
            Nenhum cliente encontrado.
          </div>
        ) : (
          <>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>CPF</th>
                    <th>Nome</th>
                    <th>Banco (Débito)</th>
                    <th>Agência</th>
                    <th>Conta</th>
                    <th>Tipo</th>
                    <th>Crédito</th>
                    {nivel === 'admin' && <th style={{ textAlign: 'right' }}>Ações</th>}
                  </tr>
                </thead>
                <tbody>
                  {clientes.map((cliente) => (
                    <tr key={cliente.id}>
                      <td style={{ whiteSpace: 'nowrap', fontFamily: 'monospace' }}>{cliente.cpf}</td>
                      <td>{cliente.nome}</td>
                      <td>{cliente.banco || '-'}</td>
                      <td>{cliente.agencia || '-'}</td>
                      <td>{cliente.conta || '-'}</td>
                      <td style={{ textTransform: 'capitalize' }}>{cliente.tipo_conta || '-'}</td>
                      <td>
                        {cliente.forma_credito === 'pix' ? (
                          <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>PIX</span>
                        ) : cliente.forma_credito === 'conta' ? (
                          <span className="badge" style={{ fontSize: '0.7rem', background: 'var(--color-info)', color: '#fff' }}>Conta</span>
                        ) : (
                          <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>—</span>
                        )}
                      </td>
                      {nivel === 'admin' && (
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '0.25rem', marginRight: '0.5rem', border: 'none', background: 'transparent', color: 'var(--color-primary)' }}
                            onClick={() => router.push(`/clientes/${cliente.id}`)}
                            title="Editar"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            className="btn btn-danger"
                            style={{ padding: '0.25rem', border: 'none', background: 'transparent', color: 'var(--color-danger)' }}
                            onClick={() => confirmDelete(cliente.id, cliente.nome)}
                            title="Excluir"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginação */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)' }}>
                <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                  {total} cliente(s) — Página {page + 1} de {totalPages}
                </span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    className="btn btn-secondary"
                    style={{ padding: '0.375rem 0.75rem' }}
                    disabled={page === 0}
                    onClick={() => setPage(p => p - 1)}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    className="btn btn-secondary"
                    style={{ padding: '0.375rem 0.75rem' }}
                    disabled={page >= totalPages - 1}
                    onClick={() => setPage(p => p + 1)}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <ConfirmModal
        isOpen={deleteModalOpen}
        title="Excluir Cliente"
        message={<span>Tem certeza que deseja excluir o cliente <strong>{clientToDelete?.nome}</strong>?<br /><br />Esta ação é permanente e não poderá ser desfeita.</span>}
        onConfirm={handleDelete}
        onCancel={() => setDeleteModalOpen(false)}
      />
    </div>
  );
}
