'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Edit2, Trash2, Search, Plus, ChevronLeft, ChevronRight, Filter, User, Copy, Check } from 'lucide-react';
import Link from 'next/link';
import { ConfirmModal } from '@/components/ConfirmModal';

const PAGE_SIZE = 50;

export default function ClientesList() {
  const [clientes, setClientes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [nivel, setNivel] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [notification, setNotification] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'success' | 'danger' | 'primary';
    onConfirm?: () => void;
    onCancel?: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'primary'
  });

  const showAlert = (title: string, message: string, type: 'success' | 'danger' | 'primary' = 'primary') => {
    setNotification({ isOpen: true, title, message, type, onConfirm: () => setNotification(prev => ({ ...prev, isOpen: false })) });
  };

  const showConfirm = (title: string, message: string, onConfirm: () => void, type: 'danger' | 'primary' = 'primary') => {
    setNotification({ 
      isOpen: true, 
      title, 
      message, 
      type, 
      onConfirm: () => { onConfirm(); setNotification(prev => ({ ...prev, isOpen: false })); },
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

  const fetchClientes = useCallback(async () => {
    setLoading(true);
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from('clientes')
      .select('*', { count: 'exact' })
      .order('nome', { ascending: true })
      .range(from, to);

    if (search) {
      query = query.or(`nome.ilike.%${search}%,cpf.ilike.%${search}%`);
    }

    const { data, count } = await query;
    if (data) setClientes(data);
    if (count !== null) setTotal(count);
    setLoading(false);
  }, [page, search]);

  useEffect(() => {
    fetchClientes();
  }, [page, search]);

  const handleDelete = async (id: string) => {
    showConfirm(
      'Excluir Cliente',
      'Tem certeza que deseja excluir este cliente? Esta ação não pode ser desfeita.',
      async () => {
        setLoading(true);
        const { error } = await supabase.from('clientes').delete().eq('id', id);
        if (error) {
          showAlert('Erro', 'Erro ao excluir cliente: ' + (error.code === '23503' ? 'Este cliente possui vendas vinculadas e não pode ser excluído.' : error.message), 'danger');
        } else {
          fetchClientes();
          showAlert('Sucesso', 'Cliente excluído com sucesso!', 'success');
        }
        setLoading(false);
      },
      'danger'
    );
  };

  const handleCopy = (cpf: string, id: string) => {
    navigator.clipboard.writeText(cpf);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <>
      <ConfirmModal
        isOpen={notification.isOpen}
        title={notification.title}
        message={notification.message}
        confirmType={notification.type}
        onConfirm={notification.onConfirm || (() => {})}
        onCancel={notification.onCancel}
        confirmText={notification.onCancel ? 'Sim, Confirmar' : 'Entendi'}
      />

      <div className="animate-fade-in">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ margin: 0 }}>Clientes</h1>
            <p style={{ color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>Gerencie o cadastro de clientes do sistema.</p>
          </div>
          <Link href="/clientes/novo" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Plus size={18} /> Novo Cliente
          </Link>
        </div>

      <div className="card" style={{ marginBottom: '2rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
          <input type="text" placeholder="Buscar por Nome ou CPF..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} style={{ paddingLeft: '2.75rem', width: '100%' }} />
        </div>
        <button className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={() => fetchClientes()}>
          <Filter size={18} /> Filtrar
        </button>
      </div>

      <div className="card">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem' }}>Carregando clientes...</div>
        ) : clientes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--color-text-muted)' }}>Nenhum cliente encontrado.</div>
        ) : (
          <>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>CPF</th>
                    <th>Email</th>
                    <th>Telefone</th>
                    <th style={{ textAlign: 'right' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {clientes.map((c) => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 500 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--color-bg-body)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-primary)' }}>
                            <User size={16} />
                          </div>
                          {c.nome}
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {c.cpf}
                          <button 
                            onClick={() => handleCopy(c.cpf, c.id)}
                            style={{ 
                              background: 'transparent', 
                              border: 'none', 
                              padding: '0.2rem', 
                              color: copiedId === c.id ? 'var(--color-success)' : 'var(--color-text-muted)', 
                              cursor: 'pointer', 
                              display: 'flex', 
                              alignItems: 'center',
                              transition: 'all 0.2s'
                            }}
                            title="Copiar CPF"
                          >
                            {copiedId === c.id ? <Check size={14} /> : <Copy size={14} />}
                          </button>
                        </div>
                      </td>
                      <td>{c.email || '-'}</td>
                      <td>{c.telefone || '-'}</td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                          <Link href={`/clientes/${c.id}/editar`} className="btn btn-secondary" style={{ padding: '0.4rem' }} title="Editar">
                            <Edit2 size={16} />
                          </Link>
                          {nivel === 'admin' && (
                            <button className="btn btn-danger" style={{ padding: '0.4rem', background: 'transparent', color: 'var(--color-danger)', border: 'none' }} onClick={() => handleDelete(c.id)} title="Excluir">
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
                  Total: {total} clientes — Página {page + 1} de {totalPages}
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
