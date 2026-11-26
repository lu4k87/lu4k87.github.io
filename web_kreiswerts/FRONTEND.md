# Frontend guide: building the app on the existing backend

For the frontend team. The backend (login, access rules, database, first endpoint) is already in place. This page shows where your pages go, how they get data and login state, how to prepare for German/English, and what to request from the backend.

In short: **one Next.js project for everything.** You build pages in `src/app/` and components in `src/components/`. Data comes only through the existing backend functions or `/api/*`, never straight from the database.

## 1. Getting started

1. Set up the project as described in the README “Run locally” (Node.js ≥ 20.9, PostgreSQL, `.env`, `npm run db:push`).
2. `npm run dev` → <http://localhost:3000>. Always open exactly this address, not `127.0.0.1` or the IP: login checks the origin against `BETTER_AUTH_URL`. The dev server listens on your own computer only (`next dev -H 127.0.0.1`); other devices in the network cannot open it.
3. Try it: home page → “Create account” (`/register`) → `/account` shows your session; log in again at `/login`; <http://localhost:3000/api/offers> lists offers (guest view without login).
4. Design: Figma link in `CONTENT/Figma.txt`. Planned features: [`docs/FEATURES.md`](FEATURES.html) (table for the team: `CONTENT/Functions_KreiswertS_EN.docx`).

## 2. Who works where

| Folder | Contents | Owner |
|---|---|---|
| `src/app/**/page.tsx`, `src/app/**/layout.tsx` | Pages: one folder = one URL (`src/app/offers/page.tsx` → `/offers`) | **Frontend** |
| `src/components/` | Reusable building blocks (button, card, filter …); you create the folder | **Frontend** |
| `src/i18n/` | UI texts in German and English (section 5); you create the folder | **Frontend** |
| `src/app/globals.css` | Tailwind CSS v4 + your design tokens from Figma | **Frontend** |
| `public/` | Images, icons, logos (`public/logo.svg` → `/logo.svg`); you create the folder | **Frontend** |
| `src/app/api/` | Endpoints (route handlers) | Backend |
| `src/server/` | Login, validation, access rules, database | Backend + DB |
| `src/lib/` | Helpers for both sides (`auth-client.ts`, `auth-errors.ts`) | Backend, you use them |

Suggested layout for `src/components/` (adapt it to Figma):

```text
src/components/
├── ui/        Button, Input, Card, Badge … (basic elements from Figma)
├── layout/    Header, Navigation, Footer, LanguageSwitch
└── offers/    OfferCard, OfferList, OfferFilter … (one folder per feature)
```

Always import with `@/` instead of `../../`: `import { OfferCard } from "@/components/offers/offer-card";`

## 3. What you may use from the backend

| Allowed | Use for |
|---|---|
| `fetch("/api/…")` | Data in client components (browser) |
| `@/server/dal/*` (functions) | Data in server components (page rendered on the server) |
| `@/server/viewer` → `getViewer()` | Guest or member? (server components) |
| `@/server/validation/*` | Validate inputs/filters + TypeScript types |
| `@/server/domain/status` | Status values and allowed transitions (e.g. cooperation) |
| `@/lib/auth-client` → `authClient` | Register, log in, log out, session in the browser |
| `@/lib/auth-errors` → `authErrorText()` | Login errors as a readable sentence in German or English: `authErrorText(error, locale)` |
| **Never:** `@/server/db/*` | Direct database access – bypasses the access rules |

- If the build reports `"server-only" cannot be imported from a Client Component`, you pulled server code into a file with `"use client"` → use `fetch("/api/…")` there. Type-only imports (`import type { … }`) are fine anywhere.
- **The backend decides what a guest may see**, not the UI. Hiding something in the frontend is not protection: if a field is missing from the response, that role must not see it.

## 4. Fetching data: two ways

**Rule of thumb:** reading (lists, details) → server component. Interactive (form, map, live filter) → a small client component with `"use client"` that handles only that part.

### a) Server component (default)

No loading state needed, the login cookie is read automatically. Filters come from the URL (`/offers?city=Moers`), e.g. from a plain `<form method="get">`.

```tsx
// src/app/offers/page.tsx
import { headers } from "next/headers";
import { getViewer } from "@/server/viewer";
import { listOffers } from "@/server/dal/offers";
import { offerListQuery } from "@/server/validation/offers";
import { messages } from "@/i18n/messages";
import { getLocale } from "@/i18n/locale";

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

export default async function OffersPage({ searchParams }: Props) {
  const t = messages[await getLocale()]; // language from the DE/EN switch (section 5)
  const viewer = await getViewer(await headers());
  const parsed = offerListQuery.safeParse(await searchParams);
  const query = parsed.success ? parsed.data : offerListQuery.parse({}); // invalid filter → no filter
  const offers = await listOffers(viewer, query);

  return (
    <main>
      <h1>{t.offers.title}</h1>
      <form method="get">
        <input name="city" defaultValue={query.city ?? ""} placeholder={t.offers.cityPlaceholder} />
        <button type="submit">{t.offers.search}</button>
      </form>
      {offers.length === 0 && <p>{t.offers.empty}</p>}
      <ul>
        {offers.map((offer) => (
          <li key={offer.id}>
            {offer.title} · {offer.materialName} · {offer.availableQuantityKg} kg · {offer.city}
          </li>
        ))}
      </ul>
    </main>
  );
}
```

### b) Client component via `/api/…`

For parts that should react without a page reload. The login cookie is sent automatically (same origin).

```tsx
// src/components/offers/offer-search.tsx
"use client";
import { useEffect, useState } from "react";
import type { GuestOffer, MemberOffer } from "@/server/dal/offer-view";
import type { Messages } from "@/i18n/messages";

type OffersResponse = { role: "guest" | "member"; offers: (GuestOffer | MemberOffer)[] };

export function OfferSearch({ city, t }: { city: string; t: Messages }) {
  const [data, setData] = useState<OffersResponse | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams({ city });
    fetch(`/api/offers?${params}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then(setData)
      .catch(() => setFailed(true));
  }, [city]);

  if (failed) return <p role="alert">{t.offers.loadError}</p>;
  if (!data) return <p>{t.common.loading}</p>;
  if (data.offers.length === 0) return <p>{t.offers.empty}</p>;
  return <p>{data.offers.length}</p>;
}
```

Every list needs three states from Figma: **loading**, **empty**, **error**. Show your own texts for them; do not display the backend's `error` field (it is technical and English only).

## 5. German and English (DE/EN)

The app will have a **language switch for DE/EN**. It is not built yet, but every page must be ready for it from day one:

- **No visible text hard-coded in components.** All labels, buttons, hints, error and empty states go into `src/i18n/messages.ts`, with the same keys for `de` and `en`.
- **Content from the database is not translated** (offer titles, material names, company names) – show it as delivered.
- **Numbers, prices, dates** via `Intl` with the current locale: `new Intl.NumberFormat(locale).format(1234.5)` → `1.234,5` (de) / `1,234.5` (en).
- **Default language: German** (users are local businesses); English must be complete, no gaps.
- Plan for longer German words in the layout (buttons, table headers): check both languages at the narrowest width.

Suggested dictionary without an extra library (TypeScript reports a missing key in either language):

```ts
// src/i18n/messages.ts
export const LOCALES = ["de", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "de";

const en = {
  common: { loading: "Loading …" },
  offers: {
    title: "Offers",
    search: "Search",
    cityPlaceholder: "City",
    empty: "No offers found.",
    loadError: "Offers could not be loaded.",
    loginForDetails: "Log in to see price and contact.",
  },
};

export type Messages = typeof en;

const de: Messages = {
  common: { loading: "Lädt …" },
  offers: {
    title: "Angebote",
    search: "Suchen",
    cityPlaceholder: "Stadt",
    empty: "Keine Angebote gefunden.",
    loadError: "Angebote konnten nicht geladen werden.",
    loginForDetails: "Einloggen, um Preis und Kontakt zu sehen.",
  },
};

export const messages: Record<Locale, Messages> = { de, en };
```

**The switch exists** (`src/components/layout/language-switch.tsx`, in the header): it stores the language in the cookie `locale` (`de`/`en`) and refreshes the page. Server components read it with `const locale = await getLocale()` from `@/i18n/locale` and use `messages[locale]`; they pass `t` (and `locale` for `Intl`) down to client components as props (example 4b). `<html lang>` follows the cookie (`src/app/layout.tsx`).

## 6. Guest and member

Every response says who is asking (`role`); members get more fields.

| Field (`GET /api/offers`) | Guest | Member |
|---|---|---|
| `id`, `title`, `materialName`, `availableQuantityKg`, `city` | ✅ | ✅ |
| `priceEurPerKg`, `description`, `contactName`, `contactEmail`, `contactPhone` | – | ✅ |

```ts
import type { GuestOffer, MemberOffer } from "@/server/dal/offer-view";

/** Does this offer include the member fields? */
export const isMemberOffer = (offer: GuestOffer | MemberOffer): offer is MemberOffer => "priceEurPerKg" in offer;
```

Guest view: where price/contact would be, show `t.offers.loginForDetails` with a link to the login page.

## 7. Login, registration, account

`/login` is **built per Figma** (server page `src/app/login/page.tsx` + client form `src/components/auth/login-form.tsx`): username or email + password (contains “@” → email login, else username login), “Remember me” (`rememberMe`; off = session ends with the browser), show/hide password, errors in DE/EN; logged-in members are redirected to `/account`. “Forgot password?”, “Need help?” and “Continue as a guest” link to `PLACEHOLDER_HREF` in `src/components/layout/links.ts` until those pages exist (password reset needs email sending).

`/register` is **built per Figma** (server page `src/app/register/page.tsx` + client form `src/components/auth/register-form.tsx`): company name, tax / VAT ID, material interest (fixed list `MATERIAL_INTERESTS`), username, work email, password + repeat, terms checkbox. The same rules run in the browser and on the server (`src/server/validation/registration.ts`, hook in `src/server/auth.ts`). The pellet photo is read from `public/images/pellets.jpg`; until that file exists the PET photo stands in. Shared pieces: `auth-brand-card.tsx`, `fields.tsx`.

`/account` is still a **test page without design**. Replace it according to Figma (keep the URL; it lives in `ROUTES` in `links.ts`), then delete `src/app/_test/`. Old German URLs (`/registrieren`, `/konto`) redirect via `next.config.ts`.

| Task | Call (browser) |
|---|---|
| Register | `await authClient.signUp.email({ name, email, password })` – `name`: 1–100 characters; a profile picture (`image`) is rejected |
| Log in | `await authClient.signIn.email({ email, password, rememberMe })` |
| Log out | `await authClient.signOut()` |
| Session in a client component | `const { data: session, isPending } = authClient.useSession()` |
| Show an error | `const { error } = await …; if (error) setError(authErrorText(error, locale))` – also covers “too many attempts” (HTTP 429: 3 login/sign-up requests per 10 s, shared by all visitors) |

- After login/logout call `router.refresh()` so server components see the new role (pattern: `src/components/auth/login-form.tsx`).
- Password: 8 to 128 characters (Better Auth). Form fields with `autoComplete="email"` / `"current-password"` / `"new-password"`.

Members-only page (server component):

```tsx
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getViewer } from "@/server/viewer";

export default async function MembersOnlyPage() {
  const viewer = await getViewer(await headers());
  if (viewer.role === "guest") redirect("/login");
  return <main>…</main>;
}
```

## 8. Showing status (cooperation)

Status values are defined once in `src/server/domain/status.ts`; database, API and UI use the same values. You only map text (per language) and colour – TypeScript reports a missing status:

```ts
import type { CooperationStatus } from "@/server/domain/status";
import type { Locale } from "@/i18n/messages";

export const COOPERATION_LABEL: Record<Locale, Record<CooperationStatus, string>> = {
  en: {
    requested: "Requested",
    negotiation: "Negotiating",
    agreed: "Agreed",
    in_progress: "In progress",
    completed: "Completed",
    rejected: "Rejected",
    cancelled: "Cancelled",
  },
  de: {
    requested: "Angefragt",
    negotiation: "In Verhandlung",
    agreed: "Vereinbart",
    in_progress: "Läuft",
    completed: "Abgeschlossen",
    rejected: "Abgelehnt",
    cancelled: "Abgebrochen",
  },
};
```

Which buttons a status shows (e.g. “Accept”): `canTransition(cooperationFlow, from, to)` from the same file. Whether the user may make the change is still checked by the backend.

## 9. Styling (Tailwind CSS v4)

- The tokens from the start page and login (colours `canvas`, `ink`, `muted`, `line`, `brand`, `mint` …, font Inter) are already in `globals.css` – reuse them before adding new ones.
- Define colours, fonts and spacing from Figma **once** as tokens in `src/app/globals.css`, then use the classes everywhere instead of fixed values:

```css
@import "tailwindcss";

@theme {
  --color-brand: #1f7a4d;        /* sample values → take them from Figma */
  --color-brand-dark: #145536;
  --font-sans: "Inter", system-ui, sans-serif;
}
/* → classes bg-brand, text-brand-dark, font-sans */
```

- Load fonts with `next/font` in `src/app/layout.tsx` (no external link in the HTML).
- Header, navigation and the language switch that appear on every page belong in `src/app/layout.tsx`.
- `<html lang="de">` must follow the chosen language once the switch exists.

## 10. Pages and data: what exists already

URLs are a suggestion; agree on them and update this table.

| Page | URL | Data from the backend |
|---|---|---|
| Start page | `/` | ✅ built per Figma · numbers from `getPlatformStats()` (`@/server/dal/stats`: businesses, offers) · ⏳ countries (no country column yet, `// MOCK`) · map is a static illustration (`// MOCK`) |
| Login | `/login` | ✅ built per Figma (Better Auth, remember me) |
| Register | `/register` | ✅ built per Figma · company fields + username via Better Auth (`additionalFields`, `username` plugin) |
| Account | `/account` | ✅ Better Auth · test page, replace per Figma |
| Offers: list + search | `/offers` | ✅ `GET /api/offers?materialId=&city=&limit=` (max. 100) |
| Map | `/map` | ⏳ coordinates + distance not yet in the response |
| Material filter (dropdown) | – | ⏳ list of materials missing (`GET /api/materials`) |
| Offer: detail · create | `/offers/[id]` · `/offers/new` | ⏳ missing |
| Demand (requests) | `/requests` | ⏳ data model still open |
| Cooperations | `/cooperations`, `/cooperations/[id]` | ⏳ endpoints missing · ✅ status values in `status.ts` |
| Notifications | `/notifications` | ⏳ planned |
| Network overview · impact | `/network` · `/impact` | ⏳ planned |
| Login error texts in English | – | ✅ `authErrorText(error, "en")` |

**A page needs data that does not exist yet:**

1. Ask the backend, stating: page · which fields · which filters/sorting · guests or members only.
2. The backend first defines the **type** of the response (like `GuestOffer`/`MemberOffer`).
3. Until the endpoint exists: build the page with sample data of exactly that type and mark the spot with `// MOCK` → later only the data source changes.

## 11. Before every commit

```bash
npm run check    # TypeScript + tests – must pass
npm run build    # production build – catches e.g. server/client errors
```

- No real company or contact data: the repository is public, the prototype uses demo data only.
- Never commit `.env`, never show it in screenshots.
- Agree on new npm packages with the backend first (vitest stays on 4.x).
