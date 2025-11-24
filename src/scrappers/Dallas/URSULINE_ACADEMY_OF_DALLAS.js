import puppeteer from "puppeteer";
import fs from "fs";
import path from "path";

const SCHOOL_NAME = "Melcher-Dallas High School";
const BASE_URL = "https://www.melcher-dallascsd.org/staff";

function makeFileName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

const FILE_BASE = makeFileName(SCHOOL_NAME);
const OUTPUT_DIR = path.join(process.cwd(), "..", "..", "..", "output");

// ✅ Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

async function scrapePage(page, url) {
  console.log(`\n🌐 Visiting: ${url}`);
  await page.goto(url, { waitUntil: "networkidle2", timeout: 0 });

  await page.waitForSelector('div[data-testid="staff-card"]', { timeout: 20000 });

  const data = await page.evaluate(() => {
    const records = [];

    document.querySelectorAll('div[data-testid="staff-card"]').forEach(card => {
      const name = card.querySelector('.name')?.innerText.trim() || "";
      const title = card.querySelector('.title')?.innerText.trim() || "";
      const phone = card.querySelector('.phone')?.innerText.trim() || "";

      let email = "";
      const emailBtn = card.querySelector('.email a, .email button');
      if (emailBtn) {
        const link = emailBtn.getAttribute('href') || emailBtn.textContent;
        if (link && link.includes('@')) email = link.replace('mailto:', '').trim();
      }

      if (name) {
        records.push({
          name,
          title,
          phone,
          email
        });
      }
    });

    return records;
  });

  return data;
}

async function getTotalPages(page) {
  const total = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('nav.cms-pagination a'))
      .map(a => a.textContent.trim())
      .filter(t => /^\d+$/.test(t))
      .map(n => parseInt(n));

    return links.length ? Math.max(...links) : 1;
  });

  console.log(`📄 Total Pages Found: ${total}`);
  return total;
}

async function main() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  console.log("🚀 Starting scraper for:", SCHOOL_NAME);

  const results = [];

  await page.goto(BASE_URL, { waitUntil: "networkidle2", timeout: 0 });
  const totalPages = await getTotalPages(page);

  const BATCH_SIZE = 3; // fast but safe

  for (let i = 1; i <= totalPages; i += BATCH_SIZE) {
    const batch = [];

    for (let j = i; j < i + BATCH_SIZE && j <= totalPages; j++) {
      const pageUrl = `${BASE_URL}?page_no=${j}`;
      batch.push(scrapePage(page, pageUrl));
    }

    const batchResults = await Promise.all(batch);
    batchResults.forEach(r => results.push(...r));

    console.log(`✅ Batch ${i} - ${Math.min(i + BATCH_SIZE - 1, totalPages)} completed`);
  }

  const jsonPath = path.join(OUTPUT_DIR, `${FILE_BASE}.json`);

  fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2), "utf8");

  console.log(`\n📦 Data saved successfully: ${jsonPath}`);
  console.log(`📊 Total Records: ${results.length}`);

  await browser.close();
}

main();
