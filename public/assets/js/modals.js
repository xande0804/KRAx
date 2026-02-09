// assets/js/modals.js
(function () {
  function qs(sel, root = document) {
    return root.querySelector(sel);
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

        <form class="modal__body" id="formNovoCliente" action="#" method="post">
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

    // Front-only
    const form = qs("#formNovoCliente");
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      Modal.close("modalNovoCliente");
    });

    qs("#btnSalvarECriarEmprestimo").addEventListener("click", () => {
      Modal.close("modalNovoCliente");
      alert("Depois: abrir modal de Novo Empréstimo já vinculado ✅");
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
                <button class="btn" type="button">✏️ Editar</button>
                <button class="btn btn--danger" type="button">🗑️ Excluir</button>
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
              <button class="btn" type="button">➕ Novo empréstimo</button>
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

  function bindOpenClose() {
    document.addEventListener("click", (e) => {
      const open = e.target.closest("[data-modal-open]");
      const close = e.target.closest("[data-modal-close]");

      if (open) {
        const key = open.getAttribute("data-modal-open");
        const map = {
          novoCliente: "modalNovoCliente",
          detalhesCliente: "modalDetalhesCliente",
          detalhesEmprestimo: "modalDetalhesEmprestimo",
        };

        // preencher dados ANTES de abrir
        if (key === "detalhesCliente") {
          const modal = document.getElementById("modalDetalhesCliente");
          if (!modal) return;

          const fill = (field, value) => {
            const el = modal.querySelector(`[data-fill="${field}"]`);
            if (el) el.textContent = value || "—";
          };

          fill("nome", open.dataset.clienteNome);
          fill("telefone", open.dataset.clienteTelefone);
          fill("cpf", open.dataset.clienteCpf);
          fill("endereco", open.dataset.clienteEndereco);
          fill("profissao", open.dataset.clienteProfissao);
          fill("placa", open.dataset.clientePlaca);
          fill("indicacao", open.dataset.clienteIndicacao);

          const temEmprestimo = open.dataset.emprestimoAtivo === "1";
          const loanBox = modal.querySelector("#loanBox");
          const noLoan = modal.querySelector("#noLoan");

          if (temEmprestimo) {
            loanBox.style.display = "";
            noLoan.style.display = "none";
            fill("loan_status", "Ativo");
            fill("loan_valor", "R$ 5.000");
            fill("loan_parcelas", "3/10");
            fill("loan_venc", "10/05/2026");
          } else {
            loanBox.style.display = "none";
            noLoan.style.display = "";
          }
        }

          if (key === "detalhesEmprestimo") {
          const modal = document.getElementById("modalDetalhesEmprestimo");
          if (!modal) return;

          const set = (field, value) => {
            const el = modal.querySelector(`[data-loan="${field}"]`);
            if (el) el.textContent = value || "—";
          };

          // dados do botão (data-*)
          set("cliente_nome", open.dataset.clienteNome);
          set("cliente_tel", open.dataset.clienteTelefone);

          set("valor", open.dataset.valor);
          set("total_juros", open.dataset.totalJuros);

          set("parcelas", open.dataset.parcelas);
          set("tipo_venc", open.dataset.tipoVenc);

          // status + criado
          const status = open.dataset.status || "Ativo";
          const statusEl = modal.querySelector(`[data-loan="status"]`);
          if (statusEl) {
            statusEl.textContent = status;

            // cores do badge
            statusEl.classList.remove(
              "badge--info",
              "badge--success",
              "badge--danger"
            );
            if (status.toLowerCase() === "quitado")
              statusEl.classList.add("badge--success");
            else if (status.toLowerCase() === "atrasado")
              statusEl.classList.add("badge--danger");
            else statusEl.classList.add("badge--info");
          }

          set("criado_em", open.dataset.criadoEm);
          const jurosLabel = modal.querySelector(`[data-loan="juros_label"]`);
          if (jurosLabel)
            jurosLabel.textContent = `Total com juros (${open.dataset.juros || "0"}%)`;

          // Parcelas (lista)
          const list = modal.querySelector("#installmentsList");
          list.innerHTML =
     `<div class="installment-row">
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

          // Histórico pagamentos (lista)
          const hist = modal.querySelector("#payHistoryList");
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

        Modal.open(map[key] || key);
      }

      if (close) {
        Modal.close(close.getAttribute("data-modal-close"));
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") Modal.closeAll();
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
  injectOverlay();

  // Injeta modais SOMENTE se existirem gatilhos na página
  if (document.querySelector('[data-modal-open="novoCliente"]')) {
    injectModalNovoCliente();
  }

  if (document.querySelector('[data-modal-open="detalhesCliente"]')) {
    injectModalDetalhesCliente();
  }

  if (document.querySelector('[data-modal-open="detalhesEmprestimo"]')) {
    injectModalDetalhesEmprestimo();
  }

  bindOpenClose();
});

})(); // fecha o (function(){ ... })();
