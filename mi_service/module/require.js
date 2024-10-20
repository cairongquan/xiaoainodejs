const axios = require("axios");
const url = require("../api");
const crypto = require("crypto");
const qs = require("qs");
const utils = require("../utils");
const tough = require("tough-cookie"); // 用于管理 Cookie 的库
const { wrapper } = require("axios-cookiejar-support");
const request = require("request");

// 创建一个 Cookie Jar
const cookieJar = new tough.CookieJar();

// 包装 axios 实例，使其支持 Cookie Jar
const client = wrapper(
  axios.create({
    jar: cookieJar, // 使用 Cookie Jar
    withCredentials: true, // 允许发送和接收 Cookies
  })
);

module.exports = class MiRequest {
  constructor() {
    const { username, password } = process.env;
    this.username = username;
    this.password = password;
    this.authObj = {};
    this.signObj = {};
    this.sid = "xiaomiio";
    this.http = client;
    this.deviceId = this.getRandom(16).toUpperCase();
    this.serviceToken = "";
  }

  getRandom(length) {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    return Array.from({ length }, () =>
      chars.charAt(Math.floor(Math.random() * chars.length))
    ).join("");
  }

  async securityTokenService() {
    const { location, nonce, ssecurity } = this.authObj;
    try {
      // 拼接 nsec 字符串
      const nsec = `nonce=${nonce}&${ssecurity}`;
      const clientSign = crypto
        .createHash("sha1")
        .update(nsec)
        .digest()
        .toString("base64");
      const requireUrl =
        location + "&clientSign=" + encodeURIComponent(clientSign);

      const response = await axios.get(requireUrl);
      const cookies = response.headers["set-cookie"];
      const serviceToken = cookies
        .find((cookie) => cookie.startsWith("serviceToken="))
        .split(";")[0]
        .split("=")[1];
      // 检查是否获取到 serviceToken
      if (!serviceToken) {
        throw new Error(response.data);
      }
      this.serviceToken = serviceToken;
      return Promise.resolve();
    } catch (error) {
      throw error;
    }
  }

  async getSign() {
    const result = await axios({
      method: "get",
      url: url.getSign,
      params: {
        sid: this.sid,
        _json: true,
      },
      headers: {
        "User-Agent":
          "APP/com.xiaomi.mihome APPV/6.0.103 iosPassportSDK/3.9.0 iOS/14.4 miHSTS",
        Cookie: `sdkVersion=3.9; deviceId=${this.deviceId}`,
      },
      maxRedirects: 0,
    });
    try {
      this.signObj = JSON.parse(result.data.slice(11));
      console.log(this.signObj);
      return Promise.resolve();
    } catch (err) {
      console.log(err, "signError");
      return Promise.reject();
    }
  }

  getAuthToken() {
    return new Promise((resolve, reject) => {
      const options = {
        method: "POST",
        url: url.getAuthToken, // 替换为实际的 URL
        body: qs.stringify({
          _json: true,
          _sign: this.signObj["_sign"],
          callback: this.signObj["callback"],
          hash: "8A953B2FEB1068F0BBB1C46B64DF03B0",
          qs: this.signObj["qs"],
          sid: this.signObj["sid"],
          user: this.username,
        }),
        headers: {
          "User-Agent":
            "APP/com.xiaomi.mihome APPV/6.0.103 iosPassportSDK/3.9.0 iOS/14.4 miHSTS",
          Cookie: `sdkVersion=3.9; deviceId=${this.deviceId}`, // 使用 Cookie 字段
          "Content-Type": "application/x-www-form-urlencoded", // 添加 Content-Type 头
        },
        followRedirect: false, // 禁止重定向
      };

      request(options, (err, data, body) => {
        try {
          this.authObj = JSON.parse(body.slice(11));
          console.log(this.authObj);
          resolve();
        } catch (err) {
          reject(err);
        }
        resolve(data.body);
      });
    });
  }

  async getDeviceList() {
    const option = {
      method: "POST",
      url: url.deviceList,
      body: qs.stringify(
        utils.signData(
          url.deviceList,
          {
            getVirtualModel: false,
            getHuamiDevices: 0,
          },
          this.authObj.ssecurity
        )
      ),
      headers: {
        "User-Agent":
          "iOS-14.4-6.0.103-iPhone12,3--D7744744F7AF32F0544445285880DD63E47D9BE9-8816080-84A3F44E137B71AE-iPhone",
        "x-xiaomi-protocal-flag-cli": "PROTOCAL-HTTP2",
        Cookie: `userId=${this.authObj.userId}; serviceToken=${this.serviceToken}; PassportDeviceId=${this.deviceId}`,
      },
    };
    return new Promise((resolve, reject) => {
      request(option, (err, data, body) => {
        console.log(err, body);
      });
    });
  }
};
