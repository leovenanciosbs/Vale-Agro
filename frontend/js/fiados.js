let listaFiadosResumo = [];

const DIAS_PRAZO = 30;
const DIAS_PERTO_VENCIMENTO = 25;

function formatarMoeda(valor) {
    return Number(valor || 0).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
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

function preencherTexto(id, valor) {
    const elemento = document.getElementById(id);

    if (elemento) {
        elemento.textContent = valor;
    }
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

function calcularDiasEmAberto(dataCompra) {
    if (!dataCompra) return 0;

    const hoje = new Date();
    const data = new Date(dataCompra + 'T00:00:00');

    hoje.setHours(0, 0, 0, 0);
    data.setHours(0, 0, 0, 0);

    const dias = Math.floor((hoje - data) / (1000 * 60 * 60 * 24));

    return dias < 0 ? 0 : dias;
}

function obterStatusPrazo(dias) {
    if (dias >= DIAS_PRAZO) {
        return {
            texto: 'Em atraso',
            classe: 'status-atrasado',
            classeLinha: 'linha-fiado-atraso',
            classeTag: 'tag-fiado-atraso'
        };
    }

    if (dias >= DIAS_PERTO_VENCIMENTO) {
        return {
            texto: 'Perto do vencimento',
            classe: 'status-proximo',
            classeLinha: 'linha-fiado-proximo',
            classeTag: 'tag-fiado-proximo'
        };
    }

    return {
        texto: 'Dentro do prazo',
        classe: 'status-ok',
        classeLinha: 'linha-fiado-ok',
        classeTag: 'tag-fiado-ok'
    };
}

function encontrarCompraMaisAntigaAberta(movimentosCliente) {
    let saldoPagamentos = movimentosCliente
        .filter(item => item.tipo === 'PAGAMENTO')
        .reduce((total, item) => total + Number(item.valor_total || 0), 0);

    const compras = movimentosCliente
        .filter(item => item.tipo === 'COMPRA')
        .sort(compararPorDataHoraId);

    for (const compra of compras) {
        const valorCompra = Number(compra.valor_total || 0);

        if (saldoPagamentos >= valorCompra) {
            saldoPagamentos -= valorCompra;
        } else {
            return compra;
        }
    }

    return null;
}

function ordenarResumoFiados(lista) {
    return [...lista].sort((a, b) => {
        const prioridadeA = a.statusClasse === 'status-atrasado'
            ? 1
            : a.statusClasse === 'status-proximo'
                ? 2
                : 3;

        const prioridadeB = b.statusClasse === 'status-atrasado'
            ? 1
            : b.statusClasse === 'status-proximo'
                ? 2
                : 3;

        if (prioridadeA !== prioridadeB) {
            return prioridadeA - prioridadeB;
        }

        if (Number(a.dias || 0) !== Number(b.dias || 0)) {
            return Number(b.dias || 0) - Number(a.dias || 0);
        }

        return String(a.cliente_nome || '').localeCompare(String(b.cliente_nome || ''));
    });
}

async function carregarResumoFiados() {
    try {
        const respostaResumo = await fetch('https://vale-agro-alpha.vercel.app/fiados/resumo');
        const resumo = await respostaResumo.json();

        const respostaMovimentos = await fetch('https://vale-agro-alpha.vercel.app/fiados');
        const movimentos = await respostaMovimentos.json();

        listaFiadosResumo = resumo.map(item => {
            const movimentosCliente = movimentos.filter(mov =>
                mov.cliente_nome === item.cliente_nome
            );

            const compraAberta = encontrarCompraMaisAntigaAberta(movimentosCliente);
            const dias = calcularDiasEmAberto(compraAberta ? compraAberta.data : null);
            const status = obterStatusPrazo(dias);

            return {
                ...item,
                primeiraCompraAberta: compraAberta ? compraAberta.data : null,
                primeiraCompraAbertaHora: compraAberta ? compraAberta.hora : '',
                dias,
                statusTexto: status.texto,
                statusClasse: status.classe,
                statusClasseLinha: status.classeLinha,
                statusClasseTag: status.classeTag
            };
        });

        listaFiadosResumo = ordenarResumoFiados(listaFiadosResumo);

        atualizarResumoSuperior();
        renderizarResumoFiados(listaFiadosResumo);

    } catch (erro) {
        console.error('Erro ao carregar contas a prazo:', erro);
        mostrarMensagemSistema('Erro ao carregar contas a prazo. Verifique se o servidor está rodando.', 'erro');
    }
}

function atualizarResumoSuperior() {
    const dentro = listaFiadosResumo.filter(item => item.statusClasse === 'status-ok').length;
    const proximo = listaFiadosResumo.filter(item => item.statusClasse === 'status-proximo').length;
    const atraso = listaFiadosResumo.filter(item => item.statusClasse === 'status-atrasado').length;

    const total = listaFiadosResumo.reduce((soma, item) => {
        return soma + Number(item.saldo || 0);
    }, 0);

    preencherTexto('totalDentroPrazo', dentro);
    preencherTexto('totalPertoVencimento', proximo);
    preencherTexto('totalEmAtraso', atraso);
    preencherTexto('totalFiadoAberto', formatarMoeda(total));
}

function renderizarResumoFiados(lista) {
    const tabela = document.getElementById('tabelaResumoFiados');
    tabela.innerHTML = '';

    if (!lista || lista.length === 0) {
        tabela.innerHTML = `
            <tr>
                <td colspan="6">Nenhuma conta a prazo em aberto.</td>
            </tr>
        `;
        return;
    }

    lista.forEach(item => {
        const clienteCodificado = encodeURIComponent(item.cliente_nome || '');

        tabela.innerHTML += `
            <tr class="linha-fiado ${item.statusClasseLinha}">
                <td>
                    <strong>${escaparHtml(item.cliente_nome)}</strong>
                </td>

                <td>
                    <strong>${formatarMoeda(item.saldo)}</strong>
                </td>

                <td>
                    ${
                        item.primeiraCompraAberta
                            ? formatarDataHora(item.primeiraCompraAberta, item.primeiraCompraAbertaHora)
                            : '-'
                    }
                </td>

                <td>
                    <strong>${item.dias}</strong> dias
                </td>

                <td>
                    <span class="tag-fiado ${item.statusClasseTag}">
                        ${item.statusTexto}
                    </span>
                </td>

                <td>
                    <button class="botao-abrir-fiado" onclick="abrirDetalhe('${clienteCodificado}')">
                        Abrir
                    </button>
                </td>
            </tr>
        `;
    });
}

function abrirDetalhe(cliente) {
    window.location.href = `fiado-detalhe.html?cliente=${cliente}`;
}

function filtrarDevedores() {
    const busca = normalizarTextoBusca(document.getElementById('buscaDevedor').value);

    const filtrados = listaFiadosResumo.filter(item =>
        campoComecaComBusca(item.cliente_nome, busca)
    );

    renderizarResumoFiados(filtrados);
}

carregarResumoFiados();
