const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { AppError } = require("../../src/utils/AppError");
const {
  createUrlService,
  validateLongUrl,
} = require("../../src/services/url.service");

function expect400(fn, messagePattern) {
  assert.throws(fn, (err) => {
    assert.ok(err instanceof AppError);
    assert.equal(err.statusCode, 400);
    assert.match(err.message, messagePattern);
    return true;
  });
}

describe("validateLongUrl", () => {
  it("requires longUrl", () => {
    expect400(() => validateLongUrl(undefined), /required/);
    expect400(() => validateLongUrl("   "), /required/);
  });

  it("rejects non-strings", () => {
    expect400(() => validateLongUrl(42), /must be a string/);
  });

  it("rejects unparseable URLs", () => {
    expect400(() => validateLongUrl("not a url"), /valid absolute URL/);
  });

  it("rejects non-http protocols", () => {
    expect400(() => validateLongUrl("javascript:alert(1)"), /http or https/);
    expect400(() => validateLongUrl("ftp://example.com"), /http or https/);
  });

  it("rejects URLs over 2048 characters", () => {
    const long = `https://example.com/${"a".repeat(2048)}`;
    expect400(() => validateLongUrl(long), /2048/);
  });

  it("rejects links back to the shortener itself", () => {
    expect400(
      () => validateLongUrl("http://sho.rt/abc1234", { ownHost: "sho.rt" }),
      /cannot point at this URL shortener/
    );
  });

  it("trims and normalises valid URLs", () => {
    assert.equal(
      validateLongUrl("  https://Example.com/path  "),
      "https://example.com/path"
    );
  });
});

describe("url.service", () => {
  it("does not touch the database for an invalid URL", async () => {
    const service = createUrlService({
      urls: { insertUrlIfCodeFree: () => assert.fail("should not insert") },
    });
    await assert.rejects(() => service.shortenUrl("nope"), AppError);
  });

  it("inserts a generated code for a valid URL", async () => {
    const inserted = [];
    const service = createUrlService({
      generateCode: () => "abc1234",
      urls: {
        insertUrlIfCodeFree: async (row) => {
          inserted.push(row);
          return { id: 1, short_code: row.shortCode, long_url: row.longUrl };
        },
      },
    });

    const result = await service.shortenUrl("https://example.com/path");
    assert.equal(result.short_code, "abc1234");
    assert.equal(inserted[0].longUrl, "https://example.com/path");
  });

  it("retries with a new code when one is taken", async () => {
    const codes = ["taken01", "fresh02"];
    const service = createUrlService({
      generateCode: () => codes.shift(),
      urls: {
        insertUrlIfCodeFree: async ({ shortCode, longUrl }) =>
          shortCode === "taken01"
            ? null
            : { id: 2, short_code: shortCode, long_url: longUrl },
      },
    });

    const result = await service.shortenUrl("https://example.com");
    assert.equal(result.short_code, "fresh02");
  });

  it("gives up with a 500 after maxAttempts collisions", async () => {
    let attempts = 0;
    const service = createUrlService({
      maxAttempts: 3,
      urls: {
        insertUrlIfCodeFree: async () => {
          attempts += 1;
          return null;
        },
      },
    });
    await assert.rejects(
      () => service.shortenUrl("https://example.com"),
      (err) => err instanceof AppError && err.statusCode === 500
    );
    assert.equal(attempts, 3);
  });

  it("404s for a missing code", async () => {
    const service = createUrlService({
      urls: { findByShortCode: async () => null },
    });
    await assert.rejects(
      () => service.getByShortCode("missing"),
      (err) => err instanceof AppError && err.statusCode === 404
    );
  });

  it("404s for a malformed code without querying the database", async () => {
    const service = createUrlService({
      urls: { findByShortCode: () => assert.fail("should not query") },
    });
    await assert.rejects(
      () => service.getByShortCode("favicon.ico"),
      (err) => err instanceof AppError && err.statusCode === 404
    );
  });
});
