import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";
import * as cheerio from "cheerio";
import { Parser } from "json2csv";

const clean = (str = "") =>
  str.replace(/\s+/g, " ").replace(/(\n|\t|\r)/g, "").trim();

async function scrapeGISNY() {
  const schoolName = "German International School New York";
  const baseUrl = "https://www.gisny.org/our-school/faculty-staff";

  console.log("Launching browser...");

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });
  const page = await browser.newPage();

  // -------------------------------
  // Step 1: Load first page to get total pages
  // -------------------------------
  await page.goto(baseUrl, { waitUntil: "networkidle2" });
  let html = await page.content();
  let $ = cheerio.load(html);

  const paginationLinks = $("div.fsElementPagination a[data-page]")
    .map((i, el) => parseInt($(el).attr("data-page")))
    .get();

  const totalPages = Math.max(...paginationLinks);

  console.log("Total pages detected:", totalPages);

  let results = [];

  // -------------------------------
  // Step 2: Loop through all pages
  // -------------------------------
  for (let p = 1; p <= totalPages; p++) {
    const pageUrl = `${baseUrl}?const_page=${p}`;
    console.log(`Fetching page ${p}/${totalPages}: ${pageUrl}`);

    await page.goto(pageUrl, { waitUntil: "networkidle2", timeout: 0 });
    html = await page.content();
    $ = cheerio.load(html);

    $("div.fsConstituentItem").each((i, el) => {
      const name = clean($(el).find(".fsFullName").text());
      const title = clean($(el).find(".fsTitles").text());
      const department = clean($(el).find(".fsDepartments").text());

      let email = clean($(el).find("a[href^='mailto:']").attr("href") || "");
      email = email.replace("mailto:", "").trim();

      results.push({
        school_name: schoolName,
        url: baseUrl,
        name,
        job_title: title || department,
        email
      });
    });
  }

  // -------------------------------
  // Step 3: Save Output
  // -------------------------------
  const projectRoot = path.join(process.cwd(), "..", "..");
  const outputDir = path.join(projectRoot, "output");

  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

  const safeName = schoolName.replace(/\s+/g, "_").toLowerCase();

  const jsonFile = path.join(outputDir, `${safeName}.json`);
  const csvFile = path.join(outputDir, `${safeName}.csv`);

  fs.writeFileSync(jsonFile, JSON.stringify(results, null, 2));

  const parser = new Parser();
  fs.writeFileSync(csvFile, parser.parse(results));

  console.log("DONE. Saved to /output folder.");
  await browser.close();
}

scrapeGISNY().catch(console.error);
