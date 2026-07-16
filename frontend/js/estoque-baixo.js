async function carregarEstoqueBaixo() {
    try {
        const resposta = await fetch('https://vale-agro-alpha.vercel.app/estoque-baixo');
        const produtos = await resposta.json();

        document.getElementById('totalProdutosBaixos').textContent = produtos.length;

        renderizarProdutosBaixos(produtos);

    } catch (erro) {
        console.error('Erro ao carregar estoque baixo:', erro);
        mostrarMensagemSistema('Erro ao carregar produtos com estoque baixo. Verifique se o servidor está rodando.', 'erro');
    }
}

function escaparHtml(valor) {
    return String(valor || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function renderizarProdutosBaixos(produtos) {
    const tabela = document.getElementById('tabelaEstoqueBaixo');
    tabela.innerHTML = '';

    if (!produtos || produtos.length === 0) {
        tabela.innerHTML = `
            <tr>
                <td colspan="8">Nenhum produto com estoque baixo.</td>
            </tr>
        `;
        return;
    }

    produtos.forEach(produto => {
        const estoqueAtual = Number(produto.estoque || 0);
        const estoqueMinimo = Number(produto.estoque_minimo || 0);
        const faltaRepor = Math.max(estoqueMinimo - estoqueAtual, 0);
        const descricao = String(produto.descricao || '').trim();

        tabela.innerHTML += `
            <tr class="estoque-baixo">
                <td>
                    <strong>${escaparHtml(produto.nome || '-')}</strong>
                </td>
                <td>${escaparHtml(produto.codigo || '-')}</td>
                <td>${escaparHtml(produto.categoria || '-')}</td>
                <td>
                    ${
                        descricao
                            ? escaparHtml(descricao)
                            : '<span style="color:#8892b0;">-</span>'
                    }
                </td>
                <td>${estoqueAtual}</td>
                <td>${estoqueMinimo}</td>
                <td>
                    <strong>${faltaRepor}</strong>
                </td>
                <td>
                    <button onclick="irParaMovimentacao(${produto.id}, ${faltaRepor})">
                        Registrar Entrada
                    </button>

                    <button onclick="irParaEstoque()" class="btn-secondary">
                        Ver Estoque
                    </button>
                </td>
            </tr>
        `;
    });
}

function irParaMovimentacao(produtoId, quantidadeSugerida) {
    window.location.href = `movimentacoes.html?produto_id=${produtoId}&tipo=ENTRADA&quantidade=${quantidadeSugerida}`;
}

function irParaEstoque() {
    window.location.href = 'estoque.html';
}

carregarEstoqueBaixo();
