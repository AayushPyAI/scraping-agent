#!/usr/bin/env node
// White Settlement Independent School District Staff Scraper
// URL: https://www.wsisd.com/staff/directory
// Output: JSON + CSV in output folder
// ESM + Cheerio + Batched Pagination

import fs from 'fs';
import path from 'path';
import * as cheerio from 'cheerio';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCHOOL_NAME = "White Settlement Independent School District";

const makeFileName = (name) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

const FILE_BASE = makeFileName(SCHOOL_NAME);
const OUTPUT_DIR = path.join(process.cwd(), "..", "..", "..", "output");

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const BASE_URL = "https://www.wsisd.com/staff/directory";
const BATCH_SIZE = 5; // pages per batch

async function fetchPage(page = 1) {
  const url = page === 1 ? BASE_URL : `${BASE_URL}?const_page=${page}&`;
  const res = await fetch(url);
  return await res.text();
}

function extractTotalPages(html) {
  const $ = cheerio.load(html);
  const label = $('.fsPaginationLabel').text();
  // example: showing 1 - 15 of 856 constituents
  const total = parseInt(label.match(/of\s+(\d+)/)?.[1] || '0');
  const perPage = 15;
  return Math.ceil(total / perPage);
}

function parseStaff(html) {
  const $ = cheerio.load(html);
  const results = [];

  $('.fsConstituentItem').each((_, el) => {
    const name = $(el).find('.fsFullName a').text().trim();
    const title = $(el).find('.fsTitles').text().replace('Titles:', '').trim();
    const email = $(el)
      .find('.fsEmail a')
      .attr('href')
      ?.replace('mailto:', '') || '';

    if (name) {
      results.push({
        school: SCHOOL_NAME,
        name,
        title,
        email
      });
    }
  });

  return results;
}

async function scrapeAll() {
  console.log(`\n🔍 Scraping ${SCHOOL_NAME}...`);

  const firstPageHtml = await fetchPage(1);
  const totalPages = extractTotalPages(firstPageHtml);

  console.log(`📄 Total Pages: ${totalPages}`);

  let allData = parseStaff(firstPageHtml);

  const pages = [];
  for (let i = 2; i <= totalPages; i++) pages.push(i);

  for (let i = 0; i < pages.length; i += BATCH_SIZE) {
    const batch = pages.slice(i, i + BATCH_SIZE);

    const responses = await Promise.all(
      batch.map(p => fetchPage(p).then(html => parseStaff(html)))
    );

    responses.forEach(arr => allData.push(...arr));

    console.log(`✅ Processed pages ${batch.join(', ')}`);
  }

  saveFiles(allData);
}

function saveFiles(data) {
  const jsonPath = path.join(OUTPUT_DIR, `${FILE_BASE}.json`);
  const csvPath = path.join(OUTPUT_DIR, `${FILE_BASE}.csv`);

  fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2));

  const headers = ['school', 'name', 'title', 'email'];
  const csvRows = [headers.join(',')];

  for (const row of data) {
    csvRows.push(headers.map(h => `"${(row[h] || '').replace(/"/g, '""')}"`).join(','));
  }

  fs.writeFileSync(csvPath, csvRows.join('\n'));

  console.log(`\n📁 Files saved:`);
  console.log(`- ${jsonPath}`);
  console.log(`- ${csvPath}`);
}

scrapeAll().catch(err => console.error(err));
