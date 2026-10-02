-- Alt text for images on the image server (R2). R2 only stores the files, so
-- the description a writer gives an image on /manage/media lives here, keyed
-- by the object's key in the bucket (e.g. "posts/2026/diagram.png"). The
-- post editor's image picker fills it in when the image is inserted.
--
-- The app treats this table as optional: until it exists, the Media page
-- just doesn't offer an alt text field (see MediaService.bx).
create table MediaAlt
(
    object_key varchar(512)                        not null
        primary key,
    alt_text   varchar(500)                        not null,
    updated_at timestamp default CURRENT_TIMESTAMP not null on update CURRENT_TIMESTAMP
);
