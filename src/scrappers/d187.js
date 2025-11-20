import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";

const clean = (s = "") => (s ? s.replace(/\s+/g, " ").trim() : "");

export async function scrapeD187() {
  const base = "https://www.d187.org";
  const url = `${base}/staff`;
  const school = "d187";

  const outputDir = "output";
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

  const jsonFile = path.join(outputDir, `${school}_faculty.json`);
  const csvFile = path.join(outputDir, `${school}_faculty.csv`);

  console.log("📌 Launching browser...");
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1500, height: 1200 });

  console.log("⏳ Loading first page...");
  await page.goto(url, { waitUntil: "networkidle2", timeout: 0 });

  console.log("📌 Extracting ALL page numbers...");

  // Extract pagination URLs
  let pageLinks = await page.evaluate(() => {
    return Array.from(
      document.querySelectorAll(
        'nav.cms-pagination ul li a[href*="page_no"]'
      )
    ).map((a) => a.getAttribute("href"));
  });

  // Always include first page manually
  pageLinks = ["/staff?page_no=1", ...pageLinks];

  // Deduplicate links
  pageLinks = [...new Set(pageLinks)];

  console.log(`📄 Found ${pageLinks.length} pages`);
  console.log(pageLinks);

  let allStaff = [];

  for (let link of pageLinks) {
    const fullUrl = base + link;
    console.log(`➡️ Opening page: ${fullUrl}`);

    await page.goto(fullUrl, { waitUntil: "networkidle2", timeout: 0 });

    await page.waitForSelector(".staff-info", { timeout: 30000 });

    const staff = await page.evaluate(() => {
      const clean = (s) => (s ? s.replace(/\s+/g, " ").trim() : "");

      return Array.from(document.querySelectorAll(".staff-info")).map((el) => {
        const name = clean(el.querySelector(".name")?.textContent || "");
        const job_title = clean(el.querySelector(".title")?.textContent || "");

        const email = clean(
          el.querySelector('.email a[href^="mailto:"]')?.textContent || ""
        );

        return { name, job_title, email };
      });
    });

    console.log(`   ✔ Found ${staff.length} staff on this page`);

    allStaff.push(
      ...staff.map((s) => ({
        school_name: school,
        url: fullUrl,
        ...s
      }))
    );
  }

  await browser.close();

  console.log(`🎉 FINAL TOTAL: ${allStaff.length}`);

  // Save JSON
  fs.writeFileSync(jsonFile, JSON.stringify(allStaff, null, 2));

  // Save CSV
  const header = "school_name,url,name,job_title,email\n";
  const rows = allStaff
    .map(
      (r) =>
        `${r.school_name},${r.url},"${r.name}","${r.job_title}",${r.email}`
    )
    .join("\n");

  fs.writeFileSync(csvFile, header + rows);

  console.log("📄 JSON + CSV saved!");

  return allStaff;
}
