import fs from "fs";
import path from "path";
import puppeteer from "puppeteer-core";

const clean = (s = "") => s.replace(/\s+/g, " ").trim();

export async function scrapeHsaswchicago() {
  const url = "https://www.hsaswchicago.org/apps/staff/";
  const school = "hsaswchicago";

  const outputDir = path.join(process.cwd(), "output");
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

  const jsonFile = path.join(outputDir, `${school}_faculty.json`);
  const csvFile = path.join(outputDir, `${school}_faculty.csv`);

  console.log("📌 Launching browser...");

  const browser = await puppeteer.launch({
    headless: true,
    executablePath:
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1500, height: 1200 });

  await page.goto(url, { waitUntil: "networkidle2", timeout: 0 });

  console.log("⏳ Waiting for staff list...");

  await page.waitForSelector("#staff_group_main li.staff", {
    timeout: 40000,
  });

  console.log("✔ Extracting staff...");

  const staff = await page.evaluate(() => {
    const clean = (t) => (t ? t.replace(/\s+/g, " ").trim() : "");

    const items = Array.from(document.querySelectorAll("#staff_group_main li.staff"));

    return items.map((li) => {
      const name = clean(li.querySelector(".name-position .name")?.textContent);
      const job = clean(li.querySelector(".user-position")?.textContent);
      const emailLink = li.querySelector(".user-email a.email")?.getAttribute("href") || "";

      // NOTE: This site hides email — only shows a mail-to form, not real email.
      const email = ""; 

      return {
        name,
        job_title: job,
        email,
      };
    });
  });

  await browser.close();

  const final = staff
    .filter((s) => s.name)
    .map((s) => ({
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
