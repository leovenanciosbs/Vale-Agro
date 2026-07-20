let graficoProdutos = null;

function formatarMoeda(valor) {
    return Number(valor || 0).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
}

function converterNumero(valor) {
    return Number(String(valor || '0').replace(',', '.')) || 0;
}

function escaparHtml(valor) {
    return String(valor || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function dataParaInput(data) {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const dia = String(data.getDate()).padStart(2, '0');

    return `${ano}-${mes}-${dia}`;
}

function hojeInput() {
    return dataParaInput(new Date());
}

function subtrairDias(dias) {
    const data = new Date();
    data.setDate(data.getDate() - dias);
    return dataParaInput(data);
}

function inicioMesAtual() {
    const data = new Date();
    return dataParaInput(new Date(data.getFullYear(), data.getMonth(), 1));
}

function inicioAnoAtual() {
    const data = new Date();
    return dataParaInput(new Date(data.getFullYear(), 0, 1));
}

function preencherTexto(id, valor) {
    const elemento = document.getElementById(id);

    if (elemento) {
        elemento.textContent = valor;
    }
}

function calcularPeriodoSelecionado() {
    const periodo = document.getElementById('filtroPeriodo').value;

    if (periodo === 'HOJE') {
        return {
            dataInicial: hojeInput(),
            dataFinal: hojeInput()
        };
    }

    if (periodo === '7DIAS') {
        return {
            dataInicial: subtrairDias(7),
            dataFinal: hojeInput()
        };
    }

    if (periodo === '30DIAS') {
        return {
            dataInicial: subtrairDias(30),
            dataFinal: hojeInput()
        };
    }

    if (periodo === 'MES') {
        return {
            dataInicial: inicioMesAtual(),
            dataFinal: hojeInput()
        };
    }

    if (periodo === 'ANO') {
        return {
            dataInicial: inicioAnoAtual(),
            dataFinal: hojeInput()
        };
    }

    return {
        dataInicial: document.getElementById('dataInicial').value,
        dataFinal: document.getElementById('dataFinal').value
    };
}

function verificarPeriodoPersonalizado() {
    const periodo = document.getElementById('filtroPeriodo').value;
    const dataInicial = document.getElementById('dataInicial');
    const dataFinal = document.getElementById('dataFinal');

    if (periodo === 'PERSONALIZADO') {
        dataInicial.style.display = 'block';
        dataFinal.style.display = 'block';
    } else {
        dataInicial.style.display = 'none';
        dataFinal.style.display = 'none';
        dataInicial.value = '';
        dataFinal.value = '';
    }
}

function irPara(pagina) {
    window.location.href = pagina;
}

async function carregarDashboard() {
    const periodo = calcularPeriodoSelecionado();

    const params = new URLSearchParams();

    if (periodo.dataInicial) params.append('dataInicial', periodo.dataInicial);
    if (periodo.dataFinal) params.append('dataFinal', periodo.dataFinal);

    try {
        const resposta = await fetch(`/dashboard?${params.toString()}`);
        const dados = await resposta.json();

        if (!resposta.ok) {
            throw new Error(dados.erro || 'Erro ao carregar dashboard.');
        }

        const faturamentoBruto = Number(
            dados.faturamentoBrutoPeriodo !== undefined
                ? dados.faturamentoBrutoPeriodo
                : dados.faturamentoPeriodo || 0
        );

        const retiradasCaixa = Number(dados.retiradasCaixa || 0);

        const caixaLiquido = Number(
            dados.caixaLiquidoPeriodo !== undefined
                ? dados.caixaLiquidoPeriodo
                : faturamentoBruto - retiradasCaixa
        );

        preencherTexto('faturamentoBrutoPeriodo', formatarMoeda(faturamentoBruto));
        preencherTexto('retiradasCaixaPeriodo', formatarMoeda(retiradasCaixa));
        preencherTexto('caixaLiquidoPeriodo', formatarMoeda(caixaLiquido));

        // Compatibilidade caso algum HTML antigo ainda tenha esse ID
        preencherTexto('faturamentoPeriodo', formatarMoeda(caixaLiquido));

        preencherTexto('totalVendas', dados.totalVendas || 0);
        preencherTexto('fiadosAberto', formatarMoeda(dados.fiadosAberto));
        preencherTexto('produtosBaixos', dados.produtosBaixos || 0);
        preencherTexto('totalMovimentacoes', dados.totalMovimentacoes || 0);

        preencherTexto(
            'estoqueBaixoAlerta',
            `${dados.estoqueBaixoAlerta || 0} produtos`
        );

        preencherTexto(
            'quantidadeFiadosAtrasados',
            `${dados.fiadosAtrasados || 0} clientes`
        );

        preencherTexto(
            'valorFiadosAtrasados',
            `${formatarMoeda(dados.valorFiadosAtrasados || 0)} pendente`
        );

        const entregasPendentes = Number(dados.entregasPendentes || 0);
        const valorEntregasAReceber = Number(dados.valorEntregasAReceber || 0);

        preencherTexto('entregasPendentes', entregasPendentes);

        preencherTexto(
            'entregasPendentesAlerta',
            `${entregasPendentes} ${entregasPendentes === 1 ? 'entrega' : 'entregas'}`
        );

        preencherTexto(
            'valorEntregasAReceber',
            `${formatarMoeda(valorEntregasAReceber)} a receber`
        );

        renderizarTabelaProdutos(dados.produtosMaisVendidos || []);
        renderizarGraficoProdutos(dados.produtosMaisVendidos || []);

    } catch (erro) {
        console.error('Erro ao carregar dashboard:', erro);
        mostrarMensagemSistema('Erro ao carregar o dashboard. Verifique se o servidor está rodando.', 'erro');
    }
}

async function registrarRetiradaCaixa() {
    const campoValor = document.getElementById('valorRetiradaCaixa');
    const campoMotivo = document.getElementById('motivoRetiradaCaixa');
    const campoObservacao = document.getElementById('observacaoRetiradaCaixa');

    const valor = converterNumero(campoValor ? campoValor.value : 0);
    const motivo = campoMotivo ? campoMotivo.value.trim() : '';
    const observacao = campoObservacao ? campoObservacao.value.trim() : '';

    if (valor <= 0) {
        mostrarMensagemSistema('Informe um valor válido para a retirada.', 'aviso');
        return;
    }

    if (!motivo) {
        mostrarMensagemSistema('Selecione o motivo da retirada.', 'aviso');
        return;
    }

    const confirmar = await mostrarConfirmacaoSistema({
        titulo: 'Confirmar retirada de caixa?',
        mensagem: `Retirada de ${formatarMoeda(valor)}. Motivo: ${motivo}`,
        textoConfirmar: 'Confirmar retirada',
        textoCancelar: 'Voltar',
        tipo: 'info'
    });

    if (!confirmar) {
        return;
    }

    try {
        const resposta = await fetch('/retiradas-caixa', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                valor,
                motivo,
                observacao
            })
        });

        const resultado = await resposta.json();

        if (!resposta.ok) {
            throw new Error(resultado.erro || 'Erro ao registrar retirada.');
        }

        if (campoValor) campoValor.value = '';
        if (campoMotivo) campoMotivo.value = '';
        if (campoObservacao) campoObservacao.value = '';

        mostrarMensagemSistema('Retirada de caixa registrada com sucesso.', 'sucesso');

        carregarDashboard();

    } catch (erro) {
        console.error('Erro ao registrar retirada de caixa:', erro);
        mostrarMensagemSistema(erro.message || 'Erro ao registrar retirada de caixa.', 'erro');
    }
}

function renderizarTabelaProdutos(produtos) {
    const tabela = document.getElementById('tabelaProdutosMaisVendidos');
    tabela.innerHTML = '';

    if (!produtos || produtos.length === 0) {
        tabela.innerHTML = `
            <tr>
                <td colspan="3">Nenhum produto vendido no período.</td>
            </tr>
        `;
        return;
    }

    produtos.forEach(produto => {
        tabela.innerHTML += `
            <tr>
                <td>${escaparHtml(produto.produto_nome || '-')}</td>
                <td>${Number(produto.quantidade_total || 0)}</td>
                <td>${formatarMoeda(produto.valor_total)}</td>
            </tr>
        `;
    });
}

function renderizarGraficoProdutos(produtos) {
    const ctx = document.getElementById('graficoProdutos');

    if (!ctx) return;

    if (graficoProdutos) {
        graficoProdutos.destroy();
    }

    const labels = produtos.map(item => item.produto_nome || '-');
    const valores = produtos.map(item => Number(item.quantidade_total || 0));

    graficoProdutos = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Quantidade vendida',
                data: valores,
                backgroundColor: 'rgba(33, 59, 86, 0.86)',
                borderColor: '#172b41',
                borderWidth: 1,
                borderRadius: 10,
                borderSkipped: false,
                hoverBackgroundColor: '#d99032',
                maxBarThickness: 42
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: {
                    top: 8,
                    right: 12,
                    bottom: 0,
                    left: 4
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: '#172431',
                    titleColor: '#ffffff',
                    bodyColor: '#eef7ef',
                    padding: 12,
                    cornerRadius: 10,
                    displayColors: false
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: '#667484',
                        font: {
                            size: 12,
                            weight: '600'
                        }
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(23, 43, 65, 0.08)',
                        drawBorder: false
                    },
                    ticks: {
                        precision: 0,
                        color: '#667484',
                        font: {
                            size: 12,
                            weight: '600'
                        }
                    }
                }
            }
        }
    });
}

verificarPeriodoPersonalizado();
carregarDashboard();
