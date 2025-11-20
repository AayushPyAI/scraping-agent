import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
const clean = (s = "") => s.replace(/\s+/g, " ").trim();

export async function scrapeChicagojesuitacademy() {
  const url = "https://www.chicagojesuitacademy.org/about-us/faculty-and-staff/";
  const school = "chicagojesuitacademy";

  const outputDir = path.join(process.cwd(), "output");
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

  const jsonFile = path.join(outputDir, `${school}_faculty.json`);
  const csvFile = path.join(outputDir, `${school}_faculty.csv`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 1200 });

  await page.goto(url, { waitUntil: "networkidle2", timeout: 0 });

  console.log("⬇️ Scrolling to trigger AJAX...");
  for (let i = 0; i < 12; i++) {
    await page.evaluate(() => window.scrollBy(0, 1000));
    await sleep(300);
  }

  console.log("⏳ Waiting for .abcfslAjaxItems_1 to exist...");

  await page.waitForFunction(
    () => document.querySelector(".abcfslAjaxItems_1") !== null,
    { timeout: 60000 }
  );

  console.log("✔ Found .abcfslAjaxItems_1 container.");
  console.log("⏳ Waiting for staff cards...");

  await page.waitForFunction(
    () =>
      document.querySelectorAll(
        ".abcfslAjaxItems_1 .abcfslItemCntrLst"
      ).length > 0,
    { timeout: 60000 }
  );

  console.log("🎯 Staff cards detected, extracting...");

  const staff = await page.evaluate(() => {
    const clean = (t) => (t ? t.replace(/\s+/g, " ").trim() : "");

    const cards = Array.from(
      document.querySelectorAll(".abcfslAjaxItems_1 .abcfslItemCntrLst")
    );

    return cards.map((card) => {
      const f = clean(card.querySelector(".abcfslSpanMP2")?.textContent);
      const l = clean(card.querySelector(".abcfslSpanMP3")?.textContent);
      const name = `${f} ${l}`.trim();

      const job = clean(card.querySelector(".T-F2")?.textContent);

      const email = clean(
        card.querySelector(".elementor-heading-title.EM-F3")?.textContent
      );

      return { name, job_title: job, email };
    });
  });

  await browser.close();

  const final = staff.filter((s) => s.name);

  console.log(`✅ Extracted ${final.length} staff members`);

  fs.writeFileSync(jsonFile, JSON.stringify(final, null, 2));

  const csvHeader = "school_name,url,name,job_title,email\n";
  const csvRows = final
    .map(
      (r) =>
        `${school},${url},"${r.name}","${r.job_title}",${r.email}`
    )
    .join("\n");

  fs.writeFileSync(csvFile, csvHeader + csvRows);

  console.log("📄 JSON + CSV saved!");

  return final;
}
