// Writes every order with its items to exports/ as JSON and CSV (backup, or to process orders in a spreadsheet).
// Usage: npm run db:export
import { mkdirSync, writeFileSync } from "node:fs";
import { openClient } from "./db.mjs";

const client = await openClient();
const { rows: orders } = await client.query(`
  SELECT o.order_number, o.status, o.created_at, o.customer_name, o.phone, o.city, o.address,
         o.subtotal, o.shipping_fee, o.total,
         coalesce(json_agg(json_build_object(
           'product', i.product_name, 'color', i.color_name, 'size', i.size,
           'quantity', i.quantity, 'unit_price', i.unit_price) ORDER BY i.id)
           FILTER (WHERE i.id IS NOT NULL), '[]') AS items
  FROM orders o LEFT JOIN order_items i ON i.order_id = o.id
  GROUP BY o.id ORDER BY o.created_at`);
await client.end();

const columns = ["order_number", "status", "created_at", "customer_name", "phone", "city", "address", "subtotal", "shipping_fee", "total", "items"];
const cell = (v) => `"${String(v).replace(/"/g, '""')}"`;
const describe = (items) => items.map((i) => `${i.product} ${i.color} — pointure ${i.size} × ${i.quantity}`).join(" ; ");
const csv = [columns.join(","), ...orders.map((o) => columns.map((c) =>
  cell(c === "items" ? describe(o.items) : c === "created_at" ? o.created_at.toISOString() : o[c])).join(","))].join("\r\n");

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
mkdirSync("exports", { recursive: true });
writeFileSync(`exports/orders-${stamp}.json`, JSON.stringify(orders, null, 2) + "\n");
writeFileSync(`exports/orders-${stamp}.csv`, "﻿" + csv + "\r\n");
console.log(`${orders.length} commande(s) exportée(s) dans exports/orders-${stamp}.{json,csv}`);
