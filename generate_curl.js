require('dotenv').config();
const crypto = require('crypto');

const publicKey = process.env.EXNODE_PUBLIC_KEY;
const privateKey = process.env.EXNODE_PRIVATE_KEY;
const baseUrl = 'https://my.exnode.io';

if (!publicKey || !privateKey) {
    console.error('Error: EXNODE_PUBLIC_KEY and EXNODE_PRIVATE_KEY are required in .env file');
    process.exit(1);
}

const endpoint = '/api/merchant/get/all';
const url = `${baseUrl}${endpoint}`;

const timestamp = Math.floor(Date.now() / 1000).toString();
// Try empty string for body
const bodyString = '';
const signatureString = `${timestamp}${bodyString}`;
const signature = crypto.createHmac('sha512', privateKey)
    .update(signatureString)
    .digest('hex');

console.log(`curl --request GET \\
  --url ${url} \\
  --header 'Accept: application/json' \\
  --header 'ApiPublic: ${publicKey}' \\
  --header 'Signature: ${signature}' \\
  --header 'Timestamp: ${timestamp}' \\
  --verbose`);
