import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";
import * as cheerio from "cheerio";
import { Parser } from "json2csv";

// Helper to clean text
const clean = (str = "") =>
  str.replace(/\s+/g, " ").replace(/(\r|\n|\t)/g, "").trim();

async function scrapeUSD497() {
  const schoolName = "New York Elementary School";
  const baseUrl = "https://www.usd497.org/staff";

  console.log("Launching browser...");

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  await page.goto(baseUrl, { waitUntil: "networkidle2", timeout: 0 });

  console.log("Extracting HTML…");
  const html = await page.content();
  const $ = cheerio.load(html);

  const results = [];

  console.log("Parsing staff entries...");

  // All staff entries
  $("div.fsConstituentItem").each((i, el) => {
    const name = clean($(el).find(".fsFullName").text());
    const job_title = clean($(el).find(".fsTitles").text());

    // Extract email from mailto link
    const email = clean($(el).find('a[href^="mailto:"]').attr("href")?.replace("mailto:", "") || "");

    results.push({
      school_name: schoolName,
      url: baseUrl,
      name,
      job_title,
      email,
    });
  });

  console.log(`Extracted ${results.length} staff members.`);

  // ------------------------------------
  // Save into root /output folder
  // ------------------------------------
  const projectRoot = path.join(process.cwd(), "..", "..");
  const outputDir = path.join(projectRoot, "output");

  if (!fs.existsSync(outputDir)) {
    console.log("Creating output folder...");
    fs.mkdirSync(outputDir);
  }

  const safeName = schoolName.replace(/\s+/g, "_").toLowerCase();

  const jsonFile = path.join(outputDir, `${safeName}.json`);
  const csvFile = path.join(outputDir, `${safeName}.csv`);

  fs.writeFileSync(jsonFile, JSON.stringify(results, null, 2));

  const parser = new Parser();
  fs.writeFileSync(csvFile, parser.parse(results));

  console.log("Saved JSON + CSV into root /output folder.");
  await browser.close();
}

scrapeUSD497().catch((err) => console.error(err));
