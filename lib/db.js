"use strict";

/* Pool PostgreSQL reutilizable para Vercel Serverless.
   Usa process.env.DATABASE_URL (nunca se imprime ni se expone). */

const { Pool } = require("pg");

let pool = null;

function sslConfig() {
  const cs = process.env.DATABASE_URL || "";
  // Proveedores gestionados (Neon/Supabase/poolers) o sslmode=require exigen TLS.
  if (/sslmode=require/i.test(cs) || /neon\.tech|supabase\.co|pooler/i.test(cs)) {
    return { rejectUnauthorized: false };
  }
  return undefined;
}

function getPool() {
  if (pool) return pool;
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured");
  }
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 2,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    ssl: sslConfig(),
  });
  pool.on("error", (err) => {
    // Solo mensaje, sin credenciales.
    console.error("pg pool error:", err && err.message);
  });
  return pool;
}

async function query(text, params) {
  return getPool().query(text, params);
}

module.exports = { getPool, query };
