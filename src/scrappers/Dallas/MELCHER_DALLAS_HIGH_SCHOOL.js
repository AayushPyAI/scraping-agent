import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE_URL = "https://www.melcher-dallascsd.org/staff";
const SCHOOL_NAME = "Melcher-Dallas High School";

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  let results = [];
  let currentPage = 1;
  let hasNextPage = true;

  while (hasNextPage) {
    const url = `${BASE_URL}?page_no=${currentPage}`;
    console.log(`🔄 Scraping Page ${currentPage}: ${url}`);

    await page.goto(url, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('[data-testid="staff-card"]', { timeout: 10000 });

    const pageData = await page.evaluate((school) => {
      const cards = document.querySelectorAll('[data-testid="staff-card"]');
      const data = [];

      cards.forEach(card => {
        const name = card.querySelector(".name")?.innerText.trim() || "";
        const title = card.querySelector(".title")?.innerText.trim() || "";
        const phone = card.querySelector(".phone")?.innerText.trim() || "";

        let email = "";
        const emailLink = card.querySelector('.email a[href^="mailto:"]');
        if (emailLink) {
          email = emailLink.getAttribute("href").replace("mailto:", "").trim();
        }

        if (name) {
          data.push({
            school: school,
            name,
            title,
            phone,
            email
          });
        }
      });

      return data;
    }, SCHOOL_NAME);

    results.push(...pageData);

    // Check if next page exists
    const nextExists = await page.evaluate(() => {
      const nextBtn = document.querySelector("li.next a:not(.disabled)");
      return !!nextBtn;
    });

    hasNextPage = nextExists;
    currentPage++;
  }

  await browser.close();

  // Save outputs
  const OUTPUT_DIR = path.join(__dirname, "../../../output");
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  fs.writeFileSync(
    path.join(OUTPUT_DIR, "melcher_dallas_high_school.json"),
    JSON.stringify(results, null, 2)
  );

  console.log(`✅ Scraping completed. Total records: ${results.length}`);
})();
