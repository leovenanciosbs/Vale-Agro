function formatarMoeda(valor) {
    return Number(valor || 0).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
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

    if (!horaFormatada) {
        return dataFormatada;
    }

    return `${dataFormatada}<br><small>${horaFormatada}</small>`;
}

function limparTelefone(telefone) {
    return String(telefone || '').replace(/\D/g, '');
}

function formatarTelefoneWhatsapp(telefone) {
    let numero = limparTelefone(telefone);

    if (!numero) return '';

    if (numero.length === 10 || numero.length === 11) {
        numero = '55' + numero;
    }

    return numero;
}

function escaparHtml(valor) {
    return String(valor || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function escaparJs(valor) {
    return String(valor || '')
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/"/g, '\\"');
}

async function carregarFiadosAtrasados() {
    try {
        const resposta = await fetch('/fiados-atrasados');
        const clientes = await resposta.json();

        const totalPendente = clientes.reduce((soma, item) => {
            return soma + Number(item.valor_pendente || item.saldo_total || 0);
        }, 0);

        document.getElementById('totalClientesAtrasados').textContent = clientes.length;
        document.getElementById('totalValorAtrasado').textContent = formatarMoeda(totalPendente);

        renderizarFiadosAtrasados(clientes);

    } catch (erro) {
        console.error('Erro ao carregar A Prazo em atraso:', erro);
        mostrarMensagemSistema('Erro ao carregar clientes em atraso. Verifique se o servidor está rodando.', 'erro');
    }
}

function renderizarFiadosAtrasados(clientes) {
    const tabela = document.getElementById('tabelaFiadosAtrasados');
    tabela.innerHTML = '';

    if (!clientes || clientes.length === 0) {
        tabela.innerHTML = `
            <tr>
                <td colspan="6">Nenhum cliente em atraso.</td>
            </tr>
        `;
        return;
    }

    clientes.forEach(cliente => {
        const telefoneFormatado = formatarTelefoneWhatsapp(cliente.telefone);
        const temTelefone = telefoneFormatado.length > 0;

        const dataHoraVencida = cliente.data_primeira_vencida
            ? formatarDataHora(cliente.data_primeira_vencida, cliente.hora_primeira_vencida)
            : '-';

        tabela.innerHTML += `
            <tr class="linha-cobranca-atraso">
                <td class="coluna-cliente-cobranca">
                    <span class="badge-cobranca-atraso">EM ATRASO</span>
                    <strong class="cliente-cobranca-nome">${escaparHtml(cliente.cliente_nome)}</strong>
                </td>
                <td class="texto-secundario-cobranca">${escaparHtml(cliente.telefone || '-')}</td>
                <td class="texto-secundario-cobranca">${escaparHtml(cliente.cidade || '-')}</td>
                <td class="coluna-saldo-cobranca">
                    <strong class="saldo-atraso-cobranca">${formatarMoeda(cliente.valor_vencido)}</strong>
                    <small>Total em aberto: ${formatarMoeda(cliente.saldo_total)}</small>
                    <small>No prazo: ${formatarMoeda(cliente.valor_no_prazo)}</small>
                    <small>Compras vencidas: ${Number(cliente.compras_vencidas || 0)}</small>
                    <small>Primeira vencida: ${dataHoraVencida}</small>
                </td>
                <td>
                    <span class="badge-dias-cobranca">${Number(cliente.dias_atraso || 0)} dias</span>
                </td>
                <td>
                    <div class="acoes-cobranca-atraso">
                        <button
                            onclick="abrirWhatsapp('${escaparJs(cliente.cliente_nome)}', '${escaparJs(cliente.telefone || '')}', ${Number(cliente.valor_vencido || 0)}, ${Number(cliente.saldo_total || 0)})"
                            ${temTelefone ? '' : 'disabled'}
                        >
                            WhatsApp
                        </button>

                        <button
                            onclick="abrirDetalhes('${encodeURIComponent(cliente.cliente_nome)}')"
                            class="btn-secondary"
                        >
                            Detalhes
                        </button>
                    </div>
                </td>
            </tr>
        `;
    });
}

function abrirWhatsapp(nome, telefone, valorVencido, saldoTotal) {
    const numero = formatarTelefoneWhatsapp(telefone);

    if (!numero) {
        mostrarMensagemSistema('Este cliente não possui telefone cadastrado.', 'aviso');
        return;
    }

    const mensagem = `
Olá, ${nome}.

Identificamos em nosso sistema um valor vencido de ${formatarMoeda(valorVencido)} referente a compras a prazo realizadas na VALE AGRO.

Seu saldo total em aberto atualmente é de ${formatarMoeda(saldoTotal)}.

Pedimos, por gentileza, que entre em contato para regularização.

Caso já tenha realizado o pagamento, desconsidere esta mensagem.

VALE AGRO
    `.trim();

    const link = `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;

    window.open(link, '_blank');
}

function abrirDetalhes(cliente) {
    window.location.href = `fiado-detalhe.html?cliente=${cliente}`;
}

carregarFiadosAtrasados();
