import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
const clean = (s = "") => s.replace(/\s+/g, " ").trim();

export async function scrapeNobleschools() {
  const url = "https://nobleschools.org/noble-leadership/";
  const school = "nobleschools";

  const outputDir = path.join(process.cwd(), "output");
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

  const jsonFile = path.join(outputDir, `${school}_faculty.json`);
  const csvFile = path.join(outputDir, `${school}_faculty.csv`);

  console.log("📌 Launching browser...");

  const browser = await puppeteer.launch({
    headless: true,   // ✔ YOUR REQUIREMENT
    args: ["--no-sandbox", "--disable-setuid-sandbox"],   // ✔ YOUR REQUIREMENT
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1500, height: 1200 });

  await page.goto(url, { waitUntil: "networkidle2", timeout: 0 });

  console.log("⬇️ Scrolling the page...");
  for (let i = 0; i < 10; i++) {
    await page.evaluate(() => window.scrollBy(0, 800));
    await sleep(250);
  }

  console.log("⏳ Waiting for .fusion-portfolio-content ...");

  await page.waitForSelector(".fusion-portfolio-content", {
    timeout: 30000,
  });

  console.log("✔ Extracting leadership members...");

  const results = await page.evaluate(() => {
    const clean = (t) => (t ? t.replace(/\s+/g, " ").trim() : "");

    const cards = Array.from(
      document.querySelectorAll(".fusion-portfolio-content")
    );

    return cards.map((card) => {
      const name = clean(card.querySelector("h2.entry-title a")?.textContent);
      const job = clean(card.querySelector(".fusion-post-content p")?.textContent);

      return {
        school_name: "nobleschools",
        url: "https://nobleschools.org/noble-leadership/",
        name,
        job_title: job,
        email: "" // page does not show emails
      };
    });
  });

  await browser.close();

  const final = results.filter((x) => x.name);

  console.log(`🎉 Extracted ${final.length} leadership members`);

  // Save JSON
  fs.writeFileSync(jsonFile, JSON.stringify(final, null, 2));

  // Save CSV
  const csvHeader = "school_name,url,name,job_title,email\n";
  const csvRows = final
    .map(
      (r) =>
        `${r.school_name},${r.url},"${r.name}","${r.job_title}",${r.email}`
    )
    .join("\n");

  fs.writeFileSync(csvFile, csvHeader + csvRows);

  console.log("📄 JSON + CSV saved!");

  return final;
}
