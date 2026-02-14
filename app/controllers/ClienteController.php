<?php

require_once __DIR__ . '/../models/dtos/ClienteDTO.php';
require_once __DIR__ . '/../models/entities/Cliente.php';
require_once __DIR__ . '/../models/daos/ClienteDAO.php';
require_once __DIR__ . '/../models/daos/EmprestimoDAO.php';

class ClienteController
{
    public function criar(): void
    {
        try {
            $dados = $_POST;

            $dto = new ClienteDTO($dados);
            $dto->validar();

            $cliente = new Cliente();
            $cliente->setNome($dto->nome);
            $cliente->setCpf($dto->cpf);
            $cliente->setTelefone($dto->telefone);
            $cliente->setEndereco($dto->endereco);
            $cliente->setProfissao($dto->profissao);
            $cliente->setPlacaCarro($dto->placa_carro);
            $cliente->setIndicacao($dto->indicacao);

            $dao = new ClienteDAO();
            $id = $dao->criar($cliente);

            $this->responderJson(true, 'Cliente criado com sucesso', [
                'id' => $id
            ]);
        } catch (Exception $e) {
            $this->responderJson(false, $e->getMessage());
        }
    }

    public function listar(): void
    {
        try {
            $dao = new ClienteDAO();
            $linhas = $dao->listar();

            $dados = [];
            foreach ($linhas as $row) {
                $dados[] = [
                    'id' => (int)$row['id'],
                    'nome' => $row['nome'],
                    'cpf' => $row['cpf'] ?? null,
                    'telefone' => $row['telefone'] ?? null,
                    'endereco' => $row['endereco'] ?? null,
                    'profissao' => $row['profissao'] ?? null,
                    'placa_carro' => $row['placa_carro'] ?? null,
                    'indicacao' => $row['indicacao'] ?? null,
                    'tem_emprestimo_ativo' => (int)($row['tem_emprestimo_ativo'] ?? 0),
                ];
            }

            $this->responderJson(true, 'Lista de clientes', $dados);
        } catch (Exception $e) {
            $this->responderJson(false, $e->getMessage());
        }
    }

    public function detalhes(): void
    {
        try {
            $id = isset($_GET['id']) ? (int)$_GET['id'] : 0;

            if ($id <= 0) {
                throw new InvalidArgumentException('ID inválido.');
            }

            $dao = new ClienteDAO();
            $c = $dao->buscarPorId($id);

            if (!$c) {
                throw new RuntimeException('Cliente não encontrado.');
            }

            $dados = [
                'id' => $c->getId(),
                'nome' => $c->getNome(),
                'cpf' => $c->getCpf(),
                'telefone' => $c->getTelefone(),
                'endereco' => $c->getEndereco(),
                'profissao' => $c->getProfissao(),
                'placa_carro' => $c->getPlacaCarro(),
                'indicacao' => $c->getIndicacao(),
            ];

            $this->responderJson(true, 'Detalhes do cliente', $dados);
        } catch (Exception $e) {
            $this->responderJson(false, $e->getMessage());
        }
    }

    public function atualizar(): void
    {
        try {
            $id = isset($_POST['id']) ? (int)$_POST['id'] : 0;
            if ($id <= 0) {
                throw new InvalidArgumentException('ID inválido.');
            }

            $dto = new ClienteDTO($_POST);
            $dto->validar();

            $dao = new ClienteDAO();
            $existente = $dao->buscarPorId($id);
            if (!$existente) {
                throw new RuntimeException('Cliente não encontrado.');
            }

            $existente->setNome($dto->nome);
            $existente->setCpf($dto->cpf);
            $existente->setTelefone($dto->telefone);
            $existente->setEndereco($dto->endereco);
            $existente->setProfissao($dto->profissao);
            $existente->setPlacaCarro($dto->placa_carro);
            $existente->setIndicacao($dto->indicacao);

            $dao->atualizar($existente);

            $this->responderJson(true, 'Cliente atualizado com sucesso', [
                'id' => $existente->getId()
            ]);
        } catch (Exception $e) {
            $this->responderJson(false, $e->getMessage());
        }
    }

    public function excluir(): void
    {
        try {
            $id = isset($_POST['id']) ? (int)$_POST['id'] : 0;

            if ($id <= 0) {
                throw new InvalidArgumentException('ID inválido.');
            }

            $dao = new ClienteDAO();
            $empDAO = new EmprestimoDAO();

            $cliente = $dao->buscarPorId($id);

            if (!$cliente) {
                throw new RuntimeException('Cliente não encontrado.');
            }

            // 🔥 REGRA DE NEGÓCIO
            $emprestimos = $empDAO->listarPorCliente($id);

            if ($emprestimos && count($emprestimos) > 0) {
                throw new RuntimeException(
                    'Não é possível excluir este cliente, pois ele possui empréstimos registrados no sistema.'
                );
            }

            $dao->excluir($id);

            $this->responderJson(true, 'Cliente excluído com sucesso');
        } catch (Exception $e) {
            $this->responderJson(false, $e->getMessage());
        }
    }

    private function responderJson(bool $ok, string $mensagem, array $dados = []): void
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
