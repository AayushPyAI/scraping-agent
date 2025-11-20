import fs from "fs";
import path from "path";
import axios from "axios";
import * as cheerio from "cheerio";

// ------------------------------
// Create output folder
// ------------------------------
const outputDir = path.join(process.cwd(), "output");
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
}

// ------------------------------
// Helper: clean text
// ------------------------------
const clean = (str = "") => str.replace(/\s+/g, " ").trim();

// ------------------------------
// Extract school name from hostname
// ------------------------------
function getSchoolNameFromUrl(url) {
    try {
        const host = new URL(url).hostname.replace("www.", "");
        return host.split(".")[0]; // e.g. chicagohopeacademy
    } catch {
        return "unknown_school";
    }
}

// ------------------------------
// MAIN SCRAPER
// ------------------------------
export async function scrapeChicagohopeacademy() {
    const url = "https://www.chicagohopeacademy.net/faculty-staff";
    const schoolName = getSchoolNameFromUrl(url);

    const jsonFile = path.join(outputDir, `${schoolName}_faculty.json`);
    const csvFile = path.join(outputDir, `${schoolName}_faculty.csv`);

    console.log(`📌 Scraping: ${url}`);
    console.log(`🏫 School Name: ${schoolName}`);

    try {
        // -----------------------------------------
        // 1. Fetch HTML
        // -----------------------------------------
        console.log("📥 Fetching page...");
        const { data: html } = await axios.get(url);

        // -----------------------------------------
        // 2. Load cheerio
        // -----------------------------------------
        console.log("🔍 Parsing HTML...");
        const $ = cheerio.load(html);

        let results = [];

        // -----------------------------------------
        // 3. Extract faculty items
        // -----------------------------------------
        $("[class*='wixui-rich-text']").each((i, el) => {
            const h3 = $(el).find("h3");

            if (!h3.length) return;

            const rawName = clean(h3.clone().children().remove().end().text());
            const jobTitle = clean(h3.find("span").text());

            if (!rawName) return;

            results.push({
                school_name: schoolName,
                url,
                name: rawName || "",
                job_title: jobTitle || "",
                email: "" // No emails on page
            });
        });

        console.log(`✅ Extracted ${results.length} staff members`);

        // -----------------------------------------
        // 4. Save JSON
        // -----------------------------------------
        fs.writeFileSync(jsonFile, JSON.stringify(results, null, 2));
        console.log(`📄 JSON saved → ${jsonFile}`);

        // -----------------------------------------
        // 5. Save CSV
        // -----------------------------------------
        const csvHeader = "school_name,url,name,job_title,email\n";
        const csvRows = results
            .map(r => `${r.school_name},${r.url},"${r.name}","${r.job_title}",${r.email}`)
            .join("\n");

        fs.writeFileSync(csvFile, csvHeader + csvRows);
        console.log(`📄 CSV saved → ${csvFile}`);

        return results;

    } catch (error) {
        console.error("❌ ERROR scraping chicagohopeacademy:", error.message);
    }
}
