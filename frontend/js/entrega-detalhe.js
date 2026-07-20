function formatarMoedaEntregaDetalhe(valor) {
    return Number(valor || 0).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
}

function formatarQuantidadeEntregaDetalhe(valor) {
    return Number(valor || 0).toLocaleString('pt-BR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 3
    });
}

function normalizarUnidadeEntregaDetalhe(valor) {
    const unidade = String(valor || 'UN').trim().toUpperCase();
    const unidadesValidas = ['UN', 'KG', 'G', 'L', 'ML', 'M'];

    return unidadesValidas.includes(unidade) ? unidade : 'UN';
}

function formatarTelefoneEntregaDetalhe(telefone) {
    const texto = String(telefone || '').trim();

    if (!texto) return '-';

    const digitos = texto.replace(/\D/g, '');

    if (digitos.length === 11) {
        return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`;
    }

    if (digitos.length === 10) {
        return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`;
    }

    return texto;
}

function escaparHtmlEntregaDetalhe(valor) {
    return String(valor || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function obterParametroEntregaDetalhe(nome) {
    return new URLSearchParams(window.location.search).get(nome);
}

function textoStatusEntregaDetalhe(status) {
    const nomes = {
        PENDENTE: 'Pendente',
        SAIU_ENTREGA: 'Saiu para entrega',
        ENTREGUE: 'Entregue',
        CANCELADA: 'Cancelada'
    };

    return nomes[status] || status || '-';
}

function textoFormaRecebimentoEntregaDetalhe(forma) {
    const nomes = {
        DINHEIRO: 'Dinheiro',
        PIX: 'PIX',
        CARTAO_CREDITO: 'Cartão Crédito',
        CARTAO_DEBITO: 'Cartão Débito',
        FIADO: 'A Prazo',
        A_RECEBER_ENTREGA: 'A receber na entrega'
    };

    return nomes[forma] || forma || '';
}

function textoPagamentoEntregaDetalhe(entrega) {
    if (Number(entrega.transferida_a_prazo || 0) === 1) {
        return 'A Prazo / Transferida para A Prazo';
    }

    const nomes = {
        PAGO_NA_COMPRA: 'Pago na compra',
        A_RECEBER_NA_ENTREGA: 'Pagar na entrega',
        RECEBIDO_NA_ENTREGA: 'Recebido na entrega',
        FIADO: 'A Prazo'
    };

    const status = nomes[entrega.status_pagamento] || entrega.status_pagamento || '-';
    const forma = textoFormaRecebimentoEntregaDetalhe(entrega.forma_recebimento);

    if (forma && ['PAGO_NA_COMPRA', 'RECEBIDO_NA_ENTREGA'].includes(entrega.status_pagamento)) {
        return `${status} (${forma})`;
    }

    return status;
}

function setTextoEntregaDetalhe(id, valor) {
    const elemento = document.getElementById(id);

    if (elemento) {
        elemento.textContent = valor || '-';
    }
}

function mostrarMensagemEntregaDetalhe(mensagem, tipo = 'aviso') {
    const caixa = document.getElementById('mensagemEntregaDetalhe');

    if (!caixa) return;

    caixa.style.display = 'block';
    caixa.innerHTML = `<strong>${tipo === 'erro' ? 'Atenção:' : 'Aviso:'}</strong><br>${escaparHtmlEntregaDetalhe(mensagem)}`;
}

function voltarEntregas() {
    window.location.href = 'entregas.html';
}

function renderizarDadosEntregaDetalhe(dados) {
    const entrega = dados.entrega || {};

    setTextoEntregaDetalhe('tituloEntregaDetalhe', `Entrega #${entrega.id || '-'}`);
    setTextoEntregaDetalhe('clienteEntregaDetalhe', entrega.cliente_nome || '-');
    setTextoEntregaDetalhe('telefoneEntregaDetalhe', formatarTelefoneEntregaDetalhe(entrega.telefone));
    setTextoEntregaDetalhe('enderecoEntregaDetalhe', entrega.endereco || '-');
    setTextoEntregaDetalhe('cidadeEntregaDetalhe', entrega.bairro_cidade || '-');
    setTextoEntregaDetalhe('statusEntregaDetalhe', textoStatusEntregaDetalhe(entrega.status_entrega));
    setTextoEntregaDetalhe('pagamentoEntregaDetalhe', textoPagamentoEntregaDetalhe(entrega));

    const observacaoBox = document.getElementById('observacaoEntregaDetalheBox');
    const observacao = String(entrega.observacao || '').trim();

    if (observacaoBox) {
        observacaoBox.style.display = observacao ? 'block' : 'none';
    }

    setTextoEntregaDetalhe('observacaoEntregaDetalhe', observacao || '-');
}

function renderizarItensEntregaDetalhe(itens) {
    const tabela = document.getElementById('tabelaItensEntregaDetalhe');

    if (!tabela) return 0;

    if (!itens.length) {
        tabela.innerHTML = `
            <tr>
                <td colspan="5" class="entrega-detalhe-sem-itens">
                    Não foi possível localizar os itens desta entrega.
                </td>
            </tr>
        `;
        return 0;
    }

    let subtotal = 0;

    tabela.innerHTML = itens.map(item => {
        const quantidade = Number(item.quantidade || 0);
        const unidade = normalizarUnidadeEntregaDetalhe(item.unidade_medida);
        const totalItem = Number(item.valor_total || 0);
        const valorUnitario = Number(item.valor_unitario || 0) > 0
            ? Number(item.valor_unitario || 0)
            : (quantidade > 0 ? totalItem / quantidade : 0);

        subtotal += totalItem;

        return `
            <tr>
                <td>
                    <strong class="entrega-detalhe-produto">
                        ${escaparHtmlEntregaDetalhe(item.produto_nome || 'Produto')}
                    </strong>
                </td>
                <td>${formatarQuantidadeEntregaDetalhe(quantidade)}</td>
                <td>${unidade}</td>
                <td>${formatarMoedaEntregaDetalhe(valorUnitario)} / ${unidade}</td>
                <td><strong>${formatarMoedaEntregaDetalhe(totalItem)}</strong></td>
            </tr>
        `;
    }).join('');

    return subtotal;
}

function renderizarResumoEntregaDetalhe(dados, subtotalItens) {
    const entrega = dados.entrega || {};
    const venda = dados.venda || {};
    const frete = Number(entrega.frete || 0);
    const totalFinal = Number(entrega.valor_total || venda.total || 0);
    const subtotal = subtotalItens > 0
        ? subtotalItens
        : Math.max(Number(venda.subtotal || 0), totalFinal - frete, 0);

    setTextoEntregaDetalhe('subtotalItensEntregaDetalhe', formatarMoedaEntregaDetalhe(subtotal));
    setTextoEntregaDetalhe('freteEntregaDetalhe', formatarMoedaEntregaDetalhe(frete));
    setTextoEntregaDetalhe('totalEntregaDetalhe', formatarMoedaEntregaDetalhe(totalFinal));

    const linhaFrete = document.getElementById('linhaFreteEntregaDetalhe');

    if (linhaFrete) {
        linhaFrete.style.display = frete > 0 ? 'flex' : 'none';
    }
}

async function carregarEntregaDetalhe() {
    const id = obterParametroEntregaDetalhe('id');

    if (!id) {
        mostrarMensagemEntregaDetalhe('Entrega não informada na URL.', 'erro');
        return;
    }

    try {
        const resposta = await fetch(`/entregas/${encodeURIComponent(id)}`);
        const dados = await resposta.json();

        if (!resposta.ok) {
            throw new Error(dados.erro || 'Erro ao carregar detalhe da entrega.');
        }

        renderizarDadosEntregaDetalhe(dados);
        const subtotalItens = renderizarItensEntregaDetalhe(dados.itens || []);
        renderizarResumoEntregaDetalhe(dados, subtotalItens);

        if (!dados.itens || dados.itens.length === 0) {
            mostrarMensagemEntregaDetalhe('Não foi possível localizar os itens desta entrega.');
        }

    } catch (erro) {
        console.error('Erro ao carregar detalhe da entrega:', erro);
        mostrarMensagemEntregaDetalhe(erro.message || 'Erro ao carregar detalhe da entrega.', 'erro');
    }
}

carregarEntregaDetalhe();
