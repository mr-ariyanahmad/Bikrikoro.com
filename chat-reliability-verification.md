# Chat Reliability Update — Verification Record

## Completed checks

The chat-room update was built and linted successfully on 27 August 2026. The only lint output is the pre-existing Fast Refresh warning in `AuthContext.tsx`; it is not an error. The canonical production domain, `https://www.bikrikoro.com/`, returned HTTP 200 after the `main` branch deployment.

| Check | Result |
|---|---|
| One conversation per buyer–seller pair | Production aggregate query returned **0** duplicate buyer–seller pairs. |
| Receipt storage | Production contains both `buyer_last_read_at` and `seller_last_read_at` fields. |
| Read authorization | The protected `mark_my_chat_thread_read` function verifies that the caller is a participant before updating only that participant’s timestamp and unread counter. |
| Initial history presentation | The app restores up to 120 session-cached messages for 30 minutes and starts protected thread and message requests concurrently; a message-shaped loading state replaces an empty white pane when there is no cache. |
| Shop navigation | In a buyer-to-seller conversation, the seller avatar and name link to the public shop route through the shared safe shop URL helper. Buyer identities are not treated as shops. |
| Send and read UI | New outgoing messages display **পাঠানো হচ্ছে**, then **পাঠানো** after the protected send response. They change to **পড়া হয়েছে** with a double check after the recipient’s protected read timestamp is observed. |

## Remaining live test boundary

The browser session used for deployment validation was not signed in, so this record does **not** claim an end-to-end two-account send/read test. The implementation, protected database migration, production schema, build, lint, and deployed public application were verified. A buyer and seller can now validate the final live receipt transition by exchanging one message and opening the same thread on the receiving account.
