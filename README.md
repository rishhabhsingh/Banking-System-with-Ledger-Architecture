# Ledger Bank

Double-entry banking app (MERN). Every transfer is an atomic debit + credit in an immutable ledger;
money is integer paise; payments are idempotent.

## Run locally

**Option A - Docker (easiest, includes a MongoDB replica set):**
```
docker compose up --build
docker compose exec api npm run seed      (once)
```
Open http://localhost:3000

**Option B - Node + MongoDB Atlas:**
```
cd backend
npm install
copy .env.example .env        (fill MONGO_URI and JWT_SECRET)
npm run seed                  (once)
npm run dev
```
```
cd frontend
npm install
npm run dev                   (http://localhost:5173, proxies /api to :3000)
```

## UPGRADING an existing database (important)
Balances are now stored on each account (fast reads) instead of being summed from the ledger on every request.
Existing accounts need a one-time backfill, otherwise they show Rs 0 until then:
```
cd backend
npm run reconcile             (reports mismatches)
npm run reconcile -- --fix    (rebuilds stored balances from the ledger)
```
Run `npm run reconcile` any time to prove stored balances equal the ledger (also in Admin > Integrity).

## Features
- Register/login (HTTP-only cookie, revocable sessions), rate limiting, helmet CSP
- Multiple accounts, 12-digit account numbers, recipient confirmation, recent recipients
- Review-then-confirm transfers, printable receipt, retry-safe (idempotency keys)
- Statements: filters, running balance, **CSV export** (formula-injection safe), **email me a statement**
- **Scheduled statement emails** (weekly/monthly, in Settings). Multi-instance safe (DB claim per user+period)
- Balance charts, dark mode, mobile layout
- Admin: reversals, freeze/close accounts, ledger reconciliation
- Ops: structured JSON logs with request IDs, /api/health + /api/ready, graceful shutdown, Docker, CI

## Tests
`cd backend && npm test`. Pure tests always run. Ledger tests (race conditions, idempotency, reversal, immutability,
reconciliation) run when `MONGO_URI_TEST` points at a throwaway replica-set database. They DROP that database.

## Email
Off by default (`EMAIL_ENABLED=false`, emails are just logged). To enable: Gmail App Password in `EMAIL_PASS`
+ `EMAIL_USER`, `EMAIL_ENABLED=true`. Email can never crash or block the API.

## Security checklist before going live
Rotate any secret that was ever shared; `NODE_ENV=production`; `ALLOW_DEMO_FUNDS=false`; strong `SYSTEM_PASSWORD`
and `JWT_SECRET` (32+ chars); Atlas network access limited to your host. See DEPLOY.md.
