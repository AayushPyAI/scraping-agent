import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";
import * as cheerio from "cheerio";
import { Parser } from "json2csv";

const clean = (str = "") =>
  str.replace(/\s+/g, " ").replace(/(\n|\t|\r)/g, "").trim();

async function scrapeBISNY() {
  const schoolName = "British International School of New York";
  const url = "https://bis-ny.org/about/faculty-and-staff/";

  console.log("Launching browser…");

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "networkidle2", timeout: 0 });

  console.log("Extracting page HTML…");
  const html = await page.content();
  const $ = cheerio.load(html);

  let results = [];

  console.log("Parsing staff members…");

  $("div.elementor-author-box__text").each((i, el) => {
    const name = clean($(el).find(".elementor-author-box__name").text());

    const job_title = clean($(el).find(".elementor-author-box__bio p").first().text());

    const email = ""; // No email on this site

    if (!name) return;

    results.push({
      school_name: schoolName,
      url,
      name,
      job_title,
      email,
    });
  });

  console.log("Found:", results.length, "staff members.");

  // -----------------------------------
  // Save results to /output folder
  // -----------------------------------
  const projectRoot = path.join(process.cwd(), "..", "..");
  const outputDir = path.join(projectRoot, "output");

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
  }

  const safeName = schoolName.replace(/\s+/g, "_").toLowerCase();

  const jsonFile = path.join(outputDir, `${safeName}.json`);
  const csvFile = path.join(outputDir, `${safeName}.csv`);

  fs.writeFileSync(jsonFile, JSON.stringify(results, null, 2));

  const parser = new Parser();
  fs.writeFileSync(csvFile, parser.parse(results));

  console.log("DONE → Saved JSON & CSV into /output folder.");

  await browser.close();
}

scrapeBISNY().catch(err => console.error(err));
