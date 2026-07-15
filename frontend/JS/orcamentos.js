let produtosOrcamento = [];
let clientesOrcamento = [];
let itensOrcamento = [];
let listaOrcamentos = [];
let produtoSelecionadoOrcamento = null;
let orcamentoDetalheAtual = null;

function mostrarMensagemOrcamento(mensagem, tipo = 'info') {
    if (typeof window.mostrarMensagemSistema === 'function') {
        window.mostrarMensagemSistema(mensagem, tipo);
        return;
    }

    console[tipo === 'erro' ? 'error' : 'log'](mensagem);
}

async function confirmarAcaoOrcamento(opcoes) {
    if (typeof window.mostrarConfirmacaoSistema === 'function') {
        return window.mostrarConfirmacaoSistema(opcoes);
    }

    mostrarMensagemOrcamento('Confirmação indisponível. Recarregue a página e tente novamente.', 'erro');
    return false;
}

const cidadesRegiaoOrcamento = [
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

function converterNumeroOrcamento(valor) {
    if (valor === null || valor === undefined) return 0;

    const texto = String(valor)
        .replace(/[R$\s]/g, '')
        .replace(/\./g, '')
        .replace(',', '.');

    return Number(texto) || 0;
}

function converterQuantidadeOrcamento(valor) {
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

function formatarMoedaOrcamento(valor) {
    return Number(valor || 0).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
}

function formatarQuantidadeOrcamento(valor) {
    return Number(valor || 0).toLocaleString('pt-BR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 3
    });
}

function normalizarUnidadeMedidaOrcamento(valor) {
    const unidade = String(valor || 'UN').trim().toUpperCase();
    const unidadesValidas = ['UN', 'KG', 'G', 'L', 'ML', 'M'];

    return unidadesValidas.includes(unidade) ? unidade : 'UN';
}

function produtoPermiteFracionadoOrcamento(produto) {
    return Number(produto?.permite_fracionado || 0) === 1;
}

function quantidadeEhInteiraOrcamento(valor) {
    const numero = Number(valor || 0);

    return Math.abs(numero - Math.round(numero)) < 0.000001;
}

function formatarQuantidadeComUnidadeOrcamento(valor, unidade) {
    return `${formatarQuantidadeOrcamento(valor)} ${normalizarUnidadeMedidaOrcamento(unidade)}`;
}

function formatarPrecoComUnidadeOrcamento(valor, unidade) {
    return `${formatarMoedaOrcamento(valor)} / ${normalizarUnidadeMedidaOrcamento(unidade)}`;
}

function formatarDataOrcamento(data) {
    if (!data) return '-';

    const partes = String(data).split('-');

    if (partes.length !== 3) return data;

    return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function formatarHoraOrcamento(hora) {
    if (!hora) return '';

    return String(hora).slice(0, 5);
}

function formatarEmissaoOrcamento(orcamento) {
    const data = formatarDataOrcamento(orcamento.data_criacao);
    const hora = formatarHoraOrcamento(orcamento.hora_criacao);

    return hora ? `${data} às ${hora}` : data;
}

function escaparHtmlOrcamento(valor) {
    return String(valor || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function normalizarTextoOrcamento(texto) {
    return String(texto || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ');
}

function produtoCombinaOrcamento(produto, termo) {
    const termoNormalizado = normalizarTextoOrcamento(termo);
    const nomeNormalizado = normalizarTextoOrcamento(produto.nome || '');
    const codigoNormalizado = normalizarTextoOrcamento(produto.codigo || '');

    if (!termoNormalizado) return false;

    const palavras = nomeNormalizado.split(' ').filter(Boolean);

    return codigoNormalizado.startsWith(termoNormalizado) ||
        nomeNormalizado.startsWith(termoNormalizado) ||
        palavras.some(palavra => palavra.startsWith(termoNormalizado));
}

function cidadeCombinaOrcamento(cidade, termo) {
    const cidadeNormalizada = normalizarTextoOrcamento(cidade);
    const termoNormalizado = normalizarTextoOrcamento(termo);

    return !!termoNormalizado && cidadeNormalizada.startsWith(termoNormalizado);
}

function clienteCombinaOrcamento(cliente, termo) {
    const nomeNormalizado = normalizarTextoOrcamento(cliente?.nome || '');
    const termoNormalizado = normalizarTextoOrcamento(termo);

    return !!termoNormalizado && nomeNormalizado.startsWith(termoNormalizado);
}

async function carregarProdutosOrcamento() {
    const resposta = await fetch('http://localhost:3000/produtos');
    const produtos = await resposta.json();

    if (!resposta.ok) {
        throw new Error(produtos.erro || 'Erro ao carregar produtos.');
    }

    produtosOrcamento = Array.isArray(produtos) ? produtos : [];
}

async function carregarClientesOrcamento() {
    try {
        const resposta = await fetch('http://localhost:3000/clientes');
        const clientes = await resposta.json();

        clientesOrcamento = resposta.ok && Array.isArray(clientes) ? clientes : [];
    } catch (erro) {
        console.warn('Não foi possível carregar clientes para autocomplete de orçamento:', erro);
        clientesOrcamento = [];
    }
}

async function carregarOrcamentos() {
    const resposta = await fetch('http://localhost:3000/orcamentos');
    const orcamentos = await resposta.json();

    if (!resposta.ok) {
        throw new Error(orcamentos.erro || 'Erro ao carregar orçamentos.');
    }

    listaOrcamentos = Array.isArray(orcamentos) ? orcamentos : [];
    renderizarListaOrcamentos();
}

async function inicializarOrcamentos() {
    try {
        await Promise.all([
            carregarProdutosOrcamento(),
            carregarClientesOrcamento(),
            carregarOrcamentos()
        ]);
        configurarFechamentoResultadosOrcamento();
        renderizarItensOrcamento();
        atualizarPreviewItemOrcamento();

    } catch (erro) {
        console.error('Erro ao iniciar orçamentos:', erro);
        mostrarMensagemOrcamento('Erro ao carregar a aba de orçamentos. Verifique se o servidor está rodando.', 'erro');
    }
}

function configurarFechamentoResultadosOrcamento() {
    document.addEventListener('click', event => {
        if (event.target.closest('.campo-sugestao-orcamento')) return;

        [
            'resultadoClientesOrcamento',
            'resultadoCidadesOrcamento',
            'resultadoProdutosOrcamento'
        ].forEach(id => {
            const elemento = document.getElementById(id);

            if (elemento) {
                elemento.innerHTML = '';
                elemento.style.display = 'none';
            }
        });
    });
}

function pesquisarClienteOrcamento() {
    const campo = document.getElementById('orcamentoCliente');
    const resultado = document.getElementById('resultadoClientesOrcamento');

    if (!campo || !resultado) return;

    const termo = campo.value;
    resultado.innerHTML = '';
    resultado.style.display = 'none';

    if (!normalizarTextoOrcamento(termo)) return;

    const encontrados = clientesOrcamento
        .filter(cliente => clienteCombinaOrcamento(cliente, termo))
        .slice(0, 8);

    if (encontrados.length === 0) {
        return;
    }

    resultado.innerHTML = encontrados.map(cliente => `
        <div class="resultado-cliente-orcamento" onpointerdown="selecionarClienteOrcamentoPorEvento(event, ${Number(cliente.id)})">
            <strong>${escaparHtmlOrcamento(cliente.nome || '-')}</strong>
            <span>
                Telefone: ${escaparHtmlOrcamento(cliente.telefone || '-')} |
                Cidade: ${escaparHtmlOrcamento(cliente.cidade || '-')}
            </span>
        </div>
    `).join('');

    resultado.style.display = 'block';
}

function selecionarClienteOrcamentoPorEvento(evento, id) {
    if (evento) {
        evento.preventDefault();
        evento.stopPropagation();
    }

    selecionarClienteOrcamento(id);
}

function selecionarClienteOrcamento(id) {
    const cliente = clientesOrcamento.find(item => Number(item.id) === Number(id));

    if (!cliente) return;

    document.getElementById('orcamentoCliente').value = cliente.nome || '';
    document.getElementById('orcamentoTelefone').value = cliente.telefone || '';
    document.getElementById('orcamentoCidade').value = cliente.cidade || '';

    document.getElementById('resultadoClientesOrcamento').innerHTML = '';
    document.getElementById('resultadoClientesOrcamento').style.display = 'none';
}

function pesquisarProdutoOrcamento() {
    const termo = document.getElementById('orcamentoBuscaProduto').value;
    const resultado = document.getElementById('resultadoProdutosOrcamento');

    resultado.innerHTML = '';

    if (!normalizarTextoOrcamento(termo)) {
        resultado.style.display = 'none';
        return;
    }

    const encontrados = produtosOrcamento
        .filter(produto => Number(produto.ativo ?? 1) === 1)
        .filter(produto => produtoCombinaOrcamento(produto, termo))
        .slice(0, 8);

    if (encontrados.length === 0) {
        resultado.innerHTML = '<div class="resultado-produto-orcamento vazio">Nenhum produto encontrado.</div>';
        resultado.style.display = 'block';
        return;
    }

    resultado.innerHTML = encontrados.map(produto => {
        const unidade = normalizarUnidadeMedidaOrcamento(produto.unidade_medida);
        const fracionado = produtoPermiteFracionadoOrcamento(produto);

        return `
            <button type="button" class="resultado-produto-orcamento" onclick="selecionarProdutoOrcamento(${Number(produto.id)})">
                <strong>${escaparHtmlOrcamento(produto.nome)}</strong>
                <span>
                    Código: ${escaparHtmlOrcamento(produto.codigo || '-')} |
                    Categoria: ${escaparHtmlOrcamento(produto.categoria || '-')} |
                    Preço: ${formatarPrecoComUnidadeOrcamento(produto.preco, unidade)} |
                    Estoque: ${formatarQuantidadeComUnidadeOrcamento(produto.estoque, unidade)} |
                    Fracionado: ${fracionado ? 'Sim' : 'Não'}
                    ${produto.descricao ? ` | Obs.: ${escaparHtmlOrcamento(produto.descricao)}` : ''}
                </span>
            </button>
        `;
    }).join('');

    resultado.style.display = 'block';
}

function selecionarProdutoOrcamento(id) {
    const produto = produtosOrcamento.find(item => Number(item.id) === Number(id));

    if (!produto) return;

    produtoSelecionadoOrcamento = produto;
    const unidade = normalizarUnidadeMedidaOrcamento(produto.unidade_medida);

    document.getElementById('orcamentoBuscaProduto').value = produto.nome || '';
    document.getElementById('orcamentoValorUnitario').value = formatarMoedaOrcamento(produto.preco);
    document.getElementById('orcamentoQuantidade').placeholder = `Qtd (${unidade})`;
    document.getElementById('resultadoProdutosOrcamento').style.display = 'none';

    if (!document.getElementById('orcamentoQuantidade').value) {
        document.getElementById('orcamentoQuantidade').value = '1';
    }

    atualizarPreviewItemOrcamento();
}

function pesquisarCidadeOrcamento() {
    const campo = document.getElementById('orcamentoCidade');
    const resultados = document.getElementById('resultadoCidadesOrcamento');
    const busca = campo.value;

    resultados.innerHTML = '';
    resultados.style.display = 'none';

    if (!normalizarTextoOrcamento(busca)) return;

    const filtradas = cidadesRegiaoOrcamento.filter(cidade =>
        cidadeCombinaOrcamento(cidade, busca)
    );

    resultados.style.display = 'block';

    if (filtradas.length === 0) {
        resultados.innerHTML = `
            <div class="resultado-produto-orcamento vazio">
                Cidade não encontrada na lista. Você pode continuar digitando manualmente.
            </div>
        `;
        return;
    }

    resultados.innerHTML = filtradas.slice(0, 8).map(cidade => `
        <button type="button" class="resultado-produto-orcamento" onclick="selecionarCidadeOrcamento('${escaparJsOrcamento(cidade)}')">
            <strong>${escaparHtmlOrcamento(cidade)}</strong>
        </button>
    `).join('');
}

function selecionarCidadeOrcamento(cidade) {
    document.getElementById('orcamentoCidade').value = cidade;
    document.getElementById('resultadoCidadesOrcamento').innerHTML = '';
    document.getElementById('resultadoCidadesOrcamento').style.display = 'none';
}

function escaparJsOrcamento(valor) {
    return String(valor || '')
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/"/g, '\\"');
}

function atualizarPreviewItemOrcamento() {
    const box = document.getElementById('produtoSelecionadoOrcamento');

    if (!produtoSelecionadoOrcamento) {
        box.textContent = 'Selecione um produto para ver preço e estoque atual.';
        return;
    }

    const quantidade = converterQuantidadeOrcamento(document.getElementById('orcamentoQuantidade').value || 1);
    const valorUnitario = converterNumeroOrcamento(document.getElementById('orcamentoValorUnitario').value);
    const total = Math.max(0, quantidade * valorUnitario);
    const unidade = normalizarUnidadeMedidaOrcamento(produtoSelecionadoOrcamento.unidade_medida);
    const fracionado = produtoPermiteFracionadoOrcamento(produtoSelecionadoOrcamento);

    box.innerHTML = `
        <strong>${escaparHtmlOrcamento(produtoSelecionadoOrcamento.nome)}</strong>
        <span>Código: ${escaparHtmlOrcamento(produtoSelecionadoOrcamento.codigo || '-')}</span>
        <span>Categoria: ${escaparHtmlOrcamento(produtoSelecionadoOrcamento.categoria || '-')}</span>
        <span>Unidade: ${unidade} | Fracionado: ${fracionado ? 'Sim' : 'Não'}</span>
        <span>Preço cadastrado: ${formatarPrecoComUnidadeOrcamento(produtoSelecionadoOrcamento.preco, unidade)}</span>
        <span>Estoque atual: ${formatarQuantidadeComUnidadeOrcamento(produtoSelecionadoOrcamento.estoque, unidade)}</span>
        <span>Total do item: ${formatarMoedaOrcamento(total)}</span>
    `;
}

function adicionarItemOrcamento() {
    if (!produtoSelecionadoOrcamento) {
        mostrarMensagemOrcamento('Selecione um produto para adicionar ao orçamento.', 'aviso');
        return;
    }

    const quantidade = converterQuantidadeOrcamento(document.getElementById('orcamentoQuantidade').value);
    const valorUnitario = converterNumeroOrcamento(document.getElementById('orcamentoValorUnitario').value);
    const unidade = normalizarUnidadeMedidaOrcamento(produtoSelecionadoOrcamento.unidade_medida);
    const permiteFracionado = produtoPermiteFracionadoOrcamento(produtoSelecionadoOrcamento);

    if (quantidade <= 0) {
        mostrarMensagemOrcamento('Informe uma quantidade maior que zero.', 'aviso');
        return;
    }

    if (!permiteFracionado && !quantidadeEhInteiraOrcamento(quantidade)) {
        mostrarMensagemOrcamento('Este produto não permite venda fracionada.', 'aviso');
        return;
    }

    if (valorUnitario < 0) {
        mostrarMensagemOrcamento('Informe um valor unitário válido.', 'aviso');
        return;
    }

    itensOrcamento.push({
        produto_id: produtoSelecionadoOrcamento.id,
        codigo: produtoSelecionadoOrcamento.codigo || '',
        produto_nome: produtoSelecionadoOrcamento.nome || '',
        categoria: produtoSelecionadoOrcamento.categoria || '',
        quantidade,
        unidade_medida: unidade,
        permite_fracionado: permiteFracionado ? 1 : 0,
        valor_unitario: valorUnitario,
        desconto_item: 0,
        valor_total: quantidade * valorUnitario
    });

    produtoSelecionadoOrcamento = null;
    document.getElementById('orcamentoBuscaProduto').value = '';
    document.getElementById('orcamentoQuantidade').value = '';
    document.getElementById('orcamentoQuantidade').placeholder = 'Qtd';
    document.getElementById('orcamentoValorUnitario').value = '';
    document.getElementById('resultadoProdutosOrcamento').style.display = 'none';

    atualizarPreviewItemOrcamento();
    renderizarItensOrcamento();
}

function atualizarItemOrcamento(indice, campo, valor) {
    if (!itensOrcamento[indice]) return;

    const novoValor = campo === 'quantidade'
        ? converterQuantidadeOrcamento(valor)
        : converterNumeroOrcamento(valor);

    if (campo === 'quantidade' &&
        !produtoPermiteFracionadoOrcamento(itensOrcamento[indice]) &&
        !quantidadeEhInteiraOrcamento(novoValor)) {
        mostrarMensagemOrcamento('Este produto não permite venda fracionada.', 'aviso');
        renderizarItensOrcamento();
        return;
    }

    itensOrcamento[indice][campo] = novoValor;
    itensOrcamento[indice].valor_total = Math.max(
        0,
        Number(itensOrcamento[indice].quantidade || 0) * Number(itensOrcamento[indice].valor_unitario || 0)
    );

    renderizarItensOrcamento();
}

function removerItemOrcamento(indice) {
    itensOrcamento.splice(indice, 1);
    renderizarItensOrcamento();
}

function renderizarItensOrcamento() {
    const tabela = document.getElementById('tabelaItensOrcamento');

    if (!itensOrcamento.length) {
        tabela.innerHTML = `
            <tr>
                <td colspan="6">Nenhum item adicionado ao orçamento.</td>
            </tr>
        `;
        atualizarTotaisOrcamento();
        return;
    }

    tabela.innerHTML = itensOrcamento.map((item, indice) => {
        const unidade = normalizarUnidadeMedidaOrcamento(item.unidade_medida);

        return `
            <tr>
                <td>
                    <strong>${escaparHtmlOrcamento(item.produto_nome)}</strong><br>
                    <small>${escaparHtmlOrcamento(item.categoria || '-')} | ${unidade}</small>
                </td>
                <td>${escaparHtmlOrcamento(item.codigo || '-')}</td>
                <td>
                    <input value="${formatarQuantidadeOrcamento(item.quantidade)}" onchange="atualizarItemOrcamento(${indice}, 'quantidade', this.value)">
                    <small>${unidade}</small>
                </td>
                <td>
                    <input value="${formatarMoedaOrcamento(item.valor_unitario)}" onchange="atualizarItemOrcamento(${indice}, 'valor_unitario', this.value)">
                    <small>/${unidade}</small>
                </td>
                <td>${formatarMoedaOrcamento(item.valor_total)}</td>
                <td>
                    <button type="button" class="btn-danger" onclick="removerItemOrcamento(${indice})">Remover</button>
                </td>
            </tr>
        `;
    }).join('');

    atualizarTotaisOrcamento();
}

function obterTotaisOrcamento() {
    const subtotal = itensOrcamento.reduce((soma, item) => {
        return soma + Number(item.valor_total || 0);
    }, 0);

    const desconto = Math.max(0, converterNumeroOrcamento(document.getElementById('orcamentoDesconto').value));
    const frete = Math.max(0, converterNumeroOrcamento(document.getElementById('orcamentoFrete').value));
    const total = Math.max(0, subtotal + frete - desconto);

    return { subtotal, desconto, frete, total };
}

function atualizarTotaisOrcamento() {
    const totais = obterTotaisOrcamento();

    document.getElementById('orcamentoSubtotal').textContent = formatarMoedaOrcamento(totais.subtotal);
    document.getElementById('orcamentoTotal').textContent = formatarMoedaOrcamento(totais.total);
}

async function salvarOrcamento() {
    if (!itensOrcamento.length) {
        mostrarMensagemOrcamento('Adicione pelo menos um item ao orçamento.', 'aviso');
        return;
    }

    const totais = obterTotaisOrcamento();

    const payload = {
        cliente_nome: document.getElementById('orcamentoCliente').value.trim(),
        telefone: document.getElementById('orcamentoTelefone').value.trim(),
        cidade: document.getElementById('orcamentoCidade').value.trim(),
        observacao: '',
        desconto: totais.desconto,
        frete: totais.frete,
        itens: itensOrcamento.map(item => ({
            produto_id: item.produto_id,
            codigo: item.codigo,
            produto_nome: item.produto_nome,
            categoria: item.categoria,
            quantidade: Number(item.quantidade || 0),
            unidade_medida: normalizarUnidadeMedidaOrcamento(item.unidade_medida),
            valor_unitario: Number(item.valor_unitario || 0),
            desconto_item: Number(item.desconto_item || 0)
        }))
    };

    try {
        const resposta = await fetch('http://localhost:3000/orcamentos', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const dados = await resposta.json();

        if (!resposta.ok || dados.erro) {
            mostrarMensagemOrcamento(dados.erro || 'Erro ao salvar orçamento.', 'erro');
            return;
        }

        mostrarMensagemOrcamento('Orçamento salvo com sucesso.', 'sucesso');
        await carregarOrcamentos();
        await visualizarOrcamento(dados.id);
        limparOrcamento();

    } catch (erro) {
        console.error('Erro ao salvar orçamento:', erro);
        mostrarMensagemOrcamento('Erro ao salvar orçamento. Verifique se o servidor está rodando.', 'erro');
    }
}

function limparOrcamento() {
    itensOrcamento = [];
    produtoSelecionadoOrcamento = null;

    document.getElementById('orcamentoCliente').value = '';
    document.getElementById('orcamentoTelefone').value = '';
    document.getElementById('orcamentoCidade').value = '';
    document.getElementById('orcamentoBuscaProduto').value = '';
    document.getElementById('orcamentoQuantidade').value = '';
    document.getElementById('orcamentoQuantidade').placeholder = 'Qtd';
    document.getElementById('orcamentoValorUnitario').value = '';
    document.getElementById('orcamentoDesconto').value = '';
    document.getElementById('orcamentoFrete').value = '';
    document.getElementById('resultadoProdutosOrcamento').style.display = 'none';
    document.getElementById('resultadoClientesOrcamento').style.display = 'none';
    document.getElementById('resultadoCidadesOrcamento').style.display = 'none';

    atualizarPreviewItemOrcamento();
    renderizarItensOrcamento();
}

function renderizarListaOrcamentos() {
    const tabela = document.getElementById('tabelaOrcamentos');
    const termo = normalizarTextoOrcamento(document.getElementById('filtroOrcamentoBusca').value);
    const status = document.getElementById('filtroOrcamentoStatus').value;

    let filtrados = [...listaOrcamentos];

    if (termo) {
        filtrados = filtrados.filter(item => {
            return normalizarTextoOrcamento(item.numero).startsWith(termo) ||
                normalizarTextoOrcamento(item.cliente_nome).includes(termo);
        });
    }

    if (status) {
        filtrados = filtrados.filter(item => item.status === status);
    }

    if (!filtrados.length) {
        tabela.innerHTML = `
            <tr>
                <td colspan="8">Nenhum orçamento encontrado.</td>
            </tr>
        `;
        return;
    }

    tabela.innerHTML = filtrados.map(item => `
        <tr>
            <td><strong>${escaparHtmlOrcamento(item.numero || '-')}</strong></td>
            <td>${formatarEmissaoOrcamento(item)}</td>
            <td>${escaparHtmlOrcamento(item.cliente_nome || '-')}</td>
            <td>${escaparHtmlOrcamento(item.telefone || '-')}</td>
            <td>${escaparHtmlOrcamento(item.cidade || '-')}</td>
            <td>${formatarMoedaOrcamento(item.total)}</td>
            <td><span class="status-orcamento status-orcamento-${String(item.status || '').toLowerCase()}">${escaparHtmlOrcamento(item.status || '-')}</span></td>
            <td class="acoes-tabela-orcamento">
                <button type="button" onclick="visualizarOrcamento(${Number(item.id)})">Visualizar</button>
                <button type="button" class="btn-secondary" onclick="imprimirOrcamento(${Number(item.id)})">Imprimir</button>
                ${
                    item.status === 'ABERTO'
                        ? `<button type="button" class="btn-danger" onclick="cancelarOrcamento(${Number(item.id)})">Cancelar</button>`
                        : ''
                }
                <button
                    type="button"
                    class="btn-remover-orcamento"
                    title="Remover do histórico"
                    aria-label="Remover do histórico"
                    onclick="removerOrcamentoHistorico(${Number(item.id)})"
                >X</button>
            </td>
        </tr>
    `).join('');
}

async function buscarOrcamento(id) {
    const resposta = await fetch(`http://localhost:3000/orcamentos/${id}`);
    const dados = await resposta.json();

    if (!resposta.ok || dados.erro) {
        throw new Error(dados.erro || 'Erro ao buscar orçamento.');
    }

    return dados;
}

async function visualizarOrcamento(id) {
    try {
        orcamentoDetalheAtual = await buscarOrcamento(id);
        document.getElementById('conteudoDetalheOrcamento').innerHTML = montarHtmlDetalheOrcamento(orcamentoDetalheAtual);
        document.getElementById('modalDetalheOrcamento').style.display = 'flex';

    } catch (erro) {
        console.error('Erro ao visualizar orçamento:', erro);
        mostrarMensagemOrcamento('Erro ao visualizar orçamento.', 'erro');
    }
}

function fecharDetalheOrcamento() {
    document.getElementById('modalDetalheOrcamento').style.display = 'none';
}

function montarHtmlDetalheOrcamento(dados) {
    const orcamento = dados.orcamento;
    const itens = dados.itens || [];
    const desconto = Number(orcamento.desconto || 0);
    const frete = Number(orcamento.frete || 0);

    return `
        <div class="detalhe-orcamento">
            <div class="detalhe-orcamento-topo">
                <div>
                    <span class="eyebrow">Orçamento</span>
                    <h2>${escaparHtmlOrcamento(orcamento.numero)}</h2>
                    <p>Este documento é apenas uma proposta comercial.</p>
                </div>
                <span class="status-orcamento status-orcamento-${String(orcamento.status || '').toLowerCase()}">${escaparHtmlOrcamento(orcamento.status)}</span>
            </div>

            <div class="grid-dados-orcamento">
                <p><span>Cliente</span>${escaparHtmlOrcamento(orcamento.cliente_nome || '-')}</p>
                <p><span>Telefone</span>${escaparHtmlOrcamento(orcamento.telefone || '-')}</p>
                <p><span>Cidade</span>${escaparHtmlOrcamento(orcamento.cidade || '-')}</p>
                <p><span>Emitido em</span>${formatarEmissaoOrcamento(orcamento)}</p>
            </div>

            <table>
                <thead>
                    <tr>
                        <th>Produto</th>
                        <th>Código</th>
                        <th>Qtd</th>
                        <th>Unitário</th>
                        <th>Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${itens.map(item => {
                        const unidade = normalizarUnidadeMedidaOrcamento(item.unidade_medida);

                        return `
                            <tr>
                                <td>${escaparHtmlOrcamento(item.produto_nome)}</td>
                                <td>${escaparHtmlOrcamento(item.codigo || '-')}</td>
                                <td>${formatarQuantidadeComUnidadeOrcamento(item.quantidade, unidade)}</td>
                                <td>${formatarPrecoComUnidadeOrcamento(item.valor_unitario, unidade)}</td>
                                <td>${formatarMoedaOrcamento(item.valor_total)}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>

            <div class="resumo-detalhe-orcamento">
                <p><span>Subtotal</span>${formatarMoedaOrcamento(orcamento.subtotal)}</p>
                ${frete > 0 ? `<p><span>Frete</span>${formatarMoedaOrcamento(frete)}</p>` : ''}
                ${desconto > 0 ? `<p><span>Desconto</span>${formatarMoedaOrcamento(desconto)}</p>` : ''}
                <p class="total"><span>Total do Orçamento</span>${formatarMoedaOrcamento(orcamento.total)}</p>
            </div>

            ${
                orcamento.observacao
                    ? `<div class="observacao-detalhe-orcamento"><strong>Observação:</strong> ${escaparHtmlOrcamento(orcamento.observacao)}</div>`
                    : ''
            }
        </div>
    `;
}

async function cancelarOrcamento(id) {
    const confirmar = await confirmarAcaoOrcamento({
        titulo: 'Cancelar orçamento?',
        mensagem: 'Essa ação marcará o orçamento como cancelado, sem alterar estoque, vendas ou financeiro.',
        textoConfirmar: 'Cancelar orçamento',
        textoCancelar: 'Voltar',
        tipo: 'perigo'
    });

    if (!confirmar) return;

    try {
        const resposta = await fetch(`http://localhost:3000/orcamentos/${id}/status`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status: 'CANCELADO' })
        });

        const dados = await resposta.json();

        if (!resposta.ok || dados.erro) {
            mostrarMensagemOrcamento(dados.erro || 'Erro ao cancelar orçamento.', 'erro');
            return;
        }

        mostrarMensagemOrcamento('Orçamento cancelado com sucesso.', 'sucesso');
        await carregarOrcamentos();

    } catch (erro) {
        console.error('Erro ao cancelar orçamento:', erro);
        mostrarMensagemOrcamento('Erro ao cancelar orçamento.', 'erro');
    }
}

async function removerOrcamentoHistorico(id) {
    const confirmar = await confirmarAcaoOrcamento({
        titulo: 'Remover orçamento do histórico?',
        mensagem: 'Essa ação ocultará o orçamento da lista, mas não movimentará estoque nem financeiro.',
        textoConfirmar: 'Remover',
        textoCancelar: 'Cancelar',
        tipo: 'perigo'
    });

    if (!confirmar) return;

    try {
        const resposta = await fetch(`http://localhost:3000/orcamentos/${id}/remover-historico`, {
            method: 'PATCH'
        });
        const dados = await resposta.json();

        if (!resposta.ok || dados.erro) {
            mostrarMensagemOrcamento(dados.erro || 'Erro ao remover orçamento do histórico.', 'erro');
            return;
        }

        mostrarMensagemOrcamento(dados.mensagem || 'Orçamento removido do histórico.', 'sucesso');
        await carregarOrcamentos();

    } catch (erro) {
        console.error('Erro ao remover orçamento do histórico:', erro);
        mostrarMensagemOrcamento('Erro ao remover orçamento do histórico.', 'erro');
    }
}

async function imprimirOrcamento(id) {
    try {
        const dados = await buscarOrcamento(id);
        abrirImpressaoOrcamento(dados);

    } catch (erro) {
        console.error('Erro ao imprimir orçamento:', erro);
        mostrarMensagemOrcamento('Erro ao imprimir orçamento.', 'erro');
    }
}

function imprimirOrcamentoAtual() {
    if (!orcamentoDetalheAtual) return;

    abrirImpressaoOrcamento(orcamentoDetalheAtual);
}

function abrirImpressaoOrcamento(dados) {
    const janela = window.open('', '_blank', 'width=900,height=700');

    if (!janela) {
        mostrarMensagemOrcamento('Não foi possível abrir a janela de impressão.', 'aviso');
        return;
    }

    janela.document.write(montarHtmlImpressaoOrcamento(dados));
    janela.document.close();
    janela.focus();
    janela.print();
}

function montarHtmlImpressaoOrcamento(dados) {
    const orcamento = dados.orcamento;
    const itens = dados.itens || [];
    const emitidoEm = formatarEmissaoOrcamento(orcamento);
    const desconto = Number(orcamento.desconto || 0);
    const frete = Number(orcamento.frete || 0);

    return `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
            <meta charset="UTF-8">
            <title>Orçamento ${escaparHtmlOrcamento(orcamento.numero)}</title>
            <style>
                *{box-sizing:border-box;}
                body{
                    width:80mm;
                    max-width:80mm;
                    margin:0 auto;
                    padding:10mm 7mm;
                    color:#111;
                    font-family:Arial,sans-serif;
                    font-size:12px;
                    line-height:1.35;
                }
                .topo{
                    text-align:center;
                    padding-bottom:8px;
                    border-bottom:1px solid #111;
                    margin-bottom:10px;
                }
                .marca{
                    margin:0;
                    font-size:18px;
                    font-weight:800;
                    letter-spacing:.08em;
                }
                .titulo{
                    margin:3px 0 4px;
                    font-size:15px;
                    font-weight:800;
                }
                .emissao{
                    margin:0;
                    font-size:11px;
                }
                .secao{
                    margin-top:10px;
                    padding-top:8px;
                    border-top:1px dashed #999;
                }
                .linha{
                    display:flex;
                    justify-content:space-between;
                    gap:8px;
                    margin-bottom:4px;
                }
                .linha span:first-child{
                    color:#555;
                    font-weight:700;
                }
                .linha span:last-child{
                    text-align:right;
                    font-weight:700;
                }
                .lista-itens{
                    display:flex;
                    flex-direction:column;
                    gap:7px;
                }
                .item-orcamento{
                    padding-bottom:7px;
                    border-bottom:1px dashed #ccc;
                }
                .item-orcamento:last-child{
                    border-bottom:0;
                    padding-bottom:0;
                }
                .produto{
                    display:block;
                    margin-bottom:4px;
                    font-size:11.5px;
                    font-weight:800;
                    overflow-wrap:anywhere;
                }
                .item-meta{
                    display:flex;
                    justify-content:space-between;
                    gap:8px;
                    color:#444;
                    font-size:10.5px;
                    font-weight:700;
                }
                .totais{
                    margin-top:10px;
                }
                .total-final{
                    margin-top:6px;
                    padding-top:7px;
                    border-top:1px solid #111;
                    font-size:15px;
                    font-weight:800;
                }
                .observacao{
                    margin-top:10px;
                    padding-top:8px;
                    border-top:1px dashed #999;
                }
                .observacao strong{
                    display:block;
                    margin-bottom:3px;
                }
                .rodape{
                    margin-top:12px;
                    padding-top:8px;
                    border-top:1px solid #111;
                    text-align:center;
                    font-size:10.5px;
                }
                @page{size:80mm auto;margin:0;}
            </style>
        </head>
        <body>
            <header class="topo">
                <h1 class="marca">VALE AGRO</h1>
                <p class="titulo">ORÇAMENTO</p>
                <p class="emissao">Emitido em: ${escaparHtmlOrcamento(emitidoEm)}</p>
            </header>

            <div class="secao">
                <div class="linha"><span>Número</span><span>${escaparHtmlOrcamento(orcamento.numero)}</span></div>
                <div class="linha"><span>Status</span><span>${escaparHtmlOrcamento(orcamento.status)}</span></div>
                <div class="linha"><span>Cliente</span><span>${escaparHtmlOrcamento(orcamento.cliente_nome || '-')}</span></div>
                <div class="linha"><span>Telefone</span><span>${escaparHtmlOrcamento(orcamento.telefone || '-')}</span></div>
                <div class="linha"><span>Cidade</span><span>${escaparHtmlOrcamento(orcamento.cidade || '-')}</span></div>
            </div>

            <div class="secao lista-itens">
                ${itens.map(item => {
                    const unidade = normalizarUnidadeMedidaOrcamento(item.unidade_medida);

                    return `
                        <div class="item-orcamento">
                            <strong class="produto">${escaparHtmlOrcamento(item.produto_nome)}</strong>
                            <div class="item-meta">
                                <span>Qtd: ${formatarQuantidadeComUnidadeOrcamento(item.quantidade, unidade)}</span>
                                <span>Unit.: ${formatarMoedaOrcamento(item.valor_unitario)}/${unidade}</span>
                                <span>Total: ${formatarMoedaOrcamento(item.valor_total)}</span>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>

            <div class="totais secao">
                <div class="linha"><span>Subtotal</span><span>${formatarMoedaOrcamento(orcamento.subtotal)}</span></div>
                ${frete > 0 ? `<div class="linha"><span>Frete</span><span>${formatarMoedaOrcamento(frete)}</span></div>` : ''}
                ${desconto > 0 ? `<div class="linha"><span>Desconto</span><span>${formatarMoedaOrcamento(desconto)}</span></div>` : ''}
                <div class="linha total-final"><span>Total final</span><span>${formatarMoedaOrcamento(orcamento.total)}</span></div>
            </div>

            ${
                orcamento.observacao
                    ? `<div class="observacao"><strong>Observação</strong>${escaparHtmlOrcamento(orcamento.observacao)}</div>`
                    : ''
            }

            <div class="rodape">
                <p>Este documento é apenas um orçamento e não reserva estoque.</p>
            </div>
        </body>
        </html>
    `;
}

document.addEventListener('DOMContentLoaded', inicializarOrcamentos);
