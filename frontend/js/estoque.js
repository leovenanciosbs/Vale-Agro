let listaProdutos = [];
let produtoEditandoId = null;

function converterNumero(valor) {
    if (!valor) return 0;

    let texto = String(valor)
        .replace(/[R$\s]/g, '')
        .replace(/\./g, '')
        .replace(',', '.');

    return Number(texto) || 0;
}

function converterQuantidade(valor) {
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

function formatarMoeda(valor) {
    return Number(valor || 0).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
}

function atualizarTextoResumoEstoque(id, valor) {
    const elemento = document.getElementById(id);

    if (elemento) {
        elemento.textContent = valor;
    }
}

function normalizarValorResumoEstoque(valor) {
    return String(valor ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
}

function produtoEstaAtivoParaResumo(produto) {
    const statusInformado = produto?.status !== undefined &&
        produto?.status !== null &&
        String(produto.status).trim() !== '';

    if (statusInformado) {
        const status = normalizarValorResumoEstoque(produto.status);

        if (['ativo', '1', 'true', 'sim'].includes(status)) return true;
        if (['inativo', 'desativado', '0', 'false', 'nao'].includes(status)) return false;
    }

    const ativoInformado = produto?.ativo !== undefined &&
        produto?.ativo !== null &&
        String(produto.ativo).trim() !== '';

    if (!ativoInformado) {
        return true;
    }

    const ativo = normalizarValorResumoEstoque(produto.ativo);

    return !['0', 'false', 'inativo', 'desativado', 'nao'].includes(ativo);
}

function atualizarResumoEstoque(produtos) {
    const lista = Array.isArray(produtos) ? produtos : [];
    const produtosAtivos = lista.filter(produtoEstaAtivoParaResumo);

    const totalProdutos = lista.length;
    const estoqueBaixo = produtosAtivos.filter(produto => {
        const estoque = converterQuantidade(produto.estoque);
        const minimo = converterQuantidade(produto.estoque_minimo);

        return estoque <= minimo;
    }).length;

    const valorEstoque = produtosAtivos.reduce((total, produto) => {
        const estoque = converterQuantidade(produto.estoque);
        const custo = converterQuantidade(produto.custo);

        return total + (estoque * custo);
    }, 0);

    atualizarTextoResumoEstoque('resumoTotalProdutos', totalProdutos);
    atualizarTextoResumoEstoque('resumoEstoqueBaixo', estoqueBaixo);
    atualizarTextoResumoEstoque('resumoProdutosAtivos', produtosAtivos.length);
    atualizarTextoResumoEstoque('resumoValorEstoque', formatarMoeda(valorEstoque));
}

function normalizarUnidadeMedidaProduto(valor) {
    const unidade = String(valor || 'UN').trim().toUpperCase();
    const unidadesValidas = ['UN', 'KG', 'G', 'L', 'ML', 'M'];

    return unidadesValidas.includes(unidade) ? unidade : 'UN';
}

function produtoPermiteFracionado(produto) {
    return Number(produto?.permite_fracionado || 0) === 1;
}

function formatarQuantidade(valor) {
    return Number(valor || 0).toLocaleString('pt-BR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 3
    });
}

function formatarQuantidadeComUnidade(valor, unidade) {
    return `${formatarQuantidade(valor)} ${normalizarUnidadeMedidaProduto(unidade)}`;
}

function formatarPrecoComUnidade(valor, unidade) {
    return `${formatarMoeda(valor)} / ${normalizarUnidadeMedidaProduto(unidade)}`;
}

function escaparHtml(valor) {
    return String(valor || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
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

function campoTemPalavraComecandoComBusca(valor, termo) {
    const textoNormalizado = normalizarTextoBusca(valor);
    const termoNormalizado = normalizarTextoBusca(termo);

    if (!termoNormalizado) return false;

    const palavras = textoNormalizado.split(' ').filter(Boolean);

    return textoNormalizado.startsWith(termoNormalizado) ||
        palavras.some(palavra => palavra.startsWith(termoNormalizado));
}

async function carregarProdutos() {
    try {
        const resposta = await fetch('/produtos');
        listaProdutos = await resposta.json();

        atualizarResumoEstoque(listaProdutos);
        renderizarTabela(listaProdutos);

    } catch (erro) {
        console.error('Erro ao carregar produtos:', erro);
        mostrarMensagemSistema('Erro ao carregar produtos. Verifique se o servidor está rodando.', 'erro');
    }
}

function renderizarTabela(produtos) {
    const tabela = document.getElementById('tabelaProdutos');

    tabela.innerHTML = '';

    if (!produtos || produtos.length === 0) {
        tabela.innerHTML = `
            <tr>
                <td colspan="9">Nenhum produto encontrado.</td>
            </tr>
        `;
        return;
    }

    produtos.forEach(produto => {
        const estoque = Number(produto.estoque || 0);
        const estoqueMinimo = Number(produto.estoque_minimo || 0);
        const estoqueBaixo = estoque <= estoqueMinimo;
        const ativo = Number(produto.ativo ?? 1) === 1;
        const unidade = normalizarUnidadeMedidaProduto(produto.unidade_medida);
        const fracionado = produtoPermiteFracionado(produto);

        const descricao = String(produto.descricao || '').trim();
        const temObservacao = descricao.length > 0;

        tabela.innerHTML += `
            <tr class="${estoqueBaixo ? 'estoque-baixo' : ''}">
                <td>${escaparHtml(produto.codigo || '-')}</td>

                <td>
                    <div class="produto-info-estoque">
                        <strong class="produto-nome-estoque">${escaparHtml(produto.nome || '-')}</strong>
                        <span class="produto-meta-estoque">${unidade} ${fracionado ? '| Fracionado: Sim' : '| Fracionado: Não'}</span>
                        ${temObservacao ? `<span class="produto-obs-estoque"><strong>Obs:</strong> ${escaparHtml(descricao)}</span>` : ''}
                    </div>
                </td>

                <td>${escaparHtml(produto.categoria || '-')}</td>
                <td>${formatarQuantidadeComUnidade(estoque, unidade)}</td>
                <td>${formatarQuantidadeComUnidade(estoqueMinimo, unidade)}</td>
                <td>${formatarMoeda(produto.custo)}</td>
                <td>${formatarPrecoComUnidade(produto.preco, unidade)}</td>
                <td>${ativo ? 'Ativo' : 'Desativado'}</td>

                <td>
                    <button onclick="abrirModalEdicao(${produto.id})" class="btn-secondary">
                        Editar
                    </button>

                    <button onclick="removerProduto(${produto.id})" class="btn-danger">
                        Remover
                    </button>
                </td>
            </tr>
        `;
    });
}

function filtrarProdutos() {
    const busca = normalizarTextoBusca(document.getElementById('buscaProduto').value);

    if (!busca) {
        renderizarTabela(listaProdutos);
        return;
    }

    const filtrados = listaProdutos.filter(produto =>
        campoTemPalavraComecandoComBusca(produto.nome, busca) ||
        campoComecaComBusca(produto.codigo, busca) ||
        campoTemPalavraComecandoComBusca(produto.categoria, busca) ||
        campoTemPalavraComecandoComBusca(produto.descricao, busca)
    );

    renderizarTabela(filtrados);
}

async function salvarProduto() {
    const produto = {
        codigo: document.getElementById('codigo').value.trim(),
        nome: document.getElementById('nome').value.trim(),
        categoria: document.getElementById('categoria').value.trim(),
        unidade_medida: normalizarUnidadeMedidaProduto(document.getElementById('unidadeMedida').value),
        permite_fracionado: Number(document.getElementById('permiteFracionado').value),
        descricao: document.getElementById('descricao') ? document.getElementById('descricao').value.trim() : '',
        custo: converterNumero(document.getElementById('custo').value),
        preco: converterNumero(document.getElementById('preco').value),
        estoque: converterQuantidade(document.getElementById('estoque').value || 0),
        estoque_minimo: converterQuantidade(document.getElementById('estoqueMinimo').value || 0),
        ativo: 1
    };

    if (!produto.nome) {
        mostrarMensagemSistema('Informe o nome do produto.', 'aviso');
        return;
    }

    try {
        const resposta = await fetch('/produtos', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(produto)
        });

        const dados = await resposta.json();

        if (!resposta.ok || dados.erro) {
            mostrarMensagemSistema(dados.erro || 'Erro ao cadastrar produto.', 'erro');
            return;
        }

        mostrarMensagemSistema('Produto cadastrado com sucesso!', 'sucesso');

        limparFormularioCadastro();
        carregarProdutos();

    } catch (erro) {
        console.error('Erro ao salvar produto:', erro);
        mostrarMensagemSistema('Erro ao salvar produto. Verifique se o servidor está rodando.', 'erro');
    }
}

function limparFormularioCadastro() {
    document.getElementById('codigo').value = '';
    document.getElementById('nome').value = '';
    document.getElementById('categoria').value = '';
    document.getElementById('unidadeMedida').value = 'UN';
    document.getElementById('permiteFracionado').value = '0';

    if (document.getElementById('descricao')) {
        document.getElementById('descricao').value = '';
    }

    document.getElementById('custo').value = '';
    document.getElementById('preco').value = '';
    document.getElementById('estoque').value = '';
    document.getElementById('estoqueMinimo').value = '';
}

function abrirModalEdicao(id) {
    const produto = listaProdutos.find(item => Number(item.id) === Number(id));

    if (!produto) {
        mostrarMensagemSistema('Produto não encontrado.', 'erro');
        return;
    }

    produtoEditandoId = id;

    document.getElementById('editCodigo').value = produto.codigo || '';
    document.getElementById('editNome').value = produto.nome || '';
    document.getElementById('editCategoria').value = produto.categoria || '';
    document.getElementById('editDescricao').value = produto.descricao || '';
    document.getElementById('editUnidadeMedida').value = normalizarUnidadeMedidaProduto(produto.unidade_medida);
    document.getElementById('editPermiteFracionado').value = produtoPermiteFracionado(produto) ? '1' : '0';
    document.getElementById('editCusto').value = produto.custo || '';
    document.getElementById('editPreco').value = produto.preco || '';
    document.getElementById('editEstoqueMinimo').value = produto.estoque_minimo || 0;
    document.getElementById('editAtivo').value = Number(produto.ativo ?? 1) === 0 ? '0' : '1';

    document.getElementById('modalEdicaoProduto').style.display = 'flex';
}

function fecharModalEdicao() {
    produtoEditandoId = null;
    document.getElementById('modalEdicaoProduto').style.display = 'none';
}

async function salvarEdicaoProduto() {
    if (!produtoEditandoId) {
        mostrarMensagemSistema('Nenhum produto selecionado.', 'aviso');
        return;
    }

    const produtoOriginal = listaProdutos.find(item => Number(item.id) === Number(produtoEditandoId));

    const produto = {
        codigo: document.getElementById('editCodigo').value.trim(),
        nome: document.getElementById('editNome').value.trim(),
        categoria: document.getElementById('editCategoria').value.trim(),
        unidade_medida: normalizarUnidadeMedidaProduto(document.getElementById('editUnidadeMedida').value),
        permite_fracionado: Number(document.getElementById('editPermiteFracionado').value),
        descricao: document.getElementById('editDescricao').value.trim(),
        custo: converterNumero(document.getElementById('editCusto').value),
        preco: converterNumero(document.getElementById('editPreco').value),
        estoque: produtoOriginal ? Number(produtoOriginal.estoque || 0) : 0,
        estoque_minimo: converterQuantidade(document.getElementById('editEstoqueMinimo').value || 0),
        ativo: Number(document.getElementById('editAtivo').value)
    };

    if (!produto.nome) {
        mostrarMensagemSistema('Informe o nome do produto.', 'aviso');
        return;
    }

    try {
        const resposta = await fetch(`/produtos/${produtoEditandoId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(produto)
        });

        const dados = await resposta.json();

        if (!resposta.ok || dados.erro) {
            mostrarMensagemSistema(dados.erro || 'Erro ao atualizar produto.', 'erro');
            return;
        }

        mostrarMensagemSistema('Produto atualizado com sucesso!', 'sucesso');

        fecharModalEdicao();
        carregarProdutos();

    } catch (erro) {
        console.error('Erro ao editar produto:', erro);
        mostrarMensagemSistema('Erro ao editar produto. Verifique se o servidor está rodando.', 'erro');
    }
}

async function removerProduto(id) {
    const produto = listaProdutos.find(item => Number(item.id) === Number(id));

    if (!produto) {
        mostrarMensagemSistema('Produto não encontrado.', 'erro');
        return;
    }

    const confirmar = await mostrarConfirmacaoSistema({
        titulo: 'Remover produto?',
        mensagem: `Tem certeza que deseja remover "${produto.nome}"? Use apenas para produtos duplicados.`,
        textoConfirmar: 'Remover',
        textoCancelar: 'Cancelar',
        tipo: 'perigo'
    });

    if (!confirmar) {
        return;
    }

    try {
        const resposta = await fetch(`/produtos/${id}`, {
            method: 'DELETE'
        });

        const dados = await resposta.json();

        if (!resposta.ok || dados.erro) {
            mostrarMensagemSistema(dados.erro || 'Erro ao remover produto.', 'erro');
            return;
        }

        mostrarMensagemSistema('Produto removido com sucesso!', 'sucesso');
        carregarProdutos();

    } catch (erro) {
        console.error('Erro ao remover produto:', erro);
        mostrarMensagemSistema('Erro ao remover produto. Verifique se o servidor está rodando.', 'erro');
    }
}

carregarProdutos();
