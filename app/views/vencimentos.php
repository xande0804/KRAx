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
  <button class="tab is-active" data-filter="hoje" type="button">Hoje</button>
  <button class="tab" data-filter="amanha" type="button">Amanhã</button>
  <button class="tab" data-filter="semana" type="button">Semana</button>
</div>

<!-- Seção: Atrasados -->
<div class="section-row" id="secAtrasados" style="display:none;">
  <div class="section-row__left">
    <span class="warn-icon">⛔</span>
    <strong class="section-row__title" id="countAtrasados">Atrasados (0)</strong>
  </div>
</div>

<section class="list venc-list" id="vencListAtrasados"></section>

<!-- Seção: Lista principal (Hoje / Amanhã / Semana) -->
<div class="section-row">
  <div class="section-row__left">
    <strong class="section-row__title" id="tituloPeriodo">Hoje (0)</strong>
  </div>
</div>

<section class="list venc-list" id="vencList"></section>

<?php require __DIR__ . '/layouts/footer.php'; ?>
