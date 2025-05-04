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

admin.initializeApp();

// Discord OAuth2 configuration
const clientId = "1368261758862758101";
const clientSecret = "E7sjZPRnFaUi_EYBM274dfuRVHgqsUWH";
const redirectUri = "https://discord-oauth-test2.web.app/auth/callback";

exports.discordAuth = onRequest(
  {
    region: "asia-east1",
    timeoutSeconds: 300,
    memory: "256MB",
    cors: true,
    invoker: "public",
  },
  async (req, res) => {
    // 1. 獲取授權碼
    const code = req.query.code;

    if (!code) {
      res.redirect("/");
      return;
    }

    try {
      // 2. 交換 token
      // Exchange code for token
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

      // 3. 獲取用戶信息
      // Get user info from Discord
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

      // 4. 創建 Firebase 令牌
      // Create or update user in Firebase
      const customToken = await admin.auth().createCustomToken(discordUser.id);

      // Store user info in Firestore
      await admin.firestore().collection("users").doc(discordUser.id).set(
        {
          username: discordUser.username,
          discriminator: discordUser.discriminator,
          avatar: `https://cdn.discordapp.com/avatars/${discordUser.id}/${
            discordUser.avatar
          }.png`,
          guilds: guilds.map((guild) => ({
            id: guild.id,
            name: guild.name,
            icon: guild.icon
              ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png`
              : null,
            owner: guild.owner,
            permissions: guild.permissions,
          })),
          lastLogin: admin.firestore.FieldValue.serverTimestamp(), // 最後登入時間
        },
        {merge: true},
      );

      // 5. 重定向到前端
      // Redirect to frontend with token
      res.redirect(`/?token=${customToken}`);
    } catch (error) {
      console.error("Error:", error);
      res.redirect("/?error=auth_failed");
    }
  },
);
