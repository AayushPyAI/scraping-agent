import fs from "fs";
import path from "path";
import axios from "axios";
import * as cheerio from "cheerio";

// ------------------------------
// Make Folder: output/
// ------------------------------
const outputDir = path.join(process.cwd(), "output");
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir);
}

// ------------------------------
// Helper: Normalize Text
// ------------------------------
const clean = (str = "") => str.replace(/\s+/g, " ").trim();

// ------------------------------
// Extract School Name From URL
// ------------------------------
function getSchoolNameFromUrl(url) {
  try {
    const host = new URL(url).hostname.replace("www.", "");
    return host.split(".")[0]; // e.g., cps
  } catch {
    return "unknown_school";
  }
}

// ------------------------------
// MAIN SCRAPER FUNCTION
// ------------------------------
export async function scrapeCPSLeadership() {
  const url = "https://www.cps.edu/about/leadership/executive-leadership/";
  const schoolName = getSchoolNameFromUrl(url);
  const jsonFile = path.join(outputDir, `${schoolName}_faculty.json`);
  const csvFile = path.join(outputDir, `${schoolName}_faculty.csv`);

  console.log(`📌 Scraping: ${url}`);
  console.log(`🏫 School Name: ${schoolName}`);

  try {
    // -----------------------------------------
    // 1. Fetch Page HTML
    // -----------------------------------------
    console.log("📥 Fetching page...");
    const { data: html } = await axios.get(url);

    // -----------------------------------------
    // 2. Load Into Cheerio
    // -----------------------------------------
    console.log("🔍 Parsing page...");
    const $ = cheerio.load(html);

    let results = [];

    // -----------------------------------------
    // 3. Scrape Listing Items
    // -----------------------------------------
    $(".promo-listing-content").each((i, el) => {
      const name = clean($(el).find("h3.minor").text());
      const jobTitle = clean($(el).find("strong").text());
      const email = ""; // Page has no email

      results.push({
        school_name: schoolName,
        url,
        name,
        job_title: jobTitle || "",
        email,
      });
    });

    console.log(`✅ Extracted ${results.length} records`);

    // -----------------------------------------
    // 4. Save JSON File
    // -----------------------------------------
    fs.writeFileSync(jsonFile, JSON.stringify(results, null, 2));
    console.log(`📄 JSON saved → ${jsonFile}`);

    // -----------------------------------------
    // 5. Convert to CSV Manually
    // -----------------------------------------
    const csvHeader = "school_name,url,name,job_title,email\n";
    const csvRows = results
      .map((r) =>
        `${r.school_name},${r.url},"${r.name}","${r.job_title}",${r.email}`
      )
      .join("\n");

    fs.writeFileSync(csvFile, csvHeader + csvRows);
    console.log(`📄 CSV saved → ${csvFile}`);

    return results;
  } catch (err) {
    console.error("❌ ERROR:", err.message);
  }
}
