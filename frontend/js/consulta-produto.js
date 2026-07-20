let produtosConsultaRapida = [];
let produtosConsultaCarregados = false;

function normalizarTextoConsultaProduto(texto) {
    return String(texto || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ');
}

function escaparHtmlConsultaProduto(valor) {
    return String(valor || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function formatarMoedaConsultaProduto(valor) {
    return Number(valor || 0).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
}

function normalizarUnidadeConsultaProduto(valor) {
    const unidade = String(valor || 'UN').trim().toUpperCase();
    const unidadesValidas = ['UN', 'KG', 'G', 'L', 'ML', 'M'];

    return unidadesValidas.includes(unidade) ? unidade : 'UN';
}

function formatarQuantidadeConsultaProduto(valor) {
    return Number(valor || 0).toLocaleString('pt-BR', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 3
    });
}

function formatarQuantidadeComUnidadeConsultaProduto(valor, unidade) {
    return `${formatarQuantidadeConsultaProduto(valor)} ${normalizarUnidadeConsultaProduto(unidade)}`;
}

function formatarPrecoComUnidadeConsultaProduto(valor, unidade) {
    return `${formatarMoedaConsultaProduto(valor)} / ${normalizarUnidadeConsultaProduto(unidade)}`;
}

function produtoPermiteFracionadoConsultaProduto(produto) {
    return Number(produto?.permite_fracionado || 0) === 1;
}

function produtoCombinaComConsulta(produto, termo) {
    const termoNormalizado = normalizarTextoConsultaProduto(termo);
    const nomeNormalizado = normalizarTextoConsultaProduto(produto.nome || '');
    const codigoNormalizado = normalizarTextoConsultaProduto(produto.codigo || '');

    if (!termoNormalizado) return false;

    const palavrasNome = nomeNormalizado.split(' ').filter(Boolean);

    return codigoNormalizado.startsWith(termoNormalizado) ||
        nomeNormalizado.startsWith(termoNormalizado) ||
        palavrasNome.some(palavra => palavra.startsWith(termoNormalizado));
}

function criarBotaoConsultaProduto() {
    if (document.getElementById('abrirConsultaProduto')) return;

    const cabecalho = document.querySelector([
        '.page-hero',
        '.cabecalho-pagina-estoque',
        '.cabecalho-pagina-fiados',
        '.cabecalho-pagina-movimentacoes',
        '.cabecalho-pagina-financeiro',
        '.cabecalho-importar-fiado',
        '.cabecalho-fiado-detalhe'
    ].join(','));

    if (!cabecalho) return;

    const botao = document.createElement('button');
    botao.type = 'button';
    botao.id = 'abrirConsultaProduto';
    botao.className = 'btn-consulta-produto-global';
    botao.textContent = 'Consultar Produto';
    botao.addEventListener('click', abrirConsultaProduto);

    cabecalho.appendChild(botao);
}

function criarModalConsultaProduto() {
    if (document.getElementById('modalConsultaProduto')) return;

    const modal = document.createElement('div');
    modal.id = 'modalConsultaProduto';
    modal.className = 'modal-consulta-produto';
    modal.setAttribute('aria-hidden', 'true');

    modal.innerHTML = `
        <div class="consulta-produto-conteudo" role="dialog" aria-modal="true" aria-labelledby="tituloConsultaProduto">
            <div class="consulta-produto-topo">
                <div>
                    <span class="eyebrow">Consulta rapida</span>
                    <h2 id="tituloConsultaProduto">Consulta Rápida de Produto</h2>
                </div>

                <button type="button" id="fecharConsultaProduto" class="fechar-consulta-produto" aria-label="Fechar consulta">×</button>
            </div>

            <input
                id="inputConsultaProduto"
                class="input-consulta-produto"
                placeholder="Digite nome ou código do produto"
                autocomplete="off"
            >

            <div id="resultadoConsultaProduto" class="resultado-consulta-produto">
                <p class="mensagem-consulta-produto">Digite o início do nome, de qualquer palavra do produto ou o código.</p>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    modal.addEventListener('click', evento => {
        if (evento.target === modal) {
            fecharConsultaProduto();
        }
    });

    document.getElementById('fecharConsultaProduto').addEventListener('click', fecharConsultaProduto);
    document.getElementById('inputConsultaProduto').addEventListener('input', renderizarResultadoConsultaProduto);
}

async function carregarProdutosConsultaProduto() {
    if (produtosConsultaCarregados) return;

    const resultado = document.getElementById('resultadoConsultaProduto');

    try {
        resultado.innerHTML = '<p class="mensagem-consulta-produto">Carregando produtos...</p>';

        const resposta = await fetch('/produtos');
        const produtos = await resposta.json();

        if (!resposta.ok) {
            throw new Error(produtos.erro || 'Erro ao carregar produtos.');
        }

        produtosConsultaRapida = Array.isArray(produtos) ? produtos : [];
        produtosConsultaCarregados = true;
        renderizarResultadoConsultaProduto();

    } catch (erro) {
        console.error('Erro ao consultar produtos:', erro);
        resultado.innerHTML = '<p class="mensagem-consulta-produto erro">Não foi possível carregar os produtos.</p>';
    }
}

function abrirConsultaProduto() {
    criarModalConsultaProduto();

    const modal = document.getElementById('modalConsultaProduto');
    const input = document.getElementById('inputConsultaProduto');

    modal.classList.add('ativo');
    modal.setAttribute('aria-hidden', 'false');
    input.value = '';

    carregarProdutosConsultaProduto();

    setTimeout(() => {
        input.focus();
    }, 0);
}

function fecharConsultaProduto() {
    const modal = document.getElementById('modalConsultaProduto');

    if (!modal) return;

    modal.classList.remove('ativo');
    modal.setAttribute('aria-hidden', 'true');
}

function renderizarResultadoConsultaProduto() {
    const input = document.getElementById('inputConsultaProduto');
    const resultado = document.getElementById('resultadoConsultaProduto');

    if (!input || !resultado) return;

    const termo = input.value;
    const termoNormalizado = normalizarTextoConsultaProduto(termo);

    if (!termoNormalizado) {
        resultado.innerHTML = '<p class="mensagem-consulta-produto">Digite o início do nome, de qualquer palavra do produto ou o código.</p>';
        return;
    }

    const produtosFiltrados = produtosConsultaRapida
        .filter(produto => produtoCombinaComConsulta(produto, termo))
        .slice(0, 8);

    if (produtosFiltrados.length === 0) {
        resultado.innerHTML = '<p class="mensagem-consulta-produto">Nenhum produto encontrado.</p>';
        return;
    }

    resultado.innerHTML = produtosFiltrados.map(produto => {
        const ativo = Number(produto.ativo ?? 1) === 1;
        const estoque = Number(produto.estoque || 0);
        const unidade = normalizarUnidadeConsultaProduto(produto.unidade_medida);
        const fracionado = produtoPermiteFracionadoConsultaProduto(produto);
        const observacao = String(produto.descricao || '').trim();

        return `
            <article class="card-consulta-produto">
                <div class="card-consulta-produto-cabecalho">
                    <strong>${escaparHtmlConsultaProduto(produto.nome || '-')}</strong>
                    <span class="${ativo ? 'status-consulta-ativo' : 'status-consulta-inativo'}">${ativo ? 'Ativo' : 'Desativado'}</span>
                </div>

                <div class="grid-consulta-produto">
                    <p><span>Código</span>${escaparHtmlConsultaProduto(produto.codigo || '-')}</p>
                    <p><span>Categoria</span>${escaparHtmlConsultaProduto(produto.categoria || '-')}</p>
                    <p><span>Unidade</span>${unidade}</p>
                    <p><span>Venda fracionada</span>${fracionado ? 'Sim' : 'Não'}</p>
                    <p><span>Preço</span>${formatarPrecoComUnidadeConsultaProduto(produto.preco, unidade)}</p>
                    <p><span>Estoque</span>${formatarQuantidadeComUnidadeConsultaProduto(estoque, unidade)}</p>
                </div>

                <p class="observacao-consulta-produto">
                    <span>Observação</span>
                    ${observacao ? escaparHtmlConsultaProduto(observacao) : '-'}
                </p>
            </article>
        `;
    }).join('');
}

document.addEventListener('keydown', evento => {
    if (evento.key === 'F2') {
        evento.preventDefault();
        abrirConsultaProduto();
        return;
    }

    if (evento.key === 'Escape') {
        fecharConsultaProduto();
    }
});

document.addEventListener('DOMContentLoaded', () => {
    criarBotaoConsultaProduto();
    criarModalConsultaProduto();
});
