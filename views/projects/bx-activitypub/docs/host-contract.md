# The Host Contract

`IHostApp` is how the module reads your data, and `IRemoteReplies` is how replies from the fediverse get back into it.

## IHostApp

```bxs
class implements="bxModules.bxactivitypub.contracts.IHostApp" {
    // baseUrl(), findActor(), getObject(), isPublic()
}
```

Types are `"Person"` and `"Group"` for accounts, `"post"` for posts and, if you [reply back](/projects/bx-activitypub/docs/replies#replying-back), `"comment"` for comments.

| Method | Returns |
|---|---|
| `baseUrl()` | Your canonical origin, e.g. `"https://example.com"`. Account and post ids are built from it |
| `findActor( type, name )` | `{ id, name, displayName, summary, avatar, header, url }` or `null` |
| `getObject( "post", id )` | `{ author, title, summary, content, url, published, tags }` or `null` |
| `getObject( "comment", id )` | Optional: `{ author, postId, parentId, content, url, published }` or `null` |
| `isPublic( type, id )` | Whether this account, post or comment may be federated at all |

### findActor( type, name )

| Field | |
|---|---|
| `id` | Your UUID for the account. Keypairs and followers are keyed by it |
| `name` | The handle, as in `@name@host` |
| `displayName` | The account's display name |
| `summary` | The bio, as HTML |
| `avatar` | Optional absolute URL |
| `header` | Optional absolute URL for the profile banner. Mastodon crops it to about 3:1 |
| `url` | Optional absolute URL of the account's profile page |

### getObject( "post", id )

| Field | |
|---|---|
| `author` | The Person's `name` |
| `title`, `summary` | Plain text |
| `content` | HTML |
| `url` | The post's own page |
| `published` | A date. Mastodon files the post under it |
| `tags` | Optional array of `{ name, url }`, sent as hashtags so posts appear in Mastodon's hashtag timelines on the servers that receive them. Names are reduced to letters, digits and underscores |

### getObject( "comment", id )

Only needed for [replying back](/projects/bx-activitypub/docs/replies#replying-back). Return `null` for every comment to never reply back.

| Field | |
|---|---|
| `author` | The Person's `name` the comment goes out as |
| `postId` | Your id of the post it's on |
| `parentId` | Your id of the comment it answers — `""` for top level |
| `content` | HTML |
| `url`, `published` | As for posts |

### isPublic( type, id )

Checked before every lookup, every time an object is served, and before every delivery. `false` means the module behaves as if the account, post or comment doesn't exist. Return `false` for drafts, private content and inactive accounts.

## IRemoteReplies (optional)

Implement this too and replies from the fediverse to your public posts reach your app. Without it, the module stays one-way:

```bxs
class implements="bxModules.bxactivitypub.contracts.IHostApp,bxModules.bxactivitypub.contracts.IRemoteReplies" {
    // ...
}
```

| Method | Called when |
|---|---|
| `acceptRemoteReply( postId, parentId, reply )` | A new reply to `postId` arrives. `parentId` is your id of the reply it answers, or `""` for the post. Return your id for it, or `null` to refuse it |
| `updateRemoteReply( hostId, reply )` | Its author edited it |
| `deleteRemoteReply( hostId )` | Its author deleted it, or their account |

`reply` is:

```plain
{
    objectUrl, url,
    author { actorUrl, name, handle, profileUrl, avatarUrl },
    contentHtml, sensitive, summary, published, attachmentCount
}
```

> [!WARNING] contentHtml is untrusted
> It's HTML from another server. Sanitize it before you store or render it — for example with bx-esapi's `sanitizeHTML()` and a policy that allows only what you want to show. The module removes the leading mention of your account but does nothing else to it.

- Only **public** replies are passed on. Followers-only replies and direct messages are dropped, and so is anything whose author isn't the account that signed it.
- Replies to replies you accepted arrive with `parentId` set, so threads keep their shape.
- `sensitive` and `summary` are the author's content warning. `attachmentCount` is how many images or files were attached — they aren't passed on.
- Moderation is yours: store replies as pending, publish them straight away, or anything in between.
