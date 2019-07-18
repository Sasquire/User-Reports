create table if not exists users (
	user_id INTEGER PRIMARY KEY,
	username TEXT
);

create table if not exists entries (
	user_id INTEGER,
	type TEXT,
	date INTEGER,
	count INTEGER,
	percentage TEXT
);

create table if not exists blacklisted_users (
	user_id INTEGER PRIMARY KEY
)