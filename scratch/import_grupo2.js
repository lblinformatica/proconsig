const { createClient } = require('@supabase/supabase-js');
const XLSX = require('xlsx');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey, {
  db: { schema: 'pro_consig' }
});

function formatCPF(cpf) {
  const clean = cpf.toString().replace(/\D/g, '').padStart(11, '0');
  return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

function excelDateToJSDate(serial) {
  if (typeof serial === 'string') {
     const parts = serial.split('/');
     if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
     return serial;
  }
  const utc_days  = Math.floor(serial - 25569);
  const utc_value = utc_days * 86400;
  const date_info = new Date(utc_value * 1000);
  return date_info.toISOString().split('T')[0];
}

async function run() {
  const filePath = path.join('c:', 'ProConsig', 'supabase', 'Grupo 2_18.04.2026.xlsx');
  const workbook = XLSX.readFile(filePath);
  const data = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

  console.log(`Iniciando processamento de ${data.length} linhas...`);

  const batchSize = 100;
  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize).map(row => ({
      operacao: parseInt(row['Operação']),
      vencimento: row['Vencimento'] ? excelDateToJSDate(row['Vencimento']) : null,
      cpf: formatCPF(row['CPF']),
      valor: parseFloat(row['Valor']) || 0,
      vendedor: row['Vendedor']?.toString() || '',
      contacobranca: row['Conta de Cob.']?.toString() || '',
      fundo: row['Fundo']?.toString() || '',
      convenio: row['Convênio']?.toString() || '',
      grupo: parseInt(row['Grupo']) || 2
    }));

    const { error } = await supabase.from('operacoes').insert(batch);
    if (error) {
      console.error(`Erro no lote ${i}:`, error.message);
    } else {
      process.stdout.write(`.`); // Progresso visual
    }
    // Pequeno delay para evitar overload
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  console.log("\nImportação concluída com sucesso!");
}

run();
