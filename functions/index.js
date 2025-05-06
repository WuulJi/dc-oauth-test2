/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const {onRequest} = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const axios = require("axios");
const {defineString} = require("firebase-functions/params");

// Define configuration parameters
const discordClientId = defineString("DISCORD_CLIENT_ID");
const discordClientSecret = defineString("DISCORD_CLIENT_SECRET");
const allowedGuildId = defineString("ALLOWED_GUILD_ID");

// Initialize Firebase Admin with explicit configuration
admin.initializeApp({
  credential: admin.credential.applicationDefault(),
  projectId: "discord-oauth-test2"
});

// 添加服務帳戶權限
admin.auth().createCustomToken = async (uid) => {
  const serviceAccount = require('./service-account.json');
  const jwt = require('jsonwebtoken');
  
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    uid: uid,
    iat: now,
    exp: now + 3600,
    aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email
  };
  
  const token = jwt.sign(payload, serviceAccount.private_key, { algorithm: 'RS256' });
  return token;
};

// Discord OAuth2 configuration
const clientId = discordClientId.value();
const clientSecret = discordClientSecret.value();
const redirectUri = "https://discord-oauth-test2.web.app/auth/callback/";

exports.discordAuth = onRequest(
  {
    region: "asia-east1",
    timeoutSeconds: 300,
    memory: "256MB",
    cors: true,
    invoker: "public",
  },
  async (req, res) => {
    console.log('Discord Auth function started');
    console.log('Request URL:', req.url);
    console.log('Request Query:', req.query);
    console.log('Request Headers:', req.headers);
    
    // 設置 CORS 頭部
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    // 處理 OPTIONS 請求
    if (req.method === 'OPTIONS') {
      res.status(204).send('');
      return;
    }

    // 1. 獲取授權碼
    const code = req.method === 'POST' ? req.body.code : req.query.code;
    console.log('Received code:', code);

    if (!code) {
      console.log('No code provided, redirecting to home');
      if (req.method === 'POST') {
        res.status(400).json({ error: 'No code provided' });
      } else {
        res.redirect("https://discord-oauth-test2.web.app");
      }
      return;
    }

    try {
      // 2. 交換 token
      console.log('Exchanging code for token...');
      const tokenResponse = await axios.post(
        "https://discord.com/api/oauth2/token",
        new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: "authorization_code",
          code: code,
          redirect_uri: redirectUri,
        }),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        },
      );

      const accessToken = tokenResponse.data.access_token;
      console.log('Successfully obtained access token');

      // 3. 獲取用戶信息
      console.log('Fetching user info from Discord...');
      const [userResponse, guildsResponse] = await Promise.all([
        axios.get("https://discord.com/api/users/@me", {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }),
        axios.get("https://discord.com/api/users/@me/guilds", {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }),
      ]);

      const discordUser = userResponse.data;
      const guilds = guildsResponse.data;
      console.log('Discord user data:', JSON.stringify(discordUser, null, 2));

      // 驗證用戶是否在允許的伺服器中
      const allowedGuild = guilds.find(guild => guild.id === allowedGuildId.value());
      if (!allowedGuild) {
        console.log('User is not in the allowed guild');
        if (req.method === 'POST') {
          res.status(403).json({ error: 'You must be a member of the required Discord server to use this application' });
        } else {
          res.redirect("https://discord-oauth-test2.web.app/?error=not_in_guild");
        }
        return;
      }

      // 4. 創建或更新 Firebase Authentication 用戶
      try {
        console.log('Attempting to get user from Firebase Auth...');
        // 嘗試獲取現有用戶
        const userRecord = await admin.auth().getUser(discordUser.id).catch((error) => {
          console.log('User not found, will create new user:', error.message);
          return null;
        });
        
        if (!userRecord) {
          console.log('Creating new user in Firebase Auth...');
          // 如果用戶不存在，創建新用戶
          const newUser = await admin.auth().createUser({
            uid: discordUser.id,
            displayName: discordUser.username,
            photoURL: `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`,
          });
          console.log('New user created:', JSON.stringify(newUser, null, 2));
        } else {
          console.log('Updating existing user in Firebase Auth...');
          // 如果用戶存在，更新用戶信息
          const updatedUser = await admin.auth().updateUser(discordUser.id, {
            displayName: discordUser.username,
            photoURL: `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`,
          });
          console.log('User updated:', JSON.stringify(updatedUser, null, 2));
        }
      } catch (error) {
        console.error('Error in Firebase Auth operation:', error);
        throw error;
      }

      console.log('Creating custom token...');
      // 5. 創建 Firebase 令牌
      const customToken = await admin.auth().createCustomToken(discordUser.id);
      console.log('Custom token created successfully');

      // Store user info in Firestore
      console.log('Storing user info in Firestore...');
      await admin.firestore().collection("users").doc(discordUser.id).set(
        {
          id: discordUser.id,
          username: discordUser.username,
          email: discordUser.email,
          avatar: discordUser.avatar,
          guild: {
            id: allowedGuild.id,
            name: allowedGuild.name,
            icon: allowedGuild.icon
          }
        },
        {merge: true},
      );
      console.log('User info stored in Firestore');

      // 6. 重定向到前端
      console.log('Redirecting to frontend with token');
      if (req.method === 'POST') {
        res.json({ token: customToken });
      } else {
        res.redirect(`https://discord-oauth-test2.web.app/?token=${customToken}`);
      }
    } catch (error) {
      console.error("Error in Discord Auth process:", error);
      if (req.method === 'POST') {
        res.status(500).json({ error: 'Authentication failed' });
      } else {
        res.redirect("https://discord-oauth-test2.web.app/?error=auth_failed");
      }
    }
  },
);
