require('dotenv').config();
const ExnodeClient = require('./exnode');

const publicKey = process.env.EXNODE_PUBLIC_KEY;
const privateKey = process.env.EXNODE_PRIVATE_KEY;
const merchantUuid = process.env.MERCHANT_UUID;

if (!publicKey || !privateKey) {
    console.error('Error: EXNODE_PUBLIC_KEY and EXNODE_PRIVATE_KEY are required in .env file');
    process.exit(1);
}

async function testPayformCreation() {
    const exnodeClient = new ExnodeClient(publicKey, privateKey);
    console.log('Testing payment form creation...\n');

    try {
        // Test parameters
        const testParams = {
            amount: 10,
            token: 'TRX',
            callback_url: 'http://localhost:3000/webhook/exnode',
            merchant_uuid: merchantUuid
        };

        console.log('Parameters:', JSON.stringify(testParams, null, 2));

        // Call the createPaymentForm method
        const result = await exnodeClient.createPaymentForm(testParams);
        console.log('\n=== PAYMENT FORM RESULT ===');
        console.log(JSON.stringify(result, null, 2));

        return result;
    } catch (error) {
        console.error('\n❌ PAYMENT FORM ERROR ===');
        console.error(error.message);
        if (error.response) {
            console.error('Status:', error.response.status);
            console.error('Response:', JSON.stringify(error.response.data, null, 2));
        }
        throw error;
    }
}

// Run the test
testPayformCreation().catch(error => {
    console.error('Test failed:', error.message);
});