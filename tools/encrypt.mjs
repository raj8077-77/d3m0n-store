#!/usr/bin/env node
/**
 * Encrypts product JSON to data/products.enc (AES-256-GCM).
 * Used by the GitHub Action every 6 hours, and locally.
 *
 * Sheet CSV columns (header row required):
 * id,name,fullName,images,youtube,description,ai,ours,others,price,marketplaces,keywords
 *
 * images       pipe-separated ImageKit URLs
 * youtube      video id or full URL
 * ai/ours/others  pipe-separated short bullets
 * marketplaces Name|price|disadvantage  separated by ;;
 * keywords     pipe-separated, only the allowed list
 *
 * Optional env:
 *   SHEET_CSV_URL  public Google Sheet CSV export
 *   AES_PASS       must match js/core.js (default below)
 *   SOURCE_JSON    fallback local JSON if no sheet URL
 */
import fs from "fs";
import path from "path";
import crypto from "crypto";
import https from "https";
import http from "http";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PASS = process.env.AES_PASS || "d3m0n.in-products-aes-2026";
const ROOT = path.resolve(__dirname, "..");
const OUT = path.join(ROOT, "data", "products.enc");
const FALLBACK = process.env.SOURCE_JSON || path.join(ROOT, "data", "products.source.json");

const ALLOWED = [
  "n8n automations",
  "Office use",
  "kid safety",
  "freelancer",
  "video editor",
  "photo editor",
  "gamers",
  "apks",
  "prompts",
  "free"
];

function get(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    lib.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(get(res.headers.location));
      }
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    }).on("error", reject);
  });
}

function splitPipe(value) {
  return String(value || "")
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else if (c !== "\r") cell += c;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  const head = rows.shift().map((h) => h.trim());
  return rows.filter((r) => r.some((c) => c.trim())).map((r) => {
    const o = {};
    head.forEach((h, i) => { o[h] = r[i] || ""; });
    return o;
  });
}

function fromCsv(text) {
  const products = parseCsv(text).map((r) => {
    const keywords = splitPipe(r.keywords).filter((k) => ALLOWED.includes(k));
    const marketplaces = String(r.marketplaces || "")
      .split(";;")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((part) => {
        const [name, price, disadvantages] = part.split("|");
        return { name: (name || "").trim(), price: (price || "").trim(), disadvantages: (disadvantages || "").trim() };
      });
    return {
      id: Number(r.id),
      name: r.name.trim(),
      fullName: r.fullName.trim(),
      images: splitPipe(r.images),
      youtube: r.youtube.trim(),
      description: r.description.trim(),
      comparison: {
        ai: splitPipe(r.ai),
        ours: splitPipe(r.ours),
        others: splitPipe(r.others)
      },
      price: r.price.trim(),
      marketplaces,
      keywords
    };
  }).filter((p) => p.id && p.name);
  return {
    updated: new Date().toISOString(),
    homeVideo: process.env.HOME_VIDEO || "fs10aqFTj8I",
    endThumb: process.env.END_THUMB || "https://ik.imagekit.io/silentgamers/Picsart_26-10-03_01-10-53-728.png?updatedAt=1790970088467&ik-s=c4c24733bafe4307af58f374b0cdad56440caf6e",
    notice: process.env.NOTICE || "Full files are sent on Telegram after WhatsApp confirmation. This page only shows public details.",
    offer: Number(process.env.OFFER || products[0] && products[0].id || 0) || null,
    products
  };
}

function encrypt(obj) {
  const key = crypto.createHash("sha256").update(PASS).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(obj), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, body, tag]).toString("base64");
}

async function main() {
  let payload;
  if (process.env.SHEET_CSV_URL) {
    payload = fromCsv(await get(process.env.SHEET_CSV_URL));
  } else if (fs.existsSync(FALLBACK)) {
    payload = JSON.parse(fs.readFileSync(FALLBACK, "utf8"));
    payload.updated = new Date().toISOString();
  } else {
    throw new Error("Set SHEET_CSV_URL or provide data/products.source.json");
  }
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, encrypt(payload));
  console.log("wrote", OUT, "products", (payload.products || []).length);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
