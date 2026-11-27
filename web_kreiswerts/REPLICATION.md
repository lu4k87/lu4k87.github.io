# Replication: set up KreiswertS for another region

KreiswertS was built for Kamp-Lintfort and the Lower Rhine, but nothing about the region is fixed in the code. The region lives in data: industrial parks, the material catalogue, companies and their sites. This guide is for the technical team of another region (a business development agency, an industrial park, a research group). It sets up the platform with that region's own data in about an hour.

Before you start you need:

- Node.js ≥ 20.9 and Git
- PostgreSQL 17 (step 2 installs it)
- a spreadsheet program for the CSV files (Excel, LibreOffice Calc or Numbers)
- the region's industrial parks (name, town, approximate centre and radius) and, if you have one, a list of companies with their sites and contact people **who agreed to be listed**

## 1. What belongs to a region

| Part | Where it lives | How you change it |
|---|---|---|
| Industrial parks | table `industrial_parks` | `parks.csv` (step 3) |
| Material categories, types and forms | tables `material_categories`, `material_types`, `material_forms` | `categories.csv`, `materials.csv` (step 3) |
| Companies and sites | tables `companies`, `sites` | `sites.csv` (step 3), or companies register themselves in the app |
| Units, material attributes, emission factors | `scripts/seed/reference.mjs` | edit the file, then `npm run db:seed` – they carry rules (ranges, required pairs, sources), not just names |
| Region name in texts | `src/i18n/` (DE + EN), e.g. "Kamp-Lintfort" on the start page | edit the texts |
| Map start view when there is no site yet | `src/components/map/live-map.tsx` (`center`) | set your region's centre; once sites exist the map fits them by itself |

Everything else – roles, verification, offers, requests, matching, negotiations, the map and the circularity overview – works the same in every region.

## 2. Install and create the database

```bash
git clone <your fork of this repository> kreiswerts && cd kreiswerts
npm ci
scripts/setup-postgres.sh          # Linux (apt) and macOS (Homebrew); Windows: scripts/setup-postgres.ps1
cp .env.example .env && chmod 600 .env
```

The setup script prints a `DATABASE_URL` line with a random password: put it into `.env`, together with `BETTER_AUTH_SECRET` (`openssl rand -base64 32`) and `BETTER_AUTH_URL` (the address the app runs at). Then create the tables and the reference data:

```bash
npm run db:push                    # tables
npm run db:seed                    # units, attributes, emission factors, the starter catalogue and parks
```

`db:seed` without `--demo` writes no company and no login. The starter catalogue (plastics enabled, metals and other categories prepared but switched off) and the four parks of Kamp-Lintfort are a starting point. Steps 3 and 4 replace the parks and extend the catalogue.

## 3. Fill in the region data

Export the current state as templates. That way you start from files with the right columns:

```bash
npm run data:export                         # writes data-export/parks.csv, categories.csv, materials.csv, sites.csv
npm run data:export -- --delimiter ";"      # the same for German Excel (semicolon)
```

Open the files, edit them and save them as CSV again (UTF-8). The import detects `,` or `;` from the header line. Another folder can be named as the first argument (`npm run data:export -- <folder>`), but only `data-export/` is ignored by Git.

### parks.csv

| Column | Required | Rule |
|---|---|---|
| `slug` | yes | stable short name, lower-case letters, digits and `-` (sites refer to it) |
| `name`, `city` | yes | as shown in the app |
| `latitude`, `longitude` | yes | centre of the park in decimal degrees (comma or point) |
| `radius_m` | no | 100–5000 m, default 600 – the "own park" search uses it |
| `source_note` | yes | where the position comes from, e.g. "approximate, from the land-use plan" – shown on the reference data page |

### categories.csv and materials.csv

| File | Columns | Rule |
|---|---|---|
| `categories.csv` | `key`, `name_en`, `name_de`, `enabled` | `key`: lower-case letters, digits, `_`; `enabled` (`true`/`false`) only counts for a **new** category – afterwards the switch on the admin page decides |
| `materials.csv` | `category`, `kind`, `key`, `name_en`, `name_de` | `kind` is `type` (polymer, metal, …) or `form` (sheet, regrind, …); `category` is a key from `categories.csv` or the database |

The order of the rows is the order in the forms. Attributes (thickness, melt flow rate, …) belong to a category and are edited in `scripts/seed/reference.mjs`.

### sites.csv

One row per site. A company with three plants has three rows with the same company.

| Column | Required | Rule |
|---|---|---|
| `company_name`, `company_vat_id` | name yes, VAT ID recommended | the company is found by VAT ID, otherwise by name; a new one is created. The name of an existing company does not change |
| `name`, `street_address`, `postal_code`, `city` | yes | the physical site |
| `industry` | no | `manufacturing`, `recycling`, `packaging`, `construction`, `logistics`, `other` (default) |
| `park` | no | a `slug` from `parks.csv` or the database; empty = outside every park |
| `latitude`, `longitude` | no | both or none; without them the site is not on the map until the administrator enters them |
| `description` | no | up to 1500 characters |
| `capabilities` | no | separated by `\|`: `cutting`, `grinding`, `sorting`, `regranulation`, `compounding`, `other` – matching suggests these sites as processors |
| `contact_name`, `contact_email` | yes | the contact person, `contact_phone` optional |
| `contact_visible`, `public_listed` | no | `true`/`false`: contact visible to verified members (default true) · name and park on the public map (default false) |
| `provenance` | no | `registered` (default) or `synthetic` for invented demo sites |
| `verification_status` | – | written by the export for information, **ignored by the import** |

A site counts as the same when the company and the address match – the duplicate rule of the registration (`Musterstr. 1` = `Musterstraße 1`). The import updates such a site instead of adding a second one.

## 4. Check, then import

```bash
npm run data:import -- --dry-run            # checks every file in data-export/ and reports, saves nothing
npm run data:import -- --prune-parks        # saves; --prune-parks removes parks that are not in parks.csv
```

- **All or nothing:** the import first checks every row of every file. Each problem is reported as `file:line column – rule`, and if there is a single one, nothing is saved. A misspelled column header is an error too, so no column is dropped without notice.
- **Adds and updates, never deletes:** the only exception is `--prune-parks`. It removes the starter parks you did not list, and only those that no site uses.
- **Files are optional:** only the files present in the folder are imported. A later list of new companies can be just `sites.csv`.
- **Imported sites start as `pending` and without a login.** They appear in the directory and on the map only after the administrator verifies them (step 6). The import never sets a site to verified.

## 5. Create the administrator

The administrator verifies sites and switches material categories on. Only the demo seed creates one (`admin_demo`), so a real region promotes a normal account once:

1. In the app, open `/register` and create the account (user name, e-mail, a strong password). Stop at the site step: an administrator has no site.
2. In the database:

```bash
psql "$DATABASE_URL" -c "update auth_users set role = 'admin', site_id = null where username = '<the user name>'"
```

3. Log in again. `/admin/verification` and `/admin/reference-data` are now open to that account.

## 6. Verify the sites and invite the companies

- `/admin/verification` lists the pending sites. Check each against the company register or a phone call, add the coordinates if they are missing, then verify.
- An imported site has no login. Its company can register in the app: a registration with the same VAT ID and address is flagged as a possible duplicate of the imported site, and the administrator decides. Companies that are not in `sites.csv` register themselves and wait for verification as usual.
- Before go-live, switch on only the material categories the region really trades (`/admin/reference-data`).

## 7. Demo data for training (optional)

`npm run db:seed -- --demo` adds eleven fictional companies with twelve sites, listings, requests, negotiations and the five cases A–E. They are useful for a workshop, and every record is labelled "synthetic". `npm run db:seed -- --reset-demo` removes them again. Real data stays untouched.

## 8. Data protection and checks

- `sites.csv` holds names, e-mail addresses and phone numbers. The export creates the files readable only by your user (mode 600). The default folder `data-export/` is ignored by Git. Never commit such a file to the repository or send it unencrypted.
- Import only people who agreed to be listed. A cell that a spreadsheet would run as a formula (`=`, `+`, `-`, `@` at the start) is written with a leading `'` and read back without it.
- After changing code or reference data: `npm run check` and `npm run build`, and the acceptance runs against your own test database (`scripts/e2e-level1.mjs`, header of the file). These runs use the demo data and refuse any database whose name does not end in `_e2e`.
