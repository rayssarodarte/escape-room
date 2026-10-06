// Telas do sistema (uma função por página) e utilitários compartilhados
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const fmtDate = (s) => String(s).slice(0, 10).split("-").reverse().join("/");
const pad = (n) => String(n).padStart(2, "0");
const fmt = (s) => {
  s = Math.max(0, Math.floor(s));
  return pad(Math.floor(s / 60)) + ":" + pad(s % 60);
};
const MESES = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

function toast(msg, erro) {
  const t = document.createElement("div");
  t.className = "toast" + (erro ? " err" : "");
  t.textContent = msg;
  $("#toasts").append(t);
  setTimeout(() => t.remove(), 4000);
}
const modal = (html) => {
  const d = $("#dlg");
  d.innerHTML = html;
  d.showModal();
  return d;
};
const confirmar = (msg) =>
  new Promise((res) => {
    const d = modal(
      `<h2>Confirmar ação</h2><p>${esc(msg)}</p><div class="acts"><button class="btn" id="n">Cancelar</button><button class="btn pri" id="s">Confirmar</button></div>`,
    );
    $("#n").onclick = () => {
      d.close();
      res(false);
    };
    $("#s").onclick = () => {
      d.close();
      res(true);
    };
    d.oncancel = () => res(false);
  });
const opts = (arr, val, txt, sel) =>
  arr
    .map(
      (o) =>
        `<option value="${esc(o[val])}"${String(o[val]) === String(sel) ? " selected" : ""}>${esc(o[txt])}</option>`,
    )
    .join("");
const debounce = (f, ms = 300) => {
  let t;
  return (...a) => {
    clearTimeout(t);
    t = setTimeout(() => f(...a), ms);
  };
};

// ---------- Dashboard ----------
async function viewDashboard() {
  const d = await api("/dashboard"),
    a = d.atual;
  const cards = [
    ["TURMAS", d.turmas, "Turmas cadastradas", "var(--blue)"],
    ["ALUNOS", d.alunos, "Participantes cadastrados", "var(--cy)"],
    ["REALIZADAS", d.realizadas, "Atividades realizadas", "var(--ok)"],
    ["EM ANDAMENTO", d.andamento, "Atividade ativa agora", "var(--warn)"],
  ];
  const max = Math.max(1, ...d.grafico.flatMap((g) => [g.total, g.tempo || 0]));
  const pct = a
    ? Math.min(100, Math.max(0, 100 * (1 - a.restante / (a.dur * 60))))
    : 0;
  $("#view").innerHTML =
    `<div class="grid4">${cards.map((c) => `<div class="card"><span class="lbl">${c[0]}</span><div class="num" style="color:${c[3]}">${c[1]}</div><span class="lbl">${c[2]}</span></div>`).join("")}</div>
  <div class="grid2"><div class="card glow">${
    a
      ? `<span class="lbl">● ATIVIDADE ATUAL</span><h2 style="color:var(--cy);margin:12px 0;font-size:17px">${esc(a.titulo.toUpperCase())}</h2>
    <p class="row lbl" style="margin:0 0 6px"><span class="sp">Turma</span><b style="color:var(--tx)">${esc(a.turma)}</b></p>
    <p class="row lbl" style="margin:0 0 6px"><span class="sp">Responsável</span><b style="color:var(--tx)">${esc(a.responsavel)}</b></p>
    <p class="row lbl" style="margin:0 0 12px"><span class="sp">Status</span><b style="color:var(--ok)">${a.status === "pausada" ? "Pausada" : "Em andamento"}</b></p>
    <div class="card" style="background:var(--bg);padding:12px"><div class="row" style="margin:0"><span class="lbl sp">Tempo</span><b class="mono" style="color:var(--warn)">${fmt(a.restante)} / ${pad(a.dur)}:00</b></div><div class="bar"><i style="width:${pct}%"></i></div></div>
    <a class="btn pri blk" style="display:block;text-align:center;margin-top:14px" href="#/atividade/${a.id}">ACOMPANHAR ATIVIDADE</a>`
      : `<div class="empty">Nenhuma atividade em andamento.<br><a href="#/nova">Iniciar nova atividade</a></div>`
  }</div>
  <div class="card"><span class="lbl">DESEMPENHO DAS ATIVIDADES</span>${
    d.grafico.length
      ? `<div class="chart">${d.grafico
          .map(
            (g) =>
              `<div><p><b style="height:${(100 * g.total) / max}%" title="${g.total} atividades"></b><b style="height:${(100 * (g.tempo || 0)) / max}%" title="${g.tempo || 0} min"></b></p>${MESES[+g.mes.slice(5) - 1]}</div>`,
          )
          .join("")}</div>
    <p class="lbl" style="margin-top:10px"><span style="color:var(--blue)">■</span> Atividades &nbsp; <span style="color:#0e5573">■</span> Tempo médio (min)</p>`
      : '<div class="empty">Sem atividades nos últimos meses.</div>'
  }</div></div>`;
}

// ---------- Turmas ----------
async function viewTurmas() {
  $("#view").innerHTML =
    `<div class="row"><input id="bq" placeholder="Pesquisar turma..." aria-label="Pesquisar turma" style="max-width:280px"><span class="sp"></span><button class="btn pri" id="nt">＋ Nova Turma</button></div><div class="card wrap" id="lista" style="padding:0"></div>`;
  const load = async () => {
    try {
      const t = await api(
        "/turmas?busca=" + encodeURIComponent($("#bq").value),
      );
      $("#lista").innerHTML = t.length
        ? `<table><tr><th>TURMA</th><th>ALUNOS</th><th>ATIVIDADES</th><th>RESPONSÁVEL</th><th>AÇÕES</th></tr>${t
            .map(
              (x) =>
                `<tr><td><b>${esc(x.nome)}</b> <span class="lbl">${esc(x.serie || "")}</span></td><td><span class="pill">${x.alunos} alunos</span></td><td style="color:var(--cy);font-weight:600">${x.atividades}</td><td>${esc(x.responsavel)}</td>
        <td><button class="btn sm" data-v="${x.id}">Cadastrar alunos</button> <button class="btn sm" data-e="${x.id}">Editar</button></td></tr>`,
            )
            .join("")}</table>`
        : '<div class="empty">Nenhuma turma encontrada.</div>';
    } catch (e) {
      $("#lista").innerHTML =
        '<div class="empty">Não foi possível carregar as turmas.</div>';
      toast(e.message, 1);
    }
  };
  $("#bq").oninput = debounce(load);
  $("#nt").onclick = () => formTurma(null, load);
  $("#lista").onclick = async (e) => {
    const v = e.target.dataset.v,
      ed = e.target.dataset.e;
    if (v)
      try {
        const t = await api("/turmas/" + v);
        const d =
          modal(`<h2>${esc(t.nome)}</h2><p class="lbl">Série: ${esc(t.serie || "—")} · Responsável: ${esc(t.responsavel)} · ${t.atividades} atividades</p>
        <div style="max-height:240px;overflow:auto;margin-top:12px">${t.lista.length ? t.lista.map((a) => `<div style="padding:5px 0;border-bottom:1px solid var(--line)">${esc(a.nome)}</div>`).join("") : '<div class="empty">Nenhum aluno cadastrado.</div>'}</div>
        <div class="acts"><button class="btn" id="x">Fechar</button></div>`);
        $("#x").onclick = () => d.close();
      } catch (er) {
        toast(er.message, 1);
      }
    if (ed)
      try {
        formTurma(await api("/turmas/" + ed), load);
      } catch (er) {
        toast(er.message, 1);
      }
  };
  load();
}
async function formTurma(t, reload) {
  let us;
  try {
    us = await api("/usuarios");
  } catch (e) {
    return toast(e.message, 1);
  }
  const d = modal(`<h2>${t ? "Editar turma" : "Nova turma"}</h2>
    <div class="fld"><label for="fn">Nome da turma</label><input id="fn" maxlength="60" value="${esc(t?.nome)}"><div class="err" id="e1"></div></div>
    <div class="fld"><label for="fs">Série</label><input id="fs" maxlength="20" value="${esc(t?.serie)}"></div>
    <div class="fld"><label for="fr">Responsável</label><select id="fr"><option value="">Selecione</option>${opts(us, "id", "nome", t?.responsavel_id)}</select><div class="err" id="e2"></div></div>
    <div class="acts"><button class="btn" id="c">Cancelar</button><button class="btn pri" id="s">Salvar</button></div>`);
  $("#c").onclick = () => d.close();
  $("#s").onclick = async () => {
    const nome = $("#fn").value.trim(),
      resp = $("#fr").value;
    $("#e1").textContent = nome ? "" : "Informe o nome da turma.";
    $("#e2").textContent = resp ? "" : "Selecione o responsável.";
    if (!nome || !resp) return;
    const b = $("#s");
    b.disabled = true;
    try {
      await api(t ? "/turmas/" + t.id : "/turmas", {
        method: t ? "PUT" : "POST",
        body: { nome, serie: $("#fs").value.trim(), responsavel_id: resp },
      });
      d.close();
      toast(
        t ? "Turma atualizada com sucesso." : "Turma cadastrada com sucesso.",
      );
      reload();
    } catch (e) {
      toast(e.message, 1);
      b.disabled = false;
    }
  };
}

// ---------- Grupos (cards compartilhados com o acompanhamento) ----------
function sit(g, a) {
  if (g.total && g.pct >= 100) return ["ok", "Missão concluída"];
  if (a.status === "finalizada") return ["and", "Não concluída"];
  const esperado = 100 * (1 - a.restante / (a.dur * 60)); // ritmo esperado pelo tempo decorrido
  return esperado - g.pct > 30
    ? ["warn", "Precisa de atenção"]
    : ["and", "Em andamento"];
}
function grupoCard(g, a, D, checks) {
  const [c, txt] = sit(g, a);
  return `<div class="card ${{ warn: "warn", ok: "done", and: "" }[c]}"><div class="gh"><h3>${esc(g.nome)}</h3><span class="badge b-${c}">${txt}</span></div>
    <p class="lbl">${g.integrantes} integrantes</p><div class="gh"><span class="lbl">Progresso</span><b class="mono" style="color:var(--${c === "warn" ? "warn" : c === "ok" ? "ok" : "cy"})">${g.pct}%</b></div>
    <div class="bar ${c === "and" ? "" : c}"><i style="width:${g.pct}%"></i></div>
    ${
      checks
        ? D.map((d) => {
            const f = g.feitos.includes(String(d.id));
            return `<label class="chk ${f ? "f" : ""}"><input type="checkbox" data-g="${g.id}" data-d="${d.id}" ${f ? "checked" : ""} ${a.status !== "em_andamento" ? "disabled" : ""}><span>${esc(d.nome)}</span></label>`;
          }).join("")
        : `<p class="lbl">Desafios: <b style="color:var(--tx)">${g.concluidos}/${g.total}</b></p>`
    }
    <button class="btn blk sm" style="margin-top:12px" data-det="${g.id}">${checks ? "Detalhes" : "Ver detalhes"}</button></div>`;
}
async function detalhes(g, D) {
  let ints = [];
  try {
    ints = await api("/grupos/" + g.id);
  } catch (e) {
    toast(e.message, 1);
  }
  const d =
    modal(`<h2>${esc(g.nome)}</h2><p class="lbl">Progresso: ${g.pct}% · Desafios: ${g.concluidos}/${g.total}</p>
    <h3 style="margin:14px 0 6px;font-size:14px">Integrantes</h3>${ints.length ? ints.map((i) => `<div>${esc(i.nome)}</div>`).join("") : '<p class="lbl">Nenhum integrante neste grupo.</p>'}
    <h3 style="margin:14px 0 6px;font-size:14px">Desafios</h3>${D.map((x) => `<div>${g.feitos.includes(String(x.id)) ? "✅" : "⬜"} ${esc(x.nome)}</div>`).join("")}
    <div class="acts"><button class="btn" id="x">Fechar</button></div>`);
  $("#x").onclick = () => d.close();
}
async function viewGrupos() {
  const turmas = await api("/turmas");
  if (!turmas.length)
    return ($("#view").innerHTML =
      '<div class="empty">Nenhuma turma cadastrada.</div>');
  $("#view").innerHTML =
    `<div class="row"><select id="st" aria-label="Turma" style="max-width:200px">${opts(turmas, "id", "nome")}</select>
    <select id="sa" aria-label="Atividade" style="max-width:260px"></select><span class="sp"></span><button class="btn pri" id="ng">＋ Novo Grupo</button></div><div id="gs"></div>`;
  let cur = null;
  const loadG = async () => {
    const id = $("#sa").value;
    if (!id)
      return ($("#gs").innerHTML =
        '<div class="empty">Selecione uma atividade.</div>');
    try {
      cur = await api("/atividades/" + id);
      $("#gs").innerHTML = cur.grupos.length
        ? `<div class="grid3">${cur.grupos.map((g) => grupoCard(g, cur.atividade, cur.desafios, false)).join("")}</div>`
        : '<div class="empty">Nenhum grupo nesta atividade.</div>';
    } catch (e) {
      $("#gs").innerHTML =
        '<div class="empty">Não foi possível carregar os grupos.</div>';
      toast(e.message, 1);
    }
  };
  const loadA = async () => {
    try {
      const at = await api("/atividades?turmaId=" + $("#st").value);
      $("#sa").innerHTML = at.length
        ? at
            .map(
              (a) =>
                `<option value="${a.id}">${fmtDate(a.data_atividade)} — ${esc(a.titulo)}</option>`,
            )
            .join("")
        : '<option value="">Nenhuma atividade</option>';
      $("#sa").value = at.length ? at[0].id : "";
      if (!at.length)
        $("#gs").innerHTML =
          '<div class="empty">Nenhuma atividade encontrada para esta turma.</div>';
      else loadG();
    } catch (e) {
      toast(e.message, 1);
    }
  };
  $("#st").onchange = loadA;
  $("#sa").onchange = loadG;
  $("#ng").onclick = async () => {
    if (!$("#sa").value)
      return toast("Selecione uma atividade antes de criar um grupo.", 1);
    try {
      await api("/grupos", {
        method: "POST",
        body: { atividade_id: $("#sa").value },
      });
      toast("Grupo criado com sucesso.");
      loadG();
    } catch (e) {
      toast(e.message, 1);
    }
  };
  $("#gs").onclick = (e) => {
    const g = e.target.dataset.det;
    if (g)
      detalhes(
        cur.grupos.find((x) => String(x.id) === g),
        cur.desafios,
      );
  };
  loadA();
}

// ---------- Nova atividade ----------
async function viewNova() {
  const [t, u, c] = await Promise.all([
    api("/turmas"),
    api("/usuarios"),
    api("/cenarios"),
  ]);
  if (!t.length)
    return ($("#view").innerHTML =
      '<div class="empty">Cadastre uma turma antes de iniciar uma atividade.</div>');
  $("#view").innerHTML =
    `<div class="card" style="max-width:600px"><div class="grid3" style="grid-template-columns:1fr 1fr">
    <div><label for="t">Turma</label><select id="t">${opts(t, "id", "nome")}</select></div>
    <div><label for="d">Data</label><input id="d" type="date" value="${new Date().toLocaleDateString("en-CA")}"></div>
    <div><label for="r">Responsável</label><select id="r">${opts(u, "id", "nome", window.me?.id)}</select></div>
    <div><label for="n">Quantidade de grupos</label><input id="n" type="number" min="1" max="20" value="5"></div>
    <div style="grid-column:1/-1"><label for="m">Duração prevista (minutos)</label><input id="m" type="number" min="1" max="600" value="${c[0]?.duracao_padrao_min || 50}"></div></div>
    <p class="card lbl" style="margin:16px 0;background:var(--bg)">Esta atividade será realizada <b style="color:var(--tx)">presencialmente</b>. O sistema será utilizado apenas para acompanhamento, controle e registro da atividade.</p>
    <div id="er" class="err"></div><div class="acts" style="display:flex;justify-content:flex-end;gap:10px"><button class="btn" id="c">Cancelar</button><button class="btn pri" id="ok">INICIAR ATIVIDADE</button></div></div>`;
  $("#c").onclick = () => (location.hash = "#/dashboard");
  $("#ok").onclick = async () => {
    const body = {
      turma_id: $("#t").value,
      data_atividade: $("#d").value,
      responsavel_id: $("#r").value,
      qtd_grupos: $("#n").value,
      duracao_prevista_min: $("#m").value,
    };
    if (!body.data_atividade) return ($("#er").textContent = "Informe a data.");
    if (!(body.qtd_grupos >= 1 && body.qtd_grupos <= 20))
      return ($("#er").textContent =
        "A quantidade de grupos deve ficar entre 1 e 20.");
    if (!(body.duracao_prevista_min >= 1))
      return ($("#er").textContent = "Informe a duração prevista.");
    $("#er").textContent = "";
    $("#ok").disabled = true;
    try {
      const r = await api("/atividades", { method: "POST", body });
      toast("Atividade iniciada com sucesso.");
      location.hash = "#/atividade/" + r.id;
    } catch (e) {
      toast(e.message, 1);
      $("#ok").disabled = false;
    }
  };
}

// ---------- Acompanhamento (contador real, pausar/continuar/encerrar, checks) ----------
async function viewAtividade(id) {
  let D = await api("/atividades/" + id);
  const draw = () => {
    const A = D.atividade,
      run = A.status === "em_andamento",
      fim = A.status === "finalizada";
    $("#sub").textContent = A.titulo;
    $("#view").innerHTML =
      `<div class="card glow hero"><div><span class="badge ${fim ? "b-and" : "b-ok"}">${fim ? "ATIVIDADE FINALIZADA" : run ? "● ATIVIDADE EM ANDAMENTO" : "ATIVIDADE PAUSADA"}</span>
      <h2 style="color:var(--cy);margin:10px 0 6px">${esc(A.titulo.toUpperCase())}</h2><span class="lbl">Turma: <b style="color:var(--tx)">${esc(A.turma)}</b> &nbsp; Início: <b style="color:var(--tx)">${esc(A.inicio || "—")}</b></span></div>
      <div class="row" style="margin:0">${
        fim
          ? ""
          : `<div style="text-align:center"><span class="lbl">TEMPO RESTANTE</span><div class="timer" id="tm"></div></div>
        <button class="btn" id="ps">${run ? "Pausar" : "Continuar"}</button><button class="btn pur" id="en">Encerrar</button>`
      }</div></div>
      <div class="grid3">${D.grupos.map((g) => grupoCard(g, A, D.desafios, true)).join("") || '<div class="empty">Nenhum grupo nesta atividade.</div>'}</div>`;
    tick(false);
    if (!fim) {
      $("#ps").onclick = () => acao(run ? "pausar" : "continuar");
      $("#en").onclick = async () => {
        if (
          await confirmar(
            "Encerrar a atividade? Esta ação não pode ser desfeita.",
          )
        )
          acao("encerrar", "Atividade encerrada com sucesso.");
      };
    }
  };
  const acao = async (a, msg) => {
    try {
      await api(`/atividades/${id}/${a}`, { method: "POST" });
      if (msg) toast(msg);
      D = await api("/atividades/" + id);
      draw();
    } catch (e) {
      toast(e.message, 1);
    }
  };
  const tick = (dec) => {
    const A = D.atividade,
      el = $("#tm");
    if (!el) return;
    if (dec && A.status === "em_andamento") A.restante--;
    el.textContent = fmt(A.restante);
    el.classList.toggle("low", A.restante <= 300);
    if (A.status === "em_andamento" && A.restante <= 0) {
      A.status = "x";
      toast("Tempo esgotado. Encerrando a atividade.");
      acao("encerrar");
    }
  };
  window.timer = setInterval(() => tick(true), 1000);
  $("#view").onclick = (e) => {
    const g = e.target.dataset.det;
    if (g)
      detalhes(
        D.grupos.find((x) => String(x.id) === g),
        D.desafios,
      );
  };
  $("#view").onchange = async (e) => {
    const { g, d } = e.target.dataset;
    if (!g) return;
    try {
      await api(`/grupos/${g}/desafios/${d}`, { method: "POST" });
      D = await api("/atividades/" + id);
      draw();
    } catch (er) {
      toast(er.message, 1);
      e.target.checked = !e.target.checked;
    }
  };
  draw();
}

// ---------- Histórico ----------
async function viewHistorico() {
  const turmas = await api("/turmas");
  let rows = [];
  $("#view").innerHTML =
    `<div class="row"><input id="bq" placeholder="Pesquisar..." aria-label="Pesquisar" style="max-width:260px"><select id="ft" aria-label="Turma" style="max-width:200px"><option value="0">Todas as turmas</option>${opts(turmas, "id", "nome")}</select>
    <span class="sp"></span><button class="btn" id="ex">⤓ Exportar</button></div><div class="card wrap" id="lista" style="padding:0"></div>`;
  const load = async () => {
    try {
      rows = await api(
        `/historico?busca=${encodeURIComponent($("#bq").value)}&turmaId=${$("#ft").value}`,
      );
      $("#lista").innerHTML = rows.length
        ? `<table><tr><th>DATA</th><th>TURMA</th><th>GRUPOS</th><th>ALUNOS</th><th>DURAÇÃO</th><th>STATUS</th><th>AÇÕES</th></tr>${rows
            .map(
              (r) =>
                `<tr><td class="mono lbl">${fmtDate(r.data_atividade)}</td><td><b>${esc(r.turma)}</b></td><td>${r.grupos}</td><td>${r.alunos}</td><td class="mono">${r.duracao ?? "—"} min</td>
        <td><span class="badge b-ok">Finalizada</span></td><td><a class="btn sm" href="#/atividade/${r.id}">Visualizar</a></td></tr>`,
            )
            .join("")}</table>`
        : '<div class="empty">Nenhuma atividade encontrada.</div>';
    } catch (e) {
      $("#lista").innerHTML =
        '<div class="empty">Não foi possível carregar o histórico.</div>';
      toast(e.message, 1);
    }
  };
  $("#bq").oninput = debounce(load);
  $("#ft").onchange = load;
  $("#ex").onclick = () => {
    if (!rows.length) return toast("Nenhum registro para exportar.", 1);
    const csv = [
      "Data;Turma;Grupos;Alunos;Duração (min)",
      ...rows.map((r) =>
        [
          fmtDate(r.data_atividade),
          r.turma,
          r.grupos,
          r.alunos,
          r.duracao ?? "",
        ].join(";"),
      ),
    ].join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(
      new Blob(["\ufeff" + csv], { type: "text/csv" }),
    );
    a.download = "historico.csv";
    a.click();
  };
  load();
}
// ---------- Turmas com cadastro de alunos (substitui a versão anterior) ----------
async function viewTurmas() {
  $("#view").innerHTML =
    `<div class="row"><input id="bq" placeholder="Pesquisar turma..." aria-label="Pesquisar turma" style="max-width:280px"><span class="sp"></span><button class="btn pri" id="nt">＋ Nova Turma</button></div><div class="card wrap" id="lista" style="padding:0"></div>`;
  const load = async () => {
    try {
      const t = await api(
        "/turmas?busca=" + encodeURIComponent($("#bq").value),
      );
      $("#lista").innerHTML = t.length
        ? `<table><tr><th>TURMA</th><th>ALUNOS</th><th>ATIVIDADES</th><th>RESPONSÁVEL</th><th>AÇÕES</th></tr>${t
            .map(
              (x) =>
                `<tr><td><b>${esc(x.nome)}</b> <span class="lbl">${esc(x.serie || "")}</span></td><td><span class="pill">${x.alunos} alunos</span></td><td style="color:var(--cy);font-weight:600">${x.atividades}</td><td>${esc(x.responsavel)}</td>
        <td><button class="btn sm" data-v="${x.id}">Cadastrar alunos</button> <button class="btn sm" data-e="${x.id}">Editar</button></td></tr>`,
            )
            .join("")}</table>`
        : '<div class="empty">Nenhuma turma encontrada.</div>';
    } catch (e) {
      $("#lista").innerHTML =
        '<div class="empty">Não foi possível carregar as turmas.</div>';
      toast(e.message, 1);
    }
  };
  $("#bq").oninput = debounce(load);
  $("#nt").onclick = () => formTurma(null, load);
  $("#lista").onclick = (e) => {
    const v = e.target.dataset.v,
      ed = e.target.dataset.e;
    if (v) dlgTurma(v, load);
    if (ed)
      api("/turmas/" + ed)
        .then((t) => formTurma(t, load))
        .catch((er) => toast(er.message, 1));
  };
  load();
}

async function dlgTurma(id, reload) {
  let t;
  try {
    t = await api("/turmas/" + id);
  } catch (e) {
    return toast(e.message, 1);
  }
  const d =
    modal(`<h2>${esc(t.nome)}</h2><p class="lbl">Série: ${esc(t.serie || "—")} · Responsável: ${esc(t.responsavel)} · ${t.atividades} atividades</p>
    <div class="fld" style="margin-top:14px"><label for="an">Adicionar alunos (um nome por linha)</label>
      <textarea id="an" rows="3" style="width:100%;background:var(--bg);border:1px solid var(--line);color:var(--tx);border-radius:9px;padding:10px;font:inherit"></textarea>
      <button class="btn pri sm" id="ad" style="margin-top:8px;color:#001">Adicionar</button></div>
    <h3 id="n" style="font-size:14px;margin:6px 0"></h3><div id="al" style="max-height:240px;overflow:auto"></div>
    <div class="acts"><button class="btn" id="x">Fechar</button></div>`);
  const draw = () => {
    $("#n").textContent = `Alunos (${t.lista.length})`;
    $("#al").innerHTML = t.lista.length
      ? t.lista
          .map(
            (
              a,
            ) => `<div class="row" style="margin:0;padding:6px 0;border-bottom:1px solid var(--line)"><span class="sp">${esc(a.nome)}</span>
      <button class="btn sm" data-ed="${a.id}">Editar</button> <button class="btn sm" data-rm="${a.id}">Remover</button></div>`,
          )
          .join("")
      : '<div class="empty">Nenhum aluno cadastrado.</div>';
  };
  const recarregar = async () => {
    t = await api("/turmas/" + id);
    draw();
  };
  draw();
  $("#x").onclick = () => {
    d.close();
    reload();
  };
  $("#ad").onclick = async () => {
    const nomes = $("#an")
      .value.split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!nomes.length) return toast("Informe ao menos um nome.", 1);
    try {
      await api(`/turmas/${id}/alunos`, { method: "POST", body: { nomes } });
      $("#an").value = "";
      toast(
        nomes.length > 1
          ? "Alunos cadastrados com sucesso."
          : "Aluno cadastrado com sucesso.",
      );
      await recarregar();
    } catch (e) {
      toast(e.message, 1);
    }
  };
  $("#al").onclick = async (e) => {
    const ed = e.target.dataset.ed,
      rm = e.target.dataset.rm;
    try {
      if (ed) {
        const a = t.lista.find((x) => String(x.id) === ed),
          nome = prompt("Novo nome do aluno:", a.nome);
        if (nome && nome.trim()) {
          await api("/alunos/" + ed, { method: "PUT", body: { nome } });
          toast("Aluno atualizado com sucesso.");
          await recarregar();
        }
      }
      if (rm && confirm("Remover este aluno da turma?")) {
        await api("/alunos/" + rm, { method: "DELETE" });
        toast("Aluno removido.");
        await recarregar();
      }
    } catch (er) {
      toast(er.message, 1);
    }
  };
}

// ---------- Detalhes do grupo com opção de excluir (substitui a versão anterior) ----------
async function detalhes(g, D) {
  let ints = [];
  try {
    ints = await api("/grupos/" + g.id);
  } catch (e) {
    toast(e.message, 1);
  }
  const d =
    modal(`<h2>${esc(g.nome)}</h2><p class="lbl">Progresso: ${g.pct}% · Desafios: ${g.concluidos}/${g.total}</p>
    <h3 style="margin:14px 0 6px;font-size:14px">Integrantes</h3>${ints.length ? ints.map((i) => `<div>${esc(i.nome)}</div>`).join("") : '<p class="lbl">Nenhum integrante neste grupo.</p>'}
    <h3 style="margin:14px 0 6px;font-size:14px">Desafios</h3>${D.map((x) => `<div>${g.feitos.includes(String(x.id)) ? "✅" : "⬜"} ${esc(x.nome)}</div>`).join("")}
    <div class="acts"><button class="btn" id="del" style="color:var(--bad);border-color:var(--bad)">Excluir grupo</button><button class="btn" id="x">Fechar</button></div>`);
  $("#x").onclick = () => d.close();
  $("#del").onclick = async () => {
    if (
      !confirm(
        `Excluir o ${g.nome}? Os integrantes ficam sem grupo e os desafios marcados deste grupo são apagados.`,
      )
    )
      return;
    try {
      await api("/grupos/" + g.id, { method: "DELETE" });
      d.close();
      toast("Grupo excluído com sucesso.");
      if (location.hash.startsWith("#/grupos")) $("#sa").onchange();
      else go();
    } catch (e) {
      toast(e.message, 1);
    }
  };
}

// ---------- Acompanhamento com troféu (substitui a versão anterior) ----------
function trofeu(g, primeiro) {
  const d =
    modal(`<style>@keyframes pop{from{transform:scale(.3);opacity:0}to{transform:scale(1);opacity:1}}</style>
    <div style="text-align:center"><div style="font-size:84px;animation:pop .5s ease-out">🏆</div>
    <h2 style="color:var(--cy);font-size:24px;margin:8px 0">${esc(g.nome)} ${primeiro ? "ganhou!" : "concluiu a missão!"}</h2>
    <p class="lbl">${primeiro ? "Primeiro grupo a resolver todos os desafios. Parabéns!" : "Todos os desafios foram resolvidos. Parabéns!"}</p></div>
    <div class="acts" style="justify-content:center"><button class="btn pri" id="x">Continuar</button></div>`);
  $("#x").onclick = () => d.close();
}

async function viewAtividade(id) {
  let D = await api("/atividades/" + id);
  const draw = () => {
    const A = D.atividade,
      run = A.status === "em_andamento",
      fim = A.status === "finalizada";
    $("#sub").textContent = A.titulo;
    $("#view").innerHTML =
      `<div class="card glow hero"><div><span class="badge ${fim ? "b-and" : "b-ok"}">${fim ? "ATIVIDADE FINALIZADA" : run ? "● ATIVIDADE EM ANDAMENTO" : "ATIVIDADE PAUSADA"}</span>
      <h2 style="color:var(--cy);margin:10px 0 6px">${esc(A.titulo.toUpperCase())}</h2><span class="lbl">Turma: <b style="color:var(--tx)">${esc(A.turma)}</b> &nbsp; Início: <b style="color:var(--tx)">${esc(A.inicio || "—")}</b></span></div>
      <div class="row" style="margin:0">${
        fim
          ? ""
          : `<div style="text-align:center"><span class="lbl">TEMPO RESTANTE</span><div class="timer" id="tm"></div></div>
        <button class="btn" id="ps">${run ? "Pausar" : "Continuar"}</button><button class="btn pur" id="en">Encerrar</button>`
      }</div></div>
      <div class="grid3">${D.grupos.map((g) => grupoCard(g, A, D.desafios, true)).join("") || '<div class="empty">Nenhum grupo nesta atividade.</div>'}</div>`;
    tick(false);
    if (!fim) {
      $("#ps").onclick = () => acao(run ? "pausar" : "continuar");
      $("#en").onclick = async () => {
        if (
          await confirmar(
            "Encerrar a atividade? Esta ação não pode ser desfeita.",
          )
        )
          acao("encerrar", "Atividade encerrada com sucesso.");
      };
    }
  };
  const acao = async (a, msg) => {
    try {
      await api(`/atividades/${id}/${a}`, { method: "POST" });
      if (msg) toast(msg);
      D = await api("/atividades/" + id);
      draw();
    } catch (e) {
      toast(e.message, 1);
    }
  };
  const tick = (dec) => {
    const A = D.atividade,
      el = $("#tm");
    if (!el) return;
    if (dec && A.status === "em_andamento") A.restante--;
    el.textContent = fmt(A.restante);
    el.classList.toggle("low", A.restante <= 300);
    if (A.status === "em_andamento" && A.restante <= 0) {
      A.status = "x";
      toast("Tempo esgotado. Encerrando a atividade.");
      acao("encerrar");
    }
  };
  window.timer = setInterval(() => tick(true), 1000);
  $("#view").onclick = (e) => {
    const g = e.target.dataset.det;
    if (g)
      detalhes(
        D.grupos.find((x) => String(x.id) === g),
        D.desafios,
      );
  };
  $("#view").onchange = async (e) => {
    const { g, d } = e.target.dataset;
    if (!g) return;
    const antes = D.grupos.find((x) => String(x.id) === g)?.pct ?? 0;
    try {
      await api(`/grupos/${g}/marcar/${d}`, { method: "POST" });
    } catch (er) {
      toast(er.message, 1);
    }
    try {
      D = await api("/atividades/" + id);
    } catch (er) {
      return toast(er.message, 1);
    }
    draw(); // sempre redesenha com o que está salvo no banco
    const gr = D.grupos.find((x) => String(x.id) === g);
    if (gr && gr.total && antes < 100 && gr.pct >= 100)
      trofeu(gr, D.grupos.filter((x) => x.total && x.pct >= 100).length === 1);
  };
  draw();
}
