import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";
import * as cheerio from "cheerio";
import { Parser } from "json2csv";

const SCHOOL_NAME = "New Miami High School";
const BASE_URL = "https://www.new-miami.k12.oh.us/directory";

const clean = (str = "") => str.replace(/\s+/g, " ").trim();
const sleep = ms => new Promise(res => setTimeout(res, ms));

const makeFileName = name =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, "_");

const FILE_BASE = makeFileName(SCHOOL_NAME);
const OUTPUT_DIR = path.join(process.cwd(), "..", "..", "..", "output");

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);

async function scrapePage(browser, pageNo) {
  const page = await browser.newPage();
  const url = `${BASE_URL}?const_page=${pageNo}`;

  console.log(`🔹 Scraping page ${pageNo}`);

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 0 });
  await page.waitForSelector(".fsConstituentItem", { timeout: 60000 });
  await sleep(700);

  const html = await page.content();
  const $ = cheerio.load(html);

  const results = [];

  $(".fsConstituentItem").each((i, el) => {
    const card = $(el);

    const name = clean(card.find(".fsFullName").text());

    let job_title = clean(
      card.find(".fsTitles").text().replace("Titles:", "")
    );

    const email = card
      .find('.fsEmail a[href^="mailto:"]')
      .attr("href")
      ?.replace("mailto:", "") || "";

    if (!name) return;

    results.push({
      school_name: SCHOOL_NAME,
      url: BASE_URL,
      name,
      job_title,
      email
    });
  });

  await page.close();
  return results;
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
    await page.waitForSelector(".fsElementPagination", { timeout: 60000 });

    const html = await page.content();
    const $ = cheerio.load(html);

    let totalPages = 1;

    $(".fsElementPagination a").each((i, el) => {
      const dp = $(el).attr("data-page");
      if (dp && !isNaN(dp)) {
        totalPages = Math.max(totalPages, parseInt(dp));
      }
    });

    console.log(`✅ Total Pages Found: ${totalPages}`);
    await page.close();

    // ⚡ BATCH PROCESSING
    const BATCH_SIZE = 5;
    let allResults = [];

    for (let i = 1; i <= totalPages; i += BATCH_SIZE) {
      const tasks = [];

      for (let j = i; j < i + BATCH_SIZE && j <= totalPages; j++) {
        tasks.push(scrapePage(browser, j));
      }

      const batchData = await Promise.all(tasks);
      batchData.forEach(d => allResults.push(...d));

      console.log(`✅ Pages ${i} to ${Math.min(i + BATCH_SIZE - 1, totalPages)} completed`);
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
