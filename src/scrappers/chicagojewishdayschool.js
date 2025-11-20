import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";

// ------------------------------
const outputDir = path.join(process.cwd(), "output");
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

// ------------------------------
const clean = (str = "") => str.replace(/\s+/g, " ").trim();

function getSchoolNameFromUrl(url) {
  try {
    return new URL(url).hostname.replace("www.", "").split(".")[0];
  } catch {
    return "unknown_school";
  }
}

async function extractEmailFromElement(el) {
  try {
    const email = await el.$eval("a[href^='mailto:']", a => a.textContent.trim());
    return email;
  } catch {
    return "";
  }
}

// ------------------------------
// MAIN SCRAPER
// ------------------------------
export async function scrapeChicagojewishdayschool() {
  const url = "https://www.chicagojewishdayschool.org/about/faculty-and-staff";
  const schoolName = getSchoolNameFromUrl(url);

  const jsonFile = path.join(outputDir, `${schoolName}_faculty.json`);
  const csvFile = path.join(outputDir, `${schoolName}_faculty.csv`);

  console.log(`📌 Launching Puppeteer for: ${url}`);

  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "networkidle2" });

  // Wait for profiles to load
  await page.waitForSelector(".fsConstituentItem");

  const data = await page.$$eval(".fsConstituentItem", items =>
    items.map(item => {
      const clean = txt => txt.replace(/\s+/g, " ").trim();

      const name = clean(
        item.querySelector("h3.fsFullName a")?.textContent || ""
      );

      const jobTitle = clean(
        item.querySelector(".fsTitles")?.textContent.replace("Titles:", "") || ""
      );

      // Email appears as a mailto link after JS loads
      const emailNode = item.querySelector(".fsEmail a[href^='mailto:']");
      const email = emailNode ? emailNode.textContent.trim() : "";

      return { name, job_title: jobTitle, email };
    })
  );

  await browser.close();

  // Normalize
  const results = data
    .filter(x => x.name) // remove blanks
    .map(x => ({
      school_name: schoolName,
      url,
      name: x.name,
      job_title: x.job_title,
      email: x.email
    }));

  console.log(`✅ Extracted: ${results.length} staff members`);

  // Save JSON
  fs.writeFileSync(jsonFile, JSON.stringify(results, null, 2));

  // Save CSV
  const csvHeader = "school_name,url,name,job_title,email\n";
  const csvRows = results
    .map(
      r =>
        `${r.school_name},${r.url},"${r.name}","${r.job_title}",${r.email}`
    )
    .join("\n");

  fs.writeFileSync(csvFile, csvHeader + csvRows);

  console.log(`📄 Files saved into output folder`);

  return results;
}
