# Unified Seller Chat Verification

## 2026-08-27

Chat creation uses the authenticated buyer identity and seller identity as the sole conversation pair. Product IDs are retained only as optional first-product context, so opening chat from multiple products owned by the same seller reuses the same conversation.

The production table already had a buyer-and-seller unique constraint. The production chat-list RPC now also selects one canonical, most-recent conversation per pair as a defensive display safeguard. The final aggregate database verification returned **0 duplicate buyer-seller pairs**.

The chat list now uses public profile photos, safe human-readable shop or user names, verified state, message preview, timestamp, and unread badges. The chat room uses the same identity treatment, carries an optional product context card, and keeps the message composer within the full-screen conversation layout.
