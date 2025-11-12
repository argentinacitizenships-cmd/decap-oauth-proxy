   import express from "express";
   import fetch from "node-fetch";
   import dotenv from "dotenv";

   dotenv.config();

   const app = express();
   const PORT = process.env.PORT || 3000;

   const {
     OAUTH_CLIENT_ID,
     OAUTH_CLIENT_SECRET,
     OAUTH_CLIENT_REDIRECT_URI,
   } = process.env;

   const GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
   const GITHUB_ACCESS_TOKEN_URL =
     "https://github.com/login/oauth/access_token";

   app.get("/oauth/authorize", (req, res) => {
     const { state, scope = "" } = req.query;
     const redirectUrl = new URL(GITHUB_AUTHORIZE_URL);
     redirectUrl.searchParams.set("client_id", OAUTH_CLIENT_ID);
     redirectUrl.searchParams.set("redirect_uri", OAUTH_CLIENT_REDIRECT_URI);
     if (state) redirectUrl.searchParams.set("state", state);
     if (scope) redirectUrl.searchParams.set("scope", scope);
     res.redirect(redirectUrl.toString());
   });

   app.get("/callback", async (req, res) => {
     const { code, state } = req.query;

     if (!code) {
       return renderResult(res, {
         error: "missing_code",
         errorDescription: "GitHub did not return an authorization code.",
       });
     }

     try {
       const tokenResponse = await fetch(GITHUB_ACCESS_TOKEN_URL, {
         method: "POST",
         headers: {
           Accept: "application/json",
           "Content-Type": "application/json",
         },
         body: JSON.stringify({
           client_id: OAUTH_CLIENT_ID,
           client_secret: OAUTH_CLIENT_SECRET,
           code,
           redirect_uri: OAUTH_CLIENT_REDIRECT_URI,
         }),
       });

       const tokenJson = await tokenResponse.json();

       if (tokenJson.error) {
         return renderResult(res, {
           error: tokenJson.error,
           errorDescription: tokenJson.error_description,
         });
       }

       return renderResult(res, {
         token: tokenJson.access_token,
         provider: "github",
         state,
       });
     } catch (err) {
       return renderResult(res, {
         error: "token_exchange_failed",
         errorDescription: err.message,
       });
     }
   });

   function renderResult(res, message) {
     res.send(`<!DOCTYPE html>
   <html>
     <head>
       <meta charset="utf-8" />
       <title>OAuth Redirect</title>
     </head>
     <body>
       <script>
        (function () {
          function sendMessage(msg) {
            var target = window.opener || window.parent;
            if (target) {
              target.postMessage(
                "authorization:github:" + JSON.stringify(msg),
                "*"
              );
            }
          }
          sendMessage(${JSON.stringify(message)});
          setTimeout(function () {
            window.close();
          }, 10);
        })();
       </script>
     </body>
   </html>`);
   }

   app.get("/", (_req, res) => {
     res.send("Decap OAuth proxy running.");
   });

   app.listen(PORT, () => {
     console.log(`OAuth proxy listening on port ${PORT}`);
   });
