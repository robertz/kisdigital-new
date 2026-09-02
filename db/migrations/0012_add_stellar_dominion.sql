-- Stellar Dominion (routes/Empire.bx) — a persistent, turn-based multiplayer
-- space-empire game, one Empire row per signed-in User (Google OAuth via the
-- existing commenter/manage_user session populations — see StompChat.bx's
-- displayNameFor()/rawUserIdFor() pattern, reused as-is). Phase 1 is
-- server-rendered only: no STOMP, no scheduler. Daily turn/upkeep reset is
-- lazy — see EmpireService's resetTurnsIfNeeded(), run opportunistically on
-- every request that touches an empire, the same pattern StompChat.bx's
-- pruneOldMessages() established for "this app has no cron, so do it on
-- access instead."
--
-- Planets are a plain count column, not their own table, for v1 — v1
-- planets are interchangeable (no individual name/defense/output), so a
-- count is sufficient and keeps every hot-path read (dashboard, leaderboard,
-- attack target list) join-free. A later phase can add a real Planet table
-- additively without changing EmpireService's external shape. Military is
-- three flat int columns (soldiers/fighters/cruisers) for the same reason —
-- no per-unit identity needed yet, only quantities.
create table Empire
(
    id              varchar(36)  default (uuid())           not null
        primary key,
    user_id         varchar(36)                              not null,
    name            varchar(50)                              not null,
    credits         bigint       default 1000                not null,
    food            bigint       default 500                 not null,
    fuel            bigint       default 500                 not null,
    population      bigint       default 100                 not null,
    soldiers        int          default 10                  not null,
    fighters        int          default 5                   not null,
    cruisers        int          default 0                   not null,
    planet_count    int          default 3                   not null,
    turns_remaining int          default 20                  not null,
    last_turn_reset date         default (curdate())         not null,
    shielded_until  timestamp                                 null,
    created         timestamp    default CURRENT_TIMESTAMP   not null,
    updated         timestamp    default CURRENT_TIMESTAMP   not null on update CURRENT_TIMESTAMP,
    constraint Empire_user_id_uindex
        unique (user_id),
    constraint Empire_User_id_fk
        foreign key (user_id) references User (id)
            on update cascade on delete cascade
);

-- One row per resolved attack. Both FKs cascade — an Empire disappearing
-- (only possible via its owning User being deleted) means its battle history
-- means nothing on its own either side, same reasoning UserPost/
-- StompChatChannelMembership already use for genuinely-owned child rows.
create table EmpireBattle
(
    id                          varchar(36) default (uuid())          not null
        primary key,
    attacker_empire_id          varchar(36)                            not null,
    defender_empire_id          varchar(36)                            not null,
    outcome                     enum ('attacker_win', 'defender_win')  not null,
    credits_plundered           bigint      default 0                 not null,
    food_plundered              bigint      default 0                 not null,
    fuel_plundered              bigint      default 0                 not null,
    planet_captured             tinyint(1)  default 0                 not null,
    attacker_committed_soldiers int         default 0                 not null,
    attacker_committed_fighters int         default 0                 not null,
    attacker_committed_cruisers int         default 0                 not null,
    attacker_power              decimal(10,2)                         not null,
    defender_power              decimal(10,2)                         not null,
    win_probability             decimal(5,4)                          not null,
    created                     timestamp   default CURRENT_TIMESTAMP not null,
    constraint EmpireBattle_Attacker_Empire_id_fk
        foreign key (attacker_empire_id) references Empire (id)
            on update cascade on delete cascade,
    constraint EmpireBattle_Defender_Empire_id_fk
        foreign key (defender_empire_id) references Empire (id)
            on update cascade on delete cascade
);

create index idx_empirebattle_defender_created
    on EmpireBattle (defender_empire_id, created);

create index idx_empirebattle_attacker_created
    on EmpireBattle (attacker_empire_id, created);
