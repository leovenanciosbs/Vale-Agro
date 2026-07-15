const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./database');

const app = express();

function dataHojeLocal() {
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = String(hoje.getMonth() + 1).padStart(2, '0');
    const dia = String(hoje.getDate()).padStart(2, '0');

    return `${ano}-${mes}-${dia}`;
}

function horaAgoraLocal() {
    const agora = new Date();
    const hora = String(agora.getHours()).padStart(2, '0');
    const minuto = String(agora.getMinutes()).padStart(2, '0');
    const segundo = String(agora.getSeconds()).padStart(2, '0');

    return `${hora}:${minuto}:${segundo}`;
}

function formatarDataLocal(data) {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const dia = String(data.getDate()).padStart(2, '0');

    return `${ano}-${mes}-${dia}`;
}

function arredondarMoeda(valor) {
    return Math.round((Number(valor || 0) + Number.EPSILON) * 100) / 100;
}

function normalizarUnidadeMedida(valor) {
    const unidade = String(valor || 'UN').trim().toUpperCase();
    const unidadesValidas = ['UN', 'KG', 'G', 'L', 'ML', 'M'];

    return unidadesValidas.includes(unidade) ? unidade : 'UN';
}

function normalizarPermiteFracionado(valor) {
    return Number(valor || 0) === 1 ? 1 : 0;
}

function quantidadeEhInteira(valor) {
    const numero = Number(valor || 0);

    return Math.abs(numero - Math.round(numero)) < 0.000001;
}

function criarErro(status, mensagem) {
    const erro = new Error(mensagem);
    erro.status = status;
    return erro;
}

function dbGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function dbAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

function dbRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function(err) {
            if (err) reject(err);
            else resolve({
                lastID: this.lastID,
                changes: this.changes
            });
        });
    });
}

async function obterTotalPagamentosGeraisFiado(clienteNome) {
    const resultado = await dbGet(
        `
        SELECT COALESCE(SUM(valor_total), 0) AS total
        FROM fiados
        WHERE cliente_nome = ?
        AND tipo = 'PAGAMENTO'
        AND COALESCE(cancelado, 0) = 0
        AND COALESCE(origem, '') NOT IN ('PAGAMENTO_ITENS', 'PAGAMENTO_VALOR')
        `,
        [clienteNome]
    );

    return arredondarMoeda(Number(resultado?.total || 0));
}

function aplicarPagamentosGeraisFiado(compras, totalPagamentosGerais) {
    let pagamentosRestantes = arredondarMoeda(totalPagamentosGerais);

    return compras.map(compra => {
        const valorTotal = Number(compra.valor_total || 0);
        const valorPagoBase = arredondarMoeda(Number(
            compra.valor_pago_efetivo !== undefined
                ? compra.valor_pago_efetivo
                : compra.valor_pago || 0
        ));
        let saldoAberto = arredondarMoeda(valorTotal - valorPagoBase);
        let valorPagoComPagamentosGerais = valorPagoBase;
        let abatimentoGeral = 0;

        if (saldoAberto < 0) {
            saldoAberto = 0;
        }

        if (pagamentosRestantes > 0 && saldoAberto > 0) {
            abatimentoGeral = arredondarMoeda(Math.min(saldoAberto, pagamentosRestantes));
            saldoAberto = arredondarMoeda(saldoAberto - abatimentoGeral);
            valorPagoComPagamentosGerais = arredondarMoeda(valorPagoBase + abatimentoGeral);
            pagamentosRestantes = arredondarMoeda(pagamentosRestantes - abatimentoGeral);
        }

        return {
            ...compra,
            valor_pago_base: valorPagoBase,
            valor_pago_com_pagamentos_gerais: valorPagoComPagamentosGerais,
            abatimento_pagamentos_gerais: abatimentoGeral,
            saldo_aberto: saldoAberto
        };
    });
}

function tratarErro(res, erro) {
    console.error(erro);
    res.status(erro.status || 500).json({
        erro: erro.message || 'Erro interno no servidor.'
    });
}

const DIAS_PRAZO_FIADO = 30;

function calcularDiasEmAbertoFiado(data, hoje = new Date()) {
    if (!data) {
        return 0;
    }

    const dataCompra = new Date(`${data}T00:00:00`);
    const dataAtual = new Date(`${formatarDataLocal(hoje)}T00:00:00`);

    if (Number.isNaN(dataCompra.getTime())) {
        return 0;
    }

    return Math.floor((dataAtual - dataCompra) / (1000 * 60 * 60 * 24));
}

async function listarFiadosAtrasados() {
    const lancamentos = await dbAll(
        `
        SELECT
            f.*,
            CASE
                WHEN f.tipo = 'COMPRA'
                THEN MAX(COALESCE(f.valor_pago, 0), COALESCE(pi.total_abatido, 0))
                ELSE COALESCE(f.valor_pago, 0)
            END AS valor_pago_efetivo,
            CASE
                WHEN f.tipo = 'COMPRA'
                AND (
                    COALESCE(f.valor_total, 0) -
                    MAX(COALESCE(f.valor_pago, 0), COALESCE(pi.total_abatido, 0))
                ) > 0
                THEN (
                    COALESCE(f.valor_total, 0) -
                    MAX(COALESCE(f.valor_pago, 0), COALESCE(pi.total_abatido, 0))
                )

                WHEN f.tipo = 'COMPRA' THEN 0

                ELSE 0
            END AS saldo_aberto,
            c.telefone,
            c.cidade
        FROM fiados f
        LEFT JOIN (
            SELECT
                fiado_id,
                COALESCE(SUM(valor_abatido), 0) AS total_abatido
            FROM pagamentos_fiados_itens
            WHERE COALESCE(cancelado, 0) = 0
            GROUP BY fiado_id
        ) pi ON pi.fiado_id = f.id
        LEFT JOIN clientes c
            ON c.nome = f.cliente_nome
        WHERE COALESCE(f.cancelado, 0) = 0
        ORDER BY f.cliente_nome ASC, f.data ASC, f.hora ASC, f.id ASC
        `
    );

    const clientes = {};

    lancamentos.forEach(item => {
        if (!clientes[item.cliente_nome]) {
            clientes[item.cliente_nome] = {
                cliente_nome: item.cliente_nome,
                telefone: item.telefone || '',
                cidade: item.cidade || '',
                compras: [],
                pagamentos: 0
            };
        }

        if (item.tipo === 'COMPRA') {
            clientes[item.cliente_nome].compras.push({
                id: item.id,
                data: item.data,
                hora: item.hora,
                produto: item.produto,
                valor: Number(item.valor_total || 0),
                saldo_aberto: Number(item.saldo_aberto || 0)
            });
        }

        if (
            item.tipo === 'PAGAMENTO' &&
            !['PAGAMENTO_ITENS', 'PAGAMENTO_VALOR'].includes(String(item.origem || ''))
        ) {
            clientes[item.cliente_nome].pagamentos += Number(item.valor_total || 0);
        }
    });

    const resultado = [];

    Object.values(clientes).forEach(cliente => {
        let pagamentosRestantes = cliente.pagamentos;

        const comprasProcessadas = cliente.compras.map(compra => {
            let saldoCompra = Number(compra.saldo_aberto || 0);

            if (pagamentosRestantes > 0) {
                const abatimento = Math.min(saldoCompra, pagamentosRestantes);
                saldoCompra -= abatimento;
                pagamentosRestantes -= abatimento;
            }

            const diasEmAberto = calcularDiasEmAbertoFiado(compra.data);
            const vencida = saldoCompra > 0 && diasEmAberto >= DIAS_PRAZO_FIADO;

            return {
                ...compra,
                saldo_aberto: saldoCompra,
                dias_em_aberto: diasEmAberto,
                vencida
            };
        });

        const comprasAbertas = comprasProcessadas.filter(compra => compra.saldo_aberto > 0);
        const comprasVencidas = comprasAbertas.filter(compra => compra.vencida);

        const saldoTotal = comprasAbertas.reduce((soma, compra) => {
            return soma + Number(compra.saldo_aberto || 0);
        }, 0);

        const valorVencido = comprasVencidas.reduce((soma, compra) => {
            return soma + Number(compra.saldo_aberto || 0);
        }, 0);

        const valorNoPrazo = saldoTotal - valorVencido;

        const maiorAtraso = comprasVencidas.reduce((maior, compra) => {
            return Math.max(maior, compra.dias_em_aberto);
        }, 0);

        const primeiraVencida = comprasVencidas[0] || {};

        if (valorVencido > 0) {
            resultado.push({
                cliente_nome: cliente.cliente_nome,
                telefone: cliente.telefone,
                cidade: cliente.cidade,
                saldo_total: saldoTotal,
                valor_pendente: saldoTotal,
                valor_vencido: valorVencido,
                valor_no_prazo: valorNoPrazo,
                dias_atraso: maiorAtraso,
                compras_vencidas: comprasVencidas.length,
                data_primeira_vencida: primeiraVencida.data || '',
                hora_primeira_vencida: primeiraVencida.hora || ''
            });
        }
    });

    resultado.sort((a, b) => b.valor_vencido - a.valor_vencido);

    return resultado;
}

async function salvarOuAtualizarCliente({
    nome,
    telefone = '',
    cidade = '',
    observacao = ''
}) {
    const nomeCliente = String(nome || '').trim();

    if (!nomeCliente) {
        return;
    }

    const dataCadastro = dataHojeLocal();

    const cliente = await dbGet(
        `
        SELECT id
        FROM clientes
        WHERE nome = ?
        `,
        [nomeCliente]
    );

    if (cliente) {
        await dbRun(
            `
            UPDATE clientes
            SET
                telefone = ?,
                cidade = ?,
                observacao = COALESCE(NULLIF(?, ''), observacao)
            WHERE nome = ?
            `,
            [
                telefone || '',
                cidade || '',
                observacao || '',
                nomeCliente
            ]
        );
    } else {
        await dbRun(
            `
            INSERT INTO clientes
            (
                nome,
                telefone,
                cidade,
                observacao,
                data_cadastro
            )
            VALUES (?, ?, ?, ?, ?)
            `,
            [
                nomeCliente,
                telefone || '',
                cidade || '',
                observacao || '',
                dataCadastro
            ]
        );
    }
}

async function buscarVendaPorMovimentacao(movimentacao) {
    if (movimentacao.venda_id) {
        const venda = await dbGet(
            `
            SELECT id
            FROM vendas
            WHERE id = ?
            AND COALESCE(cancelada, 0) = 0
            `,
            [movimentacao.venda_id]
        );

        if (venda) {
            return venda;
        }
    }

    if (movimentacao.tipo === 'VENDA') {
        const venda = await dbGet(
            `
            SELECT v.id
            FROM vendas v
            INNER JOIN itens_venda i
                ON i.venda_id = v.id
            WHERE v.data = ?
            AND v.hora = ?
            AND i.produto_id = ?
            AND ABS(COALESCE(i.quantidade, 0) - ?) < 0.0001
            AND COALESCE(v.cancelada, 0) = 0
            ORDER BY v.id DESC
            LIMIT 1
            `,
            [
                movimentacao.data,
                movimentacao.hora,
                movimentacao.produto_id,
                Number(movimentacao.quantidade || 0)
            ]
        );

        if (venda) {
            return venda;
        }
    }

    return null;
}

async function cancelarVendaPorId(vendaId, motivoCancelamento = '') {
    const venda = await dbGet(
        `
        SELECT *
        FROM vendas
        WHERE id = ?
        `,
        [vendaId]
    );

    if (!venda) {
        throw criarErro(404, 'Venda não encontrada.');
    }

    if (Number(venda.cancelada || 0) === 1) {
        throw criarErro(400, 'Esta venda já foi cancelada.');
    }

    const itens = await dbAll(
        `
        SELECT *
        FROM itens_venda
        WHERE venda_id = ?
        ORDER BY id ASC
        `,
        [vendaId]
    );

    if (!itens || itens.length === 0) {
        throw criarErro(400, 'Esta venda não possui itens para devolver ao estoque.');
    }

    const dataCancelamento = dataHojeLocal();
    const horaCancelamento = horaAgoraLocal();
    const motivo = String(motivoCancelamento || '').trim() || 'Cancelamento de venda';

    await dbRun('BEGIN TRANSACTION');

    try {
        for (const item of itens) {
            const produto = await dbGet(
                `
                SELECT *
                FROM produtos
                WHERE id = ?
                `,
                [item.produto_id]
            );

            if (produto) {
                const estoqueAnterior = Number(produto.estoque || 0);
                const quantidadeDevolvida = Number(item.quantidade || 0);
                const estoqueAtual = estoqueAnterior + quantidadeDevolvida;

                await dbRun(
                    `
                    UPDATE produtos
                    SET estoque = ?
                    WHERE id = ?
                    `,
                    [
                        estoqueAtual,
                        item.produto_id
                    ]
                );

                await dbRun(
                    `
                    INSERT INTO movimentacoes_estoque
                    (
                        venda_id,
                        produto_id,
                        produto_nome,
                        tipo,
                        quantidade,
                        estoque_anterior,
                        estoque_atual,
                        observacao,
                        data,
                        hora
                    )
                    VALUES (?, ?, ?, 'CANCELAMENTO_VENDA', ?, ?, ?, ?, ?, ?)
                    `,
                    [
                        vendaId,
                        item.produto_id,
                        item.produto_nome || produto.nome,
                        quantidadeDevolvida,
                        estoqueAnterior,
                        estoqueAtual,
                        `Cancelamento da venda #${vendaId}. ${motivo}`,
                        dataCancelamento,
                        horaCancelamento
                    ]
                );
            }
        }

        await dbRun(
            `
            UPDATE vendas
            SET
                cancelada = 1,
                data_cancelamento = ?,
                hora_cancelamento = ?,
                motivo_cancelamento = ?
            WHERE id = ?
            `,
            [
                dataCancelamento,
                horaCancelamento,
                motivo,
                vendaId
            ]
        );

        await dbRun(
            `
            UPDATE movimentacoes_estoque
            SET
                cancelada = 1,
                data_cancelamento = ?,
                hora_cancelamento = ?,
                motivo_cancelamento = ?
            WHERE COALESCE(cancelada, 0) = 0
            AND (
                venda_id = ?
                OR (
                    venda_id IS NULL
                    AND tipo = 'VENDA'
                    AND data = ?
                    AND hora = ?
                )
            )
            `,
            [
                dataCancelamento,
                horaCancelamento,
                motivo,
                vendaId,
                venda.data,
                venda.hora
            ]
        );

        await dbRun(
            `
            UPDATE fiados
            SET
                cancelado = 1,
                data_cancelamento = ?,
                hora_cancelamento = ?,
                motivo_cancelamento = ?
            WHERE COALESCE(cancelado, 0) = 0
            AND (
                venda_id = ?
                OR (
                    venda_id IS NULL
                    AND tipo = 'COMPRA'
                    AND cliente_nome = ?
                    AND data = ?
                    AND hora = ?
                )
            )
            `,
            [
                dataCancelamento,
                horaCancelamento,
                motivo,
                vendaId,
                venda.cliente_nome || '',
                venda.data,
                venda.hora
            ]
        );

        await dbRun(
            `
            UPDATE entregas
            SET
                cancelada = 1,
                status_entrega = 'CANCELADA',
                data_cancelamento = ?,
                hora_cancelamento = ?,
                motivo_cancelamento = ?,
                data_status = ?,
                hora_status = ?
            WHERE COALESCE(cancelada, 0) = 0
            AND venda_id = ?
            `,
            [
                dataCancelamento,
                horaCancelamento,
                motivo,
                dataCancelamento,
                horaCancelamento,
                vendaId
            ]
        );

        await dbRun('COMMIT');

        return {
            sucesso: true,
            venda_id: vendaId,
            data_cancelamento: dataCancelamento,
            hora_cancelamento: horaCancelamento
        };

    } catch (erro) {
        await dbRun('ROLLBACK');
        throw erro;
    }
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// DASHBOARD

app.get('/dashboard', async (req, res) => {
    const hoje = dataHojeLocal();

    const dataInicial = req.query.dataInicial || hoje;
    const dataFinal = req.query.dataFinal || hoje;

    const dados = {
        faturamentoPeriodo: 0,
        faturamentoBrutoPeriodo: 0,
        vendasRecebidasPeriodo: 0,
        recebimentosFiadosPeriodo: 0,
        recebimentosEntregasPeriodo: 0,
        retiradasCaixa: 0,
        caixaLiquidoPeriodo: 0,
        totalVendas: 0,
        ticketMedio: 0,
        fiadosAberto: 0,
        produtosBaixos: 0,
        estoqueBaixoAlerta: 0,
        fiadosAtrasados: 0,
        valorFiadosAtrasados: 0,
        entregasPendentes: 0,
        entregasAReceber: 0,
        valorEntregasAReceber: 0,
        totalMovimentacoes: 0,
        produtosMaisVendidos: [],
        formasPagamento: []
    };

    try {
        const vendasPeriodo = await dbGet(
            `
            SELECT
                COALESCE(SUM(
                    CASE
                        WHEN COALESCE(forma_pagamento, '') NOT IN ('FIADO', 'ABATIMENTO_DIVIDA', 'A_RECEBER_ENTREGA')
                        THEN total
                        ELSE 0
                    END
                ), 0) AS total,
                COUNT(
                    CASE
                        WHEN forma_pagamento <> 'ABATIMENTO_DIVIDA'
                        THEN 1
                    END
                ) AS quantidade
            FROM vendas
            WHERE data BETWEEN ? AND ?
            AND COALESCE(cancelada, 0) = 0
            `,
            [dataInicial, dataFinal]
        );

        dados.vendasRecebidasPeriodo = Number(vendasPeriodo.total || 0);
        dados.totalVendas = Number(vendasPeriodo.quantidade || 0);

        const pagamentosFiadosPeriodo = await dbGet(
            `
            SELECT COALESCE(SUM(valor_total), 0) AS total
            FROM fiados
            WHERE tipo = 'PAGAMENTO'
            AND COALESCE(cancelado, 0) = 0
            AND data BETWEEN ? AND ?
            `,
            [dataInicial, dataFinal]
        );

        dados.recebimentosFiadosPeriodo = Number(pagamentosFiadosPeriodo.total || 0);

        const entregasRecebidas = await dbGet(
            `
            SELECT COALESCE(SUM(valor_recebido), 0) AS total
            FROM entregas
            WHERE status_pagamento = 'RECEBIDO_NA_ENTREGA'
            AND COALESCE(cancelada, 0) = 0
            AND data_recebimento BETWEEN ? AND ?
            `,
            [dataInicial, dataFinal]
        );

        dados.recebimentosEntregasPeriodo = Number(entregasRecebidas.total || 0);
        dados.faturamentoBrutoPeriodo = arredondarMoeda(
            dados.vendasRecebidasPeriodo +
            dados.recebimentosFiadosPeriodo +
            dados.recebimentosEntregasPeriodo
        );

        dados.ticketMedio = dados.totalVendas > 0
            ? dados.faturamentoBrutoPeriodo / dados.totalVendas
            : 0;

        const fiados = await dbGet(
            `
            SELECT
                COALESCE(SUM(
                    CASE
                        WHEN f.tipo = 'COMPRA' THEN
                            CASE
                                WHEN (
                                    COALESCE(f.valor_total, 0) -
                                    MAX(COALESCE(f.valor_pago, 0), COALESCE(pi.total_abatido, 0))
                                ) > 0
                                THEN (
                                    COALESCE(f.valor_total, 0) -
                                    MAX(COALESCE(f.valor_pago, 0), COALESCE(pi.total_abatido, 0))
                                )
                                ELSE 0
                            END

                        WHEN f.tipo = 'PAGAMENTO'
                        AND COALESCE(f.origem, '') NOT IN ('PAGAMENTO_ITENS', 'PAGAMENTO_VALOR')
                        THEN -COALESCE(f.valor_total, 0)

                        ELSE 0
                    END
                ), 0) AS total
            FROM fiados f
            LEFT JOIN (
                SELECT
                    fiado_id,
                    COALESCE(SUM(valor_abatido), 0) AS total_abatido
                FROM pagamentos_fiados_itens
                WHERE COALESCE(cancelado, 0) = 0
                GROUP BY fiado_id
            ) pi ON pi.fiado_id = f.id
            WHERE COALESCE(f.cancelado, 0) = 0
            `,
            []
        );

        dados.fiadosAberto = Number(fiados.total || 0);

        const baixos = await dbGet(
            `
            SELECT COUNT(*) AS total
            FROM produtos
            WHERE estoque <= estoque_minimo
            `,
            []
        );

        dados.produtosBaixos = Number(baixos.total || 0);
        dados.estoqueBaixoAlerta = Number(baixos.total || 0);

        const atrasados = await listarFiadosAtrasados();
        dados.fiadosAtrasados = atrasados.length;
        dados.valorFiadosAtrasados = atrasados.reduce((soma, cliente) => {
            return soma + Number(cliente.saldo_total || 0);
        }, 0);

        const entregasPendentes = await dbGet(
            `
            SELECT COUNT(*) AS total
            FROM entregas
            WHERE status_entrega IN ('PENDENTE', 'SAIU_ENTREGA')
            AND COALESCE(cancelada, 0) = 0
            `,
            []
        );

        dados.entregasPendentes = Number(entregasPendentes.total || 0);

        const entregasReceber = await dbGet(
            `
            SELECT
                COUNT(*) AS quantidade,
                COALESCE(SUM(valor_total), 0) AS valor_total
            FROM entregas
            WHERE status_pagamento = 'A_RECEBER_NA_ENTREGA'
            AND status_entrega <> 'CANCELADA'
            AND COALESCE(cancelada, 0) = 0
            `,
            []
        );

        dados.entregasAReceber = Number(entregasReceber.quantidade || 0);
        dados.valorEntregasAReceber = Number(entregasReceber.valor_total || 0);

        const movimentacoes = await dbGet(
            `
            SELECT COUNT(*) AS total
            FROM movimentacoes_estoque
            WHERE data BETWEEN ? AND ?
            AND COALESCE(cancelada, 0) = 0
            `,
            [dataInicial, dataFinal]
        );

        dados.totalMovimentacoes = Number(movimentacoes.total || 0);

        dados.produtosMaisVendidos = await dbAll(
            `
            SELECT
                produto_nome,
                COALESCE(SUM(quantidade), 0) AS quantidade_total,
                COALESCE(SUM(valor_total), 0) AS valor_total
            FROM itens_venda
            WHERE venda_id IN (
                SELECT id
                FROM vendas
                WHERE data BETWEEN ? AND ?
                AND COALESCE(cancelada, 0) = 0
            )
            GROUP BY produto_nome
            ORDER BY quantidade_total DESC
            LIMIT 10
            `,
            [dataInicial, dataFinal]
        );

        dados.formasPagamento = await dbAll(
            `
            SELECT
                forma_pagamento,
                COALESCE(SUM(total), 0) AS total,
                COUNT(*) AS quantidade
            FROM vendas
            WHERE data BETWEEN ? AND ?
            AND COALESCE(cancelada, 0) = 0
            GROUP BY forma_pagamento
            ORDER BY total DESC
            `,
            [dataInicial, dataFinal]
        );

        const retiradas = await dbGet(
            `
            SELECT COALESCE(SUM(valor), 0) AS total
            FROM retiradas_caixa
            WHERE COALESCE(cancelada, 0) = 0
            AND data BETWEEN ? AND ?
            `,
            [dataInicial, dataFinal]
        );

        dados.retiradasCaixa = Number(retiradas.total || 0);
        dados.caixaLiquidoPeriodo = arredondarMoeda(dados.faturamentoBrutoPeriodo - dados.retiradasCaixa);
        dados.faturamentoPeriodo = dados.caixaLiquidoPeriodo;

        res.json(dados);
    } catch (err) {
        res.status(500).json(err);
    }
});

// PRODUTOS

app.get('/produtos', (req, res) => {
    db.all(
        `
        SELECT *
        FROM produtos
        ORDER BY nome ASC
        `,
        [],
        (err, rows) => {
            if (err) return res.status(500).json(err);
            res.json(rows);
        }
    );
});

app.post('/produtos', (req, res) => {
    const {
        codigo,
        nome,
        categoria,
        descricao,
        custo,
        preco,
        estoque,
        estoque_minimo,
        unidade_medida,
        permite_fracionado
    } = req.body;

    const unidadeMedida = normalizarUnidadeMedida(unidade_medida);
    const permiteFracionado = normalizarPermiteFracionado(permite_fracionado);

    db.run(
        `
        INSERT INTO produtos
        (
            codigo,
            nome,
            categoria,
            descricao,
            custo,
            preco,
            estoque,
            estoque_minimo,
            unidade_medida,
            permite_fracionado
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
            codigo,
            nome,
            categoria,
            descricao || '',
            converterNumeroOrcamentoApi(custo),
            converterNumeroOrcamentoApi(preco),
            converterNumeroOrcamentoApi(estoque),
            converterNumeroOrcamentoApi(estoque_minimo),
            unidadeMedida,
            permiteFracionado
        ],
        function(err) {
            if (err) return res.status(500).json(err);
            res.json({ sucesso: true, id: this.lastID });
        }
    );
});

app.put('/produtos/:id/entrada', (req, res) => {
    const id = req.params.id;
    const quantidade = converterNumeroOrcamentoApi(req.body.quantidade || 0);

    if (quantidade <= 0) {
        return res.status(400).json({ erro: 'Quantidade inválida.' });
    }

    db.run(
        `
        UPDATE produtos
        SET estoque = estoque + ?
        WHERE id = ?
        `,
        [quantidade, id],
        function(err) {
            if (err) return res.status(500).json(err);
            res.json({ sucesso: true });
        }
    );
});

app.put('/produtos/:id', (req, res) => {
    const id = req.params.id;

    const {
        codigo,
        nome,
        categoria,
        descricao,
        custo,
        preco,
        estoque,
        estoque_minimo,
        unidade_medida,
        permite_fracionado,
        ativo
    } = req.body;

    const unidadeMedida = normalizarUnidadeMedida(unidade_medida);
    const permiteFracionado = normalizarPermiteFracionado(permite_fracionado);

    db.run(
        `
        UPDATE produtos
        SET
            codigo = ?,
            nome = ?,
            categoria = ?,
            descricao = ?,
            custo = ?,
            preco = ?,
            estoque = ?,
            estoque_minimo = ?,
            unidade_medida = ?,
            permite_fracionado = ?,
            ativo = ?
        WHERE id = ?
        `,
        [
            codigo,
            nome,
            categoria,
            descricao,
            converterNumeroOrcamentoApi(custo),
            converterNumeroOrcamentoApi(preco),
            converterNumeroOrcamentoApi(estoque),
            converterNumeroOrcamentoApi(estoque_minimo),
            unidadeMedida,
            permiteFracionado,
            ativo,
            id
        ],
        function(err) {
            if (err) return res.status(500).json(err);
            res.json({ sucesso: true });
        }
    );
});

app.delete('/produtos/:id', (req, res) => {
    const id = req.params.id;

    db.run(
        `
        DELETE FROM produtos
        WHERE id = ?
        `,
        [id],
        function(err) {
            if (err) return res.status(500).json(err);
            res.json({ sucesso: true });
        }
    );
});

// ORCAMENTOS

function formatarNumeroOrcamento(id) {
    return `ORC-${String(id).padStart(6, '0')}`;
}

function normalizarStatusOrcamento(status) {
    const statusNormalizado = String(status || '').trim().toUpperCase();
    const permitidos = ['ABERTO', 'APROVADO', 'CANCELADO', 'EXPIRADO'];

    return permitidos.includes(statusNormalizado) ? statusNormalizado : '';
}

function converterNumeroOrcamentoApi(valor) {
    if (valor === null || valor === undefined || valor === '') return 0;
    if (typeof valor === 'number') return Number.isFinite(valor) ? valor : 0;

    const texto = String(valor).trim().replace(/[R$\s]/g, '');
    if (!texto) return 0;

    const ultimaVirgula = texto.lastIndexOf(',');
    const ultimoPonto = texto.lastIndexOf('.');
    let normalizado = texto;

    if (ultimaVirgula > -1 && ultimoPonto > -1) {
        normalizado = ultimaVirgula > ultimoPonto
            ? texto.replace(/\./g, '').replace(',', '.')
            : texto.replace(/,/g, '');
    } else if (ultimaVirgula > -1) {
        normalizado = texto.replace(/\./g, '').replace(',', '.');
    }

    const numero = Number(normalizado);
    return Number.isFinite(numero) ? numero : 0;
}

app.post('/orcamentos', async (req, res) => {
    try {
        const {
            cliente_nome,
            telefone,
            cidade,
            observacao,
            validade,
            desconto,
            frete,
            itens
        } = req.body;

        if (!Array.isArray(itens) || itens.length === 0) {
            return res.status(400).json({ erro: 'Adicione pelo menos um item ao orçamento.' });
        }

        const itensValidos = itens.map(item => {
            const quantidade = converterNumeroOrcamentoApi(item.quantidade || 0);
            const valorUnitario = converterNumeroOrcamentoApi(item.valor_unitario || 0);
            const descontoItem = Math.max(0, converterNumeroOrcamentoApi(item.desconto_item || 0));
            const valorTotal = arredondarMoeda((quantidade * valorUnitario) - descontoItem);

            return {
                produto_id: item.produto_id ? Number(item.produto_id) : null,
                codigo: String(item.codigo || '').trim(),
                produto_nome: String(item.produto_nome || item.nome || '').trim(),
                categoria: String(item.categoria || '').trim(),
                quantidade,
                unidade_medida: normalizarUnidadeMedida(item.unidade_medida),
                valor_unitario: valorUnitario,
                desconto_item: descontoItem,
                valor_total: valorTotal > 0 ? valorTotal : 0
            };
        });

        const itemInvalido = itensValidos.find(item => {
            return !item.produto_nome || item.quantidade <= 0 || item.valor_unitario < 0;
        });

        if (itemInvalido) {
            return res.status(400).json({ erro: 'Revise os itens do orçamento. Produto, quantidade e valor unitário são obrigatórios.' });
        }

        const subtotal = arredondarMoeda(itensValidos.reduce((soma, item) => {
            return soma + Number(item.valor_total || 0);
        }, 0));

        const descontoGeral = arredondarMoeda(Math.max(0, converterNumeroOrcamentoApi(desconto)));
        const freteOrcamento = arredondarMoeda(Math.max(0, converterNumeroOrcamentoApi(frete)));
        const total = arredondarMoeda(Math.max(0, subtotal + freteOrcamento - descontoGeral));
        const dataCriacao = dataHojeLocal();
        const horaCriacao = horaAgoraLocal();

        await dbRun('BEGIN TRANSACTION');

        try {
            const resultado = await dbRun(
                `
                INSERT INTO orcamentos
                (
                    cliente_nome,
                    telefone,
                    cidade,
                    observacao,
                    validade,
                    subtotal,
                    desconto,
                    frete,
                    total,
                    status,
                    data_criacao,
                    hora_criacao
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ABERTO', ?, ?)
                `,
                [
                    String(cliente_nome || '').trim(),
                    String(telefone || '').trim(),
                    String(cidade || '').trim(),
                    String(observacao || '').trim(),
                    String(validade || '').trim(),
                    subtotal,
                    descontoGeral,
                    freteOrcamento,
                    total,
                    dataCriacao,
                    horaCriacao
                ]
            );

            const orcamentoId = resultado.lastID;
            const numero = formatarNumeroOrcamento(orcamentoId);

            await dbRun(
                `
                UPDATE orcamentos
                SET numero = ?
                WHERE id = ?
                `,
                [numero, orcamentoId]
            );

            for (const item of itensValidos) {
                await dbRun(
                    `
                    INSERT INTO orcamento_itens
                    (
                        orcamento_id,
                        produto_id,
                        codigo,
                        produto_nome,
                        categoria,
                        quantidade,
                        unidade_medida,
                        valor_unitario,
                        desconto_item,
                        valor_total
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `,
                    [
                        orcamentoId,
                        item.produto_id,
                        item.codigo,
                        item.produto_nome,
                        item.categoria,
                        item.quantidade,
                        item.unidade_medida,
                        item.valor_unitario,
                        item.desconto_item,
                        item.valor_total
                    ]
                );
            }

            await dbRun('COMMIT');

            res.json({
                sucesso: true,
                id: orcamentoId,
                numero,
                subtotal,
                desconto: descontoGeral,
                frete: freteOrcamento,
                total
            });

        } catch (erroTransacao) {
            await dbRun('ROLLBACK');
            throw erroTransacao;
        }

    } catch (erro) {
        tratarErro(res, erro);
    }
});

app.get('/orcamentos', async (req, res) => {
    try {
        const rows = await dbAll(
            `
            SELECT
                id,
                numero,
                cliente_nome,
                telefone,
                cidade,
                validade,
                subtotal,
                desconto,
                frete,
                total,
                status,
                data_criacao,
                hora_criacao
            FROM orcamentos
            WHERE COALESCE(removido_historico, 0) = 0
            ORDER BY id DESC
            `
        );

        res.json(rows);

    } catch (erro) {
        tratarErro(res, erro);
    }
});

app.get('/orcamentos/:id', async (req, res) => {
    try {
        const id = req.params.id;

        const orcamento = await dbGet(
            `
            SELECT *
            FROM orcamentos
            WHERE id = ?
            `,
            [id]
        );

        if (!orcamento) {
            return res.status(404).json({ erro: 'Orçamento não encontrado.' });
        }

        const itens = await dbAll(
            `
            SELECT *
            FROM orcamento_itens
            WHERE orcamento_id = ?
            ORDER BY id ASC
            `,
            [id]
        );

        res.json({ orcamento, itens });

    } catch (erro) {
        tratarErro(res, erro);
    }
});

app.patch('/orcamentos/:id/status', async (req, res) => {
    try {
        const id = req.params.id;
        const status = normalizarStatusOrcamento(req.body.status);

        if (!status) {
            return res.status(400).json({ erro: 'Status de orçamento inválido.' });
        }

        const resultado = await dbRun(
            `
            UPDATE orcamentos
            SET status = ?
            WHERE id = ?
            `,
            [status, id]
        );

        if (resultado.changes === 0) {
            return res.status(404).json({ erro: 'Orçamento não encontrado.' });
        }

        res.json({ sucesso: true, id: Number(id), status });

    } catch (erro) {
        tratarErro(res, erro);
    }
});

app.patch('/orcamentos/:id/remover-historico', async (req, res) => {
    try {
        const id = req.params.id;
        const orcamento = await dbGet(
            `
            SELECT id
            FROM orcamentos
            WHERE id = ?
            `,
            [id]
        );

        if (!orcamento) {
            return res.status(404).json({ erro: 'Orçamento não encontrado.' });
        }

        await dbRun(
            `
            UPDATE orcamentos
            SET removido_historico = 1
            WHERE id = ?
            `,
            [id]
        );

        res.json({
            sucesso: true,
            id: Number(id),
            mensagem: 'Orçamento removido do histórico com sucesso.'
        });

    } catch (erro) {
        tratarErro(res, erro);
    }
});

// CLIENTES

app.get('/clientes', (req, res) => {
    db.all(
        `
        SELECT
            id,
            nome,
            telefone,
            cidade,
            observacao,
            data_cadastro,
            (
                SELECT e.endereco
                FROM entregas e
                WHERE LOWER(TRIM(e.cliente_nome)) = LOWER(TRIM(clientes.nome))
                    AND e.endereco IS NOT NULL
                    AND TRIM(e.endereco) <> ''
                ORDER BY e.id DESC
                LIMIT 1
            ) AS endereco
        FROM clientes
        ORDER BY nome ASC
        `,
        [],
        (err, rows) => {
            if (err) return res.status(500).json(err);
            res.json(rows);
        }
    );
});

// VENDAS

app.post('/vendas', async (req, res) => {
    try {
        const {
            forma_pagamento,
            cliente_nome,
            cliente_telefone,
            cliente_cidade,
            itens,
            observacao,
            entrega
        } = req.body;

        const descontoGeral = Math.max(0, converterNumeroOrcamentoApi(req.body.desconto || 0));

        if (!itens || itens.length === 0) {
            throw criarErro(400, 'Venda sem itens.');
        }

        const data = dataHojeLocal();
        const hora = horaAgoraLocal();
        const temEntrega = !!(entrega && entrega.tem_entrega);

        const entregaClienteNome = temEntrega ? String(entrega.cliente_nome || '').trim() : '';
        const entregaTelefone = temEntrega ? String(entrega.telefone || '').trim() : '';
        const entregaEndereco = temEntrega ? String(entrega.endereco || '').trim() : '';
        const entregaBairroCidade = temEntrega ? String(entrega.bairro_cidade || '').trim() : '';
        const entregaObservacao = temEntrega ? String(entrega.observacao || '').trim() : '';
        const freteEntregaInformado = converterNumeroOrcamentoApi(temEntrega ? entrega.frete || 0 : 0);
        const freteEntrega = temEntrega
            ? arredondarMoeda(Math.max(0, Number.isFinite(freteEntregaInformado) ? freteEntregaInformado : 0))
            : 0;
        const statusPagamentoEntrega = temEntrega
            ? String(entrega.status_pagamento || 'PAGO_NA_COMPRA').trim()
            : '';

        let formaPagamentoFinal = forma_pagamento;

        if (temEntrega && statusPagamentoEntrega === 'A_RECEBER_NA_ENTREGA') {
            formaPagamentoFinal = 'A_RECEBER_ENTREGA';
        }

        if (temEntrega && statusPagamentoEntrega === 'FIADO') {
            formaPagamentoFinal = 'FIADO';
        }

        const clienteNomeFinal = String(cliente_nome || entregaClienteNome || '').trim();
        const clienteTelefoneFinal = String(cliente_telefone || entregaTelefone || '').trim();
        const clienteCidadeFinal = String(cliente_cidade || entregaBairroCidade || '').trim();

        if (formaPagamentoFinal === 'FIADO' && !clienteNomeFinal) {
            throw criarErro(400, 'Informe o cliente para venda a prazo.');
        }

        if (formaPagamentoFinal === 'ABATIMENTO_DIVIDA') {
            if (!clienteNomeFinal) {
                throw criarErro(400, 'Informe o cliente do abatimento de d\u00edvida.');
            }

            if (!observacao || !String(observacao).trim()) {
                throw criarErro(400, 'Informe a observa\u00e7\u00e3o do abatimento de d\u00edvida.');
            }
        }

        if (temEntrega) {
            if (!entregaClienteNome) {
                throw criarErro(400, 'Informe o cliente da entrega.');
            }

            if (!entregaEndereco) {
                throw criarErro(400, 'Informe o endere\u00e7o da entrega.');
            }

            if (!['PAGO_NA_COMPRA', 'A_RECEBER_NA_ENTREGA', 'FIADO'].includes(statusPagamentoEntrega)) {
                throw criarErro(400, 'Status de pagamento da entrega inv\u00e1lido.');
            }
        }

        const itensCalculados = itens.map(item => {
            const id = Number(item.id);
            const quantidade = converterNumeroOrcamentoApi(item.quantidade || 0);
            const precoVendido = converterNumeroOrcamentoApi(item.preco || 0);
            const totalBruto = arredondarMoeda(quantidade * precoVendido);

            if (!Number.isFinite(id) || id <= 0) {
                throw criarErro(400, 'Produto inv\u00e1lido na venda.');
            }

            if (!Number.isFinite(quantidade) || quantidade <= 0) {
                throw criarErro(400, 'Quantidade inv\u00e1lida na venda.');
            }

            return {
                ...item,
                id,
                quantidade,
                precoVendido,
                totalBruto,
                descontoRateio: 0,
                totalFinal: totalBruto
            };
        });

        const subtotalVenda = arredondarMoeda(
            itensCalculados.reduce((total, item) => total + Number(item.totalBruto || 0), 0)
        );

        if (subtotalVenda <= 0) {
            throw criarErro(400, 'Total da venda inv\u00e1lido.');
        }

        if (descontoGeral > subtotalVenda) {
            throw criarErro(400, 'O desconto n\u00e3o pode ser maior que o subtotal da venda.');
        }

        const descontoVenda = arredondarMoeda(descontoGeral);
        const totalVenda = arredondarMoeda(subtotalVenda - descontoVenda + freteEntrega);

        const valorRecebidoVenda = formaPagamentoFinal === 'DINHEIRO'
            ? arredondarMoeda(Math.max(0, converterNumeroOrcamentoApi(req.body.valor_recebido || 0)))
            : 0;

        const trocoVenda = formaPagamentoFinal === 'DINHEIRO'
            ? arredondarMoeda(Math.max(0, converterNumeroOrcamentoApi(req.body.troco || 0)))
            : 0;

        let descontoAcumulado = 0;

        itensCalculados.forEach((item, index) => {
            let descontoRateio = 0;

            if (descontoVenda > 0) {
                if (index === itensCalculados.length - 1) {
                    descontoRateio = arredondarMoeda(descontoVenda - descontoAcumulado);
                } else {
                    descontoRateio = arredondarMoeda((item.totalBruto / subtotalVenda) * descontoVenda);
                    descontoAcumulado = arredondarMoeda(descontoAcumulado + descontoRateio);
                }
            }

            item.descontoRateio = descontoRateio;
            item.totalFinal = arredondarMoeda(item.totalBruto - descontoRateio);
        });

        const idsProdutos = [...new Set(itensCalculados.map(item => item.id))];
        const marcadoresProdutos = idsProdutos.map(() => '?').join(',');
        const produtos = await dbAll(
            `
            SELECT *
            FROM produtos
            WHERE id IN (${marcadoresProdutos})
            `,
            idsProdutos
        );
        const produtosPorId = new Map(produtos.map(produto => [Number(produto.id), produto]));
        const quantidadesPorProduto = new Map();

        itensCalculados.forEach(item => {
            const quantidadeAtual = Number(quantidadesPorProduto.get(item.id) || 0);
            quantidadesPorProduto.set(item.id, arredondarMoeda(quantidadeAtual + converterNumeroOrcamentoApi(item.quantidade || 0)));
        });

        for (const [produtoId, quantidadeSolicitada] of quantidadesPorProduto.entries()) {
            const produto = produtosPorId.get(produtoId);
            const item = itensCalculados.find(itemCalculado => itemCalculado.id === produtoId);

            if (!produto) {
                throw criarErro(404, `Produto n\u00e3o encontrado: ${item ? item.nome : produtoId}`);
            }

            const estoqueAtual = Number(produto.estoque || 0);
            const unidadeMedida = normalizarUnidadeMedida(produto.unidade_medida);
            const permiteFracionado = normalizarPermiteFracionado(produto.permite_fracionado);

            if (!permiteFracionado) {
                const itemDecimal = itensCalculados.find(itemCalculado => {
                    return itemCalculado.id === produtoId && !quantidadeEhInteira(itemCalculado.quantidade);
                });

                if (itemDecimal || !quantidadeEhInteira(quantidadeSolicitada)) {
                    throw criarErro(400, `Este produto n\u00e3o permite venda fracionada: ${produto.nome}.`);
                }
            }

            if (estoqueAtual < quantidadeSolicitada) {
                throw criarErro(400, `Estoque insuficiente para o produto: ${produto.nome}. Estoque atual: ${estoqueAtual} ${unidadeMedida}. Quantidade solicitada: ${quantidadeSolicitada} ${unidadeMedida}.`);
            }
        }

        await dbRun('BEGIN TRANSACTION');

        try {
            if (clienteNomeFinal && (formaPagamentoFinal === 'FIADO' || temEntrega)) {
                const cliente = await dbGet(
                    `
                    SELECT id
                    FROM clientes
                    WHERE nome = ?
                    `,
                    [clienteNomeFinal]
                );

                if (cliente) {
                    await dbRun(
                        `
                        UPDATE clientes
                        SET telefone = ?, cidade = ?
                        WHERE nome = ?
                        `,
                        [
                            clienteTelefoneFinal || '',
                            clienteCidadeFinal || '',
                            clienteNomeFinal
                        ]
                    );
                } else {
                    await dbRun(
                        `
                        INSERT INTO clientes
                        (
                            nome,
                            telefone,
                            cidade,
                            data_cadastro
                        )
                        VALUES (?, ?, ?, ?)
                        `,
                        [
                            clienteNomeFinal,
                            clienteTelefoneFinal || '',
                            clienteCidadeFinal || '',
                            data
                        ]
                    );
                }
            }

            const resultadoVenda = await dbRun(
                `
                INSERT INTO vendas
                (
                    data,
                    hora,
                    forma_pagamento,
                    cliente_nome,
                    subtotal,
                    desconto,
                    total,
                    valor_recebido,
                    troco,
                    observacao,
                    cancelada
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
                `,
                [
                    data,
                    hora,
                    formaPagamentoFinal,
                    clienteNomeFinal || '',
                    subtotalVenda,
                    descontoVenda,
                    totalVenda,
                    valorRecebidoVenda,
                    trocoVenda,
                    observacao || ''
                ]
            );
            const vendaId = resultadoVenda.lastID;

            for (const item of itensCalculados) {
                const produto = produtosPorId.get(item.id);
                const quantidade = converterNumeroOrcamentoApi(item.quantidade || 0);
                const preco = converterNumeroOrcamentoApi(item.precoVendido || 0);
                const totalItemFinal = Number(item.totalFinal || 0);
                const estoqueAnterior = Number(produto.estoque || 0);
                const estoqueAtual = arredondarMoeda(estoqueAnterior - quantidade);
                produto.estoque = estoqueAtual;
                const unidadeMedida = normalizarUnidadeMedida(produto.unidade_medida);

                const valorOriginalUnitario = converterNumeroOrcamentoApi(item.preco_original || produto.preco || preco || 0);
                const descontoUnitario = Math.max(valorOriginalUnitario - preco, 0);
                const descontoUnitarioTotal = arredondarMoeda(descontoUnitario * quantidade);
                const descontoTotalItem = arredondarMoeda(descontoUnitarioTotal + Number(item.descontoRateio || 0));

                await dbRun(
                    `
                    INSERT INTO itens_venda
                    (
                        venda_id,
                        produto_id,
                        produto_nome,
                        quantidade,
                        unidade_medida,
                        valor_original_unitario,
                        valor_unitario,
                        desconto_unitario,
                        desconto_total,
                        valor_total
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    `,
                    [
                        vendaId,
                        item.id,
                        produto.nome,
                        quantidade,
                        unidadeMedida,
                        valorOriginalUnitario,
                        preco,
                        descontoUnitario,
                        descontoTotalItem,
                        totalItemFinal
                    ]
                );

                await dbRun(
                    `
                    UPDATE produtos
                    SET estoque = ?
                    WHERE id = ?
                    `,
                    [
                        estoqueAtual,
                        item.id
                    ]
                );

                let observacaoMovimentacao = `Venda ${formaPagamentoFinal}`;

                if (formaPagamentoFinal === 'FIADO') {
                    observacaoMovimentacao = `Venda a prazo para ${clienteNomeFinal}`;
                }

                if (formaPagamentoFinal === 'ABATIMENTO_DIVIDA') {
                    observacaoMovimentacao = `Venda por abatimento de d\u00edvida para ${clienteNomeFinal}`;
                }

                if (formaPagamentoFinal === 'A_RECEBER_ENTREGA') {
                    observacaoMovimentacao = `Venda para receber na entrega de ${entregaClienteNome}`;
                }

                if (descontoVenda > 0 || descontoTotalItem > 0) {
                    observacaoMovimentacao += ' com desconto';
                }

                await dbRun(
                    `
                    INSERT INTO movimentacoes_estoque
                    (
                        venda_id,
                        produto_id,
                        produto_nome,
                        tipo,
                        quantidade,
                        estoque_anterior,
                        estoque_atual,
                        observacao,
                        data,
                        hora,
                        cancelada
                    )
                    VALUES (?, ?, ?, 'VENDA', ?, ?, ?, ?, ?, ?, 0)
                    `,
                    [
                        vendaId,
                        item.id,
                        produto.nome,
                        quantidade,
                        estoqueAnterior,
                        estoqueAtual,
                        observacaoMovimentacao,
                        data,
                        hora
                    ]
                );

                if (formaPagamentoFinal === 'FIADO') {
                    const valorUnitarioFiado = quantidade > 0
                        ? arredondarMoeda(totalItemFinal / quantidade)
                        : preco;

                    await dbRun(
                        `
                        INSERT INTO fiados
                        (
                            venda_id,
                            cliente_nome,
                            tipo,
                            produto,
                            quantidade,
                            unidade_medida,
                            valor_unitario,
                            valor_total,
                            valor_pago,
                            quitado,
                            observacao,
                            data,
                            hora,
                            origem,
                            cancelado
                        )
                        VALUES (?, ?, 'COMPRA', ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, 'VENDA_A_PRAZO', 0)
                        `,
                        [
                            vendaId,
                            clienteNomeFinal,
                            produto.nome,
                            quantidade,
                            unidadeMedida,
                            valorUnitarioFiado,
                            totalItemFinal,
                            observacao || entregaObservacao || 'Venda a prazo pelo caixa',
                            data,
                            hora
                        ]
                    );
                }
            }

            if (formaPagamentoFinal === 'FIADO' && temEntrega && freteEntrega > 0) {
                await dbRun(
                    `
                    INSERT INTO fiados
                    (
                        venda_id,
                        cliente_nome,
                        tipo,
                        produto,
                        quantidade,
                        valor_unitario,
                        valor_total,
                        valor_pago,
                        quitado,
                        observacao,
                        data,
                        hora,
                        origem,
                        cancelado
                    )
                    VALUES (?, ?, 'COMPRA', 'Frete da entrega', 1, ?, ?, 0, 0, ?, ?, ?, 'VENDA_A_PRAZO', 0)
                    `,
                    [
                        vendaId,
                        clienteNomeFinal,
                        freteEntrega,
                        freteEntrega,
                        entregaObservacao || 'Frete de venda a prazo com entrega',
                        data,
                        hora
                    ]
                );
            }

            if (temEntrega) {
                const valorRecebidoEntrega = statusPagamentoEntrega === 'PAGO_NA_COMPRA'
                    ? totalVenda
                    : 0;

                const formaRecebimentoEntrega = statusPagamentoEntrega === 'PAGO_NA_COMPRA'
                    ? formaPagamentoFinal
                    : '';

                const dataRecebimentoEntrega = statusPagamentoEntrega === 'PAGO_NA_COMPRA'
                    ? data
                    : '';

                const horaRecebimentoEntrega = statusPagamentoEntrega === 'PAGO_NA_COMPRA'
                    ? hora
                    : '';

                await dbRun(
                    `
                    INSERT INTO entregas
                    (
                        venda_id,
                        cliente_nome,
                        telefone,
                        endereco,
                        bairro_cidade,
                        observacao,
                        status_entrega,
                        status_pagamento,
                        forma_recebimento,
                        frete,
                        valor_total,
                        valor_recebido,
                        data,
                        hora,
                        data_status,
                        hora_status,
                        data_recebimento,
                        hora_recebimento,
                        cancelada
                    )
                    VALUES (?, ?, ?, ?, ?, ?, 'PENDENTE', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
                    `,
                    [
                        vendaId,
                        entregaClienteNome,
                        entregaTelefone,
                        entregaEndereco,
                        entregaBairroCidade,
                        entregaObservacao,
                        statusPagamentoEntrega,
                        formaRecebimentoEntrega,
                        freteEntrega,
                        totalVenda,
                        valorRecebidoEntrega,
                        data,
                        hora,
                        data,
                        hora,
                        dataRecebimentoEntrega,
                        horaRecebimentoEntrega
                    ]
                );
            }

            await dbRun('COMMIT');

            return res.json({
                sucesso: true,
                venda_id: vendaId,
                subtotal: subtotalVenda,
                desconto: descontoVenda,
                frete: freteEntrega,
                total: totalVenda
            });

        } catch (erroTransacao) {
            await dbRun('ROLLBACK');
            throw erroTransacao;
        }

    } catch (erro) {
        tratarErro(res, erro);
    }
});

function registrarVendaLegadoSemTransacao(req, res) {
    const {
        forma_pagamento,
        cliente_nome,
        cliente_telefone,
        cliente_cidade,
        itens,
        observacao,
        entrega
    } = req.body;

        const descontoGeral = Math.max(0, converterNumeroOrcamentoApi(req.body.desconto || 0));

    if (!itens || itens.length === 0) {
        return res.status(400).json({ erro: 'Venda sem itens.' });
    }

    const data = dataHojeLocal();
    const hora = horaAgoraLocal();
    const temEntrega = !!(entrega && entrega.tem_entrega);

    const entregaClienteNome = temEntrega ? String(entrega.cliente_nome || '').trim() : '';
    const entregaTelefone = temEntrega ? String(entrega.telefone || '').trim() : '';
    const entregaEndereco = temEntrega ? String(entrega.endereco || '').trim() : '';
    const entregaBairroCidade = temEntrega ? String(entrega.bairro_cidade || '').trim() : '';
    const entregaObservacao = temEntrega ? String(entrega.observacao || '').trim() : '';
    const freteEntregaInformado = Number(String(temEntrega ? entrega.frete || 0 : 0).replace(',', '.'));
    const freteEntrega = temEntrega
        ? arredondarMoeda(Math.max(0, Number.isFinite(freteEntregaInformado) ? freteEntregaInformado : 0))
        : 0;
    const statusPagamentoEntrega = temEntrega
        ? String(entrega.status_pagamento || 'PAGO_NA_COMPRA').trim()
        : '';

    let formaPagamentoFinal = forma_pagamento;

    if (temEntrega && statusPagamentoEntrega === 'A_RECEBER_NA_ENTREGA') {
        formaPagamentoFinal = 'A_RECEBER_ENTREGA';
    }

    if (temEntrega && statusPagamentoEntrega === 'FIADO') {
        formaPagamentoFinal = 'FIADO';
    }

    const clienteNomeFinal = String(cliente_nome || entregaClienteNome || '').trim();
    const clienteTelefoneFinal = String(cliente_telefone || entregaTelefone || '').trim();
    const clienteCidadeFinal = String(cliente_cidade || entregaBairroCidade || '').trim();

    if (formaPagamentoFinal === 'FIADO' && !clienteNomeFinal) {
        return res.status(400).json({ erro: 'Informe o cliente para venda a prazo.' });
    }

    if (formaPagamentoFinal === 'ABATIMENTO_DIVIDA') {
        if (!clienteNomeFinal) {
            return res.status(400).json({ erro: 'Informe o cliente do abatimento de dívida.' });
        }

        if (!observacao || !String(observacao).trim()) {
            return res.status(400).json({ erro: 'Informe a observação do abatimento de dívida.' });
        }
    }

    if (temEntrega) {
        if (!entregaClienteNome) {
            return res.status(400).json({ erro: 'Informe o cliente da entrega.' });
        }

        if (!entregaEndereco) {
            return res.status(400).json({ erro: 'Informe o endereço da entrega.' });
        }

        if (!['PAGO_NA_COMPRA', 'A_RECEBER_NA_ENTREGA', 'FIADO'].includes(statusPagamentoEntrega)) {
            return res.status(400).json({ erro: 'Status de pagamento da entrega inválido.' });
        }
    }

    const itensCalculados = itens.map(item => {
            const quantidade = converterNumeroOrcamentoApi(item.quantidade || 0);
            const precoVendido = converterNumeroOrcamentoApi(item.preco || 0);
        const totalBruto = arredondarMoeda(quantidade * precoVendido);

        return {
            ...item,
            quantidade,
            precoVendido,
            totalBruto,
            descontoRateio: 0,
            totalFinal: totalBruto
        };
    });

    const subtotalVenda = arredondarMoeda(
        itensCalculados.reduce((total, item) => total + Number(item.totalBruto || 0), 0)
    );

    if (subtotalVenda <= 0) {
        return res.status(400).json({ erro: 'Total da venda inválido.' });
    }

    if (descontoGeral > subtotalVenda) {
        return res.status(400).json({ erro: 'O desconto não pode ser maior que o subtotal da venda.' });
    }

    const descontoVenda = arredondarMoeda(descontoGeral);
    const totalVenda = arredondarMoeda(subtotalVenda - descontoVenda + freteEntrega);

    const valorRecebidoVenda = formaPagamentoFinal === 'DINHEIRO'
            ? arredondarMoeda(Math.max(0, converterNumeroOrcamentoApi(req.body.valor_recebido || 0)))
        : 0;

    const trocoVenda = formaPagamentoFinal === 'DINHEIRO'
            ? arredondarMoeda(Math.max(0, converterNumeroOrcamentoApi(req.body.troco || 0)))
        : 0;

    let descontoAcumulado = 0;

    itensCalculados.forEach((item, index) => {
        let descontoRateio = 0;

        if (descontoVenda > 0) {
            if (index === itensCalculados.length - 1) {
                descontoRateio = arredondarMoeda(descontoVenda - descontoAcumulado);
            } else {
                descontoRateio = arredondarMoeda((item.totalBruto / subtotalVenda) * descontoVenda);
                descontoAcumulado = arredondarMoeda(descontoAcumulado + descontoRateio);
            }
        }

        item.descontoRateio = descontoRateio;
        item.totalFinal = arredondarMoeda(item.totalBruto - descontoRateio);
    });

    function salvarOuAtualizarClienteVenda(callback) {
        if (!clienteNomeFinal) {
            callback();
            return;
        }

        if (formaPagamentoFinal !== 'FIADO' && !temEntrega) {
            callback();
            return;
        }

        db.get(
            `
            SELECT id
            FROM clientes
            WHERE nome = ?
            `,
            [clienteNomeFinal],
            (err, cliente) => {
                if (err) {
                    return res.status(500).json(err);
                }

                if (cliente) {
                    db.run(
                        `
                        UPDATE clientes
                        SET telefone = ?, cidade = ?
                        WHERE nome = ?
                        `,
                        [
                            clienteTelefoneFinal || '',
                            clienteCidadeFinal || '',
                            clienteNomeFinal
                        ],
                        (err) => {
                            if (err) return res.status(500).json(err);
                            callback();
                        }
                    );
                } else {
                    db.run(
                        `
                        INSERT INTO clientes
                        (
                            nome,
                            telefone,
                            cidade,
                            data_cadastro
                        )
                        VALUES (?, ?, ?, ?)
                        `,
                        [
                            clienteNomeFinal,
                            clienteTelefoneFinal || '',
                            clienteCidadeFinal || '',
                            data
                        ],
                        (err) => {
                            if (err) return res.status(500).json(err);
                            callback();
                        }
                    );
                }
            }
        );
    }

    salvarOuAtualizarClienteVenda(() => {
        db.run(
            `
            INSERT INTO vendas
            (
                data,
                hora,
                forma_pagamento,
                cliente_nome,
                subtotal,
                desconto,
                total,
                valor_recebido,
                troco,
                observacao,
                cancelada
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
            `,
            [
                data,
                hora,
                formaPagamentoFinal,
                clienteNomeFinal || '',
                subtotalVenda,
                descontoVenda,
                totalVenda,
                valorRecebidoVenda,
                trocoVenda,
                observacao || ''
            ],
            function(err) {
                if (err) return res.status(500).json(err);

                const vendaId = this.lastID;

                function salvarEntregaSeNecessario(callback) {
                    if (!temEntrega) {
                        callback();
                        return;
                    }

                    const valorRecebidoEntrega = statusPagamentoEntrega === 'PAGO_NA_COMPRA'
                        ? totalVenda
                        : 0;

                    const formaRecebimentoEntrega = statusPagamentoEntrega === 'PAGO_NA_COMPRA'
                        ? formaPagamentoFinal
                        : '';

                    const dataRecebimentoEntrega = statusPagamentoEntrega === 'PAGO_NA_COMPRA'
                        ? data
                        : '';

                    const horaRecebimentoEntrega = statusPagamentoEntrega === 'PAGO_NA_COMPRA'
                        ? hora
                        : '';

                    db.run(
                        `
                        INSERT INTO entregas
                        (
                            venda_id,
                            cliente_nome,
                            telefone,
                            endereco,
                            bairro_cidade,
                            observacao,
                            status_entrega,
                            status_pagamento,
                            forma_recebimento,
                            frete,
                            valor_total,
                            valor_recebido,
                            data,
                            hora,
                            data_status,
                            hora_status,
                            data_recebimento,
                            hora_recebimento,
                            cancelada
                        )
                        VALUES (?, ?, ?, ?, ?, ?, 'PENDENTE', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
                        `,
                        [
                            vendaId,
                            entregaClienteNome,
                            entregaTelefone,
                            entregaEndereco,
                            entregaBairroCidade,
                            entregaObservacao,
                            statusPagamentoEntrega,
                            formaRecebimentoEntrega,
                            freteEntrega,
                            totalVenda,
                            valorRecebidoEntrega,
                            data,
                            hora,
                            data,
                            hora,
                            dataRecebimentoEntrega,
                            horaRecebimentoEntrega
                        ],
                        (err) => {
                            if (err) return res.status(500).json(err);
                            callback();
                        }
                    );
                }

                function finalizarResposta() {
                    salvarEntregaSeNecessario(() => {
                        return res.json({
                            sucesso: true,
                            venda_id: vendaId,
                            subtotal: subtotalVenda,
                            desconto: descontoVenda,
                            frete: freteEntrega,
                            total: totalVenda
                        });
                    });
                }

                function salvarFreteFiadoSeNecessario(callback) {
                    if (formaPagamentoFinal !== 'FIADO' || !temEntrega || freteEntrega <= 0) {
                        callback();
                        return;
                    }

                    db.run(
                        `
                        INSERT INTO fiados
                        (
                            venda_id,
                            cliente_nome,
                            tipo,
                            produto,
                            quantidade,
                            valor_unitario,
                            valor_total,
                            valor_pago,
                            quitado,
                            observacao,
                            data,
                            hora,
                            origem,
                            cancelado
                        )
                        VALUES (?, ?, 'COMPRA', 'Frete da entrega', 1, ?, ?, 0, 0, ?, ?, ?, 'VENDA_A_PRAZO', 0)
                        `,
                        [
                            vendaId,
                            clienteNomeFinal,
                            freteEntrega,
                            freteEntrega,
                            entregaObservacao || 'Frete de venda a prazo com entrega',
                            data,
                            hora
                        ],
                        (err) => {
                            if (err) return res.status(500).json(err);
                            callback();
                        }
                    );
                }

                function processarItem(indice) {
                    if (indice >= itensCalculados.length) {
                        salvarFreteFiadoSeNecessario(finalizarResposta);
                        return;
                    }

                    const item = itensCalculados[indice];

                    const quantidade = Number(item.quantidade || 0);
                    const preco = Number(item.precoVendido || 0);
                    const totalItemFinal = Number(item.totalFinal || 0);

                    db.get(
                        `
                        SELECT *
                        FROM produtos
                        WHERE id = ?
                        `,
                        [item.id],
                        (err, produto) => {
                            if (err) return res.status(500).json(err);

                            if (!produto) {
                                return res.status(404).json({
                                    erro: `Produto não encontrado: ${item.nome}`
                                });
                            }

                            const estoqueAnterior = Number(produto.estoque || 0);
                            const estoqueAtual = estoqueAnterior - quantidade;

                            if (estoqueAtual < 0) {
                                return res.status(400).json({
                                    erro: `Estoque insuficiente para ${produto.nome}.`
                                });
                            }

                const valorOriginalUnitario = converterNumeroOrcamentoApi(item.preco_original || produto.preco || preco || 0);
                            const descontoUnitario = Math.max(valorOriginalUnitario - preco, 0);
                            const descontoUnitarioTotal = arredondarMoeda(descontoUnitario * quantidade);
                            const descontoTotalItem = arredondarMoeda(descontoUnitarioTotal + Number(item.descontoRateio || 0));

                            db.run(
                                `
                                INSERT INTO itens_venda
                                (
                                    venda_id,
                                    produto_id,
                                    produto_nome,
                                    quantidade,
                                    valor_original_unitario,
                                    valor_unitario,
                                    desconto_unitario,
                                    desconto_total,
                                    valor_total
                                )
                                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                                `,
                                [
                                    vendaId,
                                    item.id,
                                    produto.nome,
                                    quantidade,
                                    valorOriginalUnitario,
                                    preco,
                                    descontoUnitario,
                                    descontoTotalItem,
                                    totalItemFinal
                                ],
                                (err) => {
                                    if (err) return res.status(500).json(err);

                                    db.run(
                                        `
                                        UPDATE produtos
                                        SET estoque = ?
                                        WHERE id = ?
                                        `,
                                        [
                                            estoqueAtual,
                                            item.id
                                        ],
                                        (err) => {
                                            if (err) return res.status(500).json(err);

                                            let observacaoMovimentacao = `Venda ${formaPagamentoFinal}`;

                                            if (formaPagamentoFinal === 'FIADO') {
                                                observacaoMovimentacao = `Venda a prazo para ${clienteNomeFinal}`;
                                            }

                                            if (formaPagamentoFinal === 'ABATIMENTO_DIVIDA') {
                                                observacaoMovimentacao = `Venda por abatimento de dívida para ${clienteNomeFinal}`;
                                            }

                                            if (formaPagamentoFinal === 'A_RECEBER_ENTREGA') {
                                                observacaoMovimentacao = `Venda para receber na entrega de ${entregaClienteNome}`;
                                            }

                                            if (descontoVenda > 0 || descontoTotalItem > 0) {
                                                observacaoMovimentacao += ` com desconto`;
                                            }

                                            db.run(
                                                `
                                                INSERT INTO movimentacoes_estoque
                                                (
                                                    venda_id,
                                                    produto_id,
                                                    produto_nome,
                                                    tipo,
                                                    quantidade,
                                                    estoque_anterior,
                                                    estoque_atual,
                                                    observacao,
                                                    data,
                                                    hora,
                                                    cancelada
                                                )
                                                VALUES (?, ?, ?, 'VENDA', ?, ?, ?, ?, ?, ?, 0)
                                                `,
                                                [
                                                    vendaId,
                                                    item.id,
                                                    produto.nome,
                                                    quantidade,
                                                    estoqueAnterior,
                                                    estoqueAtual,
                                                    observacaoMovimentacao,
                                                    data,
                                                    hora
                                                ],
                                                (err) => {
                                                    if (err) return res.status(500).json(err);

                                                    if (formaPagamentoFinal === 'FIADO') {
                                                        const valorUnitarioFiado = quantidade > 0
                                                            ? arredondarMoeda(totalItemFinal / quantidade)
                                                            : preco;

                                                        db.run(
                                                            `
                                                            INSERT INTO fiados
                                                            (
                                                                venda_id,
                                                                cliente_nome,
                                                                tipo,
                                                                produto,
                                                                quantidade,
                                                                valor_unitario,
                                                                valor_total,
                                                                valor_pago,
                                                                quitado,
                                                                observacao,
                                                                data,
                                                                hora,
                                                                origem,
                                                                cancelado
                                                            )
                                                            VALUES (?, ?, 'COMPRA', ?, ?, ?, ?, 0, 0, ?, ?, ?, 'VENDA_A_PRAZO', 0)
                                                            `,
                                                            [
                                                                vendaId,
                                                                clienteNomeFinal,
                                                                produto.nome,
                                                                quantidade,
                                                                valorUnitarioFiado,
                                                                totalItemFinal,
                                                                observacao || entregaObservacao || 'Venda a prazo pelo caixa',
                                                                data,
                                                                hora
                                                            ],
                                                            (err) => {
                                                                if (err) return res.status(500).json(err);
                                                                processarItem(indice + 1);
                                                            }
                                                        );
                                                    } else {
                                                        processarItem(indice + 1);
                                                    }
                                                }
                                            );
                                        }
                                    );
                                }
                            );
                        }
                    );
                }

                processarItem(0);
            }
        );
    });
}

app.get('/vendas/:id/comprovante', async (req, res) => {
    try {
        const vendaId = req.params.id;

        const venda = await dbGet(
            `
            SELECT *
            FROM vendas
            WHERE id = ?
            `,
            [vendaId]
        );

        if (!venda) {
            return res.status(404).json({ erro: 'Venda não encontrada.' });
        }

        const itens = await dbAll(
            `
            SELECT *
            FROM itens_venda
            WHERE venda_id = ?
            ORDER BY id ASC
            `,
            [vendaId]
        );

        const entrega = await dbGet(
            `
            SELECT *
            FROM entregas
            WHERE venda_id = ?
            ORDER BY id DESC
            LIMIT 1
            `,
            [vendaId]
        );

        res.json({
            venda,
            itens,
            entrega: entrega || null
        });

    } catch (erro) {
        tratarErro(res, erro);
    }
});

app.put('/vendas/:id/cancelar', async (req, res) => {
    try {
        const vendaId = req.params.id;
        const motivo = req.body.motivo || 'Venda cancelada pelo usuário';

        const resultado = await cancelarVendaPorId(vendaId, motivo);

        res.json(resultado);

    } catch (erro) {
        tratarErro(res, erro);
    }
});

// FIADOS / A PRAZO

app.get('/fiados', (req, res) => {
    db.all(
        `
        SELECT
            f.*,
            CASE
                WHEN f.tipo = 'COMPRA'
                THEN MAX(COALESCE(f.valor_pago, 0), COALESCE(pi.total_abatido, 0))
                ELSE COALESCE(f.valor_pago, 0)
            END AS valor_pago_efetivo,
            CASE
                WHEN f.tipo = 'COMPRA'
                AND (
                    COALESCE(f.valor_total, 0) -
                    MAX(COALESCE(f.valor_pago, 0), COALESCE(pi.total_abatido, 0))
                ) > 0
                THEN (
                    COALESCE(f.valor_total, 0) -
                    MAX(COALESCE(f.valor_pago, 0), COALESCE(pi.total_abatido, 0))
                )

                WHEN f.tipo = 'COMPRA' THEN 0

                ELSE 0
            END AS saldo_aberto
        FROM fiados f
        LEFT JOIN (
            SELECT
                fiado_id,
                COALESCE(SUM(valor_abatido), 0) AS total_abatido
            FROM pagamentos_fiados_itens
            WHERE COALESCE(cancelado, 0) = 0
            GROUP BY fiado_id
        ) pi ON pi.fiado_id = f.id
        WHERE COALESCE(f.cancelado, 0) = 0
        ORDER BY f.cliente_nome ASC, f.data ASC, f.hora ASC, f.id ASC
        `,
        [],
        (err, rows) => {
            if (err) return res.status(500).json(err);
            res.json(rows);
        }
    );
});

app.get('/fiados/resumo', (req, res) => {
    db.all(
        `
        SELECT
            f.cliente_nome,
            SUM(
                CASE
                    WHEN f.tipo = 'COMPRA' THEN
                        CASE
                            WHEN (
                                COALESCE(f.valor_total, 0) -
                                MAX(COALESCE(f.valor_pago, 0), COALESCE(pi.total_abatido, 0))
                            ) > 0
                            THEN (
                                COALESCE(f.valor_total, 0) -
                                MAX(COALESCE(f.valor_pago, 0), COALESCE(pi.total_abatido, 0))
                            )
                            ELSE 0
                        END

                    WHEN f.tipo = 'PAGAMENTO'
                    AND COALESCE(f.origem, '') NOT IN ('PAGAMENTO_ITENS', 'PAGAMENTO_VALOR')
                    THEN -COALESCE(f.valor_total, 0)

                    ELSE 0
                END
            ) AS saldo
        FROM fiados f
        LEFT JOIN (
            SELECT
                fiado_id,
                COALESCE(SUM(valor_abatido), 0) AS total_abatido
            FROM pagamentos_fiados_itens
            WHERE COALESCE(cancelado, 0) = 0
            GROUP BY fiado_id
        ) pi ON pi.fiado_id = f.id
        WHERE COALESCE(f.cancelado, 0) = 0
        GROUP BY f.cliente_nome
        HAVING saldo > 0
        ORDER BY f.cliente_nome ASC
        `,
        [],
        (err, rows) => {
            if (err) return res.status(500).json(err);
            res.json(rows);
        }
    );
});

app.get('/fiados/:cliente', (req, res) => {
    const cliente = req.params.cliente;

    db.all(
        `
        SELECT
            f.*,
            CASE
                WHEN f.tipo = 'COMPRA'
                THEN MAX(COALESCE(f.valor_pago, 0), COALESCE(pi.total_abatido, 0))
                ELSE COALESCE(f.valor_pago, 0)
            END AS valor_pago_efetivo,
            CASE
                WHEN f.tipo = 'COMPRA'
                AND (
                    COALESCE(f.valor_total, 0) -
                    MAX(COALESCE(f.valor_pago, 0), COALESCE(pi.total_abatido, 0))
                ) > 0
                THEN (
                    COALESCE(f.valor_total, 0) -
                    MAX(COALESCE(f.valor_pago, 0), COALESCE(pi.total_abatido, 0))
                )

                WHEN f.tipo = 'COMPRA' THEN 0

                ELSE 0
            END AS saldo_aberto
        FROM fiados f
        LEFT JOIN (
            SELECT
                fiado_id,
                COALESCE(SUM(valor_abatido), 0) AS total_abatido
            FROM pagamentos_fiados_itens
            WHERE COALESCE(cancelado, 0) = 0
            GROUP BY fiado_id
        ) pi ON pi.fiado_id = f.id
        WHERE f.cliente_nome = ?
        AND COALESCE(f.cancelado, 0) = 0
        ORDER BY f.data ASC, f.hora ASC, f.id ASC
        `,
        [cliente],
        (err, rows) => {
            if (err) return res.status(500).json(err);
            res.json(rows);
        }
    );
});

app.post('/fiados/compra', (req, res) => {
    const {
        cliente_nome,
        produto,
        quantidade,
        valor_unitario,
        observacao
    } = req.body;

    const qtd = Number(quantidade || 0);
    const valor = Number(valor_unitario || 0);
    const total = arredondarMoeda(qtd * valor);
    const data = dataHojeLocal();
    const hora = horaAgoraLocal();

    db.run(
        `
        INSERT INTO fiados
        (
            cliente_nome,
            tipo,
            produto,
            quantidade,
            valor_unitario,
            valor_total,
            valor_pago,
            quitado,
            observacao,
            data,
            hora,
            origem,
            cancelado
        )
        VALUES (?, 'COMPRA', ?, ?, ?, ?, 0, 0, ?, ?, ?, 'LANCAMENTO_MANUAL', 0)
        `,
        [
            cliente_nome,
            produto,
            qtd,
            valor,
            total,
            observacao,
            data,
            hora
        ],
        function(err) {
            if (err) return res.status(500).json(err);
            res.json({ sucesso: true, id: this.lastID, total });
        }
    );
});

app.post('/fiados/importar-a-prazo', async (req, res) => {
    try {
        const {
            cliente_nome,
            telefone,
            cidade,
            data,
            hora,
            observacao,
            itens
        } = req.body;

        const clienteNome = String(cliente_nome || '').trim();
        const dataOriginal = String(data || '').trim();
        const horaOriginal = String(hora || '00:00:00').trim() || '00:00:00';
        const observacaoGeral = String(observacao || '').trim();

        if (!clienteNome) {
            return res.status(400).json({ erro: 'Informe o nome do cliente.' });
        }

        if (!dataOriginal) {
            return res.status(400).json({ erro: 'Informe a data original da conta a prazo.' });
        }

        if (!itens || !Array.isArray(itens) || itens.length === 0) {
            return res.status(400).json({ erro: 'Informe pelo menos um item para importar.' });
        }

        const itensValidos = itens.map((item, index) => {
            const produto = String(item.produto || item.descricao || '').trim();
            const quantidade = Number(item.quantidade || 0);
            const unidadeMedida = normalizarUnidadeMedida(item.unidade_medida);
            const valorUnitario = Number(item.valor_unitario || 0);
            const valorTotalInformado = Number(item.valor_total || 0);

            const valorTotal = valorTotalInformado > 0
                ? arredondarMoeda(valorTotalInformado)
                : arredondarMoeda(quantidade * valorUnitario);

            if (!produto) {
                throw criarErro(400, `Informe a descrição do item ${index + 1}.`);
            }

            if (valorTotal <= 0) {
                throw criarErro(400, `Informe o valor do item ${index + 1}.`);
            }

            return {
                produto,
                quantidade: quantidade > 0 ? quantidade : 1,
                unidade_medida: unidadeMedida,
                valor_unitario: valorUnitario > 0 ? valorUnitario : valorTotal,
                valor_total: valorTotal,
                observacao: String(item.observacao || '').trim()
            };
        });

        const grupoImportacao = `IMPORTACAO-${Date.now()}`;

        await dbRun('BEGIN TRANSACTION');

        try {
            await salvarOuAtualizarCliente({
                nome: clienteNome,
                telefone: telefone || '',
                cidade: cidade || '',
                observacao: observacaoGeral || 'Cliente importado do papel'
            });

            for (const item of itensValidos) {
                await dbRun(
                    `
                    INSERT INTO fiados
                    (
                        cliente_nome,
                        tipo,
                        produto,
                        quantidade,
                        unidade_medida,
                        valor_unitario,
                        valor_total,
                        valor_pago,
                        quitado,
                        observacao,
                        data,
                        hora,
                        origem,
                        grupo_importacao,
                        cancelado
                    )
                    VALUES (?, 'COMPRA', ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, 'IMPORTACAO_PAPEL', ?, 0)
                    `,
                    [
                        clienteNome,
                        item.produto,
                        item.quantidade,
                        item.unidade_medida,
                        item.valor_unitario,
                        item.valor_total,
                        item.observacao || observacaoGeral || 'Importado do papel da loja',
                        dataOriginal,
                        horaOriginal,
                        grupoImportacao
                    ]
                );
            }

            await dbRun('COMMIT');

            res.json({
                sucesso: true,
                grupo_importacao: grupoImportacao,
                itens_importados: itensValidos.length,
                total: itensValidos.reduce((soma, item) => soma + Number(item.valor_total || 0), 0)
            });

        } catch (erroTransacao) {
            await dbRun('ROLLBACK');
            throw erroTransacao;
        }

    } catch (erro) {
        tratarErro(res, erro);
    }
});

app.post('/fiados/pagamento', (req, res) => {
    const { cliente_nome, valor, observacao } = req.body;

    const valorPago = Number(valor || 0);
    const formaPagamento = String(req.body.forma_pagamento || 'DINHEIRO').trim().toUpperCase();
    let valorRecebido = arredondarMoeda(Number(req.body.valor_recebido || 0));
    let troco = 0;
    const data = dataHojeLocal();
    const hora = horaAgoraLocal();

    if (formaPagamento === 'DINHEIRO') {
        if (valorRecebido <= 0) {
            return res.status(400).json({ erro: 'Informe o valor recebido do cliente.' });
        }

        if (valorRecebido < valorPago) {
            return res.status(400).json({ erro: 'O valor recebido n\u00e3o pode ser menor que o valor do pagamento.' });
        }

        troco = arredondarMoeda(valorRecebido - valorPago);
    } else {
        valorRecebido = valorPago;
        troco = 0;
    }

    db.run(
        `
        INSERT INTO fiados
        (
            cliente_nome,
            tipo,
            produto,
            quantidade,
            valor_unitario,
            valor_total,
            valor_pago,
            quitado,
            observacao,
            data,
            hora,
            origem,
            forma_pagamento,
            valor_recebido,
            troco,
            cancelado
        )
        VALUES (?, 'PAGAMENTO', 'Pagamento recebido', 0, 0, ?, ?, 1, ?, ?, ?, 'PAGAMENTO', ?, ?, ?, 0)
        `,
        [
            cliente_nome,
            valorPago,
            valorPago,
            observacao,
            data,
            hora,
            formaPagamento,
            valorRecebido,
            troco
        ],
        function(err) {
            if (err) return res.status(500).json(err);
            res.json({ sucesso: true, id: this.lastID, valor: valorPago, valor_recebido: valorRecebido, troco });
        }
    );
});

app.post('/fiados/pagamento-itens', async (req, res) => {
    try {
        const clienteNome = String(req.body.cliente_nome || '').trim();
        const formaPagamento = String(req.body.forma_pagamento || 'DINHEIRO').trim().toUpperCase();
        const observacao = String(req.body.observacao || '').trim();
        const itensSelecionados = Array.isArray(req.body.itens) ? req.body.itens : [];

        const valorPagoInformado = arredondarMoeda(Number(req.body.valor_pago || req.body.valor || 0));
        const valorRecebidoInformado = arredondarMoeda(Number(req.body.valor_recebido || 0));

        const formasValidas = [
            'DINHEIRO',
            'PIX',
            'CARTAO',
            'CARTAO_CREDITO',
            'CARTAO_DEBITO'
        ];

        if (!clienteNome) {
            return res.status(400).json({ erro: 'Informe o cliente.' });
        }

        if (!formasValidas.includes(formaPagamento)) {
            return res.status(400).json({ erro: 'Forma de pagamento inválida.' });
        }

        if (!itensSelecionados.length) {
            return res.status(400).json({ erro: 'Selecione pelo menos um produto para receber o pagamento.' });
        }

        const idsSelecionados = itensSelecionados
            .map(item => Number(item.fiado_id || item.id || 0))
            .filter(id => id > 0);

        if (!idsSelecionados.length) {
            return res.status(400).json({ erro: 'Nenhum item válido foi selecionado.' });
        }

        const marcadores = idsSelecionados.map(() => '?').join(',');

        const compras = await dbAll(
            `
            SELECT
                f.*,
                MAX(COALESCE(f.valor_pago, 0), COALESCE(pi.total_abatido, 0)) AS valor_pago_efetivo,
                CASE
                    WHEN (
                        COALESCE(f.valor_total, 0) -
                        MAX(COALESCE(f.valor_pago, 0), COALESCE(pi.total_abatido, 0))
                    ) > 0
                    THEN (
                        COALESCE(f.valor_total, 0) -
                        MAX(COALESCE(f.valor_pago, 0), COALESCE(pi.total_abatido, 0))
                    )
                    ELSE 0
                END AS saldo_aberto
            FROM fiados f
            LEFT JOIN (
                SELECT
                    fiado_id,
                    COALESCE(SUM(valor_abatido), 0) AS total_abatido
                FROM pagamentos_fiados_itens
                WHERE COALESCE(cancelado, 0) = 0
                GROUP BY fiado_id
            ) pi ON pi.fiado_id = f.id
            WHERE f.id IN (${marcadores})
            AND f.cliente_nome = ?
            AND f.tipo = 'COMPRA'
            AND COALESCE(f.cancelado, 0) = 0
            ORDER BY f.data ASC, f.hora ASC, f.id ASC
            `,
            [
                ...idsSelecionados,
                clienteNome
            ]
        );

        if (!compras.length) {
            return res.status(404).json({ erro: 'Nenhum produto em aberto foi encontrado para este cliente.' });
        }

        const totalSelecionado = arredondarMoeda(
            compras.reduce((soma, item) => soma + Number(item.saldo_aberto || 0), 0)
        );

        if (totalSelecionado <= 0) {
            return res.status(400).json({ erro: 'Os produtos selecionados já estão quitados.' });
        }

        const valorPagamento = valorPagoInformado > 0
            ? arredondarMoeda(Math.min(valorPagoInformado, totalSelecionado))
            : totalSelecionado;

        if (valorPagamento <= 0) {
            return res.status(400).json({ erro: 'Informe um valor válido para pagamento.' });
        }

        let valorRecebido = valorRecebidoInformado;

        if (formaPagamento !== 'DINHEIRO') {
            valorRecebido = valorPagamento;
        }

        if (formaPagamento === 'DINHEIRO' && valorRecebido <= 0) {
            return res.status(400).json({ erro: 'Informe o valor recebido do cliente.' });
        }

        if (valorRecebido < valorPagamento) {
            return res.status(400).json({ erro: 'O valor recebido n\u00e3o pode ser menor que o valor do pagamento.' });
        }

        const troco = formaPagamento === 'DINHEIRO'
            ? arredondarMoeda(valorRecebido - valorPagamento)
            : 0;

        const data = dataHojeLocal();
        const hora = horaAgoraLocal();

        const mapaValoresPorItem = {};

        itensSelecionados.forEach(item => {
            const id = Number(item.fiado_id || item.id || 0);
            const valorAbatido = arredondarMoeda(Number(item.valor_abatido || item.valor || 0));

            if (id > 0 && valorAbatido > 0) {
                mapaValoresPorItem[id] = valorAbatido;
            }
        });

        await dbRun('BEGIN TRANSACTION');

        try {
            const resultadoPagamento = await dbRun(
                `
                INSERT INTO pagamentos_fiados
                (
                    cliente_nome,
                    valor_pago,
                    forma_pagamento,
                    valor_recebido,
                    troco,
                    observacao,
                    data,
                    hora,
                    cancelado
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
                `,
                [
                    clienteNome,
                    valorPagamento,
                    formaPagamento,
                    valorRecebido,
                    troco,
                    observacao || 'Pagamento por produtos selecionados',
                    data,
                    hora
                ]
            );

            const pagamentoId = resultadoPagamento.lastID;

            let restantePagamento = valorPagamento;
            const itensPagos = [];

            for (const compra of compras) {
                if (restantePagamento <= 0) break;

                const saldoAntes = arredondarMoeda(Number(compra.saldo_aberto || 0));

                if (saldoAntes <= 0) continue;

                const valorEscolhidoParaItem = mapaValoresPorItem[compra.id] || 0;

                const valorAbatido = valorEscolhidoParaItem > 0
                    ? arredondarMoeda(Math.min(valorEscolhidoParaItem, saldoAntes, restantePagamento))
                    : arredondarMoeda(Math.min(saldoAntes, restantePagamento));

                if (valorAbatido <= 0) continue;

                const valorPagoAnterior = arredondarMoeda(Number(
                    compra.valor_pago_efetivo !== undefined
                        ? compra.valor_pago_efetivo
                        : compra.valor_pago || 0
                ));
                const novoValorPago = arredondarMoeda(valorPagoAnterior + valorAbatido);
                const saldoDepois = arredondarMoeda(Number(compra.valor_total || 0) - novoValorPago);
                const quitado = saldoDepois <= 0 ? 1 : 0;

                await dbRun(
                    `
                    UPDATE fiados
                    SET
                        valor_pago = ?,
                        quitado = ?
                    WHERE id = ?
                    `,
                    [
                        novoValorPago,
                        quitado,
                        compra.id
                    ]
                );

                await dbRun(
                    `
                    INSERT INTO pagamentos_fiados_itens
                    (
                        pagamento_id,
                        fiado_id,
                        cliente_nome,
                        produto,
                        quantidade,
                        valor_original_item,
                        saldo_antes,
                        valor_abatido,
                        saldo_depois,
                        data,
                        hora,
                        cancelado
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
                    `,
                    [
                        pagamentoId,
                        compra.id,
                        clienteNome,
                        compra.produto || '',
                        Number(compra.quantidade || 0),
                        Number(compra.valor_total || 0),
                        saldoAntes,
                        valorAbatido,
                        saldoDepois > 0 ? saldoDepois : 0,
                        data,
                        hora
                    ]
                );

                const statusPagamentoItem = quitado ? 'Quitado' : 'Parcial';

                itensPagos.push({
                    fiado_id: compra.id,
                    produto: compra.produto || '',
                    quantidade: Number(compra.quantidade || 0),
                    unidade_medida: normalizarUnidadeMedida(compra.unidade_medida),
                    valor_original: Number(compra.valor_total || 0),
                    valor_original_item: Number(compra.valor_total || 0),
                    valor_pago_antes: valorPagoAnterior,
                    valor_pago_depois: novoValorPago,
                    saldo_antes: saldoAntes,
                    valor_abatido: valorAbatido,
                    saldo_depois: saldoDepois > 0 ? saldoDepois : 0,
                    quitado,
                    status: statusPagamentoItem
                });

                restantePagamento = arredondarMoeda(restantePagamento - valorAbatido);
            }

            const totalAbatido = arredondarMoeda(
                itensPagos.reduce((soma, item) => soma + Number(item.valor_abatido || 0), 0)
            );

            if (totalAbatido <= 0) {
                throw criarErro(400, 'Nenhum valor foi abatido dos produtos selecionados.');
            }

            const observacaoFinal = observacao || `Pagamento de produtos selecionados. Pagamento #${pagamentoId}`;

            const pagamentoFiado = await dbRun(
                `
                INSERT INTO fiados
                (
                    cliente_nome,
                    tipo,
                    produto,
                    quantidade,
                    valor_unitario,
                    valor_total,
                    valor_pago,
                    quitado,
                    observacao,
                    data,
                    hora,
                    origem,
                    forma_pagamento,
                    valor_recebido,
                    troco,
                    cancelado
                )
                VALUES (?, 'PAGAMENTO', 'Pagamento por produtos selecionados', 0, 0, ?, ?, 1, ?, ?, ?, 'PAGAMENTO_ITENS', ?, ?, ?, 0)
                `,
                [
                    clienteNome,
                    totalAbatido,
                    totalAbatido,
                    observacaoFinal,
                    data,
                    hora,
                    formaPagamento,
                    valorRecebido,
                    troco
                ]
            );

            await dbRun('COMMIT');

            res.json({
                sucesso: true,
                pagamento_id: pagamentoId,
                fiado_pagamento_id: pagamentoFiado.lastID,
                cliente_nome: clienteNome,
                total_selecionado: totalSelecionado,
                valor_pago: totalAbatido,
                forma_pagamento: formaPagamento,
                valor_recebido: valorRecebido,
                troco,
                abatimentos: itensPagos,
                itens: itensPagos
            });

        } catch (erroTransacao) {
            await dbRun('ROLLBACK');
            throw erroTransacao;
        }

    } catch (erro) {
        tratarErro(res, erro);
    }
});

app.post('/fiados/pagamento-valor', async (req, res) => {
    try {
        const clienteNome = String(req.body.cliente_nome || '').trim();
        const formaPagamento = String(req.body.forma_pagamento || 'DINHEIRO').trim().toUpperCase();
        const observacao = String(req.body.observacao || '').trim();

        const valorPagamentoInformado = arredondarMoeda(Number(
            req.body.valor_pagamento ||
            req.body.valor_pago ||
            req.body.valor ||
            0
        ));
        const valorRecebidoInformado = arredondarMoeda(Number(req.body.valor_recebido || 0));

        const formasValidas = [
            'DINHEIRO',
            'PIX',
            'CARTAO',
            'CARTAO_CREDITO',
            'CARTAO_DEBITO'
        ];

        if (!clienteNome) {
            return res.status(400).json({ erro: 'Informe o cliente.' });
        }

        if (!formasValidas.includes(formaPagamento)) {
            return res.status(400).json({ erro: 'Forma de pagamento invÃ¡lida.' });
        }

        if (valorPagamentoInformado <= 0) {
            return res.status(400).json({ erro: 'Informe um valor vÃ¡lido para pagamento.' });
        }

        let compras = await dbAll(
            `
            SELECT
                f.*,
                MAX(COALESCE(f.valor_pago, 0), COALESCE(pi.total_abatido, 0)) AS valor_pago_efetivo,
                CASE
                    WHEN (
                        COALESCE(f.valor_total, 0) -
                        MAX(COALESCE(f.valor_pago, 0), COALESCE(pi.total_abatido, 0))
                    ) > 0
                    THEN (
                        COALESCE(f.valor_total, 0) -
                        MAX(COALESCE(f.valor_pago, 0), COALESCE(pi.total_abatido, 0))
                    )
                    ELSE 0
                END AS saldo_aberto
            FROM fiados f
            LEFT JOIN (
                SELECT
                    fiado_id,
                    COALESCE(SUM(valor_abatido), 0) AS total_abatido
                FROM pagamentos_fiados_itens
                WHERE COALESCE(cancelado, 0) = 0
                GROUP BY fiado_id
            ) pi ON pi.fiado_id = f.id
            WHERE f.cliente_nome = ?
            AND f.tipo = 'COMPRA'
            AND COALESCE(f.cancelado, 0) = 0
            AND (
                COALESCE(f.valor_total, 0) -
                MAX(COALESCE(f.valor_pago, 0), COALESCE(pi.total_abatido, 0))
            ) > 0
            ORDER BY f.data ASC, f.hora ASC, f.id ASC
            `,
            [clienteNome]
        );

        const totalPagamentosGerais = await obterTotalPagamentosGeraisFiado(clienteNome);
        compras = aplicarPagamentosGeraisFiado(compras, totalPagamentosGerais)
            .filter(compra => Number(compra.saldo_aberto || 0) > 0);

        if (!compras.length) {
            return res.status(404).json({ erro: 'Este cliente nÃ£o possui saldo em aberto.' });
        }

        const saldoTotal = arredondarMoeda(
            compras.reduce((soma, item) => soma + Number(item.saldo_aberto || 0), 0)
        );

        if (valorPagamentoInformado > saldoTotal) {
            return res.status(400).json({ erro: 'Valor informado Ã© maior que o saldo em aberto do cliente.' });
        }

        let valorRecebido = valorRecebidoInformado;

        if (formaPagamento !== 'DINHEIRO') {
            valorRecebido = valorPagamentoInformado;
        }

        if (formaPagamento === 'DINHEIRO' && valorRecebido <= 0) {
            return res.status(400).json({ erro: 'Informe o valor recebido do cliente.' });
        }

        if (valorRecebido < valorPagamentoInformado) {
            return res.status(400).json({ erro: 'O valor recebido n\u00e3o pode ser menor que o valor do pagamento.' });
        }

        const troco = formaPagamento === 'DINHEIRO'
            ? arredondarMoeda(valorRecebido - valorPagamentoInformado)
            : 0;

        const data = dataHojeLocal();
        const hora = horaAgoraLocal();

        await dbRun('BEGIN TRANSACTION');

        try {
            const resultadoPagamento = await dbRun(
                `
                INSERT INTO pagamentos_fiados
                (
                    cliente_nome,
                    valor_pago,
                    forma_pagamento,
                    valor_recebido,
                    troco,
                    observacao,
                    data,
                    hora,
                    cancelado
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)
                `,
                [
                    clienteNome,
                    valorPagamentoInformado,
                    formaPagamento,
                    valorRecebido,
                    troco,
                    observacao || 'Recebimento avulso A Prazo',
                    data,
                    hora
                ]
            );

            const pagamentoId = resultadoPagamento.lastID;
            let restantePagamento = valorPagamentoInformado;
            const itensPagos = [];

            for (const compra of compras) {
                if (restantePagamento <= 0) break;

                const saldoAntes = arredondarMoeda(Number(compra.saldo_aberto || 0));

                if (saldoAntes <= 0) continue;

                const valorAbatido = arredondarMoeda(Math.min(saldoAntes, restantePagamento));

                if (valorAbatido <= 0) continue;

                const valorPagoAnterior = arredondarMoeda(Number(
                    compra.valor_pago_base !== undefined
                        ? compra.valor_pago_base
                        : compra.valor_pago_efetivo !== undefined
                            ? compra.valor_pago_efetivo
                            : compra.valor_pago || 0
                ));
                const valorPagoAnteriorComGerais = arredondarMoeda(Number(
                    compra.valor_pago_com_pagamentos_gerais !== undefined
                        ? compra.valor_pago_com_pagamentos_gerais
                        : valorPagoAnterior
                ));
                const novoValorPago = arredondarMoeda(valorPagoAnterior + valorAbatido);
                const valorPagoDepoisComGerais = arredondarMoeda(valorPagoAnteriorComGerais + valorAbatido);
                const saldoDepois = arredondarMoeda(saldoAntes - valorAbatido);
                const quitado = saldoDepois <= 0 ? 1 : 0;

                await dbRun(
                    `
                    UPDATE fiados
                    SET
                        valor_pago = ?,
                        quitado = ?
                    WHERE id = ?
                    `,
                    [
                        novoValorPago,
                        quitado,
                        compra.id
                    ]
                );

                await dbRun(
                    `
                    INSERT INTO pagamentos_fiados_itens
                    (
                        pagamento_id,
                        fiado_id,
                        cliente_nome,
                        produto,
                        quantidade,
                        valor_original_item,
                        saldo_antes,
                        valor_abatido,
                        saldo_depois,
                        data,
                        hora,
                        cancelado
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
                    `,
                    [
                        pagamentoId,
                        compra.id,
                        clienteNome,
                        compra.produto || '',
                        Number(compra.quantidade || 0),
                        Number(compra.valor_total || 0),
                        saldoAntes,
                        valorAbatido,
                        saldoDepois > 0 ? saldoDepois : 0,
                        data,
                        hora
                    ]
                );

                const statusPagamentoItem = quitado ? 'Quitado' : 'Parcial';

                itensPagos.push({
                    fiado_id: compra.id,
                    produto: compra.produto || '',
                    quantidade: Number(compra.quantidade || 0),
                    unidade_medida: normalizarUnidadeMedida(compra.unidade_medida),
                    valor_original: Number(compra.valor_total || 0),
                    valor_original_item: Number(compra.valor_total || 0),
                    valor_pago_antes: valorPagoAnterior,
                    valor_pago_depois: novoValorPago,
                    saldo_antes: saldoAntes,
                    valor_abatido: valorAbatido,
                    saldo_depois: saldoDepois > 0 ? saldoDepois : 0,
                    quitado,
                    status: statusPagamentoItem
                });

                restantePagamento = arredondarMoeda(restantePagamento - valorAbatido);
            }

            const totalAbatido = arredondarMoeda(
                itensPagos.reduce((soma, item) => soma + Number(item.valor_abatido || 0), 0)
            );

            if (totalAbatido <= 0) {
                throw criarErro(400, 'Nenhum valor foi abatido da ficha do cliente.');
            }

            const observacaoFinal = observacao || `Recebimento avulso A Prazo. Pagamento #${pagamentoId}`;

            const pagamentoFiado = await dbRun(
                `
                INSERT INTO fiados
                (
                    cliente_nome,
                    tipo,
                    produto,
                    quantidade,
                    valor_unitario,
                    valor_total,
                    valor_pago,
                    quitado,
                    observacao,
                    data,
                    hora,
                    origem,
                    forma_pagamento,
                    valor_recebido,
                    troco,
                    cancelado
                )
                VALUES (?, 'PAGAMENTO', 'Pagamento por valor na ficha', 0, 0, ?, ?, 1, ?, ?, ?, 'PAGAMENTO_VALOR', ?, ?, ?, 0)
                `,
                [
                    clienteNome,
                    totalAbatido,
                    totalAbatido,
                    observacaoFinal,
                    data,
                    hora,
                    formaPagamento,
                    valorRecebido,
                    troco
                ]
            );

            await dbRun('COMMIT');

            res.json({
                sucesso: true,
                modo: 'valor_livre',
                pagamento_id: pagamentoId,
                fiado_pagamento_id: pagamentoFiado.lastID,
                cliente_nome: clienteNome,
                saldo_anterior: saldoTotal,
                saldo_atual: arredondarMoeda(saldoTotal - totalAbatido),
                valor_pagamento: totalAbatido,
                valor_pago: totalAbatido,
                forma_pagamento: formaPagamento,
                valor_recebido: valorRecebido,
                troco,
                abatimentos: itensPagos,
                itens: itensPagos
            });

        } catch (erroTransacao) {
            await dbRun('ROLLBACK');
            throw erroTransacao;
        }

    } catch (erro) {
        tratarErro(res, erro);
    }
});

// ENTREGAS

app.get('/entregas', (req, res) => {
    let sql = `
        SELECT *
        FROM entregas
        WHERE 1=1
    `;

    const parametros = [];

    if (req.query.ocultarCanceladas === '1') {
        sql += ` AND COALESCE(cancelada, 0) = 0`;
    }

    if (req.query.status_entrega) {
        sql += ` AND status_entrega = ?`;
        parametros.push(req.query.status_entrega);
    }

    if (req.query.status_pagamento) {
        sql += ` AND status_pagamento = ?`;
        parametros.push(req.query.status_pagamento);
    }

    if (req.query.dataInicial) {
        sql += ` AND data >= ?`;
        parametros.push(req.query.dataInicial);
    }

    if (req.query.dataFinal) {
        sql += ` AND data <= ?`;
        parametros.push(req.query.dataFinal);
    }

    if (req.query.busca) {
        sql += `
            AND (
                cliente_nome LIKE ?
                OR telefone LIKE ?
                OR endereco LIKE ?
                OR bairro_cidade LIKE ?
            )
        `;
        const busca = `%${req.query.busca}%`;
        parametros.push(busca, busca, busca, busca);
    }

    sql += `
        ORDER BY
            CASE status_entrega
                WHEN 'PENDENTE' THEN 1
                WHEN 'SAIU_ENTREGA' THEN 2
                WHEN 'ENTREGUE' THEN 3
                WHEN 'CANCELADA' THEN 4
                ELSE 5
            END,
            data DESC,
            hora DESC,
            id DESC
    `;

    db.all(sql, parametros, (err, rows) => {
        if (err) return res.status(500).json(err);
        res.json(rows);
    });
});

app.get('/entregas/resumo', (req, res) => {
    const dados = {
        pendentes: 0,
        saiuEntrega: 0,
        entregues: 0,
        canceladas: 0,
        aReceber: 0,
        valorAReceber: 0
    };

    db.get(
        `
        SELECT
            SUM(CASE WHEN status_entrega = 'PENDENTE' AND COALESCE(cancelada, 0) = 0 THEN 1 ELSE 0 END) AS pendentes,
            SUM(CASE WHEN status_entrega = 'SAIU_ENTREGA' AND COALESCE(cancelada, 0) = 0 THEN 1 ELSE 0 END) AS saiu_entrega,
            SUM(CASE WHEN status_entrega = 'ENTREGUE' AND COALESCE(cancelada, 0) = 0 THEN 1 ELSE 0 END) AS entregues,
            SUM(CASE WHEN status_entrega = 'CANCELADA' OR COALESCE(cancelada, 0) = 1 THEN 1 ELSE 0 END) AS canceladas
        FROM entregas
        `,
        [],
        (err, resumoEntrega) => {
            if (err) return res.status(500).json(err);

            dados.pendentes = Number(resumoEntrega.pendentes || 0);
            dados.saiuEntrega = Number(resumoEntrega.saiu_entrega || 0);
            dados.entregues = Number(resumoEntrega.entregues || 0);
            dados.canceladas = Number(resumoEntrega.canceladas || 0);

            db.get(
                `
                SELECT
                    COUNT(*) AS quantidade,
                    COALESCE(SUM(valor_total), 0) AS valor_total
                FROM entregas
                WHERE status_entrega = 'ENTREGUE'
                AND status_pagamento = 'A_RECEBER_NA_ENTREGA'
                AND COALESCE(transferida_a_prazo, 0) = 0
                AND COALESCE(cancelada, 0) = 0
                `,
                [],
                (err, resumoPagamento) => {
                    if (err) return res.status(500).json(err);

                    dados.aReceber = Number(resumoPagamento.quantidade || 0);
                    dados.valorAReceber = Number(resumoPagamento.valor_total || 0);

                    res.json(dados);
                }
            );
        }
    );
});

app.get('/entregas/:id', async (req, res) => {
    try {
        const entregaId = Number(req.params.id || 0);

        if (!entregaId) {
            throw criarErro(400, 'Entrega inválida.');
        }

        const entrega = await dbGet(
            `
            SELECT
                e.*,
                v.data AS venda_data,
                v.hora AS venda_hora,
                v.forma_pagamento AS venda_forma_pagamento,
                v.cliente_nome AS venda_cliente_nome,
                v.subtotal AS venda_subtotal,
                v.desconto AS venda_desconto,
                v.total AS venda_total,
                v.valor_recebido AS venda_valor_recebido,
                v.troco AS venda_troco,
                v.observacao AS venda_observacao,
                v.cancelada AS venda_cancelada
            FROM entregas e
            LEFT JOIN vendas v
                ON v.id = e.venda_id
            WHERE e.id = ?
            `,
            [entregaId]
        );

        if (!entrega) {
            throw criarErro(404, 'Entrega não encontrada.');
        }

        const itens = entrega.venda_id
            ? await dbAll(
                `
                SELECT
                    id,
                    venda_id,
                    produto_id,
                    produto_nome,
                    quantidade,
                    unidade_medida,
                    valor_original_unitario,
                    valor_unitario,
                    desconto_unitario,
                    desconto_total,
                    valor_total
                FROM itens_venda
                WHERE venda_id = ?
                ORDER BY id ASC
                `,
                [entrega.venda_id]
            )
            : [];

        res.json({
            entrega,
            venda: entrega.venda_id
                ? {
                    id: entrega.venda_id,
                    data: entrega.venda_data,
                    hora: entrega.venda_hora,
                    forma_pagamento: entrega.venda_forma_pagamento,
                    cliente_nome: entrega.venda_cliente_nome,
                    subtotal: Number(entrega.venda_subtotal || 0),
                    desconto: Number(entrega.venda_desconto || 0),
                    total: Number(entrega.venda_total || 0),
                    valor_recebido: Number(entrega.venda_valor_recebido || 0),
                    troco: Number(entrega.venda_troco || 0),
                    observacao: entrega.venda_observacao || '',
                    cancelada: Number(entrega.venda_cancelada || 0)
                }
                : null,
            itens
        });

    } catch (erro) {
        tratarErro(res, erro);
    }
});

app.put('/entregas/:id/status', (req, res) => {
    const id = req.params.id;
    const status = req.body.status_entrega;

    const statusValidos = ['PENDENTE', 'SAIU_ENTREGA', 'ENTREGUE', 'CANCELADA'];

    if (!statusValidos.includes(status)) {
        return res.status(400).json({ erro: 'Status da entrega inválido.' });
    }

    const data = dataHojeLocal();
    const hora = horaAgoraLocal();

    db.run(
        `
        UPDATE entregas
        SET
            status_entrega = ?,
            data_status = ?,
            hora_status = ?,
            cancelada = CASE WHEN ? = 'CANCELADA' THEN 1 ELSE COALESCE(cancelada, 0) END
        WHERE id = ?
        `,
        [status, data, hora, status, id],
        function(err) {
            if (err) return res.status(500).json(err);
            res.json({ sucesso: true });
        }
    );
});

app.post('/entregas/:id/transferir-a-prazo', async (req, res) => {
    try {
        const entregaId = Number(req.params.id || 0);

        if (!entregaId) {
            throw criarErro(400, 'Entrega inv\u00e1lida.');
        }

        const entrega = await dbGet(
            `
            SELECT *
            FROM entregas
            WHERE id = ?
            `,
            [entregaId]
        );

        if (!entrega) {
            throw criarErro(404, 'Entrega n\u00e3o encontrada.');
        }

        if (Number(entrega.cancelada || 0) === 1 || entrega.status_entrega === 'CANCELADA') {
            throw criarErro(400, 'Entrega cancelada n\u00e3o pode ser transferida para A Prazo.');
        }

        if (entrega.status_entrega !== 'ENTREGUE') {
            throw criarErro(400, 'Apenas entregas j\u00e1 entregues podem ser transferidas para A Prazo.');
        }

        if (entrega.status_pagamento !== 'A_RECEBER_NA_ENTREGA') {
            throw criarErro(400, 'Esta entrega n\u00e3o est\u00e1 pendente de recebimento.');
        }

        if (Number(entrega.transferida_a_prazo || 0) === 1) {
            throw criarErro(400, 'Esta entrega j\u00e1 foi transferida para A Prazo.');
        }

        const clienteNome = String(entrega.cliente_nome || '').trim();
        const valorEntrega = arredondarMoeda(Number(entrega.valor_total || 0));

        if (!clienteNome) {
            throw criarErro(400, 'Entrega sem cliente para transferir.');
        }

        if (valorEntrega <= 0) {
            throw criarErro(400, 'Entrega sem valor em aberto para transferir.');
        }

        const itensVenda = entrega.venda_id
            ? await dbAll(
                `
                SELECT *
                FROM itens_venda
                WHERE venda_id = ?
                ORDER BY id ASC
                `,
                [entrega.venda_id]
            )
            : [];

        const data = dataHojeLocal();
        const hora = horaAgoraLocal();
        const observacaoBase = `Transferido de entrega n\u00e3o paga #${entregaId}`;
        const lancamentos = [];

        itensVenda.forEach(item => {
            const quantidade = Number(item.quantidade || 0);
            const totalItem = arredondarMoeda(Number(item.valor_total || 0));

            if (totalItem <= 0) return;

            lancamentos.push({
                produto: item.produto_nome || 'Produto da entrega',
                quantidade,
                unidadeMedida: normalizarUnidadeMedida(item.unidade_medida),
                valorUnitario: quantidade > 0
                    ? arredondarMoeda(totalItem / quantidade)
                    : arredondarMoeda(Number(item.valor_unitario || 0)),
                valorTotal: totalItem
            });
        });

        const frete = arredondarMoeda(Number(entrega.frete || 0));

        if (frete > 0) {
            lancamentos.push({
                produto: 'Frete da entrega',
                quantidade: 1,
                unidadeMedida: 'UN',
                valorUnitario: frete,
                valorTotal: frete
            });
        }

        if (!lancamentos.length) {
            lancamentos.push({
                produto: 'Entrega n\u00e3o paga',
                quantidade: 1,
                unidadeMedida: 'UN',
                valorUnitario: valorEntrega,
                valorTotal: valorEntrega
            });
        } else {
            const totalLancamentos = arredondarMoeda(
                lancamentos.reduce((soma, item) => soma + Number(item.valorTotal || 0), 0)
            );
            const diferenca = arredondarMoeda(valorEntrega - totalLancamentos);

            if (diferenca > 0.009) {
                lancamentos.push({
                    produto: 'Complemento da entrega',
                    quantidade: 1,
                    unidadeMedida: 'UN',
                    valorUnitario: diferenca,
                    valorTotal: diferenca
                });
            }
        }

        await dbRun('BEGIN TRANSACTION');

        try {
            await salvarOuAtualizarCliente({
                nome: clienteNome,
                telefone: entrega.telefone || '',
                cidade: entrega.bairro_cidade || '',
                observacao: observacaoBase
            });

            const bloqueioTransferencia = await dbRun(
                `
                UPDATE entregas
                SET transferida_a_prazo = 1
                WHERE id = ?
                AND status_entrega = 'ENTREGUE'
                AND status_pagamento = 'A_RECEBER_NA_ENTREGA'
                AND COALESCE(cancelada, 0) = 0
                AND COALESCE(transferida_a_prazo, 0) = 0
                `,
                [entregaId]
            );

            if (Number(bloqueioTransferencia.changes || 0) === 0) {
                throw criarErro(400, 'Esta entrega j\u00e1 foi transferida ou n\u00e3o est\u00e1 mais pendente de recebimento.');
            }

            const idsFiados = [];

            for (const item of lancamentos) {
                const resultado = await dbRun(
                    `
                    INSERT INTO fiados
                    (
                        venda_id,
                        cliente_nome,
                        tipo,
                        produto,
                        quantidade,
                        unidade_medida,
                        valor_unitario,
                        valor_total,
                        valor_pago,
                        quitado,
                        observacao,
                        data,
                        hora,
                        origem,
                        cancelado
                    )
                    VALUES (?, ?, 'COMPRA', ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, 'ENTREGA_TRANSFERIDA_A_PRAZO', 0)
                    `,
                    [
                        entrega.venda_id || null,
                        clienteNome,
                        item.produto,
                        item.quantidade,
                        normalizarUnidadeMedida(item.unidadeMedida),
                        item.valorUnitario,
                        item.valorTotal,
                        observacaoBase,
                        data,
                        hora
                    ]
                );

                idsFiados.push(resultado.lastID);
            }

            const observacaoAtual = String(entrega.observacao || '').trim();
            const novaObservacao = `${observacaoAtual ? observacaoAtual + ' | ' : ''}${observacaoBase}`;

            await dbRun(
                `
                UPDATE entregas
                SET
                    status_pagamento = 'FIADO',
                    transferida_a_prazo = 1,
                    fiado_transferencia_id = ?,
                    data_transferencia_prazo = ?,
                    hora_transferencia_prazo = ?,
                    observacao = ?
                WHERE id = ?
                `,
                [
                    idsFiados[0] || null,
                    data,
                    hora,
                    novaObservacao,
                    entregaId
                ]
            );

            await dbRun('COMMIT');

            res.json({
                sucesso: true,
                entrega_id: entregaId,
                fiados_criados: idsFiados.length,
                valor_transferido: valorEntrega
            });

        } catch (erroTransacao) {
            await dbRun('ROLLBACK');
            throw erroTransacao;
        }

    } catch (erro) {
        tratarErro(res, erro);
    }
});

app.put('/entregas/:id/receber', (req, res) => {
    const id = req.params.id;
    const formaRecebimento = req.body.forma_recebimento;
    const observacaoRecebimento = String(req.body.observacao || '').trim();
    const data = dataHojeLocal();
    const hora = horaAgoraLocal();

    const formasValidas = [
        'DINHEIRO',
        'PIX',
        'CARTAO_CREDITO',
        'CARTAO_DEBITO'
    ];

    if (!formasValidas.includes(formaRecebimento)) {
        return res.status(400).json({ erro: 'Forma de recebimento inválida.' });
    }

    db.get(
        `
        SELECT *
        FROM entregas
        WHERE id = ?
        AND COALESCE(cancelada, 0) = 0
        `,
        [id],
        (err, entrega) => {
            if (err) return res.status(500).json(err);

            if (!entrega) {
                return res.status(404).json({ erro: 'Entrega não encontrada.' });
            }

            if (entrega.status_pagamento !== 'A_RECEBER_NA_ENTREGA') {
                return res.status(400).json({ erro: 'Esta entrega não está pendente de recebimento.' });
            }

            const valorRecebido = Number(entrega.valor_total || 0);
            const observacaoAtual = String(entrega.observacao || '').trim();
            const novaObservacao = observacaoRecebimento
                ? `${observacaoAtual ? observacaoAtual + ' | ' : ''}Recebimento: ${observacaoRecebimento}`
                : observacaoAtual;

            db.run(
                `
                UPDATE entregas
                SET
                    status_pagamento = 'RECEBIDO_NA_ENTREGA',
                    forma_recebimento = ?,
                    valor_recebido = ?,
                    data_recebimento = ?,
                    hora_recebimento = ?,
                    observacao = ?
                WHERE id = ?
                `,
                [
                    formaRecebimento,
                    valorRecebido,
                    data,
                    hora,
                    novaObservacao,
                    id
                ],
                function(err) {
                    if (err) return res.status(500).json(err);
                    res.json({ sucesso: true, valor_recebido: valorRecebido });
                }
            );
        }
    );
});

// RETIRADAS DE CAIXA

app.post('/retiradas-caixa', async (req, res) => {
    try {
        const valor = arredondarMoeda(Number(req.body.valor || 0));
        const motivo = String(req.body.motivo || '').trim();
        const observacao = String(req.body.observacao || '').trim();

        if (valor <= 0) {
            return res.status(400).json({
                erro: 'Informe um valor válido para a retirada.'
            });
        }

        if (!motivo) {
            return res.status(400).json({
                erro: 'Informe o motivo da retirada.'
            });
        }

        const data = dataHojeLocal();
        const hora = horaAgoraLocal();

        const resultado = await dbRun(
            `
            INSERT INTO retiradas_caixa
            (
                valor,
                motivo,
                observacao,
                data,
                hora,
                cancelada
            )
            VALUES (?, ?, ?, ?, ?, 0)
            `,
            [
                valor,
                motivo,
                observacao,
                data,
                hora
            ]
        );

        res.json({
            sucesso: true,
            id: resultado.lastID,
            valor,
            motivo,
            observacao,
            data,
            hora
        });

    } catch (erro) {
        tratarErro(res, erro);
    }
});

app.get('/retiradas-caixa', async (req, res) => {
    try {
        const hoje = dataHojeLocal();

        const dataInicial = req.query.dataInicial || hoje;
        const dataFinal = req.query.dataFinal || hoje;

        const retiradas = await dbAll(
            `
            SELECT *
            FROM retiradas_caixa
            WHERE data BETWEEN ? AND ?
            ORDER BY data DESC, hora DESC, id DESC
            `,
            [dataInicial, dataFinal]
        );

        res.json(retiradas);

    } catch (erro) {
        tratarErro(res, erro);
    }
});

app.put('/retiradas-caixa/:id/cancelar', async (req, res) => {
    try {
        const id = req.params.id;
        const motivo = String(req.body.motivo || '').trim() || 'Cancelamento de retirada de caixa';

        const retirada = await dbGet(
            `
            SELECT *
            FROM retiradas_caixa
            WHERE id = ?
            `,
            [id]
        );

        if (!retirada) {
            return res.status(404).json({ erro: 'Retirada não encontrada.' });
        }

        if (Number(retirada.cancelada || 0) === 1) {
            return res.status(400).json({ erro: 'Esta retirada já foi cancelada.' });
        }

        const dataCancelamento = dataHojeLocal();
        const horaCancelamento = horaAgoraLocal();

        await dbRun(
            `
            UPDATE retiradas_caixa
            SET
                cancelada = 1,
                data_cancelamento = ?,
                hora_cancelamento = ?,
                motivo_cancelamento = ?
            WHERE id = ?
            `,
            [
                dataCancelamento,
                horaCancelamento,
                motivo,
                id
            ]
        );

        res.json({
            sucesso: true,
            retirada_id: id,
            data_cancelamento: dataCancelamento,
            hora_cancelamento: horaCancelamento
        });

    } catch (erro) {
        tratarErro(res, erro);
    }
});

// FINANCEIRO

app.get('/financeiro', async (req, res) => {
    try {
        const hoje = dataHojeLocal();

        const dataInicial = req.query.dataInicial || hoje;
        const dataFinal = req.query.dataFinal || hoje;

        const dados = {
            totalRecebido: 0,
            vendasRecebidas: 0,
            recebimentosFiados: 0,
            recebimentosEntregas: 0,
            retiradasCaixa: 0,
            abatimentosDivida: 0,
            fiadosGerados: 0,
            totalVendas: 0,
            ticketMedio: 0,
            formasEntrada: [],
            historico: []
        };

        const vendas = await dbGet(
            `
            SELECT
                COALESCE(SUM(total), 0) AS total,
                COUNT(*) AS quantidade
            FROM vendas
            WHERE data BETWEEN ? AND ?
            AND COALESCE(cancelada, 0) = 0
            AND forma_pagamento <> 'FIADO'
            AND forma_pagamento <> 'ABATIMENTO_DIVIDA'
            AND forma_pagamento <> 'A_RECEBER_ENTREGA'
            `,
            [dataInicial, dataFinal]
        );

        dados.vendasRecebidas = Number(vendas.total || 0);
        dados.totalVendas = Number(vendas.quantidade || 0);

        const recebimentosEntregas = await dbGet(
            `
            SELECT
                COALESCE(SUM(valor_recebido), 0) AS total,
                COUNT(*) AS quantidade
            FROM entregas
            WHERE status_pagamento = 'RECEBIDO_NA_ENTREGA'
            AND COALESCE(cancelada, 0) = 0
            AND data_recebimento BETWEEN ? AND ?
            `,
            [dataInicial, dataFinal]
        );

        dados.recebimentosEntregas = Number(recebimentosEntregas.total || 0);

        const abatimentos = await dbGet(
            `
            SELECT
                COALESCE(SUM(total), 0) AS total
            FROM vendas
            WHERE data BETWEEN ? AND ?
            AND COALESCE(cancelada, 0) = 0
            AND forma_pagamento = 'ABATIMENTO_DIVIDA'
            `,
            [dataInicial, dataFinal]
        );

        dados.abatimentosDivida = Number(abatimentos.total || 0);

        const pagamentosFiados = await dbGet(
            `
            SELECT
                COALESCE(SUM(valor_total), 0) AS total
            FROM fiados
            WHERE tipo = 'PAGAMENTO'
            AND COALESCE(cancelado, 0) = 0
            AND data BETWEEN ? AND ?
            `,
            [dataInicial, dataFinal]
        );

        dados.recebimentosFiados = Number(pagamentosFiados.total || 0);

        const fiadosGerados = await dbGet(
            `
            SELECT
                COALESCE(SUM(valor_total), 0) AS total
            FROM fiados
            WHERE tipo = 'COMPRA'
            AND COALESCE(cancelado, 0) = 0
            AND data BETWEEN ? AND ?
            `,
            [dataInicial, dataFinal]
        );

        dados.fiadosGerados = Number(fiadosGerados.total || 0);

        const retiradasCaixa = await dbGet(
            `
            SELECT
                COALESCE(SUM(valor), 0) AS total
            FROM retiradas_caixa
            WHERE COALESCE(cancelada, 0) = 0
            AND data BETWEEN ? AND ?
            `,
            [dataInicial, dataFinal]
        );

        dados.retiradasCaixa = Number(retiradasCaixa.total || 0);

        dados.totalRecebido = arredondarMoeda(
            dados.vendasRecebidas +
            dados.recebimentosFiados +
            dados.recebimentosEntregas -
            dados.retiradasCaixa
        );

        dados.ticketMedio = dados.totalVendas > 0
            ? dados.vendasRecebidas / dados.totalVendas
            : 0;

        const formasVendas = await dbAll(
            `
            SELECT
                forma_pagamento AS tipo,
                SUM(total) AS valor
            FROM vendas
            WHERE data BETWEEN ? AND ?
            AND COALESCE(cancelada, 0) = 0
            AND forma_pagamento <> 'FIADO'
            AND forma_pagamento <> 'ABATIMENTO_DIVIDA'
            AND forma_pagamento <> 'A_RECEBER_ENTREGA'
            GROUP BY forma_pagamento
            `,
            [dataInicial, dataFinal]
        );

        const formasEntregas = await dbAll(
            `
            SELECT
                forma_recebimento AS tipo,
                SUM(valor_recebido) AS valor
            FROM entregas
            WHERE status_pagamento = 'RECEBIDO_NA_ENTREGA'
            AND COALESCE(cancelada, 0) = 0
            AND data_recebimento BETWEEN ? AND ?
            GROUP BY forma_recebimento
            `,
            [dataInicial, dataFinal]
        );

        dados.formasEntrada = [
            ...formasVendas,
            ...formasEntregas,
            {
                tipo: 'PAGAMENTO_A_PRAZO',
                valor: dados.recebimentosFiados
            }
        ];

        if (dados.retiradasCaixa > 0) {
            dados.formasEntrada.push({
                tipo: 'RETIRADA_CAIXA',
                valor: -dados.retiradasCaixa
            });
        }

        const historico = await dbAll(
            `
            SELECT
                data,
                hora,
                origem,
                tipo,
                cliente,
                valor,
                observacao,
                referencia_id,
                tabela_origem,
                pode_cancelar,
                pode_reimprimir
            FROM (
                SELECT
                    id AS ordem_id,
                    data,
                    hora,
                    'Venda' AS origem,
                    forma_pagamento AS tipo,
                    cliente_nome AS cliente,
                    total AS valor,
                    observacao,
                    id AS referencia_id,
                    'vendas' AS tabela_origem,
                    1 AS pode_cancelar,
                    1 AS pode_reimprimir
                FROM vendas
                WHERE data BETWEEN ? AND ?
                AND COALESCE(cancelada, 0) = 0
                AND forma_pagamento <> 'FIADO'
                AND forma_pagamento <> 'ABATIMENTO_DIVIDA'
                AND forma_pagamento <> 'A_RECEBER_ENTREGA'

                UNION ALL

                SELECT
                    id AS ordem_id,
                    data,
                    hora,
                    CASE
                        WHEN COALESCE(origem, '') = 'PAGAMENTO_ITENS'
                        THEN 'Recebimento por Produtos'
                        WHEN COALESCE(origem, '') = 'PAGAMENTO_VALOR'
                        THEN 'Recebimento Avulso A Prazo'
                        ELSE 'Recebimento A Prazo'
                    END AS origem,
                    COALESCE(forma_pagamento, 'PAGAMENTO_A_PRAZO') AS tipo,
                    cliente_nome AS cliente,
                    valor_total AS valor,
                    observacao,
                    id AS referencia_id,
                    'fiados' AS tabela_origem,
                    0 AS pode_cancelar,
                    0 AS pode_reimprimir
                FROM fiados
                WHERE tipo = 'PAGAMENTO'
                AND COALESCE(cancelado, 0) = 0
                AND data BETWEEN ? AND ?

                UNION ALL

                SELECT
                    id AS ordem_id,
                    data_recebimento AS data,
                    hora_recebimento AS hora,
                    'Recebimento Entrega' AS origem,
                    forma_recebimento AS tipo,
                    cliente_nome AS cliente,
                    valor_recebido AS valor,
                    observacao,
                    id AS referencia_id,
                    'entregas' AS tabela_origem,
                    0 AS pode_cancelar,
                    0 AS pode_reimprimir
                FROM entregas
                WHERE status_pagamento = 'RECEBIDO_NA_ENTREGA'
                AND COALESCE(cancelada, 0) = 0
                AND data_recebimento BETWEEN ? AND ?

                UNION ALL

                SELECT
                    id AS ordem_id,
                    data,
                    hora,
                    'Retirada de Caixa' AS origem,
                    'RETIRADA_CAIXA' AS tipo,
                    '' AS cliente,
                    -valor AS valor,
                    CASE
                        WHEN COALESCE(observacao, '') <> ''
                        THEN motivo || ' - ' || observacao
                        ELSE motivo
                    END AS observacao,
                    id AS referencia_id,
                    'retiradas_caixa' AS tabela_origem,
                    0 AS pode_cancelar,
                    0 AS pode_reimprimir
                FROM retiradas_caixa
                WHERE COALESCE(cancelada, 0) = 0
                AND data BETWEEN ? AND ?
            )
            ORDER BY data DESC, hora DESC, ordem_id DESC
            `,
            [
                dataInicial,
                dataFinal,
                dataInicial,
                dataFinal,
                dataInicial,
                dataFinal,
                dataInicial,
                dataFinal
            ]
        );

        dados.historico = historico;

        res.json(dados);

    } catch (erro) {
        tratarErro(res, erro);
    }
});

// ESTOQUE BAIXO

app.get('/estoque-baixo', (req, res) => {
    db.all(
        `
        SELECT
            id,
            codigo,
            nome,
            categoria,
            descricao,
            estoque,
            estoque_minimo
        FROM produtos
        WHERE estoque <= estoque_minimo
        ORDER BY estoque ASC, nome ASC
        `,
        [],
        (err, rows) => {
            if (err) return res.status(500).json(err);
            res.json(rows);
        }
    );
});

// FIADOS ATRASADOS

app.get('/fiados-atrasados', (req, res) => {
    listarFiadosAtrasados()
        .then(resultado => res.json(resultado))
        .catch(erro => tratarErro(res, erro));
});

// MOVIMENTAÇÕES DE ESTOQUE

app.get('/movimentacoes-estoque', (req, res) => {
    let sql = `
        SELECT *
        FROM movimentacoes_estoque
        WHERE 1=1
    `;

    const parametros = [];

    if (req.query.incluirCanceladas !== '1') {
        sql += ` AND COALESCE(cancelada, 0) = 0`;
    }

    if (req.query.dataInicial) {
        sql += ` AND data >= ?`;
        parametros.push(req.query.dataInicial);
    }

    if (req.query.dataFinal) {
        sql += ` AND data <= ?`;
        parametros.push(req.query.dataFinal);
    }

    if (req.query.tipo) {
        sql += ` AND tipo = ?`;
        parametros.push(req.query.tipo);
    }

    if (req.query.produto) {
        sql += ` AND produto_nome LIKE ?`;
        parametros.push(`%${req.query.produto}%`);
    }

    sql += ` ORDER BY data DESC, hora DESC, id DESC`;

    db.all(sql, parametros, (err, rows) => {
        if (err) return res.status(500).json(err);
        res.json(rows);
    });
});

app.post('/movimentacoes-estoque', (req, res) => {
    const {
        produto_id,
        tipo,
        quantidade,
        observacao
    } = req.body;

    db.get(
        `
        SELECT *
        FROM produtos
        WHERE id = ?
        `,
        [produto_id],
        (err, produto) => {
            if (err) return res.status(500).json(err);

            if (!produto) {
                return res.status(404).json({
                    erro: 'Produto não encontrado.'
                });
            }

            const estoqueAnterior = Number(produto.estoque || 0);
            let estoqueAtual = estoqueAnterior;

            if (tipo === 'ENTRADA') {
                estoqueAtual += Number(quantidade);
            }

            if (tipo === 'SAIDA') {
                estoqueAtual -= Number(quantidade);
            }

            if (tipo === 'PERDA') {
                estoqueAtual -= Number(quantidade);
            }

            if (tipo === 'AJUSTE') {
                estoqueAtual = Number(quantidade);
            }

            if (estoqueAtual < 0) {
                return res.status(400).json({
                    erro: 'Estoque insuficiente.'
                });
            }

            db.run(
                `
                UPDATE produtos
                SET estoque = ?
                WHERE id = ?
                `,
                [
                    estoqueAtual,
                    produto_id
                ],
                (err) => {
                    if (err) return res.status(500).json(err);

                    const data = dataHojeLocal();
                    const hora = horaAgoraLocal();

                    db.run(
                        `
                        INSERT INTO movimentacoes_estoque
                        (
                            produto_id,
                            produto_nome,
                            tipo,
                            quantidade,
                            estoque_anterior,
                            estoque_atual,
                            observacao,
                            data,
                            hora,
                            cancelada
                        )
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
                        `,
                        [
                            produto.id,
                            produto.nome,
                            tipo,
                            quantidade,
                            estoqueAnterior,
                            estoqueAtual,
                            observacao || '',
                            data,
                            hora
                        ],
                        function(err) {
                            if (err) return res.status(500).json(err);

                            res.json({
                                sucesso: true,
                                id: this.lastID
                            });
                        }
                    );
                }
            );
        }
    );
});

app.put('/movimentacoes-estoque/:id/cancelar', async (req, res) => {
    try {
        const id = req.params.id;
        const motivo = String(req.body.motivo || '').trim() || 'Cancelamento de movimentação';

        const movimentacao = await dbGet(
            `
            SELECT *
            FROM movimentacoes_estoque
            WHERE id = ?
            `,
            [id]
        );

        if (!movimentacao) {
            return res.status(404).json({ erro: 'Movimentação não encontrada.' });
        }

        if (Number(movimentacao.cancelada || 0) === 1) {
            return res.status(400).json({ erro: 'Esta movimentação já foi cancelada.' });
        }

        if (movimentacao.tipo === 'VENDA' || movimentacao.venda_id) {
            const venda = await buscarVendaPorMovimentacao(movimentacao);

            if (!venda) {
                return res.status(400).json({
                    erro: 'Esta movimentação pertence a uma venda, mas não foi possível localizar a venda original. Cancele pelo histórico financeiro, se a venda aparecer lá.'
                });
            }

            const resultado = await cancelarVendaPorId(venda.id, motivo);

            return res.json({
                ...resultado,
                mensagem: 'Venda vinculada à movimentação cancelada com sucesso.'
            });
        }

        if (
            movimentacao.tipo === 'CANCELAMENTO_VENDA' ||
            movimentacao.tipo === 'CANCELAMENTO_MOVIMENTACAO'
        ) {
            return res.status(400).json({
                erro: 'Não é possível cancelar uma movimentação que já é de cancelamento.'
            });
        }

        const produto = await dbGet(
            `
            SELECT *
            FROM produtos
            WHERE id = ?
            `,
            [movimentacao.produto_id]
        );

        if (!produto) {
            return res.status(404).json({ erro: 'Produto da movimentação não encontrado.' });
        }

        const estoqueAnteriorAtual = Number(produto.estoque || 0);
        const quantidade = Number(movimentacao.quantidade || 0);
        let estoqueAtual = estoqueAnteriorAtual;

        if (movimentacao.tipo === 'ENTRADA') {
            estoqueAtual = estoqueAnteriorAtual - quantidade;
        } else if (
            movimentacao.tipo === 'SAIDA' ||
            movimentacao.tipo === 'PERDA'
        ) {
            estoqueAtual = estoqueAnteriorAtual + quantidade;
        } else if (movimentacao.tipo === 'AJUSTE') {
            estoqueAtual = Number(movimentacao.estoque_anterior || 0);
        } else {
            estoqueAtual = Number(movimentacao.estoque_anterior || estoqueAnteriorAtual);
        }

        if (estoqueAtual < 0) {
            return res.status(400).json({
                erro: 'Não foi possível cancelar. O estoque ficaria negativo.'
            });
        }

        const dataCancelamento = dataHojeLocal();
        const horaCancelamento = horaAgoraLocal();

        await dbRun('BEGIN TRANSACTION');

        try {
            await dbRun(
                `
                UPDATE produtos
                SET estoque = ?
                WHERE id = ?
                `,
                [
                    estoqueAtual,
                    movimentacao.produto_id
                ]
            );

            await dbRun(
                `
                UPDATE movimentacoes_estoque
                SET
                    cancelada = 1,
                    data_cancelamento = ?,
                    hora_cancelamento = ?,
                    motivo_cancelamento = ?
                WHERE id = ?
                `,
                [
                    dataCancelamento,
                    horaCancelamento,
                    motivo,
                    id
                ]
            );

            await dbRun(
                `
                INSERT INTO movimentacoes_estoque
                (
                    produto_id,
                    produto_nome,
                    tipo,
                    quantidade,
                    estoque_anterior,
                    estoque_atual,
                    observacao,
                    data,
                    hora
                )
                VALUES (?, ?, 'CANCELAMENTO_MOVIMENTACAO', ?, ?, ?, ?, ?, ?)
                `,
                [
                    movimentacao.produto_id,
                    movimentacao.produto_nome,
                    quantidade,
                    estoqueAnteriorAtual,
                    estoqueAtual,
                    `Cancelamento da movimentação #${id}. ${motivo}`,
                    dataCancelamento,
                    horaCancelamento
                ]
            );

            await dbRun('COMMIT');

            res.json({
                sucesso: true,
                movimentacao_id: id,
                estoque_atual: estoqueAtual
            });

        } catch (erroTransacao) {
            await dbRun('ROLLBACK');
            throw erroTransacao;
        }

    } catch (erro) {
        tratarErro(res, erro);
    }
});

const PORT = process.env.PORT || 3000;

async function iniciarServidor() {
    try {
        if (db.pronto) {
            await db.pronto;
        }

        app.listen(PORT, () => {
            console.log(`Servidor rodando na porta ${PORT}`);
        });
    } catch (erro) {
        console.error('Erro ao preparar o banco antes de iniciar o servidor:', erro.message);
        process.exit(1);
    }
}

iniciarServidor();
