<?php

require_once __DIR__ . '/../models/entities/Pagamento.php';
require_once __DIR__ . '/../models/daos/PagamentoDAO.php';
require_once __DIR__ . '/../models/daos/ParcelaDAO.php';
require_once __DIR__ . '/../models/daos/EmprestimoDAO.php';

class PagamentoController
{
    public function lancar(): void
    {
        try {
            $emprestimoId = (int)($_POST['emprestimo_id'] ?? 0);
            $parcelaId    = isset($_POST['parcela_id']) && $_POST['parcela_id'] !== '' ? (int)$_POST['parcela_id'] : null;
            $tipo         = strtoupper(trim($_POST['tipo_pagamento'] ?? ''));
            $valor        = (float)($_POST['valor_pago'] ?? 0);
            $obs          = isset($_POST['observacao']) ? trim($_POST['observacao']) : null;

            if ($emprestimoId <= 0) throw new InvalidArgumentException('emprestimo_id inválido.');
            if ($valor <= 0) throw new InvalidArgumentException('valor_pago inválido.');
            if (!in_array($tipo, ['JUROS','PARCELA','INTEGRAL','EXTRA'], true)) {
                throw new InvalidArgumentException('tipo_pagamento inválido.');
            }

            $pagDAO = new PagamentoDAO();
            $parDAO = new ParcelaDAO();
            $empDAO = new EmprestimoDAO();

            // 1) registra pagamento
            $p = new Pagamento();
            $p->setEmprestimoId($emprestimoId);
            $p->setParcelaId($parcelaId);
            $p->setValorPago($valor);
            $p->setTipoPagamento($tipo);
            $p->setObservacao($obs);

            $pagId = $pagDAO->criar($p);

            // 2) aplica efeito
            if ($tipo === 'PARCELA') {
                if (!$parcelaId) throw new InvalidArgumentException('parcela_id é obrigatório para pagamento do tipo PARCELA.');
                $parDAO->adicionarPagamentoNaParcela($parcelaId, $valor);
            }

            if ($tipo === 'INTEGRAL') {
                // paga todas as parcelas abertas (uma por uma, sem matemática pesada)
                $parcelas = $parDAO->listarParcelasAbertasPorEmprestimo($emprestimoId);

                foreach ($parcelas as $parcela) {
                    $faltante = (float)$parcela['valor_parcela'] - (float)$parcela['valor_pago'];
                    if ($faltante > 0) {
                        $parDAO->adicionarPagamentoNaParcela((int)$parcela['id'], $faltante);
                    }
                }

                // marca empréstimo quitado
                $empDAO->atualizarStatus($emprestimoId, 'QUITADO');
            }

            // JUROS/EXTRA só registra no histórico (não mexe em parcela)

            $this->responderJson(true, 'Pagamento lançado', ['pagamento_id' => $pagId]);

        } catch (Exception $e) {
            $this->responderJson(false, $e->getMessage());
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
