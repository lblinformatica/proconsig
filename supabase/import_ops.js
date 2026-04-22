const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const Papa = require('papaparse');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  db: { schema: 'pro_consig' }
});

async function importOps() {
  const csvFilePath = path.join(__dirname, 'Grupo 1_18.04.2026.csv');
  const csvFile = fs.readFileSync(csvFilePath, 'utf8');

  console.log('Parsing CSV...');
  const { data, errors } = Papa.parse(csvFile, {
    header: true,
    delimiter: ';',
    skipEmptyLines: true,
    dynamicTyping: false, // will handle manually for precision
  });

  if (errors.length > 0) {
    console.error('Errors parsing CSV:', errors);
  }

  console.log(`Parsed ${data.length} rows. Starting import into pro_consig.operacoes...`);

  // Transform data
  const transformed = data.map(row => ({
    operacao: parseInt(row.operacao),
    vencimento: row.vencimento,
    cpf: row.cpf,
    valor: parseFloat(row.valor.replace(',', '.')),
    vendedor: row.vendedor,
    contacobranca: row.contacobranca,
    fundo: row.fundo,
    convenio: row.convenio,
    grupo: parseInt(row.grupo)
  }));

  // Batch insert
  const batchSize = 100;
  for (let i = 0; i < transformed.length; i += batchSize) {
    const batch = transformed.slice(i, i + batchSize);
    const { error } = await supabase
      .from('operacoes')
      .insert(batch);
    
    if (error) {
      console.error(`Error in batch ${i / batchSize}:`, error);
    } else {
      process.stdout.write(`Imported ${i + batch.length}/${transformed.length} rows...\r`);
    }
  }

  console.log('\nImport finished.');
}

importOps().catch(err => console.error('Critical error:', err));
