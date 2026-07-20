let produtosVenda = [];
let clientesVenda = [];
let carrinho = [];
let ultimaVendaComprovante = null;

const cidadesRegiao = [
    'São Bento do Sapucaí',
    'Santo Antônio do Pinhal',
    'Campos do Jordão',
    'Sapucaí-Mirim',
    'Gonçalves',
    'Paraisópolis',
    'Monteiro Lobato',
    'São Francisco Xavier',
    'Pindamonhangaba',
    'Taubaté',
    'Tremembé',
    'Caçapava',
    'Jacareí',
    'São José dos Campos',
    'Aparecida',
    'Guaratinguetá',
    'Lorena',
    'Cachoeira Paulista',
    'Cruzeiro',
    'Itajubá',
    'Wenceslau Braz',
    'Piranguçu',
    'Brasópolis',
    'Consolação',
    'Cambuí',
    'Camanducaia',
    'Monte Verde',
    'Extrema'
];

function formatarMoeda(valor) {
    return Number(valor || 0).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
}

function converterNumero(valor) {
    if (!valor) return 0;

    let texto = String(valor)
        .replace(/[R$\s]/g, '')
        .replace(/\./g, '')
        .replace(',', '.');

    return Number(texto) || 0;
}

function converterQuantidadeVenda(valor) {
    if (valor === null || valor === undefined || valor === '') return 0;

    let texto = String(valor)
        .replace(/[^\d,.-]/g, '')
        .trim();

    if (!texto) return 0;

    if (texto.includes(',')) {
        texto = texto.replace(/\./g, '').replace(',', '.');
    } else if ((texto.match(/\./g) || []).length > 1) {
        texto = texto.replace(/\./g, '');
    }

    return Number(texto) || 0;
}

function arredondarMoeda(valor) {
    return Math.round((Number(valor || 0) + Number.EPSILON) * 100) / 100;
}

function normalizarUnidadeMedidaVenda(valor) {
    const unidade = String(valor || 'UN').trim().toUpperCase();
    const unidadesValidas = ['UN', 'KG', 'G', 'L', 'ML', 'M'];

    return unidadesValidas.includes(unidade) ? unidade : 'UN';
}

function produtoPermiteFracionadoVenda(produto) {
    return Number(produto?.permite_fracionado || 0) === 1;
}

function quantidadeEhInteiraVenda(valor) {
    const numero = Number(valor || 0);

    return Math.abs(numero - Math.round(numero)) < 0.000001;
}

function formatarQuantidadeVenda(valor) {
    return Number(valor || 0).toLocaleString('pt-BR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 3
    });
}

function formatarQuantidadeComUnidadeVenda(valor, unidade) {
    return `${formatarQuantidadeVenda(valor)} ${normalizarUnidadeMedidaVenda(unidade)}`;
}

function formatarPrecoComUnidadeVenda(valor, unidade) {
    return `${formatarMoeda(valor)} / ${normalizarUnidadeMedidaVenda(unidade)}`;
}

function compararIds(a, b) {
    return String(a ?? '').trim() === String(b ?? '').trim();
}

function validarQuantidadeProdutoVenda(item, quantidade) {
    if (!item || quantidade <= 0) {
        return false;
    }

    if (!produtoPermiteFracionadoVenda(item) && !quantidadeEhInteiraVenda(quantidade)) {
        mostrarMensagemSistema('Este produto não permite venda fracionada.', 'aviso');
        return false;
    }

    return true;
}

function normalizarTextoBusca(texto) {
    return String(texto || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ');
}

function campoComecaComBusca(valor, termo) {
    const textoNormalizado = normalizarTextoBusca(valor);
    const termoNormalizado = normalizarTextoBusca(termo);

    return !!termoNormalizado && textoNormalizado.startsWith(termoNormalizado);
}

function textoCombinaComTermoProdutoVenda(valor, termo) {
    const textoNormalizado = normalizarTextoBusca(valor);
    const termoNormalizado = normalizarTextoBusca(termo);

    if (!termoNormalizado) return true;
    if (textoNormalizado.startsWith(termoNormalizado)) return true;

    return textoNormalizado
        .split(' ')
        .filter(Boolean)
        .some(palavra => palavra.startsWith(termoNormalizado));
}

function produtoCombinaComBuscaVenda(produto, termo) {
    const busca = normalizarTextoBusca(termo);
    if (!busca) return true;

    const termos = busca.split(' ').filter(Boolean);
    const campos = [
        produto.nome || '',
        produto.codigo || '',
        produto.categoria || '',
        produto.descricao || ''
    ];

    return termos.every(termoBusca => {
        return campos.some(campo => textoCombinaComTermoProdutoVenda(campo, termoBusca));
    });
}

async function carregarProdutosVenda() {
    try {
        const resposta = await fetch('/produtos');
        if (!resposta.ok) {
            throw new Error('Erro ao carregar lista de produtos.');
        }

        produtosVenda = await resposta.json();
    } catch (erro) {
        produtosVenda = [];
        mostrarMensagemSistema('Não foi possível carregar os produtos. Verifique se o servidor está rodando.', 'erro');
    }
}

async function carregarClientesVenda() {
    try {
        const resposta = await fetch('/clientes');
        if (!resposta.ok) {
            throw new Error('Erro ao carregar lista de clientes.');
        }

        clientesVenda = await resposta.json();
    } catch (erro) {
        clientesVenda = [];
        mostrarMensagemSistema('Não foi possível carregar os clientes. Verifique se o servidor está rodando.', 'erro');
    }
}

function pesquisarProdutoVenda() {
    const busca = normalizarTextoBusca(document.getElementById('produtoBuscaVenda').value);
    const resultados = document.getElementById('resultadosProdutosVenda');

    resultados.innerHTML = '';

    if (busca.length < 1) return;

    const filtrados = produtosVenda.filter(produto => produtoCombinaComBuscaVenda(produto, busca));

    if (filtrados.length === 0) {
        resultados.innerHTML = `
            <div class="item-produto-busca">
                Nenhum produto encontrado.
            </div>
        `;
        return;
    }

    filtrados.slice(0, 12).forEach(produto => {
        const unidade = normalizarUnidadeMedidaVenda(produto.unidade_medida);
        const fracionado = produtoPermiteFracionadoVenda(produto);

        resultados.innerHTML += `
            <div class="item-produto-busca" onclick="adicionarProdutoCarrinho(${produto.id})">
                <strong>${produto.nome}</strong>
                <span>
                    Código: ${produto.codigo || '-'} |
                    Categoria: ${produto.categoria || '-'} |
                    Preço: ${formatarPrecoComUnidadeVenda(produto.preco, unidade)} |
                    Estoque: ${formatarQuantidadeComUnidadeVenda(produto.estoque, unidade)} |
                    Fracionado: ${fracionado ? 'Sim' : 'Não'}
                    ${produto.descricao ? ` | Obs.: ${produto.descricao}` : ''}
                </span>
            </div>
        `;
    });
}

function pesquisarClienteVenda() {
    const busca = normalizarTextoBusca(document.getElementById('clienteVenda').value);
    const resultados = document.getElementById('resultadosClientesVenda');
    const infoCliente = document.getElementById('clienteSelecionadoInfo');

    resultados.innerHTML = '';
    resultados.classList.remove('ativo');
    resultados.style.display = 'none';

    if (busca.length < 1) {
        esconderClienteSelecionado();
        return;
    }

    const filtrados = clientesVenda.filter(cliente =>
        campoComecaComBusca(cliente.nome, busca) ||
        campoComecaComBusca(cliente.telefone, busca) ||
        campoComecaComBusca(cliente.cidade, busca)
    );

    if (filtrados.length === 0) {
        resultados.innerHTML = '';
        resultados.classList.remove('ativo');
        resultados.style.display = 'none';

        infoCliente.style.display = 'block';
        infoCliente.innerHTML = `
            <strong>Cliente novo:</strong><br>
            Este cliente ainda não está cadastrado. Ao finalizar a venda a prazo, ele será salvo automaticamente.
        `;

        return;
    }

    esconderClienteSelecionado();

    resultados.style.display = '';
    resultados.classList.add('ativo');

    filtrados.slice(0, 8).forEach(cliente => {
        resultados.innerHTML += `
            <div class="item-produto-busca" onclick="selecionarClienteVenda(${cliente.id})">
                <strong>${cliente.nome}</strong>
                <span>
                    Telefone: ${cliente.telefone || '-'} |
                    Cidade: ${cliente.cidade || '-'}
                </span>
            </div>
        `;
    });
}

function selecionarClienteVenda(id) {
    const cliente = clientesVenda.find(item => compararIds(item.id, id));

    if (!cliente) return;

    document.getElementById('clienteVenda').value = cliente.nome || '';
    document.getElementById('telefoneClienteVenda').value = cliente.telefone || '';
    document.getElementById('cidadeClienteVenda').value = cliente.cidade || '';

    document.getElementById('resultadosClientesVenda').innerHTML = '';
    document.getElementById('resultadosClientesVenda').classList.remove('ativo');
    document.getElementById('resultadosClientesVenda').style.display = 'none';

    document.getElementById('clienteSelecionadoInfo').style.display = 'block';
    document.getElementById('clienteSelecionadoInfo').innerHTML = `
        <strong>Cliente selecionado:</strong><br>
        ${cliente.nome || '-'}<br>
        Telefone: ${cliente.telefone || '-'} |
        Cidade: ${cliente.cidade || '-'}
    `;
}

function esconderClienteSelecionado() {
    const info = document.getElementById('clienteSelecionadoInfo');

    if (!info) return;

    info.style.display = 'none';
    info.innerHTML = '';
}

function pesquisarClienteAbatimentoVenda() {
    const busca = normalizarTextoBusca(document.getElementById('clienteAbatimentoVenda').value);
    const resultados = document.getElementById('resultadosClientesAbatimentoVenda');
    const infoCliente = document.getElementById('clienteAbatimentoSelecionadoInfo');

    resultados.innerHTML = '';
    resultados.style.display = 'none';

    if (busca.length < 1) {
        esconderClienteAbatimentoSelecionado();
        return;
    }

    const filtrados = clientesVenda.filter(cliente =>
        campoComecaComBusca(cliente.nome, busca) ||
        campoComecaComBusca(cliente.telefone, busca) ||
        campoComecaComBusca(cliente.cidade, busca)
    );

    if (filtrados.length === 0) {
        resultados.innerHTML = '';
        resultados.style.display = 'none';

        infoCliente.style.display = 'block';
        infoCliente.innerHTML = `
            <strong>Cliente não encontrado no cadastro:</strong><br>
            Você pode continuar mesmo assim. O nome ficará registrado na venda como abatimento de dívida.
        `;

        return;
    }

    esconderClienteAbatimentoSelecionado();

    resultados.style.display = 'block';

    filtrados.slice(0, 8).forEach(cliente => {
        resultados.innerHTML += `
            <div class="item-produto-busca" onclick="selecionarClienteAbatimentoVenda(${cliente.id})">
                <strong>${cliente.nome}</strong>
                <span>
                    Telefone: ${cliente.telefone || '-'} |
                    Cidade: ${cliente.cidade || '-'}
                </span>
            </div>
        `;
    });
}

function selecionarClienteAbatimentoVenda(id) {
    const cliente = clientesVenda.find(item => compararIds(item.id, id));

    if (!cliente) return;

    document.getElementById('clienteAbatimentoVenda').value = cliente.nome || '';
    document.getElementById('telefoneClienteAbatimentoVenda').value = cliente.telefone || '';
    document.getElementById('cidadeClienteAbatimentoVenda').value = cliente.cidade || '';

    document.getElementById('resultadosClientesAbatimentoVenda').innerHTML = '';
    document.getElementById('resultadosClientesAbatimentoVenda').style.display = 'none';

    document.getElementById('clienteAbatimentoSelecionadoInfo').style.display = 'block';
    document.getElementById('clienteAbatimentoSelecionadoInfo').innerHTML = `
        <strong>Cliente selecionado para abatimento:</strong><br>
        ${cliente.nome || '-'}<br>
        Telefone: ${cliente.telefone || '-'} |
        Cidade: ${cliente.cidade || '-'}
    `;
}

function esconderClienteAbatimentoSelecionado() {
    const info = document.getElementById('clienteAbatimentoSelecionadoInfo');

    if (!info) return;

    info.style.display = 'none';
    info.innerHTML = '';
}

function pesquisarClienteEntregaVenda() {
    const busca = normalizarTextoBusca(document.getElementById('clienteEntregaVenda').value);
    const resultados = document.getElementById('resultadosClientesEntregaVenda');
    const infoCliente = document.getElementById('clienteEntregaSelecionadoInfo');

    resultados.innerHTML = '';
    resultados.style.display = 'none';

    if (busca.length < 1) {
        esconderClienteEntregaSelecionado();
        return;
    }

    const filtrados = clientesVenda.filter(cliente =>
        campoComecaComBusca(cliente.nome, busca) ||
        campoComecaComBusca(cliente.telefone, busca) ||
        campoComecaComBusca(cliente.cidade, busca)
    );

    if (filtrados.length === 0) {
        resultados.innerHTML = '';
        resultados.style.display = 'none';

        infoCliente.style.display = 'block';
        infoCliente.innerHTML = `
            <strong>Cliente novo:</strong><br>
            Este cliente será salvo automaticamente ao finalizar a venda com entrega.
        `;

        return;
    }

    esconderClienteEntregaSelecionado();

    resultados.style.display = 'block';

    filtrados.slice(0, 8).forEach(cliente => {
        resultados.innerHTML += `
            <div class="item-produto-busca" onclick="selecionarClienteEntregaVenda(${cliente.id})">
                <strong>${cliente.nome}</strong>
                <span>
                    Telefone: ${cliente.telefone || '-'} |
                    Cidade: ${cliente.cidade || '-'}
                </span>
            </div>
        `;
    });
}

function selecionarClienteEntregaVenda(id) {
    const cliente = clientesVenda.find(item => compararIds(item.id, id));

    if (!cliente) return;

    document.getElementById('clienteEntregaVenda').value = cliente.nome || '';
    document.getElementById('telefoneEntregaVenda').value = cliente.telefone || '';
    document.getElementById('bairroCidadeEntregaVenda').value = cliente.cidade || '';
    document.getElementById('enderecoEntregaVenda').value = cliente.endereco || '';

    document.getElementById('resultadosClientesEntregaVenda').innerHTML = '';
    document.getElementById('resultadosClientesEntregaVenda').style.display = 'none';

    document.getElementById('clienteEntregaSelecionadoInfo').style.display = 'block';
    document.getElementById('clienteEntregaSelecionadoInfo').innerHTML = `
        <strong>Cliente selecionado para entrega:</strong><br>
        ${cliente.nome || '-'}<br>
        Telefone: ${cliente.telefone || '-'} |
        Cidade: ${cliente.cidade || '-'}
    `;
}

function esconderClienteEntregaSelecionado() {
    const info = document.getElementById('clienteEntregaSelecionadoInfo');

    if (!info) return;

    info.style.display = 'none';
    info.innerHTML = '';
}

function pesquisarCidadeVenda() {
    const busca = normalizarTextoBusca(document.getElementById('cidadeClienteVenda').value);
    const resultados = document.getElementById('resultadosCidadesVenda');

    resultados.innerHTML = '';
    resultados.style.display = 'none';

    if (busca.length < 1) return;

    const filtradas = cidadesRegiao.filter(cidade =>
        campoComecaComBusca(cidade, busca)
    );

    if (filtradas.length === 0) {
        resultados.style.display = 'block';
        resultados.innerHTML = `
            <div class="item-produto-busca">
                Cidade não encontrada na lista. Você pode continuar digitando manualmente.
            </div>
        `;
        return;
    }

    resultados.style.display = 'block';

    filtradas.slice(0, 8).forEach(cidade => {
        resultados.innerHTML += `
            <div class="item-produto-busca" onclick="selecionarCidadeVenda('${cidade}')">
                <strong>${cidade}</strong>
            </div>
        `;
    });
}

function selecionarCidadeVenda(cidade) {
    document.getElementById('cidadeClienteVenda').value = cidade;
    document.getElementById('resultadosCidadesVenda').innerHTML = '';
    document.getElementById('resultadosCidadesVenda').style.display = 'none';
}

function pesquisarCidadeAbatimentoVenda() {
    const busca = normalizarTextoBusca(document.getElementById('cidadeClienteAbatimentoVenda').value);
    const resultados = document.getElementById('resultadosCidadesAbatimentoVenda');

    resultados.innerHTML = '';
    resultados.style.display = 'none';

    if (busca.length < 1) return;

    const filtradas = cidadesRegiao.filter(cidade =>
        campoComecaComBusca(cidade, busca)
    );

    if (filtradas.length === 0) {
        resultados.style.display = 'block';
        resultados.innerHTML = `
            <div class="item-produto-busca">
                Cidade não encontrada na lista. Você pode continuar digitando manualmente.
            </div>
        `;
        return;
    }

    resultados.style.display = 'block';

    filtradas.slice(0, 8).forEach(cidade => {
        resultados.innerHTML += `
            <div class="item-produto-busca" onclick="selecionarCidadeAbatimentoVenda('${cidade}')">
                <strong>${cidade}</strong>
            </div>
        `;
    });
}

function selecionarCidadeAbatimentoVenda(cidade) {
    document.getElementById('cidadeClienteAbatimentoVenda').value = cidade;
    document.getElementById('resultadosCidadesAbatimentoVenda').innerHTML = '';
    document.getElementById('resultadosCidadesAbatimentoVenda').style.display = 'none';
}

function pesquisarCidadeEntregaVenda() {
    const busca = normalizarTextoBusca(document.getElementById('bairroCidadeEntregaVenda').value);
    const resultados = document.getElementById('resultadosCidadesEntregaVenda');

    resultados.innerHTML = '';
    resultados.style.display = 'none';

    if (busca.length < 1) return;

    const filtradas = cidadesRegiao.filter(cidade =>
        campoComecaComBusca(cidade, busca)
    );

    if (filtradas.length === 0) {
        resultados.style.display = 'block';
        resultados.innerHTML = `
            <div class="item-produto-busca">
                Cidade não encontrada na lista. Você pode continuar digitando manualmente.
            </div>
        `;
        return;
    }

    resultados.style.display = 'block';

    filtradas.slice(0, 8).forEach(cidade => {
        resultados.innerHTML += `
            <div class="item-produto-busca" onclick="selecionarCidadeEntregaVenda('${cidade}')">
                <strong>${cidade}</strong>
            </div>
        `;
    });
}

function selecionarCidadeEntregaVenda(cidade) {
    document.getElementById('bairroCidadeEntregaVenda').value = cidade;
    document.getElementById('resultadosCidadesEntregaVenda').innerHTML = '';
    document.getElementById('resultadosCidadesEntregaVenda').style.display = 'none';
}

function adicionarProdutoCarrinho(id) {
    const produto = produtosVenda.find(item => compararIds(item.id, id));

    if (!produto) return;

    if (produto.ativo === 0) {
        mostrarMensagemSistema('Produto desativado.', 'aviso');
        return;
    }

    if (Number(produto.estoque) <= 0) {
        mostrarMensagemSistema('Produto sem estoque.', 'aviso');
        return;
    }

    const existente = carrinho.find(item => compararIds(item.id, id));

    if (existente) {
        existente.quantidade += 1;
    } else {
        carrinho.push({
            id: produto.id,
            nome: produto.nome,
            unidade_medida: normalizarUnidadeMedidaVenda(produto.unidade_medida),
            permite_fracionado: Number(produto.permite_fracionado || 0),
            preco_original: Number(produto.preco || 0),
            preco: Number(produto.preco || 0),
            quantidade: 1
        });
    }

    document.getElementById('produtoBuscaVenda').value = '';
    document.getElementById('resultadosProdutosVenda').innerHTML = '';

    renderizarCarrinho();
}

function alterarQuantidade(id, novaQuantidade) {
    const item = carrinho.find(produto => compararIds(produto.id, id));

    if (!item) return;

    const quantidade = converterQuantidadeVenda(novaQuantidade);

    if (quantidade <= 0) {
        carrinho = carrinho.filter(produto => produto.id !== id);
        renderizarCarrinho();
        return;
    }

    if (!validarQuantidadeProdutoVenda(item, quantidade)) {
        renderizarCarrinho();
        return;
    }

    item.quantidade = quantidade;
    renderizarCarrinho();
}

function alterarPrecoUnitario(id, novoPreco) {
    const item = carrinho.find(produto => compararIds(produto.id, id));

    if (!item) return;

    const preco = converterNumero(novoPreco);

    if (preco < 0) {
        mostrarMensagemSistema('Informe um preço válido.', 'aviso');
        renderizarCarrinho();
        return;
    }

    item.preco = preco;
    renderizarCarrinho();
}

function removerItem(id) {
    carrinho = carrinho.filter(item => item.id !== id);
    renderizarCarrinho();
}

function calcularSubtotalVenda() {
    return arredondarMoeda(carrinho.reduce((total, item) => {
        return total + (Number(item.quantidade || 0) * Number(item.preco || 0));
    }, 0));
}

function calcularDescontoGeral() {
    const campoDesconto = document.getElementById('descontoVendaGeral');

    if (!campoDesconto) return 0;

    return arredondarMoeda(Math.max(0, converterNumero(campoDesconto.value)));
}

function calcularFreteEntrega() {
    const campoFrete = document.getElementById('freteEntregaVenda');

    if (!entregaAtiva() || !campoFrete) return 0;

    return arredondarMoeda(Math.max(0, converterNumero(campoFrete.value)));
}

function calcularTotalVenda() {
    const subtotal = calcularSubtotalVenda();
    const desconto = Math.min(calcularDescontoGeral(), subtotal);
    const frete = calcularFreteEntrega();

    return arredondarMoeda(subtotal - desconto + frete);
}

function atualizarCarrinho() {
    renderizarCarrinho();
}

function calcularTroco() {
    const valorRecebidoInput = document.getElementById('valorRecebido');
    const trocoInput = document.getElementById('trocoVenda');

    if (!valorRecebidoInput || !trocoInput) return;

    const valorRecebido = converterNumero(valorRecebidoInput.value);
    const total = calcularTotalVenda();
    const troco = valorRecebido - total;

    trocoInput.value = troco > 0 ? formatarMoeda(troco) : formatarMoeda(0);
}

function renderizarCarrinho() {
    const tabela = document.getElementById('tabelaCarrinho');
    tabela.innerHTML = '';

    if (carrinho.length === 0) {
        tabela.innerHTML = `
            <tr>
                <td colspan="6">Nenhum produto no carrinho.</td>
            </tr>
        `;
    }

    carrinho.forEach(item => {
        const totalItem = arredondarMoeda(Number(item.quantidade || 0) * Number(item.preco || 0));
        const precoOriginal = Number(item.preco_original || item.preco || 0);
        const precoVendido = Number(item.preco || 0);
        const temDescontoItem = precoVendido < precoOriginal;
        const unidade = normalizarUnidadeMedidaVenda(item.unidade_medida);

        tabela.innerHTML += `
            <tr>
                <td>${item.nome}</td>
                <td>
                    <input
                        value="${formatarQuantidadeVenda(item.quantidade)}"
                        onchange="alterarQuantidade(${item.id}, this.value)"
                        style="max-width:90px;"
                    >
                    <small>${unidade}</small>
                </td>
                <td>${formatarPrecoComUnidadeVenda(precoOriginal, unidade)}</td>
                <td>
                    <input
                        value="${String(precoVendido).replace('.', ',')}"
                        onchange="alterarPrecoUnitario(${item.id}, this.value)"
                        style="max-width:120px;"
                    >
                    <small>/${unidade}</small>
                    ${temDescontoItem ? `<br><small>Desconto no item</small>` : ''}
                </td>
                <td>${formatarMoeda(totalItem)}</td>
                <td>
                    <button onclick="removerItem(${item.id})">Remover</button>
                </td>
            </tr>
        `;
    });

    const subtotalVenda = calcularSubtotalVenda();
    const descontoVenda = calcularDescontoGeral();
    const totalVenda = calcularTotalVenda();

    const subtotalElemento = document.getElementById('subtotalVenda');
    if (subtotalElemento) {
        subtotalElemento.textContent = formatarMoeda(subtotalVenda);
    }

    const totalElemento = document.getElementById('totalVenda');
    if (totalElemento) {
        totalElemento.textContent = formatarMoeda(totalVenda);
    }

    const totalFinalizacao = document.getElementById('totalVendaFinalizacao');
    if (totalFinalizacao) {
        totalFinalizacao.textContent = formatarMoeda(totalVenda);
    }

    const campoDesconto = document.getElementById('descontoVendaGeral');
    if (campoDesconto && descontoVenda > subtotalVenda && subtotalVenda > 0) {
        campoDesconto.style.borderColor = '#c0392b';
    } else if (campoDesconto) {
        campoDesconto.style.borderColor = '';
    }

    if (document.getElementById('formaPagamento').value === 'DINHEIRO') {
        calcularTroco();
    }
}

function entregaAtiva() {
    const checkbox = document.getElementById('temEntregaVenda');
    return !!(checkbox && checkbox.checked);
}

function pagamentoEntregaSelecionado() {
    const campo = document.getElementById('pagamentoEntregaVenda');
    return campo ? campo.value : 'PAGO_NA_COMPRA';
}

function pagamentoControladoPelaEntrega() {
    if (!entregaAtiva()) return false;

    const pagamentoEntrega = pagamentoEntregaSelecionado();

    return pagamentoEntrega === 'A_RECEBER_NA_ENTREGA' || pagamentoEntrega === 'FIADO';
}

function verificarEntregaVenda() {
    const ativo = entregaAtiva();
    const area = document.getElementById('areaEntregaVenda');

    if (!area) return;

    area.style.display = ativo ? 'block' : 'none';

    if (!ativo) {
        document.getElementById('clienteEntregaVenda').value = '';
        document.getElementById('telefoneEntregaVenda').value = '';
        document.getElementById('bairroCidadeEntregaVenda').value = '';
        document.getElementById('enderecoEntregaVenda').value = '';
        document.getElementById('observacaoEntregaVenda').value = '';
        document.getElementById('freteEntregaVenda').value = '';
        document.getElementById('pagamentoEntregaVenda').value = 'PAGO_NA_COMPRA';

        document.getElementById('resultadosClientesEntregaVenda').innerHTML = '';
        document.getElementById('resultadosClientesEntregaVenda').style.display = 'none';

        document.getElementById('resultadosCidadesEntregaVenda').innerHTML = '';
        document.getElementById('resultadosCidadesEntregaVenda').style.display = 'none';

        esconderClienteEntregaSelecionado();
    }

    verificarPagamentoEntrega();
}

function verificarPagamentoEntrega() {
    const aviso = document.getElementById('avisoPagamentoEntrega');
    const formaPagamento = document.getElementById('formaPagamento');
    const pagamentoEntrega = pagamentoEntregaSelecionado();

    if (!aviso || !formaPagamento) return;

    const formaEstavaControladaPelaEntrega = formaPagamento.disabled;

    aviso.style.display = 'none';
    aviso.innerHTML = '';

    formaPagamento.disabled = false;

    if (
        entregaAtiva() &&
        pagamentoEntrega === 'PAGO_NA_COMPRA' &&
        formaEstavaControladaPelaEntrega &&
        formaPagamento.value === 'FIADO'
    ) {
        formaPagamento.value = 'DINHEIRO';
    }

    if (entregaAtiva() && pagamentoEntrega === 'A_RECEBER_NA_ENTREGA') {
        formaPagamento.value = 'DINHEIRO';
        formaPagamento.disabled = true;

        aviso.style.display = 'block';
        aviso.innerHTML = `
            <strong>Pagamento na entrega:</strong><br>
            O estoque será baixado agora, a venda será registrada, mas o valor só entrará no financeiro quando for recebido na aba Entregas.
        `;
    }

    if (entregaAtiva() && pagamentoEntrega === 'FIADO') {
        formaPagamento.value = 'FIADO';
        formaPagamento.disabled = true;

        aviso.style.display = 'block';
        aviso.innerHTML = `
            <strong>Entrega a prazo:</strong><br>
            O estoque será baixado agora, a venda será lançada no A Prazo do cliente e a entrega ficará pendente na aba Entregas.
        `;
    }

    verificarFormaPagamento();
}

function verificarFormaPagamento() {
    const formaPagamentoSelect = document.getElementById('formaPagamento');
    const forma = formaPagamentoSelect.value;

    if (entregaAtiva() && pagamentoEntregaSelecionado() === 'PAGO_NA_COMPRA' && forma === 'FIADO') {
        document.getElementById('pagamentoEntregaVenda').value = 'FIADO';
        verificarPagamentoEntrega();
        return;
    }

    const areaDinheiro = document.getElementById('areaDinheiro');
    const areaFiado = document.getElementById('areaFiado');
    const areaAbatimento = document.getElementById('areaAbatimento');

    const cliente = document.getElementById('clienteVenda');
    const telefone = document.getElementById('telefoneClienteVenda');
    const cidade = document.getElementById('cidadeClienteVenda');

    const clienteAbatimento = document.getElementById('clienteAbatimentoVenda');
    const telefoneAbatimento = document.getElementById('telefoneClienteAbatimentoVenda');
    const cidadeAbatimento = document.getElementById('cidadeClienteAbatimentoVenda');
    const observacaoAbatimento = document.getElementById('observacaoAbatimentoVenda');

    const valorRecebido = document.getElementById('valorRecebido');
    const troco = document.getElementById('trocoVenda');
    const tipoCartao = document.getElementById('tipoCartao');
    const labelTipoCartao = document.getElementById('labelTipoCartao');

    const resultadosClientes = document.getElementById('resultadosClientesVenda');
    const resultadosCidades = document.getElementById('resultadosCidadesVenda');
    const resultadosClientesAbatimento = document.getElementById('resultadosClientesAbatimentoVenda');
    const resultadosCidadesAbatimento = document.getElementById('resultadosCidadesAbatimentoVenda');
    const camposDinheiroVenda = document.querySelectorAll('#areaDinheiro .campo-dinheiro-venda');

    areaDinheiro.style.display = 'grid';
    areaFiado.style.display = 'none';
    areaAbatimento.style.display = 'none';
    camposDinheiroVenda.forEach(campo => {
        campo.style.display = 'none';
    });

    tipoCartao.style.display = 'none';
    labelTipoCartao.style.display = 'none';

    resultadosClientes.classList.remove('ativo');
    resultadosClientes.style.display = 'none';
    resultadosCidades.style.display = 'none';
    resultadosClientesAbatimento.style.display = 'none';
    resultadosCidadesAbatimento.style.display = 'none';

    esconderClienteSelecionado();
    esconderClienteAbatimentoSelecionado();

    cliente.value = '';
    telefone.value = '';
    cidade.value = '';

    clienteAbatimento.value = '';
    telefoneAbatimento.value = '';
    cidadeAbatimento.value = '';
    observacaoAbatimento.value = '';

    valorRecebido.value = '';
    troco.value = '';
    tipoCartao.value = '';

    if (pagamentoControladoPelaEntrega()) {
        renderizarCarrinho();
        return;
    }

    if (forma === 'DINHEIRO') {
        camposDinheiroVenda.forEach(campo => {
            campo.style.display = '';
        });
        calcularTroco();
    }

    if (forma === 'CARTAO') {
        tipoCartao.style.display = 'block';
        labelTipoCartao.style.display = 'block';
    }

    if (forma === 'FIADO') {
        areaFiado.style.display = 'grid';
    }

    if (forma === 'ABATIMENTO_DIVIDA') {
        areaAbatimento.style.display = 'grid';
    }

    renderizarCarrinho();
}

async function finalizarVenda() {
    const forma_pagamento_campo = document.getElementById('formaPagamento').value;
    const tipo_cartao = document.getElementById('tipoCartao').value;

    let cliente_nome = '';
    let cliente_telefone = '';
    let cliente_cidade = '';
    let observacao = '';

    const temEntrega = entregaAtiva();
    const pagamentoEntrega = pagamentoEntregaSelecionado();

    const valorRecebido = converterNumero(document.getElementById('valorRecebido').value);
    const subtotal = calcularSubtotalVenda();
    const desconto = calcularDescontoGeral();
    const total = calcularTotalVenda();

    let entrega = null;

    if (temEntrega) {
        const clienteEntrega = document.getElementById('clienteEntregaVenda').value.trim();
        const telefoneEntrega = document.getElementById('telefoneEntregaVenda').value.trim();
        const bairroCidadeEntrega = document.getElementById('bairroCidadeEntregaVenda').value.trim();
        const enderecoEntrega = document.getElementById('enderecoEntregaVenda').value.trim();
        const observacaoEntrega = document.getElementById('observacaoEntregaVenda').value.trim();
        const freteEntrega = calcularFreteEntrega();

        if (!clienteEntrega) {
            mostrarMensagemSistema('Informe o cliente da entrega.', 'aviso');
            return;
        }

        if (!enderecoEntrega) {
            mostrarMensagemSistema('Informe o endereço da entrega.', 'aviso');
            return;
        }

        entrega = {
            tem_entrega: true,
            cliente_nome: clienteEntrega,
            telefone: telefoneEntrega,
            endereco: enderecoEntrega,
            bairro_cidade: bairroCidadeEntrega,
            observacao: observacaoEntrega,
            frete: freteEntrega,
            status_pagamento: pagamentoEntrega
        };

        if (pagamentoEntrega === 'FIADO') {
            cliente_nome = clienteEntrega;
            cliente_telefone = telefoneEntrega;
            cliente_cidade = bairroCidadeEntrega;
            observacao = observacaoEntrega || 'Venda a prazo com entrega';
        }

        if (pagamentoEntrega === 'A_RECEBER_NA_ENTREGA') {
            cliente_nome = clienteEntrega;
            cliente_telefone = telefoneEntrega;
            cliente_cidade = bairroCidadeEntrega;
            observacao = observacaoEntrega || 'Venda para receber na entrega';
        }
    }

    if (!pagamentoControladoPelaEntrega()) {
        if (forma_pagamento_campo === 'FIADO') {
            cliente_nome = document.getElementById('clienteVenda').value.trim();
            cliente_telefone = document.getElementById('telefoneClienteVenda').value.trim();
            cliente_cidade = document.getElementById('cidadeClienteVenda').value.trim();
        }

        if (forma_pagamento_campo === 'ABATIMENTO_DIVIDA') {
            cliente_nome = document.getElementById('clienteAbatimentoVenda').value.trim();
            cliente_telefone = document.getElementById('telefoneClienteAbatimentoVenda').value.trim();
            cliente_cidade = document.getElementById('cidadeClienteAbatimentoVenda').value.trim();
            observacao = document.getElementById('observacaoAbatimentoVenda').value.trim();
        }
    }

    if (carrinho.length === 0) {
        mostrarMensagemSistema('Adicione pelo menos um produto.', 'aviso');
        return;
    }

    const itemFracionadoInvalido = carrinho.find(item => {
        return !produtoPermiteFracionadoVenda(item) && !quantidadeEhInteiraVenda(item.quantidade);
    });

    if (itemFracionadoInvalido) {
        mostrarMensagemSistema(`Este produto não permite venda fracionada: ${itemFracionadoInvalido.nome}.`, 'aviso');
        return;
    }

    if (subtotal <= 0) {
        mostrarMensagemSistema('Total da venda inválido.', 'erro');
        return;
    }

    if (desconto > subtotal) {
        mostrarMensagemSistema('O desconto não pode ser maior que o subtotal da venda.', 'aviso');
        return;
    }

    if (total <= 0) {
        mostrarMensagemSistema('O total final da venda precisa ser maior que zero.', 'aviso');
        return;
    }

    if (!pagamentoControladoPelaEntrega() && forma_pagamento_campo === 'FIADO' && !cliente_nome) {
        mostrarMensagemSistema('Informe o nome do cliente para venda a prazo.', 'aviso');
        return;
    }

    if (!pagamentoControladoPelaEntrega() && forma_pagamento_campo === 'ABATIMENTO_DIVIDA' && !cliente_nome) {
        mostrarMensagemSistema('Informe o nome do cliente do abatimento.', 'aviso');
        return;
    }

    if (!pagamentoControladoPelaEntrega() && forma_pagamento_campo === 'ABATIMENTO_DIVIDA' && !observacao) {
        mostrarMensagemSistema('Informe a observação do abatimento de dívida.', 'aviso');
        return;
    }

    if (!pagamentoControladoPelaEntrega() && forma_pagamento_campo === 'DINHEIRO' && valorRecebido < total) {
        mostrarMensagemSistema('Valor recebido menor que o total da venda.', 'aviso');
        return;
    }

    if (!pagamentoControladoPelaEntrega() && forma_pagamento_campo === 'CARTAO' && !tipo_cartao) {
        mostrarMensagemSistema('Selecione se o cartão é crédito ou débito.', 'aviso');
        return;
    }

    const janelaComprovante = window.open('', '_blank');

    if (!janelaComprovante) {
        mostrarMensagemSistema('O navegador bloqueou a impressão. Libere pop-ups para este sistema antes de finalizar a venda.', 'aviso');
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

    let descricaoPagamento = forma_pagamento_campo === 'CARTAO'
        ? `CARTAO_${tipo_cartao}`
        : forma_pagamento_campo;

    if (temEntrega && pagamentoEntrega === 'A_RECEBER_NA_ENTREGA') {
        descricaoPagamento = 'A_RECEBER_ENTREGA';
    }

    if (temEntrega && pagamentoEntrega === 'FIADO') {
        descricaoPagamento = 'FIADO';
    }

    const trocoPrevisto = descricaoPagamento === 'DINHEIRO'
        ? Math.max(valorRecebido - total, 0)
        : 0;

    const itensComprovante = carrinho.map(item => ({
        nome: item.nome,
        quantidade: item.quantidade,
        unidade_medida: normalizarUnidadeMedidaVenda(item.unidade_medida),
        permite_fracionado: Number(item.permite_fracionado || 0),
        preco_original: Number(item.preco_original || item.preco || 0),
        preco: Number(item.preco || 0),
        total: arredondarMoeda(Number(item.quantidade || 0) * Number(item.preco || 0))
    }));

    try {
        const resposta = await fetch('/vendas', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                forma_pagamento: descricaoPagamento,
                cliente_nome,
                cliente_telefone,
                cliente_cidade,
                observacao,
                entrega,
                desconto,
                valor_recebido: descricaoPagamento === 'DINHEIRO' ? valorRecebido : 0,
                troco: trocoPrevisto,
                itens: carrinho.map(item => ({
                    id: item.id,
                    nome: item.nome,
                    quantidade: item.quantidade,
                    unidade_medida: normalizarUnidadeMedidaVenda(item.unidade_medida),
                    permite_fracionado: Number(item.permite_fracionado || 0),
                    preco_original: Number(item.preco_original || item.preco || 0),
                    preco: Number(item.preco || 0)
                }))
            })
        });

        const textoResposta = await resposta.text();
        let dados = {};

        try {
            dados = textoResposta ? JSON.parse(textoResposta) : {};
        } catch (erroJson) {
            dados = { erro: textoResposta };
        }

        if (!resposta.ok || !dados.sucesso) {
            janelaComprovante.close();
            mostrarMensagemSistema(dados.erro || dados.message || 'Erro ao finalizar venda.', 'erro');
            return;
        }

        ultimaVendaComprovante = {
            venda_id: dados.venda_id,
            data: new Date().toLocaleDateString('pt-BR'),
            hora: new Date().toLocaleTimeString('pt-BR'),
            forma_pagamento: descricaoPagamento,
            cliente_nome,
            cliente_telefone,
            cliente_cidade,
            observacao,
            entrega,
            itens: itensComprovante,
            subtotal: Number(dados.subtotal || subtotal),
            desconto: Number(dados.desconto || desconto),
            frete: Number(dados.frete || 0),
            total: Number(dados.total || total),
            valor_recebido: descricaoPagamento === 'DINHEIRO' ? valorRecebido : 0,
            troco: trocoPrevisto
        };

        const areaComprovante = document.getElementById('areaComprovanteVenda');
        if (areaComprovante) {
            areaComprovante.style.display = 'block';
        }

        imprimirComprovanteVenda(janelaComprovante);

        carrinho = [];

        document.getElementById('clienteVenda').value = '';
        document.getElementById('telefoneClienteVenda').value = '';
        document.getElementById('cidadeClienteVenda').value = '';

        document.getElementById('clienteAbatimentoVenda').value = '';
        document.getElementById('telefoneClienteAbatimentoVenda').value = '';
        document.getElementById('cidadeClienteAbatimentoVenda').value = '';
        document.getElementById('observacaoAbatimentoVenda').value = '';

        document.getElementById('clienteEntregaVenda').value = '';
        document.getElementById('telefoneEntregaVenda').value = '';
        document.getElementById('bairroCidadeEntregaVenda').value = '';
        document.getElementById('enderecoEntregaVenda').value = '';
        document.getElementById('observacaoEntregaVenda').value = '';
        document.getElementById('freteEntregaVenda').value = '';
        document.getElementById('pagamentoEntregaVenda').value = 'PAGO_NA_COMPRA';
        document.getElementById('temEntregaVenda').checked = false;

        const campoDesconto = document.getElementById('descontoVendaGeral');
        if (campoDesconto) {
            campoDesconto.value = '';
        }

        document.getElementById('valorRecebido').value = '';
        document.getElementById('trocoVenda').value = '';
        document.getElementById('tipoCartao').value = '';
        document.getElementById('formaPagamento').disabled = false;
        document.getElementById('formaPagamento').value = 'DINHEIRO';

        document.getElementById('resultadosClientesVenda').innerHTML = '';
        document.getElementById('resultadosClientesVenda').classList.remove('ativo');
        document.getElementById('resultadosClientesVenda').style.display = 'none';
        document.getElementById('resultadosCidadesVenda').innerHTML = '';
        document.getElementById('resultadosClientesAbatimentoVenda').innerHTML = '';
        document.getElementById('resultadosCidadesAbatimentoVenda').innerHTML = '';
        document.getElementById('resultadosClientesEntregaVenda').innerHTML = '';
        document.getElementById('resultadosCidadesEntregaVenda').innerHTML = '';

        esconderClienteSelecionado();
        esconderClienteAbatimentoSelecionado();
        esconderClienteEntregaSelecionado();

        verificarEntregaVenda();
        verificarFormaPagamento();
        renderizarCarrinho();

        await carregarProdutosVenda();
        await carregarClientesVenda();

    } catch (erro) {
        janelaComprovante.close();
        mostrarMensagemSistema(erro.message || 'Erro ao finalizar venda. Verifique se o servidor está rodando.', 'erro');
    }
}

function configurarEventosVenda() {
    const valorRecebido = document.getElementById('valorRecebido');

    if (valorRecebido) {
        valorRecebido.addEventListener('input', calcularTroco);
        valorRecebido.addEventListener('keyup', calcularTroco);
        valorRecebido.addEventListener('change', calcularTroco);
    }
}

async function iniciarPagina() {
    await carregarProdutosVenda();
    await carregarClientesVenda();

    configurarEventosVenda();
    renderizarCarrinho();
    verificarEntregaVenda();
    verificarFormaPagamento();
}

function formatarFormaPagamento(forma) {
    const nomes = {
        DINHEIRO: 'Dinheiro',
        PIX: 'PIX',
        CARTAO_CREDITO: 'Cartão Crédito',
        CARTAO_DEBITO: 'Cartão Débito',
        FIADO: 'A Prazo',
        ABATIMENTO_DIVIDA: 'Abatimento de Dívida',
        A_RECEBER_ENTREGA: 'A receber na entrega',
        PAGO_NA_COMPRA: 'Pago durante a compra',
        A_RECEBER_NA_ENTREGA: 'A receber na entrega',
        RECEBIDO_NA_ENTREGA: 'Recebido na entrega'
    };

    return nomes[forma] || forma;
}

function escaparHtmlVenda(valor) {
    return String(valor || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function montarHtmlComprovanteVendaAPrazo(venda) {
    const freteEntrega = venda.entrega && venda.entrega.tem_entrega
        ? Number(venda.entrega.frete || venda.frete || 0)
        : 0;

    const subtotalComprovante = Number(venda.subtotal || 0);
    const descontoComprovante = Number(venda.desconto || 0);
    const totalComprovante = subtotalComprovante > 0
        ? arredondarMoeda(subtotalComprovante - descontoComprovante + freteEntrega)
        : Number(venda.total || 0);

    const linhasCliente = `
        <div class="linha"></div>
        <div class="secao-titulo">CLIENTE</div>
        <div><strong>Nome:</strong> ${escaparHtmlVenda(venda.cliente_nome || '-')}</div>
        ${venda.cliente_telefone ? `<div><strong>Telefone:</strong> ${escaparHtmlVenda(venda.cliente_telefone)}</div>` : ''}
        ${venda.cliente_cidade ? `<div><strong>Cidade:</strong> ${escaparHtmlVenda(venda.cliente_cidade)}</div>` : ''}
    `;

    const linhasEntrega = venda.entrega && venda.entrega.tem_entrega
        ? `
            <div class="linha"></div>
            <div class="secao-titulo">ENTREGA</div>
            <div><strong>Entrega:</strong> Sim</div>
            <div><strong>Endereço:</strong> ${escaparHtmlVenda(venda.entrega.endereco || '-')}</div>
            <div><strong>Bairro/Cidade:</strong> ${escaparHtmlVenda(venda.entrega.bairro_cidade || '-')}</div>
            ${freteEntrega > 0 ? `<div><strong>Frete:</strong> ${formatarMoeda(freteEntrega)}</div>` : ''}
            <div><strong>Pagamento:</strong> A Prazo</div>
            ${venda.entrega.observacao ? `<div><strong>Obs. entrega:</strong> ${escaparHtmlVenda(venda.entrega.observacao)}</div>` : ''}
        `
        : '';

    const linhasItens = venda.itens.map(item => {
        const unidade = normalizarUnidadeMedidaVenda(item.unidade_medida);
        const quantidade = formatarQuantidadeComUnidadeVenda(item.quantidade, unidade);
        const precoUnitario = Number(item.preco || 0);
        const totalItem = Number(item.total || 0);

        return `
            <div class="item">
                <div class="item-nome">${escaparHtmlVenda(item.nome)}</div>
                <div class="item-formula">
                    ${quantidade} x ${formatarMoeda(precoUnitario)}/${unidade} = ${formatarMoeda(totalItem)}
                </div>
            </div>
        `;
    }).join('');

    const linhaFrete = freteEntrega > 0
        ? `
            <div class="total-linha">
                <span>Frete</span>
                <strong>${formatarMoeda(freteEntrega)}</strong>
            </div>
        `
        : '';

    const linhaDesconto = descontoComprovante > 0
        ? `
            <div class="total-linha">
                <span>Desconto</span>
                <strong>- ${formatarMoeda(descontoComprovante)}</strong>
            </div>
        `
        : '';

    const linhaObservacao = venda.observacao
        ? `
            <div class="linha"></div>
            <div class="secao-titulo">OBSERVAÇÃO</div>
            <div>${escaparHtmlVenda(venda.observacao)}</div>
        `
        : '';

    return `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <title>Comprovante de Venda A Prazo - VALE AGRO</title>
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
                    font-weight: bold;
                    letter-spacing: 0.2px;
                }

                .centro {
                    text-align: center;
                    line-height: 1.35;
                }

                .linha {
                    border-top: 1px dashed #111;
                    margin: 8px 0;
                }

                .secao-titulo {
                    font-size: 10px;
                    font-weight: bold;
                    margin: 0 0 4px;
                }

                .item {
                    margin-bottom: 7px;
                    page-break-inside: avoid;
                }

                .item-nome {
                    font-weight: bold;
                    max-width: 100%;
                    overflow-wrap: break-word;
                    text-transform: uppercase;
                }

                .item-formula {
                    font-size: 10.5px;
                    line-height: 1.3;
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

                .aviso-fiscal {
                    text-align: center;
                    font-size: 10px;
                    line-height: 1.35;
                    margin-top: 8px;
                }

                .declaracao {
                    font-size: 10.5px;
                    line-height: 1.35;
                    margin-top: 8px;
                    text-align: center;
                }

                .assinatura {
                    margin-top: 8mm;
                    text-align: center;
                    font-size: 10.5px;
                }

                .assinatura-linha {
                    border-top: 1px solid #111;
                    margin: 8mm auto 0;
                    width: 58mm;
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
            <h2>COMPROVANTE DE VENDA A PRAZO</h2>

            <div class="centro">
                Venda Nº ${venda.venda_id || '-'}<br>
                ${venda.data} - ${venda.hora}
            </div>

            ${linhasCliente}
            ${linhasEntrega}

            <div class="linha"></div>
            <div class="secao-titulo">PRODUTOS</div>

            ${linhasItens}

            <div class="linha"></div>

            <div class="total-linha">
                <span>Subtotal</span>
                <strong>${formatarMoeda(subtotalComprovante || totalComprovante)}</strong>
            </div>

            ${linhaDesconto}
            ${linhaFrete}

            <div class="total-linha total-final">
                <span>TOTAL A PRAZO</span>
                <strong>${formatarMoeda(totalComprovante)}</strong>
            </div>

            ${linhaObservacao}

            <div class="linha"></div>

            <div class="aviso-fiscal">
                Documento sem valor fiscal
            </div>

            <div class="declaracao">
                Declaro estar ciente do valor acima lançado em minha conta A Prazo.
            </div>

            <div class="assinatura">
                <div>Assinatura do cliente:</div>
                <div class="assinatura-linha"></div>
            </div>

            <div class="rodape">
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

function montarHtmlComprovanteVenda(venda) {
    if (venda.forma_pagamento === 'FIADO') {
        return montarHtmlComprovanteVendaAPrazo(venda);
    }

    let linhasItens = '';

    venda.itens.forEach(item => {
        const precoOriginal = Number(item.preco_original || item.preco || 0);
        const precoVendido = Number(item.preco || 0);
        const temDescontoItem = precoVendido < precoOriginal;
        const unidade = normalizarUnidadeMedidaVenda(item.unidade_medida);

        linhasItens += `
            <div class="item">
                <div class="item-nome">${item.nome}</div>

                ${temDescontoItem ? `
                    <div class="item-linha item-desconto">
                        <span>Preço cadastrado: ${formatarMoeda(precoOriginal)}</span>
                        <strong></strong>
                    </div>
                ` : ''}

                <div class="item-linha">
                    <span>${formatarQuantidadeComUnidadeVenda(item.quantidade, unidade)} x ${formatarMoeda(precoVendido)}/${unidade}</span>
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
            <div><strong>Cliente:</strong> ${venda.cliente_nome || '-'}</div>
            <div><strong>Telefone:</strong> ${venda.cliente_telefone || '-'}</div>
            <div><strong>Cidade:</strong> ${venda.cliente_cidade || '-'}</div>
        `
        : '';

    const dadosAbatimento = venda.forma_pagamento === 'ABATIMENTO_DIVIDA'
        ? `
            <div class="linha"></div>
            <div><strong>Observação:</strong></div>
            <div>${venda.observacao || '-'}</div>
        `
        : '';

    const dadosEntrega = venda.entrega && venda.entrega.tem_entrega
        ? `
            <div class="linha"></div>
            <div><strong>Entrega:</strong> Sim</div>
            <div><strong>Cliente:</strong> ${venda.entrega.cliente_nome || '-'}</div>
            <div><strong>Telefone:</strong> ${venda.entrega.telefone || '-'}</div>
            <div><strong>Endereço:</strong> ${venda.entrega.endereco || '-'}</div>
            <div><strong>Bairro/Cidade:</strong> ${venda.entrega.bairro_cidade || '-'}</div>
            <div><strong>Pagamento:</strong> ${formatarFormaPagamento(venda.entrega.status_pagamento || '')}</div>
            ${venda.entrega.observacao ? `<div><strong>Obs. entrega:</strong> ${venda.entrega.observacao}</div>` : ''}
        `
        : '';

    const freteEntrega = venda.entrega && venda.entrega.tem_entrega
        ? converterNumero(venda.entrega.frete || venda.frete || 0)
        : 0;

    const linhaFrete = freteEntrega > 0
        ? `
            <div class="total-linha">
                <span>Frete</span>
                <strong>${formatarMoeda(freteEntrega)}</strong>
            </div>
        `
        : '';

    const subtotalComprovante = Number(venda.subtotal || 0);
    const descontoComprovante = Number(venda.desconto || 0);
    const totalComprovante = subtotalComprovante > 0
        ? arredondarMoeda(subtotalComprovante - descontoComprovante + freteEntrega)
        : Number(venda.total || 0);

    const dadosDinheiro = venda.forma_pagamento === 'DINHEIRO'
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
                <strong>${formatarMoeda(totalComprovante)}</strong>
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
                <strong>${formatarMoeda(subtotalComprovante || totalComprovante)}</strong>
            </div>

            ${linhaFrete}

            ${Number(venda.desconto || 0) > 0 ? `
                <div class="total-linha">
                    <span>Desconto</span>
                    <strong>- ${formatarMoeda(venda.desconto)}</strong>
                </div>
            ` : ''}

            <div class="total-linha total-final">
                <span>TOTAL</span>
                <strong>${formatarMoeda(totalComprovante)}</strong>
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

function imprimirComprovanteVenda(janelaExistente = null) {
    if (!ultimaVendaComprovante) {
        mostrarMensagemSistema('Nenhuma venda recente para imprimir.', 'aviso');
        return;
    }

    const janela = janelaExistente || window.open('', '_blank');

    if (!janela) {
        mostrarMensagemSistema('O navegador bloqueou a impressão. Libere pop-ups para este sistema.', 'aviso');
        return;
    }

    janela.document.open();
    janela.document.write(montarHtmlComprovanteVenda(ultimaVendaComprovante));
    janela.document.close();
}

iniciarPagina();
