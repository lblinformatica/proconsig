'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { ArrowLeft, UserCheck, UserMinus, Loader2 } from 'lucide-react';

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

export default function DetalhesMeta(props: { params: Promise<{ id: string }> }) {
  const params = use(props.params);
  const [meta, setMeta] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMeta = async () => {
      try {
        const { data, error } = await supabase
          .from('metas')
          .select('*')
          .eq('id', params.id)
          .single();

        if (error) throw error;
        setMeta(data);
      } catch (err) {
        console.error('Erro ao carregar meta:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMeta();
  }, [params.id]);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '1rem' }}>
        <Loader2 className="animate-spin text-primary" size={40} />
        <p style={{ color: 'var(--color-text-muted)' }}>Carregando detalhes da meta...</p>
      </div>
    );
  }

  if (!meta) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '4rem' }}>
        <h3>Meta não encontrada</h3>
        <p style={{ color: 'var(--color-text-muted)', marginBottom: '2rem' }}>O registro solicitado não existe ou foi removido.</p>
        <Link href="/metas" className="btn btn-primary">Voltar para Metas</Link>
      </div>
    );
  }

  const formatCurrency = (val: any) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(val) || 0);

  return (
    <div className="animate-fade-in" style={{ maxWidth: '900px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link href="/metas" className="btn btn-secondary" style={{ padding: '0.5rem' }}>
            <ArrowLeft size={20} />
          </Link>
          <h1 style={{ margin: 0 }}>Detalhes da Meta</h1>
        </div>
        <div style={{
          backgroundColor: meta.cliente_cadastrado ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
          color: meta.cliente_cadastrado ? 'var(--color-success)' : 'var(--color-danger)',
          padding: '0.5rem 1rem',
          borderRadius: 'var(--radius-full)',
          fontSize: '0.875rem',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          {meta.cliente_cadastrado ? <UserCheck size={16} /> : <UserMinus size={16} />}
          {meta.cliente_cadastrado ? 'Cliente Cadastrado' : 'Cliente Não Cadastrado'}
        </div>
      </div>

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
              {formatCurrency(meta.contrato)}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>Saldo Restante</span>
            <div style={{ fontSize: '1.25rem', fontWeight: 700 }}>
              {formatCurrency(meta.saldo)}
            </div>
          </div>
        </div>

        <div style={{ padding: '2.5rem', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '2rem' }}>
          <div>
            <label style={labelStyle}>Nome do Cliente</label>
            <div style={valueStyle}>{meta.nome_cliente || '-'}</div>
          </div>
          <div>
            <label style={labelStyle}>CPF</label>
            <div style={valueStyle}>{meta.cpf || '-'}</div>
          </div>
          <div>
            <label style={labelStyle}>Operação</label>
            <div style={valueStyle}>{meta.operacao}</div>
          </div>

          <div>
            <label style={labelStyle}>Vencimento</label>
            <div style={valueStyle}>
              {meta.vencimento ? new Date(meta.vencimento + 'T12:00:00').toLocaleDateString('pt-BR') : '-'}
            </div>
          </div>
          <div>
            <label style={labelStyle}>Restam (Parcelas)</label>
            <div style={valueStyle}>{meta.restam ?? 0}</div>
          </div>
          <div>
            <label style={labelStyle}>Valor Parcela</label>
            <div style={valueStyle}>{formatCurrency(meta.parcela_valor)}</div>
          </div>

          <div>
            <label style={labelStyle}>Troco</label>
            <div style={valueStyle}>{formatCurrency(meta.troco)}</div>
          </div>
          <div>
            <label style={labelStyle}>Coeficiente</label>
            <div style={valueStyle}>{meta.coef ?? '-'}</div>
          </div>
          <div>
            <label style={labelStyle}>Data Pagamento</label>
            <div style={valueStyle}>
              {meta.data_pagamento ? new Date(meta.data_pagamento + 'T12:00:00').toLocaleDateString('pt-BR') : '-'}
            </div>
          </div>

          <div>
            <label style={labelStyle}>Vendedor</label>
            <div style={valueStyle}>{meta.vendedor || '-'}</div>
          </div>
          <div>
            <label style={labelStyle}>Código Cobrança</label>
            <div style={valueStyle}>{meta.codigo_cobranca ?? '-'}</div>
          </div>
          <div>
            <label style={labelStyle}>Convênio</label>
            <div style={valueStyle}>{meta.convenio || '-'}</div>
          </div>

          <div style={{ gridColumn: 'span 2' }}>
            <label style={labelStyle}>Cód. Fundo</label>
            <div style={valueStyle}>{meta.cod_fundo || '-'}</div>
          </div>
          <div>
            <label style={labelStyle}>Importado em</label>
            <div style={valueStyle}>
              {meta.data_importacao ? new Date(meta.data_importacao).toLocaleString('pt-BR') : '-'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

