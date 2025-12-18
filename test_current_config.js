require('dotenv').config();
const ExnodeClient = require('./exnode');

// Use the actual keys from your .env file
const publicKey = process.env.EXNODE_PUBLIC_KEY;
const privateKey = process.env.EXNODE_PRIVATE_KEY;
const merchantUuid = process.env.MERCHANT_UUID;

console.log('Testing with current configuration:');
console.log('Public Key:', publicKey);
console.log('Merchant UUID:', merchantUuid);

async function testPayform() {
    const exnodeClient = new ExnodeClient(publicKey, privateKey);
    console.log('\n=== Testing Payment Form Creation ===');

    try {
        // Test with different parameter combinations
        const testCases = [
            {
                name: 'Test 1 - All params',
                params: {
                    amount: 10,
                    token: 'TRX',
                    callback_url: 'http://localhost:3000/webhook/exnode',
                    merchant_uuid: merchantUuid
                }
            },
            {
                name: 'Test 2 - Minimal params',
                params: {
                    amount: 10,
                    token: 'TRX'
                }
            },
            {
                name: 'Test 3 - Different endpoint',
                params: {
                    amount: 10,
                    token: 'TRX'
                },
                endpoint: '/api/payment/create' // Try different endpoint
            }
        ];

        for (const testCase of testCases) {
            console.log(`\n--- ${testCase.name} ---`);
            console.log('Params:', JSON.stringify(testCase.params, null, 2));

            try {
                let result;
                if (testCase.endpoint) {
                    // Test with custom endpoint
                    result = await axios.post(`https://my.exnode.io${testCase.endpoint}`, testCase.params, {
                        headers: {
                            'ApiPublic': publicKey,
                            'Content-Type': 'application/json'
                        },
                        timeout: 10000
                    });
                } else {
                    result = await exnodeClient.createPaymentForm(testCase.params);
                }

                console.log('Result:', JSON.stringify(result, null, 2));
                if (result.payment_url || result.url) {
                    console.log('✅ SUCCESS: Got payment URL:', result.payment_url || result.url);
                } else {
                    console.log('❌ No payment URL in response');
                }
            } catch (error) {
                console.log('❌ ERROR:', error.message);
                if (error.response) {
                    console.log('Status:', error.response.status);
                    console.log('Response:', JSON.stringify(error.response.data, null, 2));
                }
            }
        }

        console.log('\n=== Test Summary ===');
    } catch (error) {
        console.error('Test failed:', error.message);
    }
}

testPayform();