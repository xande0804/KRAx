// assets/js/modals.js
(function () {
  function qs(sel, root = document) {
    return root.querySelector(sel);
  }

  function injectToastHost() {
    if (document.getElementById("toastHost")) return;
    const host = document.createElement("div");
    host.id = "toastHost";
    host.className = "toast-host";
    document.body.appendChild(host);
  }

  function toast(msg, type = "success", ms = 2200) {
    injectToastHost();
    const host = document.getElementById("toastHost");

    const el = document.createElement("div");
    el.className = `toast toast--${type}`;
    el.textContent = msg;

    host.appendChild(el);

    requestAnimationFrame(() => el.classList.add("is-show"));

    setTimeout(() => {
      el.classList.remove("is-show");
      setTimeout(() => el.remove(), 250);
    }, ms);
  }

  function onSuccess(msg, opts = {}) {
    toast(msg || "Ação concluída com sucesso!", "success", 1700);

    const {
      redirectTo = null, // ex: "emprestimos.html"
      reload = true,
      delay = 900,
    } = opts;

    setTimeout(() => {
      if (redirectTo) {
        window.location.href = redirectTo;
        return;
      }
      if (reload) window.location.reload();
    }, delay);
  }

  function onError(msg) {
    toast(msg || "Ocorreu um erro.", "error", 2600);
  }

  const Modal = {
    open(id) {
      const overlay = qs("#modalOverlay");
      const modal = qs(`#${id}`);
      if (!overlay || !modal) return;

      overlay.classList.add("is-open");
      modal.classList.add("is-open");
      modal.setAttribute("aria-hidden", "false");
      document.body.classList.add("no-scroll");
    },
    close(id) {
      const overlay = qs("#modalOverlay");
      const modal = qs(`#${id}`);
      if (!overlay || !modal) return;

      modal.classList.remove("is-open");
      modal.setAttribute("aria-hidden", "true");

      const anyOpen = document.querySelector(".modal.is-open");
      if (!anyOpen) overlay.classList.remove("is-open");

      document.body.classList.remove("no-scroll");
    },
    closeAll() {
      document.querySelectorAll(".modal.is-open").forEach((m) => {
        m.classList.remove("is-open");
        m.setAttribute("aria-hidden", "true");
      });
      const overlay = qs("#modalOverlay");
      if (overlay) overlay.classList.remove("is-open");
      document.body.classList.remove("no-scroll");
    },
  };

  window.GestorModal = Modal;

  function injectOverlay() {
    if (qs("#modalOverlay")) return;
    const overlay = document.createElement("div");
    overlay.id = "modalOverlay";
    overlay.className = "modal-overlay";
    overlay.addEventListener("click", () => Modal.closeAll());
    document.body.appendChild(overlay);
  }

  function injectModalNovoCliente() {
    if (qs("#modalNovoCliente")) return;

    const modal = document.createElement("section");
    modal.className = "modal";
    modal.id = "modalNovoCliente";
    modal.setAttribute("aria-hidden", "true");

    modal.innerHTML = `
      <div class="modal__dialog">
        <header class="modal__header">
          <div>
            <h3 class="modal__title">Novo cliente</h3>
            <p class="modal__subtitle">Preencha os dados do novo cliente.</p>
          </div>
          <button class="iconbtn" type="button" data-modal-close="modalNovoCliente">×</button>
        </header>

        <form class="modal__body" id="formNovoCliente" action="/KRAx/public/api.php?route=clientes/criar" method="post">
          <div class="form-grid">
            <div class="field form-span-2">
              <label>Nome *</label>
              <input name="nome" required placeholder="Nome completo" />
            </div>

            <div class="field">
              <label>CPF</label>
              <input name="cpf" placeholder="000.000.000-00" />
            </div>

            <div class="field">
              <label>Telefone</label>
              <input name="telefone" placeholder="(00) 00000-0000" />
            </div>

            <div class="field form-span-2">
              <label>Endereço</label>
              <input name="endereco" placeholder="Rua, numero, bairro" />
            </div>

            <div class="field">
              <label>Profissão</label>
              <input name="profissao" placeholder="Ex: Comerciante" />
            </div>

            <div class="field">
              <label>Placa do carro</label>
              <input name="placa_carro" placeholder="ABC-1234" />
            </div>

            <div class="field form-span-2">
              <label>Indicação</label>
              <input name="indicacao" placeholder="Quem indicou este cliente?" />
            </div>
          </div>

          <footer class="modal__footer">
            <button class="btn" type="button" data-modal-close="modalNovoCliente">Cancelar</button>

            <button class="btn btn--secondary" type="submit" name="acao" value="salvar">
              Salvar cadastro
            </button>

            <button class="btn btn--primary" type="button" id="btnSalvarECriarEmprestimo">
              Salvar e criar empréstimo
            </button>
          </footer>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    // ===== SUBMIT REAL (POST pro backend) =====
    const form = qs("#formNovoCliente");
    let abrirNovoEmprestimoDepois = false; // 👈 FLAG

    form.addEventListener("submit", async (e) => {
      e.preventDefault(); // não deixar navegar pra página de JSON

      try {
        const fd = new FormData(form);

        const res = await fetch("/KRAx/public/api.php?route=clientes/criar", {
          method: "POST",
          body: fd,
        });

        const json = await res.json();

        if (!json.ok) {
          onError(json.mensagem || "Erro ao criar cliente");
          abrirNovoEmprestimoDepois = false;
          return;
        }

        const novoClienteId = json.dados?.id;
        const nomeDigitado = (fd.get("nome") || "").toString().trim();

        // fecha + limpa
        Modal.close("modalNovoCliente");
        form.reset();

        // se foi "Salvar e criar empréstimo": abre o outro modal já vinculado
        if (abrirNovoEmprestimoDepois) {
          toast("Cliente cadastrado! Abrindo empréstimo...", "success", 1400);
          abrirNovoEmprestimoDepois = false;

          Modal.closeAll();

          // garante que o modal exista (se sua injeção depende de gatilho)
          if (
            !document.getElementById("modalNovoEmprestimo") &&
            typeof injectModalNovoEmprestimo === "function"
          ) {
            injectModalNovoEmprestimo();
          }

          // abre e passa os dados pelo "dataset" como se fosse um botão
          Modal.open("modalNovoEmprestimo");

          // preenche dentro do modal de novo empréstimo
          setTimeout(() => {
            Modal.open("modalNovoEmprestimo");

            const modalEmp = document.getElementById("modalNovoEmprestimo");
            if (!modalEmp) return;

            const selectCliente = modalEmp.querySelector(
              'select[name="cliente_id"]',
            );
            if (selectCliente && novoClienteId) {
              selectCliente.innerHTML = `
                <option value="">Selecione o cliente</option>
                <option value="${novoClienteId}">${nomeDigitado || "Cliente"}</option>
              `;
              selectCliente.value = String(novoClienteId);

              // trava (CSS)
              selectCliente.disabled = false;
              selectCliente.dataset.locked = "1";
            }

            const inputData = modalEmp.querySelector(
              'input[name="data_emprestimo"]',
            );
            if (inputData && !inputData.value) {
              inputData.value = new Date().toISOString().slice(0, 10);
            }
          }, 0);
        } else {
          onSuccess("Cliente cadastrado!", { reload: true });
        }
      } catch (err) {
        console.error(err);
        onSuccess("Erro de conexão com o servidor");
        abrirNovoEmprestimoDepois = false;
      }
    });

    // ===== BOTÃO “SALVAR E CRIAR EMPRÉSTIMO” =====
    qs("#btnSalvarECriarEmprestimo").addEventListener("click", () => {
      abrirNovoEmprestimoDepois = true;
      form.requestSubmit(); // dispara o submit acima
    });
  }

  function injectModalDetalhesCliente() {
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
              <div class="client-line"><span class="icon-bullet">📞</span> <span data-fill="telefone">(00) 00000-0000</span></div>
              <div class="client-line"><span class="icon-bullet">🪪</span> CPF <strong data-fill="cpf">000.000.000-00</strong></div>
              <div class="client-line"><span class="icon-bullet">📍</span> <span data-fill="endereco">Endereço</span></div>
              <div class="client-line"><span class="icon-bullet">💼</span> <span data-fill="profissao">Profissão</span></div>
              <div class="client-line"><span class="icon-bullet">🚗</span> <span data-fill="placa">ABC-1234</span></div>
              <div class="client-line"><span class="icon-bullet">👥</span> Indicação: <strong data-fill="indicacao">—</strong></div>

              <div class="client-actions">
                <button class="btn" type="button" id="btnEditarCliente">✏️ Editar</button>
                <button class="btn btn--danger" type="button" id="btnExcluirCliente">🗑️ Excluir</button>
              </div>
            </div>

            <div class="hr"></div>

            <div>
              <div class="section-title-row">💸 Empréstimo ativo</div>

              <div class="loan-box" id="loanBox">
                <div class="loan-row-1">
                  <span class="badge badge--info" data-fill="loan_status">Ativo</span>
                  <strong data-fill="loan_valor">R$ 5.000</strong>
                  <span class="loan-meta"><span data-fill="loan_parcelas">3/10</span> parcelas</span>
                </div>

                <div class="loan-row-2">
                  Próximo vencimento: <strong data-fill="loan_venc">10/05/2026</strong>
                </div>

                <div class="loan-actions">
                  <button class="btn btn--secondary" type="button">Gerenciar</button>
                  <button class="btn btn--primary" type="button">Lançar pagamento</button>
                </div>
              </div>

              <div class="muted" id="noLoan" style="display:none; margin-top:8px;">
                Este cliente não possui empréstimo ativo.
              </div>
            </div>

            <div class="bottom-action">
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
  }

  function injectModalDetalhesEmprestimo() {
    if (qs("#modalDetalhesEmprestimo")) return;

    const modal = document.createElement("section");
    modal.className = "modal";
    modal.id = "modalDetalhesEmprestimo";
    modal.setAttribute("aria-hidden", "true");

    modal.innerHTML = `
    <div class="modal__dialog modal__dialog--xl">
      <header class="modal__header">
        <div>
          <h3 class="modal__title">Detalhes do empréstimo</h3>
          <p class="modal__subtitle">Informações completas do empréstimo.</p>
        </div>
        <button class="iconbtn" type="button" data-modal-close="modalDetalhesEmprestimo">×</button>
      </header>

      <div class="modal__body">

        <div class="loan-head">
          <div class="loan-head__icon">👤</div>
          <div>
            <p class="loan-head__name" data-loan="cliente_nome">Cliente</p>
            <p class="loan-head__sub" data-loan="cliente_tel">(00) 00000-0000</p>
          </div>
        </div>

        <div class="loan-kpis">
          <div class="kpi">
            <div class="kpi__label">Valor</div>
            <div class="kpi__value" data-loan="valor">R$ 0</div>
          </div>

          <div class="kpi">
            <div class="kpi__label" data-loan="juros_label">Total com juros (0%)</div>
            <div class="kpi__value" data-loan="total_juros">R$ 0</div>
          </div>

          <div class="kpi">
            <div class="kpi__label">Parcelas</div>
            <div class="kpi__value" data-loan="parcelas">0 / 0</div>
          </div>

          <div class="kpi">
            <div class="kpi__label">Vencimento</div>
            <div class="kpi__value" data-loan="tipo_venc">Mensal</div>
          </div>
        </div>

        <div class="loan-status">
          Status: <span class="badge badge--info" data-loan="status">Ativo</span>
          <span>•</span>
          <span>Criado em <strong data-loan="criado_em">--/--/----</strong></span>
        </div>

        <div class="loan-actions-row">
          <button class="btn btn--primary" type="button">Lançar pagamento</button>
          <button class="btn btn--secondary" type="button">Marcar como quitado</button>
        </div>

        <div class="hr"></div>

        <div class="modal-section">
          <h4 class="modal-section__title">Parcelas</h4>

          <div class="installments">
            <div class="installments__scroll" id="installmentsList">
              <!-- injetado por JS -->
            </div>
          </div>
        </div>
        
        <div class="modal-section">
          <h4 class="modal-section__title">Histórico de pagamentos</h4>
          <div class="pay-history" id="payHistoryList">
            <!-- injetado por JS -->
          </div>
        </div>
      </div>
    </div>`;

    document.body.appendChild(modal);
  }

  function injectModalLancamentoPagamento() {
    if (qs("#modalLancarPagamento")) return;

    const modal = document.createElement("section");
    modal.className = "modal";
    modal.id = "modalLancarPagamento";
    modal.setAttribute("aria-hidden", "true");

    modal.innerHTML = `
    <div class="modal__dialog">
      <header class="modal__header">
        <div>
          <h3 class="modal__title">Lançar pagamento</h3>
          <p class="modal__subtitle">Registre o pagamento recebido.</p>
        </div>
        <button class="iconbtn" type="button" data-modal-close="modalLancarPagamento">×</button>
      </header>

      <form class="modal__body" id="formLancarPagamento" action="#" method="post">
      <input type="hidden" name="emprestimo_id" data-pay="emprestimo_id" />
      <input type="hidden" name="parcela_id" data-pay="parcela_id" />

        <div class="form-grid">

          <div class="field form-span-2">
            <label>Cliente</label>
            <input name="cliente_nome" data-pay="cliente_nome" readonly value="—" />
          </div>

          <div class="field form-span-2">
            <label>Empréstimo</label>
            <input name="emprestimo_info" data-pay="emprestimo_info" readonly value="—" />
          </div>

          <div class="field form-span-2">
            <label>Tipo de pagamento</label>
            <select name="tipo_pagamento" data-pay="tipo_pagamento" required>
  <option value="PARCELA">Parcela</option>
  <option value="JUROS">Apenas juros</option>
  <option value="INTEGRAL">Valor integral (quitação)</option>
  <option value="EXTRA">Multa</option>
</select>

          </div>

          <div class="field">
            <label>Valor pago (R$)</label>
            <input name="valor_pago" data-pay="valor_pago" inputmode="decimal" placeholder="0,00" required />
          </div>

          <div class="field">
            <label>Data do pagamento</label>
            <input name="data_pagamento" data-pay="data_pagamento" type="date" required />
          </div>

          <div class="field form-span-2">
            <label>Observação (opcional)</label>
            <textarea name="observacao" data-pay="observacao" rows="4" placeholder="Alguma anotação..."></textarea>
          </div>

        </div>

        <footer class="modal__footer modal__footer--end">
          <button class="btn" type="button" data-modal-close="modalLancarPagamento">Cancelar</button>
          <button class="btn btn--primary" type="submit">Confirmar pagamento</button>
        </footer>
      </form>
    </div>
  `;

    document.body.appendChild(modal);

    // front-only: não recarrega
    const form = qs("#formLancarPagamento");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      try {
        const fd = new FormData(form);

        // AJUSTE a rota se a sua for diferente
        const res = await fetch(
          "/KRAx/public/api.php?route=pagamentos/lancar",
          {
            method: "POST",
            body: fd,
          },
        );

        const json = await res.json();

        if (!json.ok) {
          onError(json.mensagem || "Erro ao lançar pagamento");
          return;
        }

        Modal.close("modalLancarPagamento");
        form.reset();

        onSuccess("Pagamento lançado!", { reload: true });
      } catch (err) {
        console.error(err);
        onError("Erro de conexão com o servidor");
      }
    });
  }
  function injectModalNovoEmprestimo() {
    if (qs("#modalNovoEmprestimo")) return;

    const modal = document.createElement("section");
    modal.className = "modal";
    modal.id = "modalNovoEmprestimo";
    modal.setAttribute("aria-hidden", "true");

    modal.innerHTML = `
  <div class="modal__dialog">
    <header class="modal__header">
      <div>
        <h3 class="modal__title">Novo empréstimo</h3>
        <p class="modal__subtitle">Preencha os dados do empréstimo.</p>
      </div>
      <button class="iconbtn" type="button" data-modal-close="modalNovoEmprestimo">×</button>
    </header>

    <form class="modal__body" id="formNovoEmprestimo" action="/KRAx/public/api.php?route=emprestimos/criar" method="post">
      <div class="form-grid">

        <div class="field form-span-2">
          <label>Cliente</label>
          <select name="cliente_id" data-loannew="cliente_id" required>
          <option value="">Selecione o cliente</option>
        </select>

        </div>

        <div class="field form-span-2">
          <label>Data do empréstimo</label>
          <input type="date" name="data_emprestimo" data-loannew="data_emprestimo" required />
        </div>

        <div class="field">
          <label>Valor (R$)</label>
          <input name="valor_principal" data-loannew="valor" inputmode="decimal" placeholder="0,00" required />
        </div>

        <div class="field">
          <label>Parcelas</label>
          <input type="number" min="1" name="quantidade_parcelas" data-loannew="parcelas" value="10" required />
        </div>

        <div class="field">
          <label>Juros (%)</label>
          <input type="number" min="0" step="0.01" name="porcentagem_juros" data-loannew="juros" value="10" required />
        </div>

        <div class="field form-span-2">
          <label>Tipo de vencimento</label>
          <select name="tipo_vencimento" required>
            <option value="MENSAL">Mensal</option>
            <option value="SEMANAL">Semanal</option>
            <option value="DIARIO">Diário</option>
          </select>
        </div>

        <div class="field form-span-2">
          <label>Dia do mês</label>
          <select name="regra_vencimento" data-loannew="dia_mes" required>
            ${Array.from({ length: 28 }, (_, i) => `<option value="${i + 1}">Dia ${i + 1}</option>`).join("")}
          </select>
        </div>

      </div>

      <footer class="modal__footer modal__footer--end">
        <button class="btn" type="button" data-modal-close="modalNovoEmprestimo">Cancelar</button>
        <button class="btn btn--primary" type="submit">Salvar empréstimo</button>
      </footer>
    </form>
  </div>
`;

    document.body.appendChild(modal);

    // ===== SUBMIT REAL (POST pro backend) =====
    const form = qs("#formNovoEmprestimo");

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      try {
        const fd = new FormData(form);

        const res = await fetch(
          "/KRAx/public/api.php?route=emprestimos/criar",
          {
            method: "POST",
            body: fd,
          },
        );

        const json = await res.json();

        if (!json.ok) {
          onError(json.mensagem || "Erro ao criar empréstimo");
          return;
        }

        Modal.close("modalNovoEmprestimo");
        form.reset();

        // vai pra página de empréstimos depois de criar
        onSuccess("Empréstimo criado!", {
          redirectTo: "emprestimos.html",
          reload: false,
        });
      } catch (err) {
        console.error(err);
        onError("Erro de conexão com o servidor");
      }
    });
  }

  function injectModalEditarCliente() {
    if (qs("#modalEditarCliente")) return;

    const modal = document.createElement("section");
    modal.className = "modal";
    modal.id = "modalEditarCliente";
    modal.setAttribute("aria-hidden", "true");

    modal.innerHTML = `
      <div class="modal__dialog">
        <header class="modal__header">
          <div>
            <h3 class="modal__title">Editar cliente</h3>
            <p class="modal__subtitle">Atualize os dados do cliente.</p>
          </div>
          <button class="iconbtn" type="button" data-modal-close="modalEditarCliente">×</button>
        </header>
  
        <form class="modal__body" id="formEditarCliente" action="/KRAx/public/api.php?route=clientes/atualizar" method="post">
          <input type="hidden" name="id" />
  
          <div class="form-grid">
            <div class="field form-span-2">
              <label>Nome *</label>
              <input name="nome" required />
            </div>
  
            <div class="field">
              <label>CPF</label>
              <input name="cpf" />
            </div>
  
            <div class="field">
              <label>Telefone</label>
              <input name="telefone" />
            </div>
  
            <div class="field form-span-2">
              <label>Endereço</label>
              <input name="endereco" />
            </div>
  
            <div class="field">
              <label>Profissão</label>
              <input name="profissao" />
            </div>
  
            <div class="field">
              <label>Placa do carro</label>
              <input name="placa_carro" />
            </div>
  
            <div class="field form-span-2">
              <label>Indicação</label>
              <input name="indicacao" />
            </div>
          </div>
  
          <footer class="modal__footer modal__footer--end">
            <button class="btn" type="button" data-modal-close="modalEditarCliente">Cancelar</button>
            <button class="btn btn--primary" type="submit">Salvar alterações</button>
          </footer>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    const form = qs("#formEditarCliente");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      try {
        const fd = new FormData(form);

        const res = await fetch(
          "/KRAx/public/api.php?route=clientes/atualizar",
          {
            method: "POST",
            body: fd,
          },
        );

        const json = await res.json();

        if (!json.ok) {
          onError(json.mensagem || "Erro ao atualizar cliente");
          return;
        }

        Modal.close("modalEditarCliente");
        onSuccess("Cliente atualizado!", { reload: true });
      } catch (err) {
        console.error(err);
        onError("Erro de conexão com o servidor");
      }
    });
  }

  function bindOpenClose() {
    document.addEventListener("click", async (e) => {
      const openEl = e.target.closest("[data-modal-open]");
      const closeEl = e.target.closest("[data-modal-close]");

      // 1) Se clicou em algo que só fecha (X, Cancelar etc)
      if (closeEl && !openEl) {
        Modal.close(closeEl.getAttribute("data-modal-close"));
        return;
      }

      // 2) Se clicou em algo que abre modal
      if (openEl) {
        const key = openEl.getAttribute("data-modal-open");
        const map = {
          novoCliente: "modalNovoCliente",
          detalhesCliente: "modalDetalhesCliente",
          detalhesEmprestimo: "modalDetalhesEmprestimo",
          lancarPagamento: "modalLancarPagamento",
          novoEmprestimo: "modalNovoEmprestimo",
        };

        // Se o MESMO botão também manda fechar um modal antes, fecha primeiro.
        // Ex: botão "Novo empréstimo" dentro do modal detalhesCliente
        const closeTarget = openEl.getAttribute("data-modal-close");
        if (closeTarget) Modal.close(closeTarget);

        // -------------------------
        // DETALHES CLIENTE (com fetch)
        // -------------------------
        if (key === "detalhesCliente") {
          const modal = document.getElementById("modalDetalhesCliente");
          if (!modal) return;

          const clienteId = openEl.dataset.clienteId;
          if (!clienteId) return;

          const fill = (field, value) => {
            const el = modal.querySelector(`[data-fill="${field}"]`);
            if (el) el.textContent = value || "—";
          };

          // enquanto carrega
          fill("nome", "Carregando...");
          fill("telefone", "—");
          fill("cpf", "—");
          fill("endereco", "—");
          fill("profissao", "—");
          fill("placa", "—");
          fill("indicacao", "—");

          // esconde empréstimo enquanto carrega
          const loanBox = modal.querySelector("#loanBox");
          const noLoan = modal.querySelector("#noLoan");
          if (loanBox) loanBox.style.display = "none";
          if (noLoan) noLoan.style.display = "none";

          try {
            const res = await fetch(
              `/KRAx/public/api.php?route=clientes/detalhes&id=${clienteId}`,
            );
            const json = await res.json();

            if (!json.ok) {
              onError(json.mensagem || "Erro ao buscar cliente");
              return;
            }

            const c = json.dados;

            // guarda o clienteId no modal (útil pra editar/excluir)
            modal.dataset.clienteId = String(clienteId);

            // preenche dados
            fill("nome", c.nome);
            fill("telefone", c.telefone);
            fill("cpf", c.cpf);
            fill("endereco", c.endereco);
            fill("profissao", c.profissao);
            fill("placa", c.placa_carro);
            fill("indicacao", c.indicacao);

            // botão "Novo empréstimo" DENTRO do modal
            const btnNovo = modal.querySelector("#btnNovoEmprestimoDoCliente");
            if (btnNovo) {
              btnNovo.dataset.clienteId = String(clienteId);
              btnNovo.dataset.clienteNome = c.nome || "";
            }

            // botões Editar / Excluir (precisa ter os IDs no HTML do modal)
            const btnEdit = modal.querySelector("#btnEditarCliente");
            if (btnEdit) btnEdit.dataset.clienteId = String(clienteId);

            const btnDel = modal.querySelector("#btnExcluirCliente");
            if (btnDel) btnDel.dataset.clienteId = String(clienteId);

            // ==========================
            // EMPRÉSTIMOS DO CLIENTE (opcional)
            // Se você ainda não tem esse endpoint, deixe comentado por enquanto.
            // ==========================
            /*
            try {
              const r2 = await fetch(`/KRAx/public/api.php?route=emprestimos/por_cliente&id=${clienteId}`);
              const j2 = await r2.json();
        
              if (j2.ok && (j2.dados || []).length) {
                const e0 = j2.dados[0]; // por enquanto usa o primeiro (ou o "ativo")
        
                fill("loan_status", e0.status || "Ativo");
                fill("loan_valor", e0.valor_formatado || `R$ ${e0.valor_principal ?? "—"}`);
                fill("loan_parcelas", e0.parcelas_info || `${e0.parcelas_pagas ?? 0}/${e0.quantidade_parcelas ?? 0}`);
                fill("loan_venc", e0.proximo_vencimento || "—");
        
                if (loanBox) loanBox.style.display = "";
                if (noLoan) noLoan.style.display = "none";
              } else {
                if (loanBox) loanBox.style.display = "none";
                if (noLoan) {
                  noLoan.style.display = "";
                  noLoan.textContent = "Este cliente não possui empréstimo ativo.";
                }
              }
            } catch (err2) {
              console.error(err2);
              if (loanBox) loanBox.style.display = "none";
              if (noLoan) {
                noLoan.style.display = "";
                noLoan.textContent = "Não foi possível carregar os empréstimos deste cliente.";
              }
            }
            */

            // abre modal
            Modal.open("modalDetalhesCliente");
            return;
          } catch (err) {
            console.error(err);
            onError("Erro de rede ao buscar cliente");
            return;
          }
        }

        // -------------------------
        // DETALHES EMPRÉSTIMO
        // -------------------------
        if (key === "detalhesEmprestimo") {
          const modal = document.getElementById("modalDetalhesEmprestimo");
          if (!modal) return;

          const set = (field, value) => {
            const el = modal.querySelector(`[data-loan="${field}"]`);
            if (el) el.textContent = value || "—";
          };

          // dados do botão (data-*)
          set("cliente_nome", openEl.dataset.clienteNome);
          set("cliente_tel", openEl.dataset.clienteTelefone);

          set("valor", openEl.dataset.valor);
          set("total_juros", openEl.dataset.totalJuros);

          set("parcelas", openEl.dataset.parcelas);
          set("tipo_venc", openEl.dataset.tipoVenc);

          // status + criado
          const status = openEl.dataset.status || "Ativo";
          const statusEl = modal.querySelector(`[data-loan="status"]`);
          if (statusEl) {
            statusEl.textContent = status;

            // cores do badge
            statusEl.classList.remove(
              "badge--info",
              "badge--success",
              "badge--danger",
            );
            if (status.toLowerCase() === "quitado")
              statusEl.classList.add("badge--success");
            else if (status.toLowerCase() === "atrasado")
              statusEl.classList.add("badge--danger");
            else statusEl.classList.add("badge--info");
          }

          set("criado_em", openEl.dataset.criadoEm);
          const jurosLabel = modal.querySelector(`[data-loan="juros_label"]`);
          if (jurosLabel)
            jurosLabel.textContent = `Total com juros (${openEl.dataset.juros || "0"}%)`;

          // Parcelas (lista)
          const list = modal.querySelector("#installmentsList");
          if (list) {
            list.innerHTML = `<div class="installment-row">
              <div class="inst-left">
                <span class="inst-dot inst-dot--ok"></span>
                <span class="inst-title">Parcela 1</span>
              </div>
              <div class="inst-right">
                <span>10/02/2026</span>
                <span class="inst-value">R$ 550,00</span>
              </div>
            </div>
            <div class="installment-row">
              <div class="inst-left">
                <span class="inst-dot inst-dot--ok"></span>
                <span class="inst-title">Parcela 2</span>
              </div>
              <div class="inst-right">
                <span>10/03/2026</span>
                <span class="inst-value">R$ 550,00</span>
              </div>
            </div>
            <div class="installment-row">
              <div class="inst-left">
                <span class="inst-dot inst-dot--ok"></span>
                <span class="inst-title">Parcela 3</span>
              </div>
              <div class="inst-right">
                <span>10/04/2026</span>
                <span class="inst-value">R$ 550,00</span>
              </div>
            </div>
            <div class="installment-row">
              <div class="inst-left">
                <span class="inst-dot"></span>
                <span class="inst-title">Parcela 4</span>
              </div>
              <div class="inst-right">
                <span>10/05/2026</span>
                <span class="inst-value">R$ 550,00</span>
              </div>
            </div>`;
          }

          // Histórico pagamentos (lista)
          const hist = modal.querySelector("#payHistoryList");
          if (hist) {
            hist.innerHTML = `
            <div class="pay-row">
              <div class="pay-left">
                <div class="pay-title">Parcela</div>
              </div>
              <div class="pay-right">
                <span>10/02/2026</span>
                <span class="pay-value">R$ 550,00</span>
              </div>
            </div>
            <div class="pay-row">
              <div class="pay-left">
                <div class="pay-title">Parcela</div>
                <div class="pay-sub">Pagamento em dia</div>
              </div>
              <div class="pay-right">
                <span>10/01/2026</span>
                <span class="pay-value">R$ 550,00</span>
              </div>
            </div>`;
          }

          Modal.open("modalDetalhesEmprestimo");
          return;
        }

        // -------------------------
        // LANÇAR PAGAMENTO
        // -------------------------
        if (key === "lancarPagamento") {
          const modal = document.getElementById("modalLancarPagamento");
          if (!modal) return;

          const setPay = (field, value) => {
            const el = modal.querySelector(`[data-pay="${field}"]`);
            if (!el) return;

            if (
              el.tagName === "INPUT" ||
              el.tagName === "TEXTAREA" ||
              el.tagName === "SELECT"
            ) {
              el.value = value ?? "";
            } else {
              el.textContent = value ?? "—";
            }
          };

          setPay("cliente_nome", openEl.dataset.clienteNome || "—");
          setPay("emprestimo_info", openEl.dataset.emprestimoInfo || "—");

          setPay("emprestimo_id", openEl.dataset.emprestimoId || "");

          if (openEl.dataset.tipoPadrao)
            setPay("tipo_pagamento", openEl.dataset.tipoPadrao);
          if (openEl.dataset.valorPadrao)
            setPay("valor_pago", openEl.dataset.valorPadrao);
          if (openEl.dataset.dataPadrao)
            setPay("data_pagamento", openEl.dataset.dataPadrao);

          

          Modal.open("modalLancarPagamento");
          return;
        }

        // -------------------------
        // NOVO EMPRÉSTIMO (cliente pré-selecionado e com nome)
        // -------------------------
        if (key === "novoEmprestimo") {
          const modal = document.getElementById("modalNovoEmprestimo");
          if (!modal) return;

          const selectCliente = modal.querySelector(
            'select[name="cliente_id"]',
          );
          if (!selectCliente) return;

          const clienteId = openEl.dataset.clienteId || "";
          const clienteNome = openEl.dataset.clienteNome || "";

          if (clienteId) {
            // 1) garante que exista a option do cliente com o nome certo
            let opt = selectCliente.querySelector(
              `option[value="${clienteId}"]`,
            );
            if (!opt) {
              opt = document.createElement("option");
              opt.value = clienteId;
              opt.textContent = clienteNome || `Cliente #${clienteId}`;
              selectCliente.appendChild(opt);
            } else {
              if (clienteNome) opt.textContent = clienteNome;
            }

            // 2) seleciona
            selectCliente.value = clienteId;

            // 3) trava (sem disabled)
            selectCliente.disabled = false;
            selectCliente.dataset.locked = "1";
          } else {
            // ABRINDO DO ZERO (tela empréstimos / botão rápido)

            // 1) destrava
            selectCliente.disabled = false;
            selectCliente.removeAttribute("data-locked");

            // 2) limpa opções antigas (deixa só "Selecione o cliente")
            const first = selectCliente.querySelector('option[value=""]');
            selectCliente.innerHTML = "";
            if (first) selectCliente.appendChild(first);
            else {
              const opt0 = document.createElement("option");
              opt0.value = "";
              opt0.textContent = "Selecione o cliente";
              selectCliente.appendChild(opt0);
            }
            selectCliente.value = "";

            // 3) carrega clientes do backend pra preencher o select
            try {
              const res = await fetch(
                `/KRAx/public/api.php?route=clientes/listar`,
              );
              const json = await res.json();

              if (json.ok) {
                (json.dados || []).forEach((c) => {
                  const opt = document.createElement("option");
                  opt.value = c.id;
                  opt.textContent = c.nome;
                  selectCliente.appendChild(opt);
                });
              } else {
                alert(json.mensagem || "Erro ao carregar clientes");
              }
            } catch (err) {
              console.error(err);
              alert("Erro de rede ao carregar clientes");
            }
          }

          // Data padrão: hoje
          const inputData = modal.querySelector(
            'input[name="data_emprestimo"]',
          );
          if (inputData && !inputData.value) {
            inputData.value = new Date().toISOString().slice(0, 10);
          }

          Modal.open("modalNovoEmprestimo");
          return;
        }

        // fallback: abre via map
        Modal.open(map[key] || key);
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") Modal.closeAll();
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    injectOverlay();

    injectModalNovoCliente();
    injectModalDetalhesCliente();
    injectModalDetalhesEmprestimo();
    injectModalLancamentoPagamento();
    injectModalNovoEmprestimo();
    injectModalEditarCliente();

    bindOpenClose();
  });
})();
