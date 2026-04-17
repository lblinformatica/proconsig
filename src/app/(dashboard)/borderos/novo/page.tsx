'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { ArrowLeft, CheckCircle2, AlertTriangle, ExternalLink } from 'lucide-react';
import { validateCPF, formatCPF } from '@/lib/cpf';

// ── Helpers ──────────────────────────────────────────────────────────────────
const fs = { display: 'block', marginBottom: '0.5rem', fontWeight: 500 } as const;
const ls = {
  fontSize: '1rem', fontWeight: 600, color: 'var(--color-primary)',
  marginBottom: '1.25rem', display: 'block', width: '100%',
  borderBottom: '1px solid var(--color-border)', paddingBottom: '0.25rem'
} as const;
const readonlyStyle = {
  background: 'var(--color-bg-body)',
  color: 'var(--color-text-muted)',
  cursor: 'default',
  width: '100%'
} as const;

async function lookupBanco(codigo: string): Promise<string> {
  if (!codigo) return '';
  const { data } = await supabase.from('bancos').select('nome').eq('codigo', codigo.padStart(3, '0')).single();
  return data?.nome ?? '';
}

type FormValues = {
  orgao: string; empresa: string; operacao: string; codigo_operacao: string; corretor: string;
  valor: string; saldo: string; valor_liquido: string; coef: string; parcela: string; prazo: string;
  banco: string; banco_nome: string; tipo_conta: string; agencia: string; agencia_dv: string;
  conta: string; conta_dv: string; op: string;
  forma_credito: string; credito_banco: string; credito_agencia: string; credito_agencia_dv: string;
  credito_conta: string; credito_conta_dv: string; credito_tipo_conta: string;
  pix_tipo_chave: string; pix_chave: string;
  contrato: string; empresa_ativacao: string; conta_ativacao: string; inicio: string; dia_util: string; juncao: string;
  observacao: string;
};

export default function NovoBordero() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [cpfError, setCpfError] = useState('');

  // Client lookup
  const [cpf, setCpf] = useState('');
  const [clientFound, setClientFound] = useState<any>(null);
  const [checkingClient, setCheckingClient] = useState(false);
  const [showClientModal, setShowClientModal] = useState(false);

  const [form, setForm] = useState<FormValues>({
    orgao: '', empresa: '', operacao: '', codigo_operacao: '', corretor: '',
    valor: '', saldo: '', valor_liquido: '', coef: '', parcela: '', prazo: '',
    banco: '', banco_nome: '', tipo_conta: 'corrente', agencia: '', agencia_dv: '', conta: '', conta_dv: '', op: '',
    forma_credito: '', credito_banco: '', credito_agencia: '', credito_agencia_dv: '',
    credito_conta: '', credito_conta_dv: '', credito_tipo_conta: 'corrente',
    pix_tipo_chave: '', pix_chave: '',
    contrato: '', empresa_ativacao: '', conta_ativacao: '', inicio: '', dia_util: '', juncao: '',
    observacao: ''
  });

  // Auto-fill banking from client
  useEffect(() => {
    if (!clientFound) return;
    const fillBancoNome = async () => {
      const nome = await lookupBanco(clientFound.banco || '');
      setForm(f => ({
        ...f,
        banco: clientFound.banco || '',
        banco_nome: nome,
        tipo_conta: clientFound.tipo_conta || 'corrente',
        agencia: clientFound.agencia || '',
        agencia_dv: clientFound.agencia_dv || '',
        conta: clientFound.conta || '',
        conta_dv: clientFound.conta_dv || '',
        op: clientFound.op || '',
        forma_credito: clientFound.forma_credito || '',
        credito_banco: clientFound.credito_banco || '',
        credito_agencia: clientFound.credito_agencia || '',
        credito_agencia_dv: clientFound.credito_agencia_dv || '',
        credito_conta: clientFound.credito_conta || '',
        credito_conta_dv: clientFound.credito_conta_dv || '',
        credito_tipo_conta: clientFound.credito_tipo_conta || 'corrente',
        pix_tipo_chave: clientFound.pix_tipo_chave || '',
        pix_chave: clientFound.pix_chave || ''
      }));
    };
    fillBancoNome();
  }, [clientFound]);

  // Auto-calc: valor_liquido = valor - saldo
  useEffect(() => {
    const v = parseFloat(form.valor.replace(',', '.')) || 0;
    const s = parseFloat(form.saldo.replace(',', '.')) || 0;
    if (v > 0 || s > 0) setForm(f => ({ ...f, valor_liquido: (v - s).toFixed(2) }));
  }, [form.valor, form.saldo]);

  // Auto-calc: coef = parcela / valor
  useEffect(() => {
    const v = parseFloat(form.valor.replace(',', '.')) || 0;
    const p = parseFloat(form.parcela.replace(',', '.')) || 0;
    if (v > 0 && p > 0) setForm(f => ({ ...f, coef: (p / v).toFixed(6) }));
  }, [form.valor, form.parcela]);

  // REFIN: contrato = codigo_operacao
  useEffect(() => {
    if (form.operacao === 'REFIN') setForm(f => ({ ...f, contrato: f.codigo_operacao }));
  }, [form.operacao, form.codigo_operacao]);

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCPF(e.target.value);
    setCpf(formatted);
    setCpfError('');
    if (formatted.length < 14) { setClientFound(null); setShowClientModal(false); }
  };

  const checkCPF = useCallback(async () => {
    if (cpf.length !== 14) return;
    if (!validateCPF(cpf)) { setCpfError('CPF inválido.'); return; }
    setCheckingClient(true);
    setError('');
    const { data: clients } = await supabase.from('clientes').select('*').eq('cpf', cpf);
    setCheckingClient(false);
    if (clients && clients.length > 0) {
      setClientFound(clients[0]);
      setShowClientModal(false);
    } else {
      setClientFound(null);
      setShowClientModal(true);
    }
  }, [cpf]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateCPF(cpf)) { setError('CPF inválido.'); return; }
    if (!clientFound) { setError('Verifique o CPF e confirme o cliente antes de salvar.'); return; }
    setLoading(true); setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      let userId = null;
      if (session) {
        const { data: profile } = await supabase.from('usuarios').select('id').eq('supabase_user_id', session.user.id).single();
        if (profile) userId = profile.id;
      }
      const parsedValor = parseFloat(form.valor.replace(',', '.')) || null;
      const parsedSaldo = parseFloat(form.saldo.replace(',', '.')) || null;
      const parsedLiquido = parseFloat(form.valor_liquido.replace(',', '.')) || null;
      const parsedCoef = parseFloat(form.coef.replace(',', '.')) || null;
      const parsedParcela = parseFloat(form.parcela.replace(',', '.')) || null;
      const parsedPrazo = parseInt(form.prazo) || null;

      const { error: borderoError } = await supabase.from('borderos').insert({
        cpf,
        orgao: form.orgao, empresa: form.empresa, operacao: form.operacao,
        codigo_operacao: form.codigo_operacao, corretor: form.corretor,
        valor: parsedValor, saldo: parsedSaldo, abat: parsedLiquido, coef: parsedCoef,
        parcela: parsedParcela, prazo: parsedPrazo,
        banco: form.banco, agencia: form.agencia, agencia_dv: form.agencia_dv,
        op: form.op, conta: form.conta, conta_dv: form.conta_dv,
        contrato: form.contrato, empresa_ativacao: form.empresa_ativacao,
        conta_ativacao: form.conta_ativacao, inicio: form.inicio || null,
        dia_util: form.dia_util, juncao: form.juncao, observacao: form.observacao,
        status: 'Aprovado',
        created_by: userId
      });
      if (borderoError) throw new Error('Erro ao criar borderô: ' + borderoError.message);

      // UPDATE client banking info
      const { error: clientUpdateError } = await supabase.from('clientes').update({
        banco: form.banco,
        agencia: form.agencia,
        agencia_dv: form.agencia_dv,
        conta: form.conta,
        conta_dv: form.conta_dv,
        op: form.op,
        tipo_conta: form.tipo_conta,
        forma_credito: form.forma_credito,
        credito_banco: form.credito_banco,
        credito_agencia: form.credito_agencia,
        credito_agencia_dv: form.credito_agencia_dv,
        credito_conta: form.credito_conta,
        credito_conta_dv: form.credito_conta_dv,
        credito_tipo_conta: form.credito_tipo_conta,
        pix_tipo_chave: form.pix_tipo_chave,
        pix_chave: form.pix_chave
      }).eq('id', clientFound.id);

      if (clientUpdateError) console.error('Erro ao atualizar dados bancários do cliente:', clientUpdateError);

      router.push('/borderos'); router.refresh();
    } catch (err: any) { setError(err.message); setLoading(false); }
  };

  const creditBlock = () => {
    if (!clientFound) return null;
    return (
      <div style={{ padding: '1.5rem', background: 'var(--color-bg-surface-hover)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={fs}>Forma de Recebimento</label>
          <select name="forma_credito" value={form.forma_credito} onChange={handleChange} style={{ width: '100%', maxWidth: '300px' }}>
            <option value="">Selecione...</option>
            <option value="pix">PIX</option>
            <option value="conta">Crédito em Conta</option>
          </select>
        </div>

        {form.forma_credito === 'pix' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(150px, 1fr) 2fr', gap: '1.5rem', animation: 'fadeIn 0.3s ease' }}>
            <div>
              <label style={fs}>Tipo de Chave</label>
              <select name="pix_tipo_chave" value={form.pix_tipo_chave} onChange={handleChange} style={{ width: '100%' }}>
                <option value="">Selecione...</option>
                <option value="email">E-mail</option>
                <option value="cpf">CPF</option>
                <option value="telefone">Telefone</option>
                <option value="aleatoria">Chave Aleatória</option>
              </select>
            </div>
            <div>
              <label style={fs}>Chave PIX</label>
              <input name="pix_chave" type="text" value={form.pix_chave} onChange={handleChange} placeholder="Informe a chave PIX" style={{ width: '100%' }} />
            </div>
          </div>
        )}

        {form.forma_credito === 'conta' && (
          <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 110px 90px 54px 120px 54px 70px', gap: '0.75rem', alignItems: 'end', animation: 'fadeIn 0.3s ease' }}>
            <div>
              <label style={fs}>Banco</label>
              <input name="credito_banco" type="text" value={form.credito_banco} onChange={handleChange} style={{ width: '100%' }} />
            </div>
            <div style={{ gridColumn: 'span 2' }}>
              <label style={fs}>Tipo de Conta</label>
              <select name="credito_tipo_conta" value={form.credito_tipo_conta} onChange={handleChange} style={{ width: '100%' }}>
                <option value="corrente">Corrente</option>
                <option value="poupanca">Poupança</option>
              </select>
            </div>
            <div>
              <label style={fs}>Agência</label>
              <input name="credito_agencia" type="text" value={form.credito_agencia} onChange={handleChange} style={{ width: '100%' }} />
            </div>
            <div>
              <label style={fs}>DV</label>
              <input name="credito_agencia_dv" type="text" value={form.credito_agencia_dv} onChange={handleChange} style={{ width: '100%' }} />
            </div>
            <div>
              <label style={fs}>Conta</label>
              <input name="credito_conta" type="text" value={form.credito_conta} onChange={handleChange} style={{ width: '100%' }} />
            </div>
            <div>
              <label style={fs}>DV</label>
              <input name="credito_conta_dv" type="text" value={form.credito_conta_dv} onChange={handleChange} style={{ width: '100%' }} />
            </div>
          </div>
        )}
        
        {!form.forma_credito && (
          <div style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', fontStyle: 'italic' }}>
            Selecione uma forma de recebimento para informar os dados.
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="animate-fade-in" style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '2rem', gap: '1rem' }}>
        <Link href="/borderos" className="btn btn-secondary" style={{ padding: '0.5rem' }}><ArrowLeft size={20} /></Link>
        <h1 style={{ margin: 0 }}>Novo Borderô</h1>
      </div>

      {/* Modal: Cliente não cadastrado */}
      {showClientModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, backdropFilter: 'blur(2px)' }}>
          <div className="card animate-fade-in" style={{ maxWidth: '480px', width: '100%', backgroundColor: 'var(--color-bg-surface)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--color-border)' }}>
              <AlertTriangle size={24} color="var(--color-warning)" />
              <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Cliente Não Cadastrado</h2>
            </div>
            <p style={{ color: 'var(--color-text-muted)', marginBottom: '1.5rem', lineHeight: 1.6 }}>
              O CPF <strong style={{ color: 'var(--color-text-main)', fontFamily: 'monospace' }}>{cpf}</strong> não está cadastrado no sistema. Você deve cadastrar o cliente antes de continuar.
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowClientModal(false)}>Fechar</button>
              <Link href={`/clientes/novo`} className="btn btn-primary">
                <ExternalLink size={16} /> Cadastrar Cliente
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Seção: Identificação do Cliente */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <fieldset style={{ border: 'none', margin: 0, padding: 0 }}>
          <legend style={ls}>Identificação do Cliente</legend>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', marginBottom: '1rem' }}>
            <div style={{ maxWidth: '260px', flex: 1 }}>
              <label htmlFor="search_cpf" style={fs}>CPF do Cliente</label>
              <input id="search_cpf" type="text" value={cpf} onChange={handleCpfChange} onBlur={checkCPF} placeholder="000.000.000-00" required style={{ width: '100%', borderColor: cpfError ? 'var(--color-danger)' : undefined }} />
              {cpfError && <span style={{ color: 'var(--color-danger)', fontSize: '0.8rem', display: 'block', marginTop: '0.25rem' }}>{cpfError}</span>}
            </div>
            {checkingClient && <span style={{ color: 'var(--color-text-muted)', padding: '0.625rem 0' }}>Verificando...</span>}
            {clientFound && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-success)', padding: '0.625rem 0' }}>
                <CheckCircle2 size={20} /> Cliente: <strong>{clientFound.nome}</strong>
              </div>
            )}
          </div>
        </fieldset>
      </div>

      {clientFound && (
        <form onSubmit={handleSubmit}>
          {error && <div style={{ padding: '1rem', backgroundColor: 'var(--color-danger-bg)', color: 'var(--color-danger)', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem' }}>{error}</div>}

          {/* ── Dados Institucionais ── */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <fieldset style={{ border: 'none', margin: 0, padding: 0 }}>
              <legend style={ls}>Dados Institucionais e Operação</legend>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.5rem' }}>
                <div>
                  <label style={fs}>Órgão</label>
                  <select name="orgao" value={form.orgao} onChange={handleChange} style={{ width: '100%' }}>
                    <option value="">Selecione...</option>
                    <option value="FEDERAL">Federal</option>
                    <option value="MUNICIPAL">Municipal</option>
                    <option value="ESTADUAL">Estadual</option>
                    <option value="PRIVADO">Privado</option>
                  </select>
                </div>
                <div>
                  <label style={fs}>Empresa</label>
                  <input name="empresa" type="text" value={form.empresa} onChange={handleChange} style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={fs}>Operação</label>
                  <select name="operacao" value={form.operacao} onChange={handleChange} required style={{ width: '100%' }}>
                    <option value="">Selecione...</option>
                    <option value="REFIN">REFIN</option>
                    <option value="NOVO">NOVO</option>
                    <option value="COMPRA">COMPRA</option>
                  </select>
                </div>
                <div>
                  <label style={fs}>Cód. Operação</label>
                  <input name="codigo_operacao" type="text" value={form.codigo_operacao} onChange={handleChange} style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={fs}>Corretor</label>
                  <input name="corretor" type="text" value={form.corretor} onChange={handleChange} style={{ width: '100%' }} />
                </div>
              </div>
            </fieldset>
          </div>

          {/* ── Valores e Condições ── */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <fieldset style={{ border: 'none', margin: 0, padding: 0 }}>
              <legend style={ls}>Valores e Condições</legend>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1.5rem' }}>
                <div>
                  <label style={{ ...fs, minHeight: '3rem', display: 'flex', alignItems: 'flex-end', paddingBottom: '0.25rem' }}>Valor Contrato (R$)</label>
                  <input name="valor" type="text" value={form.valor} onChange={handleChange} placeholder="0.00" required style={{ width: '100%', fontWeight: 600, color: 'var(--color-primary)' }} />
                </div>
                <div>
                  <label style={{ ...fs, minHeight: '3rem', display: 'flex', alignItems: 'flex-end', paddingBottom: '0.25rem' }}>Saldo Devedor (R$)</label>
                  <input name="saldo" type="text" value={form.saldo} onChange={handleChange} placeholder="0.00" style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={{ ...fs, minHeight: '3rem', display: 'flex', alignItems: 'flex-end', paddingBottom: '0.25rem' }}>Valor Líquido (R$)</label>
                  <input name="valor_liquido" type="text" value={form.valor_liquido} readOnly style={{ ...readonlyStyle }} title="Calculado automaticamente: Valor do Contrato - Saldo Devedor" />
                </div>
                <div>
                  <label style={{ ...fs, minHeight: '3rem', display: 'flex', alignItems: 'flex-end', paddingBottom: '0.25rem' }}>Parcela (R$)</label>
                  <input name="parcela" type="text" value={form.parcela} onChange={handleChange} placeholder="0.00" style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={{ ...fs, minHeight: '3rem', display: 'flex', alignItems: 'flex-end', paddingBottom: '0.25rem' }}>Prazo (meses)</label>
                  <input name="prazo" type="number" value={form.prazo} onChange={handleChange} placeholder="72" style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={{ ...fs, minHeight: '3rem', display: 'flex', alignItems: 'flex-end', paddingBottom: '0.25rem' }}>Coeficiente</label>
                  <input name="coef" type="text" value={form.coef} readOnly style={{ ...readonlyStyle }} title="Calculado automaticamente: Parcela / Valor do Contrato" />
                </div>
              </div>
            </fieldset>
          </div>

          {/* ── Dados Bancários (Débito) ── */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <fieldset style={{ border: 'none', margin: 0, padding: 0 }}>
              <legend style={ls}>Dados Bancários (Débito)</legend>
              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '1rem', marginTop: 0 }}>Estes dados serão salvos no cadastro do cliente ao finalizar.</p>
              <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 110px 90px 54px 120px 54px 70px', gap: '0.75rem', alignItems: 'end' }}>
                <div>
                  <label style={fs}>Banco</label>
                  <input name="banco" type="text" value={form.banco} onChange={handleChange} style={{ width: '100%' }} />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={fs}>Tipo de Conta</label>
                  <select name="tipo_conta" value={form.tipo_conta} onChange={handleChange} style={{ width: '100%' }}>
                    <option value="corrente">Corrente</option>
                    <option value="poupanca">Poupança</option>
                  </select>
                </div>
                <div>
                  <label style={fs}>Agência</label>
                  <input name="agencia" type="text" value={form.agencia} onChange={handleChange} style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={fs}>DV</label>
                  <input name="agencia_dv" type="text" value={form.agencia_dv} onChange={handleChange} style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={fs}>Conta</label>
                  <input name="conta" type="text" value={form.conta} onChange={handleChange} style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={fs}>DV</label>
                  <input name="conta_dv" type="text" value={form.conta_dv} onChange={handleChange} style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={fs}>OP</label>
                  <input name="op" type="text" value={form.op} onChange={handleChange} style={{ width: '100%' }} />
                </div>
              </div>
            </fieldset>
          </div>

          {/* ── Dados Para Crédito ── */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <fieldset style={{ border: 'none', margin: 0, padding: 0 }}>
              <legend style={ls}>Dados Para Crédito (Recebimento)</legend>
              <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '1rem', marginTop: 0 }}>Estes dados serão salvos no cadastro do cliente ao finalizar.</p>
              {creditBlock()}
            </fieldset>
          </div>

          {/* ── Ativação, Contrato e Lote ── */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <fieldset style={{ border: 'none', margin: 0, padding: 0 }}>
              <legend style={ls}>Ativação, Contrato e Lote</legend>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.5rem' }}>
                <div>
                  <label style={fs}>Nº do Contrato {form.operacao === 'REFIN' && <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>(= Cód. Op.)</span>}</label>
                  <input name="contrato" type="text" value={form.contrato} onChange={handleChange}
                    readOnly={form.operacao === 'REFIN'}
                    style={{ width: '100%', ...(form.operacao === 'REFIN' ? readonlyStyle : {}) }} />
                </div>
                <div>
                  <label style={fs}>Empresa Ativação</label>
                  <input name="empresa_ativacao" type="text" value={form.empresa_ativacao} onChange={handleChange} style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={fs}>Conta Ativação</label>
                  <input name="conta_ativacao" type="text" value={form.conta_ativacao} onChange={handleChange} style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={fs}>Data Início</label>
                  <input name="inicio" type="date" value={form.inicio} onChange={handleChange} style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={fs}>Dia Útil Adicional</label>
                  <input name="dia_util" type="text" value={form.dia_util} onChange={handleChange} style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={fs}>Junção / Lote</label>
                  <input name="juncao" type="text" value={form.juncao} onChange={handleChange} style={{ width: '100%' }} />
                </div>
              </div>
            </fieldset>
          </div>

          {/* ── Observações ── */}
          <div className="card" style={{ marginBottom: '1.5rem' }}>
            <fieldset style={{ border: 'none', margin: 0, padding: 0 }}>
              <legend style={ls}>Considerações Finais</legend>
              <label style={fs}>Observação da Operação</label>
              <textarea name="observacao" value={form.observacao} onChange={handleChange} rows={4} placeholder="Adicione pendências, detalhes ou acordos com o cliente." style={{ width: '100%', resize: 'vertical' }} />
            </fieldset>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid var(--color-border)', paddingTop: '1.5rem' }}>
            <Link href="/borderos" className="btn btn-secondary">Cancelar</Link>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Salvando...' : 'Finalizar Cadastro'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
