<?php
$activePage = 'vencimentos';
$pageTitle  = 'GestorPro • Vencimentos';

$pageCss = [
  'list',
  'badges',
  'tabs',
  'vencimentos',
  'badges',
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

<div class="tabs" id="vencTabs">
  <button class="tab is-active" data-filter="por_data" type="button">Hoje</button>
  <button class="tab" data-filter="hoje" type="button">Diários</button>
  <button class="tab" data-filter="semana" type="button">Semanais</button>
  <button class="tab" data-filter="amanha" type="button">Mensais</button>
  <button class="tab" data-filter="atrasados" type="button" style="color: #d93025; font-weight: bold;">Atrasados</button>
</div>

<div class="searchbar">
  <span class="searchbar__icon">🔎</span>
  <input
    id="vencSearch"
    class="input input--search"
    type="text"
    placeholder="Buscar por nome, CPF ou telefone..."
  />
</div>

<div class="section-row">
  <div class="section-row__left">
    <strong class="section-row__title" id="tituloPeriodo">Hoje (0)</strong>
  </div>
</div>

<section class="list venc-list" id="vencList"></section>

<?php require __DIR__ . '/layouts/footer.php'; ?>