# Features: implementation plan

What the platform should offer businesses and what the data model and backend need for it. Basis: the team's idea list from 2026-11-19 (6 features) and the proposal (`CONTENT/KreiswertS_Proposal.pdf`). More features will follow → section “Adding a new feature”.

As of 2026-11-19: only the concept and the status flows (`src/server/domain/status.ts`) are prepared. Endpoints are built only when a feature is up next.

## Overview

| No. | Feature | By 2027-01-10 | New in the data model |
|---|---|---|---|
| 1 | Map + search, notifications | yes | `alerts` (saved search) · `notifications` |
| 2 | Offer + demand, match reasons | yes | **Demand** (`requests` or a type column, open) |
| 3 | Organise cooperation | yes | columns in `agreements` · `agreement_events` |
| 4 | Material tracking (containers) | planned only | `containers` · `container_events` |
| 5 | Network overview | yes | nothing, but needs demand from no. 2 |
| 6 | Impact | yes | nothing, only type `numeric` for CO₂ factors |

## One pattern for all flows

Cooperation (3) and containers (4) follow the same pattern; overview (5) and impact (6) only read from it:

```text
Record with status ──▶ change only as the flow allows (status.ts) ──▶ every change as a row in the history (*_events)
                                                                         └──▶ overview, impact, timeline in the UI
```

- **Status values** are defined once in `status.ts` (lower case, `snake_case`, ≤ 20 characters) → database, API, tests and UI use the same values.
- **History** (`*_events`: who, when, from → to, note) instead of only the current status → timeline, analytics, traceability.
- **Who may make which change** (buyer/seller) is checked by the Data Access Layer, not by the user interface.

## 1 Map + search

- **Filters:** material type (`materials.id`/`category`), quantity, distance, availability (`offers.availableFrom`, `status`), price (visible to members only).
- **Distance:** haversine formula in SQL over `sites.latitude/longitude`. That is enough for one region; PostGIS is only needed for many thousands of sites.
- **Notification** (“PE film within 10 km”): table `alerts` (site, material or category, radius in km, minimum quantity). When an offer is created, the backend checks which `alerts` match → entry in `notifications` (shown in the app). Sending e-mails is a later step.
- **Planned:** `GET /api/offers?…&maxDistanceKm=&near=<siteId>` (extension) · `GET/POST/DELETE /api/alerts` · `GET /api/notifications`.

## 2 Offer + demand

- **Demand is missing from the data model** → clarify with the database owners (see “Open database questions”).
- **Match reasons** (“material fits · 7 km · quantity is enough”): pure function `matchReasons(offer, request)` in the backend, no table of its own → testable on its own, reasons can be extended.
- **“Material fits”:** first the same material or the same category. A compatibility table (e.g. PE-LD ↔ PE-HD) is added only if the team provides it from the domain side.

## 3 Cooperation

Status (in `status.ts`, column `agreements.status`):

```text
requested ──▶ negotiation ──▶ agreed ──▶ in_progress ──▶ completed
    │              │             │            │
    └──────────────┴─▶ rejected  └────────────┴─▶ cancelled
```

- `rejected` = request declined (only before agreement) · `cancelled` = aborted (until completion) → overview and impact count only `completed`.
- **Present:** quantity, price, `buyerConfirmedAt`/`sellerConfirmedAt` (both set → `agreed`), `actualQuantityKg`, `completedAt`.
- **Missing:** pickup date (`pickup_date`), material quality (`quality_notes`, later maybe classes) · history `agreement_events`, also for counter-offers during negotiation.

## 4 Material tracking (planned, not in the prototype)

```text
collected ──▶ sorting ──▶ processing ──▶ available ──▶ reserved ──▶ delivered ──▶ reused
```

- Tables `containers` (identifier, material, quantity, site, optional `agreement_id`) + `container_events` (status changes with place and time).
- Implementation later: add the flow to `status.ts`, create the tables; the rest follows the pattern above.
- In the prototype at most as a simple status list of a cooperation.

## 5 Network overview

Queries only, no new tables: active offers and demands · unmatched materials (offer/demand without an open cooperation) · most requested materials (demands + `alerts` per material).

## 6 Impact

- Reused quantity = sum of `actualQuantityKg` of all `completed` · avoided disposal = the same quantity (an assumption, mark it as such in the report) · CO₂ = quantity × `impactFactorUsed`.
- Filter by year via `completedAt`; the factor is fixed at completion, later changes to the catalogue do not change old values.

## Open database questions (for the database owners)

Adds to the list in the README:

1. **Demand:** a separate table `requests` (site, material, quantity, period, maximum price, status) or one table `listings` with `type = offer/request`? Recommendation: a separate table, because of separate fields and simpler matching and counting.
2. **Status values** of `agreements.status` as above (7 values) → enforce as a `CHECK` rule or PostgreSQL `ENUM`.
3. **`agreements`:** columns `pickup_date`, `quality_notes`; table `agreement_events` for the history.
4. **`alerts`** + **`notifications`** for notifications.
5. **Types:** `impact_factor_*` and `agreed_price_eur_per_kg` as `NUMERIC` (today `INTEGER`; €0.40/kg would be lost).
6. **Later:** `containers` + `container_events` (no. 4).

## Adding a new feature

1. Row in “Overview” + a short section here (what, data, logic, open points).
2. Does it have a flow → flow in `status.ts` + test; does it need data → item under “Open database questions”.
3. Implement it following the pattern in `src/app/api/offers/route.ts`: route → login → Zod → Data Access Layer → Drizzle.
