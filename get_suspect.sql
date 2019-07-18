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
edits as (
	select user_id from tag_edits
	union
	select user_id from note_updates
	union
	select user_id from wiki_updates
	union
	select user_id from post_uploads
),
fully as (
	select
		user_id,
		username,
		coalesce(tag_edits.count, 0) as tag_updates,
		coalesce(note_updates.count, 0) as note_updates,
		coalesce(wiki_updates.count, 0) as wiki_updates,
		coalesce(post_uploads.count, 0) as post_uploads
	from edits
	left join tag_edits using(user_id)
	left join wiki_updates using(user_id)
	left join note_updates using(user_id)
	left join post_uploads using(user_id)
	inner join users using(user_id)
),
risked as (
	select
		*,
		(tag_updates * ? + 1) * (note_updates * ? + 1) * (wiki_updates * ? + 1) * (post_uploads * ? + 1) as risk
	from fully
)
select * from risked
where
	(
		tag_updates >= ?
		or note_updates >= ?
		or wiki_updates >= ?
		or post_uploads >= ?
	)
	and risk >= ?;
