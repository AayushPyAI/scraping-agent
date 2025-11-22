import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";
import * as cheerio from "cheerio";
import { Parser } from "json2csv";

const SCHOOL_NAME = "Little Miami High School";
const TARGET_URL = "https://www.littlemiamischools.com/page/board-members";

const clean = (str = "") => str.replace(/\s+/g, " ").trim();
const makeFileName = (name) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, "_");

const FILE_BASE = makeFileName(SCHOOL_NAME);
const OUTPUT_DIR = path.join(process.cwd(), "..", "..", "..", "output");

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

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

    console.log("⏳ Waiting for board cards...");
    await page.waitForSelector(".card-container", { timeout: 60000 });

    // ✅ Works on all Puppeteer versions
    await sleep(1500);

    const html = await page.content();
    const $ = cheerio.load(html);

    const results = [];

    $(".card-container").each((i, el) => {
      const card = $(el);

      const strongText = clean(card.find("strong").text());

      let name = "";
      let job_title = "";

      if (strongText.includes("–")) {
        const parts = strongText.split("–");
        name = clean(parts[0]);
        job_title = clean(parts[1]);
      } else if (strongText.includes("-")) {
        const parts = strongText.split("-");
        name = clean(parts[0]);
        job_title = clean(parts[1]);
      } else {
        name = strongText;
      }

      const email =
        card.find('a[href^="mailto:"]').attr("href")?.replace("mailto:", "") || "";

      if (!name) return;

      results.push({
        school_name: SCHOOL_NAME,
        url: TARGET_URL,
        name,
        job_title,
        email,
      });
    });

    console.log(`✅ Total records found: ${results.length}`);

    if (!results.length) throw new Error("No board members detected");

    const jsonPath = path.join(OUTPUT_DIR, `${FILE_BASE}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));

    const parser = new Parser({
      fields: ["school_name", "url", "name", "job_title", "email"],
    });

    const csv = parser.parse(results);
    fs.writeFileSync(path.join(OUTPUT_DIR, `${FILE_BASE}.csv`), csv);

    console.log("✅ Files saved successfully.");
  } catch (err) {
    console.error("❌ Scraping failed:", err);
  } finally {
    await browser.close();
    console.log("🧹 Browser closed.");
  }
})();
