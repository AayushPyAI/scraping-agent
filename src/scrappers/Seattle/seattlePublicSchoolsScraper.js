import puppeteer from "puppeteer";
import * as cheerio from "cheerio";
import fs from "fs";
import path from "path";
import { Parser } from "json2csv";
import { fileURLToPath } from "url";

// Fix __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCHOOL_NAME = "Seattle Public Schools";
const TARGET_URL = "https://www.seattleschools.org/about/leadership/";

// ========= FILE UTILS =========
function makeFileName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const FILE_BASE = makeFileName(SCHOOL_NAME);
const OUTPUT_DIR = path.join(process.cwd(), "..", "..", "..", "output");

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const OUTPUT_JSON = path.join(OUTPUT_DIR, `${FILE_BASE}.json`);
const OUTPUT_CSV = path.join(OUTPUT_DIR, `${FILE_BASE}.csv`);
// =============================

async function scrapeSeattlePublicSchools() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  console.log("Opening:", TARGET_URL);
  await page.goto(TARGET_URL, { waitUntil: "networkidle2", timeout: 0 });

  const html = await page.content();
  const $ = cheerio.load(html);

  const results = [];

  // Each leadership block
  $(".wp-block-column").each((_, element) => {
    const name = $(element)
      .find("h4")
      .first()
      .text()
      .trim() || "";

    const job_title = $(element)
      .find("p")
      .first()
      .text()
      .trim() || "";

    // No visible email in structure → keep empty
    const email = "";

    if (name || job_title) {
      results.push({
        school_name: SCHOOL_NAME,
        url: TARGET_URL,
        name,
        job_title,
        email
      });
    }
  });

  // ✅ Write JSON
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(results, null, 2), "utf-8");

  // ✅ Write CSV
  const parser = new Parser({
    fields: ["school_name", "url", "name", "job_title", "email"]
  });
  const csv = parser.parse(results);
  fs.writeFileSync(OUTPUT_CSV, csv, "utf-8");

  console.log("✅ Scraping complete!");
  console.log("JSON:", OUTPUT_JSON);
  console.log("CSV :", OUTPUT_CSV);

  await browser.close();
}

scrapeSeattlePublicSchools();
