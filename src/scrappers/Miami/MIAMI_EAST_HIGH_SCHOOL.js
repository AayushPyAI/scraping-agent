import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";
import * as cheerio from "cheerio";
import { Parser } from "json2csv";

const SCHOOL_NAME = "Miami East High School";
const BASE_URL = "https://www.miamieast.k12.oh.us/staff";

const clean = (str = "") => str.replace(/\s+/g, " ").trim();
const sleep = ms => new Promise(res => setTimeout(res, ms));

const makeFileName = name =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, "_");

const FILE_BASE = makeFileName(SCHOOL_NAME);
const OUTPUT_DIR = path.join(process.cwd(), "..", "..", "..", "output");
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);

async function scrapePage(browser, pageNo) {
  const page = await browser.newPage();
  const url = `${BASE_URL}?page_no=${pageNo}`;

  console.log(`🔹 Scraping page ${pageNo}`);

  await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: 0,
  });

  await page.waitForSelector('[data-testid="staff-card"]', { timeout: 60000 });
  await sleep(800);

  const html = await page.content();
  const $ = cheerio.load(html);

  const staff = [];

  $('[data-testid="staff-card"]').each((i, el) => {
    const card = $(el);

    const name = clean(card.find(".name").text());
    const job_title = clean(card.find(".title").text());
    const email = card.find('a[href^="mailto:"]').text().trim();

    if (!name) return;

    staff.push({
      school_name: SCHOOL_NAME,
      url: BASE_URL,
      name,
      job_title,
      email,
    });
  });

  await page.close();
  return staff;
}

(async () => {
  console.log("🚀 Launching browser...");

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 0 });

    console.log("🔍 Detecting total pages...");
    await page.waitForSelector("nav ul li a", { timeout: 60000 });

    const html = await page.content();
    const $ = cheerio.load(html);

    let totalPages = 1;

    $("nav ul li a").each((i, el) => {
      const href = $(el).attr("href");
      if (href && href.includes("page_no=")) {
        const match = href.match(/page_no=(\d+)/);
        if (match) totalPages = Math.max(totalPages, parseInt(match[1]));
      }
    });

    console.log(`✅ Total Pages Found: ${totalPages}`);
    await page.close();

    // 🔥 BATCH PROCESSING
    const BATCH_SIZE = 4; // adjust for speed vs safety
    let allResults = [];

    for (let i = 1; i <= totalPages; i += BATCH_SIZE) {
      const batch = [];

      for (let j = i; j < i + BATCH_SIZE && j <= totalPages; j++) {
        batch.push(scrapePage(browser, j));
      }

      const data = await Promise.all(batch);
      data.forEach(d => allResults.push(...d));
      console.log(`✅ Batch ${i} - ${i + BATCH_SIZE - 1} done`);
    }

    console.log(`✅ Total staff extracted: ${allResults.length}`);

    const jsonPath = path.join(OUTPUT_DIR, `${FILE_BASE}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(allResults, null, 2));

    const parser = new Parser({
      fields: ["school_name", "url", "name", "job_title", "email"],
    });

    const csv = parser.parse(allResults);
    fs.writeFileSync(path.join(OUTPUT_DIR, `${FILE_BASE}.csv`), csv);

    console.log("✅ Files successfully created.");

  } catch (err) {
    console.error("❌ Scraping failed:", err);
  } finally {
    await browser.close();
    console.log("🧹 Browser closed.");
  }
})();
