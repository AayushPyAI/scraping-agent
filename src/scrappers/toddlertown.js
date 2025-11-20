import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";

const clean = (s = "") => (s ? s.replace(/\s+/g, " ").trim() : "");

export async function scrapeToddlerTown() {
  const url = "https://toddlertownchildrenslearningacademy.com/meet-our-staff/";
  const school = "toddlertown";

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
  await page.setViewport({ width: 1400, height: 1200 });

  console.log("⏳ Loading page...");
  await page.goto(url, { waitUntil: "networkidle2", timeout: 0 });

  console.log("⏳ Waiting for widget blocks...");
  await page.waitForSelector(".elementor-widget", { timeout: 30000 });

  console.log("✔ Extracting staff...");

  const staff = await page.evaluate(() => {
    const clean = (s = "") => (s ? s.replace(/\s+/g, " ").trim() : "");
  
    const widgets = Array.from(
      document.querySelectorAll(
        ".elementor-widget-heading, .elementor-widget-icon-list"
      )
    );
  
    const results = [];
  
    let tempName = "";
    let tempJob = "";
  
    for (let i = 0; i < widgets.length; i++) {
      const w = widgets[i];
  
      // HEADING (Name or Job Title)
      if (w.classList.contains("elementor-widget-heading")) {
        const h = w.querySelector("h1,h2,h3");
        if (!h) continue;
  
        const text = clean(h.textContent);
  
        // First heading = Name
        if (!tempName) {
          tempName = text;
          continue;
        }
  
        // Second heading = Job Title
        if (!tempJob) {
          tempJob = text;
          continue;
        }
      }
  
      // ICON LIST (contains email)
      if (w.classList.contains("elementor-widget-icon-list")) {
        const mail = w.querySelector('a[href^="mailto:"]');
  
        if (mail && tempName && tempJob) {
          const email = clean(mail.getAttribute("href").replace("mailto:", ""));
  
          // Save only VALID staff (must have email)
          results.push({
            name: tempName,
            job_title: tempJob,
            email,
          });
        }
  
        // Reset to capture next staff entry
        tempName = "";
        tempJob = "";
      }
    }
  
    return results;
  });
  
  

  await browser.close();

  console.log(`🎉 Extracted ${staff.length} records`);

  const final = staff.map((s) => ({
    school_name: school,
    url,
    ...s,
  }));

  fs.writeFileSync(jsonFile, JSON.stringify(final, null, 2));

  const header = "school_name,url,name,job_title,email\n";
  const rows = final
    .map(
      (r) =>
        `${r.school_name},${r.url},"${r.name}","${r.job_title}",${r.email}`
    )
    .join("\n");

  fs.writeFileSync(csvFile, header + rows);

  console.log("📄 JSON + CSV saved!");

  return final;
}
