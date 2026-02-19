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
            // ✅ QUITAÇÃO (REGRA CERTA E SINCRONIZADA COM O FRONT):
            //
            // DIÁRIO/SEMANAL:
            //   quitação = totalComJuros - SOMENTE parcelas pagas cheias
            //   (pagamento JUROS não abate)
            //
            // MENSAL:
            //   quitação = saldoParcelasAbertas - (qtdRestantes - 1) * jurosUnit
            //   (parcelas restantes + 1 juros)  [sua regra]
            // =========================================================
            if ($tipo === 'QUITACAO') {

                $emp = $empDAO->buscarPorId($emprestimoId);
                if (!$emp) {
                    throw new RuntimeException('Empréstimo não encontrado.');
                }

                $principal = (float)$emp->getValorPrincipal();
                $jurosPct  = (float)$emp->getPorcentagemJuros();
                $qtdTotal  = max(1, (int)$emp->getQuantidadeParcelas());
                $tipoV = strtoupper(trim((string)$emp->getTipoVencimento()));

                // ✅ DIÁRIO/SEMANAL: total c/juros - apenas parcelas pagas 100%
                if ($tipoV === 'DIARIO' || $tipoV === 'SEMANAL') {

                    // total do contrato
                    $totalComJuros = $principal * (1 + ($jurosPct / 100));

                    // soma SOMENTE das parcelas pagas cheias (pela tabela parcelas)
                    $todasParcelas = $parDAO->listarPorEmprestimo($emprestimoId);

                    $totalParcelasPagasCheias = 0.0;

                    foreach ($todasParcelas as $p) {
                        $st = strtoupper(trim((string)($p['status'] ?? '')));
                        $vpar = (float)($p['valor_parcela'] ?? 0);
                        $vp = (float)($p['valor_pago'] ?? 0);

                        if ($vpar <= 0) continue;

                        // paga cheia se status ou vp >= vpar (tolerância mínima)
                        $pagaCheia = in_array($st, ['PAGA', 'QUITADA'], true) || ($vp + 0.00001 >= $vpar);

                        if ($pagaCheia) {
                            $totalParcelasPagasCheias += $vpar;
                        }
                    }

                    $totalQuitacao = $totalComJuros - $totalParcelasPagasCheias;
                    $totalQuitacao = round(max(0, $totalQuitacao), 2);

                    if ($totalQuitacao <= 0) {
                        throw new InvalidArgumentException('Não há saldo pendente para quitar.');
                    }

                    $valor = $totalQuitacao;

                    if (!$obs) {
                        $obs = 'Quitação = total c/juros − apenas parcelas pagas (juros pagos não abatem)';
                    }

                } else {
                    // ✅ MENSAL: sua regra (parcelas restantes + 1 juros)

                    $parcelasAbertas = $parDAO->listarParcelasAbertasPorEmprestimo($emprestimoId);

                    $faltanteParcelas = 0.0;
                    $qtdRestantes = 0;

                    foreach ($parcelasAbertas as $parcela) {
                        $vpar  = (float)($parcela['valor_parcela'] ?? 0);
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

                    $jurosTotalContrato = $principal * ($jurosPct / 100);

                    // mensal: juros por prestação é fixo (ex: 300)
                    $jurosUnit = $jurosTotalContrato;

                    // regra: remove juros futuros embutidos e deixa só 1 juros
                    $totalQuitacao = $faltanteParcelas - (($qtdRestantes - 1) * $jurosUnit);
                    if ($totalQuitacao < 0) $totalQuitacao = 0;

                    $totalQuitacao = round($totalQuitacao, 2);

                    if ($totalQuitacao <= 0) {
                        throw new InvalidArgumentException('Não há saldo pendente para quitar.');
                    }

                    $valor = $totalQuitacao;

                    if (!$obs) {
                        $obs = 'Quitação (parcelas restantes + 1 juros)';
                    }
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

                // ✅ regra de adiar cronograma (mantida)
                $adiou = false;
                $parcelasAdiadaIds = [];
                $novasDatas = [];

                if ($tipo === 'JUROS') {
                    $emp = $empDAO->buscarPorId($emprestimoId);
                    if (!$emp) {
                        throw new RuntimeException('Empréstimo não encontrado.');
                    }

                    $tipoV = strtoupper(trim((string)$emp->getTipoVencimento()));
                    $prox = $parDAO->buscarProximaParcelaAbertaPorEmprestimo($emprestimoId);

                    if ($prox && !empty($prox['numero_parcela'])) {
                        $numProx = (int)$prox['numero_parcela'];
                        $abertas = $parDAO->listarParcelasAbertasPorEmprestimo($emprestimoId);

                        foreach ($abertas as $parc) {
                            $idParc = (int)($parc['id'] ?? 0);
                            $numParc = (int)($parc['numero_parcela'] ?? 0);
                            $dvRaw = (string)($parc['data_vencimento'] ?? '');

                            if ($idParc <= 0 || $numParc < $numProx) continue;
                            if (!$dvRaw) continue;

                            $dt = new DateTime(substr($dvRaw, 0, 10));

                            if ($tipoV === 'DIARIO') $dt->modify('+1 day');
                            elseif ($tipoV === 'SEMANAL') $dt->modify('+7 day');
                            elseif ($tipoV === 'MENSAL') $dt->modify('+1 month');
                            else continue;

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

                // INTEGRAL: paga tudo que falta
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

                // QUITACAO:
                // distribui o valor nas parcelas abertas e marca restantes como QUITADA
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

                $todas = $parDAO->listarPorEmprestimo($emprestimoId);

                if (!$todas || count($todas) === 0) {
                    throw new InvalidArgumentException('Nenhuma parcela encontrada para este empréstimo.');
                }

                $parcelasAlvo = array_values(array_filter($todas, function ($p) {
                    $st = strtoupper(trim((string)($p['status'] ?? '')));
                    $vpar = (float)($p['valor_parcela'] ?? 0);
                    $vp = (float)($p['valor_pago'] ?? 0);

                    if ($vpar <= 0) return false;
                    if (in_array($st, ['PAGA', 'QUITADA'], true)) return false;
                    return $vp < $vpar;
                }));

                if (!$parcelasAlvo || count($parcelasAlvo) === 0) {
                    throw new InvalidArgumentException('Não há prestações em aberto para receber pagamento.');
                }

                usort($parcelasAlvo, function ($a, $b) {
                    return ((int)($a['numero_parcela'] ?? 0)) <=> ((int)($b['numero_parcela'] ?? 0));
                });

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

    /**
     * ✅ Editar pagamento (seguro):
     * - Permite editar: data_pagamento, valor_pago, observacao, parcela_id (somente se for PARCELA)
     * - BLOQUEIA: mudança de tipo e edição de QUITACAO/INTEGRAL (por enquanto)
     * - Reverte/aplica impacto em parcelas quando tipo = PARCELA
     */
    public function atualizar(): void
    {
        try {
            $pagamentoId = (int)($_POST['pagamento_id'] ?? 0);

            // campos novos
            $dataPagamento = trim((string)($_POST['data_pagamento'] ?? ''));
            if ($dataPagamento === '') $dataPagamento = date('Y-m-d');

            $valor = $this->parseMoneyBR($_POST['valor_pago'] ?? 0);
            $obs = isset($_POST['observacao']) ? trim((string)$_POST['observacao']) : null;

            $parcelaIdNova = isset($_POST['parcela_id']) && $_POST['parcela_id'] !== ''
                ? (int)$_POST['parcela_id']
                : null;

            if ($pagamentoId <= 0) throw new InvalidArgumentException('pagamento_id inválido.');
            if ($valor <= 0) throw new InvalidArgumentException('valor_pago inválido.');

            $pagDAO = new PagamentoDAO();
            $empDAO = new EmprestimoDAO();

            $pdo = $pagDAO->getPdo();
            $pdo->beginTransaction();

            $old = $pagDAO->buscarPorId($pagamentoId);
            if (!$old) throw new RuntimeException('Pagamento não encontrado.');

            $emprestimoId = (int)($old['emprestimo_id'] ?? 0);
            $tipo = strtoupper(trim((string)($old['tipo_pagamento'] ?? '')));

            if ($emprestimoId <= 0) throw new RuntimeException('Pagamento inválido (emprestimo_id).');

            // Por segurança, não deixamos editar tipo agora
            $tipoNovo = strtoupper(trim((string)($_POST['tipo_pagamento'] ?? '')));
            if ($tipoNovo !== '' && $tipoNovo !== $tipo) {
                throw new InvalidArgumentException('Não é permitido alterar o tipo do pagamento na edição.');
            }

            // Bloqueia tipos perigosos
            if (in_array($tipo, ['QUITACAO', 'INTEGRAL'], true)) {
                throw new InvalidArgumentException('Edição não permitida para QUITACAO/INTEGRAL. Use correção (estorno + novo).');
            }

            $oldParcelaId = isset($old['parcela_id']) && $old['parcela_id'] !== null ? (int)$old['parcela_id'] : null;
            $oldValor = (float)($old['valor_pago'] ?? 0);

            // ===== Reverte impacto antigo em parcela (se tipo PARCELA) =====
            if ($tipo === 'PARCELA') {
                if (!$oldParcelaId || $oldParcelaId <= 0) {
                    throw new RuntimeException('Pagamento PARCELA sem parcela_id (dados inconsistentes).');
                }
                $this->ajustarPagamentoNaParcelaTx($pdo, $oldParcelaId, -abs($oldValor));
            }

            // ===== Aplica impacto novo =====
            if ($tipo === 'PARCELA') {
                if (!$parcelaIdNova || $parcelaIdNova <= 0) {
                    throw new InvalidArgumentException('Para pagamento tipo PARCELA, informe parcela_id.');
                }
                $this->ajustarPagamentoNaParcelaTx($pdo, $parcelaIdNova, +abs($valor));
            } else {
                // JUROS / EXTRA: não afeta parcelas (e também NÃO mexe no cronograma na edição)
                $parcelaIdNova = null;
            }

            // Atualiza registro do pagamento
            $okUpd = $pagDAO->atualizar(
                $pagamentoId,
                $parcelaIdNova,
                $dataPagamento,
                (float)$valor,
                $tipo,
                $obs
            );

            if (!$okUpd) {
                throw new RuntimeException('Falha ao atualizar pagamento.');
            }

            // Recalcula status do empréstimo (pode reabrir se antes estava QUITADO)
            $this->recalcularStatusEmprestimoTx($pdo, $empDAO, $emprestimoId);

            $pdo->commit();

            $this->responderJson(true, 'Pagamento atualizado', [
                'pagamento_id' => $pagamentoId,
                'emprestimo_id' => $emprestimoId,
                'tipo_pagamento' => $tipo,
                'parcela_id' => $parcelaIdNova,
                'valor_pago' => $valor,
                'data_pagamento' => $dataPagamento
            ]);
        } catch (Exception $e) {
            // tenta rollback se necessário
            try {
                if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
                    $pdo->rollBack();
                }
            } catch (Throwable $t) { /* ignora */ }

            $this->responderJson(false, $e->getMessage());
        }
    }

    /**
     * ✅ Excluir pagamento (seguro):
     * - Reverte impacto em parcelas (se tipo PARCELA)
     * - Bloqueia QUITACAO/INTEGRAL por segurança (por enquanto)
     */
    public function excluir(): void
    {
        try {
            $pagamentoId = (int)($_POST['pagamento_id'] ?? 0);
            if ($pagamentoId <= 0) throw new InvalidArgumentException('pagamento_id inválido.');

            $pagDAO = new PagamentoDAO();
            $empDAO = new EmprestimoDAO();

            $pdo = $pagDAO->getPdo();
            $pdo->beginTransaction();

            $old = $pagDAO->buscarPorId($pagamentoId);
            if (!$old) throw new RuntimeException('Pagamento não encontrado.');

            $emprestimoId = (int)($old['emprestimo_id'] ?? 0);
            $tipo = strtoupper(trim((string)($old['tipo_pagamento'] ?? '')));

            if ($emprestimoId <= 0) throw new RuntimeException('Pagamento inválido (emprestimo_id).');

            if (in_array($tipo, ['QUITACAO', 'INTEGRAL'], true)) {
                throw new InvalidArgumentException('Exclusão não permitida para QUITACAO/INTEGRAL. Use correção (estorno + novo).');
            }

            $oldParcelaId = isset($old['parcela_id']) && $old['parcela_id'] !== null ? (int)$old['parcela_id'] : null;
            $oldValor = (float)($old['valor_pago'] ?? 0);

            // reverte impacto
            if ($tipo === 'PARCELA') {
                if (!$oldParcelaId || $oldParcelaId <= 0) {
                    throw new RuntimeException('Pagamento PARCELA sem parcela_id (dados inconsistentes).');
                }
                $this->ajustarPagamentoNaParcelaTx($pdo, $oldParcelaId, -abs($oldValor));
            }

            $okDel = $pagDAO->excluir($pagamentoId);
            if (!$okDel) throw new RuntimeException('Falha ao excluir pagamento.');

            $this->recalcularStatusEmprestimoTx($pdo, $empDAO, $emprestimoId);

            $pdo->commit();

            $this->responderJson(true, 'Pagamento excluído', [
                'pagamento_id' => $pagamentoId,
                'emprestimo_id' => $emprestimoId,
                'tipo_pagamento' => $tipo
            ]);
        } catch (Exception $e) {
            try {
                if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
                    $pdo->rollBack();
                }
            } catch (Throwable $t) { /* ignora */ }

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
        $p->setDataPagamento($dataPagamento);
        $p->setObservacao($obs);

        return $pagDAO->criar($p);
    }

    /**
     * Ajuste atômico de valor_pago/status/pago_em usando o MESMO PDO da transação.
     * Delta pode ser + ou -.
     */
    private function ajustarPagamentoNaParcelaTx(PDO $pdo, int $parcelaId, float $delta): void
    {
        if ($parcelaId <= 0) throw new InvalidArgumentException('parcela_id inválido.');
        if (!is_finite($delta) || $delta == 0.0) return;

        $stmtSel = $pdo->prepare("SELECT valor_parcela, COALESCE(valor_pago,0) AS valor_pago, pago_em
                                  FROM parcelas WHERE id = :id LIMIT 1");
        $stmtSel->execute([':id' => $parcelaId]);
        $row = $stmtSel->fetch(PDO::FETCH_ASSOC);
        if (!$row) throw new RuntimeException('Parcela não encontrada.');

        $valorParcela = round((float)($row['valor_parcela'] ?? 0), 2);
        $valorAtual   = round((float)($row['valor_pago'] ?? 0), 2);

        $novo = round($valorAtual + $delta, 2);
        if ($novo < 0) $novo = 0.0;
        if ($valorParcela > 0 && $novo > $valorParcela) $novo = $valorParcela;

        if ($valorParcela > 0 && $novo + 0.00001 >= $valorParcela) {
            $novo = $valorParcela;
            $status = 'PAGA';

            $stmtUpd = $pdo->prepare("
                UPDATE parcelas
                SET valor_pago = :vp,
                    status = :st,
                    pago_em = CASE WHEN pago_em IS NULL THEN NOW() ELSE pago_em END
                WHERE id = :id
            ");
            $stmtUpd->execute([':vp' => $novo, ':st' => $status, ':id' => $parcelaId]);
            return;
        }

        if ($novo > 0) {
            $status = 'PARCIAL';
            $stmtUpd = $pdo->prepare("
                UPDATE parcelas
                SET valor_pago = :vp,
                    status = :st,
                    pago_em = NULL
                WHERE id = :id
            ");
            $stmtUpd->execute([':vp' => $novo, ':st' => $status, ':id' => $parcelaId]);
            return;
        }

        $status = 'ABERTA';
        $stmtUpd = $pdo->prepare("
            UPDATE parcelas
            SET valor_pago = :vp,
                status = :st,
                pago_em = NULL
            WHERE id = :id
        ");
        $stmtUpd->execute([':vp' => 0, ':st' => $status, ':id' => $parcelaId]);
    }

    /**
     * Recalcula status do empréstimo:
     * - se existir alguma parcela com valor_pago < valor_parcela => ATIVO
     * - senão => QUITADO
     */
    private function recalcularStatusEmprestimoTx(PDO $pdo, EmprestimoDAO $empDAO, int $emprestimoId): void
    {
        $stmt = $pdo->prepare("
            SELECT COUNT(*) AS abertas
            FROM parcelas
            WHERE emprestimo_id = :eid
              AND ROUND(COALESCE(valor_pago,0),2) < ROUND(COALESCE(valor_parcela,0),2)
        ");
        $stmt->execute([':eid' => $emprestimoId]);
        $abertas = (int)($stmt->fetchColumn() ?? 0);

        $novoStatus = ($abertas > 0) ? 'ATIVO' : 'QUITADO';
        $empDAO->atualizarStatus($emprestimoId, $novoStatus);
    }

    private function parseMoneyBR($v): float
    {
        if (is_int($v) || is_float($v)) return (float)$v;

        $s = trim((string)$v);
        if ($s === '') return 0.0;

        $s = str_replace(['R$', ' ', "\u{00A0}"], '', $s);
        $s = preg_replace('/[^0-9,\.\-]/', '', $s);

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
