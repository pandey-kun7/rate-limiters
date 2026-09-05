# API Rate Limiter

A hands-on **Node.js + Express** implementation of the five classic API rate-limiting algorithms, packaged as drop-in Express middleware with an interactive algorithm selector and live, color-coded console logging.

| # | Algorithm | Quick summary |
|---|-----------|---------------|
| 1 | **Token Bucket** | Fixed burst capacity, refilled with one token every interval |
| 2 | **Sliding Window Log** | Tracks exact timestamps of recent requests in a rolling window |
| 3 | **Leaky Bucket** | FIFO queue that drains at a constant rate to smooth bursts |
| 4 | **Fixed Window Counter** | Simple counter that resets every fixed time window |
| 5 | **Sliding Window Counter** | Hybrid estimate combining current + previous window counts |

> When you start the server, the terminal asks which algorithm to use — press **1–5** and watch the middleware allow or throttle every request against the sample route.
>
> Everything is hand-rolled from scratch — zero rate-limiting libraries. Great for learning how each algorithm actually works under the hood.

![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=nodedotjs&logoColor=white) ![Express](https://img.shields.io/badge/Express-5.x-000000?logo=express&logoColor=white) ![JavaScript](https://img.shields.io/badge/JavaScript-ESM-F7DF1E?logo=javascript&logoColor=black) ![License](https://img.shields.io/badge/license-ISC-blue)

---

## Table of Contents

- [Features](#features)
- [The Algorithms](#the-algorithms)
- [How It Works](#how-it-works)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Configuration & Tuning](#configuration--tuning)
- [Project Structure](#project-structure)
- [Trying It Out](#trying-it-out)
- [Example Console Output](#example-console-output)
- [Using the Middleware in Your Own Project](#using-the-middleware-in-your-own-project)
- [Limitations & Notes](#limitations--notes)
- [Roadmap Ideas](#roadmap-ideas)
- [License](#license)

---

## Features

- **Five hand-written rate-limiting algorithms** — no third-party rate limiter dependency
- **Interactive algorithm selection** — pick 1–5 in the terminal when the server boots; pick anything else and requests pass through unthrottled
- **Rich console logging** — every allow, reject, refill, and window-reset event is logged with ANSI colors and live counters
- **Working demo endpoint** — `GET /` serves a sample image through the throttled route so you can feel the limiter kick in
- **Educational by design** — the state and logic of every algorithm is explicit and easy to follow
- **Modern ESM codebase** — `import` / `export` throughout, ready for Node 18+

---

## The Algorithms

All algorithms live in [`middleware/rateLimiter.js`](middleware/rateLimiter.js) and share the same default budget: **3 requests per 10-second window**, with refills/drains firing on a **10-second tick**. The differences are in *how* they track and enforce that budget.

### 1. Token Bucket

> Think of a bucket that holds up to `BUCKET_SIZE` tokens. Each incoming request spends one token; when the bucket is empty the request is rejected. Every `RATE_FILL` (10 s) tick, one new token is added back — up to the bucket's capacity.

- **Good for:** allowing short, natural bursts while capping sustained throughput.
- **Trade-off:** a client can burst all 3 tokens instantly, then must wait up to 10 s for each new token.

### 2. Sliding Window Log

> Keeps a log of the exact `Date.now()` timestamp of every accepted request. On each new request, stale entries older than the window (`SLIDING_WINDOW_LENGTH` = 10 s) are pruned. If fewer than `MAX_REQ_ALLOWED` (3) timestamps remain, the request is logged and allowed; otherwise it is rejected.

- **Good for:** the most accurate, true "N requests per last X seconds" semantics.
- **Trade-off:** memory grows with request volume (every timestamp is stored).

### 3. Leaky Bucket

> Requests are placed into a FIFO queue (bucket) of capacity `BUCKET_SIZE`. If the queue is full, the request is dropped. Every 10 s tick, the oldest queued request is dequeued and processed at a constant drain rate.

- **Good for:** smoothing bursts into a perfectly steady stream (great for integration with rate-limited downstream services).
- **Trade-off:** requests are artificially delayed by queueing, and the processing rate is fixed.

### 4. Fixed Window Counter

> A plain counter is incremented on each allowed request. Every `RATE_FILL` (10 s) tick the counter resets to zero. When the counter is at the `MAX_REQUEST_ALLOWED` (3) limit, further requests are rejected.

- **Good for:** the simplest and cheapest approach for uniform traffic.
- **Trade-off:** suffers from the classic **boundary burst** problem — a client can double-dip by hammering requests right at the end of one window and the start of the next.

### 5. Sliding Window Counter

> A hybrid approach: it tracks the request count of the **previous** window and the **current** window, then computes a weighted estimate of the requests in the true sliding window:

```
estimated = currentWindowCount + previousWindowCount * (1 - elapsed_ms / WINDOW_TIME_LIMIT)
```

- **Good for:** near-sliding-window accuracy at a fraction of the memory cost of a full timestamp log.
- **Trade-off:** it is an approximation — the weighted estimate can drift slightly from the exact number.

---

## How It Works

```
Start server (npm start)
        |
        v
readline prompt: "Which type of ratelimiter...?"   ->   user presses 1-5
        |
        v
choice is exported from index.js and read by the middleware
        |
        v
Client hits  GET /   ->   rateLimiter middleware
                             |
                             v
                   dispatch to one of the 5 algorithms
                             |
                  +----------+-----------+
                  |                      |
                  v                      v
             within budget          over budget
                  |                      |
                  v                      v
             next() -> controller   sends public/err/rate-limited.html
             serves the image       + logs the rejection
             + logs the event
```

Every request passes through the `rateLimiter` middleware (registered in [`routes/serve.route.js`](routes/serve.route.js)) before reaching the controller. The controller simply serves `public/images/download.jpg` per request — ideal for rapid-fire testing with `curl` or a browser refresh.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | [Node.js](https://nodejs.org/) (ECMAScript Modules, `"type": "module"`) |
| Web framework | [Express](https://expressjs.com/) v5 |
| CORS | [`cors`](https://www.npmjs.com/package/cors) |
| Dev tooling | [nodemon](https://www.npmjs.com/package/nodemon) (auto-restart) |

**Dependencies:** `express`, `cors`, `nodemon`, `path`

---

## Prerequisites

- **Node.js 18+** (required by Express 5 / native stable ESM)
- **npm** (bundled with Node.js)
- A terminal that supports ANSI color codes for the full log experience

---

## Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Start the server (runs via nodemon)
npm start
```

You'll see the server banner, followed by an interactive prompt:

```text
Which type of ratelimiter you wish to use ?
 Press 1 for Token Bucket
 Press 2 for Sliding Window Log
 Press 3 for Leaky Bucket
 Press 4 for Fixed Window Counter
 Press 5 for Sliding Window Counter
```

Type a number and press **Enter**. The prompt loops, so you can switch algorithms live at any time without restarting the server. If you press any other key, the middleware passes every request through **unthrottled**.

The server listens on **http://localhost:8000**.

---

## Configuration & Tuning

All knobs are module-level constants in [`middleware/rateLimiter.js`](middleware/rateLimiter.js). Tweak them to change the request budget, window length, or refill rate.

| Constant | Default | Applies to |
|----------|---------|------------|
| `BUCKET_SIZE` | `3` | Token Bucket, Leaky Bucket |
| `RATE_FILL` | `10,000 ms` | Fill/drain tick for Token Bucket, Leaky Bucket, Fixed Window Counter |
| `SLIDING_WINDOW_LENGTH` | `10,000 ms` | Sliding Window Log |
| `MAX_REQ_ALLOWED` | `3` | Sliding Window Log |
| `MAX_REQUEST_ALLOWED` | `3` | Fixed Window Counter |
| `MAX_WINDOW_REQ_ALLOWED` | `3` | Sliding Window Counter |
| `WINDOW_TIME_LIMIT` | `10,000 ms` | Sliding Window Counter |

> **Example:** to allow 10 requests per 30-second window with the Sliding Window Log, set `MAX_REQ_ALLOWED = 10` and `SLIDING_WINDOW_LENGTH = 30000`.

---

## Project Structure

```text
rate-limiter/
├── controllers/
│   └── serve.controller.js      # Serves the sample image on each allowed request
├── middleware/
│   └── rateLimiter.js           # All 5 rate-limiting algorithms + dispatcher
├── public/
│   ├── err/
│   │   └── rate-limited.html    # Page returned when a request is throttled
│   └── images/
│       └── download.jpg         # Sample resource served by the demo route
├── routes/
│   └── serve.route.js           # GET / wired with the rateLimiter middleware
├── .gitignore                   # Ignores node_modules
├── index.js                     # Express bootstrap + interactive algorithm prompt
└── package.json
```

---

## Trying It Out

With the server running and an algorithm selected, open a terminal and fire requests at `GET /`:

```bash
# Allowed request (first few) — returns the sample image
curl -i http://localhost:8000/

# Hammer the endpoint — the 4th rapid request gets throttled
for i in 1 2 3 4 5; do curl -s -o /dev/null -w "Request $i -> HTTP %{http_code}\n" http://localhost:8000/; done
```

Or just smash **F5** in your browser a few times — after 3 quick refreshes you'll land on the **rate-limited** page:

> `You have been limited from accessing the contents of the page.`

Then wait ~10 seconds: the window refills / bucket drains / counter resets (depending on the active algorithm) and requests start flowing again.

---

## Example Console Output

With **Token Bucket (1)** selected (order of allow/reject logs may vary slightly by tick timing):

```text
═══════════════════════════════════════════════
  Server is running
  URL       : http://localhost:8000
═══════════════════════════════════════════════

Which type of ratelimiter you wish to use ?
 Press 1 for Token Bucket
 Press 2 for Sliding Window Log
 Press 3 for Leaky Bucket
 Press 4 for Fixed Window Counter
 Press 5 for Sliding Window Counter
>> 1  Token Bucket selected

[Request] Incoming request from ::1
[Token Bucket] Remaining tokens : 2 / 3
[Request] Incoming request from ::1
[Token Bucket] Remaining tokens : 1 / 3
[Request] Incoming request from ::1
[Token Bucket] Remaining tokens : 0 / 3
[Request] Incoming request from ::1
[Token Bucket] Request rejected, bucket is empty
[Token Bucket] Adding token... new size : 1        <- after ~10 s tick
```

Each algorithm uses its own tag — `[Sliding Window]`, `[Leaky Bucket]`, `[Fixed Window]`, `[Sliding Window Counter]` — so you always know exactly what the middleware is doing.

---

## Using the Middleware in Your Own Project

The middleware is completely decoupled from the demo route. Mount it on any route you want to protect:

```js
import { rateLimiter } from "./middleware/rateLimiter.js";
import { choice } from "./index.js"; // make choice configurable in your app

// Protect any group of routes
app.use("/api", rateLimiter, apiRouter);
// Or protect a single route
app.get("/protected", rateLimiter, handler);
```

> **Tip:** in a real application you'd typically set `choice` from an environment variable or config instead of the terminal prompt, and run one algorithm per service.

<!-- ---

## Limitations & Notes

This is a **learning-oriented prototype**, so a few things are simplified on purpose:

- **In-memory, single-process state** — counters, buckets, and timestamps live in process memory. Restarting the server resets all limits, and the limiter will not work correctly across multiple server instances (use Redis or a shared store for multi-node deployments).
- **Global (not per-client) limits** — the budget is shared across *all* clients hitting the server. Production rate limiters typically key on IP, API key, or user ID.
- **Throttled responses use HTTP 200** — `res.sendFile()` is called without setting `res.status(429)`. The proper status for rate limiting is **429 Too Many Requests**, ideally with a `Retry-After` header.
- **Fixed tick refills** — Token Bucket, Leaky Bucket, and Fixed Window Counter rely on a `setInterval` tick rather than a continuously computed refill, so behavior is slightly chunkier than production-grade libraries.
- **The `choice` prompt loops** — switching algorithms restarts that algorithm's state from scratch, but previously used algorithms keep pacing state already set during earlier sessions with them.

--- -->

## Roadmap Ideas

- [ ] Per-client (IP / API key) rate-limiting keys
- [ ] HTTP `429` status + `Retry-After` header for throttled responses
- [ ] Redis-backed shared state for multi-instance scaling
- [ ] Configurable limits via environment variables or a config file
- [ ] Automated tests with a request runner (supertest, vitest, etc.)
- [ ] Expose limits via `RateLimit-*` / `X-RateLimit-*` response headers

---

## License

Distributed under the **ISC License**. See `package.json` for details.