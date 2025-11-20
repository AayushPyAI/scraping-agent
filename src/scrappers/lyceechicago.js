import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";

const clean = (s = "") => s.replace(/\s+/g, " ").trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function scrapeLyceechicago() {
  const url = "https://www.lyceechicago.org/about/faculty-staff";
  const school = "lyceechicago";

  const outputDir = path.join(process.cwd(), "output");
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

  const jsonFile = path.join(outputDir, `${school}_faculty.json`);
  const csvFile = path.join(outputDir, `${school}_faculty.csv`);

  console.log("📌 Launching browser...");

  const browser = await puppeteer.launch({
    headless: true, // Set to false to see what's happening
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 1500 });

  await page.goto(url, { waitUntil: "networkidle2", timeout: 0 });

  console.log("⏳ Waiting for list items...");
  await page.waitForSelector(".fsConstituentItem", { timeout: 40000 });

  // Extract list of clickable profile selectors
  const staffLinks = await page.evaluate(() => {
    return Array.from(
      document.querySelectorAll(".fsConstituentItem .fsFullName a")
    ).map((el, index) => ({
      selector: `.fsConstituentItem:nth-of-type(${index + 1}) .fsFullName a`,
    }));
  });

  console.log(`📄 Found ${staffLinks.length} people`);

  let final = [];

  for (let i = 0; i < staffLinks.length; i++) {
    const { selector } = staffLinks[i];
    console.log(`➡️ Opening profile modal ${i + 1}/${staffLinks.length}`);

    try {
      await page.click(selector);

      // Wait for modal to open
      await page.waitForSelector("dialog.fsDialog[open]", { timeout: 10000 });

      // Wait for content to fully load
      await sleep(800);

      // Extract data from modal using correct selectors
      const modalData = await page.evaluate(() => {
        const clean = (t) => (t ? t.replace(/\s+/g, " ").trim() : "");

        const modal = document.querySelector("dialog.fsDialog[open]");
        if (!modal) return null;

        // Get the content container
        const content = modal.querySelector('[id*="DialogContent"]');
        if (!content) return null;

        // Extract name from heading
        const nameHeading = content.querySelector("h3, h2, h1, [role='heading']");
        const name = nameHeading ? clean(nameHeading.textContent) : "";

        // Get all generic divs in order
        const generics = Array.from(content.querySelectorAll("div[id*='DialogContent'] > div"));
        
        let job_title = "";
        let department = "";
        
        // The structure is: image, heading, job_title(generic), department(generic), email container
        generics.forEach((elem) => {
          const text = clean(elem.textContent);
          // Skip empty, very long text, or email containers
          if (text && text.length < 100 && !text.includes("@") && !elem.querySelector("a")) {
            if (!job_title && !elem.id.includes("Email")) {
              job_title = text;
            } else if (!department && !elem.id.includes("Email") && text !== job_title) {
              department = text;
            }
          }
        });

        // Extract email from mailto link
        const emailLink = content.querySelector('a[href^="mailto:"]');
        const email = emailLink 
          ? clean(emailLink.getAttribute("href").replace("mailto:", ""))
          : "";

        // Extract image
        const img = content.querySelector("img")?.getAttribute("src") || "";

        return { name, job_title, department, email, image: img };
      });

      if (modalData && modalData.name) {
        final.push({
          school_name: school,
          url,
          ...modalData,
        });
        console.log(`   ✓ ${modalData.name} - ${modalData.email}`);
      } else {
        console.log(`   ⚠️ Failed to extract data`);
      }

      // Close modal
      try {
        await page.click("button.fsDialogCloseButton");
      } catch (e) {
        await page.keyboard.press("Escape");
      }

      await sleep(500);
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
  }

  await browser.close();

  console.log(`\n🎉 Extracted ${final.length} records`);

  fs.writeFileSync(jsonFile, JSON.stringify(final, null, 2));

  // CSV format
  const csvHeader = "school_name,url,name,job_title,department,email,image\n";
  const csvRows = final
    .map((r) =>
      `${r.school_name},${r.url},"${r.name || ""}","${r.job_title || ""}","${r.department || ""}","${r.email || ""}","${r.image || ""}"`
    )
    .join("\n");
  fs.writeFileSync(csvFile, csvHeader + csvRows);

  console.log("📄 JSON + CSV saved!");

  return final;
}
