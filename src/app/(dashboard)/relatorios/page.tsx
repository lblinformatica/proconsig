'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Download, FileSearch, Calendar, Filter, ChevronLeft, ChevronRight, FileText, Clock, User, Search, Copy, Check } from 'lucide-react';
import * as XLSX from 'xlsx';
import { ConfirmModal } from '@/components/ConfirmModal';
import { useEffect } from 'react';
import { sendRelatorioEmail } from '@/app/actions/relatorios';
import { validateCPF, formatCPF, formatAgencia } from '@/lib/cpf';

export default function RelatoriosPage() {
  const [loading, setLoading] = useState(false);
  const [vendas, setVendas] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 25;
  const [vendedores, setVendedores] = useState<any[]>([]);
  const [contas, setContas] = useState<any[]>([]);
  const [operacoes, setOperacoes] = useState<any[]>([]);

  useEffect(() => {
    const fetchMetadata = async () => {
      const { data: vData } = await supabase.schema('pro_consig').from('vendedores').select('codigo, nome');
      if (vData) setVendedores(vData);

      const { data: cData } = await supabase.schema('pro_consig').from('contas').select('*');
      if (cData) setContas(cData);

      const { data: oData } = await supabase.schema('pro_consig').from('operacoes').select('operacao, grupo');
      if (oData) setOperacoes(oData);
    };
    fetchMetadata();
  }, []);

  const getVendedorFormatted = (codigo: string) => {
    if (!codigo) return '-';
    const v = vendedores.find(x => x.codigo === codigo);
    return v ? `${v.codigo} - ${v.nome}` : codigo;
  };

  const getSaleGrupo = (v: any) => {
    if (!v) return '-';
    if (v.grupo !== undefined && v.grupo !== null) {
      return v.grupo.toString();
    }
    if (v.codigo_operacao) {
      const op = operacoes.find(o => o.operacao?.toString() === v.codigo_operacao?.toString());
      if (op && op.grupo !== undefined && op.grupo !== null) {
        return op.grupo.toString();
      }
    }
    if (v.conta_ativacao) {
      const matched = contas.find(c =>
        Number(c.conta_ativacao) === Number(v.conta_ativacao) &&
        (c.empresa_ativacao === v.empresa_ativacao || c.empresa_credora === v.empresa_credora)
      );
      if (matched && matched.grupo !== undefined && matched.grupo !== null) {
        return matched.grupo.toString();
      }
      const matchedByConta = contas.find(c => Number(c.conta_ativacao) === Number(v.conta_ativacao));
      if (matchedByConta && matchedByConta.grupo !== undefined && matchedByConta.grupo !== null) {
        return matchedByConta.grupo.toString();
      }
    }
    return '-';
  };

  const [filters, setFilters] = useState({
    cpf: '', status: 'Aprovado', dataInicio: '', dataFim: '', corretor: ''
  });
  const [modalError, setModalError] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyCPF = (cpf: string, id: string) => {
    navigator.clipboard.writeText(cpf);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const [nivel, setNivel] = useState('');
  const [allowedGroups, setAllowedGroups] = useState<number[]>([]);
  const [userEmail, setUserEmail] = useState('');

  // Carregar dados e perfil do usuário ao entrar na tela
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: profile } = await supabase
        .from('usuarios')
        .select('nivel, grupos_permitidos, email')
        .eq('supabase_user_id', session.user.id)
        .single();

      if (profile) {
        setNivel(profile.nivel);
        setUserEmail(profile.email || session.user.email || '');
        if (profile.nivel === 'financeiro' && profile.grupos_permitidos && profile.grupos_permitidos.length > 0) {
          const groupNumbers = profile.grupos_permitidos.map(Number);
          setAllowedGroups(groupNumbers);
        }
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (nivel !== '') {
      buscarDados(0);
    }
  }, [nivel, allowedGroups]);

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'cpf') {
      setFilters(prev => ({ ...prev, cpf: formatCPF(value) }));
    } else {
      setFilters(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleTogglePaga = async (vendaId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'Pago' ? 'Aprovado' : 'Pago';
    const { error } = await supabase
      .from('vendas')
      .update({ status: newStatus })
      .eq('id', vendaId);

    if (error) {
      setModalError('Erro ao atualizar status da venda: ' + error.message);
    } else {
      setVendas(prev => prev.map(v => v.id === vendaId ? { ...v, status: newStatus } : v));
    }
  };

  const handleToggleSelectAll = async () => {
    if (vendas.length === 0) return;

    const allPaid = vendas.every(v => v.status === 'Pago');
    const newStatus = allPaid ? 'Aprovado' : 'Pago';
    const ids = vendas.map(v => v.id);

    const { error } = await supabase
      .from('vendas')
      .update({ status: newStatus })
      .in('id', ids);

    if (error) {
      setModalError('Erro ao atualizar status das vendas: ' + error.message);
    } else {
      setVendas(prev => prev.map(v => ids.includes(v.id) ? { ...v, status: newStatus } : v));
    }
  };

  const buscarDados = async (p = page) => {
    if (filters.cpf && !validateCPF(filters.cpf)) {
      setModalError('Por favor, informe um CPF válido para realizar a busca.');
      return;
    }
    setLoading(true);
    const from = p * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const twentyMinutesAgo = new Date(Date.now() - 20 * 60 * 1000).toISOString();

    let query = supabase
      .from('vendas')
      .select('*, usuarios!created_by(nome), clientes(nome)', { count: 'exact' })
      .lte('created_at', twentyMinutesAgo)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (nivel === 'financeiro') {
      if (allowedGroups.length > 0) {
        query = query.in('grupo', allowedGroups);
      } else {
        query = query.in('grupo', [-1]);
      }
    }

    if (filters.cpf) query = query.eq('cpf', formatCPF(filters.cpf));
    if (filters.corretor) {
      const matchedCodes = vendedores
        .filter(x => x.nome.toUpperCase().includes(filters.corretor.toUpperCase()) || x.codigo.includes(filters.corretor))
        .map(x => x.codigo);
      if (matchedCodes.length > 0) {
        query = query.in('corretor', matchedCodes);
      } else {
        query = query.eq('corretor', 'NON_EXISTENT_SELLER');
      }
    }
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.dataInicio) query = query.gte('created_at', filters.dataInicio);
    if (filters.dataFim) query = query.lte('created_at', filters.dataFim + 'T23:59:59');

    const { data, count, error } = await query;
    if (error) {
      setModalError('Erro ao buscar dados: ' + error.message);
    } else {
      setVendas(data || []);
      setTotal(count || 0);
    }
    setLoading(false);
  };



  const [countResult, setCountResult] = useState(0);

  const exportExcel = async () => {
    if (filters.cpf && !validateCPF(filters.cpf)) {
      setModalError('Por favor, informe um CPF válido para realizar a busca.');
      return;
    }
    setLoading(true);
    let allData: any[] = [];
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      const twentyMinutesAgo = new Date(Date.now() - 20 * 60 * 1000).toISOString();
      let query = supabase
        .from('vendas')
        .select('*, usuarios!created_by(nome), clientes(nome)')
        .lte('created_at', twentyMinutesAgo)
        .range(page * pageSize, (page + 1) * pageSize - 1)
        .order('created_at', { ascending: false });

      if (nivel === 'financeiro') {
        if (allowedGroups.length > 0) {
          query = query.in('grupo', allowedGroups);
        } else {
          query = query.in('grupo', [-1]);
        }
      }

      if (filters.cpf) query = query.eq('cpf', formatCPF(filters.cpf));
      if (filters.corretor) {
        const matchedCodes = vendedores
          .filter(x => x.nome.toUpperCase().includes(filters.corretor.toUpperCase()) || x.codigo.includes(filters.corretor))
          .map(x => x.codigo);
        if (matchedCodes.length > 0) {
          query = query.in('corretor', matchedCodes);
        } else {
          query = query.eq('corretor', 'NON_EXISTENT_SELLER');
        }
      }
      if (filters.status) query = query.eq('status', filters.status);
      if (filters.dataInicio) query = query.gte('created_at', filters.dataInicio);
      if (filters.dataFim) query = query.lte('created_at', filters.dataFim + 'T23:59:59');

      const { data, error } = await query;

      if (error) {
        setModalError('Erro na exportação: ' + error.message);
        hasMore = false;
        break;
      }

      if (data && data.length > 0) {
        allData = [...allData, ...data];
        if (data.length < pageSize) hasMore = false;
        else page++;
      } else {
        hasMore = false;
      }
    }

    if (allData.length > 0) {
      const timestamp = new Date().toLocaleString('pt-BR');
      const rows = allData.map(v => ({
        'ID Venda': v.venda_id || '-',
        'Status Venda': v.status === 'Pago' ? 'PAGA' : 'ABERTA',
        'Status Exportação': v.data_exportacao_atual ? 'RE-EXPORTADO' : 'NOVO (Primeira Vez)',
        'Penúltima Exportação': v.data_exportacao_anterior ? new Date(v.data_exportacao_anterior).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '-',
        'Última Exportação': v.data_exportacao_atual ? new Date(v.data_exportacao_atual).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : '-',
        'Data Cadastro': new Date(v.created_at).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
        'Hora': new Date(v.created_at).toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo' }),
        'Operador': v.usuarios?.nome || '-',
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
        'Conta (Débito)': `${v.conta || ''}-${v.conta_dv || ''}`,
        'Forma Recebimento': v.forma_credito?.toUpperCase() || '-',
        'PIX (Chave)': v.pix_chave || '-',
        'PIX (Tipo)': v.pix_tipo_chave || '-',
        'Banco (Crédito)': v.credito_banco || '-',
        'Agência (Crédito)': `${v.credito_agencia || ''}-${v.credito_agencia_dv || ''}`,
        'Conta (Crédito)': `${v.credito_conta || ''}-${v.credito_conta_dv || ''}`,
        'Contrato nº': v.contrato || '-',
        'Ativação': v.empresa_ativacao || '-',
        'Início (Mês/Ano)': v.inicio ? new Date(v.inicio).toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' }) : '-',
        'Empresa Credora': v.empresa_credora || '-',
        'Observações': v.observacao || '-',
        'Log de Exportação': `Gerado em ${timestamp}`
      }));

      // Salvar o arquivo
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Relatório de Vendas");
      XLSX.writeFile(workbook, `Relatorio_Vendas_${new Date().toISOString().split('T')[0]}.xlsx`);

      // Atualizar as datas no banco de dados
      const ids = allData.map(v => v.id);
      await supabase.rpc('update_vendas_export_dates', { venda_ids: ids });

      setModalError('Exportação concluída! Os registros foram marcados com a data de hoje.');
    }
    setLoading(false);
  };

  const exportBordero = async () => {
    if (filters.cpf && !validateCPF(filters.cpf)) {
      setModalError('Por favor, informe um CPF válido para realizar a busca.');
      return;
    }
    setLoading(true);
    let allData: any[] = [];
    let pageNum = 0;
    const pageSize = 1000;
    let hasMore = true;

    // Fetch all sales matching filters with 20 minutes delay
    while (hasMore) {
      const twentyMinutesAgo = new Date(Date.now() - 20 * 60 * 1000).toISOString();
      let query = supabase
        .from('vendas')
        .select('*, usuarios!created_by(nome), clientes(nome)')
        .lte('created_at', twentyMinutesAgo)
        .neq('status', 'Pago') // Exclui vendas pagas da exportação do borderô
        .range(pageNum * pageSize, (pageNum + 1) * pageSize - 1)
        .order('created_at', { ascending: false });

      if (nivel === 'financeiro') {
        if (allowedGroups.length > 0) {
          query = query.in('grupo', allowedGroups);
        } else {
          query = query.in('grupo', [-1]);
        }
      }

      if (filters.cpf) query = query.eq('cpf', formatCPF(filters.cpf));
      if (filters.corretor) {
        const matchedCodes = vendedores
          .filter(x => x.nome.toUpperCase().includes(filters.corretor.toUpperCase()) || x.codigo.includes(filters.corretor))
          .map(x => x.codigo);
        if (matchedCodes.length > 0) {
          query = query.in('corretor', matchedCodes);
        } else {
          query = query.eq('corretor', 'NON_EXISTENT_SELLER');
        }
      }
      if (filters.status) query = query.eq('status', filters.status);
      if (filters.dataInicio) query = query.gte('created_at', filters.dataInicio);
      if (filters.dataFim) query = query.lte('created_at', filters.dataFim + 'T23:59:59');

      const { data, error } = await query;

      if (error) {
        setModalError('Erro na busca para o Borderô: ' + error.message);
        hasMore = false;
        break;
      }

      if (data && data.length > 0) {
        allData = [...allData, ...data];
        if (data.length < pageSize) hasMore = false;
        else pageNum++;
      } else {
        hasMore = false;
      }
    }

    if (allData.length === 0) {
      setModalError('Nenhuma venda encontrada para gerar o borderô.');
      setLoading(false);
      return;
    }

    // 1. Get next lote number from pro_consig.borderos_lotes
    let nextLote = 1;
    const getTodayLocalDateStr = () => {
      const d = new Date();
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    const todayStr = getTodayLocalDateStr();

    try {
      const { data: existingLotes, error: fetchError } = await supabase
        .schema('pro_consig')
        .from('borderos_lotes')
        .select('lote')
        .eq('data', todayStr)
        .order('lote', { ascending: false })
        .limit(1);

      if (fetchError) {
        console.error('Erro ao buscar lote:', fetchError);
      } else if (existingLotes && existingLotes.length > 0) {
        nextLote = existingLotes[0].lote + 1;
      }

      const { error: insertError } = await supabase
        .schema('pro_consig')
        .from('borderos_lotes')
        .insert({ data: todayStr, lote: nextLote });

      if (insertError) {
        console.error('Erro ao gravar lote:', insertError);
      }
    } catch (err) {
      console.error('Erro ao processar lote:', err);
    }

    // 2. Format title text
    const todayFormatted = new Date().toLocaleDateString('pt-BR'); // dd/mm/yyyy
    const titleText = `Borderô ${todayFormatted} - Lote ${nextLote}`;



    // Helper to parse BRL comma-separated number strings safely
    const parseBRLString = (val: any) => {
      if (val === undefined || val === null) return 0;
      if (typeof val === 'number') return val;
      const cleaned = String(val).replace(/\s/g, '').replace(',', '.');
      const num = Number(cleaned);
      return isNaN(num) ? 0 : num;
    };

    try {
      // Fetch contas and operacoes to resolve Grupo
      const { data: allContas } = await supabase.schema('pro_consig').from('contas').select('*');
      const uniqueOpCodes = Array.from(new Set(allData.map(v => v.codigo_operacao).filter(Boolean)));
      let opsData: any[] = [];
      if (uniqueOpCodes.length > 0) {
        const { data } = await supabase
          .schema('pro_consig')
          .from('operacoes')
          .select('operacao, grupo')
          .in('operacao', uniqueOpCodes);
        opsData = data || [];
      }

      const opGroupMap: { [opCode: string]: number } = {};
      opsData.forEach(op => {
        if (op.operacao) {
          opGroupMap[op.operacao.toString()] = op.grupo;
        }
      });

      // Import exceljs dynamically to avoid SSR building issues
      const ExcelJS = (await import('exceljs')).default;
      const workbook = new ExcelJS.Workbook();

      const styleRow = (
        row: any,
        isHeader = false,
        isTotal = false,
        highlightYellow = false,
        valorCreditoCol = 10,
        centerCols = [1, 2, 3, 4, 5, 6, 7, 8, 12, 16, 17, 18],
        highlightOrange = false
      ) => {
        row.eachCell({ includeEmpty: true }, (cell: any, colNumber: number) => {
          // Font
          if (isHeader) {
            cell.font = { name: 'Calibri', family: 2, size: 11, bold: true, italic: true, color: { argb: 'FF000000' } };
          } else if (isTotal) {
            cell.font = { name: 'Calibri', family: 2, size: 11, bold: true };
          } else {
            cell.font = { name: 'Calibri', family: 2, size: 11 };
          }

          // Border
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFC0C0C0' } },
            left: { style: 'thin', color: { argb: 'FFC0C0C0' } },
            bottom: { style: 'thin', color: { argb: 'FFC0C0C0' } },
            right: { style: 'thin', color: { argb: 'FFC0C0C0' } }
          };

          // Fill (Orange for savings accounts, Yellow for highlighted rows, standard for others)
          if (!isHeader && !isTotal) {
            if (highlightOrange) {
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFFFCC80' }
              };
            } else if (highlightYellow) {
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFFFFF00' }
              };
            }
          }

          // Alignment
          if (isHeader) {
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
          } else if (isTotal) {
            if (colNumber === valorCreditoCol) {
              cell.alignment = { horizontal: 'right', vertical: 'middle' };
            }
          } else {
            // Data cells alignment
            if (centerCols.includes(colNumber)) {
              cell.alignment = { horizontal: 'center', vertical: 'middle' };
            } else if (colNumber === valorCreditoCol) { // Valor Crédito
              cell.alignment = { horizontal: 'right', vertical: 'middle' };
            } else {
              cell.alignment = { horizontal: 'left', vertical: 'middle' };
            }
          }

          // Number formats
          if (colNumber === valorCreditoCol && !isHeader) {
            cell.numFmt = '#,##0.00';
          }
        });
      };

      const timestamp = new Date().toLocaleString('pt-BR');

      // ────────────────────────────────────────────────────────────────────────
      // SHEET 1: DETALHADO (Detailed)
      // ────────────────────────────────────────────────────────────────────────
      const wsDetailed = workbook.addWorksheet('Detalhado');

      wsDetailed.columns = [
        { header: 'Nome', key: 'nome', width: 26 },
        { header: 'CPF', key: 'cpf', width: 15 },
        { header: 'ID Venda', key: 'venda_id', width: 15 },
        { header: 'Forma Recebimento', key: 'forma_recebimento', width: 20 },
        { header: 'Banco', key: 'banco', width: 8 },
        { header: 'Agência ', key: 'agencia', width: 10 },
        { header: 'DV', key: 'agencia_dv', width: 5 },
        { header: 'OP', key: 'op', width: 6 },
        { header: 'Conta', key: 'conta', width: 13 },
        { header: 'DV', key: 'conta_dv', width: 8 },
        { header: 'Chave PIX', key: 'chave_pix', width: 13 },
        { header: 'Pix', key: 'pix', width: 39 },
        { header: 'Valor Crédito', key: 'valor_credito', width: 15 },
        { header: 'Grupo', key: 'grupo', width: 8 },
        { header: 'Obs.:', key: 'obs', width: 34 },
        { header: 'Status PG', key: 'status_pg', width: 12 },
        { header: 'Vendedor', key: 'vendedor', width: 17 },
        { header: 'Carteira', key: 'carteira', width: 15 },
        { header: 'Gerado', key: 'gerado', width: 21 },
        { header: 'Cód. Operação', key: 'cod_operacao', width: 20 },
        { header: 'Empresa Credora', key: 'empresa_credora', width: 19 },
        { header: 'Novo Cliente', key: 'novo_cliente', width: 15 },
        { header: 'Atualização Cadastral', key: 'atualizacao_cadastral', width: 20 }
      ];

      // Row 1: Merged Title Block (A1:W1 since we added columns, total 23 columns)
      wsDetailed.mergeCells('A1:W1');
      const titleCellDet = wsDetailed.getCell('A1');
      titleCellDet.value = titleText;
      titleCellDet.font = { name: 'Calibri', family: 2, size: 24, color: { argb: 'FF000000' } };
      titleCellDet.alignment = { horizontal: 'left', vertical: 'middle' };
      wsDetailed.getRow(1).height = 31.2;

      // Row 2: Headers
      const headerRowDet = wsDetailed.getRow(2);
      headerRowDet.values = [
        'Nome', 'CPF', 'ID Venda', 'Forma Recebimento', 'Banco', 'Agência ', 'DV', 'OP', 'Conta', 'DV', 'Chave PIX', 'Pix', 'Valor Crédito', 'Grupo', 'Obs.:', 'Status PG', 'Vendedor', 'Carteira', 'Gerado', 'Cód. Operação', 'Empresa Credora', 'Novo Cliente', 'Atualização Cadastral'
      ];
      headerRowDet.height = 20;
      styleRow(headerRowDet, true, false, false, 13, [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 14, 16, 19, 20, 21, 22, 23]);

      // Row 3+: Data Rows
      allData.forEach((v) => {
        const isPix = v.forma_credito?.toLowerCase() === 'pix';

        // Get Group
        let saleGrupo = '';
        if (v.codigo_operacao && opGroupMap[v.codigo_operacao.toString()]) {
          saleGrupo = opGroupMap[v.codigo_operacao.toString()].toString();
        } else {
          const matched = allContas?.find(c =>
            Number(c.conta_ativacao) === Number(v.conta_ativacao) &&
            (c.empresa_ativacao === v.empresa_ativacao || c.empresa_credora === v.empresa_credora)
          );
          if (matched) {
            saleGrupo = matched.grupo.toString();
          } else {
            const matchedByConta = allContas?.find(c => Number(c.conta_ativacao) === Number(v.conta_ativacao));
            if (matchedByConta) {
              saleGrupo = matchedByConta.grupo.toString();
            }
          }
        }

        const rowData = {
          nome: v.clientes?.nome || '',
          cpf: v.cpf || '',
          venda_id: v.venda_id || '',
          forma_recebimento: v.forma_credito?.toUpperCase() || '',
          banco: isPix ? '' : (v.credito_banco || ''),
          agencia: isPix ? '' : formatAgencia(v.credito_agencia),
          agencia_dv: isPix ? '' : (v.credito_agencia_dv || ''),
          op: isPix ? '' : (v.op || ''),
          conta: isPix ? '' : (v.credito_conta || ''),
          conta_dv: isPix ? '' : (v.credito_conta_dv || ''),
          chave_pix: isPix ? (v.pix_tipo_chave || '') : '',
          pix: isPix ? (v.pix_chave || '') : '',
          valor_credito: parseBRLString(v.abat),
          grupo: saleGrupo,
          obs: v.observacao || '',
          status_pg: '',
          vendedor: getVendedorFormatted(v.corretor),
          carteira: getVendedorFormatted(v.carteira),
          gerado: timestamp,
          cod_operacao: v.codigo_operacao || '',
          empresa_credora: v.empresa_credora || '',
          novo_cliente: v.novo_cliente || '',
          atualizacao_cadastral: v.atualizacao_cadastral || ''
        };

        const addedRow = wsDetailed.addRow(rowData);
        addedRow.height = 20;
        const isPoupanca = v.credito_tipo_conta?.toLowerCase() === 'poupança' || v.tipo_conta?.toLowerCase() === 'poupança';
        styleRow(addedRow, false, false, isPix, 13, [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 14, 16, 19, 20, 21, 22, 23], isPoupanca);
      });

      // Total Row (Valor Crédito is now in column 13 (M))
      const lastRowIndexDet = wsDetailed.rowCount + 1;
      const totalRowDet = wsDetailed.getRow(lastRowIndexDet);
      totalRowDet.height = 20;
      totalRowDet.getCell(13).value = { formula: `SUM(M3:M${lastRowIndexDet - 1})` };
      styleRow(totalRowDet, false, true, false, 13, [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 14, 16, 19, 20, 21, 22, 23]);

      // ────────────────────────────────────────────────────────────────────────
      // SHEET 2: CONSOLIDADO (Consolidado)
      // ────────────────────────────────────────────────────────────────────────
      const wsConsolidated = workbook.addWorksheet('Consolidado');

      wsConsolidated.columns = [
        { header: 'Nome', key: 'nome', width: 26 },
        { header: 'CPF', key: 'cpf', width: 15 },
        { header: 'Forma Recebimento', key: 'forma_recebimento', width: 20 },
        { header: 'Banco', key: 'banco', width: 8 },
        { header: 'Agência ', key: 'agencia', width: 10 },
        { header: 'DV', key: 'agencia_dv', width: 5 },
        { header: 'OP', key: 'op', width: 6 },
        { header: 'Conta', key: 'conta', width: 13 },
        { header: 'DV', key: 'conta_dv', width: 8 },
        { header: 'Chave PIX', key: 'chave_pix', width: 13 },
        { header: 'Pix', key: 'pix', width: 39 },
        { header: 'Valor Crédito', key: 'valor_credito', width: 15 },
        { header: 'Grupo', key: 'grupo', width: 8 },
        { header: 'Obs.:', key: 'obs', width: 34 },
        { header: 'Status PG', key: 'status_pg', width: 12 },
        { header: 'Vendedor', key: 'vendedor', width: 17 },
        { header: 'Carteira', key: 'carteira', width: 15 },
        { header: 'Gerado', key: 'gerado', width: 21 },
        { header: 'Empresa Credora', key: 'empresa_credora', width: 19 },
        { header: 'Novo Cliente', key: 'novo_cliente', width: 15 },
        { header: 'Atualização Cadastral', key: 'atualizacao_cadastral', width: 20 }
      ];

      // Row 1: Merged Title Block (A1:U1 since we added columns, total 21 columns)
      wsConsolidated.mergeCells('A1:U1');
      const titleCellCons = wsConsolidated.getCell('A1');
      titleCellCons.value = titleText;
      titleCellCons.font = { name: 'Calibri', family: 2, size: 24, color: { argb: 'FF000000' } };
      titleCellCons.alignment = { horizontal: 'left', vertical: 'middle' };
      wsConsolidated.getRow(1).height = 31.2;

      // Row 2: Headers
      const headerRowCons = wsConsolidated.getRow(2);
      headerRowCons.values = [
        'Nome', 'CPF', 'Forma Recebimento', 'Banco', 'Agência ', 'DV', 'OP', 'Conta', 'DV', 'Chave PIX', 'Pix', 'Valor Crédito', 'Grupo', 'Obs.:', 'Status PG', 'Vendedor', 'Carteira', 'Gerado', 'Empresa Credora', 'Novo Cliente', 'Atualização Cadastral'
      ];
      headerRowCons.height = 20;
      styleRow(headerRowCons, true, false, false, 12, [2, 3, 4, 5, 6, 7, 8, 9, 10, 13, 15, 18, 19, 20, 21]);

      // Group data by CPF for consolidation
      const groupedData: { [cpf: string]: any[] } = {};
      allData.forEach(v => {
        if (v.cpf) {
          if (!groupedData[v.cpf]) groupedData[v.cpf] = [];
          groupedData[v.cpf].push(v);
        }
      });

      // Add grouped rows
      Object.keys(groupedData).forEach(cpf => {
        const sales = groupedData[cpf];
        const primarySale = sales[0];
        const isPix = primarySale.forma_credito?.toLowerCase() === 'pix';

        // Sum net values
        const totalValue = sales.reduce((sum, s) => sum + parseBRLString(s.abat), 0);

        // Concatenate observations and codes
        const allObs = sales.map(s => s.observacao).filter(Boolean).join('; ');

        // Get Group
        let saleGrupo = '';
        if (primarySale.codigo_operacao && opGroupMap[primarySale.codigo_operacao.toString()]) {
          saleGrupo = opGroupMap[primarySale.codigo_operacao.toString()].toString();
        } else {
          const matched = allContas?.find(c =>
            Number(c.conta_ativacao) === Number(primarySale.conta_ativacao) &&
            (c.empresa_ativacao === primarySale.empresa_ativacao || c.empresa_credora === primarySale.empresa_credora)
          );
          if (matched) {
            saleGrupo = matched.grupo.toString();
          } else {
            const matchedByConta = allContas?.find(c => Number(c.conta_ativacao) === Number(primarySale.conta_ativacao));
            if (matchedByConta) {
              saleGrupo = matchedByConta.grupo.toString();
            }
          }
        }

        const rowData = {
          nome: primarySale.clientes?.nome || '',
          cpf: cpf,
          forma_recebimento: primarySale.forma_credito?.toUpperCase() || '',
          banco: isPix ? '' : (primarySale.credito_banco || ''),
          agencia: isPix ? '' : formatAgencia(primarySale.credito_agencia),
          agencia_dv: isPix ? '' : (primarySale.credito_agencia_dv || ''),
          op: isPix ? '' : (primarySale.op || ''),
          conta: isPix ? '' : (primarySale.credito_conta || ''),
          conta_dv: isPix ? '' : (primarySale.credito_conta_dv || ''),
          chave_pix: isPix ? (primarySale.pix_tipo_chave || '') : '',
          pix: isPix ? (primarySale.pix_chave || '') : '',
          valor_credito: totalValue,
          grupo: saleGrupo,
          obs: allObs,
          status_pg: '',
          vendedor: getVendedorFormatted(primarySale.corretor),
          carteira: getVendedorFormatted(primarySale.carteira),
          gerado: timestamp,
          empresa_credora: primarySale.empresa_credora || '',
          novo_cliente: primarySale.novo_cliente || '',
          atualizacao_cadastral: primarySale.atualizacao_cadastral || ''
        };

        const addedRow = wsConsolidated.addRow(rowData);
        addedRow.height = 20;
        const isPoupanca = sales.some(s => s.credito_tipo_conta?.toLowerCase() === 'poupança' || s.tipo_conta?.toLowerCase() === 'poupança');
        styleRow(addedRow, false, false, isPix, 12, [2, 3, 4, 5, 6, 7, 8, 9, 10, 13, 15, 18, 19, 20, 21], isPoupanca);
      });

      // Total Row
      const lastRowIndexCons = wsConsolidated.rowCount + 1;
      const totalRowCons = wsConsolidated.getRow(lastRowIndexCons);
      totalRowCons.height = 20;
      totalRowCons.getCell(12).value = { formula: `SUM(L3:L${lastRowIndexCons - 1})` };
      styleRow(totalRowCons, false, true, false, 12, [2, 3, 4, 5, 6, 7, 8, 9, 10, 13, 15, 18, 19, 20, 21]);

      // ────────────────────────────────────────────────────────────────────────
      // SHEET 3: CADASTRO E-MAIL (Cadastro E-mail)
      // ────────────────────────────────────────────────────────────────────────
      const wsEmail = workbook.addWorksheet('Cadastro E-mail');

      wsEmail.columns = [
        { header: 'Empresa Credora', key: 'empresa_credora', width: 20 },
        { header: 'Empresa Ativação', key: 'empresa_ativacao', width: 20 },
        { header: 'Código Convênio', key: 'codigo_convenio', width: 18 },
        { header: 'Conta Ativação', key: 'conta_ativacao', width: 16 },
        { header: 'CONTRATO', key: 'contrato', width: 15 },
        { header: 'Data', key: 'data', width: 12 },
        { header: 'Nome', key: 'nome', width: 30 },
        { header: 'CPF', key: 'cpf', width: 16 },
        { header: 'Órgão', key: 'orgao', width: 20 },
        { header: 'Dia Útil', key: 'dia_util', width: 10 },
        { header: 'Conf', key: 'conf1', width: 8 },
        { header: 'Inicio', key: 'inicio', width: 12 },
        { header: 'Conf', key: 'conf2', width: 8 },
        { header: 'Restam', key: 'restam', width: 10 },
        { header: 'Abatidas', key: 'abatidas', width: 10 },
        { header: 'Conf', key: 'conf3', width: 8 },
        { header: 'Vendedor', key: 'vendedor', width: 20 },
        { header: 'Corretor', key: 'corretor', width: 15 },
        { header: 'Banco', key: 'banco', width: 10 },
        { header: 'Agência', key: 'agencia', width: 10 },
        { header: 'DV', key: 'agencia_dv', width: 6 },
        { header: 'OP', key: 'op', width: 6 },
        { header: 'Conta', key: 'conta', width: 15 },
        { header: 'DV', key: 'conta_dv', width: 6 },
        { header: 'Vr. Contrato', key: 'vr_contrato', width: 15 },
        { header: 'Liq. Cliente', key: 'liq_cliente', width: 15 },
        { header: 'Prazo', key: 'prazo', width: 8 },
        { header: 'Parcela', key: 'parcela', width: 15 },
        { header: 'Coeficiente', key: 'coeficiente', width: 12 },
        { header: 'Código WEBDEC', key: 'codigo_webdec', width: 18 },
        { header: 'Novo Cliente', key: 'novo_cliente', width: 15 },
        { header: 'Atualização Cadastral', key: 'atualizacao_cadastral', width: 20 },
        { header: 'Observação', key: 'observacao', width: 35 }
      ];

      // Helper to extract numbers from empresa_ativacao
      const getConvenioCode = (empresa: string) => {
        if (!empresa) return '';
        const match = empresa.match(/\d+/g);
        return match ? match.join('') : '';
      };

      // Style Header Row
      const headerRowEmail = wsEmail.getRow(1);
      headerRowEmail.height = 20;
      headerRowEmail.eachCell({ includeEmpty: true }, (cell) => {
        cell.font = { name: 'Calibri', family: 2, size: 11, bold: true, italic: true };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFC0C0C0' } },
          left: { style: 'thin', color: { argb: 'FFC0C0C0' } },
          bottom: { style: 'thin', color: { argb: 'FFC0C0C0' } },
          right: { style: 'thin', color: { argb: 'FFC0C0C0' } }
        };
      });

      // Data Rows
      allData.forEach((v) => {
        const dataCadastro = v.created_at ? new Date(v.created_at) : null;
        const dataInicio = v.inicio ? new Date(v.inicio + 'T12:00:00') : null;

        const rowData = {
          empresa_credora: v.empresa_credora || '',
          empresa_ativacao: v.empresa_ativacao || '',
          codigo_convenio: getConvenioCode(v.empresa_ativacao),
          conta_ativacao: v.conta_ativacao || '',
          contrato: v.contrato || '',
          data: dataCadastro,
          nome: v.clientes?.nome || '',
          cpf: v.cpf || '',
          orgao: v.empresa || '', // Órgão column gets the 'empresa' field as per instructions
          dia_util: v.dia_util || '',
          conf1: '',
          inicio: dataInicio,
          conf2: '',
          restam: v.restam !== null && v.restam !== undefined ? v.restam : '',
          abatidas: v.abatidas !== null && v.abatidas !== undefined ? v.abatidas : '',
          conf3: '',
          vendedor: getVendedorFormatted(v.corretor),
          corretor: getVendedorFormatted(v.carteira),
          banco: v.credito_banco || '',
          agencia: formatAgencia(v.credito_agencia),
          agencia_dv: v.credito_agencia_dv || '',
          op: v.op || '',
          conta: v.credito_conta || '',
          conta_dv: v.credito_conta_dv || '',
          vr_contrato: v.valor || 0,
          liq_cliente: parseBRLString(v.abat),
          prazo: v.prazo ? `${v.prazo}X` : '',
          parcela: v.parcela || 0,
          coeficiente: v.coef || 0,
          codigo_webdec: '',
          novo_cliente: v.novo_cliente || '',
          atualizacao_cadastral: v.atualizacao_cadastral || '',
          observacao: v.observacao || ''
        };

        const addedRow = wsEmail.addRow(rowData);
        addedRow.height = 20;

        const isPoupanca = v.credito_tipo_conta?.toLowerCase() === 'poupança' || v.tipo_conta?.toLowerCase() === 'poupança';

        addedRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          cell.font = { name: 'Calibri', family: 2, size: 11 };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFC0C0C0' } },
            left: { style: 'thin', color: { argb: 'FFC0C0C0' } },
            bottom: { style: 'thin', color: { argb: 'FFC0C0C0' } },
            right: { style: 'thin', color: { argb: 'FFC0C0C0' } }
          };

          if (isPoupanca) {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFFFCC80' }
            };
          }

          // Alignment
          const centerCols = [3, 4, 5, 6, 8, 10, 11, 12, 13, 14, 15, 16, 19, 20, 21, 22, 23, 24, 27, 30, 31, 32];
          const rightCols = [25, 26, 28, 29];

          if (centerCols.includes(colNumber)) {
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
          } else if (rightCols.includes(colNumber)) {
            cell.alignment = { horizontal: 'right', vertical: 'middle' };
          } else {
            cell.alignment = { horizontal: 'left', vertical: 'middle' };
          }

          // Number Formats
          if ([25, 26, 28].includes(colNumber)) {
            cell.numFmt = '#,##0.00';
          } else if (colNumber === 29) {
            cell.numFmt = '0.000';
          } else if (colNumber === 6) {
            cell.numFmt = 'yyyy-mm-dd';
          } else if (colNumber === 12) {
            cell.numFmt = 'mm/yyyy';
          }
        });
      });

      // ────────────────────────────────────────────────────────────────────────
      // GENERATE AND DOWNLOAD
      // ────────────────────────────────────────────────────────────────────────
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const filename = `Bordero_${todayStr.split('-').reverse().join('_')}_Lote_${nextLote}.xlsx`;

      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Marcar as vendas do relatório como pagas
      const ids = allData.map(v => v.id);
      const { error: updateStatusError } = await supabase
        .from('vendas')
        .update({ status: 'Pago' })
        .in('id', ids);

      if (updateStatusError) {
        console.error('Erro ao marcar vendas como pagas:', updateStatusError);
      }

      // Enviar email para o usuário logado com o anexo em base64
      let emailSuccessMsg = '';
      try {
        const { data: { session } } = await supabase.auth.getSession();
        console.log('Sessão obtida para envio de e-mail:', session);
        if (session?.user?.id) {
          // Buscar o e-mail do usuário na tabela pro_consig.usuarios
          const { data: dbUser } = await supabase
            .from('usuarios')
            .select('email')
            .eq('supabase_user_id', session.user.id)
            .single();

          const recipientEmail = dbUser?.email || session.user.email;

          if (recipientEmail) {
            console.log('Enviando e-mail do borderô para:', recipientEmail);
            // Converter ArrayBuffer para base64
            const uint8 = new Uint8Array(buffer);
            let binary = '';
            for (let i = 0; i < uint8.length; i++) {
              binary += String.fromCharCode(uint8[i]);
            }
            const base64 = window.btoa(binary);

            const emailRes = await sendRelatorioEmail({
              to: recipientEmail,
              subject: `Borderô Gerado - Lote ${nextLote}`,
              html: `
                <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                  <!-- Header Banner -->
                  <div style="background-color: #4f46e5; padding: 25px 20px; text-align: center;">
                    <table style="margin: 0 auto; border-collapse: collapse; border: none;">
                      <tr>
                        <td style="padding-right: 12px; vertical-align: middle; border: none;">
                          <img src="cid:branding_logo" alt="Logo" width="40" height="40" style="border-radius: 8px; display: block; object-fit: cover; border: none;" />
                        </td>
                        <td style="text-align: left; vertical-align: middle; border: none;">
                          <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700; line-height: 1.0; letter-spacing: -0.5px; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; border: none;">Central Pagamentos</h1>
                        </td>
                      </tr>
                    </table>
                  </div>
                  
                  <!-- Content Box -->
                  <div style="padding: 30px 25px; background-color: #ffffff; color: #1e293b; line-height: 1.6;">
                    <p style="margin-top: 0; font-size: 16px;">Olá,</p>
                    <p style="font-size: 15px;">O Borderô correspondente ao lote <strong style="color: #4f46e5; font-size: 16px;">${nextLote}</strong> foi gerado com sucesso pelo sistema em <strong>${todayFormatted}</strong>.</p>
                    
                    <!-- Details Card -->
                    <div style="background-color: #f8fafc; border: 1px solid #f1f5f9; border-radius: 8px; padding: 20px; margin: 25px 0;">
                      <h3 style="margin-top: 0; margin-bottom: 15px; color: #334155; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Informações do Lote</h3>
                      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                        <tr>
                          <td style="padding: 6px 0; color: #64748b;">Número do Lote:</td>
                          <td style="padding: 6px 0; font-weight: 600; text-align: right; color: #0f172a;">Lote ${nextLote}</td>
                        </tr>
                        <tr>
                          <td style="padding: 6px 0; color: #64748b;">Data de Geração:</td>
                          <td style="padding: 6px 0; font-weight: 600; text-align: right; color: #0f172a;">${todayFormatted}</td>
                        </tr>
                        <tr>
                          <td style="padding: 6px 0; color: #64748b;">Arquivo:</td>
                          <td style="padding: 6px 0; font-weight: 600; text-align: right; color: #0f172a;">${filename}</td>
                        </tr>
                      </table>
                    </div>

                    <p style="font-size: 15px;">O arquivo Excel consolidado contendo as 3 planilhas (<strong>Detalhado</strong>, <strong>Consolidado</strong> e <strong>Cadastro E-mail</strong>) já foi anexado a este e-mail para o seu controle.</p>
                    
                    <p style="font-size: 14px; color: #64748b; margin-bottom: 0;">Se precisar de suporte, entre em contato com o administrador do sistema.</p>
                  </div>
                  
                  <!-- Footer -->
                  <div style="background-color: #f1f5f9; padding: 15px 20px; text-align: center; border-top: 1px solid #e2e8f0;">
                    <p style="margin: 0; font-size: 11px; color: #94a3b8;">© 2026 ProConsig - Central Pagamentos. Todos os direitos reservados.</p>
                  </div>
                </div>
              `,
              base64Attachment: base64,
              filename: filename
            });

            if (emailRes && !emailRes.success) {
              console.error('Erro retornado pela Server Action de e-mail:', emailRes.error);
              emailSuccessMsg = `\n\n(Aviso: O e-mail não pôde ser enviado. Erro: ${emailRes.error})`;
            } else {
              console.log('E-mail enviado com sucesso com id:', emailRes?.data);
              emailSuccessMsg = `\n\n(E-mail com anexo enviado para: ${recipientEmail})`;
            }
          } else {
            console.warn('Nenhum e-mail de usuário logado encontrado.');
            emailSuccessMsg = `\n\n(Aviso: E-mail não enviado porque não foi encontrado o endereço eletrônico)`;
          }
        } else {
          console.warn('Nenhum usuário logado encontrado na sessão do Supabase.');
          emailSuccessMsg = `\n\n(Aviso: E-mail não enviado porque não há sessão ativa)`;
        }
      } catch (emailErr: any) {
        console.error('Erro ao enviar email com anexo:', emailErr);
        emailSuccessMsg = `\n\n(Aviso: Erro ao enviar e-mail: ${emailErr.message || emailErr})`;
      }

      // Atualizar dados locais da tabela
      buscarDados(page);

      setModalError(`Borderô gerado com sucesso!\nAs vendas foram marcadas como pagas.\nNúmero do Lote: ${nextLote}${emailSuccessMsg}`);
    } catch (err: any) {
      setModalError('Erro ao gerar o Excel do Borderô: ' + err.message);
    }
    setLoading(false);
    return; // ensure final statement
  };

  return (
    <div className="animate-fade-in">
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ margin: 0 }}>Relatórios de Vendas</h1>
        <p style={{ color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>Filtre e exporte dados detalhados para Excel.</p>
      </div>

      <div className="card" style={{ marginBottom: '2rem', padding: '1.25rem' }}>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '180px' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'capitalize' }}>CPF</label>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
              <input name="cpf" type="text" value={filters.cpf} onChange={handleFilterChange} placeholder="000.000.000-00" maxLength={14} style={{ width: '100%', paddingLeft: '2.5rem', height: '42px' }} />
            </div>
          </div>
          <div style={{ flex: 1, minWidth: '180px' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'capitalize' }}>Vendedor</label>
            <div style={{ position: 'relative' }}>
              <User size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
              <input name="corretor" type="text" value={filters.corretor} onChange={handleFilterChange} placeholder="Nome do vendedor..." style={{ width: '100%', paddingLeft: '2.5rem', height: '42px' }} />
            </div>
          </div>
          <div style={{ flex: 1, minWidth: '150px' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'capitalize' }}>Status Venda</label>
            <select
              name="status"
              value={filters.status}
              onChange={handleFilterChange}
              style={{
                width: '100%',
                height: '42px',
                padding: '0 1rem',
                borderRadius: '8px',
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-bg-surface)',
                color: 'var(--color-text)',
                cursor: 'pointer',
                outline: 'none'
              }}
            >
              <option value="">Todos</option>
              <option value="Aprovado">Aberta (Não Paga)</option>
              <option value="Pago">Paga</option>
            </select>
          </div>
          <div style={{ width: '180px' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'capitalize' }}>Data Inicial</label>
            <div style={{ position: 'relative' }}>
              <Calendar size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
              <input name="dataInicio" type="date" value={filters.dataInicio} onChange={handleFilterChange} style={{ width: '100%', paddingLeft: '2.5rem', height: '42px' }} />
            </div>
          </div>
          <div style={{ width: '180px' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'capitalize' }}>Data Final</label>
            <div style={{ position: 'relative' }}>
              <Calendar size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
              <input name="dataFim" type="date" value={filters.dataFim} onChange={handleFilterChange} style={{ width: '100%', paddingLeft: '2.5rem', height: '42px' }} />
            </div>
          </div>
          <button
            className="btn btn-secondary"
            onClick={() => { setPage(0); buscarDados(0); }}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', height: '42px', padding: '0 1.5rem' }}
          >
            <Filter size={18} /> {loading ? '...' : 'Filtrar'}
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: '0' }}>

        <div style={{ padding: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ padding: '0.5rem', borderRadius: '10px', backgroundColor: 'var(--color-primary-light)', color: 'var(--color-primary)' }}>
              <FileText size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0 }}>Registros Encontrados</h3>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Total de <strong>{total}</strong> vendas apuradas</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-secondary" onClick={exportExcel} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Download size={18} /> {loading ? 'Processando...' : 'Exportar para Excel'}
            </button>
            <button className="btn btn-primary" onClick={exportBordero} disabled={loading} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <FileText size={18} /> {loading ? 'Processando...' : 'Gerar Borderô'}
            </button>
          </div>
        </div>

        <div className="table-wrapper">
          <table className="table">
            <thead>
              <tr>
                <th style={{ paddingLeft: '1.5rem', width: '100px', textAlign: 'left' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input
                      type="checkbox"
                      checked={vendas.length > 0 && vendas.every(v => v.status === 'Pago')}
                      onChange={handleToggleSelectAll}
                      style={{ cursor: 'pointer', transform: 'scale(1.2)' }}
                      title="Selecionar todas como pagas"
                    />
                    <span>Paga?</span>
                  </div>
                </th>
                <th>ID Venda</th>
                <th>Cliente / CPF</th>
                <th>Operação</th>
                <th>Valor</th>
                <th>Vendedor</th>
                <th>Grupo</th>
                <th>Novo?</th>
                <th>Atualização?</th>
                <th>Banco</th>
                <th>Última Exportação</th>
                <th>Data Cadastro</th>
              </tr>
            </thead>
            <tbody>
              {vendas.length === 0 ? (
                <tr>
                  <td colSpan={12} style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>Nenhum dado para exibir com esses filtros.</td>
                </tr>
              ) : (
                vendas.map((v) => (
                  <tr key={v.id}>
                    <td style={{ paddingLeft: '1.5rem', textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={v.status === 'Pago'}
                        onChange={() => handleTogglePaga(v.id, v.status)}
                        style={{ cursor: 'pointer', transform: 'scale(1.2)' }}
                      />
                    </td>
                    <td style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{v.venda_id || '-'}</td>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: '0.8rem' }}>{v.clientes?.nome || '-'}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '0.15rem' }}>
                        {v.cpf}
                        <button
                          onClick={() => handleCopyCPF(v.cpf, v.id)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            padding: '0.1rem',
                            cursor: 'pointer',
                            color: copiedId === v.id ? 'var(--color-success)' : 'var(--color-text-light)',
                            display: 'flex',
                            alignItems: 'center'
                          }}
                          title="Copiar CPF"
                        >
                          {copiedId === v.id ? <Check size={12} /> : <Copy size={12} />}
                        </button>
                      </div>
                    </td>
                    <td style={{ fontSize: '0.85rem' }}>{v.operacao}</td>
                    <td style={{ fontWeight: 600 }}>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v.valor || 0)}</td>
                    <td style={{ fontSize: '0.8rem' }}>{getVendedorFormatted(v.corretor)}</td>
                    <td style={{ fontSize: '0.85rem', fontWeight: 600 }}>{getSaleGrupo(v)}</td>
                    <td>{v.novo_cliente || '-'}</td>
                    <td>{v.atualizacao_cadastral || '-'}</td>
                    <td>{v.banco}</td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Clock size={14} />
                        {v.data_exportacao_atual ? new Date(v.data_exportacao_atual).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : 'Nunca Exportado'}
                      </div>
                    </td>
                    <td style={{ fontSize: '0.8rem' }}>{new Date(v.created_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {total > PAGE_SIZE && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.5rem', borderTop: '1px solid var(--color-border)' }}>
            <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
              Página {page + 1} de {Math.ceil(total / PAGE_SIZE)}
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn-secondary" style={{ padding: '0.5rem' }} disabled={page === 0} onClick={() => { setPage(p => p - 1); buscarDados(page - 1); }}><ChevronLeft size={18} /></button>
              <button className="btn btn-secondary" style={{ padding: '0.5rem' }} disabled={page >= Math.ceil(total / PAGE_SIZE) - 1} onClick={() => { setPage(p => p + 1); buscarDados(page + 1); }}><ChevronRight size={18} /></button>
            </div>
          </div>
        )}
      </div>



      <ConfirmModal
        isOpen={!!modalError}
        title="Relatórios"
        message={modalError}
        onConfirm={() => setModalError('')}
        confirmText="Entendi"
        confirmType="primary"
      />
    </div>
  );
}
