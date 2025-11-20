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
// Helpers
// ------------------------------
const clean = (str = "") => str.replace(/\s+/g, " ").trim();

/**
 * Return hostname-based short school name
 */
function getSchoolNameFromUrl(url) {
  try {
    const host = new URL(url).hostname.replace("www.", "");
    // join remaining parts to make a shorter id if subdomain-like
    return host.split(".")[0];
  } catch {
    return "unknown_school";
  }
}

/**
 * Find first email in a block of text/html
 */
function extractEmail(text) {
  const m = text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
  return m ? m[0] : "";
}

/**
 * Heuristic to decide if a strong-text is likely a person name.
 * - not too long
 * - contains at least one space (first + last)
 * - not start with "Chicago Christian" or other obvious site intro
 */
function isLikelyPersonName(name) {
  if (!name) return false;
  const t = name.trim();
  if (t.length < 2 || t.length > 50) return false;
  if (!/\s/.test(t)) return false; // must contain space (first + last)
  const low = t.toLowerCase();
  if (low.includes("chicago christian") || low.includes("three campuses") || low.includes("made up of")) return false;
  return true;
}

// ------------------------------
// MAIN SCRAPER
// ------------------------------
export async function scrapeChicagochristian() {
  const url = "https://www.chicagochristian.org/about";
  const schoolName = getSchoolNameFromUrl(url);
  const jsonFile = path.join(outputDir, `${schoolName}_faculty.json`);
  const csvFile = path.join(outputDir, `${schoolName}_faculty.csv`);

  console.log(`📌 Scraping: ${url}`);
  console.log(`🏫 School Name: ${schoolName}`);

  try {
    const { data: html } = await axios.get(url);
    const $ = cheerio.load(html);

    const results = [];

    // Iterate over content-wrap sections
    $(".content-wrap").each((i, section) => {
      const $section = $(section);

      // For each <strong> inside the section, consider it as a potential person name
      $section.find("strong").each((j, strongEl) => {
        const rawName = clean($(strongEl).text());
        if (!isLikelyPersonName(rawName)) return; // skip non-person or long intros

        // Find job title:
        // Prefer the nearest <em> in the same section (common pattern),
        // otherwise take parent text excluding the strong text and email lines.
        let jobTitle = "";
        const $strong = $(strongEl);
        const $parent = $strong.parent();

        // 1) If there's an <em> sibling (common), use its text
        const emText = clean($parent.find("em").first().text());
        if (emText) {
          jobTitle = emText;
        } else {
          // 2) Else, build candidate from parent's text without the strong text
          // Remove the <strong> temporarily then read text
          const parentClone = $parent.clone();
          parentClone.find("strong").remove();
          const afterStrongText = clean(parentClone.text());
          // often the first line is job title; split by line breaks or multiple spaces
          if (afterStrongText) {
            // remove emails if accidentally included
            const withoutEmail = afterStrongText.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "").trim();
            // take first chunk (before two consecutive spaces or a '|' or newline)
            const candidate = withoutEmail.split(/\r?\n|<br>|<br\/>|  |—|–|\|/)[0] || "";
            jobTitle = clean(candidate);
          }
        }

        // 3) Email: search the whole section HTML/text for an email
        const sectionHtml = $.html($section);
        const sectionText = $section.text();
        const email = extractEmail(sectionHtml) || extractEmail(sectionText) || "";

        // Final push
        results.push({
          school_name: schoolName,
          url,
          name: rawName,
          job_title: jobTitle || "",
          email: email || ""
        });
      });
    });

    // Deduplicate by name+job (in case duplicates)
    const uniq = [];
    const seen = new Set();
    for (const r of results) {
      const key = `${r.name}|${r.job_title}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniq.push(r);
      }
    }

    console.log(`✅ Extracted ${uniq.length} person records`);

    // Save JSON
    fs.writeFileSync(jsonFile, JSON.stringify(uniq, null, 2));
    console.log(`📄 JSON saved → ${jsonFile}`);

    // Save CSV (safe quoted fields)
    const csvHeader = "school_name,url,name,job_title,email\n";
    const csvRows = uniq
      .map(r =>
        [
          r.school_name,
          r.url,
          `"${r.name.replace(/"/g, '""')}"`,
          `"${r.job_title.replace(/"/g, '""')}"`,
          r.email ? `"${r.email.replace(/"/g, '""')}"` : ""
        ].join(",")
      )
      .join("\n");
    fs.writeFileSync(csvFile, csvHeader + csvRows);
    console.log(`📄 CSV saved → ${csvFile}`);

    return uniq;
  } catch (err) {
    console.error("❌ ERROR scraping chicagochristian:", err.message);
    return [];
  }
}
