const { Pool } = require('pg');
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

function convertSql(sql) {
  let index = 1;
  return sql.replace(/\?/g, () => `$${index++}`);
}

const db = {
  get: (sql, params, callback) => {
    if (typeof params === 'function') {
      callback = params;
      params = [];
    }
    const pgSql = convertSql(sql);
    pool.query(pgSql, params, (err, res) => {
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
    pool.query(pgSql, params, (err, res) => {
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
    const pgSql = convertSql(sql);
    const isInsert = pgSql.trim().toUpperCase().startsWith('INSERT');
    const finalSql = isInsert ? `${pgSql} RETURNING id` : pgSql;

    pool.query(finalSql, params, (err, res) => {
      if (err) {
        if (callback) callback.call({}, err);
      } else {
        const resultCtx = {
          changes: res.rowCount,
          lastID: isInsert && res.rows.length > 0 ? res.rows[0].id : undefined
        };
        if (callback) callback.call(resultCtx, null);
      }
    });
  },
  
  serialize: (cb) => {
    if (cb) cb();
  }
};

db.pronto = Promise.resolve(db);

module.exports = db;
