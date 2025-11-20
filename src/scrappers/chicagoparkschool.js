import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";

const clean = (s = "") => s.replace(/\s+/g, " ").trim();

export async function scrapeChicagoparkschool() {
  const url = "https://chicagoparkschool.org/staff/";
  const school = "chicagoparkschool";

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

  console.log("⏳ Waiting for staff columns...");

  await page.waitForSelector(".elementor-column", { timeout: 30000 });

  console.log("✔ Extracting staff...");

  const staff = await page.evaluate(() => {
    const clean = (t) => (t ? t.replace(/\s+/g, " ").trim() : "");

    // Each staff entry appears inside .elementor-column .elementor-widget-wrap
    const blocks = Array.from(
      document.querySelectorAll(".elementor-column .elementor-widget-wrap")
    );

    return blocks
      .map((block) => {
        const name = clean(
          block.querySelector("h2.elementor-heading-title")?.textContent
        );

        const job_title = clean(
          block.querySelector("h5.elementor-heading-title")?.textContent
        );

        const email = clean(
          block
            .querySelector('.staff-member-bio a[href^="mailto:"]')
            ?.getAttribute("href")
            ?.replace("mailto:", "")
        );

        if (!name) return null;

        return { name, job_title, email };
      })
      .filter(Boolean);
  });

  await browser.close();

  const final = staff.map((s) => ({
    school_name: school,
    url,
    ...s,
  }));

  console.log(`🎉 Extracted ${final.length} staff members`);

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
