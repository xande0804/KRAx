// public/assets/js/modals/detalhesCliente.modal.js
(function () {
  const qs = window.qs;
  const onError = window.onError || function () { };
  const GestorModal = window.GestorModal;

  function money(v) {
    const num = Number(v);
    if (Number.isFinite(num)) {
      return num.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    }
    const s = String(v ?? "");
    return s.includes("R$") ? s : (s ? `R$ ${s}` : "—");
  }

  function badge(status) {
    const s = String(status || "").toUpperCase();
    if (s === "QUITADO") return `<span class="badge badge--success">Quitado</span>`;
    if (s === "ATRASADO") return `<span class="badge badge--danger">Atrasado</span>`;
    return `<span class="badge badge--info">Ativo</span>`;
  }

  function esc(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatDateBR(yyyyMMdd) {
    const s = String(yyyyMMdd || "");
    if (!s) return "—";
    const only = s.slice(0, 10);
    const [y, m, d] = only.split("-");
    if (!y || !m || !d) return s;
    return `${d}/${m}/${y}`;
  }

  function onlyDate(x) {
    return String(x || "").slice(0, 10);
  }

  function parseISODate(x) {
    const s = onlyDate(x);
    if (!s) return null;
    const [y, m, d] = s.split("-");
    if (!y || !m || !d) return null;
    return new Date(Number(y), Number(m) - 1, Number(d));
  }

  function daysDiff(aISO, bISO) {
    // b - a (em dias)
    const a = parseISODate(aISO);
    const b = parseISODate(bISO);
    if (!a || !b) return 0;
    const ms = b.getTime() - a.getTime();
    return Math.floor(ms / (1000 * 60 * 60 * 24));
  }

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  function formatBytes(bytes) {
    const b = Number(bytes) || 0;
    if (b <= 0) return "—";
    const units = ["B", "KB", "MB", "GB"];
    let n = b;
    let i = 0;
    while (n >= 1024 && i < units.length - 1) {
      n = n / 1024;
      i++;
    }
    const val = i === 0 ? String(Math.round(n)) : n.toFixed(1).replace(".", ",");
    return `${val} ${units[i]}`;
  }

  function extFromName(name) {
    const s = String(name || "");
    const idx = s.lastIndexOf(".");
    return idx >= 0 ? s.slice(idx + 1).toLowerCase() : "";
  }

  function docKind(doc) {
    const mime = String(doc?.mime || "").toLowerCase();
    const name = String(doc?.nome_original || doc?.arquivo || "");
    const ext = extFromName(name);
    if (mime.startsWith("image/") || ["png", "jpg", "jpeg", "webp", "gif", "bmp"].includes(ext)) return "image";
    if (mime === "application/pdf" || ext === "pdf") return "pdf";
    return "file";
  }

  function docIcon(doc) {
    const kind = docKind(doc);
    if (kind === "image") return "🖼️";
    if (kind === "pdf") return "📄";
    return "📎";
  }

  function renderDocs(list) {
    if (!Array.isArray(list) || list.length === 0) {
      return `<div class="muted" style="margin-top:8px;">Nenhum documento anexado.</div>`;
    }

    return `
      <div class="docs-list" style="display:grid; gap:10px; margin-top:10px;">
        ${list.map((d) => {
      const url = String(d?.url || "");
      const nome = String(d?.nome_original || d?.arquivo || "Documento");
      const criado = d?.criado_em ? formatDateBR(String(d.criado_em).slice(0, 10)) : "";
      const tamanho = formatBytes(d?.tamanho);

      const kind = docKind(d);
      const icon = docIcon(d);

      const preview = (kind === "image" && url)
        ? `<img src="${esc(url)}" alt="${esc(nome)}" style="width:46px; height:46px; object-fit:cover; border-radius:10px; border:1px solid rgba(0,0,0,.08);" />`
        : `<div style="width:46px; height:46px; border-radius:10px; border:1px solid rgba(0,0,0,.08); display:flex; align-items:center; justify-content:center; font-size:18px;">${icon}</div>`;

      return `
            <div class="doc-row" style="display:flex; gap:12px; align-items:center; padding:10px; border:1px solid rgba(0,0,0,.08); border-radius:14px;">
              ${preview}

              <div style="min-width:0; flex:1;">
                <div style="font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                  ${esc(nome)}
                </div>
                <div class="muted" style="margin-top:2px; font-size:12px;">
                  ${criado ? `Enviado em ${esc(criado)}` : ""}${criado ? " • " : ""}${esc(tamanho)}
                </div>
              </div>

              <div style="display:flex; gap:8px; flex-wrap:wrap; justify-content:flex-end;">
                ${url ? `<a class="btn btn--secondary" href="${esc(url)}" target="_blank" rel="noopener">👁️ Ver</a>` : ""}
                ${url ? `<a class="btn" href="${esc(url)}" download>⬇️ Baixar</a>` : ""}
              </div>
            </div>
          `;
    }).join("")}
      </div>
    `;
  }

  // =============================
  // ✅ AVALIAÇÃO DO CLIENTE (1–5)
  // =============================
  function starsHTML(n) {
  const s = Math.max(1, Math.min(5, Number(n) || 1));
  const full = "★".repeat(s);
  const empty = "☆".repeat(5 - s);
  return `<span style="color:#f59e0b;">${full}${empty}</span>`;
}


  function ratingLabel(stars) {
    const s = Number(stars) || 1;
    if (s >= 5) return "Excelente pagador";
    if (s === 4) return "Bom pagador";
    if (s === 3) return "Regular";
    if (s === 2) return "Risco alto";
    return "Inadimplente";
  }

  function starsFromScore(score) {
    const x = Number(score) || 0;
    if (x >= 90) return 5;
    if (x >= 75) return 4;
    if (x >= 55) return 3;
    if (x >= 35) return 2;
    return 1;
  }

  function computeScore(metrics) {
    const total = Math.max(1, metrics.totalParcelas || 1);

    const fracAtrasoHoje = (metrics.emAtrasoHoje || 0) / total;
    const fracPagasAtrasadas = (metrics.pagasAtrasadas || 0) / total;
    const mediaAtraso = Math.max(0, metrics.mediaDiasAtraso || 0);
    const diasSemPagar = Math.max(0, metrics.diasSemPagar || 0);

    let score = 100;
    score -= 60 * fracAtrasoHoje;
    score -= 25 * fracPagasAtrasadas;
    score -= Math.min(20, mediaAtraso);
    score -= (diasSemPagar > 30 ? 15 : 0);

    score = Math.max(0, Math.min(100, score));
    return Math.round(score);
  }

  function pickMaxISO(a, b) {
    const aa = onlyDate(a);
    const bb = onlyDate(b);
    if (!aa) return bb;
    if (!bb) return aa;
    return aa > bb ? aa : bb;
  }

  function calcClienteMetricsFromEmprestimos(detailsArr) {
    const hoje = todayISO();

    let totalParcelas = 0;
    let pagasEmDia = 0;
    let pagasAtrasadas = 0;
    let emAtrasoHoje = 0;

    let somaDiasAtraso = 0;
    let qtdAtrasosPagos = 0;

    let lastPayISO = ""; // última data de pagamento encontrada

    for (const det of (detailsArr || [])) {
      const dados = det?.dados || det || {};
      const parcelas = Array.isArray(dados.parcelas) ? dados.parcelas : [];
      const pagamentos = Array.isArray(dados.pagamentos) ? dados.pagamentos : [];

      // última data no histórico de pagamentos
      for (const pg of pagamentos) {
        const d = onlyDate(pg.data_pagamento || pg.data || "");
        lastPayISO = pickMaxISO(lastPayISO, d);
      }

      for (const p of parcelas) {
        const vpar = Number(p.valor_parcela ?? 0) || 0;
        if (vpar <= 0) continue;

        totalParcelas++;

        const venc = onlyDate(p.data_vencimento ?? p.dataVencimento ?? "");
        const st = String(p.status || p.parcela_status || "").trim().toUpperCase();
        const vp = Number(p.valor_pago ?? p.valorPago ?? 0) || 0;

        const paga = (st === "PAGA" || st === "QUITADA" || vp + 0.00001 >= vpar);

        // data real de pagamento da parcela (preferência: pago_em)
        let pagoEm = onlyDate(p.pago_em || p.pagoEm || "");
        if (!pagoEm) {
          // fallback: procura no histórico o último pagamento desta parcela
          const pid = Number(p.id ?? p.parcela_id ?? 0) || 0;
          if (pid) {
            for (const pg of pagamentos) {
              const pgPid = Number(pg.parcela_id ?? pg.parcelaId ?? 0) || 0;
              const d = onlyDate(pg.data_pagamento || pg.data || "");
              if (pgPid === pid && d) pagoEm = pickMaxISO(pagoEm, d);
            }
          }
        }

        if (paga) {
          if (venc && pagoEm) {
            if (pagoEm <= venc) {
              pagasEmDia++;
            } else {
              pagasAtrasadas++;
              const atrasoDias = daysDiff(venc, pagoEm);
              if (atrasoDias > 0) {
                somaDiasAtraso += atrasoDias;
                qtdAtrasosPagos++;
              }
            }
          } else {
            // se não tiver datas, conta como paga em dia (neutro)
            pagasEmDia++;
          }
        } else {
          // não paga -> se vencida, está em atraso hoje
          if (venc && venc < hoje) emAtrasoHoje++;
        }
      }
    }

    const mediaDiasAtraso = qtdAtrasosPagos > 0 ? (somaDiasAtraso / qtdAtrasosPagos) : 0;
    const diasSemPagar = lastPayISO ? daysDiff(lastPayISO, hoje) : 999;

    return {
      totalParcelas,
      pagasEmDia,
      pagasAtrasadas,
      emAtrasoHoje,
      mediaDiasAtraso: Math.round(mediaDiasAtraso * 10) / 10,
      diasSemPagar,
      lastPayISO
    };
  }

  function renderRatingBlock(metrics) {
  const score = computeScore(metrics);
  const stars = starsFromScore(score);

  return `
    <div style="padding:10px 12px; border:1px solid rgba(0,0,0,.08); border-radius:14px; background:#fff;">
      
      <div style="font-size:18px; letter-spacing:2px;">
        ${starsHTML(stars)}
      </div>

      <div style="font-weight:700; margin-top:4px;">
        ${esc(ratingLabel(stars))}
      </div>

      <div class="muted" style="font-size:12px; margin-top:2px;">
        Score: ${esc(String(score))}/100
      </div>

    </div>
  `;
}


  // ========= INJECT MODAL =========
  window.injectModalDetalhesCliente = function injectModalDetalhesCliente() {
    if (qs("#modalDetalhesCliente")) return;

    const modal = document.createElement("section");
    modal.className = "modal";
    modal.id = "modalDetalhesCliente";
    modal.setAttribute("aria-hidden", "true");

    modal.innerHTML = `
      <div class="modal__dialog modal__dialog--xl">
        <header class="modal__header">
          <div class="client-head">
            <div class="client-head__left">
              <div class="client-avatar">👤</div>
              <div>
                <h3 class="client-name" data-fill="nome">Cliente</h3>
                <p class="client-sub">Dados completos do cliente</p>

                <!-- ✅ NOVO: Avaliação -->
                
              </div>
            </div>
            <button class="iconbtn" type="button" data-modal-close="modalDetalhesCliente">×</button>
          </div>
        </header>

        <div class="modal__body">
          <div class="client-details">

            <div class="client-info">
            <div id="clientRatingWrap" style="margin-top:6px;">
                  <div class="muted" style="font-size:12px;">Carregando avaliação...</div>
                </div>
              <div class="client-line"><span class="icon-bullet">📞</span> <span data-fill="telefone">—</span></div>
              <div class="client-line"><span class="icon-bullet">🪪</span> CPF <strong data-fill="cpf">—</strong></div>
              <div class="client-line"><span class="icon-bullet">📍</span> <span data-fill="endereco">—</span></div>
              <div class="client-line"><span class="icon-bullet">💼</span> <span data-fill="profissao">—</span></div>
              <div class="client-line"><span class="icon-bullet">🚗</span> <span data-fill="placa">—</span></div>
              <div class="client-line"><span class="icon-bullet">👥</span> Indicação: <strong data-fill="indicacao">—</strong></div>

              <!-- ✅ NOVO: Documentos -->
              <div class="hr" style="margin:14px 0;"></div>
              <div>
                <div class="section-title-row">📎 Documentos</div>
                <div id="docsListWrap" style="margin-top:8px;">
                  <div class="muted">Carregando documentos...</div>
                </div>
              </div>

              <div class="client-actions" style="margin-top:14px;">
                <button class="btn" type="button" id="btnEditarCliente">✏️ Editar</button>
                <button class="btn btn--danger" type="button" id="btnExcluirCliente">🗑️ Excluir</button>
              </div>
            </div>

            <div class="hr"></div>

            <!-- ===== Empréstimo ativo ===== -->
            <div>
              <div class="section-title-row">💸 Empréstimo ativo</div>

              <div class="loan-box" id="loanActiveBox" style="display:none;">
                <div class="loan-row-1">
                  <span class="badge badge--info" data-loan-active="status">Ativo</span>
                  <strong data-loan-active="valor">—</strong>
                  <span class="loan-meta"><span data-loan-active="parcelas">—</span> parcelas</span>
                </div>

                <div class="loan-row-2">
                  Próximo vencimento: <strong data-loan-active="venc">—</strong>
                </div>

                <div class="loan-actions">
                  <button
                    class="btn btn--primary"
                    type="button"
                    data-modal-open="lancarPagamento"
                    id="btnPagamentoEmprestimoAtivo"
                  >
                    💳 Lançar pagamento
                  </button>

                  <button class="btn btn--secondary" type="button" id="btnGerenciarEmprestimoAtivo">
                    Gerenciar
                  </button>
                </div>
              </div>

              <div class="muted" id="loanActiveEmpty" style="display:none; margin-top:8px;">
                Nenhum empréstimo ativo.
              </div>
            </div>

            <div class="hr" id="hrHistory" style="margin-top:16px;"></div>

            <!-- ===== Histórico ===== -->
            <div id="historyWrap">
              <div class="section-title-row">🕘 Histórico de empréstimos</div>

              <div id="loanHistoryList" style="display:grid; gap:10px; margin-top:10px;"></div>

              <div class="muted" id="loanHistoryEmpty" style="display:none; margin-top:8px;">
                Nenhum empréstimo no histórico.
              </div>
            </div>

            <div class="bottom-action" style="margin-top:16px;">
              <button
                class="btn"
                type="button"
                data-modal-open="novoEmprestimo"
                data-modal-close="modalDetalhesCliente"
                id="btnNovoEmprestimoDoCliente"
              >
                ➕ Novo empréstimo
              </button>
            </div>

          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
  };

  // ========= OPEN (carrega dados) =========
  window.openDetalhesCliente = async function openDetalhesCliente(clienteId) {
    const modal = document.getElementById("modalDetalhesCliente");
    if (!modal) return;

    const id = String(clienteId || "");
    if (!id) return;

    const fill = (field, value) => {
      const el = modal.querySelector(`[data-fill="${field}"]`);
      if (el) el.textContent = value || "—";
    };

    // Loading básico do cliente
    fill("nome", "Carregando...");
    fill("telefone", "—");
    fill("cpf", "—");
    fill("endereco", "—");
    fill("profissao", "—");
    fill("placa", "—");
    fill("indicacao", "—");

    modal.dataset.clienteId = id;

    // rating UI
    const ratingWrap = modal.querySelector("#clientRatingWrap");
    if (ratingWrap) ratingWrap.innerHTML = `<div class="muted" style="font-size:12px;">Carregando avaliação...</div>`;

    // prepara UI empréstimos
    const activeBox = modal.querySelector("#loanActiveBox");
    const activeEmpty = modal.querySelector("#loanActiveEmpty");
    const histList = modal.querySelector("#loanHistoryList");
    const histEmpty = modal.querySelector("#loanHistoryEmpty");

    if (activeBox) activeBox.style.display = "none";
    if (activeEmpty) activeEmpty.style.display = "none";
    if (histList) histList.innerHTML = "";
    if (histEmpty) histEmpty.style.display = "none";

    // prepara docs UI
    const docsWrap = modal.querySelector("#docsListWrap");
    if (docsWrap) docsWrap.innerHTML = `<div class="muted">Carregando documentos...</div>`;

    try {
      // 1) detalhes do cliente (✅ agora vem documentos também)
      const res = await fetch(`/KRAx/public/api.php?route=clientes/detalhes&id=${encodeURIComponent(id)}`);
      const json = await res.json();
      if (!json.ok) {
        onError(json.mensagem || "Erro ao buscar cliente");
        return;
      }

      const c = json.dados || {};
      fill("nome", c.nome);
      fill("telefone", c.telefone);
      fill("cpf", c.cpf);
      fill("endereco", c.endereco);
      fill("profissao", c.profissao);
      fill("placa", c.placa_carro);
      fill("indicacao", c.indicacao);

      // ✅ DOCUMENTOS no detalhes
      if (docsWrap) {
        docsWrap.innerHTML = renderDocs(c.documentos || []);
      }

      // datasets pros botões
      const btnNovo = modal.querySelector("#btnNovoEmprestimoDoCliente");
      if (btnNovo) {
        btnNovo.dataset.clienteId = id;
        btnNovo.dataset.clienteNome = c.nome || "";
      }

      const btnEdit = modal.querySelector("#btnEditarCliente");
      if (btnEdit) btnEdit.dataset.clienteId = id;

      const btnDel = modal.querySelector("#btnExcluirCliente");
      if (btnDel) btnDel.dataset.clienteId = id;

      // 2) lista de empréstimos do cliente
      const r2 = await fetch(`/KRAx/public/api.php?route=emprestimos/por_cliente&cliente_id=${encodeURIComponent(id)}`);
      const j2 = await r2.json();

      const lista = (j2 && j2.ok && Array.isArray(j2.dados)) ? j2.dados : [];

      const normStatus = (x) => String(x.status || x.emprestimo_status || x.situacao || "").toUpperCase();
      const getEmpId = (x) => String(x.emprestimo_id || x.id || x.emprestimoId || "");
      const getValor = (x) => x.valor_principal ?? x.valor ?? x.valorPrincipal ?? null;
      const getParcelasTxt = (x) =>
        x.parcelas ||
        x.parcelas_info ||
        x.parcelasInfo ||
        `${x.parcelas_pagas ?? x.pagas ?? 0}/${x.quantidade_parcelas ?? x.total_parcelas ?? x.total ?? 0}`;
      const getProxVenc = (x) => x.proximo_vencimento || x.prox_vencimento || x.proximoVencimento || x.vencimento || null;

      // ativo principal
      const ativos = lista.filter((x) => normStatus(x) === "ATIVO");
      const ativo = ativos.length ? ativos[0] : null;

      const ativoId = ativo ? getEmpId(ativo) : "";

      // histórico = tudo que NÃO for o ativo principal
      const historico = lista.filter((x) => getEmpId(x) !== ativoId);

      // ✅ Avaliação: busca detalhes de todos empréstimos (cap 10 por segurança)
      const idsEmp = Array.from(new Set(lista.map(getEmpId).filter(Boolean))).slice(0, 10);

      let detailsArr = [];
      if (idsEmp.length) {
        const reqs = idsEmp.map((eid) =>
          fetch(`/KRAx/public/api.php?route=emprestimos/detalhes&id=${encodeURIComponent(eid)}`)
            .then(r => r.json())
            .catch(() => null)
        );

        const results = await Promise.all(reqs);
        detailsArr = results.filter(x => x && x.ok).map(x => x.dados || x);
      }

      const metrics = calcClienteMetricsFromEmprestimos(detailsArr);

      if (ratingWrap) {
        // se não tiver nenhum empréstimo/parcela, nota neutra 3★
        if (!metrics.totalParcelas || metrics.totalParcelas <= 0) {
          ratingWrap.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px; margin-top:8px;">
              <div style="padding:8px 10px; border:1px solid rgba(0,0,0,.08); border-radius:12px; background:#fff;">
                ${starsHTML(3)}
                <div style="font-weight:800; margin-top:2px;">3★ • Sem histórico suficiente</div>
                <div class="muted" style="font-size:12px; margin-top:2px;">Cadastre pagamentos para avaliar melhor</div>
              </div>
            </div>
          `;
        } else {
          ratingWrap.innerHTML = renderRatingBlock(metrics);
        }
      }

      // ====== Empréstimo ativo ======
      if (ativo && activeBox) {
        const setActive = (key, value) => {
          const el = activeBox.querySelector(`[data-loan-active="${key}"]`);
          if (el) el.textContent = value ?? "—";
        };

        const empId = getEmpId(ativo);
        const parcelasTxt = getParcelasTxt(ativo);
        const st = normStatus(ativo);

        setActive("status", st === "ATRASADO" ? "Atrasado" : "Ativo");
        setActive("valor", money(getValor(ativo)));
        setActive("parcelas", parcelasTxt);

        const pv = getProxVenc(ativo);
        setActive("venc", pv ? formatDateBR(pv) : "—");

        const btnGer = modal.querySelector("#btnGerenciarEmprestimoAtivo");
        if (btnGer) {
          btnGer.onclick = () => {
            if (typeof window.openDetalhesEmprestimo === "function") {
              window.openDetalhesEmprestimo(empId, { origem: "cliente", clienteId: id });
            } else {
              onError("Função openDetalhesEmprestimo() não encontrada.");
            }
          };
        }

        const btnPay = modal.querySelector("#btnPagamentoEmprestimoAtivo");
        if (btnPay) {
          btnPay.dataset.origem = "cliente";
          btnPay.dataset.clienteId = id;
          btnPay.dataset.emprestimoId = empId;
          btnPay.dataset.clienteNome = c.nome || "";
          btnPay.dataset.emprestimoInfo = `${money(getValor(ativo))} - ${parcelasTxt} parcelas`;
          btnPay.dataset.tipoPadrao = "PARCELA";
        }

        activeBox.style.display = "";
        if (activeEmpty) activeEmpty.style.display = "none";
      } else {
        if (activeBox) activeBox.style.display = "none";
        if (activeEmpty) activeEmpty.style.display = "";
      }

      // ====== Histórico ======
      if (historico.length && histList) {
        histList.innerHTML = historico
          .map((e) => {
            const empId = getEmpId(e);
            const parcelasTxt = getParcelasTxt(e);
            const st = normStatus(e);

            const parcelasSafe = esc(String(parcelasTxt ?? "—"));

            return `
              <article class="list-item" style="padding:12px;">
                <div class="list-item__main">
                  <div class="list-item__title" style="display:flex; align-items:center; gap:10px;">
                    <strong>${money(getValor(e))}</strong>
                    <span class="muted">${parcelasSafe} parcelas</span>
                  </div>
                </div>

                <div class="list-item__actions" style="display:flex; align-items:center; gap:10px;">
                  ${badge(st)}
                  <button
                    class="linkbtn"
                    type="button"
                    data-modal-open="detalhesEmprestimo"
                    data-emprestimo-id="${esc(empId)}"
                  >Ver</button>
                </div>
              </article>
            `;
          })
          .join("");

        if (histEmpty) histEmpty.style.display = "none";
      } else {
        if (histList) histList.innerHTML = "";
        if (histEmpty) histEmpty.style.display = "";
      }

      GestorModal.open("modalDetalhesCliente");
    } catch (err) {
      console.error(err);
      onError("Erro ao carregar detalhes do cliente.");
    }
  };
})();
