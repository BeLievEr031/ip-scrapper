import puppeteer from "puppeteer";
import XLSX from "xlsx";
import * as fs from "fs";
XLSX.set_fs(fs);
import express from "express";
// const year = process.argv[2];
let filename = "";

const startScraping = async (year) => {
  // Launch the browser and open a new blank page
  const browser = await puppeteer.launch({
    // executablePath: `C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe`,
    headless: false,
    args: ["--start-maximized"],
  });

  const page = await browser.newPage();

  // Navigate the page to a URL
  await page.goto(`https://www.iplt20.com/matches/results/${year}`);
  // Set screen size
  await page.setViewport({ width: 1280, height: 1024 });

  await page.waitForSelector("#team_archive");
  await page.waitForSelector("#team_archive li.ng-scope");

  const matches = await page.$$("#team_archive li.ng-scope"); // 74

  const matchCenters = await page.$$("a.vn-matchBtn");

  const matchSchedule = await page.$$(
    "#team_archive li.ng-scope div.vn-schedule-head"
  );

  // vn-shedule-desk
  const matchArr = [];
  const teamsObj = {};
  for (let i = 0; i < 2; i++) {
    let obj = {};
    obj.dateTime = await scheduleDataProvider(
      "div.vn-schedule-head .vn-matchDateTime",
      matches[i]
    );
    obj.matchNo = await scheduleDataProvider(
      "div.vn-schedule-head .vn-matchOrder",
      matches[i]
    );
    obj.venue = await scheduleDataProvider(
      "div.vn-schedule-head .vn-venueDet",
      matches[i]
    );
    obj.winner = await scheduleDataProvider(
      "div.vn-shedule-desk .vn-ticketTitle",
      matches[i]
    );
    obj.team1 = await scheduleDataProvider(
      "div.vn-shedule-desk .live-score .vn-shedTeam .vn-teamTitle .vn-teamName h3",
      matches[i]
    );
    obj.team2 = await scheduleDataProvider(
      "div.vn-shedule-desk .live-score .vn-shedTeam.vn-team-2 .vn-teamTitle .vn-teamName h3",
      matches[i]
    );

    teamsObj[obj.team1] = "null";
    teamsObj[obj.team2] = "null";

    obj.team1score = await scheduleDataProvider(
      "div.vn-shedule-desk .live-score .vn-shedTeam .vn-teamTitle p",
      matches[i]
    );
    obj.team1over = await scheduleDataProvider(
      "div.vn-shedule-desk .live-score .vn-shedTeam .vn-teamTitle span",
      matches[i]
    );

    obj.team2score = await scheduleDataProvider(
      "div.vn-shedule-desk .live-score .vn-shedTeam.vn-team-2 .vn-teamTitle p",
      matches[i]
    );
    obj.team2over = await scheduleDataProvider(
      "div.vn-shedule-desk .live-score .vn-shedTeam.vn-team-2 .vn-teamTitle span",
      matches[i]
    );

    const hrefProperty = await matchCenters[i].getProperty("href");
    // Extract the href value from the property
    const href = await hrefProperty.jsonValue();

    const newPage = await browser.newPage();
    // Navigate the page to a URL
    await newPage.goto(href);

    await newPage.waitForSelector(`[data-id="scoreCard"]`);
    const scoreCard = await newPage.$('[data-id="scoreCard"]');
    await scoreCard.click();

    try {
      await newPage.waitForSelector(
        `.widgetContent [ng-if="matchSummary.MOM!=undefined && matchSummary.MOM!=''"] .ng-binding`
      );
      const MOM = await newPage.$(
        `.widgetContent [ng-if="matchSummary.MOM!=undefined && matchSummary.MOM!=''"] .ng-binding`
      );
      const MOMPlayer = await MOM?.evaluate((el) => el.textContent);
      obj.MOMPlayer = MOMPlayer;
    } catch (error) {
      console.log(error);
    }

    matchArr.push(obj);

    await newPage.close();
  }

  createExcel(teamsObj, matchArr, year);
  return true;
};

function createExcel(teamsObj, matchArr, year) {
  const worksheet = XLSX.utils.json_to_sheet(matchArr);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "whole season");

  /* fix headers */
  XLSX.utils.sheet_add_aoa(worksheet, [Object.keys(matchArr[0])]);

  /* calculate column width */
  worksheet["!cols"] = [
    { wch: 30 },
    { wch: 30 },
    { wch: 30 },
    { wch: 30 },
    { wch: 30 },
    { wch: 30 },
    { wch: 30 },
    { wch: 30 },
    { wch: 30 },
    { wch: 30 },
    { wch: 30 },
  ];

  createExcelTeamWise(teamsObj, matchArr, workbook);

  /* create an XLSX file and try to save to Presidents.xlsx */
  XLSX.writeFile(workbook, `match-record-${year}.xlsx`, { compression: true });
  filename = `match-record-${year}.xlsx`;
}

const scheduleDataProvider = async (selector, match) => {
  const promiseData = await match.$(selector);
  const actualData = await promiseData?.evaluate((el) => el.textContent);
  return actualData;
};

function createExcelTeamWise(teamsObj, matchArr, workbook) {
  const teamArr = Object.keys(teamsObj);
  for (let i = 0; i < teamArr.length; i++) {
    const singleTeamMatchArr = matchArr.filter((elem) => {
      return elem.team1 === teamArr[i] || elem.team2 === teamArr[i];
    });

    const worksheet = XLSX.utils.json_to_sheet(singleTeamMatchArr);
    XLSX.utils.book_append_sheet(workbook, worksheet, teamArr[i]);
    worksheet["!cols"] = [
      { wch: 30 },
      { wch: 30 },
      { wch: 30 },
      { wch: 30 },
      { wch: 30 },
      { wch: 30 },
      { wch: 30 },
      { wch: 30 },
      { wch: 30 },
      { wch: 30 },
      { wch: 30 },
    ];
    /* fix headers */
    XLSX.utils.sheet_add_aoa(worksheet, [Object.keys(matchArr[0])]);
  }
}

// startScraping();
import path from "path";
import cors from "cors";
const app = express();

app.use(cors({ origin: "*"}));
app.use(express.json({ limit: "16KB" }));
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 5000;

app.post("/", async (req, res) => {
  const { year } = req.body;
  if (!year) {
    return res.status(422).json({
      status: false,
      msg: "All fields required.",
    });
  }

  const isScrapped = await startScraping(year);
  if (isScrapped) {
    res.status(200).json({
      status: true,
      msg: "IPL data scrapped.",
      filename: `${filename}`,
    });

    filename = "";
  } else {
    res.status(500).json({
      status: true,
      msg: "Scrapping Failed.",
    });
  }
});

app.get("/download", (req, res) => {
  const { file } = req.query;
  res.sendFile(path.join(process.cwd(), file));
});

app.get("/", (req, res) => {
  // const { file } = req.query;
  // res.sendFile(path.join(process.cwd(), file));
  res.json({
    msg: "Conected!!"
  })
});

app.listen(PORT, () => {
  console.log("Connected to the server", PORT);
});
