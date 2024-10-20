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
        miRequest
          .securityTokenService()
          .then(() => {
            miRequest.getDeviceList();
          })
          .catch((err) => {
            console.log(err);
            console.log("serviceToken失败");
          });
      })
      .catch(() => {
        console.log("login失败");
      });
  })
  .catch((err) => {
    console.log(err);
    console.log("sign获取失败");
  });
