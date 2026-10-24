import {
    getSession,
    isSameOrigin,
    json,
    methodNotAllowed,
    readJson,
    sql,
    withErrors
} from "./lib/shared.mjs";

export const handler = withErrors(async event => {
    if (!["GET", "PUT", "DELETE"].includes(event.httpMethod)) {
        return methodNotAllowed("GET, PUT, DELETE");
    }
    const session = await getSession(event);
    if (!session) return json(401, { error: "Sign in to save a personal map pin." });

    if (event.httpMethod === "GET") {
        const rows = await sql`
            SELECT label, latitude, longitude, updated_at
            FROM user_saved_locations WHERE user_id = ${session.id} LIMIT 1
        `;
        return json(200, rows[0] || null);
    }

    if (!isSameOrigin(event)) return json(403, { error: "Request origin not allowed." });

    if (event.httpMethod === "DELETE") {
        await sql`DELETE FROM user_saved_locations WHERE user_id = ${session.id}`;
        return json(200, { ok: true });
    }

    const body = readJson(event, 2048);
    const label = typeof body.label === "string" ? body.label.trim() : "";
    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);
    if (!label || label.length > 160 || !Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
        return json(400, { error: "Provide a label and valid map coordinates." });
    }

    const rows = await sql`
        INSERT INTO user_saved_locations (user_id, label, latitude, longitude, updated_at)
        VALUES (${session.id}, ${label}, ${latitude}, ${longitude}, NOW())
        ON CONFLICT (user_id) DO UPDATE SET
            label = EXCLUDED.label, latitude = EXCLUDED.latitude,
            longitude = EXCLUDED.longitude, updated_at = NOW()
        RETURNING label, latitude, longitude, updated_at
    `;
    return json(200, rows[0]);
});
