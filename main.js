// https://e621.net/report/tag_updates

const request = require('request');
const { JSDOM } = require('jsdom');
const option_path = './options.json';
const options = require(option_path);
const fs = require('fs');
const all_users = [];
main();

async function main(){
	const filtered_all = [];
	for(const type of options.types){
		const suspect_user_ids = await get_type(type);
		filtered_all.push(...suspect_user_ids);
	}
	const extra_good = all_users.filter(e => filtered_all.includes(e.id));
	const dtext = build_dtext(extra_good);
	console.log(dtext);
}

function build_dtext(good_users){
	const user_ids = new Set(good_users.map(e => e.id));
	const types = ['p', 't', 'w', 'n'];
	const info = [];
	for(const user_id of user_ids){
		const data = {};
		for(const type of types){
			const good = good_users
				.find(e => e.id == user_id && e.type == type);
			if(good){
				data[`${type}_count`] = good.edit_count;
				data[`${type}_link`] = build_link(good.name, good.id, type);
				data.name = good.name;
				data.user_link = good.user_link;
			} else {
				// eslint-disable-next-line no-shadow
				const user = good_users.find(e => e.id == user_id);
				data[`${type}_count`] = 0;
				// eslint-disable-next-line max-len
				data[`${type}_link`] = build_link(user.name, user.id, type);		
			}
		}
		const user = good_users.find(e => e.id == user_id);
		data.name = user.name;
		data.user_link = user.user_link;
		data.risk = risk_factor(data);
		info.push(data);
	}
	return `Here is the daily report for ${new Date()}
	[table]
	User Name | Risk Value | Tag Edits | Post Uploads | Wiki Edits | Note Edits
	${info
		.sort((a, b) => b.risk - a.risk)
		.map(build_line)
		.join('\n')}
	[/table]`;
}

function risk_factor(user){
	// eslint-disable-next-line max-len
	return ((user.t_count - user.p_count) || 1) * (user.p_count || 1) * (user.w_count || 1) * (user.n_count || 1);
}

function build_link(name, id, type){
	switch (type){
		case 'p': return `https://e621.net/post?tags=${encodeURIComponent(`user:${name}`)}`;
		case 'w': return `https://e621.net/wiki/recent_changes?user_id=${id}`;
		case 'n': return `https://e621.net/note/history?user_id=${id}`;
		case 't': return `https://e621.net/post_tag_history?user_id=${id}`;
		default: return false; // Doesn't happen
	}
}

function build_line(user){
	const _ = (type) => `"${user[`${type}_count`]}":${user[`${type}_link`]}`;
	/* eslint-disable-next-line max-len */ //      tag         post       wiki        note
	return `"${user.name}":${user.user_link} | ${user.risk} | ${_('t')} | ${_('p')} | ${_('w')} | ${_('n')}`;
}


async function get_type(type){
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
				all_users.push(...users.map(p => ({type: type.key, ...p})));

				const filtered = filter_users(users, type.key, type.limit)
					.map(p => p.id);

				resolve(filtered);
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

function filter_users(user_list, key, limit){
	// User could be blocked with this key
	const blockable = options.blocked_users
	/* Maybe do this later
		.filter(e => e.blocked_on.includes(key)) */
		.map(e => e.name);

	return user_list.filter(e => {
		return !blockable.includes(e.name) && e.edit_count >= limit;
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
		const d_day = date.getDate().toString().padStart(2, '0');
		return `${d_year}-${d_month}-${d_day}`;
	}
}
