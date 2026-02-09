<?php

class Cliente
{
    private ?int $id = null;
    private string $nome;
    private ?string $cpf = null;
    private ?string $telefone = null;
    private ?string $endereco = null;
    private ?string $profissao = null;
    private ?string $placaCarro = null;
    private ?string $indicacao = null;

    // ===== GETTERS =====

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getNome(): string
    {
        return $this->nome;
    }

    public function getCpf(): ?string
    {
        return $this->cpf;
    }

    public function getTelefone(): ?string
    {
        return $this->telefone;
    }

    public function getEndereco(): ?string
    {
        return $this->endereco;
    }

    public function getProfissao(): ?string
    {
        return $this->profissao;
    }

    public function getPlacaCarro(): ?string
    {
        return $this->placaCarro;
    }

    public function getIndicacao(): ?string
    {
        return $this->indicacao;
    }

    // ===== SETTERS =====

    public function setId(int $id): void
    {
        $this->id = $id;
    }

    public function setNome(string $nome): void
    {
        $this->nome = trim($nome);
    }

    public function setCpf(?string $cpf): void
    {
        $this->cpf = $cpf ? trim($cpf) : null;
    }

    public function setTelefone(?string $telefone): void
    {
        $this->telefone = $telefone ? trim($telefone) : null;
    }

    public function setEndereco(?string $endereco): void
    {
        $this->endereco = $endereco ? trim($endereco) : null;
    }

    public function setProfissao(?string $profissao): void
    {
        $this->profissao = $profissao ? trim($profissao) : null;
    }

    public function setPlacaCarro(?string $placaCarro): void
    {
        $this->placaCarro = $placaCarro ? strtoupper(trim($placaCarro)) : null;
    }

    public function setIndicacao(?string $indicacao): void
    {
        $this->indicacao = $indicacao ? trim($indicacao) : null;
    }
}
