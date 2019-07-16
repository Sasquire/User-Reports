// https://e621.net/report/tag_updates

const request = require('request');
const { JSDOM } = require('jsdom');

request({
	url: 'https://e621.net/report/tag_updates',
	headers: { 'User-Agent': 'idem\'s tag edit watcher (finds bad users)' }
}, (e, h, r) => {
	if(e || h.statusCode != 200){
		console.log(`Some Error ${e || h.statusCode}`);
	} else {
		const dom = new JSDOM(r).window.document;
		find_users(dom);
	}
});

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
