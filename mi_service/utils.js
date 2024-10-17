const crypto = require("crypto");

function signNonce(ssecurity, nonce) {
  // 创建一个 SHA256 哈希对象
  const hash = crypto.createHash("sha256");
  // 将 ssecurity 和 nonce 进行 base64 解码
  const decodedSsecurity = Buffer.from(ssecurity, "base64");
  const decodedNonce = Buffer.from(nonce, "base64");
  // 更新哈希对象
  hash.update(decodedSsecurity);
  hash.update(decodedNonce);
  // 获取哈希结果，并进行 base64 编码
  const signed = hash.digest("base64");
  return signed;
}

function generateHmac(uri, snonce, nonce, data) {
  // 将 URI, snonce, nonce 和 data 连接成消息
  const msg = [uri, snonce, nonce, "data=" + data].join("&");
  // 解码 snonce（从 base64 编码）
  const decodedSnonce = Buffer.from(snonce, "base64");
  // 使用 HMAC-SHA256 生成签名
  const hmac = crypto.createHmac("sha256", decodedSnonce);
  hmac.update(msg);
  // 获取 HMAC 签名结果
  const sign = hmac.digest();
  return sign;
}
function createNonce() {
  // 生成 8 个随机字节
  const randomBytes = crypto.randomBytes(8);
  // 获取当前时间戳，并转换为以分钟为单位的时间，然后转换为大端字节格式的 Buffer
  const timestamp = Math.floor(Date.now() / 1000 / 60); // 获取 Unix 时间戳，单位是分钟
  const timestampBuffer = Buffer.alloc(4);
  timestampBuffer.writeUInt32BE(timestamp);
  // 将随机字节和时间戳拼接
  const combinedBuffer = Buffer.concat([randomBytes, timestampBuffer]);
  // 将拼接后的结果进行 Base64 编码
  const result = combinedBuffer.toString("base64");
  return result;
}

module.exports = {
  signData(url, data, ssecurity) {
    const jsonData = JSON.stringify(data);
    const nonce = createNonce();
    const snonce = signNonce(ssecurity, nonce);
    const sign = generateHmac(url, snonce, nonce, jsonData);
    return {
      _nonce: nonce,
      data: data,
      signature: new Buffer(sign).toString("base64"),
    };
  },
};
