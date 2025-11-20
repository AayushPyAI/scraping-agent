import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";
import * as cheerio from "cheerio";
import { Parser } from "json2csv";

// ------------------------------
// Helper to clean text
// ------------------------------
const clean = (str = "") =>
  str.replace(/\s+/g, " ").replace(/(\r|\n|\t)/g, "").trim();

// ------------------------------
// Main Scraper Function
// ------------------------------
async function scrapeHarborSchoolDirectory() {
  const schoolName = "New York Harbor School";
  const url = "https://www.newyorkharborschool.org/directory";

  console.log("Launching browser…");

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();

  console.log("Visiting:", url);
  await page.goto(url, { waitUntil: "networkidle2", timeout: 0 });

  console.log("Extracting HTML...");
  const html = await page.content();

  const $ = cheerio.load(html);

  console.log("Parsing staff blocks…");

  const results = [];

  const staffBlocks = $(
    "[data-mesh-id*='inlineContent-gridContainer']"
  ).children("div");

  let temp = {};

  staffBlocks.each((i, el) => {
    const text = clean($(el).text());

    // NAME BLOCK (bold)
    if ($(el).find("span[style*='font-weight:bold']").length > 0) {
      temp.name = clean($(el).text());
      return;
    }

    // EMAIL BLOCK (contains mailto link)
    const mailLink = $(el).find("a[href^='mailto:']").attr("href");
    if (mailLink) {
      temp.email = mailLink.replace("mailto:", "").trim();
      return;
    }

    // JOB TITLE BLOCK
    if (
      text &&
      temp.name &&
      temp.email &&
      text.length < 100 &&
      /principal|teacher|director|manager|coordinator/i.test(text)
    ) {
      temp.job_title = text;

      // Push record
      results.push({
        school_name: schoolName,
        url,
        name: temp.name || "",
        job_title: temp.job_title || "",
        email: temp.email || "",
      });

      temp = {};
    }
  });

  console.log(`Found ${results.length} staff members`);

  // ------------------------------
  // Create Output Folder
  // ------------------------------
  const outputDir = path.join(process.cwd(), "..", "..", "output");
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

  const safeName = schoolName.replace(/\s+/g, "_").toLowerCase();

  const jsonFile = path.join(outputDir, `${safeName}_faculty.json`);
  const csvFile = path.join(outputDir, `${safeName}_faculty.csv`);

  // ------------------------------
  // Save JSON
  // ------------------------------
  console.log("Saving JSON:", jsonFile);
  fs.writeFileSync(jsonFile, JSON.stringify(results, null, 2));

  // ------------------------------
  // Save CSV
  // ------------------------------
  console.log("Saving CSV:", csvFile);
  const parser = new Parser();
  const csv = parser.parse(results);
  fs.writeFileSync(csvFile, csv);

  console.log("All files saved inside /output folder.");
  console.log("Scraping completed.");

  await browser.close();
}

scrapeHarborSchoolDirectory().catch((err) => {
  console.error("Error:", err);
});
