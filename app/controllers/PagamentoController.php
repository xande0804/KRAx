<?php

require_once __DIR__ . '/../models/entities/Pagamento.php';
require_once __DIR__ . '/../models/daos/PagamentoDAO.php';
require_once __DIR__ . '/../models/daos/ParcelaDAO.php';
require_once __DIR__ . '/../models/daos/EmprestimoDAO.php';
require_once __DIR__ . '/../../app/config/database.php';

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
            // QUITAÇÃO (NOVA REGRA):
            // Quitação = saldoParcelasAbertas - (qtdRestantes - 1) * jurosUnit
            // Onde:
            // - saldoParcelasAbertas = Σ (valor_parcela - valor_pago) das parcelas abertas
            // - jurosUnit:
            //    MENSAL: principal * (jurosPct/100)
            //    DIARIO/SEMANAL: (principal * (jurosPct/100)) / qtdParcelas
            //
            // ✅ Sempre cobra 1 juros (não importa se já pagou JUROS antes).
            // =========================================================
            if ($tipo === 'QUITACAO') {
                $parcelasAbertas = $parDAO->listarParcelasAbertasPorEmprestimo($emprestimoId);

                $faltanteParcelas = 0.0;
                $qtdRestantes = 0;

                foreach ($parcelasAbertas as $parcela) {
                    $vpar = (float)($parcela['valor_parcela'] ?? 0);
                    $vpago = (float)($parcela['valor_pago'] ?? 0);
                    $falt = $vpar - $vpago;
                    if ($falt > 0) {
                        $faltanteParcelas += $falt;
                        $qtdRestantes++;
                    }
                }

                if ($qtdRestantes <= 0 || $faltanteParcelas <= 0) {
                    throw new InvalidArgumentException('Não há saldo pendente para quitar.');
                }

                $emp = $empDAO->buscarPorId($emprestimoId);
                if (!$emp) {
                    throw new RuntimeException('Empréstimo não encontrado.');
                }

                $principal = (float)$emp->getValorPrincipal();
                $jurosPct  = (float)$emp->getPorcentagemJuros();
                $qtdTotal  = max(1, (int)$emp->getQuantidadeParcelas());

                $tipoV = strtoupper(trim((string)$emp->getTipoVencimento()));

                $jurosTotalContrato = $principal * ($jurosPct / 100);

                // juros unitário por prestação
                if ($tipoV === 'MENSAL') {
                    $jurosUnit = $jurosTotalContrato; // ex: 300
                } else {
                    $jurosUnit = $jurosTotalContrato / $qtdTotal; // ex: 300/4 = 75
                }

                // ✅ regra final: remove juros futuros embutidos e deixa só 1 juros
                $totalQuitacao = $faltanteParcelas - (($qtdRestantes - 1) * $jurosUnit);

                // proteção contra arredondamento / casos extremos
                if ($totalQuitacao < 0) $totalQuitacao = 0;

                // arredonda em 2 casas (dinheiro)
                $totalQuitacao = round($totalQuitacao, 2);

                if ($totalQuitacao <= 0) {
                    throw new InvalidArgumentException('Não há saldo pendente para quitar.');
                }

                $valor = $totalQuitacao;

                if (!$obs) {
                    $obs = 'Quitação (parcelas restantes + 1 juros)';
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

                // cria pagamento
                $pagId = $this->criarPagamento(
                    $pagDAO,
                    $emprestimoId,
                    $parcelaId,
                    $tipo,
                    $valor,
                    $dataPagamento,
                    $obs
                );

                // ✅ REGRA: se pagou JUROS, adia o "cronograma" (todas as parcelas em aberto)
                // - DIARIO: +1 dia
                // - SEMANAL: +7 dias
                // - MENSAL: +1 mês
                $adiou = false;
                $parcelasAdiadaIds = [];
                $novasDatas = [];

                if ($tipo === 'JUROS') {
                    $emp = $empDAO->buscarPorId($emprestimoId);
                    if (!$emp) {
                        throw new RuntimeException('Empréstimo não encontrado.');
                    }

                    $tipoV = strtoupper(trim((string)$emp->getTipoVencimento()));

                    // pega a "próxima" aberta
                    $prox = $parDAO->buscarProximaParcelaAbertaPorEmprestimo($emprestimoId);

                    if ($prox && !empty($prox['numero_parcela'])) {
                        $numProx = (int)$prox['numero_parcela'];

                        // pega TODAS as parcelas abertas ordenadas por numero_parcela
                        $abertas = $parDAO->listarParcelasAbertasPorEmprestimo($emprestimoId);

                        foreach ($abertas as $parc) {
                            $idParc = (int)($parc['id'] ?? 0);
                            $numParc = (int)($parc['numero_parcela'] ?? 0);
                            $dvRaw = (string)($parc['data_vencimento'] ?? '');

                            // só adia a partir da próxima (inclusive)
                            if ($idParc <= 0 || $numParc < $numProx) continue;
                            if (!$dvRaw) continue;

                            $dt = new DateTime(substr($dvRaw, 0, 10));

                            if ($tipoV === 'DIARIO') {
                                $dt->modify('+1 day');
                            } elseif ($tipoV === 'SEMANAL') {
                                $dt->modify('+7 day');
                            } elseif ($tipoV === 'MENSAL') {
                                $dt->modify('+1 month');
                            } else {
                                // tipo desconhecido: não faz nada
                                continue;
                            }

                            $nova = $dt->format('Y-m-d');
                            $parDAO->atualizarDataVencimento($idParc, $nova);

                            $adiou = true;
                            $parcelasAdiadaIds[] = $idParc;
                            $novasDatas[] = [
                                'parcela_id' => $idParc,
                                'numero_parcela' => $numParc,
                                'nova_data_vencimento' => $nova
                            ];
                        }
                    }
                }

                $this->responderJson(true, 'Pagamento lançado', [
                    'pagamento_id'   => $pagId,
                    'valor_pago'     => $valor,
                    'tipo_pagamento' => $tipo,
                    'data_pagamento' => $dataPagamento,

                    // debug útil
                    'adiou_cronograma' => $adiou,
                    'parcelas_adiadas_ids' => $parcelasAdiadaIds,
                    'parcelas_adiadas' => $novasDatas
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

                // INTEGRAL: paga tudo que falta nas parcelas (como antes)
                if ($tipo === 'INTEGRAL') {
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

                // QUITACAO (NOVA REGRA):
                // - Distribui o valor pago nas parcelas abertas (sem "inventar" pagamento)
                // - Depois fecha o empréstimo e marca parcelas restantes como QUITADA
                $restante = $valor;

                $parcelasAbertas = $parDAO->listarParcelasAbertasPorEmprestimo($emprestimoId);

                foreach ($parcelasAbertas as $parcela) {
                    if ($restante <= 0) break;

                    $idParcela    = (int)($parcela['id'] ?? 0);
                    $valorParcela = (float)($parcela['valor_parcela'] ?? 0);
                    $valorPagoPar = (float)($parcela['valor_pago'] ?? 0);

                    if ($idParcela <= 0) continue;

                    $faltante = $valorParcela - $valorPagoPar;
                    if ($faltante <= 0) continue;

                    $pagarAqui = min($restante, $faltante);
                    if ($pagarAqui <= 0) continue;

                    $parDAO->adicionarPagamentoNaParcela($idParcela, $pagarAqui);
                    $restante -= $pagarAqui;
                }

                // Marca o resto como QUITADA para não ficar em aberto no sistema
                // (mesmo que o valor_pago não tenha batido 100% da prestação — pois foi quitação com desconto)
                $pdo = Database::conectar();
                $stmt = $pdo->prepare("
                    UPDATE parcelas
                    SET status = 'QUITADA',
                        pago_em = CASE WHEN pago_em IS NULL THEN NOW() ELSE pago_em END
                    WHERE emprestimo_id = :eid
                      AND status IN ('ABERTA','PARCIAL','ATRASADA','ATRASADO')
                ");
                $stmt->execute([':eid' => $emprestimoId]);

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

                // ✅ CORREÇÃO PRINCIPAL:
                // Em vez de depender do listarParcelasAbertasPorEmprestimo (que pode filtrar por status),
                // usamos TODAS as parcelas do empréstimo e consideramos "em aberto" quem tem valor_pago < valor_parcela.
                $todas = $parDAO->listarPorEmprestimo($emprestimoId);

                if (!$todas || count($todas) === 0) {
                    throw new InvalidArgumentException('Nenhuma parcela encontrada para este empréstimo.');
                }

                $parcelasAlvo = array_values(array_filter($todas, function ($p) {
                    $st = strtoupper(trim((string)($p['status'] ?? '')));
                    $vpar = (float)($p['valor_parcela'] ?? 0);
                    $vp = (float)($p['valor_pago'] ?? 0);

                    // se não tem valor_parcela, não tem como ratear corretamente
                    if ($vpar <= 0) return false;

                    // já quitada/paga: ignora
                    if (in_array($st, ['PAGA', 'QUITADA'], true)) return false;

                    // "em aberto" = falta pagar algum valor
                    return $vp < $vpar;
                }));

                if (!$parcelasAlvo || count($parcelasAlvo) === 0) {
                    throw new InvalidArgumentException('Não há prestações em aberto para receber pagamento.');
                }

                // ordena por numero_parcela
                usort($parcelasAlvo, function ($a, $b) {
                    return ((int)($a['numero_parcela'] ?? 0)) <=> ((int)($b['numero_parcela'] ?? 0));
                });

                // se veio parcelaId, coloca ela como primeira (e mantém as demais em ordem)
                if ($parcelaId) {
                    usort($parcelasAlvo, function ($a, $b) use ($parcelaId) {
                        $ida = (int)($a['id'] ?? 0);
                        $idb = (int)($b['id'] ?? 0);

                        if ($ida === $parcelaId) return -1;
                        if ($idb === $parcelaId) return 1;

                        return ((int)($a['numero_parcela'] ?? 0)) <=> ((int)($b['numero_parcela'] ?? 0));
                    });
                }

                $pagamentosCriados = [];

                foreach ($parcelasAlvo as $parcela) {
                    if ($restante <= 0) break;

                    $idParcela     = (int)($parcela['id'] ?? 0);
                    $valorParcela  = (float)($parcela['valor_parcela'] ?? 0);
                    $valorPagoPar  = (float)($parcela['valor_pago'] ?? 0);

                    if ($idParcela <= 0) continue;

                    $faltante = $valorParcela - $valorPagoPar;
                    if ($faltante <= 0) continue;

                    $pagarAqui = min($restante, $faltante);
                    if ($pagarAqui <= 0) continue;

                    // registra pagamento vinculado à parcela
                    $pagId = $this->criarPagamento(
                        $pagDAO,
                        $emprestimoId,
                        $idParcela,
                        'PARCELA',
                        $pagarAqui,
                        $dataPagamento,
                        $obs
                    );

                    // atualiza parcela
                    $parDAO->adicionarPagamentoNaParcela($idParcela, $pagarAqui);

                    $pagamentosCriados[] = [
                        'pagamento_id' => $pagId,
                        'parcela_id'   => $idParcela,
                        'valor_pago'   => $pagarAqui,
                        'data_pagamento' => $dataPagamento,
                    ];

                    $restante -= $pagarAqui;
                }

                // se ainda sobrou, aí sim vira crédito EXTRA (só quando não existe mais parcela para abater)
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

                // verifica se ainda existe alguma parcela "em aberto"
                $todasDepois = $parDAO->listarPorEmprestimo($emprestimoId);
                $aindaFalta = false;

                foreach ($todasDepois as $p) {
                    $st = strtoupper(trim((string)($p['status'] ?? '')));
                    $vpar = (float)($p['valor_parcela'] ?? 0);
                    $vp = (float)($p['valor_pago'] ?? 0);

                    if ($vpar > 0 && !in_array($st, ['PAGA', 'QUITADA'], true) && $vp < $vpar) {
                        $aindaFalta = true;
                        break;
                    }
                }

                if (!$aindaFalta) {
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
