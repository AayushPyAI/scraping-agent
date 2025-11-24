import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";
import * as cheerio from "cheerio";
import { Parser } from "json2csv";

const SCHOOL_NAME = "Dallas Christian School";
const TARGET_URL = "https://www.dallaschristian.com/apps/staff/";

const clean = (str = "") => str.replace(/\s+/g, " ").trim();
const sleep = ms => new Promise(res => setTimeout(res, ms));

const makeFileName = name =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, "_");

const FILE_BASE = makeFileName(SCHOOL_NAME);
const OUTPUT_DIR = path.join(process.cwd(), "..", "..", "..", "output");

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);

async function extractEmail(browser, profileUrl) {
  if (!profileUrl) return "";

  const page = await browser.newPage();
  await page.goto(profileUrl, { waitUntil: "domcontentloaded", timeout: 0 });

  await sleep(800);

  const html = await page.content();
  const $ = cheerio.load(html);

  const email =
    $('a[href^="mailto:"]').attr("href")?.replace("mailto:", "") || "";

  await page.close();
  return email;
}

(async () => {
  console.log("🚀 Launching browser...");

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();

    await page.goto(TARGET_URL, {
      waitUntil: "domcontentloaded",
      timeout: 0,
    });

    console.log("⏳ Waiting for staff list...");
    await page.waitForSelector(".user-info", { timeout: 60000 });
    await sleep(1000);

    const html = await page.content();
    const $ = cheerio.load(html);

    const results = [];

    const staffCards = $(".user-info").toArray();

    for (const el of staffCards) {
      const card = $(el);

      const name = clean(card.find(".name").text());
      const job_title = clean(card.find(".user-position").text());

      const profilePath = card.find(".name").attr("href");
      const profile_url = profilePath
        ? `https://www.dallaschristian.com${profilePath}`
        : "";

      let email = "";
      if (profile_url) {
        email = await extractEmail(browser, profile_url);
      }

      if (!name) continue;

      results.push({
        school_name: SCHOOL_NAME,
        url: TARGET_URL,
        name,
        job_title,
        email,
      });
    }

    console.log(`✅ Total staff found: ${results.length}`);

    const jsonPath = path.join(OUTPUT_DIR, `${FILE_BASE}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));

    const parser = new Parser({
      fields: ["school_name", "url", "name", "job_title", "email"],
    });

    const csv = parser.parse(results);
    fs.writeFileSync(path.join(OUTPUT_DIR, `${FILE_BASE}.csv`), csv);

    console.log("✅ Files successfully created.");

  } catch (err) {
    console.error("❌ Scraping failed:", err);
  } finally {
    await browser.close();
    console.log("🧹 Browser closed.");
  }
})();
