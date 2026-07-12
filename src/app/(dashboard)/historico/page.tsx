'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { History, Search, User, ChevronLeft, ChevronRight, Loader2, Eye } from 'lucide-react';
import Link from 'next/link';

const PAGE_SIZE = 20;

export default function HistoricoSaldosPage() {
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);

  const [filters, setFilters] = useState({
    vendaCodigo: '',
    usuarioNome: ''
  });

  const [nivel, setNivel] = useState('');
  const [allowedGroups, setAllowedGroups] = useState<number[]>([]);

  // 1. Initial Load: user profile & permissions
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: profile } = await supabase
        .from('usuarios')
        .select('nivel, grupos_permitidos')
        .eq('supabase_user_id', session.user.id)
        .single();

      if (profile) {
        setNivel(profile.nivel);
        if (profile.nivel === 'financeiro' && profile.grupos_permitidos && profile.grupos_permitidos.length > 0) {
          setAllowedGroups(profile.grupos_permitidos.map(Number));
        }
      }
    };
    init();
  }, []);

  // 2. Load History data on page / filters change
  const fetchHistory = async (p = page) => {
    setLoading(true);
    const from = p * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .schema('pro_consig')
      .from('historico_saldos')
      .select('*, vendas!inner(id, venda_id, grupo, operacao, codigo_operacao, contrato)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    // Filter by allowed groups for financeiro users
    if (nivel === 'financeiro') {
      if (allowedGroups.length > 0) {
        query = query.in('vendas.grupo', allowedGroups);
      } else {
        query = query.in('vendas.grupo', [-1]);
      }
    }

    if (filters.vendaCodigo) {
      query = query.ilike('venda_codigo', `%${filters.vendaCodigo}%`);
    }

    if (filters.usuarioNome) {
      query = query.ilike('usuario_nome', `%${filters.usuarioNome}%`);
    }

    const { data, count, error } = await query;

    if (error) {
      console.error('Error fetching history:', error);
    } else {
      setHistory(data || []);
      setTotalCount(count || 0);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (nivel !== '') {
      fetchHistory(0);
      setPage(0);
    }
  }, [nivel, allowedGroups, filters.vendaCodigo, filters.usuarioNome]);

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    fetchHistory(newPage);
  };

  const formatBRL = (val: number) => {
    if (val === null || val === undefined) return '-';
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getContratoDisplay = (v: any) => {
    if (!v) return '-';
    if (v.operacao === 'REFIN') return v.codigo_operacao || '-';
    if (v.operacao === 'NOVO') return 'Nova Venda';
    return v.contrato || v.codigo_operacao || '-';
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: 0 }}>
          <History size={28} style={{ color: 'var(--color-primary)' }} />
          Histórico de Alterações de Saldo
        </h1>
        <p style={{ color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>
          Consulte o log de modificações manuais do campo Saldo realizadas em Nova Venda ou Editar Venda.
        </p>
      </div>

      {/* FILTROS */}
      <div className="card" style={{ marginBottom: '2rem', padding: '1.25rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '220px' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>Contrato</label>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
              <input
                name="vendaCodigo"
                type="text"
                value={filters.vendaCodigo}
                onChange={handleFilterChange}
                placeholder="Ex: 12698 ou Nova Venda"
                style={{ width: '100%', paddingLeft: '2.5rem', height: '42px' }}
              />
            </div>
          </div>
          <div style={{ flex: 1, minWidth: '220px' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)' }}>Usuário</label>
            <div style={{ position: 'relative' }}>
              <User size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
              <input
                name="usuarioNome"
                type="text"
                value={filters.usuarioNome}
                onChange={handleFilterChange}
                placeholder="Nome do usuário..."
                style={{ width: '100%', paddingLeft: '2.5rem', height: '42px' }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* TABELA */}
      <div className="card" style={{ padding: '0' }}>
        <div style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontWeight: 600, fontSize: '1.1rem' }}>Registros de Alteração</span>
            <span className="badge" style={{ backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary-dark)' }}>
              {totalCount} total
            </span>
          </div>
        </div>

        <div className="table-responsive">
          <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ paddingLeft: '1.5rem' }}>Contrato</th>
                <th>Operação</th>
                <th>Usuário</th>
                <th style={{ textAlign: 'right' }}>Valor Original</th>
                <th style={{ textAlign: 'right' }}>Valor Novo</th>
                <th style={{ textAlign: 'right' }}>Diferença</th>
                <th style={{ paddingRight: '1.5rem', textAlign: 'right' }}>Data / Hora</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '3rem' }}>
                    <Loader2 className="animate-spin" style={{ margin: '0 auto', color: 'var(--color-primary)' }} />
                  </td>
                </tr>
              ) : history.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>
                    Nenhum registro de alteração de saldo encontrado.
                  </td>
                </tr>
              ) : (
                history.map((h) => {
                  const diff = h.valor_novo - h.valor_original;
                  const diffColor = diff > 0 ? 'var(--color-success)' : diff < 0 ? 'var(--color-danger)' : 'var(--color-text)';
                  const parentVenda = Array.isArray(h.vendas) ? h.vendas[0] : h.vendas;
                  const vendaId = parentVenda?.id;

                  return (
                    <tr key={h.id}>
                      <td style={{ paddingLeft: '1.5rem', fontWeight: 600 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {getContratoDisplay(parentVenda)}
                          {vendaId && (
                            <Link 
                              href={`/vendas/${vendaId}`}
                              style={{ color: 'var(--color-primary)', display: 'inline-flex', alignItems: 'center' }}
                              title="Ver Venda"
                            >
                              <Eye size={15} />
                            </Link>
                          )}
                        </div>
                      </td>
                      <td>
                        <span className="badge" style={{ 
                          backgroundColor: h.tipo_operacao === 'Nova Venda' ? 'rgba(59, 130, 246, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                          color: h.tipo_operacao === 'Nova Venda' ? '#3b82f6' : '#10b981'
                        }}>
                          {h.tipo_operacao}
                        </span>
                      </td>
                      <td>{h.usuario_nome || '-'}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatBRL(h.valor_original)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{formatBRL(h.valor_novo)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', color: diffColor, fontWeight: 'bold' }}>
                        {diff > 0 ? '+' : ''}{formatBRL(diff)}
                      </td>
                      <td style={{ paddingRight: '1.5rem', textAlign: 'right', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                        {formatDate(h.created_at)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINAÇÃO */}
        {!loading && totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem', borderTop: '1px solid var(--color-border)' }}>
            <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
              Página {page + 1} de {totalPages}
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button 
                className="btn btn-secondary" 
                style={{ padding: '0.5rem' }} 
                disabled={page === 0} 
                onClick={() => handlePageChange(page - 1)}
              >
                <ChevronLeft size={18} />
              </button>
              <button 
                className="btn btn-secondary" 
                style={{ padding: '0.5rem' }} 
                disabled={page >= totalPages - 1} 
                onClick={() => handlePageChange(page + 1)}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
