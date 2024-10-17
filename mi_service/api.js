const authBaseURL = "https://account.xiaomi.com/pass";
const minaBaseUrl = " https://api.io.mi.com";

module.exports = {
  getSign: `${authBaseURL}/serviceLogin`,
  getAuthToken: `${authBaseURL}/serviceLoginAuth2`,
  deviceList: `${minaBaseUrl}/app/home/device_list`,
};
