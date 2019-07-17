create table if not exists users (
	user_id INTEGER PRIMARY KEY,
	username TEXT
);

create table if not exists entries (
	user_id INTEGER PRIMARY KEY,
	type TEXT,
	date INTEGER,
	count INTEGER,
	percentage TEXT
);