const crypto = require("crypto");

const ALPHABET =
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

// 248 = 62 * 4. Bytes 248-255 are discarded so each character is equally
// likely; plain `byte % 62` would favour the first 8 characters.
const MAX_UNBIASED_BYTE = 256 - (256 % ALPHABET.length);

function generateShortCode(length = 7) {
  let code = "";
  while (code.length < length) {
    for (const byte of crypto.randomBytes(length)) {
      if (byte < MAX_UNBIASED_BYTE && code.length < length) {
        code += ALPHABET[byte % ALPHABET.length];
      }
    }
  }
  return code;
}

module.exports = { generateShortCode, ALPHABET };
