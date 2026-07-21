const { Pool } = require('pg');
const { AsyncLocalStorage } = require('async_hooks');
const dotenv = require('dotenv');

dotenv.config();

const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL or SUPABASE_DB_URL must be defined to connect to Supabase/Postgres.');
}

const useSsl = String(process.env.DB_SSL || 'true').toLowerCase() === 'true';

const pool = new Pool({
  connectionString,
  ssl: useSsl ? { rejectUnauthorized: false } : false
});

const transactionContext = new AsyncLocalStorage();

function convertSql(sql) {
  let index = 1;
  return sql.replace(/\?/g, () => `$${index++}`);
}

function getCurrentClient() {
  return transactionContext.getStore();
}

const db = {
  get: (sql, params, callback) => {
    if (typeof params === 'function') {
      callback = params;
      params = [];
    }

    const pgSql = convertSql(sql);
    const client = getCurrentClient();
    const executor = client || pool;

    executor.query(pgSql, params, (err, res) => {
      if (err) {
        callback(err, null);
      } else {
        callback(null, res.rows[0]);
      }
    });
  },

  all: (sql, params, callback) => {
    if (typeof params === 'function') {
      callback = params;
      params = [];
    }

    const pgSql = convertSql(sql);
    const client = getCurrentClient();
    const executor = client || pool;

    executor.query(pgSql, params, (err, res) => {
      if (err) {
        callback(err, null);
      } else {
        callback(null, res.rows);
      }
    });
  },

  run: (sql, params, callback) => {
    if (typeof params === 'function') {
      callback = params;
      params = [];
    }

    const sqlTrim = String(sql || '').trim();
    const upperSql = sqlTrim.toUpperCase();
    const client = getCurrentClient();

    const handleResult = (err, res) => {
      if (callback) {
        if (err) callback.call({}, err);
        else {
          const isInsert = sqlTrim.toUpperCase().startsWith('INSERT');
          const resultCtx = {
            changes: res ? res.rowCount : 0,
            lastID: isInsert && res && res.rows.length > 0 ? res.rows[0].id : undefined
          };
          callback.call(resultCtx, null);
        }
      }
    };

    if (upperSql === 'BEGIN TRANSACTION' || upperSql === 'BEGIN') {
      if (client) {
        const error = new Error('Transaction already in progress.');
        if (callback) callback.call({}, error);
        return Promise.resolve();
      }

      return pool.connect().then(transactionClient => {
        return transactionClient.query('BEGIN').then(() => {
          transactionContext.enterWith(transactionClient);
          if (callback) callback.call({ changes: 0 }, null);
        }).catch(err => {
          transactionClient.release();
          if (callback) callback.call({}, err);
          throw err;
        });
      });
    }

    if (upperSql === 'COMMIT' || upperSql === 'ROLLBACK') {
      if (!client) {
        const error = new Error('No transaction in progress.');
        if (callback) callback.call({}, error);
        return Promise.resolve();
      }

      return client.query(convertSql(sql), params)
        .then(res => {
          client.release();
          transactionContext.enterWith(null);
          if (callback) callback.call({ changes: res.rowCount, lastID: undefined }, null);
        })
        .catch(err => {
          client.release();
          transactionContext.enterWith(null);
          if (callback) callback.call({}, err);
          throw err;
        });
    }

    const pgSql = convertSql(sql);
    const executor = client || pool;
    const isInsert = pgSql.trim().toUpperCase().startsWith('INSERT');
    const finalSql = isInsert ? `${pgSql} RETURNING id` : pgSql;

    if (callback) {
      executor.query(finalSql, params, handleResult);
      return;
    }

    return new Promise((resolve, reject) => {
      executor.query(finalSql, params, (err, res) => {
        if (err) return reject(err);
        resolve({
          changes: res.rowCount,
          lastID: isInsert && res.rows.length > 0 ? res.rows[0].id : undefined
        });
      });
    });
  },

  serialize: (cb) => {
    if (cb) cb();
  }
};

db.pronto = Promise.resolve(db);

module.exports = db;
