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

  let chartEmp = null;
  let chartFin = null;

  function moneyBR(v) {
    return Number(v || 0).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  function animateNumber(el, finalValue, isMoney = false) {
    let start = 0;
    const duration = 800;
    const startTime = performance.now();

    function update(now) {
      const progress = Math.min((now - startTime) / duration, 1);
      const value = start + (finalValue - start) * progress;

      el.textContent = isMoney ? moneyBR(value) : Math.floor(value);

      if (progress < 1) requestAnimationFrame(update);
    }

    requestAnimationFrame(update);
  }

  function aplicarResumoOperacional(dados) {
    const o = dados.operacional || {};

    animateNumber(elClientes, o.clientes);
    animateNumber(elAtivos, o.emprestimos_ativos);
    animateNumber(elHoje, o.vencem_hoje);
    animateNumber(elAtrasados, o.atrasados);
  }

  function aplicarResumoFinanceiro(dados) {
    const f = dados.financeiro || {};

    animateNumber(elQuantoSaiu, f.quanto_saiu, true);
    animateNumber(elQuantoVoltou, f.quanto_ja_voltou, true);
    animateNumber(elPrevistoVoltar, f.previsto_ainda_pra_voltar, true);
  }

  function renderGraficoEmprestimos(lista) {
    if (!ctxEmp) return;

    const labels = lista.map(i => i.mes);
    const data = lista.map(i => i.quantidade);

    if (chartEmp) chartEmp.destroy();

    chartEmp = new Chart(ctxEmp, {
      type: "bar",
      data: {
        labels,
        datasets: [{
          label: "Empréstimos",
          data,
          backgroundColor: "#2f5fe3",
          borderRadius: 8,
          barThickness: 40,
        }]
      },
      options: {
        responsive: true,
        animation: {
          duration: 1000
        },
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: {
            beginAtZero: true
          }
        }
      }
    });
  }

  function renderGraficoFinanceiro(lista) {
    if (!ctxFin) return;

    const labels = lista.map(i => i.mes);
    const voltou = lista.map(i => i.valor_voltou);
    const saiu = lista.map(i => i.valor_saiu);

    if (chartFin) chartFin.destroy();

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
            borderWidth: 2,
            tension: 0.35,
            pointRadius: 5,
            pointHoverRadius: 7,
            pointBorderWidth: 2,
            pointBackgroundColor: "#16a34a",
            pointBorderColor: "#ffffff",
            borderDash: [6, 6],
            fill: false,
            order: 1,
          }
        ]
      },
      options: {
        responsive: true,
        animation: {
          duration: 1200
        },
        plugins: {
          legend: {
            position: "top"
          },
          tooltip: {
            callbacks: {
              label: function (context) {
                const label = context.dataset.label || "";
                const value = context.raw || 0;
      
                return `${label}: ${value.toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL"
                })}`;
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: function (value) {
                return value.toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL"
                });
              }
            }
          }
        }
      }
    });
  }

  async function fetchData() {
    const params = new URLSearchParams();
    params.set("route", "dashboard/resumo");

    if (elDataInicial.value && elDataFinal.value) {
      params.set("data_inicial", elDataInicial.value);
      params.set("data_final", elDataFinal.value);
    }

    const res = await fetch(`/KRAx/public/api.php?${params.toString()}`);
    const json = await res.json();

    if (!json.ok) throw new Error(json.mensagem);

    return json.dados;
  }

  async function carregar() {
    try {
      const dados = await fetchData();

      aplicarResumoOperacional(dados);
      aplicarResumoFinanceiro(dados);

      renderGraficoEmprestimos(dados.graficos.emprestimos_por_mes);
      renderGraficoFinanceiro(dados.graficos.financeiro_por_mes);

      elFiltroInfo.textContent = "Dados atualizados";
    } catch (e) {
      console.error(e);
      elErro.style.display = "";
    }
  }

  elFiltroForm?.addEventListener("submit", e => {
    e.preventDefault();
    carregar();
  });

  elLimparFiltro?.addEventListener("click", () => {
    elDataInicial.value = "";
    elDataFinal.value = "";
    carregar();
  });

  carregar();
})();