import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";
import { Parser } from "json2csv";

const SCHOOL_NAME = "Coram Deo Academy of Dallas";
const TARGET_URL = "https://www.coramdeoacademy.org/about/leadership";

const clean = (str = "") =>
  str.replace(/\s+/g, " ").trim();

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
    await page.goto(TARGET_URL, {
      waitUntil: "networkidle2",
      timeout: 0,
    });

    console.log("⏳ Scraping leadership cards...");

    const results = await page.evaluate(() => {
      const clean = str => (str || "").replace(/\s+/g, " ").trim();
      const data = [];

      const cards = document.querySelectorAll('a.group');

      cards.forEach(card => {
        const nameEl = card.querySelector('p.font-brand-heading');
        const titleEl = card.querySelector('.lg\\:absolute p.font-normal');

        const name = clean(nameEl?.innerText || "");
        const job_title = clean(titleEl?.innerText || "");

        if (!name) return;

        data.push({
          name,
          job_title,
        });
      });

      return data;
    });

    const finalData = results.map(item => ({
      school_name: SCHOOL_NAME,
      url: TARGET_URL,
      name: item.name,
      job_title: item.job_title,
      email: ""
    }));

    console.log(`✅ Total leadership found: ${finalData.length}`);

    fs.writeFileSync(
      path.join(OUTPUT_DIR, `${FILE_BASE}.json`),
      JSON.stringify(finalData, null, 2)
    );

    const parser = new Parser({
      fields: ["school_name", "url", "name", "job_title", "email"],
    });

    fs.writeFileSync(
      path.join(OUTPUT_DIR, `${FILE_BASE}.csv`),
      parser.parse(finalData)
    );

    console.log("✅ Files successfully created.");

  } catch (err) {
    console.error("❌ Scraping failed:", err);
  } finally {
    await browser.close();
    console.log("🧹 Browser closed.");
  }
})();
