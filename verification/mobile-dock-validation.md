# Mobile Dock Validation

The deployed homepage was reached successfully at the production URL on 27 August 2026. A fresh headless phone viewport initially displayed the existing first-visit splash, so it could not yet be used to evaluate the persistent mobile dock. The next visual check must use an already-dismissed splash session or the Orders route after the splash is dismissed.

The deployed `/chat` route also reached the expected protected login boundary without a runtime error. Authenticated chat-list and chat-thread dock visibility remains a manual mobile-session check because the sandbox browser has no signed-in marketplace session.
