'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Edit2, Trash2, Search, Plus, Percent, Check, X } from 'lucide-react';
import { ConfirmModal } from '@/components/ConfirmModal';
import { useRouter } from 'next/navigation';
import { Coeficiente } from '@/lib/coeficientes';

export default function CoeficientesPage() {
  const router = useRouter();
  const [coeficientes, setCoeficientes] = useState<Coeficiente[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [nivel, setNivel] = useState('');
  const [saving, setSaving] = useState(false);

  // Modal State for Add / Edit
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    prazo: '',
    coef_min: '',
    coef_max: '',
    ativo: true
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

  // 1. Check user permission
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

      if (profile) {
        setNivel(profile.nivel);
        if (profile.nivel !== 'admin') {
          router.push('/vendas');
        }
      }
    };
    checkUser();
  }, [router]);

  // 2. Fetch coeficientes
  const fetchCoeficientes = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .schema('pro_consig')
      .from('coeficientes')
      .select('*')
      .order('prazo', { ascending: true });

    if (error) {
      console.error('Erro ao buscar coeficientes:', error);
      showAlert('Erro', 'Não foi possível carregar os coeficientes.', 'danger');
    } else if (data) {
      setCoeficientes(data);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCoeficientes();
  }, [fetchCoeficientes]);

  // Form helpers
  const handleOpenAdd = () => {
    setEditingId(null);
    setForm({
      prazo: '',
      coef_min: '',
      coef_max: '',
      ativo: true
    });
    setFormError('');
    setShowModal(true);
  };

  const handleOpenEdit = (item: Coeficiente) => {
    setEditingId(item.id);
    setForm({
      prazo: String(item.prazo),
      coef_min: String(item.coef_min).replace('.', ','),
      coef_max: String(item.coef_max).replace('.', ','),
      ativo: item.ativo
    });
    setFormError('');
    setShowModal(true);
  };

  const parseNumber = (val: string): number => {
    if (!val) return NaN;
    const clean = val.replace(/\./g, '').replace(',', '.');
    return parseFloat(clean);
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const prazoNum = parseInt(form.prazo, 10);
    const minNum = parseNumber(form.coef_min);
    const maxNum = parseNumber(form.coef_max);

    if (isNaN(prazoNum) || prazoNum <= 0) {
      setFormError('Informe um prazo válido (número inteiro maior que 0).');
      return;
    }

    if (isNaN(minNum) || isNaN(maxNum)) {
      setFormError('Informe valores numéricos válidos para os coeficientes mínimo e máximo.');
      return;
    }

    if (minNum > maxNum) {
      setFormError('O coeficiente mínimo não pode ser maior que o coeficiente máximo.');
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        // Update
        const { error } = await supabase
          .schema('pro_consig')
          .from('coeficientes')
          .update({
            prazo: prazoNum,
            coef_min: minNum,
            coef_max: maxNum,
            ativo: form.ativo,
            updated_at: new Date().toISOString()
          })
          .eq('id', editingId);

        if (error) throw error;
        showAlert('Sucesso', 'Coeficiente atualizado com sucesso!', 'success');
      } else {
        // Insert
        const { error } = await supabase
          .schema('pro_consig')
          .from('coeficientes')
          .insert({
            prazo: prazoNum,
            coef_min: minNum,
            coef_max: maxNum,
            ativo: form.ativo
          });

        if (error) throw error;
        showAlert('Sucesso', 'Coeficiente cadastrado com sucesso!', 'success');
      }

      setShowModal(false);
      fetchCoeficientes();
    } catch (err: any) {
      setFormError(err.message || 'Erro ao salvar coeficiente.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (item: Coeficiente) => {
    const newStatus = !item.ativo;
    const { error } = await supabase
      .schema('pro_consig')
      .from('coeficientes')
      .update({ ativo: newStatus, updated_at: new Date().toISOString() })
      .eq('id', item.id);

    if (error) {
      showAlert('Erro', 'Não foi possível alterar o status do coeficiente.', 'danger');
    } else {
      fetchCoeficientes();
    }
  };

  const handleDelete = async (id: string, prazo: number) => {
    showConfirm(
      'Excluir Coeficiente',
      `Tem certeza que deseja excluir o coeficiente para o prazo de ${prazo}x? Esta ação não poderá ser desfeita.`,
      async () => {
        const { error } = await supabase
          .schema('pro_consig')
          .from('coeficientes')
          .delete()
          .eq('id', id);

        if (error) {
          showAlert('Erro', 'Erro ao excluir coeficiente: ' + error.message, 'danger');
        } else {
          showAlert('Sucesso', 'Coeficiente excluído com sucesso!', 'success');
          fetchCoeficientes();
        }
      },
      'danger'
    );
  };

  // Filter list by search term
  const filteredCoeficientes = coeficientes.filter(c => {
    if (!search.trim()) return true;
    const term = search.trim().toLowerCase();
    const prazoStr = `${c.prazo}x`;
    const minStr = String(c.coef_min);
    const maxStr = String(c.coef_max);
    return prazoStr.includes(term) || String(c.prazo).includes(term) || minStr.includes(term) || maxStr.includes(term);
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
          <div className="card animate-fade-in" style={{ maxWidth: '500px', width: '100%', padding: '1.5rem', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem' }}>
                {editingId ? 'Editar Coeficiente' : 'Novo Coeficiente'}
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
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                    Prazo (em meses)
                  </label>
                  <input
                    type="number"
                    value={form.prazo}
                    onChange={e => setForm(f => ({ ...f, prazo: e.target.value }))}
                    placeholder="Ex: 1, 3, 6, 12, 15"
                    required
                    style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--color-border)' }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                      Coeficiente Mínimo
                    </label>
                    <input
                      type="text"
                      value={form.coef_min}
                      onChange={e => setForm(f => ({ ...f, coef_min: e.target.value }))}
                      placeholder="Ex: 1,170"
                      required
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--color-border)' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                      Coeficiente Máximo
                    </label>
                    <input
                      type="text"
                      value={form.coef_max}
                      onChange={e => setForm(f => ({ ...f, coef_max: e.target.value }))}
                      placeholder="Ex: 1,400"
                      required
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--color-border)' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <input
                    type="checkbox"
                    id="coef_ativo"
                    checked={form.ativo}
                    onChange={e => setForm(f => ({ ...f, ativo: e.target.checked }))}
                    style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                  />
                  <label htmlFor="coef_ativo" style={{ fontSize: '0.9rem', cursor: 'pointer' }}>
                    Coeficiente Ativo (disponível para cálculo nas vendas)
                  </label>
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
                  {saving ? 'Salva...' : editingId ? 'Atualizar' : 'Cadastrar'}
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
              <Percent size={28} /> Coeficientes
            </h1>
            <p style={{ color: 'var(--color-text-muted)', margin: '0.25rem 0 0 0', fontSize: '0.9rem' }}>
              Gerencie a tabela de prazos e coeficientes para cálculo automático de prazo nas vendas.
            </p>
          </div>
          <button
            onClick={handleOpenAdd}
            className="btn btn-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
          >
            <Plus size={18} /> Novo Coeficiente
          </button>
        </div>

        {/* Filter Card */}
        <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', maxWidth: '400px' }}>
            <Search size={18} style={{ color: 'var(--color-text-muted)' }} />
            <input
              type="text"
              placeholder="Buscar por prazo ou coeficiente..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: '100%', border: 'none', background: 'transparent', outline: 'none', color: 'var(--color-text-main)' }}
            />
          </div>
        </div>

        {/* Table Card */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>
              Carregando coeficientes...
            </div>
          ) : filteredCoeficientes.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>
              Nenhum coeficiente encontrado.
            </div>
          ) : (
            <div className="table-wrapper">
              <table className="table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left' }}>Prazo</th>
                    <th style={{ textAlign: 'left' }}>Coeficiente Mínimo</th>
                    <th style={{ textAlign: 'left' }}>Coeficiente Máximo</th>
                    <th style={{ textAlign: 'left' }}>Faixa de Aplicação</th>
                    <th style={{ textAlign: 'center' }}>Status</th>
                    <th style={{ textAlign: 'right' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCoeficientes.map(item => (
                    <tr key={item.id}>
                      <td style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--color-primary)' }}>
                        {item.prazo}x
                      </td>
                      <td style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                        {Number(item.coef_min).toFixed(6).replace('.', ',')}
                      </td>
                      <td style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                        {Number(item.coef_max).toFixed(6).replace('.', ',')}
                      </td>
                      <td style={{ fontSize: '0.9rem', color: 'var(--color-text-muted)' }}>
                        {Number(item.coef_min).toFixed(4).replace('.', ',')} até {Number(item.coef_max).toFixed(4).replace('.', ',')}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          onClick={() => handleToggleStatus(item)}
                          style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: 0 }}
                          title={item.ativo ? 'Clique para inativar' : 'Clique para ativar'}
                        >
                          {item.ativo ? (
                            <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                              <Check size={12} /> Ativo
                            </span>
                          ) : (
                            <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                              <X size={12} /> Inativo
                            </span>
                          )}
                        </button>
                      </td>
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
                            onClick={() => handleDelete(item.id, item.prazo)}
                            className="btn btn-secondary"
                            style={{ padding: '0.4rem', color: 'var(--color-danger)' }}
                            title="Excluir"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
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
