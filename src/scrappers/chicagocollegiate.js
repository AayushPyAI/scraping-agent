import fs from "fs";
import path from "path";
import puppeteer from "puppeteer"; // pure puppeteer

const clean = (s = "") => s.replace(/\s+/g, " ").trim();

export async function scrapeChicagocollegiate() {
  const url = "https://chicagocollegiate.org/our-team/our-network-leadership/";
  const school = "chicagocollegiate";

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
  await page.setViewport({ width: 1600, height: 1400 });

  await page.goto(url, { waitUntil: "networkidle2", timeout: 0 });

  console.log("⏳ Waiting for Beaver Builder modules...");

  // wait for headers
  await page.waitForSelector(".fl-heading-text", { timeout: 40000 });

  console.log("✔ Extracting leadership data...");

  const staff = await page.evaluate(() => {
    const clean = (t) => (t ? t.replace(/\s+/g, " ").trim() : "");

    // Beaver Builder pattern: pairs of h4 (job) + h3 (name)
    const jobEls = Array.from(
      document.querySelectorAll("h4.fl-heading .fl-heading-text")
    );
    const nameEls = Array.from(
      document.querySelectorAll("h3.fl-heading .fl-heading-text")
    );

    const count = Math.min(jobEls.length, nameEls.length);

    const items = [];

    for (let i = 0; i < count; i++) {
      const job_title = clean(jobEls[i].textContent);
      const name = clean(nameEls[i].textContent);

      items.push({
        name,
        job_title,
        email: "",
      });
    }

    return items;
  });

  await browser.close();

  const final = staff.map((s) => ({
    school_name: school,
    url,
    ...s,
  }));

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
