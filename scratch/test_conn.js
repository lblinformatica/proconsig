const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey, {
  db: { schema: 'pro_consig' }
});

async function test() {
  const { data, error } = await supabase.from('usuarios').select('count', { count: 'exact', head: true });
  if (error) console.error("Erro no teste:", error.message);
  else console.log("Conectado com sucesso! Total de usuários:", data);
}

test();
