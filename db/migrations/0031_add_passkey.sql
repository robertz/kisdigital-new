-- Passkeys for commenters (bx-passkeys' TableCredentialStore, shape from its
-- sql/mysql.sql). user_id is User.id. The binary collations make
-- credential_id and user_id compare case-sensitively, which the module needs.
create table Passkey
(
    credential_id varchar(1400) character set ascii collate ascii_bin     not null primary key,
    user_id       varchar(255)  character set utf8mb4 collate utf8mb4_bin not null,
    public_key    text                                                    not null,
    algorithm     int                                                     not null,
    sign_count    bigint        default 0                                 not null,
    transports    varchar(255)                                            null,
    name          varchar(100)  character set utf8mb4                     not null,
    created_at    datetime                                                not null,
    last_used_at  datetime                                                null,
    key ix_passkey_user (user_id)
);
