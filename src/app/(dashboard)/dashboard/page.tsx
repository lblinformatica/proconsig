'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { FileText, Clock, CheckCircle, Users } from 'lucide-react';

interface Bordero {
  id: string;
  bordero_id: string | null;
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
    borderosPendentes: 0,
    borderosAprovados: 0,
    totalBorderosValor: 0,
    clientesAtivos: 0
  });
  const [recentBorderos, setRecentBorderos] = useState<Bordero[]>([]);
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

      // Queries paralelas para métricas
      const isOperacional = userNivel === 'operacional';

      // Borderos pendentes
      let pendQuery = supabase
        .from('borderos')
        .select('id', { count: 'exact', head: true })
        .ilike('status', 'pendente');
      if (isOperacional && uid) pendQuery = pendQuery.eq('created_by', uid);

      // Borderos aprovados
      let aprovQuery = supabase
        .from('borderos')
        .select('id', { count: 'exact', head: true })
        .ilike('status', 'aprovado');
      if (isOperacional && uid) aprovQuery = aprovQuery.eq('created_by', uid);

      // Total valor
      let valorQuery = supabase.from('borderos').select('valor');
      if (isOperacional && uid) valorQuery = valorQuery.eq('created_by', uid);

      // Clientes ativos
      const clientesQuery = supabase
        .from('clientes')
        .select('id', { count: 'exact', head: true });

      // Últimos borderôs
      let recentQuery = supabase
        .from('borderos')
        .select('id, bordero_id, cpf, operacao, valor, status, created_at, clientes(nome), usuarios!created_by(nome)')
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
        borderosPendentes: pendentes ?? 0,
        borderosAprovados: aprovados ?? 0,
        totalBorderosValor: totalValor,
        clientesAtivos: clientes ?? 0
      });
      setRecentBorderos((recent as any[]) ?? []);
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
      label: 'Valor Total (Borderôs)',
      value: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metrics.totalBorderosValor),
      color: 'var(--color-primary)',
      icon: <FileText size={22} />
    },
    {
      label: 'Borderôs Pendentes',
      value: metrics.borderosPendentes,
      color: 'var(--color-warning)',
      icon: <Clock size={22} />
    },
    {
      label: 'Borderôs Aprovados',
      value: metrics.borderosAprovados,
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
        <h1 style={{ margin: 0 }}>Início</h1>
      </div>

      {/* Cards de métricas */}
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

      {/* Últimos borderôs */}
      <div className="card">
        <div style={{ marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.25rem', margin: 0 }}>
            Últimos Borderôs {nivel === 'operacional' ? '(seus lançamentos)' : ''}
          </h2>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', margin: '0.25rem 0 0' }}>
            Exibindo os últimos 50 registros
          </p>
        </div>
        {recentBorderos.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>
            Nenhum borderô encontrado.
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
                {recentBorderos.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <Link href={`/borderos/${b.id}/editar`} style={{ color: 'var(--color-primary)', fontWeight: 600, fontFamily: 'monospace', fontSize: '0.85rem', textDecoration: 'none' }}>
                        {b.bordero_id || b.id.substring(0, 8).toUpperCase()}
                      </Link>
                    </td>
                    <td>
                      <div>{b.clientes?.nome || 'N/A'}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{b.cpf}</div>
                    </td>
                    <td>{b.operacao || '-'}</td>
                    <td style={{ fontWeight: 500 }}>
                      {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(b.valor || 0)}
                    </td>
                    <td>
                      <span className={`badge ${b.status?.toLowerCase() === 'aprovado' ? 'badge-success' : b.status?.toLowerCase() === 'rejeitado' ? 'badge-danger' : 'badge-warning'}`}>
                        {b.status || 'Pendente'}
                      </span>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      {new Date(b.created_at).toLocaleDateString('pt-BR')}
                    </td>
                    {nivel === 'admin' && (
                      <td style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                        {(b as any).usuarios?.nome || '-'}
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
