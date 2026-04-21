<?php

require_once __DIR__ . '/../models/daos/DashboardDAO.php';

class DashboardController
{
    public function resumo(): void
    {
        try {
            $dashboardDAO = new DashboardDAO();

            $hoje = date('Y-m-d');
            $filtro = $this->resolverFiltro($hoje);

            $dados = [
                'operacional' => [
                    'clientes'             => $dashboardDAO->contarClientes(),
                    'emprestimos_ativos'   => $dashboardDAO->contarEmprestimosAtivos(),
                    'vencem_hoje'          => $dashboardDAO->contarVencemHoje($hoje),
                    'atrasados'            => $dashboardDAO->contarClientesAtrasados($hoje),
                ],
                'financeiro' => [
                    'quanto_saiu'               => $dashboardDAO->somarQuantoSaiu($filtro['data_inicial'], $filtro['data_final']),
                    'quanto_ja_voltou'          => $dashboardDAO->somarQuantoJaVoltou($filtro['data_inicial'], $filtro['data_final']),
                    'previsto_ainda_pra_voltar' => $dashboardDAO->somarPrevistoAindaPraVoltar(),
                ],
                'filtro' => [
                    'data_inicial'            => $filtro['data_inicial'],
                    'data_final'              => $filtro['data_final'],
                    'periodo_padrao_aplicado' => $filtro['periodo_padrao_aplicado'],
                ],
                'graficos' => [
                    'emprestimos_por_mes' => $dashboardDAO->listarEmprestimosPorMes($filtro['data_inicial'], $filtro['data_final']),
                    'financeiro_por_mes'  => $dashboardDAO->listarFinanceiroPorMes($filtro['data_inicial'], $filtro['data_final']),
                ],
                'ranking' => [
                    'top_clientes' => $dashboardDAO->listarTopClientesPorTotalPago($filtro['data_inicial'], $filtro['data_final'], 5),
                ],
            ];

            $this->responderJson(true, 'Resumo do dashboard', $dados);
        } catch (InvalidArgumentException $e) {
            $this->responderJson(false, $e->getMessage(), null);
        } catch (Exception $e) {
            $this->responderJson(false, $e->getMessage(), null);
        }
    }

    private function resolverFiltro(string $hoje): array
    {
        $dataInicial = trim((string)($_GET['data_inicial'] ?? ''));
        $dataFinal   = trim((string)($_GET['data_final'] ?? ''));

        if ($dataInicial === '' && $dataFinal === '') {
            $dtFinal = new DateTimeImmutable($hoje);
            $dtInicial = $dtFinal->modify('-1 month');

            return [
                'data_inicial'            => $dtInicial->format('Y-m-d'),
                'data_final'              => $dtFinal->format('Y-m-d'),
                'periodo_padrao_aplicado' => true,
            ];
        }

        if ($dataInicial === '' || $dataFinal === '') {
            throw new InvalidArgumentException('Informe data_inicial e data_final para aplicar o filtro.');
        }

        if (!$this->isDataValida($dataInicial) || !$this->isDataValida($dataFinal)) {
            throw new InvalidArgumentException('Data inválida. Use o formato YYYY-MM-DD.');
        }

        if ($dataInicial > $dataFinal) {
            throw new InvalidArgumentException('Intervalo inválido: data_inicial não pode ser maior que data_final.');
        }

        return [
            'data_inicial'            => $dataInicial,
            'data_final'              => $dataFinal,
            'periodo_padrao_aplicado' => false,
        ];
    }

    private function isDataValida(string $data): bool
    {
        $dt = DateTime::createFromFormat('Y-m-d', $data);

        return $dt instanceof DateTime
            && $dt->format('Y-m-d') === $data;
    }

    private function responderJson(bool $ok, string $mensagem, $dados = null): void
    {
        header('Content-Type: application/json; charset=utf-8');

        echo json_encode([
            'ok'       => $ok,
            'mensagem' => $mensagem,
            'dados'    => $dados,
        ]);

        exit;
    }
}