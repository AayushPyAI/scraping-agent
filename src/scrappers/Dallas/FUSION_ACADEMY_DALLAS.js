import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";
import * as cheerio from "cheerio";
import { Parser } from "json2csv";

const SCHOOL_NAME = "Fusion Academy Dallas";
const TARGET_URL = "https://www.fusionacademy.com/campuses/dallas/meet-our-team/";

const clean = (str = "") => str.replace(/\s+/g, " ").trim();

const makeFileName = name =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, "_");

const FILE_BASE = makeFileName(SCHOOL_NAME);
const OUTPUT_DIR = path.join(process.cwd(), "..", "..", "..", "output");

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);

(async () => {
  console.log("🚀 Launching browser...");

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();

    await page.goto(TARGET_URL, {
      waitUntil: "networkidle2",
      timeout: 0,
    });

    console.log("⏳ Waiting for staff list...");
    await page.waitForSelector(".staff-item", { timeout: 60000 });

    const html = await page.content();
    const $ = cheerio.load(html);

    const results = [];

    $(".staff-item").each((i, el) => {
      const card = $(el);

      const name = clean(card.find(".content h3").text());
      const job_title = clean(card.find(".content .teacher-info-1").text());

      if (!name) return;

      results.push({
        school_name: SCHOOL_NAME,
        url: TARGET_URL,
        name,
        job_title,
        email: ""
      });
    });

    console.log(`✅ Total staff found: ${results.length}`);

    // Save JSON
    fs.writeFileSync(
      path.join(OUTPUT_DIR, `${FILE_BASE}.json`),
      JSON.stringify(results, null, 2)
    );

    // Save CSV
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
