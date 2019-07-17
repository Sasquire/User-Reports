const raw_request = require('request');
const { JSDOM } = require('jsdom');
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.db');
const { URL } = require('url');
const valid_types = [
	'note_updates',
	'tag_updates',
	'wiki_updates',
	'post_uploads'
];

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


async function download_type(type){
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

// Between now and however many is specified
function date_difference(time){
	const now = new Date();
	const later = new Date(now.getTime() + time);
	return [get_date(now), get_date(later)];

	function get_date(date){
		const d_year = date.getFullYear();
		const d_month = (date.getMonth() + 1).toString().padStart(2, '0');
		const d_day = date.getDate().toString().padStart(2, '0');
		return `${d_year}-${d_month}-${d_day}`;
	}
}

download_type('tag_updates').then(console.log);
