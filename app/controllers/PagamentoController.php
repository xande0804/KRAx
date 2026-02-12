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

            $parcelaId = isset($_POST['parcela_id']) && $_POST['parcela_id'] !== ''
                ? (int)$_POST['parcela_id']
                : null;

            $tipo = strtoupper(trim($_POST['tipo_pagamento'] ?? ''));

            // ✅ aceita 0,07 e 1.234,56
            $valor = $this->parseMoneyBR($_POST['valor_pago'] ?? 0);

            // ✅ data do pagamento (se vier vazio, usa hoje)
            $dataPagamento = trim((string)($_POST['data_pagamento'] ?? ''));
            if ($dataPagamento === '') {
                $dataPagamento = date('Y-m-d');
            }

            $obs = isset($_POST['observacao']) ? trim($_POST['observacao']) : null;

            if ($emprestimoId <= 0) {
                throw new InvalidArgumentException('emprestimo_id inválido.');
            }

            if (!in_array($tipo, ['JUROS', 'PARCELA', 'INTEGRAL', 'EXTRA', 'QUITACAO'], true)) {
                throw new InvalidArgumentException('tipo_pagamento inválido.');
            }

            $pagDAO = new PagamentoDAO();
            $parDAO = new ParcelaDAO();
            $empDAO = new EmprestimoDAO();

            // =========================================================
            // QUITAÇÃO: backend calcula o valor real
            // =========================================================
            if ($tipo === 'QUITACAO') {
                $parcelasAbertas = $parDAO->listarParcelasAbertasPorEmprestimo($emprestimoId);

                $faltanteParcelas = 0.0;
                foreach ($parcelasAbertas as $parcela) {
                    $faltante = (float)$parcela['valor_parcela'] - (float)$parcela['valor_pago'];
                    if ($faltante > 0) $faltanteParcelas += $faltante;
                }

                $emp = $empDAO->buscarPorId($emprestimoId);
                if (!$emp) {
                    throw new RuntimeException('Empréstimo não encontrado.');
                }

                $principal = (float)$emp->getValorPrincipal();
                $jurosPct  = (float)$emp->getPorcentagemJuros();

                $jurosTotal = $principal * ($jurosPct / 100);
                $jurosPago  = $pagDAO->somarPorEmprestimoETipo($emprestimoId, 'JUROS');

                $faltanteJuros = $jurosTotal - $jurosPago;
                if ($faltanteJuros < 0) $faltanteJuros = 0;

                $totalQuitacao = $faltanteParcelas + $faltanteJuros;

                if ($totalQuitacao <= 0) {
                    throw new InvalidArgumentException('Não há saldo pendente para quitar.');
                }

                $valor = $totalQuitacao;

                if (!$obs) {
                    $obs = 'Quitação total (parcelas + juros)';
                }
            }

            if ($valor <= 0) {
                throw new InvalidArgumentException('valor_pago inválido.');
            }

            // =========================================================
            // 1) EFEITO POR TIPO
            // =========================================================

            // ---------- JUROS / EXTRA ----------
            if ($tipo === 'JUROS' || $tipo === 'EXTRA') {

                $pagId = $this->criarPagamento(
                    $pagDAO,
                    $emprestimoId,
                    $parcelaId,
                    $tipo,
                    $valor,
                    $dataPagamento,
                    $obs
                );

                $this->responderJson(true, 'Pagamento lançado', [
                    'pagamento_id'   => $pagId,
                    'valor_pago'     => $valor,
                    'tipo_pagamento' => $tipo,
                    'data_pagamento' => $dataPagamento,
                ]);
                return;
            }

            // ---------- INTEGRAL / QUITACAO ----------
            if ($tipo === 'INTEGRAL' || $tipo === 'QUITACAO') {

                $pagId = $this->criarPagamento(
                    $pagDAO,
                    $emprestimoId,
                    null,
                    $tipo,
                    $valor,
                    $dataPagamento,
                    $obs
                );

                $parcelas = $parDAO->listarParcelasAbertasPorEmprestimo($emprestimoId);
                foreach ($parcelas as $parcela) {
                    $faltante = (float)$parcela['valor_parcela'] - (float)$parcela['valor_pago'];
                    if ($faltante > 0) {
                        $parDAO->adicionarPagamentoNaParcela((int)$parcela['id'], $faltante);
                    }
                }

                $empDAO->atualizarStatus($emprestimoId, 'QUITADO');

                $this->responderJson(true, 'Pagamento lançado', [
                    'pagamento_id'   => $pagId,
                    'valor_pago'     => $valor,
                    'tipo_pagamento' => $tipo,
                    'data_pagamento' => $dataPagamento,
                ]);
                return;
            }

            // ---------- PARCELA ----------
            if ($tipo === 'PARCELA') {

                $restante = $valor;

                $parcelasAbertas = $parDAO->listarParcelasAbertasPorEmprestimo($emprestimoId);

                if (!$parcelasAbertas || count($parcelasAbertas) === 0) {
                    throw new InvalidArgumentException('Não há prestações em aberto para receber pagamento.');
                }

                if ($parcelaId) {
                    usort($parcelasAbertas, function ($a, $b) use ($parcelaId) {
                        if ((int)$a['id'] === $parcelaId) return -1;
                        if ((int)$b['id'] === $parcelaId) return 1;
                        return ((int)$a['numero_parcela'] <=> (int)$b['numero_parcela']);
                    });
                }

                $pagamentosCriados = [];

                foreach ($parcelasAbertas as $parcela) {
                    if ($restante <= 0) break;

                    $idParcela     = (int)$parcela['id'];
                    $valorParcela  = (float)$parcela['valor_parcela'];
                    $valorPagoPar  = (float)$parcela['valor_pago'];

                    $faltante = $valorParcela - $valorPagoPar;
                    if ($faltante <= 0) continue;

                    $pagarAqui = min($restante, $faltante);

                    $pagId = $this->criarPagamento(
                        $pagDAO,
                        $emprestimoId,
                        $idParcela,
                        'PARCELA',
                        $pagarAqui,
                        $dataPagamento,
                        $obs
                    );

                    $parDAO->adicionarPagamentoNaParcela($idParcela, $pagarAqui);

                    $pagamentosCriados[] = [
                        'pagamento_id' => $pagId,
                        'parcela_id'   => $idParcela,
                        'valor_pago'   => $pagarAqui,
                        'data_pagamento' => $dataPagamento,
                    ];

                    $restante -= $pagarAqui;
                }

                if ($restante > 0) {
                    $obsExtra = trim(($obs ? $obs . ' | ' : '') . 'Crédito excedente gerado automaticamente');

                    $pagIdExtra = $this->criarPagamento(
                        $pagDAO,
                        $emprestimoId,
                        null,
                        'EXTRA',
                        $restante,
                        $dataPagamento,
                        $obsExtra
                    );

                    $pagamentosCriados[] = [
                        'pagamento_id'   => $pagIdExtra,
                        'parcela_id'     => null,
                        'valor_pago'     => $restante,
                        'tipo_pagamento' => 'EXTRA',
                        'data_pagamento' => $dataPagamento,
                    ];
                }

                $aindaAbertas = $parDAO->listarParcelasAbertasPorEmprestimo($emprestimoId);
                if (!$aindaAbertas || count($aindaAbertas) === 0) {
                    $empDAO->atualizarStatus($emprestimoId, 'QUITADO');
                }

                $this->responderJson(true, 'Pagamento lançado', [
                    'tipo_pagamento' => 'PARCELA',
                    'valor_total'    => $valor,
                    'data_pagamento' => $dataPagamento,
                    'pagamentos'     => $pagamentosCriados
                ]);
                return;
            }

            throw new InvalidArgumentException('Fluxo não tratado.');

        } catch (Exception $e) {
            $this->responderJson(false, $e->getMessage());
        }
    }

    private function criarPagamento(
        PagamentoDAO $pagDAO,
        int $emprestimoId,
        ?int $parcelaId,
        string $tipo,
        float $valor,
        string $dataPagamento,
        ?string $obs
    ): int {
        $p = new Pagamento();

        $p->setEmprestimoId($emprestimoId);
        $p->setParcelaId($parcelaId);
        $p->setValorPago($valor);
        $p->setTipoPagamento($tipo);

        // ✅ ESSENCIAL: evita "Typed property ... must not be accessed"
        $p->setDataPagamento($dataPagamento);

        $p->setObservacao($obs);

        return $pagDAO->criar($p);
    }

    /**
     * Converte valores do input pt-BR:
     * "0,07" -> 0.07
     * "1.234,56" -> 1234.56
     * "1234.56" -> 1234.56
     */
    private function parseMoneyBR($v): float
    {
        if (is_int($v) || is_float($v)) return (float)$v;

        $s = trim((string)$v);
        if ($s === '') return 0.0;

        // remove "R$", espaços e qualquer coisa que não seja número, ponto, vírgula ou sinal
        $s = str_replace(['R$', ' ', "\u{00A0}"], '', $s);
        $s = preg_replace('/[^0-9,\.\-]/', '', $s);

        // se tem vírgula, assume vírgula como decimal e remove pontos de milhar
        if (strpos($s, ',') !== false) {
            $s = str_replace('.', '', $s);
            $s = str_replace(',', '.', $s);
        }

        return (float)$s;
    }

    private function responderJson(bool $ok, string $mensagem, $dados = null): void
    {
        header('Content-Type: application/json');

        echo json_encode([
            'ok'       => $ok,
            'mensagem' => $mensagem,
            'dados'    => $dados
        ]);

        exit;
    }
}
