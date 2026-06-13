'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { ArrowLeft, Edit2, User, Landmark, Wallet, Calculator, Info, FileText, Calendar, Building } from 'lucide-react';
import { formatCPF } from '@/lib/cpf';

export default function VendaDetails(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [venda, setVenda] = useState<any>(null);
  const [cliente, setCliente] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        setLoading(true);
        // 1. Fetch sale with operator info
        const { data: vendaData, error: vendaErr } = await supabase
          .from('vendas')
          .select('*, usuarios!created_by(nome)')
          .eq('id', params.id)
          .single();

        if (vendaErr) throw vendaErr;

        if (vendaData) {
          setVenda(vendaData);

          // 2. Fetch client info
          const { data: clientData, error: clientErr } = await supabase
            .schema('pro_consig')
            .from('clientes')
            .select('*')
            .eq('cpf', formatCPF(vendaData.cpf))
            .maybeSingle();

          if (clientData) {
            setCliente(clientData);
          }
        }
      } catch (err: any) {
        console.error('Erro ao buscar detalhes da venda:', err);
        setError(err.message || 'Erro ao carregar detalhes.');
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [params.id]);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: '1rem', color: 'var(--color-text-muted)' }}>
        <div className="spinner" style={{ width: '40px', height: '40px', borderRadius: '50%', border: '4px solid var(--color-border)', borderTopColor: 'var(--color-primary)', animation: 'spin 1s linear infinite' }}></div>
        <span>Carregando detalhes da venda...</span>
        <style jsx>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  if (error || !venda) {
    return (
      <div className="card" style={{ padding: '3rem', textAlign: 'center', maxWidth: '500px', margin: '3rem auto' }}>
        <h3 style={{ color: 'var(--color-danger)', marginBottom: '1rem' }}>Ops! Ocorreu um erro</h3>
        <p style={{ color: 'var(--color-text-muted)', marginBottom: '2rem' }}>{error || 'Não foi possível encontrar este registro de venda.'}</p>
        <Link href="/vendas" className="btn btn-secondary" style={{ width: '100%' }}>
          Voltar para Vendas
        </Link>
      </div>
    );
  }

  const formatBRL = (val: number | null | undefined) => {
    if (val === null || val === undefined) return 'R$ 0,00';
    return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const getInicioDesconto = () => {
    if (!venda.inicio) return '-';
    const d = new Date(venda.inicio);
    const mes = (d.getUTCMonth() + 1).toString().padStart(2, '0');
    const ano = d.getUTCFullYear();
    return `${mes}/${ano}`;
  };

  return (
    <div className="animate-fade-in" style={{ paddingBottom: '3rem' }}>
      {/* Navigation & Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <Link href="/vendas" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-text-muted)', textDecoration: 'none', marginBottom: '0.75rem', fontSize: '0.875rem' }}>
            <ArrowLeft size={16} /> Voltar para lista de vendas
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <h1 style={{ margin: 0 }}>Venda {venda.venda_id || '-'}</h1>
            <span className="badge badge-info" style={{ fontSize: '0.9rem', padding: '0.35rem 0.75rem' }}>{venda.operacao}</span>
          </div>
        </div>

        <Link href={`/vendas/${venda.id}/editar`} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', height: '42px', padding: '0 1.25rem' }}>
          <Edit2 size={16} /> Editar Registro
        </Link>
      </div>

      {/* Main Grid Content */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>

        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* Client Info Card */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.75rem' }}>
              <div style={{ padding: '0.4rem', borderRadius: '8px', backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>
                <User size={18} />
              </div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Dados do Cliente</h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.9rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Nome Completo:</span>
                <span style={{ fontWeight: 600, textAlign: 'right' }}>{cliente?.nome || venda.clientes?.nome || '-'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>CPF:</span>
                <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>{formatCPF(venda.cpf)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Novo Cliente?</span>
                <span style={{ fontWeight: 600 }}>{venda.novo_cliente || '-'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Atualização Cadastral?</span>
                <span style={{ fontWeight: 600 }}>{venda.atualizacao_cadastral || '-'}</span>
              </div>

              <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px dashed var(--color-border)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ fontWeight: 600, color: 'var(--color-text-muted)', fontSize: '0.8rem', textTransform: 'uppercase' }}>Domicílio Bancário Principal</div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Banco:</span>
                  <span>{venda.banco || '-'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Agência:</span>
                  <span>{venda.agencia || '-'}{venda.agencia_dv ? `-${venda.agencia_dv}` : ''}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Conta:</span>
                  <span>{venda.conta || '-'}{venda.conta_dv ? `-${venda.conta_dv}` : ''} ({venda.tipo_conta})</span>
                </div>
                {venda.op && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Operação (OP):</span>
                    <span>{venda.op}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Credit/Payment Info Card */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.75rem' }}>
              <div style={{ padding: '0.4rem', borderRadius: '8px', backgroundColor: 'var(--color-success-light)', color: 'var(--color-success)' }}>
                <Wallet size={18} />
              </div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Recebimento / Crédito</h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.9rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Forma de Crédito:</span>
                <span style={{ fontWeight: 600, textTransform: 'uppercase' }}>{venda.forma_credito || 'Conta'}</span>
              </div>

              {venda.forma_credito === 'pix' ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Tipo de Chave PIX:</span>
                    <span>{venda.pix_tipo_chave || '-'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Chave PIX:</span>
                    <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{venda.pix_chave || '-'}</span>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Banco de Crédito:</span>
                    <span>{venda.credito_banco || '-'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Agência de Crédito:</span>
                    <span>{venda.credito_agencia || '-'}{venda.credito_agencia_dv ? `-${venda.credito_agencia_dv}` : ''}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Conta de Crédito:</span>
                    <span>{venda.credito_conta || '-'}{venda.credito_conta_dv ? `-${venda.credito_conta_dv}` : ''} ({venda.credito_tipo_conta || 'corrente'})</span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Observations Card */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.75rem' }}>
              <div style={{ padding: '0.4rem', borderRadius: '8px', backgroundColor: 'var(--color-warning-light)', color: 'var(--color-warning)' }}>
                <FileText size={18} />
              </div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Observações</h3>
            </div>

            <div style={{ fontSize: '0.9rem', color: venda.observacao ? 'var(--color-text)' : 'var(--color-text-muted)', whiteSpace: 'pre-line', lineHeight: '1.5' }}>
              {venda.observacao || 'Nenhuma observação informada.'}
            </div>
          </div>

        </div>

        {/* Right Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* Financial Values Card */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.75rem' }}>
              <div style={{ padding: '0.4rem', borderRadius: '8px', backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>
                <Calculator size={18} />
              </div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Financeiro e Coeficientes</h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.9rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Valor do Contrato (Bruto):</span>
                <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--color-primary)' }}>{formatBRL(venda.valor)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Saldo Devedor / Quitação:</span>
                <span style={{ fontWeight: 600, color: 'var(--color-danger)' }}>{formatBRL(venda.saldo)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--color-success-light)', padding: '0.5rem', borderRadius: '6px' }}>
                <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>Valor Líquido (Crédito):</span>
                <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--color-success)' }}>{formatBRL(venda.abat)}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Valor da Parcela:</span>
                <span style={{ fontWeight: 600 }}>{formatBRL(venda.parcela)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Coeficiente Aplicado:</span>
                <span style={{ fontWeight: 600 }}>{venda.coef ? venda.coef.toFixed(5).replace('.', ',') : '-'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Prazo:</span>
                <span style={{ fontWeight: 600 }}>{venda.prazo ? `${venda.prazo} meses` : '-'}</span>
              </div>
            </div>
          </div>

          {/* Operation Fields Card */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.75rem' }}>
              <div style={{ padding: '0.4rem', borderRadius: '8px', backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>
                <Building size={18} />
              </div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Informações Operacionais</h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.9rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Número do Contrato:</span>
                <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{venda.contrato || '-'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Empresa Credora:</span>
                <span style={{ fontWeight: 600 }}>{venda.empresa_credora || '-'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Convênio:</span>
                <span>{venda.orgao || '-'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Empresa:</span>
                <span>{venda.empresa || '-'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Vendedor:</span>
                <span>{venda.corretor || '-'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Carteira:</span>
                <span>{venda.carteira || '-'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Código de Operação:</span>
                <span>{venda.codigo_operacao || '-'}</span>
              </div>

              <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px dashed var(--color-border)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Empresa de Ativação:</span>
                  <span>{venda.empresa_ativacao || '-'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Conta de Ativação:</span>
                  <span>{venda.conta_ativacao || '-'}</span>
                </div>
              </div>

              <div style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px dashed var(--color-border)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Início Desconto (Referência):</span>
                  <span>{getInicioDesconto()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Dia Útil do Desconto:</span>
                  <span>{venda.dia_util ? `${venda.dia_util}º dia útil` : '-'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Parcelas Restantes:</span>
                  <span>{venda.restam !== null && venda.restam !== undefined ? venda.restam : '-'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Parcelas Abatidas:</span>
                  <span>{venda.abatidas !== null && venda.abatidas !== undefined ? venda.abatidas : '-'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Audit Info Card */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.75rem' }}>
              <div style={{ padding: '0.4rem', borderRadius: '8px', backgroundColor: 'var(--color-secondary-light)', color: 'var(--color-text-muted)' }}>
                <Info size={18} />
              </div>
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Auditoria</h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.9rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Cadastrado por:</span>
                <span>{venda.usuarios?.nome || '-'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Data de Geração:</span>
                <span>{formatDate(venda.created_at)} às {new Date(venda.created_at).toLocaleTimeString('pt-BR')}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Status de Liquidação:</span>
                <span style={{ fontWeight: 600, color: venda.status === 'Pago' ? 'var(--color-success)' : 'var(--color-warning)' }}>
                  {venda.status === 'Pago' ? 'PAGO / LIQUIDADO' : 'ABERTO (Aguardando Lote)'}
                </span>
              </div>
              {venda.data_exportacao_atual && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-muted)' }}>Última Exportação Borderô:</span>
                  <span>{formatDate(venda.data_exportacao_atual)}</span>
                </div>
              )}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
