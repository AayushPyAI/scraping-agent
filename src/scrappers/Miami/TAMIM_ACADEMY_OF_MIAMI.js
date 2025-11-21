// Filename: TAMIM_ACADEMY_OF_MIAMI.js
// Scraper for: Tamim Academy of Miami
// URL: https://www.tamimmiami.org/staff/

import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";
import * as cheerio from "cheerio";
import { Parser } from "json2csv";

const SCHOOL_NAME = "Tamim Academy of Miami";
const TARGET_URL = "https://www.tamimmiami.org/staff/";

const clean = (str = "") => str.replace(/\s+/g, " ").trim();
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const makeFileName = (name) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, "_");

const FILE_BASE = makeFileName(SCHOOL_NAME);
const OUTPUT_DIR = path.join(process.cwd(), "..", "..", "..", "output");

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

(async () => {
  console.log("🚀 Launching browser...");

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  try {
    const page = await browser.newPage();

    await page.goto(TARGET_URL, {
      waitUntil: "networkidle2",
      timeout: 0
    });

    console.log("⏳ Extracting staff data...");
    await sleep(1500);

    const html = await page.content();
    const $ = cheerio.load(html);

    const results = [];

    $("div.sc_team_item_info").each((_, el) => {
      const block = $(el);

      const name =
        clean(block.find(".sc_team_item_title a").text()) || "";

      const job_title =
        clean(block.find(".sc_team_item_position p").text()) || "";

      const emailHref = block.find('a[href^="mailto:"]').attr("href");
      const email = emailHref ? emailHref.replace("mailto:", "") : "";

      results.push({
        school_name: SCHOOL_NAME,
        url: TARGET_URL,
        name,
        job_title,
        email
      });
    });

    console.log(`✅ Total staff extracted: ${results.length}`);

    if (!results.length) {
      console.warn("⚠️ No data extracted. Structure may have changed.");
      return;
    }

    // ---------- SAVE JSON ----------
    const jsonPath = path.join(OUTPUT_DIR, `${FILE_BASE}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));

    // ---------- SAVE CSV ----------
    const parser = new Parser({
      fields: [
        "school_name",
        "url",
        "name",
        "job_title",
        "email"
      ]
    });

    const csv = parser.parse(results);
    const csvPath = path.join(OUTPUT_DIR, `${FILE_BASE}.csv`);
    fs.writeFileSync(csvPath, csv);

    console.log("🎉 Scraping completed successfully.");
  } catch (error) {
    console.error("❌ Scraping failed:", error);
  } finally {
    await browser.close();
    console.log("🧹 Browser closed.");
  }
})();
