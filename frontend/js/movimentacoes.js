let produtosMovimentacao = [];
let produtoSelecionado = null;
let produtoFiltroSelecionado = '';

function converterNumero(valor) {
    if (!valor) return 0;

    let texto = String(valor)
        .replace(/[R$\s]/g, '')
        .replace(/\./g, '')
        .replace(',', '.');

    return Number(texto) || 0;
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

function dataParaInput(data) {
    const ano = data.getFullYear();
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const dia = String(data.getDate()).padStart(2, '0');

    return `${ano}-${mes}-${dia}`;
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

function hojeInput() {
    return dataParaInput(new Date());
}

function ultimoDiaDoMes(ano, mes) {
    return new Date(ano, Number(mes), 0).getDate();
}

function preencherAnos() {
    const selectAno = document.getElementById('filtroAno');
    const anoAtual = new Date().getFullYear();

    selectAno.innerHTML = '';

    for (let ano = anoAtual; ano >= anoAtual - 10; ano--) {
        selectAno.innerHTML += `<option value="${ano}">${ano}</option>`;
    }

    selectAno.value = anoAtual;
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

    if (periodo === 'MES_ANO') {
        const ano = document.getElementById('filtroAno').value;
        const mes = document.getElementById('filtroMes').value;
        const ultimoDia = ultimoDiaDoMes(ano, mes);

        return {
            dataInicial: `${ano}-${mes}-01`,
            dataFinal: `${ano}-${mes}-${String(ultimoDia).padStart(2, '0')}`
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
    const filtroAno = document.getElementById('filtroAno');
    const filtroMes = document.getElementById('filtroMes');

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

async function carregarProdutosMovimentacao() {
    const resposta = await fetch('https://vale-agro-alpha.vercel.app/produtos');
    produtosMovimentacao = await resposta.json();
}

function pesquisarProdutoMovimentacao() {
    const busca = normalizarTextoBusca(document.getElementById('buscaProdutoMov').value);
    const resultados = document.getElementById('resultadosProdutosMov');

    resultados.innerHTML = '';

    if (busca.length < 1) return;

    const filtrados = filtrarProdutos(busca);

    if (filtrados.length === 0) {
        resultados.innerHTML = `<div class="item-produto-busca">Nenhum produto encontrado.</div>`;
        return;
    }

    filtrados.slice(0, 12).forEach(produto => {
        resultados.innerHTML += `
            <div class="item-produto-busca" onclick="selecionarProdutoMovimentacao(${produto.id})">
                <strong>${produto.nome}</strong>
                <span>
                    Código: ${produto.codigo || '-'} |
                    Categoria: ${produto.categoria || '-'} |
                    Estoque atual: ${produto.estoque}
                </span>
            </div>
        `;
    });
}

function filtrarProdutos(busca) {
    return produtosMovimentacao.filter(produto =>
        campoComecaComBusca(produto.nome, busca) ||
        campoComecaComBusca(produto.codigo, busca) ||
        campoComecaComBusca(produto.categoria, busca) ||
        campoComecaComBusca(produto.descricao, busca)
    );
}

function selecionarProdutoMovimentacao(id) {
    produtoSelecionado = produtosMovimentacao.find(produto => Number(produto.id) === Number(id));

    if (!produtoSelecionado) return;

    document.getElementById('buscaProdutoMov').value = produtoSelecionado.nome;
    document.getElementById('resultadosProdutosMov').innerHTML = '';

    document.getElementById('produtoSelecionadoMov').innerHTML = `
        <strong>Produto selecionado:</strong><br>
        ${produtoSelecionado.nome}<br>
        Código: ${produtoSelecionado.codigo || '-'} |
        Categoria: ${produtoSelecionado.categoria || '-'} |
        Estoque atual: ${produtoSelecionado.estoque}
        ${produtoSelecionado.descricao ? `<br>Obs.: ${produtoSelecionado.descricao}` : ''}
    `;
}

function aplicarParametrosDaUrl() {
    const parametros = new URLSearchParams(window.location.search);

    const produtoId = Number(parametros.get('produto_id') || 0);
    const tipo = parametros.get('tipo') || '';
    const quantidade = parametros.get('quantidade') || '';

    if (produtoId > 0) {
        selecionarProdutoMovimentacao(produtoId);
    }

    if (tipo) {
        const tipoMovimentacao = document.getElementById('tipoMovimentacao');

        if (tipoMovimentacao) {
            const tiposValidos = ['ENTRADA', 'SAIDA', 'PERDA', 'AJUSTE'];

            if (tiposValidos.includes(tipo)) {
                tipoMovimentacao.value = tipo;
            }
        }
    }

    if (quantidade && Number(quantidade) > 0) {
        const campoQuantidade = document.getElementById('quantidadeMovimentacao');

        if (campoQuantidade) {
            campoQuantidade.value = quantidade;
        }
    }

    if (produtoId > 0 || tipo || quantidade) {
        const campoQuantidade = document.getElementById('quantidadeMovimentacao');

        if (campoQuantidade) {
            campoQuantidade.focus();
            campoQuantidade.select();
        }

        window.history.replaceState({}, document.title, 'movimentacoes.html');
    }
}

function pesquisarProdutoFiltro() {
    const busca = normalizarTextoBusca(document.getElementById('buscaProdutoFiltro').value);
    const resultados = document.getElementById('resultadosProdutosFiltro');

    resultados.innerHTML = '';

    if (busca.length < 1) {
        produtoFiltroSelecionado = '';
        document.getElementById('produtoFiltroSelecionado').innerHTML = '';
        return;
    }

    const filtrados = filtrarProdutos(busca);

    if (filtrados.length === 0) {
        resultados.innerHTML = `<div class="item-produto-busca">Nenhum produto encontrado.</div>`;
        return;
    }

    filtrados.slice(0, 12).forEach(produto => {
        resultados.innerHTML += `
            <div class="item-produto-busca" onclick="selecionarProdutoFiltro('${produto.nome.replace(/'/g, "\\'")}')">
                <strong>${produto.nome}</strong>
                <span>
                    Código: ${produto.codigo || '-'} |
                    Categoria: ${produto.categoria || '-'}
                    ${produto.descricao ? ` | Obs.: ${produto.descricao}` : ''}
                </span>
            </div>
        `;
    });
}

function selecionarProdutoFiltro(nomeProduto) {
    produtoFiltroSelecionado = nomeProduto;

    document.getElementById('buscaProdutoFiltro').value = nomeProduto;
    document.getElementById('resultadosProdutosFiltro').innerHTML = '';

    document.getElementById('produtoFiltroSelecionado').innerHTML = `
        <strong>Filtro de produto:</strong> ${nomeProduto}
    `;

    carregarMovimentacoes();
}

function limparProdutoFiltro() {
    produtoFiltroSelecionado = '';
    document.getElementById('buscaProdutoFiltro').value = '';
    document.getElementById('resultadosProdutosFiltro').innerHTML = '';
    document.getElementById('produtoFiltroSelecionado').innerHTML = '';

    carregarMovimentacoes();
}

async function salvarMovimentacao() {
    const tipo = document.getElementById('tipoMovimentacao').value;
    const quantidade = converterNumero(document.getElementById('quantidadeMovimentacao').value);
    const observacao = document.getElementById('observacaoMovimentacao').value.trim();

    if (!produtoSelecionado) {
        mostrarMensagemSistema('Selecione um produto.', 'aviso');
        return;
    }

    if (quantidade <= 0) {
        mostrarMensagemSistema('Informe uma quantidade válida.', 'aviso');
        return;
    }

    const resposta = await fetch('https://vale-agro-alpha.vercel.app/movimentacoes-estoque', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            produto_id: produtoSelecionado.id,
            tipo,
            quantidade,
            observacao
        })
    });

    const dados = await resposta.json();

    if (!dados.sucesso) {
        mostrarMensagemSistema(dados.erro || 'Erro ao registrar movimentação.', 'erro');
        return;
    }

    mostrarMensagemSistema('Movimentação registrada com sucesso!', 'sucesso');

    produtoSelecionado = null;

    document.getElementById('buscaProdutoMov').value = '';
    document.getElementById('quantidadeMovimentacao').value = '';
    document.getElementById('observacaoMovimentacao').value = '';
    document.getElementById('produtoSelecionadoMov').innerHTML = '';
    document.getElementById('resultadosProdutosMov').innerHTML = '';

    await carregarProdutosMovimentacao();
    await carregarMovimentacoes();
}

async function carregarMovimentacoes() {
    const periodo = calcularPeriodoSelecionado();
    const tipo = document.getElementById('filtroTipo').value;

    const params = new URLSearchParams();

    if (periodo.dataInicial) params.append('dataInicial', periodo.dataInicial);
    if (periodo.dataFinal) params.append('dataFinal', periodo.dataFinal);
    if (tipo) params.append('tipo', tipo);
    if (produtoFiltroSelecionado) params.append('produto', produtoFiltroSelecionado);

    const resposta = await fetch(`https://vale-agro-alpha.vercel.app/movimentacoes-estoque?${params.toString()}`);
    const dados = await resposta.json();

    renderizarMovimentacoes(dados);
    atualizarResumo(dados);
}

function podeCancelarMovimentacao(item) {
    const tipo = String(item.tipo || '').toUpperCase();

    if (Number(item.cancelada || 0) === 1) return false;

    if (tipo === 'CANCELAMENTO_VENDA') return false;
    if (tipo === 'CANCELAMENTO_MOVIMENTACAO') return false;

    return ['ENTRADA', 'SAIDA', 'PERDA', 'AJUSTE', 'VENDA'].includes(tipo);
}

function montarAcoesMovimentacao(item) {
    if (!podeCancelarMovimentacao(item)) {
        return '<span style="color:#8892b0;font-size:12px;">-</span>';
    }

    const tipo = String(item.tipo || '').toUpperCase();
    const textoBotao = tipo === 'VENDA' || item.venda_id
        ? 'Cancelar venda'
        : 'Cancelar';

    const classeBotao = tipo === 'VENDA' || item.venda_id
        ? 'btn-danger botao-tabela-compacto'
        : 'btn-secondary botao-tabela-compacto';

    return `
        <button
            onclick="cancelarMovimentacao(${item.id})"
            class="${classeBotao}"
        >
            ${textoBotao}
        </button>
    `;
}

async function cancelarMovimentacao(id) {
    if (!id) return;

    const item = await buscarMovimentacaoNaTela(id);
    const cancelamentoVenda = item && (item.tipo === 'VENDA' || item.venda_id);

    let mensagem = 'Tem certeza que deseja cancelar esta movimentação?';

    if (cancelamentoVenda) {
        mensagem =
            'Esta movimentação pertence a uma venda.\n\n' +
            'Ao cancelar, o sistema tentará cancelar a venda completa, devolver os produtos ao estoque, ajustar o financeiro e cancelar o A Prazo vinculado, se existir.\n\n' +
            'Deseja continuar?';
    } else {
        mensagem =
            'Tem certeza que deseja cancelar esta movimentação?\n\n' +
            'O sistema vai fazer o ajuste contrário no estoque e manter o registro de cancelamento no histórico.';
    }

    const confirmar = await mostrarConfirmacaoSistema({
        titulo: cancelamentoVenda ? 'Cancelar venda?' : 'Cancelar movimentação?',
        mensagem,
        textoConfirmar: 'Continuar',
        textoCancelar: 'Voltar',
        tipo: cancelamentoVenda ? 'info' : 'perigo'
    });

    if (!confirmar) return;

    const motivo = await mostrarPromptSistema({
        titulo: 'Motivo do cancelamento',
        mensagem: 'Informe o motivo para manter o histórico claro.',
        rotulo: 'Motivo',
        valorInicial: 'Lançamento incorreto',
        textoConfirmar: 'Confirmar cancelamento',
        textoCancelar: 'Voltar',
        tipo: cancelamentoVenda ? 'info' : 'perigo'
    });

    if (motivo === null) return;

    try {
        const resposta = await fetch(`https://vale-agro-alpha.vercel.app/movimentacoes-estoque/${id}/cancelar`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                motivo: motivo || 'Cancelamento feito pelo usuário'
            })
        });

        const dados = await resposta.json();

        if (!resposta.ok || !dados.sucesso) {
            mostrarMensagemSistema(dados.erro || 'Erro ao cancelar movimentação.', 'erro');
            return;
        }

        mostrarMensagemSistema('Cancelamento realizado com sucesso.', 'sucesso');

        await carregarProdutosMovimentacao();
        await carregarMovimentacoes();

    } catch (erro) {
        mostrarMensagemSistema('Erro ao cancelar movimentação. Verifique se o servidor está rodando.', 'erro');
    }
}

async function buscarMovimentacaoNaTela(id) {
    const periodo = calcularPeriodoSelecionado();
    const tipo = document.getElementById('filtroTipo').value;

    const params = new URLSearchParams();

    if (periodo.dataInicial) params.append('dataInicial', periodo.dataInicial);
    if (periodo.dataFinal) params.append('dataFinal', periodo.dataFinal);
    if (tipo) params.append('tipo', tipo);
    if (produtoFiltroSelecionado) params.append('produto', produtoFiltroSelecionado);

    const resposta = await fetch(`https://vale-agro-alpha.vercel.app/movimentacoes-estoque?${params.toString()}`);
    const dados = await resposta.json();

    return dados.find(item => Number(item.id) === Number(id)) || null;
}

function renderizarMovimentacoes(lista) {
    const tabela = document.getElementById('tabelaMovimentacoes');
    tabela.innerHTML = '';

    if (!lista || lista.length === 0) {
        tabela.innerHTML = `
            <tr>
                <td colspan="8">Nenhuma movimentação encontrada.</td>
            </tr>
        `;
        return;
    }

    lista.forEach(item => {
        tabela.innerHTML += `
            <tr>
                <td>${formatarDataHora(item.data, item.hora)}</td>
                <td>${item.produto_nome}</td>
                <td>${formatarTipo(item.tipo)}</td>
                <td>${formatarQuantidade(item)}</td>
                <td>${item.estoque_anterior}</td>
                <td>${item.estoque_atual}</td>
                <td>${item.observacao || '-'}</td>
                <td>${montarAcoesMovimentacao(item)}</td>
            </tr>
        `;
    });
}

function formatarTipo(tipo) {
    const nomes = {
        ENTRADA: 'Entrada',
        SAIDA: 'Saída Manual',
        PERDA: 'Perda',
        AJUSTE: 'Ajuste',
        VENDA: 'Venda',
        CANCELAMENTO_VENDA: 'Cancelamento de Venda',
        CANCELAMENTO_MOVIMENTACAO: 'Cancelamento de Movimentação'
    };

    return nomes[tipo] || tipo;
}

function formatarQuantidade(item) {
    const tipo = String(item.tipo || '').toUpperCase();
    const quantidade = Number(item.quantidade || 0);
    const estoqueAnterior = Number(item.estoque_anterior || 0);
    const estoqueAtual = Number(item.estoque_atual || 0);
    const diferenca = estoqueAtual - estoqueAnterior;

    if (tipo === 'ENTRADA') return `+${quantidade}`;
    if (tipo === 'AJUSTE') return quantidade;
    if (tipo === 'CANCELAMENTO_VENDA') return `+${quantidade}`;

    if (tipo === 'CANCELAMENTO_MOVIMENTACAO') {
        if (diferenca > 0) return `+${Math.abs(diferenca)}`;
        if (diferenca < 0) return `-${Math.abs(diferenca)}`;
        return quantidade;
    }

    return `-${quantidade}`;
}

function atualizarResumo(lista) {
    const entradas = lista
        .filter(item => {
            if (item.tipo === 'ENTRADA') return true;
            if (item.tipo === 'CANCELAMENTO_VENDA') return true;

            if (item.tipo === 'CANCELAMENTO_MOVIMENTACAO') {
                return Number(item.estoque_atual || 0) > Number(item.estoque_anterior || 0);
            }

            return false;
        })
        .reduce((soma, item) => {
            if (item.tipo === 'CANCELAMENTO_MOVIMENTACAO') {
                return soma + Math.abs(Number(item.estoque_atual || 0) - Number(item.estoque_anterior || 0));
            }

            return soma + Number(item.quantidade || 0);
        }, 0);

    const saidas = lista
        .filter(item => {
            if (item.tipo === 'SAIDA') return true;
            if (item.tipo === 'VENDA') return true;

            if (item.tipo === 'CANCELAMENTO_MOVIMENTACAO') {
                return Number(item.estoque_atual || 0) < Number(item.estoque_anterior || 0);
            }

            return false;
        })
        .reduce((soma, item) => {
            if (item.tipo === 'CANCELAMENTO_MOVIMENTACAO') {
                return soma + Math.abs(Number(item.estoque_atual || 0) - Number(item.estoque_anterior || 0));
            }

            return soma + Number(item.quantidade || 0);
        }, 0);

    const perdas = lista
        .filter(item => item.tipo === 'PERDA')
        .reduce((soma, item) => soma + Number(item.quantidade || 0), 0);

    const ajustes = lista
        .filter(item => item.tipo === 'AJUSTE').length;

    document.getElementById('totalEntradas').textContent = entradas;
    document.getElementById('totalSaidas').textContent = saidas;
    document.getElementById('totalPerdas').textContent = perdas;
    document.getElementById('totalAjustes').textContent = ajustes;
}

function limparFiltros() {
    document.getElementById('filtroPeriodo').value = 'HOJE';
    document.getElementById('dataInicial').value = '';
    document.getElementById('dataFinal').value = '';
    document.getElementById('filtroTipo').value = '';
    document.getElementById('buscaProdutoFiltro').value = '';
    document.getElementById('resultadosProdutosFiltro').innerHTML = '';
    document.getElementById('produtoFiltroSelecionado').innerHTML = '';

    const filtroMes = document.getElementById('filtroMes');
    if (filtroMes) {
        filtroMes.value = String(new Date().getMonth() + 1).padStart(2, '0');
    }

    produtoFiltroSelecionado = '';

    verificarPeriodoPersonalizado();
    carregarMovimentacoes();
}

async function iniciarPagina() {
    preencherAnos();

    const filtroMes = document.getElementById('filtroMes');
    if (filtroMes) {
        filtroMes.value = String(new Date().getMonth() + 1).padStart(2, '0');
    }

    verificarPeriodoPersonalizado();
    await carregarProdutosMovimentacao();

    aplicarParametrosDaUrl();

    await carregarMovimentacoes();
}

iniciarPagina();
