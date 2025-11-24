import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";
import * as cheerio from "cheerio";
import { Parser } from "json2csv";

const SCHOOL_NAME = "Texans Can Academy - Dallas North";
const BASE_URL = "https://www.texanscan.org/o/dallas/staff";

const clean = (str = "") => str.replace(/\s+/g, " ").trim();

const makeFileName = name =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, "_");

const FILE_BASE = makeFileName(SCHOOL_NAME);
const OUTPUT_DIR = path.join(process.cwd(), "..", "..", "..", "output");

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);

// Scrape single page
async function scrapePage(browser, url) {
  const page = await browser.newPage();

  await page.goto(url, { waitUntil: "networkidle2", timeout: 0 });
  await page.waitForSelector('[data-testid="staff-card"]', { timeout: 60000 });

  const html = await page.content();
  const $ = cheerio.load(html);

  const data = [];

  $('[data-testid="staff-card"]').each((i, el) => {
    const card = $(el);

    const name = clean(card.find(".staff-info .name").text());
    const job_title = clean(card.find(".staff-info .title").text());

    const email =
      card
        .find(".staff-info .email a[href^='mailto:']")
        .attr("href")
        ?.replace("mailto:", "") || "";

    if (!name) return;

    data.push({
      school_name: SCHOOL_NAME,
      url,
      name,
      job_title,
      email,
    });
  });

  await page.close();
  return data;
}

(async () => {
  console.log("🚀 Launching browser...");

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    // Determine total pages
    const page = await browser.newPage();
    await page.goto(BASE_URL, { waitUntil: "networkidle2", timeout: 0 });

    const html = await page.content();
    const $ = cheerio.load(html);

    let lastPage = 1;

    $(".cms-pagination a").each((i, el) => {
      const href = $(el).attr("href") || "";
      const match = href.match(/page_no=(\d+)/);
      if (match) {
        const num = parseInt(match[1]);
        if (num > lastPage) lastPage = num;
      }
    });

    console.log(`📄 Total Pages Found: ${lastPage}`);
    await page.close();

    const results = [];
    const BATCH_SIZE = 5;

    for (let i = 1; i <= lastPage; i += BATCH_SIZE) {
      const batch = [];

      for (let j = i; j < i + BATCH_SIZE && j <= lastPage; j++) {
        const pageUrl =
          j === 1 ? BASE_URL : `${BASE_URL}?page_no=${j}`;
        batch.push(scrapePage(browser, pageUrl));
      }

      const batchResults = await Promise.all(batch);
      batchResults.forEach(r => results.push(...r));

      console.log(`✅ Processed pages ${i} - ${Math.min(i + BATCH_SIZE - 1, lastPage)}`);
    }

    console.log(`🎯 Total Staff Extracted: ${results.length}`);

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
