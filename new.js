const axios = require('axios');
const qs = require('qs');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function getRandom(length) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    return Array.from({ length }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
}

class XiaomiTTS {
    constructor(user, password) {
        this.loginResult = false;
        this.user = user;
        this.password = password;
        this.serviceToken = null;
        this.deviceIds = null;
        this.userId = null;
        this.cookies = {};
        this.request = axios.create({
            baseURL: 'https://account.xiaomi.com',
            headers: {
                'User-Agent': 'APP/com.xiaomi.mihome APPV/6.0.103 iosPassportSDK/3.9.0 iOS/14.4 miHSTS',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
                'Accept-Encoding': 'gzip, deflate, br',
                'Accept-Language': 'zh-CN,zh;q=0.9'
            }
        });

        this.sign = null;
    }

    async login() {
        try {
            const signResult = await this.getSign();
            if (!signResult) {
                console.warn('get_sign Failed');
                return;
            }

            const loginResult = await this.serviceLoginAuth2();
            if (!loginResult) {
                console.warn('Request Login_url Failed');
                return;
            }
            if (this.serviceLoginAuth2Json.code === 0) {
                const miaiLoginResult = await this.loginMiai();
                if (!miaiLoginResult) {
                    console.warn('login miai Failed');
                    return;
                }

                const deviceIdResult = await this.getDeviceId();
                if (!deviceIdResult) {
                    console.warn('get_deviceId Failed');
                    return;
                }

                this.loginResult = true;
            } else if (this.serviceLoginAuth2Json.code === 87001) {
                // Handle CAPTCHA
                console.warn('CAPTCHA required.');
            } else if (this.serviceLoginAuth2Json.code === 70016) {
                console.error('Incorrect password');
            }
        } catch (error) {
            console.error(error);
        }
    }

    async getSign() {
        const url = `https://account.xiaomi.com/pass/serviceLogin?sid=micoapi&_json=true`;
        try {
            const response = await this.request.get(url);
            const match = response.data.match(/_sign":"(.*?)",/);
            if (match && match[1]) {
                this.sign = match[1];
                return true;
            }
            return false;
        } catch (error) {
            console.error(error);
            return false;
        }
    }

    async serviceLoginAuth2() {
        const url = 'https://account.xiaomi.com/pass/serviceLoginAuth2';
        const postData = {
            '_json': 'true',
            '_sign': this.sign,
            'callback': 'https://api.mina.mi.com/sts',
            'hash': crypto.createHash('md5').update(this.password).digest('hex').toUpperCase(),
            'qs': '%3Fsid%3Dmicoapi',
            'serviceParam': '{"checkSafePhone":false}',
            'sid': 'micoapi',
            'user': this.user
        };

        try {
            const response = await this.request.post(url, qs.stringify(postData), {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    Referer: 'https://account.xiaomi.com/pass/serviceLogin?sid=micoapi',
                    Origin: "https://account.xiaomi.com"
                },
            });
            this.serviceLoginAuth2Json = JSON.parse(response.data.slice(11));
            console.log(this.serviceLoginAuth2Json)
            await this.request.get(`https://api2.mina.mi.com/admin/v2/device_list?master=0&requestId=app_ios_${getRandom(30)}`, {
                headers: {

                }
            }).then(res => {
                console.log(res.data.data)
            })
            return true;
        } catch (error) {
            console.error(error);
            return false;
        }
    }

    async loginMiai() {
        const serviceToken = `nonce=${this.serviceLoginAuth2Json.nonce}&${this.serviceLoginAuth2Json.ssecurity}`;
        const serviceTokenSha1 = crypto.createHash('sha1').update(serviceToken).digest('base64');
        const url = `${this.serviceLoginAuth2Json.location}&clientSign=${encodeURIComponent(serviceTokenSha1)}`;
        console.log(url)
        try {
            const response = await this.request.get(url, {
                headers: {
                    'User-Agent': 'MiHome/6.0.103 (com.xiaomi.mihome; build:6.0.103.1; iOS 14.4.0) Alamofire/6.0.103 MICO/iOSApp/appStore/6.0.103',
                    'Accept-Language': 'zh-cn', 'Connection': 'keep-alive'
                }
            });
            if (response.status === 200) {
                this.serviceToken = response.headers['set-cookie'];
                this.userId = this.serviceToken.userId;
                return true;
            }
            return false;
        } catch (error) {
            // console.error(error);
            return false;
        }
    }

    async getDeviceId() {
        const url = 'https://api.mina.mi.com/admin/v2/device_list?master=1&requestId=someUniqueRequestId';
        try {
            const response = await axios.get(url, {
                headers: { 'Cookie': `userId=${this.userId};serviceToken=${this.serviceToken}` }
            });

            this.deviceIds = response.data.data;
            return true;
        } catch (error) {
            console.error(error);
            return false;
        }
    }

    async textToSpeech(text, deviceIdIndex = 0) {
        try {
            const url = `https://api.mina.mi.com/remote/ubus?deviceId=${this.deviceIds[deviceIdIndex].deviceID}&message=${encodeURIComponent(JSON.stringify({ text }))}&method=text_to_speech&path=mibrain&requestId=${this.generateRandomString(30)}`;
            const response = await axios.post(url, null, {
                headers: { 'Cookie': this.serviceToken }
            });

            if (response.data.message === 'Success') {
                return true;
            }

            console.error(response.data);
            return false;
        } catch (error) {
            console.error(error);
            return false;
        }
    }

    generateRandomString(length) {
        return crypto.randomBytes(length).toString('hex');
    }
}

const client = new XiaomiTTS('13018913506', '20103113579ABCD');
client.login().then(() => {
    if (client.loginResult) {
        client.textToSpeech('你好，小米');
    }
});
