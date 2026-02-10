<?php

require_once __DIR__ . '/../models/daos/ClienteDAO.php';
require_once __DIR__ . '/../models/daos/EmprestimoDAO.php';
require_once __DIR__ . '/../models/daos/ParcelaDAO.php';

class DashboardController
{
    public function resumo(): void
    {
        try {
            $cliDAO = new ClienteDAO();
            $empDAO = new EmprestimoDAO();
            $parDAO = new ParcelaDAO();

            $hoje = $_GET['data'] ?? date('Y-m-d');

            $dados = [
                'clientes' => $cliDAO->contarTodos(),
                'emprestimos_ativos' => $empDAO->contarAtivos(),
                'vencem_hoje' => $parDAO->contarVencemHoje($hoje),
                'atrasados' => $parDAO->contarAtrasados($hoje),
            ];

            $this->responderJson(true, 'Resumo do dashboard', $dados);
        } catch (Exception $e) {
            $this->responderJson(false, $e->getMessage(), null);
        }
    }

    private function responderJson(bool $ok, string $mensagem, $dados = null): void
    {
        header('Content-Type: application/json');
        echo json_encode([
            'ok' => $ok,
            'mensagem' => $mensagem,
            'dados' => $dados
        ]);
        exit;
    }
}
