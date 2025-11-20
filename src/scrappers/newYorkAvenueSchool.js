import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";
import * as cheerio from "cheerio";
import { Parser } from "json2csv";

const clean = (str = "") =>
  str.replace(/\s+/g, " ").replace(/(\r|\n|\t)/g, "").trim();

async function scrapeNewYorkAvenueSchool() {
  const schoolName = "New York Avenue School";
  const url =
    "https://www.acboe.org/site/default.aspx?PageType=14&DomainID=117&PageID=197&ModuleInstanceID=224&ViewID=606008db-225b-4ad2-8f7b-9ebac54372c1&IsMoreExpandedView=True";

  console.log("Launching browser...");

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "networkidle2", timeout: 0 });

  console.log("Extracting page content...");
  const html = await page.content();
  const $ = cheerio.load(html);

  const results = [];

  console.log("Parsing staff entries...");

  $("div.ui-article").each((i, el) => {
    const block = $(el).find(".ui-article-description span");

    // -----------------------
    // Extract Name + Title
    // -----------------------
    let nameJobRaw = clean(block.find("p").first().text());

    // Remove any leading commas, double spaces, etc.
    nameJobRaw = nameJobRaw.replace(/\s+/g, " ").trim();

    let name = "";
    let job_title = "";

    if (nameJobRaw.includes(",")) {
      // Format: "Shay Steele, President"
      const parts = nameJobRaw.split(",");
      name = clean(parts[0]);
      job_title = clean(parts[1] || "");
    } else {
      name = nameJobRaw;
      job_title = "";
    }

    // -----------------------
    // Extract Email
    // -----------------------
    let email = clean(block.find("a[href^='mailto:']").text());

    results.push({
      school_name: schoolName,
      url,
      name,
      job_title,
      email,
    });
  });

  console.log(`Found ${results.length} staff entries`);

  // --------------------------------
  // Write output to project root /output
  // --------------------------------
  const projectRoot = path.join(process.cwd(), "..", "..");
  const outputDir = path.join(projectRoot, "output");

  if (!fs.existsSync(outputDir)) {
    console.log("Creating output folder...");
    fs.mkdirSync(outputDir);
  }

  const safeName = schoolName.replace(/\s+/g, "_").toLowerCase();

  const jsonFile = path.join(outputDir, `${safeName}.json`);
  const csvFile = path.join(outputDir, `${safeName}.csv`);

  // JSON
  fs.writeFileSync(jsonFile, JSON.stringify(results, null, 2));

  // CSV
  const parser = new Parser();
  const csv = parser.parse(results);
  fs.writeFileSync(csvFile, csv);

  console.log("Saved to /output folder successfully.");
  await browser.close();
}

scrapeNewYorkAvenueSchool().catch((err) => console.error(err));
