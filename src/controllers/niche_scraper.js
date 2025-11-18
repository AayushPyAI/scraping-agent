import dotenv from "dotenv"
dotenv.config()
import { ScrapflyClient, ScrapeConfig } from "scrapfly-sdk";
import * as cheerio from 'cheerio';
import fs from "fs/promises";
const apiKey = process.env.SCRAPFLY_API_KEY;
if(!apiKey){
  throw error("Scraply api key is required.")
}
const scrapfly = new ScrapflyClient({ key: apiKey });

// ----------------------------------------------------
// STEP 1 → SCRAPE SCHOOL LIST PAGE
// ----------------------------------------------------
async function scrapeSchoolList() {
  console.log("➡️  Fetching school list...");

  const url = "https://www.niche.com/k12/search/best-schools/?geoip=true";

  const result = await scrapfly.scrape(
    new ScrapeConfig({
      url,
      asp: true,
      render_js: true,
      wait_for_selector: ".card.search-result",
    })
  );

  const $ = cheerio.load(result.result.content);

  const schools = [];

  $(".card.search-result").each((i, el) => {
    const anchor = $(el).find("a.search-result__link").first();
    const profileUrl = anchor.attr("href")?.trim();
    const name = anchor
      .find("[data-testid='search-result__title']")
      .text()
      .trim();

    if (profileUrl && name) {
      schools.push({ name, profileUrl });
    }
  });

  console.log(`✔ Found ${schools.length} schools`);
  return schools;
}

// ----------------------------------------------------
// STEP 2 → SCRAPE OFFICIAL WEBSITE FROM PROFILE PAGE
// ----------------------------------------------------
async function extractOfficialWebsite(profileUrl, name) {
  try {
    const result = await scrapfly.scrape(
      new ScrapeConfig({
        url: profileUrl,
        asp: true,
        render_js: true,
        wait_for_selector: ".profile__buckets",
      })
    );

    const $ = cheerio.load(result.result.content);

    const websiteAnchor = $("a.profile__website__link").first();
    const officialUrl = websiteAnchor.attr("href")?.trim() || "";

    console.log(`✔ ${name} → ${officialUrl}`);

    return officialUrl;
  } catch (err) {
    console.log(`❌ Failed for ${name}`);
    return "";
  }
}

// ----------------------------------------------------
// BATCH PROCESSOR → faster parallel scraping
// ----------------------------------------------------
async function processInBatches(items, batchSize, handlerFn) {
  const results = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);

    console.log(`\n⚡ Processing batch: ${i / batchSize + 1}`);

    const batchResults = await Promise.all(
      batch.map((item) => handlerFn(item))
    );

    results.push(...batchResults);
  }

  return results;
}

// ----------------------------------------------------
// MAIN → Combined Workflow
// ----------------------------------------------------
async function main() {
  const schoolList = await scrapeSchoolList();

  const batchSize = 5; // number of parallel requests per batch

  const finalResults = await processInBatches(
    schoolList,
    batchSize,
    async (school) => {
      const officialWebsite = await extractOfficialWebsite(
        school.profileUrl,
        school.name
      );

      return {
        name: school.name,
        profileUrl: school.profileUrl,
        officialWebsite,
      };
    }
  );

  // Save only final results
  await fs.writeFile(
    "schools-final.json",
    JSON.stringify(finalResults, null, 2)
  );

  console.log("\n🎉 Final data saved to schools-final.json");
}

main().catch((e) => console.error("❌ Fatal Error:", e));
