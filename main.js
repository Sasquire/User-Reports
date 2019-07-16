// https://e621.net/report/tag_updates

const request = require('request');
const { JSDOM } = require('jsdom');
const options = require('./options.json');
const fs = require('fs');

main('tag_updates');

async function main(type){
	const [start, end] = today_tomorrow();
	const url = `https://e621.net/report/${type}?start_date=${start}&end_date=${end}`;
	return new Promise((resolve, reject) => {
		request({
			url: url,
			headers: {
				'User-Agent': 'idem\'s tag edit watcher (finds bad users)'
			}
		}, (e, h, r) => {
			if(e || h.statusCode != 200){
				console.log(`Some Error ${e || h.statusCode}`);
			} else {
				const dom = new JSDOM(r).window.document;
				const users = find_users(dom);
				const filtered = filter_users(users);
				console.log(filtered.map(p => p.name).join('\n'));
			}
		});
	});
}

function find_users(dom){
	const query = 'table tr.even, table tr.odd';
	const users = Array.from(dom.querySelectorAll(query))
		.map(e => ({
			user_link: e.children[0].querySelector('a'),
			edit_count: e.children[1].querySelector('a'),
			percentage: e.children[2].textContent
		}))
		.filter(e => {
			if(e.user_link === null){
				console.log(`Other: ${e.percentage}`);
				return false;
			} else {
				return true;
			}
		})
		.map(e => ({
			name: e.user_link.textContent,
			id: parseInt(e.user_link.href.match(/\d+/u)[0], 10),
			edit_count: parseInt(e.edit_count.textContent, 10),
			user_link: e.user_link.href,
			edit_history_link: e.edit_count.href,
			percentage: e.percentage
		}));

	return users;
}

function filter_users(user_list, key){
	// User could be blocked with this key
	const blockable = options.blocked_users
		.filter(e => e.blocked_on.includes(key));

	return user_list.filter(e => !blockable.includes(e.name));
}

// Tomorrow is really 30 days in the future
function today_tomorrow(){
	const now = new Date();
	const tomorrow = new Date(now.getTime() + (1000 * 3600 * 24 * 30));
	return [get_date(now), get_date(tomorrow)];


	function get_date(date){
		const d_year = date.getFullYear();
		const d_month = (date.getMonth() + 1).toString().padStart(2, '0');
		const d_day = date.getDay().toString().padStart(2, '0');
		return `${d_year}-${d_month}-${d_day}`;
	}
}
