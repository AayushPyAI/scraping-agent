import fs from "fs";
import path from "path";
import puppeteer from "puppeteer-core";

const clean = (s = "") => s.replace(/\s+/g, " ").trim();

export async function scrapeSd170() {
  const url = "https://www.sd170.com/page/board-members";
  const school = "sd170";

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
  await page.setViewport({ width: 1600, height: 1200 });

  await page.goto(url, { waitUntil: "networkidle2", timeout: 0 });

  console.log("⏳ Waiting for table rows...");

  await page.waitForSelector(".table-v2-block table tbody tr", {
    timeout: 30000,
  });

  console.log("✔ Extracting board members...");

  const data = await page.evaluate(() => {
    const clean = (t) => (t ? t.replace(/\s+/g, " ").trim() : "");

    const rows = Array.from(
      document.querySelectorAll(".table-v2-block table tbody tr")
    );

    return rows
      .map((row) => {
        const tds = row.querySelectorAll("td");
        if (tds.length < 2) return null;

        // NAME (first non-empty <p>)
        let name = "";
        const ps1 = Array.from(tds[0].querySelectorAll("p"));
        for (const p of ps1) {
          const text = clean(p.textContent);
          if (text.length > 0) {
            name = text;
            break;
          }
        }

        // JOB TITLE (center column)
        let job = "";
        const ps2 = Array.from(tds[1].querySelectorAll("p"));
        for (const p of ps2) {
          const text = clean(p.textContent);
          if (text.length > 0) {
            job = text;
            break;
          }
        }

        // EMAIL
        const email =
          clean(
            tds[2].querySelector('a[href^="mailto:"]')?.textContent
          ) || "";

        if (!name) return null;

        return {
          name,
          job_title: job,
          email,
        };
      })
      .filter(Boolean);
  });

  await browser.close();

  const final = data.map((r) => ({
    school_name: school,
    url,
    ...r,
  }));

  console.log(`🎉 Extracted ${final.length} board members`);

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
