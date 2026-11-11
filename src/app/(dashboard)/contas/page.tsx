'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Edit2, Trash2, Search, Plus, Landmark, X, Filter } from 'lucide-react';
import { ConfirmModal } from '@/components/ConfirmModal';
import { useRouter } from 'next/navigation';

export interface Conta {
  id: number;
  conta_ativacao: number;
  grupo: number;
  empresa_ativacao: string;
  empresa_credora: string;
}

export default function ContasPage() {
  const router = useRouter();
  const [contas, setContas] = useState<Conta[]>([]);
  const [loading, setLoading] = useState(true);
  const [userNivel, setUserNivel] = useState('');
  const [search, setSearch] = useState('');
  const [grupoFilter, setGrupoFilter] = useState('');
  const [credoraFilter, setCredoraFilter] = useState('');
  const [saving, setSaving] = useState(false);

  const isAdmin = userNivel === 'admin';

  // Modal State for Add / Edit
  const [showModal, setShowModal] = useState(false);
  const [editingConta, setEditingConta] = useState<Conta | null>(null);
  const [form, setForm] = useState({
    conta_ativacao: '',
    grupo: '1',
    empresa_ativacao: '',
    empresa_credora: ''
  });
  const [formError, setFormError] = useState('');

  // Notification / Alert Modal
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

  // 1. Check user permission (all authenticated users can view; only admin can create/edit/delete)
  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/login');
        return;
      }
      const { data: profile } = await supabase
        .from('usuarios')
        .select('nivel')
        .eq('supabase_user_id', session.user.id)
        .single();

      if (profile?.nivel) {
        setUserNivel(profile.nivel);
      }
    };
    checkUser();
  }, [router]);

  // 2. Fetch contas
  const fetchContas = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .schema('pro_consig')
      .from('contas')
      .select('*')
      .order('grupo', { ascending: true })
      .order('conta_ativacao', { ascending: true });

    if (error) {
      console.error('Erro ao buscar contas:', error);
      showAlert('Erro', 'Não foi possível carregar as contas de ativação.', 'danger');
    } else if (data) {
      setContas(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchContas();
  }, [fetchContas]);

  const gruposDisponiveis = useMemo(() => {
    const sets = new Set<number>([1, 2]);
    contas.forEach(c => {
      if (c.grupo) sets.add(Number(c.grupo));
    });
    return Array.from(sets).sort((a, b) => a - b);
  }, [contas]);

  const credorasDisponiveis = useMemo(() => {
    const sets = new Set<string>();
    contas.forEach(c => {
      if (c.empresa_credora && c.empresa_credora.trim()) {
        sets.add(c.empresa_credora.trim().toUpperCase());
      }
    });
    return Array.from(sets).sort((a, b) => a.localeCompare(b));
  }, [contas]);

  // Se o grupo ou empresa credora filtrados não existirem mais após uma exclusão, reseta o filtro correspondente
  useEffect(() => {
    if (!loading && grupoFilter && !gruposDisponiveis.includes(Number(grupoFilter))) {
      setGrupoFilter('');
    }
    if (!loading && credoraFilter && !credorasDisponiveis.includes(credoraFilter)) {
      setCredoraFilter('');
    }
  }, [gruposDisponiveis, grupoFilter, credorasDisponiveis, credoraFilter, loading]);

  // Form helpers
  const handleOpenAdd = () => {
    setEditingConta(null);
    setForm({
      conta_ativacao: '',
      grupo: grupoFilter || '',
      empresa_ativacao: '',
      empresa_credora: ''
    });
    setFormError('');
    setShowModal(true);
  };

  const handleOpenEdit = (item: Conta) => {
    setEditingConta(item);
    setForm({
      conta_ativacao: String(item.conta_ativacao),
      grupo: String(item.grupo),
      empresa_ativacao: item.empresa_ativacao || '',
      empresa_credora: item.empresa_credora || ''
    });
    setFormError('');
    setShowModal(true);
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const contaNum = parseInt(form.conta_ativacao.trim(), 10);
    const grupoNum = parseInt(form.grupo.trim(), 10);
    const empAtivacao = form.empresa_ativacao.trim().toUpperCase();
    const empCredora = form.empresa_credora.trim().toUpperCase();

    if (isNaN(contaNum) || contaNum <= 0) {
      setFormError('Informe um número de Conta Ativação válido (inteiro maior que 0).');
      return;
    }

    if (isNaN(grupoNum) || grupoNum <= 0) {
      setFormError('Informe um Grupo válido (inteiro maior que 0).');
      return;
    }

    if (!empAtivacao) {
      setFormError('Informe a Empresa de Ativação.');
      return;
    }

    if (!empCredora) {
      setFormError('Informe a Empresa Credora.');
      return;
    }

    // Validação de duplicidade da chave composta (conta_ativacao + grupo)
    const duplicate = contas.find(
      c => Number(c.conta_ativacao) === contaNum &&
        Number(c.grupo) === grupoNum &&
        (!editingConta || c.id !== editingConta.id)
    );

    if (duplicate) {
      setFormError(`Já existe a Conta Ativação ${contaNum} cadastrada para o Grupo ${grupoNum}.`);
      return;
    }

    setSaving(true);
    try {
      if (editingConta) {
        const { error } = await supabase
          .schema('pro_consig')
          .from('contas')
          .update({
            conta_ativacao: contaNum,
            grupo: grupoNum,
            empresa_ativacao: empAtivacao,
            empresa_credora: empCredora
          })
          .eq('id', editingConta.id);

        if (error) throw error;
        showAlert('Sucesso', 'Conta de ativação atualizada com sucesso!', 'success');
      } else {
        const { error } = await supabase
          .schema('pro_consig')
          .from('contas')
          .insert({
            conta_ativacao: contaNum,
            grupo: grupoNum,
            empresa_ativacao: empAtivacao,
            empresa_credora: empCredora
          });

        if (error) throw error;
        showAlert('Sucesso', 'Conta de ativação cadastrada com sucesso!', 'success');
      }

      setShowModal(false);
      fetchContas();
    } catch (err: any) {
      if (err.code === '23505') {
        setFormError(`A Conta Ativação ${contaNum} já está cadastrada para o Grupo ${grupoNum}.`);
      } else {
        setFormError(err.message || 'Erro ao salvar conta de ativação.');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: Conta) => {
    try {
      // Verifica se a conta (conta_ativacao + grupo) está sendo utilizada em vendas
      const { data: vendasGrupo, error: checkError } = await supabase
        .schema('pro_consig')
        .from('vendas')
        .select('id, conta_ativacao')
        .eq('grupo', item.grupo)
        .not('conta_ativacao', 'is', null);

      if (checkError) {
        showAlert('Erro', 'Não foi possível verificar o vínculo da conta nas vendas: ' + checkError.message, 'danger');
        return;
      }

      const qtdVendasEmUso = (vendasGrupo || []).filter(
        v => parseInt(String(v.conta_ativacao).trim(), 10) === Number(item.conta_ativacao)
      ).length;

      if (qtdVendasEmUso > 0) {
        showAlert(
          'Exclusão Bloqueada',
          `A Conta Ativação ${item.conta_ativacao} (Grupo ${item.grupo} - ${item.empresa_ativacao}) não pode ser excluída pois está vinculada a ${qtdVendasEmUso} ${qtdVendasEmUso === 1 ? 'venda registrada' : 'vendas registradas'} no sistema.`,
          'danger'
        );
        return;
      }

      showConfirm(
        'Excluir Conta de Ativação',
        `Tem certeza que deseja excluir a Conta Ativação ${item.conta_ativacao} do Grupo ${item.grupo} (${item.empresa_ativacao})? Esta ação não poderá ser desfeita.`,
        async () => {
          const { error } = await supabase
            .schema('pro_consig')
            .from('contas')
            .delete()
            .eq('id', item.id);

          if (error) {
            showAlert('Erro', 'Erro ao excluir conta: ' + error.message, 'danger');
          } else {
            showAlert('Sucesso', 'Conta de ativação excluída com sucesso!', 'success');
            fetchContas();
          }
        },
        'danger'
      );
    } catch (err: any) {
      showAlert('Erro', 'Ocorreu um erro ao tentar excluir a conta: ' + (err.message || ''), 'danger');
    }
  };

  // Filter list by search term, group and empresa credora
  const filteredContas = contas.filter(c => {
    if (grupoFilter && String(c.grupo) !== grupoFilter) return false;
    if (credoraFilter && (c.empresa_credora || '').trim().toUpperCase() !== credoraFilter) return false;
    if (!search.trim()) return true;
    const term = search.trim().toLowerCase();
    const contaStr = String(c.conta_ativacao);
    const empAtivStr = (c.empresa_ativacao || '').toLowerCase();
    const empCredStr = (c.empresa_credora || '').toLowerCase();
    const grupoStr = `grupo ${c.grupo}`;
    return (
      contaStr.includes(term) ||
      empAtivStr.includes(term) ||
      empCredStr.includes(term) ||
      grupoStr.includes(term)
    );
  });

  return (
    <>
      <ConfirmModal
        isOpen={notification.isOpen}
        title={notification.title}
        message={notification.message}
        onConfirm={notification.onConfirm || (() => setNotification(prev => ({ ...prev, isOpen: false })))}
        onCancel={notification.onCancel}
        confirmText={notification.confirmText || (notification.onCancel ? 'Confirmar' : 'Entendi')}
        cancelText="Cancelar"
        confirmType={notification.type === 'danger' ? 'danger' : 'primary'}
      />

      {/* Modal Add / Edit */}
      {showModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem'
        }}>
          <div className="card animate-fade-in" style={{ maxWidth: '520px', width: '100%', padding: '1.5rem', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Landmark size={20} style={{ color: 'var(--color-primary)' }} />
                {editingConta ? 'Editar Conta de Ativação' : 'Nova Conta de Ativação'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>

            {formError && (
              <div style={{
                padding: '0.75rem', marginBottom: '1rem', borderRadius: '6px',
                backgroundColor: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-danger)', fontSize: '0.85rem'
              }}>
                {formError}
              </div>
            )}

            <form onSubmit={handleSubmitForm}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                      Grupo
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={form.grupo}
                      onChange={e => setForm(f => ({ ...f, grupo: e.target.value.replace(/\D/g, '') }))}
                      placeholder="Ex: 1, 2, 3"
                      required
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--color-border)' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                      Conta Ativação
                    </label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={form.conta_ativacao}
                      onChange={e => setForm(f => ({ ...f, conta_ativacao: e.target.value.replace(/\D/g, '') }))}
                      placeholder="Ex: 1, 2, 17"
                      required
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--color-border)' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                    Empresa de Ativação
                  </label>
                  <input
                    type="text"
                    value={form.empresa_ativacao}
                    onChange={e => setForm(f => ({ ...f, empresa_ativacao: e.target.value.toUpperCase() }))}
                    placeholder="Ex: BB - OVALE 10459"
                    required
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--color-border)' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                    Empresa Credora
                  </label>
                  <input
                    type="text"
                    value={form.empresa_credora}
                    onChange={e => setForm(f => ({ ...f, empresa_credora: e.target.value.toUpperCase() }))}
                    placeholder="Ex: UP, OVALE, CENTRAL PROTEGE"
                    required
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--color-border)' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn btn-secondary"
                  disabled={saving}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                >
                  {saving ? 'Salvando...' : editingConta ? 'Atualizar' : 'Cadastrar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main Page Layout */}
      <div className="animate-fade-in" style={{ width: '100%', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              Contas de Ativação
            </h1>
            <p style={{ color: 'var(--color-text-muted)', margin: '0.25rem 0 0 0', fontSize: '0.9rem' }}>
              {isAdmin
                ? 'Gerencie as contas de ativação, grupos e empresas credoras vinculadas às vendas.'
                : 'Consulte as contas de ativação, grupos e empresas credoras vinculadas às vendas.'}
            </p>
          </div>
          {isAdmin && (
            <button
              onClick={handleOpenAdd}
              className="btn btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
            >
              <Plus size={18} /> Nova Conta
            </button>
          )}
        </div>

        {/* Filter Card */}
        <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1, minWidth: '240px', maxWidth: '450px' }}>
            <Search size={18} style={{ color: 'var(--color-text-muted)', flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Buscar por conta, empresa de ativação ou credora..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', border: 'none', background: 'transparent', outline: 'none', color: 'var(--color-text-main)' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Filter size={16} style={{ color: 'var(--color-text-muted)' }} />
              <select
                value={credoraFilter}
                onChange={e => setCredoraFilter(e.target.value)}
                style={{ padding: '0.4rem 0.75rem', borderRadius: '6px', border: '1px solid var(--color-border)', fontSize: '0.85rem' }}
              >
                <option value="">Todas as Empresas Credoras</option>
                {credorasDisponiveis.map(emp => (
                  <option key={emp} value={emp}>{emp}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <select
                value={grupoFilter}
                onChange={e => setGrupoFilter(e.target.value)}
                style={{ padding: '0.4rem 0.75rem', borderRadius: '6px', border: '1px solid var(--color-border)', fontSize: '0.85rem' }}
              >
                <option value="">Todos os Grupos</option>
                {gruposDisponiveis.map(g => (
                  <option key={g} value={String(g)}>Grupo {g}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Table Card */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>
              Carregando contas de ativação...
            </div>
          ) : filteredContas.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>
              Nenhuma conta encontrada.
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'center', width: '110px' }}>Grupo</th>
                    <th style={{ textAlign: 'center', width: '150px' }}>Conta Ativação</th>
                    <th style={{ textAlign: 'left' }}>Empresa de Ativação</th>
                    <th style={{ textAlign: 'left' }}>Empresa Credora</th>
                    {isAdmin && <th style={{ textAlign: 'right', width: '120px' }}>Ações</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredContas.map(item => (
                    <tr key={item.id}>
                      <td style={{ textAlign: 'center', fontWeight: 700, fontSize: '0.95rem' }}>
                        {item.grupo}
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 700, fontSize: '1rem', color: 'var(--color-primary)' }}>
                        {item.conta_ativacao}
                      </td>
                      <td style={{ fontSize: '0.92rem', fontWeight: 600 }}>
                        {item.empresa_ativacao}
                      </td>
                      <td style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)', fontWeight: 500 }}>
                        {item.empresa_credora}
                      </td>
                      {isAdmin && (
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                            <button
                              onClick={() => handleOpenEdit(item)}
                              className="btn btn-secondary"
                              style={{ padding: '0.4rem' }}
                              title="Editar"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              onClick={() => handleDelete(item)}
                              className="btn btn-secondary"
                              style={{ padding: '0.4rem', color: 'var(--color-danger)' }}
                              title="Excluir"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

