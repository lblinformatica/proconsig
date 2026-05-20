'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Download, FileSearch, Calendar, Filter, ChevronLeft, ChevronRight, FileText, Clock, User, Search, Copy, Check } from 'lucide-react';
import * as XLSX from 'xlsx';
import { ConfirmModal } from '@/components/ConfirmModal';
import { useEffect } from 'react';

export default function RelatoriosPage() {
  const [loading, setLoading] = useState(false);
  const [vendas, setVendas] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 25;

  const [filters, setFilters] = useState({
    banco: '', status: 'Aprovado', dataInicio: '', dataFim: '', corretor: ''
  });
  const [modalError, setModalError] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyCPF = (cpf: string, id: string) => {
    navigator.clipboard.writeText(cpf);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const [nivel, setNivel] = useState('');
  const [allowedContas, setAllowedContas] = useState<string[]>([]);

  // Carregar dados e perfil do usuário ao entrar na tela
  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: profile } = await supabase
        .from('usuarios')
        .select('nivel, grupos_permitidos')
        .eq('supabase_user_id', session.user.id)
        .single();
      
      if (profile) {
        setNivel(profile.nivel);
        if (profile.nivel === 'financeiro' && profile.grupos_permitidos && profile.grupos_permitidos.length > 0) {
          const groupNumbers = profile.grupos_permitidos.map(Number);
          const { data: contasData } = await supabase
            .schema('pro_consig')
            .from('contas')
            .select('conta_ativacao')
            .in('grupo', groupNumbers);
          
          if (contasData) {
            const contasStringList = contasData.map(c => c.conta_ativacao.toString());
            setAllowedContas(contasStringList);
          }
        }
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (nivel !== '') {
      buscarDados(0);
    }
  }, [nivel, allowedContas]);

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
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

  const buscarDados = async (p = page) => {
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
      if (allowedContas.length > 0) {
        query = query.in('conta_ativacao', allowedContas);
      } else {
        query = query.in('conta_ativacao', ['-1']);
      }
    }

    if (filters.banco) query = query.ilike('banco', `%${filters.banco}%`);
    if (filters.corretor) query = query.ilike('corretor', `%${filters.corretor}%`);
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
        if (allowedContas.length > 0) {
          query = query.in('conta_ativacao', allowedContas);
        } else {
          query = query.in('conta_ativacao', ['-1']);
        }
      }

      if (filters.banco) query = query.ilike('banco', `%${filters.banco}%`);
      if (filters.corretor) query = query.ilike('corretor', `%${filters.corretor}%`);
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
        'Vendedor': v.corretor || '-',
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
        .range(pageNum * pageSize, (pageNum + 1) * pageSize - 1)
        .order('created_at', { ascending: false });

      if (nivel === 'financeiro') {
        if (allowedContas.length > 0) {
          query = query.in('conta_ativacao', allowedContas);
        } else {
          query = query.in('conta_ativacao', ['-1']);
        }
      }

      if (filters.banco) query = query.ilike('banco', `%${filters.banco}%`);
      if (filters.corretor) query = query.ilike('corretor', `%${filters.corretor}%`);
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
      // Import exceljs dynamically to avoid SSR building issues
      const ExcelJS = (await import('exceljs')).default;
      const workbook = new ExcelJS.Workbook();

      const styleRow = (
        row: any,
        isHeader = false,
        isTotal = false,
        highlightYellow = false,
        valorCreditoCol = 10,
        centerCols = [1, 2, 3, 4, 5, 6, 7, 8, 12, 16, 17, 18]
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

          // Fill (Yellow for highlighted rows, standard for others)
          if (highlightYellow && !isHeader && !isTotal) {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFFFFF00' }
            };
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
        { header: 'Obs.:', key: 'obs', width: 34 },
        { header: 'Status PG', key: 'status_pg', width: 12 },
        { header: 'Nome', key: 'nome', width: 26 },
        { header: 'CPF', key: 'cpf', width: 15 },
        { header: 'Vendedor', key: 'vendedor', width: 17 },
        { header: 'Gerado', key: 'gerado', width: 21 },
        { header: 'Cód. Operação', key: 'cod_operacao', width: 20 },
        { header: 'Empresa Credora', key: 'empresa_credora', width: 19 }
      ];

      // Row 1: Merged Title Block (A1:S1 since we added 1 more column, total 19 columns)
      wsDetailed.mergeCells('A1:S1');
      const titleCellDet = wsDetailed.getCell('A1');
      titleCellDet.value = titleText;
      titleCellDet.font = { name: 'Calibri', family: 2, size: 24, color: { argb: 'FF000000' } };
      titleCellDet.alignment = { horizontal: 'left', vertical: 'middle' };
      wsDetailed.getRow(1).height = 31.2;

      // Row 2: Headers
      const headerRowDet = wsDetailed.getRow(2);
      headerRowDet.values = [
        'ID Venda', 'Forma Recebimento', 'Banco', 'Agência ', 'DV', 'OP', 'Conta', 'DV', 'Chave PIX', 'Pix', 'Valor Crédito', 'Obs.:', 'Status PG', 'Nome', 'CPF', 'Vendedor', 'Gerado', 'Cód. Operação', 'Empresa Credora'
      ];
      headerRowDet.height = 20;
      styleRow(headerRowDet, true, false, false, 11, [1, 2, 3, 4, 5, 6, 7, 8, 9, 13, 17, 18, 19]);

      // Row 3+: Data Rows
      allData.forEach((v) => {
        const isPix = v.forma_credito?.toLowerCase() === 'pix';

        const rowData = {
          venda_id: v.venda_id || '',
          forma_recebimento: v.forma_credito?.toUpperCase() || '',
          banco: isPix ? '' : (v.credito_banco || ''),
          agencia: isPix ? '' : (v.credito_agencia || ''),
          agencia_dv: isPix ? '' : (v.credito_agencia_dv || ''),
          op: isPix ? '' : (v.op || ''),
          conta: isPix ? '' : (v.credito_conta || ''),
          conta_dv: isPix ? '' : (v.credito_conta_dv || ''),
          chave_pix: isPix ? (v.pix_tipo_chave || '') : '',
          pix: isPix ? (v.pix_chave || '') : '',
          valor_credito: parseBRLString(v.abat),
          obs: v.observacao || '',
          status_pg: '',
          nome: v.clientes?.nome || '',
          cpf: v.cpf || '',
          vendedor: v.corretor || '',
          gerado: timestamp,
          cod_operacao: v.codigo_operacao || '',
          empresa_credora: v.empresa_credora || ''
        };

        const addedRow = wsDetailed.addRow(rowData);
        addedRow.height = 20;
        styleRow(addedRow, false, false, isPix, 11, [1, 2, 3, 4, 5, 6, 7, 8, 9, 13, 17, 18, 19]);
      });

      // Total Row (Valor Crédito is now in column 11 (K))
      const lastRowIndexDet = wsDetailed.rowCount + 1;
      const totalRowDet = wsDetailed.getRow(lastRowIndexDet);
      totalRowDet.height = 20;
      totalRowDet.getCell(11).value = { formula: `SUM(K3:K${lastRowIndexDet - 1})` };
      styleRow(totalRowDet, false, true, false, 11, [1, 2, 3, 4, 5, 6, 7, 8, 9, 13, 17, 18, 19]);

      // ────────────────────────────────────────────────────────────────────────
      // SHEET 2: CONSOLIDADO (Cosolidado)
      // ────────────────────────────────────────────────────────────────────────
      const wsConsolidated = workbook.addWorksheet('Cosolidado');
      
      wsConsolidated.columns = [
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
        { header: 'Obs.:', key: 'obs', width: 34 },
        { header: 'Status PG', key: 'status_pg', width: 12 },
        { header: 'Nome', key: 'nome', width: 26 },
        { header: 'CPF', key: 'cpf', width: 15 },
        { header: 'Vendedor', key: 'vendedor', width: 17 },
        { header: 'Gerado', key: 'gerado', width: 21 }
      ];

      // Row 1: Merged Title Block
      wsConsolidated.mergeCells('A1:P1');
      const titleCellCons = wsConsolidated.getCell('A1');
      titleCellCons.value = titleText;
      titleCellCons.font = { name: 'Calibri', family: 2, size: 24, color: { argb: 'FF000000' } };
      titleCellCons.alignment = { horizontal: 'left', vertical: 'middle' };
      wsConsolidated.getRow(1).height = 31.2;

      // Row 2: Headers
      const headerRowCons = wsConsolidated.getRow(2);
      headerRowCons.values = [
        'Forma Recebimento', 'Banco', 'Agência ', 'DV', 'OP', 'Conta', 'DV', 'Chave PIX', 'Pix', 'Valor Crédito', 'Obs.:', 'Status PG', 'Nome', 'CPF', 'Vendedor', 'Gerado'
      ];
      headerRowCons.height = 20;
      styleRow(headerRowCons, true);

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

        const rowData = {
          forma_recebimento: primarySale.forma_credito?.toUpperCase() || '',
          banco: isPix ? '' : (primarySale.credito_banco || ''),
          agencia: isPix ? '' : (primarySale.credito_agencia || ''),
          agencia_dv: isPix ? '' : (primarySale.credito_agencia_dv || ''),
          op: isPix ? '' : (primarySale.op || ''),
          conta: isPix ? '' : (primarySale.credito_conta || ''),
          conta_dv: isPix ? '' : (primarySale.credito_conta_dv || ''),
          chave_pix: isPix ? (primarySale.pix_tipo_chave || '') : '',
          pix: isPix ? (primarySale.pix_chave || '') : '',
          valor_credito: totalValue,
          obs: allObs,
          status_pg: '',
          nome: primarySale.clientes?.nome || '',
          cpf: cpf,
          vendedor: primarySale.corretor || '',
          gerado: timestamp
        };

        const addedRow = wsConsolidated.addRow(rowData);
        addedRow.height = 20;
        styleRow(addedRow, false, false, isPix);
      });

      // Total Row
      const lastRowIndexCons = wsConsolidated.rowCount + 1;
      const totalRowCons = wsConsolidated.getRow(lastRowIndexCons);
      totalRowCons.height = 20;
      totalRowCons.getCell(10).value = { formula: `SUM(J3:J${lastRowIndexCons - 1})` };
      styleRow(totalRowCons, false, true);

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

      setModalError(`Borderô gerado com sucesso!\nNúmero do Lote: ${nextLote}`);
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
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'capitalize' }}>Banco</label>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
              <input name="banco" type="text" value={filters.banco} onChange={handleFilterChange} placeholder="Buscar banco..." style={{ width: '100%', paddingLeft: '2.5rem', height: '42px' }} />
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
                <th style={{ paddingLeft: '1.5rem' }}>ID Venda</th>
                <th>Cliente / CPF</th>
                 <th>Operação</th>
                <th>Valor</th>
                <th>Vendedor</th>
                <th>Banco</th>
                <th style={{ textAlign: 'center' }}>Paga?</th>
                <th>Última Exportação</th>
                <th>Data Cadastro</th>
              </tr>
            </thead>
            <tbody>
              {vendas.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>Nenhum dado para exibir com esses filtros.</td>
                </tr>
              ) : (
                vendas.map((v) => (
                  <tr key={v.id}>
                    <td style={{ paddingLeft: '1.5rem', fontWeight: 600, color: 'var(--color-primary)' }}>{v.venda_id || '-'}</td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{v.clientes?.nome || '-'}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.15rem' }}>
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
                    <td>{v.corretor}</td>
                    <td>{v.banco}</td>
                    <td style={{ textAlign: 'center' }}>
                      <input 
                        type="checkbox" 
                        checked={v.status === 'Pago'} 
                        onChange={() => handleTogglePaga(v.id, v.status)}
                        style={{ cursor: 'pointer', transform: 'scale(1.2)' }}
                      />
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <Clock size={14} />
                        {v.data_exportacao_atual ? new Date(v.data_exportacao_atual).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' }) : 'Nunca Exportado'}
                      </div>
                    </td>
                    <td style={{ fontSize: '0.8rem' }}>{new Date(v.created_at).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</td>
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
