(function () {
    function normalizarTipoFeedback(tipo) {
        const tipoNormalizado = String(tipo || 'info').toLowerCase();
        const tiposPermitidos = ['sucesso', 'erro', 'aviso', 'info', 'perigo'];

        return tiposPermitidos.includes(tipoNormalizado) ? tipoNormalizado : 'info';
    }

    function garantirAreaMensagensSistema() {
        let area = document.getElementById('sistemaToastArea');

        if (!area) {
            area = document.createElement('div');
            area.id = 'sistemaToastArea';
            area.className = 'sistema-toast-area';
            area.setAttribute('aria-live', 'polite');
            area.setAttribute('aria-atomic', 'true');
            document.body.appendChild(area);
        }

        return area;
    }

    function mostrarMensagemSistema(mensagem, tipo = 'info', opcoes = {}) {
        const area = garantirAreaMensagensSistema();
        const tipoFinal = normalizarTipoFeedback(tipo);
        const toast = document.createElement('div');
        const texto = document.createElement('p');
        const fechar = document.createElement('button');
        const duracao = Number(opcoes.duracao || 3800);

        toast.className = `sistema-toast sistema-toast-${tipoFinal}`;
        toast.setAttribute('role', tipoFinal === 'erro' || tipoFinal === 'perigo' ? 'alert' : 'status');

        texto.textContent = String(mensagem || '');

        fechar.type = 'button';
        fechar.className = 'sistema-toast-fechar';
        fechar.setAttribute('aria-label', 'Fechar mensagem');
        fechar.textContent = 'X';

        toast.appendChild(texto);
        toast.appendChild(fechar);
        area.appendChild(toast);

        function removerToast() {
            toast.classList.remove('visivel');
            window.setTimeout(() => toast.remove(), 180);
        }

        fechar.addEventListener('click', removerToast);
        window.requestAnimationFrame(() => toast.classList.add('visivel'));

        if (duracao > 0) {
            window.setTimeout(removerToast, duracao);
        }
    }

    function criarTextoElemento(tag, texto, classe) {
        const elemento = document.createElement(tag);

        if (classe) elemento.className = classe;
        elemento.textContent = String(texto || '');

        return elemento;
    }

    function mostrarConfirmacaoSistema(opcoes = {}) {
        return new Promise(resolve => {
            const tipo = normalizarTipoFeedback(opcoes.tipo || 'info');
            const overlay = document.createElement('div');
            const dialog = document.createElement('div');
            const titulo = criarTextoElemento('h2', opcoes.titulo || 'Confirmar ação', 'sistema-confirmacao-titulo');
            const mensagem = criarTextoElemento('p', opcoes.mensagem || 'Deseja continuar?', 'sistema-confirmacao-mensagem');
            const acoes = document.createElement('div');
            const cancelar = document.createElement('button');
            const confirmar = document.createElement('button');
            let resolvido = false;

            overlay.className = 'sistema-confirmacao-overlay';
            overlay.setAttribute('aria-hidden', 'true');

            dialog.className = `sistema-confirmacao-dialog sistema-confirmacao-${tipo}`;
            dialog.setAttribute('role', 'dialog');
            dialog.setAttribute('aria-modal', 'true');
            dialog.setAttribute('aria-labelledby', 'sistemaConfirmacaoTitulo');

            titulo.id = 'sistemaConfirmacaoTitulo';

            acoes.className = 'sistema-confirmacao-acoes';

            cancelar.type = 'button';
            cancelar.className = 'btn-secondary sistema-confirmacao-cancelar';
            cancelar.textContent = opcoes.textoCancelar || 'Cancelar';

            confirmar.type = 'button';
            confirmar.className = `sistema-confirmacao-confirmar sistema-confirmacao-confirmar-${tipo}`;
            confirmar.textContent = opcoes.textoConfirmar || 'Confirmar';

            acoes.appendChild(cancelar);
            acoes.appendChild(confirmar);
            dialog.appendChild(titulo);
            dialog.appendChild(mensagem);
            dialog.appendChild(acoes);
            overlay.appendChild(dialog);
            document.body.appendChild(overlay);

            function finalizar(confirmado) {
                if (resolvido) return;
                resolvido = true;

                overlay.classList.remove('visivel');
                overlay.setAttribute('aria-hidden', 'true');
                document.removeEventListener('keydown', aoPressionarTecla);
                window.setTimeout(() => overlay.remove(), 180);
                resolve(confirmado);

                if (confirmado && typeof opcoes.onConfirmar === 'function') {
                    Promise.resolve(opcoes.onConfirmar()).catch(erro => {
                        console.error('Erro ao executar ação confirmada:', erro);
                        mostrarMensagemSistema('Erro ao executar ação.', 'erro');
                    });
                }
            }

            function aoPressionarTecla(evento) {
                if (evento.key === 'Escape') finalizar(false);
            }

            cancelar.addEventListener('click', () => finalizar(false));
            confirmar.addEventListener('click', () => finalizar(true));
            overlay.addEventListener('click', evento => {
                if (evento.target === overlay) finalizar(false);
            });
            document.addEventListener('keydown', aoPressionarTecla);

            window.requestAnimationFrame(() => {
                overlay.classList.add('visivel');
                overlay.setAttribute('aria-hidden', 'false');
                cancelar.focus();
            });
        });
    }

    function mostrarPromptSistema(opcoes = {}) {
        return new Promise(resolve => {
            const tipo = normalizarTipoFeedback(opcoes.tipo || 'info');
            const overlay = document.createElement('div');
            const dialog = document.createElement('div');
            const titulo = criarTextoElemento('h2', opcoes.titulo || 'Informe os dados', 'sistema-confirmacao-titulo');
            const mensagem = criarTextoElemento('p', opcoes.mensagem || '', 'sistema-confirmacao-mensagem');
            const grupoCampo = document.createElement('label');
            const rotuloCampo = document.createElement('span');
            const campo = opcoes.multilinha ? document.createElement('textarea') : document.createElement('input');
            const acoes = document.createElement('div');
            const cancelar = document.createElement('button');
            const confirmar = document.createElement('button');
            let resolvido = false;

            overlay.className = 'sistema-confirmacao-overlay';
            overlay.setAttribute('aria-hidden', 'true');

            dialog.className = `sistema-confirmacao-dialog sistema-confirmacao-${tipo}`;
            dialog.setAttribute('role', 'dialog');
            dialog.setAttribute('aria-modal', 'true');
            dialog.setAttribute('aria-labelledby', 'sistemaPromptTitulo');

            titulo.id = 'sistemaPromptTitulo';

            grupoCampo.className = 'sistema-prompt-campo';
            rotuloCampo.textContent = opcoes.rotulo || 'Motivo';
            campo.value = opcoes.valorInicial || '';
            campo.placeholder = opcoes.placeholder || '';
            campo.setAttribute('aria-label', opcoes.rotulo || 'Campo de texto');

            if (!opcoes.multilinha) {
                campo.type = opcoes.inputType || 'text';
            }

            acoes.className = 'sistema-confirmacao-acoes';

            cancelar.type = 'button';
            cancelar.className = 'btn-secondary sistema-confirmacao-cancelar';
            cancelar.textContent = opcoes.textoCancelar || 'Cancelar';

            confirmar.type = 'button';
            confirmar.className = `sistema-confirmacao-confirmar sistema-confirmacao-confirmar-${tipo}`;
            confirmar.textContent = opcoes.textoConfirmar || 'Confirmar';

            grupoCampo.appendChild(rotuloCampo);
            grupoCampo.appendChild(campo);
            acoes.appendChild(cancelar);
            acoes.appendChild(confirmar);
            dialog.appendChild(titulo);
            if (opcoes.mensagem) dialog.appendChild(mensagem);
            dialog.appendChild(grupoCampo);
            dialog.appendChild(acoes);
            overlay.appendChild(dialog);
            document.body.appendChild(overlay);

            function finalizar(valor) {
                if (resolvido) return;
                resolvido = true;

                overlay.classList.remove('visivel');
                overlay.setAttribute('aria-hidden', 'true');
                document.removeEventListener('keydown', aoPressionarTecla);
                window.setTimeout(() => overlay.remove(), 180);
                resolve(valor);
            }

            function aoPressionarTecla(evento) {
                if (evento.key === 'Escape') finalizar(null);
                if (evento.key === 'Enter' && !opcoes.multilinha) finalizar(campo.value);
            }

            cancelar.addEventListener('click', () => finalizar(null));
            confirmar.addEventListener('click', () => finalizar(campo.value));
            overlay.addEventListener('click', evento => {
                if (evento.target === overlay) finalizar(null);
            });
            document.addEventListener('keydown', aoPressionarTecla);

            window.requestAnimationFrame(() => {
                overlay.classList.add('visivel');
                overlay.setAttribute('aria-hidden', 'false');
                campo.focus();
                campo.select();
            });
        });
    }

    window.mostrarMensagemSistema = mostrarMensagemSistema;
    window.mostrarConfirmacaoSistema = mostrarConfirmacaoSistema;
    window.mostrarConfirmacao = mostrarConfirmacaoSistema;
    window.mostrarPromptSistema = mostrarPromptSistema;
})();
