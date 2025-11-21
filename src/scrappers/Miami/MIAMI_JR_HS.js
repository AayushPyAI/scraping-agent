
import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";
import * as cheerio from "cheerio";
import { Parser } from "json2csv";

const SCHOOL_NAME = "MIAMI JR HS";
const TARGET_URL = "https://miamiwardogs.com/about/leadership-team/";

// ------------------------------
// 👉 Helper: normalize text
// ------------------------------
const clean = (str = "") => str.replace(/\s+/g, " ").trim();

// ------------------------------
// 👉 Create safe filename
// ------------------------------
const makeFileName = (name) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, "_");

const FILE_BASE = makeFileName(SCHOOL_NAME);

// Output folder (root/output)
const OUTPUT_DIR = path.join(process.cwd(), "..", "..", "..", "output");

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR);
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
      waitUntil: "domcontentloaded",
      timeout: 0,
    });

    console.log("Page loaded, extracting HTML...");

    const content = await page.content();
    const $ = cheerio.load(content);

    const results = [];

    // Each leadership block pattern
    $(
      '.elementor-widget-heading:has(h3)'
    ).each((i, el) => {
      const name = clean($(el).find("h3").text());

      const infoBlock = $(el)
        .parent()
        .find('.elementor-widget-text-editor');

      const job_title = clean(infoBlock.find("em").text());
      const email = clean(infoBlock.find("a[href^=\"mailto:\"]").text());

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

    console.log(`Total records found: ${results.length}`);

    if (!results.length) {
      console.warn("⚠️ No data extracted. Please check selector structure.");
      return;
    }

    // ------------------------------
    // 👉 Save JSON
    // ------------------------------
    const jsonPath = path.join(OUTPUT_DIR, `${FILE_BASE}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));

    console.log(`✅ JSON saved: ${jsonPath}`);

    // ------------------------------
    // 👉 Save CSV
    // ------------------------------
    const fields = [
      "school_name",
      "url",
      "name",
      "job_title",
      "email",
    ];

    const parser = new Parser({ fields });
    const csv = parser.parse(results);

    const csvPath = path.join(OUTPUT_DIR, `${FILE_BASE}.csv`);
    fs.writeFileSync(csvPath, csv);

    console.log(`✅ CSV saved: ${csvPath}`);
  } catch (error) {
    console.error("❌ Scraping failed:", error);
  } finally {
    await browser.close();
    console.log("Browser closed.");
  }
})();
