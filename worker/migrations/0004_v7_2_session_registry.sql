-- v7.2 session registry: user-level token invalidation timestamp.
-- Any session token with iat < sessions_valid_after is treated as revoked.

ALTER TABLE users ADD COLUMN sessions_valid_after INTEGER DEFAULT 0;
