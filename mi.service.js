const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs').promises;
const base64 = require('base64-js');
const querystring = require('querystring');
const path = require('path')

function getRandom(length) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    return Array.from({ length }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
}

class MiTokenStore {
    constructor(tokenPath) {
        this.tokenPath = tokenPath;
    }

    async loadToken() {
        try {
            const data = await fs.readFile(this.tokenPath, 'utf-8');
            return JSON.parse(data);
        } catch (e) {
            console.error(`Exception on load token from ${this.tokenPath}: ${e}`);
            return null;
        }
    }

    async saveToken(token = null) {
        try {
            if (token) {
                await fs.writeFile(this.tokenPath, JSON.stringify(token, null, 2));
            } else {
                await fs.unlink(this.tokenPath);
            }
        } catch (e) {
            console.error(`Exception on save token to ${this.tokenPath}: ${e}`);
        }
    }
}

class MiAccount {
    constructor(username, password, tokenStore = path.join(__dirname, '../other/mi.token')) {
        this.username = username;
        this.password = password;
        this.tokenStore = typeof tokenStore === 'string' ? new MiTokenStore(tokenStore) : tokenStore;
        this.token = null;
    }

    async login(sid) {
        if (!this.token) {
            this.token = { deviceId: getRandom(16).toUpperCase() };
        }
        try {
            let resp = await this._serviceLogin(`serviceLogin?sid=${sid}&_json=true`);
            if (resp.code !== 0) {
                console.log(resp)
                const data = {
                    _json: 'true',
                    qs: resp.qs,
                    sid: resp.sid,
                    _sign: resp._sign,
                    callback: resp.callback,
                    user: this.username,
                    hash: crypto.createHash('md5').update(this.password).digest('hex').toUpperCase()
                };
                resp = await this._serviceLogin('serviceLoginAuth2', data);
                if (resp.code !== 0) {
                    throw new Error(JSON.stringify(resp));
                }
            }

            this.token.userId = resp.userId;
            this.token.passToken = resp.passToken;

            const serviceToken = await this._securityTokenService(resp.location, resp.nonce, resp.ssecurity);
            this.token[sid] = [resp.ssecurity, serviceToken];

            if (this.tokenStore) {
                await this.tokenStore.saveToken(this.token);
            }
            return true;
        } catch (e) {
            this.token = null;
            if (this.tokenStore) {
                await this.tokenStore.saveToken();
            }
            console.error(`Exception on login ${this.username}: ${e}`);
            return false;
        }
    }

    async _serviceLogin(uri, data = null) {
        const headers = {
            'User-Agent': 'APP/com.xiaomi.mihome APPV/6.0.103 iosPassportSDK/3.9.0 iOS/14.4 miHSTS'
        };
        const cookies = {
            sdkVersion: '3.9',
            deviceId: this.token.deviceId
        };
        if (this.token.passToken) {
            cookies.userId = this.token.userId;
            cookies.passToken = this.token.passToken;
        }
        const url = `https://account.xiaomi.com/pass/${uri}`;
        const response = await axios({
            method: data ? 'POST' : 'GET',
            url,
            headers,
            data: querystring.stringify(data),
            withCredentials: true,
            headers,
            jar: true,
            validateStatus: false
        });
        const resp = JSON.parse(response.data.slice(11));
        console.log(resp)
        console.debug(`${uri}: ${JSON.stringify(resp)}`);
        return resp;
    }

    async _securityTokenService(location, nonce, ssecurity) {
        const nsec = `nonce=${nonce}&${ssecurity}`;
        const clientSign = base64.fromByteArray(crypto.createHash('sha1').update(nsec).digest());
        const url = `${location}&clientSign=${encodeURIComponent(clientSign)}`;
        const response = await axios.get(url, { withCredentials: true, jar: true });

        if (!response.headers['set-cookie']) {
            throw new Error(response.data);
        }

        const serviceToken = response.headers['set-cookie'].find(c => c.includes('serviceToken')).split(';')[0].split('=')[1];
        return serviceToken;
    }

    async miRequest(sid, url, data, headers, relogin = true) {
        if (!this.token && this.tokenStore) {
            this.token = await this.tokenStore.loadToken();
        }
        if ((this.token && this.token[sid]) || await this.login(sid)) {
            const cookies = { userId: this.token.userId, serviceToken: this.token[sid][1] };
            const content = typeof data === 'function' ? data(this.token, cookies) : data;
            const method = data ? 'POST' : 'GET';
            console.debug(`${url} ${content}`);
            console.log(this.token)
            const response = await axios({
                method,
                url,
                data: querystring.stringify(content),
                headers,
                withCredentials: true,
                jar: true,
                validateStatus: false
            });

            const resp = response.data;
            console.log(resp)
            if (resp.code === 0) {
                return resp;
            } else if (resp.message && resp.message.toLowerCase().includes('auth')) {
                console.warn(`Auth error on request ${url}, relogin...`);
                this.token = null;
                return await this.miRequest(sid, url, data, headers, false);
            }
        } else {
            throw new Error(`Login failed: ${url}`);
        }
    }
}

// module.exports = {
//     MiAccount,
//     miTokenStore: new MiTokenStore(path.join(__dirname, '../other/mi.token')),
//     getRandom
// }

new MiAccount("13018913506", "20103113579ABCD").login('micoapi')