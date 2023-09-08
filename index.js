const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");
const dayjs = require("dayjs");

// add locale id
const localeId = require("dayjs/locale/id");
dayjs.locale(localeId);

// define URL
const URL = "https://sipd.kemendagri.go.id/aklap";
function getURL(url) {
  return URL + url;
}

const username = "ppkATMA";
const password = "kaltimprov";

/**
 * Login to SIPD
 * @param {string} username
 * @param {string} password
 * @returns {Promise<void>}
 * @example
 * login("ppkATMA", "**********");
 */
const login = async (username, password) => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    timezoneId: "Asia/Jakarta",
  });

  const page = await context.newPage();

  await page.goto(getURL("/login"));
  await page.isVisible('btn[type="submit"]');

  await page.fill('input[name="username"]', username);
  await page.fill('input[name="password"]', password);

  const tahun = dayjs().format("YYYY");

  await page.click("#vs1__combobox");
  await page.keyboard.type(tahun);

  await page.keyboard.press("Enter");

  await page.waitForResponse(
    (resp) => resp.url().includes("daerah-by-tahun") && resp.status() === 200
  );

  await page.click("#vs2__combobox");

  await page.keyboard.type("Provinsi Kalimantan Timur");
  await page.keyboard.press("Enter");

  await page.click('label[for="remember"]');

  await page.getByText("Log In").click();

  await page.waitForURL(getURL("/home"));

  console.log("login success");

  const cookies = await context.cookies();
  const cookieJson = JSON.stringify(cookies);

  if (!fs.existsSync(path.resolve(__dirname, "auth_session", username))) {
    fs.mkdirSync(path.resolve(__dirname, "auth_session", username), {
      recursive: true,
    });
  }

  fs.writeFileSync(
    path.resolve(__dirname, "auth_session", username, "cookies.json"),
    cookieJson
  );

  console.log("cookies saved");

  await browser.close();
};

/**
 * Check login status
 * @param {string} username
 * @returns {Promise<void>}
 * @example
 * checkLogin("ppkATMA");
 */
const checkLogin = async (username) => {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    timezoneId: "Asia/Jakarta",
  });

  // cek apakah auth_session/username/cookies.json ada
  if (
    !fs.existsSync(
      path.resolve(__dirname, "auth_session", username, "cookies.json")
    )
  ) {
    console.log("User belum login");
    await browser.close();
    return;
  }

  const cookies = fs.readFileSync(
    path.resolve(__dirname, "auth_session", username, "cookies.json"),
    "utf8"
  );

  const deserializedCookies = JSON.parse(cookies);
  await context.addCookies(deserializedCookies);

  const page = await context.newPage();

  await page.goto(getURL("/home"));

  console.log("User udah login kok");

  await browser.close();
};

// run login()
// login(username, password);
checkLogin(username);
