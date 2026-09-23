const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { generateShortCode, ALPHABET } = require("../../src/utils/shortCode");

describe("generateShortCode", () => {
  it("returns a 7-character alphanumeric code by default", () => {
    const code = generateShortCode();
    assert.equal(code.length, 7);
    for (const char of code) {
      assert.ok(ALPHABET.includes(char));
    }
  });

  it("returns unique values across many calls", () => {
    const seen = new Set();
    for (let i = 0; i < 200; i += 1) {
      seen.add(generateShortCode());
    }
    assert.ok(seen.size > 190);
  });

  it("honours a custom length", () => {
    assert.equal(generateShortCode(12).length, 12);
  });
});
