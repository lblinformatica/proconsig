'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { ArrowLeft } from 'lucide-react';
import { ConfirmModal } from '@/components/ConfirmModal';

export default function NovoVendedor() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    codigo: '',
    nome: '',
    meta: '',
    meta_diaria: '',
    ativo: true
  });

  const [notification, setNotification] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'success' | 'danger' | 'primary';
    onConfirm?: () => void;
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { id, value } = e.target;
    let val: any = value;
    if (id === 'nome') {
      val = value.toUpperCase();
    } else if (id === 'meta' || id === 'meta_diaria') {
      val = value.replace(/[^\d.,]/g, '');
    } else if (id === 'ativo') {
      val = value === 'true';
    }
    setForm(f => ({ ...f, [id]: val }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.codigo.trim() || !form.nome.trim()) {
      setError('Por favor, preencha todos os campos obrigatórios.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const metaNum = form.meta ? parseFloat(form.meta.replace(/\./g, '').replace(',', '.')) : 0;
      const metaDiariaNum = form.meta_diaria ? parseFloat(form.meta_diaria.replace(/\./g, '').replace(',', '.')) : 0;
      const { error: dbError } = await supabase
        .schema('pro_consig')
        .from('vendedores')
        .insert({
          codigo: form.codigo.trim(),
          nome: form.nome.trim().toUpperCase(),
          meta: isNaN(metaNum) ? 0 : metaNum,
          meta_diaria: isNaN(metaDiariaNum) ? 0 : metaDiariaNum,
          ativo: form.ativo
        });

      if (dbError) {
        if (dbError.code === '23505') {
          if (dbError.message.includes('codigo')) {
            throw new Error('Já existe um vendedor com este código cadastrado.');
          } else {
            throw new Error('Já existe um vendedor com este nome cadastrado.');
          }
        }
        throw new Error(dbError.message);
      }

      router.push('/vendedores');
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar vendedor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: '600px', margin: '0 auto' }}>
      <ConfirmModal
        isOpen={notification.isOpen}
        title={notification.title}
        message={notification.message}
        confirmType={notification.type}
        onConfirm={notification.onConfirm || (() => { })}
        confirmText="Entendi"
      />

      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '2rem', gap: '1rem' }}>
        <Link href="/vendedores" className="btn btn-secondary" style={{ padding: '0.5rem' }}>
          <ArrowLeft size={20} />
        </Link>
        <h1 style={{ margin: 0 }}>Novo Vendedor</h1>
      </div>

      <form onSubmit={handleSubmit}>
        {error && (
          <div style={{ padding: '1rem', backgroundColor: 'var(--color-danger-bg)', color: 'var(--color-danger)', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem' }}>
            {error}
          </div>
        )}

        <div className="card" style={{ marginBottom: '1.5rem', padding: '2rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div>
              <label htmlFor="codigo" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                Código do Vendedor <span style={{ color: 'var(--color-danger)' }}>*</span>
              </label>
              <input
                id="codigo"
                type="text"
                value={form.codigo}
                onChange={handleChange}
                placeholder="Ex: 01, 02, VEND01"
                required
                style={{ width: '100%' }}
              />
              <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', marginTop: '0.25rem', display: 'block' }}>
                Código único de identificação. Sugerido formato numérico sequencial com dois dígitos (ex: 01, 02).
              </span>
            </div>

            <div>
              <label htmlFor="nome" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                Nome Completo <span style={{ color: 'var(--color-danger)' }}>*</span>
              </label>
              <input
                id="nome"
                type="text"
                value={form.nome}
                onChange={handleChange}
                placeholder="Ex: ALESSANDRA"
                required
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label htmlFor="meta" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                Meta Mensal (R$)
              </label>
              <input
                id="meta"
                type="text"
                value={form.meta}
                onChange={handleChange}
                placeholder="Ex: 50.000,00"
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label htmlFor="meta_diaria" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                Meta Diária (R$)
              </label>
              <input
                id="meta_diaria"
                type="text"
                value={form.meta_diaria}
                onChange={handleChange}
                placeholder="Ex: 2.000,00"
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label htmlFor="ativo" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                Status
              </label>
              <select
                id="ativo"
                value={form.ativo ? 'true' : 'false'}
                onChange={handleChange}
                style={{ width: '100%', padding: '0.5rem' }}
              >
                <option value="true">Ativo</option>
                <option value="false">Inativo</option>
              </select>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
          <Link href="/vendedores" className="btn btn-secondary">Cancelar</Link>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Salvando...' : 'Salvar Vendedor'}
          </button>
        </div>
      </form>
    </div>
  );
}
