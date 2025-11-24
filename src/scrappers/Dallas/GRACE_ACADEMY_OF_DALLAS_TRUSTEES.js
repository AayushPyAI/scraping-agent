import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";
import * as cheerio from "cheerio";
import { Parser } from "json2csv";

const SCHOOL_NAME = "Grace Academy of Dallas";
const TARGET_URL = "https://www.graceacademy.com/apps/pages/index.jsp?uREC_ID=462666&type=d";

const clean = (str = "") =>
  str.replace(/\s+/g, " ").trim();

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
    await page.goto(TARGET_URL, { waitUntil: "domcontentloaded", timeout: 0 });

    console.log("⏳ Extracting trustee data...");

    const html = await page.content();
    const $ = cheerio.load(html);

    const results = [];

    $("#trustees div.photo h3").each((i, el) => {
      const text = clean($(el).text());

      if (!text) return;

      let name = "";
      let job_title = "";

      if (text.includes(",")) {
        const parts = text.split(",");
        name = clean(parts[0]);
        job_title = clean(parts.slice(1).join(","));
      } else {
        name = text;
      }

      results.push({
        school_name: SCHOOL_NAME,
        url: TARGET_URL,
        name,
        job_title,
        email: ""
      });
    });

    console.log(`✅ Total trustees found: ${results.length}`);

    // Save JSON
    fs.writeFileSync(
      path.join(OUTPUT_DIR, `${FILE_BASE}.json`),
      JSON.stringify(results, null, 2)
    );

    // Save CSV
    const parser = new Parser({
      fields: ["school_name", "url", "name", "job_title", "email"],
    });

    fs.writeFileSync(
      path.join(OUTPUT_DIR, `${FILE_BASE}.csv`),
      parser.parse(results)
    );

    console.log("✅ Files successfully created.");

  } catch (err) {
    console.error("❌ Scraping failed:", err);
  } finally {
    await browser.close();
    console.log("🧹 Browser closed.");
  }
})();
