import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";

const clean = (s = "") => s.replace(/\s+/g, " ").trim();

export async function scrapeMontessoriAcademyChicago() {
  const url = "https://montessoriacademychicago.org/about/leadership/";
  const school = "montessoriacademychicago";

  const outputDir = path.join(process.cwd(), "output");
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

  const jsonFile = path.join(outputDir, `${school}_faculty.json`);
  const csvFile = path.join(outputDir, `${school}_faculty.csv`);

  console.log("📌 Launching browser...");

  // ❌ NO executablePath  
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 1400 });

  await page.goto(url, { waitUntil: "networkidle2", timeout: 0 });

  console.log("⏳ Waiting for leadership columns...");

  await page.waitForSelector(".three-columns .four.columns", {
    timeout: 30000,
  });

  console.log("✔ Extracting leadership data...");

  const staff = await page.evaluate(() => {
    const clean = (t) => (t ? t.replace(/\s+/g, " ").trim() : "");

    const blocks = Array.from(
      document.querySelectorAll(".three-columns .four.columns")
    );

    return blocks
      .map((block) => {
        // NAME
        const name = clean(
          block.querySelector(".leadership-name b, .leadership-name strong")
            ?.textContent
        );

        // JOB TITLE
        const job_title = clean(
          block.querySelector("p em")?.textContent
        );

        // EMAIL (CLEAN DOMAIN)
        let email = block
          .querySelector('.leadership-name a[href^="mailto:"]')
          ?.getAttribute("href")
          ?.replace("mailto:", "")
          .trim();

        if (email) {
          // REMOVE development domain
          email = email.replace(".localhost.me", ".org");
        }

        if (!name) return null;

        return {
          name,
          job_title,
          email,
        };
      })
      .filter(Boolean);
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
