'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { Plus, Search, Edit2, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { ConfirmModal } from '@/components/ConfirmModal';

const PAGE_SIZE = 50;

export default function BorderosPage() {
  const [borderos, setBorderos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingProfile, setFetchingProfile] = useState(true);
  const [busca, setBusca] = useState('');
  const [nivel, setNivel] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: profile } = await supabase.from('usuarios').select('nivel, id').eq('supabase_user_id', session.user.id).single();
      if (profile) { setNivel(profile.nivel); setUserId(profile.id); }
      setFetchingProfile(false);
    };
    init();
  }, []);

  const fetchBorderos = useCallback(async (searchOverride?: string) => {
    setLoading(true);
    const search = searchOverride !== undefined ? searchOverride : busca;
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const isOperacional = nivel === 'operacional';

    let query = supabase
      .from('borderos')
      .select('id, bordero_id, cpf, operacao, valor, status, created_at, empresa, clientes(nome), usuarios!created_by(nome)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (isOperacional && userId) query = query.eq('created_by', userId);
    if (search) query = query.or(`cpf.ilike.%${search}%,operacao.ilike.%${search}%,status.ilike.%${search}%`);

    const { data, count } = await query;
    if (data) setBorderos(data as any[]);
    if (count !== null) setTotal(count);
    setLoading(false);
  }, [page, busca, nivel, userId]);

  useEffect(() => {
    if (!fetchingProfile && nivel) {
      fetchBorderos();
    }
  }, [page, nivel, userId, fetchingProfile]);

  const handleSearch = () => { setPage(0); fetchBorderos(busca); };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    const { error } = await supabase.from('borderos').delete().eq('id', deleteId);
    setDeleting(false);
    if (error) {
      alert('Erro ao excluir borderô: ' + error.message);
    } else {
      setDeleteId(null);
      fetchBorderos();
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ margin: '0 0 1rem 0' }}>Borderôs</h1>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <div style={{ position: 'relative', minWidth: '320px' }}>
              <Search size={18} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
              <input
                type="text"
                placeholder="Buscar por CPF, operação, status..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                style={{ paddingLeft: '2.5rem', width: '100%' }}
              />
            </div>
            <button className="btn btn-secondary" onClick={handleSearch}>Buscar</button>
          </div>
        </div>

        <Link href="/borderos/novo" className="btn btn-primary" style={{ whiteSpace: 'nowrap', marginTop: '0.5rem' }}>
          <Plus size={18} /> Novo Borderô
        </Link>
      </div>

      <div className="card" style={{ opacity: loading ? 0.6 : 1, transition: 'opacity 0.2s' }}>
        {fetchingProfile ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>Identificando usuário...</div>
        ) : loading && borderos.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>Buscando borderôs...</div>
        ) : borderos.length === 0 && !loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>
            Nenhum borderô encontrado.
          </div>
        ) : (
          <>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>ID Borderô</th>
                    <th>Cliente (CPF)</th>
                    <th>Operação</th>
                    <th>Valor</th>
                    <th>Status</th>
                    <th>Usuário</th>
                    <th>Data</th>
                    <th style={{ textAlign: 'right' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {borderos.map((bordero) => (
                    <tr key={bordero.id}>
                      <td>
                        <div style={{ fontWeight: 600, fontFamily: 'monospace', fontSize: '0.85rem', color: 'var(--color-primary)', whiteSpace: 'nowrap' }}>
                          {bordero.bordero_id || bordero.id.substring(0, 8).toUpperCase()}
                        </div>
                        {bordero.empresa && <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bordero.empresa}</div>}
                      </td>
                      <td>
                        <div>{bordero.clientes?.nome || 'N/A'}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontFamily: 'monospace' }}>{bordero.cpf}</div>
                      </td>
                      <td>{bordero.operacao || '-'}</td>
                      <td style={{ fontWeight: 500 }}>
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(bordero.valor || 0)}
                      </td>
                      <td>
                        <span className={`badge ${bordero.status?.toLowerCase() === 'aprovado' ? 'badge-success' : bordero.status?.toLowerCase() === 'rejeitado' ? 'badge-danger' : 'badge-warning'}`}>
                          {bordero.status || 'Pendente'}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                        {bordero.usuarios?.nome || '-'}
                      </td>
                      <td style={{ whiteSpace: 'nowrap', fontSize: '0.85rem' }}>
                        {new Date(bordero.created_at).toLocaleDateString('pt-BR')}
                      </td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                          <Link 
                            href={`/borderos/${bordero.id}/editar`} 
                            className="btn btn-secondary" 
                            style={{ padding: '0.4rem', border: 'none', background: 'transparent', color: 'var(--color-primary)' }}
                            title="Editar Borderô"
                          >
                            <Edit2 size={16} />
                          </Link>
                          {nivel === 'admin' && (
                            <button 
                              onClick={() => setDeleteId(bordero.id)}
                              className="btn btn-danger" 
                              style={{ padding: '0.4rem', border: 'none', background: 'transparent', color: 'var(--color-danger)' }}
                              title="Excluir Borderô"
                            >
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)' }}>
                <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                  {total} borderô(s) — Página {page + 1} de {totalPages}
                  {nivel === 'operacional' ? ' (seus lançamentos)' : ''}
                </span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn btn-secondary" style={{ padding: '0.375rem 0.75rem' }} disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                    <ChevronLeft size={16} />
                  </button>
                  <button className="btn btn-secondary" style={{ padding: '0.375rem 0.75rem' }} disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
      <ConfirmModal
        isOpen={!!deleteId}
        title="Excluir Borderô"
        message="Tem certeza que deseja excluir permanentemente este borderô? Esta ação não poderá ser desfeita."
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
        confirmText={deleting ? 'Excluindo...' : 'Excluir'}
      />
    </div>
  );
}
