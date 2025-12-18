const axios = require('axios');
const crypto = require('crypto');

class ExnodeClient {
    constructor(publicKey, privateKey) {
        this.publicKey = publicKey;
        this.privateKey = privateKey;
        this.baseUrl = 'https://my.exnode.io';
    }

    /**
     * Generate HMAC-SHA512 signature
     * @param {string} timestamp - Current timestamp as string
     * @param {string} body - Request body as JSON string
     * @returns {string} - The calculated signature
     */
    generateSignature(timestamp, body) {
        const message = timestamp + body;
        return crypto
            .createHmac('sha512', this.privateKey)
            .update(message)
            .digest('hex');
    }

    /**
     * Create a new transaction (invoice)
     * @param {object} params - Transaction parameters
     * @param {string} params.amount - Amount to collect
     * @param {string} params.currency - Currency code (e.g., 'USDTTRC20')
     * @param {string} params.client_transaction_id - Unique ID from your system
     * @param {string} params.callback_url - Webhook URL
     * @returns {Promise<object>} - The created transaction details
     */
    async createTransaction({ amount, currency, client_transaction_id, callback_url }) {
        // Correct endpoint from API documentation
        const endpoint = '/api/transaction/create/in';
        const url = `${this.baseUrl}${endpoint}`;
        console.log(`Creating transaction with endpoint: ${url}`);

        // Prepare the request body based on the API documentation
        const body = {
            token: currency, // Currency token (e.g., 'LTC', 'USDTTRC20')
            amount: amount,
            client_transaction_id: client_transaction_id,
            callback_url: callback_url,
            merchant_uuid: (process.env.MERCHANT_UUID || '').trim()
        };

        const bodyString = JSON.stringify(body);
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const signature = this.generateSignature(timestamp, bodyString);

        let retries = 3;
        while (retries > 0) {
            try {
                const response = await axios.post(url, body, {
                    headers: {
                        'ApiPublic': this.publicKey,
                        'Timestamp': timestamp,
                        'Signature': signature,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    timeout: 10000 // 10 second timeout
                });

                console.log('Transaction created successfully!');
                return response.data;
            } catch (error) {
                const isNetworkError = !error.response && (error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET');

                if (isNetworkError && retries > 1) {
                    console.log(`Network error, retrying... (${retries - 1} attempts left)`);
                    retries--;
                    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
                    continue;
                }

                console.error('Exnode API Error:', error.response ? error.response.data : error.message);
                throw error;
            }
        }
    }

    /**
     * Check transaction status
     * @param {string} trackerId - The tracker ID from createTransaction response
     * @returns {Promise<object>} - Transaction status details
     */
    async checkTransactionStatus(trackerId) {
        const endpoint = '/api/transaction/get';
        const url = `${this.baseUrl}${endpoint}`;

        const body = {
            tracker_id: trackerId
        };

        const bodyString = JSON.stringify(body);
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const signature = this.generateSignature(timestamp, bodyString);

        try {
            const response = await axios.post(url, body, {
                headers: {
                    'ApiPublic': this.publicKey,
                    'Timestamp': timestamp,
                    'Signature': signature,
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                timeout: 10000
            });

            return response.data;
        } catch (error) {
            console.error('Error checking transaction status:', error.response ? error.response.data : error.message);
            throw error;
        }
    }

    /**
     * Create a payment form URL for users to pay
     * @param {object} params - Payment form parameters
     * @param {number} params.amount - Amount to collect
     * @param {string} params.token - Currency token (e.g., 'LTC', 'USDTTON')
     * @param {string} params.callback_url - Webhook URL
     * @returns {Promise<object>} - The payment form details
     */
    async createPaymentForm({ amount, token, callback_url, client_transaction_id }) {
        const endpoint = '/api/crypto/invoice/create';
        const url = `${this.baseUrl}${endpoint}`;
        console.log(`Creating payment form with endpoint: ${url}`);

        const body = {
            amount: amount,
            token: token,
            fiat_currency: "USD",
            client_transaction_id: client_transaction_id,
            payform: true,
            merchant_uuid: (process.env.MERCHANT_UUID || '').trim(),
            call_back_url: callback_url,
            strict_currency: false
        };

        const bodyString = JSON.stringify(body);
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const signature = this.generateSignature(timestamp, bodyString);

        let retries = 3;
        while (retries > 0) {
            try {
                const response = await axios.post(url, body, {
                    headers: {
                        'ApiPublic': this.publicKey,
                        'Timestamp': timestamp,
                        'Signature': signature,
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    timeout: 10000 // 10 second timeout
                });

                console.log('Payment form created successfully!');
                return response.data;
            } catch (error) {
                const isNetworkError = !error.response && (error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT' || error.code === 'ECONNRESET');

                if (isNetworkError && retries > 1) {
                    console.log(`Network error, retrying... (${retries - 1} attempts left)`);
                    retries--;
                    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
                    continue;
                }

                console.error('Exnode API Error:', error.response ? error.response.data : error.message);
                throw error;
            }
        }
    }
}

module.exports = ExnodeClient;
