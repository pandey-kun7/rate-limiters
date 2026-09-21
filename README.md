# ratty

> Drop-in Express rate-limiting middleware with 5 swappable algorithms. Pick one at runtime, hammer it, watch it hold.

![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=nodedotjs&logoColor=white) ![Express](https://img.shields.io/badge/Express-5.x-000000?logo=express&logoColor=white) ![License](https://img.shields.io/badge/license-ISC-blue)

```bash
npm install
npm start
```

Press `1-5` to select algorithm. Open `http://localhost:8000`.

| # | Algorithm | Strategy |
|---|-----------|----------|
| 1 | Token Bucket | Burst capacity + refill on tick |
| 2 | Sliding Window Log | Exact timestamps in rolling window |
| 3 | Leaky Bucket | FIFO queue, constant drain |
| 4 | Fixed Window Counter | Counter reset every window |
| 5 | Sliding Window Counter | Weighted prev + curr window estimate |

Default budget: **3 req / 10s**.

## Rate limit options

When you start the server it asks you to pick a number from 1 to 5. Each one is a different way of deciding when to say "slow down":

- **Token Bucket** — you get a small bucket of tokens. Every request spends one. Tokens slowly come back over time, so quick bursts are fine but you can't go full speed forever.
- **Sliding Window Log** — remembers exactly when your last few requests came in. If you've made too many in the last 10 seconds, you wait.
- **Leaky Bucket** — requests line up in a queue and get let through one at a time at a steady pace. Great for smoothing out sudden spikes.
- **Fixed Window Counter** — simply counts how many requests came in, then resets the count every 10 seconds. Simple and strict.
- **Sliding Window Counter** — like the counter above, but smarter about requests near the edge of the window so one unlucky burst doesn't punish you unfairly.

Everything runs on the same default budget: **3 requests per 10 seconds**.

## Normal vs priority requests

There are two kinds of requests:

- **Normal** — the everyday kind. If you're over the limit, you get turned away with a "too many requests" page. Try the light button in the demo, or hit `/api/normal`.
- **Priority** — the VIP lane. If you're over the limit, instead of being turned away you're put in a waiting line and let through shortly after. Try the dark button in the demo, or hit `/api/priority`.

## How each limiter decides

No matter which option you pick, the idea is the same: requests within the budget go straight through, requests over it get stopped. The only difference is how "the budget" is counted:

- **Token Bucket** — Got a token left? You're in. Out of tokens? Normal requests get stopped, priority ones wait in line until a token comes back.
- **Sliding Window Log** — Too many recent timestamps? Stopped. Otherwise you're in.
- **Leaky Bucket** — Room in the queue? You join the line and get served in order. Queue full? Stopped (unless you're priority, then you get a separate waiting line).
- **Fixed Window Counter** — Counter full for this window? Stopped. Otherwise you're counted and let in. Count resets every few seconds.
- **Sliding Window Counter** — Estimates your load across the current and previous window. Under the estimate? You're in. Over it? Stopped.

```bash
curl -i http://localhost:8000/api/normal
curl -i -H "Priority: 1" http://localhost:8000/api/priority
```

## Usage

Use it like any Express middleware:

```js
import { rateLimiter } from "./middleware/rateLimiter.js";

app.use("/api", rateLimiter, apiRouter);
```

Right now the 1-5 choice comes from the terminal prompt when the server starts.

When you're over the limit you get a `429` page telling you to slow down. Allowed requests also carry headers showing how much budget is left.

## Config

Limits live in one file — `middleware/rateLimiter.js`. Defaults are 3 requests per 10 seconds everywhere. Bump the numbers there if you want a looser or stricter setup.

```text
ratty/
├── middleware/rateLimiter.js   # all 5 algorithms
├── routes/serve.route.js       # demo routes
├── controllers/serve.controller.js
├── public/html/index.html      # demo UI
├── public/err/rate-limited.html
└── index.js                    # boot + 1-5 prompt
```

## Notes

Limits are kept in memory on one server, shared across everyone (not per user). Good enough for demos and learning, not for production.

ISC License.

