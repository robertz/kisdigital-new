-- Stellar Dominion Phase 3: a third tradeable resource, Equipment, plus a
-- logged trade history the market now prices off of. See
-- EmpireService.bx's getMarketPrices()/buyResource()/sellResource() for how
-- MarketTrade drives real supply/demand pricing (replacing the old fixed
-- ±20% daily random walk) and buildMilitary()/collectIncome() for how
-- Equipment is produced (Industrial planets) and consumed (fighters and
-- cruisers).
--
-- No automated migration runner in this project — applied by hand, same as
-- every migration before it.
alter table Empire
    add column equipment bigint default 0 not null;

create table MarketTrade
(
    id         varchar(36)                   default (uuid())         not null
        primary key,
    empire_id  varchar(36)                                            not null,
    resource   enum ('food', 'fuel', 'equipment')                     not null,
    direction  enum ('buy', 'sell')                                   not null,
    qty        int                                                    not null,
    unit_price int                                                    not null,
    created    timestamp                     default CURRENT_TIMESTAMP not null,
    constraint MarketTrade_Empire_id_fk
        foreign key (empire_id) references Empire (id)
            on update cascade on delete cascade
);

-- getMarketPrices() filters WHERE resource = :resource AND created >=
-- CURDATE() per call (one query, GROUP BY resource covers all three) — this
-- composite index serves that lookup directly.
create index idx_market_trade_resource_created
    on MarketTrade (resource, created);
