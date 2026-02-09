<?php

class ClienteDTO
{
    public string $nome;
    public ?string $cpf;
    public ?string $telefone;
    public ?string $endereco;
    public ?string $profissao;
    public ?string $placa_carro;
    public ?string $indicacao;

    public function __construct(array $dados)
    {
        $this->nome        = trim($dados['nome'] ?? '');
        $this->cpf         = $this->normalizar($dados['cpf'] ?? null);
        $this->telefone    = $this->normalizar($dados['telefone'] ?? null);
        $this->endereco    = $this->normalizar($dados['endereco'] ?? null);
        $this->profissao   = $this->normalizar($dados['profissao'] ?? null);
        $this->placa_carro = $this->normalizar($dados['placa_carro'] ?? null);
        $this->indicacao   = $this->normalizar($dados['indicacao'] ?? null);
    }

    private function normalizar(?string $valor): ?string
    {
        if ($valor === null) return null;

        $valor = trim($valor);
        return $valor === '' ? null : $valor;
    }

    public function validar(): void
    {
        if ($this->nome === '') {
            throw new InvalidArgumentException('Nome é obrigatório.');
        }
    }
}
