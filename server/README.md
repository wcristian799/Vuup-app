# VUUP API Server

Hono-based REST API for the VUUP ride/delivery platform.

## Stack

- **Runtime**: Node.js 22+ / TypeScript (ESM)
- **Framework**: Hono v4 + @hono/node-server
- **Database**: SQLite via `better-sqlite3`
- **Auth**: JWT (HS256) via `jose` — short-lived access tokens (15 min) + refresh tokens (30 days)
- **Validation**: Zod

## Quick start

```bash
# Install dependencies
npm install

# Copy env template and set secrets
cp .env.example .env
# Edit .env: set AUTH_SECRET to a random 32+ char string

# Seed the database with representative data
npm run seed

# Start dev server (hot reload)
npm run dev
```

Server starts on `http://localhost:3001` by default. Override with `PORT=<n>`.

## Environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `AUTH_SECRET` | **Yes** (prod) | fallback dev string | HMAC secret for JWT signing — use a random 32+ char string in production |
| `DB_PATH` | No | `./data/vuup.db` | SQLite file path. Use `:memory:` for ephemeral/test databases |
| `PORT` | No | `3001` | HTTP port |
| `NODE_ENV` | No | — | Set to `production` to enable strict OTP verification |

**Never commit real secrets.** Use environment variables or a secrets manager.

## Database

### Schema / migrations

Schema is created automatically on server startup via `src/db/database.ts`. The `db.exec()` block uses `CREATE TABLE IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS`, so it is safe to run on every boot — missing tables and indexes are created, existing ones are unchanged.

### Seed script

```bash
npm run seed
```

Populates the database with representative data:
- 5 users: passenger (Ana), driver (Carlos), founder (Roberto), motoboy (Mario), admin
- 5 wallets with seeded balances
- 2 sample transactions
- 1 completed ride
- 1 patron link (Ana -> Carlos)
- 2 safety events
- 1 carpool route
- 2 coupons (`VUUP10` — 10% off, `PRIMEIRAVIAGEM` — R$5 fixed)

Seed is idempotent (`INSERT OR IGNORE`) — safe to re-run.

### In-memory mode (tests)

Set `DB_PATH=:memory:` to use a fresh in-memory SQLite database. The `vitest.config.ts` sets this automatically so every test run starts clean.

## npm scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled build |
| `npm test` | Run all tests (in-memory DB) |
| `npm run typecheck` | Type-check without emitting |
| `npm run seed` | Seed the database |

## API routes

All routes except `/health` and `/auth/*` require `Authorization: Bearer <access_token>`.

### Auth
| Method | Path | Description |
|---|---|---|
| POST | `/auth/otp-request` | Request OTP for phone (dev: logs to console) |
| POST | `/auth/login` | Verify OTP, issue JWT pair, auto-create user on first login |
| POST | `/auth/refresh` | Exchange refresh token for new access token |
| POST | `/auth/logout` | Revoke refresh token |

### Users
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/users/me` | any | Current user profile |
| PATCH | `/users/me` | any | Update name / avatar |

### Rides
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/rides/fare-estimate` | any | Fare quote (no ride created) |
| GET | `/rides/nearby-drivers` | any | Available drivers near a point |
| POST | `/rides` | passenger | Request a ride |
| GET | `/rides` | any | List caller's rides (paginated) |
| GET | `/rides/:id` | any | Ride detail + VIP window state |
| PATCH | `/rides/:id/cancel` | passenger | Cancel ride |
| PATCH | `/rides/:id/status` | driver | Advance ride state machine |

State machine: `searching -> accepted -> driver_en_route -> in_progress -> completed / cancelled`

### Wallet
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/wallet` | any | Balance + pending |
| GET | `/wallet/transactions` | any | Transaction history (paginated) |
| POST | `/wallet/transfer` | any | Transfer to another user's wallet |

### Deliveries (Motoboy)
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/deliveries` | any | Create delivery job |
| GET | `/deliveries` | any | Caller's deliveries |
| GET | `/deliveries/open` | motoboy | Available pending deliveries |
| GET | `/deliveries/:id` | any | Delivery detail |
| PATCH | `/deliveries/:id/status` | motoboy | Advance delivery state |

State machine: `pending -> accepted -> picked_up -> in_transit -> delivered / failed`

### Campaigns and Coupons
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/campaigns` | founder/admin | Create campaign |
| GET | `/campaigns` | any | List own campaigns (admin: all) |
| GET | `/campaigns/:id` | owner/admin | Campaign detail |
| PATCH | `/campaigns/:id/status` | owner/admin | Update status |
| POST | `/campaigns/:id/coupons` | owner/admin | Issue coupon for campaign |
| GET | `/campaigns/:id/coupons` | owner/admin | List campaign coupons |
| POST | `/coupons/validate` | any | Validate coupon code |

### Safety (Escudo)
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/safety/events` | any | Community safety feed |
| POST | `/safety/events` | any | Report event |
| POST | `/safety/events/:id/upvote` | any | Upvote event |
| POST | `/safety/sos` | any | Trigger emergency SOS |

### Carpool
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/carpool/routes` | any | Active carpool routes |
| GET | `/carpool/routes/:id` | any | Route detail |
| POST | `/carpool/routes` | driver | Create route |
| POST | `/carpool/routes/:id/join` | any | Join a seat |

### Patron driver
| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/patron` | any | Caller's patron links |
| POST | `/patron` | passenger | Set patron driver |
| PATCH | `/patron/:id` | passenger | Update label |
| DELETE | `/patron/:id` | passenger | Deactivate link |
| GET | `/patron/passengers` | driver | Passengers who have caller as patron |

## Auth notes

- Access tokens expire in 15 minutes
- Refresh tokens expire in 30 days and are stored in the DB for revocation
- In dev/test mode any 6-digit numeric OTP is accepted
- Role-based authorization is enforced per route (see route docs above)
