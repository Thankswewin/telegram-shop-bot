const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const app = express();

app.use(cors());
app.use(express.json());

const CLIENT_ID = 'CLIENTID';
const CLIENT_SECRET = 'TWITTERCLIENTSECRET';
const REDIRECT_URI = 'https://yourdomain.com/callback';

// Serve static files
app.use(express.static(path.join(__dirname)));

// Callback route
app.get('/callback', (req, res) => {
    res.sendFile(path.join(__dirname, 'callback.html'));
});

// Token endpoint
app.post('/token', async (req, res) => {
    const { code } = req.body;
    
    if (!code) {
        return res.status(400).json({ error: 'Code parameter is required' });
    }

    try {
        const auth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
        
        const tokenResponse = await axios({
            method: 'post',
            url: 'https://api.twitter.com/2/oauth2/token',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            data: new URLSearchParams({
                code: code,
                grant_type: 'authorization_code',
                redirect_uri: REDIRECT_URI,
                code_verifier: 'challenge'
            }).toString()
        });
        
        console.log('Token response:', tokenResponse.data);
        res.json(tokenResponse.data);
    } catch (error) {
        console.error('Token exchange error:', error.response?.data || error.message);
        res.status(500).json({ 
            error: 'Failed to exchange token',
            details: error.response?.data || error.message
        });
    }
});

// Tweet endpoint
app.post('/tweet', async (req, res) => {
    const { accessToken, text } = req.body;

    if (!accessToken || !text) {
        return res.status(400).json({ error: 'Access token and tweet text are required' });
    }

    try {
        console.log('Posting tweet with token:', accessToken);
        console.log('Tweet text:', text);

        const response = await axios({
            method: 'post',
            url: 'https://api.twitter.com/2/tweets',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'User-Agent': 'v2TweetLookupJS'
            },
            data: {
                text: text
            }
        });

        console.log('Tweet posted successfully:', response.data);
        res.json(response.data);
    } catch (error) {
        console.error('Tweet posting error:', {
            status: error.response?.status,
            data: error.response?.data,
            headers: error.response?.headers,
            error: error.message
        });
        
        res.status(500).json({
            error: 'Failed to post tweet',
            details: error.response?.data || error.message
        });
    }
});

app.listen(80, '0.0.0.0', () => {
    console.log('Server running on port 80');
}); 