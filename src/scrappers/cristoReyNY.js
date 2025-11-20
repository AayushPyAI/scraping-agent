import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";
import * as cheerio from "cheerio";
import { Parser } from "json2csv";

const clean = (str = "") =>
  str.replace(/\s+/g, " ").replace(/(\n|\t|\r)/g, "").trim();

async function scrapeCristoReyNY() {
  const schoolName = "Cristo Rey New York High School";
  const url = "https://www.cristoreyny.org/faculty-and-staff";

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

  console.log("Extracting staff blocks...");

  // Every Wix staff card uses this structure:
  // div[class*=wixui-box] inside containers
  $("div.wixui-box").each((i, el) => {
    const block = $(el);

    // NAME (always h6 or h3 inside rich text)
    const name =
      clean(block.find("h6 span").text()) ||
      clean(block.find("h3 span").text());

    // JOB TITLE (first <p> after name)
    let job_title = "";
    const paragraphs = block.find("p");

    if (paragraphs.length > 0) {
      job_title = clean($(paragraphs[0]).text());
    }

    // EMAIL
    const email = clean(block.find("a[href^='mailto:']").text());

    // Skip empty blocks
    if (!name || !email) return;

    results.push({
      school_name: schoolName,
      url,
      name,
      job_title,
      email
    });
  });

  console.log("Found:", results.length, "staff");

  // -----------------------------
  // Save Files in /output
  // -----------------------------
  const projectRoot = path.join(process.cwd(), "..", "..");
  const outputDir = path.join(projectRoot, "output");

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
  }

  const safeName = schoolName.replace(/\s+/g, "_").toLowerCase();

  const jsonFile = path.join(outputDir, `${safeName}.json`);
  const csvFile = path.join(outputDir, `${safeName}.csv`);

  // Save JSON
  fs.writeFileSync(jsonFile, JSON.stringify(results, null, 2));

  // Save CSV
  const parser = new Parser();
  fs.writeFileSync(csvFile, parser.parse(results));

  console.log("Saved JSON + CSV to /output folder.");
  await browser.close();
}

scrapeCristoReyNY().catch(console.error);
