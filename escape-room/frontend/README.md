# Escape Room de Computação — O Sistema Foi Invadido

1. `cd backend && copy .env.example .env` (ajuste DB_PASS e JWT_SECRET) → `npm install` → `npm start`
2. Abra http://localhost:3000
Requisitos: Node 18+, SQL Server Express (instância SQLEXPRESS02) com TCP/IP e SQL Server Browser ativos, e as tabelas `grupo_desafio` + colunas `pausada_em` / `segundos_pausados` já criadas.
A API serve o frontend (mesma origem, sem CORS). Pontos a confirmar estão marcados com "CONFIRMAR" em backend/src/routes.js.
