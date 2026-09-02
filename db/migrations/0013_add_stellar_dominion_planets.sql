-- Stellar Dominion planets become real per-empire entities with individual
-- resource yields instead of a flat count — see EmpireService.bx's
-- collectIncome()/exploreForPlanet()/attackEmpire() for how a planet's
-- type now drives its own credits/food/fuel contribution instead of every
-- planet being worth the same flat 100 credits. Empire.planet_count is
-- dropped in favor of COUNT(*)/GROUP BY over this table — this app's
-- tables are small enough (personal demo, not real production scale) that
-- the extra join costs nothing worth caching a denormalized count for, and
-- a single source of truth avoids a synced counter column ever disagreeing
-- with the rows it's supposed to be counting.
--
-- No automated migration runner in this project (see db/schema.sql's own
-- header) — applied by hand, same as every migration before it. If any
-- Empire rows already exist with a planet_count value when this runs,
-- they need a one-time backfill of that many Planet rows (any type mix)
-- before the column drop below, done as a companion one-off script rather
-- than portable SQL here.
create table Planet
(
    id        varchar(36)  default (uuid())                 not null
        primary key,
    empire_id varchar(36)                                    not null,
    type      enum ('agricultural', 'mining', 'industrial')  not null,
    created   timestamp    default CURRENT_TIMESTAMP         not null,
    constraint Planet_Empire_id_fk
        foreign key (empire_id) references Empire (id)
            on update cascade on delete cascade
);

create index idx_planet_empire
    on Planet (empire_id);

alter table Empire
    drop column planet_count;
