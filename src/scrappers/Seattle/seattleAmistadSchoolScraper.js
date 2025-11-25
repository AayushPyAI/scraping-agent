import puppeteer from "puppeteer";
import * as cheerio from "cheerio";
import fs from "fs";
import path from "path";
import { Parser } from "json2csv";
import { fileURLToPath } from "url";

// Fix __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCHOOL_NAME = "Seattle Amistad School";
const TARGET_URL = "https://seattleamistadschool.org/admissions";

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
// ==============================

async function scrapeSeattleAmistadSchool() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  console.log("Opening:", TARGET_URL);
  await page.goto(TARGET_URL, { waitUntil: "networkidle2", timeout: 0 });

  const html = await page.content();
  const $ = cheerio.load(html);

  const results = [];

  $(".list-item-content").each((_, element) => {
    const name = $(element)
      .find(".list-item-content__title")
      .first()
      .text()
      .trim() || "";

    const job_title = $(element)
      .find(".list-item-content__description p")
      .first()
      .text()
      .replace(/\s+/g, " ")
      .replace(/"/g, "")
      .trim() || "";

    const email = ""; // Not present on page

    if (name) {
      results.push({
        school_name: SCHOOL_NAME,
        url: TARGET_URL,
        name,
        job_title,
        email
      });
    }
  });

  // ✅ Save JSON
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(results, null, 2), "utf-8");

  // ✅ Save CSV
  const parser = new Parser({
    fields: ["school_name", "url", "name", "job_title", "email"]
  });
  const csv = parser.parse(results);
  fs.writeFileSync(OUTPUT_CSV, csv, "utf-8");

  console.log("✅ Scraping completed!");
  console.log("JSON:", OUTPUT_JSON);
  console.log("CSV :", OUTPUT_CSV);

  await browser.close();
}

scrapeSeattleAmistadSchool();
