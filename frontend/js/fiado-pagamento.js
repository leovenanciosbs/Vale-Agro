const CHAVE_PAGAMENTO_A_PRAZO = 'pagamentoAPrazoSelecionado';
const CHAVE_MENSAGEM_FIADO_DETALHE = 'mensagemFiadoDetalhe';

let pagamentoAPrazoAtual = null;
let ultimoComprovantePagamentoItens = null;

function converterNumero(valor) {
    if (!valor) return 0;

    const texto = String(valor)
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

    if (!numero) return '-';

    return numero.toLocaleString('pt-BR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 3
    });
}

function normalizarUnidadeMedidaFiadoPagamento(valor) {
    const unidade = String(valor || 'UN').trim().toUpperCase();
    const unidadesValidas = ['UN', 'KG', 'G', 'L', 'ML', 'M'];

    return unidadesValidas.includes(unidade) ? unidade : 'UN';
}

function formatarQuantidadeComUnidadeFiadoPagamento(valor, unidade) {
    const quantidade = formatarQuantidade(valor);

    return quantidade === '-' ? '-' : `${quantidade} ${normalizarUnidadeMedidaFiadoPagamento(unidade)}`;
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

    if (partes.length !== 3) return data;

    return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function formatarHora(hora) {
    if (!hora) return '';
    return String(hora).slice(0, 5);
}

function formatarDataHora(data, hora) {
    const dataFormatada = formatarData(data);
    const horaFormatada = formatarHora(hora);

    if (!horaFormatada) return dataFormatada;

    return `${dataFormatada}<br><small>${horaFormatada}</small>`;
}

function formatarFormaPagamento(forma) {
    const nomes = {
        DINHEIRO: 'Dinheiro',
        PIX: 'PIX',
        CARTAO: 'Cartao',
        CARTAO_CREDITO: 'Cartao de Credito',
        CARTAO_DEBITO: 'Cartao de Debito'
    };

    return nomes[forma] || forma || '-';
}

function normalizarTextoBusca(valor) {
    return String(valor || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toUpperCase();
}

function obterClienteUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get('cliente') || '';
}

function lerPagamentoAPrazoSalvo() {
    try {
        return JSON.parse(sessionStorage.getItem(CHAVE_PAGAMENTO_A_PRAZO) || 'null');
    } catch (erro) {
        return null;
    }
}

function obterClientePagamento() {
    return String(
        pagamentoAPrazoAtual?.cliente_nome ||
        pagamentoAPrazoAtual?.cliente ||
        obterClienteUrl() ||
        ''
    );
}

function obterModoPagamento() {
    return pagamentoAPrazoAtual?.modo || 'itens_selecionados';
}

function ehModoValorLivre() {
    return obterModoPagamento() === 'valor_livre';
}

function voltarParaProdutos(pagamentoConfirmado = false) {
    const cliente = obterClientePagamento();

    if (pagamentoConfirmado) {
        sessionStorage.removeItem(CHAVE_PAGAMENTO_A_PRAZO);
    }

    if (cliente) {
        window.location.href = `fiado-detalhe.html?cliente=${encodeURIComponent(cliente)}`;
        return;
    }

    window.location.href = 'fiados.html';
}

function validarPagamentoSalvo(dados) {
    if (!dados || dados.origem !== 'a_prazo') return false;
    if (!dados.cliente_nome && !dados.cliente) return false;

    if ((dados.modo || 'itens_selecionados') === 'valor_livre') {
        return Number(dados.saldo_total || dados.saldo_anterior || 0) > 0;
    }

    if (!Array.isArray(dados.itens) || !dados.itens.length) return false;

    return dados.itens.some(item => Number(item.fiado_id || item.id || 0) > 0);
}

function preencherTexto(id, valor) {
    const elemento = document.getElementById(id);

    if (elemento) {
        elemento.textContent = valor;
    }
}

function preencherClienteBasico() {
    const cliente = obterClientePagamento();

    preencherTexto('clientePagamentoFiado', cliente || 'Cliente');
}

async function carregarDadosClienteComplementares() {
    const cliente = obterClientePagamento();

    if (!cliente) return;

    try {
        const resposta = await fetch('https://vale-agro-alpha.vercel.app/clientes');
        const clientes = await resposta.json();
        const clienteNormalizado = normalizarTextoBusca(cliente);
        const encontrado = (clientes || []).find(item => {
            return normalizarTextoBusca(item.nome) === clienteNormalizado;
        });

        if (!encontrado) return;

        preencherTexto('telefonePagamentoFiado', encontrado.telefone || 'Telefone nao informado');
        preencherTexto('cidadePagamentoFiado', encontrado.cidade || 'Cidade nao informada');
    } catch (erro) {
        console.error('Erro ao carregar dados do cliente:', erro);
    }
}

function obterItensPagamento() {
    if (ehModoValorLivre()) return [];

    return (pagamentoAPrazoAtual?.itens || []).map(item => {
        const saldoAberto = Number(item.saldo_aberto || item.valor_pagamento || 0);

        return {
            fiado_id: Number(item.fiado_id || item.id || 0),
            produto: item.produto || '',
            data: item.data || '',
            hora: item.hora || '',
            quantidade: Number(item.quantidade || 0),
            unidade_medida: normalizarUnidadeMedidaFiadoPagamento(item.unidade_medida),
            saldo_aberto: saldoAberto,
            valor_pagamento: Number(item.valor_pagamento || saldoAberto)
        };
    }).filter(item => item.fiado_id > 0 && item.saldo_aberto > 0);
}

function obterTotalSelecionado() {
    if (ehModoValorLivre()) {
        return Number(pagamentoAPrazoAtual?.saldo_total || pagamentoAPrazoAtual?.saldo_anterior || 0);
    }

    return obterItensPagamento().reduce((soma, item) => {
        return soma + Number(item.saldo_aberto || 0);
    }, 0);
}

function renderizarItensPagamento() {
    const tabela = document.getElementById('tabelaItensPagamentoFiado');
    const cardItens = document.querySelector('.card-itens-caixa-fiado');
    const itens = obterItensPagamento();

    if (cardItens) {
        cardItens.style.display = ehModoValorLivre() ? 'none' : '';
    }

    if (ehModoValorLivre()) return;

    if (!tabela) return;

    tabela.innerHTML = '';

    if (!itens.length) {
        tabela.innerHTML = '<tr><td colspan="5">Nenhum item selecionado.</td></tr>';
        return;
    }

    itens.forEach(item => {
        tabela.innerHTML += `
            <tr>
                <td>${escaparHtml(item.produto || '-')}</td>
                <td>${formatarDataHora(item.data, item.hora)}</td>
                <td>${formatarQuantidadeComUnidadeFiadoPagamento(item.quantidade, item.unidade_medida)}</td>
                <td>${formatarMoeda(item.saldo_aberto)}</td>
                <td>${formatarMoeda(item.valor_pagamento)}</td>
            </tr>
        `;
    });
}

function preencherResumoPagamento() {
    const itens = obterItensPagamento();
    const totalSelecionado = obterTotalSelecionado();
    const campoValor = document.getElementById('valorPagamentoFiadoUnificado');
    const rotulosResumo = document.querySelectorAll('.resumo-caixa-fiado span');

    if (ehModoValorLivre()) {
        if (rotulosResumo[0]) rotulosResumo[0].textContent = 'Modo';
        if (rotulosResumo[1]) rotulosResumo[1].textContent = 'Saldo em aberto';

        preencherTexto('quantidadeItensPagamentoFiado', 'Valor livre');
        preencherTexto('totalSelecionadoCaixaFiado', formatarMoeda(totalSelecionado));

        if (campoValor) {
            campoValor.value = '';
            campoValor.placeholder = 'Informe o valor pago';
        }

        return;
    }

    if (rotulosResumo[0]) rotulosResumo[0].textContent = 'Itens selecionados';
    if (rotulosResumo[1]) rotulosResumo[1].textContent = 'Total selecionado';

    preencherTexto('quantidadeItensPagamentoFiado', String(itens.length));
    preencherTexto('totalSelecionadoCaixaFiado', formatarMoeda(totalSelecionado));

    if (campoValor && !campoValor.value) {
        campoValor.value = formatarMoeda(totalSelecionado);
    }
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

function obterDadosPagamentoParaEnvio() {
    const itens = obterItensPagamento();
    const totalSelecionado = obterTotalSelecionado();
    const formaPagamento = document.getElementById('formaPagamentoFiadoUnificado')?.value || 'DINHEIRO';
    const valorPagamento = converterNumero(document.getElementById('valorPagamentoFiadoUnificado')?.value);
    let valorRecebido = converterNumero(document.getElementById('valorRecebidoFiadoUnificado')?.value);
    const observacao = document.getElementById('observacaoPagamentoFiadoUnificado')?.value.trim() || '';

    if (formaPagamento !== 'DINHEIRO') {
        valorRecebido = valorPagamento;
    }

    const troco = formaPagamento === 'DINHEIRO'
        ? Math.max(valorRecebido - valorPagamento, 0)
        : 0;

    return {
        itens,
        totalSelecionado,
        formaPagamento,
        valorPagamento,
        valorRecebido,
        troco,
        observacao
    };
}

function validarDadosPagamento(dadosPagamento) {
    if (!ehModoValorLivre() && !dadosPagamento.itens.length) {
        mostrarMensagemSistema('Nenhum produto selecionado para pagamento.', 'aviso');
        return false;
    }

    if (dadosPagamento.valorPagamento <= 0) {
        mostrarMensagemSistema('Informe o valor do pagamento.', 'aviso');
        return false;
    }

    if (dadosPagamento.valorPagamento > dadosPagamento.totalSelecionado) {
        const mensagem = ehModoValorLivre()
            ? 'Valor informado \u00e9 maior que o saldo em aberto do cliente.'
            : `O valor do pagamento nao pode ser maior que o total selecionado. Total selecionado: ${formatarMoeda(dadosPagamento.totalSelecionado)}`;

        mostrarMensagemSistema(mensagem, 'aviso');
        return false;
    }

    if (dadosPagamento.formaPagamento === 'DINHEIRO' && dadosPagamento.valorRecebido <= 0) {
        mostrarMensagemSistema('Informe o valor recebido do cliente.', 'aviso');
        return false;
    }

    if (dadosPagamento.valorRecebido < dadosPagamento.valorPagamento) {
        mostrarMensagemSistema('O valor recebido nao pode ser menor que o valor do pagamento.', 'aviso');
        return false;
    }

    return true;
}

async function confirmarPagamentoFiadoUnificado() {
    const dadosPagamento = obterDadosPagamentoParaEnvio();

    if (!validarDadosPagamento(dadosPagamento)) return;

    const confirmar = await mostrarConfirmacaoSistema({
        titulo: 'Confirmar pagamento?',
        mensagem: ehModoValorLivre()
            ? `Valor na ficha: ${formatarMoeda(dadosPagamento.valorPagamento)}. Forma: ${formatarFormaPagamento(dadosPagamento.formaPagamento)}.`
            : `Itens selecionados: ${dadosPagamento.itens.length}. Valor: ${formatarMoeda(dadosPagamento.valorPagamento)}. Forma: ${formatarFormaPagamento(dadosPagamento.formaPagamento)}.`,
        textoConfirmar: 'Confirmar pagamento',
        textoCancelar: 'Voltar',
        tipo: 'aviso'
    });

    if (!confirmar) return;

    await registrarPagamentoItensFiadoUnificado(dadosPagamento);
}

async function registrarPagamentoItensFiadoUnificado(dadosPagamento) {
    const cliente = obterClientePagamento();
    const saldoAnterior = Number(pagamentoAPrazoAtual?.saldo_anterior || dadosPagamento.totalSelecionado || 0);
    const modoValorLivre = ehModoValorLivre();
    const urlPagamento = modoValorLivre
        ? 'https://vale-agro-alpha.vercel.app/fiados/pagamento-valor'
        : 'https://vale-agro-alpha.vercel.app/fiados/pagamento-itens';
    const corpoPagamento = modoValorLivre
        ? {
            cliente_nome: cliente,
            valor_pagamento: dadosPagamento.valorPagamento,
            forma_pagamento: dadosPagamento.formaPagamento,
            valor_recebido: dadosPagamento.valorRecebido,
            troco: dadosPagamento.troco,
            observacao: dadosPagamento.observacao
        }
        : {
            cliente_nome: cliente,
            forma_pagamento: dadosPagamento.formaPagamento,
            valor_pago: dadosPagamento.valorPagamento,
            valor_recebido: dadosPagamento.valorRecebido,
            troco: dadosPagamento.troco,
            observacao: dadosPagamento.observacao,
            itens: dadosPagamento.itens.map(item => ({
                fiado_id: item.fiado_id
            }))
        };

    try {
        const resposta = await fetch(urlPagamento, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(corpoPagamento)
        });

        const dados = await resposta.json();

        if (!resposta.ok || !dados.sucesso) {
            mostrarMensagemSistema(dados.erro || 'Erro ao registrar pagamento dos produtos.', 'erro');
            return;
        }

        const abatimentosAtuais = Array.isArray(dados.abatimentos)
            ? dados.abatimentos
            : dados.itens || [];
        const valorPagoComprovante = Number(
            dados.valor_pagamento !== undefined
                ? dados.valor_pagamento
                : dados.valor_pago || dadosPagamento.valorPagamento || 0
        );
        const saldoAnteriorComprovante = Number(
            dados.saldo_anterior !== undefined
                ? dados.saldo_anterior
                : saldoAnterior
        );
        const saldoAtualComprovante = Number(
            dados.saldo_atual !== undefined
                ? dados.saldo_atual
                : Math.max(saldoAnteriorComprovante - valorPagoComprovante, 0)
        );

        ultimoComprovantePagamentoItens = {
            modo: modoValorLivre ? 'valor_livre' : 'itens_selecionados',
            cliente,
            data: new Date().toLocaleDateString('pt-BR'),
            hora: new Date().toLocaleTimeString('pt-BR'),
            forma_pagamento: dadosPagamento.formaPagamento,
            total_selecionado: dados.total_selecionado,
            valor_pago: valorPagoComprovante,
            valor_recebido: dados.valor_recebido,
            troco: dados.troco,
            saldo_anterior: saldoAnteriorComprovante,
            saldo_atual: saldoAtualComprovante,
            observacao: dadosPagamento.observacao,
            itens: abatimentosAtuais
        };

        mostrarMensagemSistema('Pagamento registrado com sucesso.', 'sucesso');
        sessionStorage.setItem(CHAVE_MENSAGEM_FIADO_DETALHE, 'Pagamento registrado com sucesso.');

        setTimeout(() => {
            imprimirUltimoComprovantePagamentoItensFiado();
        }, 300);

        setTimeout(() => {
            voltarParaProdutos(true);
        }, 1200);

    } catch (erro) {
        console.error('Erro ao registrar pagamento dos produtos:', erro);
        mostrarMensagemSistema('Erro ao registrar pagamento dos produtos. Verifique se o servidor esta rodando.', 'erro');
    }
}

function montarComprovantePagamentoItensFiado(pagamento) {
    let linhasItens = '';
    const totalSelecionado = Number(pagamento.total_selecionado || 0);
    const valorPago = Number(pagamento.valor_pago || 0);
    const valorRecebido = Number(pagamento.valor_recebido || 0);
    const troco = Number(pagamento.troco || 0);
    const modoValorLivre = pagamento.modo === 'valor_livre';
    const formaPagamento = normalizarTextoBusca(pagamento.forma_pagamento);
    const pagamentoEmDinheiro = formaPagamento === 'DINHEIRO';
    const mostrarTotalSelecionado = !modoValorLivre && Math.abs(totalSelecionado - valorPago) > 0.009;
    const mostrarValorRecebido = !modoValorLivre ||
        pagamentoEmDinheiro ||
        Math.abs(valorRecebido - valorPago) > 0.009;
    const mostrarTroco = !modoValorLivre ||
        pagamentoEmDinheiro ||
        Math.abs(troco) > 0.009;
    const totalSelecionadoHtml = mostrarTotalSelecionado
        ? `
            <div class="total-linha">
                <span>Total selecionado</span>
                <strong>${formatarMoeda(totalSelecionado)}</strong>
            </div>
        `
        : '';

    pagamento.itens.forEach(item => {
        const status = item.status || (Number(item.quitado || 0) === 1 ? 'Quitado' : 'Parcial');
        const saldoDepois = Number(item.saldo_depois || 0);
        const itemQuitado = Number(item.quitado || 0) === 1 || saldoDepois <= 0;

        if (modoValorLivre) {
            linhasItens += `
                <div class="item">
                    <div class="item-nome">${escaparHtml(item.produto || '-')}</div>
                    <div class="item-abatimento">
                        ${formatarMoeda(item.valor_abatido)} ${itemQuitado ? 'quitado' : 'parcial'}
                    </div>
                    ${itemQuitado ? '' : `
                        <div class="item-saldo-restante">
                            Saldo restante do item: ${formatarMoeda(saldoDepois)}
                        </div>
                    `}
                </div>
            `;
            return;
        }

        linhasItens += `
            <div class="item">
                <div class="item-nome">${escaparHtml(item.produto || '-')}</div>
                <div class="item-linha">
                    <span>Qtd: ${formatarQuantidadeComUnidadeFiadoPagamento(item.quantidade, item.unidade_medida)} | ${escaparHtml(status)}:</span>
                    <strong>${formatarMoeda(item.valor_abatido)}</strong>
                </div>
            </div>
        `;
    });

    return `
        <h1>VALE AGRO</h1>
        <h2>${modoValorLivre ? 'COMPROVANTE DE PAGAMENTO A PRAZO' : 'COMPROVANTE DE PAGAMENTO'}</h2>

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
                <strong>Observacao:</strong><br>
                ${escaparHtml(pagamento.observacao)}
            </div>
        ` : ''}

        <div class="linha"></div>

        <div class="secao-comprovante">${modoValorLivre ? 'ABATIMENTOS NA FICHA' : 'ITENS PAGOS'}</div>

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

        ${mostrarValorRecebido ? `
            <div class="total-linha">
                <span>Valor recebido</span>
                <strong>${formatarMoeda(valorRecebido)}</strong>
            </div>
        ` : ''}

        ${mostrarTroco ? `
            <div class="total-linha">
                <span>Troco</span>
                <strong>${formatarMoeda(troco)}</strong>
            </div>
        ` : ''}

        <div class="total-linha">
            <span>Saldo atual</span>
            <strong>${formatarMoeda(pagamento.saldo_atual)}</strong>
        </div>

        <div class="linha"></div>

        <div class="rodape">
            Documento sem valor fiscal<br>
            VALE AGRO agradece a preferencia
        </div>
    `;
}

function imprimirUltimoComprovantePagamentoItensFiado() {
    if (!ultimoComprovantePagamentoItens) {
        mostrarMensagemSistema('Nenhum pagamento recente para imprimir.', 'aviso');
        return;
    }

    const pagamento = ultimoComprovantePagamentoItens;
    const janela = window.open('', '_blank');

    if (!janela) {
        mostrarMensagemSistema('O navegador bloqueou a abertura do comprovante.', 'aviso');
        return;
    }

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

                .item-abatimento {
                    margin-top: 2px;
                    font-size: 12px;
                }

                .item-saldo-restante {
                    margin-top: 2px;
                    font-size: 11px;
                }

                .item-linha,
                .total-linha {
                    display: flex;
                    justify-content: space-between;
                    gap: 8px;
                    margin: 5px 0;
                    font-size: 12px;
                }

                .item-linha strong,
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

function configurarEventosPagamento() {
    const forma = document.getElementById('formaPagamentoFiadoUnificado');
    const valorPagamento = document.getElementById('valorPagamentoFiadoUnificado');
    const valorRecebido = document.getElementById('valorRecebidoFiadoUnificado');

    forma?.addEventListener('change', calcularTrocoPagamentoUnificado);
    valorPagamento?.addEventListener('input', calcularTrocoPagamentoUnificado);
    valorRecebido?.addEventListener('input', calcularTrocoPagamentoUnificado);
}

async function carregarPagamentoAPrazo() {
    pagamentoAPrazoAtual = lerPagamentoAPrazoSalvo();

    if (!validarPagamentoSalvo(pagamentoAPrazoAtual)) {
        mostrarMensagemSistema('Selecione pelo menos um produto para continuar.', 'aviso');

        setTimeout(() => {
            const clienteUrl = obterClienteUrl();

            if (clienteUrl) {
                window.location.href = `fiado-detalhe.html?cliente=${encodeURIComponent(clienteUrl)}`;
                return;
            }

            window.location.href = 'fiados.html';
        }, 1200);

        return;
    }

    preencherClienteBasico();
    renderizarItensPagamento();
    preencherResumoPagamento();
    configurarEventosPagamento();
    calcularTrocoPagamentoUnificado();
    await carregarDadosClienteComplementares();
}

carregarPagamentoAPrazo();
