import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";
import * as cheerio from "cheerio";
import { Parser } from "json2csv";

const clean = (str = "") =>
  str.replace(/\s+/g, " ").replace(/(\n|\t|\r)/g, "").trim();

async function scrapeMarymountNY() {
  const schoolName = "Marymount School of New York";
  const baseUrl = "https://www.marymountnyc.org/about/our-people";

  console.log("Launching browser...");

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  const page = await browser.newPage();
  await page.goto(baseUrl, { waitUntil: "networkidle2", timeout: 0 });

  console.log("Extracting first page...");
  let html = await page.content();
  let $ = cheerio.load(html);

  // Get total pages
  const pageCountText = clean($("span.page-count").text()); // "Page 1 of 6"
  const totalPages = parseInt(pageCountText.split("of")[1].trim());

  console.log("Total pages detected:", totalPages);

  let results = [];

  // -----------------------------------------------------
  // LOOP THROUGH ALL PAGES
  // -----------------------------------------------------
  for (let p = 1; p <= totalPages; p++) {
    const url = `${baseUrl}?&p=${p}`;
    console.log(`Scraping page ${p}/${totalPages}: ${url}`);

    await page.goto(url, { waitUntil: "networkidle2", timeout: 0 });
    html = await page.content();
    $ = cheerio.load(html);

    $("li.member-directory-item").each((i, el) => {
      const name = clean($(el).find("h2.title").text());

      const category = clean($(el).find(".categories").text());
      let job_title = clean($(el).find(".job_title").text());
      if (!job_title) job_title = category; // fallback

      let email = clean($(el).find(".email a[href^='mailto:']").attr("href") || "");
      email = email.replace("mailto:", "").trim();

      if (!name) return;

      results.push({
        school_name: schoolName,
        url: baseUrl,
        name,
        job_title,
        email
      });
    });
  }

  // -----------------------------------------------------
  // SAVE RESULT FILES
  // -----------------------------------------------------
  const projectRoot = path.join(process.cwd(), "..", "..");
  const outputDir = path.join(projectRoot, "output");

  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

  const safeName = schoolName.replace(/\s+/g, "_").toLowerCase();

  const jsonFile = path.join(outputDir, `${safeName}.json`);
  const csvFile = path.join(outputDir, `${safeName}.csv`);

  fs.writeFileSync(jsonFile, JSON.stringify(results, null, 2));

  const parser = new Parser();
  fs.writeFileSync(csvFile, parser.parse(results));

  console.log("DONE → Saved in /output");
  await browser.close();
}

scrapeMarymountNY().catch(err => console.error(err));
