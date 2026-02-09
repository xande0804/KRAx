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
            $valorParcela = round($dto->valor_principal / $dto->quantidade_parcelas, 2);

            for ($i = 1; $i <= $dto->quantidade_parcelas; $i++) {
                $p = new Parcela();
                $p->setEmprestimoId($emprestimoId);
                $p->setNumeroParcela($i);
                $p->setValorParcela($valorParcela);
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
            $dataStr = $_GET['data'] ?? date('Y-m-d');
            $data = new DateTime($dataStr);


            $parcelaDao = new ParcelaDAO();
            $lista = $parcelaDao->listarVencimentos($data);

            $saida = [];
            foreach ($lista as $row) {
                $saida[] = [
                    'cliente_id' => $row['cliente_id'],
                    'cliente_nome' => $row['cliente_nome'],
                    'emprestimo_id' => $row['emprestimo_id'],
                    'parcela_id' => $row['parcela_id'],
                    'data_vencimento' => $row['data_vencimento'],
                    'valor' => $row['valor_parcela'],
                    'status' => $row['data_vencimento'] < date('Y-m-d')
                        ? 'ATRASADO'
                        : 'HOJE'
                ];
            }

            $this->responderJson(true, 'Vencimentos', $saida);
        } catch (Exception $e) {
            $this->responderJson(false, $e->getMessage());
        }
    }

    public function detalhes(): void
    {
        try {
            $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;
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
