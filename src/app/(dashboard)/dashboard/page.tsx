'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { FileText, Clock, CheckCircle, Users } from 'lucide-react';

interface Venda {
  id: string;
  cpf: string;
  operacao: string;
  valor: number;
  status: string;
  created_at: string;
  clientes: { nome: string } | null;
  usuarios: { nome: string } | null;
}

export default function DashboardPage() {
  const [metrics, setMetrics] = useState({
    vendasPendentes: 0,
    vendasAprovadas: 0,
    totalVendasValor: 0,
    clientesAtivos: 0
  });
  const [recentVendas, setRecentVendas] = useState<Venda[]>([]);
  const [loading, setLoading] = useState(true);
  const [nivel, setNivel] = useState('');
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const fetchAll = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: profile } = await supabase
        .from('usuarios')
        .select('nivel, id')
        .eq('supabase_user_id', session.user.id)
        .single();

      const userNivel = profile?.nivel ?? '';
      const uid = profile?.id ?? null;
      setNivel(userNivel);
      setUserId(uid);

      const isOperacional = userNivel === 'operacional';

      // Vendas pendentes
      let pendQuery = supabase
        .from('vendas')
        .select('id', { count: 'exact', head: true })
        .ilike('status', 'pendente');
      if (isOperacional && uid) pendQuery = pendQuery.eq('created_by', uid);

      // Vendas aprovadas
      let aprovQuery = supabase
        .from('vendas')
        .select('id', { count: 'exact', head: true })
        .ilike('status', 'aprovado');
      if (isOperacional && uid) aprovQuery = aprovQuery.eq('created_by', uid);

      // Total valor
      let valorQuery = supabase.from('vendas').select('valor');
      if (isOperacional && uid) valorQuery = valorQuery.eq('created_by', uid);

      // Clientes ativos
      const clientesQuery = supabase
        .from('clientes')
        .select('id', { count: 'exact', head: true });

      // Últimas vendas
      let recentQuery = supabase
        .from('vendas')
        .select('id, cpf, operacao, valor, status, created_at, clientes(nome), usuarios!created_by(nome)')
        .order('created_at', { ascending: false })
        .limit(50);
      if (isOperacional && uid) recentQuery = recentQuery.eq('created_by', uid);

      const [
        { count: pendentes },
        { count: aprovados },
        { data: valorData },
        { count: clientes },
        { data: recent }
      ] = await Promise.all([pendQuery, aprovQuery, valorQuery, clientesQuery, recentQuery]);

      const totalValor = (valorData ?? []).reduce((acc: number, b: any) => acc + (b.valor ?? 0), 0);

      setMetrics({
        vendasPendentes: pendentes ?? 0,
        vendasAprovadas: aprovados ?? 0,
        totalVendasValor: totalValor,
        clientesAtivos: clientes ?? 0
      });
      setRecentVendas((recent as any[]) ?? []);
      setLoading(false);
    };

    fetchAll();
  }, []);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: 'var(--color-text-muted)' }}>
      Carregando métricas...
    </div>
  );

  const cards = [
    {
      label: 'Valor Total (Vendas)',
      value: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metrics.totalVendasValor),
      color: 'var(--color-primary)',
      icon: <FileText size={22} />
    },
    {
      label: 'Vendas Pendentes',
      value: metrics.vendasPendentes,
      color: 'var(--color-warning)',
      icon: <Clock size={22} />
    },
    {
      label: 'Vendas Aprovadas',
      value: metrics.vendasAprovadas,
      color: 'var(--color-success)',
      icon: <CheckCircle size={22} />
    },
    {
      label: 'Clientes Ativos',
      value: metrics.clientesAtivos,
      color: 'var(--color-info)',
      icon: <Users size={22} />
    }
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ margin: 0 }}>Dashboard</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
        {cards.map((card, i) => (
          <div key={i} className="card" style={{ borderLeft: `4px solid ${card.color}`, display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ color: card.color, opacity: 0.85 }}>{card.icon}</div>
            <div>
              <div style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{card.label}</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', marginTop: '0.25rem', color: 'var(--color-text-main)' }}>{card.value}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <div style={{ marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.25rem', margin: 0 }}>
            Últimas Vendas {nivel === 'operacional' ? '(seus lançamentos)' : ''}
          </h2>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', margin: '0.25rem 0 0' }}>
            Exibindo os últimos 50 registros
          </p>
        </div>
        {recentVendas.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>
            Nenhuma venda encontrada.
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Cliente</th>
                  <th>Operação</th>
                  <th>Valor</th>
                  <th>Status</th>
                  <th>Data</th>
                  {nivel === 'admin' && <th>Usuário</th>}
                </tr>
              </thead>
              <tbody>
                {recentVendas.map((v) => (
                  <tr key={v.id}>
                    <td>
                      <Link href={`/vendas/${v.id}/editar`} style={{ color: 'var(--color-primary)', fontWeight: 600, fontFamily: 'monospace', fontSize: '0.85rem', textDecoration: 'none' }}>
                        {v.id.substring(0, 8).toUpperCase()}
                      </Link>
                    </td>
                    <td>
                      <div>{v.clientes?.nome || 'N/A'}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{v.cpf}</div>
                    </td>
                    <td>{v.operacao || '-'}</td>
                    <td style={{ fontWeight: 500 }}>
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v.valor || 0)}
                    </td>
                    <td>
                      <span className={`badge ${v.status?.toLowerCase() === 'aprovado' ? 'badge-success' : v.status?.toLowerCase() === 'rejeitado' ? 'badge-danger' : 'badge-warning'}`}>
                        {v.status || 'Pendente'}
                      </span>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {new Date(v.created_at).toLocaleDateString('pt-BR')}
                    </td>
                    {nivel === 'admin' && (
                      <td style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                        {v.usuarios?.nome || '-'}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
