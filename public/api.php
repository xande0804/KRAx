<?php

$route = $_GET['route'] ?? '';

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

    case 'emprestimos/criar':
        (new EmprestimoController())->criar();
        break;

    case 'vencimentos/hoje':
        (new EmprestimoController())->vencimentosDoDia();
        break;

    case 'vencimentos/amanha':
        (new EmprestimoController())->vencimentosAmanha();
    break;

    /*case 'vencimentos/semana':
        (new EmprestimoController())->vencimentosSemana();
    break;*/


    case 'emprestimos/detalhes':
        (new EmprestimoController())->detalhes();
        break;

    case 'emprestimos/listar':
        (new EmprestimoController())->listar();
        break;

    case 'pagamentos/lancar':
        (new PagamentoController())->lancar();
        break;

    case 'dashboard/resumo':
        (new DashboardController())->resumo();
        break;

    case 'emprestimos/por_cliente':
        (new EmprestimoController())->porCliente();
        break;

    default:
        header('Content-Type: application/json');
        echo json_encode([
            'ok' => false,
            'mensagem' => 'Rota não encontrada'
        ]);
        exit;
}
