// TEXANS CAN ACADEMY - DALLAS PLEASANT GROVE SCRAPER
// URL: https://www.texanscan.org/o/dallas/staff

import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";
import * as cheerio from "cheerio";
import { Parser } from "json2csv";

const SCHOOL_NAME = "Texans Can Academy - Dallas Pleasant Grove";
const TARGET_URL = "https://www.texanscan.org/o/dallas/staff";

const clean = (str = "") => str.replace(/\s+/g, " ").trim();
const sleep = ms => new Promise(res => setTimeout(res, ms));

const makeFileName = name => name.toLowerCase().replace(/[^a-z0-9]+/g, "_");

const FILE_BASE = makeFileName(SCHOOL_NAME);
const OUTPUT_DIR = path.join(process.cwd(), "..", "..", "..", "output");

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

async function getTotalPages(page) {
  return await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('.cms-pagination a'))
      .map(a => a.textContent.trim())
      .filter(n => !isNaN(n));
    return links.length ? Math.max(...links.map(Number)) : 1;
  });
}

async function scrapePage(browser, pageNumber) {
  const page = await browser.newPage();
  const url = pageNumber === 1 ? TARGET_URL : `${TARGET_URL}?page_no=${pageNumber}`;

  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 0 });
  await page.waitForSelector('.contact-box', { timeout: 60000 });
  await sleep(1000);

  const html = await page.content();
  const $ = cheerio.load(html);

  const batchResults = [];

  $('.contact-box').each((_, el) => {
    const card = $(el);

    const name = clean(card.find('.name').text());
    const job_title = clean(card.find('.title').text());

    const email =
      card
        .find('.email a')
        .attr('href')?.replace('mailto:', '') || '';

    const phone = clean(card.find('.phone').text());

    if (!name) return;

    batchResults.push({
      school_name: SCHOOL_NAME,
      url: TARGET_URL,
      name,
      job_title,
      phone,
      email
    });
  });

  await page.close();
  return batchResults;
}

(async () => {
  console.log("🚀 Launching browser...");

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  try {
    const page = await browser.newPage();
    await page.goto(TARGET_URL, { waitUntil: "domcontentloaded", timeout: 0 });

    const totalPages = await getTotalPages(page);
    console.log(`📄 Total pages detected: ${totalPages}`);

    let results = [];

    for (let i = 1; i <= totalPages; i++) {
      console.log(`📥 Scraping page ${i}/${totalPages}...`);
      const batch = await scrapePage(browser, i);
      results = results.concat(batch);
    }

    console.log(`✅ Total staff extracted: ${results.length}`);

    // Save JSON
    const jsonPath = path.join(OUTPUT_DIR, `${FILE_BASE}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));

    // Save CSV
    const parser = new Parser({
      fields: ["school_name", "url", "name", "job_title", "phone", "email"]
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
