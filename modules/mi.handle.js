const miService = require('./mi.service.js')
const miApi = require('../api/mi.api.js')

const requestHeader = { 'User-Agent': 'MiHome/6.0.103 (com.xiaomi.mihome; build:6.0.103.1; iOS 14.4.0) Alamofire/6.0.103 MICO/iOSApp/appStore/6.0.103' }

async function init() {
    const miAccount = new miService.MiAccount('13018913506', '20103113579ABCD')
    await miAccount.login('micoapi')
    const deviceList = await miAccount.miRequest('micoapi', `https://api2.mina.mi.com/${miApi.deviceList}&requestId=app_ios_${miService.getRandom(30)}`, undefined, requestHeader)
    console.log(deviceList)
}

init()