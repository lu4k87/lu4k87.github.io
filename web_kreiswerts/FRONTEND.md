# Frontend guide: building on the Level 1 platform

For everyone who adds or changes pages. Level 1 – accounts, offers, search, map, directory, administration – is built as a clickable prototype (state 2026-11-27). This page shows where pages go, how they get data and the viewer, how texts work in German and English, and which pages and endpoints exist.

In short: **one Next.js project for everything.** Pages live in `src/app/`, components in `src/components/`. Data comes only through the functions of the Data Access Layer or `/api/*`, never straight from the database.

## 1. Getting started

1. Set up the project as described in the README “Run locally” (Node.js ≥ 20.9, PostgreSQL, `.env`, `npm run db:push`, `npm run db:seed -- --demo`).
2. `npm run dev` → <http://localhost:3000>. Always open exactly this address, not `127.0.0.1` or the IP: login checks the origin against `BETTER_AUTH_URL`. The dev server listens on your own computer only.
3. Try it with the demo logins: `site_a` publishes an offer, `site_b` finds it with “Search wider area” and sends an enquiry, `admin_demo` verifies `site_e`.
4. Sources: the wireframes and the specification in `CONTENT/`, the plan in [`docs/FEATURES.md`](FEATURES.html).

## 2. Where things are

| Folder | Contents |
|---|---|
| `src/app/(platform)/` | Pages of the company platform; `layout.tsx` = header + frame, `gate.tsx` = who may open a page |
| `src/app/about/`, `regional-map/`, `help/`, `login/`, `register/`, … | Public pages (own header via `SiteHeader`) |
| `src/components/ui/` | Building blocks: `elements.tsx` (page header, section card, notice, badge, facts list, buttons), `form.tsx` (field, input, select, checkbox), `icons.tsx` |
| `src/components/layout/` | Headers, navigation, footer, language switch, `links.ts` (all routes) |
| `src/components/offers/` | Offer card, detail view, form, live preview, search filters, formatting |
| `src/components/map/` | The interactive map (`live-map.tsx`, MapLibre + OpenFreeMap, client component), its geometry (`geo.ts`) and the marker look shared with legends (`marker-style.ts`) |
| `src/i18n/` | UI texts: `messages.ts` (start, login, register), `platform.ts` (platform) |
| `src/app/api/` | Endpoints (route handlers) |
| `src/server/` | Login, access rules, validation, business rules, database |
| `src/lib/` | Helpers for client components: `api-client.ts`, `auth-client.ts`, `auth-errors.ts` |

Always import with `@/` instead of `../../`. Routes are never typed as strings in pages: use `ROUTES`, `offerPath(id)`, `sitePath(id)` from `@/components/layout/links`.

## 3. What a page may use

| Allowed | Use for |
|---|---|
| `@/server/dal/*` (functions) | Data in server components – every function takes the viewer and checks access itself |
| `fetch("/api/…")` via `apiRequest()` | Writes and live data in client components |
| `platformPage(need, path)` from `(platform)/gate.tsx` | The viewer of a platform page + the redirect or notice for everyone who may not open it |
| `@/server/validation/*`, `@/server/domain/*` | Schemas, value lists and rules – pure modules, usable in the browser too |
| `@/lib/auth-client` → `authClient` | Register, log in, log out, password reset in the browser |
| **Never:** `@/server/db/*` | Direct database access – bypasses the access rules |

- If the build reports `"server-only" cannot be imported from a Client Component`, server code was pulled into a file with `"use client"` → use `apiRequest()` there. Type-only imports (`import type { … }`) are fine anywhere.
- **The server decides what a viewer may see and do**, not the UI. Hiding a button is not protection: every write is checked again in the Data Access Layer, and a field that is missing from a response is not allowed for that viewer.

## 4. Fetching data: two ways

**Rule of thumb:** reading (lists, details) → server component. Interactive (form, button) → a small client component that handles only that part.

### a) Server component (default)

No loading state, the session is read on the server. Filters come from the URL through a plain `<form method="get">`, so every search can be linked and “Search wider area” is the same URL with another `scope`.

```tsx
// src/app/(platform)/offers/page.tsx (shortened)
import { searchOffers } from "@/server/dal/offers";
import { offerSearchQuery } from "@/server/validation/offers";
import { ROUTES } from "@/components/layout/links";
import { platformPage } from "../gate";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function OffersPage({ searchParams }: Props) {
  const page = await platformPage("browse", ROUTES.offers); // guest → login · no site → /register/site
  if (page.blocked) return page.blocked;                     // e.g. "your site is waiting for verification"
  const parsed = offerSearchQuery.safeParse(await searchParams);
  const query = parsed.success ? parsed.data : offerSearchQuery.parse({}); // invalid filter → no filter
  const result = await searchOffers(page.viewer, query);
  return <ul>{result.offers.map((offer) => <li key={offer.id}>{offer.title}</li>)}</ul>;
}
```

`platformPage(need, …)`: `"account"` any login with a site · `"site"` a company site (not the administrator) · `"browse"` verified site or administrator · `"admin"` the administrator.

### b) Client component via `/api/…`

```tsx
"use client";
import { apiErrorText, apiRequest, problemsByField } from "@/lib/api-client";

const result = await apiRequest<{ id: number }>("POST", `/api/offers/${offerId}/enquiries`, { topic, message });
if (!result.ok) {
  setFields(problemsByField(result.error.fields)); // { message: "INVALID" } → sentence via fieldErrorText()
  setError(apiErrorText(result.error, t.errors));  // one sentence in the UI language
}
```

`apiRequest()` never throws: a failure comes back as `{ ok: false, error: { code, status, fields, reason } }`. After a successful write call `router.refresh()` so the server components show the new state. Every list has three states: filled, **empty** (`EmptyState`) and **error** (`Notice tone="error"`).

## 5. German and English (DE/EN)

- **No visible text hard-coded in components.** All labels, buttons, hints, error and empty states are in `src/i18n/messages.ts` and `src/i18n/platform.ts`, with the same keys for `de` and `en`; TypeScript reports a missing key.
- Value lists (origin, price mode, delivery term, status …) are keyed by the values of `src/server/domain/listing.ts`: `t.platform.labels.origin[offer.origin]`.
- **Content from the database is shown as stored** (offer titles, company names). Names of the material catalogue exist in both languages: `nameOf(item, locale)`.
- **Numbers, prices, dates, distances** through `makeFormatters(locale, t, units)` in `src/components/offers/format.ts` – the same wording in cards, detail and preview. Unknown stays the word “unknown”, never `0`.
- **Default language: German**; English must be complete. Plan for long German words: check both languages at the narrowest width.
- The switch is in the header (`language-switch.tsx`, cookie `locale`). Server components read `const locale = await getLocale()` and pass `t` (and `locale`) down to client components as props.
- No invisible characters in source files (a no-break space looks like a space): write them as ` ` inside strings. `python3 scripts/escape-invisible.py` converts them.

## 6. Who sees and may do what

The viewer comes from the session (`getViewer()` → guest, member with the current state of the site, or administrator). Rules: [`docs/FEATURES.md`](FEATURES.html#roles-and-the-verification-gate).

| Viewer | Pages |
|---|---|
| Guest | Public pages; every platform page redirects to `/login?next=…` |
| Account without a site | Redirected to `/register/site` |
| Site, pending | Dashboard, My offers (drafts), account; search, map and directory show a notice instead |
| Site, verified | Everything of the company platform |
| Site, declined | Dashboard, My offers (read, close), account (read) |
| Administrator | Dashboard, verification, reference data, and read access to offers, map, directory |

What a member sees of another site: company, branch, park and city, capabilities, the offer itself – never the street address, and the contact only if that site shows it (`supplier.contact` is then `null`).

## 7. Login, registration, account

- `/login` – username or email + password, “remember me”; `?next=/path` returns to the page a guest came from (`safeNextPath()` only accepts paths inside the app).
- `/register` (account + company) → `/register/site` (physical site). The new site is pending until the administrator verifies it.
- `/forgot-password` → `/reset-password?token=…` – without a mail provider the link is written to the server log.
- `/account` – verification status, company, site, profile and visibility, password, logout.

| Task | Call (browser) |
|---|---|
| Register | `authClient.signUp.email({ name, username, email, password, companyName, vatId, materialInterest })`, then `apiRequest("POST", "/api/registration/site", …)` |
| Log in | `authClient.signIn.email({ email, password, rememberMe })` or `signIn.username(…)` |
| Log out | `authClient.signOut()` – `SignOutButton` does it and returns to the start page |
| Reset password | `authClient.requestPasswordReset({ email, redirectTo })` · `authClient.resetPassword({ newPassword, token })` |
| Change password | `authClient.changePassword({ currentPassword, newPassword })` – ends the other sessions |
| Show an error | `authErrorText(error, locale)` – also covers “too many attempts” (HTTP 429) |

Password: 8 to 128 characters with a digit and a capital letter. Form fields carry `autoComplete` (`email`, `username`, `current-password`, `new-password`).

## 8. Showing status

Status values are defined once in `src/server/domain/status.ts`; the texts are in `t.platform.labels`:

| What | Values | Text |
|---|---|---|
| Offer | `draft`, `active`, `expired` (derived from the expiry date), `closed` | `labels.offerStatus[offer.status]` |
| Site verification | `pending`, `verified`, `declined` | `labels.verification[status]` |
| Fictional data | `provenance === "synthetic"` | `Badge` “Demo” + `t.common.synthetic` |

A status is always written as a word (`Badge`), never shown by colour alone. Which buttons a state offers is decided on the page (`OfferActions`); whether the action is allowed is decided by the server.

## 9. Styling (Tailwind CSS v4)

- Tokens (colours `canvas`, `surface`, `ink`, `muted`, `line`, `brand`, `mint`, `map`, `notice`, `danger`; font Inter) are in `src/app/globals.css` – reuse them before adding new ones.
- Page background is white (`surface`); `canvas` (warm beige) is only for inset panels and fields inside cards.
- Longer paragraphs in columns of at least 45 characters (page intros, section intros, map notes) use `prose-justify`: justified with hyphenation, left-aligned below 480 px.
- Map colours are tokens too (`map-offer`, `map-request`, `map-both`, `map-park`, `map-radius`, `map-flow`), shared by the map layers, the markers and the legend. `<LiveMap interactive>` (only `/map` and `/regional-map`, not the start page) adds the layer bar, "show all", park hover and subtle motion: markers rise in once, a selected marker pings once, material flows along the pathways; all off with reduced motion.
- Type scale: 13 px (notes) · 15 px (body) · 18 px (h3) · 22 px (h2) · 28–32 px (h1). Small notes that can wrap use `leading-normal`.
- Layout: flex and grid with `gap`; grid tracks `minmax(0, 1fr)` and `min-w-0` on text columns so nothing overflows at 360 px; cards in a row get `items-start` when their content differs. Every scroll area carries `scroll-thin`.
- Reuse `PageHeader`, `Section`, `Notice`, `Badge`, `Facts`, `EmptyState`, `Field`, `TextInput`, `Select`, `Choice` instead of new one-off markup.
- **Light and dark** (user, 2026-11-27): every colour token has both values via `light-dark()` in `globals.css`; dark palette "Graphit" (neutral dark grey, green only for buttons, brand cards and map markers). Without a choice the page follows the system setting; the round button next to DE / EN (`ThemeSwitch`) stores `theme=light|dark` in a cookie like the locale, and the root layout puts it on `<html data-theme>`. So: use only tokens – no hex values, no `bg-white`; `text-white` only on `brand`, `map-offer` or `map-both`. The map itself stays light (OpenFreeMap "liberty") in both schemes, its popups and controls take the tokens.
- Markers that would cover each other on screen are spread on a small circle after every zoom (`spreadOffsets` in `src/components/map/geo.ts`, tested in `geo.test.ts`).

## 10. Pages and data: what exists

| Page | URL | Data from the backend |
|---|---|---|
| Start page | `/` | `getPlatformStats()` (verified sites, active offers, industrial parks) · `publicMap()` for the interactive hero map |
| About · help | `/about` · `/help` | `listDemoCases()`, `getCatalogue()` · legal sections are labelled placeholders |
| Public regional map | `/regional-map` | `publicMap()` · `GET /api/public/map` |
| Login · password recovery | `/login` · `/forgot-password` · `/reset-password` | Better Auth |
| Registration | `/register` · `/register/site` | Better Auth · `POST /api/registration/site` |
| Dashboard | `/dashboard` | `listMyOffers()`, `listEnquiries()`, `listMyRequests()`, `listResponses()`, `listNegotiations()`, `listExchanges()`, `getMySite()` · administrator: `listSitesForReview()` |
| Material offers | `/offers` | `searchOffers()` · `GET /api/offers` |
| Individual offer | `/offers/[id]` | `getOffer()`, `ownRequestsForOffer()` · `POST /api/offers/[id]/enquiries` |
| My offers | `/my-offers` | `listMyOffers()` · `POST /api/my/offers/[id]/publish · /renew · /close` · `DELETE /api/my/offers/[id]` |
| Create / edit offer | `/my-offers/new` · `/my-offers/[id]/edit` | `getCatalogue()`, `getMyOffer()` · `POST /api/my/offers` · `PUT /api/my/offers/[id]` |
| Preview before publishing | `/my-offers/[id]/preview` | `getOffer()`, `getPublishProblems()` |
| Company directory · site profile | `/companies` · `/sites/[id]` | `listSites()`, `getSiteProfile()`, `listActiveOffersOfSite()` |
| Industrial map | `/map` | `memberMap()` · `GET /api/map` (offers, requests, collection groups) |
| My account | `/account` | `getMySite()` · `PUT /api/my/site` · Better Auth (`changePassword`) |
| Site verification | `/admin/verification` | `listSitesForReview()` · `POST /api/admin/sites/[id]/verification` |
| Reference data | `/admin/reference-data` | `getCatalogue()`, `listParks()` · `POST /api/admin/categories/[id]` |
| Material requests | `/requests` | `searchRequests()` · `GET /api/requests` |
| Individual request | `/requests/[id]` | `getRequest()`, `listResponses()`, `ownOffersForRequest()`, `getRequestPublishProblems()` · `POST /api/requests/[id]/responses` |
| My requests | `/my-requests` | `listMyRequests()`, `listResponses()` · `POST /api/my/requests/[id]/publish · /renew · /close` · `DELETE /api/my/requests/[id]` · `POST /api/my/responses/[id]/reply` |
| Create / edit request | `/my-requests/new` · `/my-requests/[id]/edit` | `getCatalogue()`, `getMyRequest()` · `POST /api/my/requests` · `PUT /api/my/requests/[id]` |
| Matches | `/matches` | `listMatches()` · `GET /api/matches` |
| Individual match | `/matches/[requestId]/[offerId]` | `getMatch()`, `getMatchAssessments()` · `GET /api/matches/[requestId]/[offerId]` · `PUT /api/my/assessments` · `POST /api/my/assessments/[id]/approve` |
| Negotiations | `/negotiations` · `/negotiations/new?offer=&request=` · `/negotiations/[id]` | `listNegotiations()`, `getNegotiationStart()`, `getNegotiation()`, `getNegotiationFeasibility()`, `contractSummaryFor()`, `getChainView()` · `POST /api/my/negotiations` · `POST /api/my/negotiations/[id]/revisions · /accept · /decline · /withdraw · /exchange · /contract · /chain-consent` |
| Exchanges | `/exchanges` · `/exchanges/[id]` | `listExchanges()`, `getExchange()`, `getExchangePayment()` · `PUT /api/my/exchanges/[id]` · `POST /api/my/exchanges/[id]/complete · /cancel · /payments` · `POST /api/my/payments/[id]/checkout · /capture · /cancel · /refund` (simulated payment, label it “simulated” everywhere) |
| Contract | `/contracts/[id]` | `getContract()` · `GET /api/my/contracts/[id]` · `POST /api/my/contracts/[id]/sign · /void` |
| Circularity overview | `/impact` | `getImpactOverview()`, `listChainBenefits()` · `GET /api/my/impact` · factors: `listFactors()` · `GET /api/impact-factors` |

All endpoints with input and output: README “API” and the architecture page.

**A page needs data that does not exist yet:**

1. Add the feature to [`docs/FEATURES.md`](FEATURES.html) first.
2. Define the **type** of the response as an allow-list built on the server (like `OfferCard` / `OfferDetail` in `src/server/dal/offer-view.ts`).
3. Build the five stations: route (`api()` from `src/server/http.ts`) → viewer → Zod → Data Access Layer (starts with a `require…()` rule) → Drizzle. Then add the row here.

## 11. Before every commit

```bash
npm run check    # TypeScript + unit tests – must pass
npm run build    # production build – catches e.g. server/client errors
```

- A changed page is measured at 1440, 768 and 360 px before it counts as done (overlap, overflow, type scale), and looked at in German with the longest content.
- No real company or contact data: the repository is public, the prototype uses fictional demo data only.
- Never commit `.env` or `.env.demo`, never show them in screenshots.
- Agree on new npm packages first (vitest stays on 4.x).
