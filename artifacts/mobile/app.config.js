const appJson = require("./app.json");

const replitDevDomain = process.env.REPLIT_DEV_DOMAIN;
const origin = replitDevDomain
  ? `https://${replitDevDomain}`
  : "https://replit.com/";

module.exports = {
  ...appJson.expo,
  plugins: [
    [
      "expo-router",
      {
        origin,
      },
    ],
    "expo-font",
    "expo-web-browser",
  ],
};
