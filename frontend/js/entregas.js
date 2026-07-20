let entregasLista = [];

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
        return `
            <div class="entrega-data-bloco">
                <span class="entrega-data-dia">${dataFormatada}</span>
            </div>
        `;
    }

    return `
        <div class="entrega-data-bloco">
            <span class="entrega-data-dia">${dataFormatada}</span>
            <span class="entrega-data-hora">${horaFormatada}</span>
        </div>
    `;
}

function formatarDataHoraTexto(data, hora) {
    const dataFormatada = formatarData(data);
    const horaFormatada = formatarHora(hora);

    if (!horaFormatada) {
        return dataFormatada;
    }

    return `${dataFormatada} às ${horaFormatada}`;
}

function formatarDataHoraCompacta(data, hora) {
    const dataFormatada = formatarData(data);
    const horaFormatada = formatarHora(hora);

    if (!horaFormatada) {
        return dataFormatada;
    }

    return `${dataFormatada} &bull; ${horaFormatada}`;
}

function escaparHtml(valor) {
    return String(valor || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function formatarTelefoneEntrega(telefone) {
    const texto = String(telefone || '').trim();

    if (!texto) {
        return '-';
    }

    const digitos = texto.replace(/\D/g, '');

    if (digitos.length === 11) {
        return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`;
    }

    if (digitos.length === 10) {
        return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`;
    }

    return escaparHtml(texto);
}

function nomeStatusEntrega(status) {
    const nomes = {
        PENDENTE: 'Pendente',
        SAIU_ENTREGA: 'Saiu para entrega',
        ENTREGUE: 'Entregue',
        CANCELADA: 'Cancelada'
    };

    return nomes[status] || status || '-';
}

function nomeStatusEntregaBadge(status) {
    const nomes = {
        PENDENTE: 'PENDENTE',
        SAIU_ENTREGA: 'SAIU ENTREGA',
        ENTREGUE: 'ENTREGUE',
        CANCELADA: 'CANCELADA'
    };

    return nomes[status] || String(status || '-').toUpperCase();
}

function nomeStatusPagamento(status) {
    const nomes = {
        PAGO_NA_COMPRA: 'Pago na compra',
        A_RECEBER_NA_ENTREGA: 'A receber na entrega',
        RECEBIDO_NA_ENTREGA: 'Recebido na entrega',
        FIADO: 'A Prazo'
    };

    return nomes[status] || status || '-';
}

function nomeStatusPagamentoBadge(status) {
    const nomes = {
        PAGO_NA_COMPRA: 'PAGO',
        A_RECEBER_NA_ENTREGA: 'A RECEBER',
        RECEBIDO_NA_ENTREGA: 'RECEBIDO',
        FIADO: 'A PRAZO'
    };

    return nomes[status] || String(status || '-').toUpperCase();
}

function nomeFormaRecebimento(forma) {
    const nomes = {
        DINHEIRO: 'Dinheiro',
        PIX: 'PIX',
        CARTAO_CREDITO: 'Cartão Crédito',
        CARTAO_DEBITO: 'Cartão Débito'
    };

    return nomes[forma] || forma || '-';
}

function classeStatusEntrega(status) {
    if (status === 'PENDENTE') return 'status-proximo';
    if (status === 'SAIU_ENTREGA') return 'status-proximo';
    if (status === 'ENTREGUE') return 'status-ok';
    if (status === 'CANCELADA') return 'status-atrasado';

    return '';
}

function classeStatusPagamento(status) {
    if (status === 'PAGO_NA_COMPRA') return 'status-ok';
    if (status === 'RECEBIDO_NA_ENTREGA') return 'status-ok';
    if (status === 'A_RECEBER_NA_ENTREGA') return 'status-proximo';
    if (status === 'FIADO') return 'status-proximo';

    return '';
}

function classeStatusEspecifico(prefixo, status) {
    const statusClasse = String(status || 'indefinido')
        .toLowerCase()
        .replace(/_/g, '-')
        .replace(/[^a-z0-9-]/g, '');

    return `${prefixo}-${statusClasse}`;
}

function entregaEstaCancelada(entrega) {
    return Number(entrega.cancelada || 0) === 1 || entrega.status_entrega === 'CANCELADA';
}

function entregaPagamentoPendente(entrega) {
    return !entregaEstaCancelada(entrega) &&
        entrega.status_entrega === 'ENTREGUE' &&
        entrega.status_pagamento === 'A_RECEBER_NA_ENTREGA' &&
        Number(entrega.transferida_a_prazo || 0) !== 1;
}

function entregaEstaAberta(entrega) {
    if (entregaEstaCancelada(entrega)) {
        return false;
    }

    return entrega.status_entrega === 'PENDENTE' || entrega.status_entrega === 'SAIU_ENTREGA';
}

function entregaEstaFinalizada(entrega) {
    return !entregaEstaAberta(entrega) && !entregaPagamentoPendente(entrega);
}

function injetarEstiloAcoesEntrega() {
    if (document.getElementById('estiloAcoesEntregaLimpa')) {
        return;
    }

    const estilo = document.createElement('style');
    estilo.id = 'estiloAcoesEntregaLimpa';

    estilo.innerHTML = `
        #tabelaEntregasAbertas .acoes-entrega-limpa,
        #tabelaEntregasPagamentoPendente .acoes-entrega-limpa,
        #tabelaEntregasFinalizadas .acoes-entrega-limpa{
            display:flex !important;
            flex-direction:column !important;
            align-items:center !important;
            justify-content:center !important;
            gap:5px !important;
            min-width:78px !important;
            max-width:100% !important;
            margin:0 auto !important;
        }

        #tabelaEntregasAbertas .acoes-entrega-limpa button,
        #tabelaEntregasPagamentoPendente .acoes-entrega-limpa button,
        #tabelaEntregasFinalizadas .acoes-entrega-limpa button{
            width:78px !important;
            min-width:78px !important;
            max-width:78px !important;
            height:30px !important;
            min-height:30px !important;
            padding:0 !important;
            font-size:11px !important;
            line-height:30px !important;
            border-radius:8px !important;
            text-align:center !important;
            white-space:nowrap !important;
            overflow:hidden !important;
            text-overflow:ellipsis !important;
            word-break:normal !important;
            box-shadow:0 8px 18px rgba(23,155,99,0.12) !important;
        }

        .botao-menu-entrega-limpo{
            background:#179b63 !important;
            color:#fff !important;
            font-size:16px !important;
            letter-spacing:1px;
        }

        .botao-menu-entrega-limpo:hover{
            background:#11b877 !important;
        }

        .botao-cancelar-entrega-limpo{
            background:#c64f4a !important;
            color:#fff !important;
        }

        .botao-cancelar-entrega-limpo:hover{
            background:#e05f5a !important;
        }

        .botao-transferir-prazo-entrega{
            background:#1f3347 !important;
            color:#fff !important;
        }

        .botao-transferir-prazo-entrega:hover{
            background:#2f4b66 !important;
        }

        .menu-global-acoes-entrega{
            position:fixed;
            display:none;
            min-width:150px;
            background:#08140f;
            border:1px solid rgba(127,174,145,0.28);
            border-radius:10px;
            padding:8px;
            box-shadow:0 18px 45px rgba(0,0,0,0.24);
            z-index:9999;
        }

        .menu-global-acoes-entrega.aberto{
            display:block;
        }

        .menu-global-acoes-entrega button{
            width:100%;
            display:block;
            margin:0 0 6px 0;
            padding:9px 10px;
            border-radius:7px;
            font-size:12px;
            text-align:left;
            background:#179b63;
            color:#fff;
        }

        .menu-global-acoes-entrega button:last-child{
            margin-bottom:0;
        }

        .menu-global-acoes-entrega button:hover{
            background:#11b877;
        }

        .menu-global-acoes-entrega .botao-voltar-entrega{
            background:#6f7f76;
        }

        .menu-global-acoes-entrega .botao-voltar-entrega:hover{
            background:#83948b;
        }

        body:has(#tabelaEntregasAbertas) table:has(#tabelaEntregasAbertas) th:nth-child(10),
        body:has(#tabelaEntregasPagamentoPendente) table:has(#tabelaEntregasPagamentoPendente) th:nth-child(10),
        body:has(#tabelaEntregasFinalizadas) table:has(#tabelaEntregasFinalizadas) th:nth-child(10){
            width:88px !important;
        }

        body:has(#tabelaEntregasAbertas) #tabelaEntregasAbertas td:nth-child(10),
        body:has(#tabelaEntregasPagamentoPendente) #tabelaEntregasPagamentoPendente td:nth-child(10),
        body:has(#tabelaEntregasFinalizadas) #tabelaEntregasFinalizadas td:nth-child(10){
            width:88px !important;
            min-width:88px !important;
            max-width:88px !important;
            overflow:visible !important;
        }
    `;

    document.head.appendChild(estilo);
}

function garantirMenuGlobalAcoesEntrega() {
    let menu = document.getElementById('menuGlobalAcoesEntrega');

    if (!menu) {
        menu = document.createElement('div');
        menu.id = 'menuGlobalAcoesEntrega';
        menu.className = 'menu-global-acoes-entrega';
        menu.addEventListener('click', (evento) => {
            evento.stopPropagation();
        });
        document.body.appendChild(menu);
    }

    return menu;
}

function fecharMenuAcoesEntrega() {
    const menu = document.getElementById('menuGlobalAcoesEntrega');

    if (menu) {
        menu.classList.remove('aberto');
        menu.innerHTML = '';
    }
}

function montarAcaoMenu(texto, acao, classeExtra = '') {
    return `
        <button type="button" class="${classeExtra}" onclick="fecharMenuAcoesEntrega(); ${acao}">
            ${texto}
        </button>
    `;
}

function montarConteudoMenuAcoes(entrega) {
    let html = montarAcaoMenu(
        'Ver itens da entrega',
        `abrirDetalheEntrega(${entrega.id})`,
        'botao-ver-itens-entrega'
    );

    if (entrega.status_entrega === 'PENDENTE') {
        html += montarAcaoMenu(
            'Marcar como saiu',
            `atualizarStatusEntrega(${entrega.id}, 'SAIU_ENTREGA')`
        );

        html += montarAcaoMenu(
            'Marcar como entregue',
            `atualizarStatusEntrega(${entrega.id}, 'ENTREGUE')`
        );
    }

    if (entrega.status_entrega === 'SAIU_ENTREGA') {
        html += montarAcaoMenu(
            'Marcar como entregue',
            `atualizarStatusEntrega(${entrega.id}, 'ENTREGUE')`
        );

        html += montarAcaoMenu(
            'Voltar para pendente',
            `atualizarStatusEntrega(${entrega.id}, 'PENDENTE')`,
            'botao-voltar-entrega'
        );
    }

    if (entrega.status_entrega === 'ENTREGUE') {
        html += montarAcaoMenu(
            'Reabrir entrega',
            `atualizarStatusEntrega(${entrega.id}, 'PENDENTE')`,
            'botao-voltar-entrega'
        );
    }

    if (
        entrega.status_pagamento === 'A_RECEBER_NA_ENTREGA' &&
        entrega.status_entrega !== 'CANCELADA'
    ) {
        html += montarAcaoMenu(
            'Receber pagamento',
            `abrirModalRecebimentoEntrega(${entrega.id})`
        );
    }

    if (entregaPagamentoPendente(entrega)) {
        html += montarAcaoMenu(
            'Transferir para A Prazo',
            `transferirEntregaParaPrazo(${entrega.id})`,
            'botao-transferir-prazo-entrega'
        );
    }

    return html;
}

function abrirDetalheEntrega(id) {
    window.location.href = `entrega-detalhe.html?id=${encodeURIComponent(id)}`;
}

function abrirMenuAcoesEntrega(evento, id) {
    evento.stopPropagation();

    const entrega = entregasLista.find(item => Number(item.id) === Number(id));

    if (!entrega) {
        mostrarMensagemSistema('Entrega não encontrada.', 'erro');
        return;
    }

    const conteudo = montarConteudoMenuAcoes(entrega);

    if (!conteudo) {
        return;
    }

    const menu = garantirMenuGlobalAcoesEntrega();
    menu.innerHTML = conteudo;

    const botao = evento.currentTarget;
    const posicao = botao.getBoundingClientRect();

    const larguraMenu = 170;
    const alturaEstimada = 150;

    let left = posicao.left - larguraMenu - 8;
    let top = posicao.top;

    if (left < 8) {
        left = posicao.right + 8;
    }

    if (top + alturaEstimada > window.innerHeight - 10) {
        top = window.innerHeight - alturaEstimada - 10;
    }

    if (top < 8) {
        top = 8;
    }

    menu.style.left = `${left}px`;
    menu.style.top = `${top}px`;
    menu.style.minWidth = `${larguraMenu}px`;
    menu.classList.add('aberto');
}

function atualizarResumoPelaLista() {
    const pendentes = entregasLista.filter(item =>
        item.status_entrega === 'PENDENTE' &&
        Number(item.cancelada || 0) === 0
    ).length;

    const saiuEntrega = entregasLista.filter(item =>
        item.status_entrega === 'SAIU_ENTREGA' &&
        Number(item.cancelada || 0) === 0
    ).length;

    const entregasAReceber = entregasLista.filter(entregaPagamentoPendente);

    const finalizadas = entregasLista.filter(entregaEstaFinalizada).length;

    const valorAReceber = entregasAReceber.reduce((total, item) => {
        return total + Number(item.valor_total || 0);
    }, 0);

    const campoPendentes = document.getElementById('resumoEntregasPendentes');
    const campoSaiu = document.getElementById('resumoSaiuEntrega');
    const campoAReceber = document.getElementById('resumoEntregasAReceber');
    const campoFinalizadas = document.getElementById('resumoEntregasFinalizadas');
    const campoValor = document.getElementById('resumoValorAReceber');

    if (campoPendentes) campoPendentes.textContent = pendentes;
    if (campoSaiu) campoSaiu.textContent = saiuEntrega;
    if (campoAReceber) campoAReceber.textContent = entregasAReceber.length;
    if (campoFinalizadas) campoFinalizadas.textContent = finalizadas;
    if (campoValor) campoValor.textContent = formatarMoeda(valorAReceber);
}

async function carregarEntregas() {
    const busca = document.getElementById('buscaEntrega')?.value.trim() || '';
    const statusEntrega = document.getElementById('filtroStatusEntrega')?.value || '';
    const statusPagamento = document.getElementById('filtroStatusPagamento')?.value || '';
    const dataInicial = document.getElementById('dataInicialEntrega')?.value || '';
    const dataFinal = document.getElementById('dataFinalEntrega')?.value || '';

    const params = new URLSearchParams();

    if (busca) params.append('busca', busca);
    if (statusEntrega) params.append('status_entrega', statusEntrega);
    if (statusPagamento) params.append('status_pagamento', statusPagamento);
    if (dataInicial) params.append('dataInicial', dataInicial);
    if (dataFinal) params.append('dataFinal', dataFinal);

    try {
        const resposta = await fetch(`/entregas?${params.toString()}`);
        entregasLista = await resposta.json();

        renderizarEntregas();
        atualizarResumoPelaLista();

    } catch (erro) {
        console.error('Erro ao carregar entregas:', erro);
        mostrarMensagemSistema('Erro ao carregar entregas. Verifique se o servidor está rodando.', 'erro');
    }
}

function renderizarEntregas() {
    const tabelaAbertas = document.getElementById('tabelaEntregasAbertas');
    const tabelaPagamentoPendente = document.getElementById('tabelaEntregasPagamentoPendente');
    const tabelaFinalizadas = document.getElementById('tabelaEntregasFinalizadas');

    if (!tabelaAbertas || !tabelaPagamentoPendente || !tabelaFinalizadas) {
        console.error('Tabelas de entregas nao encontradas no HTML.');
        return;
    }

    tabelaAbertas.innerHTML = '';
    tabelaPagamentoPendente.innerHTML = '';
    tabelaFinalizadas.innerHTML = '';

    const entregasAbertas = entregasLista.filter(entregaEstaAberta);
    const entregasPagamentoPendente = entregasLista.filter(entregaPagamentoPendente);
    const entregasFinalizadas = entregasLista.filter(entregaEstaFinalizada);

    if (entregasAbertas.length === 0) {
        tabelaAbertas.innerHTML = `
            <tr>
                <td colspan="10">Nenhuma entrega em aberto.</td>
            </tr>
        `;
    } else {
        entregasAbertas.forEach(entrega => {
            tabelaAbertas.innerHTML += montarLinhaEntrega(entrega);
        });
    }

    if (entregasPagamentoPendente.length === 0) {
        tabelaPagamentoPendente.innerHTML = `
            <tr>
                <td colspan="10">Nenhuma entrega entregue com pagamento pendente.</td>
            </tr>
        `;
    } else {
        entregasPagamentoPendente.forEach(entrega => {
            tabelaPagamentoPendente.innerHTML += montarLinhaEntrega(entrega);
        });
    }

    if (entregasFinalizadas.length === 0) {
        tabelaFinalizadas.innerHTML = `
            <tr>
                <td colspan="10">Nenhuma entrega finalizada.</td>
            </tr>
        `;
    } else {
        entregasFinalizadas.forEach(entrega => {
            tabelaFinalizadas.innerHTML += montarLinhaEntrega(entrega);
        });
    }
}
function montarInfoStatusEntrega(entrega) {
    const detalhes = [];

    if (entrega.data_status || entrega.hora_status) {
        detalhes.push(formatarDataHoraCompacta(entrega.data_status || entrega.data, entrega.hora_status));
    }

    if (Number(entrega.cancelada || 0) === 1 && entrega.motivo_cancelamento) {
        detalhes.push(`Motivo: ${escaparHtml(entrega.motivo_cancelamento)}`);
    }

    return `
        <div class="entrega-status-bloco">
            <span class="tag-status entrega-status-badge ${classeStatusEntrega(entrega.status_entrega)} ${classeStatusEspecifico('entrega-status', entrega.status_entrega)}">
                ${nomeStatusEntregaBadge(entrega.status_entrega)}
            </span>
            ${detalhes
                .filter(Boolean)
                .map(detalhe => `<span class="entrega-status-data">${detalhe}</span>`)
                .join('')}
        </div>
    `;
}

function montarInfoStatusPagamento(entrega) {
    const detalhes = [];
    const transferidaPrazo = Number(entrega.transferida_a_prazo || 0) === 1;
    const statusPagamentoVisual = transferidaPrazo ? 'FIADO' : entrega.status_pagamento;

    if (entrega.status_pagamento === 'A_RECEBER_NA_ENTREGA' && !transferidaPrazo) {
        detalhes.push('Na entrega');
    }

    if (transferidaPrazo) {
        detalhes.push('Transferido');
    } else if (entrega.status_pagamento === 'FIADO') {
        detalhes.push('Entrega a prazo');
    }

    if (entrega.forma_recebimento) {
        detalhes.push(escaparHtml(nomeFormaRecebimento(entrega.forma_recebimento)));
    }

    if (entrega.status_pagamento === 'PAGO_NA_COMPRA' && (entrega.data_recebimento || entrega.hora_recebimento)) {
        detalhes.push(formatarDataHoraCompacta(entrega.data_recebimento || entrega.data, entrega.hora_recebimento));
    }

    if (entrega.status_pagamento === 'RECEBIDO_NA_ENTREGA' && (entrega.data_recebimento || entrega.hora_recebimento)) {
        detalhes.push(formatarDataHoraCompacta(entrega.data_recebimento, entrega.hora_recebimento));
    }

    return `
        <div class="entrega-pagamento-bloco">
            <span class="tag-status entrega-pagamento-badge ${classeStatusPagamento(statusPagamentoVisual)} ${classeStatusEspecifico('entrega-pagamento', statusPagamentoVisual)}">
                ${nomeStatusPagamentoBadge(statusPagamentoVisual)}
            </span>
            ${detalhes
                .filter(Boolean)
                .map(detalhe => `<span class="entrega-pagamento-detalhe">${detalhe}</span>`)
                .join('')}
        </div>
    `;
}

function formatarObservacaoEntrega(entrega) {
    const observacao = String(entrega.observacao || '').trim();

    if (!observacao) {
        return '-';
    }

    const textoComparacao = observacao.toLowerCase();
    const ehTransferenciaAutomatica = textoComparacao.includes('transferido de entrega') ||
        textoComparacao.includes('transferida de entrega');

    if (ehTransferenciaAutomatica) {
        const entregaOrigem = observacao.match(/#\s*(\d+)/);

        if (entregaOrigem) {
            return `#${entregaOrigem[1]} Transferida`;
        }

        return 'Entrega transferida';
    }

    return escaparHtml(observacao);
}

function montarLinhaEntrega(entrega) {
    return `
        <tr>
            <td class="entrega-col-data entrega-data-celula">${formatarDataHora(entrega.data, entrega.hora)}</td>
            <td class="entrega-col-cliente"><span class="entrega-cliente-nome">${escaparHtml(entrega.cliente_nome || '-')}</span></td>
            <td class="entrega-col-telefone"><span class="entrega-texto-secundario">${formatarTelefoneEntrega(entrega.telefone)}</span></td>
            <td class="entrega-col-endereco"><span class="entrega-texto-secundario">${escaparHtml(entrega.endereco || '-')}</span></td>
            <td class="entrega-col-cidade"><span class="entrega-texto-secundario">${escaparHtml(entrega.bairro_cidade || '-')}</span></td>
            <td class="entrega-col-status">${montarInfoStatusEntrega(entrega)}</td>
            <td class="entrega-col-pagamento">${montarInfoStatusPagamento(entrega)}</td>
            <td class="entrega-col-valor"><span class="entrega-valor-destaque">${formatarMoeda(entrega.valor_total)}</span></td>
            <td class="entrega-col-observacao"><span class="entrega-observacao-texto">${formatarObservacaoEntrega(entrega)}</span></td>
            <td class="entrega-col-acoes">
                ${montarBotoesEntrega(entrega)}
            </td>
        </tr>
    `;
}

function montarBotoesEntrega(entrega) {
    const temMenu = montarConteudoMenuAcoes(entrega).trim() !== '';
    const entregaCancelada = Number(entrega.cancelada || 0) === 1 || entrega.status_entrega === 'CANCELADA';
    const podeCancelar = !entregaCancelada &&
        (entrega.status_entrega === 'PENDENTE' || entrega.status_entrega === 'SAIU_ENTREGA');

    if (!temMenu && !podeCancelar) {
        return '-';
    }

    let html = `<div class="acoes-entrega acoes-entrega-limpa">`;

    if (temMenu) {
        html += `
            <button type="button" class="botao-menu-entrega-limpo" onclick="abrirMenuAcoesEntrega(event, ${entrega.id})">
                ...
            </button>
        `;
    }

    if (podeCancelar) {
        html += `
            <button type="button" class="botao-cancelar-entrega-limpo" onclick="atualizarStatusEntrega(${entrega.id}, 'CANCELADA')">
                Cancelar
            </button>
        `;
    }

    html += `</div>`;

    return html;
}

async function atualizarStatusEntrega(id, status) {
    fecharMenuAcoesEntrega();

    let mensagem = '';

    if (status === 'SAIU_ENTREGA') mensagem = 'Confirmar que esta entrega saiu para entrega?';
    if (status === 'ENTREGUE') mensagem = 'Confirmar que esta entrega foi entregue?';
    if (status === 'CANCELADA') mensagem = 'Confirmar cancelamento desta entrega?';
    if (status === 'PENDENTE') mensagem = 'Confirmar reabertura desta entrega como pendente?';

    if (mensagem) {
        const confirmar = await mostrarConfirmacaoSistema({
            titulo: 'Atualizar entrega?',
            mensagem,
            textoConfirmar: 'Confirmar',
            textoCancelar: 'Cancelar',
            tipo: status === 'CANCELADA' ? 'perigo' : 'aviso'
        });

        if (!confirmar) return;
    }

    try {
        const resposta = await fetch(`/entregas/${id}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                status_entrega: status
            })
        });

        const dados = await resposta.json();

        if (!dados.sucesso) {
            mostrarMensagemSistema(dados.erro || 'Erro ao atualizar status da entrega.', 'erro');
            return;
        }

        mostrarMensagemSistema('Status da entrega atualizado com sucesso.', 'sucesso');
        await carregarEntregas();

    } catch (erro) {
        console.error('Erro ao atualizar entrega:', erro);
        mostrarMensagemSistema('Erro ao atualizar status da entrega.', 'erro');
    }
}

async function transferirEntregaParaPrazo(id) {
    fecharMenuAcoesEntrega();

    const confirmar = await mostrarConfirmacaoSistema({
        titulo: 'Transferir para A Prazo?',
        mensagem: 'O valor ficará em aberto na ficha do cliente e não será lançado como recebido no financeiro agora.',
        textoConfirmar: 'Transferir',
        textoCancelar: 'Cancelar',
        tipo: 'aviso'
    });

    if (!confirmar) return;

    try {
        const resposta = await fetch(`/entregas/${id}/transferir-a-prazo`, {
            method: 'POST'
        });

        const dados = await resposta.json();

        if (!resposta.ok || !dados.sucesso) {
            mostrarMensagemSistema(dados.erro || 'Erro ao transferir entrega para A Prazo.', 'erro');
            return;
        }

        await carregarEntregas();

        mostrarMensagemSistema('Entrega transferida para A Prazo com sucesso.', 'sucesso');

    } catch (erro) {
        console.error('Erro ao transferir entrega para A Prazo:', erro);
        mostrarMensagemSistema('Erro ao transferir entrega para A Prazo.', 'erro');
    }
}

function abrirModalRecebimentoEntrega(id) {
    fecharMenuAcoesEntrega();

    const entrega = entregasLista.find(item => Number(item.id) === Number(id));

    if (!entrega) {
        mostrarMensagemSistema('Entrega não encontrada.', 'erro');
        return;
    }

    document.getElementById('entregaRecebimentoId').value = entrega.id;
    document.getElementById('clienteRecebimentoEntrega').textContent = entrega.cliente_nome || '-';
    document.getElementById('valorRecebimentoEntrega').textContent = formatarMoeda(entrega.valor_total || 0);
    document.getElementById('formaRecebimentoEntrega').value = 'DINHEIRO';
    document.getElementById('observacaoRecebimentoEntrega').value = '';

    document.getElementById('modalReceberEntrega').style.display = 'flex';
}

function fecharModalRecebimentoEntrega() {
    const modal = document.getElementById('modalReceberEntrega');

    if (modal) modal.style.display = 'none';

    const id = document.getElementById('entregaRecebimentoId');
    const obs = document.getElementById('observacaoRecebimentoEntrega');

    if (id) id.value = '';
    if (obs) obs.value = '';
}

async function confirmarRecebimentoEntrega() {
    const id = document.getElementById('entregaRecebimentoId').value;
    const formaRecebimento = document.getElementById('formaRecebimentoEntrega').value;
    const observacao = document.getElementById('observacaoRecebimentoEntrega').value.trim();

    if (!id) {
        mostrarMensagemSistema('Entrega inválida.', 'erro');
        return;
    }

    if (!formaRecebimento) {
        mostrarMensagemSistema('Selecione a forma de recebimento.', 'aviso');
        return;
    }

    const confirmar = await mostrarConfirmacaoSistema({
        titulo: 'Confirmar recebimento?',
        mensagem: 'Confirmar recebimento do pagamento desta entrega?',
        textoConfirmar: 'Confirmar',
        textoCancelar: 'Cancelar',
        tipo: 'aviso'
    });

    if (!confirmar) return;

    try {
        const resposta = await fetch(`/entregas/${id}/receber`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                forma_recebimento: formaRecebimento,
                observacao
            })
        });

        const dados = await resposta.json();

        if (!dados.sucesso) {
            mostrarMensagemSistema(dados.erro || 'Erro ao receber pagamento da entrega.', 'erro');
            return;
        }

        fecharModalRecebimentoEntrega();
        await carregarEntregas();

        mostrarMensagemSistema(`Pagamento recebido: ${formatarMoeda(dados.valor_recebido || 0)}`, 'sucesso');

    } catch (erro) {
        console.error('Erro ao receber pagamento:', erro);
        mostrarMensagemSistema('Erro ao receber pagamento da entrega.', 'erro');
    }
}

function limparFiltrosEntregas() {
    const busca = document.getElementById('buscaEntrega');
    const statusEntrega = document.getElementById('filtroStatusEntrega');
    const statusPagamento = document.getElementById('filtroStatusPagamento');
    const dataInicial = document.getElementById('dataInicialEntrega');
    const dataFinal = document.getElementById('dataFinalEntrega');

    if (busca) busca.value = '';
    if (statusEntrega) statusEntrega.value = '';
    if (statusPagamento) statusPagamento.value = '';
    if (dataInicial) dataInicial.value = '';
    if (dataFinal) dataFinal.value = '';

    carregarEntregas();
}

function configurarModalEntregas() {
    const modal = document.getElementById('modalReceberEntrega');

    if (!modal) return;

    modal.addEventListener('click', (evento) => {
        if (evento.target === modal) {
            fecharModalRecebimentoEntrega();
        }
    });
}

function configurarFechamentoMenuAcoes() {
    document.addEventListener('click', () => {
        fecharMenuAcoesEntrega();
    });

    window.addEventListener('scroll', () => {
        fecharMenuAcoesEntrega();
    }, true);
}

function iniciarPaginaEntregas() {
    injetarEstiloAcoesEntrega();
    garantirMenuGlobalAcoesEntrega();
    configurarFechamentoMenuAcoes();
    carregarEntregas();
    configurarModalEntregas();
}

iniciarPaginaEntregas();
