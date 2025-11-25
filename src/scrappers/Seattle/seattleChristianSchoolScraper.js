import puppeteer from "puppeteer";
import * as cheerio from "cheerio";
import fs from "fs";
import path from "path";
import { Parser } from "json2csv";
import { fileURLToPath } from "url";

// Fix __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCHOOL_NAME = "Seattle Christian School";
const BASE_URL = "https://www.seaprep.org/about-prep/directory";

// ========= FILE UTILS =========
function makeFileName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const FILE_BASE = makeFileName(SCHOOL_NAME);
const OUTPUT_DIR = path.join(process.cwd(), "..", "..", "..", "output");

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const OUTPUT_JSON = path.join(OUTPUT_DIR, `${FILE_BASE}.json`);
const OUTPUT_CSV = path.join(OUTPUT_DIR, `${FILE_BASE}.csv`);
// =================================

// Number of pages processed simultaneously
const BATCH_SIZE = 3;

// Detect total number of pages dynamically
async function getTotalPages(page) {
  const html = await page.content();
  const $ = cheerio.load(html);

  let maxPage = 1;

  $(".fsElementPagination a[data-page]").each((_, el) => {
    const pageNum = parseInt($(el).attr("data-page"));
    if (!isNaN(pageNum) && pageNum > maxPage) {
      maxPage = pageNum;
    }
  });

  return maxPage;
}

// Scrape a single page
async function scrapePage(browser, pageNumber) {
  const page = await browser.newPage();
  const url = pageNumber === 1 ? BASE_URL : `${BASE_URL}?const_page=${pageNumber}`;

  await page.goto(url, { waitUntil: "networkidle2", timeout: 0 });

  const html = await page.content();
  const $ = cheerio.load(html);

  const results = [];

  $(".fsConstituentItem").each((_, el) => {
    const name = $(el)
      .find(".fsFullName a")
      .text()
      .trim() || "";

    const job_title = $(el)
      .find(".fsTitles")
      .text()
      .trim() || "";

    const email = $(el)
      .find("a[href^='mailto:']")
      .attr("href")
      ? $(el)
          .find("a[href^='mailto:']")
          .attr("href")
          .replace("mailto:", "")
          .trim()
      : "";

    if (name) {
      results.push({
        school_name: SCHOOL_NAME,
        url: BASE_URL,
        name,
        job_title,
        email
      });
    }
  });

  await page.close();
  return results;
}

// MAIN
async function scrapeSeattleChristianSchool() {
  const browser = await puppeteer.launch({ headless: true });
  const firstPage = await browser.newPage();

  console.log("Loading first page...");
  await firstPage.goto(BASE_URL, { waitUntil: "networkidle2", timeout: 0 });

  const totalPages = await getTotalPages(firstPage);
  console.log(`✅ Total Pages Found: ${totalPages}`);

  let allResults = [];

  for (let i = 1; i <= totalPages; i += BATCH_SIZE) {
    const batchTasks = [];

    for (let j = i; j < i + BATCH_SIZE && j <= totalPages; j++) {
      batchTasks.push(scrapePage(browser, j));
    }

    console.log(`⚡ Scraping pages ${i} - ${Math.min(i + BATCH_SIZE - 1, totalPages)}`);
    const batchResults = await Promise.all(batchTasks);
    batchResults.forEach(r => allResults.push(...r));
  }

  // ✅ Save JSON
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(allResults, null, 2), "utf-8");

  // ✅ Save CSV
  const parser = new Parser({
    fields: ["school_name", "url", "name", "job_title", "email"]
  });
  const csv = parser.parse(allResults);
  fs.writeFileSync(OUTPUT_CSV, csv, "utf-8");

  console.log("✅ Scraping finished successfully!");
  console.log("JSON:", OUTPUT_JSON);
  console.log("CSV :", OUTPUT_CSV);

  await browser.close();
}

scrapeSeattleChristianSchool();
