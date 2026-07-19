import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { config as loadDotenv } from "dotenv";
import AdmZip from "adm-zip";
import { parse } from "csv-parse/sync";
import type { PoolClient } from "pg";
import { getPool } from "../lib/db";
import { resetEnvCache } from "../lib/env";
import { parseGtfsTime } from "../lib/gtfs/time";

loadDotenv({ quiet: true });

const REJECT_RATE_LIMIT = 0.005;

type Row = Record<string, string>;

type FileStats = {
  loaded: number;
  rejected: number;
};

type Capabilities = {
  transfers: boolean;
  frequencies: boolean;
  feed_info: boolean;
  calendar_dates: boolean;
};

function parseArgs(argv: string[]) {
  let source: string | undefined;
  let force = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--source") source = argv[++i];
    else if (a === "--force") force = true;
    else if (a.startsWith("--source=")) source = a.slice("--source=".length);
  }
  if (!source) {
    throw new Error("Usage: npm run gtfs:import -- --source <url-or-path> [--force]");
  }
  return { source, force };
}

async function resolveZip(source: string): Promise<{ bytes: Buffer; label: string }> {
  if (/^https?:\/\//i.test(source)) {
    const res = await fetch(source);
    if (!res.ok) throw new Error(`Failed to download ${source}: ${res.status}`);
    const ab = await res.arrayBuffer();
    return { bytes: Buffer.from(ab), label: source };
  }
  const abs = path.resolve(source);
  return { bytes: fs.readFileSync(abs), label: abs };
}

function sha256(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

function readCsv(zip: AdmZip, fileName: string): { rows: Row[]; present: boolean } {
  const entry = zip.getEntries().find((e) => e.entryName.split("/").pop() === fileName);
  if (!entry) return { rows: [], present: false };
  let text = entry.getData().toString("utf8");
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows = parse(text, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
    bom: true,
  }) as Row[];
  return { rows, present: true };
}

function yn(v: string | undefined): boolean {
  return v === "1" || v?.toLowerCase() === "true";
}

function parseDate(yyyymmdd: string | undefined): string | null {
  if (!yyyymmdd || !/^\d{8}$/.test(yyyymmdd)) return null;
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}

async function insertReject(
  client: PoolClient,
  feedVersionId: number,
  fileName: string,
  lineNumber: number,
  reason: string,
  raw: Row,
) {
  await client.query(
    `INSERT INTO gtfs_import_rejects (feed_version_id, file_name, line_number, reason, raw_row)
     VALUES ($1, $2, $3, $4, $5)`,
    [feedVersionId, fileName, lineNumber, reason, JSON.stringify(raw)],
  );
}

export async function importGtfs(options: {
  source: string;
  force?: boolean;
}): Promise<{
  feedVersionId: number;
  sha256: string;
  skipped: boolean;
  stats: Record<string, FileStats>;
  capabilities: Capabilities;
  durationMs: number;
}> {
  resetEnvCache();
  const started = Date.now();
  const { bytes, label } = await resolveZip(options.source);
  const hash = sha256(bytes);

  const pool = getPool();
  const existing = await pool.query<{ id: string; status: string }>(
    `SELECT id, status FROM feed_versions WHERE sha256 = $1 ORDER BY id DESC LIMIT 1`,
    [hash],
  );
  if (existing.rows[0] && !options.force) {
    return {
      feedVersionId: Number(existing.rows[0].id),
      sha256: hash,
      skipped: true,
      stats: {},
      capabilities: {
        transfers: false,
        frequencies: false,
        feed_info: false,
        calendar_dates: false,
      },
      durationMs: Date.now() - started,
    };
  }

  const zip = new AdmZip(bytes);
  const client = await pool.connect();
  let feedVersionId = 0;
  const stats: Record<string, FileStats> = {};
  const capabilities: Capabilities = {
    transfers: false,
    frequencies: false,
    feed_info: false,
    calendar_dates: false,
  };

  try {
    await client.query("BEGIN");

    const fv = await client.query<{ id: string }>(
      `INSERT INTO feed_versions (source, sha256, status)
       VALUES ($1, $2, 'loading')
       RETURNING id`,
      [label, hash],
    );
    feedVersionId = Number(fv.rows[0].id);

    const ensureStat = (file: string) => {
      if (!stats[file]) stats[file] = { loaded: 0, rejected: 0 };
      return stats[file];
    };

    // agency
    {
      const file = "agency.txt";
      const { rows } = readCsv(zip, file);
      const st = ensureStat(file);
      let line = 1;
      for (const row of rows) {
        line++;
        if (!row.agency_id || !row.agency_name || !row.agency_timezone) {
          st.rejected++;
          await insertReject(client, feedVersionId, file, line, "missing required fields", row);
          continue;
        }
        await client.query(
          `INSERT INTO agency (feed_version_id, agency_id, agency_name, agency_url, agency_timezone, agency_lang, agency_phone)
           VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [
            feedVersionId,
            row.agency_id,
            row.agency_name,
            row.agency_url || null,
            row.agency_timezone,
            row.agency_lang || null,
            row.agency_phone || null,
          ],
        );
        st.loaded++;
      }
    }

    // routes
    {
      const file = "routes.txt";
      const { rows } = readCsv(zip, file);
      const st = ensureStat(file);
      let line = 1;
      for (const row of rows) {
        line++;
        if (!row.route_id || row.route_type === undefined || row.route_type === "") {
          st.rejected++;
          await insertReject(client, feedVersionId, file, line, "missing required fields", row);
          continue;
        }
        try {
          await client.query(
            `INSERT INTO routes (
               feed_version_id, route_id, agency_id, route_short_name, route_long_name,
               route_desc, route_type, route_url, route_color, route_text_color
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
            [
              feedVersionId,
              row.route_id,
              row.agency_id || null,
              row.route_short_name || null,
              row.route_long_name || null,
              row.route_desc || null,
              Number(row.route_type),
              row.route_url || null,
              row.route_color || null,
              row.route_text_color || null,
            ],
          );
          st.loaded++;
        } catch (err) {
          st.rejected++;
          await insertReject(
            client,
            feedVersionId,
            file,
            line,
            err instanceof Error ? err.message : String(err),
            row,
          );
        }
      }
    }

    // stops
    {
      const file = "stops.txt";
      const { rows } = readCsv(zip, file);
      const st = ensureStat(file);
      let line = 1;
      for (const row of rows) {
        line++;
        const lat = Number(row.stop_lat);
        const lon = Number(row.stop_lon);
        if (!row.stop_id || !row.stop_name || !Number.isFinite(lat) || !Number.isFinite(lon)) {
          st.rejected++;
          await insertReject(client, feedVersionId, file, line, "missing/invalid stop fields", row);
          continue;
        }
        if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
          st.rejected++;
          await insertReject(client, feedVersionId, file, line, "lat/lon out of range", row);
          continue;
        }
        await client.query(
          `INSERT INTO stops (
             feed_version_id, stop_id, stop_code, stop_name, stop_desc,
             stop_lat, stop_lon, zone_id, stop_url, location_type, parent_station,
             wheelchair_boarding, geom
           ) VALUES (
             $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,
             ST_SetSRID(ST_MakePoint($7, $6), 4326)::geography
           )`,
          [
            feedVersionId,
            row.stop_id,
            row.stop_code || null,
            row.stop_name,
            row.stop_desc || null,
            lat,
            lon,
            row.zone_id || null,
            row.stop_url || null,
            row.location_type ? Number(row.location_type) : null,
            row.parent_station || null,
            row.wheelchair_boarding ? Number(row.wheelchair_boarding) : null,
          ],
        );
        st.loaded++;
      }
    }

    // calendar
    {
      const file = "calendar.txt";
      const { rows } = readCsv(zip, file);
      const st = ensureStat(file);
      let line = 1;
      for (const row of rows) {
        line++;
        const start = parseDate(row.start_date);
        const end = parseDate(row.end_date);
        if (!row.service_id || !start || !end) {
          st.rejected++;
          await insertReject(client, feedVersionId, file, line, "missing required fields", row);
          continue;
        }
        await client.query(
          `INSERT INTO calendar (
             feed_version_id, service_id, monday, tuesday, wednesday, thursday,
             friday, saturday, sunday, start_date, end_date
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
          [
            feedVersionId,
            row.service_id,
            yn(row.monday),
            yn(row.tuesday),
            yn(row.wednesday),
            yn(row.thursday),
            yn(row.friday),
            yn(row.saturday),
            yn(row.sunday),
            start,
            end,
          ],
        );
        st.loaded++;
      }
    }

    // calendar_dates
    {
      const file = "calendar_dates.txt";
      const { rows, present } = readCsv(zip, file);
      capabilities.calendar_dates = present;
      const st = ensureStat(file);
      let line = 1;
      for (const row of rows) {
        line++;
        const date = parseDate(row.date);
        if (!row.service_id || !date || !row.exception_type) {
          st.rejected++;
          await insertReject(client, feedVersionId, file, line, "missing required fields", row);
          continue;
        }
        await client.query(
          `INSERT INTO calendar_dates (feed_version_id, service_id, date, exception_type)
           VALUES ($1,$2,$3,$4)`,
          [feedVersionId, row.service_id, date, Number(row.exception_type)],
        );
        st.loaded++;
      }
    }

    // shapes
    {
      const file = "shapes.txt";
      const { rows } = readCsv(zip, file);
      const st = ensureStat(file);
      let line = 1;
      for (const row of rows) {
        line++;
        const lat = Number(row.shape_pt_lat);
        const lon = Number(row.shape_pt_lon);
        const seq = Number(row.shape_pt_sequence);
        if (!row.shape_id || !Number.isFinite(lat) || !Number.isFinite(lon) || !Number.isFinite(seq)) {
          st.rejected++;
          await insertReject(client, feedVersionId, file, line, "missing/invalid shape fields", row);
          continue;
        }
        await client.query(
          `INSERT INTO shapes (
             feed_version_id, shape_id, shape_pt_lat, shape_pt_lon, shape_pt_sequence, shape_dist_traveled
           ) VALUES ($1,$2,$3,$4,$5,$6)`,
          [
            feedVersionId,
            row.shape_id,
            lat,
            lon,
            seq,
            row.shape_dist_traveled ? Number(row.shape_dist_traveled) : null,
          ],
        );
        st.loaded++;
      }
    }

    // shape_geometries
    await client.query(
      `INSERT INTO shape_geometries (feed_version_id, shape_id, geom)
       SELECT
         feed_version_id,
         shape_id,
         ST_SetSRID(
           ST_MakeLine(ST_MakePoint(shape_pt_lon, shape_pt_lat) ORDER BY shape_pt_sequence),
           4326
         )::geography
       FROM shapes
       WHERE feed_version_id = $1
       GROUP BY feed_version_id, shape_id
       HAVING COUNT(*) >= 2`,
      [feedVersionId],
    );
    const nullGeoms = await client.query(
      `SELECT COUNT(*)::int AS c FROM shape_geometries WHERE feed_version_id = $1 AND geom IS NULL`,
      [feedVersionId],
    );
    if (nullGeoms.rows[0].c > 0) {
      throw new Error("shape_geometries contains NULL geom after materialisation");
    }

    // trips
    {
      const file = "trips.txt";
      const { rows } = readCsv(zip, file);
      const st = ensureStat(file);
      let line = 1;
      for (const row of rows) {
        line++;
        if (!row.route_id || !row.service_id || !row.trip_id) {
          st.rejected++;
          await insertReject(client, feedVersionId, file, line, "missing required fields", row);
          continue;
        }
        try {
          await client.query(
            `INSERT INTO trips (
               feed_version_id, route_id, service_id, trip_id, trip_headsign, trip_short_name,
               direction_id, block_id, shape_id, wheelchair_accessible, bikes_allowed
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
            [
              feedVersionId,
              row.route_id,
              row.service_id,
              row.trip_id,
              row.trip_headsign || null,
              row.trip_short_name || null,
              row.direction_id !== undefined && row.direction_id !== ""
                ? Number(row.direction_id)
                : null,
              row.block_id || null,
              row.shape_id || null,
              row.wheelchair_accessible ? Number(row.wheelchair_accessible) : null,
              row.bikes_allowed ? Number(row.bikes_allowed) : null,
            ],
          );
          st.loaded++;
        } catch (err) {
          st.rejected++;
          await insertReject(
            client,
            feedVersionId,
            file,
            line,
            err instanceof Error ? err.message : String(err),
            row,
          );
        }
      }
    }

    // stop_times
    {
      const file = "stop_times.txt";
      const { rows } = readCsv(zip, file);
      const st = ensureStat(file);
      let line = 1;
      for (const row of rows) {
        line++;
        const arr = parseGtfsTime(row.arrival_time || "");
        const dep = parseGtfsTime(row.departure_time || "");
        const seq = Number(row.stop_sequence);
        if (!row.trip_id || !row.stop_id || arr === null || dep === null || !Number.isFinite(seq)) {
          st.rejected++;
          await insertReject(client, feedVersionId, file, line, "missing/invalid stop_time fields", row);
          continue;
        }
        try {
          await client.query(
            `INSERT INTO stop_times (
               feed_version_id, trip_id, arrival_time, departure_time, stop_id, stop_sequence,
               stop_headsign, pickup_type, drop_off_type, shape_dist_traveled, timepoint
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
            [
              feedVersionId,
              row.trip_id,
              arr,
              dep,
              row.stop_id,
              seq,
              row.stop_headsign || null,
              row.pickup_type ? Number(row.pickup_type) : null,
              row.drop_off_type ? Number(row.drop_off_type) : null,
              row.shape_dist_traveled ? Number(row.shape_dist_traveled) : null,
              row.timepoint ? Number(row.timepoint) : null,
            ],
          );
          st.loaded++;
        } catch (err) {
          st.rejected++;
          await insertReject(
            client,
            feedVersionId,
            file,
            line,
            err instanceof Error ? err.message : String(err),
            row,
          );
        }
      }
    }

    // transfers
    {
      const file = "transfers.txt";
      const { rows, present } = readCsv(zip, file);
      capabilities.transfers = present;
      const st = ensureStat(file);
      let line = 1;
      for (const row of rows) {
        line++;
        if (!row.from_stop_id || !row.to_stop_id || row.transfer_type === undefined) {
          st.rejected++;
          await insertReject(client, feedVersionId, file, line, "missing required fields", row);
          continue;
        }
        try {
          await client.query(
            `INSERT INTO transfers (
               feed_version_id, from_stop_id, to_stop_id, transfer_type, min_transfer_time
             ) VALUES ($1,$2,$3,$4,$5)`,
            [
              feedVersionId,
              row.from_stop_id,
              row.to_stop_id,
              Number(row.transfer_type),
              row.min_transfer_time ? Number(row.min_transfer_time) : null,
            ],
          );
          st.loaded++;
        } catch (err) {
          st.rejected++;
          await insertReject(
            client,
            feedVersionId,
            file,
            line,
            err instanceof Error ? err.message : String(err),
            row,
          );
        }
      }
    }

    // frequencies
    {
      const file = "frequencies.txt";
      const { rows, present } = readCsv(zip, file);
      capabilities.frequencies = present;
      const st = ensureStat(file);
      let line = 1;
      for (const row of rows) {
        line++;
        const start = parseGtfsTime(row.start_time || "");
        const end = parseGtfsTime(row.end_time || "");
        const headway = Number(row.headway_secs);
        if (!row.trip_id || start === null || end === null || !Number.isFinite(headway)) {
          st.rejected++;
          await insertReject(client, feedVersionId, file, line, "missing/invalid frequency fields", row);
          continue;
        }
        try {
          await client.query(
            `INSERT INTO frequencies (
               feed_version_id, trip_id, start_time, end_time, headway_secs, exact_times
             ) VALUES ($1,$2,$3,$4,$5,$6)`,
            [
              feedVersionId,
              row.trip_id,
              start,
              end,
              headway,
              row.exact_times ? Number(row.exact_times) : null,
            ],
          );
          st.loaded++;
        } catch (err) {
          st.rejected++;
          await insertReject(
            client,
            feedVersionId,
            file,
            line,
            err instanceof Error ? err.message : String(err),
            row,
          );
        }
      }
    }

    // feed_info dates
    let feedStart: string | null = null;
    let feedEnd: string | null = null;
    {
      const file = "feed_info.txt";
      const { rows, present } = readCsv(zip, file);
      capabilities.feed_info = present;
      if (rows[0]) {
        feedStart = parseDate(rows[0].feed_start_date);
        feedEnd = parseDate(rows[0].feed_end_date);
      }
    }
    if (!feedStart || !feedEnd) {
      const cal = await client.query<{ s: string; e: string }>(
        `SELECT MIN(start_date)::text AS s, MAX(end_date)::text AS e
         FROM calendar WHERE feed_version_id = $1`,
        [feedVersionId],
      );
      feedStart = feedStart ?? cal.rows[0]?.s ?? null;
      feedEnd = feedEnd ?? cal.rows[0]?.e ?? null;
    }

    // reject rate gate
    for (const [file, st] of Object.entries(stats)) {
      const total = st.loaded + st.rejected;
      if (total > 0 && st.rejected / total > REJECT_RATE_LIMIT) {
        throw new Error(
          `Reject rate for ${file} is ${(st.rejected / total * 100).toFixed(2)}% (limit ${REJECT_RATE_LIMIT * 100}%)`,
        );
      }
    }

    const durationMs = Date.now() - started;
    const rowCounts: Record<string, number> = {};
    for (const [file, st] of Object.entries(stats)) {
      rowCounts[file] = st.loaded;
    }
    const shapeGeomCount = await client.query<{ c: number }>(
      `SELECT COUNT(*)::int AS c FROM shape_geometries WHERE feed_version_id = $1`,
      [feedVersionId],
    );
    rowCounts["shape_geometries"] = shapeGeomCount.rows[0].c;

    await client.query(
      `UPDATE feed_versions SET status = 'superseded'
       WHERE status = 'active'`,
    );
    await client.query(
      `UPDATE feed_versions SET
         status = 'active',
         activated_at = now(),
         feed_start_date = $2,
         feed_end_date = $3,
         row_counts = $4::jsonb,
         capabilities = $5::jsonb,
         load_duration_ms = $6,
         error_message = NULL
       WHERE id = $1`,
      [
        feedVersionId,
        feedStart,
        feedEnd,
        JSON.stringify(rowCounts),
        JSON.stringify(capabilities),
        durationMs,
      ],
    );

    await client.query("COMMIT");

    return {
      feedVersionId,
      sha256: hash,
      skipped: false,
      stats,
      capabilities,
      durationMs,
    };
  } catch (err) {
    await client.query("ROLLBACK");
    if (feedVersionId) {
      await pool.query(
        `UPDATE feed_versions SET status = 'failed', error_message = $2
         WHERE id = $1 AND status = 'loading'`,
        [feedVersionId, err instanceof Error ? err.message : String(err)],
      );
      // loading row may have been rolled back — insert a failed marker if needed
      const still = await pool.query(`SELECT 1 FROM feed_versions WHERE id = $1`, [
        feedVersionId,
      ]);
      if ((still.rowCount ?? 0) === 0) {
        await pool.query(
          `INSERT INTO feed_versions (source, sha256, status, error_message)
           VALUES ($1, $2, 'failed', $3)`,
          [label, hash, err instanceof Error ? err.message : String(err)],
        );
      }
    }
    throw err;
  } finally {
    client.release();
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const result = await importGtfs(args);
  if (result.skipped) {
    console.log(
      JSON.stringify({
        ok: true,
        skipped: true,
        sha256: result.sha256,
        feedVersionId: result.feedVersionId,
        message: "Bundle SHA already imported; pass --force to reload",
      }),
    );
    return;
  }
  console.log(
    JSON.stringify(
      {
        ok: true,
        skipped: false,
        feedVersionId: result.feedVersionId,
        sha256: result.sha256,
        durationMs: result.durationMs,
        capabilities: result.capabilities,
        files: result.stats,
      },
      null,
      2,
    ),
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
