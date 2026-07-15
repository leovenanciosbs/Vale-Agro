const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// No Vercel, usar /tmp para persistência temporária
const databaseDir = process.env.VERCEL ? '/tmp' : path.join(__dirname, '../database');
const dbPath = path.join(databaseDir, 'valeagro.db');

if (!fs.existsSync(databaseDir)) {
    fs.mkdirSync(databaseDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Erro ao conectar ao banco:', err.message);
    } else {
        console.log('Banco SQLite conectado.');
    }
});

const migracoesPendentes = [];

function adicionarColunaSeNaoExistir(tabela, coluna, definicao) {
    const migracao = new Promise((resolve, reject) => {
        db.all(`PRAGMA table_info(${tabela})`, [], (err, colunas) => {
            if (err) {
                console.error(err);
                reject(err);
                return;
            }

            const existe = colunas.some(item => item.name === coluna);

            if (existe) {
                resolve();
                return;
            }

            db.run(`ALTER TABLE ${tabela} ADD COLUMN ${coluna} ${definicao}`, (erroAlteracao) => {
                if (erroAlteracao) {
                    console.error(`Erro ao adicionar coluna ${coluna} em ${tabela}:`, erroAlteracao.message);
                    reject(erroAlteracao);
                    return;
                }

                resolve();
            });
        });
    });

    migracoesPendentes.push(migracao);

    return migracao;
}

db.serialize(() => {

    db.run(`
        CREATE TABLE IF NOT EXISTS produtos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            codigo TEXT,
            nome TEXT NOT NULL,
            categoria TEXT,
            descricao TEXT,
            custo REAL,
            preco REAL,
            estoque REAL DEFAULT 0,
            estoque_minimo REAL DEFAULT 0,
            unidade_medida TEXT DEFAULT 'UN',
            permite_fracionado INTEGER DEFAULT 0,
            ativo INTEGER DEFAULT 1
        )
    `);

    adicionarColunaSeNaoExistir('produtos', 'descricao', 'TEXT');
    adicionarColunaSeNaoExistir('produtos', 'unidade_medida', "TEXT DEFAULT 'UN'");
    adicionarColunaSeNaoExistir('produtos', 'permite_fracionado', 'INTEGER DEFAULT 0');
    adicionarColunaSeNaoExistir('produtos', 'ativo', 'INTEGER DEFAULT 1');

    db.run(`
        CREATE TABLE IF NOT EXISTS clientes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL UNIQUE,
            telefone TEXT,
            cidade TEXT,
            observacao TEXT,
            data_cadastro TEXT
        )
    `);

    adicionarColunaSeNaoExistir('clientes', 'telefone', 'TEXT');
    adicionarColunaSeNaoExistir('clientes', 'cidade', 'TEXT');
    adicionarColunaSeNaoExistir('clientes', 'observacao', 'TEXT');
    adicionarColunaSeNaoExistir('clientes', 'data_cadastro', 'TEXT');

    db.run(`
        CREATE TABLE IF NOT EXISTS fiados (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            venda_id INTEGER,
            cliente_nome TEXT NOT NULL,
            tipo TEXT NOT NULL,
            produto TEXT,
            quantidade REAL DEFAULT 0,
            unidade_medida TEXT DEFAULT 'UN',
            valor_unitario REAL DEFAULT 0,
            valor_total REAL DEFAULT 0,
            valor_pago REAL DEFAULT 0,
            quitado INTEGER DEFAULT 0,
            observacao TEXT,
            data TEXT NOT NULL,
            hora TEXT,
            origem TEXT DEFAULT 'SISTEMA',
            grupo_importacao TEXT,
            forma_pagamento TEXT,
            valor_recebido REAL DEFAULT 0,
            troco REAL DEFAULT 0,
            cancelado INTEGER DEFAULT 0,
            data_cancelamento TEXT,
            hora_cancelamento TEXT,
            motivo_cancelamento TEXT
        )
    `);

    adicionarColunaSeNaoExistir('fiados', 'venda_id', 'INTEGER');
    adicionarColunaSeNaoExistir('fiados', 'unidade_medida', "TEXT DEFAULT 'UN'");
    adicionarColunaSeNaoExistir('fiados', 'hora', 'TEXT');
    adicionarColunaSeNaoExistir('fiados', 'origem', "TEXT DEFAULT 'SISTEMA'");
    adicionarColunaSeNaoExistir('fiados', 'grupo_importacao', 'TEXT');
    adicionarColunaSeNaoExistir('fiados', 'valor_pago', 'REAL DEFAULT 0');
    adicionarColunaSeNaoExistir('fiados', 'quitado', 'INTEGER DEFAULT 0');
    adicionarColunaSeNaoExistir('fiados', 'forma_pagamento', 'TEXT');
    adicionarColunaSeNaoExistir('fiados', 'valor_recebido', 'REAL DEFAULT 0');
    adicionarColunaSeNaoExistir('fiados', 'troco', 'REAL DEFAULT 0');
    adicionarColunaSeNaoExistir('fiados', 'cancelado', 'INTEGER DEFAULT 0');
    adicionarColunaSeNaoExistir('fiados', 'data_cancelamento', 'TEXT');
    adicionarColunaSeNaoExistir('fiados', 'hora_cancelamento', 'TEXT');
    adicionarColunaSeNaoExistir('fiados', 'motivo_cancelamento', 'TEXT');

    db.run(`
        CREATE TABLE IF NOT EXISTS pagamentos_fiados (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cliente_nome TEXT NOT NULL,
            valor_pago REAL DEFAULT 0,
            forma_pagamento TEXT DEFAULT 'DINHEIRO',
            valor_recebido REAL DEFAULT 0,
            troco REAL DEFAULT 0,
            observacao TEXT,
            data TEXT NOT NULL,
            hora TEXT,
            cancelado INTEGER DEFAULT 0,
            data_cancelamento TEXT,
            hora_cancelamento TEXT,
            motivo_cancelamento TEXT
        )
    `);

    adicionarColunaSeNaoExistir('pagamentos_fiados', 'cliente_nome', 'TEXT');
    adicionarColunaSeNaoExistir('pagamentos_fiados', 'valor_pago', 'REAL DEFAULT 0');
    adicionarColunaSeNaoExistir('pagamentos_fiados', 'forma_pagamento', "TEXT DEFAULT 'DINHEIRO'");
    adicionarColunaSeNaoExistir('pagamentos_fiados', 'valor_recebido', 'REAL DEFAULT 0');
    adicionarColunaSeNaoExistir('pagamentos_fiados', 'troco', 'REAL DEFAULT 0');
    adicionarColunaSeNaoExistir('pagamentos_fiados', 'observacao', 'TEXT');
    adicionarColunaSeNaoExistir('pagamentos_fiados', 'data', 'TEXT');
    adicionarColunaSeNaoExistir('pagamentos_fiados', 'hora', 'TEXT');
    adicionarColunaSeNaoExistir('pagamentos_fiados', 'cancelado', 'INTEGER DEFAULT 0');
    adicionarColunaSeNaoExistir('pagamentos_fiados', 'data_cancelamento', 'TEXT');
    adicionarColunaSeNaoExistir('pagamentos_fiados', 'hora_cancelamento', 'TEXT');
    adicionarColunaSeNaoExistir('pagamentos_fiados', 'motivo_cancelamento', 'TEXT');

    db.run(`
        CREATE TABLE IF NOT EXISTS pagamentos_fiados_itens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            pagamento_id INTEGER NOT NULL,
            fiado_id INTEGER NOT NULL,
            cliente_nome TEXT NOT NULL,
            produto TEXT,
            quantidade REAL DEFAULT 0,
            valor_original_item REAL DEFAULT 0,
            saldo_antes REAL DEFAULT 0,
            valor_abatido REAL DEFAULT 0,
            saldo_depois REAL DEFAULT 0,
            data TEXT NOT NULL,
            hora TEXT,
            cancelado INTEGER DEFAULT 0,
            data_cancelamento TEXT,
            hora_cancelamento TEXT,
            motivo_cancelamento TEXT
        )
    `);

    adicionarColunaSeNaoExistir('pagamentos_fiados_itens', 'pagamento_id', 'INTEGER');
    adicionarColunaSeNaoExistir('pagamentos_fiados_itens', 'fiado_id', 'INTEGER');
    adicionarColunaSeNaoExistir('pagamentos_fiados_itens', 'cliente_nome', 'TEXT');
    adicionarColunaSeNaoExistir('pagamentos_fiados_itens', 'produto', 'TEXT');
    adicionarColunaSeNaoExistir('pagamentos_fiados_itens', 'quantidade', 'REAL DEFAULT 0');
    adicionarColunaSeNaoExistir('pagamentos_fiados_itens', 'valor_original_item', 'REAL DEFAULT 0');
    adicionarColunaSeNaoExistir('pagamentos_fiados_itens', 'saldo_antes', 'REAL DEFAULT 0');
    adicionarColunaSeNaoExistir('pagamentos_fiados_itens', 'valor_abatido', 'REAL DEFAULT 0');
    adicionarColunaSeNaoExistir('pagamentos_fiados_itens', 'saldo_depois', 'REAL DEFAULT 0');
    adicionarColunaSeNaoExistir('pagamentos_fiados_itens', 'data', 'TEXT');
    adicionarColunaSeNaoExistir('pagamentos_fiados_itens', 'hora', 'TEXT');
    adicionarColunaSeNaoExistir('pagamentos_fiados_itens', 'cancelado', 'INTEGER DEFAULT 0');
    adicionarColunaSeNaoExistir('pagamentos_fiados_itens', 'data_cancelamento', 'TEXT');
    adicionarColunaSeNaoExistir('pagamentos_fiados_itens', 'hora_cancelamento', 'TEXT');
    adicionarColunaSeNaoExistir('pagamentos_fiados_itens', 'motivo_cancelamento', 'TEXT');

    db.run(`
        CREATE TABLE IF NOT EXISTS vendas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            data TEXT NOT NULL,
            hora TEXT,
            forma_pagamento TEXT NOT NULL,
            cliente_nome TEXT,
            subtotal REAL DEFAULT 0,
            desconto REAL DEFAULT 0,
            total REAL DEFAULT 0,
            valor_recebido REAL DEFAULT 0,
            troco REAL DEFAULT 0,
            observacao TEXT,
            cancelada INTEGER DEFAULT 0,
            data_cancelamento TEXT,
            hora_cancelamento TEXT,
            motivo_cancelamento TEXT
        )
    `);

    adicionarColunaSeNaoExistir('vendas', 'hora', 'TEXT');
    adicionarColunaSeNaoExistir('vendas', 'subtotal', 'REAL DEFAULT 0');
    adicionarColunaSeNaoExistir('vendas', 'desconto', 'REAL DEFAULT 0');
    adicionarColunaSeNaoExistir('vendas', 'valor_recebido', 'REAL DEFAULT 0');
    adicionarColunaSeNaoExistir('vendas', 'troco', 'REAL DEFAULT 0');
    adicionarColunaSeNaoExistir('vendas', 'cancelada', 'INTEGER DEFAULT 0');
    adicionarColunaSeNaoExistir('vendas', 'data_cancelamento', 'TEXT');
    adicionarColunaSeNaoExistir('vendas', 'hora_cancelamento', 'TEXT');
    adicionarColunaSeNaoExistir('vendas', 'motivo_cancelamento', 'TEXT');

    db.run(`
        CREATE TABLE IF NOT EXISTS itens_venda (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            venda_id INTEGER,
            produto_id INTEGER,
            produto_nome TEXT,
            quantidade REAL DEFAULT 0,
            unidade_medida TEXT DEFAULT 'UN',
            valor_original_unitario REAL DEFAULT 0,
            valor_unitario REAL DEFAULT 0,
            desconto_unitario REAL DEFAULT 0,
            desconto_total REAL DEFAULT 0,
            valor_total REAL DEFAULT 0
        )
    `);

    adicionarColunaSeNaoExistir('itens_venda', 'valor_original_unitario', 'REAL DEFAULT 0');
    adicionarColunaSeNaoExistir('itens_venda', 'unidade_medida', "TEXT DEFAULT 'UN'");
    adicionarColunaSeNaoExistir('itens_venda', 'desconto_unitario', 'REAL DEFAULT 0');
    adicionarColunaSeNaoExistir('itens_venda', 'desconto_total', 'REAL DEFAULT 0');

    db.run(`
        CREATE TABLE IF NOT EXISTS movimentacoes_estoque (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            venda_id INTEGER,
            produto_id INTEGER,
            produto_nome TEXT,
            tipo TEXT NOT NULL,
            quantidade REAL DEFAULT 0,
            estoque_anterior REAL DEFAULT 0,
            estoque_atual REAL DEFAULT 0,
            observacao TEXT,
            data TEXT NOT NULL,
            hora TEXT,
            cancelada INTEGER DEFAULT 0,
            data_cancelamento TEXT,
            hora_cancelamento TEXT,
            motivo_cancelamento TEXT
        )
    `);

    adicionarColunaSeNaoExistir('movimentacoes_estoque', 'venda_id', 'INTEGER');
    adicionarColunaSeNaoExistir('movimentacoes_estoque', 'hora', 'TEXT');
    adicionarColunaSeNaoExistir('movimentacoes_estoque', 'cancelada', 'INTEGER DEFAULT 0');
    adicionarColunaSeNaoExistir('movimentacoes_estoque', 'data_cancelamento', 'TEXT');
    adicionarColunaSeNaoExistir('movimentacoes_estoque', 'hora_cancelamento', 'TEXT');
    adicionarColunaSeNaoExistir('movimentacoes_estoque', 'motivo_cancelamento', 'TEXT');

    db.run(`
        CREATE TABLE IF NOT EXISTS entregas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            venda_id INTEGER,
            cliente_nome TEXT NOT NULL,
            telefone TEXT,
            endereco TEXT NOT NULL,
            bairro_cidade TEXT,
            observacao TEXT,
            status_entrega TEXT DEFAULT 'PENDENTE',
            status_pagamento TEXT DEFAULT 'PAGO_NA_COMPRA',
            forma_recebimento TEXT,
            frete REAL DEFAULT 0,
            valor_total REAL DEFAULT 0,
            valor_recebido REAL DEFAULT 0,
            data TEXT NOT NULL,
            hora TEXT,
            data_status TEXT,
            hora_status TEXT,
            data_recebimento TEXT,
            hora_recebimento TEXT,
            cancelada INTEGER DEFAULT 0,
            data_cancelamento TEXT,
            hora_cancelamento TEXT,
            motivo_cancelamento TEXT
        )
    `);

    adicionarColunaSeNaoExistir('entregas', 'venda_id', 'INTEGER');
    adicionarColunaSeNaoExistir('entregas', 'cliente_nome', 'TEXT');
    adicionarColunaSeNaoExistir('entregas', 'telefone', 'TEXT');
    adicionarColunaSeNaoExistir('entregas', 'endereco', 'TEXT');
    adicionarColunaSeNaoExistir('entregas', 'bairro_cidade', 'TEXT');
    adicionarColunaSeNaoExistir('entregas', 'observacao', 'TEXT');
    adicionarColunaSeNaoExistir('entregas', 'status_entrega', "TEXT DEFAULT 'PENDENTE'");
    adicionarColunaSeNaoExistir('entregas', 'status_pagamento', "TEXT DEFAULT 'PAGO_NA_COMPRA'");
    adicionarColunaSeNaoExistir('entregas', 'forma_recebimento', 'TEXT');
    adicionarColunaSeNaoExistir('entregas', 'frete', 'REAL DEFAULT 0');
    adicionarColunaSeNaoExistir('entregas', 'valor_total', 'REAL DEFAULT 0');
    adicionarColunaSeNaoExistir('entregas', 'valor_recebido', 'REAL DEFAULT 0');
    adicionarColunaSeNaoExistir('entregas', 'data', 'TEXT');
    adicionarColunaSeNaoExistir('entregas', 'hora', 'TEXT');
    adicionarColunaSeNaoExistir('entregas', 'data_status', 'TEXT');
    adicionarColunaSeNaoExistir('entregas', 'hora_status', 'TEXT');
    adicionarColunaSeNaoExistir('entregas', 'data_recebimento', 'TEXT');
    adicionarColunaSeNaoExistir('entregas', 'hora_recebimento', 'TEXT');
    adicionarColunaSeNaoExistir('entregas', 'cancelada', 'INTEGER DEFAULT 0');
    adicionarColunaSeNaoExistir('entregas', 'data_cancelamento', 'TEXT');
    adicionarColunaSeNaoExistir('entregas', 'hora_cancelamento', 'TEXT');
    adicionarColunaSeNaoExistir('entregas', 'motivo_cancelamento', 'TEXT');
    adicionarColunaSeNaoExistir('entregas', 'transferida_a_prazo', 'INTEGER DEFAULT 0');
    adicionarColunaSeNaoExistir('entregas', 'fiado_transferencia_id', 'INTEGER');
    adicionarColunaSeNaoExistir('entregas', 'data_transferencia_prazo', 'TEXT');
    adicionarColunaSeNaoExistir('entregas', 'hora_transferencia_prazo', 'TEXT');

    db.run(`
        CREATE TABLE IF NOT EXISTS orcamentos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            numero TEXT,
            cliente_nome TEXT,
            telefone TEXT,
            cidade TEXT,
            observacao TEXT,
            validade TEXT,
            subtotal REAL DEFAULT 0,
            desconto REAL DEFAULT 0,
            frete REAL DEFAULT 0,
            total REAL DEFAULT 0,
            status TEXT DEFAULT 'ABERTO',
            removido_historico INTEGER DEFAULT 0,
            data_criacao TEXT NOT NULL,
            hora_criacao TEXT
        )
    `);

    adicionarColunaSeNaoExistir('orcamentos', 'numero', 'TEXT');
    adicionarColunaSeNaoExistir('orcamentos', 'cliente_nome', 'TEXT');
    adicionarColunaSeNaoExistir('orcamentos', 'telefone', 'TEXT');
    adicionarColunaSeNaoExistir('orcamentos', 'cidade', 'TEXT');
    adicionarColunaSeNaoExistir('orcamentos', 'observacao', 'TEXT');
    adicionarColunaSeNaoExistir('orcamentos', 'validade', 'TEXT');
    adicionarColunaSeNaoExistir('orcamentos', 'subtotal', 'REAL DEFAULT 0');
    adicionarColunaSeNaoExistir('orcamentos', 'desconto', 'REAL DEFAULT 0');
    adicionarColunaSeNaoExistir('orcamentos', 'frete', 'REAL DEFAULT 0');
    adicionarColunaSeNaoExistir('orcamentos', 'total', 'REAL DEFAULT 0');
    adicionarColunaSeNaoExistir('orcamentos', 'status', "TEXT DEFAULT 'ABERTO'");
    adicionarColunaSeNaoExistir('orcamentos', 'removido_historico', 'INTEGER DEFAULT 0');
    adicionarColunaSeNaoExistir('orcamentos', 'data_criacao', 'TEXT');
    adicionarColunaSeNaoExistir('orcamentos', 'hora_criacao', 'TEXT');

    db.run(`
        CREATE TABLE IF NOT EXISTS orcamento_itens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            orcamento_id INTEGER NOT NULL,
            produto_id INTEGER,
            codigo TEXT,
            produto_nome TEXT NOT NULL,
            categoria TEXT,
            quantidade REAL DEFAULT 0,
            unidade_medida TEXT DEFAULT 'UN',
            valor_unitario REAL DEFAULT 0,
            desconto_item REAL DEFAULT 0,
            valor_total REAL DEFAULT 0
        )
    `);

    adicionarColunaSeNaoExistir('orcamento_itens', 'orcamento_id', 'INTEGER');
    adicionarColunaSeNaoExistir('orcamento_itens', 'produto_id', 'INTEGER');
    adicionarColunaSeNaoExistir('orcamento_itens', 'codigo', 'TEXT');
    adicionarColunaSeNaoExistir('orcamento_itens', 'produto_nome', 'TEXT');
    adicionarColunaSeNaoExistir('orcamento_itens', 'categoria', 'TEXT');
    adicionarColunaSeNaoExistir('orcamento_itens', 'quantidade', 'REAL DEFAULT 0');
    adicionarColunaSeNaoExistir('orcamento_itens', 'unidade_medida', "TEXT DEFAULT 'UN'");
    adicionarColunaSeNaoExistir('orcamento_itens', 'valor_unitario', 'REAL DEFAULT 0');
    adicionarColunaSeNaoExistir('orcamento_itens', 'desconto_item', 'REAL DEFAULT 0');
    adicionarColunaSeNaoExistir('orcamento_itens', 'valor_total', 'REAL DEFAULT 0');

    db.run(`
        CREATE TABLE IF NOT EXISTS retiradas_caixa (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            valor REAL DEFAULT 0,
            motivo TEXT,
            observacao TEXT,
            data TEXT NOT NULL,
            hora TEXT,
            cancelada INTEGER DEFAULT 0,
            data_cancelamento TEXT,
            hora_cancelamento TEXT,
            motivo_cancelamento TEXT
        )
    `);

    adicionarColunaSeNaoExistir('retiradas_caixa', 'valor', 'REAL DEFAULT 0');
    adicionarColunaSeNaoExistir('retiradas_caixa', 'motivo', 'TEXT');
    adicionarColunaSeNaoExistir('retiradas_caixa', 'observacao', 'TEXT');
    adicionarColunaSeNaoExistir('retiradas_caixa', 'data', 'TEXT');
    adicionarColunaSeNaoExistir('retiradas_caixa', 'hora', 'TEXT');
    adicionarColunaSeNaoExistir('retiradas_caixa', 'cancelada', 'INTEGER DEFAULT 0');
    adicionarColunaSeNaoExistir('retiradas_caixa', 'data_cancelamento', 'TEXT');
    adicionarColunaSeNaoExistir('retiradas_caixa', 'hora_cancelamento', 'TEXT');
    adicionarColunaSeNaoExistir('retiradas_caixa', 'motivo_cancelamento', 'TEXT');
});

db.pronto = Promise.all(migracoesPendentes).then(() => db);

module.exports = db;
