import fs from "fs";
import path from "path";
import puppeteer from "puppeteer"; // pure puppeteer

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
const clean = (s = "") => s.replace(/\s+/g, " ").trim();

export async function scrapeLatinschool() {
  const url =
    "https://www.latinschool.org/about-us/facultystaff?utf8=%E2%9C%93&const_search_group_ids=229&const_search_role_ids=1&const_search_keyword=&const_search_first_name=&const_search_last_name=&const_search_department=";

  const school = "latinschool";

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
  await page.setViewport({ width: 1600, height: 1400 });

  await page.goto(url, { waitUntil: "networkidle2", timeout: 0 });

  let allStaff = [];

  console.log("⏳ Waiting for first staff items...");
  await page.waitForSelector(".fsConstituentItem", { timeout: 40000 });

  // Function to extract staff from current page
  const scrapeCurrentPage = async () => {
    const staff = await page.evaluate(() => {
      const clean = (t) => (t ? t.replace(/\s+/g, " ").trim() : "");

      const cards = Array.from(document.querySelectorAll(".fsConstituentItem"));

      return cards.map((card) => {
        const name = clean(card.querySelector(".fsFullName a")?.textContent);

        let job_title = "";
        const titleEl = card.querySelector(".fsTitles");
        if (titleEl) {
          job_title = clean(titleEl.innerText.replace("Titles:", ""));
        }

        return {
          name,
          job_title,
          email: "", // Finalsite list view does not show email
        };
      });
    });

    return staff.filter((s) => s.name);
  };

  // ⏳ Scrape first page
  console.log("📄 Scraping page 1...");
  allStaff.push(...(await scrapeCurrentPage()));

  // Handle pagination
  let pageNum = 1;

  while (true) {
    // Try multiple possible NEXT button selectors (Finalsite varies)
    const nextButtonSelectors = [
      ".fsPaginationNext",
      "a.fsElementPaginationNext",
      ".fsLoadMore a",
      ".fsPagination a[aria-label='Next']",
    ];

    let nextExists = false;

    for (const sel of nextButtonSelectors) {
      const exists = await page.$(sel);
      if (exists) {
        nextExists = sel;
        break;
      }
    }

    if (!nextExists) {
      console.log("⛔ No more pages found. Pagination ended.");
      break;
    }

    pageNum++;
    console.log(`➡️ Clicking Next (Page ${pageNum}) using selector: ${nextExists}`);

    await page.click(nextExists);
    await sleep(1000);

    // Wait for items to reload
    await page.waitForSelector(".fsConstituentItem", { timeout: 30000 });

    // Scrape next page
    console.log(`📄 Scraping page ${pageNum}...`);
    const nextPageData = await scrapeCurrentPage();

    if (nextPageData.length === 0) {
      console.log("⚠️ No new staff detected — pagination likely ended.");
      break;
    }

    allStaff.push(...nextPageData);
  }

  await browser.close();

  // Normalize
  const final = allStaff.map((s) => ({
    school_name: school,
    url,
    ...s,
  }));

  console.log(`🎉 TOTAL STAFF EXTRACTED: ${final.length}`);

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
