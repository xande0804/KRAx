<?php
date_default_timezone_set('America/Sao_Paulo');
ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/../storage/logs/app.log');
error_reporting(E_ALL);

session_start();
$publicRoutes = ['auth/login'];

$route = $_GET['route'] ?? '';

if (empty($_SESSION['user']) && !in_array($route, $publicRoutes, true)) {
    header('Content-Type: application/json; charset=utf-8');
    http_response_code(401);
    echo json_encode([
        'ok' => false,
        'error' => 'Não autorizado (faça login).'
    ]);
    exit;
}

require_once __DIR__ . '/../app/controllers/ClienteController.php';
require_once __DIR__ . '/../app/controllers/EmprestimoController.php';
require_once __DIR__ . '/../app/controllers/PagamentoController.php';
require_once __DIR__ . '/../app/controllers/DashboardController.php';

switch ($route) {

    case 'clientes/criar':
        (new ClienteController())->criar();
        break;

    case 'clientes/listar':
        (new ClienteController())->listar();
        break;

    case 'clientes/detalhes':
        (new ClienteController())->detalhes();
        break;

    case 'clientes/atualizar':
        (new ClienteController())->atualizar();
        break;

    case 'clientes/excluir':
        (new ClienteController())->excluir();
        break;

    case 'clientes/documentos/listar':
        (new ClienteController())->documentosListar();
        break;

    case 'clientes/documentos/excluir':
        (new ClienteController())->documentosExcluir();
        break;

    case 'emprestimos/criar':
        (new EmprestimoController())->criar();
        break;

    case 'emprestimos/atualizar':
        (new EmprestimoController())->atualizar();
        break;

    case 'vencimentos/hoje':
        (new EmprestimoController())->vencimentosDoDia();
        break;

    case 'vencimentos/amanha':
        (new EmprestimoController())->vencimentosAmanha();
        break;

    case 'vencimentos/semana':
        (new EmprestimoController())->vencimentosSemana();
        break;

    case 'emprestimos/detalhes':
        (new EmprestimoController())->detalhes();
        break;

    case 'emprestimos/listar':
        (new EmprestimoController())->listar();
        break;

    case 'emprestimos/por_cliente':
        (new EmprestimoController())->porCliente();
        break;

    case 'pagamentos/lancar':
        (new PagamentoController())->lancar();
        break;

    case 'pagamentos/atualizar':
        (new PagamentoController())->atualizar();
        break;

    case 'pagamentos/excluir':
        (new PagamentoController())->excluir();
        break;

    case 'dashboard/resumo':
        (new DashboardController())->resumo();
        break;

    case 'emprestimos/excluir':
        (new EmprestimoController())->excluir();
        break;


    case 'auth/login': {
            $auth = require __DIR__ . '/../app/config/auth.php';

            $username = trim($_POST['username'] ?? '');
            $password = $_POST['password'] ?? '';

            $userOk = hash_equals((string)$auth['username'], (string)$username);
            $passOk = $userOk && password_verify($password, (string)$auth['password_hash']);

            if (!$passOk) {
                header('Location: /KRAx/app/views/login.php?erro=' . urlencode('Usuário ou senha inválidos.'));
                exit;
            }

            session_regenerate_id(true);
            $_SESSION['user'] = $auth['username'];

            header('Location: /KRAx/public/index.php');
            exit;
        }

    case 'auth/logout': {
            $_SESSION = [];
            if (ini_get('session.use_cookies')) {
                $params = session_get_cookie_params();
                setcookie(
                    session_name(),
                    '',
                    time() - 42000,
                    $params['path'],
                    $params['domain'],
                    $params['secure'],
                    $params['httponly']
                );
            }
            session_destroy();

            header('Location: /KRAx/app/views/login.php');
            exit;
        }

    default:
        header('Content-Type: application/json');
        echo json_encode([
            'ok' => false,
            'mensagem' => 'Rota não encontrada'
        ]);
        exit;
}
