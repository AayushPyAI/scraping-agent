import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";

const clean = (s = "") => (s ? s.replace(/\s+/g, " ").trim() : "");

export async function scrapeEFACChicago() {
  const url = "https://www.efachicago.org/en/board-of-trustees/";
  const school = "efac_chicago";

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
  await page.goto(url, { waitUntil: "networkidle2", timeout: 0 });

  console.log("⏳ Waiting for paragraph blocks...");
  await page.waitForSelector("p", { timeout: 30000 });

  console.log("✔ Extracting trustees...");

  const staff = await page.evaluate(() => {
    const clean = (s = "") => (s ? s.replace(/\s+/g, " ").trim() : "");

    const paragraphs = Array.from(document.querySelectorAll("p"));
    const results = [];

    for (const p of paragraphs) {
      const text = clean(p.textContent);

      // Skip empty / non-name lines
      if (!text) continue;
      if (!text.includes(",")) continue;
      if (!p.querySelector("a[href^='mailto:']")) continue;

      // NAME (before the first comma)
      const name = clean(text.split(",")[0]);

      // JOB TITLE (inside <em> or <i>)
      let job = "";
      const jobTag = p.querySelector("em, i");
      if (jobTag) job = clean(jobTag.textContent);

      // EMAIL
      const mail = p.querySelector("a[href^='mailto:']");
      const email = mail
        ? clean(mail.getAttribute("href").replace("mailto:", ""))
        : "";

      // Skip invalid
      if (!name || !email) continue;

      results.push({
        name,
        job_title: job,
        email,
      });
    }

    return results;
  });

  await browser.close();

  console.log(`🎉 Extracted ${staff.length} trustee entries`);

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
