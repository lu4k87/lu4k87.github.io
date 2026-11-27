# Features: Level 1 and Level 2 (built)

What the platform offers businesses and what the data model and backend do for it. Since 2026-11-26 the plan follows the working specification in `CONTENT/`:

| Source | Content |
|---|---|
| `CONTENT/KreiswertS_Backend_Functionality.xlsx` | 21 Level 1 requirements (L1-001 … L1-021), 11 Level 2 requirements, page register (PG-01 … PG-28), decisions (D01 … D20), plastics dictionary, safeguards (X-01 … X-10), 64 planned tests |
| `CONTENT/KreiswertS_Page_Tree.pdf` | Page tree, material catalogue, main navigation, user journeys |
| `CONTENT/KreiswertS_User_Scenarios.pdf` | 4 walkthroughs with the fictional sites A, B and C – the acceptance test of Level 1 |
| 6 wireframes in `CONTENT/` (JPEG) | Structure of create offer, offer detail, material categories, data structure |

**Level 1 is an offers-first clickable prototype:** a verified site publishes material offers, other verified sites find them in their own industrial park or in a wider radius, read the details and contact the supplier. Only **Plastics** is enabled; the material model is generic. Independent requests, matching, negotiation, exchanges, feasibility and impact are **Level 2** (built on 2026-11-27, see below).

All company data is fictional demo data. Nothing in the prototype is a real offer, contract or saving.

## Level 1 at a glance

| ID | Function | Pages | Backend |
|---|---|---|---|
| L1-001 | Site registration: company → site → account | `/register`, `/register/site`, `/account` | `POST /api/registration/site` |
| L1-002 | Login, logout, password recovery | `/login`, `/forgot-password`, `/reset-password` | Better Auth (`/api/auth/*`) |
| L1-003 | Site verification by an administrator | `/admin/verification`, `/account` | `GET /api/admin/sites`, `POST /api/admin/sites/[id]/verification` |
| L1-004 | Dashboard and ownership | `/dashboard`, `/my-offers` | `GET /api/my/offers`, `GET /api/my/enquiries` |
| L1-005 – 010 | Publish an offer: material, properties, availability, price, delivery, evidence | `/my-offers/new`, `/my-offers/[id]/edit`, `/my-offers/[id]/preview` | `POST /api/my/offers`, `PUT /api/my/offers/[id]`, `POST …/publish` |
| L1-011 | Edit an offer with stale-edit detection | `/my-offers/[id]/edit` | `PUT /api/my/offers/[id]` (`expectedRevision`) |
| L1-012 | Close an offer (idempotent), renew an expired one | `/my-offers` | `POST …/close`, `POST …/renew` |
| L1-013 – 015 | Search in the own park, widen to a radius, result cards | `/offers` | `GET /api/offers` |
| L1-016 | Offer detail | `/offers/[id]` | `GET /api/offers/[id]` |
| L1-017 | Contact supplier (enquiry + one response) | `/offers/[id]`, `/dashboard` | `POST /api/offers/[id]/enquiries`, `POST /api/my/enquiries/[id]/response` |
| L1-018 | Company directory and site profile | `/companies`, `/sites/[id]` | `GET /api/sites`, `GET /api/sites/[id]` |
| L1-019 | Interactive industrial map with the list filters | `/map` | `GET /api/map` |
| L1-020 | Public interactive regional map and overview (also the start page map) | `/regional-map`, `/` | `GET /api/public/map` |
| L1-021 | Synthetic demo cases A–E, provenance labels | `/about`, all listing views | seed (`npm run db:seed -- --demo`) |
| PG-16 | Reference data (catalogue, units, parks) | `/admin/reference-data` | `GET /api/catalogue`, `POST /api/admin/categories/[id]` |
| PG-02, PG-28 | About, help, contact, legal placeholders | `/about`, `/help` | – |

## Roles and the verification gate (D01, D03)

```text
guest ──register──▶ member without site ──site step──▶ member, site pending ──admin verifies──▶ member, site verified
                                                                └──admin declines──▶ member, site declined
```

| Who | May |
|---|---|
| Guest | Public pages and the public projection (`/api/public/map`) only |
| Member without a site | Finish the registration (company + site) |
| Member, site **pending** | Edit the own site profile, create and edit **drafts** (a listing published earlier cannot be changed while the site is under review) |
| Member, site **verified** | Publish, search, open offers, the map, the directory, send and answer enquiries |
| Member, site **declined** | Read the own profile and offers, close own listings; no editing, no publishing, no contact |
| Administrator | Verify or decline sites (with a note), switch a material category on or off, read the platform; has no site and cannot publish |

- **One account belongs to one physical site** (`auth_users.site_id`, unique). Several sites can share one company (same VAT ID).
- **The role and the site are set on the server only** (`input: false` in Better Auth). No request can set `role`, `siteId` or a verification status of its own site.
- **Verification is about identity, not about material quality:** a verified site with a self-declared grade shows both statuses side by side.
- **Duplicate claims** (same company and same normalised address as an existing site) stay `pending`, carry a reference to the existing site and are resolved by the administrator. The answer of the registration does not say whether an address is already registered.
- **A VAT ID is only a claim until verification:** a pending site sees nothing of the company's other sites, and the name of a company becomes binding with its first verified site. After the site step an account can no longer change its company name or VAT ID.
- Every status change of a site is a row in `site_verification_events` (who, when, from → to, note).

## Data model

Defined in `src/server/db/schema.ts`; the login tables of Better Auth are in `auth-schema.ts`.

```text
companies ─┬─▶ sites ─┬─▶ offers ─┬─▶ offer_delivery_options
           │          │           ├─▶ offer_attribute_values ──▶ attribute_definitions
industrial_parks ─────┘           ├─▶ offer_revisions (history)
                                  └─▶ enquiries (from site → to site)
auth_users ──▶ sites (1 : 1)      site_verification_events
material_categories ─┬─▶ material_types          units ──▶ category_units
                     ├─▶ material_forms          demo_cases (A–E, simulated pathways)
                     └─▶ attribute_definitions
```

| Table | Content |
|---|---|
| `companies` | Name, VAT ID (unique when given) |
| `industrial_parks` | Name, city, approximate centre, radius, source note, provenance |
| `sites` | Company, branch name, industry, address, park (optional), coordinates (optional – unknown stays `NULL`), contact, capabilities, verification status + reviewer + time + note, duplicate reference, visibility switches, provenance |
| `material_categories` · `material_types` · `material_forms` | Catalogue; a category is `enabled` or not. Types and forms belong to a category |
| `units` · `category_units` | Unit, dimension (mass, count, volume, area), factor to the base unit; permitted units per category |
| `attribute_definitions` | Per category: key, names, data type, unit, limits, forms it applies to, flags `required` / `critical`, `required_with` (e.g. test conditions when a melt flow rate is given) |
| `offers` | Owner site, status, title, description, category/type/form, origin, legal status, waste code, quantity + unit, minimum lot, frequency + period + expected quantity, dates, price fields, logistics fields, evidence fields, provenance, `revision` |
| `offer_delivery_options` | One row per accepted arrangement: EXW, FCA, DAP, DPU or custom, with named place and Incoterms version for formal terms |
| `offer_attribute_values` | The values entered for an offer; no row = unknown |
| `offer_revisions` | Snapshot of every saved state with actor and status – history and stale-edit evidence |
| `enquiries` | Offer, sending site, receiving site, topic, message, one optional response |
| `site_verification_events` | Audit trail of verification |
| `demo_cases` | The five illustrative cases A–E with pathway label; always marked as simulated |

The former tables `users` and `agreements` of the 2026-11-18 diagram are gone: Better Auth owns the logins, and agreements belong to Level 2.

### Generic material model (L1-006, D04, X-06)

`category → type → form → attribute definitions → offer attribute values`. Nothing in the offer table is specific to plastics. A new category is data: rows in the catalogue tables plus its attribute definitions. The seed contains **Metals as a disabled category with its own attributes** to prove this; publishing in a disabled category is rejected.

Data types of attribute definitions:

| Type | Stored as | Example |
|---|---|---|
| `number` | value + optional comparator (`<`, `≤`, `≥`, `>`) | contamination `< 1 %`, melt flow rate `0.8 g/10 min` |
| `range` | minimum + maximum (one value allowed) | particle size `3–6 mm` |
| `integer` | value | unit count |
| `text` | text | grade, coating |
| `enum` | one of the configured values | layer structure |

- **Unknown is `NULL`, never 0.** An explicit 0 or `false` is kept.
- Attributes flagged `critical` appear on the detail page as “unknown” when empty; empty optional attributes are hidden.
- Changing the form removes values that no longer apply; the form asks before it does.
- Simplification: polymer fractions of mixed plastics are free text for now, not a validated list.

## Offer rules

### Lifecycle (D05)

```text
draft ──publish──▶ active ──close──▶ closed
                     │  ▲
        expiry date  ▼  │ renew (validated again)
                  expired ──close──▶ closed
```

- Stored statuses: `draft`, `active`, `closed`. **Expired is derived:** `active` and `expires_at` in the past (`effectiveOfferStatus`). No background job is needed.
- Default validity 30 days (1–90 selectable). Renewal runs the publish validation again and sets a new expiry date.
- Closing is idempotent, keeps the offer under My offers, removes it from search and map and disables contact. **Closing never records an exchange.**
- A draft may be incomplete (only a title is required). It becomes active only when `publishProblems` returns no problem.

### Quantity and units (L1-007)

- Quantity is positive and uses a unit permitted for the category (plastics: kg, t, item).
- Minimum lot and expected recurring quantity use the offer's unit; the minimum lot may not exceed the current stock.
- **Current stock and expected future output are separate fields** and are shown separately.
- Only kg and t are converted into each other. Mass, count, volume and area are never converted across dimensions.

### Price (L1-008, D06)

| Mode | Amount | Who pays |
|---|---|---|
| `fixed` | required, > 0 | requester |
| `negotiable` | optional indicative amount | requester |
| `quotation` | none – shown as “on enquiry”, never as €0 | – |
| `free` | explicit 0 | – |
| `paid_recovery` | required, > 0 | **offerer** pays for the recovery |

Currency EUR; VAT basis net, gross or unspecified; the entered price unit is kept. €400/t is shown with its equivalent €0.40/kg; an item price is never turned into a mass price. Prices are indicative, not a contract.

### Delivery (L1-009, D07)

| Arrangement | Loading | Transport | Unloading |
|---|---|---|---|
| EXW | requester | requester | requester |
| FCA at the offerer's premises | offerer | requester | requester |
| DAP | offerer | offerer | requester |
| DPU | offerer | offerer | offerer |
| Custom collection or recovery | by arrangement (free text, **not** an Incoterm) |

Formal terms need a named place and the version (Incoterms 2020). EXW, FCA and custom count as **collection**, DAP and DPU as **delivered** – the search filter uses this. The labels are plain-language responsibilities, not a legal certification.

### Evidence (L1-010, D09 fallback)

Metadata only: evidence status (self-declared, document provided, tested, unknown), datasheet available (to members or on enquiry), photographs available, sample available (yes, no, unknown). **No file upload and no file storage.** Offer images are illustrations per material form and labelled as such.

### Visibility (D08, D12)

| Field group | Guest | Verified member | Owner |
|---|---|---|---|
| Public projection: park names, sites that chose to be named, simulated pathways; material categories for the region as a whole and only from three named sites on | ✅ | ✅ | ✅ |
| Offer: title, classification, quantity, price, delivery, attributes, evidence | – | ✅ | ✅ |
| Supplier: company, branch, park, city, capabilities | – | ✅ | ✅ |
| Supplier contact (name, email, phone) | – | only if the site allows it | ✅ |
| Street address of a site | – | – | ✅ (and the administrator) |
| Drafts, revision history | – | – | ✅ |
| Enquiries | – | sender and receiver site only | – |

Each projection is built on the server as its own allow-list (`src/server/dal/offer-view.ts`, `src/server/dal/map.ts`); nothing is hidden only in the browser.

## Search and map (L1-013 – L1-015, L1-019, D10)

- **Local first:** the search starts with active offers of sites in the searching site's park. If the park is unknown, the page asks for an area (park) or a radius; it never guesses.
- **Search wider area** keeps every filter and adds sites within the chosen radius (5–100 km), sorted by distance. It is offered with zero, some or unsuitable local results. It never creates a request.
- **Distance is the straight line** between the two sites (`distanceKm`) and labelled as such. Without coordinates the distance is unknown; those offers stay in the list, marked “no location”, and the map says how many are missing.
- List and map use the same query and the same filters: category, type, form, origin, frequency, collection or delivery, minimum quantity.
- **The map is a real, interactive map** (user decision 2026-11-27, replaces F2): MapLibre GL JS with the vector tiles and the "Positron" style of OpenFreeMap – zoom, pan, full screen, scale, popups; no key and no account. Park areas, the search radius and pathways are map layers; sites are focusable markers (`live-map.tsx`, geometry in `geo.ts`). Scroll-zoom needs Ctrl/⌘ (two fingers on touch), so the page keeps scrolling. Loading the map sends the viewer's IP address to the tile server – the pages say so. Without WebGL or tile server the page shows a notice; the list under the map always repeats what the map shows.
- Ceiling: distances are computed in the application for up to 1,000 candidate offers. Beyond a few thousand active listings move the radius filter into SQL.

## Enquiries (L1-017, D11)

A verified site sends a private enquiry about one active offer of another site: topic (quotation, sample, collection, specification, other) and message. The supplier answers once. The enquiry carries the listing reference (`KW-000123`), changes neither stock nor status and creates no demand record. Limits against misuse: 5 enquiries per offer and sender per day, 30 per sender per day – counted under a lock, so parallel requests cannot pass them. Ceiling: the inbox shows the newest 200 enquiries of a site without paging.

## Demo data and provenance (L1-021, D13)

- `npm run db:seed` writes the reference data (catalogue, units, parks) and is safe to repeat. `npm run db:seed -- --demo` adds the fictional sites with logins, listings and the cases A–E; `--reset-demo` first removes the demo records and the test registrations made with the demo e-mail domain.
- Demo logins: `site_a` … `site_e` share the password `DEMO_PASSWORD`, `admin_demo` has its own `DEMO_ADMIN_PASSWORD`. Put both into `.env.demo` (ignored by Git) to keep them across re-seeds; otherwise random ones are generated and printed once.
- Every fictional site and listing carries `provenance = 'synthetic'` and shows the label on cards, detail, profile and map.
- The cases A–E are **illustrative pathways**: A PC sheets (direct reuse), B PE film (pooled recycling), C PC residues (specialist recycling), D PVC profiles (sorting and grinding), E mixed packaging (unresolved). They are never counted as completed exchanges; the prototype has no counter for confirmed exchanges or savings at all.
- Park positions are approximate centres taken from public descriptions and marked as such – verify them before real use.

## Decisions

Taken by the user on 2026-11-26:

| No. | Decision |
|---|---|
| F1 | New sites are pending; a demo administrator verifies them. Pending sites may edit their profile and drafts only. Three verified demo sites are seeded |
| F2 | ~~An own drawn map, no tile server~~ – replaced on 2026-11-27 by the user: interactive MapLibre map with OpenFreeMap tiles, also on the start page |
| F3 | Built in this repository; tests run against the database `kreiswerts_e2e` on an own port |
| F4 | Evidence as metadata plus illustrations; no upload |

Derived from the sources while building – open for review:

| Topic | Choice |
|---|---|
| Registration | Two requests behind one form: Better Auth creates the account, `POST /api/registration/site` creates company and site. An account without a site can only finish the registration |
| Coordinates of a new site | Unknown until the administrator enters them at verification (no geocoding service) |
| Expired offers | Derived from the expiry date instead of a stored status |
| Admin and listings | The administrator may read offers, map and directory, but cannot publish or enquire |
| Password recovery | Single-use link, valid 30 minutes, same answer for every address; without a mail provider the link is written to the server log |
| Legal notice, privacy, terms | Labelled placeholders – the team supplies the real texts |
| Reference data page | Read-only apart from switching a category on or off; other changes go through the seed |
| Industry | Stored per site, not per company – a branch can do something else than the head office |
| Login name | Fixed after sign-up (a logged-in account cannot probe which names exist by renaming itself) |
| “Today” in date rules | The calendar day in Germany (`Europe/Berlin`), not in UTC |
| Verification list | One status per page (the waiting sites first), newest first, 50 per page |

## Safeguards (X-01 … X-10)

| Rule | Where |
|---|---|
| Ownership and role checked on every private route | `src/server/access.ts`, every function in `src/server/dal/` |
| Foreign keys, positive quantity, permitted unit, catalogue combination, attribute validation | `schema.ts` constraints + `publish.ts` |
| Stale edits rejected | The revision sent by the browser must equal the one just read (`requireCurrentRevision`), and the write is applied to exactly that revision (`UPDATE … WHERE revision = <read>`), HTTP 409 otherwise – what was validated is what gets changed |
| Names cannot look alike | Text fields reject control characters and every invisible format character (`validation/common.ts`) |
| Limits hold under parallel requests | Enquiry limits are counted and written under a row lock of the sending site |
| Audit trail | `offer_revisions`, `site_verification_events` |
| Public data as an allow-list | `publicMap()` in `dal/map.ts` |
| Structured errors with a request ID, no internals | `src/server/http.ts` |
| Cross-site requests rejected on writes | Origin check + JSON-only bodies in `http.ts` |

## Checks

| Check | Command | Covers |
|---|---|---|
| Unit tests | `npm run check` | Rules, validation, access, projections, form state, map geometry, volume aggregation – named after the test register (AT-L1-…, NT-L1-…, AT-L2-…) |
| Acceptance run | `node scripts/e2e-level1.mjs`, `node scripts/e2e-level2.mjs` and `node scripts/e2e-map.mjs` (header of the files: how to start the test instance) | The four user scenarios, ownership, the verification gate, registration, password recovery, expiry, and one check per finding of the security review – against an own instance and the database `kreiswerts_e2e`; the script refuses any other target |
| Layout | `layout_audit.py` per page at 1440, 768 and 360 px | Overlap, overflow, type scale, spacing |

### Security review of 2026-11-27

Reviewed before the first commit; every finding has a test. Fixed: publishing could be bypassed by an edit racing the publish (revision lock), enquiry limits could be passed by parallel requests (row lock), an unverified VAT ID claim could name a company and list its sites, the verification list was cut off after 500 sites, attribute maps and history snapshots were unbounded, a declined site could still change its profile, one demo password also opened the administrator login, another session survived a password change, the public map could reveal the activity of a single named site, the acceptance script could be pointed at a working database, look-alike names with invisible characters.

Accepted for the prototype and documented: the password reset link goes to the server log (no mail provider), sign-up reveals whether a username or e-mail is taken, the login rate limit is shared by all clients, the enquiry inbox has no paging.

### Security review of Level 2 (2026-11-27)

No critical or high finding, no IDOR, no SQL injection. Fixed, each with a check in `scripts/e2e-level2.mjs`: responses had no daily limit (now 30 per sending site and day, counted under a row lock like enquiries), a response racing a close or edit could land on a closed request or name an outdated revision (the request row is now share-locked and checked again inside the insert transaction), the match overview was unbounded (now 20 candidates per own listing, the rest counted), responders saw the revision numbers of a competitor's request (now only "answered an earlier version"), request drafts had no ceiling (now 50 per site).

Open for later: the same draft ceiling for offers (Level 1 pattern), a daily ceiling for saved revisions.

## Level 2, part 1 (built 2026-11-27): requests and explained matching

Decided by the user on 2026-11-27: build requests (PG-17 – PG-20) and matching (PG-21, PG-22) first, extend the data model in this repository, build in the style of the Level 1 pages without a preview round.

| ID | Function | Pages | Backend |
|---|---|---|---|
| L2-001 | Publish a material request without referring to an offer: accepted types and forms, origin, quantity and smallest batch, timing, technical criteria, price ceiling, preferred delivery | `/my-requests/new`, `/my-requests/[id]/edit`, `/requests/[id]` (owner: publish) | `POST /api/my/requests`, `PUT /api/my/requests/[id]`, `POST …/publish` |
| L2-002 | Browse open requests: own park first, wider area with the same filters | `/requests`, `/requests/[id]` | `GET /api/requests`, `GET /api/requests/[id]` |
| L2-003 | Respond to a request once, optionally pointing at an own active offer; the requester replies once | `/requests/[id]`, `/my-requests` | `POST /api/requests/[id]/responses`, `POST /api/my/responses/[id]/reply` |
| L2-004 | Manage requests: edit with history and stale-edit detection, close as fulfilled or withdrawn, renew, delete a draft | `/my-requests`, `/requests/[id]` | `PUT /api/my/requests/[id]`, `POST …/close`, `…/renew`, `DELETE /api/my/requests/[id]` |
| L2-005 | Explained matching: request against offer, criterion by criterion, four results, no score | `/matches`, `/matches/[requestId]/[offerId]`, “Compatibility” on `/requests/[id]` and `/offers/[id]` | `GET /api/matches`, `GET /api/matches/[requestId]/[offerId]` |
| L2-009 (part) | Preparation steps and possible processors (verified sites declaring the capability) on the comparison page | `/matches/[requestId]/[offerId]` | inside `getMatch()` |

### Data model

```text
requests ─┬─▶ request_types ──▶ material_types        sites ──▶ requests (owner)
          ├─▶ request_forms ──▶ material_forms
          ├─▶ request_criteria ──▶ attribute_definitions
          ├─▶ request_revisions (history)
          └─▶ request_responses (from site → to site, optional offer, answered revision)
```

- Same lifecycle as offers (D05): `draft → active → closed`, expired derived from `expires_at`, renewal validates again. A closed request carries `closure_reason` = `fulfilled` or `withdrawn` (a database rule enforces it). Closing records no exchange.
- **Criteria** per attribute: numbers as an accepted range (either bound open), enum and text as one accepted value; each marked `required` or `preferred`. Criteria are offered for the attributes of the accepted forms; the test conditions of an MFR are an offer detail, not a criterion.
- **Responses:** one per site and request (unique index). The referenced offer must be the responder's own active offer (422 `NOT_OWN_OFFER` otherwise). The response stores the request revision it answered; the requester's list marks responses to an older version. Only the two sites can read a response.
- Matches are **not stored**: every result is computed from the current request and offer, so an edit on either side changes it at once.

### Matching rules (D15, `matching.ts`)

| Criterion | Hard or preference | Rule |
|---|---|---|
| Category | hard | must be equal |
| Material type | hard | listed → met · `unknown` → unknown · `mixed` → processing (sorting) · other → failed |
| Form | hard | listed → met · a documented route (sheet, component, film → regrind by grinding; regrind → granulate by regranulation) → processing · other → failed |
| Origin | hard | listed → met · unknown → unknown · other → failed |
| Quantity | hard | the batch reaches the smallest accepted lot (masses converted, other dimensions unknown); the offerer's minimum lot must not exceed the need |
| Timing | hard | available before the requested end, collectable after the requested start |
| Evidence, sample | hard | weaker or missing evidence → unknown (never failed); a refused sample fails |
| Technical criteria | as marked | numbers by interval (inside → met, outside → failed, partly → unknown); enum equal or failed; free text: contained → met, otherwise unknown (text cannot prove a mismatch) |
| Recurring supply, price ceiling, delivery | preference | reported next to the result only; free material and paid recovery are below any ceiling, “on enquiry” is unknown |

Result: any failed requirement → **incompatible**; else any processing → **processing required** (steps named); else any unknown → **conditional**; else **compatible on declared data**. A preference never changes the result. Lists show only pairs that are not incompatible and count the others.

### Decisions derived while building – open for review

| Topic | Choice |
|---|---|
| German term | “Gesuch” for a request, so it is never confused with “Anfrage” (an enquiry about an offer) |
| Navigation | Level 2 navigation of the page tree: Materialangebote, Materialgesuche, “Meine Inserate” with tabs My offers · My requests · Matches; Create request next to Create offer |
| Preview of a request | The owner's view of `/requests/[id]` is the preview: it lists what is missing and carries the Publish button |
| Free-text criteria | No automatic failure, only “unknown” – review by people |
| Processors | Verified sites that declare the capability, nearest to the offer first – candidates, not acceptances |
| Ceiling | Matching compares up to 1,000 candidates per own listing in the application |

## Level 2, part 2 (built 2026-11-27): negotiations and exchanges

Decided by the user on 2026-11-27: build PG-23 – PG-26 now; the freight-adjusted comparison (L2-007) and the circularity overview (PG-27) come later; the data model may be extended in this repository.

| ID | Function | Pages | Backend |
|---|---|---|---|
| L2-006 | Proposals with immutable revisions: quantity, payment direction, price, VAT basis, delivery arrangement with named place (Incoterms® 2020 for formal terms), transport organiser, freight (amount, estimated / quoted / confirmed, who pays, offerer's share when shared), delivery window, technical acceptance conditions, validity. Counterproposal, accept, decline, withdraw | `/negotiations`, `/negotiations/new`, `/negotiations/[id]`; “Propose terms” on `/matches/[requestId]/[offerId]` and on responses that name an offer | `GET`/`POST /api/my/negotiations`, `GET /api/my/negotiations/[id]`, `POST …/revisions`, `…/accept`, `…/decline`, `…/withdraw` |
| L2-011 | Exchange of an agreed negotiation: planned → completed or cancelled, planned date, received quantity and date, quality check, history | `/exchanges`, `/exchanges/[id]`, “Exchange” on `/negotiations/[id]`, counts on `/dashboard` | `POST /api/my/negotiations/[id]/exchange`, `GET /api/my/exchanges`, `GET`/`PUT /api/my/exchanges/[id]`, `POST …/complete`, `…/cancel` |

### Data model

```text
offers ◀── negotiations ──▶ requests (optional)          sites ──▶ negotiations (offerer, requester)
              ├─▶ proposal_revisions (insert only: one row per proposal, terms + validity)
              └─▶ exchanges ──▶ proposal_revisions (the accepted one)
                     └─▶ exchange_events (history)
```

- **Parties come from the server:** the owner of the offer is the offerer. If the viewer owns the offer, the request names the requester (an open request of another verified site); otherwise the viewer is the requester and a request given must be its own open one. A site never negotiates with itself. At most one **open** negotiation per offer and requesting site (partial unique index).
- **Revisions are only inserted** – a counterproposal is a new row, the earlier one stays as it was (AT-L2-006). Pending, superseded, accepted, declined, withdrawn and expired follow from the negotiation row; the page marks the terms each revision changed.
- **Who may do what (D16):** only the counterpart of the current revision accepts, declines or counters; its author can withdraw. Every decision carries the revision the page showed – an outdated one is a 409 `STALE`. An expired proposal cannot be accepted (409 `PROPOSAL_EXPIRED`); either site may then propose anew or withdraw. Accepting locks the terms (`agreed` is final). The negotiation row is locked during each change, so an accept and a counter at the same moment cannot both win.
- **Exchange (L2-011):** only for an agreed negotiation (409 `NOT_AGREED`), one per negotiation, linked to the accepted revision by a foreign key. Both sites can move the date or cancel with a reason; only the receiving site (the requester) records received quantity, date and quality check, which completes it. Cancelling records no delivery.
- **Simulated records (D13, X-05):** a negotiation is `simulated` when the offer, the request or either site (the viewer's own included) is demo data; the exchange copies the flag. Only a completed, non-simulated exchange whose material was not rejected counts as a verified outcome (`countsAsVerifiedOutcome()`); the exchange list counts simulated completions separately. Closing a listing or contacting a supplier never creates an exchange.
- **Not binding:** accepting records agreed terms only – no contract, no payment, no technical approval of the material, no collection. The pages say so.
- **Receipt:** an accepted receipt needs a quantity above 0 and a date between the agreement and today; only a completion with received material counts as an outcome.
- **Limits:** 20 new negotiations per site and day (checked before and inside the transaction), 40 revisions per negotiation, 50 changes per exchange, lists show the newest 200, the exchange history the newest 100 entries.
- Status flows: `negotiationFlow` and `exchangeFlow` in `status.ts` (they replace the cooperation flow prepared earlier); rules in `negotiation.ts`.

### Decisions derived while building – open for review

| Topic | Choice |
|---|---|
| Navigation | As in the page tree: negotiations and exchanges are reached through the dashboard (counts and two cards) with tabs Negotiations · Exchanges; no new item in the main navigation |
| Entry points | “Propose terms” on the match comparison and on responses that name an offer; an open negotiation of the same pair is linked instead |
| Decline | Ends the negotiation; a counterproposal is the way to keep talking |
| Expiry | No background job: an open negotiation whose current proposal ran out shows as expired |
| Listing closed later | Accepting, countering and proposing anew need the offer (and the request) still open and the other site still verified (security review 2026-11-27); declining and withdrawing stay possible; an exchange of terms already agreed continues |
| German terms | “Fassung” for a revision, “Austausch” for an exchange |
| Demo data | Two simulated negotiations: C and D still negotiating (HDPE offcuts), B and A agreed with a planned exchange (stretch film) |

## Level 2: requests on the map and volume aggregation (built 2026-11-27)

Decided by the user on 2026-11-27 together with the interactive map: build the rest of Level 2; this part belongs to the industrial map (PG-13).

| ID | Function | Pages | Backend |
|---|---|---|---|
| L2-002 (map) | Open requests of other sites on the industrial map: same area, category, type, form and frequency as the offer search; origin, delivery and minimum quantity are offer fields and filter offers only | `/map` (square markers, list per site) | `GET /api/map` → `requests` |
| L2-010 | Feedstock volume aggregation: compatible batches of the current search added up as a potential collection group | `/map` → "Collection groups", highlight on the map (`?group=`) | `GET /api/map` → `aggregation` |

Rules of the aggregation (`aggregation.ts`, D19):

- **Compatible** = same material type and same form; mixed types or forms are never grouped (counted as excluded).
- Only active listings; closed and expired ones drop out; an offer counts once.
- **Current stock and recurring supply stay apart:** the expected quantity per period is shown next to the total, never added to it.
- Only masses are summed (kg); a batch in items or without a quantity stays in the group but outside the total.
- Potential totals only: nothing is reserved, booked or routed. The page shows groups of two or more batches; the API returns every group.
- Demo data: two HDPE sheet batches (80 kg at Site D, 200 kg at Site C) form a group of 280 kg.

## Level 2, part 3 (built 2026-11-27): economic feasibility, environmental assessment, circularity overview

Decided by the user on 2026-11-27: build directly in the style of the existing pages without a preview round; emission factors as demo factors, each one labelled "example value, not sourced"; the data model may be extended in this repository.

| ID | Function | Pages | Backend |
|---|---|---|---|
| L2-007 | Economic feasibility: delivered cost for the requester and net proceeds for the offerer on one quantity and price, freight shared by percent, the viewer's own costs (fixed or per unit, each estimated / quoted / confirmed), processing yield, private baseline, contribution and break-even | "Economic feasibility" on `/matches/[requestId]/[offerId]`, "Commercial comparison" on `/negotiations/[id]` | `PUT /api/my/assessments` |
| L2-008 | Comparative environmental assessment: existing route against the proposed one for the same quantity, reference displacement, transport-only apart from the lifecycle comparison, every factor with unit, version, geography, boundary and source | "Environmental assessment" on `/matches/[requestId]/[offerId]` | `PUT /api/my/assessments`, `POST /api/my/assessments/[id]/approve`, `GET /api/impact-factors` |
| PG-27 | Company circularity overview: exchanges (realised apart from simulated) and the released environmental assessments, demo records summed apart | `/impact`, card on `/dashboard` | `GET /api/my/impact` |

### Data model

```text
sites ──▶ assessments ──▶ offers, requests (match) or negotiations       impact_factors (key + version, example flag)
            inputs (validated JSON), status draft | approved, revision, simulated
```

- **One private assessment per site, kind and subject** (unique `site_id, kind, subject_key`; subject = a match or a negotiation). Every query filters by the viewer's site: the other site never sees the baseline, the own costs or the result. Access to the subject uses the same rules as its page (`getMatch()`, `getNegotiation()`), so a site outside the pair gets a 404.
- **Results are computed on every read**, never stored – the pure modules `feasibility.ts` and `environment.ts`. Saving needs the revision the page showed (409 `STALE` otherwise); at most 500 assessments per site.
- **Factors** (`impact_factors`): a stored version never changes; a new value is a new version. The seed adds nine example factors (virgin PE/PP/PC/PVC, sorting, grinding, regranulation, incineration, truck transport), all `example = true` and shown as "example value, not sourced".

### Rules (D17, D18, D13)

| Topic | Rule |
|---|---|
| Common basis | Match: the viewer's assumptions, suggested from the listings (the need in the offer's unit, at most the batch; price and payment direction from the price mode; "delivered price" when the offer includes delivery). Negotiation: the current or agreed proposal – price quoted while open, confirmed once agreed |
| Freight | One amount per shipment on top of the price, split by the offerer's share; a delivered price takes no extra freight (422 `FREIGHT_ALREADY_INCLUDED`, NT-L2-007). AT-L2-007: 500 kg at €400/t with €80 freight shared equally → offerer €160, requester €240 before other costs |
| Unknown | A missing price, freight amount, cost, yield or baseline gives no total – never 0; a price per item against a quantity in kg is not comparable (no total) |
| Contribution, break-even | Offerer: net proceeds after own costs + today's route cost; requester: today's material cost for the usable quantity − delivered cost. Break-even = fixed costs (incl. own freight share) ÷ margin per unit, **only for a positive contribution** |
| Cost status | The weakest status of all inputs used: estimated < quoted < confirmed |
| Environment | Existing = today's treatment + its transport + the virgin material bought instead (reference displacement = quantity × yield × substitution, AT-L2-008: 500 kg × 90 % × 80 % = 360 kg). Proposed = preparation + transport + treatment of the residue. Transport-only is shown apart |
| No claim | Without the existing route (baseline) or a factor there is no comparative CO₂e result; a factor with the wrong unit or boundary for its step (422 `FACTOR_MISMATCH`) or a quantity that is not a mass (422 `UNIT_NOT_MASS`) is refused (NT-L2-008). Example factors make every result "illustrative" |
| Release | Only a comparative result can be released for the overview (422 `INCOMPLETE`); every new save returns it to draft |
| Overview | Realised = completed, non-simulated, not rejected exchanges (`countsAsVerifiedOutcome()`); released assessments are estimates, never a realised saving; assessments of demo listings are summed apart (D13) |

### Security review of part 3 (2026-11-27)

No finding: ownership per site, access to the subject, stale edits, the ceiling of 500 and the input bounds held. Two hardenings applied: the demo rule (D13) of an assessment also looks at both sites, like negotiations; stored inputs are read through their Zod schema again (a row that no longer fits counts as missing – check in `scripts/e2e-level2.mjs`), and the overview sums every released assessment instead of the newest 200. Found while testing: a request now records its closing time when the row really changes (`clock_timestamp()`), so a response written just before the close never shows a later time – the race check of part 1 had failed once on this. Accepted for the prototype: no daily limit for saves (a save overwrites, no history grows), no delete (the ceiling only affects the own site), quantities are self-declared – limit them to the batch before any result becomes public.

### Decisions derived while building – open for review

| Topic | Choice |
|---|---|
| Freight in the break-even | Counted as fixed (one shipment); preparation costs per unit scale with the quantity |
| Combined chain benefit | Not shown: it needs the private inputs of both sites (the internal payment would cancel out) |
| Pre-consumer vs post-consumer | The origin of the offer is shown as listed and never relabelled; the assessment does not change it |
| Factor suggestion | Transport factor and the virgin material of the offer's polymer are preselected; "no preparation" when the match needs no step |
| Navigation | `/impact` is reached through a card on the dashboard, like negotiations and exchanges |

## Level 2: not built

Signed payments and integrated payment, contract execution, sourced emission factors, combined chain benefit of both sites.

Level 2 is not a dependency of Level 1: the four scenarios end without a demand record.

## Adding a feature

1. Row in “Level 1 at a glance” (or the Level 2 list) and a short section here.
2. Does it have a flow → add it to `status.ts` with a test. Does it need data → `schema.ts`, then `npm run db:push`.
3. Implement it following `src/app/api/offers/route.ts`: route → viewer → Zod → Data Access Layer → Drizzle.
4. Update the table in [`docs/FRONTEND.md`](FRONTEND.html) §10 and rebuild the architecture page.
