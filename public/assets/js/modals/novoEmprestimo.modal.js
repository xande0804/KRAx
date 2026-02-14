// public/assets/js/modals/novoEmprestimo.modal.js
(function () {
  const qs = window.qs;
  const onError = window.onError || function () { };
  const toast = window.toast || function () { };
  const GestorModal = window.GestorModal;

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  // =========================
  // Autocomplete state/cache
  // =========================
  let clientesCache = null; // [{id:"", nome:""}, ...]
  let acActiveIndex = -1;

  function escHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function normalizeTxt(s) {
    return String(s ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // remove acentos
      .toLowerCase()
      .trim();
  }

  // ✅ Highlight 100% correto ignorando acentos:
  // cria uma string normalizada + um mapa de posições (cada char normalizado aponta pro índice no original)
  function buildNormalizedMap(original) {
    const src = String(original ?? "");
    let norm = "";
    const map = []; // map[normIndex] = originalIndex

    for (let i = 0; i < src.length; i++) {
      const ch = src[i];
      // NFD separa diacríticos; removemos diacríticos; pode virar 0..N chars
      const base = ch.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      for (let k = 0; k < base.length; k++) {
        norm += base[k].toLowerCase();
        map.push(i);
      }
    }
    return { norm, map, src };
  }

  function highlightMatchAccentsSafe(nome, query) {
    const raw = String(nome ?? "");
    const q = normalizeTxt(query);
    if (!q) return escHtml(raw);

    const { norm, map, src } = buildNormalizedMap(raw);
    const idx = norm.indexOf(q);
    if (idx < 0) return escHtml(raw);

    const startOrig = map[idx];
    const endOrig = map[idx + q.length - 1] + 1; // +1 pra cortar corretamente

    const a = src.slice(0, startOrig);
    const b = src.slice(startOrig, endOrig);
    const c = src.slice(endOrig);

    return `${escHtml(a)}<strong>${escHtml(b)}</strong>${escHtml(c)}`;
  }

  async function loadClientesCache() {
    if (Array.isArray(clientesCache)) return clientesCache;

    try {
      const res = await fetch(`/KRAx/public/api.php?route=clientes/listar`);
      const json = await res.json();

      if (!json.ok) throw new Error(json.mensagem || "Erro ao carregar clientes");

      const lista = Array.isArray(json.dados) ? json.dados : [];
      clientesCache = lista
        .map((c) => ({ id: String(c.id), nome: String(c.nome || "") }))
        .filter((c) => c.id && c.nome);

      // ordenação alfabética pt-BR (ignorando acentos)
      clientesCache.sort((a, b) =>
        a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" })
      );

      return clientesCache;
    } catch (err) {
      console.error(err);
      onError("Erro de rede ao carregar clientes");
      clientesCache = [];
      return clientesCache;
    }
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

            <!-- ✅ CLIENTE (Autocomplete) -->
            <div class="field form-span-2" style="position:relative;">
              <label>Cliente</label>

              <input type="hidden" name="cliente_id" required id="clienteIdHidden" />

              <div style="position:relative;">
                <input
                  type="text"
                  id="clienteSearchInput"
                  autocomplete="off"
                  placeholder="Digite para buscar (ex: AL)..."
                />
                <button
                  type="button"
                  id="clienteClearBtn"
                  title="Trocar cliente"
                  aria-label="Trocar cliente"
                  style="display:none;"
                >×</button>
              </div>

              <div class="acbox" id="clienteSuggestBox" hidden></div>

              <div class="muted" style="margin-top:6px;">
                Digite para buscar.
              </div>
            </div>

            <div class="field form-span-2">
              <label>Data do empréstimo</label>
              <input type="date" name="data_emprestimo" required />
            </div>

            <div class="field">
              <label>Valor (R$)</label>
              <input name="valor_principal" inputmode="decimal" placeholder="0,00" required />
            </div>

            <div class="field">
              <label>Parcelas</label>
              <input type="number" min="1" name="quantidade_parcelas" value="20" required />
            </div>

            <div class="field">
              <label>Juros (%)</label>
              <input type="number" min="0" step="0.01" name="porcentagem_juros" value="30" required />
            </div>

            <div class="field form-span-2">
              <label>Tipo de vencimento</label>
              <select name="tipo_vencimento" required id="tipoVencimentoNovoEmprestimo">
                <option value="DIARIO">Diário</option>
                <option value="SEMANAL">Semanal</option>
                <option value="MENSAL">Mensal</option>
              </select>
            </div>

            <!-- ✅ Dinâmico: semanal (1..6) / diário-mensal (date) -->
            <div class="field form-span-2" id="wrapRegraVencimento">
              <label id="labelRegraVencimento">Primeiro vencimento</label>
              <input type="date" name="regra_vencimento" required id="regraVencimentoInput" />
              <div class="muted" style="margin-top:6px;" id="hintRegraVencimento"></div>
            </div>

          </div>

          <footer class="modal__footer modal__footer--end">
            <button class="btn" type="button" data-modal-close="modalNovoEmprestimo">Cancelar</button>
            <button class="btn btn--primary" type="submit" id="btnSubmitNovoEmprestimo">Salvar empréstimo</button>
          </footer>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    // =========================
    // CSS mínimo pro "X" (inline safe)
    // (o restante do autocomplete vai no CSS global que te passei)
    // =========================
    const clearBtn = modal.querySelector("#clienteClearBtn");
    if (clearBtn) {
      clearBtn.style.position = "absolute";
      clearBtn.style.right = "10px";
      clearBtn.style.top = "50%";
      clearBtn.style.transform = "translateY(-50%)";
      clearBtn.style.width = "28px";
      clearBtn.style.height = "28px";
      clearBtn.style.borderRadius = "999px";
      clearBtn.style.border = "1px solid #e6e8ef";
      clearBtn.style.background = "#fff";
      clearBtn.style.cursor = "pointer";
      clearBtn.style.lineHeight = "26px";
      clearBtn.style.fontSize = "18px";
      clearBtn.style.padding = "0";
    }

    // =========================
    // Elements
    // =========================
    const form = qs("#formNovoEmprestimo");
    const btnSubmit = qs("#btnSubmitNovoEmprestimo");

    const tipoSel = modal.querySelector("#tipoVencimentoNovoEmprestimo");
    const wrapRegra = modal.querySelector("#wrapRegraVencimento");
    const inputDataEmp = modal.querySelector('input[name="data_emprestimo"]');

    const clienteHidden = modal.querySelector("#clienteIdHidden");
    const clienteInput = modal.querySelector("#clienteSearchInput");
    const suggestBox = modal.querySelector("#clienteSuggestBox");

    // =========================
    // Regra vencimento dinâmica
    // =========================
    function renderRegraField() {
      const tipo = String(tipoSel ? tipoSel.value : "DIARIO").toUpperCase();
      if (!wrapRegra) return;

      wrapRegra.innerHTML = `
        <label id="labelRegraVencimento"></label>
        <div id="regraFieldSlot"></div>
        <div class="muted" style="margin-top:6px;" id="hintRegraVencimento"></div>
      `;

      const label = wrapRegra.querySelector("#labelRegraVencimento");
      const slot = wrapRegra.querySelector("#regraFieldSlot");
      const hint = wrapRegra.querySelector("#hintRegraVencimento");

      const baseDate = (inputDataEmp && inputDataEmp.value) ? inputDataEmp.value : todayISO();

      function hintSet(t) { if (hint) hint.textContent = t || ""; }

      if (tipo === "SEMANAL") {
        if (label) label.textContent = "Dia da semana";
        if (slot) {
          slot.innerHTML = `
            <select name="regra_vencimento" required id="regraVencimentoSelect">
              <option value="1">Segunda</option>
              <option value="2">Terça</option>
              <option value="3">Quarta</option>
              <option value="4">Quinta</option>
              <option value="5">Sexta</option>
              <option value="6">Sábado</option>
            </select>
          `;
        }
        hintSet("Primeira prestação será no mínimo daqui 7 dias e cairá no dia selecionado (sem domingo).");
      } else {
        if (label) label.textContent = "Primeiro vencimento";
        if (slot) {
          slot.innerHTML = `<input type="date" name="regra_vencimento" required id="regraVencimentoDate" />`;
        }

        const dateEl = wrapRegra.querySelector("#regraVencimentoDate");
        if (dateEl) {
          dateEl.value = baseDate;
          dateEl.min = baseDate;
        }

        hintSet(tipo === "MENSAL"
          ? "Escolha a data do primeiro vencimento. As próximas parcelas serão mês a mês."
          : "Escolha a data do primeiro vencimento. As próximas parcelas serão dia a dia."
        );
      }
    }

    if (tipoSel) tipoSel.addEventListener("change", renderRegraField);

    if (inputDataEmp) {
      inputDataEmp.addEventListener("change", () => {
        const dateEl = modal.querySelector("#regraVencimentoDate");
        if (dateEl) {
          const base = inputDataEmp.value || todayISO();
          dateEl.min = base;
          if (!dateEl.value || dateEl.value < base) dateEl.value = base;
        }
      });
    }

    // =========================
    // Autocomplete behavior
    // =========================
    function hideSuggest() {
      if (!suggestBox) return;
      suggestBox.hidden = true;
      suggestBox.innerHTML = "";
      acActiveIndex = -1;
    }

    function setClienteSelecionado(id, nome) {
      if (clienteHidden) clienteHidden.value = String(id || "");
      if (clienteInput) clienteInput.value = String(nome || "");
      hideSuggest();
    }

    function setLockedUI(isLocked) {
      if (!clienteInput || !clearBtn) return;
      clienteInput.disabled = !!isLocked;
      clearBtn.style.display = isLocked ? "" : "none";
      if (isLocked) clienteInput.dataset.locked = "1";
      else clienteInput.removeAttribute("data-locked");
    }

    function renderSuggest(query) {
      if (!suggestBox || !clienteInput) return;

      const q = normalizeTxt(query);
      if (!q) {
        hideSuggest();
        return;
      }

      const list = Array.isArray(clientesCache) ? clientesCache : [];
      const filtered = list.filter((c) => normalizeTxt(c.nome).includes(q));

      // ordem alfabética
      filtered.sort((a, b) =>
        a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" })
      );

      const limited = filtered.slice(0, 7);

      if (!limited.length) {
        suggestBox.innerHTML = `<div class="acitem">Nenhum cliente encontrado</div>`;
        suggestBox.hidden = false;
        acActiveIndex = -1;
        return;
      }

      suggestBox.innerHTML = limited.map((c, idx) => `
        <div class="acitem" role="option" data-idx="${idx}" data-id="${escHtml(c.id)}" data-nome="${escHtml(c.nome)}">
          ${highlightMatchAccentsSafe(c.nome, query)}
        </div>
      `).join("");

      suggestBox.hidden = false;
      acActiveIndex = -1;
    }

    function setActiveIndex(idx) {
      if (!suggestBox) return;
      const items = Array.from(suggestBox.querySelectorAll(".acitem"));
      items.forEach((i) => i.classList.remove("is-active"));

      if (idx < 0 || idx >= items.length) {
        acActiveIndex = -1;
        return;
      }

      acActiveIndex = idx;
      const el = items[idx];
      el.classList.add("is-active");
      el.scrollIntoView({ block: "nearest" });
    }

    // clique / hover na sugestão
    if (suggestBox) {
      suggestBox.addEventListener("mousedown", (e) => {
        const item = e.target.closest(".acitem");
        if (!item) return;
        e.preventDefault(); // evita blur antes de selecionar

        // ignora "Nenhum cliente encontrado"
        if (/Nenhum cliente/i.test(item.textContent || "")) return;

        const id = item.getAttribute("data-id") || "";
        const nome = item.getAttribute("data-nome") || item.textContent || "";
        if (id) setClienteSelecionado(id, nome);
      });

      suggestBox.addEventListener("mousemove", (e) => {
        const item = e.target.closest(".acitem");
        if (!item) return;
        const idx = Number(item.getAttribute("data-idx"));
        if (Number.isFinite(idx)) setActiveIndex(idx);
      });
    }

    // digitação
    if (clienteInput) {
      clienteInput.addEventListener("input", async () => {
        // se o usuário começou a digitar manualmente, limpa seleção anterior
        if (clienteHidden) clienteHidden.value = "";
        setLockedUI(false);

        await loadClientesCache();
        renderSuggest(clienteInput.value);
      });

      clienteInput.addEventListener("keydown", (e) => {
        if (!suggestBox || suggestBox.hidden) {
          // Enter sem dropdown: não envia, força escolher
          if (e.key === "Enter") e.preventDefault();
          return;
        }

        const items = Array.from(suggestBox.querySelectorAll(".acitem"));
        const hasRealItems =
          items.length && !/Nenhum cliente/i.test(items[0].textContent || "");

        if (e.key === "ArrowDown") {
          e.preventDefault();
          if (!hasRealItems) return;
          const next = acActiveIndex < 0 ? 0 : Math.min(items.length - 1, acActiveIndex + 1);
          setActiveIndex(next);
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          if (!hasRealItems) return;
          const prev = acActiveIndex <= 0 ? 0 : acActiveIndex - 1;
          setActiveIndex(prev);
        } else if (e.key === "Enter") {
          e.preventDefault();
          if (!hasRealItems) return;

          const idx = acActiveIndex >= 0 ? acActiveIndex : 0;
          const el = items[idx];

          const id = el.getAttribute("data-id") || "";
          const nome = el.getAttribute("data-nome") || el.textContent || "";
          if (id) setClienteSelecionado(id, nome);
        } else if (e.key === "Escape") {
          e.preventDefault();
          hideSuggest();
        }
      });

      // blur fecha (delay p/ clique)
      clienteInput.addEventListener("blur", () => {
        setTimeout(hideSuggest, 120);
      });
    }

    // ✅ botão X pra destravar e trocar cliente
    if (clearBtn) {
      clearBtn.addEventListener("click", async () => {
        if (clienteHidden) clienteHidden.value = "";
        if (clienteInput) {
          clienteInput.value = "";
          setLockedUI(false);
          clienteInput.focus();
        }
        await loadClientesCache();
        hideSuggest(); // só aparece quando digitar
      });
    }

    // =========================
    // Submit
    // =========================
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      // evita duplo clique
      if (btnSubmit) {
        btnSubmit.disabled = true;
        btnSubmit.dataset.loading = "1";
      }

      try {
        // ✅ valida cliente selecionado
        if (!clienteHidden || !clienteHidden.value) {
          if (btnSubmit) btnSubmit.disabled = false;
          onError("Selecione um cliente (digite e escolha na lista).");
          return;
        }

        // validação extra: se for date, garante >= data_emprestimo
        const tipo = String((modal.querySelector('select[name="tipo_vencimento"]')?.value) || "").toUpperCase();
        const base = modal.querySelector('input[name="data_emprestimo"]')?.value || "";
        const regraDate = modal.querySelector('input[name="regra_vencimento"][type="date"]')?.value || "";

        if ((tipo === "DIARIO" || tipo === "MENSAL") && base && regraDate && regraDate < base) {
          if (btnSubmit) btnSubmit.disabled = false;
          onError("O primeiro vencimento não pode ser menor que a data do empréstimo.");
          return;
        }

        const fd = new FormData(form);

        const res = await fetch("/KRAx/public/api.php?route=emprestimos/criar", {
          method: "POST",
          body: fd,
        });

        const json = await res.json();

        if (!json.ok) {
          if (btnSubmit) btnSubmit.disabled = false;
          onError(json.mensagem || "Erro ao criar empréstimo");
          return;
        }

        GestorModal.close("modalNovoEmprestimo");
        form.reset();

        // limpa cliente UI
        if (clienteHidden) clienteHidden.value = "";
        if (clienteInput) clienteInput.value = "";
        setLockedUI(false);
        hideSuggest();

        toast("Empréstimo criado!");

        window.location.href = "emprestimos.php";
      } catch (err) {
        console.error(err);
        if (btnSubmit) btnSubmit.disabled = false;
        onError("Erro de conexão com o servidor");
      }
    });

    // defaults iniciais
    const inputData = modal.querySelector('input[name="data_emprestimo"]');
    if (inputData && !inputData.value) inputData.value = todayISO();

    renderRegraField();
  }

  // ✅ PADRÃO CERTO: recebe payload { clienteId, clienteNome }
  async function openNovoEmprestimo(payload = {}) {
    if (!document.getElementById("modalNovoEmprestimo")) {
      injectModalNovoEmprestimo();
    }

    const modal = document.getElementById("modalNovoEmprestimo");
    if (!modal) return;

    const btnSubmit = modal.querySelector("#btnSubmitNovoEmprestimo");
    if (btnSubmit) {
      btnSubmit.disabled = false;
      delete btnSubmit.dataset.loading;
    }

    const clienteHidden = modal.querySelector("#clienteIdHidden");
    const clienteInput = modal.querySelector("#clienteSearchInput");
    const suggestBox = modal.querySelector("#clienteSuggestBox");
    const clearBtn = modal.querySelector("#clienteClearBtn");

    function setLockedUI(isLocked) {
      if (!clienteInput || !clearBtn) return;
      clienteInput.disabled = !!isLocked;
      clearBtn.style.display = isLocked ? "" : "none";
      if (isLocked) clienteInput.dataset.locked = "1";
      else clienteInput.removeAttribute("data-locked");
    }

    if (suggestBox) {
      suggestBox.hidden = true;
      suggestBox.innerHTML = "";
    }
    acActiveIndex = -1;

    // carrega cache (melhora UX na primeira busca)
    await loadClientesCache();

    const clienteId = String(payload.clienteId || "");
    const clienteNome = String(payload.clienteNome || "");

    if (clienteId && clienteHidden && clienteInput) {
      clienteHidden.value = clienteId;
      clienteInput.value = clienteNome || `Cliente #${clienteId}`;
      setLockedUI(true); // ✅ travado e com X pra destravar
    } else if (clienteHidden && clienteInput) {
      clienteHidden.value = "";
      clienteInput.value = "";
      setLockedUI(false);
    }

    const inputData = modal.querySelector('input[name="data_emprestimo"]');
    if (inputData && !inputData.value) inputData.value = todayISO();

    // re-render (pra ajustar min/default do vencimento)
    const tipoSel = modal.querySelector('#tipoVencimentoNovoEmprestimo');
    if (tipoSel) {
      const ev = new Event('change', { bubbles: true });
      tipoSel.dispatchEvent(ev);
    }

    GestorModal.open("modalNovoEmprestimo");
  }

  window.injectModalNovoEmprestimo = injectModalNovoEmprestimo;
  window.openNovoEmprestimo = openNovoEmprestimo;
})();
