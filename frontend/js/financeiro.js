let graficoFinanceiro = null;
let ultimoHistoricoFinanceiro = [];
let periodoHistoricoAtual = {
    dataInicial: '',
    dataFinal: ''
};
let clientesComprovanteCache = null;

function formatarMoeda(valor) {
    return Number(valor || 0).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
}

function normalizarUnidadeMedidaFinanceiro(valor) {
    const unidade = String(valor || 'UN').trim().toUpperCase();
    const unidadesValidas = ['UN', 'KG', 'G', 'L', 'ML', 'M'];

    return unidadesValidas.includes(unidade) ? unidade : 'UN';
}

function formatarQuantidadeFinanceiro(valor) {
    return Number(valor || 0).toLocaleString('pt-BR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 3
    });
}

function formatarQuantidadeComUnidadeFinanceiro(valor, unidade) {
    return `${formatarQuantidadeFinanceiro(valor)} ${normalizarUnidadeMedidaFinanceiro(unidade)}`;
}

function escaparHtml(valor) {
    return String(valor || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function preencherTexto(id, valor) {
    const elemento = document.getElementById(id);

    if (elemento) {
        elemento.textContent = valor;
    }
}

function formatarData(data) {
    if (!data) return '-';

    const partes = String(data).split('-');

    if (partes.length !== 3) {
        return data;
    }

    return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function formatarHora(hora) {
    if (!hora) return '';
    return String(hora).slice(0, 5);
}

function formatarHoraCompleta(hora) {
    if (!hora) return '';
    return String(hora).slice(0, 8);
}

function formatarDataHora(data, hora) {
    const dataFormatada = formatarData(data);
    const horaFormatada = formatarHora(hora);

    if (!horaFormatada) {
        return dataFormatada;
    }

    return `${dataFormatada}<br><small>${horaFormatada}</small>`;
}

function calcularTotalHistorico(lista) {
    return lista.reduce((total, item) => {
        const tipo = String(item.tipo || '').toUpperCase();

        if (tipo === 'FIADO') return total;
        if (tipo === 'ABATIMENTO_DIVIDA') return total;
        if (tipo === 'A_RECEBER_ENTREGA') return total;

        return total + Number(item.valor || 0);
    }, 0);
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

function ultimoDiaDoMes(ano, mes) {
    return new Date(ano, Number(mes), 0).getDate();
}

function preencherAnos(selectId) {
    const selectAno = document.getElementById(selectId);
    const anoAtual = new Date().getFullYear();

    if (!selectAno) return;

    selectAno.innerHTML = '';

    for (let ano = anoAtual; ano >= anoAtual - 10; ano--) {
        selectAno.innerHTML += `<option value="${ano}">${ano}</option>`;
    }

    selectAno.value = anoAtual;
}

function calcularPeriodoFinanceiro() {
    return calcularPeriodoPorCampos({
        periodoId: 'filtroPeriodo',
        anoId: 'filtroAno',
        mesId: 'filtroMes',
        dataInicialId: 'dataInicial',
        dataFinalId: 'dataFinal'
    });
}

function calcularPeriodoHistorico() {
    return calcularPeriodoPorCampos({
        periodoId: 'historicoPeriodo',
        anoId: 'historicoAno',
        mesId: 'historicoMes',
        dataInicialId: 'historicoDataInicial',
        dataFinalId: 'historicoDataFinal'
    });
}

function calcularPeriodoPorCampos(ids) {
    const periodo = document.getElementById(ids.periodoId).value;

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

    if (periodo === 'MES_ANO') {
        const ano = document.getElementById(ids.anoId).value;
        const mes = document.getElementById(ids.mesId).value;
        const ultimoDia = ultimoDiaDoMes(ano, mes);

        return {
            dataInicial: `${ano}-${mes}-01`,
            dataFinal: `${ano}-${mes}-${String(ultimoDia).padStart(2, '0')}`
        };
    }

    return {
        dataInicial: document.getElementById(ids.dataInicialId).value,
        dataFinal: document.getElementById(ids.dataFinalId).value
    };
}

function verificarFiltrosFinanceiro() {
    verificarFiltrosPorCampos({
        periodoId: 'filtroPeriodo',
        anoId: 'filtroAno',
        mesId: 'filtroMes',
        dataInicialId: 'dataInicial',
        dataFinalId: 'dataFinal'
    });
}

function verificarFiltrosHistorico() {
    verificarFiltrosPorCampos({
        periodoId: 'historicoPeriodo',
        anoId: 'historicoAno',
        mesId: 'historicoMes',
        dataInicialId: 'historicoDataInicial',
        dataFinalId: 'historicoDataFinal'
    });
}

function verificarFiltrosPorCampos(ids) {
    const periodo = document.getElementById(ids.periodoId).value;

    const dataInicial = document.getElementById(ids.dataInicialId);
    const dataFinal = document.getElementById(ids.dataFinalId);
    const filtroAno = document.getElementById(ids.anoId);
    const filtroMes = document.getElementById(ids.mesId);

    dataInicial.style.display = 'none';
    dataFinal.style.display = 'none';
    filtroAno.style.display = 'none';
    filtroMes.style.display = 'none';

    dataInicial.value = '';
    dataFinal.value = '';

    if (periodo === 'PERSONALIZADO') {
        dataInicial.style.display = 'block';
        dataFinal.style.display = 'block';
    }

    if (periodo === 'MES_ANO') {
        filtroAno.style.display = 'block';
        filtroMes.style.display = 'block';
    }
}

function formatarTipo(tipo) {
    const nomes = {
        DINHEIRO: 'Dinheiro',
        PIX: 'PIX',
        CARTAO_CREDITO: 'Cartão de Crédito',
        CARTAO_DEBITO: 'Cartão de Débito',
        CARTAO: 'Cartão',
        FIADO: 'A Prazo Gerado',
        PAGAMENTO_FIADO: 'Recebimento A Prazo',
        PAGAMENTO_A_PRAZO: 'Recebimento A Prazo',
        ABATIMENTO_DIVIDA: 'Abatimento de Dívida',
        A_RECEBER_ENTREGA: 'A Receber na Entrega',
        RECEBIDO_NA_ENTREGA: 'Recebido na Entrega',
        RETIRADA_CAIXA: 'Retirada de Caixa'
    };

    return nomes[tipo] || tipo || '-';
}

function formatarFormaPagamento(forma) {
    const nomes = {
        DINHEIRO: 'Dinheiro',
        PIX: 'PIX',
        CARTAO_CREDITO: 'Cartão de Crédito',
        CARTAO_DEBITO: 'Cartão de Débito',
        CARTAO: 'Cartão',
        FIADO: 'A Prazo',
        ABATIMENTO_DIVIDA: 'Abatimento de Dívida',
        A_RECEBER_ENTREGA: 'A Receber na Entrega',
        PAGO_NA_COMPRA: 'Pago durante a compra',
        A_RECEBER_NA_ENTREGA: 'A receber na entrega',
        RECEBIDO_NA_ENTREGA: 'Recebido na entrega',
        RETIRADA_CAIXA: 'Retirada de Caixa'
    };

    return nomes[forma] || forma || '-';
}

function formatarOrigemFinanceira(item) {
    const texto = String(
        item.origem ||
        item.observacao ||
        item.tipo ||
        ''
    ).trim();

    const textoNormalizado = texto.toUpperCase();

    if (
        textoNormalizado.includes('PAGAMENTO_ITENS') ||
        textoNormalizado.includes('PAGAMENTO POR PRODUTOS') ||
        textoNormalizado.includes('RECEBIMENTO POR PRODUTOS')
    ) {
        return 'Pagamento A Prazo';
    }

    return texto || '-';
}

function classeTipoFinanceiro(tipo) {
    const tipoNormalizado = String(tipo || '').toUpperCase();

    if (
        tipoNormalizado === 'DINHEIRO' ||
        tipoNormalizado === 'PIX' ||
        tipoNormalizado === 'CARTAO' ||
        tipoNormalizado === 'CARTAO_CREDITO' ||
        tipoNormalizado === 'CARTAO_DEBITO' ||
        tipoNormalizado === 'PAGAMENTO_FIADO' ||
        tipoNormalizado === 'PAGAMENTO_A_PRAZO' ||
        tipoNormalizado === 'RECEBIDO_NA_ENTREGA'
    ) {
        return 'tag-financeiro-entrada';
    }

    if (
        tipoNormalizado === 'FIADO' ||
        tipoNormalizado === 'A_RECEBER_ENTREGA'
    ) {
        return 'tag-financeiro-pendente';
    }

    if (
        tipoNormalizado === 'ABATIMENTO_DIVIDA' ||
        tipoNormalizado === 'RETIRADA_CAIXA'
    ) {
        return 'tag-financeiro-saida';
    }

    return 'tag-financeiro-neutro';
}

function classeValorFinanceiro(item) {
    const tipo = String(item.tipo || '').toUpperCase();
    const valor = Number(item.valor || 0);

    if (tipo === 'FIADO' || tipo === 'A_RECEBER_ENTREGA') {
        return 'valor-financeiro-pendente';
    }

    if (tipo === 'ABATIMENTO_DIVIDA' || tipo === 'RETIRADA_CAIXA' || valor < 0) {
        return 'valor-financeiro-saida';
    }

    return 'valor-financeiro-entrada';
}

async function carregarFinanceiro() {
    const periodo = calcularPeriodoFinanceiro();

    const params = new URLSearchParams();

    if (periodo.dataInicial) params.append('dataInicial', periodo.dataInicial);
    if (periodo.dataFinal) params.append('dataFinal', periodo.dataFinal);

    try {
        const resposta = await fetch(`/financeiro?${params.toString()}`);
        const dados = await resposta.json();

        preencherTexto('totalRecebido', formatarMoeda(dados.totalRecebido));
        preencherTexto('vendasRecebidas', formatarMoeda(dados.vendasRecebidas));
        preencherTexto('recebimentosFiados', formatarMoeda(dados.recebimentosFiados));
        preencherTexto('abatimentosDivida', formatarMoeda(dados.abatimentosDivida));
        preencherTexto('fiadosGerados', formatarMoeda(dados.fiadosGerados));
        preencherTexto('totalVendas', dados.totalVendas);
        preencherTexto('ticketMedio', formatarMoeda(dados.ticketMedio));
        preencherTexto('recebimentosEntregas', formatarMoeda(dados.recebimentosEntregas || 0));

        renderizarResumo(dados);
        renderizarGrafico(dados.formasEntrada || []);

    } catch (erro) {
        console.error('Erro ao carregar financeiro:', erro);
        mostrarMensagemSistema('Erro ao carregar financeiro. Verifique se o servidor está rodando.', 'erro');
    }
}

async function carregarHistoricoFinanceiro() {
    const periodo = calcularPeriodoHistorico();
    periodoHistoricoAtual = periodo;

    const params = new URLSearchParams();

    if (periodo.dataInicial) params.append('dataInicial', periodo.dataInicial);
    if (periodo.dataFinal) params.append('dataFinal', periodo.dataFinal);

    try {
        const resposta = await fetch(`/financeiro?${params.toString()}`);
        const dados = await resposta.json();

        ultimoHistoricoFinanceiro = dados.historico || [];

        renderizarHistorico(ultimoHistoricoFinanceiro);

        const totalHistorico = calcularTotalHistorico(ultimoHistoricoFinanceiro);

        preencherTexto('totalHistoricoFinanceiro', formatarMoeda(totalHistorico));
        preencherTexto('quantidadeLancamentos', `${ultimoHistoricoFinanceiro.length} lançamentos`);

    } catch (erro) {
        console.error('Erro ao carregar histórico financeiro:', erro);
        mostrarMensagemSistema('Erro ao carregar histórico financeiro. Verifique se o servidor está rodando.', 'erro');
    }
}

function renderizarResumo(dados) {
    const tabela = document.getElementById('tabelaResumoFinanceiro');

    tabela.innerHTML = `
        <tr>
            <td>Vendas recebidas</td>
            <td>${formatarMoeda(dados.vendasRecebidas)}</td>
        </tr>
        <tr>
            <td>Recebimentos A Prazo</td>
            <td>${formatarMoeda(dados.recebimentosFiados)}</td>
        </tr>
        <tr>
            <td>Recebimentos de entregas</td>
            <td>${formatarMoeda(dados.recebimentosEntregas || 0)}</td>
        </tr>
        <tr class="linha-resumo-total-financeiro">
            <td>Total recebido</td>
            <td>${formatarMoeda(dados.totalRecebido)}</td>
        </tr>
        <tr>
            <td>Abatimento de dívida</td>
            <td>${formatarMoeda(dados.abatimentosDivida)}</td>
        </tr>
        <tr>
            <td>A Prazo gerado</td>
            <td>${formatarMoeda(dados.fiadosGerados)}</td>
        </tr>
    `;
}

function montarAcoesHistorico(item) {
    const referenciaId = item.referencia_id || '';
    const tabelaOrigem = String(item.tabela_origem || '');

    if (tabelaOrigem !== 'vendas' || !referenciaId) {
        return '<span style="color:#8892b0;font-size:12px;">-</span>';
    }

    let botoes = '';

    if (Number(item.pode_reimprimir || 0) === 1) {
        botoes += `
            <button
                onclick="reimprimirComprovanteFinanceiro(${referenciaId})"
                title="Reimprimir comprovante"
                class="botao-reimprimir-financeiro"
            >
                Reimprimir
            </button>
        `;
    }

    if (Number(item.pode_cancelar || 0) === 1) {
        botoes += `
            <button
                onclick="cancelarVendaFinanceiro(${referenciaId})"
                title="Cancelar venda"
                class="botao-cancelar-financeiro"
            >
                Cancelar
            </button>
        `;
    }

    return `
        <div class="acoes-financeiro">
            ${botoes || '<span style="color:#8892b0;font-size:12px;">-</span>'}
        </div>
    `;
}

function renderizarHistorico(lista) {
    const tabela = document.getElementById('tabelaHistoricoFinanceiro');
    tabela.innerHTML = '';

    if (!lista || lista.length === 0) {
        tabela.innerHTML = `
            <tr>
                <td colspan="7">Nenhum lançamento financeiro encontrado.</td>
            </tr>
        `;
        return;
    }

    lista.forEach(item => {
        tabela.innerHTML += `
            <tr class="linha-historico-financeiro">
                <td>${formatarDataHora(item.data, item.hora)}</td>
                <td>${escaparHtml(formatarOrigemFinanceira(item))}</td>
                <td>
                    <span class="tag-financeiro ${classeTipoFinanceiro(item.tipo)}">
                        ${escaparHtml(formatarTipo(item.tipo))}
                    </span>
                </td>
                <td>${escaparHtml(item.cliente || '-')}</td>
                <td class="${classeValorFinanceiro(item)}">${formatarMoeda(item.valor)}</td>
                <td>${escaparHtml(item.observacao || '-')}</td>
                <td>${montarAcoesHistorico(item)}</td>
            </tr>
        `;
    });
}

function renderizarGrafico(formas) {
    const ctx = document.getElementById('graficoFinanceiro');

    if (!ctx) return;

    if (graficoFinanceiro) {
        graficoFinanceiro.destroy();
    }

    const formasFiltradas = formas.filter(item => {
        const valor = Number(item.valor || 0);
        const tipo = String(item.tipo || '').toUpperCase();

        if (valor <= 0) return false;
        if (tipo === 'FIADO') return false;
        if (tipo === 'ABATIMENTO_DIVIDA') return false;
        if (tipo === 'A_RECEBER_ENTREGA') return false;
        if (tipo === 'RETIRADA_CAIXA') return false;

        return true;
    });

    const temDados = formasFiltradas.length > 0;

    const labels = temDados
        ? formasFiltradas.map(item => formatarTipo(item.tipo))
        : ['Sem entradas no período'];

    const valores = temDados
        ? formasFiltradas.map(item => Number(item.valor || 0))
        : [1];

    const cores = temDados
        ? ['#172b41', '#213b56', '#d99032', '#7ed321', '#2f7ea3', '#8a988e']
        : ['#c8d4c7'];

    graficoFinanceiro = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data: valores,
                backgroundColor: cores,
                borderColor: '#ffffff',
                borderWidth: 4,
                hoverOffset: 6,
                spacing: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '68%',
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: '#52616f',
                        usePointStyle: true,
                        pointStyle: 'circle',
                        padding: 14,
                        font: {
                            size: 12,
                            weight: '700'
                        }
                    }
                },
                tooltip: {
                    backgroundColor: '#172431',
                    titleColor: '#ffffff',
                    bodyColor: '#eef7ef',
                    padding: 12,
                    cornerRadius: 10,
                    displayColors: true,
                    callbacks: {
                        label: function(context) {
                            if (!temDados) {
                                return 'Nenhuma entrada encontrada';
                            }

                            const label = context.label || '';
                            const valor = context.raw || 0;

                            return `${label}: ${formatarMoeda(valor)}`;
                        }
                    }
                }
            }
        }
    });
}

async function cancelarVendaFinanceiro(vendaId) {
    if (!vendaId) return;

    const confirmar = await mostrarConfirmacaoSistema({
        titulo: 'Cancelar venda?',
        mensagem: 'Ao cancelar, o sistema vai devolver os produtos ao estoque, remover o valor dos totais financeiros e cancelar o lançamento A Prazo vinculado, se existir.',
        textoConfirmar: 'Cancelar venda',
        textoCancelar: 'Voltar',
        tipo: 'info'
    });

    if (!confirmar) return;

    const motivo = await mostrarPromptSistema({
        titulo: 'Motivo do cancelamento',
        mensagem: 'Informe o motivo para manter o histórico financeiro claro.',
        rotulo: 'Motivo',
        valorInicial: 'Venda lançada incorretamente',
        textoConfirmar: 'Confirmar cancelamento',
        textoCancelar: 'Voltar',
        tipo: 'info'
    });

    if (motivo === null) return;

    try {
        const resposta = await fetch(`/vendas/${vendaId}/cancelar`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                motivo: motivo || 'Venda cancelada pelo usuário'
            })
        });

        const dados = await resposta.json();

        if (!resposta.ok || !dados.sucesso) {
            mostrarMensagemSistema(dados.erro || 'Erro ao cancelar venda.', 'erro');
            return;
        }

        mostrarMensagemSistema('Venda cancelada com sucesso.', 'sucesso');

        await carregarFinanceiro();
        await carregarHistoricoFinanceiro();

    } catch (erro) {
        console.error('Erro ao cancelar venda:', erro);
        mostrarMensagemSistema('Erro ao cancelar venda. Verifique se o servidor está rodando.', 'erro');
    }
}

async function carregarClientesParaComprovante() {
    if (clientesComprovanteCache) {
        return clientesComprovanteCache;
    }

    try {
        const resposta = await fetch('/clientes');
        clientesComprovanteCache = await resposta.json();
    } catch (erro) {
        clientesComprovanteCache = [];
    }

    return clientesComprovanteCache;
}

async function buscarClienteParaComprovante(nome) {
    const nomeCliente = String(nome || '').trim().toLowerCase();

    if (!nomeCliente) {
        return null;
    }

    const clientes = await carregarClientesParaComprovante();

    return clientes.find(cliente =>
        String(cliente.nome || '').trim().toLowerCase() === nomeCliente
    ) || null;
}

async function reimprimirComprovanteFinanceiro(vendaId) {
    if (!vendaId) return;

    const janelaComprovante = window.open('', '_blank');

    if (!janelaComprovante) {
        mostrarMensagemSistema('O navegador bloqueou a impressão. Libere pop-ups para este sistema.', 'aviso');
        return;
    }

    janelaComprovante.document.write(`
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <title>Preparando comprovante</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    padding: 20px;
                    text-align: center;
                }
            </style>
        </head>
        <body>
            <h2>Preparando comprovante...</h2>
            <p>Aguarde.</p>
        </body>
        </html>
    `);
    janelaComprovante.document.close();

    try {
        const resposta = await fetch(`/vendas/${vendaId}/comprovante`);
        const dados = await resposta.json();

        if (!resposta.ok || dados.erro) {
            janelaComprovante.close();
            mostrarMensagemSistema(dados.erro || 'Erro ao buscar comprovante.', 'erro');
            return;
        }

        const venda = dados.venda;
        const itens = dados.itens || [];
        const entrega = dados.entrega || null;
        const cliente = await buscarClienteParaComprovante(venda.cliente_nome);

        const subtotalItens = itens.reduce((soma, item) => {
            return soma + Number(item.valor_total || 0);
        }, 0);

        const vendaComprovante = {
            venda_id: venda.id,
            data: formatarData(venda.data),
            hora: formatarHoraCompleta(venda.hora),
            forma_pagamento: venda.forma_pagamento,
            cliente_nome: venda.cliente_nome || '',
            cliente_telefone: entrega ? entrega.telefone || '' : cliente ? cliente.telefone || '' : '',
            cliente_cidade: entrega ? entrega.bairro_cidade || '' : cliente ? cliente.cidade || '' : '',
            observacao: venda.observacao || '',
            entrega: entrega ? {
                tem_entrega: true,
                cliente_nome: entrega.cliente_nome || '',
                telefone: entrega.telefone || '',
                endereco: entrega.endereco || '',
                bairro_cidade: entrega.bairro_cidade || '',
                observacao: entrega.observacao || '',
                status_pagamento: entrega.status_pagamento || ''
            } : null,
            itens: itens.map(item => ({
                nome: item.produto_nome || '',
                quantidade: Number(item.quantidade || 0),
                unidade_medida: normalizarUnidadeMedidaFinanceiro(item.unidade_medida),
                preco_original: Number(item.valor_original_unitario || item.valor_unitario || 0),
                preco: Number(item.valor_unitario || 0),
                total: Number(item.valor_total || 0)
            })),
            subtotal: Number(venda.subtotal || subtotalItens || venda.total || 0),
            desconto: Number(venda.desconto || 0),
            total: Number(venda.total || 0),
            valor_recebido: Number(venda.valor_recebido || 0),
            troco: Number(venda.troco || 0)
        };

        janelaComprovante.document.open();
        janelaComprovante.document.write(montarHtmlComprovanteVenda(vendaComprovante));
        janelaComprovante.document.close();

    } catch (erro) {
        janelaComprovante.close();
        console.error('Erro ao reimprimir comprovante:', erro);
        mostrarMensagemSistema('Erro ao reimprimir comprovante. Verifique se o servidor está rodando.', 'erro');
    }
}

function montarHtmlComprovanteVenda(venda) {
    let linhasItens = '';

    venda.itens.forEach(item => {
        const precoOriginal = Number(item.preco_original || item.preco || 0);
        const precoVendido = Number(item.preco || 0);
        const temDescontoItem = precoVendido < precoOriginal;
        const unidade = normalizarUnidadeMedidaFinanceiro(item.unidade_medida);

        linhasItens += `
            <div class="item">
                <div class="item-nome">${escaparHtml(item.nome)}</div>

                ${temDescontoItem ? `
                    <div class="item-linha item-desconto">
                        <span>Preço cadastrado: ${formatarMoeda(precoOriginal)}</span>
                        <strong></strong>
                    </div>
                ` : ''}

                <div class="item-linha">
                    <span>${formatarQuantidadeComUnidadeFinanceiro(item.quantidade, unidade)} x ${formatarMoeda(precoVendido)}/${unidade}</span>
                    <strong>${formatarMoeda(item.total)}</strong>
                </div>
            </div>
        `;
    });

    const mostrarCliente =
        venda.forma_pagamento === 'FIADO' ||
        venda.forma_pagamento === 'ABATIMENTO_DIVIDA' ||
        venda.forma_pagamento === 'A_RECEBER_ENTREGA';

    const dadosCliente = mostrarCliente
        ? `
            <div class="linha"></div>
            <div><strong>Cliente:</strong> ${escaparHtml(venda.cliente_nome || '-')}</div>
            <div><strong>Telefone:</strong> ${escaparHtml(venda.cliente_telefone || '-')}</div>
            <div><strong>Cidade:</strong> ${escaparHtml(venda.cliente_cidade || '-')}</div>
        `
        : '';

    const dadosAbatimento = venda.forma_pagamento === 'ABATIMENTO_DIVIDA'
        ? `
            <div class="linha"></div>
            <div><strong>Observação:</strong></div>
            <div>${escaparHtml(venda.observacao || '-')}</div>
        `
        : '';

    const dadosEntrega = venda.entrega && venda.entrega.tem_entrega
        ? `
            <div class="linha"></div>
            <div><strong>Entrega:</strong> Sim</div>
            <div><strong>Cliente:</strong> ${escaparHtml(venda.entrega.cliente_nome || '-')}</div>
            <div><strong>Telefone:</strong> ${escaparHtml(venda.entrega.telefone || '-')}</div>
            <div><strong>Endereço:</strong> ${escaparHtml(venda.entrega.endereco || '-')}</div>
            <div><strong>Bairro/Cidade:</strong> ${escaparHtml(venda.entrega.bairro_cidade || '-')}</div>
            <div><strong>Pagamento:</strong> ${formatarFormaPagamento(venda.entrega.status_pagamento || '')}</div>
            ${venda.entrega.observacao ? `<div><strong>Obs. entrega:</strong> ${escaparHtml(venda.entrega.observacao)}</div>` : ''}
        `
        : '';

    const dadosDinheiro = venda.forma_pagamento === 'DINHEIRO' && Number(venda.valor_recebido || 0) > 0
        ? `
            <div class="linha"></div>
            <div class="total-linha">
                <span>Recebido</span>
                <strong>${formatarMoeda(venda.valor_recebido)}</strong>
            </div>
            <div class="total-linha">
                <span>Troco</span>
                <strong>${formatarMoeda(venda.troco)}</strong>
            </div>
        `
        : '';

    const avisoReceberEntrega = venda.forma_pagamento === 'A_RECEBER_ENTREGA'
        ? `
            <div class="linha"></div>
            <div><strong>Valor a receber na entrega:</strong></div>
            <div class="total-linha total-final">
                <span>A RECEBER</span>
                <strong>${formatarMoeda(venda.total)}</strong>
            </div>
        `
        : '';

    return `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <title>Comprovante de Venda - VALE AGRO</title>
            <style>
                @page {
                    size: 80mm auto;
                    margin: 0;
                }

                * {
                    box-sizing: border-box;
                }

                html,
                body {
                    margin: 0;
                    padding: 0;
                    width: 72mm;
                    color: #111;
                    font-family: Arial, sans-serif;
                    font-size: 11px;
                }

                body {
                    padding: 4mm 3mm 2mm 3mm;
                    overflow: hidden;
                }

                h1 {
                    text-align: center;
                    font-size: 17px;
                    margin: 0 0 3px;
                }

                h2 {
                    text-align: center;
                    font-size: 12px;
                    margin: 0 0 8px;
                    font-weight: normal;
                }

                .centro {
                    text-align: center;
                    line-height: 1.35;
                }

                .linha {
                    border-top: 1px dashed #111;
                    margin: 8px 0;
                }

                .item {
                    margin-bottom: 7px;
                    page-break-inside: avoid;
                }

                .item-nome {
                    font-weight: bold;
                    max-width: 100%;
                    overflow-wrap: break-word;
                }

                .item-linha {
                    display: flex;
                    justify-content: space-between;
                    gap: 8px;
                    width: 100%;
                    font-size: 10.5px;
                }

                .item-linha span {
                    max-width: 42mm;
                    white-space: nowrap;
                }

                .item-linha strong {
                    min-width: 20mm;
                    text-align: right;
                    white-space: nowrap;
                }

                .item-desconto {
                    font-size: 9.5px;
                }

                .total-linha {
                    display: flex;
                    justify-content: space-between;
                    gap: 8px;
                    margin: 4px 0;
                    font-size: 12px;
                }

                .total-linha strong {
                    min-width: 24mm;
                    text-align: right;
                    white-space: nowrap;
                }

                .total-final {
                    font-size: 15px;
                    font-weight: bold;
                }

                .rodape {
                    text-align: center;
                    margin-top: 10px;
                    font-size: 10px;
                    line-height: 1.35;
                }

                @media print {
                    html,
                    body {
                        width: 72mm;
                        margin: 0;
                        padding: 0;
                    }

                    body {
                        padding: 4mm 3mm 2mm 3mm;
                    }
                }
            </style>
        </head>
        <body>
            <h1>VALE AGRO</h1>
            <h2>COMPROVANTE DE VENDA</h2>

            <div class="centro">
                Venda Nº ${venda.venda_id || '-'}<br>
                ${venda.data} - ${venda.hora}<br>
                ${formatarFormaPagamento(venda.forma_pagamento)}
            </div>

            ${dadosCliente}
            ${dadosAbatimento}
            ${dadosEntrega}

            <div class="linha"></div>

            ${linhasItens}

            <div class="linha"></div>

            <div class="total-linha">
                <span>Subtotal</span>
                <strong>${formatarMoeda(venda.subtotal || venda.total)}</strong>
            </div>

            ${Number(venda.desconto || 0) > 0 ? `
                <div class="total-linha">
                    <span>Desconto</span>
                    <strong>- ${formatarMoeda(venda.desconto)}</strong>
                </div>
            ` : ''}

            <div class="total-linha total-final">
                <span>TOTAL</span>
                <strong>${formatarMoeda(venda.total)}</strong>
            </div>

            ${dadosDinheiro}
            ${avisoReceberEntrega}

            <div class="linha"></div>

            <div class="rodape">
                Documento sem valor fiscal<br>
                VALE AGRO agradece a preferência
            </div>

            <script>
                window.addEventListener('load', function() {
                    setTimeout(function() {
                        window.print();

                        setTimeout(function() {
                            window.close();
                        }, 800);
                    }, 300);
                });
            <\/script>
        </body>
        </html>
    `;
}

function gerarPDFHistoricoFinanceiro() {
    const periodo = periodoHistoricoAtual;

    const janela = window.open('', '_blank');

    if (!janela) {
        mostrarMensagemSistema('O navegador bloqueou a abertura do PDF. Libere pop-ups para este sistema.', 'aviso');
        return;
    }

    let linhas = '';

    const totalHistorico = calcularTotalHistorico(ultimoHistoricoFinanceiro);

    if (!ultimoHistoricoFinanceiro || ultimoHistoricoFinanceiro.length === 0) {
        linhas = `
            <tr>
                <td colspan="6">Nenhum lançamento financeiro encontrado.</td>
            </tr>
        `;
    } else {
        ultimoHistoricoFinanceiro.forEach(item => {
            linhas += `
                <tr>
                    <td>${formatarDataHora(item.data, item.hora)}</td>
                    <td>${escaparHtml(formatarOrigemFinanceira(item))}</td>
                    <td>${escaparHtml(formatarTipo(item.tipo))}</td>
                    <td>${escaparHtml(item.cliente || '-')}</td>
                    <td>${formatarMoeda(item.valor)}</td>
                    <td>${escaparHtml(item.observacao || '-')}</td>
                </tr>
            `;
        });
    }

    janela.document.write(`
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <title>Histórico Financeiro - VALE AGRO</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    padding: 30px;
                    color: #111;
                }

                h1 {
                    margin-bottom: 5px;
                }

                p {
                    margin-top: 0;
                    margin-bottom: 20px;
                }

                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 20px;
                }

                th, td {
                    border: 1px solid #ccc;
                    padding: 8px;
                    text-align: left;
                    font-size: 13px;
                    vertical-align: top;
                }

                th {
                    background: #f0f0f0;
                }

                small {
                    color: #555;
                    font-size: 11px;
                }
            </style>
        </head>
        <body>
            <h1>VALE AGRO</h1>
            <p>Histórico Financeiro</p>
            <p>Período: ${formatarData(periodo.dataInicial)} até ${formatarData(periodo.dataFinal)}</p>

            <table>
                <thead>
                    <tr>
                        <th>Data/Hora</th>
                        <th>Origem</th>
                        <th>Tipo</th>
                        <th>Cliente</th>
                        <th>Valor</th>
                        <th>Observação</th>
                    </tr>
                </thead>
                <tbody>
                    ${linhas}
                </tbody>
            </table>

            <h2 style="margin-top:30px;">
                Total do Período:
                ${formatarMoeda(totalHistorico)}
            </h2>

            <p>
                Quantidade de lançamentos:
                ${ultimoHistoricoFinanceiro.length}
            </p>

            <script>
                window.print();
            <\/script>
        </body>
        </html>
    `);

    janela.document.close();
}

preencherAnos('filtroAno');
preencherAnos('historicoAno');

document.getElementById('filtroMes').value = String(new Date().getMonth() + 1).padStart(2, '0');
document.getElementById('historicoMes').value = String(new Date().getMonth() + 1).padStart(2, '0');

verificarFiltrosFinanceiro();
verificarFiltrosHistorico();

carregarFinanceiro();
carregarHistoricoFinanceiro();
