# Deploying

The Docker image contains the API **and** the built React app, so one service = one URL. No CORS, and the
login cookie stays first-party.

## 1. Database: MongoDB Atlas
1. Create a free M0 cluster (transactions require a replica set; Atlas has one).
2. Database Access: create a user with a strong password.
3. Network Access: Render free instances have changing IPs, so add 0.0.0.0/0 (safe only with a strong DB password).
4. Copy the connection string: `mongodb+srv://USER:PASS@cluster.xxxx.mongodb.net/ledger?retryWrites=true&w=majority`
   (URL-encode special characters in the password).

## 2. Host: Render (Blueprint)
1. Push this folder to GitHub (make sure `.env` is NOT committed).
2. Render > New > Blueprint > select the repo (uses `render.yaml`).
3. Fill `MONGO_URI` and `SYSTEM_PASSWORD` when prompted. `JWT_SECRET` is generated for you.
4. Seed the system account ONCE from your own computer (Render's free plan has no Shell). In `backend/.env` put your
   Atlas `MONGO_URI` and the same `SYSTEM_EMAIL` / `SYSTEM_PASSWORD` you gave Render, then run `npm run seed`.
   For a public portfolio demo also set `ALLOW_DEMO_FUNDS=true` on Render, otherwise new visitors have no money to try
   transfers with (it's demo money only, capped at Rs 50,000 per top-up).
5. Visit the URL, register, and log in with the system user to reach /admin.

Railway / Fly.io / any Docker host work the same: build the root `Dockerfile`, set the env vars from
`backend/.env.example`, health check `/api/ready`.

## 3. Turn on email (optional)
Set `EMAIL_ENABLED=true`, `EMAIL_USER`, and `EMAIL_PASS` (Gmail App Password). Users then enable weekly/monthly
statements in Settings.

## Scaling notes
- **Stateless API**: sessions are JWT + a revocation list in MongoDB, so run as many instances as you like behind a load balancer.
- **Hot path is O(1)**: balances are stored on the account and updated in the same transaction as the ledger;
  reads never scan the ledger. `reconcile` proves they agree.
- **No double-spend**: the debit is one conditional atomic update; concurrent writers retry.
- **Scheduler is safe on N instances**: each (user, period) is claimed by a unique index, so exactly one sends.
  Set `SCHEDULER_ENABLED=false` on instances that shouldn't run it.
- **Rate limiter is per-process memory**: with several instances, use a shared store (Redis) for exact global limits.
- Indexes exist for ledger (account, _id), transactions (initiatedBy, key), and a TTL for revoked tokens.
- Beyond this: read replicas for statements/reports, a job queue for email at large volume, and moving the
  statement CSV to streaming for very large histories (currently capped at 20,000 rows per statement).

## Free-tier behaviour to expect
Render free web services sleep after ~15 minutes idle; the first request then takes 30-60 seconds. Open the URL
yourself shortly before showing it to anyone. The statement-email scheduler also only runs while the service is awake.
