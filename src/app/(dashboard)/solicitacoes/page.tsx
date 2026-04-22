'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { CheckCircle, XCircle, ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react';
import { ConfirmModal } from '@/components/ConfirmModal';
import { adminResolveSolicitacao } from '@/app/actions/solicitacoes';
import Link from 'next/link';

const PAGE_SIZE = 50;

export default function SolicitacoesPage() {
  const [solicitacoes, setSolicitacoes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [nivel, setNivel] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [actionType, setActionType] = useState<'aprovada' | 'rejeitada' | null>(null);
  const [modalMessage, setModalMessage] = useState('');
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

  const fetchSolicitacoes = useCallback(async () => {
    setLoading(true);
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const isOperacional = nivel === 'operacional';

    let query = supabase
      .from('solicitacoes_alteracao')
      .select('*, vendas(cpf, valor, operacao, id), usuarios!solicitante_id(nome)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (isOperacional && userId) query = query.eq('solicitante_id', userId);

    const { data, count } = await query;
    if (data) setSolicitacoes(data);
    if (count !== null) setTotal(count);
    setLoading(false);
  }, [page, nivel, userId]);

  useEffect(() => {
    if (nivel !== undefined && nivel !== '') fetchSolicitacoes();
  }, [page, nivel, userId]);

  const confirmDecision = (request: any, decision: 'aprovada' | 'rejeitada') => {
    setSelectedRequest(request); setActionType(decision); setModalOpen(true);
  };

  const handleDecisionConfirm = async () => {
    if (!selectedRequest || !actionType) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      let aprovadorId = '';
      if (session) {
        const { data: profile } = await supabase.from('usuarios').select('id').eq('supabase_user_id', session.user.id).single();
        if (profile) aprovadorId = profile.id;
      }
      const res = await adminResolveSolicitacao(selectedRequest.id, actionType, aprovadorId);
      if (res.error) setModalError(res.error);
      else setModalMessage(`Solicitação ${actionType} com sucesso. O operador foi notificado.`);
      fetchSolicitacoes();
    } catch (err: any) {
      setModalError('Erro ao processar: ' + err.message);
    } finally {
      setModalOpen(false); setSelectedRequest(null); setActionType(null);
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ margin: 0 }}>Solicitações de Ajuste (Vendas)</h1>
        <p style={{ color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>
          Analise pedidos de exclusão ou alteração de vendas pendentes de revisão.
          {nivel === 'operacional' ? ' Exibindo apenas suas solicitações.' : ''}
        </p>
      </div>

      <div className="card">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>Carregando solicitações...</div>
        ) : solicitacoes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>
            Não há solicitações pendentes.
          </div>
        ) : (
          <>
            <div className="table-wrapper">
              <table className="table">
                <thead>
                  <tr>
                    <th>Data/Hora</th>
                    <th>Solicitante</th>
                    <th>Tipo</th>
                    <th>Venda</th>
                    <th>Motivo</th>
                    <th>Status</th>
                    {nivel === 'admin' && <th style={{ textAlign: 'center' }}>Decisão</th>}
                  </tr>
                </thead>
                <tbody>
                  {solicitacoes.map((sol) => (
                    <tr key={sol.id}>
                      <td style={{ whiteSpace: 'nowrap', fontSize: '0.8rem' }}>
                        <div>{new Date(sol.created_at).toLocaleDateString('pt-BR')}</div>
                        <div style={{ color: 'var(--color-text-muted)' }}>{new Date(sol.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
                      </td>
                      <td>{sol.usuarios?.nome || '-'}</td>
                      <td style={{ textTransform: 'capitalize', fontWeight: 600, color: sol.tipo === 'exclusao' ? 'var(--color-danger)' : 'var(--color-primary)' }}>
                        {sol.tipo}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', fontWeight: 600 }}>
                            {sol.vendas?.id?.substring(0, 8).toUpperCase() || 'N/A'}
                          </span>
                          {sol.vendas?.id && (
                            <Link href={`/vendas/${sol.vendas.id}/editar`} title="Ver detalhes da venda">
                              <ExternalLink size={14} color="var(--color-primary)" />
                            </Link>
                          )}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                          CPF: {sol.vendas?.cpf} — {sol.vendas?.operacao}
                        </div>
                      </td>
                      <td style={{ maxWidth: '220px', wordWrap: 'break-word', fontSize: '0.875rem' }}>{sol.motivo}</td>
                      <td>
                        <span className={`badge ${sol.status === 'aprovada' ? 'badge-success' : sol.status === 'rejeitada' ? 'badge-danger' : 'badge-warning'}`}>
                          {sol.status}
                        </span>
                      </td>
                      {nivel === 'admin' && (
                        <td style={{ textAlign: 'center', minWidth: '140px' }}>
                          {sol.status === 'pendente' ? (
                            <>
                              <button className="btn btn-success" style={{ padding: '0.5rem', marginRight: '0.5rem' }} title="Aprovar" onClick={() => confirmDecision(sol, 'aprovada')}>
                                <CheckCircle size={18} />
                              </button>
                              <button className="btn btn-danger" style={{ padding: '0.5rem', background: 'transparent', color: 'var(--color-danger)', border: '1px solid var(--color-danger)' }} title="Rejeitar" onClick={() => confirmDecision(sol, 'rejeitada')}>
                                <XCircle size={18} />
                              </button>
                            </>
                          ) : (
                            <span style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
                              Processado
                            </span>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)' }}>
                <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                  {total} solicitação(ões) — Página {page + 1} de {totalPages}
                </span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn btn-secondary" style={{ padding: '0.375rem 0.75rem' }} disabled={page === 0} onClick={() => setPage(p => p - 1)}><ChevronLeft size={16} /></button>
                  <button className="btn btn-secondary" style={{ padding: '0.375rem 0.75rem' }} disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}><ChevronRight size={16} /></button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <ConfirmModal
        isOpen={modalOpen}
        title={actionType === 'aprovada' ? 'Aprovar Solicitação' : 'Rejeitar Solicitação'}
        message={
          <span>
            Decisão sobre a venda do cliente <strong>{selectedRequest?.vendas?.cpf}</strong>.<br /><br />
            Decisão: <strong style={{ color: actionType === 'aprovada' ? 'var(--color-success)' : 'var(--color-danger)', textTransform: 'uppercase' }}>{actionType}</strong>
            {actionType === 'aprovada' && selectedRequest?.tipo === 'exclusao' && (
              <div style={{ marginTop: '0.5rem', color: 'var(--color-danger)' }}>
                <strong>Atenção:</strong> Esta venda será excluída permanentemente!
              </div>
            )}
          </span>
        }
        confirmText={actionType === 'aprovada' ? 'Confirmar Aprovação' : 'Sim, Rejeitar'}
        confirmType={actionType === 'aprovada' ? 'primary' : 'danger'}
        onConfirm={handleDecisionConfirm}
        onCancel={() => setModalOpen(false)}
      />

      <ConfirmModal isOpen={!!modalMessage} title="Sucesso" message={modalMessage} onConfirm={() => setModalMessage('')} confirmText="Entendi" confirmType="primary" />
      <ConfirmModal isOpen={!!modalError} title="Ocorreu um Problema" message={modalError} onConfirm={() => setModalError('')} confirmText="Entendi" confirmType="danger" />
    </div>
  );
}
