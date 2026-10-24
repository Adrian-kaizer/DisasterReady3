
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
    if (!["GET", "PUT"].includes(event.httpMethod)) {
        return methodNotAllowed("GET, PUT");
    }

    const session = await getSession(event);

    if (!session) {
        return json(401, {
            error: "Sign in to sync your checklist."
        });
    }

    // Create the Neon database client
    const db = sql();

    // LOAD SAVED CHECKLIST
    if (event.httpMethod === "GET") {
        const rows = await db`
            SELECT items, updated_at
            FROM checklist_progress
            WHERE user_id = ${session.id}
            LIMIT 1
        `;

        return json(200, rows[0] || { items: {} });
    }

    // SAVE CHECKLIST
    if (!isSameOrigin(event)) {
        return json(403, {
            error: "Request origin not allowed."
        });
    }

    const body = readJson(event, 12000);

    if (
        !body.items ||
        typeof body.items !== "object" ||
        Array.isArray(body.items) ||
        Object.keys(body.items).length > 200 ||
        Object.values(body.items).some(
            value => typeof value !== "boolean"
        )
    ) {
        return json(400, {
            error: "Checklist data is invalid."
        });
    }

    const rows = await db`
        INSERT INTO checklist_progress
            (user_id, items, updated_at)
        VALUES (
            ${session.id},
            ${JSON.stringify(body.items)}::jsonb,
            NOW()
        )
        ON CONFLICT (user_id)
        DO UPDATE SET
            items = EXCLUDED.items,
            updated_at = NOW()
        RETURNING user_id, items, updated_at
    `;

    if (!rows.length) {
        throw new Error("Checklist save returned no database row.");
    }

    console.log("Checklist saved for user:", session.id);

    return json(200, {
        success: true,
        items: rows[0].items,
        updated_at: rows[0].updated_at
    });
});
