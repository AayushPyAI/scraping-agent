// Filename: MATER_ACADEMY_MIAMI_BEACH.js

import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";
import * as cheerio from "cheerio";
import { Parser } from "json2csv";

const SCHOOL_NAME = "Mater Academy - Miami Beach";
const TARGET_URL = "https://www.materbeach.com/apps/staff/departmental.jsp?show=TDE";

const clean = (str = "") => str.replace(/\s+/g, " ").trim();

const makeFileName = (name) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, "_");

const FILE_BASE = makeFileName(SCHOOL_NAME);
const OUTPUT_DIR = path.join(process.cwd(), "..", "..", "..", "output");

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

(async () => {
  console.log('🚀 Launching browser...');
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  try {
    // Navigate to the staff page
    await page.goto('https://www.materbeach.com/apps/staff/departmental.jsp?show=TDE', {
      waitUntil: 'networkidle2'
    });

    console.log('✅ Waiting for staff list on the main page...');
    
    // FIXED SELECTOR: Use 'dl' instead of 'ul'
    await page.waitForSelector('dl.staff-categoryStaffMembers', { timeout: 10000 });

    console.log('✅ Staff list found! Now scraping...');

    // Scrape all staff members
    const staffData = await page.evaluate(() => {
      const staffList = [];
      
      // Select all staff categories
      const categories = document.querySelectorAll('.staff-category');
      
      categories.forEach(category => {
        const categoryName = category.querySelector('.staff-header')?.textContent.trim();
        const staffMembers = category.querySelectorAll('.staff-categoryStaffMember');
        
        staffMembers.forEach(member => {
          const nameElement = member.querySelector('dt');
          const positionElement = member.querySelector('dd');
          const link = member.querySelector('a')?.href;
          
          staffList.push({
            category: categoryName,
            name: nameElement?.textContent.trim(),
            position: positionElement?.textContent.trim(),
            profileUrl: link
          });
        });
      });
      
      return staffList;
    });

    console.log('✅ Successfully scraped staff data:');
    console.log(JSON.stringify(staffData, null, 2));
    console.log(`\nTotal staff members found: ${staffData.length}`);

  } catch (error) {
    console.error('❌ Scraping failed:', error.message);
  } finally {
    await browser.close();
  }
})();
