'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { ShieldCheck, XCircle, Search, UserCheck, Shield, Edit2, Trash2, UserMinus } from 'lucide-react';
import { ConfirmModal } from '@/components/ConfirmModal';
import { EditUserModal } from '@/components/EditUserModal';
import { adminChangeUserStatus, adminDeleteUser } from '@/app/actions/admin';

export default function UsuariosPage() {
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');

  // Modal States
  const [modalOpen, setModalOpen] = useState(false);
  const [actionType, setActionType] = useState<'approve_op' | 'approve_admin' | 'deactivate' | 'reactivate' | 'reject' | 'delete' | null>(null);
  const [selectedUser, setSelectedUser] = useState<any>(null);

  // Edit Modal State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<any>(null);

  // Error Modal State
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    fetchUsuarios();
  }, []);

  const fetchUsuarios = async () => {
    setLoading(true);
    let query = supabase.from('usuarios').select('*').order('created_at', { ascending: false });

    if (busca) {
      query = query.or(`nome.ilike.%${busca}%,email.ilike.%${busca}%`);
    }

    const { data } = await query;
    if (data) setUsuarios(data);
    setLoading(false);
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
        setErrorMessage(res.error);
      } else {
        fetchUsuarios();
      }
    } else {
      const res = await adminChangeUserStatus(selectedUser.id, actionType);
      if (res.error) setErrorMessage(res.error);
      else fetchUsuarios();
    }

    setModalOpen(false);
    setSelectedUser(null);
    setActionType(null);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ margin: 0 }}>Gerenciamento de Usuários</h1>

        <div style={{ position: 'relative', width: '300px' }}>
          <Search size={18} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
          <input
            type="text"
            placeholder="Buscar por nome ou e-mail..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchUsuarios()}
            style={{ paddingLeft: '2.5rem' }}
          />
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>Buscando usuários...</div>
        ) : (
          <div className="table-wrapper" style={{ overflow: 'visible' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Conta</th>
                  <th>E-mail</th>
                  <th>Perfil</th>
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
                        {usr.nivel === 'admin' ? <Shield size={14} color="var(--color-primary)" /> : <UserCheck size={14} color="var(--color-text-muted)" />}
                        {usr.nivel}
                      </span>
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

      <ConfirmModal
        isOpen={!!errorMessage}
        title="Ocorreu um Problema"
        message={errorMessage}
        onConfirm={() => setErrorMessage('')}
        confirmText="Entendi"
        confirmType="danger"
      />
    </div>
  );
}
