// Filename: MIAMI_LAKES_K8_CENTER.js

import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";
import * as cheerio from "cheerio";
import { Parser } from "json2csv";

const SCHOOL_NAME = "Miami Lakes K-8 Center";
const TARGET_URL = "https://mlk8center.org/apps/staff/";

const clean = (str = "") => str.replace(/\s+/g, " ").trim();

const makeFileName = (name) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, "_");

const FILE_BASE = makeFileName(SCHOOL_NAME);
const OUTPUT_DIR = path.join(process.cwd(), "..", "..", "..", "output");

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);

(async () => {
  console.log("🚀 Launching browser...");

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();

    console.log("⏳ Loading page...");
    await page.goto(TARGET_URL, {
      waitUntil: "networkidle2", // Changed from domcontentloaded
      timeout: 60000,
    });

    console.log("⏳ Waiting for staff cards to load...");
    // Wait for actual staff cards to appear
    await page.waitForSelector("#staff a[href*='uREC_ID']", { timeout: 60000 });

    const html = await page.content();
    const $ = cheerio.load(html);

    const results = [];

    // Staff members are in <a> tags with href containing uREC_ID
    $("#staff a[href*='uREC_ID']").each((i, el) => {
      const card = $(el);

      // Name is in <dt> inside the link
      const name = clean(card.find("dt").text());
      
      // Job title is in <dd> inside the link  
      const job_title = clean(card.find("dd").text());

      const profileLink = card.attr("href");

      // Only add if we have a name
      if (name) {
        results.push({
          school_name: SCHOOL_NAME,
          url: TARGET_URL,
          name,
          job_title,
          email: "",
          profile_url: profileLink
            ? `https://mlk8center.org${profileLink}`
            : ""
        });
      }
    });

    console.log(`✅ Total records found: ${results.length}`);

    const jsonPath = path.join(OUTPUT_DIR, `${FILE_BASE}.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2));

    const parser = new Parser({
      fields: ["school_name", "url", "name", "job_title", "email", "profile_url"],
    });

    const csv = parser.parse(results);
    const csvPath = path.join(OUTPUT_DIR, `${FILE_BASE}.csv`);
    fs.writeFileSync(csvPath, csv);

    console.log("✅ Files saved successfully.");
    console.log(`📄 JSON: ${jsonPath}`);
    console.log(`📊 CSV: ${csvPath}`);
  } catch (error) {
    console.error("❌ Scraping failed:", error);
  } finally {
    await browser.close();
    console.log("🧹 Browser closed.");
  }
})();
