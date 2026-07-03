'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { ShieldCheck, XCircle, Search, UserCheck, Shield, Edit2, Trash2, UserMinus, BarChart, TrendingUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { ConfirmModal } from '@/components/ConfirmModal';
import { EditUserModal } from '@/components/EditUserModal';
import { adminChangeUserStatus, adminDeleteUser } from '@/app/actions/admin';

const PAGE_SIZE = 50;

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);

  // Notification Modal State
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

  // Modal States
  const [modalOpen, setModalOpen] = useState(false);
  const [actionType, setActionType] = useState<'approve_op' | 'approve_admin' | 'deactivate' | 'reactivate' | 'reject' | 'delete' | null>(null);
  const [selectedUser, setSelectedUser] = useState<any>(null);

  // Edit Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<any>(null);

  const fetchUsuarios = useCallback(async () => {
    setLoading(true);
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from('usuarios')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (busca) {
      query = query.or(`nome.ilike.%${busca}%,email.ilike.%${busca}%`);
    }

    const { data, count } = await query;
    if (data) setUsuarios(data);
    if (count !== null) setTotal(count);
    setLoading(false);
  }, [page, busca]);

  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    fetchUsuarios();
    const interval = setInterval(() => {
      fetchUsuarios();
    }, 30000);
    return () => clearInterval(interval);
  }, [page, fetchUsuarios]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const isOnline = (ultimaAtividadeStr: string | null) => {
    if (!ultimaAtividadeStr) return false;
    const lastActive = new Date(ultimaAtividadeStr).getTime();
    return (currentTime - lastActive) < 90000;
  };

  const formatLastLogin = (ultimoLoginStr: string | null) => {
    if (!ultimoLoginStr) return '-';
    const date = new Date(ultimoLoginStr);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const confirmAction = (user: any, type: typeof actionType) => {
    setSelectedUser(user);
    setActionType(type);
    setModalOpen(true);
  };

  const handleActionConfirm = async () => {
    if (!selectedUser || !actionType) return;

    if (actionType === 'delete') {
      const res = await adminDeleteUser(selectedUser.id);
      if (res.error) {
        showAlert('Erro', res.error, 'danger');
      } else {
        fetchUsuarios();
      }
    } else {
      const res = await adminChangeUserStatus(selectedUser.id, actionType);
      if (res.error) showAlert('Erro', res.error, 'danger');
      else fetchUsuarios();
    }

    setModalOpen(false);
    setSelectedUser(null);
    setActionType(null);
  };  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ margin: 0 }}>Gerenciamento de Usuários</h1>
      </div>

      <div className="card" style={{ marginBottom: '2rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
          <input
            type="text"
            placeholder="Buscar por nome ou e-mail..."
            value={busca}
            onChange={(e) => { setBusca(e.target.value); setPage(0); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setPage(0);
                fetchUsuarios();
              }
            }}
            style={{ paddingLeft: '2.75rem', width: '100%' }}
          />
        </div>
        <button className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={() => { setPage(0); fetchUsuarios(); }}>
          <Search size={18} /> Filtrar
        </button>
      </div>

      <div className="card">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>Buscando usuários...</div>
        ) : usuarios.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--color-text-muted)' }}>Nenhum usuário encontrado.</div>
        ) : (
          <>
            <div className="table-wrapper" style={{ overflow: 'visible' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Conta</th>
                    <th>E-mail</th>
                    <th>Perfil</th>
                    <th>Logado</th>
                    <th>Último Login</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {usuarios.map((usr) => (
                    <tr key={usr.id}>
                      <td><div style={{ fontWeight: 500 }}>{usr.nome}</div></td>
                      <td>{usr.conta}</td>
                      <td>{usr.email}</td>
                      <td style={{ textTransform: 'capitalize' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                          {usr.nivel === 'admin' && <Shield size={14} color="var(--color-primary)" />}
                          {usr.nivel === 'operacional' && <UserCheck size={14} color="var(--color-text-muted)" />}
                          {usr.nivel === 'financeiro' && <BarChart size={14} color="var(--color-warning)" />}
                          {usr.nivel === 'vendedor' && <TrendingUp size={14} color="var(--color-success)" />}
                          {usr.nivel}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          <span style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            backgroundColor: isOnline(usr.ultima_atividade) ? 'var(--color-success)' : 'var(--color-text-muted)',
                            display: 'inline-block'
                          }} />
                          <span style={{ fontSize: '0.85rem', color: isOnline(usr.ultima_atividade) ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
                            {isOnline(usr.ultima_atividade) ? 'Sim' : 'Não'}
                          </span>
                        </div>
                      </td>
                      <td style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                        {formatLastLogin(usr.ultimo_login)}
                      </td>
                      <td>
                        <span className={`badge ${usr.status === 'ativo' ? 'badge-success' : usr.status === 'inativo' ? 'badge-neutral' : usr.status === 'rejeitado' ? 'badge-danger' : 'badge-warning'}`}>
                          {usr.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button
                          className="btn btn-secondary"
                          style={{ padding: '0.4rem', marginRight: '0.4rem', background: 'transparent', color: 'var(--color-primary)', border: 'none' }}
                          onClick={() => { setUserToEdit(usr); setEditModalOpen(true); }}
                          title="Editar Dados e E-mail"
                        >
                          <Edit2 size={16} />
                        </button>

                        {usr.status === 'pendente' && (
                          <>
                            <button
                              className="btn btn-success"
                              style={{ padding: '0.4rem', marginRight: '0.4rem' }}
                              onClick={() => confirmAction(usr, 'approve_op')}
                              title="Aprovar como Operacional"
                            >
                              <UserCheck size={16} />
                            </button>
                            <button
                              className="btn btn-primary"
                              style={{ padding: '0.4rem', marginRight: '0.4rem' }}
                              onClick={() => confirmAction(usr, 'approve_admin')}
                              title="Aprovar como Administrador"
                            >
                              <ShieldCheck size={16} />
                            </button>
                            <button
                              className="btn btn-danger"
                              style={{ padding: '0.4rem', marginRight: '0.4rem', background: 'transparent', color: 'var(--color-danger)', border: '1px solid var(--color-danger)' }}
                              onClick={() => confirmAction(usr, 'reject')}
                              title="Rejeitar Cadastro"
                            >
                              <XCircle size={16} />
                            </button>
                          </>
                        )}

                        {usr.status === 'ativo' && (
                          <>
                            <button
                              className="btn btn-danger"
                              style={{ padding: '0.4rem', marginRight: '0.4rem', color: 'var(--color-warning)', background: 'transparent', border: '1px solid var(--color-warning)' }}
                              onClick={() => confirmAction(usr, 'deactivate')}
                              title="Desativar Acesso"
                            >
                              <UserMinus size={16} />
                            </button>
                          </>
                        )}

                        {usr.status === 'inativo' && (
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '0.4rem', marginRight: '0.4rem' }}
                            onClick={() => confirmAction(usr, 'reactivate')}
                            title="Reativar Acesso"
                          >
                            <ShieldCheck size={16} />
                          </button>
                        )}

                        <button
                          className="btn btn-danger"
                          style={{ padding: '0.4rem', border: 'none', background: 'transparent', color: 'var(--color-danger)' }}
                          onClick={() => confirmAction(usr, 'delete')}
                          title="Excluir Permanentemente"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {total > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--color-border)' }}>
                <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                  Total: {total} usuários{totalPages > 1 ? ` — Página ${page + 1} de ${totalPages}` : ''}
                </span>
                {totalPages > 1 && (
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-secondary" style={{ padding: '0.5rem' }} disabled={page === 0} onClick={() => setPage(p => p - 1)}><ChevronLeft size={18} /></button>
                    <button className="btn btn-secondary" style={{ padding: '0.5rem' }} disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}><ChevronRight size={18} /></button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <ConfirmModal
        isOpen={modalOpen}
        title={
          actionType === 'delete' ? 'Excluir Usuário Permanentemente' :
            actionType === 'reject' ? 'Rejeitar Cadastro' :
            actionType === 'deactivate' ? 'Desativar Usuário' :
              actionType === 'reactivate' ? 'Reativar Usuário' : 'Aprovar Acesso'
        }
        message={
          <span>
            {actionType === 'delete' && <>Tem certeza que deseja apagar o registro de <strong>{selectedUser?.nome}</strong> para sempre? Historicamente, sugerimos apenas "Desativar" para não quebrar a relação dele com as Vendas e Clientes registrados.</>}
            {actionType === 'reject' && <>Você está rejeitando o pedido de acesso de <strong>{selectedUser?.nome}</strong>. O status dele ficará bloqueado e não terá qualquer acesso no CentralPagamentos.</>}
            {actionType === 'deactivate' && <>Isso revogará temporariamente o acesso do usuário <strong>{selectedUser?.nome}</strong> da plataforma. Essa ação pode ser desfeita a qualquer momento.</>}
            {actionType === 'reactivate' && <>Restabelecer acesso para o perfil de <strong>{selectedUser?.nome}</strong> ({selectedUser?.nivel}).</>}
            {actionType === 'approve_op' && <>Aprovar o cadastro e garantir nível <strong>Operacional</strong> para <strong>{selectedUser?.nome}</strong>?</>}
            {actionType === 'approve_admin' && <>Aprovar o cadastro e garantir plenos poderes como <strong>Administrador</strong> para <strong>{selectedUser?.nome}</strong>?</>}
          </span>
        }
        confirmText={
          actionType === 'delete' ? 'Sim, Excluir' :
            actionType === 'reject' ? 'Rejeitar Cadastro' :
                actionType === 'deactivate' ? 'Desativar Acesso' :
                  actionType === 'reactivate' ? 'Reativar' :
                    'Confirmar Aprovação'
        }
        onConfirm={handleActionConfirm}
        onCancel={() => setModalOpen(false)}
      />

      <EditUserModal
        isOpen={editModalOpen}
        user={userToEdit}
        onClose={() => setEditModalOpen(false)}
        onSuccess={fetchUsuarios}
      />


      {/* Custom Notification Modal */}
      <ConfirmModal
        isOpen={notification.isOpen}
        title={notification.title}
        message={notification.message}
        confirmType={notification.type}
        onConfirm={notification.onConfirm || (() => {})}
        onCancel={notification.onCancel}
        confirmText={notification.onCancel ? 'Confirmar' : 'Entendi'}
      />
    </div>
  );
}

