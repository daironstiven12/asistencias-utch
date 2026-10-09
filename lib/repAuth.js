"use strict";

/* Autenticación de representantes: scrypt + JWT HMAC en cookie HttpOnly.
   Sin dependencias externas. El secreto vive solo en process.env. */

const crypto = require("crypto");

const COOKIE_NAME = "rep_session";
const SESSION_TTL_SECONDS = 12 * 60 * 60;
const SCRYPT_OPTS = { N: 32768, r: 8, p: 1, keylen: 32, maxmem: 64 * 1024 * 1024 };

function b64urlEncode(buf) {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function b64urlDecode(s) {
  const b = String(s).replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(b + "=".repeat((4 - (b.length % 4)) % 4), "base64");
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(
    String(password),
    salt,
    SCRYPT_OPTS.keylen,
    { N: SCRYPT_OPTS.N, r: SCRYPT_OPTS.r, p: SCRYPT_OPTS.p, maxmem: SCRYPT_OPTS.maxmem }
  );
  return (
    "$scrypt$N=" +
    SCRYPT_OPTS.N +
    ",r=" +
    SCRYPT_OPTS.r +
    ",p=" +
    SCRYPT_OPTS.p +
    "$" +
    b64urlEncode(salt) +
    "$" +
    b64urlEncode(hash)
  );
}

function verifyPassword(password, stored) {
  try {
    const parts = String(stored).split("$");
    // ["", "scrypt", "N=..,r=..,p=..", salt, hash]
    if (parts.length !== 5 || parts[1] !== "scrypt") return false;
    const params = Object.fromEntries(
      parts[2].split(",").map((kv) => kv.split("="))
    );
    const N = parseInt(params.N, 10);
    const r = parseInt(params.r, 10);
    const p = parseInt(params.p, 10);
    if (!N || !r || !p) return false;
    const salt = b64urlDecode(parts[3]);
    const expected = b64urlDecode(parts[4]);
    const actual = crypto.scryptSync(String(password), salt, expected.length, { N, r, p, maxmem: 128 * 1024 * 1024 });
    if (actual.length !== expected.length) return false;
    return crypto.timingSafeEqual(actual, expected);
  } catch (e) {
    return false;
  }
}

function getSessionSecret() {
  if (process.env.REP_SESSION_SECRET) return process.env.REP_SESSION_SECRET;
  try {
    const LOCAL_CONFIG = require("./localConfig");
    if (LOCAL_CONFIG && LOCAL_CONFIG.REP_SESSION_SECRET) return LOCAL_CONFIG.REP_SESSION_SECRET;
  } catch (e) {}
  return null;
}

function signSession(representativeId) {
  const secret = getSessionSecret();
  if (!secret) throw new Error("REP_SESSION_SECRET is not configured");
  const header = b64urlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const payload = b64urlEncode(
    JSON.stringify({ sub: String(representativeId), iat: now, exp: now + SESSION_TTL_SECONDS })
  );
  const sig = b64urlEncode(
    crypto.createHmac("sha256", secret).update(header + "." + payload).digest()
  );
  return header + "." + payload + "." + sig;
}

function verifySession(token) {
  try {
    const secret = getSessionSecret();
    if (!secret || typeof token !== "string") return null;
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const expect = b64urlEncode(
      crypto.createHmac("sha256", secret).update(parts[0] + "." + parts[1]).digest()
    );
    const a = Buffer.from(expect);
    const b = Buffer.from(parts[2]);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(b64urlDecode(parts[1]).toString("utf8"));
    if (!payload.sub || !payload.exp || payload.exp * 1000 <= Date.now()) return null;
    return { representativeId: String(payload.sub) };
  } catch (e) {
    return null;
  }
}

function readCookies(req) {
  const out = {};
  const header = req.headers && req.headers.cookie;
  if (!header) return out;
  for (const part of String(header).split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

function cookieHeader(token, maxAge) {
  const secure = process.env.VERCEL_ENV === "production" ? "; Secure" : "";
  return (
    COOKIE_NAME +
    "=" +
    encodeURIComponent(token) +
    "; Path=/; Max-Age=" +
    maxAge +
    "; HttpOnly" +
    secure +
    "; SameSite=Lax"
  );
}

function setSessionCookie(res, token) {
  res.setHeader("Set-Cookie", cookieHeader(token, SESSION_TTL_SECONDS));
}

function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", cookieHeader("", 0));
}

module.exports = {
  COOKIE_NAME,
  SESSION_TTL_SECONDS,
  hashPassword,
  verifyPassword,
  signSession,
  verifySession,
  readCookies,
  setSessionCookie,
  clearSessionCookie,
};
