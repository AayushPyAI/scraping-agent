import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";
import * as cheerio from "cheerio";
import { Parser } from "json2csv";

const clean = (str = "") =>
  str.replace(/\s+/g, " ").replace(/(\n|\t|\r)/g, "").trim();

async function scrapeClarkeSchoolsNY() {
  const schoolName = "Clarke Schools for Hearing and Speech in New York";
  const url = "https://www.clarkeschools.org/about-us/board-of-trustees/";

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

  // Staff blocks
  $("div.card-body.text-center").each((i, el) => {
    const name = clean($(el).find(".pix-member-name").text());
    const job_title = clean($(el).find(".pix-member-title").text());

    // No email present anywhere
    const email = "";

    if (!name) return;

    results.push({
      school_name: schoolName,
      url,
      name,
      job_title,
      email
    });
  });

  console.log("Found members:", results.length);

  // -----------------------------
  // Save JSON & CSV in /output
  // -----------------------------
  const projectRoot = path.join(process.cwd(), "..", "..");
  const outputDir = path.join(projectRoot, "output");

  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

  const safeName = schoolName.replace(/\s+/g, "_").toLowerCase();

  const jsonFile = path.join(outputDir, `${safeName}.json`);
  const csvFile = path.join(outputDir, `${safeName}.csv`);

  fs.writeFileSync(jsonFile, JSON.stringify(results, null, 2));

  const parser = new Parser();
  fs.writeFileSync(csvFile, parser.parse(results));

  console.log("Saved to /output folder.");

  await browser.close();
}

scrapeClarkeSchoolsNY().catch(console.error);
