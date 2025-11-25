#!/usr/bin/env node
// Scraper for Cristo Rey Jesuit Seattle High School
// URL: https://www.cristoreyseattle.org/about-us/faculty-staff
// Handles pagination + visits profile pages to extract email
// Saves JSON and CSV in output folder

import fs from 'fs';
import path from 'path';
import * as cheerio from 'cheerio';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCHOOL_NAME = 'Cristo Rey Jesuit Seattle High School';

function makeFileName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

const FILE_BASE = makeFileName(SCHOOL_NAME);
const OUTPUT_DIR = path.join(process.cwd(), '..', '..', '..', 'output');
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const BASE_URL = 'https://www.cristoreyseattle.org/about-us/faculty-staff';
const CONCURRENT_BATCH = 5;

async function fetchHTML(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  return res.text();
}

function parseStaffFromPage(html) {
  const $ = cheerio.load(html);
  const staff = [];

  $('.fsConstituentItem').each((_, el) => {
    const name = $(el).find('.fsFullName a').text().trim();
    const title = $(el).find('.fsTitles').text().trim();
    const profileLink = $(el).find('.fsViewProfileLink a').attr('href');

    staff.push({
      name,
      title,
      profileLink: profileLink && profileLink !== '#' ? profileLink : null
    });
  });

  return staff;
}

function getTotalPages(html) {
  const $ = cheerio.load(html);
  const label = $('.fsPaginationLabel').text();
  const match = label.match(/of\s+(\d+)/i);
  if (!match) return 1;

  const totalItems = parseInt(match[1], 10);
  const perPageMatch = label.match(/showing\s+1\s+-\s+(\d+)/i);
  const perPage = perPageMatch ? parseInt(perPageMatch[1], 10) : 24;

  return Math.ceil(totalItems / perPage);
}

async function getEmailFromProfile(relativeUrl) {
  try {
    const url = relativeUrl.startsWith('http')
      ? relativeUrl
      : new URL(relativeUrl, BASE_URL).href;

    const html = await fetchHTML(url);
    const $ = cheerio.load(html);

    const mailLink = $('a[href^="mailto:"]').first().attr('href');
    return mailLink ? mailLink.replace('mailto:', '').trim() : '';
  } catch {
    return '';
  }
}

async function scrapeAll() {
  console.log('Starting scrape for:', SCHOOL_NAME);

  const firstHTML = await fetchHTML(BASE_URL);
  const totalPages = getTotalPages(firstHTML);

  console.log('Total pages detected:', totalPages);

  let allStaff = [];

  for (let page = 1; page <= totalPages; page++) {
    const pageUrl = page === 1 ? BASE_URL : `${BASE_URL}?const_page=${page}&`;
    console.log('Fetching page:', pageUrl);

    const html = await fetchHTML(pageUrl);
    const staffBatch = parseStaffFromPage(html);

    // Process profiles in batches
    for (let i = 0; i < staffBatch.length; i += CONCURRENT_BATCH) {
      const chunk = staffBatch.slice(i, i + CONCURRENT_BATCH);

      const enriched = await Promise.all(
        chunk.map(async (person) => {
          let email = '';
          if (person.profileLink) {
            email = await getEmailFromProfile(person.profileLink);
          }
          return {
            school: SCHOOL_NAME,
            name: person.name,
            title: person.title,
            email
          };
        })
      );

      allStaff.push(...enriched);
      console.log(`Processed ${allStaff.length} records so far...`);
    }
  }

  return allStaff;
}

function saveJSON(data) {
  const filePath = path.join(OUTPUT_DIR, `${FILE_BASE}.json`);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  console.log('JSON saved:', filePath);
}

function saveCSV(data) {
  const filePath = path.join(OUTPUT_DIR, `${FILE_BASE}.csv`);

  const headers = ['school', 'name', 'title', 'email'];
  const rows = data.map(d =>
    headers.map(h => `"${(d[h] || '').replace(/"/g, '""')}"`).join(',')
  );

  fs.writeFileSync(filePath, [headers.join(','), ...rows].join('\n'));
  console.log('CSV saved:', filePath);
}

(async () => {
  try {
    const result = await scrapeAll();
    saveJSON(result);
    saveCSV(result);
    console.log('✅ Scraping completed successfully');
  } catch (err) {
    console.error('❌ Scraping failed:', err);
  }
})();
