import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";
import * as cheerio from "cheerio";
import { Parser } from "json2csv";

const SCHOOL_NAME = "Dallas Christian Academy";
const TARGET_URL = "https://dallaschristianacademy.org/about-us/faculty-staff";

const clean = (str = "") => str.replace(/\s+/g, " ").trim();

const makeFileName = name =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, "_");

const FILE_BASE = makeFileName(SCHOOL_NAME);
const OUTPUT_DIR = path.join(process.cwd(), "..", "..", "..", "output");

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);

function extractEmailFromOnclick(onclick = "") {
  // Extracts parts like 'racosta' + '@' + 'dallaschristianacademy.org'
  const match = onclick.match(/'([^']+)'\s*\+\s*'@'\s*\+\s*'([^']+)'/);
  if (!match) return "";
  return `${match[1]}@${match[2]}`;
}

(async () => {
  console.log("🚀 Launching browser...");

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();

    await page.goto(TARGET_URL, {
      waitUntil: "domcontentloaded",
      timeout: 0,
    });

    console.log("⏳ Waiting for staff cards...");
    await page.waitForSelector("section.row.text-center article", { timeout: 60000 });

    const html = await page.content();
    const $ = cheerio.load(html);

    const results = [];

    $("section.row.text-center article").each((i, el) => {
      const card = $(el);

      const name = clean(card.find(".staff-title h3").text());
      const job_title = clean(card.find(".staff-title p").text());

      const onclick = card.find(".staff-img a.email").attr("onclick") || "";
      const email = extractEmailFromOnclick(onclick);

      if (!name) return;

      results.push({
        school_name: SCHOOL_NAME,
        url: TARGET_URL,
        name,
        job_title,
        email,
      });
    });

    console.log(`✅ Total staff found: ${results.length}`);

    const jsonPath = path.join(OUTPUT_DIR, `${FILE_BASE}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));

    const parser = new Parser({
      fields: ["school_name", "url", "name", "job_title", "email"],
    });

    const csv = parser.parse(results);
    fs.writeFileSync(path.join(OUTPUT_DIR, `${FILE_BASE}.csv`), csv);

    console.log("✅ Files successfully created.");

  } catch (err) {
    console.error("❌ Scraping failed:", err);
  } finally {
    await browser.close();
    console.log("🧹 Browser closed.");
  }
})();
