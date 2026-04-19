<?php

$activePage = 'inicio';
$pageTitle  = 'GestorPro • Início';

$pageCss = [
  'badges',
  'cards',
];

$pageJs = [
  'pages/dashboard',
];

$pageVendorJs = [
  'https://cdn.jsdelivr.net/npm/chart.js'
];

require __DIR__ . '/layouts/header.php';
?>

<section class="page-head">
  <h1 class="page-title">Bem-vindo ao GestorPro</h1>
  <p class="page-sub">
    Gerencie seus clientes e empréstimos de forma rápida.
  </p>
</section>

<section class="grid grid--4 gap-12">
  <article class="card card--stat">
    <div class="stat__label">Clientes</div>
    <div class="stat__value" id="statClientes">...</div>
  </article>

  <article class="card card--stat">
    <div class="stat__label">Empréstimos ativos</div>
    <div class="stat__value" id="statAtivos">...</div>
  </article>

  <article class="card card--stat">
    <div class="stat__label">Vencem hoje</div>
    <div class="stat__value" id="statHoje">...</div>
  </article>

  <article class="card card--stat">
    <div class="stat__label stat__label--danger">Atrasados</div>
    <div class="stat__value stat__value--danger" id="statAtrasados">...</div>
  </article>
</section>

<section class="section">
  <h2 class="section-title">Ações rápidas</h2>

  <div class="grid grid--4 gap-16">
    <a class="action-card" href="/KRAx/app/views/clientes.php">
      <div class="action-card__icon">👥</div>
      <div class="action-card__title">Clientes</div>
    </a>

    <a class="action-card" href="/KRAx/app/views/emprestimos.php">
      <div class="action-card__icon">💸</div>
      <div class="action-card__title">Empréstimos</div>
    </a>

    <a class="action-card" href="/KRAx/app/views/vencimentos.php">
      <div class="action-card__icon">📅</div>
      <div class="action-card__title">Vencimentos</div>
    </a>

    <button
      class="btn btn--primary action-card action-card--primary"
      type="button"
      data-modal-open="novoEmprestimo">
      + Novo empréstimo
    </button>
  </div>
</section>

<section class="section">
  <div class="section-head" style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">
    <div>
      <h2 class="section-title">Resumo financeiro</h2>
      <p class="page-sub" style="margin:0;">
        Visão principal de saída, retorno e saldo previsto.
      </p>
    </div>

    <form id="dashboardFiltroForm" style="
  display:flex;
  justify-content:space-between;
  align-items:end;
  gap:16px;
  flex-wrap:wrap;
  width:100%;
">
  <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:end;">
    <div>
      <label class="stat__label" for="dashboardDataInicial">Data inicial</label>
      <input type="date" id="dashboardDataInicial" name="data_inicial" class="input" />
    </div>

    <div>
      <label class="stat__label" for="dashboardDataFinal">Data final</label>
      <input type="date" id="dashboardDataFinal" name="data_final" class="input" />
    </div>
  </div>

  <div style="display:flex;gap:8px;align-items:end;margin-left:auto;">
    <button type="submit" class="btn btn--primary">
      Aplicar filtro
    </button>

    <button type="button" class="btn btn--ghost" id="dashboardLimparFiltro">
      Últimos 12 meses
    </button>
  </div>
</form>
  </div>

  <div id="dashboardFiltroInfo" class="page-sub" style="margin-top:8px;">
    Carregando período...
  </div>

  <div id="dashboardErro" class="page-sub" style="margin-top:8px; display:none;">
    Não foi possível carregar os dados do dashboard.
  </div>

  <div style=" display: grid; grid-template-columns: repeat(3, 1fr);gap: 12px; margin-top: 16px;">
    <article class="card card--stat">
      <div class="stat__label">Quanto saiu</div>
      <div class="stat__value" id="statQuantoSaiu">...</div>
    </article>

    <article class="card card--stat">
      <div class="stat__label">Quanto já voltou</div>
      <div class="stat__value" id="statQuantoVoltou">...</div>
    </article>

    <article class="card card--stat">
      <div class="stat__label">Previsto ainda pra voltar</div>
      <div class="stat__value" id="statPrevistoVoltar">...</div>
    </article>
  </div>
</section>

<section class="section">
  <h2 class="section-title">Visão mensal</h2>

  <div class="grid grid--2 gap-16">
    
    <article class="card">
      <div class="stat__label" style="margin-bottom:12px;">
        Empréstimos por mês
      </div>

      <div style="height:320px;">
        <canvas id="graficoEmprestimosMes"></canvas>
      </div>
    </article>

    <article class="card">
      <div class="stat__label" style="margin-bottom:12px;">
        Saída x retorno por mês
      </div>

      <div style="height:320px;">
        <canvas id="graficoFinanceiroMes"></canvas>
      </div>
    </article>

  </div>
</section>

<section class="section">
  <h2 class="section-title">Top 5 clientes</h2>

  <article class="card">
    <div id="rankingTopClientes" class="page-sub">
      Carregando ranking...
    </div>
  </article>
</section>



<?php require __DIR__ . '/layouts/footer.php'; ?>