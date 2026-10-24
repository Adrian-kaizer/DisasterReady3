# DisasterReadyPH

A disaster-preparedness  web application with a responsive dashboard, weather lookup, interactive Leaflet map, personal location pin, emergency checklist, hazard reporting, and flood-level monitoring.

## Production stack

- HTML, CSS, and browser JavaScript
- Leaflet + OpenStreetMap
- Netlify static hosting and serverless Functions
- Neon PostgreSQL via `@neondatabase/serverless`
- HttpOnly session cookies and salted password hashes

## Quick start

1. Create a Neon database and run `database/neon-schema.sql` in its SQL editor.
2. Run `npm install`.
3. Set `DATABASE_URL` in a local `.env` file using `.env.example` as a template.
4. Run `npm run dev` and open the local URL printed by Netlify CLI.

For deployment, migration from the old SQLite account database, administrator setup, and test steps, read [`NETLIFY-DEPLOY.md`](NETLIFY-DEPLOY.md).

## API overview

- `/api/register`, `/api/login`, `/api/session`, `/api/logout`
- `/api/profile`, `/api/profile-picture`, `/api/delete-account`
- `/api/location-search`, `/api/saved-location`
- `/api/checklist`, `/api/hazard-reports`, `/api/flood-stations`

Protected endpoints require a valid session. User-owned resources are scoped to the signed-in account. Flood-station management is administrator-only.

## Safety note

This project is an informational tool, not an emergency dispatch service. Hazard reports are not automatically delivered to responders, and flood readings should be verified against official monitoring and emergency advisories.
