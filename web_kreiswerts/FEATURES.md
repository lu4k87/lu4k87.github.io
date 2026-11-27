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
| Fn 41 | Deadline in the listing: label “urgent”, sort by deadline | `/offers`, `/map`, `/offers/[id]`, offer form | `GET /api/offers?sort=deadline` (card field `urgent`) |
| Fn 46 | Guide: duties of both sides, by-product or waste, course of a cooperation, sources | `/guide` (footer) | – (static) |
| Fn 19 | Saved search + in-app notice (bell) | `/offers`, `/notifications`, header | `GET/POST /api/my/saved-searches`, `DELETE …/[id]`, `GET /api/my/notifications`, `POST …/read` |

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
- Demo logins: `site_a` … `site_l` share the password `DEMO_PASSWORD`, `admin_demo` has its own `DEMO_ADMIN_PASSWORD`. Put both into `.env.demo` (ignored by Git) to keep them across re-seeds; otherwise random ones are generated and printed once.
- Every fictional site and listing carries `provenance = 'synthetic'` and shows the label on cards, detail, profile and map.
- The cases A–E are **illustrative pathways**: A PC sheets (direct reuse), B PE film (pooled recycling), C PC residues (specialist recycling), D PVC profiles (sorting and grinding), E mixed packaging (unresolved). They are never counted as completed exchanges; the prototype has no counter for confirmed exchanges or savings at all.
- Park positions are approximate centres taken from public descriptions and marked as such – verify them before real use.
- **Eleven fictional companies, twelve sites** (project goal: at least ten documented companies, added 2026-11-28). Sites A–E carry the user scenarios; F–L add further sources, takers and processors around the cases A–E – a second stretch-film source and a film collector for the pooled recycling (B), PMMA offcuts and a PC sheet request (A), a builder with PVC pipe offcuts and a PVC regrind request (D), a compounder for ABS/PS, a packaging maker with PET skeletons, an appliance maker with ABS housings and unsorted dismantling parts (E), a sorting plant outside every park. Names end in "(fiktiv)", streets and VAT IDs are placeholders. The acceptance runs count on gaps in this data (no further HDPE sheet, LDPE or PVC regrind, no PP offer); `scripts/data/records.test.mjs` guards them.

## Region data import and export (function 34, built 2026-11-28)

Another region sets the platform up with its own data – guide: [`REPLICATION.md`](REPLICATION.html).

- `npm run data:export [-- <folder>]` writes `parks.csv`, `categories.csv`, `materials.csv` (types and forms) and `sites.csv` (with company name and VAT ID) – spreadsheet CSV with byte order mark, `--delimiter ";"` for German Excel, `--skip-demo` leaves the synthetic sites out. Default folder `data-export/` is ignored by Git; files are created with mode 600 because `sites.csv` holds contact data.
- `npm run data:import [-- <folder>]` reads the files that are there, checks every row against the value lists and bounds of the app (`scripts/data/records.mjs`, same lists as `domain/listing.ts`, same address rule as the registration – a unit test compares them) and references to parks and categories, and reports each problem as `file:line column`. One problem → nothing is saved (one transaction); `--dry-run` checks only.
- Adds and updates, never deletes (exception `--prune-parks`: parks missing from `parks.csv` that no site uses). A site is the same when company (VAT ID, else name) and address match. New sites start `pending` without a login – the import never verifies; an existing site keeps its status and provenance. A category's `enabled` only counts when it is new, as in the seed.
- Formula guard (CWE-1236): a text cell starting with `=`, `+`, `-` or `@` (not a number or phone number) is written with a leading `'` and read back without it.
- Units, attributes and emission factors stay in `scripts/seed/reference.mjs`: they carry rules and sources, not just names.

## Deadline, guide, saved search (functions no. 41, 46, 19, built 2026-11-28)

Numbers of the function list `CONTENT/Functions_KreiswertS_EN.docx`; acceptance and negative tests in `scripts/e2e-functions.mjs`.

**No. 41 – deadline in the listing.** The list asked for a column `available_until`; the offer already had the field “Collection deadline” (`collection_until`) with the same meaning (“by when the material must be gone”), so it is reused – no second date that could contradict the first.
- **Urgent** = deadline today or within the next 7 days (`isUrgent`, calendar day in Germany); a past deadline cannot be published (rule `DATE_PAST`). The server sets the card field `urgent`; list, map, detail page and “My offers” show the label “Urgent / Dringend”. The form explains the rule under the date field.
- **Sort** `sort=deadline`: earliest deadline first, listings without a deadline last (newest first among them).

**No. 46 – guide.** Public page `/guide`, link in every footer, static (no backend), DE/EN in `src/i18n/guide.ts`: waste, by-product, end of waste (KrWG §§ 3–5), waste hierarchy (§ 6), duties of the supplying and the receiving company (§§ 7, 22, 53–54), the six steps of a cooperation on the platform, what the platform does not do, and links to the original texts (gesetze-im-internet.de, EUR-Lex PPWR Art. 3, 7). Marked “no legal advice” with a date.

**No. 19 – saved search + in-app notice.**
- **Data:** `saved_searches` (site, author, name, filters as JSON) and `notifications` (site, saved search, offer, read at). Both belong to a **site**: every member of the site sees and manages them, no other site ever does (every query filters by the session's site; someone else's id answers 404, marking it as read changes nothing).
- **Saving:** “Save search” under the filters of `/offers` sends the query string; the server parses it with the search schema itself (`savedSearchFilters` = search filters without sort and page size), so only filters the search knows are stored. Only a verified site can save; at most 20 per site (`TOO_MANY`, checked under a row lock).
- **Check:** when an offer is published, `matchesSavedSearch` runs the same filters as the list (park or radius, category, type, form, origin, frequency, handover, minimum kg) for every saved search of the **other verified** sites. One notice per site and offer (unique key) – two matching searches or republishing after expiry do not notify twice. The check runs after the publish transaction and never fails or undoes the publication. Offers published before the search raise no notice.
- **Showing:** the bell in the header shows the number of unread notices (server-side on every page load, no polling); `/notifications` lists the newest 50 with offer, matching search and time, “Mark all as read”, and the saved searches with “Show results” and “Delete” (deletes its notices too). A notice whose offer was closed or expired stays, labelled, without a link; offers of a site that lost its verification disappear.
- **Not yet:** e-mail (no. 20) and a setting to switch notices off.

## Decisions

Taken by the user on 2026-11-26:

| No. | Decision |
|---|---|
| F1 | New sites are pending; a demo administrator verifies them. Pending sites may edit their profile and drafts only. Eleven verified demo sites and one pending are seeded |
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
| Acceptance run | `node scripts/e2e-level1.mjs`, `node scripts/e2e-level2.mjs` (with `PAYMENT_WEBHOOK_SECRET` set for server and script) and `node scripts/e2e-map.mjs` (header of the files: how to start the test instance) | The four user scenarios, ownership, the verification gate, registration, password recovery, expiry, and one check per finding of the security review – against an own instance and the database `kreiswerts_e2e`; the script refuses any other target |
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
- **Factors** (`impact_factors`): a stored version never changes; a new value is a new version. The seed adds nine example factors (virgin PE/PP/PC/PVC, sorting, grinding, regranulation, incineration, truck transport), all `example = true` and shown as "example value, not sourced" – and, since part 4, four sourced factors (see below).

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
| Combined chain benefit | ~~Not shown~~ – built on 2026-11-27 with the explicit release of both sites (Level 2, part 4) |
| Pre-consumer vs post-consumer | The origin of the offer is shown as listed and never relabelled; the assessment does not change it |
| Factor suggestion | Transport factor and the virgin material of the offer's polymer are preselected; "no preparation" when the match needs no step |
| Navigation | `/impact` is reached through a card on the dashboard, like negotiations and exchanges |

## Level 2, part 4 (built 2026-11-27): contract, simulated payment, sourced factors, combined chain benefit

Decided by the user on 2026-11-27: build the rest of Level 2. No real payment provider – the payment is simulated but built like a real integration; a prototype first.

| ID | Function | Pages | Backend |
|---|---|---|---|
| L2-012 | Contract of an agreed negotiation: immutable snapshot of the accepted revision with a SHA-256 fingerprint, both sites sign (who and when recorded), void while a signature is missing, execution derived from delivery and payment | `/contracts/[id]`, "Contract" on `/negotiations/[id]` | `POST /api/my/negotiations/[id]/contract`, `GET /api/my/contracts/[id]`, `POST …/sign`, `…/void` |
| L2-013 | Simulated payment per exchange: amount from the signed terms, pending → authorised → captured / failed / cancelled / refunded, idempotency keys, signed provider confirmation, audit trail | "Payment (simulated)" on `/exchanges/[id]` | `GET`/`POST /api/my/exchanges/[id]/payments`, `POST /api/my/payments/[id]/checkout`, `…/capture`, `…/cancel`, `…/refund`, `POST /api/payments/webhook` |
| L2-008 (sources) | Sourced emission factors: source document, version, geography, boundary; a result loses "illustrative" only when every factor used is sourced | "Environmental assessment" on `/matches/[requestId]/[offerId]` | `GET /api/impact-factors` (`sourceUrl`, `example`) |
| L2-014 | Combined chain benefit: the offerer's and the requester's contribution added up, only from comparisons both sites released | "Combined chain benefit" on `/negotiations/[id]`, `/impact` | `GET`/`POST /api/my/negotiations/[id]/chain-consent`, `GET /api/my/impact` → `chain` |

### Data model

```text
negotiations ──▶ contracts (snapshot + hash, signatures) ──▶ contract_events
exchanges ──▶ payments (amount, lines, provider ref, keys) ──▶ payment_events (site or provider, event id once)
negotiations ──▶ chain_consents (site, assessment + revision, proposal revision)
impact_factors + source_url (required unless example)
```

### Contract

- **Snapshot:** built from the database when the contract is created – accepted revision, terms, offer, request, both parties, agreement time, demo flag. Stored once as JSON with the SHA-256 of its canonical form (sorted keys); the page recomputes it and shows whether the content is unchanged. One contract per negotiation that is not voided (partial unique index).
- **Signing:** each site once, with the fingerprint the page showed and an explicit confirmation – another fingerprint is a 409 `SNAPSHOT_CHANGED`, a stored snapshot that no longer matches its fingerprint a 409 `SNAPSHOT_DAMAGED`. User and time are recorded; the second signature makes it `signed` (final). Before that either site can void it with a reason; a new contract can then be created.
- **Status flow** `contractFlow` in `status.ts`: awaiting signatures → signed or voided. **Execution** is derived on every read (`contract.ts`): fulfilled = material arrived and not rejected + payment captured (or none due); ended without fulfilment = payment refunded, or delivery failed with nothing captured; otherwise in execution.
- **Not binding:** a confirmation inside the platform, not a qualified electronic signature – the pages say so.

### Simulated payment

- **Amount** (`payment.ts`) from the terms of the signed contract: material = price × agreed quantity (converted to the price unit; per item against kg gives no amount), plus the freight share the other site owes the transport organiser (a third-party carrier is paid directly and stays outside); both netted into one payment, so the payer can be either site. Stored in cents with its lines. The VAT basis is carried as agreed – the platform determines no tax (reverse charge is possible for plastic waste).
- **Flow** `paymentFlow`: pending → authorised (provider confirmation) or failed or cancelled; authorised → captured (only after the material arrived and was not rejected) or cancelled (by the payer, only before the receipt is recorded); captured → refunded (by the payee, with a reason). Only the payer starts and authorises. Either site captures – except a payee that recorded the receipt itself: then the payer captures, so nobody confirms their own claim.
- **Provider port** (`src/server/payments/`): `PaymentProvider` interface, `SimulatedProvider` adapter. The simulated checkout produces the signed confirmation a provider would send; it runs through the same check as one from outside.
- **Confirmation endpoint** `POST /api/payments/webhook`: no session and no Origin (server to server), instead HMAC-SHA256 over `<timestamp>.<raw body>` in `KW-Signature`, constant-time comparison, 5 minutes tolerance, 8 KB body limit, event id stored once (a replay changes nothing), amount and currency must match. Secret `PAYMENT_WEBHOOK_SECRET` (≥ 32 characters); without it a random secret per server process – the simulated checkout still works, nobody outside can sign.
- **Idempotency:** create, capture, cancel and refund carry a key the browser generates once per form; the same key returns the earlier result instead of a second operation, a key of another exchange is refused. At most one live payment per exchange (partial unique index), 20 attempts per exchange.
- **Audit trail** `payment_events`: every change with its source (site + user, or provider + event id). Every payment is `simulated`; every place in the UI says "simulated" (DE/EN).

### Sourced emission factors (D18)

Only values read from a public document on 2026-11-27; a factor without a reliable public value stays an example. The database refuses a non-example factor without an https source.

| Factor | Value | Geography · boundary | Source |
|---|---|---|---|
| Truck, all trucks ≥ 3.5 t | 0.118 kg CO₂e/tkm | Germany 2024 · transport (incl. energy supply) | UBA, "Vergleich der durchschnittlichen Emissionen einzelner Verkehrsmittel im Güterverkehr 2024", TREMOD 6.71B (10/2025) |
| Truck, articulated and road trains | 0.101 kg CO₂e/tkm | Germany 2024 · transport | same table |
| Incineration of plastic waste | 2.75 kg CO₂/kg | IPCC default · end of life | IPCC 2006 Guidelines Vol. 5, Eq. 5.1 with Table 2.4 (plastics: dry matter 100 %, carbon 75 %, fossil 100 %) and Table 5.2 (oxidation 100 %): 0.75 × 44/12; combustion CO₂ only, no energy credit |
| Virgin suspension PVC | 2.08 kg CO₂e/kg | Europe · cradle to gate | Plastics Europe / ECVM Eco-profile VCM and PVC, rev. January 2026, Table 14 (EF 3.1) |

Still examples: virgin PE, PP and PC (the eco-profiles are only available as download packages that could not be read), sorting, grinding, regranulation. A result is "illustrative" as long as one example factor is used; the forms mark each factor "sourced" or "example value" and suggest sourced ones first.

### Combined chain benefit

- **Consent:** each site releases its saved commercial comparison of the negotiation (`chain.ts`). A release names the assessment revision and the proposal revision – a new save or a counterproposal ends it (409 `STALE` / `STALE_TERMS` on an outdated release); withdrawing deletes it.
- **Result:** only when both releases are valid: offerer's contribution + requester's contribution (the payment between them cancels out), with the weaker cost status; unknown on either side gives no total, never 0. The other site sees the total, never the inputs – the release text says that it can work out the other contribution by subtracting its own.
- **Overview:** `/impact` lists the negotiations with a combined benefit (newest 20), demo pairs summed apart.

### Security review of part 4 (2026-11-27)

No critical or high finding: no IDOR, no way to `handleProviderEvent()` without a valid signature, the `external` option weakens no other route. Fixed, each with a check in `scripts/e2e-level2.mjs` or a unit test: the payer could cancel an authorised payment after the receipt was recorded, and a payee that recorded the receipt itself could capture without anyone else confirming it (CWE-841 – now `paymentActions()` and a share lock on the exchange row); contracts per negotiation were unbounded through create/void loops (now 5, counted under the negotiation lock, CWE-770); the chain overview loaded up to 50 negotiations one by one (now 20, CWE-400). Hardened: a `PAYMENT_WEBHOOK_SECRET` shorter than 32 characters stops the server instead of being replaced silently; an outdated release of the other site is shown as none (it would reveal a new private save). Found by the acceptance run while building: the database rule "a sourced factor needs a source" passed for a missing URL (NULL in a CHECK counts as passed – now `coalesce`), and the demo reset failed once payments existed.

Open for later: the snapshot is immutable by the application only – a database trigger and the hash in the `signed` event would also guard against direct database edits; `external` could require a verify function in the route frame itself.

### Decisions derived while building – open for review

| Topic | Choice |
|---|---|
| Contract per | Negotiation (one exchange per negotiation exists anyway); the payment refers to both |
| Payment timing | Can start once both signed, even after delivery; capture only after delivery |
| Netting | Material price and freight share are settled as one net payment |
| Amount basis | Agreed quantity of the signed terms, not the received quantity |
| Who captures | Either site once the delivery is recorded as accepted – not the payee if it recorded the receipt itself (security review) |
| Disputes | No automatic capture after a deadline – a payee whose payer does not capture has to ask; open for the team |
| Demo | No contract or payment is seeded; the click-through creates them on the agreed demo negotiation |

Level 2 is not a dependency of Level 1: the four scenarios end without a demand record.

## Adding a feature

1. Row in “Level 1 at a glance” (or the Level 2 list) and a short section here.
2. Does it have a flow → add it to `status.ts` with a test. Does it need data → `schema.ts`, then `npm run db:push`.
3. Implement it following `src/app/api/offers/route.ts`: route → viewer → Zod → Data Access Layer → Drizzle.
4. Update the table in [`docs/FRONTEND.md`](FRONTEND.html) §10 and rebuild the architecture page.
