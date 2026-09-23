# Shortly — URL Shortener API with Analytics (2026)

A REST API for shortening URLs and tracking how they are used. Send a long URL and get a short link back. Each visit to the short link is redirected and recorded, and an analytics endpoint reports total clicks, clicks per day and top referrers.

**Live API:** https://shortly-url-shortener-izh4.onrender.com
<sub>Hosted on Render's free tier, so the first request after a period of inactivity can take up to a minute while the service wakes up.</sub>

**Stack:** Node.js · Express · PostgreSQL (Neon) · node-postgres · Render · Postman

---

## Features

- **Short links:** 7-character base62 codes generated with a cryptographically secure random source.
- **Click tracking:** every redirect records a timestamp, referrer and user agent.
- **Analytics:** total clicks, a per-day breakdown (UTC) and the top 10 referrers for any link.
- **Input validation:** URLs are parsed with the WHATWG `URL` parser. Only `http`/`https` URLs up to 2,048 characters are accepted, and links back to the service itself are rejected to prevent redirect loops.
- **Security:** all SQL is parameterised, `javascript:`/`data:` URLs are rejected, the shorten endpoint is rate-limited, and internal errors are never exposed to clients.
- **Tests:** unit, integration and end-to-end API tests (Postman collection).

---

## API

### `POST /api/shorten`

Creates a short link.

```http
POST /api/shorten
Content-Type: application/json

{ "longUrl": "https://example.com/some/long/path" }
```

```http
HTTP/1.1 201 Created
Location: https://shortly-url-shortener-izh4.onrender.com/aZ3kQ9x

{
  "shortCode": "aZ3kQ9x",
  "shortUrl": "https://shortly-url-shortener-izh4.onrender.com/aZ3kQ9x",
  "longUrl": "https://example.com/some/long/path"
}
```

### `GET /:shortCode`

Redirects to the original URL and records the click.

```http
HTTP/1.1 302 Found
Location: https://example.com/some/long/path
```

### `GET /api/stats/:shortCode`

Returns analytics for a short link.

```json
{
  "shortCode": "aZ3kQ9x",
  "shortUrl": "https://shortly-url-shortener-izh4.onrender.com/aZ3kQ9x",
  "longUrl": "https://example.com/some/long/path",
  "createdAt": "2026-09-23T10:15:00.000Z",
  "totalClicks": 3,
  "clicksPerDay": [
    { "day": "2026-09-23", "clicks": 2 },
    { "day": "2026-09-24", "clicks": 1 }
  ],
  "referrers": [
    { "referrer": "direct", "clicks": 2 },
    { "referrer": "https://news.example/", "clicks": 1 }
  ]
}
```

### `GET /` and `GET /health`

`/` returns a short JSON description of the API with links to these docs. `/health` returns `{ "status": "ok" }` for uptime checks; it doesn't query the database, so frequent checks don't keep the database awake.

### Status codes

| Endpoint | Case | Status |
|---|---|---|
| `POST /api/shorten` | Link created | `201 Created` (with `Location` header) |
| | `longUrl` missing, not a string, malformed, not http(s), too long, or points at this service | `400 Bad Request` |
| | Request body is not valid JSON | `400 Bad Request` |
| | Request body exceeds 16 KB | `413 Payload Too Large` |
| | More than 30 requests per 15 minutes from one IP | `429 Too Many Requests` |
| `GET /:shortCode` | Code exists | `302 Found` |
| | Code does not exist or is malformed | `404 Not Found` |
| `GET /api/stats/:shortCode` | Code exists | `200 OK` |
| | Code does not exist or is malformed | `404 Not Found` |
| Any | Unexpected server error | `500 Internal Server Error` |

Errors always have the same shape, with a message that states exactly what is wrong:

```json
{ "error": "longUrl must use the http or https protocol" }
```

---

## Design decisions

### Database schema

```sql
CREATE TABLE urls (
  id          BIGSERIAL PRIMARY KEY,
  short_code  VARCHAR(16) NOT NULL UNIQUE,
  long_url    TEXT        NOT NULL CHECK (char_length(long_url) <= 2048),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE clicks (
  id          BIGSERIAL PRIMARY KEY,
  url_id      BIGINT      NOT NULL REFERENCES urls (id) ON DELETE CASCADE,
  clicked_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  referrer    TEXT,
  user_agent  TEXT
);

CREATE INDEX clicks_url_id_clicked_at_idx ON clicks (url_id, clicked_at);
```

| Index | Purpose |
|---|---|
| `urls.short_code` (unique) | Serves the redirect lookup, the most frequent query in the system, and guarantees that no two links share a code. |
| `clicks (url_id, clicked_at)` | Serves all three analytics queries, which filter on `url_id` first; `clicked_at` second returns rows in time order. It also indexes the foreign key, which PostgreSQL does not do automatically, so deleting a link does not scan the whole `clicks` table. |

**Indexes deliberately omitted:**
- **`long_url`:** the same URL shortened twice gets two independent links with separate analytics, so there is no need to look links up by URL.
- **`(url_id, referrer)`:** every index adds a write to the click insert that runs on each redirect. Referrer grouping runs on rows the composite index has already narrowed down, so a dedicated index isn't justified yet.

**Other choices:**
- `BIGINT` keys, because click volume can exceed the 2.1 billion limit of `INT`.
- `TIMESTAMPTZ`, so that per-day aggregation is done in UTC and doesn't depend on the server's timezone.
- Clicks reference the numeric `url_id` rather than the short code, which gives a compact join key.

### Collision-free short codes

Codes are 7 random characters from a 62-character alphabet, which gives 62⁷ ≈ 3.5 trillion possible codes.

- **The database guarantees uniqueness.** The insert uses `INSERT ... ON CONFLICT (short_code) DO NOTHING`, which checks and inserts in one atomic statement. A separate "check, then insert" would allow two concurrent requests to claim the same code.
- If a code is already taken, the service generates a new one and retries, up to 5 attempts. At 10 million stored links, the chance of a single collision is about 1 in 350,000.
- Codes come from `crypto.randomBytes` with rejection sampling to remove modulo bias, so every character is equally likely and codes cannot be predicted.
- Random codes were chosen over encoding the auto-increment ID because sequential codes are enumerable: anyone could iterate through every link and infer the service's volume.

### Redirects

- **302 rather than 301.** Browsers cache a 301 permanently, so repeat visitors would skip the server and their clicks would never be recorded.
- **The click is logged after the response is sent**, so users never wait on an analytics write. The trade-off is that a click can be lost if the process crashes between the two steps, which is acceptable for analytics.
- **Malformed codes return 404 without a database query.** Codes are checked against a pattern first, which keeps noise such as `/favicon.ico` off the database.

### Architecture

```
src/
├── app.js                  Express app: middleware, routes, error handling
├── server.js               Starts the HTTP server (kept separate so tests can import the app)
├── config/                 Reads and validates environment variables in one place
├── routes/                 Maps URLs to controllers; no logic
├── controllers/            HTTP only: reads the request, calls a service, sets the status code
├── services/               Business rules: URL validation, code generation, analytics
├── db/                     SQL only, every query parameterised
├── middleware/             Rate limiting and centralised error handling
└── utils/                  Short-code generator and the AppError type
migrations/                 Idempotent SQL migrations
postman/                    Postman collection (v3 format)
tests/                      Unit and integration tests
```

Each layer has one responsibility. Services contain no HTTP code and repositories contain no business rules, so services can be unit-tested with in-memory fakes, without Express or a database. Services throw typed errors, and a single error-handling middleware maps them to HTTP status codes.

---

## Running locally

**Prerequisites:** Node.js 20+ and a PostgreSQL database (a free [Neon](https://neon.tech) project works).

```bash
git clone https://github.com/ShivamSapru/shortly-url-shortener.git
cd shortly-url-shortener
npm install
cp .env.example .env        # then fill in DATABASE_URL
npm run migrate             # create tables and indexes
npm run dev                 # http://localhost:3000
```

### Environment variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `BASE_URL` | No | Public URL used to build `shortUrl`. Defaults to Render's `RENDER_EXTERNAL_URL`, then `http://localhost:3000` |
| `PORT` | No | Defaults to `3000` |
| `NODE_ENV` | No | `development`, `production` or `test` |
| `TEST_DATABASE_URL` | For tests | A separate, disposable database. The integration tests truncate tables, so they never use `DATABASE_URL`. |

---

## Testing

```bash
npm test          # unit tests; also runs the integration tests if TEST_DATABASE_URL is set
npm run test:api  # Postman collection against a running server (19 assertions)
```

- **Unit tests** cover URL validation rules, collision retries, retry exhaustion and the analytics response shape, using in-memory fakes.
- **Integration tests** send real HTTP requests through the app against a real PostgreSQL database, from creating a link through to redirects and analytics.
- **Postman collection** (`postman/collections/URL Shortener API/`) exercises every endpoint and status code. To run it against the live deployment:

  ```bash
  npx postman collection run "postman/collections/URL Shortener API" \
    --env-var "baseUrl=https://shortly-url-shortener-izh4.onrender.com" --delay-request 500
  ```

---

## Deployment

The API is deployed on **Render** as a web service built from this repository (`npm ci`, then `npm start`). The database is **Neon** serverless PostgreSQL. `DATABASE_URL` is configured in Render's environment settings and never committed. Express is configured to trust Render's proxy, so rate limiting applies per client IP rather than to the proxy's address.

---

## Possible extensions

- Redis cache in front of the short-code lookup to reduce database load on redirects
- Custom aliases (`409 Conflict` when taken) and link expiry (`410 Gone`)
- Batched click inserts through a queue for high traffic
- CI pipeline running the test suite against a temporary database branch on every push

---

## Author

**Shivam Sapru** · [GitHub](https://github.com/ShivamSapru)
