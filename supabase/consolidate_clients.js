const { createClient } = require('@supabase/supabase-js');
const XLSX = require('xlsx');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

function validateCPF(cpf) {
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(digits)) return false;

  const calc = (len) => {
    let sum = 0;
    for (let i = 0; i < len; i++) {
      sum += parseInt(digits[i]) * (len + 1 - i);
    }
    const rem = (sum * 10) % 11;
    return rem === 10 || rem === 11 ? 0 : rem;
  };

  return calc(9) === parseInt(digits[9]) && calc(10) === parseInt(digits[10]);
}

function formatCPF(val) {
  return val
    .replace(/\D/g, '')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})/, '$1-$2')
    .replace(/(-\d{2})\d+?$/, '$1');
}

async function run() {
  const filePath = path.join(__dirname, 'Banco de Dados_08.05.2026.xlsx');
  console.log(`Lendo arquivo: ${filePath}`);

  const workbook = XLSX.readFile(filePath);
  let allRows = [];
  let invalidRows = [];

  workbook.SheetNames.forEach(sheetName => {
    console.log(`Processando planilha: ${sheetName}`);
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet).map(r => ({ ...r, __sheetName: sheetName }));
    allRows = allRows.concat(rows);
  });

  console.log(`Total de registros lidos: ${allRows.length}`);

  const uniqueClients = new Map();
  let invalidCount = 0;

  allRows.forEach(row => {
    const rawCpf = String(row.cpf || row.CPF || '').replace(/[^\d]/g, '');
    const nome = row.nome || row.Nome || row.NOME || '';

    if (rawCpf && validateCPF(rawCpf)) {
      const formattedCpf = formatCPF(rawCpf);
      uniqueClients.set(formattedCpf, {
        cpf: formattedCpf,
        nome: String(nome).trim(),
        banco: '',
        agencia: '',
        conta: ''
      });
    } else if (rawCpf) {
      invalidCount++;
      invalidRows.push({
        planilha: row.__sheetName,
        cpf: row.cpf || row.CPF || '',
        nome: row.nome || row.Nome || row.NOME || ''
      });
    }
  });

  console.log(`Registros válidos e únicos: ${uniqueClients.size}`);
  console.log(`Registros com CPF inválido ignorados: ${invalidCount}`);

  const clientsToProcess = Array.from(uniqueClients.values());

  // Buscar CPFs já existentes no banco
  console.log('Verificando registros existentes no banco...');
  const { data: existing, error: fetchError } = await supabase
    .schema('pro_consig')
    .from('clientes')
    .select('cpf');

  if (fetchError) {
    console.error('Erro ao buscar clientes existentes:', fetchError);
    return;
  }

  const existingCpfs = new Set(existing.map(c => c.cpf));
  const newClients = clientsToProcess.filter(c => !existingCpfs.has(c.cpf));

  console.log(`Novos registros para importar: ${newClients.length}`);

  if (newClients.length === 0) {
    console.log('Nenhum novo registro encontrado para importar.');
    return;
  }

  // Importar em lotes
  const batchSize = 100;
  let importedCount = 0;

  for (let i = 0; i < newClients.length; i += batchSize) {
    const batch = newClients.slice(i, i + batchSize);
    const { error: insertError } = await supabase
      .schema('pro_consig')
      .from('clientes')
      .insert(batch);

    if (insertError) {
      console.error(`Erro ao importar lote ${i / batchSize + 1}:`, insertError);
    } else {
      importedCount += batch.length;
      console.log(`Importado lote ${i / batchSize + 1}... (${importedCount}/${newClients.length})`);
    }
  }

  console.log('Processo concluído!');
  console.log(`Total importado: ${importedCount} novos clientes.`);

  if (invalidRows.length > 0) {
    const invalidFilePath = path.join(__dirname, 'CPFs_Invalidos_08.05.2026.xlsx');
    const ws = XLSX.utils.json_to_sheet(invalidRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "CPFs Inválidos");
    XLSX.writeFile(wb, invalidFilePath);
    console.log(`Arquivo de CPFs inválidos gerado: ${invalidFilePath}`);
  }
}

run();
