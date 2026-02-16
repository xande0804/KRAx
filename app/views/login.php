<?php
session_start();

// Se já estiver logado, manda pra home
if (!empty($_SESSION['user'])) {
  header('Location: /KRAx/public/index.php');
  exit;
}

$erro = $_GET['erro'] ?? '';
?>
<!DOCTYPE html>
<html lang="pt-br">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Login • GestorPro</title>

  <!-- usa seus css atuais -->
  <link rel="stylesheet" href="/KRAx/public/assets/css/base.css" />
  <link rel="stylesheet" href="/KRAx/public/assets/css/forms.css" />
  <link rel="stylesheet" href="/KRAx/public/assets/css/buttons.css" />

  <style>
    .login-wrap{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;}
    .login-card{width:100%;max-width:420px;background:#fff;border-radius:16px;padding:24px;box-shadow:0 10px 30px rgba(0,0,0,.08);}
    .login-title{font-size:22px;margin:0 0 6px;}
    .login-sub{margin:0 0 18px;color:#666;}
    .login-err{background:#ffe9e9;color:#a10000;padding:10px 12px;border-radius:10px;margin-bottom:14px;}
    .login-actions{display:flex;gap:10px;align-items:center;margin-top:14px;}
    .login-actions .btn{width:100%;}
  </style>
</head>
<body>
  <div class="login-wrap">
    <div class="login-card">
      <h1 class="login-title">Entrar</h1>
      <p class="login-sub">Acesso restrito (usuário único).</p>

      <?php if ($erro): ?>
        <div class="login-err">
          <?= htmlspecialchars($erro) ?>
        </div>
      <?php endif; ?>

      <form method="POST" action="/KRAx/public/api.php?route=auth/login">
        <label class="field">
          <span class="field__label">Usuário</span>
          <input class="input" type="text" name="username" autocomplete="username" required />
        </label>

        <label class="field">
          <span class="field__label">Senha</span>
          <input class="input" type="password" name="password" autocomplete="current-password" required />
        </label>

        <div class="login-actions">
          <button class="btn btn--primary" type="submit">Entrar</button>
        </div>
      </form>
    </div>
  </div>
</body>
</html>
