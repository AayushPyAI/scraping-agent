// Filename: MIAMI_SPRINGS_MIDDLE_SCHOOL.js
// Scraper for: Miami Springs Middle School
// URL: https://miamispringsmiddle.net/faculty-and-staff-directory/

import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";
import * as cheerio from "cheerio";
import { Parser } from "json2csv";

const SCHOOL_NAME = "Miami Springs Middle School";
const TARGET_URL = "https://miamispringsmiddle.net/faculty-and-staff-directory/";

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
    await sleep(1200);

    const html = await page.content();
    const $ = cheerio.load(html);

    const results = [];

    $("figcaption.wpzabb-member-caption").each((_, el) => {
      const block = $(el);

      const name = clean(block.find(".wpzabb-member-name-text").text()) || "";
      const job_title = clean(block.find(".wpzabb-member-position").text()) || "";

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
