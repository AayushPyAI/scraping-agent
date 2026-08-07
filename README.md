# Scraping Agent 🕷️

A powerful Node.js web scraping application that automatically extracts faculty and staff information from multiple Chicago-area educational institutions and organizations.

## Overview

This project uses advanced web scraping techniques to collect structured data (names, job titles, emails, URLs) from 20+ Chicago schools and educational organizations. The scraped data is processed, combined, and exported in both JSON and CSV formats for easy analysis and integration.

## Features

✨ **Multi-Source Scraping**: Scrapes faculty/staff data from 20+ Chicago educational institutions
- Chicago Public Schools (CPS) Leadership
- Private schools (Chicago Hope Academy, Jesuit Academy, Waldorf, etc.)
- Religious schools (Chicago Christian, Chicago Jewish Day School)
- Specialty schools (Latin School, Lycée Chicago, Montessori Academy)
- Other educational organizations

🚀 **Batch Processing**: Efficiently processes scrapers in configurable batches to optimize performance and resource usage

📊 **Data Export**: Automatically combines and exports results in:
- **JSON format**: Structured data for programmatic access
- **CSV format**: Spreadsheet-compatible format for analysis

🔍 **Smart Data Organization**: Prioritizes records with email addresses for easier contact and outreach

⚡ **Error Handling**: Robust error handling with detailed logging for troubleshooting failed scrapers

## Tech Stack

- **Node.js**: JavaScript runtime for server-side execution
- **Axios**: HTTP client for web requests
- **Cheerio**: jQuery-like syntax for HTML parsing
- **Playwright**: Browser automation with stealth mode
- **Puppeteer**: Headless Chrome automation
- **Scrapfly SDK**: Advanced scraping with anti-bot bypass
- **Dotenv**: Environment variable management

## Installation

1. Clone the repository:
```bash
git clone https://github.com/AayushPyAI/scraping-agent.git
cd scraping-agent
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file (if required by any scrapers):
```bash
# Add any API keys or configuration needed
```

## Usage

Run the complete scraping pipeline:
```bash
npm start
```

This will:
1. Execute all 20+ scrapers in batches of 5
2. Log progress and results for each scraper
3. Combine all results and sort by email availability
4. Export data to `output/allChicagoCityFacultyData.json` and `output/allChicagoCityFacultyData.csv`

## Output Structure

The scraped data includes the following fields:
- `school_name`: Name of the educational institution
- `url`: URL of the school's website or specific page
- `name`: Faculty/staff member's name
- `job_title`: Position or role title
- `email`: Contact email address (if available)

### Example Output (JSON)
```json
[
  {
    "school_name": "Chicago Public Schools",
    "url": "https://example.com",
    "name": "John Doe",
    "job_title": "Principal",
    "email": "john.doe@cps.edu"
  }
]
```

### Example Output (CSV)
```csv
school_name,url,name,job_title,email
"Chicago Public Schools","https://example.com","John Doe","Principal","john.doe@cps.edu"
```

## Supported Schools

The agent currently scrapes from:
1. CPS (Chicago Public Schools) Leadership
2. Chicago Hope Academy
3. Chicago Christian School
4. Chicago Jewish Day School
5. Chicago Jesuit Academy
6. Noble Schools
7. Chicago Waldorf School
8. Chicago Commons
9. School District 170
10. HSASW Chicago
11. Chicago Park School
12. Montessori Academy Chicago
13. Latin School of Chicago
14. Chicago Collegiate School
15. Lycée Chicago
16. School District 187
17. Toddler Town
18. Association House
19. EFAC Chicago
20. German School Chicago

## Project Structure

```
scraping-agent/
├── src/
│   ├── index.js                          # Main entry point
│   └── scrappers/                        # Individual scraper modules
│       ├── association_house.js
│       ├── chicagochristian.js
│       ├── chicagocollegiate.js
│       ├── chicagocommons.js
│       ├── chicagohopeacademy.js
│       ├── chicagojesuitacademy.js
│       ├── chicagojewishdayschool.js
│       ├── chicagoparkschool.js
│       ├── chicagowaldorf.js
│       ├── cpsLeadership.js
│       ├── d187.js
│       ├── hsaswchicago.js
│       ├── latinschool.js
│       ├── lyceechicago.js
│       ├── nobleschools.js
│       ├── ontessoriacademychicago.js
│       ├── scrape_efac_chicago.js
│       ├── scrape_german_school_chicago.js
│       ├── sd170.js
│       └── toddlertown.js
├── output/                               # Generated output files
│   ├── allChicagoCityFacultyData.json
│   └── allChicagoCityFacultyData.csv
├── public/
│   └── fonts/                            # Custom fonts for web interface
├── package.json
└── README.md
```

## Performance

- **Batch Size**: 5 scrapers per batch
- **Total Batches**: 4 batches (20 scrapers total)
- **Output**: Records sorted with email-having entries prioritized

## Error Handling

The application provides:
- ✓ Detailed success/failure logging for each scraper
- ✓ Graceful error handling with meaningful error messages
- ✓ Summary report showing success/failure count
- ✓ Continues processing even if individual scrapers fail

## Future Enhancements

- [ ] Add database storage for scraped data
- [ ] Implement scheduling for periodic scraping
- [ ] Add data validation and deduplication
- [ ] Create web dashboard for data visualization
- [ ] Add support for additional Chicago schools
- [ ] Implement proxy rotation for better reliability

## License

ISC

## Author

AayushPyAI

---

**Note**: This scraper respects robots.txt and follows ethical web scraping practices. Ensure you have permission to scrape data from target websites.
