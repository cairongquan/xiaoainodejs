const axios = require("axios");
const url = require("../api");
const crypto = require("crypto");
const qs = require("qs");
const utils = require("../utils");
const tough = require("tough-cookie"); // 用于管理 Cookie 的库
const { wrapper } = require("axios-cookiejar-support");

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
    this.sign = "";
    this.authObj = {};
    this.sid = "micoapi";
    this.http = client;
  }

  getRandom(length) {
    const chars =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    return Array.from({ length }, () =>
      chars.charAt(Math.floor(Math.random() * chars.length))
    ).join("");
  }

  async getSign() {
    const { data: signResult } = await this.http({
      method: "get",
      url: url.getSign,
      params: {
        sid: this.sid,
        _json: true,
      },
    });
    const match = signResult.match(/_sign":"(.*?)",/);
    if (match && match[1]) {
      this.sign = match[1];
      return Promise.resolve();
    } else {
      return Promise.reject();
    }
  }

  async getAuthToken() {
    const { data: authResult } = await this.http({
      method: "post",
      url: url.getAuthToken,
      data: qs.stringify({
        _json: "true",
        _sign: this.sign,
        callback: "https://api.mina.mi.com/sts",
        hash: crypto
          .createHash("md5")
          .update(this.password)
          .digest("hex")
          .toUpperCase(),
        qs: "%3Fsid%3Dmicoapi",
        serviceParam: '{"checkSafePhone":false}',
        sid: "micoapi",
        user: this.username,
      }),
    });
    try {
      this.authObj = Object.assign(
        this.authObj,
        JSON.parse(authResult.slice(11))
      );
    } catch {
      return Promise.reject();
    }
  }

  async getDeviceList() {
    const cookies = {
      userId: this.authObj.userId,
      serviceToken: this.authObj.passToken,
    };
    console.log(cookies, this.authObj);
    // const { data: deviceList } = await this.http({
    //   method: "POST",
    //   url: url.deviceList,
    //   data: utils.signData(
    //     url.deviceList,
    //     {
    //       getVirtualModel: false,
    //       getHuamiDevices: 0,
    //     },
    //     this.authObj.ssecurity
    //   ),
    //   headers: {
    //     Cookie: cookies,
    //   },
    // });
    // console.log(deviceList.data);
  }
};
