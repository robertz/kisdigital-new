# Replies & Reactions

Accepting replies from the fediverse, replying back as the account, and counting likes and boosts.

## Accepting replies

Implement [`IRemoteReplies`](/projects/bx-activitypub/docs/host-contract#iremotereplies-optional) alongside `IHostApp` and public replies to your posts arrive through `acceptRemoteReply()`, with their later edits through `updateRemoteReply()` and deletions through `deleteRemoteReply()`. Without it, everything inbound other than follows, likes and boosts is acknowledged and ignored.

Where a reply lands, and whether it shows straight away, is up to your app.

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
