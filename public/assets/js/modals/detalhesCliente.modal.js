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

    function safeText(v) {
        return String(v ?? "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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
                </div>
              </div>
              <button class="iconbtn" type="button" data-modal-close="modalDetalhesCliente">×</button>
            </div>
          </header>
  
          <div class="modal__body">
            <div class="client-details">
  
              <div class="client-info">
                <div class="client-line"><span class="icon-bullet">📞</span> <span data-fill="telefone">—</span></div>
                <div class="client-line"><span class="icon-bullet">🪪</span> CPF <strong data-fill="cpf">—</strong></div>
                <div class="client-line"><span class="icon-bullet">📍</span> <span data-fill="endereco">—</span></div>
                <div class="client-line"><span class="icon-bullet">💼</span> <span data-fill="profissao">—</span></div>
                <div class="client-line"><span class="icon-bullet">🚗</span> <span data-fill="placa">—</span></div>
                <div class="client-line"><span class="icon-bullet">👥</span> Indicação: <strong data-fill="indicacao">—</strong></div>
  
                <div class="client-actions">
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
                    <button class="btn btn--secondary" type="button" id="btnGerenciarEmprestimoAtivo">
                      Gerenciar
                    </button>
  
                    <button
                      class="btn btn--primary"
                      type="button"
                      data-modal-open="lancarPagamento"
                      id="btnPagamentoEmprestimoAtivo"
                    >
                      💳 Lançar pagamento
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

        // prepara UI empréstimos
        const activeBox = modal.querySelector("#loanActiveBox");
        const activeEmpty = modal.querySelector("#loanActiveEmpty");
        const histList = modal.querySelector("#loanHistoryList");
        const histEmpty = modal.querySelector("#loanHistoryEmpty");

        if (activeBox) activeBox.style.display = "none";
        if (activeEmpty) activeEmpty.style.display = "none";
        if (histList) histList.innerHTML = "";
        if (histEmpty) histEmpty.style.display = "none";

        try {
            // 1) detalhes do cliente
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

            // 2) lista de empréstimos do cliente (ATIVO/ATRASADO/QUITADO)
            //    precisa existir esse endpoint:
            //    /api.php?route=emprestimos/por_cliente&cliente_id=ID
            const r2 = await fetch(`/KRAx/public/api.php?route=emprestimos/por_cliente&cliente_id=${encodeURIComponent(id)}`);
            const j2 = await r2.json();

            const lista = (j2 && j2.ok && Array.isArray(j2.dados)) ? j2.dados : [];

            // regra igual às prints:
            // - "Empréstimo ativo": só status ATIVO
            // - "Histórico": ATRASADO + QUITADO (+ o resto que não for ATIVO, se vier)
            const normStatus = (x) => String(x.status || x.emprestimo_status || x.situacao || "").toUpperCase();
            const getEmpId = (x) => String(x.emprestimo_id || x.id || x.emprestimoId || "");
            const getValor = (x) => x.valor_principal ?? x.valor ?? x.valorPrincipal ?? null;
            const getParcelasTxt = (x) =>
                x.parcelas ||
                x.parcelas_info ||
                x.parcelasInfo ||
                `${x.parcelas_pagas ?? x.pagas ?? 0}/${x.quantidade_parcelas ?? x.total_parcelas ?? x.total ?? 0}`;
            const getProxVenc = (x) => x.proximo_vencimento || x.prox_vencimento || x.proximoVencimento || x.vencimento || null;

            // pega os ATIVOS e escolhe 1 "principal" (o primeiro da lista normalmente já é o mais recente)
            const ativos = lista.filter((x) => normStatus(x) === "ATIVO");
            const ativo = ativos.length ? ativos[0] : null;

            const ativoId = ativo ? getEmpId(ativo) : "";

            // histórico = tudo que NÃO for o ativo principal (inclui outros ATIVOS, ATRASADOS, QUITADOS, etc.)
            const historico = lista.filter((x) => getEmpId(x) !== ativoId);



            // ====== Empréstimo ativo ======
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
                setActive("venc", getProxVenc(ativo) || "—");

                // Botão "Gerenciar" -> abre detalhes do empréstimo
                const btnGer = modal.querySelector("#btnGerenciarEmprestimoAtivo");
                if (btnGer) {
                    btnGer.onclick = () => {
                        if (typeof window.openDetalhesEmprestimo === "function") {
                            window.openDetalhesEmprestimo(empId);
                        } else {
                            onError("Função openDetalhesEmprestimo() não encontrada.");
                        }
                    };
                }

                // Botão "Lançar pagamento"
                const btnPay = modal.querySelector("#btnPagamentoEmprestimoAtivo");
                if (btnPay) {
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

                        const parcelasSafe = String(parcelasTxt ?? "—")
                            .replace(/&/g, "&amp;")
                            .replace(/</g, "&lt;")
                            .replace(/>/g, "&gt;")
                            .replace(/"/g, "&quot;")
                            .replace(/'/g, "&#039;");

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
                data-emprestimo-id="${empId}"
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