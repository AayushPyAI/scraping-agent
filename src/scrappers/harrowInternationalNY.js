import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";
import * as cheerio from "cheerio";
import { Parser } from "json2csv";

const clean = (str = "") =>
  str.replace(/\s+/g, " ").replace(/(\n|\t|\r)/g, "").trim();

async function scrapeHarrowNY() {
  const schoolName = "Harrow International School New York";
  const url = "https://www.harrownewyork.com/about-us/faculty";

  console.log("Launching browser...");

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "networkidle2", timeout: 0 });

  const html = await page.content();
  const $ = cheerio.load(html);

  let results = [];

  console.log("Extracting faculty items…");

  $("div.fsConstituentItem").each((i, el) => {
    const name = clean($(el).find(".fsFullName").text());
    const job_title = clean($(el).find(".fsTitles").text());

    let email = clean($(el).find(".fsEmail a[href^='mailto:']").attr("href") || "");
    if (email) {
      email = email.replace("mailto:", "").trim();
    }

    if (!name) return;

    results.push({
      school_name: schoolName,
      url,
      name,
      job_title,
      email
    });
  });

  console.log("Total faculty found:", results.length);

  // ---------------------------------------
  // Save JSON + CSV into /output folder
  // ---------------------------------------
  const projectRoot = path.join(process.cwd(), "..", "..");
  const outputDir = path.join(projectRoot, "output");

  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

  const safeName = schoolName.replace(/\s+/g, "_").toLowerCase();

  const jsonFile = path.join(outputDir, `${safeName}.json`);
  const csvFile = path.join(outputDir, `${safeName}.csv`);

  // JSON
  fs.writeFileSync(jsonFile, JSON.stringify(results, null, 2));

  // CSV
  const parser = new Parser();
  fs.writeFileSync(csvFile, parser.parse(results));

  console.log("DONE → Saved to /output");

  await browser.close();
}

scrapeHarrowNY().catch((err) => console.error(err));
