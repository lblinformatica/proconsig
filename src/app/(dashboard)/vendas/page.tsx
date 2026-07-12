'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Edit2, Trash2, Search, Plus, ChevronLeft, ChevronRight, Filter, Copy, Check, Eye, Lock, Calculator, Download, X } from 'lucide-react';
import Link from 'next/link';
import { ConfirmModal } from '@/components/ConfirmModal';

const PAGE_SIZE = 50;

export default function VendasList() {
  const [vendas, setVendas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [nivel, setNivel] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [allowedGroups, setAllowedGroups] = useState<number[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [deleting, setDeleting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [vendedores, setVendedores] = useState<any[]>([]);
  const [exporting, setExporting] = useState(false);
  const [sumModalData, setSumModalData] = useState<{ cpf: string; name: string; vendas: any[]; total: number } | null>(null);
  const [loadingSumModal, setLoadingSumModal] = useState(false);

  const [notification, setNotification] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'success' | 'danger' | 'primary';
    onConfirm?: () => void;
    onCancel?: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'primary'
  });

  const showAlert = (title: string, message: string, type: 'success' | 'danger' | 'primary' = 'primary') => {
    setNotification({ isOpen: true, title, message, type, onConfirm: () => setNotification(prev => ({ ...prev, isOpen: false })) });
  };

  const showConfirm = (title: string, message: string, onConfirm: () => void, type: 'danger' | 'primary' = 'primary') => {
    setNotification({
      isOpen: true,
      title,
      message,
      type,
      onConfirm: () => { onConfirm(); setNotification(prev => ({ ...prev, isOpen: false })); },
      onCancel: () => setNotification(prev => ({ ...prev, isOpen: false }))
    });
  };

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: profile } = await supabase.from('usuarios').select('nivel, id, grupos_permitidos').eq('supabase_user_id', session.user.id).single();
      if (profile) {
        setNivel(profile.nivel);
        setUserId(profile.id);
        if (profile.grupos_permitidos) {
          setAllowedGroups(profile.grupos_permitidos.map(Number));
        }
      }

      const { data: vData } = await supabase.schema('pro_consig').from('vendedores').select('codigo, nome');
      if (vData) setVendedores(vData);
    };
    init();
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    if (/[a-zA-Z]/.test(v)) {
      setSearch(v);
    } else {
      const digits = v.replace(/\D/g, '').slice(0, 11);
      let formatted = digits;
      if (digits.length > 9) {
        formatted = `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
      } else if (digits.length > 6) {
        formatted = `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
      } else if (digits.length > 3) {
        formatted = `${digits.slice(0, 3)}.${digits.slice(3)}`;
      }
      setSearch(formatted);
    }
    setPage(0);
  };

  const getVendedorFormatted = (codigo: string) => {
    if (!codigo) return '-';
    const v = vendedores.find(x => x.codigo === codigo);
    return v ? `${v.codigo} - ${v.nome}` : codigo;
  };

  const getContratoDisplay = (v: any) => {
    if (v.operacao === 'REFIN') return v.codigo_operacao || '-';
    if (v.operacao === 'NOVO') return 'Nova Venda';
    return v.contrato || v.codigo_operacao || '-';
  };

  const formatLiquido = (val: any) => {
    if (val === undefined || val === null) return '-';
    if (typeof val === 'number') return `R$ ${val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const clean = String(val).replace(/\s/g, '');
    let cleanVal = clean;
    if (clean.includes(',')) {
      cleanVal = clean.replace(/\./g, '').replace(',', '.');
    }
    const num = parseFloat(cleanVal);
    return isNaN(num) ? '-' : `R$ ${num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getFormaRecebimentoFormatted = (v: any) => {
    const forma = v.forma_credito ? String(v.forma_credito).trim().toUpperCase() : '';
    if (forma === 'CONTA') {
      const tipo = (v.credito_tipo_conta || v.tipo_conta || '').trim().toUpperCase();
      return tipo ? `CONTA ${tipo}` : 'CONTA';
    }
    return forma || '-';
  };

  const fetchVendas = useCallback(async () => {
    setLoading(true);
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const filterOwn = nivel === 'operacional' || nivel === 'vendedor';

    const isCPFSearch = search ? /^[0-9.-]+$/.test(search) : false;
    let selectFields = '*, usuarios!created_by(nome), clientes(nome)';
    if (search && !isCPFSearch) {
      selectFields = '*, usuarios!created_by(nome), clientes!inner(nome)';
    }

    let query = supabase
      .from('vendas')
      .select(selectFields, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    if (search) {
      if (isCPFSearch) {
        query = query.ilike('cpf', `%${search}%`);
      } else {
        query = query.ilike('clientes.nome', `%${search}%`);
      }
    }

    if (filterOwn && userId) {
      query = query.eq('created_by', userId);
    } else if (nivel === 'financeiro') {
      if (allowedGroups.length > 0) {
        query = query.in('grupo', allowedGroups);
      } else {
        query = query.in('grupo', [-1]); // bloqueia tudo se nenhum grupo estiver definido
      }
    }

    const { data, count } = await query;
    if (data) setVendas(data);
    if (count !== null) setTotal(count);
    setLoading(false);
  }, [page, search, nivel, userId, allowedGroups]);

  useEffect(() => {
    if (nivel !== '') fetchVendas();
  }, [page, search, nivel, userId, allowedGroups]);

  const handleDelete = async (id: string) => {
    // Verifica se a venda está paga antes de permitir exclusão
    const { data: venda } = await supabase.from('vendas').select('status').eq('id', id).single();
    if (venda && (venda.status?.toLowerCase() === 'pago' || venda.status?.toLowerCase() === 'paga')) {
      showAlert('Erro', 'Esta venda está paga e não pode ser excluída.', 'danger');
      return;
    }

    setDeleting(true);
    const { error } = await supabase.from('vendas').delete().eq('id', id);
    setDeleting(false);
    if (error) {
      showAlert('Erro', 'Erro ao excluir venda: ' + error.message, 'danger');
    } else {
      fetchVendas();
    }
  };

  const handleCopy = (cpf: string, id: string) => {
    navigator.clipboard.writeText(cpf);
    setCopiedId(id);
    showAlert('Copiado', 'CPF copiado para a área de transferência!', 'success');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleOpenSumModal = async (venda: any) => {
    const rawCpf = venda.cpf.replace(/[^\d]/g, '');
    const clientName = venda.clientes?.nome || '-';
    setLoadingSumModal(true);
    try {
      const { data, error } = await supabase
        .schema('pro_consig')
        .from('vendas')
        .select('id, operacao, codigo_operacao, abat, status')
        .eq('cpf', venda.cpf);

      if (error) throw error;

      const openSales = (data || []).filter(s => {
        const sLower = s.status?.toLowerCase();
        return sLower !== 'pago' && sLower !== 'paga';
      });

      const totalAbat = openSales.reduce((acc, curr) => {
        const valStr = String(curr.abat || '0').replace(/\s/g, '');
        let cleanVal = valStr;
        if (valStr.includes(',')) {
          cleanVal = valStr.replace(/\./g, '').replace(',', '.');
        }
        const val = parseFloat(cleanVal) || 0;
        return acc + val;
      }, 0);

      setSumModalData({
        cpf: venda.cpf,
        name: clientName,
        vendas: openSales,
        total: totalAbat
      });
    } catch (e: any) {
      showAlert('Erro', 'Falha ao buscar vendas do cliente: ' + e.message, 'danger');
    } finally {
      setLoadingSumModal(false);
    }
  };

  const exportExcel = async () => {
    try {
      setExporting(true);
      const filterOwn = nivel === 'operacional' || nivel === 'vendedor';

      const isCPFSearch = search ? /^[0-9.-]+$/.test(search) : false;
      let selectFields = '*, usuarios!created_by(nome), clientes(nome)';
      if (search && !isCPFSearch) {
        selectFields = '*, usuarios!created_by(nome), clientes!inner(nome)';
      }

      let query = supabase
        .from('vendas')
        .select(selectFields)
        .order('created_at', { ascending: false });

      if (search) {
        if (isCPFSearch) {
          query = query.ilike('cpf', `%${search}%`);
        } else {
          query = query.ilike('clientes.nome', `%${search}%`);
        }
      }

      if (filterOwn && userId) {
        query = query.eq('created_by', userId);
      } else if (nivel === 'financeiro') {
        if (allowedGroups.length > 0) {
          query = query.in('grupo', allowedGroups);
        } else {
          query = query.in('grupo', [-1]);
        }
      }

      const { data, error } = await query;
      if (error) {
        throw new Error(error.message);
      }

      const allData = (data || []) as any[];

      if (allData.length === 0) {
        showAlert('Aviso', 'Nenhum registro encontrado para exportar.');
        setExporting(false);
        return;
      }

      const timestamp = new Date().toLocaleString('pt-BR');
      const rows = allData.map(v => ({
        'Contrato': getContratoDisplay(v),
        'Status Venda': v.status === 'Pago' ? 'PAGA' : 'ABERTA',
        'Status Exportação': v.data_exportacao_atual ? 'RE-EXPORTADO' : 'NOVO (Primeira Vez)',
        'Penúltima Exportação': v.data_exportacao_anterior ? new Date(v.data_exportacao_anterior).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '-',
        'Última Exportação': v.data_exportacao_atual ? new Date(v.data_exportacao_atual).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '-',
        'Data Cadastro': new Date(v.created_at).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
        'Hora': new Date(v.created_at).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
        'Operador': v.usuarios?.nome || '-',
        'Cliente': v.clientes?.nome || '-',
        'CPF Cliente': v.cpf,
        'Órgão': v.orgao || '-',
        'Empresa': v.empresa || '-',
        'Operação': v.operacao,
        'Cód. Operação': v.codigo_operacao || '-',
        'Vendedor': getVendedorFormatted(v.corretor),
        'Carteira': getVendedorFormatted(v.carteira),
        'Novo Cliente': v.novo_cliente || '-',
        'Atualização Cadastral': v.atualizacao_cadastral || '-',
        'Valor Contrato': v.valor || 0,
        'Saldo Devedor': v.saldo || 0,
        'Valor Líquido': v.abat || 0,
        'Parcela': v.parcela || 0,
        'Coeficiente': v.coef || 0,
        'Prazo': v.prazo || 0,
        'Banco (Débito)': v.banco || '-',
        'Agência (Débito)': `${v.agencia || ''}-${v.agencia_dv || ''}`,
        'Conta (Débito)': `${v.conta || ''}-${v.conta_dv || ''}${v.tipo_conta ? ` (${v.tipo_conta})` : ''}`,
        'Forma Recebimento': getFormaRecebimentoFormatted(v),
        'PIX (Chave)': v.pix_chave || '-',
        'PIX (Tipo)': v.pix_tipo_chave || '-',
        'Banco (Crédito)': v.credito_banco || '-',
        'Agência (Crédito)': `${v.credito_agencia || ''}-${v.credito_agencia_dv || ''}`,
        'Conta (Crédito)': `${v.credito_conta || ''}-${v.credito_conta_dv || ''}${v.credito_tipo_conta ? ` (${v.credito_tipo_conta})` : ''}`,
        'Contrato nº': v.contrato || '-',
        'Ativação': v.empresa_ativacao || '-',
        'Início (Mês/Ano)': v.inicio ? new Date(v.inicio).toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' }) : '-',
        'Empresa Credora': v.empresa_credora || '-',
        'Observações': v.observacao || '-',
        'Log de Exportação': `Gerado em ${timestamp}`
      }));

      const ExcelJS = (await import('exceljs')).default;
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Relatório de Vendas");

      const headers = Object.keys(rows[0]);
      worksheet.columns = headers.map(header => ({
        header: header,
        key: header,
        width: Math.max(header.length + 4, 15)
      }));

      rows.forEach(rowData => {
        const addedRow = worksheet.addRow(rowData);
        const isPix = String(rowData['Forma Recebimento'])?.toLowerCase().includes('pix');
        const isPoupanca = String(rowData['Conta (Crédito)'])?.toLowerCase().includes('poupan') || 
                           String(rowData['Conta (Débito)'])?.toLowerCase().includes('poupan') || 
                           String(rowData['Forma Recebimento'])?.toLowerCase().includes('poupan');
        if (isPix || isPoupanca) {
          addedRow.eachCell((cell) => {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFFFFF00' }
            };
          });
        }
      });

      const headerRow = worksheet.getRow(1);
      headerRow.font = { name: 'Calibri', family: 2, size: 11, bold: true };
      headerRow.height = 20;

      headerRow.eachCell((cell) => {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFC0C0C0' } },
          left: { style: 'thin', color: { argb: 'FFC0C0C0' } },
          bottom: { style: 'thin', color: { argb: 'FFC0C0C0' } },
          right: { style: 'thin', color: { argb: 'FFC0C0C0' } }
        };
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const filename = `Relatorio_Vendas_${new Date().toISOString().split('T')[0]}.xlsx`;

      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      link.click();
    } catch (e: any) {
      showAlert('Erro', 'Falha ao exportar excel: ' + e.message, 'danger');
    } finally {
      setExporting(false);
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <>
      <ConfirmModal
        isOpen={notification.isOpen}
        title={notification.title}
        message={notification.message}
        confirmType={notification.type}
        onConfirm={notification.onConfirm || (() => { })}
        onCancel={notification.onCancel}
        confirmText={notification.onCancel ? 'Sim, Confirmar' : 'Entendi'}
      />

      <div className="animate-fade-in">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ margin: 0 }}>Vendas</h1>
            <p style={{ color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>Gerencie as operações e acompanhe o status.</p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button className="btn btn-secondary" onClick={exportExcel} disabled={exporting} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Download size={18} /> {exporting ? 'Exportando...' : 'Exportar'}
            </button>
            <Link href="/vendas/novo" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Plus size={18} /> Nova Venda
            </Link>
          </div>
        </div>

        <div className="card" style={{ marginBottom: '2rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
            <input type="text" placeholder="Buscar por Nome ou CPF..." value={search} onChange={handleSearchChange} style={{ paddingLeft: '2.75rem', width: '100%' }} />
          </div>
          <button className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={() => fetchVendas()}>
            <Filter size={18} /> Filtrar
          </button>
        </div>

        <div className="card">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '4rem' }}>Carregando vendas...</div>
          ) : vendas.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--color-text-muted)' }}>Nenhuma venda encontrada.</div>
          ) : (
            <>
              <div className="table-wrapper">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Contrato</th>
                      <th>Data</th>
                      <th>Cliente / CPF</th>
                      <th>Operação</th>
                      <th>Valor</th>
                      <th>Parcela</th>
                      <th>Líquido</th>
                      <th>Vendedor</th>
                      <th>Pago</th>
                      <th style={{ textAlign: 'right' }}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vendas.map((v) => (
                      <tr key={v.id}>
                        <td style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--color-primary)', fontSize: '0.85rem' }}>{getContratoDisplay(v)}</td>
                        <td style={{ fontSize: '0.875rem' }}>{new Date(v.created_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                            <span style={{ fontWeight: 600, textTransform: 'uppercase', fontSize: '0.8rem' }}>
                              {v.clientes?.nome || '-'}
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
                              {v.cpf}
                              <button
                                onClick={() => handleCopy(v.cpf, v.id)}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  padding: '0.2rem',
                                  cursor: 'pointer',
                                  color: copiedId === v.id ? 'var(--color-success)' : 'var(--color-text-muted)',
                                  display: 'flex'
                                }}
                                title="Copiar CPF"
                              >
                                {copiedId === v.id ? <Check size={14} /> : <Copy size={14} />}
                              </button>
                            </div>
                          </div>
                        </td>
                        <td><span className="badge badge-info">{v.operacao}</span></td>
                        <td style={{ fontWeight: 600 }}>R$ {v.valor?.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td>R$ {v.parcela?.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                        <td>{formatLiquido(v.abat)}</td>
                        <td style={{ fontSize: '0.875rem' }}>{v.usuarios?.nome || '-'}</td>
                        <td>
                          {v.status?.toLowerCase() === 'pago' || v.status?.toLowerCase() === 'paga' ? (
                            <span className="badge badge-success">Sim</span>
                          ) : (
                            <span className="badge badge-warning">Não</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                            <button
                              onClick={() => handleOpenSumModal(v)}
                              className="btn btn-secondary"
                              style={{ padding: '0.4rem' }}
                              title="Ver Somatória do CPF"
                              disabled={loadingSumModal}
                            >
                              <Calculator size={16} />
                            </button>
                            <Link href={`/vendas/${v.id}`} className="btn btn-secondary" style={{ padding: '0.4rem' }} title="Visualizar">
                              <Eye size={16} />
                            </Link>
                            {v.status?.toLowerCase() === 'pago' || v.status?.toLowerCase() === 'paga' ? (
                              <span className="btn btn-secondary" style={{ padding: '0.4rem', cursor: 'not-allowed', opacity: 0.6 }} title="Venda Paga (Edição Bloqueada)">
                                <Lock size={16} style={{ color: 'var(--color-text-muted)' }} />
                              </span>
                            ) : (
                              <>
                                <Link href={`/vendas/${v.id}/editar`} className="btn btn-secondary" style={{ padding: '0.4rem' }} title="Editar">
                                  <Edit2 size={16} />
                                </Link>
                                {(nivel === 'admin' || nivel === 'operacional' || (nivel === 'vendedor' && v.created_by === userId)) && (
                                  <button
                                    className="btn btn-danger"
                                    style={{ padding: '0.4rem', background: 'transparent', color: 'var(--color-danger)', border: 'none' }}
                                    onClick={() => showConfirm('Excluir Venda', 'Tem certeza que deseja excluir esta venda permanentemente?', () => handleDelete(v.id), 'danger')}
                                    title="Excluir"
                                  >
                                    <Trash2 size={16} />
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--color-border)' }}>
                  <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                    Total: {total} vendas — Página {page + 1} de {totalPages}
                  </span>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-secondary" style={{ padding: '0.5rem' }} disabled={page === 0} onClick={() => setPage(p => p - 1)}><ChevronLeft size={18} /></button>
                    <button className="btn btn-secondary" style={{ padding: '0.5rem' }} disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}><ChevronRight size={18} /></button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Sum Modal */}
      {sumModalData && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
          backgroundColor: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 9999, padding: '1.5rem'
        }}>
          <div className="card animate-scale-up" style={{ width: '100%', maxWidth: '600px', padding: '0', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
            <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--color-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Calculator className="text-primary" /> Valores Líquidos a Receber
              </h3>
              <button onClick={() => setSumModalData(null)} style={{ background: 'transparent', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}>
                <X size={20} />
              </button>
            </div>
            <div style={{ padding: '1.5rem' }}>
              <div style={{ marginBottom: '1.5rem' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Cliente</div>
                <div style={{ fontWeight: 600, fontSize: '1.1rem', textTransform: 'uppercase' }}>{sumModalData.name}</div>
                <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>CPF: {sumModalData.cpf}</div>
              </div>

              <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: '8px', marginBottom: '1.5rem' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--color-bg-body)', borderBottom: '1px solid var(--color-border)' }}>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', color: 'var(--color-text-muted)' }}>Operação</th>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', color: 'var(--color-text-muted)' }}>Contrato</th>
                      <th style={{ padding: '0.5rem 0.75rem', textAlign: 'right', color: 'var(--color-text-muted)' }}>Valor Líquido</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sumModalData.vendas.length === 0 ? (
                      <tr>
                        <td colSpan={3} style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                          Nenhuma venda em aberto encontrada para este cliente.
                        </td>
                      </tr>
                    ) : (
                      sumModalData.vendas.map((s, idx) => {
                        const valStr = String(s.abat || '0').replace(/\s/g, '');
                        let cleanVal = valStr;
                        if (valStr.includes(',')) {
                          cleanVal = valStr.replace(/\./g, '').replace(',', '.');
                        }
                        const val = parseFloat(cleanVal) || 0;

                        return (
                          <tr key={s.id || idx} style={{ borderBottom: '1px solid var(--color-border)' }}>
                            <td style={{ padding: '0.5rem 0.75rem' }}><span className="badge badge-info">{s.operacao}</span></td>
                            <td style={{ padding: '0.5rem 0.75rem', fontWeight: 500 }}>{s.codigo_operacao || '-'}</td>
                            <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: 600 }}>
                              R$ {val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(79, 70, 229, 0.05)', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--color-primary-light)' }}>
                <span style={{ fontWeight: 600, color: 'var(--color-primary)', fontSize: '0.9rem' }}>Total Líquido Aberto:</span>
                <span style={{ fontWeight: 700, fontSize: '1.1rem', color: 'var(--color-primary)' }}>
                  R$ {sumModalData.total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
            <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'flex-end', background: 'var(--color-bg-body)' }}>
              <button onClick={() => setSumModalData(null)} className="btn btn-secondary">Fechar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
