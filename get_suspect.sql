with
today as (
	select * from entries where date = ?
),
tag_edits as (
	select user_id, count
	from today
	where type = 'tag_updates'
),
note_updates as (
	select user_id, count
	from today
	where type = 'note_updates'
),
wiki_updates as (
	select user_id, count
	from today
	where type = 'wiki_updates'
),
post_uploads as (
	select user_id, count
	from today
	where type = 'post_uploads'
),
pool_updates as (
	select user_id, count
	from today
	where type = 'pool_updates'
),
edits as (
	select user_id from tag_edits
	union
	select user_id from note_updates
	union
	select user_id from wiki_updates
	union
	select user_id from post_uploads
	union
	select user_id from pool_updates
),
fully as (
	select
		user_id,
		username,
		coalesce(tag_edits.count, 0) as tag_updates,
		coalesce(note_updates.count, 0) as note_updates,
		coalesce(wiki_updates.count, 0) as wiki_updates,
		coalesce(post_uploads.count, 0) as post_uploads,
		coalesce(pool_updates.count, 0) as pool_updates
	from edits
	left join tag_edits using(user_id)
	left join wiki_updates using(user_id)
	left join note_updates using(user_id)
	left join post_uploads using(user_id)
	left join pool_updates using(user_id)
	inner join users using(user_id)
	where user_id not in blacklisted_users
),
risked as (
	select
		*,
		(tag_updates * ?) +
		(note_updates * ?) +
		(wiki_updates * ?) +
		(post_uploads * ?) +
		(pool_updates * ?) as risk
	from fully
)
select * from risked
where risk >= ?;
order by risk desc;
