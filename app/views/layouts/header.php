<?php
// defaults de segurança
$activePage = $activePage ?? '';
$pageTitle  = $pageTitle  ?? 'GestorPro';
$pageCss    = $pageCss    ?? [];
?>

<!DOCTYPE html>
<html lang="pt-br">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title><?= htmlspecialchars($pageTitle) ?></title>

  <!-- CSS base (sempre carregados) -->
  <link rel="stylesheet" href="/KRAx/public/assets/css/base.css" />
  <link rel="stylesheet" href="/KRAx/public/assets/css/topbar.css" />
  <link rel="stylesheet" href="/KRAx/public/assets/css/buttons.css" />
  <link rel="stylesheet" href="/KRAx/public/assets/css/forms.css" />
  <link rel="stylesheet" href="/KRAx/public/assets/css/modals.css" />
  <link rel="stylesheet" href="/KRAx/public/assets/css/modal-pagamento.css" />

  <!-- CSS específicos da página -->
  <?php foreach ($pageCss as $css): ?>
    <link rel="stylesheet" href="/KRAx/public/assets/css/<?= $css ?>.css" />
  <?php endforeach; ?>
</head>

<body>
<header class="topbar">
  <div class="topbar__left">
    <a class="brand" href="/KRAx/public/index.php">
      <span class="brand__logo">∞</span>
      <span class="brand__name">GestorPro</span>
    </a>
  </div>

  <nav class="topbar__nav">
    <a class="navlink <?= $activePage === 'inicio' ? 'is-active' : '' ?>" 
       href="/KRAx/public/index.php">Início</a>

    <a class="navlink <?= $activePage === 'clientes' ? 'is-active' : '' ?>" 
       href="/KRAx/app/views/clientes.php">Clientes</a>

    <a class="navlink <?= $activePage === 'emprestimos' ? 'is-active' : '' ?>" 
       href="/KRAx/app/views/emprestimos.php">Empréstimos</a>

    <a class="navlink <?= $activePage === 'vencimentos' ? 'is-active' : '' ?>" 
       href="/KRAx/app/views/vencimentos.php">Vencimentos</a>
  </nav>

  <div class="topbar__right">
    <button class="btn btn--primary" type="button" data-modal-open="novoEmprestimo">
      + Novo empréstimo
    </button>
  </div>
</header>

<main class="container">
