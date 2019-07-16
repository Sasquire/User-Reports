// https://e621.net/report/tag_updates

const request = require('request');
const { JSDOM } = require('jsdom');

request('https://e621.net/report/tag_updates', (e, h, r) => {
	if(e || h.statusCode != 200){
		console.log(`Some Error ${e || h.statusCode}`);
	} else {
		console.log(r);
	}
});
