'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { FileText, Clock, CheckCircle, Users, TrendingUp, ShieldCheck, Database, History, ChevronRight, BarChart3, AlertCircle, Info, Target } from 'lucide-react';


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
    totalVendasValor: 0,
    clientesTotal: 0,
    ticketMedio: 0,
    ticketMedioPorCliente: 0,
    cpfValidoPercent: 0,
    totalOperacoes: 0
  });

  const [recentVendas, setRecentVendas] = useState<Venda[]>([]);
  const [recentImports, setRecentImports] = useState<any[]>([]);
  const [groupDistribution, setGroupDistribution] = useState<{ grupo: string, count: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [nivel, setNivel] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [vendedoresProduction, setVendedoresProduction] = useState<any[]>([]);
  const [totalSalesMonth, setTotalSalesMonth] = useState(0);


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

      // 1. Chamar a função centralizada de estatísticas (Rápida e Precisa para grandes volumes)
      const { data: stats, error: statsError } = await supabase.rpc('get_dashboard_stats');

      if (statsError) {
        console.error('Erro ao buscar estatísticas:', statsError);
      } else if (stats) {
        setMetrics({
          totalVendasValor: stats.total_vendas_valor || 0,
          clientesTotal: stats.clientes_total || 0,
          ticketMedio: stats.ticket_medio || 0,
          ticketMedioPorCliente: stats.ticket_medio_por_cliente || 0,
          cpfValidoPercent: stats.cpf_valido_percent || 0,
          totalOperacoes: stats.total_operacoes || 0
        });

        setGroupDistribution(stats.group_distribution || []);
      }

      // 2. Buscar dados listáveis (Vendas recentes e Histórico de Importação)
      let recentQuery = supabase
        .from('vendas')
        .select('id, cpf, operacao, valor, status, created_at, clientes(nome), usuarios!created_by(nome)')
        .order('created_at', { ascending: false })
        .limit(10);

      if (isOperacional && uid) recentQuery = recentQuery.eq('created_by', uid);

      const [recentRes, historyRes] = await Promise.all([
        recentQuery,
        supabase.rpc('get_import_history').limit(5)
      ]);

      setRecentVendas((recentRes.data as any[]) ?? []);
      setRecentImports(historyRes.data || []);

      // 3. Buscar vendedores e calcular estatísticas de produção do mês
      const now = new Date();
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

      const [sellersRes, salesRes, opsRes] = await Promise.all([
        supabase.schema('pro_consig').from('vendedores').select('codigo, nome, meta, meta_diaria'),
        supabase.schema('pro_consig').from('vendas').select('valor, corretor, created_at').gte('created_at', firstDay).lt('created_at', lastDay),
        supabase.schema('pro_consig').from('operacoes').select('valor, vendedor').gte('data_importacao', firstDay).lt('data_importacao', lastDay)
      ]);

      const sellers = sellersRes.data || [];
      const monthlySales = salesRes.data || [];
      const monthlyOps = opsRes.data || [];

      const totalSalesVal = monthlySales.reduce((sum, item) => sum + (item.valor || 0), 0);
      setTotalSalesMonth(totalSalesVal);

      const todayDateString = now.toLocaleDateString('pt-BR');

      const computedProd = sellers.map(seller => {
        const key = seller.nome.trim().toUpperCase();
        const formattedKey = `${seller.codigo} - ${seller.nome}`.trim().toUpperCase();

        // Sum sales (vendido)
        const sales = monthlySales.filter(s => {
          if (!s.corretor) return false;
          const sClean = s.corretor.trim().toUpperCase();
          return sClean === seller.codigo || sClean === key || sClean === formattedKey || sClean.includes(key);
        });
        const totalVendido = sales.reduce((sum, item) => sum + (item.valor || 0), 0);

        // Sum sales today (vendido hoje)
        const todaySales = sales.filter(s => {
          return new Date(s.created_at).toLocaleDateString('pt-BR') === todayDateString;
        });
        const totalVendidoHoje = todaySales.reduce((sum, item) => sum + (item.valor || 0), 0);

        // Sum operations
        const ops = monthlyOps.filter(o => {
          if (!o.vendedor) return false;
          const oClean = o.vendedor.trim().toUpperCase();
          return oClean === seller.codigo || oClean === key || oClean === formattedKey || oClean.includes(key);
        });
        const totalOperacoes = ops.reduce((sum, item) => sum + (item.valor || 0), 0);

        const metaCadastrada = seller.meta || 0;
        const meta = metaCadastrada > 0 ? metaCadastrada : totalOperacoes;
        const atingidoPercent = meta > 0 ? (totalVendido / meta) * 100 : 0;
        const totalPercent = totalSalesVal > 0 ? (totalVendido / totalSalesVal) * 100 : 0;

        // Daily meta logic
        const metaDiaria = seller.meta_diaria || 0;
        const atingidoDiarioPercent = metaDiaria > 0 ? (totalVendidoHoje / metaDiaria) * 100 : 0;

        return {
          codigo: seller.codigo,
          nome: seller.nome,
          meta,
          metaCadastrada,
          totalVendido,
          totalOperacoes,
          atingidoPercent,
          totalPercent,
          metaDiaria,
          totalVendidoHoje,
          atingidoDiarioPercent
        };
      }).sort((a, b) => b.totalVendido - a.totalVendido);

      setVendedoresProduction(computedProd);
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
      label: 'Volume de Vendas',
      value: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metrics.totalVendasValor),
      color: 'var(--color-primary)',
      icon: <TrendingUp size={22} />,
      desc: 'Total líquido acumulado'
    },
    {
      label: 'Ticket Médio (Operação)',
      value: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metrics.ticketMedio),
      color: 'var(--color-success)',
      icon: <BarChart3 size={22} />,
      desc: 'Por operação importada'
    },
    {
      label: 'Ticket Médio (CPF)',
      value: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(metrics.ticketMedioPorCliente),
      color: 'var(--color-warning)',
      icon: <TrendingUp size={22} />,
      desc: 'Média por CPF único'
    },

    {
      label: 'Clientes na Base',
      value: new Intl.NumberFormat('pt-BR').format(metrics.clientesTotal),
      color: 'var(--color-info)',
      icon: <Users size={22} />,
      desc: 'Total de clientes cadastrados'
    }
  ];

  return (
    <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2.5rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.75rem' }}>Dashboard</h1>
          <p style={{ color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>Visão geral da operação e inteligência de dados.</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem', marginBottom: '2.5rem' }}>
        {cards.map((card, i) => (
          <div key={i} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', position: 'relative', overflow: 'hidden', padding: '1.25rem' }}>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '12px', backgroundColor: `${card.color}15`, color: card.color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {card.icon}
              </div>
            </div>
            <div>
              <div style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', fontWeight: 600, textTransform: 'capitalize', letterSpacing: '0.05em' }}>{card.label}</div>
              <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '0.25rem', color: 'var(--color-text-main)', letterSpacing: '-0.02em' }}>{card.value}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <Info size={12} /> {card.desc}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2.5rem' }}>

        {/* Produção por Vendedor */}
        <div className="card">
          <h3 style={{ fontSize: '1.1rem', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Target size={18} color="var(--color-primary)" /> Produção por Vendedor
          </h3>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
            Acompanhamento de vendas, metas e operações importadas do mês atual.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {vendedoresProduction.map((item, idx) => {
              const formatBrl = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
              return (
                <div key={idx} style={{ paddingBottom: '0.75rem', borderBottom: idx < vendedoresProduction.length - 1 ? '1px solid var(--color-border)' : 'none', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', fontWeight: 700, color: 'var(--color-text-main)' }}>
                    <span>{idx + 1}º - {item.codigo} - {item.nome}</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', flexWrap: 'wrap' }}>
                    {/* Meta Mensal */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.2rem' }}>
                        <span>Mensal: <strong>{formatBrl(item.totalVendido)}</strong></span>
                        <span>
                          Meta: {item.metaCadastrada > 0 ? (
                            <span style={{ color: 'var(--color-warning)', fontWeight: 600 }}>Cadastrada</span>
                          ) : (
                            <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>Dinâmica</span>
                          )} ({formatBrl(item.meta)})
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ flex: 1, height: '6px', backgroundColor: 'var(--color-bg-body)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{
                            height: '100%',
                            width: `${Math.min(item.atingidoPercent, 100)}%`,
                            backgroundColor: item.atingidoPercent >= 100 ? 'var(--color-success)' : 'var(--color-primary)',
                            borderRadius: '3px',
                            transition: 'width 1s ease'
                          }} />
                        </div>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: item.atingidoPercent >= 100 ? 'var(--color-success)' : 'var(--color-primary)', minWidth: '35px', textAlign: 'right' }}>
                          {item.atingidoPercent.toFixed(0)}%
                        </span>
                      </div>
                    </div>

                    {/* Meta Diária */}
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.2rem' }}>
                        <span>Hoje: <strong>{formatBrl(item.totalVendidoHoje)}</strong></span>
                        <span>
                          Meta Diária: {item.metaDiaria > 0 ? (
                            <strong style={{ color: 'var(--color-text-main)' }}>{formatBrl(item.metaDiaria)}</strong>
                          ) : (
                            <span style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>Não cadastrada</span>
                          )}
                        </span>
                      </div>
                      {item.metaDiaria > 0 ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{ flex: 1, height: '6px', backgroundColor: 'var(--color-bg-body)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{
                              height: '100%',
                              width: `${Math.min(item.atingidoDiarioPercent, 100)}%`,
                              backgroundColor: item.atingidoDiarioPercent >= 100 ? 'var(--color-success)' : 'var(--color-primary)',
                              borderRadius: '3px',
                              transition: 'width 1s ease'
                            }} />
                          </div>
                          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: item.atingidoDiarioPercent >= 100 ? 'var(--color-success)' : 'var(--color-primary)', minWidth: '35px', textAlign: 'right' }}>
                            {item.atingidoDiarioPercent.toFixed(0)}%
                          </span>
                        </div>
                      ) : (
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', height: '14px', display: 'flex', alignItems: 'center' }}>
                          -
                        </div>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '0.1rem' }}>
                    <span>Participação no mês: <strong>{item.totalPercent.toFixed(1)}%</strong></span>
                    <span>Total Operações Mês: <strong>{formatBrl(item.totalOperacoes)}</strong></span>
                  </div>
                </div>
              );
            })}
            {vendedoresProduction.length === 0 && (
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Nenhum vendedor cadastrado ou com produção este mês.</p>
            )}
          </div>
        </div>

        {/* Últimas Importações */}
        <div className="card">
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <History size={18} color="var(--color-primary)" /> Últimas Importações
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {recentImports.length === 0 ? (
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Nenhum histórico encontrado.</p>
            ) : (
              recentImports.map((imp, i) => (
                <div key={i} style={{ padding: '0.75rem', backgroundColor: 'var(--color-bg-body)', borderRadius: '8px', borderLeft: '3px solid var(--color-primary)' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{imp.nome_arquivo}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                    <span>{new Date(imp.data_importacao).toLocaleDateString('pt-BR')}</span>
                    <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{imp.total_registros} Registros</span>
                  </div>
                </div>
              ))
            )}
            <Link href="/operacoes" className="btn btn-secondary" style={{ marginTop: '0.5rem', fontSize: '0.85rem', width: '100%', justifyContent: 'center' }}>
              Gerenciar Operações
            </Link>
          </div>
        </div>

        {/* Distribuição por Grupo (Gráfico CSS) */}
        <div className="card">
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Database size={18} color="var(--color-primary)" /> Distribuição por Grupo
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {groupDistribution.map((item, idx) => {
              const percent = metrics.totalOperacoes > 0 ? (item.count / metrics.totalOperacoes) * 100 : 0;
              return (
                <div key={idx}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.5rem' }}>
                    <span style={{ fontWeight: 600 }}>Grupo {item.grupo}</span>
                    <span style={{ color: 'var(--color-text-muted)' }}>{item.count} registros ({percent.toFixed(1)}%)</span>
                  </div>
                  <div style={{ height: '8px', backgroundColor: 'var(--color-bg-body)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${percent}%`, backgroundColor: 'var(--color-primary)', borderRadius: '4px', transition: 'width 1s ease' }} />
                  </div>
                </div>
              );
            })}
            {groupDistribution.length === 0 && <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Nenhuma operação importada para análise.</p>}
          </div>
        </div>

        {/* Qualidade da Base */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <ShieldCheck size={18} color={metrics.cpfValidoPercent > 90 ? 'var(--color-success)' : 'var(--color-warning)'} /> Qualidade da Base
            </h3>
            <span style={{ fontSize: '1.25rem', fontWeight: 800, color: metrics.cpfValidoPercent > 90 ? 'var(--color-success)' : 'var(--color-warning)' }}>
              {metrics.cpfValidoPercent.toFixed(1)}%
            </span>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', margin: 0 }}>
            Percentual de CPFs válidos em relação ao total de operações importadas na base.
          </p>
        </div>

        {/* Dica de Qualidade */}
        {metrics.cpfValidoPercent < 95 && (
          <div className="card" style={{ backgroundColor: 'var(--color-warning-bg)', borderColor: 'var(--color-warning)', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
            <AlertCircle size={20} color="var(--color-warning)" />
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--color-warning)' }}>Atenção na Base</div>
              <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.25rem', lineHeight: '1.4' }}>
                Detectamos muitos CPFs inválidos. Recomendamos revisar as últimas importações para garantir a integridade dos dados.
              </p>
            </div>
          </div>
        )}

        {/* Últimas Vendas */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Últimas Vendas</h3>
            <Link href="/vendas" style={{ fontSize: '0.85rem', color: 'var(--color-primary)', textDecoration: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              Ver todas <ChevronRight size={16} />
            </Link>
          </div>
          {recentVendas.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>Nenhuma venda encontrada.</div>
          ) : (
            <div className="table-wrapper">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Cliente</th>
                    <th>Operação</th>
                    <th>Valor</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentVendas.map((v) => (
                    <tr key={v.id}>
                      <td>
                        <div style={{ fontWeight: 500 }}>{v.clientes?.nome || 'N/A'}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{v.cpf}</div>
                      </td>
                      <td>{v.operacao}</td>
                      <td style={{ fontWeight: 600 }}>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v.valor || 0)}</td>
                      <td>
                        <span className={`badge ${v.status?.toLowerCase() === 'aprovado' ? 'badge-success' : v.status?.toLowerCase() === 'rejeitado' ? 'badge-danger' : 'badge-warning'}`} style={{ fontSize: '0.65rem' }}>
                          {v.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
