import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";
import * as cheerio from "cheerio";
import { Parser } from "json2csv";

const clean = (str = "") =>
  str.replace(/\s+/g, " ").replace(/(\r|\n|\t)/g, "").trim();

async function scrapeNymillsElementary() {
  const schoolName = "New York Mills Elementary School";
  const url = "https://www.nymills.k12.mn.us/staff";

  console.log("Launching browser...");

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "networkidle2", timeout: 0 });

  console.log("Extracting HTML...");
  const html = await page.content();
  const $ = cheerio.load(html);

  const results = [];

  console.log("Parsing staff cards...");

  $("div.cs-card").each((i, el) => {
    const name = clean($(el).find(".cs-item-title").text());
    const job = clean($(el).find(".cs-subtext").first().text());

    // Extract email ID from onclick attribute
    const onclick = $(el).find("a[onclick*='email']").attr("onclick") || "";
    const emailMatch = onclick.match(/id=([A-Za-z0-9]+)/);

    results.push({
      school_name: schoolName,
      url,
      name: name || "",
      job_title: job || "",
      email: emailMatch ? emailMatch[1] : "", // will fetch below
      _emailId: emailMatch ? emailMatch[1] : "", // temporary field
    });
  });

  console.log(`Found ${results.length} staff members`);

  // ---------------------------------------
  // Fetch actual email for each user ID
  // ---------------------------------------
  console.log("Fetching actual emails...");

  for (let item of results) {
    if (!item._emailId) continue;

    const emailUrl = `https://www.nymills.k12.mn.us/sys/user/email?id=${item._emailId}&code=False`;

    try {
      const emailPage = await browser.newPage();
      await emailPage.goto(emailUrl, { waitUntil: "networkidle2" });

      const emailHtml = await emailPage.content();
      const $$ = cheerio.load(emailHtml);

      const email = clean($$("body").text());

      if (email && email.includes("@")) {
        item.email = email;
      } else {
        item.email = "";
      }

      await emailPage.close();
    } catch (e) {
      console.log("Email fetch failed for ID:", item._emailId);
      item.email = "";
    }

    // Remove temp field
    delete item._emailId;
  }

  // ---------------------------------------
  // Save to output folder (project root)
  // ---------------------------------------
  const projectRoot = path.join(process.cwd(), "..", "..");
  const outputDir = path.join(projectRoot, "output");

  if (!fs.existsSync(outputDir)) {
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

  console.log("Saved JSON + CSV to /output folder");
  await browser.close();
}

scrapeNymillsElementary().catch((err) => console.error(err));
