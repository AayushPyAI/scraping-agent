// Filename: MIAMI_ELEMENTARY_SCHOOL.js
// Scraper for: Miami Elementary School
// URL: https://www.lsc.k12.in.us/directory1

import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";
import * as cheerio from "cheerio";
import { Parser } from "json2csv";

const SCHOOL_NAME = "Miami Elementary School";
const BASE_URL = "https://www.lsc.k12.in.us/directory1";

const clean = (str = "") => str.replace(/\s+/g, " ").trim();

const makeFileName = (name) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, "_");

const FILE_BASE = makeFileName(SCHOOL_NAME);
const OUTPUT_DIR = path.join(process.cwd(), "..", "..", "..", "output");

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// ⚡ Batch size for fast processing
const BATCH_SIZE = 6;

(async () => {
  console.log("🚀 Launching browser...");

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const firstPage = await browser.newPage();
    await firstPage.goto(BASE_URL, { waitUntil: "networkidle2", timeout: 0 });

    await firstPage.waitForSelector(".fsPaginationLabel");

    console.log("🔍 Detecting pagination...");

    const paginationText = await firstPage.$eval(
      ".fsPaginationLabel",
      el => el.innerText
    );

    const totalMatch = paginationText.match(/of\s+(\d+)/i);
    const totalRecords = totalMatch ? parseInt(totalMatch[1]) : 0;
    const perPage = 12;
    const totalPages = Math.ceil(totalRecords / perPage);

    console.log(`📄 Total Records: ${totalRecords}`);
    console.log(`📘 Total Pages: ${totalPages}`);

    const results = [];

    // 🔁 Pagination in batches
    for (let i = 1; i <= totalPages; i += BATCH_SIZE) {
      const pages = [];

      for (let j = i; j < i + BATCH_SIZE && j <= totalPages; j++) {
        pages.push(j);
      }

      console.log(`⚡ Processing pages: ${pages.join(", ")}`);

      await Promise.all(
        pages.map(async (pageNo) => {
          const page = await browser.newPage();
          const url = `${BASE_URL}?const_page=${pageNo}`;

          await page.goto(url, { waitUntil: "networkidle2", timeout: 0 });
          await page.waitForSelector(".fsConstituentItem");

          const html = await page.content();
          const $ = cheerio.load(html);

          $(".fsConstituentItem").each((_, el) => {
            const block = $(el);

            const name = clean(
              block.find("h3.fsFullName a").text()
            );

            const location = clean(
              block.find(".fsLocations").text()
            );

            const emailHref = block.find('.fsEmail a[href^="mailto:"]').attr("href");
            const email = emailHref ? emailHref.replace("mailto:", "") : "";

            if (name) {
              results.push({
                school_name: SCHOOL_NAME,
                url: BASE_URL,
                name,
                location,
                email,
              });
            }
          });

          await page.close();
        })
      );
    }

    console.log(`✅ Total staff extracted: ${results.length}`);

    // ---------------- JSON ----------------
    const jsonPath = path.join(OUTPUT_DIR, `${FILE_BASE}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));

    // ---------------- CSV ----------------
    const parser = new Parser({
      fields: [
        "school_name",
        "url",
        "name",
        "location",
        "email"
      ],
    });

    const csv = parser.parse(results);
    const csvPath = path.join(OUTPUT_DIR, `${FILE_BASE}.csv`);
    fs.writeFileSync(csvPath, csv);

    console.log("🎉 Scraping completed successfully.");
  } catch (error) {
    console.error("❌ Scraping error:", error);
  } finally {
    await browser.close();
    console.log("🧹 Browser closed.");
  }
})();
