import { scrapeChicagochristian } from "./scrappers/chicagochristian.js";
import { scrapeChicagocollegiate } from "./scrappers/chicagocollegiate.js";
import { scrapeChicagocommons } from "./scrappers/chicagocommons.js";
import { scrapeChicagohopeacademy } from "./scrappers/chicagohopeacademy.js";
import { scrapeChicagojesuitacademy } from "./scrappers/chicagojesuitacademy.js";
import { scrapeChicagojewishdayschool } from "./scrappers/chicagojewishdayschool.js";
import { scrapeChicagoparkschool } from "./scrappers/chicagoparkschool.js";
import { scrapeChicagowaldorf } from "./scrappers/chicagowaldorf.js";
import { scrapeCPSLeadership } from "./scrappers/cpsLeadership.js";
import { scrapeHsaswchicago } from "./scrappers/hsaswchicago.js";
import { scrapeLatinschool } from "./scrappers/latinschool.js";
import { scrapeLyceechicago } from "./scrappers/lyceechicago.js";
import { scrapeNobleschools } from "./scrappers/nobleschools.js";
import { scrapeMontessoriAcademyChicago } from "./scrappers/ontessoriacademychicago.js";
import { scrapeSd170 } from "./scrappers/sd170.js";

async function main() {
  console.log("----------------------------------------------------");
  console.log("Starting All Scrapers...");
  console.log("----------------------------------------------------");

  
//   await scrapeCPSLeadership();
//   await scrapeChicagohopeacademy();
//   await scrapeChicagochristian();
//   await scrapeChicagojewishdayschool();
  // await scrapeChicagojesuitacademy();
  // await scrapeNobleschools();
  // await scrapeChicagowaldorf();
  // await scrapeChicagocommons();
  // await scrapeSd170();
  // await scrapeHsaswchicago();
  // await scrapeChicagoparkschool();
  // await scrapeMontessoriAcademyChicago();
  // await scrapeLatinschool();
  // await scrapeChicagocollegiate();
  await scrapeLyceechicago();
  console.log("----------------------------------------------------");
  console.log("All scrapers completed!");
  console.log("----------------------------------------------------");
}

main();
