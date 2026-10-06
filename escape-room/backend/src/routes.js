// Rotas + consultas SQL (nomes de tabelas/colunas exatamente como no AtexPii)
const router = require("express").Router();
const jwt = require("jsonwebtoken"),
  bcrypt = require("bcryptjs");
const { q } = require("./db");
const SECRET = process.env.JWT_SECRET || "dev-secret";

// CONFIRMAR: valores reais de status no banco (mapeamento em um só lugar)
const ST = {
  ANDAMENTO: "em_andamento",
  PAUSADA: "pausada",
  FIM: "finalizada",
  G_OK: "concluido",
  G_AND: "em_andamento",
};

// Tempo restante (s) calculado no servidor, considerando pausas
const REST = `a.duracao_prevista_min*60 - (DATEDIFF(SECOND,a.iniciada_em,ISNULL(a.encerrada_em,SYSDATETIME())) - a.segundos_pausados
  - CASE WHEN a.pausada_em IS NOT NULL THEN DATEDIFF(SECOND,a.pausada_em,SYSDATETIME()) ELSE 0 END)`;

const h = (fn) => (req, res) =>
  fn(req, res).catch((e) => {
    console.error(e);
    res.status(500).json({ erro: "Erro interno ao acessar o banco." });
  });
const bad = (res, m) => res.status(400).json({ erro: m });

// ---------- Autenticação ----------
router.post(
  "/auth/login",
  h(async (req, res) => {
    const { login, senha, lembrar } = req.body || {};
    if (!login || !senha) return bad(res, "Informe usuário/e-mail e senha.");
    const [u] = await q(
      "SELECT id,nome,perfil,senha_hash FROM usuario WHERE (username=@l OR email=@l) AND ativo=1",
      { l: login },
    );
    // CONFIRMAR: formato do senha_hash (aqui: bcrypt)
    if (!u || !(await bcrypt.compare(senha, u.senha_hash)))
      return res.status(401).json({ erro: "Usuário ou senha inválidos." });
    const t = jwt.sign({ id: u.id, nome: u.nome, perfil: u.perfil }, SECRET, {
      expiresIn: lembrar ? "7d" : "8h",
    });
    res.cookie("token", t, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: lembrar ? 7 * 864e5 : undefined,
    });
    res.json({ id: u.id, nome: u.nome, perfil: u.perfil });
  }),
);
router.post("/auth/logout", (req, res) => {
  res.clearCookie("token");
  res.json({ ok: true });
});

router.use((req, res, next) => {
  try {
    req.user = jwt.verify(req.cookies.token, SECRET);
    next();
  } catch {
    res.status(401).json({ erro: "Sessão expirada." });
  }
});
router.get("/auth/me", (req, res) => res.json(req.user));

// ---------- Dashboard ----------
router.get(
  "/dashboard",
  h(async (req, res) => {
    const [c] = await q(
      `SELECT (SELECT COUNT(*) FROM turma WHERE ativo=1) turmas,(SELECT COUNT(*) FROM aluno WHERE ativo=1) alunos,
    (SELECT COUNT(*) FROM atividade WHERE status=@f) realizadas,(SELECT COUNT(*) FROM atividade WHERE status IN(@a,@p)) andamento`,
      { f: ST.FIM, a: ST.ANDAMENTO, p: ST.PAUSADA },
    );
    const [atual] = await q(
      `SELECT TOP 1 a.id,ce.titulo,t.nome turma,u.nome responsavel,a.status,a.duracao_prevista_min dur,${REST} restante
    FROM atividade a JOIN cenario ce ON ce.id=a.cenario_id JOIN turma t ON t.id=a.turma_id JOIN usuario u ON u.id=a.responsavel_id
    WHERE a.status IN(@a,@p) ORDER BY a.iniciada_em DESC`,
      { a: ST.ANDAMENTO, p: ST.PAUSADA },
    );
    const grafico =
      await q(`SELECT FORMAT(a.data_atividade,'yyyy-MM') mes,COUNT(*) total,AVG(DATEDIFF(MINUTE,a.iniciada_em,a.encerrada_em)) tempo
    FROM atividade a WHERE a.data_atividade>=DATEADD(MONTH,-3,DATEFROMPARTS(YEAR(GETDATE()),MONTH(GETDATE()),1))
    GROUP BY FORMAT(a.data_atividade,'yyyy-MM') ORDER BY mes`);
    res.json({ ...c, atual: atual || null, grafico });
  }),
);

// ---------- Turmas ----------
const TURMAS = `SELECT t.id,t.nome,t.serie,t.responsavel_id,u.nome responsavel,
  (SELECT COUNT(*) FROM aluno WHERE turma_id=t.id AND ativo=1) alunos,(SELECT COUNT(*) FROM atividade WHERE turma_id=t.id) atividades
  FROM turma t JOIN usuario u ON u.id=t.responsavel_id WHERE t.ativo=1`;
router.get(
  "/turmas",
  h(async (req, res) =>
    res.json(
      await q(TURMAS + " AND t.nome LIKE '%'+@b+'%' ORDER BY t.nome", {
        b: req.query.busca || "",
      }),
    ),
  ),
);
router.get(
  "/turmas/:id",
  h(async (req, res) => {
    const [t] = await q(TURMAS + " AND t.id=@id", { id: req.params.id });
    if (!t) return res.status(404).json({ erro: "Turma não encontrada." });
    t.lista = await q(
      "SELECT id,nome FROM aluno WHERE turma_id=@id AND ativo=1 ORDER BY nome",
      { id: req.params.id },
    );
    res.json(t);
  }),
);
const okTurma = (b) => b && b.nome && b.nome.trim() && b.responsavel_id;
router.post(
  "/turmas",
  h(async (req, res) => {
    if (!okTurma(req.body))
      return bad(res, "Informe o nome e o responsável da turma.");
    const { nome, serie, responsavel_id } = req.body;
    const [r] = await q(
      "INSERT INTO turma(nome,serie,responsavel_id,ativo) OUTPUT INSERTED.id VALUES(@n,@s,@r,1)",
      { n: nome.trim(), s: serie || null, r: responsavel_id },
    );
    res.status(201).json(r);
  }),
);
router.put(
  "/turmas/:id",
  h(async (req, res) => {
    if (!okTurma(req.body))
      return bad(res, "Informe o nome e o responsável da turma.");
    const { nome, serie, responsavel_id } = req.body;
    await q(
      "UPDATE turma SET nome=@n,serie=@s,responsavel_id=@r WHERE id=@id",
      {
        n: nome.trim(),
        s: serie || null,
        r: responsavel_id,
        id: req.params.id,
      },
    );
    res.json({ ok: true });
  }),
);

// ---------- Apoio ----------
router.get(
  "/usuarios",
  h(async (req, res) =>
    res.json(
      await q("SELECT id,nome FROM usuario WHERE ativo=1 ORDER BY nome"),
    ),
  ),
);
router.get(
  "/cenarios",
  h(async (req, res) =>
    res.json(
      await q(
        "SELECT id,titulo,duracao_padrao_min FROM cenario WHERE ativo=1 ORDER BY id",
      ),
    ),
  ),
);

// ---------- Atividades ----------
router.get(
  "/atividades",
  h(async (req, res) =>
    res.json(
      await q(
        `SELECT a.id,a.data_atividade,a.status,ce.titulo FROM atividade a JOIN cenario ce ON ce.id=a.cenario_id
   WHERE a.turma_id=@t ORDER BY a.data_atividade DESC,a.id DESC`,
        { t: req.query.turmaId || 0 },
      ),
    ),
  ),
);

router.post(
  "/atividades",
  h(async (req, res) => {
    const {
      turma_id,
      responsavel_id,
      data_atividade,
      qtd_grupos,
      duracao_prevista_min,
    } = req.body || {};
    const n = Number(qtd_grupos),
      m = Number(duracao_prevista_min);
    if (!turma_id || !responsavel_id || !data_atividade)
      return bad(res, "Preencha turma, data e responsável.");
    if (!(n >= 1 && n <= 20))
      return bad(res, "A quantidade de grupos deve ficar entre 1 e 20.");
    if (!(m >= 1 && m <= 600))
      return bad(res, "A duração deve ficar entre 1 e 600 minutos.");
    const [ce] = await q(
      "SELECT TOP 1 id FROM cenario WHERE ativo=1 ORDER BY id",
    );
    if (!ce) return bad(res, "Nenhum cenário ativo cadastrado.");
    const [a] = await q(
      `INSERT INTO atividade(cenario_id,turma_id,responsavel_id,data_atividade,qtd_grupos,duracao_prevista_min,status,iniciada_em,criado_em)
    OUTPUT INSERTED.id VALUES(@c,@t,@r,@d,@n,@m,@s,SYSDATETIME(),SYSDATETIME())`,
      {
        c: ce.id,
        t: turma_id,
        r: responsavel_id,
        d: data_atividade,
        n,
        m,
        s: ST.ANDAMENTO,
      },
    );
    const ids = [];
    for (let i = 1; i <= n; i++) {
      const [g] = await q(
        "INSERT INTO grupo(atividade_id,numero,nome,status) OUTPUT INSERTED.id VALUES(@a,@i,@nome,@s)",
        {
          a: a.id,
          i,
          nome: "GRUPO " + String(i).padStart(2, "0"),
          s: ST.G_AND,
        },
      );
      ids.push(g.id);
    }
    // Distribui os alunos da turma entre os grupos (rodízio)
    const alunos = await q(
      "SELECT id FROM aluno WHERE turma_id=@t AND ativo=1 ORDER BY nome",
      { t: turma_id },
    );
    for (let i = 0; i < alunos.length; i++)
      await q(
        "INSERT INTO grupo_integrante(grupo_id,atividade_id,aluno_id) VALUES(@g,@a,@al)",
        { g: ids[i % n], a: a.id, al: alunos[i].id },
      );
    res.status(201).json({ id: a.id });
  }),
);

// Atividade completa: dados, desafios e grupos com progresso (usada em acompanhamento, grupos e histórico)
router.get(
  "/atividades/:id",
  h(async (req, res) => {
    const id = req.params.id;
    const [a] = await q(
      `SELECT a.id,a.status,a.data_atividade,a.duracao_prevista_min dur,t.nome turma,ce.titulo,u.nome responsavel,
    CONVERT(varchar(5),a.iniciada_em,108) inicio,${REST} restante FROM atividade a JOIN turma t ON t.id=a.turma_id
    JOIN cenario ce ON ce.id=a.cenario_id JOIN usuario u ON u.id=a.responsavel_id WHERE a.id=@id`,
      { id },
    );
    if (!a) return res.status(404).json({ erro: "Atividade não encontrada." });
    const desafios = await q(
      "SELECT d.id,d.nome FROM desafio d JOIN atividade a ON a.cenario_id=d.cenario_id WHERE a.id=@id ORDER BY d.ordem",
      { id },
    );
    const grupos = await q(
      `SELECT g.id,g.numero,g.nome,(SELECT COUNT(*) FROM grupo_integrante WHERE grupo_id=g.id) integrantes
    FROM grupo g WHERE g.atividade_id=@id ORDER BY g.numero`,
      { id },
    );
    const feitos = await q(
      "SELECT gd.grupo_id,gd.desafio_id FROM grupo_desafio gd JOIN grupo g ON g.id=gd.grupo_id WHERE g.atividade_id=@id",
      { id },
    );
    grupos.forEach((g) => {
      g.feitos = feitos
        .filter((f) => String(f.grupo_id) === String(g.id))
        .map((f) => String(f.desafio_id));
      g.concluidos = g.feitos.length;
      g.total = desafios.length;
      g.pct = g.total ? Math.round((100 * g.concluidos) / g.total) : 0;
    });
    res.json({ atividade: a, desafios, grupos });
  }),
);

// Controle de tempo
const ctl = (nome, sqlSet, cond) =>
  router.post(
    `/atividades/:id/${nome}`,
    h(async (req, res) => {
      await q(`UPDATE atividade SET ${sqlSet} WHERE id=@id AND ${cond}`, {
        id: req.params.id,
        a: ST.ANDAMENTO,
        p: ST.PAUSADA,
        f: ST.FIM,
      });
      res.json({ ok: true });
    }),
  );
ctl("pausar", "status=@p,pausada_em=SYSDATETIME()", "status=@a");
ctl(
  "continuar",
  "segundos_pausados=segundos_pausados+DATEDIFF(SECOND,pausada_em,SYSDATETIME()),pausada_em=NULL,status=@a",
  "status=@p",
);
ctl(
  "encerrar",
  `segundos_pausados=segundos_pausados+CASE WHEN pausada_em IS NULL THEN 0 ELSE DATEDIFF(SECOND,pausada_em,SYSDATETIME()) END,
  pausada_em=NULL,status=@f,encerrada_em=SYSDATETIME()`,
  "status IN(@a,@p)",
);

// ---------- Grupos ----------
router.post(
  "/grupos",
  h(async (req, res) => {
    const { atividade_id, nome } = req.body || {};
    if (!atividade_id) return bad(res, "Selecione uma atividade.");
    const [m] = await q(
      "SELECT ISNULL(MAX(numero),0)+1 n FROM grupo WHERE atividade_id=@a",
      { a: atividade_id },
    );
    const [g] = await q(
      "INSERT INTO grupo(atividade_id,numero,nome,status) OUTPUT INSERTED.id VALUES(@a,@n,@nome,@s)",
      {
        a: atividade_id,
        n: m.n,
        nome: (nome && nome.trim()) || "GRUPO " + String(m.n).padStart(2, "0"),
        s: ST.G_AND,
      },
    );
    await q("UPDATE atividade SET qtd_grupos=qtd_grupos+1 WHERE id=@a", {
      a: atividade_id,
    });
    res.status(201).json(g);
  }),
);
router.get(
  "/grupos/:id",
  h(async (req, res) =>
    res.json(
      await q(
        "SELECT al.nome FROM grupo_integrante gi JOIN aluno al ON al.id=gi.aluno_id WHERE gi.grupo_id=@g ORDER BY al.nome",
        { g: req.params.id },
      ),
    ),
  ),
);

// Marca/desmarca um desafio como concluído e atualiza a situação do grupo
router.post(
  "/grupos/:gid/desafios/:did",
  h(async (req, res) => {
    const p = { g: req.params.gid, d: req.params.did };
    const ex = await q(
      "SELECT 1 x FROM grupo_desafio WHERE grupo_id=@g AND desafio_id=@d",
      p,
    );
    if (ex.length)
      await q(
        "DELETE FROM grupo_desafio WHERE grupo_id=@g AND desafio_id=@d",
        p,
      );
    else
      await q(
        "INSERT INTO grupo_desafio(grupo_id,desafio_id) VALUES(@g,@d)",
        p,
      );
    await q(
      `UPDATE g SET status=CASE WHEN c.n>=t.n AND t.n>0 THEN @ok ELSE @and END,
    concluido_em=CASE WHEN c.n>=t.n AND t.n>0 THEN SYSDATETIME() ELSE NULL END
    FROM grupo g CROSS APPLY(SELECT COUNT(*) n FROM grupo_desafio WHERE grupo_id=g.id) c
    CROSS APPLY(SELECT COUNT(*) n FROM desafio d JOIN atividade a ON a.cenario_id=d.cenario_id WHERE a.id=g.atividade_id) t WHERE g.id=@g`,
      { g: p.g, ok: ST.G_OK, and: ST.G_AND },
    );
    res.json({ marcado: !ex.length });
  }),
);

// ---------- Histórico ----------
router.get(
  "/historico",
  h(async (req, res) =>
    res.json(
      await q(
        `SELECT a.id,a.data_atividade,t.nome turma,a.qtd_grupos grupos,(SELECT COUNT(*) FROM grupo_integrante WHERE atividade_id=a.id) alunos,
   DATEDIFF(MINUTE,a.iniciada_em,a.encerrada_em)-a.segundos_pausados/60 duracao,a.status
   FROM atividade a JOIN turma t ON t.id=a.turma_id
   WHERE a.status=@f AND (@t=0 OR a.turma_id=@t) AND (t.nome LIKE '%'+@b+'%' OR CONVERT(varchar(10),a.data_atividade,103) LIKE '%'+@b+'%')
   ORDER BY a.data_atividade DESC,a.id DESC`,
        {
          f: ST.FIM,
          t: Number(req.query.turmaId) || 0,
          b: req.query.busca || "",
        },
      ),
    ),
  ),
);

// ---------- Alunos (cadastro, edição e remoção) ----------
router.post(
  "/turmas/:id/alunos",
  h(async (req, res) => {
    const lista = Array.isArray(req.body?.nomes)
      ? req.body.nomes
      : [req.body?.nome];
    const nomes = lista.map((n) => String(n || "").trim()).filter(Boolean);
    if (!nomes.length) return bad(res, "Informe o nome do aluno.");
    if (nomes.length > 100 || nomes.some((n) => n.length > 120))
      return bad(res, "Use até 100 nomes, com no máximo 120 caracteres cada.");
    for (const n of nomes)
      await q("INSERT INTO aluno(turma_id,nome,ativo) VALUES(@t,@n,1)", {
        t: req.params.id,
        n,
      });
    res.status(201).json({ inseridos: nomes.length });
  }),
);
router.put(
  "/alunos/:id",
  h(async (req, res) => {
    const nome = String(req.body?.nome || "").trim();
    if (!nome || nome.length > 120)
      return bad(res, "Informe um nome válido (até 120 caracteres).");
    await q("UPDATE aluno SET nome=@n WHERE id=@id", {
      n: nome,
      id: req.params.id,
    });
    res.json({ ok: true });
  }),
);
// Remover = inativar (ativo=0), para não quebrar grupos e histórico já registrados
router.delete(
  "/alunos/:id",
  h(async (req, res) => {
    await q("UPDATE aluno SET ativo=0 WHERE id=@id", { id: req.params.id });
    res.json({ ok: true });
  }),
);

module.exports = router;

// ---------- Excluir grupo ----------
router.delete(
  "/grupos/:id",
  h(async (req, res) => {
    const [g] = await q(
      "SELECT g.id,g.atividade_id,a.status FROM grupo g JOIN atividade a ON a.id=g.atividade_id WHERE g.id=@id",
      { id: req.params.id },
    );
    if (!g) return res.status(404).json({ erro: "Grupo não encontrado." });
    if (g.status === ST.FIM)
      return bad(
        res,
        "Não é possível excluir grupos de uma atividade finalizada.",
      );
    await q("DELETE FROM grupo_desafio WHERE grupo_id=@id", { id: g.id });
    await q("DELETE FROM grupo_integrante WHERE grupo_id=@id", { id: g.id });
    await q("DELETE FROM grupo WHERE id=@id", { id: g.id });
    await q(
      "UPDATE atividade SET qtd_grupos=CASE WHEN qtd_grupos>0 THEN qtd_grupos-1 ELSE 0 END WHERE id=@a",
      { a: g.atividade_id },
    );
    res.json({ ok: true });
  }),
);

// ---------- Marcar/desmarcar desafio (versão resistente a erro de status) ----------
router.post(
  "/grupos/:gid/marcar/:did",
  h(async (req, res) => {
    const p = { g: req.params.gid, d: req.params.did };
    const ex = await q(
      "SELECT 1 x FROM grupo_desafio WHERE grupo_id=@g AND desafio_id=@d",
      p,
    );
    if (ex.length)
      await q(
        "DELETE FROM grupo_desafio WHERE grupo_id=@g AND desafio_id=@d",
        p,
      );
    else
      await q(
        "INSERT INTO grupo_desafio(grupo_id,desafio_id) VALUES(@g,@d)",
        p,
      );
    const [r] = await q(
      `SELECT (SELECT COUNT(*) FROM grupo_desafio WHERE grupo_id=@g) feitos,
    (SELECT COUNT(*) FROM desafio d JOIN atividade a ON a.cenario_id=d.cenario_id JOIN grupo g ON g.atividade_id=a.id WHERE g.id=@g) total`,
      { g: p.g },
    );
    const ok = r.total > 0 && r.feitos >= r.total;
    try {
      await q(
        "UPDATE grupo SET concluido_em=CASE WHEN @ok=1 THEN SYSDATETIME() ELSE NULL END WHERE id=@g",
        { g: p.g, ok: ok ? 1 : 0 },
      );
    } catch (e) {
      console.error("concluido_em não atualizado:", e.message);
    }
    try {
      await q("UPDATE grupo SET status=@s WHERE id=@g", {
        g: p.g,
        s: ok ? ST.G_OK : ST.G_AND,
      });
    } catch (e) {
      console.error(
        "status do grupo não atualizado (provável CHECK na coluna status):",
        e.message,
      );
    }
    res.json({ marcado: !ex.length, completo: ok });
  }),
);
