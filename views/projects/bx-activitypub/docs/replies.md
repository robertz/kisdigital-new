# Replies & Reactions

Accepting replies from the fediverse, replying back as the account, and counting likes and boosts.

## Accepting replies

Implement [`IRemoteReplies`](/projects/bx-activitypub/docs/host-contract#iremotereplies-optional) alongside `IHostApp` and public replies to your posts arrive through `acceptRemoteReply()`, with their later edits through `updateRemoteReply()` and deletions through `deleteRemoteReply()`. Without it, everything inbound other than follows, likes and boosts is acknowledged and ignored.

Where a reply lands, and whether it shows straight away, is up to your app.

## Whole threads

A reply to someone else's reply only reaches you if it mentions your account. To fill in the rest of the conversation, `ap.fetchThreads()` (the express adapter runs it every 30 minutes) reads the `replies` collection of each reply you accepted and fetches the ones you don't have yet, each from its own server. They arrive through `acceptRemoteReply()` under the same rules as delivered replies: public only, and your moderation.

It follows threads for posts up to 30 days old, up to 3 levels below a delivered reply, and fetches at most 50 new replies per run. A server that fails is skipped and retried later.

Deletions of fetched replies aren't delivered to you. When a fetched reply disappears from its parent's collection and its server answers 404 or 410, it's removed through `deleteRemoteReply()`. Edits to fetched replies aren't picked up.

## Replying back

`ap.syncComment( id )` does for a comment what `syncPost` does for a post: `Create`, `Update` (content changed) or `Delete`, sent as a `Note` from its author's account. It needs `getObject( "comment", id )` in your host.

Only replies in fediverse threads go out:

- a comment answering a remote reply you accepted, or
- a comment answering one of your own comments that went out.

Top-level comments, and threads with no one from the fediverse in them, stay on your site. The remote author being answered is mentioned, so their server notifies them, and the reply goes to their own inbox as well as to the account's followers.

`federatedCommentIds()` lists the comments currently on the fediverse, for a sweep. Replies to your comments from the fediverse arrive through `acceptRemoteReply` with `parentId` set to your comment's id.

> [!WARNING] Whatever goes out goes out under the account's name
> If other people can comment on your site, anything they write in reply to a fediverse commenter can go out as the account. Hold those for approval — answer `isPublic( "comment", id )` with `false` until approved — if you don't want that.

## Likes and boosts

```bxs
var counts = ap.reactionCounts( "post", postId )   // { likes, boosts }
```

Likes and boosts from the fediverse are verified and stored once per account. They're removed when someone un-likes or un-boosts, and when their account is deleted.
