import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";

const clean = (s = "") => (s ? s.replace(/\s+/g, " ").trim() : "");

export async function scrapeAssociationHouse() {
  const url = "https://www.associationhouse.org/executive-staff";
  const school = "association_house";

  // Create output folder
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

  console.log("⏳ Loading page...");
  await page.goto(url, { waitUntil: "networkidle2", timeout: 0 });

  console.log("⏳ Waiting for Wix text blocks...");
  await page.waitForSelector(".wixui-rich-text", { timeout: 30000 });

  console.log("✔ Extracting staff...");

  const staff = await page.evaluate(() => {
    const clean = (s = "") => (s ? s.replace(/\s+/g, " ").trim() : "");

    const blocks = Array.from(document.querySelectorAll(".wixui-rich-text"));

    const results = [];
    let currentName = "";

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];

      const h2 = block.querySelector("h1, h2, h3");
      const p = block.querySelector("p");

      // NAME
      if (h2) {
        currentName = clean(h2.textContent);
        continue;
      }

      // JOB TITLE (after name)
      if (currentName && p) {
        const job = clean(p.textContent);

        results.push({
          name: currentName,
          job_title: job,
          email: "", // No email listed
        });

        currentName = ""; // Reset
      }
    }

    return results;
  });

  await browser.close();

  console.log(`🎉 Extracted ${staff.length} staff entries`);

  const final = staff.map((s) => ({
    school_name: school,
    url,
    ...s,
  }));

  // Save JSON
  fs.writeFileSync(jsonFile, JSON.stringify(final, null, 2));

  // Save CSV
  const header = "school_name,url,name,job_title,email\n";
  const rows = final
    .map(
      (r) =>
        `${r.school_name},${r.url},"${r.name}","${r.job_title}",${r.email}`
    )
    .join("\n");

  fs.writeFileSync(csvFile, header + rows);

  console.log("📄 JSON + CSV saved!");

  return final;
}
