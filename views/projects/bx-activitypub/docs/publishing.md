# Publishing

Sending posts, edits, deletions and profile changes out to followers.

## syncPost( id )

Call `ap.syncPost( id )` for any post that might have changed, as often as you like. It compares the post with what was last sent and does whatever is needed:

| Post is… | Sends |
|---|---|
| Public and never sent | `Create` |
| Public, sent, and its title, summary, content, url or tags changed | `Update` |
| Sent before, and now not public or gone (`getObject` returns `null`) | `Delete` — its id then answers `410 Gone` |
| Anything else | Nothing |

Each post goes out as an `Article`, attributed to its author's `Person` account, addressed to the public and copied to that account's followers.

`publishPost( id )` sends a post's first `Create` explicitly, if you'd rather not go through `syncPost`.

## syncActor( type, name )

Does the same for an account's profile, sending `Update{Person}` when its name, bio, avatar, header or profile URL changed.

## A scheduled sweep

A typical app runs a scheduled sweep rather than wiring `syncPost` into every save:

```bxs
app.schedule( 2 * 60 * 1000, () => {
    for ( var id in recentPostIds() ) {
        ap.syncPost( id )
    }
    for ( var id in ap.federatedPostIds() ) {
        ap.syncPost( id )
    }
    ap.syncActor( "Person", "blog" )
}, { name : "activitypub-sync" } )
```

`federatedPostIds()` lists every post currently on the fediverse, so the sweep revisits posts that have since been unpublished or deleted and sends their `Delete`.

Choose a cutoff for "recent". Mastodon files a post under its `published` date, so an old post federated today lands deep in followers' timelines — and backfilling your whole archive sends every new follower a flood.

> [!NOTE] How this site does it
> This blog federates only posts published after a configured cutoff date, and sweeps on a schedule the same way — `syncPost` for recent posts plus `federatedPostIds()`, then `syncActor` for the `@blog` account.

## What can't be undone

> [!WARNING] Permanent choices
> - **Hostname and handles.** Changing either orphans every follower. Account migration via `Move` isn't supported.
> - **Post ownership.** A post's id belongs forever to the account that first published it. Mastodon ignores a later `Create` of the same id from a different account.
> - **Deletions.** A deleted post's id stays deleted. Mastodon won't accept it again, even if you republish the post.

Settle all three before federating from production.
