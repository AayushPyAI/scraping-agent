import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";

const clean = (s = "") => (s ? s.replace(/\s+/g, " ").trim() : "");

export async function scrapeGermanSchoolChicago() {
  const url = "https://www.germanschoolchicago.com/about/faculty-and-staff";
  const school = "german_school_chicago";

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

  console.log("⏳ Waiting for faculty list...");
  await page.waitForSelector("li.group", { timeout: 30000 });

  console.log("✔ Extracting faculty...");

  const staff = await page.evaluate(() => {
    const clean = (s = "") => (s ? s.replace(/\s+/g, " ").trim() : "");

    const people = Array.from(document.querySelectorAll("li.group"));
    const results = [];

    for (const p of people) {
      const first = p.querySelector(".first-name");
      const last = p.querySelector(".last-name");
      const job = p.querySelector(".job-title");
      const img = p.querySelector("img");

      const name = clean(
        `${first ? clean(first.textContent) : ""} ${last ? clean(last.textContent) : ""}`
      );

      const job_title = job ? clean(job.textContent) : "";
      const image_url = img ? img.src : "";

      if (!name) continue;

      results.push({
        name,
        job_title,
        email: "", // No emails on this page
        image_url,
      });
    }

    return results;
  });

  await browser.close();

  console.log(`🎉 Extracted ${staff.length} faculty entries`);

  const final = staff.map((s) => ({
    school_name: school,
    url,
    ...s,
  }));

  // Save JSON
  fs.writeFileSync(jsonFile, JSON.stringify(final, null, 2));

  // Save CSV
  const header = "school_name,url,name,job_title,email,image_url\n";
  const rows = final
    .map(
      (r) =>
        `${r.school_name},${r.url},"${r.name}","${r.job_title}",${r.email},${r.image_url}`
    )
    .join("\n");

  fs.writeFileSync(csvFile, header + rows);

  console.log("📄 JSON + CSV saved!");

  return final;
}
