// public/assets/js/modals/detalhesEmprestimo.modal.js
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

    function statusBadge(status) {
        const s = String(status || "").trim().toUpperCase();
        if (s === "QUITADO") return { text: "Quitado", cls: "badge--success" };
        if (s === "ATRASADO") return { text: "Atrasado", cls: "badge--danger" };
        return { text: "Ativo", cls: "badge--info" };
    }

    // ========= INJECT =========
    window.injectModalDetalhesEmprestimo = function injectModalDetalhesEmprestimo() {
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
                <p class="loan-head__sub" data-loan="cliente_tel">—</p>
              </div>
            </div>
  
            <div class="loan-kpis">
              <div class="kpi">
                <div class="kpi__label">Valor</div>
                <div class="kpi__value" data-loan="valor">—</div>
              </div>
  
              <div class="kpi">
                <div class="kpi__label" data-loan="juros_label">Total com juros</div>
                <div class="kpi__value" data-loan="total_juros">—</div>
              </div>
  
              <div class="kpi">
                <div class="kpi__label">Parcelas</div>
                <div class="kpi__value" data-loan="parcelas">—</div>
              </div>
  
              <div class="kpi">
                <div class="kpi__label">Vencimento</div>
                <div class="kpi__value" data-loan="tipo_venc">—</div>
              </div>
            </div>
  
            <div class="loan-status">
              Status:
              <span class="badge badge--info" data-loan="status">Ativo</span>
              <span>•</span>
              <span>Criado em <strong data-loan="criado_em">—</strong></span>
            </div>
  
            <div class="loan-actions-row">
              <button class="btn btn--primary" type="button" data-modal-open="lancarPagamento" id="btnPayFromLoan">
                💳 Lançar pagamento
              </button>
              <button class="btn btn--secondary" type="button" id="btnMarkQuitado" disabled title="a gente implementa depois">
                Marcar como quitado
              </button>
            </div>
  
            <div class="hr"></div>
  
            <div class="modal-section">
              <h4 class="modal-section__title">Parcelas</h4>
              <div class="installments">
                <div class="installments__scroll" id="installmentsList"></div>
              </div>
            </div>
  
            <div class="modal-section">
              <h4 class="modal-section__title">Histórico de pagamentos</h4>
              <div class="pay-history" id="payHistoryList"></div>
            </div>
  
          </div>
        </div>
      `;

        document.body.appendChild(modal);
    };

    // ========= OPEN =========
    window.openDetalhesEmprestimo = async function openDetalhesEmprestimo(emprestimoId) {
        const modal = document.getElementById("modalDetalhesEmprestimo");
        if (!modal) return;

        const id = String(emprestimoId || "");
        if (!id) return;

        const set = (field, value) => {
            const el = modal.querySelector(`[data-loan="${field}"]`);
            if (el) el.textContent = value ?? "—";
        };

        // loading
        set("cliente_nome", "Carregando...");
        set("cliente_tel", "—");
        set("valor", "—");
        set("total_juros", "—");
        set("parcelas", "—");
        set("tipo_venc", "—");
        set("status", "—");
        set("criado_em", "—");

        const installments = modal.querySelector("#installmentsList");
        const payHist = modal.querySelector("#payHistoryList");
        if (installments) installments.innerHTML = `<div class="muted" style="padding:10px;">Carregando parcelas...</div>`;
        if (payHist) payHist.innerHTML = `<div class="muted" style="padding:10px;">Carregando pagamentos...</div>`;

        try {
            const res = await fetch(
                `/KRAx/public/api.php?route=emprestimos/detalhes&id=${encodeURIComponent(id)}`
            );
            const json = await res.json();

            if (!json.ok) {
                onError(json.mensagem || "Erro ao buscar empréstimo");
                return;
            }

            const dados = json.dados || {};
            const emp = dados.emprestimo || {};
            const cli = dados.cliente || {};
            const parcelas = Array.isArray(dados.parcelas) ? dados.parcelas : [];
            const pagamentos = Array.isArray(dados.pagamentos) ? dados.pagamentos : [];

            set("cliente_nome", cli.nome || "—");
            set("cliente_tel", cli.telefone || "—");

            const principal = Number(emp.valor_principal ?? 0);
            const jurosPct = Number(emp.porcentagem_juros ?? 0);
            const totalComJuros = principal * (1 + jurosPct / 100);

            set("valor", money(principal));
            set("juros_label", `Total com juros (${jurosPct || 0}%)`);
            set("total_juros", money(totalComJuros));

            const totalParcelas = Number(emp.quantidade_parcelas ?? parcelas.length ?? 0);
            const pagas = parcelas.filter((p) => {
                const st = String(p.status || p.parcela_status || "").trim().toUpperCase();
                const valorPago = Number(p.valor_pago ?? p.valorPago ?? 0);
                return st === "PAGA" || st === "QUITADA" || valorPago > 0;
            }).length;

            set("parcelas", `${pagas} / ${totalParcelas || 0}`);

            const tipoV = String(emp.tipo_vencimento || "").trim().toUpperCase();
            const tipoTxt = tipoV === "DIARIO" ? "Diário" : tipoV === "SEMANAL" ? "Semanal" : "Mensal";
            set("tipo_venc", tipoTxt);

            const st = statusBadge(emp.status);
            const statusEl = modal.querySelector(`[data-loan="status"]`);
            if (statusEl) {
                statusEl.textContent = st.text;
                statusEl.classList.remove("badge--info", "badge--success", "badge--danger");
                statusEl.classList.add(st.cls);
            }

            set("criado_em", formatDateBR(emp.data_emprestimo || emp.criado_em || emp.created_at));

            // botão "Lançar pagamento" dentro do detalhes
            const btnPay = modal.querySelector("#btnPayFromLoan");
            if (btnPay) {
                btnPay.dataset.emprestimoId = id;
                btnPay.dataset.clienteNome = cli.nome || "";
                btnPay.dataset.emprestimoInfo = `${money(principal)} - ${pagas}/${totalParcelas} parcelas`;
                btnPay.dataset.tipoPadrao = "PARCELA";
            }

            // Parcelas
            if (installments) {
                if (!parcelas.length) {
                    installments.innerHTML = `<div class="muted" style="padding:10px;">Nenhuma parcela encontrada.</div>`;
                } else {
                    installments.innerHTML = parcelas
                        .map((p) => {
                            const num = p.numero_parcela ?? p.numeroParcela ?? p.num ?? "—";
                            const venc = formatDateBR(p.data_vencimento ?? p.dataVencimento);
                            const val = money(p.valor_parcela ?? p.valorParcela);

                            const stp = String(p.status || p.parcela_status || "").trim().toUpperCase();
                            const valorPago = Number(p.valor_pago ?? 0);

                            const isPaga = stp === "PAGA" || stp === "QUITADA" || valorPago > 0;
                            const isAtrasada = stp === "ATRASADO";

                            const dotCls = isPaga ? "inst-dot--ok" : isAtrasada ? "inst-dot--danger" : "";

                            return `
                  <div class="installment-row">
                    <div class="inst-left">
                      <span class="inst-dot ${dotCls}"></span>
                      <span class="inst-title">Parcela ${esc(num)}</span>
                    </div>
                    <div class="inst-right">
                      <span>${esc(venc)}</span>
                      <span class="inst-value">${esc(val)}</span>
                    </div>
                  </div>
                `;
                        })
                        .join("");
                }
            }

            // Pagamentos
            if (payHist) {
                if (!pagamentos.length) {
                    payHist.innerHTML = `<div class="muted" style="padding:10px;">Nenhum pagamento registrado.</div>`;
                } else {
                    payHist.innerHTML = pagamentos
                        .map((pg) => {
                            const tipo = String(pg.tipo_pagamento || pg.tipo || "Pagamento");
                            const data = formatDateBR(pg.data_pagamento || pg.data);
                            const val = money(pg.valor_pago || pg.valor);
                            const obs = String(pg.observacao || "").trim();

                            return `
                  <div class="pay-row">
                    <div class="pay-left">
                      <div class="pay-title">${esc(tipo)}</div>
                      ${obs ? `<div class="pay-sub">${esc(obs)}</div>` : ``}
                    </div>
                    <div class="pay-right">
                      <span>${esc(data)}</span>
                      <span class="pay-value">${esc(val)}</span>
                    </div>
                  </div>
                `;
                        })
                        .join("");
                }
            }

            GestorModal.open("modalDetalhesEmprestimo");
        } catch (err) {
            console.error(err);
            onError("Erro de rede ao buscar detalhes do empréstimo.");
        }
    };
})();