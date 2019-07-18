const raw_request = require('request');
const { JSDOM } = require('jsdom');
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.db');
const { URL } = require('url');
const fs = require('fs');
const options = {
	tag_updates: {
		limit: 20,
		scale: 1
	},
	note_updates: {
		limit: 2,
		scale: 30
	},
	wiki_updates: {
		limit: 2,
		scale: 50
	},
	post_uploads: {
		limit: 10,
		scale: 10
	},
	risk_limit: 30
};
const valid_types = Object.keys(options);

async function database_promisify(type, script, ...fills){
	return new Promise((resolve, reject) => {
		db[type](script, ...fills, (err, other) => {
			if(err){
				reject(err);
			} else {
				resolve(other);
			}
		});
	});
}

async function db_get(script, ...fills){
	return database_promisify('get', script, ...fills);
}

async function db_exec(script, ...fills){
	return database_promisify('exec', script, ...fills);
}

async function db_run(script, ...fills){
	return database_promisify('run', script, ...fills);
}

async function db_all(script, ...fills){
	return database_promisify('all', script, ...fills);
}

async function request(request_options){
	return new Promise((resolve, reject) => {
		raw_request(request_options, (e, h, r) => {
			if(e || h.statusCode != 200){
				reject(e || h.statusCode);
			} else {
				resolve(r);
			}
		});
	});
}

async function init_db(){
	const init_script = fs.readFileSync('./initdb.sql', 'utf8');
	await db_exec(init_script);
}

async function insert_user(data){
	await db_run(`
	insert into users
	values (?, ?)
	on conflict do nothing`,
	data.user_id,
	data.username);
}

async function insert_events(data){
	await db_run(`
	insert into entries
	values (?, ?, ?, ?, ?)
	on conflict do nothing`,
	data.user_id,
	data.type,
	data.date,
	data.count,
	data.percentage);
}

async function update_array(data){
	await Promise.all(data.map(insert_user));
	await Promise.all(data.map(insert_events));
}

async function suspect_users(){
	const now = new Date(date_difference(0)[0]).getTime();
	const date_query = fs.readFileSync('./get_suspect.sql', 'utf8');
	return db_all(
		date_query,
		now,
		options.tag_updates.scale,
		options.note_updates.scale,
		options.wiki_updates.scale,
		options.post_uploads.scale,

		options.tag_updates.limit,
		options.note_updates.limit,
		options.wiki_updates.limit,
		options.post_uploads.limit,
		options.risk_limit
	);
}

async function blacklist_user(id){
	const query = `
	insert into blacklisted_users
	values (?)
	on conflict do nothing`;
	return db_run(query, id);
}

async function download_type_raw(type){
	const url = new URL(`https://e621.net/report/${type}`);

	// 30 days in the future
	const [now, later] = date_difference(1000 * 3600 * 24 * 30);
	url.searchParams.set('start_date', now);
	url.searchParams.set('end_date', later);
	url.searchParams.set('limit', 100);
	return request({
		url: url.href,
		headers: {
			'User-Agent': 'idem\'s tag edit watcher (finds bad users)'
		}
	});
}

async function download_type(type){
	const [now] = date_difference(0);
	const raw_text = await download_type_raw(type);
	const dom = new JSDOM(raw_text).window.document;
	const users = find_users(dom);
	users.forEach(e => (e.type = type));
	users.forEach(e => (e.date = new Date(now).getTime()));
	return users;
}

// Between now and however many is specified
function date_difference(time){
	const now = new Date();
	const later = new Date(now.getTime() + time);
	return [e621_date(now), e621_date(later)];
}

function e621_date(date){
	const d_year = date.getFullYear();
	const d_month = (date.getMonth() + 1).toString().padStart(2, '0');
	const d_day = date.getDate().toString().padStart(2, '0');
	return `${d_year}-${d_month}-${d_day}`;
}

function find_users(dom){
	const query = 'table tr.even, table tr.odd';
	const users = Array.from(dom.querySelectorAll(query))
		.slice(0, -1) // Removes the last item
		.map(e => ({
			username: e.children[0].textContent,
			user_id: parseInt(e.children[0].children[0].href.match(/\d+/u)[0], 10),
			count: parseInt(e.children[1].textContent, 10),
			percentage: e.children[2].textContent
		}));

	return users;
}

function build_dtext(users){
	return `Here is the daily report for ${new Date()}
	[table]
	User Name | Risk Value | Tag Edits | Post Uploads | Wiki Edits | Note Edits
	${users
		.sort((a, b) => b.risk - a.risk)
		.map(build_line)
		.join('\n')}
	[/table]`;
}

function build_line(user){
	const tag_link = `https://e621.net/post_tag_history?user_id=${user.user_id}`;
	const note_link = `https://e621.net/note/history?user_id=${user.user_id}`;
	const wiki_link = `https://e621.net/wiki/recent_changes?user_id=${user.user_id}`;
	const post_link = `https://e621.net/post?tags=${encodeURIComponent(`user:${user.username}`)}&a`;

	const user_link = `https://e621.net/user/show/${user.user_id}`;

	const _ = (a, b) => `"${a}":${b}`;
	return [
		_(user.username, user_link),
		user.risk,
		_(user.tag_updates, tag_link),
		_(user.post_uploads, post_link),
		_(user.wiki_updates, wiki_link),
		_(user.note_updates, note_link)
	].join(' | ');
}

async function download_all(){
	const d1 = await download_type('tag_updates');
	const d2 = await download_type('note_updates');
	const d3 = await download_type('wiki_updates');
	const d4 = await download_type('post_uploads');
	return [...d1, ...d2, ...d3, ...d4];
}

init_db()
	.then(download_all)
	.then(update_array)
	.then(suspect_users)
	.then(build_dtext)
	.then(a => console.log(a))
	.catch(e => console.log(e));
