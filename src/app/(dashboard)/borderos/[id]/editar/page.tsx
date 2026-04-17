'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { ArrowLeft, CheckCircle2, Edit2, Trash2, ShieldAlert } from 'lucide-react';
import { createSolicitacao } from '@/app/actions/solicitacoes';
import { ConfirmModal } from '@/components/ConfirmModal';
import { createPortal } from 'react-dom';

export default function EditarBordero(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  const router = useRouter();
  
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [fetchingProfile, setFetchingProfile] = useState(true);
  const [error, setError] = useState('');
  
  const [cpf, setCpf] = useState('');
  const [clientFound, setClientFound] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);

  // Modal states para solicitação (Operacional)
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestType, setRequestType] = useState<'alteracao' | 'exclusao'>('alteracao');
  const [motivo, setMotivo] = useState('');
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  
  const [form, setForm] = useState({
    orgao: '',
    empresa_ativacao: '',
    conta_ativacao: '',
    dia_util: '',
    operacao: '',
    codigo_operacao: '',
    abat: '',
    inicio: '',
    parcela: '',
    saldo: '',
    contrato: '',
    coef: '',
    prazo: '',
    corretor: '',
    banco: '',
    agencia: '',
    agencia_dv: '',
    op: '',
    conta: '',
    conta_dv: '',
    valor: '',
    empresa: '',
    juncao: '',
    observacao: ''
  });

  useEffect(() => {
    fetchBordero();
  }, []);

  const fetchBordero = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: profile } = await supabase.from('usuarios').select('*').eq('supabase_user_id', session.user.id).single();
        setUserProfile(profile);
      }
      setFetchingProfile(false);

      const { data, error } = await supabase
        .from('borderos')
        .select('*')
        .eq('id', params.id)
        .single();

      if (error) throw error;
      
      if (data) {
        setCpf(data.cpf);
        
        // Fetch Client details to display safely
        const { data: clients } = await supabase.from('clientes').select('*').eq('cpf', data.cpf);
        if (clients && clients.length > 0) {
          setClientFound(clients[0]);
        }

        setForm({
          orgao: data.orgao || '',
          empresa_ativacao: data.empresa_ativacao || '',
          conta_ativacao: data.conta_ativacao || '',
          dia_util: data.dia_util || '',
          operacao: data.operacao || '',
          codigo_operacao: data.codigo_operacao || '',
          abat: data.abat || '',
          inicio: data.inicio || '',
          parcela: data.parcela ? data.parcela.toString() : '',
          saldo: data.saldo ? data.saldo.toString() : '',
          contrato: data.contrato || '',
          coef: data.coef ? data.coef.toString() : '',
          prazo: data.prazo ? data.prazo.toString() : '',
          corretor: data.corretor || '',
          banco: data.banco || '',
          agencia: data.agencia || '',
          agencia_dv: data.agencia_dv || '',
          op: data.op || '',
          conta: data.conta || '',
          conta_dv: data.conta_dv || '',
          valor: data.valor ? data.valor.toString() : '',
          empresa: data.empresa || '',
          juncao: data.juncao || '',
          observacao: data.observacao || ''
        });
      }
    } catch (err: any) {
      setError('Erro ao carregar dados do borderô: ' + err.message);
    } finally {
      setFetching(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Formatações
      const parsedValor = parseFloat(form.valor.replace(',', '.')) || null;
      const parsedSaldo = parseFloat(form.saldo.replace(',', '.')) || null;
      const parsedCoef = parseFloat(form.coef.replace(',', '.')) || null;
      const parsedParcela = parseInt(form.parcela) || null;
      const parsedPrazo = parseInt(form.prazo) || null;

      const { error: borderoError } = await supabase
        .from('borderos')
        .update({
          orgao: form.orgao,
          empresa_ativacao: form.empresa_ativacao,
          conta_ativacao: form.conta_ativacao,
          dia_util: form.dia_util,
          operacao: form.operacao,
          codigo_operacao: form.codigo_operacao,
          abat: form.abat,
          inicio: form.inicio || null,
          parcela: parsedParcela,
          saldo: parsedSaldo,
          contrato: form.contrato,
          coef: parsedCoef,
          prazo: parsedPrazo,
          corretor: form.corretor,
          banco: form.banco,
          agencia: form.agencia,
          agencia_dv: form.agencia_dv,
          op: form.op,
          conta: form.conta,
          conta_dv: form.conta_dv,
          valor: parsedValor,
          empresa: form.empresa,
          juncao: form.juncao,
          observacao: form.observacao
        })
        .eq('id', params.id);

      if (borderoError) throw new Error('Erro ao alterar borderô: ' + borderoError.message);

      router.push('/borderos');
      router.refresh();

    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingRequest(true);
    try {
      const res = await createSolicitacao({
        bordero_id: params.id,
        tipo: requestType,
        motivo,
        solicitante_id: userProfile?.id,
        solicitante_nome: userProfile?.nome || 'Operador',
      });
      if (res.error) throw new Error(res.error);
      setShowRequestModal(false);
      setMotivo('');
      setModalMessage('Solicitação enviada com sucesso para o administrador!');
    } catch (err: any) {
      setError('Erro ao solicitar: ' + err.message);
    } finally {
      setSubmittingRequest(false);
    }
  };

  const isAdmin = userProfile?.nivel === 'admin';
  const inputStyle = (dis: boolean) => ({ 
    width: '100%', 
    backgroundColor: dis ? 'var(--color-bg-body)' : undefined,
    color: dis ? 'var(--color-text-muted)' : undefined,
    cursor: dis ? 'not-allowed' : undefined
  });


  if (fetching || fetchingProfile) {
    return (
      <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--color-text-muted)' }}>
        Identificando permissões e carregando dados...
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link href="/borderos" className="btn btn-secondary" style={{ padding: '0.5rem' }}>
            <ArrowLeft size={20} />
          </Link>
          <h1 style={{ margin: 0 }}>{isAdmin ? 'Editar Borderô' : 'Visualizar Borderô'}</h1>
        </div>

        {!isAdmin && (
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button className="btn btn-secondary" onClick={() => { setRequestType('alteracao'); setShowRequestModal(true); }}>
              <Edit2 size={18} /> Solicitar Alteração
            </button>
            <button className="btn btn-danger" onClick={() => { setRequestType('exclusao'); setShowRequestModal(true); }}>
              <Trash2 size={18} /> Solicitar Exclusão
            </button>
          </div>
        )}
      </div>

      <div className="card" style={{ marginBottom: '2rem', backgroundColor: 'var(--color-bg-surface-hover)' }}>
        <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>
          Borderô Vinculado
        </h2>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '0.5rem' }}>
          <div style={{ flexGrow: 1, maxWidth: '250px' }}>
            <label>CPF do Cliente (Fixo)</label>
            <input type="text" value={cpf} disabled style={{ backgroundColor: 'var(--color-bg-body)', cursor: 'not-allowed' }} />
          </div>
          {clientFound && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-success)', marginTop: '1.5rem' }}>
              <CheckCircle2 size={20} /> Cliente: <strong>{clientFound.nome}</strong>
            </div>
          )}
        </div>
        <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
          * O CPF do cliente associado ao borderô não pode ser alterado por segurança de auditoria. Caso o borderô precise ir para outro responsável, o procedimento correto é apagar este registro e cadastrar um novo.
        </div>
      </div>

      <div className="card">
        <h2 style={{ fontSize: '1.25rem', marginBottom: '1rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>
          Dados do Borderô
        </h2>

        {error && (
          <div style={{ padding: '1rem', backgroundColor: 'var(--color-danger-bg)', color: 'var(--color-danger)', borderRadius: 'var(--radius-md)', marginBottom: '1.5rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          
          {/* GRUPO 1: Dados Institucionais e Operação */}
          <fieldset style={{ border: 'none', margin: '0 0 2.5rem 0', padding: 0 }}>
            <legend style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-primary)', marginBottom: '1.25rem', display: 'block', width: '100%', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.25rem' }}>
              Dados Institucionais e Operação
            </legend>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Órgão</label>
                <input name="orgao" type="text" value={form.orgao} onChange={handleChange} readOnly={!isAdmin} style={inputStyle(!isAdmin)} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Empresa</label>
                <input name="empresa" type="text" value={form.empresa} onChange={handleChange} readOnly={!isAdmin} style={inputStyle(!isAdmin)} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Operação</label>
                <input name="operacao" type="text" value={form.operacao} onChange={handleChange} required readOnly={!isAdmin} style={inputStyle(!isAdmin)} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Cód. Operação</label>
                <input name="codigo_operacao" type="text" value={form.codigo_operacao} onChange={handleChange} readOnly={!isAdmin} style={inputStyle(!isAdmin)} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Corretor</label>
                <input name="corretor" type="text" value={form.corretor} onChange={handleChange} readOnly={!isAdmin} style={inputStyle(!isAdmin)} />
              </div>
            </div>
          </fieldset>

          {/* GRUPO 2: Valores e Condições */}
          <fieldset style={{ border: 'none', margin: '0 0 2.5rem 0', padding: 0 }}>
            <legend style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-primary)', marginBottom: '1.25rem', display: 'block', width: '100%', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.25rem' }}>
              Valores e Condições
            </legend>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Valor Liberado (R$)</label>
                <input name="valor" type="text" value={form.valor} onChange={handleChange} placeholder="0.00" required readOnly={!isAdmin} style={{ ...inputStyle(!isAdmin), fontWeight: 600, color: 'var(--color-primary)' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Saldo Devedor (R$)</label>
                <input name="saldo" type="text" value={form.saldo} onChange={handleChange} placeholder="0.00" readOnly={!isAdmin} style={inputStyle(!isAdmin)} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Abatimento (R$)</label>
                <input name="abat" type="text" value={form.abat} onChange={handleChange} placeholder="0.00" readOnly={!isAdmin} style={inputStyle(!isAdmin)} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Prazo (meses)</label>
                <input name="prazo" type="number" value={form.prazo} onChange={handleChange} placeholder="e.g. 72" readOnly={!isAdmin} style={inputStyle(!isAdmin)} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Parcela (R$)</label>
                <input name="parcela" type="number" value={form.parcela} onChange={handleChange} placeholder="0.00" readOnly={!isAdmin} style={inputStyle(!isAdmin)} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Coeficiente</label>
                <input name="coef" type="text" value={form.coef} onChange={handleChange} placeholder="0.00000" readOnly={!isAdmin} style={inputStyle(!isAdmin)} />
              </div>
            </div>
          </fieldset>

          {/* GRUPO 3: Dados Bancários (Repasse) */}
          <fieldset style={{ border: 'none', margin: '0 0 2.5rem 0', padding: 0 }}>
            <legend style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-primary)', marginBottom: '1.25rem', display: 'block', width: '100%', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.25rem' }}>
              Dados Bancários (Repasse / Averbação)
            </legend>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '1.5rem' }}>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Banco</label>
                <input name="banco" type="text" value={form.banco} onChange={handleChange} placeholder="001" readOnly={!isAdmin} style={inputStyle(!isAdmin)} />
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Agência</label>
                <input name="agencia" type="text" value={form.agencia} onChange={handleChange} readOnly={!isAdmin} style={inputStyle(!isAdmin)} />
              </div>
              <div style={{ gridColumn: 'span 1' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>DV (Ag)</label>
                <input name="agencia_dv" type="text" value={form.agencia_dv} onChange={handleChange} readOnly={!isAdmin} style={inputStyle(!isAdmin)} />
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Conta Corrente</label>
                <input name="conta" type="text" value={form.conta} onChange={handleChange} readOnly={!isAdmin} style={inputStyle(!isAdmin)} />
              </div>
              <div style={{ gridColumn: 'span 1' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>DV (CC)</label>
                <input name="conta_dv" type="text" value={form.conta_dv} onChange={handleChange} readOnly={!isAdmin} style={inputStyle(!isAdmin)} />
              </div>
              <div style={{ gridColumn: 'span 1' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>OP</label>
                <input name="op" type="text" value={form.op} onChange={handleChange} readOnly={!isAdmin} style={inputStyle(!isAdmin)} />
              </div>
            </div>
          </fieldset>

          {/* GRUPO 4: Contrato, Ativação e Lote */}
          <fieldset style={{ border: 'none', margin: '0 0 2.5rem 0', padding: 0 }}>
            <legend style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-primary)', marginBottom: '1.25rem', display: 'block', width: '100%', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.25rem' }}>
              Ativação, Contrato e Lote
            </legend>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1.5rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Nº do Contrato</label>
                <input name="contrato" type="text" value={form.contrato} onChange={handleChange} readOnly={!isAdmin} style={inputStyle(!isAdmin)} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Empresa Ativação</label>
                <input name="empresa_ativacao" type="text" value={form.empresa_ativacao} onChange={handleChange} readOnly={!isAdmin} style={inputStyle(!isAdmin)} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Conta Ativação</label>
                <input name="conta_ativacao" type="text" value={form.conta_ativacao} onChange={handleChange} readOnly={!isAdmin} style={inputStyle(!isAdmin)} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Data Início</label>
                <input name="inicio" type="date" value={form.inicio} onChange={handleChange} readOnly={!isAdmin} style={inputStyle(!isAdmin)} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Dia Útil Adicional</label>
                <input name="dia_util" type="text" value={form.dia_util} onChange={handleChange} readOnly={!isAdmin} style={inputStyle(!isAdmin)} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Junção / Lote</label>
                <input name="juncao" type="text" value={form.juncao} onChange={handleChange} readOnly={!isAdmin} style={inputStyle(!isAdmin)} />
              </div>
            </div>
          </fieldset>

          {/* GRUPO 5: Observações */}
          <fieldset style={{ border: 'none', margin: '0', padding: 0 }}>
            <legend style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--color-primary)', marginBottom: '1.25rem', display: 'block', width: '100%', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.25rem' }}>
              Considerações Finais
            </legend>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Observação da Operação</label>
              <textarea name="observacao" value={form.observacao} onChange={handleChange} rows={4} placeholder="Adicione pendências, detalhes da esteira ou acordos com o cliente." readOnly={!isAdmin} style={{ ...inputStyle(!isAdmin), resize: 'vertical' }} />
            </div>
          </fieldset>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem', borderTop: '1px solid var(--color-border)', paddingTop: '1.5rem', marginTop: '2rem' }}>
            <Link href="/borderos" className="btn btn-secondary">Voltar</Link>
            {isAdmin && (
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? 'Salvando Alterações...' : 'Salvar Alterações'}
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Modal de Solicitação para Operadores */}
      {showRequestModal && createPortal(
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999,
          backdropFilter: 'blur(2px)'
        }}>
          <div className="card animate-fade-in" style={{ width: '100%', maxWidth: '500px', backgroundColor: 'var(--color-bg-surface)' }}>
            <h2 style={{ marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.75rem', margin: '0 0 1rem 0' }}>
              <ShieldAlert size={24} color={requestType === 'exclusao' ? 'var(--color-danger)' : 'var(--color-warning)'} />
              Solicitar {requestType === 'alteracao' ? 'Alteração' : 'Exclusão'}
            </h2>
            <form onSubmit={handleSubmitRequest}>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>Motivo da solicitação</label>
                <textarea
                  rows={4}
                  required
                  value={motivo}
                  onChange={e => setMotivo(e.target.value)}
                  placeholder="Explique ao administrador por que esta ação é necessária..."
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowRequestModal(false)} disabled={submittingRequest}>Cancelar</button>
                <button type="submit" className={`btn ${requestType === 'exclusao' ? 'btn-danger' : 'btn-primary'}`} disabled={submittingRequest}>
                  {submittingRequest ? 'Enviando...' : 'Enviar Solicitação para Admin'}
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}

      <ConfirmModal 
        isOpen={!!modalMessage}
        title="Sucesso"
        message={modalMessage}
        onConfirm={() => setModalMessage('')}
        confirmText="Entendi"
        confirmType="primary"
      />
    </div>
  );
}
