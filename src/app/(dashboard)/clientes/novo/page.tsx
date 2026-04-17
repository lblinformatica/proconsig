'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { ArrowLeft, Building2, CreditCard, Wallet } from 'lucide-react';
import { validateCPF, formatCPF } from '@/lib/cpf';

// ── Helpers ────────────────────────────────────────────────
const fieldStyle = { display: 'block', marginBottom: '0.5rem', fontWeight: 500 } as const;
const gridStyle = (cols: string) => ({ display: 'grid', gridTemplateColumns: cols, gap: '1.5rem' });
const legendStyle = {
  fontSize: '1rem', fontWeight: 600, color: 'var(--color-primary)',
  marginBottom: '1.25rem', display: 'block', width: '100%',
  borderBottom: '1px solid var(--color-border)', paddingBottom: '0.25rem'
} as const;

async function lookupBanco(codigo: string): Promise<string> {
  if (!codigo || codigo.length < 3) return '';
  const { data } = await supabase
    .from('bancos')
    .select('nome')
    .eq('codigo', codigo.padStart(3, '0'))
    .single();
  return data?.nome ?? '';
}

export default function NovoCliente() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cpfError, setCpfError] = useState('');

  // ── Form state ──────────────────────────────────────────
  const [form, setForm] = useState({
    cpf: '',
    nome: '',
    // Dados bancários de débito
    banco: '',
    banco_nome: '',
    agencia: '',
    agencia_dv: '',
    conta: '',
    conta_dv: '',
    op: '',
    tipo_conta: 'corrente' as string,
    // Forma de crédito
    forma_credito: '' as '' | 'conta' | 'pix',
    // Crédito em conta
    credito_banco: '',
    credito_banco_nome: '',
    credito_agencia: '',
    credito_agencia_dv: '',
    credito_tipo_conta: 'corrente' as string,
    credito_conta: '',
    credito_conta_dv: '',
    // PIX
    pix_tipo_chave: 'cpf' as string,
    pix_chave: ''
  });

  // Lookup automático de banco débito
  useEffect(() => {
    const t = setTimeout(async () => {
      const nome = await lookupBanco(form.banco);
      setForm(f => ({ ...f, banco_nome: nome }));
    }, 400);
    return () => clearTimeout(t);
  }, [form.banco]);

  // Lookup automático de banco crédito
  useEffect(() => {
    if (form.forma_credito !== 'conta') return;
    const t = setTimeout(async () => {
      const nome = await lookupBanco(form.credito_banco);
      setForm(f => ({ ...f, credito_banco_nome: nome }));
    }, 400);
    return () => clearTimeout(t);
  }, [form.credito_banco, form.forma_credito]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { id, value } = e.target;
    setForm(f => ({ ...f, [id]: id === 'cpf' ? formatCPF(value) : value }));
    if (id === 'cpf') setCpfError('');
  };

  const handleCpfBlur = () => {
    if (form.cpf.length > 0 && !validateCPF(form.cpf)) {
      setCpfError('CPF inválido. Verifique os dígitos.');
    } else {
      setCpfError('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateCPF(form.cpf)) {
      setError('CPF inválido. Verifique os dígitos verificadores.');
      return;
    }
    setLoading(true);
    setError('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      let userId = null;
      if (session) {
        const { data: profile } = await supabase.from('usuarios').select('id').eq('supabase_user_id', session.user.id).single();
        if (profile) userId = profile.id;
      }

      const payload: any = {
        cpf: form.cpf,
        nome: form.nome,
        banco: form.banco,
        agencia: form.agencia,
        agencia_dv: form.agencia_dv,
        conta: form.conta,
        conta_dv: form.conta_dv,
        op: form.op,
        tipo_conta: form.tipo_conta,
        forma_credito: form.forma_credito || null,
        created_by: userId
      };

      if (form.forma_credito === 'conta') {
        payload.credito_banco = form.credito_banco;
        payload.credito_agencia = form.credito_agencia;
        payload.credito_agencia_dv = form.credito_agencia_dv;
        payload.credito_tipo_conta = form.credito_tipo_conta;
        payload.credito_conta = form.credito_conta;
        payload.credito_conta_dv = form.credito_conta_dv;
      } else if (form.forma_credito === 'pix') {
        payload.pix_tipo_chave = form.pix_tipo_chave;
        payload.pix_chave = form.pix_chave;
      }

      const { error: dbError } = await supabase.from('clientes').insert(payload);
      if (dbError) {
        if (dbError.code === '23505') throw new Error('Já existe um cliente com este CPF cadastrado.');
        throw new Error(dbError.message);
      }

      router.push('/clientes');
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar cliente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '2rem', gap: '1rem' }}>
        <Link href="/clientes" className="btn btn-secondary" style={{ padding: '0.5rem' }}>
          <ArrowLeft size={20} />
        </Link>
        <h1 style={{ margin: 0 }}>Novo Cliente</h1>
      </div>

      <form onSubmit={handleSubmit}>
        {error && (
          <div style={{ padding: '1rem', backgroundColor: 'var(--color-danger-bg)', color: 'var(--color-danger)', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem' }}>
            {error}
          </div>
        )}

        {/* ── Identificação ── */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <fieldset style={{ border: 'none', margin: 0, padding: 0 }}>
            <legend style={legendStyle}>Identificação</legend>
            <div style={gridStyle('1fr 2fr')}>
              <div>
                <label htmlFor="cpf" style={fieldStyle}>CPF</label>
                <input id="cpf" type="text" value={form.cpf} onChange={handleChange} onBlur={handleCpfBlur} placeholder="000.000.000-00" required style={{ width: '100%', borderColor: cpfError ? 'var(--color-danger)' : undefined }} />
                {cpfError && <span style={{ color: 'var(--color-danger)', fontSize: '0.8rem', marginTop: '0.25rem', display: 'block' }}>{cpfError}</span>}
              </div>
              <div>
                <label htmlFor="nome" style={fieldStyle}>Nome Completo</label>
                <input id="nome" type="text" value={form.nome} onChange={handleChange} placeholder="Ex: Maria das Graças Silva" required style={{ width: '100%' }} />
              </div>
            </div>
          </fieldset>
        </div>

        {/* ── Dados Bancários (Débito) ── */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <fieldset style={{ border: 'none', margin: 0, padding: 0 }}>
            <legend style={legendStyle}>
              <Building2 size={16} style={{ display: 'inline', marginRight: '0.5rem', verticalAlign: 'middle' }} />
              Dados Bancários (Débito)
            </legend>
            <div style={{ ...gridStyle('80px 1fr 120px 80px 60px 80px 60px 60px'), alignItems: 'end' }}>
              <div>
                <label style={fieldStyle}>Banco</label>
                <input id="banco" type="text" value={form.banco} onChange={handleChange} placeholder="001" maxLength={10} style={{ width: '100%' }} />
              </div>
              <div>
                <label style={fieldStyle}>Nome</label>
                <input type="text" value={form.banco_nome} readOnly placeholder="Automático..." style={{ width: '100%', background: 'var(--color-bg-body)', color: 'var(--color-text-muted)', cursor: 'default' }} />
              </div>
              <div>
                <label style={fieldStyle}>Tipo</label>
                <select id="tipo_conta" value={form.tipo_conta} onChange={handleChange} style={{ width: '100%' }}>
                  <option value="corrente">Corrente</option>
                  <option value="poupanca">Poupança</option>
                </select>
              </div>
              <div>
                <label style={fieldStyle}>Agência</label>
                <input id="agencia" type="text" value={form.agencia} onChange={handleChange} placeholder="0001" style={{ width: '100%' }} />
              </div>
              <div>
                <label style={fieldStyle}>DV</label>
                <input id="agencia_dv" type="text" value={form.agencia_dv} onChange={handleChange} maxLength={2} style={{ width: '100%' }} />
              </div>
              <div>
                <label style={fieldStyle}>Conta</label>
                <input id="conta" type="text" value={form.conta} onChange={handleChange} placeholder="123456" style={{ width: '100%' }} />
              </div>
              <div>
                <label style={fieldStyle}>DV</label>
                <input id="conta_dv" type="text" value={form.conta_dv} onChange={handleChange} maxLength={2} style={{ width: '100%' }} />
              </div>
              <div>
                <label style={fieldStyle}>OP</label>
                <input id="op" type="text" value={form.op} onChange={handleChange} placeholder="000" style={{ width: '100%' }} />
              </div>
            </div>
          </fieldset>
        </div>

        {/* ── Forma Para Crédito ── */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <fieldset style={{ border: 'none', margin: 0, padding: 0 }}>
            <legend style={legendStyle}>
              <CreditCard size={16} style={{ display: 'inline', marginRight: '0.5rem', verticalAlign: 'middle' }} />
              Forma Para Crédito
            </legend>

            <div style={{ marginBottom: '1.5rem' }}>
              <label style={fieldStyle}>Tipo de Crédito</label>
              <select id="forma_credito" value={form.forma_credito} onChange={handleChange} required style={{ maxWidth: '280px', width: '100%' }}>
                <option value="">Selecione...</option>
                <option value="conta">Crédito em Conta</option>
                <option value="pix">PIX</option>
              </select>
            </div>

            {/* Crédito em Conta */}
            {form.forma_credito === 'conta' && (
              <div style={{ padding: '1.25rem', backgroundColor: 'var(--color-bg-surface-hover)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-primary)', marginBottom: '1rem' }}>Dados Bancários para Crédito</div>
                <div style={{ ...gridStyle('120px 1fr 80px 80px 1fr 80px'), gap: '1rem', alignItems: 'end' }}>
                  <div>
                    <label style={fieldStyle}>Nº Banco</label>
                    <input id="credito_banco" type="text" value={form.credito_banco} onChange={handleChange} placeholder="001" maxLength={10} style={{ width: '100%' }} />
                  </div>
                  <div>
                    <label style={fieldStyle}>Nome</label>
                    <input type="text" value={form.credito_banco_nome} readOnly placeholder="Automático..." style={{ width: '100%', background: 'var(--color-bg-body)', color: 'var(--color-text-muted)' }} />
                  </div>
                  <div>
                    <label style={fieldStyle}>Agência</label>
                    <input id="credito_agencia" type="text" value={form.credito_agencia} onChange={handleChange} style={{ width: '100%' }} />
                  </div>
                  <div>
                    <label style={fieldStyle}>DV</label>
                    <input id="credito_agencia_dv" type="text" value={form.credito_agencia_dv} onChange={handleChange} maxLength={2} style={{ width: '100%' }} />
                  </div>
                  <div>
                    <label style={fieldStyle}>Conta</label>
                    <input id="credito_conta" type="text" value={form.credito_conta} onChange={handleChange} style={{ width: '100%' }} />
                  </div>
                  <div>
                    <label style={fieldStyle}>DV</label>
                    <input id="credito_conta_dv" type="text" value={form.credito_conta_dv} onChange={handleChange} maxLength={2} style={{ width: '100%' }} />
                  </div>
                </div>
                <div style={{ marginTop: '1rem', ...gridStyle('180px 1fr') }}>
                  <div>
                    <label style={fieldStyle}>Tipo de Conta Crédito</label>
                    <select id="credito_tipo_conta" value={form.credito_tipo_conta} onChange={handleChange} style={{ width: '100%' }}>
                      <option value="corrente">Corrente</option>
                      <option value="poupanca">Poupança</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* PIX */}
            {form.forma_credito === 'pix' && (
              <div style={{ padding: '1.25rem', backgroundColor: 'var(--color-bg-surface-hover)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-success)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Wallet size={16} /> Dados PIX
                </div>
                <div style={gridStyle('220px 1fr')}>
                  <div>
                    <label style={fieldStyle}>Tipo de Chave PIX</label>
                    <select id="pix_tipo_chave" value={form.pix_tipo_chave} onChange={handleChange} style={{ width: '100%' }}>
                      <option value="cpf">CPF</option>
                      <option value="email">E-mail</option>
                      <option value="telefone">Telefone</option>
                      <option value="aleatoria">Chave Aleatória</option>
                    </select>
                  </div>
                  <div>
                    <label style={fieldStyle}>Chave PIX</label>
                    <input id="pix_chave" type="text" value={form.pix_chave} onChange={handleChange} placeholder={
                      form.pix_tipo_chave === 'cpf' ? '000.000.000-00' :
                      form.pix_tipo_chave === 'email' ? 'exemplo@email.com' :
                      form.pix_tipo_chave === 'telefone' ? '(11) 99999-9999' : 'Chave aleatória UUID'
                    } style={{ width: '100%' }} required />
                  </div>
                </div>
              </div>
            )}
          </fieldset>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
          <Link href="/clientes" className="btn btn-secondary">Cancelar</Link>
          <button type="submit" className="btn btn-primary" disabled={loading || !!cpfError}>
            {loading ? 'Salvando...' : 'Salvar Cliente'}
          </button>
        </div>
      </form>
    </div>
  );
}
