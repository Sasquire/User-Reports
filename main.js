// https://e621.net/report/tag_updates

const request = require('request');
const { JSDOM } = require('jsdom');
const option_path = './options.json';
const options = require(option_path);
const fs = require('fs');

main(options.types[0]);

async function main(type){
	const [start, end] = today_tomorrow();
	const url = `https://e621.net/report/${type.name}?start_date=${start}&end_date=${end}&limit=100`;
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
				const filtered = filter_users(users, type.key);
				console.log(filtered);
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
			user_link: `https://e621.net${e.user_link.href}`,
			edit_history_link: `https://e621.net${e.edit_count.href}`,
			percentage: e.percentage
		}));

	return users;
}

function save_settings(json){
	fs.writeFileSync(option_path, JSON.stringify(json, null, '\t'), 'utf8');
}

function block_user(name, type){
	const user = options.blocked_users.find(e => e.name == name);
	if(user){
		user.blocked_on += type;
	} else {
		options.blocked_users.push({
			name: name,
			blocked_on: type
		});
	}

	save_settings(options);
}

function filter_users(user_list, key){
	// User could be blocked with this key
	const blockable = options.blocked_users
		.filter(e => e.blocked_on.includes(key))
		.map(e => e.name);

	return user_list.filter(e => {
		// A console.log(e.name, blockable, blockable.some(p => p == e.name))
		// console.log(e.name, blockable.includes(e.name), key)
		return !blockable.includes(e.name);
	});
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
