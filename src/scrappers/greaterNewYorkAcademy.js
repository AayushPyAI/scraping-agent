import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";
import * as cheerio from "cheerio";
import { Parser } from "json2csv";

const clean = (str = "") =>
  str.replace(/\s+/g, " ").replace(/(\n|\t|\r)/g, "").trim();

async function scrapeGNYA() {
  const schoolName = "Greater New York Academy";
  const baseUrl = "https://www.gnya.org/apps/staff/";

  console.log("Launching browser...");

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  const page = await browser.newPage();
  await page.goto(baseUrl, { waitUntil: "networkidle2", timeout: 0 });

  console.log("Extracting main staff listing page...");
  const html = await page.content();
  const $ = cheerio.load(html);

  const staffList = $("li.staff");
  let results = [];

  console.log("Found staff:", staffList.length);

  // --------------------------------------
  // Step 1: Extract Name, Position, Profile URL
  // --------------------------------------
  staffList.each((i, el) => {
    const name = clean($(el).find(".name-position .name").text());
    const job_title = clean($(el).find(".user-position").text());

    const profileRel = $(el).find(".name-position a.name").attr("href") || "";
    const profileUrl = profileRel.startsWith("http")
      ? profileRel
      : `https://www.gnya.org${profileRel}`;

    results.push({
      school_name: schoolName,
      url: baseUrl,
      name,
      job_title,
      email: "",
      profile: profileUrl
    });
  });

  // --------------------------------------
  // Step 2: Visit each profile page to get email
  // --------------------------------------
  console.log("Fetching emails from profile pages...");

  for (let item of results) {
    try {
      const profilePage = await browser.newPage();

      await profilePage.goto(item.profile, {
        waitUntil: "networkidle2",
        timeout: 0
      });

      const profileHtml = await profilePage.content();
      const $$ = cheerio.load(profileHtml);

      // Emails are inside:  a[href^="mailto:"]
      let email =
        clean($$("a[href^='mailto:']").first().text()) ||
        clean($$("a[href*='@']").first().text());

      if (email.includes("@")) {
        item.email = email;
      }

      await profilePage.close();
    } catch (err) {
      console.log("Error fetching email for:", item.name);
      item.email = "";
    }

    delete item.profile; // cleanup
  }

  // --------------------------------------
  // Step 3: Save to /output
  // --------------------------------------
  const projectRoot = path.join(process.cwd(), "..", "..");
  const outputDir = path.join(projectRoot, "output");

  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

  const safeName = schoolName.replace(/\s+/g, "_").toLowerCase();

  const jsonFile = path.join(outputDir, `${safeName}.json`);
  const csvFile = path.join(outputDir, `${safeName}.csv`);

  fs.writeFileSync(jsonFile, JSON.stringify(results, null, 2));

  const parser = new Parser();
  fs.writeFileSync(csvFile, parser.parse(results));

  console.log("Scraping completed!");
  console.log("Files saved in:", outputDir);

  await browser.close();
}

scrapeGNYA().catch(err => console.error(err));
