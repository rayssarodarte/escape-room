// Conexão com o SQL Server (banco AtexPii)
require("dotenv").config();
const sql = require("mssql");
const porta = Number(process.env.DB_PORT) || undefined;
const cfg = {
  server: process.env.DB_SERVER || "localhost",
  database: process.env.DB_NAME || "AtexPii",
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  port: porta,
  options: {
    instanceName: porta ? undefined : process.env.DB_INSTANCE || undefined,
    trustServerCertificate: true,
    encrypt: false,
  },
};
let pool;
const get = () => pool || (pool = new sql.ConnectionPool(cfg).connect());
// Executa uma consulta parametrizada e devolve as linhas
async function q(text, params = {}) {
  const r = (await get()).request();
  for (const [k, v] of Object.entries(params)) r.input(k, v);
  return (await r.query(text)).recordset;
}
module.exports = { q };
