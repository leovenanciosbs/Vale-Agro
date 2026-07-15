let itensImportacaoAPrazo = [];
let clientesImportacaoAPrazo = [];
let produtosImportacaoAPrazo = [];

const cidadesRegiaoImportacaoAPrazo = [
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

function formatarNumeroInput(valor) {
    const numero = Number(valor || 0);

    if (!numero) {
        return '';
    }

    return String(numero).replace('.', ',');
}

function converterNumero(valor) {
    if (!valor) return 0;

    let texto = String(valor)
        .replace(/[R$\s]/g, '')
        .replace(/\./g, '')
        .replace(',', '.');

    return Number(texto) || 0;
}

function arredondarMoeda(valor) {
    return Math.round((Number(valor || 0) + Number.EPSILON) * 100) / 100;
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

function normalizarTextoBuscaImportacao(texto) {
    return String(texto || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ');
}

function campoComecaComBuscaImportacao(valor, termo) {
    const textoNormalizado = normalizarTextoBuscaImportacao(valor);
    const termoNormalizado = normalizarTextoBuscaImportacao(termo);

    return !!termoNormalizado && textoNormalizado.startsWith(termoNormalizado);
}

function campoTemPalavraComecandoComBuscaImportacao(valor, termo) {
    const textoNormalizado = normalizarTextoBuscaImportacao(valor);
    const termoNormalizado = normalizarTextoBuscaImportacao(termo);

    if (!termoNormalizado) return false;

    const palavras = textoNormalizado.split(' ').filter(Boolean);

    return textoNormalizado.startsWith(termoNormalizado) ||
        palavras.some(palavra => palavra.startsWith(termoNormalizado));
}

function normalizarUnidadeMedidaImportacao(valor) {
    const unidade = String(valor || 'UN').trim().toUpperCase();
    const unidadesValidas = ['UN', 'KG', 'G', 'L', 'ML', 'M'];

    return unidadesValidas.includes(unidade) ? unidade : 'UN';
}

function formatarPrecoComUnidadeImportacao(valor, unidade) {
    return `${formatarMoeda(valor)} / ${normalizarUnidadeMedidaImportacao(unidade)}`;
}

function formatarQuantidadeImportacao(valor) {
    const numero = Number(valor || 0);

    if (!numero) return '0';

    return numero.toLocaleString('pt-BR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 3
    });
}

function formatarQuantidadeComUnidadeImportacao(valor, unidade) {
    return `${formatarQuantidadeImportacao(valor)} ${normalizarUnidadeMedidaImportacao(unidade)}`;
}

function produtoPermiteFracionadoImportacao(produto) {
    return Number(produto?.permite_fracionado || 0) === 1;
}

function produtoCombinaComBuscaImportacao(produto, termo) {
    return campoTemPalavraComecandoComBuscaImportacao(produto.nome, termo) ||
        campoComecaComBuscaImportacao(produto.codigo, termo) ||
        campoTemPalavraComecandoComBuscaImportacao(produto.categoria, termo) ||
        campoTemPalavraComecandoComBuscaImportacao(produto.descricao, termo);
}

function mostrarResultadosImportacao(elemento) {
    if (!elemento) return;

    elemento.style.display = '';
    elemento.classList.add('ativo');
}

function esconderResultadosImportacao(elemento) {
    if (!elemento) return;

    elemento.innerHTML = '';
    elemento.classList.remove('ativo');
    elemento.style.display = 'none';
}

function esconderTodosResultadosImportacao() {
    document.querySelectorAll('.pagina-importar-fiado .sugestoes-importacao').forEach(elemento => {
        esconderResultadosImportacao(elemento);
    });
}

function renderizarResultadoVazioImportacao(elemento, mensagem) {
    elemento.innerHTML = `
        <div class="item-produto-busca item-busca-vazio-importacao">
            ${escaparHtml(mensagem)}
        </div>
    `;
    mostrarResultadosImportacao(elemento);
}

async function carregarClientesImportacaoAPrazo() {
    try {
        const resposta = await fetch('http://localhost:3000/clientes');
        const dados = await resposta.json();
        clientesImportacaoAPrazo = Array.isArray(dados) ? dados : [];
    } catch (erro) {
        console.warn('Não foi possível carregar clientes para importação:', erro);
        clientesImportacaoAPrazo = [];
    }
}

async function carregarProdutosImportacaoAPrazo() {
    try {
        const resposta = await fetch('http://localhost:3000/produtos');
        const dados = await resposta.json();
        produtosImportacaoAPrazo = Array.isArray(dados) ? dados : [];
    } catch (erro) {
        console.warn('Não foi possível carregar produtos para importação:', erro);
        produtosImportacaoAPrazo = [];
    }
}

function voltarAPrazo() {
    window.location.href = 'fiados.html';
}

function pesquisarClienteImportacao() {
    const campo = document.getElementById('clienteImportacao');
    const resultados = document.getElementById('resultadosClientesImportacao');

    if (!campo || !resultados) return;

    const busca = campo.value;
    esconderResultadosImportacao(resultados);

    if (!normalizarTextoBuscaImportacao(busca)) return;

    const filtrados = clientesImportacaoAPrazo.filter(cliente =>
        campoComecaComBuscaImportacao(cliente.nome, busca) ||
        campoComecaComBuscaImportacao(cliente.telefone, busca) ||
        campoComecaComBuscaImportacao(cliente.cidade, busca)
    );

    if (filtrados.length === 0) {
        renderizarResultadoVazioImportacao(
            resultados,
            'Cliente não encontrado. Você pode continuar digitando manualmente.'
        );
        return;
    }

    filtrados.slice(0, 8).forEach(cliente => {
        resultados.innerHTML += `
            <div class="item-produto-busca" onclick="selecionarClienteImportacao(${Number(cliente.id)})">
                <strong>${escaparHtml(cliente.nome || '-')}</strong>
                <span>
                    Telefone: ${escaparHtml(cliente.telefone || '-')} |
                    Cidade: ${escaparHtml(cliente.cidade || '-')}
                </span>
            </div>
        `;
    });

    mostrarResultadosImportacao(resultados);
}

function selecionarClienteImportacao(id) {
    const cliente = clientesImportacaoAPrazo.find(item => Number(item.id) === Number(id));

    if (!cliente) return;

    document.getElementById('clienteImportacao').value = cliente.nome || '';
    document.getElementById('telefoneImportacao').value = cliente.telefone || '';
    document.getElementById('cidadeImportacao').value = cliente.cidade || '';

    esconderResultadosImportacao(document.getElementById('resultadosClientesImportacao'));
    esconderResultadosImportacao(document.getElementById('resultadosCidadesImportacao'));
}

function pesquisarCidadeImportacao() {
    const campo = document.getElementById('cidadeImportacao');
    const resultados = document.getElementById('resultadosCidadesImportacao');

    if (!campo || !resultados) return;

    const busca = campo.value;
    esconderResultadosImportacao(resultados);

    if (!normalizarTextoBuscaImportacao(busca)) return;

    const filtradas = cidadesRegiaoImportacaoAPrazo.filter(cidade =>
        campoComecaComBuscaImportacao(cidade, busca)
    );

    if (filtradas.length === 0) {
        renderizarResultadoVazioImportacao(
            resultados,
            'Cidade não encontrada na lista. Você pode continuar digitando manualmente.'
        );
        return;
    }

    filtradas.slice(0, 8).forEach(cidade => {
        resultados.innerHTML += `
            <div class="item-produto-busca" onclick="selecionarCidadeImportacao('${escaparHtml(cidade)}')">
                <strong>${escaparHtml(cidade)}</strong>
            </div>
        `;
    });

    mostrarResultadosImportacao(resultados);
}

function selecionarCidadeImportacao(cidade) {
    document.getElementById('cidadeImportacao').value = cidade || '';
    esconderResultadosImportacao(document.getElementById('resultadosCidadesImportacao'));
}

function pesquisarProdutoImportacao() {
    const campo = document.getElementById('buscaProdutoImportacao');
    const resultados = document.getElementById('resultadosProdutosImportacao');

    if (!campo || !resultados) return;

    const busca = campo.value;
    resultados.innerHTML = '';

    if (!normalizarTextoBuscaImportacao(busca)) return;

    const filtrados = produtosImportacaoAPrazo
        .filter(produto => Number(produto.ativo ?? 1) === 1)
        .filter(produto => produtoCombinaComBuscaImportacao(produto, busca));

    if (filtrados.length === 0) {
        resultados.innerHTML = `
            <div class="item-produto-busca item-busca-vazio-importacao">
                Nenhum produto encontrado. Use "Adicionar item manual" para lançar o item do papel.
            </div>
        `;
        return;
    }

    filtrados.slice(0, 12).forEach(produto => {
        const unidade = normalizarUnidadeMedidaImportacao(produto.unidade_medida);
        const fracionado = produtoPermiteFracionadoImportacao(produto);

        resultados.innerHTML += `
            <div class="item-produto-busca" onclick="adicionarProdutoCarrinhoImportacao(${Number(produto.id)})">
                <strong>${escaparHtml(produto.nome || '-')}</strong>
                <span>
                    Código: ${escaparHtml(produto.codigo || '-')} |
                    Categoria: ${escaparHtml(produto.categoria || '-')} |
                    Preço: ${escaparHtml(formatarPrecoComUnidadeImportacao(produto.preco, unidade))} |
                    Estoque: ${escaparHtml(formatarQuantidadeComUnidadeImportacao(produto.estoque, unidade))} |
                    Fracionado: ${fracionado ? 'Sim' : 'Não'}
                    ${produto.descricao ? ` | Obs.: ${escaparHtml(produto.descricao)}` : ''}
                </span>
            </div>
        `;
    });
}

function adicionarProdutoCarrinhoImportacao(id) {
    const produto = produtosImportacaoAPrazo.find(produtoItem => Number(produtoItem.id) === Number(id));

    if (!produto) return;

    const unidade = normalizarUnidadeMedidaImportacao(produto.unidade_medida);
    const valorUnitario = Number(produto.preco || 0);

    itensImportacaoAPrazo.push({
        produto: produto.nome || '',
        produto_codigo: produto.codigo || '',
        categoria: produto.categoria || '',
        unidade_medida: unidade,
        permite_fracionado: Number(produto.permite_fracionado || 0),
        manual: false,
        quantidade: 1,
        valor_unitario: valorUnitario,
        valor_total: arredondarMoeda(valorUnitario),
        observacao: ''
    });

    renderizarItensImportacaoAPrazo();

    const campoBusca = document.getElementById('buscaProdutoImportacao');
    const resultados = document.getElementById('resultadosProdutosImportacao');

    if (campoBusca) {
        campoBusca.value = '';
        campoBusca.focus();
    }

    if (resultados) {
        resultados.innerHTML = '';
    }

    setTimeout(() => {
        const ultimoIndice = itensImportacaoAPrazo.length - 1;
        const campoQuantidade = document.getElementById(`quantidadeImportacao_${ultimoIndice}`);

        if (campoQuantidade) {
            campoQuantidade.focus();
            campoQuantidade.select();
        }
    }, 50);
}

function configurarFechamentoSugestoesImportacao() {
    document.addEventListener('click', event => {
        if (!event.target.closest('.campo-sugestao-importacao')) {
            esconderTodosResultadosImportacao();
        }

        if (!event.target.closest('.campo-busca-produto-importacao')) {
            const resultadosProdutos = document.getElementById('resultadosProdutosImportacao');

            if (resultadosProdutos) {
                resultadosProdutos.innerHTML = '';
            }
        }
    });
}

function adicionarItemManualImportacaoAPrazo() {
    itensImportacaoAPrazo.push({
        produto: '',
        produto_codigo: '',
        quantidade: 1,
        valor_unitario: 0,
        valor_total: 0,
        unidade_medida: 'UN',
        permite_fracionado: 1,
        manual: true,
        observacao: ''
    });

    renderizarItensImportacaoAPrazo();

    setTimeout(() => {
        const ultimoIndice = itensImportacaoAPrazo.length - 1;
        const campoProduto = document.getElementById(`produtoImportacao_${ultimoIndice}`);

        if (campoProduto) {
            campoProduto.focus();
        }
    }, 50);
}

function adicionarItemImportacaoAPrazo() {
    adicionarItemManualImportacaoAPrazo();
}

function removerItemImportacaoAPrazo(indice) {
    itensImportacaoAPrazo.splice(indice, 1);

    if (itensImportacaoAPrazo.length === 0) {
        adicionarItemImportacaoAPrazo();
        return;
    }

    renderizarItensImportacaoAPrazo();
}

function atualizarCampoTotalLinha(indice) {
    const item = itensImportacaoAPrazo[indice];
    const campoTotal = document.getElementById(`valorTotalImportacao_${indice}`);

    if (!item || !campoTotal) return;

    campoTotal.textContent = formatarMoeda(calcularTotalItemImportacao(item));
}

function atualizarItemImportacaoAPrazo(indice, campo, valor) {
    if (!itensImportacaoAPrazo[indice]) return;

    if (campo === 'produto' || campo === 'observacao') {
        itensImportacaoAPrazo[indice][campo] = valor;
    } else if (campo === 'unidade_medida') {
        itensImportacaoAPrazo[indice][campo] = normalizarUnidadeMedidaImportacao(valor);
    } else {
        itensImportacaoAPrazo[indice][campo] = converterNumero(valor);
    }

    if (campo === 'quantidade' || campo === 'valor_unitario') {
        const quantidade = Number(itensImportacaoAPrazo[indice].quantidade || 0);
        const valorUnitario = Number(itensImportacaoAPrazo[indice].valor_unitario || 0);

        if (quantidade > 0 && valorUnitario > 0) {
            itensImportacaoAPrazo[indice].valor_total = arredondarMoeda(quantidade * valorUnitario);
            atualizarCampoTotalLinha(indice);
        }
    }

    if (campo === 'valor_total') {
        const quantidade = Number(itensImportacaoAPrazo[indice].quantidade || 0);
        const valorTotal = Number(itensImportacaoAPrazo[indice].valor_total || 0);

        if (quantidade > 0 && valorTotal > 0) {
            itensImportacaoAPrazo[indice].valor_unitario = arredondarMoeda(valorTotal / quantidade);

            const campoUnitario = document.getElementById(`valorUnitarioImportacao_${indice}`);

            if (campoUnitario) {
                campoUnitario.value = formatarNumeroInput(itensImportacaoAPrazo[indice].valor_unitario);
            }
        }
    }

    atualizarTotalImportacaoAPrazo();
}

function calcularTotalItemImportacao(item) {
    const valorTotal = Number(item.valor_total || 0);

    if (valorTotal > 0) {
        return arredondarMoeda(valorTotal);
    }

    return arredondarMoeda(
        Number(item.quantidade || 0) * Number(item.valor_unitario || 0)
    );
}

function calcularTotalImportacaoAPrazo() {
    return itensImportacaoAPrazo.reduce((soma, item) => {
        return soma + calcularTotalItemImportacao(item);
    }, 0);
}

function atualizarTotalImportacaoAPrazo() {
    const total = calcularTotalImportacaoAPrazo();
    const elemento = document.getElementById('totalImportacaoAPrazo');

    if (elemento) {
        elemento.textContent = formatarMoeda(total);
    }
}

function renderizarItensImportacaoAPrazo() {
    const tabela = document.getElementById('tabelaItensImportacao');

    tabela.innerHTML = '';

    if (itensImportacaoAPrazo.length === 0) {
        tabela.innerHTML = `
            <tr class="linha-carrinho-vazio-importacao">
                <td colspan="7">
                    Busque um produto acima ou adicione um item manual para começar a importar a conta do papel.
                </td>
            </tr>
        `;

        atualizarTotalImportacaoAPrazo();
        return;
    }

    itensImportacaoAPrazo.forEach((item, indice) => {
        const unidade = normalizarUnidadeMedidaImportacao(item.unidade_medida);
        const totalItem = calcularTotalItemImportacao(item);
        const produtoManual = item.manual !== false;

        tabela.innerHTML += `
            <tr class="linha-item-importacao">
                <td class="coluna-produto-importacao" data-label="Produto">
                    ${produtoManual ? `
                        <input
                            id="produtoImportacao_${indice}"
                            value="${escaparHtml(item.produto || '')}"
                            placeholder="Produto / descrição"
                            oninput="atualizarItemImportacaoAPrazo(${indice}, 'produto', this.value)"
                            class="campo-produto-manual-importacao"
                        >
                    ` : `
                        <strong>${escaparHtml(item.produto || '-')}</strong>
                        <small>
                            Código: ${escaparHtml(item.produto_codigo || '-')}
                            ${item.categoria ? ` | Categoria: ${escaparHtml(item.categoria)}` : ''}
                        </small>
                    `}
                </td>

                <td class="coluna-qtd-importacao" data-label="Qtd">
                    <input
                        id="quantidadeImportacao_${indice}"
                        value="${formatarNumeroInput(item.quantidade || 1)}"
                        placeholder="Qtd"
                        oninput="atualizarItemImportacaoAPrazo(${indice}, 'quantidade', this.value)"
                        class="campo-qtd-importacao"
                    >
                </td>

                <td class="coluna-unidade-importacao" data-label="Unidade">
                    ${produtoManual ? `
                        <select
                            id="unidadeImportacao_${indice}"
                            onchange="atualizarItemImportacaoAPrazo(${indice}, 'unidade_medida', this.value)"
                            class="campo-unidade-importacao"
                        >
                            ${['UN', 'KG', 'G', 'L', 'ML', 'M'].map(opcao => `
                                <option value="${opcao}" ${opcao === unidade ? 'selected' : ''}>${opcao}</option>
                            `).join('')}
                        </select>
                    ` : `
                        <span class="tag-unidade-importacao">${escaparHtml(unidade)}</span>
                    `}
                </td>

                <td class="coluna-valor-importacao" data-label="Valor Unit.">
                    <input
                        id="valorUnitarioImportacao_${indice}"
                        value="${formatarNumeroInput(item.valor_unitario)}"
                        placeholder="Valor unit."
                        oninput="atualizarItemImportacaoAPrazo(${indice}, 'valor_unitario', this.value)"
                        class="campo-valor-importacao"
                    >
                </td>

                <td class="coluna-total-importacao" data-label="Total">
                    <strong id="valorTotalImportacao_${indice}">${formatarMoeda(totalItem)}</strong>
                </td>

                <td class="coluna-observacao-importacao" data-label="Observação">
                    <input
                        value="${escaparHtml(item.observacao || '')}"
                        placeholder="Obs. do item"
                        oninput="atualizarItemImportacaoAPrazo(${indice}, 'observacao', this.value)"
                    >
                </td>

                <td class="coluna-acao-importacao" data-label="Ação">
                    <button
                        onclick="removerItemImportacaoAPrazo(${indice})"
                        class="botao-remover-importacao"
                    >
                        Remover
                    </button>
                </td>
            </tr>
        `;
    });

    atualizarTotalImportacaoAPrazo();
}

function validarItensImportacao() {
    const itensValidos = [];

    for (let i = 0; i < itensImportacaoAPrazo.length; i++) {
        const item = itensImportacaoAPrazo[i];

        const produto = String(item.produto || '').trim();
        const quantidade = Number(item.quantidade || 0);
        const valorUnitario = Number(item.valor_unitario || 0);
        const valorTotal = calcularTotalItemImportacao(item);
        const unidadeMedida = normalizarUnidadeMedidaImportacao(item.unidade_medida);
        const observacao = String(item.observacao || '').trim();

        if (!produto && valorTotal <= 0) {
            continue;
        }

        if (!produto) {
            mostrarMensagemSistema(`Informe a descrição do item ${i + 1}.`, 'aviso');
            return null;
        }

        if (valorTotal <= 0) {
            mostrarMensagemSistema(`Informe o valor do item ${i + 1}.`, 'aviso');
            return null;
        }

        itensValidos.push({
            produto,
            quantidade: quantidade > 0 ? quantidade : 1,
            valor_unitario: valorUnitario > 0 ? valorUnitario : valorTotal,
            valor_total: valorTotal,
            unidade_medida: unidadeMedida,
            observacao
        });
    }

    if (itensValidos.length === 0) {
        mostrarMensagemSistema('Adicione pelo menos um item para importar.', 'aviso');
        return null;
    }

    return itensValidos;
}

async function salvarImportacaoAPrazo() {
    const clienteNome = document.getElementById('clienteImportacao').value.trim();
    const telefone = document.getElementById('telefoneImportacao').value.trim();
    const cidade = document.getElementById('cidadeImportacao').value.trim();
    const data = document.getElementById('dataImportacao').value;

    if (!clienteNome) {
        mostrarMensagemSistema('Informe o nome do cliente.', 'aviso');
        return;
    }

    if (!data) {
        mostrarMensagemSistema('Informe a data original da conta.', 'aviso');
        return;
    }

    const itens = validarItensImportacao();

    if (!itens) {
        return;
    }

    const totalImportacao = itens.reduce((soma, item) => {
        return soma + Number(item.valor_total || 0);
    }, 0);

    const confirmar = await mostrarConfirmacaoSistema({
        titulo: 'Confirmar importação?',
        mensagem: `Cliente: ${clienteNome}. Total importado: ${formatarMoeda(totalImportacao)}. Essa importação não vai mexer no estoque e não vai entrar como venda do dia.`,
        textoConfirmar: 'Importar',
        textoCancelar: 'Cancelar',
        tipo: 'aviso'
    });

    if (!confirmar) {
        return;
    }

    try {
        const resposta = await fetch('http://localhost:3000/fiados/importar-a-prazo', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                cliente_nome: clienteNome,
                telefone,
                cidade,
                data,
                itens
            })
        });

        const dados = await resposta.json();

        if (!resposta.ok || !dados.sucesso) {
            mostrarMensagemSistema(dados.erro || 'Erro ao importar conta a prazo.', 'erro');
            return;
        }

        mostrarMensagemSistema(`Importação concluída com sucesso. Itens importados: ${dados.itens_importados}. Total: ${formatarMoeda(dados.total)}.`, 'sucesso');

        window.location.href = `fiado-detalhe.html?cliente=${encodeURIComponent(clienteNome)}`;

    } catch (erro) {
        console.error('Erro ao importar conta a prazo:', erro);
        mostrarMensagemSistema('Erro ao importar conta a prazo. Verifique se o servidor está rodando.', 'erro');
    }
}

async function iniciarImportacaoAPrazo() {
    const dataImportacao = document.getElementById('dataImportacao');

    if (dataImportacao) {
        dataImportacao.value = dataParaInput(new Date());
    }

    renderizarItensImportacaoAPrazo();
    configurarFechamentoSugestoesImportacao();

    await Promise.all([
        carregarClientesImportacaoAPrazo(),
        carregarProdutosImportacaoAPrazo()
    ]);
}

iniciarImportacaoAPrazo();
