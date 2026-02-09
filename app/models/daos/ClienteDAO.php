<?php

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../entities/Cliente.php';

class ClienteDAO
{
    private PDO $pdo;

    public function __construct()
    {
        $this->pdo = Database::conectar();
    }

    // CREATE
    public function criar(Cliente $cliente): int
    {
        $sql = "INSERT INTO clientes (nome, cpf, telefone, endereco, profissao, placa_carro, indicacao)
                VALUES (:nome, :cpf, :telefone, :endereco, :profissao, :placa_carro, :indicacao)";

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([
            ':nome'       => $cliente->getNome(),
            ':cpf'        => $cliente->getCpf(),
            ':telefone'   => $cliente->getTelefone(),
            ':endereco'   => $cliente->getEndereco(),
            ':profissao'  => $cliente->getProfissao(),
            ':placa_carro' => $cliente->getPlacaCarro(),
            ':indicacao'  => $cliente->getIndicacao(),
        ]);

        return (int)$this->pdo->lastInsertId();
    }

    // READ (listar todos)
    public function listar(): array
    {
        $sql = "SELECT id, nome, cpf, telefone, endereco, profissao, placa_carro, indicacao
                FROM clientes
                ORDER BY nome ASC";

        $stmt = $this->pdo->query($sql);
        $linhas = $stmt->fetchAll();

        $clientes = [];
        foreach ($linhas as $row) {
            $clientes[] = $this->mapearParaEntity($row);
        }

        return $clientes;
    }

    // READ (buscar por id)
    public function buscarPorId(int $id): ?Cliente
    {
        $sql = "SELECT id, nome, cpf, telefone, endereco, profissao, placa_carro, indicacao
                FROM clientes
                WHERE id = :id
                LIMIT 1";

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([':id' => $id]);

        $row = $stmt->fetch();
        if (!$row) return null;

        return $this->mapearParaEntity($row);
    }

    // READ (buscar por cpf) — útil pra validação/duplicidade
    public function buscarPorCpf(string $cpf): ?Cliente
    {
        $sql = "SELECT id, nome, cpf, telefone, endereco, profissao, placa_carro, indicacao
                FROM clientes
                WHERE cpf = :cpf
                LIMIT 1";

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([':cpf' => $cpf]);

        $row = $stmt->fetch();
        if (!$row) return null;

        return $this->mapearParaEntity($row);
    }

    // UPDATE
    public function atualizar(Cliente $cliente): bool
    {
        if ($cliente->getId() === null) {
            throw new InvalidArgumentException("Cliente sem ID não pode ser atualizado.");
        }

        $sql = "UPDATE clientes
                SET nome = :nome,
                    cpf = :cpf,
                    telefone = :telefone,
                    endereco = :endereco,
                    profissao = :profissao,
                    placa_carro = :placa_carro,
                    indicacao = :indicacao
                WHERE id = :id";

        $stmt = $this->pdo->prepare($sql);
        return $stmt->execute([
            ':id'         => $cliente->getId(),
            ':nome'       => $cliente->getNome(),
            ':cpf'        => $cliente->getCpf(),
            ':telefone'   => $cliente->getTelefone(),
            ':endereco'   => $cliente->getEndereco(),
            ':profissao'  => $cliente->getProfissao(),
            ':placa_carro' => $cliente->getPlacaCarro(),
            ':indicacao'  => $cliente->getIndicacao(),
        ]);
    }

    // DELETE
    public function excluir(int $id): bool
    {
        $sql = "DELETE FROM clientes WHERE id = :id";
        $stmt = $this->pdo->prepare($sql);
        return $stmt->execute([':id' => $id]);
    }

    // ===== Helper: mapeia array do banco -> Entity =====
    private function mapearParaEntity(array $row): Cliente
    {
        $c = new Cliente();
        $c->setId((int)$row['id']);
        $c->setNome($row['nome']);
        $c->setCpf($row['cpf'] ?? null);
        $c->setTelefone($row['telefone'] ?? null);
        $c->setEndereco($row['endereco'] ?? null);
        $c->setProfissao($row['profissao'] ?? null);
        $c->setPlacaCarro($row['placa_carro'] ?? null);
        $c->setIndicacao($row['indicacao'] ?? null);
        return $c;
    }
}
