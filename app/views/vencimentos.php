<?php
$activePage = 'vencimentos';
$pageTitle  = 'GestorPro • Vencimentos';

$pageCss = [
  'list',
  'badges',
  'tabs',
  'vencimentos',
];

$pageJs = [
  'pages/vencimentos',
];

require __DIR__ . '/layouts/header.php';
?>

<div class="page-head">
  <h1 class="page-title">Vencimentos</h1>
  <p class="page-sub">Acompanhe os vencimentos e lance pagamentos.</p>
</div>

<!-- Tabs (Hoje / Amanhã / Semana) -->
<div class="tabs" id="vencTabs">
  <button class="tab is-active" data-filter="hoje">Hoje</button>
  <button class="tab" data-filter="amanha">Amanhã</button>
  <button class="tab" data-filter="semana">Semana</button>
</div>

<!-- Título de seção "Atrasados (3)" -->
<div class="section-row">
  <div class="section-row__left">
    <span class="warn-icon">⛔</span>
    <strong class="section-row__title">Atrasados (3)</strong>
  </div>
</div>

<!-- Lista de vencimentos -->
<section class="list venc-list" id="vencList">
  <article class="list-item venc-item" data-period="hoje semana" data-status="atrasado">
    <div class="venc-left">
      <div class="venc-title">
        <span class="warn-dot">!</span>
        <strong>Pedro Costa</strong>
        <span class="badge badge--danger">Atrasado</span>
      </div>

      <div class="venc-meta">
        <span>Parcela 3</span>
        <span>R$ 345,00</span>
        <span>Vencimento: 04/12/2025</span>
      </div>
    </div>

    <div class="venc-right">
      <button
        class="btn btn--primary btn--compact"
        type="button"
        data-modal-open="lancarPagamento"
        data-cliente-nome="Pedro Costa"
        data-emprestimo-info="Parcela 3 • R$ 345,00 • Venc: 10/02/2026"
        data-valor-padrao="345,00"
      >
        Lançar pagamento
      </button>
    </div>
  </article>

  <article class="list-item venc-item" data-period="hoje semana" data-status="atrasado">
    <div class="venc-left">
      <div class="venc-title">
        <span class="warn-dot">!</span>
        <strong>Pedro Costa</strong>
        <span class="badge badge--danger">Atrasado</span>
      </div>

      <div class="venc-meta">
        <span>Parcela 4</span>
        <span>R$ 345,00</span>
        <span>Vencimento: 10/02/2026</span>
      </div>
    </div>

    <div class="venc-right">
      <button
        class="btn btn--primary btn--compact"
        type="button"
        data-modal-open="lancarPagamento"
        data-cliente-nome="Pedro Costa"
        data-emprestimo-info="Parcela 3 • R$ 345,00 • Venc: 04/12/2025"
        data-valor-padrao="345,00"
      >
        Lançar pagamento
      </button>
    </div>
  </article>

  <article class="list-item venc-item" data-period="hoje semana" data-status="atrasado">
    <div class="venc-left">
      <div class="venc-title">
        <span class="warn-dot">!</span>
        <strong>Pedro Costa</strong>
        <span class="badge badge--danger">Atrasado</span>
      </div>

      <div class="venc-meta">
        <span>Parcela 5</span>
        <span>R$ 345,00</span>
        <span>Vencimento: 06/12/2025</span>
      </div>
    </div>

    <div class="venc-right">
      <button
        class="btn btn--primary btn--compact"
        type="button"
        data-modal-open="lancarPagamento"
        data-cliente-nome="Pedro Costa"
        data-emprestimo-info="Parcela 3 • R$ 345,00 • Venc: 04/12/2025"
        data-valor-padrao="345,00"
      >
        Lançar pagamento
      </button>
    </div>
  </article>
</section>

<?php require __DIR__ . '/layouts/footer.php'; ?>
