"use strict";

/* Utilidades para códigos temporales (estudiante / docente).
   Sin Math.random: usa crypto del entorno Node. */

const crypto = require("crypto");

// Alfabeto sin caracteres ambiguos (sin 0/O, 1/I).
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const DEFAULT_LENGTH = 6;

function generateCode(length = DEFAULT_LENGTH, alphabet = ALPHABET) {
  const len = Math.max(1, Number(length) || DEFAULT_LENGTH);
  const chars = String(alphabet);
  let out = "";
  for (let i = 0; i < len; i++) {
    out += chars[crypto.randomInt(chars.length)];
  }
  return out;
}

function generateSessionCodes(length = DEFAULT_LENGTH) {
  const studentCode = generateCode(length);
  let teacherCode = generateCode(length);
  let guard = 0;
  while (teacherCode === studentCode && guard < 10) {
    teacherCode = generateCode(length);
    guard += 1;
  }
  return { studentCode, teacherCode };
}

module.exports = { ALPHABET, DEFAULT_LENGTH, generateCode, generateSessionCodes };
