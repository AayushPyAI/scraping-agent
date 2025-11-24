import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";
import * as cheerio from "cheerio";
import { Parser } from "json2csv";

const SCHOOL_NAME = "Melcher-Dallas Elementary School";
const TARGET_URL = "https://www.melcher-dallascsd.org/page/board-members";

const clean = (str = "") =>
  str.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();

const makeFileName = name =>
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
    await page.goto(TARGET_URL, { waitUntil: "networkidle2", timeout: 0 });

    const html = await page.content();
    const $ = cheerio.load(html);

    const results = [];

    $(".html-wrapper p").each((i, el) => {
      const p = $(el);

      const mailLink = p.find('a[href^="mailto:"]');
      if (!mailLink.length) return;

      const email = mailLink.attr("href").replace("mailto:", "").trim();
      const name = clean(mailLink.text());

      const role = clean(
        p.find("span").first().text().replace(":", "")
      );

      if (!name) return;

      results.push({
        school_name: SCHOOL_NAME,
        url: TARGET_URL,
        name,
        job_title: role,
        email,
      });
    });

    console.log(`✅ Total board members found: ${results.length}`);

    fs.writeFileSync(
      path.join(OUTPUT_DIR, `${FILE_BASE}.json`),
      JSON.stringify(results, null, 2)
    );

    const parser = new Parser({
      fields: ["school_name", "url", "name", "job_title", "email"],
    });

    fs.writeFileSync(
      path.join(OUTPUT_DIR, `${FILE_BASE}.csv`),
      parser.parse(results)
    );

    console.log("✅ Files successfully created.");

  } catch (err) {
    console.error("❌ Scraping failed:", err);
  } finally {
    await browser.close();
    console.log("🧹 Browser closed.");
  }
})();
