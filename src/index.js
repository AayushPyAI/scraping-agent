import fs from "fs";
import path from "path";
import { scrapeAssociationHouse } from "./scrappers/association_house.js";
import { scrapeChicagochristian } from "./scrappers/chicagochristian.js";
import { scrapeChicagocollegiate } from "./scrappers/chicagocollegiate.js";
import { scrapeChicagocommons } from "./scrappers/chicagocommons.js";
import { scrapeChicagohopeacademy } from "./scrappers/chicagohopeacademy.js";
import { scrapeChicagojesuitacademy } from "./scrappers/chicagojesuitacademy.js";
import { scrapeChicagojewishdayschool } from "./scrappers/chicagojewishdayschool.js";
import { scrapeChicagoparkschool } from "./scrappers/chicagoparkschool.js";
import { scrapeChicagowaldorf } from "./scrappers/chicagowaldorf.js";
import { scrapeCPSLeadership } from "./scrappers/cpsLeadership.js";
import { scrapeD187 } from "./scrappers/d187.js";
import { scrapeHsaswchicago } from "./scrappers/hsaswchicago.js";
import { scrapeLatinschool } from "./scrappers/latinschool.js";
import { scrapeLyceechicago } from "./scrappers/lyceechicago.js";
import { scrapeNobleschools } from "./scrappers/nobleschools.js";
import { scrapeMontessoriAcademyChicago } from "./scrappers/ontessoriacademychicago.js";
import { scrapeEFACChicago } from "./scrappers/scrape_efac_chicago.js";
import { scrapeGermanSchoolChicago } from "./scrappers/scrape_german_school_chicago.js";
import { scrapeSd170 } from "./scrappers/sd170.js";
import { scrapeToddlerTown } from "./scrappers/toddlertown.js";

// Wrapper function to handle errors and logging for each scraper
async function runScraper(scraperFn, scraperName) {
  try {
    console.log(`  ▶ Starting scraper: ${scraperName}`);
    const result = await scraperFn();
    console.log(`  ✓ Completed scraper: ${scraperName} (${result?.length || 0} records)`);
    return { success: true, name: scraperName, data: result || [] };
  } catch (error) {
    console.error(`  ✗ Failed scraper: ${scraperName} - ${error.message}`);
    return { success: false, name: scraperName, data: [], error: error.message };
  }
}

// Function to process a batch of scrapers
async function processBatch(batchNumber, scrapers) {
  console.log(`\n📦 Batch ${batchNumber} - Processing ${scrapers.length} scrapers...`);
  console.log(`   Scrapers: ${scrapers.map(s => s.name).join(", ")}`);
  
  const promises = scrapers.map(({ fn, name }) => runScraper(fn, name));
  const results = await Promise.allSettled(promises);
  
  const batchResults = results.map((result, index) => {
    if (result.status === "fulfilled") {
      return result.value;
    } else {
      const scraperName = scrapers[index].name;
      console.error(`  ✗ Scraper ${scraperName} rejected: ${result.reason}`);
      return { success: false, name: scraperName, data: [], error: result.reason?.message || "Unknown error" };
    }
  });
  
  const successful = batchResults.filter(r => r.success).length;
  const failed = batchResults.filter(r => !r.success).length;
  console.log(`📦 Batch ${batchNumber} completed - Success: ${successful}, Failed: ${failed}\n`);
  
  return batchResults;
}

// Function to combine and sort results
function combineAndSortResults(allResults) {
  const combined = [];
  
  allResults.forEach(({ data, name }) => {
    if (Array.isArray(data)) {
      combined.push(...data);
    }
  });
  
  // Sort: entries with emails first, then entries without emails
  combined.sort((a, b) => {
    const aHasEmail = a.email && a.email.trim() !== "";
    const bHasEmail = b.email && b.email.trim() !== "";
    
    if (aHasEmail && !bHasEmail) return -1;
    if (!aHasEmail && bHasEmail) return 1;
    return 0;
  });
  
  return combined;
}

// Function to write combined output files
function writeCombinedFiles(data) {
  const outputDir = path.join(process.cwd(), "output");
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const jsonFile = path.join(outputDir, "allChicagoCityFacultyData.json");
  const csvFile = path.join(outputDir, "allChicagoCityFacultyData.csv");
  
  // Write JSON
  fs.writeFileSync(jsonFile, JSON.stringify(data, null, 2));
  console.log(`✓ Combined JSON saved: ${jsonFile} (${data.length} records)`);
  
  // Write CSV
  if (data.length > 0) {
    const csvHeader = "school_name,url,name,job_title,email\n";
    const csvRows = data.map((r) => {
      const school_name = (r.school_name || "").replace(/"/g, '""');
      const url = (r.url || "").replace(/"/g, '""');
      const name = (r.name || "").replace(/"/g, '""');
      const job_title = (r.job_title || "").replace(/"/g, '""');
      const email = (r.email || "").replace(/"/g, '""');
      return `"${school_name}","${url}","${name}","${job_title}","${email}"`;
    }).join("\n");
    
    fs.writeFileSync(csvFile, csvHeader + csvRows);
    console.log(`✓ Combined CSV saved: ${csvFile} (${data.length} records)`);
  } else {
    fs.writeFileSync(csvFile, csvHeader);
    console.log(`✓ Combined CSV saved: ${csvFile} (empty)`);
  }
}

async function main() {
  console.log("====================================================");
  console.log("Starting All Scrapers - Batch Processing");
  console.log("====================================================");
  
  // Define all scrapers with their names
  const allScrapers = [
    { fn: scrapeCPSLeadership, name: "CPS Leadership" },
    { fn: scrapeChicagohopeacademy, name: "Chicago Hope Academy" },
    { fn: scrapeChicagochristian, name: "Chicago Christian" },
    { fn: scrapeChicagojewishdayschool, name: "Chicago Jewish Day School" },
    { fn: scrapeChicagojesuitacademy, name: "Chicago Jesuit Academy" },
    { fn: scrapeNobleschools, name: "Noble Schools" },
    { fn: scrapeChicagowaldorf, name: "Chicago Waldorf" },
    { fn: scrapeChicagocommons, name: "Chicago Commons" },
    { fn: scrapeSd170, name: "SD170" },
    { fn: scrapeHsaswchicago, name: "HSASW Chicago" },
    { fn: scrapeChicagoparkschool, name: "Chicago Park School" },
    { fn: scrapeMontessoriAcademyChicago, name: "Montessori Academy Chicago" },
    { fn: scrapeLatinschool, name: "Latin School" },
    { fn: scrapeChicagocollegiate, name: "Chicago Collegiate" },
    { fn: scrapeLyceechicago, name: "Lycee Chicago" },
    { fn: scrapeD187, name: "D187" },
    { fn: scrapeToddlerTown, name: "Toddler Town" },
    { fn: scrapeAssociationHouse, name: "Association House" },
    { fn: scrapeEFACChicago, name: "EFAC Chicago" },
    { fn: scrapeGermanSchoolChicago, name: "German School Chicago" },
  ];
  
  // Process in batches of 5
  const batchSize = 5;
  const batches = [];
  for (let i = 0; i < allScrapers.length; i += batchSize) {
    batches.push(allScrapers.slice(i, i + batchSize));
  }
  
  console.log(`\n📊 Total scrapers: ${allScrapers.length}`);
  console.log(`📊 Total batches: ${batches.length}`);
  console.log(`📊 Batch size: ${batchSize}\n`);
  
  // Process all batches
  const allResults = [];
  for (let i = 0; i < batches.length; i++) {
    const batchResults = await processBatch(i + 1, batches[i]);
    allResults.push(...batchResults);
  }
  
  // Summary
  const successfulScrapers = allResults.filter(r => r.success);
  const failedScrapers = allResults.filter(r => !r.success);
  
  console.log("====================================================");
  console.log("Scraping Summary");
  console.log("====================================================");
  console.log(`✓ Successful: ${successfulScrapers.length}`);
  console.log(`✗ Failed: ${failedScrapers.length}`);
  
  if (failedScrapers.length > 0) {
    console.log("\nFailed scrapers:");
    failedScrapers.forEach(({ name, error }) => {
      console.log(`  - ${name}: ${error}`);
    });
  }
  
  // Combine and sort results
  console.log("\n📝 Combining and sorting results...");
  const combinedData = combineAndSortResults(successfulScrapers);
  
  const withEmail = combinedData.filter(r => r.email && r.email.trim() !== "").length;
  const withoutEmail = combinedData.filter(r => !r.email || r.email.trim() === "").length;
  
  console.log(`  Total records: ${combinedData.length}`);
  console.log(`  Records with email: ${withEmail}`);
  console.log(`  Records without email: ${withoutEmail}`);
  
  // Write combined files
  console.log("\n💾 Writing combined output files...");
  writeCombinedFiles(combinedData);
  
  console.log("\n====================================================");
  console.log("All scrapers completed!");
  console.log("====================================================");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
