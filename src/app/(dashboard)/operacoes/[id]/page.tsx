'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import {
  ArrowLeft, UserCheck, UserMinus, FileText,
  Calendar, Hash, DollarSign, Briefcase,
  LayoutGrid, Landmark, Wallet, Loader2
} from 'lucide-react';

// Estilos compartilhados (mesma lógica visual do modal)
const labelStyle = {
  fontSize: '0.75rem',
  color: 'var(--color-text-muted)',
  display: 'block',
  marginBottom: '0.25rem',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.025em'
};

const valueStyle = {
  fontWeight: 600,
  fontSize: '1.05rem',
  color: 'var(--color-text)'
};

export default function DetalhesOperacao(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  const router = useRouter();
  const [operation, setOperation] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOperation = async () => {
      try {
        const { data, error } = await supabase
          .from('operacoes')
          .select('*')
          .eq('id', params.id)
          .single();

        if (error) throw error;
        setOperation(data);
      } catch (err) {
        console.error('Erro ao carregar operação:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchOperation();
  }, [params.id]);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '1rem' }}>
        <Loader2 className="animate-spin text-primary" size={40} />
        <p style={{ color: 'var(--color-text-muted)' }}>Carregando detalhes da operação...</p>
      </div>
    );
  }

  if (!operation) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '4rem' }}>
        <h3>Operação não encontrada</h3>
        <p style={{ color: 'var(--color-text-muted)', marginBottom: '2rem' }}>A operação solicitada não existe ou foi removida.</p>
        <Link href="/operacoes" className="btn btn-primary">Voltar para Operações</Link>
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ maxWidth: '900px', margin: '0 auto' }}>
      {/* Header com Voltar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link href="/operacoes" className="btn btn-secondary" style={{ padding: '0.5rem' }}>
            <ArrowLeft size={20} />
          </Link>
          <h1 style={{ margin: 0 }}>Detalhes da Operação</h1>
        </div>
        <div style={{
          backgroundColor: operation.cliente_cadastrado ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
          color: operation.cliente_cadastrado ? 'var(--color-success)' : 'var(--color-danger)',
          padding: '0.5rem 1rem',
          borderRadius: 'var(--radius-full)',
          fontSize: '0.875rem',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          {operation.cliente_cadastrado ? <UserCheck size={16} /> : <UserMinus size={16} />}
          {operation.cliente_cadastrado ? 'Cliente Cadastrado' : 'Cliente Não Cadastrado'}
        </div>
      </div>

      {/* Grid de Informações */}
      <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{
          padding: '1.5rem 2rem',
          backgroundColor: 'var(--color-bg-surface-hover)',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>Valor Contrato</span>
            <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-primary)' }}>
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(operation.contrato) || 0)}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>Valor Bruto</span>
            <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(operation.valor)}
            </div>
          </div>
        </div>

        <div style={{ padding: '2.5rem', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2.5rem' }}>
          {/* Identificação */}
          <div>
            <label style={labelStyle}>Nome do Cliente</label>
            <div style={valueStyle}>{operation.nome_cliente || '-'}</div>
          </div>
          <div>
            <label style={labelStyle}>CPF</label>
            <div style={valueStyle}>{operation.cpf}</div>
          </div>
          <div>
            <label style={labelStyle}>Contrato</label>
            <div style={valueStyle}>{operation.operacao}</div>
          </div>

          {/* Financeiro */}
          <div>
            <label style={labelStyle}>Vencimento</label>
            <div style={valueStyle}>{new Date(operation.vencimento + 'T12:00:00').toLocaleDateString('pt-BR')}</div>
          </div>
          <div>
            <label style={labelStyle}>Nº Parcela</label>
            <div style={valueStyle}>{operation.num_parcela || '-'}</div>
          </div>
          <div>
            <label style={labelStyle}>Valor Parcela</label>
            <div style={valueStyle}>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(operation.parcela_valor)}</div>
          </div>

          {/* Resultados */}
          <div>
            <label style={labelStyle}>Saldo devedor</label>
            <div style={valueStyle}>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(operation.saldo)}</div>
          </div>
          <div>
            <label style={labelStyle}>Troco Estimado</label>
            <div style={{ ...valueStyle, color: 'var(--color-success)' }}>
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(operation.troco)}
            </div>
          </div>
          <div>
            <label style={labelStyle}>Coeficiente</label>
            <div style={valueStyle}>
              {new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(operation.coef || 0)}
            </div>
          </div>

          {/* Configurações */}
          <div>
            <label style={labelStyle}>Grupo</label>
            <div style={valueStyle}>{operation.grupo}</div>
          </div>
          <div>
            <label style={labelStyle}>Fundo</label>
            <div style={valueStyle}>{operation.fundo || '-'}</div>
          </div>
          <div>
            <label style={labelStyle}>Convênio</label>
            <div style={valueStyle}>{operation.convenio || '-'}</div>
          </div>
        </div>

        {/* Footer info */}
        <div style={{
          padding: '1.5rem 2rem',
          backgroundColor: 'rgba(0,0,0,0.02)',
          borderTop: '1px solid var(--color-border)',
          display: 'flex',
          gap: '3rem'
        }}>
          <div>
            <label style={labelStyle}>Conta de Cobrança</label>
            <div style={{ fontWeight: 500 }}>{operation.contacobranca || '-'}</div>
          </div>
          <div>
            <label style={labelStyle}>Importado em</label>
            <div style={{ fontWeight: 500 }}>{new Date(operation.data_importacao).toLocaleString('pt-BR')}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
