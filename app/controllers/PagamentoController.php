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

            // ✅ inclui QUITACAO
            if (!in_array($tipo, ['JUROS', 'PARCELA', 'INTEGRAL', 'EXTRA', 'QUITACAO'], true)) {
                throw new InvalidArgumentException('tipo_pagamento inválido.');
            }

            $pagDAO = new PagamentoDAO();
            $parDAO = new ParcelaDAO();
            $empDAO = new EmprestimoDAO();

            // ✅ QUITACAO: backend calcula o valor real (não confia no front)
            if ($tipo === 'QUITACAO') {
                // 1) saldo das parcelas (principal em aberto)
                $parcelasAbertas = $parDAO->listarParcelasAbertasPorEmprestimo($emprestimoId);
            
                $faltanteParcelas = 0.0;
                foreach ($parcelasAbertas as $parcela) {
                    $faltante = (float)$parcela['valor_parcela'] - (float)$parcela['valor_pago'];
                    if ($faltante > 0) $faltanteParcelas += $faltante;
                }
            
                // 2) juros faltante (JUROS total - JUROS pago)
                $emp = $empDAO->buscarPorId($emprestimoId);
                if (!$emp) throw new RuntimeException('Empréstimo não encontrado.');
            
                $principal = (float)$emp->getValorPrincipal();
                $jurosPct  = (float)$emp->getPorcentagemJuros();
            
                $jurosTotal = $principal * ($jurosPct / 100);
            
                // soma pagamentos do tipo JUROS
                $jurosPago = $pagDAO->somarPorEmprestimoETipo($emprestimoId, 'JUROS');
            
                $faltanteJuros = $jurosTotal - $jurosPago;
                if ($faltanteJuros < 0) $faltanteJuros = 0; // não deixa negativo
            
                // 3) total quitação
                $totalQuitacao = $faltanteParcelas + $faltanteJuros;
            
                if ($totalQuitacao <= 0) {
                    throw new InvalidArgumentException('Não há saldo pendente para quitar.');
                }
            
                $valor = $totalQuitacao;
            
                if (!$obs) {
                    $obs = 'Quitação total (parcelas + juros)';
                }
            }
            

            // ✅ valida valor (mas QUITACAO já foi calculado acima)
            if ($valor <= 0) throw new InvalidArgumentException('valor_pago inválido.');

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

            if ($tipo === 'INTEGRAL' || $tipo === 'QUITACAO') {
                $parcelas = $parDAO->listarParcelasAbertasPorEmprestimo($emprestimoId);

                foreach ($parcelas as $parcela) {
                    $faltante = (float)$parcela['valor_parcela'] - (float)$parcela['valor_pago'];
                    if ($faltante > 0) {
                        $parDAO->adicionarPagamentoNaParcela((int)$parcela['id'], $faltante);
                    }
                }

                $empDAO->atualizarStatus($emprestimoId, 'QUITADO');
            }

            $this->responderJson(true, 'Pagamento lançado', [
                'pagamento_id' => $pagId,
                'valor_pago' => $valor,
                'tipo_pagamento' => $tipo
            ]);
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