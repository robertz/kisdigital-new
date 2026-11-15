# Users & Linking Accounts

How to store the identities `verify()` receives, and how a signed-in user attaches another provider.

## Storing users

The identity passed to `verify()`:

```bxs
{ provider: "github", id: "583231", email: "octocat@github.com", emailVerified: true,
  name: "The Octocat", username: "octocat", avatarUrl: "https://…", raw: { …the provider's profile… } }
```

`id` is the provider's stable user id, as a string — for GitHub, the numeric id, not the login (logins can be renamed, and then claimed by someone else); for Google, Microsoft, GitLab, Apple and OIDC, the `sub` claim. Store identities in their own table, linked to your users:

```sql
CREATE TABLE users (
	id           INT IDENTITY PRIMARY KEY,
	display_name NVARCHAR(200) NOT NULL,
	email        NVARCHAR(320) NULL,
	created_at   DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE TABLE user_identities (
	id               INT IDENTITY PRIMARY KEY,
	user_id          INT NOT NULL REFERENCES users ( id ),
	provider         VARCHAR(32) NOT NULL,
	provider_user_id VARCHAR(255) NOT NULL,
	email            NVARCHAR(320) NULL,
	email_verified   BIT NOT NULL DEFAULT 0,
	created_at       DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
	last_login_at    DATETIME2 NULL,
	CONSTRAINT uq_user_identities UNIQUE ( provider, provider_user_id )
);
```

In `verify()`: look up `( identity.provider, identity.id )`. Found → that's the user. Not found → create a user and an identity row. Never look a user up by email to decide who someone is: an address can be unverified, reassigned, or typed into another provider by someone else. If you want to attach a new provider to an existing account automatically by email, only do it when `identity.emailVerified` is true — and prefer an explicit "link account" step for a signed-in user — next.

## Linking accounts

Matching a new provider login to an existing user by email is the shortcut the section above warns against. The safe version is explicit: a user who is already signed in proves they also own the other account.

```bxs
auth = boxExpressAuth( {
	verify: …,
	loadUser: …,
	link: ( identity, user, tokens, req ) => {
		var owner = identities.find( identity.provider, identity.id )
		if ( !isNull( owner ) && owner.userId != user.id ) {
			return false                 // already someone else's
		}
		identities.attach( user.id, identity )
		return true
	},
	linkRedirect: "/settings/accounts",
	linkFailureRedirect: "/settings/accounts"
} )
```

```html
<form method="post" action="/auth/google/link">
	<input type="hidden" name="_csrf" value="…req.csrfToken()…">
	<input type="hidden" name="returnTo" value="/settings/accounts">
	<button>Connect Google</button>
</form>
```

`POST /auth/:provider/link` runs the same flow as a login — same callback URL, same state, PKCE and ID-token checks — but the callback calls `link( identity, user, tokens, req )` instead of `verify()`, with `user` the signed-in user. It doesn't regenerate the session or change who is signed in.

- It's POST so another site can't start it with a link or an image; keep `boxExpressCsrf()` in front.
- Anonymous: `401`, or a `303` to `loginPath` for a browser.
- If the user signed out, or someone else signed in, between the start and the callback, it's refused with `link_denied`.
- Return `false` (or null) from `link()` to refuse — say, an identity that already belongs to another user. Throws go to your error handler.
- Without a `link` option the route is a `404`.
