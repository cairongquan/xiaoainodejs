const dotenv = require("dotenv");
const MiRequest = require("./module/require.js");

dotenv.config({
  path: "./mi.env",
});

const miRequest = new MiRequest();
miRequest
  .getSign()
  .then(() => {
    miRequest
      .getAuthToken()
      .then(() => {
        miRequest.getDeviceList();
      })
      .catch(() => {
        console.log("login失败");
      });
  })
  .catch(() => {
    console.log("sign获取失败");
  });
