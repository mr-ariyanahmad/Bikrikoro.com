# Facebook Login — verified findings

Firebase's official JavaScript guide requires the Facebook provider to be enabled in Firebase Authentication with the Meta App ID and App Secret, and requires the Firebase OAuth handler URL to be listed in the Meta app's Facebook Login settings.

Meta's strict URI matching guidance states that every redirect URI used by the app must be listed in Valid OAuth redirect URIs and must match exactly. For the current BikriKoro custom-auth setup, the safe list is:

```text
https://auth.bikrikoro.com/__/auth/handler
https://com-bikrikoro.firebaseapp.com/__/auth/handler
```

The repository code correctly uses Firebase `FacebookAuthProvider`, requests the email scope, attempts popup first, and falls back to redirect when the popup is blocked. The visible Bengali message is a generic fallback when the Firebase error code is not one of the specifically mapped cases, so the actual configuration error code is needed if console settings are correct.

## Sources

- https://firebase.google.com/docs/auth/web/facebook-login
- https://developers.facebook.com/blog/post/2017/12/18/strict-uri-matching/
