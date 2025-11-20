import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";
import * as cheerio from "cheerio";
import { Parser } from "json2csv";

const clean = (str = "") =>
  str.replace(/\s+/g, " ").replace(/(\r|\n|\t)/g, "").trim();

async function scrapeEastersealsNY() {
  const schoolName = "Easterseals New York";
  const baseUrl = "https://ny.easterseals.com/about-us/people";

  console.log("Launching browser...");

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  await page.goto(baseUrl, { waitUntil: "networkidle2", timeout: 0 });

  console.log("Extracting listing page...");
  const html = await page.content();
  const $ = cheerio.load(html);

  const results = [];

  console.log("Parsing staff listing...");

  // Each card
  $("div.card__content").each((i, el) => {
    const name = clean($(el).find("h2.h3 span").text());
    const job_title = clean($(el).find(".card__subheading").text());
    const profileUrl = $(el).find("a.h3__link").attr("href");

    results.push({
      school_name: schoolName,
      url: baseUrl,
      name,
      job_title,
      email: "",
      profilePage: profileUrl || "",
    });
  });

  console.log(`Found ${results.length} people. Fetching profile emails...`);

  // ---------------------------------------
  // VISIT EACH PROFILE PAGE TO GET EMAIL
  // ---------------------------------------
  for (let item of results) {
    if (!item.profilePage) continue;

    try {
      const profilePage = await browser.newPage();
      await profilePage.goto(item.profilePage, {
        waitUntil: "networkidle2",
        timeout: 0,
      });

      const profileHtml = await profilePage.content();
      const $$ = cheerio.load(profileHtml);

      // Try to find email anywhere on the profile
      let email =
        clean($$("a[href^='mailto:']").first().text()) ||
        clean($$("a[href*='@']").first().text());

      if (email.includes("@")) {
        item.email = email;
      }

      await profilePage.close();
    } catch (error) {
      console.log("Failed to fetch email from profile:", item.profilePage);
      item.email = "";
    }

    delete item.profilePage;
  }

  // ---------------------------------------
  // Save into /output at project root
  // ---------------------------------------
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
  const csv = parser.parse(results);
  fs.writeFileSync(csvFile, csv);

  console.log("Saved JSON + CSV in /output folder.");
  await browser.close();
}

scrapeEastersealsNY().catch((err) => console.error(err));
