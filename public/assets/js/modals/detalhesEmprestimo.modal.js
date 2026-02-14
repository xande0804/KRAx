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

  function toNumber(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  // ✅ trabalhar em centavos (inteiros) pra não sobrar 0,01 por float
  function toCents(v) {
    const n = toNumber(v);
    return Math.round(n * 100);
  }

  function moneyFromCents(cents) {
    const n = (Number(cents) || 0) / 100;
    return money(n);
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

  // ✅ define quais tipos amortizam (reduzem a dívida principal/total)
  function tipoAmortiza(tipoRaw) {
    const t = String(tipoRaw || "").trim().toUpperCase();
    if (t === "JUROS") return false;
    if (t === "PARCELA") return true;
    if (t === "INTEGRAL" || t === "QUITACAO") return true;
    if (t === "EXTRA") return true;
    return false;
  }

  function todayISO() {
    return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  }

  function onlyDate(yyyyMMdd) {
    return String(yyyyMMdd || "").slice(0, 10);
  }

  // comparação segura (YYYY-MM-DD)
  function isBeforeISO(a, b) {
    const aa = onlyDate(a);
    const bb = onlyDate(b);
    if (!aa || !bb) return false;
    return aa < bb;
  }

  // ✅ ajuda: determina situação real da parcela olhando valor_pago x valor_parcela + vencimento
  function calcSituacaoParcela(p, isQuitado, hojeStr) {
    const stp = String(p.status || p.parcela_status || "").trim().toUpperCase();
    const valorParcela = toNumber(p.valor_parcela ?? p.valorParcela ?? 0);
    const valorPago = toNumber(p.valor_pago ?? p.valorPago ?? 0);

    // tolerância 1 centavo
    const vparC = toCents(valorParcela);
    const vpC = toCents(valorPago);

    const isPagaReal = isQuitado
      ? true
      : (stp === "PAGA" || stp === "QUITADA" || (vparC > 0 && vpC >= vparC));

    const isParcial = !isQuitado && !isPagaReal && vpC > 0 && vparC > 0 && vpC < vparC;

    const vencISO = onlyDate(p.data_vencimento ?? p.dataVencimento);
    const vencidaPorData = !isQuitado && vencISO && isBeforeISO(vencISO, hojeStr);

    // ✅ ATRASADA (real): vencida por data E ainda não paga
    const isAtrasadaReal = vencidaPorData && !isPagaReal;

    // ✅ PAGA ATRASADA: paga, mas vencimento já passou (pagou depois do venc.)
    const isPagaAtrasada = isPagaReal && vencidaPorData;

    const restanteC = Math.max(0, vparC - vpC);

    return {
      stp,
      valorParcela,
      valorPago,
      isPagaReal,
      isParcial,
      isAtrasadaReal,
      isPagaAtrasada,
      vencISO,
      restanteC
    };
  }

  // ========= INJECT DETALHES =========
  window.injectModalDetalhesEmprestimo = function injectModalDetalhesEmprestimo() {
    if (qs("#modalDetalhesEmprestimo")) return;

    // ✅ garante que o modal de edição exista (se o arquivo separado já estiver carregado)
    if (typeof window.injectModalEditarEmprestimo === "function") {
      window.injectModalEditarEmprestimo();
    }

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
              <div class="kpi__label">Valor do empréstimo</div>
              <div class="kpi__value" data-loan="valor">—</div>
              <div class="kpi__hint" data-loan="prestacao_hint">Prestação: —</div>
            </div>

            <div class="kpi">
              <div class="kpi__label" data-loan="juros_label">Total com juros</div>
              <div class="kpi__value" data-loan="total_juros">—</div>
              <div class="kpi__hint" data-loan="saldo_hint">Pago: — • Falta: —</div>
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

            <button class="btn btn--secondary" type="button" id="btnEditLoan">
              ✏️ Editar empréstimo
            </button>

            <button class="btn btn--secondary" type="button" id="btnMarkQuitado">
              Marcar como quitado
            </button>
          </div>

          <div class="hr"></div>

          <div class="modal-section">
            <h4 class="modal-section__title">Prestações</h4>
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
  window.openDetalhesEmprestimo = async function openDetalhesEmprestimo(emprestimoId, ctx) {
    const modal = document.getElementById("modalDetalhesEmprestimo");
    if (!modal) return;

    const id = String(emprestimoId || "");
    if (!id) return;

    modal.dataset.emprestimoId = id;

    const origem = (ctx && ctx.origem) ? String(ctx.origem) : "emprestimos";
    const clienteIdCtx = (ctx && ctx.clienteId) ? String(ctx.clienteId) : "";
    modal.dataset.origem = origem;
    modal.dataset.clienteId = clienteIdCtx;

    const set = (field, value) => {
      const el = modal.querySelector(`[data-loan="${field}"]`);
      if (el) el.textContent = value ?? "—";
    };

    // loading
    set("cliente_nome", "Carregando...");
    set("cliente_tel", "—");
    set("valor", "—");
    set("prestacao_hint", "Prestação: —");
    set("juros_label", "Total com juros");
    set("total_juros", "—");
    set("saldo_hint", "Pago: — • Falta: —");
    set("parcelas", "—");
    set("tipo_venc", "—");
    set("status", "—");
    set("criado_em", "—");

    const installments = modal.querySelector("#installmentsList");
    const payHist = modal.querySelector("#payHistoryList");
    if (installments) installments.innerHTML = `<div class="muted" style="padding:10px;">Carregando prestações...</div>`;
    if (payHist) payHist.innerHTML = `<div class="muted" style="padding:10px;">Carregando pagamentos...</div>`;

    try {
      const res = await fetch(`/KRAx/public/api.php?route=emprestimos/detalhes&id=${encodeURIComponent(id)}`);
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

      const hojeStr = todayISO();

      set("cliente_nome", cli.nome || "—");
      set("cliente_tel", cli.telefone || "—");

      const principal = toNumber(emp.valor_principal ?? 0);
      const principalC = toCents(principal);

      const jurosPct = toNumber(emp.porcentagem_juros ?? 0);
      const totalParcelas = Number(emp.quantidade_parcelas ?? parcelas.length ?? 0) || 1;

      const tipoV = String(emp.tipo_vencimento || "").trim().toUpperCase();
      const tipoTxt = tipoV === "DIARIO" ? "Diário" : tipoV === "SEMANAL" ? "Semanal" : "Mensal";
      set("tipo_venc", tipoTxt);

      // ✅ calcular total/parcelas em centavos (inteiro)
      let valorPrestacaoC = 0;
      let totalComJurosC = 0;

      if (tipoV === "MENSAL") {
        const jurosInteiro = principal * (jurosPct / 100);
        const totalComJuros = principal + (jurosInteiro * totalParcelas);
        totalComJurosC = toCents(totalComJuros);

        const prestacao = (principal / totalParcelas) + jurosInteiro;
        valorPrestacaoC = toCents(prestacao);
      } else {
        const totalComJuros = principal * (1 + jurosPct / 100);
        totalComJurosC = toCents(totalComJuros);
        valorPrestacaoC = Math.round(totalComJurosC / totalParcelas);
      }

      // ✅ somas em centavos
      const totalPagoTudoC = pagamentos.reduce((acc, pg) => {
        const v = toNumber(pg.valor_pago ?? pg.valor ?? 0);
        return acc + toCents(v);
      }, 0);

      const totalPagoAmortizaC = pagamentos.reduce((acc, pg) => {
        const tipoPg = pg.tipo_pagamento || pg.tipo;
        if (!tipoAmortiza(tipoPg)) return acc;
        const v = toNumber(pg.valor_pago ?? pg.valor ?? 0);
        return acc + toCents(v);
      }, 0);

      // saldo em centavos
      let saldoC = totalComJurosC - totalPagoAmortizaC;
      if (saldoC < 0) saldoC = 0;

      const statusAtual = String(emp.status || "").trim().toUpperCase();
      const isQuitado = statusAtual === "QUITADO";

      // ✅ regra: se está QUITADO, não mostra 0,01 — mostra 0,00
      if (isQuitado || saldoC <= 1) {
        saldoC = 0;
      }

      set("valor", moneyFromCents(principalC));

      set("prestacao_hint", `Prestação: ${moneyFromCents(valorPrestacaoC)}`);

      set("juros_label", `Total com juros (${jurosPct || 0}%)`);
      set("total_juros", moneyFromCents(totalComJurosC));
      set("saldo_hint", `Pago: ${moneyFromCents(totalPagoTudoC)} • Falta: ${moneyFromCents(saldoC)}`);

      // ✅ CONTAGEM DE PARCELAS:
      let pagas = 0;
      if (isQuitado) {
        pagas = totalParcelas;
      } else {
        pagas = parcelas.filter((p) => calcSituacaoParcela(p, false, hojeStr).isPagaReal).length;
      }
      set("parcelas", `${pagas} / ${totalParcelas || 0}`);

      const st = statusBadge(emp.status);
      const statusEl = modal.querySelector(`[data-loan="status"]`);
      if (statusEl) {
        statusEl.textContent = st.text;
        statusEl.classList.remove("badge--info", "badge--success", "badge--danger");
        statusEl.classList.add(st.cls);
      }

      set("criado_em", formatDateBR(emp.data_emprestimo || emp.criado_em || emp.created_at));

      const btnPay = modal.querySelector("#btnPayFromLoan");
      const btnQuit = modal.querySelector("#btnMarkQuitado");
      const btnEdit = modal.querySelector("#btnEditLoan");

      // regra de visibilidade
      if (isQuitado) {
        if (btnPay) btnPay.style.display = "none";
        if (btnQuit) btnQuit.style.display = "none";
        if (btnEdit) btnEdit.style.display = "none";
      } else {
        if (btnPay) btnPay.style.display = "";
        if (btnQuit) btnQuit.style.display = "";
        if (btnEdit) btnEdit.style.display = "";
      }

      if (btnPay) {
        btnPay.dataset.emprestimoId = id;
        btnPay.dataset.clienteNome = cli.nome || "";
        btnPay.dataset.emprestimoInfo = `${moneyFromCents(principalC)} - ${pagas}/${totalParcelas} parcelas`;
        btnPay.dataset.tipoPadrao = "PARCELA";

        btnPay.dataset.origem = modal.dataset.origem || "emprestimos";
        btnPay.dataset.clienteId = modal.dataset.clienteId || String(emp.cliente_id || "");

        btnPay.dataset.returnTo = "detalhesEmprestimo";
        btnPay.dataset.returnEmprestimoId = id;
        btnPay.dataset.returnClienteId = btnPay.dataset.clienteId || "";
      }

      // ✅ chama o modal separado (se existir)
      if (btnEdit) {
        btnEdit.onclick = () => {
          if (typeof window.openEditarEmprestimo !== "function") {
            onError("Modal de edição não carregado. Verifique se editarEmprestimo.modal.js está incluído.");
            return;
          }

          window.openEditarEmprestimo({
            emprestimoId: id,
            clienteId: String(emp.cliente_id || modal.dataset.clienteId || ""),
            clienteNome: String(cli.nome || ""),
            jurosPct: jurosPct,
            quantidadeParcelas: totalParcelas,
            tipoVencimento: tipoV,
            origem: modal.dataset.origem || "emprestimos",
          });
        };
      }

      if (btnQuit) {
        btnQuit.disabled = isQuitado;

        btnQuit.onclick = async () => {
          if (btnQuit.disabled) return;

          const ok = confirm("Confirmar quitação total deste empréstimo?");
          if (!ok) return;

          btnQuit.disabled = true;

          try {
            const fd = new FormData();
            fd.append("emprestimo_id", id);
            fd.append("tipo_pagamento", "QUITACAO");
            fd.append("valor_pago", "1");
            fd.append("observacao", "Quitação (parcelas restantes + 1 juros)");

            const r = await fetch("/KRAx/public/api.php?route=pagamentos/lancar", {
              method: "POST",
              body: fd,
            });
            const j = await r.json();

            if (!j.ok) {
              btnQuit.disabled = false;
              onError(j.mensagem || "Erro ao quitar empréstimo");
              return;
            }

            GestorModal.close("modalDetalhesEmprestimo");

            const origemSalva = modal.dataset.origem || "emprestimos";
            const clienteIdSalvo = modal.dataset.clienteId || "";

            if (origemSalva === "cliente" && clienteIdSalvo && typeof window.openDetalhesCliente === "function") {
              window.openDetalhesCliente(clienteIdSalvo);
              if (typeof window.refreshClientesList === "function") window.refreshClientesList();
            } else {
              if (typeof window.refreshEmprestimosList === "function") window.refreshEmprestimosList();
              if (typeof window.refreshClientesList === "function") window.refreshClientesList();
            }
          } catch (e) {
            console.error(e);
            btnQuit.disabled = false;
            onError("Erro de rede ao quitar empréstimo.");
          }
        };
      }

      // ✅ LISTA DE PRESTAÇÕES (com atraso em vermelho / paga atrasada em verde água)
      if (installments) {
        if (!parcelas.length) {
          installments.innerHTML = `<div class="muted" style="padding:10px;">Nenhuma prestação encontrada.</div>`;
        } else {
          installments.innerHTML = parcelas
            .map((p) => {
              const num = p.numero_parcela ?? p.numeroParcela ?? p.num ?? "—";
              const vencISO = onlyDate(p.data_vencimento ?? p.dataVencimento);
              const vencBR = formatDateBR(vencISO);

              const s = calcSituacaoParcela(p, isQuitado, hojeStr);

              // ✅ valor exibido:
              let valTxt = "—";
              if (s.isParcial) {
                valTxt = moneyFromCents(s.restanteC);
              } else {
                const valorParcela = toNumber(p.valor_parcela ?? p.valorParcela ?? 0);
                valTxt = valorParcela > 0 ? money(valorParcela) : moneyFromCents(valorPrestacaoC);
              }

              // bolinha de status
              const dotCls = s.isPagaReal
                ? (s.isPagaAtrasada ? "inst-dot--ok" : "inst-dot--ok")
                : s.isParcial
                  ? "inst-dot--warn"
                  : s.isAtrasadaReal
                    ? "inst-dot--danger"
                    : "";

              // ✅ badge de status (o que você pediu)
              let badge = "";
              if (isQuitado) {
                badge = `<span class="badge badge--success" style="margin-left:10px;">Paga</span>`;
              } else if (s.isAtrasadaReal) {
                badge = `<span class="badge badge--danger" style="margin-left:10px;">Atrasada</span>`;
              } else if (s.isPagaReal && s.isPagaAtrasada) {
                // verde água / mais escuro (inline pra não depender de CSS)
                badge = `<span class="badge badge--success" style="margin-left:10px; background:#0f766e; border-color:#0f766e; color:#fff;">Paga (atrasada)</span>`;
              } else if (s.isPagaReal) {
                badge = `<span class="badge badge--success" style="margin-left:10px;">Paga</span>`;
              } else if (s.isParcial) {
                badge = `<span class="badge badge--info" style="margin-left:10px;">Parcial</span>`;
              }

              // linha extra no parcial
              const subLinha = (!isQuitado && s.isParcial)
                ? `<span class="muted" style="margin-left:10px;">Restante após adiantamento</span>`
                : ``;

              // ✅ se atrasada, pinta a linha (leve) e data em vermelho
              const rowStyle = s.isAtrasadaReal
                ? `style="border-left:4px solid #ef4444; padding-left:10px;"`
                : ``;

              const vencStyle = s.isAtrasadaReal
                ? `style="color:#ef4444; font-weight:600;"`
                : ``;

              return `
                <div class="installment-row" ${rowStyle}>
                  <div class="inst-left">
                    <span class="inst-dot ${dotCls}"></span>
                    <span class="inst-title">Prestação ${esc(num)}</span>
                    ${badge}
                    ${subLinha}
                  </div>

                  <div class="inst-right">
                    <span ${vencStyle}>${esc(vencBR)}</span>
                    <span class="inst-value">${esc(valTxt)}</span>
                  </div>
                </div>
              `;
            })
            .join("");
        }
      }

      if (payHist) {
        if (!pagamentos.length) {
          payHist.innerHTML = `<div class="muted" style="padding:10px;">Nenhum pagamento registrado.</div>`;
        } else {
          payHist.innerHTML = pagamentos
            .map((pg) => {
              const tipoRaw = String(pg.tipo_pagamento || pg.tipo || "Pagamento").trim().toUpperCase();

              let title =
                tipoRaw === "PARCELA" ? "Prestação" :
                  tipoRaw === "JUROS" ? "Juros" :
                    tipoRaw === "INTEGRAL" ? "Pagamento integral" :
                      tipoRaw === "EXTRA" ? "Crédito/extra" :
                        tipoRaw;

              let sub = String(pg.observacao || "").trim();

              if (tipoRaw === "QUITACAO") {
                title = "PAGAMENTO";
                sub = "Quitação (parcelas restantes + 1 juros)";
              }

              const data = formatDateBR(pg.data_pagamento || pg.data);
              const val = money(pg.valor_pago || pg.valor);

              return `
                <div class="pay-row">
                  <div class="pay-left">
                    <div class="pay-title">${esc(title)}</div>
                    ${sub ? `<div class="pay-sub">${esc(sub)}</div>` : ``}
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
