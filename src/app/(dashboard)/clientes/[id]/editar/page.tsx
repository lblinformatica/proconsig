'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabaseClient';
import { ArrowLeft, Building2, CreditCard, Wallet, Search, Plus, Trash2, Edit, X, Phone } from 'lucide-react';
import { validateCPF, formatCPF } from '@/lib/cpf';
import { formatCEP, formatPhone, formatMoney, parseMoneyToNumber } from '@/lib/formatters';
import { ESPECIE_OPTIONS } from '@/lib/constants';
import { ConfirmModal } from '@/components/ConfirmModal';

const fieldStyle = { display: 'block', marginBottom: '0.5rem', fontWeight: 500 } as const;
const gridStyle = (cols: string) => ({ display: 'grid', gridTemplateColumns: cols, gap: '1.5rem' });
const legendStyle = {
  fontSize: '1rem', fontWeight: 600, color: 'var(--color-primary)',
  marginBottom: '1.25rem', display: 'block', width: '100%',
  borderBottom: '1px solid var(--color-border)', paddingBottom: '0.25rem'
} as const;

const ESTADOS_BR = [
  { value: 'AC', label: 'Acre' },
  { value: 'AL', label: 'Alagoas' },
  { value: 'AP', label: 'Amapá' },
  { value: 'AM', label: 'Amazonas' },
  { value: 'BA', label: 'Bahia' },
  { value: 'CE', label: 'Ceará' },
  { value: 'DF', label: 'Distrito Federal' },
  { value: 'ES', label: 'Espírito Santo' },
  { value: 'GO', label: 'Goiás' },
  { value: 'MA', label: 'Maranhão' },
  { value: 'MT', label: 'Mato Grosso' },
  { value: 'MS', label: 'Mato Grosso do Sul' },
  { value: 'MG', label: 'Minas Gerais' },
  { value: 'PA', label: 'Pará' },
  { value: 'PB', label: 'Paraíba' },
  { value: 'PR', label: 'Paraná' },
  { value: 'PE', label: 'Pernambuco' },
  { value: 'PI', label: 'Piauí' },
  { value: 'RJ', label: 'Rio de Janeiro' },
  { value: 'RN', label: 'Rio Grande do Norte' },
  { value: 'RS', label: 'Rio Grande do Sul' },
  { value: 'RO', label: 'Rondônia' },
  { value: 'RR', label: 'Roraima' },
  { value: 'SC', label: 'Santa Catarina' },
  { value: 'SP', label: 'São Paulo' },
  { value: 'SE', label: 'Sergipe' },
  { value: 'TO', label: 'Tocantins' }
];

const ESTADO_CIVIL_OPTIONS = [
  { value: 'Solteiro(a)', label: 'Solteiro(a)' },
  { value: 'Casado(a)', label: 'Casado(a)' },
  { value: 'Divorciado(a)', label: 'Divorciado(a)' },
  { value: 'Viúvo(a)', label: 'Viúvo(a)' },
  { value: 'União Estável', label: 'União Estável' }
];


async function lookupBanco(codigo: string): Promise<string> {
  if (!codigo || codigo.length < 1) return '';
  const { data } = await supabase.from('bancos').select('nome').eq('codigo', codigo.padStart(3, '0')).single();
  return data?.nome ?? '';
}

export default function EditarCliente() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');
  const [cpfError, setCpfError] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const [form, setForm] = useState({
    cpf: '', nome: '',
    banco: '', banco_nome: '', agencia: '', agencia_dv: '', conta: '', conta_dv: '', op: '', tipo_conta: 'corrente',
    forma_credito: '' as '' | 'conta' | 'pix',
    credito_banco: '', credito_banco_nome: '', credito_agencia: '', credito_agencia_dv: '',
    credito_tipo_conta: 'corrente', credito_conta: '', credito_conta_dv: '',
    pix_tipo_chave: 'cpf', pix_chave: '',
    // Novos campos
    data_nascimento: '',
    sexo: '',
    tipo_cliente: '',
    endereco: '',
    numero: '',
    complemento: '',
    bairro: '',
    cep: '',
    estado: '',
    cidade: '',
    naturalidade: '',
    estado_civil: '',
    rg: '',
    uf_rg: '',
    orgao_expedidor: '',
    data_emissao_rg: '',
    conjuge: '',
    nome_pai: '',
    nome_mae: '',
    email: '',
    nacionalidade: 'Brasileira',
    especie: '',
    salario: '0,00',
    ocupacao: '',
    ocupacao_detalhe: '',
    data_admissao: ''
  });

  // Telefones modal state
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [cepErrorModal, setCepErrorModal] = useState({ isOpen: false, title: '', message: '' });
  const [telefones, setTelefones] = useState<Array<{ id?: string; telefone: string; tipo: string; observacao: string }>>([]);
  const [editingPhoneIndex, setEditingPhoneIndex] = useState<number | null>(null);
  const [phoneForm, setPhoneForm] = useState({
    telefone: '',
    tipo: 'Celular',
    observacao: ''
  });

  useEffect(() => {
    if (!id) return;
    const fetchCliente = async () => {
      try {
        const { data, error } = await supabase.from('clientes').select('*').eq('id', id).single();
        if (error) throw error;
        if (data) {
          setForm({
            cpf: data.cpf || '', nome: data.nome || '',
            banco: data.banco || '', banco_nome: '', agencia: data.agencia || '',
            agencia_dv: data.agencia_dv || '', conta: data.conta || '',
            conta_dv: data.conta_dv || '', op: data.op || '', tipo_conta: data.tipo_conta || 'corrente',
            forma_credito: data.forma_credito || '',
            credito_banco: data.credito_banco || '', credito_banco_nome: '',
            credito_agencia: data.credito_agencia || '', credito_agencia_dv: data.credito_agencia_dv || '',
            credito_tipo_conta: data.credito_tipo_conta || 'corrente',
            credito_conta: data.credito_conta || '', credito_conta_dv: data.credito_conta_dv || '',
            pix_tipo_chave: data.pix_tipo_chave || 'cpf', pix_chave: data.pix_chave || '',
            // Novos campos
            data_nascimento: data.data_nascimento || '',
            sexo: data.sexo || '',
            tipo_cliente: data.tipo_cliente || '',
            endereco: data.endereco || '',
            numero: data.numero || '',
            complemento: data.complemento || '',
            bairro: data.bairro || '',
            cep: data.cep ? formatCEP(data.cep) : '',
            estado: data.estado || '',
            cidade: data.cidade || '',
            naturalidade: data.naturalidade || '',
            estado_civil: data.estado_civil || '',
            rg: data.rg || '',
            uf_rg: data.uf_rg || '',
            orgao_expedidor: data.orgao_expedidor || '',
            data_emissao_rg: data.data_emissao_rg || '',
            conjuge: data.conjuge || '',
            nome_pai: data.nome_pai || '',
            nome_mae: data.nome_mae || '',
            email: data.email || '',
            nacionalidade: data.nacionalidade || 'Brasileira',
            especie: data.especie || '',
            salario: formatMoney((data.salario || 0).toString()),
            ocupacao: data.ocupacao || '',
            ocupacao_detalhe: data.ocupacao_detalhe || '',
            data_admissao: data.data_admissao || ''
          });
          // Populate bank names
          const [nomeBanco, nomeCredito] = await Promise.all([
            lookupBanco(data.banco || ''),
            lookupBanco(data.credito_banco || '')
          ]);
          setForm(f => ({ ...f, banco_nome: nomeBanco, credito_banco_nome: nomeCredito }));
        }

        // Buscar telefones cadastrados
        const { data: phonesData, error: phonesError } = await supabase
          .from('telefones')
          .select('*')
          .eq('cliente_id', id);
        if (phonesError) throw phonesError;
        if (phonesData) {
          setTelefones(phonesData.map(p => ({
            id: p.id,
            telefone: formatPhone(p.telefone),
            tipo: p.tipo,
            observacao: p.observacao || ''
          })));
        }
      } catch (err: any) {
        setError('Erro ao carregar dados: ' + err.message);
      } finally { setFetching(false); }
    };
    fetchCliente();
  }, [id]);

  useEffect(() => {
    const t = setTimeout(async () => {
      const nome = await lookupBanco(form.banco);
      setForm(f => ({ ...f, banco_nome: nome }));
    }, 400);
    return () => clearTimeout(t);
  }, [form.banco]);

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
    let val = value;
    if (id === 'cpf') {
      val = formatCPF(value);
    } else if (id === 'cep') {
      val = formatCEP(value);
    } else if (id === 'salario') {
      val = formatMoney(value);
    } else if (id === 'email') {
      val = value.toLowerCase();
    } else if (typeof val === 'string') {
      val = val.toUpperCase();
    }
    setForm(f => ({ ...f, [id]: val }));
    if (id === 'cpf') setCpfError('');
  };

  const handleCpfBlur = () => {
    if (form.cpf.length > 0 && !validateCPF(form.cpf)) setCpfError('CPF inválido.');
    else setCpfError('');
  };

  const handleCepSearch = async () => {
    const cleanCep = form.cep.replace(/\D/g, '');
    if (!cleanCep) {
      setForm(f => ({
        ...f,
        endereco: '',
        numero: '',
        complemento: '',
        bairro: '',
        cidade: '',
        estado: ''
      }));
      return;
    }
    if (cleanCep.length === 8) {
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        const data = await res.json();
        if (data.erro) {
          setCepErrorModal({
            isOpen: true,
            title: 'CEP não encontrado',
            message: `Não foi possível localizar as informações para o CEP ${form.cep}. Verifique o número informado.`
          });
          setForm(f => ({
            ...f,
            endereco: '',
            numero: '',
            complemento: '',
            bairro: '',
            cidade: '',
            estado: ''
          }));
        } else {
          setForm(f => ({
            ...f,
            endereco: data.logradouro || '',
            bairro: data.bairro || '',
            cidade: data.localidade || '',
            estado: data.uf || '',
            complemento: data.complemento || f.complemento
          }));
        }
      } catch (err) {
        console.error("Erro ao buscar CEP:", err);
        setCepErrorModal({
          isOpen: true,
          title: 'Erro na busca de CEP',
          message: 'Ocorreu uma falha na conexão ao buscar o CEP. Tente novamente.'
        });
      }
    } else {
      setCepErrorModal({
        isOpen: true,
        title: 'CEP Inválido',
        message: 'Por favor, informe um CEP válido com 8 dígitos para realizar a busca.'
      });
    }
  };

  const handleAddPhone = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneForm.telefone) return;
    
    if (editingPhoneIndex !== null) {
      setTelefones(prev => {
        const updated = [...prev];
        updated[editingPhoneIndex] = { ...phoneForm };
        return updated;
      });
      setEditingPhoneIndex(null);
    } else {
      setTelefones(prev => [...prev, { ...phoneForm }]);
    }
    setPhoneForm({
      telefone: '',
      tipo: 'Celular',
      observacao: ''
    });
  };

  const handleEditPhone = (index: number) => {
    setPhoneForm(telefones[index]);
    setEditingPhoneIndex(index);
  };

  const handleDeletePhone = (index: number) => {
    setTelefones(prev => prev.filter((_, i) => i !== index));
    if (editingPhoneIndex === index) {
      setEditingPhoneIndex(null);
      setPhoneForm({ telefone: '', tipo: 'Celular', observacao: '' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateCPF(form.cpf)) { setError('CPF inválido.'); return; }
    setLoading(true); setError('');
    try {
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
        // Novos campos
        data_nascimento: form.data_nascimento || null,
        sexo: form.sexo || null,
        tipo_cliente: form.tipo_cliente || null,
        endereco: form.endereco || null,
        numero: form.numero || null,
        complemento: form.complemento || null,
        bairro: form.bairro || null,
        cep: form.cep || null,
        estado: form.estado || null,
        cidade: form.cidade || null,
        naturalidade: form.naturalidade || null,
        estado_civil: form.estado_civil || null,
        rg: form.rg || null,
        uf_rg: form.uf_rg || null,
        orgao_expedidor: form.orgao_expedidor || null,
        data_emissao_rg: form.data_emissao_rg || null,
        conjuge: form.conjuge || null,
        nome_pai: form.nome_pai || null,
        nome_mae: form.nome_mae || null,
        email: form.email || null,
        nacionalidade: form.nacionalidade || null,
        especie: form.especie || null,
        salario: parseMoneyToNumber(form.salario),
        ocupacao: form.ocupacao || null,
        ocupacao_detalhe: form.ocupacao_detalhe || null,
        data_admissao: form.data_admissao || null
      };

      if (form.forma_credito === 'conta') {
        payload.credito_banco = form.credito_banco;
        payload.credito_agencia = form.credito_agencia;
        payload.credito_agencia_dv = form.credito_agencia_dv;
        payload.credito_tipo_conta = form.credito_tipo_conta;
        payload.credito_conta = form.credito_conta;
        payload.credito_conta_dv = form.credito_conta_dv;
        payload.pix_tipo_chave = null;
        payload.pix_chave = null;
      } else if (form.forma_credito === 'pix') {
        payload.pix_tipo_chave = form.pix_tipo_chave;
        payload.pix_chave = form.pix_chave;
        payload.credito_banco = null;
        payload.credito_agencia = null;
        payload.credito_agencia_dv = null;
        payload.credito_tipo_conta = null;
        payload.credito_conta = null;
        payload.credito_conta_dv = null;
      } else {
        payload.pix_tipo_chave = null;
        payload.pix_chave = null;
        payload.credito_banco = null;
        payload.credito_agencia = null;
        payload.credito_agencia_dv = null;
        payload.credito_tipo_conta = null;
        payload.credito_conta = null;
        payload.credito_conta_dv = null;
      }

      // Atualizar cliente
      const { error: dbError } = await supabase.from('clientes').update(payload).eq('id', id);
      if (dbError) {
        if (dbError.code === '23505') throw new Error('CPF já cadastrado.');
        throw new Error(dbError.message);
      }

      // Sincronizar telefones: deletar e reinserir
      const { error: deletePhonesErr } = await supabase.from('telefones').delete().eq('cliente_id', id);
      if (deletePhonesErr) throw deletePhonesErr;

      if (telefones.length > 0) {
        const phonesPayload = telefones.map(t => ({
          cliente_id: id,
          telefone: t.telefone,
          tipo: t.tipo,
          observacao: t.observacao
        }));
        const { error: insertPhonesErr } = await supabase.from('telefones').insert(phonesPayload);
        if (insertPhonesErr) throw insertPhonesErr;
      }

      router.push('/clientes');
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Erro ao atualizar.');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) return <div className="animate-fade-in" style={{ textAlign: 'center', padding: '4rem', color: 'var(--color-text-muted)' }}>Carregando...</div>;

  return (
    <div className="animate-fade-in" style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '2rem', gap: '1rem' }}>
        <Link href="/clientes" className="btn btn-secondary" style={{ padding: '0.5rem' }}>
          <ArrowLeft size={20} />
        </Link>
        <h1 style={{ margin: 0 }}>Editar Cliente</h1>
      </div>

      <form onSubmit={handleSubmit}>
        {error && (
          <div style={{ padding: '1rem', backgroundColor: 'var(--color-danger-bg)', color: 'var(--color-danger)', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem' }}>
            {error}
          </div>
        )}

        {/* ── Dados Pessoais & Identificação ── */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <fieldset style={{ border: 'none', margin: 0, padding: 0 }}>
            <legend style={legendStyle}>Identificação</legend>
            
            <div style={gridStyle('1.2fr 3.8fr')}>
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

            <div style={{ ...gridStyle('1.2fr 1.5fr 2fr'), marginTop: '1.25rem' }}>
              <div>
                <label htmlFor="data_nascimento" style={fieldStyle}>Data de Nascimento</label>
                <input id="data_nascimento" type="date" value={form.data_nascimento} onChange={handleChange} style={{ width: '100%' }} />
              </div>
              <div>
                <label style={fieldStyle}>Sexo</label>
                <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', height: '40px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0, fontWeight: 'normal', cursor: 'pointer' }}>
                    <input type="radio" name="sexo" checked={form.sexo === 'Masculino'} onChange={() => setForm(f => ({ ...f, sexo: 'Masculino' }))} style={{ width: 'auto' }} />
                    Masculino
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0, fontWeight: 'normal', cursor: 'pointer' }}>
                    <input type="radio" name="sexo" checked={form.sexo === 'Feminino'} onChange={() => setForm(f => ({ ...f, sexo: 'Feminino' }))} style={{ width: 'auto' }} />
                    Feminino
                  </label>
                </div>
              </div>
              <div>
                <label htmlFor="tipo_cliente" style={fieldStyle}>Tipo de Cliente</label>
                <select id="tipo_cliente" value={form.tipo_cliente} onChange={handleChange} style={{ width: '100%' }}>
                  <option value="">Selecione</option>
                  <option value="Aposentado Orgao Publico">Aposentado Orgão Público</option>
                  <option value="Aposentado/Pensionista">Aposentado/Pensionista</option>
                  <option value="Autonomo">Autônomo</option>
                  <option value="Celetista">Celetista</option>
                  <option value="COMISSIONADO">COMISSIONADO</option>
                  <option value="Empresario">Empresário</option>
                  <option value="Funcionario Empresa">Funcionário Empresa</option>
                  <option value="Militar Reformado">Militar Reformado</option>
                  <option value="Pensionista Militar">Pensionista Militar</option>
                  <option value="Pensionista Orgao Publico">Pensionista Orgão Público</option>
                  <option value="Pensionista Outra Natureza">Pensionista Outra Natureza</option>
                  <option value="Prestador de Serviços">Prestador de Serviços</option>
                  <option value="Proprietario de Empresa">Proprietário de Empresa</option>
                  <option value="Servidor Ativo">Servidor Ativo</option>
                </select>
              </div>
            </div>

            <div style={{ ...gridStyle('1.2fr 0.8fr 1fr 1.5fr'), marginTop: '1.25rem' }}>
              <div>
                <label htmlFor="rg" style={fieldStyle}>RG</label>
                <input id="rg" type="text" value={form.rg} onChange={handleChange} placeholder="00.000.000-0" style={{ width: '100%' }} />
              </div>
              <div>
                <label htmlFor="uf_rg" style={fieldStyle}>UF do RG</label>
                <select id="uf_rg" value={form.uf_rg} onChange={handleChange} style={{ width: '100%' }}>
                  <option value="">Selecione</option>
                  {ESTADOS_BR.map(st => <option key={st.value} value={st.value}>{st.value}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="orgao_expedidor" style={fieldStyle}>Orgão Expedidor</label>
                <input id="orgao_expedidor" type="text" value={form.orgao_expedidor} onChange={handleChange} placeholder="SSP" style={{ width: '100%' }} />
              </div>
              <div>
                <label htmlFor="data_emissao_rg" style={fieldStyle}>Data Emissão RG</label>
                <input id="data_emissao_rg" type="date" value={form.data_emissao_rg} onChange={handleChange} style={{ width: '100%' }} />
              </div>
            </div>

            <div style={{ ...gridStyle('1fr 1fr'), marginTop: '1.25rem' }}>
              <div>
                <label htmlFor="estado_civil" style={fieldStyle}>Estado Civil</label>
                <select id="estado_civil" value={form.estado_civil} onChange={handleChange} required style={{ width: '100%' }}>
                  <option value="">Selecione</option>
                  {ESTADO_CIVIL_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="conjuge" style={fieldStyle}>Cônjuge</label>
                <input id="conjuge" type="text" value={form.conjuge} onChange={handleChange} placeholder="Nome do cônjuge se casado" style={{ width: '100%' }} />
              </div>
              <div>
                <label htmlFor="nome_mae" style={fieldStyle}>Nome da Mãe</label>
                <input id="nome_mae" type="text" value={form.nome_mae} onChange={handleChange} placeholder="Nome da mãe" style={{ width: '100%' }} />
              </div>
              <div>
                <label htmlFor="nome_pai" style={fieldStyle}>Nome do Pai</label>
                <input id="nome_pai" type="text" value={form.nome_pai} onChange={handleChange} placeholder="Nome do pai" style={{ width: '100%' }} />
              </div>
            </div>

            <div style={{ ...gridStyle('2fr 1.5fr 1.2fr'), marginTop: '1.25rem' }}>
              <div>
                <label htmlFor="email" style={fieldStyle}>E-mail</label>
                <input id="email" type="email" value={form.email} onChange={handleChange} placeholder="exemplo@email.com" style={{ width: '100%' }} />
              </div>
              <div>
                <label htmlFor="naturalidade" style={fieldStyle}>Naturalidade</label>
                <input id="naturalidade" type="text" value={form.naturalidade} onChange={handleChange} placeholder="Cidade natal" style={{ width: '100%' }} />
              </div>
              <div>
                <label htmlFor="nacionalidade" style={fieldStyle}>Nacionalidade</label>
                <input id="nacionalidade" type="text" value={form.nacionalidade} onChange={handleChange} placeholder="Ex: Brasileira" style={{ width: '100%' }} />
              </div>
            </div>
          </fieldset>
        </div>

        {/* ── Endereço ── */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <fieldset style={{ border: 'none', margin: 0, padding: 0 }}>
            <legend style={legendStyle}>Endereço</legend>
            
            <div style={gridStyle('1.2fr 2fr 0.8fr')}>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'end' }}>
                <div style={{ flex: 1 }}>
                  <label htmlFor="cep" style={fieldStyle}>CEP</label>
                  <input id="cep" type="text" value={form.cep} onChange={handleChange} placeholder="00000-000" style={{ width: '100%' }} />
                </div>
                <button type="button" className="btn btn-secondary" style={{ padding: '0.65rem' }} onClick={handleCepSearch} title="Buscar CEP">
                  <Search size={20} />
                </button>
              </div>
              <div>
                <label htmlFor="endereco" style={fieldStyle}>Endereço</label>
                <input id="endereco" type="text" value={form.endereco} onChange={handleChange} placeholder="Rua, Avenida, etc." style={{ width: '100%' }} />
              </div>
              <div>
                <label htmlFor="numero" style={fieldStyle}>Número</label>
                <input id="numero" type="text" value={form.numero} onChange={handleChange} placeholder="123" style={{ width: '100%' }} />
              </div>
            </div>

            <div style={gridStyle('1.5fr 1.5fr')}>
              <div>
                <label htmlFor="complemento" style={fieldStyle}>Complemento</label>
                <input id="complemento" type="text" value={form.complemento} onChange={handleChange} placeholder="Apto, Sala, etc." style={{ width: '100%' }} />
              </div>
              <div>
                <label htmlFor="bairro" style={fieldStyle}>Bairro</label>
                <input id="bairro" type="text" value={form.bairro} onChange={handleChange} placeholder="Bairro" style={{ width: '100%' }} />
              </div>
            </div>

            <div style={gridStyle('1fr 2fr 1fr')}>
              <div>
                <label htmlFor="estado" style={fieldStyle}>Estado</label>
                <select id="estado" value={form.estado} onChange={handleChange} style={{ width: '100%' }}>
                  <option value="">Selecione</option>
                  {ESTADOS_BR.map(st => <option key={st.value} value={st.value}>{st.label}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="cidade" style={fieldStyle}>Cidade</label>
                <input id="cidade" type="text" value={form.cidade} onChange={handleChange} placeholder="Cidade" style={{ width: '100%' }} />
              </div>
              <div>
                <label style={fieldStyle}>Contatos</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', height: '40px' }}>
                  <button type="button" className="btn" style={{ backgroundColor: '#ff9800', color: 'white', fontWeight: 600, padding: '0 0.75rem', height: '40px', fontSize: '0.9rem', flex: 1 }} onClick={() => setShowPhoneModal(true)}>
                    Telefones
                  </button>
                  {telefones.length > 0 && (
                    <span className="badge badge-success" style={{ padding: '0.35rem 0.5rem', fontSize: '0.85rem', borderRadius: 'var(--radius-sm)' }}>
                      {telefones.length}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </fieldset>
        </div>

        {/* ── Informações Profissionais & Financeiras ── */}
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <fieldset style={{ border: 'none', margin: 0, padding: 0 }}>
            <legend style={legendStyle}>Informações Profissionais & Financeiras</legend>
            
            <div style={gridStyle('1.2fr 2.5fr 1.3fr')}>
              <div>
                <label htmlFor="salario" style={fieldStyle}>Salário</label>
                <input id="salario" type="text" value={form.salario} onChange={handleChange} placeholder="0,00" style={{ width: '100%' }} />
              </div>
              <div>
                <label style={fieldStyle}>Ocupação</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <select id="ocupacao" value={form.ocupacao} onChange={handleChange} style={{ flex: 1 }}>
                    <option value="">Selecione</option>
                    <option value="Aposentado ou Pensionista">Aposentado ou Pensionista</option>
                    <option value="Assalariado Privado">Assalariado Privado</option>
                    <option value="Empresario">Empresário</option>
                    <option value="Profissional Liberal">Profissional Liberal</option>
                    <option value="Autonomo">Autônomo</option>
                    <option value="Assalariado Publico">Assalariado Público</option>
                  </select>
                  <input id="ocupacao_detalhe" type="text" value={form.ocupacao_detalhe} onChange={handleChange} placeholder="Detalhamento..." style={{ flex: 1 }} />
                </div>
              </div>
              <div>
                <label htmlFor="data_admissao" style={fieldStyle}>Data de Admissão</label>
                <input id="data_admissao" type="date" value={form.data_admissao} onChange={handleChange} style={{ width: '100%' }} />
              </div>
            </div>

            <div style={gridStyle('1.5fr')}>
              <div style={{ maxWidth: '300px' }}>
                <label htmlFor="especie" style={fieldStyle}>Espécie</label>
                <select id="especie" value={form.especie} onChange={handleChange} style={{ width: '100%' }}>
                  <option value="">Selecione</option>
                  {ESPECIE_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                </select>
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
            {loading ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>
      </form>

      {showPhoneModal && mounted && createPortal(
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(15, 23, 42, 0.45)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999999,
          backdropFilter: 'blur(3px)'
        }}>
          <div className="card" style={{
            width: '100%',
            maxWidth: '520px',
            backgroundColor: 'var(--color-bg-surface)',
            padding: '2.5rem',
            border: 'none',
            boxShadow: 'var(--shadow-float)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-primary-light)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--color-primary)'
                }}>
                  <Phone size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600, color: 'var(--color-text-main)' }}>
                    Contatos Telefônicos
                  </h3>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                    Gerencie os números de telefone do cliente
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPhoneModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', padding: '0.25rem' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddPhone} style={{
              display: 'grid',
              gridTemplateColumns: '1.5fr 1fr 1.5fr auto',
              gap: '1rem',
              alignItems: 'end',
              backgroundColor: 'var(--color-bg-body)',
              padding: '1.25rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
              marginBottom: '1.5rem'
            }}>
              <div>
                <label style={{ ...fieldStyle, fontSize: '0.85rem' }}>Telefone</label>
                <input
                  type="text"
                  value={phoneForm.telefone}
                  onChange={e => setPhoneForm(p => ({ ...p, telefone: formatPhone(e.target.value) }))}
                  placeholder="(00) 00000-0000"
                  style={{ width: '100%', padding: '0.5rem', fontSize: '0.875rem' }}
                />
              </div>
              <div>
                <label style={{ ...fieldStyle, fontSize: '0.85rem' }}>Tipo</label>
                <select
                  value={phoneForm.tipo}
                  onChange={e => setPhoneForm(p => ({ ...p, tipo: e.target.value }))}
                  style={{ width: '100%', padding: '0.5rem', fontSize: '0.875rem' }}
                >
                  <option value="Celular">Celular</option>
                  <option value="Fixo">Fixo</option>
                  <option value="Recado">Recado</option>
                  <option value="WhatsApp">WhatsApp</option>
                </select>
              </div>
              <div>
                <label style={{ ...fieldStyle, fontSize: '0.85rem' }}>Observação</label>
                <input
                  type="text"
                  value={phoneForm.observacao}
                  onChange={e => setPhoneForm(p => ({ ...p, observacao: e.target.value.toUpperCase() }))}
                  placeholder="Ex: WhatsApp"
                  style={{ width: '100%', padding: '0.5rem', fontSize: '0.875rem' }}
                />
              </div>
              <button
                type="submit"
                className="btn btn-primary"
                style={{
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  fontSize: '0.875rem',
                  padding: '0 1.25rem'
                }}
              >
                <Plus size={16} />
                {editingPhoneIndex !== null ? 'Salvar' : 'Adicionar'}
              </button>
            </form>

            <div className="card" style={{ padding: 0, overflow: 'hidden', border: '1px solid var(--color-border)' }}>
              <div style={{
                padding: '0.75rem 1rem',
                backgroundColor: 'var(--color-bg-sidebar)',
                borderBottom: '1px solid var(--color-border)',
                fontWeight: 600,
                fontSize: '0.85rem',
                color: 'var(--color-text-muted)'
              }}>
                Telefones Adicionados ({telefones.length})
              </div>
              
              <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
                {telefones.length === 0 ? (
                  <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                    Nenhum telefone adicionado.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {telefones.map((phone, idx) => (
                      <div key={idx} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.625rem 1rem',
                        borderBottom: idx === telefones.length - 1 ? 'none' : '1px solid var(--color-border)',
                        fontSize: '0.875rem'
                      }}>
                        <div>
                          <strong style={{ color: 'var(--color-text-main)' }}>{phone.telefone}</strong>
                          <span style={{
                            marginLeft: '0.5rem',
                            padding: '0.125rem 0.375rem',
                            backgroundColor: 'var(--color-bg-body)',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '0.75rem',
                            color: 'var(--color-text-muted)'
                          }}>{phone.tipo}</span>
                          {phone.observacao && (
                            <span style={{ marginLeft: '0.5rem', color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
                              ({phone.observacao})
                            </span>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            type="button"
                            onClick={() => handleEditPhone(idx)}
                            style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', padding: '0.25rem' }}
                          >
                            <Edit size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeletePhone(idx)}
                            style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', padding: '0.25rem' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid var(--color-border)', paddingTop: '1rem' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowPhoneModal(false)}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <ConfirmModal
        isOpen={cepErrorModal.isOpen}
        title={cepErrorModal.title}
        message={cepErrorModal.message}
        confirmText="OK"
        onConfirm={() => setCepErrorModal(prev => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
