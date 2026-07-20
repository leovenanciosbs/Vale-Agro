let clienteSelecionado = '';
let ultimoResumoCliente = null;
let ultimoHistoricoCliente = [];
let ultimoComprovantePagamento = null;
let ultimoComprovantePagamentoItens = null;

const DIAS_PRAZO = 30;
const CHAVE_PAGAMENTO_A_PRAZO = 'pagamentoAPrazoSelecionado';
const CHAVE_MENSAGEM_FIADO_DETALHE = 'mensagemFiadoDetalhe';

function converterNumero(valor) {
    if (!valor) return 0;

    let texto = String(valor)
        .replace(/[R$\s]/g, '')
        .replace(/\./g, '')
        .replace(',', '.');

    return Number(texto) || 0;
}

function formatarMoeda(valor) {
    return Number(valor || 0).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
}

function formatarQuantidade(valor) {
    const numero = Number(valor || 0);

    if (!numero) {
        return '-';
    }

    return numero.toLocaleString('pt-BR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 3
    });
}

function normalizarUnidadeMedidaFiado(valor) {
    const unidade = String(valor || 'UN').trim().toUpperCase();
    const unidadesValidas = ['UN', 'KG', 'G', 'L', 'ML', 'M'];

    return unidadesValidas.includes(unidade) ? unidade : 'UN';
}

function formatarQuantidadeComUnidadeFiado(valor, unidade) {
    const quantidade = formatarQuantidade(valor);

    return quantidade === '-' ? '-' : `${quantidade} ${normalizarUnidadeMedidaFiado(unidade)}`;
}

function formatarPrecoComUnidadeFiado(valor, unidade) {
    return `${formatarMoeda(valor)} / ${normalizarUnidadeMedidaFiado(unidade)}`;
}

function escaparHtml(valor) {
    return String(valor || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
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

function formatarDataHora(data, hora) {
    const dataFormatada = formatarData(data);
    const horaFormatada = formatarHora(hora);

    if (!horaFormatada) {
        return dataFormatada;
    }

    return `${dataFormatada}<br><small>${horaFormatada}</small>`;
}

function formatarFormaPagamento(forma) {
    const nomes = {
        DINHEIRO: 'Dinheiro',
        PIX: 'PIX',
        CARTAO: 'Cartão',
        CARTAO_CREDITO: 'Cartão de Crédito',
        CARTAO_DEBITO: 'Cartão de Débito'
    };

    return nomes[forma] || forma || '-';
}

function compararPorDataHoraId(a, b) {
    const dataA = String(a.data || '');
    const dataB = String(b.data || '');

    if (dataA !== dataB) {
        return dataA.localeCompare(dataB);
    }

    const horaA = String(a.hora || '');
    const horaB = String(b.hora || '');

    if (horaA !== horaB) {
        return horaA.localeCompare(horaB);
    }

    return Number(a.id || 0) - Number(b.id || 0);
}

function compararPorDataHoraIdDecrescente(a, b) {
    return compararPorDataHoraId(b, a);
}

function ordenarRegistrosRecentesPrimeiro(lista) {
    return [...(lista || [])].sort(compararPorDataHoraIdDecrescente);
}

function obterDataCompraFiado(item) {
    return String(item?.data || '').slice(0, 10) || 'SEM_DATA';
}

function agruparItensPorDataFiado(itens) {
    const grupos = new Map();

    [...(itens || [])].sort(compararPorDataHoraId).forEach(item => {
        const data = obterDataCompraFiado(item);

        if (!grupos.has(data)) {
            grupos.set(data, []);
        }

        grupos.get(data).push(item);
    });

    return Array.from(grupos.entries()).map(([data, itensGrupo]) => {
        const totalAberto = itensGrupo.reduce((soma, item) => {
            return soma + Number(item.saldo_aberto || 0);
        }, 0);

        return {
            data,
            itens: itensGrupo,
            quantidade: itensGrupo.length,
            totalAberto
        };
    });
}

function montarLinhaGrupoDataFiado(grupo, colspan) {
    const textoItens = grupo.quantidade === 1 ? '1 item em aberto' : `${grupo.quantidade} itens em aberto`;
    const dataFormatada = grupo.data === 'SEM_DATA' ? 'Sem data' : formatarData(grupo.data);
    const titulo = grupo.data === 'SEM_DATA' ? 'Compra sem data' : `Compra de ${dataFormatada}`;

    return `
        <tr class="linha-grupo-data-fiado">
            <td colspan="${colspan}">
                <div class="grupo-data-fiado-cabecalho">
                    <strong class="grupo-data-fiado-titulo">${titulo}</strong>
                    <span class="grupo-data-fiado-resumo">${textoItens} | Total ${formatarMoeda(grupo.totalAberto)}</span>
                </div>
            </td>
        </tr>
    `;
}

function obterClienteUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('cliente') || '';
}

function voltarFiados() {
    window.location.href = 'fiados.html';
}

function mostrarMensagemRetornoFiadoDetalhe() {
    const mensagem = sessionStorage.getItem(CHAVE_MENSAGEM_FIADO_DETALHE);

    if (!mensagem) return;

    sessionStorage.removeItem(CHAVE_MENSAGEM_FIADO_DETALHE);
    mostrarMensagemSistema(mensagem, 'sucesso');
}

function calcularDiasEmAberto(dataCompra) {
    if (!dataCompra) return 0;

    const hoje = new Date();
    const data = new Date(dataCompra + 'T00:00:00');

    hoje.setHours(0, 0, 0, 0);
    data.setHours(0, 0, 0, 0);

    const dias = Math.floor((hoje - data) / (1000 * 60 * 60 * 24));

    return dias < 0 ? 0 : dias;
}

function formatarOrigemConta(item) {
    const origem = String(item.origem || '').toUpperCase();

    if (origem === 'IMPORTACAO_PAPEL') {
        return 'Importado do papel';
    }

    if (origem === 'VENDA_A_PRAZO') {
        return 'Venda a prazo';
    }

    if (origem === 'LANCAMENTO_MANUAL') {
        return 'Lançamento manual';
    }

    if (origem === 'PAGAMENTO') {
        return 'Pagamento geral';
    }

    if (origem === 'PAGAMENTO_ITENS') {
        return 'Pagamento por produtos';
    }

    if (origem === 'PAGAMENTO_VALOR') {
        return 'Recebimento avulso A Prazo';
    }

    return '';
}

function montarObservacaoComOrigem(item) {
    const observacao = String(item.observacao || '').trim();
    const origem = formatarOrigemConta(item);

    if (origem && observacao) {
        return `${escaparHtml(observacao)}<br><small>${escaparHtml(origem)}</small>`;
    }

    if (origem) {
        return `<small>${escaparHtml(origem)}</small>`;
    }

    return observacao ? escaparHtml(observacao) : '-';
}

function processarFiadosCliente(historico) {
    let totalCompras = 0;
    let totalPagamentos = 0;
    let pagamentosGeraisRestantes = 0;

    const compras = historico
        .filter(item => item.tipo === 'COMPRA')
        .sort(compararPorDataHoraId);

    const pagamentos = historico
        .filter(item => item.tipo === 'PAGAMENTO')
        .sort(compararPorDataHoraId);

    compras.forEach(compra => {
        totalCompras += Number(compra.valor_total || 0);
    });

    pagamentos.forEach(pagamento => {
        totalPagamentos += Number(pagamento.valor_total || 0);

        if (!['PAGAMENTO_ITENS', 'PAGAMENTO_VALOR'].includes(String(pagamento.origem || ''))) {
            pagamentosGeraisRestantes += Number(pagamento.valor_total || 0);
        }
    });

    const comprasProcessadas = compras.map(compra => {
        const valorTotal = Number(compra.valor_total || 0);
        const valorPagoPorItem = Number(
            compra.valor_pago_efetivo !== undefined
                ? compra.valor_pago_efetivo
                : compra.valor_pago || 0
        );
        let valorPagoCalculado = valorPagoPorItem;

        let saldoCompra = valorTotal - valorPagoPorItem;

        if (saldoCompra < 0) {
            saldoCompra = 0;
        }

        if (pagamentosGeraisRestantes > 0 && saldoCompra > 0) {
            const abatimento = Math.min(saldoCompra, pagamentosGeraisRestantes);
            saldoCompra -= abatimento;
            valorPagoCalculado += abatimento;
            pagamentosGeraisRestantes -= abatimento;
        }

        const dias = calcularDiasEmAberto(compra.data);
        const vencida = saldoCompra > 0 && dias >= DIAS_PRAZO;

        return {
            ...compra,
            valor_pago_calculado: valorPagoCalculado,
            saldo_aberto: saldoCompra,
            dias_em_aberto: dias,
            vencida
        };
    });

    const comprasAbertas = comprasProcessadas.filter(compra => compra.saldo_aberto > 0);
    const comprasVencidas = comprasAbertas.filter(compra => compra.vencida);
    const comprasNoPrazo = comprasAbertas.filter(compra => !compra.vencida);

    const saldoAtual = comprasAbertas.reduce((soma, compra) => {
        return soma + Number(compra.saldo_aberto || 0);
    }, 0);

    const valorVencido = comprasVencidas.reduce((soma, compra) => {
        return soma + Number(compra.saldo_aberto || 0);
    }, 0);

    const valorNoPrazo = comprasNoPrazo.reduce((soma, compra) => {
        return soma + Number(compra.saldo_aberto || 0);
    }, 0);

    const maiorAtraso = comprasVencidas.reduce((maior, compra) => {
        return Math.max(maior, compra.dias_em_aberto);
    }, 0);

    return {
        totalCompras,
        totalPagamentos,
        saldoAtual,
        valorVencido,
        valorNoPrazo,
        maiorAtraso,
        comprasProcessadas,
        comprasVencidas,
        comprasNoPrazo,
        pagamentos
    };
}

function obterSituacao(resumo) {
    if (resumo.valorVencido > 0) {
        return `Em atraso - ${resumo.maiorAtraso} dias`;
    }

    const comprasPerto = resumo.comprasNoPrazo.filter(compra => compra.dias_em_aberto >= 25);

    if (comprasPerto.length > 0) {
        const maior = comprasPerto.reduce((max, compra) => {
            return Math.max(max, compra.dias_em_aberto);
        }, 0);

        return `Perto do vencimento - ${maior} dias`;
    }

    if (resumo.saldoAtual > 0) {
        return 'Dentro do prazo';
    }

    return 'Quitado';
}

async function carregarDetalheCliente() {
    clienteSelecionado = decodeURIComponent(obterClienteUrl());

    if (!clienteSelecionado) {
        mostrarMensagemSistema('Cliente não informado.', 'erro');
        voltarFiados();
        return;
    }

    document.getElementById('nomeClienteFiado').textContent = clienteSelecionado;

    const resposta = await fetch(`/fiados/${encodeURIComponent(clienteSelecionado)}`);
    const historico = await resposta.json();

    ultimoHistoricoCliente = historico.sort(compararPorDataHoraId);

    const resumo = processarFiadosCliente(ultimoHistoricoCliente);
    ultimoResumoCliente = resumo;

    document.getElementById('totalComprasCliente').textContent = formatarMoeda(resumo.totalCompras);
    document.getElementById('totalRecebidoCliente').textContent = formatarMoeda(resumo.totalPagamentos);
    document.getElementById('saldoAtualCliente').textContent = formatarMoeda(resumo.saldoAtual);
    document.getElementById('valorVencidoCliente').textContent = formatarMoeda(resumo.valorVencido);
    document.getElementById('valorNoPrazoCliente').textContent = formatarMoeda(resumo.valorNoPrazo);
    document.getElementById('situacaoCliente').textContent = obterSituacao(resumo);

    document.querySelector('.card-valor-vencido-fiado')?.classList.toggle('tem-atraso', resumo.valorVencido > 0);
    document.querySelector('.card-situacao-fiado')?.classList.toggle('tem-atraso', resumo.valorVencido > 0);

    renderizarProdutosParaAbater();
    renderizarComprasNoPrazo(resumo.comprasNoPrazo);
    renderizarComprasVencidas(resumo.comprasVencidas);
    renderizarPagamentos(resumo.pagamentos);
    renderizarHistoricoCompleto(ultimoHistoricoCliente);

    prepararPagamentoPorItensFiado();
    calcularTrocoPagamentoUnificado();
    mostrarMensagemRetornoFiadoDetalhe();
}

function obterComprasAbertasParaPagamento() {
    if (!ultimoResumoCliente) return [];

    return [
        ...ultimoResumoCliente.comprasVencidas,
        ...ultimoResumoCliente.comprasNoPrazo
    ].sort(compararPorDataHoraId);
}

function renderizarProdutosParaAbater() {
    const tabela = document.getElementById('tabelaProdutosParaAbater');

    if (!tabela) return;

    const compras = obterComprasAbertasParaPagamento();

    tabela.innerHTML = '';

    if (!compras.length) {
        tabela.innerHTML = `
            <tr>
                <td colspan="8">Nenhum produto em aberto para abater.</td>
            </tr>
        `;

        atualizarSelecaoPagamentoItensFiado();
        return;
    }

    agruparItensPorDataFiado(compras).forEach(grupo => {
        tabela.innerHTML += montarLinhaGrupoDataFiado(grupo, 8);

        grupo.itens.forEach(item => {
            const valorPago = Number(item.valor_pago_calculado || item.valor_pago || 0);
            const saldoAberto = Number(item.saldo_aberto || 0);
            const classe = item.vencida ? 'status-atrasado' : item.dias_em_aberto >= 25 ? 'status-proximo' : '';

            tabela.innerHTML += `
                <tr id="linhaProdutoPagamentoFiado_${item.id}" class="${classe}">
                    <td class="coluna-pagar-fiado">
                        <input
                            type="checkbox"
                            class="checkbox-pagamento-fiado"
                            data-id="${item.id}"
                            data-saldo="${saldoAberto}"
                            data-vencida="${item.vencida ? '1' : '0'}"
                            onchange="atualizarSelecaoPagamentoItensFiado()"
                        >
                    </td>
                    <td>${formatarDataHora(item.data, item.hora)}</td>
                    <td>
                        ${escaparHtml(item.produto || '-')}
                        ${formatarOrigemConta(item) ? `<br><small>${escaparHtml(formatarOrigemConta(item))}</small>` : ''}
                    </td>
                    <td>${formatarQuantidadeComUnidadeFiado(item.quantidade, item.unidade_medida)}</td>
                    <td>${formatarMoeda(item.valor_total)}</td>
                    <td class="valor-pago-fiado">${formatarMoeda(valorPago)}</td>
                    <td class="saldo-aberto-fiado">${formatarMoeda(saldoAberto)}</td>
                    <td>${item.dias_em_aberto} dias</td>
                </tr>
            `;
        });
    });

    restaurarSelecaoPagamentoAPrazoPendente();
    atualizarSelecaoPagamentoItensFiado();
}

function obterItensSelecionadosPagamentoFiado() {
    const checkboxes = Array.from(document.querySelectorAll('.checkbox-pagamento-fiado:checked'));

    return checkboxes.map(checkbox => {
        return {
            fiado_id: Number(checkbox.dataset.id || 0),
            saldo_aberto: Number(checkbox.dataset.saldo || 0),
            vencida: checkbox.dataset.vencida === '1'
        };
    }).filter(item => item.fiado_id > 0 && item.saldo_aberto > 0);
}

function obterPagamentoAPrazoSalvo() {
    try {
        return JSON.parse(sessionStorage.getItem(CHAVE_PAGAMENTO_A_PRAZO) || 'null');
    } catch (erro) {
        return null;
    }
}

function itemPagamentoAPrazoDetalhado(item) {
    const saldoAberto = Number(item.saldo_aberto || 0);
    const valorPago = Number(item.valor_pago_calculado || item.valor_pago || 0);

    return {
        fiado_id: Number(item.id || item.fiado_id || 0),
        produto: item.produto || '',
        data: item.data || '',
        hora: item.hora || '',
        quantidade: Number(item.quantidade || 0),
        unidade_medida: normalizarUnidadeMedidaFiado(item.unidade_medida),
        valor_total: Number(item.valor_total || 0),
        valor_pago: valorPago,
        saldo_aberto: saldoAberto,
        valor_pagamento: saldoAberto,
        dias_em_aberto: Number(item.dias_em_aberto || 0),
        vencida: Boolean(item.vencida)
    };
}

function restaurarSelecaoPagamentoAPrazoPendente() {
    const pagamentoSalvo = obterPagamentoAPrazoSalvo();

    if (!pagamentoSalvo || pagamentoSalvo.origem !== 'a_prazo') return;

    const clienteSalvo = String(pagamentoSalvo.cliente_nome || pagamentoSalvo.cliente || '');

    if (clienteSalvo !== clienteSelecionado) return;

    const idsSelecionados = new Set(
        (pagamentoSalvo.itens || []).map(item => Number(item.fiado_id || item.id || 0))
    );

    document.querySelectorAll('.checkbox-pagamento-fiado').forEach(checkbox => {
        checkbox.checked = idsSelecionados.has(Number(checkbox.dataset.id || 0));
    });
}

function limparPagamentoAPrazoSalvoDoCliente() {
    const pagamentoSalvo = obterPagamentoAPrazoSalvo();

    if (!pagamentoSalvo) return;

    const clienteSalvo = String(pagamentoSalvo.cliente_nome || pagamentoSalvo.cliente || '');

    if (clienteSalvo === clienteSelecionado) {
        sessionStorage.removeItem(CHAVE_PAGAMENTO_A_PRAZO);
    }
}

function irParaPagamentoFiadoSelecionado() {
    const selecionados = obterItensSelecionadosPagamentoFiado();

    if (!selecionados.length) {
        mostrarMensagemSistema('Selecione pelo menos um produto para continuar.', 'aviso');
        return;
    }

    const comprasAbertas = obterComprasAbertasParaPagamento();
    const itens = selecionados.map(selecionado => {
        const compra = comprasAbertas.find(item => Number(item.id || 0) === Number(selecionado.fiado_id));

        return itemPagamentoAPrazoDetalhado(compra || selecionado);
    }).filter(item => item.fiado_id > 0 && item.saldo_aberto > 0);

    const totalSelecionado = itens.reduce((soma, item) => {
        return soma + Number(item.saldo_aberto || 0);
    }, 0);

    if (!itens.length || totalSelecionado <= 0) {
        mostrarMensagemSistema('Selecione pelo menos um produto para continuar.', 'aviso');
        return;
    }

    sessionStorage.setItem(CHAVE_PAGAMENTO_A_PRAZO, JSON.stringify({
        origem: 'a_prazo',
        modo: 'itens_selecionados',
        cliente: clienteSelecionado,
        cliente_nome: clienteSelecionado,
        itens,
        ids: itens.map(item => item.fiado_id),
        quantidade_itens: itens.length,
        total_selecionado: totalSelecionado,
        saldo_anterior: ultimoResumoCliente ? Number(ultimoResumoCliente.saldoAtual || 0) : totalSelecionado,
        criado_em: new Date().toISOString()
    }));

    window.location.href = `fiado-pagamento.html?cliente=${encodeURIComponent(clienteSelecionado)}`;
}

function irParaPagamentoValorFicha() {
    const saldoAtual = ultimoResumoCliente ? Number(ultimoResumoCliente.saldoAtual || 0) : 0;

    if (saldoAtual <= 0) {
        mostrarMensagemSistema('Este cliente nao possui saldo em aberto.', 'aviso');
        return;
    }

    sessionStorage.setItem(CHAVE_PAGAMENTO_A_PRAZO, JSON.stringify({
        origem: 'a_prazo',
        modo: 'valor_livre',
        cliente: clienteSelecionado,
        cliente_nome: clienteSelecionado,
        itens: [],
        ids: [],
        quantidade_itens: 0,
        total_selecionado: 0,
        saldo_total: saldoAtual,
        saldo_anterior: saldoAtual,
        criado_em: new Date().toISOString()
    }));

    window.location.href = `fiado-pagamento.html?cliente=${encodeURIComponent(clienteSelecionado)}`;
}

function atualizarSelecaoPagamentoItensFiado() {
    const selecionados = obterItensSelecionadosPagamentoFiado();

    const totalSelecionado = selecionados.reduce((soma, item) => {
        return soma + Number(item.saldo_aberto || 0);
    }, 0);

    document.querySelectorAll('.checkbox-pagamento-fiado').forEach(checkbox => {
        const linha = document.getElementById(`linhaProdutoPagamentoFiado_${checkbox.dataset.id}`);

        if (!linha) return;

        if (checkbox.checked) {
            linha.classList.add('linha-produto-selecionado-fiado');
        } else {
            linha.classList.remove('linha-produto-selecionado-fiado');
        }
    });

    const totalSelecionadoElemento = document.getElementById('totalSelecionadoPagamentoItens');
    const quantidadeElemento = document.getElementById('quantidadeItensSelecionadosPagamento');
    const campoValorUnificado = document.getElementById('valorPagamentoFiadoUnificado');
    const resumoSelecao = document.getElementById('resumoSelecaoProdutosFiado');
    const textoResumoSelecao = document.getElementById('textoResumoSelecaoPagamento');
    const textoItensSelecionados = document.getElementById('textoItensSelecionadosPagamento');
    const botaoFinalizarSelecionados = document.getElementById('botaoFinalizarPagamentoSelecionados');
    const temSelecionados = selecionados.length > 0;

    if (totalSelecionadoElemento) {
        totalSelecionadoElemento.textContent = formatarMoeda(totalSelecionado);
    }

    if (quantidadeElemento) {
        quantidadeElemento.textContent = selecionados.length;
    }

    if (resumoSelecao) {
        resumoSelecao.classList.toggle('sem-selecao', !temSelecionados);
        resumoSelecao.classList.toggle('com-selecao', temSelecionados);
    }

    if (textoResumoSelecao) {
        textoResumoSelecao.textContent = temSelecionados
            ? 'Produtos marcados:'
            : 'Nenhum produto selecionado.';
    }

    if (textoItensSelecionados) {
        textoItensSelecionados.textContent = selecionados.length === 1
            ? 'item selecionado'
            : 'itens selecionados';
    }

    if (botaoFinalizarSelecionados) {
        botaoFinalizarSelecionados.disabled = !temSelecionados;
        botaoFinalizarSelecionados.hidden = !temSelecionados;
        botaoFinalizarSelecionados.setAttribute('aria-hidden', temSelecionados ? 'false' : 'true');
    }

    if (campoValorUnificado) {
        campoValorUnificado.value = totalSelecionado > 0 ? formatarMoeda(totalSelecionado) : '';
    }

    calcularTrocoPagamentoUnificado();
}

function selecionarComprasVencidasParaPagamento() {
    document.querySelectorAll('.checkbox-pagamento-fiado').forEach(checkbox => {
        checkbox.checked = checkbox.dataset.vencida === '1';
    });

    atualizarSelecaoPagamentoItensFiado();
}

function selecionarTodasComprasAbertasParaPagamento() {
    document.querySelectorAll('.checkbox-pagamento-fiado').forEach(checkbox => {
        checkbox.checked = true;
    });

    atualizarSelecaoPagamentoItensFiado();
}

function limparSelecaoPagamentoItens() {
    document.querySelectorAll('.checkbox-pagamento-fiado').forEach(checkbox => {
        checkbox.checked = false;
    });

    limparPagamentoAPrazoSalvoDoCliente();

    atualizarSelecaoPagamentoItensFiado();
}

function prepararPagamentoPorItensFiado() {
    const areaProdutos = document.getElementById('areaProdutosPagamentoFiado');

    if (areaProdutos) areaProdutos.style.display = 'block';

    atualizarSelecaoPagamentoItensFiado();
    calcularTrocoPagamentoUnificado();
}

function alternarTipoPagamentoFiado() {
    prepararPagamentoPorItensFiado();
}

function atualizarCamposPorFormaPagamentoFiado() {
    const forma = document.getElementById('formaPagamentoFiadoUnificado')?.value || 'DINHEIRO';
    const campoValor = document.getElementById('valorPagamentoFiadoUnificado');
    const campoRecebido = document.getElementById('valorRecebidoFiadoUnificado');
    const campoTroco = document.getElementById('trocoPagamentoFiadoUnificado');

    if (!campoValor || !campoRecebido || !campoTroco) return false;

    const valorPagamento = converterNumero(campoValor.value);
    const ehDinheiro = forma === 'DINHEIRO';
    const grupoRecebido = campoRecebido.closest('.campo-pagamento-fiado');
    const grupoTroco = campoTroco.closest('.campo-pagamento-fiado');

    grupoRecebido?.classList.toggle('campo-pagamento-oculto', !ehDinheiro);
    grupoTroco?.classList.toggle('campo-pagamento-oculto', !ehDinheiro);

    if (!ehDinheiro) {
        campoRecebido.value = valorPagamento > 0 ? formatarMoeda(valorPagamento) : '';
        campoRecebido.readOnly = true;
        campoTroco.value = formatarMoeda(0);
        return false;
    }

    campoRecebido.readOnly = false;
    return true;
}

function calcularTrocoPagamentoUnificado() {
    const campoValor = document.getElementById('valorPagamentoFiadoUnificado');
    const campoRecebido = document.getElementById('valorRecebidoFiadoUnificado');
    const campoTroco = document.getElementById('trocoPagamentoFiadoUnificado');

    if (!campoValor || !campoRecebido || !campoTroco) return;

    const ehDinheiro = atualizarCamposPorFormaPagamentoFiado();

    if (!ehDinheiro) return;

    const valorPagamento = converterNumero(campoValor.value);

    const valorRecebido = converterNumero(campoRecebido.value);

    if (valorPagamento <= 0 || valorRecebido <= 0) {
        campoTroco.value = formatarMoeda(0);
        return;
    }

    const troco = valorRecebido - valorPagamento;

    campoTroco.value = troco > 0 ? formatarMoeda(troco) : formatarMoeda(0);
}

async function confirmarPagamentoFiadoUnificado() {
    await registrarPagamentoItensFiadoUnificado();
}

async function registrarPagamentoItensFiadoUnificado() {
    const selecionados = obterItensSelecionadosPagamentoFiado();

    if (!selecionados.length) {
        mostrarMensagemSistema('Selecione pelo menos um produto para receber o pagamento.', 'aviso');
        return;
    }

    const totalSelecionado = selecionados.reduce((soma, item) => {
        return soma + Number(item.saldo_aberto || 0);
    }, 0);

    const formaPagamento = document.getElementById('formaPagamentoFiadoUnificado').value;
    const valorPagamento = converterNumero(document.getElementById('valorPagamentoFiadoUnificado').value);
    let valorRecebido = converterNumero(document.getElementById('valorRecebidoFiadoUnificado').value);
    const observacao = document.getElementById('observacaoPagamentoFiadoUnificado').value.trim();

    if (valorPagamento <= 0) {
        mostrarMensagemSistema('Informe o valor do pagamento.', 'aviso');
        return;
    }

    if (valorPagamento > totalSelecionado) {
        mostrarMensagemSistema(`O valor do pagamento não pode ser maior que o total selecionado. Total selecionado: ${formatarMoeda(totalSelecionado)}`, 'aviso');
        return;
    }

    if (formaPagamento !== 'DINHEIRO') {
        valorRecebido = valorPagamento;
    }

    if (formaPagamento === 'DINHEIRO' && valorRecebido <= 0) {
        mostrarMensagemSistema('Informe o valor recebido do cliente.', 'aviso');
        return;
    }

    if (valorRecebido < valorPagamento) {
        mostrarMensagemSistema('O valor recebido não pode ser menor que o valor do pagamento.', 'aviso');
        return;
    }

    const troco = formaPagamento === 'DINHEIRO'
        ? Math.max(valorRecebido - valorPagamento, 0)
        : 0;

    const saldoAnterior = ultimoResumoCliente
        ? Number(ultimoResumoCliente.saldoAtual || 0)
        : 0;

    const confirmar = await mostrarConfirmacaoSistema({
        titulo: 'Confirmar pagamento dos produtos?',
        mensagem: `Itens selecionados: ${selecionados.length}. Valor: ${formatarMoeda(valorPagamento)}. Forma: ${formatarFormaPagamento(formaPagamento)}.`,
        textoConfirmar: 'Confirmar pagamento',
        textoCancelar: 'Cancelar',
        tipo: 'aviso'
    });

    if (!confirmar) return;

    try {
        const resposta = await fetch('/fiados/pagamento-itens', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                cliente_nome: clienteSelecionado,
                forma_pagamento: formaPagamento,
                valor_pago: valorPagamento,
                valor_recebido: valorRecebido,
                troco,
                observacao,
                itens: selecionados.map(item => ({
                    fiado_id: item.fiado_id
                }))
            })
        });

        const dados = await resposta.json();

        if (!resposta.ok || !dados.sucesso) {
            mostrarMensagemSistema(dados.erro || 'Erro ao registrar pagamento dos produtos.', 'erro');
            return;
        }

        ultimoComprovantePagamentoItens = {
            cliente: clienteSelecionado,
            data: new Date().toLocaleDateString('pt-BR'),
            hora: new Date().toLocaleTimeString('pt-BR'),
            forma_pagamento: formaPagamento,
            total_selecionado: dados.total_selecionado,
            valor_pago: dados.valor_pago,
            valor_recebido: dados.valor_recebido,
            troco: dados.troco,
            saldo_anterior: saldoAnterior,
            saldo_atual: Math.max(saldoAnterior - Number(dados.valor_pago || 0), 0),
            observacao,
            itens: dados.itens || []
        };

        ultimoComprovantePagamento = null;

        mostrarMensagemSistema('Pagamento registrado com sucesso.', 'sucesso');

        limparCamposPagamentoUnificado();

        await carregarDetalheCliente();

        setTimeout(() => {
            imprimirUltimoComprovantePagamentoItensFiado();
        }, 400);

    } catch (erro) {
        console.error('Erro ao registrar pagamento dos produtos:', erro);
        mostrarMensagemSistema('Erro ao registrar pagamento dos produtos. Verifique se o servidor está rodando.', 'erro');
    }
}

async function registrarPagamentoGeralFiadoUnificado() {
    const valor = converterNumero(document.getElementById('valorPagamentoFiadoUnificado').value);
    const formaPagamento = document.getElementById('formaPagamentoFiadoUnificado').value;
    let valorRecebido = converterNumero(document.getElementById('valorRecebidoFiadoUnificado').value);
    const observacao = document.getElementById('observacaoPagamentoFiadoUnificado').value.trim();

    if (valor <= 0) {
        mostrarMensagemSistema('Informe o valor do pagamento corretamente.', 'aviso');
        return;
    }

    const saldoAnterior = ultimoResumoCliente
        ? Number(ultimoResumoCliente.saldoAtual || 0)
        : 0;

    if (saldoAnterior <= 0) {
        mostrarMensagemSistema('Este cliente não possui saldo em aberto.', 'aviso');
        return;
    }

    if (valor > saldoAnterior) {
        mostrarMensagemSistema(`O valor do pagamento não pode ser maior que o saldo atual do cliente. Saldo atual: ${formatarMoeda(saldoAnterior)}`, 'aviso');
        return;
    }

    if (formaPagamento !== 'DINHEIRO') {
        valorRecebido = valor;
    }

    if (formaPagamento === 'DINHEIRO' && valorRecebido <= 0) {
        mostrarMensagemSistema('Informe o valor recebido do cliente.', 'aviso');
        return;
    }

    if (valorRecebido < valor) {
        mostrarMensagemSistema('O valor recebido não pode ser menor que o valor do pagamento.', 'aviso');
        return;
    }

    const troco = formaPagamento === 'DINHEIRO'
        ? Math.max(valorRecebido - valor, 0)
        : 0;

    const confirmar = await mostrarConfirmacaoSistema({
        titulo: 'Confirmar pagamento geral?',
        mensagem: `Valor: ${formatarMoeda(valor)}. Forma: ${formatarFormaPagamento(formaPagamento)}.`,
        textoConfirmar: 'Confirmar pagamento',
        textoCancelar: 'Cancelar',
        tipo: 'aviso'
    });

    if (!confirmar) return;

    try {
        const resposta = await fetch('/fiados/pagamento', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                cliente_nome: clienteSelecionado,
                valor,
                forma_pagamento: formaPagamento,
                valor_recebido: valorRecebido,
                troco,
                observacao
            })
        });

        const dados = await resposta.json();

        if (!resposta.ok || !dados.sucesso) {
            mostrarMensagemSistema(dados.erro || 'Erro ao registrar pagamento geral.', 'erro');
            return;
        }

        const saldoAtual = Math.max(saldoAnterior - valor, 0);

        ultimoComprovantePagamento = {
            cliente: clienteSelecionado,
            data: new Date().toLocaleDateString('pt-BR'),
            hora: new Date().toLocaleTimeString('pt-BR'),
            forma_pagamento: formaPagamento,
            saldo_anterior: saldoAnterior,
            valor_recebido: valor,
            valor_entregue: valorRecebido,
            troco,
            saldo_atual: saldoAtual,
            observacao
        };

        ultimoComprovantePagamentoItens = null;

        mostrarMensagemSistema('Pagamento geral registrado com sucesso.', 'sucesso');

        limparCamposPagamentoUnificado();

        await carregarDetalheCliente();

        setTimeout(() => {
            imprimirComprovantePagamentoFiado();
        }, 400);

    } catch (erro) {
        console.error('Erro ao registrar pagamento geral:', erro);
        mostrarMensagemSistema('Erro ao registrar pagamento geral. Verifique se o servidor está rodando.', 'erro');
    }
}

function limparCamposPagamentoUnificado() {
    const campoValor = document.getElementById('valorPagamentoFiadoUnificado');
    const campoRecebido = document.getElementById('valorRecebidoFiadoUnificado');
    const campoTroco = document.getElementById('trocoPagamentoFiadoUnificado');
    const campoObs = document.getElementById('observacaoPagamentoFiadoUnificado');

    if (campoValor) campoValor.value = '';
    if (campoRecebido) campoRecebido.value = '';
    if (campoTroco) campoTroco.value = formatarMoeda(0);
    if (campoObs) campoObs.value = '';

    limparSelecaoPagamentoItens();
    calcularTrocoPagamentoUnificado();
}

function reimprimirComprovanteFiadoUnificado() {
    if (ultimoComprovantePagamentoItens) {
        imprimirUltimoComprovantePagamentoItensFiado();
        return;
    }

    if (ultimoComprovantePagamento) {
        imprimirComprovantePagamentoFiado();
        return;
    }

    mostrarMensagemSistema('Nenhum pagamento recente para reimprimir.', 'aviso');
}

function renderizarComprasVencidas(lista) {
    const tabela = document.getElementById('tabelaComprasVencidas');

    if (!tabela) return;

    tabela.innerHTML = '';

    if (!lista || lista.length === 0) {
        tabela.innerHTML = `
            <tr>
                <td colspan="7">Nenhuma compra vencida.</td>
            </tr>
        `;
        return;
    }

    agruparItensPorDataFiado(lista).forEach(grupo => {
        tabela.innerHTML += montarLinhaGrupoDataFiado(grupo, 7);

        grupo.itens.forEach(item => {
            const valorPago = Number(item.valor_pago_calculado || item.valor_pago || 0);

            tabela.innerHTML += `
                <tr class="status-atrasado">
                    <td>${formatarDataHora(item.data, item.hora)}</td>
                    <td>
                        ${escaparHtml(item.produto || '-')}
                        ${formatarOrigemConta(item) ? `<br><small>${escaparHtml(formatarOrigemConta(item))}</small>` : ''}
                    </td>
                    <td>${formatarQuantidadeComUnidadeFiado(item.quantidade, item.unidade_medida)}</td>
                    <td>${formatarMoeda(item.valor_total)}</td>
                    <td class="valor-pago-fiado">${formatarMoeda(valorPago)}</td>
                    <td class="saldo-aberto-fiado">${formatarMoeda(item.saldo_aberto)}</td>
                    <td>${item.dias_em_aberto} dias</td>
                </tr>
            `;
        });
    });
}

function renderizarComprasNoPrazo(lista) {
    const tabela = document.getElementById('tabelaComprasNoPrazo');

    if (!tabela) return;

    tabela.innerHTML = '';

    if (!lista || lista.length === 0) {
        tabela.innerHTML = `
            <tr>
                <td colspan="7">Nenhuma compra no prazo.</td>
            </tr>
        `;
        return;
    }

    agruparItensPorDataFiado(lista).forEach(grupo => {
        tabela.innerHTML += montarLinhaGrupoDataFiado(grupo, 7);

        grupo.itens.forEach(item => {
            const classe = item.dias_em_aberto >= 25 ? 'status-proximo' : '';
            const valorPago = Number(item.valor_pago_calculado || item.valor_pago || 0);

            tabela.innerHTML += `
                <tr class="${classe}">
                    <td>${formatarDataHora(item.data, item.hora)}</td>
                    <td>
                        ${escaparHtml(item.produto || '-')}
                        ${formatarOrigemConta(item) ? `<br><small>${escaparHtml(formatarOrigemConta(item))}</small>` : ''}
                    </td>
                    <td>${formatarQuantidadeComUnidadeFiado(item.quantidade, item.unidade_medida)}</td>
                    <td>${formatarMoeda(item.valor_total)}</td>
                    <td class="valor-pago-fiado">${formatarMoeda(valorPago)}</td>
                    <td class="saldo-aberto-fiado">${formatarMoeda(item.saldo_aberto)}</td>
                    <td>${item.dias_em_aberto} dias</td>
                </tr>
            `;
        });
    });
}

function renderizarPagamentos(lista) {
    const tabela = document.getElementById('tabelaPagamentosCliente');
    const pagamentosOrdenados = ordenarRegistrosRecentesPrimeiro(lista);

    tabela.innerHTML = '';

    if (!pagamentosOrdenados.length) {
        tabela.innerHTML = `
            <tr>
                <td colspan="6">Nenhum pagamento registrado.</td>
            </tr>
        `;
        return;
    }

    pagamentosOrdenados.forEach(item => {
        tabela.innerHTML += `
            <tr class="status-ok">
                <td>${formatarDataHora(item.data, item.hora)}</td>
                <td>${formatarMoeda(item.valor_total)}</td>
                <td>${formatarFormaPagamento(item.forma_pagamento || '')}</td>
                <td>${item.valor_recebido ? formatarMoeda(item.valor_recebido) : '-'}</td>
                <td>${item.troco ? formatarMoeda(item.troco) : '-'}</td>
                <td>${montarObservacaoComOrigem(item)}</td>
            </tr>
        `;
    });
}

function renderizarHistoricoCompleto(historico) {
    const tabela = document.getElementById('tabelaHistoricoCliente');
    const historicoOrdenado = ordenarRegistrosRecentesPrimeiro(historico);

    tabela.innerHTML = '';

    if (!historicoOrdenado.length) {
        tabela.innerHTML = `
            <tr>
                <td colspan="9">Nenhum histórico encontrado.</td>
            </tr>
        `;
        return;
    }

    historicoOrdenado.forEach(item => {
        const valorPago = item.tipo === 'COMPRA'
            ? Number(item.valor_pago || 0)
            : 0;

        const saldo = item.tipo === 'COMPRA'
            ? Math.max(Number(item.valor_total || 0) - valorPago, 0)
            : 0;

        tabela.innerHTML += `
            <tr>
                <td>${formatarDataHora(item.data, item.hora)}</td>
                <td>${item.tipo === 'COMPRA' ? 'Compra' : 'Pagamento'}</td>
                <td>
                    ${escaparHtml(item.produto || '-')}
                    ${formatarOrigemConta(item) && item.tipo === 'COMPRA' ? `<br><small>${escaparHtml(formatarOrigemConta(item))}</small>` : ''}
                </td>
                <td>${item.tipo === 'COMPRA' ? formatarQuantidadeComUnidadeFiado(item.quantidade, item.unidade_medida) : '-'}</td>
                <td>${item.tipo === 'COMPRA' ? formatarPrecoComUnidadeFiado(item.valor_unitario, item.unidade_medida) : '-'}</td>
                <td>${formatarMoeda(item.valor_total)}</td>
                <td>${item.tipo === 'COMPRA' ? formatarMoeda(valorPago) : '-'}</td>
                <td>${item.tipo === 'COMPRA' ? formatarMoeda(saldo) : '-'}</td>
                <td>${montarObservacaoComOrigem(item)}</td>
            </tr>
        `;
    });
}

/* COMPATIBILIDADE COM CAMPOS ANTIGOS */

function calcularTrocoPagamentoFiado() {
    calcularTrocoPagamentoUnificado();
}

async function registrarPagamentoHistorico() {
    await registrarPagamentoItensFiadoUnificado();
}

async function registrarPagamentoItensFiado() {
    await registrarPagamentoItensFiadoUnificado();
}

function calcularTrocoPagamentoItensFiado() {
    calcularTrocoPagamentoUnificado();
}

function imprimirExtratoCliente() {
    if (!ultimoResumoCliente) {
        mostrarMensagemSistema('Nenhum dado carregado.', 'aviso');
        return;
    }

    const resumo = ultimoResumoCliente;
    const janela = window.open('', '_blank');

    let comprasVencidas = '';
    let comprasNoPrazo = '';
    let pagamentos = '';

    resumo.comprasVencidas.forEach(item => {
        comprasVencidas += `
            <tr>
                <td>${formatarDataHora(item.data, item.hora)}</td>
                <td>${escaparHtml(item.produto || '-')} ${formatarOrigemConta(item) ? `<br><small>${escaparHtml(formatarOrigemConta(item))}</small>` : ''}</td>
                <td>${formatarQuantidadeComUnidadeFiado(item.quantidade, item.unidade_medida)}</td>
                <td>${formatarMoeda(item.valor_total)}</td>
                <td>${formatarMoeda(item.valor_pago_calculado || item.valor_pago || 0)}</td>
                <td>${formatarMoeda(item.saldo_aberto)}</td>
                <td>${item.dias_em_aberto} dias</td>
            </tr>
        `;
    });

    resumo.comprasNoPrazo.forEach(item => {
        comprasNoPrazo += `
            <tr>
                <td>${formatarDataHora(item.data, item.hora)}</td>
                <td>${escaparHtml(item.produto || '-')} ${formatarOrigemConta(item) ? `<br><small>${escaparHtml(formatarOrigemConta(item))}</small>` : ''}</td>
                <td>${formatarQuantidadeComUnidadeFiado(item.quantidade, item.unidade_medida)}</td>
                <td>${formatarMoeda(item.valor_total)}</td>
                <td>${formatarMoeda(item.valor_pago_calculado || item.valor_pago || 0)}</td>
                <td>${formatarMoeda(item.saldo_aberto)}</td>
                <td>${item.dias_em_aberto} dias</td>
            </tr>
        `;
    });

    resumo.pagamentos.forEach(item => {
        pagamentos += `
            <tr>
                <td>${formatarDataHora(item.data, item.hora)}</td>
                <td>${formatarMoeda(item.valor_total)}</td>
                <td>${formatarFormaPagamento(item.forma_pagamento || '')}</td>
                <td>${item.valor_recebido ? formatarMoeda(item.valor_recebido) : '-'}</td>
                <td>${item.troco ? formatarMoeda(item.troco) : '-'}</td>
                <td>${montarObservacaoComOrigem(item)}</td>
            </tr>
        `;
    });

    janela.document.write(`
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <title>Relatório A Prazo - VALE AGRO</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    padding: 30px;
                    color: #111;
                }

                h1, h2 {
                    margin-bottom: 8px;
                }

                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin: 15px 0 25px;
                }

                th, td {
                    border: 1px solid #ccc;
                    padding: 8px;
                    text-align: left;
                    font-size: 13px;
                }

                th {
                    background: #f0f0f0;
                }

                small {
                    color: #555;
                    font-size: 11px;
                }

                .resumo {
                    margin-bottom: 25px;
                    line-height: 1.7;
                }
            </style>
        </head>
        <body>
            <h1>VALE AGRO</h1>
            <h2>RELATÓRIO A PRAZO DO CLIENTE</h2>

            <div class="resumo">
                <strong>Cliente:</strong> ${escaparHtml(clienteSelecionado)}<br>
                <strong>Data de Emissão:</strong> ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}<br>
                <strong>Situação:</strong> ${escaparHtml(obterSituacao(resumo))}<br><br>
                <strong>Total em compras:</strong> ${formatarMoeda(resumo.totalCompras)}<br>
                <strong>Total recebido:</strong> ${formatarMoeda(resumo.totalPagamentos)}<br>
                <strong>Saldo atual:</strong> ${formatarMoeda(resumo.saldoAtual)}<br>
                <strong>Saldo vencido:</strong> ${formatarMoeda(resumo.valorVencido)}<br>
                <strong>Saldo no prazo:</strong> ${formatarMoeda(resumo.valorNoPrazo)}<br>
            </div>

            <h2>Compras no Prazo</h2>
            <table>
                <thead>
                    <tr>
                        <th>Data/Hora</th>
                        <th>Produto</th>
                        <th>Qtd</th>
                        <th>Valor Original</th>
                        <th>Já Pago</th>
                        <th>Saldo Aberto</th>
                        <th>Dias</th>
                    </tr>
                </thead>
                <tbody>
                    ${comprasNoPrazo || '<tr><td colspan="7">Nenhuma compra no prazo.</td></tr>'}
                </tbody>
            </table>

            <h2>Compras Vencidas</h2>
            <table>
                <thead>
                    <tr>
                        <th>Data/Hora</th>
                        <th>Produto</th>
                        <th>Qtd</th>
                        <th>Valor Original</th>
                        <th>Já Pago</th>
                        <th>Saldo Aberto</th>
                        <th>Dias</th>
                    </tr>
                </thead>
                <tbody>
                    ${comprasVencidas || '<tr><td colspan="7">Nenhuma compra vencida.</td></tr>'}
                </tbody>
            </table>

            <h2>Pagamentos</h2>
            <table>
                <thead>
                    <tr>
                        <th>Data/Hora</th>
                        <th>Valor</th>
                        <th>Forma</th>
                        <th>Valor Recebido</th>
                        <th>Troco</th>
                        <th>Observação</th>
                    </tr>
                </thead>
                <tbody>
                    ${pagamentos || '<tr><td colspan="6">Nenhum pagamento registrado.</td></tr>'}
                </tbody>
            </table>

            <hr>

            <div style="
                margin-top:20px;
                text-align:center;
                font-size:12px;
                color:#666;
            ">
                VALE AGRO • Relatório emitido pelo sistema
            </div>

            <script>
                window.print();
            <\/script>
        </body>
        </html>
    `);

    janela.document.close();
}

function montarComprovantePagamento(pagamento) {
    const mostrarEntregueTroco = Number(pagamento.valor_entregue || 0) > 0;

    const entregueTrocoHtml = mostrarEntregueTroco
        ? `
            <div class="linha"></div>

            <div class="total-linha">
                <span>Entregue</span>
                <strong>${formatarMoeda(pagamento.valor_entregue)}</strong>
            </div>

            <div class="total-linha">
                <span>Troco</span>
                <strong>${formatarMoeda(pagamento.troco)}</strong>
            </div>
        `
        : '';

    return `
        <h1>VALE AGRO</h1>
        <h2>COMPROVANTE DE PAGAMENTO</h2>

        <div class="centro">
            ${pagamento.data} - ${pagamento.hora}
        </div>

        <div class="linha"></div>

        <div class="info">
            <strong>Cliente:</strong><br>
            ${escaparHtml(pagamento.cliente)}
        </div>

        ${pagamento.forma_pagamento ? `
            <div class="info">
                <strong>Forma:</strong><br>
                ${formatarFormaPagamento(pagamento.forma_pagamento)}
            </div>
        ` : ''}

        ${pagamento.observacao ? `
            <div class="info">
                <strong>Observação:</strong><br>
                ${escaparHtml(pagamento.observacao)}
            </div>
        ` : ''}

        <div class="linha"></div>

        <div class="total-linha">
            <span>Saldo anterior</span>
            <strong>${formatarMoeda(pagamento.saldo_anterior)}</strong>
        </div>

        <div class="total-linha destaque">
            <span>Pagamento</span>
            <strong>${formatarMoeda(pagamento.valor_recebido)}</strong>
        </div>

        <div class="total-linha">
            <span>Saldo atual</span>
            <strong>${formatarMoeda(pagamento.saldo_atual)}</strong>
        </div>

        ${entregueTrocoHtml}

        <div class="linha"></div>

        <div class="rodape">
            Documento sem valor fiscal<br>
            VALE AGRO agradece a preferência
        </div>
    `;
}

function imprimirComprovantePagamentoFiado() {
    if (!ultimoComprovantePagamento) {
        mostrarMensagemSistema('Nenhum pagamento recente para reimprimir.', 'aviso');
        return;
    }

    const pagamento = ultimoComprovantePagamento;
    const janela = window.open('', '_blank');

    janela.document.write(`
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <title>Comprovante de Pagamento A Prazo - VALE AGRO</title>
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

                .info {
                    margin: 4px 0;
                    overflow-wrap: break-word;
                }

                .total-linha {
                    display: flex;
                    justify-content: space-between;
                    gap: 8px;
                    margin: 5px 0;
                    font-size: 12px;
                }

                .total-linha strong {
                    min-width: 24mm;
                    text-align: right;
                    white-space: nowrap;
                }

                .destaque {
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
            ${montarComprovantePagamento(pagamento)}

            <script>
                window.print();
                setTimeout(() => window.close(), 500);
            <\/script>
        </body>
        </html>
    `);

    janela.document.close();
}

function montarComprovantePagamentoItensFiado(pagamento) {
    let linhasItens = '';
    const totalSelecionado = Number(pagamento.total_selecionado || 0);
    const valorPago = Number(pagamento.valor_pago || 0);
    const mostrarTotalSelecionado = Math.abs(totalSelecionado - valorPago) > 0.009;
    const totalSelecionadoHtml = mostrarTotalSelecionado
        ? `
            <div class="total-linha">
                <span>Total selecionado</span>
                <strong>${formatarMoeda(totalSelecionado)}</strong>
            </div>
        `
        : '';

    pagamento.itens.forEach(item => {
        linhasItens += `
            <div class="item">
                <div class="item-nome">${escaparHtml(item.produto || '-')}</div>
                <div class="item-linha">
                    <span>Qtd: ${formatarQuantidadeComUnidadeFiado(item.quantidade, item.unidade_medida)} | Valor pago:</span>
                    <strong>${formatarMoeda(item.valor_abatido)}</strong>
                </div>
            </div>
        `;
    });

    return `
        <h1>VALE AGRO</h1>
        <h2>COMPROVANTE DE PAGAMENTO</h2>

        <div class="centro">
            ${pagamento.data} - ${pagamento.hora}<br>
            ${formatarFormaPagamento(pagamento.forma_pagamento)}
        </div>

        <div class="linha"></div>

        <div class="info">
            <strong>Cliente:</strong><br>
            ${escaparHtml(pagamento.cliente)}
        </div>

        ${pagamento.observacao ? `
            <div class="info">
                <strong>Observação:</strong><br>
                ${escaparHtml(pagamento.observacao)}
            </div>
        ` : ''}

        <div class="linha"></div>

        <div class="secao-comprovante">ITENS PAGOS</div>

        ${linhasItens}

        <div class="linha"></div>

        <div class="secao-comprovante">RESUMO</div>

        <div class="total-linha">
            <span>Saldo anterior</span>
            <strong>${formatarMoeda(pagamento.saldo_anterior)}</strong>
        </div>

        ${totalSelecionadoHtml}

        <div class="total-linha destaque">
            <span>Pagamento</span>
            <strong>${formatarMoeda(valorPago)}</strong>
        </div>

        <div class="total-linha">
            <span>Valor recebido</span>
            <strong>${formatarMoeda(pagamento.valor_recebido)}</strong>
        </div>

        <div class="total-linha">
            <span>Troco</span>
            <strong>${formatarMoeda(pagamento.troco)}</strong>
        </div>

        <div class="total-linha">
            <span>Saldo atual</span>
            <strong>${formatarMoeda(pagamento.saldo_atual)}</strong>
        </div>

        <div class="linha"></div>

        <div class="rodape">
            Documento sem valor fiscal<br>
            VALE AGRO agradece a preferência
        </div>
    `;
}

function imprimirUltimoComprovantePagamentoItensFiado() {
    if (!ultimoComprovantePagamentoItens) {
        mostrarMensagemSistema('Nenhum pagamento por itens recente para reimprimir.', 'aviso');
        return;
    }

    const pagamento = ultimoComprovantePagamentoItens;
    const janela = window.open('', '_blank');

    janela.document.write(`
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <title>Comprovante de Pagamento - VALE AGRO</title>
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

                .info {
                    margin: 4px 0;
                    overflow-wrap: break-word;
                }

                .item {
                    margin-bottom: 8px;
                    page-break-inside: avoid;
                }

                .secao-comprovante {
                    font-size: 10px;
                    font-weight: bold;
                    text-transform: uppercase;
                    margin: 0 0 6px;
                }

                .item-nome {
                    font-weight: bold;
                    overflow-wrap: break-word;
                }

                .item-linha {
                    display: flex;
                    justify-content: space-between;
                    gap: 8px;
                    margin: 2px 0;
                }

                .item-linha strong {
                    min-width: 22mm;
                    text-align: right;
                    white-space: nowrap;
                }

                .pequeno {
                    font-size: 10px;
                }

                .total-linha {
                    display: flex;
                    justify-content: space-between;
                    gap: 8px;
                    margin: 5px 0;
                    font-size: 12px;
                }

                .total-linha strong {
                    min-width: 24mm;
                    text-align: right;
                    white-space: nowrap;
                }

                .destaque {
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
            ${montarComprovantePagamentoItensFiado(pagamento)}

            <script>
                window.print();
                setTimeout(() => window.close(), 500);
            <\/script>
        </body>
        </html>
    `);

    janela.document.close();
}

function reimprimirComprovanteFiadoUnificado() {
    if (ultimoComprovantePagamentoItens) {
        imprimirUltimoComprovantePagamentoItensFiado();
        return;
    }

    if (ultimoComprovantePagamento) {
        imprimirComprovantePagamentoFiado();
        return;
    }

    mostrarMensagemSistema('Nenhum pagamento recente para reimprimir.', 'aviso');
}

function inicializarAbasFiadoDetalhe() {
    const botoes = document.querySelectorAll('[data-fiado-tab]');
    const secoes = document.querySelectorAll('[data-fiado-section]');

    if (!botoes.length || !secoes.length) return;

    botoes.forEach(botao => {
        botao.setAttribute('aria-selected', botao.classList.contains('ativo') ? 'true' : 'false');

        botao.addEventListener('click', () => {
            const alvo = botao.dataset.fiadoTab;

            botoes.forEach(item => {
                item.classList.toggle('ativo', item === botao);
                item.setAttribute('aria-selected', item === botao ? 'true' : 'false');
            });

            secoes.forEach(secao => {
                secao.classList.toggle('ativo', secao.dataset.fiadoSection === alvo);
            });
        });
    });
}

inicializarAbasFiadoDetalhe();
carregarDetalheCliente();
