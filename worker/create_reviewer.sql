INSERT OR IGNORE INTO users (username, display_name, email, password_hash, role, created_at)
VALUES ('reviewer', 'Play Review Team', 'reviewer@eugenemierak.com', 'pbkdf2$120000$SGS0tw78V4S1+YcKFwN4gw==$SVYXSwpE6gVpRiGHOGV/oyYsdlY+/439rsCY7oluroo=', 'customer', datetime('now'));

-- Grant the reviewer access to chapter 1 (launch book slug: book_chapter_1)
INSERT OR IGNORE INTO user_books (username, book_id, granted_at)
SELECT 'reviewer', book_id, datetime('now') FROM books WHERE slug = 'book_chapter_1';
