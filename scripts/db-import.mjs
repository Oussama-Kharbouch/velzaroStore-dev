// Imports the orders of the former site (Cloudflare D1 table `orders`) into orders + order_items.
// Usage: npm run db:import -- <export.sql | export.json | export.csv>
// Existing orders are never modified or deleted: an order whose number already exists is skipped.
//
// Former format, one row per order:
//   id "VZ-<uuid>", name, phone, total, created_at (ISO),
//   address "<ville>\n<adresse>\nLivraison : <frais> DH",
//   items JSON [{"id":"<slug coloris>","size":42,"qty":1,"price":649}]
import { readFileSync } from "node:fs";
import { extname, resolve } from "node:path";
import { openClient, transaction } from "./db.mjs";

const COLUMNS = ["id", "name", "address", "phone", "items", "total", "created_at"];
const file = process.argv[2];
if (!file) {
  console.error("Usage : npm run db:import -- <fichier .sql | .json | .csv>");
  process.exit(1);
}
const source = readFileSync(resolve(process.env.INIT_CWD || process.cwd(), file), "utf8");

/** Reads the INSERT statements of the `orders` table from an SQLite/D1 dump (`wrangler d1 export`). */
function rowsFromSql(sql) {
  const rows = [];
  const insert = /INSERT\s+INTO\s+["`]?orders["`]?\s*(\(([^)]*)\))?\s*VALUES\s*/gi;
  let match;
  while ((match = insert.exec(sql))) {
    const columns = match[2] ? match[2].split(",").map((c) => c.trim().replace(/^["`]|["`]$/g, "")) : COLUMNS;
    let i = insert.lastIndex;
    // One or more "(…)" tuples separated by commas, up to the closing ";".
    while (sql[i] === "(") {
      const values = [];
      i++;
      for (;;) {
        while (/\s/.test(sql[i])) i++;
        if (sql[i] === "'") {
          let value = "";
          for (i++; ; i++) {
            if (sql[i] === "'" && sql[i + 1] === "'") { value += "'"; i++; }
            else if (sql[i] === "'") { i++; break; }
            else if (i >= sql.length) throw new Error("Export SQL tronqué (chaîne non fermée).");
            else value += sql[i];
          }
          values.push(value);
        } else {
          const token = /^[^,)\s]+/.exec(sql.slice(i))[0];
          values.push(/^null$/i.test(token) ? null : Number(token));
          i += token.length;
        }
        while (/\s/.test(sql[i])) i++;
        if (sql[i] === ",") { i++; continue; }
        if (sql[i] === ")") { i++; break; }
        throw new Error(`Export SQL illisible près de : ${sql.slice(i, i + 40)}`);
      }
      rows.push(Object.fromEntries(columns.map((c, k) => [c, values[k]])));
      while (/\s/.test(sql[i])) i++;
      if (sql[i] === ",") { i++; while (/\s/.test(sql[i])) i++; }
    }
    insert.lastIndex = i;
  }
  return rows;
}

function rowsFromJson(text) {
  let data = JSON.parse(text);
  // `wrangler d1 execute --json` wraps rows as [{ results: [...] }].
  if (Array.isArray(data) && data[0]?.results) data = data.flatMap((r) => r.results);
  if (!Array.isArray(data)) data = data.orders ?? data.results ?? [];
  return data;
}

function rowsFromCsv(text) {
  // RFC 4180: quoted fields may contain commas, quotes ("") and line breaks (addresses do).
  const records = [];
  let record = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { record.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      record.push(field); field = "";
      if (record.some((v) => v !== "")) records.push(record);
      record = [];
    } else field += c;
  }
  record.push(field);
  if (record.some((v) => v !== "")) records.push(record);
  const [header, ...body] = records;
  const names = header.map((h) => h.replace(/^﻿/, "").trim());
  return body.map((values) => Object.fromEntries(names.map((n, i) => [n, values[i]])));
}

/** "Casablanca\nRue…\nLivraison : 25 DH" → { city, address, shippingFee } */
function splitAddress(raw) {
  const lines = String(raw).split(/\r?\n/);
  const fee = /^Livraison : (\d+) DH$/.exec(lines.at(-1)?.trim() ?? "");
  if (lines.length >= 3 && fee) {
    return { city: lines[0].trim(), address: lines.slice(1, -1).join("\n").trim(), shippingFee: Number(fee[1]) };
  }
  return { city: "", address: String(raw).trim(), shippingFee: null };
}

const ext = extname(file).toLowerCase();
const rows = ext === ".sql" ? rowsFromSql(source)
  : ext === ".json" ? rowsFromJson(source)
  : ext === ".csv" ? rowsFromCsv(source)
  : (() => { throw new Error("Format non reconnu : utilisez .sql, .json ou .csv"); })();

const client = await openClient();
const { rows: variantRows } = await client.query(
  "SELECT v.id, v.slug, v.color_name, p.name AS product_name FROM variants v JOIN products p ON p.id = v.product_id",
);
const variants = new Map(variantRows.map((v) => [v.slug, v]));
if (!variants.size) throw new Error("Catalogue vide : lancez d'abord `npm run db:seed`.");

let inserted = 0, skipped = 0;
for (const raw of rows) {
  const row = { ...raw, created_at: raw.created_at ?? raw.createdAt };
  const missing = COLUMNS.filter((c) => row[c] === undefined || row[c] === null || row[c] === "");
  if (missing.length) throw new Error(`Commande ${row.id ?? "?"} incomplète (${missing.join(", ")}) : import interrompu, rien n'a été écrit pour elle.`);

  const items = typeof row.items === "string" ? JSON.parse(row.items) : row.items;
  if (!Array.isArray(items) || !items.length) throw new Error(`Commande ${row.id} : aucun article — import interrompu.`);
  const lines = items.map((item) => {
    const variant = variants.get(item.id);
    if (!variant) throw new Error(`Commande ${row.id} : coloris inconnu « ${item.id} » — import interrompu.`);
    const line = { variant, size: Number(item.size), quantity: Number(item.qty), unitPrice: Number(item.price) };
    if (![line.size, line.quantity, line.unitPrice].every((n) => Number.isInteger(n) && n > 0)) {
      throw new Error(`Commande ${row.id} : article incomplet ${JSON.stringify(item)} (pointure, quantité et prix attendus) — import interrompu.`);
    }
    return line;
  });
  const subtotal = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0);
  const total = Number(row.total);
  const { city, address, shippingFee } = splitAddress(row.address);
  const fee = shippingFee ?? total - subtotal;
  if (subtotal + fee !== total) console.warn(`Attention : ${row.id} — total enregistré ${total} DH ≠ ${subtotal} + ${fee} DH ; le total enregistré est conservé.`);

  await transaction(client, async () => {
    const order = await client.query(
      `INSERT INTO orders (order_number, customer_name, phone, city, address, subtotal, shipping_fee, total, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT (order_number) DO NOTHING RETURNING id`,
      [row.id, row.name, row.phone, city, address, subtotal, fee, total, row.created_at],
    );
    if (!order.rowCount) { skipped++; return; }
    await client.query(
      `INSERT INTO order_events (order_id, kind, to_status, message, created_at) VALUES ($1, 'creation', 'en-attente', $2, $3)`,
      [order.rows[0].id, "Commande passée sur l’ancien site (importée).", row.created_at],
    );
    for (const l of lines) {
      await client.query(
        `INSERT INTO order_items (order_id, variant_id, product_name, color_name, size, quantity, unit_price)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [order.rows[0].id, l.variant.id, l.variant.product_name, l.variant.color_name, l.size, l.quantity, l.unitPrice],
      );
    }
    inserted++;
  });
}
const { rows: [{ n }] } = await client.query("SELECT count(*)::int AS n FROM orders");
await client.end();
console.log(`${rows.length} commande(s) lue(s) : ${inserted} importée(s), ${skipped} déjà présente(s). Total en base : ${n}.`);
