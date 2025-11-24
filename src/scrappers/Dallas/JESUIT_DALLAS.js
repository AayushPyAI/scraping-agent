import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";
import * as cheerio from "cheerio";
import { Parser } from "json2csv";

const SCHOOL_NAME = "Jesuit College Preparatory School of Dallas";
const BASE_URL = "https://www.jesuitdallas.org/about/faculty-staff-directory";

const clean = (str = "") => str.replace(/\s+/g, " ").trim();

const makeFileName = name =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, "_");

const FILE_BASE = makeFileName("Jesuit Dallas");
const OUTPUT_DIR = path.join(process.cwd(), "..", "..", "..", "output");

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);

// Extract one page
async function scrapePage(browser, url) {
  const page = await browser.newPage();

  await page.goto(url, { waitUntil: "networkidle2", timeout: 0 });
  await page.waitForSelector(".fsConstituentItem", { timeout: 60000 });

  const html = await page.content();
  const $ = cheerio.load(html);

  const data = [];

  $(".fsConstituentItem").each((i, el) => {
    const card = $(el);

    const name = clean(card.find(".fsFullName").text());

    const job_title = clean(
      card.find(".fsBiography p")
        .contents()
        .first()
        .text()
    );

    const email =
      card.find('a[href^="mailto:"]')
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
    const firstPage = await browser.newPage();
    await firstPage.goto(BASE_URL, { waitUntil: "networkidle2", timeout: 0 });

    const html = await firstPage.content();
    const $ = cheerio.load(html);

    // Get total pages from pagination
    const lastPage = parseInt(
      $(".fsLastPageLink").attr("data-page") || "1"
    );

    console.log(`📄 Total Pages Found: ${lastPage}`);

    await firstPage.close();

    const results = [];
    const BATCH_SIZE = 4;

    for (let i = 1; i <= lastPage; i += BATCH_SIZE) {
      const batch = [];

      for (let j = i; j < i + BATCH_SIZE && j <= lastPage; j++) {
        const pageUrl = j === 1 ? BASE_URL : `${BASE_URL}?const_page=${j}`;
        batch.push(scrapePage(browser, pageUrl));
      }

      const batchResults = await Promise.all(batch);
      batchResults.forEach(r => results.push(...r));

      console.log(`✅ Processed pages ${i} - ${Math.min(i + BATCH_SIZE - 1, lastPage)}`);
    }

    console.log(`🎯 Total Staff Extracted: ${results.length}`);

    // SAVE JSON
    fs.writeFileSync(
      path.join(OUTPUT_DIR, `${FILE_BASE}.json`),
      JSON.stringify(results, null, 2)
    );

    // SAVE CSV
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
