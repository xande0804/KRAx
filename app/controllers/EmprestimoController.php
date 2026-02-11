<?php

require_once __DIR__ . '/../models/dtos/EmprestimoDTO.php';
require_once __DIR__ . '/../models/entities/Emprestimo.php';
require_once __DIR__ . '/../models/entities/Parcela.php';
require_once __DIR__ . '/../models/daos/EmprestimoDAO.php';
require_once __DIR__ . '/../models/daos/ParcelaDAO.php';
require_once __DIR__ . '/../models/daos/PagamentoDAO.php';
require_once __DIR__ . '/../models/daos/ClienteDAO.php';


class EmprestimoController
{
    public function criar(): void
    {
        try {
            $dto = new EmprestimoDTO($_POST);
            $dto->validar();

            // 1) Cria empréstimo
            $e = new Emprestimo();
            $e->setClienteId($dto->cliente_id);
            $e->setDataEmprestimo($dto->data_emprestimo);
            $e->setValorPrincipal($dto->valor_principal);
            $e->setPorcentagemJuros($dto->porcentagem_juros);
            $e->setQuantidadeParcelas($dto->quantidade_parcelas);
            $e->setTipoVencimento($dto->tipo_vencimento);
            $e->setRegraVencimento($dto->regra_vencimento);

            $emprestimoDao = new EmprestimoDAO();
            $emprestimoId = $emprestimoDao->criar($e);

            // 2) Gera parcelas
            $parcelaDao = new ParcelaDAO();
            $principal = (float) $dto->valor_principal;
            $qtd = (int) $dto->quantidade_parcelas;
            $jurosPct = (float) $dto->porcentagem_juros;

            if ($qtd <= 0) {
                throw new InvalidArgumentException("Quantidade de parcelas inválida.");
            }

            $tipo = strtoupper(trim($dto->tipo_vencimento));

            // 🔥 NOVA REGRA
            if ($tipo === "MENSAL") {
                // Fórmula mensal nova
                $valorPrestacao = ($principal / $qtd) + ($principal * ($jurosPct / 100));
            } else {
                // Mantém fórmula antiga para diário e semanal
                $totalComJuros = $principal * (1 + $jurosPct / 100);
                $valorPrestacao = $totalComJuros / $qtd;
            }

            $principal = (float)$dto->valor_principal;
            $qtd = (int)$dto->quantidade_parcelas;
            $jurosPct = (float)$dto->porcentagem_juros;

            $tipoV = strtoupper($dto->tipo_vencimento);

            // prestação fixa
            if ($tipoV === 'MENSAL') {
                $valorPrestacao = ($principal / $qtd) + ($principal * ($jurosPct / 100));
            } else { // DIARIO e SEMANAL
                $valorPrestacao = ($principal / $qtd) + (($principal * ($jurosPct / 100)) / $qtd);
            }

            $valorPrestacao = round($valorPrestacao, 2);



            for ($i = 1; $i <= $dto->quantidade_parcelas; $i++) {
                $p = new Parcela();
                $p->setEmprestimoId($emprestimoId);
                $p->setNumeroParcela($i);
                $p->setValorParcela($valorPrestacao);
                $p->setValorPago(0);
                $p->setStatus('ABERTA');
                $p->setDataVencimento(
                    $this->calcularVencimento($dto->data_emprestimo, $dto->tipo_vencimento, $dto->regra_vencimento, $i)
                );

                $parcelaDao->criar($p);
            }

            $this->responderJson(true, 'Empréstimo criado com parcelas');
        } catch (Exception $e) {
            $this->responderJson(false, $e->getMessage());
        }
    }

    private function calcularVencimento(string $base, string $tipo, ?int $regra, int $n): string
    {
        $data = new DateTime($base);

        if ($tipo === 'DIARIO') {
            $data->modify("+{$n} day");
        }

        if ($tipo === 'SEMANAL') {
            $data->modify("+{$n} week");
        }

        if ($tipo === 'MENSAL') {
            $data->modify("+{$n} month");
            if ($regra !== null) {
                $data->setDate($data->format('Y'), $data->format('m'), $regra);
            }
        }

        return $data->format('Y-m-d');
    }

    public function vencimentosDoDia(): void
{
    try {
        $hojeStr = $_GET['data'] ?? date('Y-m-d');
        $hoje = new DateTime($hojeStr);

        $parcelaDao = new ParcelaDAO();

        // listarVencimentos($dataBase) traz <= dataBase
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

        // atrasados: tudo < hoje
        $rowsAteHoje = $parcelaDao->listarVencimentos($hoje);
        [$atrasados, $_ignoreHoje] = $this->splitAtrasadosEPeriodo($rowsAteHoje, $hojeStr, $hojeStr);

        // lista amanhã: somente amanhã
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
        $fim = (new DateTime($hojeStr))->modify('+6 day'); // 7 dias contando hoje

        $parcelaDao = new ParcelaDAO();

        // atrasados: < hoje
        $rowsAteHoje = $parcelaDao->listarVencimentos($hoje);
        [$atrasados, $_ignoreHoje] = $this->splitAtrasadosEPeriodo($rowsAteHoje, $hojeStr, $hojeStr);

        // lista semana: hoje..+6 (não inclui atrasados)
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

/**
 * Separa atrasados (< hoje) e período (entre ini..fim).
 * $iniStr e $fimStr são Y-m-d.
 */
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

/**
 * Mapeia no formato do front, calculando valor da prestação conforme regra,
 * e forçando o status desejado (HOJE / AMANHA / PENDENTE / ATRASADO).
 */
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
            if ($id <= 0)
                throw new InvalidArgumentException('ID inválido.');

            $empDAO = new EmprestimoDAO();
            $parDAO = new ParcelaDAO();
            $pagDAO = new PagamentoDAO();
            $cliDAO = new ClienteDAO();

            $emp = $empDAO->buscarPorId($id);
            if (!$emp)
                throw new RuntimeException('Empréstimo não encontrado.');

            $cliente = $cliDAO->buscarPorId($emp->getClienteId());
            if (!$cliente)
                throw new RuntimeException('Cliente não encontrado.');

            $parcelas = $parDAO->listarPorEmprestimo($id);
            $pagamentos = $pagDAO->listarPorEmprestimo($id);

            $dados = [
                'emprestimo' => [
                    'id' => $emp->getId(),
                    'cliente_id' => $emp->getClienteId(),
                    'data_emprestimo' => $emp->getDataEmprestimo(),
                    'valor_principal' => $emp->getValorPrincipal(),
                    'porcentagem_juros' => $emp->getPorcentagemJuros(),
                    'quantidade_parcelas' => $emp->getQuantidadeParcelas(),
                    'tipo_vencimento' => $emp->getTipoVencimento(),
                    'regra_vencimento' => $emp->getRegraVencimento(),
                    'status' => $emp->getStatus(),
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
            if ($clienteId <= 0)
                throw new InvalidArgumentException('cliente_id inválido.');

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
                ];
            }

            $this->responderJson(true, 'Empréstimos do cliente', $saida);
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
