<?php

require_once __DIR__ . '/../models/dtos/EmprestimoDTO.php';
require_once __DIR__ . '/../models/entities/Emprestimo.php';
require_once __DIR__ . '/../models/entities/Parcela.php';
require_once __DIR__ . '/../models/daos/EmprestimoDAO.php';
require_once __DIR__ . '/../models/daos/ParcelaDAO.php';
require_once __DIR__ . '/../models/daos/PagamentoDAO.php';
require_once __DIR__ . '/../models/daos/ClienteDAO.php';
require_once __DIR__ . '/../../app/config/database.php';

class EmprestimoController
{
    public function criar(): void
    {
        try {
            $dto = new EmprestimoDTO($_POST);
            $dto->validar();

            $e = new Emprestimo();
            $e->setClienteId($dto->cliente_id);
            $e->setDataEmprestimo($dto->data_emprestimo);
            $e->setValorPrincipal($dto->valor_principal);
            $e->setPorcentagemJuros($dto->porcentagem_juros);
            $e->setQuantidadeParcelas($dto->quantidade_parcelas);
            $e->setTipoVencimento($dto->tipo_vencimento);
            $e->setRegraVencimento($dto->regra_vencimento);
            $e->setGrupo($dto->grupo);

            $emprestimoDao = new EmprestimoDAO();
            $emprestimoId = $emprestimoDao->criar($e);

            $parcelaDao = new ParcelaDAO();

            $principal = (float)$dto->valor_principal;
            $qtd       = (int)$dto->quantidade_parcelas;
            $jurosPct  = (float)$dto->porcentagem_juros;
            $tipoV     = strtoupper(trim($dto->tipo_vencimento));

            if ($qtd <= 0) {
                throw new InvalidArgumentException("Quantidade de parcelas inválida.");
            }

            $jurosPctF  = $jurosPct / 100;

            if ($tipoV === 'MENSAL') {
                $jurosInteiro = $principal * $jurosPctF;
                $totalComJuros = $principal + ($jurosInteiro * $qtd);
            } else {
                $totalComJuros = $principal * (1 + $jurosPctF);
            }

            $totalComJurosC = (int) round($totalComJuros * 100);

            $baseC  = intdiv($totalComJurosC, $qtd);
            $restoC = $totalComJurosC - ($baseC * $qtd);

            for ($i = 1; $i <= $qtd; $i++) {
                $p = new Parcela();
                $p->setEmprestimoId($emprestimoId);
                $p->setNumeroParcela($i);

                $valorParcelaC = ($i === $qtd) ? ($baseC + $restoC) : $baseC;
                $valorParcela  = $valorParcelaC / 100;

                $p->setValorParcela($valorParcela);
                $p->setValorPago(0);
                $p->setStatus('ABERTA');

                $venc = $this->calcularVencimento(
                    $dto->data_emprestimo,
                    $dto->tipo_vencimento,
                    $dto->regra_vencimento,
                    $i
                );

                $p->setDataVencimento($venc);

                $parcelaDao->criar($p);
            }

            $this->responderJson(true, 'Empréstimo criado com parcelas', [
                'emprestimo_id' => (int)$emprestimoId,
                'grupo' => $e->getGrupo(),
            ]);
        } catch (Exception $e) {
            $this->responderJson(false, $e->getMessage());
        }
    }

    public function atualizar(): void
    {
        try {
            $id = isset($_POST['emprestimo_id']) ? (int)$_POST['emprestimo_id'] : 0;
            if ($id <= 0) throw new InvalidArgumentException("emprestimo_id inválido.");

            $qtdNova = isset($_POST['quantidade_parcelas']) ? (int)$_POST['quantidade_parcelas'] : 0;
            if ($qtdNova <= 0) throw new InvalidArgumentException("Quantidade de parcelas inválida.");

            $jurosPctNovo = isset($_POST['porcentagem_juros']) ? (float)$_POST['porcentagem_juros'] : -1;
            if ($jurosPctNovo < 0) throw new InvalidArgumentException("Juros (%) inválido.");

            $regraPost = isset($_POST['regra_vencimento']) ? trim((string)$_POST['regra_vencimento']) : '';
            $grupoNovo = strtoupper(trim((string)($_POST['grupo'] ?? 'PADRAO')));
            if ($grupoNovo === '') $grupoNovo = 'PADRAO';

            if (!in_array($grupoNovo, ['PADRAO', 'MARIA'], true)) {
                throw new InvalidArgumentException("Grupo inválido.");
            }

            $empDAO = new EmprestimoDAO();
            $parDAO = new ParcelaDAO();

            $emp = $empDAO->buscarPorId($id);
            if (!$emp) throw new RuntimeException("Empréstimo não encontrado.");

            $statusEmp = strtoupper(trim($emp->getStatus() ?? ''));
            if ($statusEmp === 'QUITADO') {
                throw new RuntimeException("Não é possível editar um empréstimo quitado.");
            }

            $tipoV   = strtoupper(trim((string)$emp->getTipoVencimento()));
            $dataEmp = (string)$emp->getDataEmprestimo();

            if ($regraPost === '') {
                throw new InvalidArgumentException("Informe a regra do vencimento para alterar.");
            }
            $regraNova = $this->validarRegraVencimentoParaTipo($tipoV, $regraPost, $dataEmp);

            $parcelasExistentes = $parDAO->listarPorEmprestimo($id);

            $pagas = [];
            $naoPagas = [];

            foreach ($parcelasExistentes as $p) {
                $st = strtoupper(trim((string)($p['status'] ?? '')));
                $valorPago = (float)($p['valor_pago'] ?? 0);
                $valorParcela = (float)($p['valor_parcela'] ?? 0);

                $isPaga = in_array($st, ['PAGA', 'QUITADA'], true) || ($valorParcela > 0 && $valorPago >= $valorParcela);

                if ($isPaga) $pagas[] = $p;
                else $naoPagas[] = $p;
            }

            $qtdPagas = count($pagas);

            if ($qtdNova < $qtdPagas) {
                throw new InvalidArgumentException("Não dá pra reduzir para {$qtdNova} parcelas: já existem {$qtdPagas} parcelas pagas.");
            }

            $principal = (float)$emp->getValorPrincipal();

            $qtdAntiga = (int)$emp->getQuantidadeParcelas();
            $jurosPctAntigo = (float)$emp->getPorcentagemJuros();

            $totalAntigo = 0.0;
            if ($tipoV === 'MENSAL') {
                $jurosUnitOld = $principal * ($jurosPctAntigo / 100);
                $totalAntigo = $principal + ($jurosUnitOld * max(1, $qtdAntiga));
            } else {
                $totalAntigo = $principal * (1 + ($jurosPctAntigo / 100));
            }
            $totalAntigo = round($totalAntigo, 2);

            $totalNovo = 0.0;
            if ($tipoV === 'MENSAL') {
                $jurosUnitNew = $principal * ($jurosPctNovo / 100);
                $totalNovo = $principal + ($jurosUnitNew * max(1, $qtdNova));
            } else {
                $totalNovo = $principal * (1 + ($jurosPctNovo / 100));
            }
            $totalNovo = round($totalNovo, 2);

            $totalPagoConsiderado = 0.0;
            foreach ($parcelasExistentes as $p) {
                $vp = (float)($p['valor_pago'] ?? 0);
                $vpar = (float)($p['valor_parcela'] ?? 0);
                if ($vp <= 0) continue;
                $totalPagoConsiderado += min($vp, $vpar > 0 ? $vpar : $vp);
            }
            $totalPagoConsiderado = round($totalPagoConsiderado, 2);

            $pdo = Database::conectar();
            $pdo->beginTransaction();

            try {
                $stmtUp = $pdo->prepare("
                UPDATE emprestimos
                SET quantidade_parcelas = :qtd,
                    porcentagem_juros = :juros,
                    regra_vencimento = :regra,
                    grupo = :grupo
                WHERE id = :id
            ");
                $stmtUp->execute([
                    ':qtd'   => $qtdNova,
                    ':juros' => $jurosPctNovo,
                    ':regra' => $regraNova,
                    ':grupo' => $grupoNovo,
                    ':id'    => $id
                ]);

                $stmtSel = $pdo->prepare("
                SELECT id, numero_parcela, status, valor_pago, valor_parcela, data_vencimento
                FROM parcelas
                WHERE emprestimo_id = :id
                ORDER BY numero_parcela ASC, id ASC
            ");
                $stmtSel->execute([':id' => $id]);
                $rows = $stmtSel->fetchAll(PDO::FETCH_ASSOC);

                $rowsPagas = [];
                $rowsNaoPagas = [];

                foreach ($rows as $row) {
                    $st = strtoupper(trim((string)($row['status'] ?? '')));
                    $valorPago = (float)($row['valor_pago'] ?? 0);
                    $valorParcela = (float)($row['valor_parcela'] ?? 0);

                    $isPaga = in_array($st, ['PAGA', 'QUITADA'], true) || ($valorParcela > 0 && $valorPago >= $valorParcela);

                    if ($isPaga) $rowsPagas[] = $row;
                    else $rowsNaoPagas[] = $row;
                }

                $qtdPagasNow = count($rowsPagas);
                $qtdRestantes = $qtdNova - $qtdPagasNow;

                if (count($rowsNaoPagas) > $qtdRestantes) {
                    $excesso = array_slice($rowsNaoPagas, $qtdRestantes);
                    $stmtDel = $pdo->prepare("DELETE FROM parcelas WHERE id = :pid");
                    foreach ($excesso as $ex) {
                        $stmtDel->execute([':pid' => (int)$ex['id']]);
                    }
                    $rowsNaoPagas = array_slice($rowsNaoPagas, 0, $qtdRestantes);
                }

                if (count($rowsNaoPagas) < $qtdRestantes) {
                    $faltam = $qtdRestantes - count($rowsNaoPagas);

                    $maxNum = 0;
                    foreach ($rows as $r) {
                        $maxNum = max($maxNum, (int)$r['numero_parcela']);
                    }

                    $stmtIns = $pdo->prepare("
                    INSERT INTO parcelas
                    (emprestimo_id, numero_parcela, data_vencimento, valor_parcela, valor_pago, status)
                    VALUES
                    (:eid, :num, :dv, :vp, 0, 'ABERTA')
                ");

                    for ($k = 1; $k <= $faltam; $k++) {
                        $num = $maxNum + $k;
                        $dv = $this->calcularVencimento($dataEmp, $tipoV, $regraNova, $num);

                        $stmtIns->execute([
                            ':eid' => $id,
                            ':num' => $num,
                            ':dv'  => $dv,
                            ':vp'  => 0,
                        ]);
                    }

                    $stmtSel->execute([':id' => $id]);
                    $rows = $stmtSel->fetchAll(PDO::FETCH_ASSOC);

                    $rowsPagas = [];
                    $rowsNaoPagas = [];
                    foreach ($rows as $row) {
                        $st = strtoupper(trim((string)($row['status'] ?? '')));
                        $valorPago = (float)($row['valor_pago'] ?? 0);
                        $valorParcela = (float)($row['valor_parcela'] ?? 0);
                        $isPaga = in_array($st, ['PAGA', 'QUITADA'], true) || ($valorParcela > 0 && $valorPago >= $valorParcela);
                        if ($isPaga) $rowsPagas[] = $row;
                        else $rowsNaoPagas[] = $row;
                    }

                    $rowsNaoPagas = array_slice($rowsNaoPagas, 0, $qtdRestantes);
                }

                $stmtUpParc = $pdo->prepare("
                UPDATE parcelas
                SET numero_parcela = :num,
                    data_vencimento = :dv,
                    valor_parcela = :vp,
                    status = 'ABERTA'
                WHERE id = :pid
            ");

                if ($qtdRestantes > 0) {
                    if ($tipoV === 'MENSAL') {
                        $jurosUnit = $principal * ($jurosPctNovo / 100);

                        $principalAmortizado = 0.0;

                        foreach ($rowsPagas as $rp) {
                            $vp = (float)($rp['valor_pago'] ?? 0);
                            $vpar = (float)($rp['valor_parcela'] ?? 0);
                            $pago = min($vp, $vpar > 0 ? $vpar : $vp);

                            $am = $pago - $jurosUnit;
                            if ($am > 0) $principalAmortizado += $am;
                        }

                        foreach ($rowsNaoPagas as $rn) {
                            $vp = (float)($rn['valor_pago'] ?? 0);
                            if ($vp <= 0) continue;
                            $am = $vp - $jurosUnit;
                            if ($am > 0) $principalAmortizado += $am;
                        }

                        $principalRestante = max(0, $principal - $principalAmortizado);

                        $totalRestante = $principalRestante + ($jurosUnit * $qtdRestantes);
                        $totalRestC = (int) round($totalRestante * 100);
                        $baseC  = intdiv($totalRestC, $qtdRestantes);
                        $restoC = $totalRestC - ($baseC * $qtdRestantes);

                        for ($i = 0; $i < $qtdRestantes; $i++) {
                            $row = $rowsNaoPagas[$i];
                            $num = $qtdPagasNow + ($i + 1);
                            $dv = $this->calcularVencimento($dataEmp, $tipoV, $regraNova, $num);

                            $vpC = ($i === ($qtdRestantes - 1)) ? ($baseC + $restoC) : $baseC;
                            $vp  = $vpC / 100;

                            $stmtUpParc->execute([
                                ':num' => $num,
                                ':dv'  => $dv,
                                ':vp'  => $vp,
                                ':pid' => (int)$row['id'],
                            ]);
                        }
                    } else {
                        $saldoRestante = max(0, $totalNovo - $totalPagoConsiderado);

                        $saldoRestC = (int) round($saldoRestante * 100);
                        $baseC  = intdiv($saldoRestC, $qtdRestantes);
                        $restoC = $saldoRestC - ($baseC * $qtdRestantes);

                        for ($i = 0; $i < $qtdRestantes; $i++) {
                            $row = $rowsNaoPagas[$i];

                            $num = $qtdPagasNow + ($i + 1);
                            $dv  = $this->calcularVencimento($dataEmp, $tipoV, $regraNova, $num);

                            $vpC = ($i === ($qtdRestantes - 1)) ? ($baseC + $restoC) : $baseC;
                            $vp  = $vpC / 100;

                            $stmtUpParc->execute([
                                ':num' => $num,
                                ':dv'  => $dv,
                                ':vp'  => $vp,
                                ':pid' => (int)$row['id'],
                            ]);
                        }
                    }
                }

                $pdo->commit();

                $this->responderJson(true, "Empréstimo atualizado (parcelas pagas mantidas).", [
                    'total_antigo' => $totalAntigo,
                    'total_novo'   => $totalNovo,
                    'diferenca'    => round($totalNovo - $totalAntigo, 2),
                    'pagas'        => $qtdPagasNow,
                    'restantes'    => $qtdRestantes,
                    'qtd_total'    => $qtdNova,
                    'grupo'        => $grupoNovo,
                ]);
            } catch (Exception $e) {
                $pdo->rollBack();
                throw $e;
            }
        } catch (Exception $e) {
            $this->responderJson(false, $e->getMessage());
        }
    }

    private function normalizarRegraVencimentoParaUI(string $tipoV, string $regraRaw, array $parcelas): string
    {
        $tipo = strtoupper(trim($tipoV));
        $raw  = trim((string)$regraRaw);

        if ($tipo === 'SEMANAL') {
            return $raw;
        }

        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $raw)) {
            return $raw;
        }

        if (preg_match('/^\d{4}-\d{2}-\d{2}/', $raw)) {
            return substr($raw, 0, 10);
        }

        $firstDate = '';

        foreach ($parcelas as $p) {
            $num = isset($p['numero_parcela']) ? (int)$p['numero_parcela'] : 0;
            if ($num === 1 && !empty($p['data_vencimento'])) {
                $firstDate = substr((string)$p['data_vencimento'], 0, 10);
                break;
            }
        }

        if (!$firstDate) {
            $min = null;
            foreach ($parcelas as $p) {
                if (empty($p['data_vencimento'])) continue;
                $d = substr((string)$p['data_vencimento'], 0, 10);
                if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $d)) continue;
                if ($min === null || $d < $min) $min = $d;
            }
            if ($min) $firstDate = $min;
        }

        return $firstDate;
    }

    private function validarRegraVencimentoParaTipo(string $tipo, string $regra, string $dataEmprestimo): string
    {
        $tipo = strtoupper(trim($tipo));
        $regra = trim((string)$regra);

        if ($tipo === 'SEMANAL') {
            if ($regra === '') throw new InvalidArgumentException("regra_vencimento é obrigatória para SEMANAL.");

            $dow = (int)$regra;
            if ($dow < 1 || $dow > 6) {
                throw new InvalidArgumentException("regra_vencimento semanal deve ser 1-6 (Segunda a Sábado).");
            }
            return (string)$dow;
        }

        if ($tipo === 'DIARIO' || $tipo === 'MENSAL') {
            if ($regra === '') {
                throw new InvalidArgumentException("regra_vencimento (primeiro vencimento) é obrigatória para {$tipo}.");
            }

            if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $regra)) {
                throw new InvalidArgumentException("regra_vencimento deve ser uma data no formato YYYY-MM-DD.");
            }

            $baseDt = new DateTime($dataEmprestimo);
            $first  = new DateTime($regra);

            if ($first < $baseDt) {
                throw new InvalidArgumentException("O primeiro vencimento ({$tipo}) não pode ser menor que a data do empréstimo.");
            }

            return $first->format('Y-m-d');
        }

        throw new InvalidArgumentException("tipo_vencimento inválido.");
    }

    private function ajustarSeDomingo(DateTime $dt): void
    {
        if ((int)$dt->format('N') === 7) {
            $dt->modify('+1 day');
        }
    }

    private function calcularVencimento(string $base, string $tipo, ?string $regra, int $n): string
    {
        $tipo = strtoupper(trim((string)$tipo));
        $baseDt = new DateTime($base);

        if ($n <= 0) {
            throw new InvalidArgumentException("Número de parcela inválido.");
        }

        if ($tipo === 'DIARIO') {
            if (!$regra) {
                throw new InvalidArgumentException("regra_vencimento (primeiro vencimento) é obrigatória para DIÁRIO.");
            }

            $first = new DateTime($regra);
            if ($first < $baseDt) {
                throw new InvalidArgumentException("O primeiro vencimento (DIÁRIO) não pode ser menor que a data do empréstimo.");
            }

            $cur = clone $first;
            for ($i = 1; $i <= $n; $i++) {
                $due = clone $cur;

                $this->ajustarSeDomingo($due);

                if ($i === $n) {
                    return $due->format('Y-m-d');
                }

                $cur = clone $due;
                $cur->modify('+1 day');
            }

            return $first->format('Y-m-d');
        }

        if ($tipo === 'MENSAL') {
            if (!$regra) {
                throw new InvalidArgumentException("regra_vencimento (primeiro vencimento) é obrigatória para MENSAL.");
            }

            $first = new DateTime($regra);
            if ($first < $baseDt) {
                throw new InvalidArgumentException("O primeiro vencimento (MENSAL) não pode ser menor que a data do empréstimo.");
            }

            $cur = clone $first;
            for ($i = 1; $i <= $n; $i++) {
                $due = clone $cur;

                $this->ajustarSeDomingo($due);

                if ($i === $n) {
                    return $due->format('Y-m-d');
                }

                $cur = clone $due;
                $cur->modify('+1 month');
            }

            return $first->format('Y-m-d');
        }

        if ($tipo === 'SEMANAL') {
            if ($regra === null || $regra === '') {
                throw new InvalidArgumentException("regra_vencimento é obrigatória para SEMANAL.");
            }

            $dow = (int)$regra;
            if ($dow < 1 || $dow > 6) {
                throw new InvalidArgumentException("regra_vencimento semanal deve ser 1-6 (Segunda a Sábado).");
            }

            $start = new DateTime($base);
            $start->modify('+7 day');

            $currentDow = (int)$start->format('N');
            $delta = $dow - $currentDow;
            if ($delta < 0) $delta += 7;

            $first = clone $start;
            $first->modify('+' . $delta . ' day');

            if ($first < $baseDt) {
                throw new InvalidArgumentException("Vencimento semanal calculado inválido (menor que data do empréstimo).");
            }

            $cur = clone $first;
            for ($i = 1; $i <= $n; $i++) {
                $due = clone $cur;

                $this->ajustarSeDomingo($due);

                if ($i === $n) {
                    return $due->format('Y-m-d');
                }

                $cur = clone $due;
                $cur->modify('+1 week');
            }

            return $first->format('Y-m-d');
        }

        throw new InvalidArgumentException("tipo_vencimento inválido.");
    }

    public function vencimentosDoDia(): void
    {
        try {
            $hojeStr = $_GET['data'] ?? date('Y-m-d');
            $hoje = new DateTime($hojeStr);

            $parcelaDao = new ParcelaDAO();

            $rows = $parcelaDao->listarVencimentos($hoje);

            [$atrasados, $hojeLista] = $this->splitAtrasadosEPeriodo($rows, $hojeStr, $hojeStr);

            $this->responderJson(true, 'Vencimentos', [
                'atrasados' => $this->mapVencimentosCustom($atrasados, 'ATRASADO'),
                'lista' => $this->mapVencimentosCustom($hojeLista, 'HOJE'),
                'periodo_label' => 'Hoje',
            ]);
        } catch (Exception $e) {
            $this->responderJson(false, $e->getMessage());
        }
    }

    public function vencimentosAmanha(): void
    {
        try {
            $hojeStr = $_GET['data'] ?? date('Y-m-d');
            $hoje = new DateTime($hojeStr);

            $amanha = (new DateTime($hojeStr))->modify('+1 day');
            $amanhaStr = $amanha->format('Y-m-d');

            $parcelaDao = new ParcelaDAO();

            $rowsAteHoje = $parcelaDao->listarVencimentos($hoje);
            [$atrasados, $_ignoreHoje] = $this->splitAtrasadosEPeriodo($rowsAteHoje, $hojeStr, $hojeStr);

            $rowsAmanha = $parcelaDao->listarVencimentosEntre($amanha, $amanha);

            $this->responderJson(true, 'Vencimentos amanhã', [
                'atrasados' => $this->mapVencimentosCustom($atrasados, 'ATRASADO'),
                'lista' => $this->mapVencimentosCustom($rowsAmanha, 'AMANHA'),
                'periodo_label' => 'Amanhã',
            ]);
        } catch (Exception $e) {
            $this->responderJson(false, $e->getMessage());
        }
    }

    public function vencimentosSemana(): void
    {
        try {
            $hojeStr = $_GET['data'] ?? date('Y-m-d');
            $hoje = new DateTime($hojeStr);

            $ini = new DateTime($hojeStr);
            $fim = (new DateTime($hojeStr))->modify('+6 day');

            $parcelaDao = new ParcelaDAO();

            $rowsAteHoje = $parcelaDao->listarVencimentos($hoje);
            [$atrasados, $_ignoreHoje] = $this->splitAtrasadosEPeriodo($rowsAteHoje, $hojeStr, $hojeStr);

            $rowsSemana = $parcelaDao->listarVencimentosEntre($ini, $fim);

            $this->responderJson(true, 'Vencimentos da semana', [
                'atrasados' => $this->mapVencimentosCustom($atrasados, 'ATRASADO'),
                'lista' => $this->mapVencimentosCustom($rowsSemana, 'PENDENTE'),
                'periodo_label' => 'Semana',
            ]);
        } catch (Exception $e) {
            $this->responderJson(false, $e->getMessage());
        }
    }

    private function splitAtrasadosEPeriodo(array $rows, string $iniStr, string $fimStr): array
    {
        $hojeStr = date('Y-m-d');

        $atrasados = [];
        $periodo = [];

        foreach ($rows as $row) {
            $dataV = substr((string)$row['data_vencimento'], 0, 10);

            if ($dataV < $hojeStr) {
                $atrasados[] = $row;
                continue;
            }

            if ($dataV >= $iniStr && $dataV <= $fimStr) {
                $periodo[] = $row;
            }
        }

        return [$atrasados, $periodo];
    }

    private function mapVencimentosCustom(array $lista, string $statusForcado): array
    {
        $saida = [];

        foreach ($lista as $row) {
            $dataV = substr((string)$row['data_vencimento'], 0, 10);

            $principal = (float)($row['valor_principal'] ?? 0);
            $jurosPct  = (float)($row['porcentagem_juros'] ?? 0);
            $qtd       = max(1, (int)($row['quantidade_parcelas'] ?? 1));
            $tipoV     = strtoupper(trim((string)($row['tipo_vencimento'] ?? '')));

            if ($tipoV === 'MENSAL') {
                $valorPrestacao = ($principal / $qtd) + ($principal * ($jurosPct / 100));
            } else {
                $totalComJuros = $principal * (1 + $jurosPct / 100);
                $valorPrestacao = $totalComJuros / $qtd;
            }

            $valorPrestacao = round($valorPrestacao, 2);

            $saida[] = [
                'cliente_id' => (int)$row['cliente_id'],
                'cliente_nome' => $row['cliente_nome'],
                'emprestimo_id' => (int)$row['emprestimo_id'],
                'parcela_id' => (int)$row['parcela_id'],
                'parcela_num' => isset($row['numero_parcela']) ? (int)$row['numero_parcela'] : null,
                'data_vencimento' => $dataV,
                'valor' => $valorPrestacao,
                'status' => $statusForcado,
            ];
        }

        return $saida;
    }

    public function detalhes(): void
    {
        try {
            $id = isset($_GET['id']) ? (int) $_GET['id'] : 0;
            if ($id <= 0) throw new InvalidArgumentException('ID inválido.');

            $empDAO = new EmprestimoDAO();
            $parDAO = new ParcelaDAO();
            $pagDAO = new PagamentoDAO();
            $cliDAO = new ClienteDAO();

            $emp = $empDAO->buscarPorId($id);
            if (!$emp) throw new RuntimeException('Empréstimo não encontrado.');

            $cliente = $cliDAO->buscarPorId($emp->getClienteId());
            if (!$cliente) throw new RuntimeException('Cliente não encontrado.');

            $parcelas = $parDAO->listarPorEmprestimo($id);
            $pagamentos = $pagDAO->listarPorEmprestimo($id);

            $tipoV = (string)$emp->getTipoVencimento();
            $regraRaw = (string)$emp->getRegraVencimento();

            $regraUI = $this->normalizarRegraVencimentoParaUI($tipoV, $regraRaw, $parcelas);

            $dados = [
                'emprestimo' => [
                    'id' => $emp->getId(),
                    'cliente_id' => $emp->getClienteId(),
                    'data_emprestimo' => $emp->getDataEmprestimo(),
                    'valor_principal' => $emp->getValorPrincipal(),
                    'porcentagem_juros' => $emp->getPorcentagemJuros(),
                    'quantidade_parcelas' => $emp->getQuantidadeParcelas(),
                    'tipo_vencimento' => $tipoV,
                    'regra_vencimento' => $regraUI,
                    'regra_vencimento_raw' => $regraRaw,
                    'status' => $emp->getStatus(),
                    'grupo' => $emp->getGrupo(),
                ],
                'cliente' => [
                    'id' => $cliente->getId(),
                    'nome' => $cliente->getNome(),
                    'cpf' => $cliente->getCpf(),
                    'telefone' => $cliente->getTelefone(),
                    'endereco' => $cliente->getEndereco(),
                    'profissao' => $cliente->getProfissao(),
                    'placa_carro' => $cliente->getPlacaCarro(),
                    'indicacao' => $cliente->getIndicacao(),
                    'grupo' => $cliente->getGrupo(),
                ],
                'parcelas' => $parcelas,
                'pagamentos' => $pagamentos
            ];

            $this->responderJson(true, 'Detalhes do empréstimo', $dados);
        } catch (Exception $e) {
            $this->responderJson(false, $e->getMessage());
        }
    }

    public function listar(): void
    {
        try {
            $filtro = isset($_GET['filtro']) ? strtoupper($_GET['filtro']) : null;

            $dao = new EmprestimoDAO();
            $lista = $dao->listarComFiltro($filtro);

            $saida = [];
            foreach ($lista as $row) {
                $saida[] = [
                    'emprestimo_id' => $row['id'],
                    'cliente_id' => $row['cliente_id'],
                    'cliente_nome' => $row['cliente_nome'],
                    'valor_principal' => $row['valor_principal'],
                    'parcelas' => $row['parcelas_pagas'] . '/' . $row['quantidade_parcelas'],
                    'proximo_vencimento' => $row['proximo_vencimento'],
                    'status' => $row['status'],
                    'grupo' => $row['grupo'] ?? 'PADRAO',
                ];
            }

            $this->responderJson(true, 'Lista de empréstimos', $saida);
        } catch (Exception $e) {
            $this->responderJson(false, $e->getMessage());
        }
    }

    public function porCliente(): void
    {
        try {
            $clienteId = isset($_GET['cliente_id']) ? (int) $_GET['cliente_id'] : 0;
            if ($clienteId <= 0) throw new InvalidArgumentException('cliente_id inválido.');

            $dao = new EmprestimoDAO();
            $lista = $dao->listarPorCliente($clienteId);

            $saida = [];
            foreach ($lista as $row) {
                $saida[] = [
                    'emprestimo_id' => $row['id'],
                    'cliente_id' => $row['cliente_id'],
                    'cliente_nome' => $row['cliente_nome'],
                    'valor_principal' => $row['valor_principal'],
                    'parcelas' => $row['parcelas_pagas'] . '/' . $row['quantidade_parcelas'],
                    'proximo_vencimento' => $row['proximo_vencimento'],
                    'status' => $row['status'],
                    'grupo' => $row['grupo'] ?? 'PADRAO',
                ];
            }

            $this->responderJson(true, 'Empréstimos do cliente', $saida);
        } catch (Exception $e) {
            $this->responderJson(false, $e->getMessage());
        }
    }

    public function excluir(): void
    {
        try {
            $id = isset($_POST['emprestimo_id']) ? (int)$_POST['emprestimo_id'] : 0;
            if ($id <= 0) throw new InvalidArgumentException("emprestimo_id inválido.");

            $pdo = Database::conectar();

            $stmt = $pdo->prepare("SELECT COUNT(*) FROM pagamentos WHERE emprestimo_id = :id");
            $stmt->execute([':id' => $id]);
            $qtdPag = (int)$stmt->fetchColumn();

            if ($qtdPag > 0) {
                $this->responderJson(false, "Não é possível excluir: já existem pagamentos lançados neste empréstimo.");
            }

            $stmt2 = $pdo->prepare("
            SELECT COUNT(*)
            FROM parcelas
            WHERE emprestimo_id = :id
              AND (
                valor_pago > 0
                OR UPPER(TRIM(status)) IN ('PAGA','QUITADA','PARCIAL')
              )
        ");
            $stmt2->execute([':id' => $id]);
            $qtdMov = (int)$stmt2->fetchColumn();

            if ($qtdMov > 0) {
                $this->responderJson(false, "Não é possível excluir: este empréstimo já teve movimento em parcelas.");
            }

            $pdo->beginTransaction();
            try {
                $pdo->prepare("DELETE FROM pagamentos WHERE emprestimo_id = :id")->execute([':id' => $id]);
                $pdo->prepare("DELETE FROM parcelas WHERE emprestimo_id = :id")->execute([':id' => $id]);

                $stmtDelEmp = $pdo->prepare("DELETE FROM emprestimos WHERE id = :id");
                $stmtDelEmp->execute([':id' => $id]);

                if ($stmtDelEmp->rowCount() <= 0) {
                    throw new RuntimeException("Empréstimo não encontrado para excluir.");
                }

                $pdo->commit();
                $this->responderJson(true, "Empréstimo excluído com sucesso.");
            } catch (Exception $e) {
                $pdo->rollBack();
                throw $e;
            }
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