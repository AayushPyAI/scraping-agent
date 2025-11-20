import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clean = (s = "") => s.replace(/\s+/g, " ").trim();

export async function scrapeChicagowaldorf() {
  const url = "https://www.chicagowaldorf.org/facultyadministration";
  const school = "chicagowaldorf";

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

  console.log("⬇️ Scrolling page to load content...");
  for (let i = 0; i < 10; i++) {
    await page.evaluate(() => window.scrollBy(0, 800));
    await sleep(250);
  }

  console.log("⏳ Waiting for staff cards...");

  await page.waitForSelector(".list-item-content__text-wrapper", {
    timeout: 40000,
  });

  console.log("✔ Extracting faculty/staff data...");

  const staff = await page.evaluate(() => {
    const clean = (t) => (t ? t.replace(/\s+/g, " ").trim() : "");
    const cards = Array.from(
      document.querySelectorAll(".list-item-content__text-wrapper")
    );

    return cards.map((card) => {
      const name = clean(
        card.querySelector(".list-item-content__title")?.textContent
      );

      const desc = card.querySelector(
        ".list-item-content__description p"
      )?.innerHTML;

      let jobTitle = "";
      if (desc) {
        const lines = desc.split("<br>");
        jobTitle = clean(lines[lines.length - 1]
          .replace(/<[^>]+>/g, "")
        );
      }

      return {
        school_name: "chicagowaldorf",
        url: "https://www.chicagowaldorf.org/facultyadministration",
        name,
        job_title: jobTitle,
        email: "" // no email on page
      };
    });
  });

  await browser.close();

  const final = staff.filter((p) => p.name);

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
