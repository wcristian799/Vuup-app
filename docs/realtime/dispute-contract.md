# VUUP Realtime Event Contract — Dispute & Efeito Enxame

**Version:** 1.0  
**Owner:** Realtime & Mobile Engineering  
**Last updated:** 2026-06-28  
**Related issues:** [VUU-41](/VUU/issues/VUU-41), [VUU-35](/VUU/issues/VUU-35), [VUU-13](/VUU/issues/VUU-13)

---

## Overview

VUUP uses **Server-Sent Events (SSE)** for the realtime channel. The backend
exposes three event streams:

| Stream | Endpoint | Auth | Description |
|---|---|---|---|
| Ride-scoped | `GET /matching/rides/:rideId/stream` | Bearer JWT | Dispute events for a specific ride |
| User-scoped | `GET /matching/me/stream` | Bearer JWT | Events for the current user (passenger or driver) |
| Swarm | `GET /matching/swarm/stream` | Bearer JWT | Community panic / Efeito Enxame broadcasts |

### Wire format

Each event is sent as a standard SSE named event:

```
event: <eventType>
data: <JSON payload>

```

Clients parse `event:` to dispatch to the right handler. All `data:` values
are valid JSON objects.

---

## QoS Priority

The frontend client (`DisputeWsClient`) implements a two-tier priority queue:

| Priority | Event types | Dispatch |
|---|---|---|
| **HIGH** (panic/safety) | `swarm_event_created`, `swarm_activated`, `swarm_confirmed`, `swarm_resolved` | Synchronous — called immediately on receipt |
| **NORMAL** (dispute/ride) | All other event types | Queued via `queueMicrotask` — yields to HIGH events in the same tick |

This ensures panic alerts from Efeito Enxame are never blocked by ride auction
events, even when both streams are active simultaneously.

---

## Dispute Channel Events

### Connected (both streams)

**Event:** `connected`  
**Direction:** Server → Client  
**When:** Immediately on stream open

```json
{
  "ts": "2026-06-28T12:00:00.000Z"
}
```

---

### Disputa aberta

**Event:** `disputa_opened`  
**Direction:** Server → Passenger (user stream)  
**When:** `POST /rides` creates a new ride (auto-opens dispute session)

```json
{
  "rideId": "uuid",
  "windowExpiresAt": "2026-06-28T12:00:15.000Z",
  "fareEstimateCents": 1200
}
```

**Notes:**
- `windowExpiresAt` is 15 000 ms from session creation (`DISPUTA_WINDOW_MS`)
- Passenger should display a countdown timer

---

### Bid recebido

**Event:** `bid_received`  
**Direction:** Server → Ride stream  
**When:** A driver submits a bid via `POST /matching/rides/:id/disputa/bid`

```json
{
  "driverId": "uuid",
  "distanceToOriginKm": 0.42,
  "offeredFareCents": 1100,
  "totalBids": 3
}
```

**Notes:**
- `driverId` is the platform UUID (not PII-exposing to passengers — consider masking in production)
- `distanceToOriginKm` is rounded to 2 decimal places
- `offeredFareCents` is always `<= fareEstimateCents` (price stability rule)
- `totalBids` ranges 1–5

---

### Disputa resolvida

**Event:** `disputa_resolved`  
**Direction:** Server → Ride stream + Passenger user stream  
**When:** Session fills to 5 bids, timeout expires, or cancelled

```json
{
  "rideId": "uuid",
  "outcome": "resolved",
  "winnerId": "driver-uuid"
}
```

**`outcome` values:**

| Value | Meaning |
|---|---|
| `resolved` | A winner was selected (>= 1 bid, window not cancelled) |
| `expired` | Window timed out with 0 bids |
| `cancelled` | Ride or session was manually cancelled |

**Notes:**
- `winnerId` is `null` when `outcome` is `expired` or `cancelled`
- The winning driver also receives a `ride_assigned` event on their user stream

---

### Corrida atribuída (driver)

**Event:** `ride_assigned`  
**Direction:** Server → Winning driver's user stream  
**When:** `disputa_resolved` selects a winner

```json
{
  "rideId": "uuid",
  "passengerId": "uuid",
  "fareEstimateCents": 1200
}
```

---

### Erro de disputa

**Event:** `dispute_error`  
**Direction:** Server → Client  
**When:** Unexpected server-side error in the dispute flow

```json
{
  "code": "INTERNAL_ERROR",
  "message": "Human-readable description"
}
```

---

## Efeito Enxame / The Shield Events

All swarm events are delivered on the **swarm stream** (`/matching/swarm/stream`).
Every connected client receives these broadcasts — no ride scoping.

### Evento de enxame criado

**Event:** `swarm_event_created`  
**Direction:** Server → All swarm subscribers  
**When:** `POST /matching/swarm` reports a panic or community alert

```json
{
  "id": "uuid",
  "type": "panic",
  "lat": -23.55,
  "lng": -46.633,
  "description": "Motorista em perigo",
  "confirmCount": 1,
  "swarmActive": false,
  "createdAt": "2026-06-28T12:00:00.000Z"
}
```

**`type` values:**

| Value | Meaning |
|---|---|
| `panic` | SOS / immediate danger — highest urgency |
| `community_alert` | Community reports road hazard or risk area |
| `swarm_active` | (internal) used when `swarmActive` flips to true |

**LGPD note:** `lat` and `lng` are coarsened to 3 decimal places (~111 m precision)
before leaving the server. Full-precision GPS is never persisted or streamed.

---

### Confirmação de enxame

**Event:** `swarm_confirmed`  
**Direction:** Server → All swarm subscribers  
**When:** A community member confirms an event (`POST /matching/swarm/:id/confirm`)
and `confirmCount < SWARM_THRESHOLD`

```json
{
  "id": "uuid",
  "confirmCount": 2,
  "swarmActive": false
}
```

---

### Enxame ativado

**Event:** `swarm_activated`  
**Direction:** Server → All swarm subscribers  
**When:** `confirmCount` reaches `SWARM_THRESHOLD` (3) — triggers "The Shield" UI

```json
{
  "id": "uuid",
  "lat": -23.55,
  "lng": -46.633,
  "confirmCount": 3,
  "description": "Motorista em perigo"
}
```

**Notes:**
- This is the HIGH-priority event the frontend dispatcher handles synchronously
- UI should display the community shield animation and notify nearby drivers

---

### Enxame resolvido

**Event:** `swarm_resolved`  
**Direction:** Server → All swarm subscribers  
**When:** Admin calls `POST /matching/swarm/:id/resolve`

```json
{
  "id": "uuid"
}
```

---

## REST API — Dispute & Swarm Endpoints

### Dispute

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/matching/rides/:id/disputa/bid` | Driver JWT | Submit a bid |
| `GET` | `/matching/rides/:id/disputa` | Any JWT | Get session state |
| `POST` | `/matching/rides/:id/disputa/cancel` | Passenger/Admin JWT | Cancel session |

**Bid body:**

```json
{
  "lat": -23.5506,
  "lng": -46.6334,
  "offeredFareCents": 1100
}
```

`offeredFareCents` is optional; defaults to `fareEstimateCents`.

**Session state response:**

```json
{
  "rideId": "uuid",
  "passengerId": "uuid",
  "fareEstimateCents": 1200,
  "bidsCount": 3,
  "windowOpensAt": "2026-06-28T12:00:00.000Z",
  "windowExpiresAt": "2026-06-28T12:00:15.000Z",
  "winnerId": null,
  "outcome": "open"
}
```

### Swarm / Efeito Enxame

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/matching/swarm` | Any JWT | Report a panic/alert |
| `POST` | `/matching/swarm/:id/confirm` | Any JWT | Community confirm |
| `POST` | `/matching/swarm/:id/resolve` | Admin JWT | Resolve event |
| `GET` | `/matching/swarm` | Any JWT | List active events |

**Panic body:**

```json
{
  "type": "panic",
  "location": { "lat": -23.5510, "lng": -46.6340 },
  "description": "Perigo na rua"
}
```

---

## Constants

| Constant | Value | File |
|---|---|---|
| `DISPUTA_WINDOW_MS` | `15_000` ms | `server/src/lib/matching.ts` |
| `MAX_BIDS` | `5` | `server/src/lib/matching.ts` |
| `SWARM_THRESHOLD` | `3` | `server/src/lib/matching.ts` |
| `DISPUTE_WINDOW_MS` (client) | `15_000` ms | `src/lib/disputa-corrida-ws.ts` |
| `MAX_DRIVERS` (client) | `5` | `src/lib/disputa-corrida-ws.ts` |
| `PROXIMITY_RADIUS_M` (client) | `1_500` m | `src/lib/disputa-corrida-ws.ts` |
| `ALERT_RADIUS_M` (shield) | `1_500` m | `src/hooks/use-shield.ts` |
| `MAX_SHIELD_DURATION_MS` | `1_800_000` ms (30 min) | `src/hooks/use-shield.ts` |

---

## Winner Selection Algorithm

```
1. Sort bids by distanceToOriginKm ASC (nearest first)
2. Tie-break: offeredFareCents ASC (lowest fare)
3. Tie-break: bidAt ASC (earliest bid)
```

The passenger always pays `fareEstimateCents` regardless of the winning driver's
counter-offer. Price stability is enforced by the server.

---

## Integration Notes for VUU-13 (Backend Dispute Logic)

VUU-13 owns the persistence and final settlement of dispute outcomes. The
realtime layer (VUU-35/VUU-41) is responsible for:

1. **Opening** the dispute session when `POST /rides` creates a ride
2. **Collecting** driver bids during the 15-second window
3. **Resolving** the winner and emitting events
4. **Notifying** all parties via SSE

VUU-13 should:

1. Listen for `disputa_resolved` events (or poll `GET /matching/rides/:id/disputa`)
2. Persist the `winnerId` and `fareEstimateCents` to the ride record
3. Trigger the driver assignment flow (`PATCH /rides/:id/status` to `accepted`)

**Stub backend:** If VUU-13 is not yet available, the mock server at
`POST /rides` already auto-opens a `DisputaSession` and the realtime flow
works end-to-end with in-memory state. All events emit correctly.

---

## Mobile Reconnect Behaviour (VUU-37 / Android)

The `DisputeWsClient` implements exponential backoff with jitter on reconnect:

```
delay = min(1000ms * 2^attempt, 30_000ms) + random(0, 500ms)
```

On mobile background (Android network loss):
- `EventSource.onerror` fires when the connection drops
- Client schedules reconnect via the backoff formula
- On reconnect, the `connected` heartbeat confirms the stream is live
- Swarm stream reconnects independently of the ride stream

For Android Capacitor apps, the native `@capacitor/network` plugin should be
used to trigger `client.connect()` immediately on network restoration rather
than waiting for the backoff timer.

---

## LGPD Compliance Summary

| Data | Treatment |
|---|---|
| Driver GPS (server internal) | Full precision, never logged, used only for bid ranking |
| Driver GPS (streamed to clients) | Coarsened to 3 dp (~111 m) before emission |
| Swarm event coordinates | Coarsened to 3 dp on creation |
| A/V emergency stream | Only started after explicit LGPD consent (`grantConsentAndArm`) |
| A/V stream data | In-memory only; auto-cleared on disarm or session end |
| GPS in Shield | Passed to `safety.sos()` at runtime; never persisted by the hook |
