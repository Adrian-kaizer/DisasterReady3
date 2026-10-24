# DisasterReadyPH — Netlify + Neon deployment

The production architecture is a static frontend hosted by Netlify, Netlify Functions for protected API endpoints, and Neon PostgreSQL for persistent shared data. Node.js is still the runtime for the serverless functions; a continuously running Express/Node server and SQLite are not used in production.

## 1. Create and initialize Neon

1. Create a PostgreSQL project in [Neon](https://neon.tech/).
2. Open the Neon SQL Editor and execute the complete `database/neon-schema.sql` file. For an existing database, run it again to add missing tables and indexes.
3. Copy the pooled or standard PostgreSQL connection string. Keep it secret.

The schema contains accounts, hashed-password authentication sessions, rate-limit records, cached location searches, personal map pins, per-account preparedness checklist state, user-owned hazard reports, shared flood-monitoring stations, and water-level readings.

## 2. Configure locally

Install Node.js 22 or newer, then run:

```bash
npm install
```

Copy `.env.example` to `.env` and set `DATABASE_URL` to your Neon connection string. Never commit `.env`, expose the connection string in browser code, or paste it into public issue reports.

## 3. Migrate existing accounts (only if needed)

If you have existing accounts in the old local SQLite database, first keep a backup of `database/users.sqlite`, then run:

```bash
npm run migrate:sqlite-to-neon
```

The script migrates account records and password hashes; it does not migrate browser-local checklist, hazard-report, or flood-station data. Review its output and resolve duplicate email conflicts before retrying.

## 4. Create an administrator account

After the schema is installed, create an admin if one does not already exist:

```bash
npm run create:admin -- admin@example.com
```

The script asks for the password in the terminal. Public registration creates regular user accounts only. Administrator access is required to create/update shared flood-monitoring stations and delete them.

## 5. Test locally with Netlify

```bash
npm run dev
```

Use the local URL printed by Netlify CLI, usually `http://localhost:8888`. Test registration, login/logout, profile updates, account deletion, personal map pins, checklist syncing, hazard reports, and admin-only station management. Browser GPS works on localhost and HTTPS after permission is granted.

## 6. Deploy

1. Push the project to GitHub and import that repository into Netlify.
2. In Netlify site settings, add the environment variable `DATABASE_URL` with the Neon connection string. Set it for the deploy contexts you use.
3. Use build command `npm run build` and publish directory `dist`. `netlify.toml` already configures these values and the Functions directory.
4. Deploy, then test the deployed URL over HTTPS.

The `dist` directory contains only public frontend assets. Netlify Functions run from `netlify/functions`. Local migration utilities and `.env` are not published as frontend assets.

## Data ownership and limitations

- Each signed-in user can save one private personal map pin and their own checklist state.
- Users can submit and view their own hazard reports. A report is not automatically sent to emergency services and remains unverified until an authorized workflow reviews it.
- Flood stations/readings are shared. Only an account with the `admin` role can create/update stations or delete them.
- A searched or GPS-derived map pin is only a coordinate reference, not proof of an official evacuation center. Verify evacuation centers and emergency instructions with the relevant LGU/barangay or official agency.
- Weather and geocoding providers may have availability, rate, accuracy, and usage-policy limitations.
- Before public launch, test account deletion and profile-picture handling, set up a database backup/restore plan, and confirm your privacy notice reflects the information you collect.
