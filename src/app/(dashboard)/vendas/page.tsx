'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Edit2, Trash2, Search, Plus, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import Link from 'next/link';
import { ConfirmModal } from '@/components/ConfirmModal';

const PAGE_SIZE = 50;

export default function VendasList() {
  const [vendas, setVendas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [nivel, setNivel] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [modalError, setModalError] = useState('');

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: profile } = await supabase.from('usuarios').select('nivel, id').eq('supabase_user_id', session.user.id).single();
      if (profile) { setNivel(profile.nivel); setUserId(profile.id); }
    };
    init();
  }, []);

  const fetchVendas = useCallback(async () => {
    setLoading(true);
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const isOperacional = nivel === 'operacional';

    let query = supabase
      .from('vendas')
      .select('*, usuarios!created_by(nome)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (search) {
      if (search.includes('.') || search.includes('-')) query = query.ilike('cpf', `%${search}%`);
      else query = query.or(`cpf.ilike.%${search}%,operacao.ilike.%${search}%`);
    }

    if (isOperacional && userId) query = query.eq('created_by', userId);

    const { data, count } = await query;
    if (data) setVendas(data);
    if (count !== null) setTotal(count);
    setLoading(false);
  }, [page, search, nivel, userId]);

  useEffect(() => {
    if (nivel !== '') fetchVendas();
  }, [page, search, nivel, userId]);

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    const { error } = await supabase.from('vendas').delete().eq('id', deleteId);
    setDeleting(false);
    if (error) {
      setModalError('Erro ao excluir venda: ' + error.message);
    } else {
      setDeleteId(null);
      fetchVendas();
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <>
      <ConfirmModal
        isOpen={!!deleteId}
        title="Excluir Venda"
        message="Tem certeza que deseja excluir esta venda permanentemente? Esta ação não pode ser desfeita."
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
        confirmText={deleting ? "Excluindo..." : "Sim, Excluir"}
        confirmType="danger"
      />

      <ConfirmModal
        isOpen={!!modalError}
        title="Ocorreu um Erro"
        message={modalError}
        onConfirm={() => setModalError('')}
        confirmText="Entendi"
      />

      <div className="animate-fade-in">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ margin: 0 }}>Vendas</h1>
            <p style={{ color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>Gerencie as operações e acompanhe o status.</p>
          </div>
          <Link href="/vendas/novo" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Plus size={18} /> Nova Venda
          </Link>
        </div>
        
        {/* ... Restante do conteúdo ... */}

      <div className="card" style={{ marginBottom: '2rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
          <input type="text" placeholder="Buscar por CPF ou Operação..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} style={{ paddingLeft: '2.75rem', width: '100%' }} />
        </div>
        <button className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={() => fetchVendas()}>
          <Filter size={18} /> Filtrar
        </button>
      </div>

      <div className="card">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem' }}>Carregando vendas...</div>
        ) : vendas.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--color-text-muted)' }}>Nenhuma venda encontrada.</div>
        ) : (
          <>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>ID Venda</th>
                    <th>Data</th>
                    <th>CPF</th>
                    <th>Operação</th>
                    <th>Valor</th>
                    <th>Parcela</th>
                    <th>Operador</th>
                    <th style={{ textAlign: 'right' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {vendas.map((v) => (
                    <tr key={v.id}>
                      <td style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--color-primary)', fontSize: '0.85rem' }}>{v.venda_id}</td>
                      <td>{new Date(v.created_at).toLocaleDateString('pt-BR')}</td>
                      <td style={{ fontWeight: 500 }}>{v.cpf}</td>
                      <td><span className="badge badge-info">{v.operacao}</span></td>
                      <td style={{ fontWeight: 600 }}>R$ {v.valor?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                      <td>R$ {v.parcela?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                      <td style={{ fontSize: '0.875rem' }}>{v.usuarios?.nome || '-'}</td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                          <Link href={`/vendas/${v.id}/editar`} className="btn btn-secondary" style={{ padding: '0.4rem' }} title="Editar">
                            <Edit2 size={16} />
                          </Link>
                          {nivel === 'admin' && (
                            <button className="btn btn-danger" style={{ padding: '0.4rem', background: 'transparent', color: 'var(--color-danger)', border: 'none' }} onClick={() => setDeleteId(v.id)} title="Excluir">
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
                  Total: {total} vendas — Página {page + 1} de {totalPages}
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

      <ConfirmModal
        isOpen={!!deleteId}
        title="Excluir Venda"
        message="Tem certeza que deseja excluir esta venda? Esta ação não poderá ser desfeita."
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
        confirmText={deleting ? 'Excluindo...' : 'Excluir'}
      />

      </div>
    </>
  );
}
