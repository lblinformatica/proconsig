const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join('c:', 'ProConsig', 'supabase', 'Grupo 2_18.04.2026.xlsx');
const workbook = XLSX.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(worksheet);

console.log("Colunas encontradas:", Object.keys(data[0]));
console.log("Exemplo de linha:", JSON.stringify(data[0], null, 2));
