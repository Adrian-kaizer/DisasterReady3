
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
  if (!["GET", "POST", "DELETE"].includes(event.httpMethod)) {
    return methodNotAllowed("GET, POST, DELETE");
  }

  const session = await getSession(event);

  if (!session) {
    return json(401, {
      error: "Sign in to access flood monitoring."
    });
  }

  // GET: Retrieve flood stations and their latest readings.
  if (event.httpMethod === "GET") {
    const db = sql();

    const rows = await db`
      SELECT
        s.id,
        s.name,
        s.location,
        s.warning_level AS "warningLevel",
        s.critical_level AS "criticalLevel",
        latest.water_level AS "waterLevel",
        latest.recorded_at AS "updatedAt",
        COALESCE(history.readings, '[]'::json) AS readings
      FROM flood_stations s
      LEFT JOIN LATERAL (
        SELECT water_level, recorded_at
        FROM flood_readings
        WHERE station_id = s.id
        ORDER BY recorded_at DESC
        LIMIT 1
      ) latest ON TRUE
      LEFT JOIN LATERAL (
        SELECT json_agg(
          json_build_object(
            'level', r.water_level,
            'time', r.recorded_at
          )
          ORDER BY r.recorded_at
        ) AS readings
        FROM (
          SELECT water_level, recorded_at
          FROM flood_readings
          WHERE station_id = s.id
          ORDER BY recorded_at DESC
          LIMIT 20
        ) r
      ) history ON TRUE
      ORDER BY s.name
    `;

    return json(
      200,
      rows.map((row) => ({
        ...row,
        waterLevel:
          row.waterLevel == null ? 0 : Number(row.waterLevel),
        warningLevel: Number(row.warningLevel),
        criticalLevel: Number(row.criticalLevel),
        updatedAt: row.updatedAt || null,
        readings: row.readings || []
      }))
    );
  }

  // Only same-origin requests may modify stations.
  if (!isSameOrigin(event)) {
    return json(403, {
      error: "Request origin not allowed."
    });
  }

  if (session.role !== "admin") {
    return json(403, {
      error: "Administrator access is required to manage monitoring stations."
    });
  }

  const db = sql();

  // DELETE: Remove a monitoring station.
  if (event.httpMethod === "DELETE") {
    const body = readJson(event, 1000);
    const id = Number(body.id);

    if (!Number.isSafeInteger(id) || id < 1) {
      return json(400, {
        error: "A valid station ID is required."
      });
    }

    await db`
      DELETE FROM flood_stations
      WHERE id = ${id}
    `;

    return json(200, { ok: true });
  }

  // POST: Create/update a station and record its water level.
  const body = readJson(event, 3000);

  const name =
    typeof body.name === "string" ? body.name.trim() : "";

  const location =
    typeof body.location === "string" ? body.location.trim() : "";

  const waterLevel = Number(body.waterLevel);
  const warningLevel = Number(body.warningLevel);
  const criticalLevel = Number(body.criticalLevel);

  if (
    !name ||
    name.length > 120 ||
    !location ||
    location.length > 240 ||
    !Number.isFinite(waterLevel) ||
    waterLevel < 0 ||
    !Number.isFinite(warningLevel) ||
    warningLevel <= 0 ||
    !Number.isFinite(criticalLevel) ||
    criticalLevel <= warningLevel
  ) {
    return json(400, {
      error: "Check station details, water level, and thresholds."
    });
  }

  const rows = await db`
    INSERT INTO flood_stations (
      name,
      location,
      warning_level,
      critical_level,
      created_by,
      updated_at
    )
    VALUES (
      ${name},
      ${location},
      ${warningLevel},
      ${criticalLevel},
      ${session.id},
      NOW()
    )
    ON CONFLICT (LOWER(name), LOWER(location))
    DO UPDATE SET
      warning_level = EXCLUDED.warning_level,
      critical_level = EXCLUDED.critical_level,
      updated_at = NOW()
    RETURNING
      id,
      name,
      location,
      warning_level AS "warningLevel",
      critical_level AS "criticalLevel"
  `;

  const station = rows[0];

  if (!station || station.id == null) {
    throw new Error(
      "Flood station insert did not return a station ID."
    );
  }

  await db`
    INSERT INTO flood_readings (
      station_id,
      water_level,
      recorded_by
    )
    VALUES (
      ${station.id},
      ${waterLevel},
      ${session.id}
    )
  `;

  return json(200, {
    ...station,
    waterLevel,
    updatedAt: new Date().toISOString()
  });
});
