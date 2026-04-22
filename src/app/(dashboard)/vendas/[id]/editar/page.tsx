'use client';

import { useState, useEffect, useCallback, useMemo, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { ArrowLeft, CheckCircle2, Search, AlertTriangle, UserPlus, Info, ListFilter, Calculator, User, Building, Loader2, Landmark, Wallet } from 'lucide-react';
import { validateCPF, formatCPF } from '@/lib/cpf';
import { ConfirmModal } from '@/components/ConfirmModal';

// ── Helpers ──────────────────────────────────────────────────────────────────
const fs = { display: 'block', marginBottom: '0.5rem', fontWeight: 500, fontSize: '0.85rem' } as const;
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

const getPrazoByCoef = (coef: number): number | string => {
  if (coef >= 1.170 && coef <= 1.190) return 1;
  if (coef >= 0.531 && coef <= 0.632) return 3;
  if (coef >= 0.366 && coef <= 0.399) return 4;
  if (coef >= 0.320 && coef <= 0.341) return 6;
  if (coef >= 0.260 && coef <= 0.291) return 8;
  if (coef >= 0.189 && coef <= 0.199) return 12;
  if (coef >= 0.149 && coef <= 0.160) return 15;
  return '';
};

export default function EditarVenda(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  const router = useRouter();
  
  const [fetching, setFetching] = useState(true);
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [error, setError] = useState('');
  const [duplicateModal, setDuplicateModal] = useState(false);
  const [alertModal, setAlertModal] = useState<{ show: boolean, title: string, message: string }>({ show: false, title: '', message: '' });
  
  const [cpf, setCpf] = useState('');
  const [clientFound, setClientFound] = useState<any>(null);
  const [searchInitiated, setSearchInitiated] = useState(false);
  const [operacoesDisponiveis, setOperacoesDisponiveis] = useState<any[]>([]);
  const [selectedOpIds, setSelectedOpIds] = useState<number[]>([]);

  const [form, setForm] = useState({
    orgao: '', empresa: '', operacao: 'REFIN', codigo_operacao: '', corretor: '',
    valor: '', saldo: '', valor_liquido: '', coef: '', parcela: '', prazo: '',
    banco: '', agencia: '', agencia_dv: '', op: '', conta: '', conta_dv: '', tipo_conta: 'corrente',
    contrato: '', empresa_ativacao: '', conta_ativacao: '',
    inicio_mes: '', inicio_ano: new Date().getFullYear().toString(),
    dia_util: '', empresa_credora: '', observacao: '',
    forma_credito: 'conta', pix_tipo_chave: '', pix_chave: '',
    credito_banco: '', credito_agencia: '', credito_agencia_dv: '',
    credito_conta: '', credito_conta_dv: '', credito_tipo_conta: 'corrente'
  });

  const showAlert = (title: string, message: string) => {
    setAlertModal({ show: true, title, message });
  };

  // Carregamento inicial
  useEffect(() => {
    const fetchVenda = async () => {
      try {
        const { data: venda, error: vError } = await supabase.schema('pro_consig').from('vendas').select('*').eq('id', params.id).single();
        if (vError) throw vError;

        if (venda) {
          setCpf(venda.cpf);
          
          let mes = '', ano = new Date().getFullYear().toString();
          if (venda.inicio) {
            const d = new Date(venda.inicio);
            mes = (d.getUTCMonth() + 1).toString().padStart(2, '0');
            ano = d.getUTCFullYear().toString();
          }

          setForm({
            orgao: venda.orgao || '',
            empresa: venda.empresa || '',
            operacao: venda.operacao || 'REFIN',
            codigo_operacao: venda.codigo_operacao || '',
            corretor: venda.corretor || '',
            valor: venda.valor ? venda.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '',
            saldo: venda.saldo ? venda.saldo.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '',
            valor_liquido: venda.abat ? venda.abat.toString().replace('.', ',') : '',
            parcela: venda.parcela ? venda.parcela.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '',
            coef: venda.coef ? venda.coef.toFixed(3).replace('.', ',') : '',
            prazo: venda.prazo ? venda.prazo.toString() : '',
            banco: venda.banco || '',
            agencia: venda.agencia || '',
            agencia_dv: venda.agencia_dv || '',
            op: venda.op || '',
            conta: venda.conta || '',
            conta_dv: venda.conta_dv || '',
            tipo_conta: venda.tipo_conta || 'corrente',
            contrato: venda.contrato || '',
            empresa_ativacao: venda.empresa_ativacao || '',
            conta_ativacao: venda.conta_ativacao || '',
            inicio_mes: mes,
            inicio_ano: ano,
            dia_util: venda.dia_util || '',
            empresa_credora: venda.empresa_credora || '',
            observacao: venda.observacao || '',
            forma_credito: venda.forma_credito || 'conta',
            pix_tipo_chave: venda.pix_tipo_chave || '',
            pix_chave: venda.pix_chave || '',
            credito_banco: venda.credito_banco || '',
            credito_agencia: venda.credito_agencia || '',
            credito_agencia_dv: venda.credito_agencia_dv || '',
            credito_conta: venda.credito_conta || '',
            credito_conta_dv: venda.credito_conta_dv || '',
            credito_tipo_conta: venda.credito_tipo_conta || 'corrente'
          });

          // Carrega cliente e operações
          const { data: cliente } = await supabase.from('clientes').select('*').eq('cpf', venda.cpf).single();
          if (cliente) {
            setClientFound(cliente);
            setSearchInitiated(true);
            const { data: ops } = await supabase.from('operacoes').select('*').eq('cpf', venda.cpf);
            const { data: otherVendas } = await supabase.schema('pro_consig').from('vendas').select('contrato').eq('cpf', venda.cpf).neq('id', params.id);
            if (ops) {
              const soldElsewhere = new Set(otherVendas?.map(v => v.contrato) || []);
              setOperacoesDisponiveis(ops.filter(o => !soldElsewhere.has(o.operacao.toString())));
            }
          }
        }
      } catch (err: any) {
        setError('Erro ao carregar: ' + err.message);
      } finally {
        setFetching(false);
      }
    };
    fetchVenda();
  }, [params.id]);

  const buscarCliente = async () => {
    if (!validateCPF(cpf)) return showAlert('CPF Inválido', 'Informe um CPF válido.');
    setSearchLoading(true);
    setSearchInitiated(true);
    const formattedCpf = formatCPF(cpf);
    const { data: cliente } = await supabase.from('clientes').select('*').eq('cpf', formattedCpf).single();
    if (cliente) {
      setClientFound(cliente);
      const { data: ops } = await supabase.from('operacoes').select('*').eq('cpf', formattedCpf);
      const { data: existingVendas } = await supabase.schema('pro_consig').from('vendas').select('contrato').eq('cpf', formattedCpf).neq('id', params.id);
      if (ops) {
        const sold = new Set(existingVendas?.map(v => v.contrato) || []);
        setOperacoesDisponiveis(ops.filter(o => !sold.has(o.operacao.toString())));
      }
    } else {
      setClientFound(null);
      setOperacoesDisponiveis([]);
    }
    setSearchLoading(false);
  };

  const codigosUnicos = useMemo(() => Array.from(new Set(operacoesDisponiveis.map(o => o.operacao.toString()))), [operacoesDisponiveis]);

  const parcelasExibidas = useMemo(() => {
    if (form.operacao !== 'REFIN' || !form.codigo_operacao) return [];
    return operacoesDisponiveis
      .filter(o => o.operacao.toString() === form.codigo_operacao)
      .sort((a, b) => new Date(a.vencimento).getTime() - new Date(b.vencimento).getTime())
      .map((o, index) => {
        const hoje = new Date();
        const venc = new Date(o.vencimento);
        const diffTime = venc.getTime() - hoje.getTime();
        const dias = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const rate = o.grupo === 2 ? 0.0022 : 0;
        const percDesconto = dias > 0 ? (dias * rate) : 0;
        const valorDesconto = o.valor * percDesconto;
        return {
          ...o, numParcela: index + 1, dias: dias > 0 ? dias : 0,
          percDesconto: (percDesconto * 100).toFixed(2),
          valorDesconto, valorComDesconto: o.valor - valorDesconto
        };
      });
  }, [form.operacao, form.codigo_operacao, operacoesDisponiveis]);

  const totaisRefin = useMemo(() => {
    const selecionadas = parcelasExibidas.filter(p => selectedOpIds.includes(p.id));
    const bruto = selecionadas.reduce((acc, curr) => acc + curr.valor, 0);
    const liquido = selecionadas.reduce((acc, curr) => acc + curr.valorComDesconto, 0);
    return { bruto, liquido, qtd: selecionadas.length, total: parcelasExibidas.length };
  }, [parcelasExibidas, selectedOpIds]);

  const isAllSelected = useMemo(() => parcelasExibidas.length > 0 && selectedOpIds.length === parcelasExibidas.length, [parcelasExibidas, selectedOpIds]);

  const handleSelectAll = () => {
    if (isAllSelected) setSelectedOpIds([]);
    else setSelectedOpIds(parcelasExibidas.map(p => p.id));
  };

  useEffect(() => {
    if (totaisRefin.liquido > 0) setForm(f => ({ ...f, saldo: totaisRefin.liquido.toFixed(2).replace('.', ',') }));
  }, [totaisRefin.liquido]);

  useEffect(() => {
    if (form.operacao === 'REFIN' && form.codigo_operacao) setForm(f => ({ ...f, contrato: f.codigo_operacao }));
  }, [form.operacao, form.codigo_operacao]);

  useEffect(() => {
    const v = parseFloat(form.valor.replace(/\./g, '').replace(',', '.')) || 0;
    const s = parseFloat(form.saldo.replace(/\./g, '').replace(',', '.')) || 0;
    if (v > 0 || s > 0) setForm(f => ({ ...f, valor_liquido: (v - s).toFixed(2).replace('.', ',') }));
  }, [form.valor, form.saldo]);

  useEffect(() => {
    const v = parseFloat(form.valor.replace(/\./g, '').replace(',', '.')) || 0;
    const p = parseFloat(form.parcela.replace(/\./g, '').replace(',', '.')) || 0;
    if (v > 0 && p > 0) {
      const rawCoef = p / v;
      const roundedCoef = Math.round(rawCoef * 1000) / 1000;
      const calculatedPrazo = getPrazoByCoef(roundedCoef);
      setForm(f => ({
        ...f,
        coef: roundedCoef.toFixed(3).replace('.', ','),
        prazo: calculatedPrazo.toString()
      }));
    }
  }, [form.valor, form.parcela]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (e.target.name === 'operacao' && e.target.value !== 'REFIN') setSelectedOpIds([]);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (!value) return;
    let num = parseFloat(value.replace(/\./g, '').replace(',', '.'));
    if (!isNaN(num)) setForm(f => ({ ...f, [name]: num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }));
  };

  const toggleOpSelection = (id: number) => setSelectedOpIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientFound) return showAlert('Atenção', 'Busque o cliente.');
    if (form.operacao === 'REFIN' && selectedOpIds.length === 0) return showAlert('Atenção', 'Selecione as parcelas.');
    if (!form.prazo) return showAlert('Atenção', 'Prazo não identificado.');

    setLoading(true);
    setError('');

    try {
      // Valida duplicidade excluindo esta venda
      const { data: duplicate } = await supabase.schema('pro_consig').from('vendas').select('id').eq('cpf', formatCPF(cpf)).eq('contrato', form.contrato).neq('id', params.id).maybeSingle();
      if (duplicate) { setDuplicateModal(true); setLoading(false); return; }

      const dataInicio = (form.inicio_mes && form.inicio_ano) ? `${form.inicio_ano}-${form.inicio_mes}-01` : null;

      const { error: updateError } = await supabase.schema('pro_consig').from('vendas').update({
        cpf: formatCPF(cpf),
        orgao: form.orgao, empresa: form.empresa, operacao: form.operacao,
        codigo_operacao: form.codigo_operacao, corretor: form.corretor,
        valor: parseFloat(form.valor.replace(/\./g, '').replace(',', '.')) || null,
        saldo: parseFloat(form.saldo.replace(/\./g, '').replace(',', '.')) || null,
        abat: form.valor_liquido,
        coef: parseFloat(form.coef.replace(/\./g, '').replace(',', '.')) || null,
        parcela: parseFloat(form.parcela.replace(/\./g, '').replace(',', '.')) || null,
        prazo: parseInt(form.prazo) || null,
        banco: form.banco, agencia: form.agencia, agencia_dv: form.agencia_dv,
        op: form.op, conta: form.conta, conta_dv: form.conta_dv, tipo_conta: form.tipo_conta,
        contrato: form.contrato, empresa_ativacao: form.empresa_ativacao,
        conta_ativacao: form.conta_ativacao, inicio: dataInicio,
        dia_util: form.dia_util, empresa_credora: form.empresa_credora, observacao: form.observacao,
        forma_credito: form.forma_credito, pix_tipo_chave: form.pix_tipo_chave,
        pix_chave: form.pix_chave, credito_banco: form.credito_banco,
        credito_agencia: form.credito_agencia, credito_agencia_dv: form.credito_agencia_dv,
        credito_conta: form.credito_conta, credito_conta_dv: form.credito_conta_dv,
        credito_tipo_conta: form.credito_tipo_conta
      }).eq('id', params.id);

      if (updateError) throw updateError;
      router.push('/vendas');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  if (fetching) return <div className="card" style={{ textAlign: 'center', padding: '4rem' }}><Loader2 className="animate-spin" style={{ margin: '0 auto' }} /> Carregando...</div>;

  return (
    <>
      <ConfirmModal isOpen={alertModal.show} title={alertModal.title} message={alertModal.message} onConfirm={() => setAlertModal({ show: false, title: '', message: '' })} confirmText="Entendi" />
      <ConfirmModal isOpen={duplicateModal} title="Venda Duplicada" message="Já existe outra venda para este contrato." onConfirm={() => setDuplicateModal(false)} confirmText="Fechar" confirmType="danger" />

      <div className="animate-fade-in" style={{ maxWidth: '1050px', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1.5rem', gap: '1rem' }}>
          <Link href="/vendas" className="btn btn-secondary" style={{ padding: '0.5rem' }}><ArrowLeft size={20} /></Link>
          <h1 style={{ margin: 0 }}>Editar Venda</h1>
        </div>

        {error && (
          <div className="card animate-fade-in" style={{ marginBottom: '1.5rem', backgroundColor: 'rgba(239, 68, 68, 0.08)', borderColor: 'var(--color-danger)', color: 'var(--color-danger)', display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '1rem' }}>
            <AlertTriangle size={24} />
            <div style={{ fontSize: '0.9rem' }}><strong>Erro:</strong> {error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* IDENTIFICAÇÃO */}
          <div className="card" style={{ marginBottom: '1rem', backgroundColor: 'var(--color-bg-surface-hover)' }}>
            <legend style={ls}>Identificação do Cliente</legend>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <div style={{ maxWidth: '280px', flex: 1 }}>
                <label style={fs}>CPF do Cliente</label>
                <input type="text" value={cpf} onChange={e => setCpf(formatCPF(e.target.value))} placeholder="000.000.000-00" style={{ width: '100%' }} />
              </div>
              <button type="button" className="btn btn-secondary" style={{ marginTop: '1.5rem', padding: '0.65rem' }} onClick={buscarCliente} disabled={searchLoading}><Search size={20} /></button>
              {clientFound && (
                <div className="animate-scale-up" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-success)', marginTop: '1.5rem' }}>
                  <CheckCircle2 size={20} /> <strong>{clientFound.nome}</strong>
                </div>
              )}
            </div>
          </div>

          {searchLoading ? (
            <div className="card" style={{ textAlign: 'center', padding: '4rem' }}><Loader2 size={40} className="animate-spin" style={{ color: 'var(--color-primary)', margin: '0 auto' }} /><p>Buscando dados...</p></div>
          ) : clientFound ? (
            <div className="animate-fade-in">
              <div className="card" style={{ marginBottom: '1rem' }}>
                <legend style={ls}>Dados Institucionais e Operação</legend>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem' }}>
                  <div><label style={fs}>Órgão</label><input name="orgao" type="text" value={form.orgao} onChange={handleChange} required style={{ width: '100%' }} /></div>
                  <div><label style={fs}>Empresa</label><input name="empresa" type="text" value={form.empresa} onChange={handleChange} required style={{ width: '100%' }} /></div>
                  <div><label style={fs}>Operação</label><select name="operacao" value={form.operacao} onChange={handleChange} required style={{ width: '100%' }}><option value="REFIN">REFIN</option><option value="NOVO">NOVO</option><option value="COMPRA">COMPRA</option></select></div>
                  <div><label style={fs}>Cód. Operação</label>{form.operacao === 'REFIN' && codigosUnicos.length > 0 ? (<select name="codigo_operacao" value={form.codigo_operacao} onChange={handleChange} required style={{ width: '100%' }}><option value="">Selecione...</option>{codigosUnicos.map(c => <option key={c} value={c}>{c}</option>)}</select>) : (<input name="codigo_operacao" type="text" value={form.codigo_operacao} onChange={handleChange} required style={{ width: '100%' }} />)}</div>
                  <div><label style={fs}>Corretor</label><input name="corretor" type="text" value={form.corretor} onChange={handleChange} required style={{ width: '100%' }} /></div>
                </div>
              </div>

              {/* GRID REFIN */}
              {form.operacao === 'REFIN' && form.codigo_operacao && (
                <div className="card animate-fade-in" style={{ marginBottom: '1rem', border: '1px solid var(--color-primary-light)', backgroundColor: 'rgba(79, 70, 229, 0.01)' }}>
                  <legend style={ls}><div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><ListFilter size={18} /> Detalhes da Operação {form.codigo_operacao}</div></legend>
                  <div className="table-wrapper" style={{ border: '1px solid var(--color-border)' }}>
                    <table className="table table-sm" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                      <thead>
                        <tr>
                          <th style={{ width: '44px', position: 'sticky', top: 0, zIndex: 10, backgroundColor: 'var(--color-bg-surface-hover)', borderBottom: '2px solid var(--color-border)', textAlign: 'center', padding: '0.5rem' }}>
                            <input type="checkbox" checked={isAllSelected} onChange={handleSelectAll} style={{ cursor: 'pointer', verticalAlign: 'middle' }} />
                          </th>
                          <th style={{ width: '60px', position: 'sticky', top: 0, zIndex: 10, backgroundColor: 'var(--color-bg-surface-hover)', borderBottom: '2px solid var(--color-border)', textAlign: 'right' }}>Parcela</th>
                          <th style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: 'var(--color-bg-surface-hover)', borderBottom: '2px solid var(--color-border)', textAlign: 'center' }}>Vencimento</th>
                          <th style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: 'var(--color-bg-surface-hover)', borderBottom: '2px solid var(--color-border)', textAlign: 'right' }}>Valor (R$)</th>
                          <th style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: 'var(--color-bg-surface-hover)', borderBottom: '2px solid var(--color-border)', textAlign: 'center' }}>Dias</th>
                          <th style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: 'var(--color-bg-surface-hover)', borderBottom: '2px solid var(--color-border)', textAlign: 'center' }}>% Desconto</th>
                          <th style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: 'var(--color-bg-surface-hover)', borderBottom: '2px solid var(--color-border)', textAlign: 'right' }}>Desconto (R$)</th>
                          <th style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: 'var(--color-bg-surface-hover)', borderBottom: '2px solid var(--color-border)', textAlign: 'right' }}>Líquido (R$)</th>
                          <th style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: 'var(--color-bg-surface-hover)', borderBottom: '2px solid var(--color-border)', textAlign: 'center' }}>Grupo</th>
                        </tr>
                      </thead>
                      <tbody style={{ fontSize: '0.8125rem' }}>
                        {parcelasExibidas.map(p => (
                          <tr key={p.id} onClick={() => toggleOpSelection(p.id)} style={{ cursor: 'pointer', backgroundColor: selectedOpIds.includes(p.id) ? 'rgba(79, 70, 229, 0.06)' : 'transparent' }}>
                            <td style={{ padding: '0.4rem 0.5rem', width: '44px', textAlign: 'center' }}>
                              <input type="checkbox" checked={selectedOpIds.includes(p.id)} readOnly style={{ verticalAlign: 'middle' }} />
                            </td>
                            <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right', fontWeight: 600, color: 'var(--color-text-muted)' }}>{p.numParcela}</td>
                            <td style={{ padding: '0.4rem 0.5rem', textAlign: 'center' }}>{new Date(p.vencimento).toLocaleDateString('pt-BR')}</td>
                            <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right', fontWeight: 500 }}>{p.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                            <td style={{ padding: '0.4rem 0.5rem', textAlign: 'center' }}>{p.dias}</td>
                            <td style={{ padding: '0.4rem 0.5rem', textAlign: 'center', color: 'var(--color-danger)' }}>{p.percDesconto}%</td>
                            <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right', color: 'var(--color-danger)' }}>- {p.valorDesconto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                            <td style={{ padding: '0.4rem 0.5rem', textAlign: 'right', fontWeight: 600, color: 'var(--color-success)' }}>{p.valorComDesconto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                            <td style={{ padding: '0.4rem 0.5rem', textAlign: 'center', fontWeight: 600 }}>G{p.grupo}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ marginTop: '0.75rem', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.75rem' }}>
                    <div className="card" style={{ padding: '0.5rem', textAlign: 'center', border: '1px solid var(--color-border)' }}><span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Total Parcelas</span><div style={{ fontSize: '1rem', fontWeight: 700 }}>{totaisRefin.total}</div></div>
                    <div className="card" style={{ padding: '0.5rem', textAlign: 'center', border: '1px solid var(--color-border)' }}><span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Selecionadas</span><div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-primary)' }}>{totaisRefin.qtd}</div></div>
                    <div className="card" style={{ padding: '0.5rem', textAlign: 'center', border: '1px solid var(--color-border)' }}><span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Total Bruto</span><div style={{ fontSize: '1rem', fontWeight: 700 }}>R$ {totaisRefin.bruto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div></div>
                    <div className="card" style={{ padding: '0.5rem', textAlign: 'center', border: '1px solid var(--color-border)' }}><span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Total Líquido</span><div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--color-success)' }}>R$ {totaisRefin.liquido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div></div>
                  </div>
                </div>
              )}

              <div className="card" style={{ marginBottom: '1rem' }}>
                <legend style={ls}>Valores e Condições</legend>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '1rem' }}>
                  <div><label style={fs}>Contrato (R$)</label><input name="valor" type="text" value={form.valor} onChange={handleChange} onBlur={handleBlur} required style={{ width: '100%', fontWeight: 700, color: 'var(--color-primary)' }} /></div>
                  <div><label style={fs}>Saldo (R$)</label><input name="saldo" type="text" value={form.saldo} onChange={handleChange} onBlur={handleBlur} required style={{ width: '100%' }} /></div>
                  <div><label style={fs}>Líquido (R$)</label><input name="valor_liquido" type="text" value={form.valor_liquido} readOnly style={readonlyStyle} /></div>
                  <div><label style={fs}>Parcela (R$)</label><input name="parcela" type="text" value={form.parcela} onChange={handleChange} onBlur={handleBlur} required style={{ width: '100%' }} /></div>
                  <div><label style={fs}>Coeficiente</label><input name="coef" type="text" value={form.coef} readOnly style={readonlyStyle} /></div>
                  <div><label style={fs}>Prazo</label><input name="prazo" type="text" value={form.prazo} readOnly style={readonlyStyle} /></div>
                </div>
              </div>

              <div className="card" style={{ marginBottom: '1rem' }}>
                <legend style={ls}><Landmark size={18} /> Dados Bancários (Débito)</legend>
                <div style={{ display: 'grid', gridTemplateColumns: '120px 180px 100px 60px 120px 60px 60px', gap: '1rem' }}>
                  <div><label style={fs}>Banco</label><input name="banco" type="text" value={form.banco} onChange={handleChange} style={{ width: '100%' }} /></div>
                  <div><label style={fs}>Tipo Conta</label><select name="tipo_conta" value={form.tipo_conta} onChange={handleChange} style={{ width: '100%' }}><option value="corrente">Corrente</option><option value="poupanca">Poupança</option></select></div>
                  <div><label style={fs}>Agência</label><input name="agencia" type="text" value={form.agencia} onChange={handleChange} style={{ width: '100%' }} /></div>
                  <div><label style={fs}>DV</label><input name="agencia_dv" type="text" value={form.agencia_dv} onChange={handleChange} style={{ width: '100%' }} /></div>
                  <div><label style={fs}>Conta</label><input name="conta" type="text" value={form.conta} onChange={handleChange} style={{ width: '100%' }} /></div>
                  <div><label style={fs}>DV</label><input name="conta_dv" type="text" value={form.conta_dv} onChange={handleChange} style={{ width: '100%' }} /></div>
                  <div><label style={fs}>OP</label><input name="op" type="text" value={form.op} onChange={handleChange} style={{ width: '100%' }} /></div>
                </div>
              </div>

              <div className="card" style={{ marginBottom: '1rem' }}>
                <legend style={ls}><Wallet size={18} /> Dados Para Crédito (Recebimento)</legend>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={fs}>Forma de Recebimento</label>
                  <select name="forma_credito" value={form.forma_credito} onChange={handleChange} style={{ width: '300px' }}>
                    <option value="conta">Crédito em Conta</option>
                    <option value="pix">PIX</option>
                    <option value="ordem">Ordem de Pagamento</option>
                  </select>
                </div>
                {form.forma_credito === 'conta' && (
                  <div className="animate-fade-in" style={{ display: 'grid', gridTemplateColumns: '120px 180px 100px 60px 120px 60px', gap: '1rem' }}>
                    <div><label style={fs}>Banco</label><input name="credito_banco" type="text" value={form.credito_banco} onChange={handleChange} style={{ width: '100%' }} /></div>
                    <div><label style={fs}>Tipo Conta</label><select name="credito_tipo_conta" value={form.credito_tipo_conta} onChange={handleChange} style={{ width: '100%' }}><option value="corrente">Corrente</option><option value="poupanca">Poupança</option></select></div>
                    <div><label style={fs}>Agência</label><input name="credito_agencia" type="text" value={form.credito_agencia} onChange={handleChange} style={{ width: '100%' }} /></div>
                    <div><label style={fs}>DV</label><input name="credito_agencia_dv" type="text" value={form.credito_agencia_dv} onChange={handleChange} style={{ width: '100%' }} /></div>
                    <div><label style={fs}>Conta</label><input name="credito_conta" type="text" value={form.credito_conta} onChange={handleChange} style={{ width: '100%' }} /></div>
                    <div><label style={fs}>DV</label><input name="credito_conta_dv" type="text" value={form.credito_conta_dv} onChange={handleChange} style={{ width: '100%' }} /></div>
                  </div>
                )}
                {form.forma_credito === 'pix' && (
                  <div className="animate-fade-in" style={{ display: 'flex', gap: '1rem' }}>
                    <div style={{ width: '200px' }}><label style={fs}>Tipo de Chave</label><select name="pix_tipo_chave" value={form.pix_tipo_chave} onChange={handleChange} style={{ width: '100%' }}><option value="">Selecione...</option><option value="cpf">CPF</option><option value="celular">Celular</option><option value="email">E-mail</option><option value="aleatoria">Chave Aleatória</option></select></div>
                    <div style={{ flex: 1 }}><label style={fs}>Chave PIX</label><input name="pix_chave" type="text" value={form.pix_chave} onChange={handleChange} style={{ width: '100%' }} /></div>
                  </div>
                )}
              </div>

              <div className="card" style={{ marginBottom: '1rem' }}>
                <legend style={ls}>Ativação, Contrato e Lote</legend>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                  <div><label style={fs}>Nº do Contrato</label><input name="contrato" type="text" value={form.contrato} onChange={handleChange} disabled={form.operacao === 'REFIN'} required style={form.operacao === 'REFIN' ? readonlyStyle : { width: '100%' }} /></div>
                  <div><label style={fs}>Empresa Ativação</label><input name="empresa_ativacao" type="text" value={form.empresa_ativacao} onChange={handleChange} required style={{ width: '100%' }} /></div>
                  <div><label style={fs}>Conta Ativação</label><input name="conta_ativacao" type="text" value={form.conta_ativacao} onChange={handleChange} required style={{ width: '100%' }} /></div>
                  <div><label style={fs}>Dia Útil Adicional</label><input name="dia_util" type="text" value={form.dia_util} onChange={handleChange} required style={{ width: '100%' }} /></div>
                  <div><label style={fs}>Empresa Credora</label><input name="empresa_credora" type="text" value={form.empresa_credora} onChange={handleChange} required style={{ width: '100%' }} /></div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <div style={{ flex: 1 }}><label style={fs}>Mês</label><select name="inicio_mes" value={form.inicio_mes} onChange={handleChange} required style={{ width: '100%' }}><option value="">--</option>{['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'].map(m => <option key={m} value={m}>{m}</option>)}</select></div>
                    <div style={{ flex: 1.5 }}><label style={fs}>Ano</label><input name="inicio_ano" type="number" value={form.inicio_ano} onChange={handleChange} required style={{ width: '100%' }} /></div>
                  </div>
                </div>
              </div>

              <div className="card" style={{ marginBottom: '1.5rem' }}>
                <legend style={ls}>Observações</legend>
                <textarea name="observacao" value={form.observacao} onChange={handleChange} rows={2} style={{ width: '100%' }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', marginBottom: '2rem' }}>
                <Link href="/vendas" className="btn btn-secondary">Cancelar</Link>
                <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Salvando...' : 'Salvar Alterações'}</button>
              </div>
            </div>
          ) : (
             <div style={{ textAlign: 'center', padding: '4rem' }}>Aguardando CPF...</div>
          )}
        </form>
      </div>
    </>
  );
}
