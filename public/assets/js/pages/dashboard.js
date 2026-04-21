// public/assets/js/pages/dashboard.js
(function () {
  const elClientes = document.getElementById("statClientes");
  const elAtivos = document.getElementById("statAtivos");
  const elHoje = document.getElementById("statHoje");
  const elAtrasados = document.getElementById("statAtrasados");

  const elQuantoSaiu = document.getElementById("statQuantoSaiu");
  const elQuantoVoltou = document.getElementById("statQuantoVoltou");
  const elPrevistoVoltar = document.getElementById("statPrevistoVoltar");

  const elFiltroForm = document.getElementById("dashboardFiltroForm");
  const elDataInicial = document.getElementById("dashboardDataInicial");
  const elDataFinal = document.getElementById("dashboardDataFinal");
  const elLimparFiltro = document.getElementById("dashboardLimparFiltro");
  const elFiltroInfo = document.getElementById("dashboardFiltroInfo");
  const elErro = document.getElementById("dashboardErro");

  const ctxEmp = document.getElementById("graficoEmprestimosMes");
  const ctxFin = document.getElementById("graficoFinanceiroMes");
  const elRankingTopClientes = document.getElementById("rankingTopClientes");

  let chartEmp = null;
  let chartFin = null;

  function moneyBR(v) {
    return Number(v || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  function escHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function fmtDateBR(iso) {
    const s = String(iso || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return "—";

    const [y, m, d] = s.split("-");
    return `${d}/${m}/${y}`;
  }

  function formatPeriodoInfo(filtro) {
    const dataInicial = String(filtro?.data_inicial || "");
    const dataFinal = String(filtro?.data_final || "");
    const periodoPadrao = Boolean(filtro?.periodo_padrao_aplicado);

    if (!dataInicial || !dataFinal) {
      return "Período indisponível.";
    }

    const label = `${fmtDateBR(dataInicial)} até ${fmtDateBR(dataFinal)}`;

    return periodoPadrao
      ? `Período atual: ${label} (último mês).`
      : `Período filtrado: ${label}.`;
  }

  function animateNumber(el, finalValue, isMoney = false) {
    if (!el) return;

    const valueNumber = Number(finalValue);
    if (!Number.isFinite(valueNumber)) return;

    const start = 0;
    const duration = 800;
    const startTime = performance.now();

    function update(now) {
      const progress = Math.min((now - startTime) / duration, 1);
      const current = start + (valueNumber - start) * progress;

      el.textContent = isMoney ? moneyBR(current) : String(Math.floor(current));

      if (progress < 1) {
        requestAnimationFrame(update);
        return;
      }

      el.textContent = isMoney ? moneyBR(valueNumber) : String(Math.floor(valueNumber));
    }

    requestAnimationFrame(update);
  }

  function aplicarResumoOperacional(dados) {
    const o = dados?.operacional ?? {};

    if (o.clientes != null) animateNumber(elClientes, o.clientes);
    if (o.emprestimos_ativos != null) animateNumber(elAtivos, o.emprestimos_ativos);
    if (o.vencem_hoje != null) animateNumber(elHoje, o.vencem_hoje);
    if (o.atrasados != null) animateNumber(elAtrasados, o.atrasados);
  }

  function aplicarResumoFinanceiro(dados) {
    const f = dados?.financeiro ?? {};

    if (f.quanto_saiu != null) animateNumber(elQuantoSaiu, f.quanto_saiu, true);
    if (f.quanto_ja_voltou != null) animateNumber(elQuantoVoltou, f.quanto_ja_voltou, true);
    if (f.previsto_ainda_pra_voltar != null) animateNumber(elPrevistoVoltar, f.previsto_ainda_pra_voltar, true);
  }

  function aplicarFiltro(dados) {
    const filtro = dados?.filtro ?? {};

    if (elDataInicial && filtro.data_inicial) {
      elDataInicial.value = String(filtro.data_inicial);
    }

    if (elDataFinal && filtro.data_final) {
      elDataFinal.value = String(filtro.data_final);
    }

    if (elFiltroInfo) {
      elFiltroInfo.textContent = formatPeriodoInfo(filtro);
    }
  }

  function renderGraficoEmprestimos(lista) {
    if (!ctxEmp || typeof Chart === "undefined") return;

    const rows = Array.isArray(lista) ? lista : [];
    const labels = rows.map((i) => i.mes);
    const data = rows.map((i) => Number(i.quantidade || 0));

    if (chartEmp) {
      chartEmp.destroy();
    }

    chartEmp = new Chart(ctxEmp, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Empréstimos",
            data,
            backgroundColor: "#2f5fe3",
            borderRadius: 8,
            barThickness: 40,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 1000,
        },
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            callbacks: {
              label: function (context) {
                const value = Number(context.raw || 0);
                return `${value} empréstimo(s)`;
              },
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              precision: 0,
            },
          },
        },
      },
    });
  }

  function renderGraficoFinanceiro(lista) {
    if (!ctxFin || typeof Chart === "undefined") return;

    const rows = Array.isArray(lista) ? lista : [];
    const labels = rows.map((i) => i.mes);
    const voltou = rows.map((i) => Number(i.valor_voltou || 0));
    const saiu = rows.map((i) => Number(i.valor_saiu || 0));

    if (chartFin) {
      chartFin.destroy();
    }

    chartFin = new Chart(ctxFin, {
      data: {
        labels,
        datasets: [
          {
            type: "bar",
            label: "Saiu",
            data: saiu,
            backgroundColor: "#2f5fe3",
            borderRadius: 6,
            barThickness: 35,
            order: 2,
          },
          {
            type: "line",
            label: "Voltou",
            data: voltou,
            borderColor: "#16a34a",
            backgroundColor: "#16a34a",
            borderWidth: 3,
            tension: 0.35,
            pointRadius: 5,
            pointHoverRadius: 7,
            pointBorderWidth: 2,
            pointBackgroundColor: "#16a34a",
            pointBorderColor: "#ffffff",
            borderDash: [6, 6],
            fill: false,
            order: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 1200,
        },
        plugins: {
          legend: {
            position: "top",
          },
          tooltip: {
            callbacks: {
              label: function (context) {
                const label = context.dataset.label || "";
                const value = Number(context.raw || 0);

                return `${label}: ${value.toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}`;
              },
            },
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: function (value) {
                return Number(value).toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                });
              },
            },
          },
        },
      },
    });
  }

  function renderRankingTopClientes(lista) {
    if (!elRankingTopClientes) return;

    const rows = Array.isArray(lista) ? lista : [];

    if (!rows.length) {
      elRankingTopClientes.innerHTML =
        '<div class="page-sub">Nenhum cliente no ranking para o período selecionado.</div>';
      return;
    }

    elRankingTopClientes.innerHTML = `
      <div style="display:grid;gap:10px;">
        ${rows
          .map((item) => {
            const posicao = Number(item?.posicao ?? 0);
            const clienteNome = escHtml(item?.cliente_nome ?? "Cliente");
            const totalPago = moneyBR(item?.total_pago ?? 0);
            const qtdPagamentos = Number(item?.quantidade_pagamentos ?? 0);

            return `
              <div style="display:flex;justify-content:space-between;align-items:center;gap:16px;padding:12px 14px;border:1px solid #e6e8ef;border-radius:14px;background:#fff;">
                <div style="min-width:0;">
                  <div style="font-weight:800;">#${posicao} • ${clienteNome}</div>
                  <div class="page-sub" style="margin:4px 0 0 0;">
                    ${qtdPagamentos} pagamento(s) no período
                  </div>
                </div>
                <div style="font-weight:800;white-space:nowrap;">
                  ${escHtml(totalPago)}
                </div>
              </div>
            `;
          })
          .join("")}
      </div>
    `;
  }

  async function fetchData() {
    const params = new URLSearchParams();
    params.set("route", "dashboard/resumo");

    const dataInicial = String(elDataInicial?.value || "").trim();
    const dataFinal = String(elDataFinal?.value || "").trim();

    if (dataInicial && dataFinal) {
      params.set("data_inicial", dataInicial);
      params.set("data_final", dataFinal);
    }

    const res = await fetch(`/KRAx/public/api.php?${params.toString()}`, {
      headers: { Accept: "application/json" },
    });

    const json = await res.json();

    if (!json.ok) {
      throw new Error(json.mensagem || "Erro ao carregar dashboard");
    }

    return json.dados;
  }

  function esconderErro() {
    if (!elErro) return;
    elErro.style.display = "none";
    elErro.textContent = "";
  }

  function mostrarErro(message) {
    if (!elErro) return;
    elErro.textContent = String(message || "Não foi possível carregar os dados do dashboard.");
    elErro.style.display = "";
  }

  async function carregar() {
    try {
      esconderErro();

      const dados = await fetchData();

      aplicarResumoOperacional(dados);
      aplicarResumoFinanceiro(dados);
      aplicarFiltro(dados);

      renderGraficoEmprestimos(dados?.graficos?.emprestimos_por_mes);
      renderGraficoFinanceiro(dados?.graficos?.financeiro_por_mes);
      renderRankingTopClientes(dados?.ranking?.top_clientes);

      if (elFiltroInfo && dados?.filtro) {
        elFiltroInfo.textContent = formatPeriodoInfo(dados.filtro);
      }
    } catch (e) {
      console.error(e);
      mostrarErro(e.message || "Erro ao carregar dashboard.");
    }
  }

  elFiltroForm?.addEventListener("submit", function (e) {
    e.preventDefault();
    carregar();
  });

  elLimparFiltro?.addEventListener("click", function () {
    if (elDataInicial) elDataInicial.value = "";
    if (elDataFinal) elDataFinal.value = "";
    carregar();
  });

  if (elLimparFiltro) {
    elLimparFiltro.textContent = "Último mês";
  }

  carregar();
})();