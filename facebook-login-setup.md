# Facebook Login — BikriKoro Setup

## Application update

The BikriKoro Facebook button now uses the same browser popup interaction as the working Google button. It no longer deliberately redirects mobile users to the `bikrikoro.firebaseapp.com` handler page, which was the path shown in the reported blank-screen failure. The deployed login screen renders the Facebook entry button normally.

## Vercel environment variables

**No additional Facebook-specific Vercel environment variable is required** for the current Firebase JavaScript SDK implementation. The existing `VITE_FIREBASE_*` variables identify the Firebase project; they do not contain, and must not contain, the Meta App Secret.

| Where | Required setting | Value to enter |
|---|---|---|
| Meta for Developers | Add the **Facebook Login** product | Enable it for the correct Meta app. |
| Meta for Developers → Facebook Login → Settings | Valid OAuth Redirect URI | `https://bikrikoro.firebaseapp.com/__/auth/handler` |
| Firebase Console → Authentication → Sign-in method | Facebook provider | Enable it and enter the Meta App ID and App Secret. |
| Firebase Console → Authentication → Settings → Authorized domains | Website domain | Ensure `bikrikoro.com` and `www.bikrikoro.com` are listed. |
| Meta for Developers → Basic settings | App domains | Add `bikrikoro.com` and `www.bikrikoro.com`. |

> Do not send, commit, or add the Meta App Secret to Vercel or client-side source code. It belongs only in Firebase Authentication's Facebook provider configuration.

## Validation boundary

Production `/login` returned HTTP 200 after deployment. The Login page completed rendering and displayed the Facebook button. A full sign-in was not initiated because it would require a user’s Meta account and the provider configuration above; once the Firebase and Meta settings are saved, the final check is to select Facebook, approve the Meta prompt, and verify that the browser returns to BikriKoro as an authenticated user.

## Official references

Firebase documents the Facebook provider App ID, App Secret, and Meta OAuth redirect URI requirements: [Firebase Facebook Login guide](https://firebase.google.com/docs/auth/web/facebook-login). Firebase also documents why popup sign-in avoids redirect storage issues on some browsers: [Redirect sign-in best practices](https://firebase.google.com/docs/auth/web/redirect-best-practices).
