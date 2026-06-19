const functions = require('firebase-functions');
const admin = require('firebase-admin');

admin.initializeApp();

/**
 * Cloud Function to exchange Apple Sign In idToken for customToken
 * This allows React Native Firebase to establish a session
 */
exports.exchangeAppleToken = functions.https.onRequest(async (req, res) => {
  // Enable CORS for React Native app
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed. Use POST.' });
    return;
  }

  try {
    const { idToken } = req.body;
    
    if (!idToken) {
      res.status(400).json({ error: 'idToken is required' });
      return;
    }
    
    console.log('Exchanging Apple idToken for customToken...');
    
    // Verify the idToken from Apple Sign In
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const uid = decodedToken.uid;
    
    console.log('Verified idToken for user:', uid);
    
    // Create a custom token that React Native Firebase can use
    const customToken = await admin.auth().createCustomToken(uid);
    
    console.log('Created customToken successfully');
    
    res.json({ customToken });
  } catch (error) {
    console.error('Error exchanging token:', error);
    res.status(400).json({ error: error.message || 'Failed to exchange token' });
  }
});
