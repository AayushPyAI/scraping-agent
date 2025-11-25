// filename: settles-bridge-elementary-school.js
// Scraper for Settles Bridge Elementary School
// URL: https://settlesbridge.forsyth.k12.ga.us/our-school/staff-directory

import fs from "fs";
import path from "path";
import puppeteer from "puppeteer";
import * as cheerio from 'cheerio';

const SCHOOL_NAME = "Settles Bridge Elementary School";
const URL = "https://settlesbridge.forsyth.k12.ga.us/our-school/staff-directory";

function makeFileName(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

const FILE_BASE = makeFileName(SCHOOL_NAME);
const OUTPUT_DIR = path.join(process.cwd(), "..", "..", "..", "output");
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);

const JSON_FILE = path.join(OUTPUT_DIR, `${FILE_BASE}.json`);
const CSV_FILE = path.join(OUTPUT_DIR, `${FILE_BASE}.csv`);

const normalize = (text) => text ? text.replace(/\s+/g, ' ').trim() : "";

async function scrape() {
  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  await page.goto(URL, { waitUntil: "networkidle2", timeout: 0 });
  const html = await page.content();
  const $ = cheerio.load(html);

  const results = [];

  $("table tbody tr").each((_, row) => {
    const cells = $(row).find('td');

    const lastName = normalize($(cells[0]).text());
    const firstName = normalize($(cells[1]).text());
    const email = normalize($(cells[3]).find('a').text());

    const name = normalize(`${firstName} ${lastName}`);

    results.push({
      school_name: SCHOOL_NAME,
      url: URL,
      name: name || "",
      job_title: "",
      email: email || ""
    });
  });

  // Save JSON
  fs.writeFileSync(JSON_FILE, JSON.stringify(results, null, 2));

  // Save CSV
  const csvHeader = "school_name,url,name,job_title,email\n";
  const csvRows = results.map(r =>
    `"${r.school_name}","${r.url}","${r.name}","${r.job_title}","${r.email}"`
  ).join("\n");

  fs.writeFileSync(CSV_FILE, csvHeader + csvRows);

  await browser.close();
  console.log(`✅ Scraping complete for ${SCHOOL_NAME}`);
  console.log(`JSON: ${JSON_FILE}`);
  console.log(`CSV : ${CSV_FILE}`);
}

scrape();