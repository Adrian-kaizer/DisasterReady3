
import {
  getSession,
  isSameOrigin,
  json,
  methodNotAllowed,
  readJson,
  sql,
  withErrors
} from "./lib/shared.mjs";

export const handler = withErrors(async (event) => {
  if (!["GET", "POST"].includes(event.httpMethod)) {
    return methodNotAllowed("GET, POST");
  }

  const session = await getSession(event);

  if (!session) {
    return json(401, {
      error: "Sign in to access hazard reports."
    });
  }

  // GET: Retrieve reports belonging to the signed-in user.
  if (event.httpMethod === "GET") {
    const db = sql();

    const rows = await db`
      SELECT
        id,
        location,
        hazard_type AS type,
        description,
        status,
        created_at AS date
      FROM hazard_reports
      WHERE user_id = ${session.id}
      ORDER BY created_at DESC
      LIMIT 100
    `;

    return json(200, rows);
  }

  // POST: Verify that the request comes from this website.
  if (!isSameOrigin(event)) {
    return json(403, {
      error: "Request origin not allowed."
    });
  }

  // Read and validate the submitted report.
  const body = readJson(event, 5000);

  const location =
    typeof body.location === "string"
      ? body.location.trim()
      : "";

  const type =
    typeof body.type === "string"
      ? body.type.trim()
      : "";

  const description =
    typeof body.description === "string"
      ? body.description.trim()
      : "";

  if (
    !location ||
    location.length > 240 ||
    !type ||
    type.length > 80 ||
    !description ||
    description.length > 2000
  ) {
    return json(400, {
      error:
        "Enter a valid location, hazard type, and description (maximum 2,000 characters)."
    });
  }

  // Save the report to Neon PostgreSQL.
  const db = sql();

  const rows = await db`
    INSERT INTO hazard_reports (
      user_id,
      location,
      hazard_type,
      description
    )
    VALUES (
      ${session.id},
      ${location},
      ${type},
      ${description}
    )
    RETURNING
      id,
      location,
      hazard_type AS type,
      description,
      status,
      created_at AS date
  `;

  console.log(
    "Hazard report insert returned:",
    rows.length
  );

  if (!rows.length) {
    throw new Error(
      "Hazard report INSERT returned no rows."
    );
  }

  // Return the newly saved report as JSON.
  return json(201, rows[0]);
});
