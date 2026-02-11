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
                if (!$emp) throw new RuntimeException('Empréstimo não encontrado.');

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

                if (!$obs) $obs = 'Quitação total (parcelas + juros)';
            }

            if ($valor <= 0) throw new InvalidArgumentException('valor_pago inválido.');

            // =========================================================
            // 1) EFEITO POR TIPO
            // =========================================================

            // ---------- JUROS / EXTRA: só registra pagamento ----------
            if ($tipo === 'JUROS' || $tipo === 'EXTRA') {
                $pagId = $this->criarPagamento($pagDAO, $emprestimoId, $parcelaId, $tipo, $valor, $obs);

                $this->responderJson(true, 'Pagamento lançado', [
                    'pagamento_id' => $pagId,
                    'valor_pago' => $valor,
                    'tipo_pagamento' => $tipo
                ]);
                return;
            }

            // ---------- QUITAÇÃO / INTEGRAL: paga tudo e quita ----------
            if ($tipo === 'INTEGRAL' || $tipo === 'QUITACAO') {
                // registra pagamento principal (sem parcela_id mesmo)
                $pagId = $this->criarPagamento($pagDAO, $emprestimoId, null, $tipo, $valor, $obs);

                // agora aplica: quitar todas parcelas faltantes
                $parcelas = $parDAO->listarParcelasAbertasPorEmprestimo($emprestimoId);
                foreach ($parcelas as $parcela) {
                    $faltante = (float)$parcela['valor_parcela'] - (float)$parcela['valor_pago'];
                    if ($faltante > 0) {
                        $parDAO->adicionarPagamentoNaParcela((int)$parcela['id'], $faltante);
                    }
                }

                $empDAO->atualizarStatus($emprestimoId, 'QUITADO');

                $this->responderJson(true, 'Pagamento lançado', [
                    'pagamento_id' => $pagId,
                    'valor_pago' => $valor,
                    'tipo_pagamento' => $tipo
                ]);
                return;
            }

            // ---------- PARCELA: SEMPRE precisa aplicar em parcela(s) ----------
            if ($tipo === 'PARCELA') {
                $restante = $valor;

                $parcelasAbertas = $parDAO->listarParcelasAbertasPorEmprestimo($emprestimoId);
                if (!$parcelasAbertas || count($parcelasAbertas) === 0) {
                    throw new InvalidArgumentException('Não há prestações em aberto para receber pagamento.');
                }

                // se veio parcela_id, começa por ela; se não, começa pela primeira aberta
                if ($parcelaId) {
                    // reordena: coloca a parcela escolhida primeiro
                    usort($parcelasAbertas, function ($a, $b) use ($parcelaId) {
                        if ((int)$a['id'] === $parcelaId) return -1;
                        if ((int)$b['id'] === $parcelaId) return 1;
                        return ((int)$a['numero_parcela'] <=> (int)$b['numero_parcela']);
                    });
                }

                $pagamentosCriados = [];

                foreach ($parcelasAbertas as $parcela) {
                    if ($restante <= 0) break;

                    $idParcela   = (int)$parcela['id'];
                    $valorParcela = (float)$parcela['valor_parcela'];
                    $valorPagoPar = (float)$parcela['valor_pago'];

                    $faltante = $valorParcela - $valorPagoPar;
                    if ($faltante <= 0) continue;

                    $pagarAqui = min($restante, $faltante);

                    // ✅ 1) cria pagamento COM parcela_id (senão dá erro)
                    $pagId = $this->criarPagamento(
                        $pagDAO,
                        $emprestimoId,
                        $idParcela,
                        'PARCELA',
                        $pagarAqui,
                        $obs
                    );

                    // ✅ 2) aplica na parcela
                    $parDAO->adicionarPagamentoNaParcela($idParcela, $pagarAqui);

                    $pagamentosCriados[] = [
                        'pagamento_id' => $pagId,
                        'parcela_id' => $idParcela,
                        'valor_pago' => $pagarAqui
                    ];

                    $restante -= $pagarAqui;
                }

                // se sobrou grana e não tem mais parcelas: registra como EXTRA (crédito)
                if ($restante > 0) {
                    $obsExtra = trim(($obs ? $obs . ' | ' : '') . 'Crédito excedente gerado automaticamente');
                    $pagIdExtra = $this->criarPagamento($pagDAO, $emprestimoId, null, 'EXTRA', $restante, $obsExtra);

                    $pagamentosCriados[] = [
                        'pagamento_id' => $pagIdExtra,
                        'parcela_id' => null,
                        'valor_pago' => $restante,
                        'tipo_pagamento' => 'EXTRA'
                    ];
                }

                // depois de aplicar, se não existir mais parcelas abertas -> marca quitado
                $aindaAbertas = $parDAO->listarParcelasAbertasPorEmprestimo($emprestimoId);
                if (!$aindaAbertas || count($aindaAbertas) === 0) {
                    $empDAO->atualizarStatus($emprestimoId, 'QUITADO');
                }

                $this->responderJson(true, 'Pagamento lançado', [
                    'tipo_pagamento' => 'PARCELA',
                    'valor_total' => $valor,
                    'pagamentos' => $pagamentosCriados
                ]);
                return;
            }

            throw new InvalidArgumentException('Fluxo não tratado.');

        } catch (Exception $e) {
            $this->responderJson(false, $e->getMessage());
        }
    }

    private function criarPagamento(PagamentoDAO $pagDAO, int $emprestimoId, ?int $parcelaId, string $tipo, float $valor, ?string $obs): int
    {
        $p = new Pagamento();
        $p->setEmprestimoId($emprestimoId);
        $p->setParcelaId($parcelaId);
        $p->setValorPago($valor);
        $p->setTipoPagamento($tipo);
        $p->setObservacao($obs);

        return $pagDAO->criar($p);
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
