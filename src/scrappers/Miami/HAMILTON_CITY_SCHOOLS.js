import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";
import * as cheerio from "cheerio";
import { Parser } from "json2csv";

const SCHOOL_NAME = "Hamilton City Schools";
const BASE_URL = "https://www.hamiltoncityschools.com/staff-directory1";

const clean = (str = "") => str.replace(/\s+/g, " ").trim();

const makeFileName = (name) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, "_");

const FILE_BASE = makeFileName(SCHOOL_NAME);
const OUTPUT_DIR = path.join(process.cwd(), "..", "..", "..", "output");

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// ----------------------
// 🔥 Batch size control
// ----------------------
const BATCH_SIZE = 5; // pages processed simultaneously

(async () => {
  console.log("🚀 Launching browser...");

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.goto(BASE_URL, { waitUntil: "networkidle2", timeout: 0 });

    console.log("🔍 Detecting total pages...");

    await page.waitForSelector(".fsPaginationLabel");

    const paginationText = await page.$eval(
      ".fsPaginationLabel",
      el => el.innerText
    );

    const totalRecordsMatch = paginationText.match(/of\s+(\d+)/i);
    const totalRecords = totalRecordsMatch ? parseInt(totalRecordsMatch[1]) : 0;
    const perPage = 24;
    const totalPages = Math.ceil(totalRecords / perPage);

    console.log(`📄 Total Records: ${totalRecords}`);
    console.log(`📘 Total Pages: ${totalPages}`);

    const results = [];

    // ----------------------
    // 🔁 Process pages in batches
    // ----------------------
    for (let i = 1; i <= totalPages; i += BATCH_SIZE) {
      const batchPages = [];

      for (let j = i; j < i + BATCH_SIZE && j <= totalPages; j++) {
        batchPages.push(j);
      }

      console.log(`⚡ Processing batch pages: ${batchPages.join(", ")}`);

      const batchPromises = batchPages.map(async (pageNumber) => {
        const batchPage = await browser.newPage();
        const url = `${BASE_URL}?const_page=${pageNumber}`;

        await batchPage.goto(url, { waitUntil: "networkidle2", timeout: 0 });
        await batchPage.waitForSelector(".fsConstituentItem");

        const html = await batchPage.content();
        const $ = cheerio.load(html);

        $(".fsConstituentItem").each((_, el) => {
          const block = $(el);

          const name = clean(
            block.find("h3.fsFullName a").text()
          );

          const title = clean(
            block.find(".fsTitles").text().replace("Titles:", "")
          );

          const location = clean(
            block.find(".fsLocations").text().replace("Locations:", "")
          );

          const emailLink = block.find('.fsEmail a[href^="mailto:"]').attr("href");
          const email = emailLink ? emailLink.replace("mailto:", "") : "";

          if (name) {
            results.push({
              school_name: SCHOOL_NAME,
              url: BASE_URL,
              name,
              title,
              location,
              email,
            });
          }
        });

        await batchPage.close();
      });

      await Promise.all(batchPromises);
    }

    console.log(`✅ Total staff extracted: ${results.length}`);

    // ----------------------
    // ✅ Save JSON
    // ----------------------
    const jsonPath = path.join(OUTPUT_DIR, `${FILE_BASE}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));

    // ----------------------
    // ✅ Save CSV
    // ----------------------
    const parser = new Parser({
      fields: [
        "school_name",
        "url",
        "name",
        "title",
        "location",
        "email"
      ],
    });

    const csv = parser.parse(results);
    const csvPath = path.join(OUTPUT_DIR, `${FILE_BASE}.csv`);
    fs.writeFileSync(csvPath, csv);

    console.log("🎉 Scraping completed successfully.");
  } catch (err) {
    console.error("❌ Error:", err);
  } finally {
    await browser.close();
    console.log("🧹 Browser closed.");
  }
})();
