import puppeteer from "puppeteer";
import * as cheerio from "cheerio";
import fs from "fs";
import path from "path";
import { Parser } from "json2csv";
import { fileURLToPath } from "url";

// Fix __dirname for ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCHOOL_NAME = "Seattle Preparatory School";
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

// Get total pages from pagination
async function getTotalPages(page) {
  const html = await page.content();
  const $ = cheerio.load(html);

  let maxPage = 1;

  $(".fsElementPagination a[data-page]").each((_, el) => {
    const pageNum = parseInt($(el).attr("data-page"));
    if (pageNum > maxPage) maxPage = pageNum;
  });

  return maxPage;
}

// Scrape single page
async function scrapePage(browser, pageNumber) {
  const page = await browser.newPage();
  const url = pageNumber === 1 ? BASE_URL : `${BASE_URL}?const_page=${pageNumber}`;

  await page.goto(url, { waitUntil: "networkidle2", timeout: 0 });

  const html = await page.content();
  const $ = cheerio.load(html);

  const data = [];

  $(".fsConstituentItem").each((_, element) => {
    const name = $(element)
      .find(".fsFullName a")
      .text()
      .trim() || "";

    const job_title = $(element)
      .find(".fsTitles")
      .text()
      .trim() || "";

    const email = $(element)
      .find("a[href^='mailto:']")
      .attr("href")
      ? $(element)
          .find("a[href^='mailto:']")
          .attr("href")
          .replace("mailto:", "")
          .trim()
      : "";

    if (name) {
      data.push({
        school_name: SCHOOL_NAME,
        url: BASE_URL,
        name,
        job_title,
        email
      });
    }
  });

  await page.close();
  return data;
}

// Main scraper
async function scrapeSeattlePrepDirectory() {
  const browser = await puppeteer.launch({ headless: true });
  const firstPage = await browser.newPage();

  console.log("Loading initial page...");
  await firstPage.goto(BASE_URL, { waitUntil: "networkidle2", timeout: 0 });

  const totalPages = await getTotalPages(firstPage);
  console.log(`✅ Total Pages Found: ${totalPages}`);

  let finalResults = [];

  for (let i = 1; i <= totalPages; i += BATCH_SIZE) {
    const batch = [];

    for (let j = i; j < i + BATCH_SIZE && j <= totalPages; j++) {
      batch.push(scrapePage(browser, j));
    }

    console.log(`⚡ Processing pages ${i} to ${Math.min(i + BATCH_SIZE - 1, totalPages)}...`);
    const batchResults = await Promise.all(batch);
    batchResults.forEach(r => finalResults.push(...r));
  }

  // ✅ Save JSON
  fs.writeFileSync(OUTPUT_JSON, JSON.stringify(finalResults, null, 2), "utf-8");

  // ✅ Save CSV
  const parser = new Parser({
    fields: ["school_name", "url", "name", "job_title", "email"]
  });
  const csv = parser.parse(finalResults);
  fs.writeFileSync(OUTPUT_CSV, csv, "utf-8");

  console.log("✅ Scraping completed successfully!");
  console.log("JSON:", OUTPUT_JSON);
  console.log("CSV :", OUTPUT_CSV);

  await browser.close();
}

scrapeSeattlePrepDirectory();
