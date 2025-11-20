import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clean = (s = "") => s.replace(/\s+/g, " ").trim();

export async function scrapeChicagocommons() {
  const url = "https://www.chicagocommons.org/leadership/";
  const school = "chicagocommons";

  const outputDir = path.join(process.cwd(), "output");
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

  const jsonFile = path.join(outputDir, `${school}_faculty.json`);
  const csvFile = path.join(outputDir, `${school}_faculty.csv`);

  console.log("📌 Launching browser...");

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1500, height: 1200 });

  await page.goto(url, { waitUntil: "networkidle2", timeout: 0 });

  console.log("⬇️ Scrolling...");
  for (let i = 0; i < 8; i++) {
    await page.evaluate(() => window.scrollBy(0, 900));
    await sleep(250);
  }

  console.log("⏳ Waiting for leadership sections...");

  // We wait for any Elementor heading block
  await page.waitForSelector(".elementor-heading-title", { timeout: 30000 });

  console.log("✔ Extracting data...");

  const results = await page.evaluate(() => {
    const clean = (t) => (t ? t.replace(/\s+/g, " ").trim() : "");

    const names = Array.from(
      document.querySelectorAll(".elementor-heading-title")
    ).map((el) => clean(el.textContent));

    const titles = Array.from(
      document.querySelectorAll(".elementor-text-editor p span")
    ).map((el) => clean(el.textContent));

    // Pair names with titles by index
    const staff = [];
    const max = Math.min(names.length, titles.length);

    for (let i = 0; i < max; i++) {
      staff.push({
        name: names[i],
        job_title: titles[i],
        email: ""
      });
    }

    return staff;
  });

  await browser.close();

  const final = results.filter((r) => r.name);

  console.log(`🎉 Extracted ${final.length} leaders`);

  // Save JSON
  const jsonData = final.map((r) => ({
    school_name: "chicagocommons",
    url,
    ...r,
  }));

  fs.writeFileSync(jsonFile, JSON.stringify(jsonData, null, 2));

  // Save CSV
  const csvHeader = "school_name,url,name,job_title,email\n";
  const csvRows = jsonData
    .map(
      (r) =>
        `${r.school_name},${r.url},"${r.name}","${r.job_title}",${r.email}`
    )
    .join("\n");

  fs.writeFileSync(csvFile, csvHeader + csvRows);

  console.log("📄 JSON + CSV saved!");

  return jsonData;
}
