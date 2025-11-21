// Filename: MIAMI_DADE_SCHOOL_BOARD.js

import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";
import * as cheerio from "cheerio";
import { Parser } from "json2csv";

const SCHOOL_NAME = "Miami-Dade School Board";
const TARGET_URL = "https://www3.dadeschools.net/SchoolBoard/members";

const clean = (str = "") => str.replace(/\s+/g, " ").trim();

const makeFileName = (name) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, "_");

const FILE_BASE = makeFileName(SCHOOL_NAME);
const OUTPUT_DIR = path.join(process.cwd(), "..", "..", "..", "output");

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

(async () => {
  console.log("Launching browser...");

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

    console.log("Waiting for board members to render...");

    // ✅ WAIT FIRST - IMPORTANT
    await page.waitForSelector("div.card.mx-auto.full-height", {
      timeout: 20000,
    });

    console.log("Extracting HTML...");
    const content = await page.content();
    const $ = cheerio.load(content);

    const results = [];

    $("div.card.mx-auto.full-height").each((i, el) => {
      const card = $(el);

      const name = clean(card.find("h4.text-center").first().text());
      const job_title = clean(card.find("h5.text-uppercase").text());
      
      const emailLink = card.find('a[href^="mailto:"]').attr("href");
      const email = emailLink ? emailLink.replace("mailto:", "") : "";

      if (name) {
        results.push({
          school_name: SCHOOL_NAME,
          url: TARGET_URL,
          name,
          job_title,
          email,
        });
      }
    });

    console.log(`✅ Total records found: ${results.length}`);

    if (!results.length) {
      console.warn("⚠️ No data extracted. Selector issue.");
      return;
    }

    // ✅ JSON
    const jsonPath = path.join(OUTPUT_DIR, `${FILE_BASE}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));

    // ✅ CSV
    const parser = new Parser({
      fields: ["school_name", "url", "name", "job_title", "email"],
    });
    const csv = parser.parse(results);

    const csvPath = path.join(OUTPUT_DIR, `${FILE_BASE}.csv`);
    fs.writeFileSync(csvPath, csv);

    console.log("✅ Data successfully saved");
  } catch (error) {
    console.error("❌ Scraping failed:", error);
  } finally {
    await browser.close();
    console.log("Browser closed.");
  }
})();
