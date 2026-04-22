const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey, {
  db: { schema: 'pro_consig' }
});

function validateCPF(cpf) {
  cpf = cpf.replace(/[^\d]+/g, '');
  if (cpf.length !== 11 || !!cpf.match(/(\d)\1{10}/)) return false;
  let s = 0, r;
  for (let i = 1; i <= 9; i++) s += parseInt(cpf.substring(i - 1, i)) * (11 - i);
  r = (s * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  if (r !== parseInt(cpf.substring(9, 10))) return false;
  s = 0;
  for (let i = 1; i <= 10; i++) s += parseInt(cpf.substring(i - 1, i)) * (12 - i);
  r = (s * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  if (r !== parseInt(cpf.substring(10, 11))) return false;
  return true;
}

async function check() {
  const { data: clientes } = await supabase.from('clientes').select('cpf, nome');
  const invalidos = clientes.filter(c => !validateCPF(c.cpf));
  
  if (invalidos.length > 0) {
    console.log(`Encontrados ${invalidos.length} CPFs inválidos:`);
    invalidos.forEach(c => console.log(`- ${c.nome} (${c.cpf})`));
  } else {
    console.log("Todos os CPFs dos clientes são válidos! ✅");
  }
}

check();
