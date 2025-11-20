import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";
import * as cheerio from "cheerio";
import { Parser } from "json2csv";

const clean = (str = "") =>
  str.replace(/\s+/g, " ").replace(/(\n|\t|\r)/g, "").trim();

async function scrapeKeioAcademyNY() {
  const schoolName = "Keio Academy of New York";
  const baseUrl = "https://www.keio.edu/about-us/faculty-staff-directory";

  console.log("Launching browser...");

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  const page = await browser.newPage();
  await page.goto(baseUrl, { waitUntil: "networkidle2", timeout: 0 });

  let html = await page.content();
  let $ = cheerio.load(html);

  // -----------------------------
  // Get total constituents
  // -----------------------------
  const paginationText = clean($(".fsPaginationLabel").text());
  // Example: "showing 1 - 8 of 12 constituents"
  const total = parseInt(paginationText.split("of")[1]);
  const pageSize = $("div.fsConstituentItem").length; // 8 per page
  const totalPages = Math.ceil(total / pageSize);

  console.log(`Total: ${total}, pageSize: ${pageSize}, pages: ${totalPages}`);

  let results = [];

  // -----------------------------
  // Pagination Loop
  // -----------------------------
  for (let p = 1; p <= totalPages; p++) {
    const url = `${baseUrl}?const_page=${p}`;
    console.log(`Scraping page ${p}/${totalPages}: ${url}`);

    await page.goto(url, { waitUntil: "networkidle2", timeout: 0 });

    html = await page.content();
    $ = cheerio.load(html);

    $("div.fsConstituentItem").each((i, el) => {
      const name = clean($(el).find(".fsFullName").text());

      let title = clean($(el).find(".fsTitles").text().replace("Titles:", "").trim());
      let dept = clean($(el).find(".fsDepartments").text().replace("Departments:", "").trim());

      let job_title = title || dept;

      // Email optional
      let email = clean($(el).find(".fsEmail a[href^='mailto:']").attr("href") || "")
        .replace("mailto:", "")
        .trim();

      results.push({
        school_name: schoolName,
        url: baseUrl,
        name,
        job_title,
        email
      });
    });
  }

  // -----------------------------
  // Save JSON & CSV
  // -----------------------------
  const projectRoot = path.join(process.cwd(), "..", "..");
  const outputDir = path.join(projectRoot, "output");
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

  const safeName = schoolName.replace(/\s+/g, "_").toLowerCase();

  fs.writeFileSync(
    path.join(outputDir, `${safeName}.json`),
    JSON.stringify(results, null, 2)
  );

  const parser = new Parser();
  fs.writeFileSync(
    path.join(outputDir, `${safeName}.csv`),
    parser.parse(results)
  );

  console.log("DONE → Files saved in /output");
  await browser.close();
}

scrapeKeioAcademyNY().catch(err => console.error(err));
