# GitHub, Google, Microsoft & GitLab

The built-in presets, and how to register an app with each provider.

## GitHub

`boxExpressAuthGitHub()` is plain OAuth2; the [quickstart](/projects/boxlang-express-auth/docs/getting-started#quickstart) shows it in full. To register the app:

1. GitHub → **Settings → Developer settings → OAuth Apps → New OAuth App** (or the same under an organization's settings).
2. **Homepage URL**: your app, e.g. `https://tracker.example.com`.
3. **Authorization callback URL**: exactly the provider's `callbackUrl` — the mount path plus `/github/callback`: `https://tracker.example.com/auth/github/callback`. For local development, register a second OAuth app with `http://localhost:3000/auth/github/callback` rather than widening the production one.
4. Leave **Enable Device Flow** off.
5. Copy the Client ID, generate a client secret, and put both in the environment (`GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`). Never commit them.

GitHub supports PKCE for OAuth apps (`S256` only); this module always sends it. The default scopes are `read:user` and `user:email` — the latter is what lets the provider see private addresses and whether they're verified.

## Google

```bxs
auth.provider( "google", boxExpressAuthGoogle( {
	clientId: getSystemSetting( "GOOGLE_CLIENT_ID" ),
	clientSecret: getSystemSetting( "GOOGLE_CLIENT_SECRET" ),
	callbackUrl: "https://tracker.example.com/auth/google/callback",
	hostedDomain: "example.com"        // optional — see below
} ) )
```

Link to `/auth/google`. Scopes default to `openid email profile`. The identity's `id` is Google's `sub` (a long numeric string); `username` is always `""` because Google has none; `avatarUrl` is the `picture` claim.

**`hostedDomain`** limits sign-in to one Google Workspace domain. It's sent as Google's `hd` parameter — which only pre-selects the account and can be removed by the user — and then **enforced** against the `hd` claim inside the signed ID token. `"*"` accepts any Workspace account but no consumer `@gmail.com` one. Don't restrict by the email's domain instead: Google says to use `hd` for that.

### Registering a Google OAuth client

1. [Google Cloud console](https://console.cloud.google.com/) → pick or create a project → **APIs & Services → OAuth consent screen**. Choose *Internal* (Workspace users only) or *External*, add the `openid`, `email` and `profile` scopes, and add test users while the app is in testing.
2. **APIs & Services → Credentials → Create credentials → OAuth client ID**, application type **Web application**.
3. **Authorized redirect URIs**: exactly the provider's `callbackUrl` — `https://tracker.example.com/auth/google/callback`. Add `http://localhost:3000/auth/google/callback` to a separate dev client rather than the production one.
4. Put the client ID and secret in the environment (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`).

## Microsoft

```bxs
auth.provider( "microsoft", boxExpressAuthMicrosoft( {
	clientId: getSystemSetting( "MICROSOFT_CLIENT_ID" ),
	clientSecret: getSystemSetting( "MICROSOFT_CLIENT_SECRET" ),
	callbackUrl: "https://tracker.example.com/auth/microsoft/callback",
	tenant: "organizations"
} ) )
```

Entra ID (the v2.0 endpoints), as an OIDC preset. `tenant` decides who can sign in:

| `tenant` | |
|---|---|
| `"common"` (default) | Any work/school account, and personal Microsoft accounts |
| `"organizations"` | Work/school accounts only |
| `"consumers"` | Personal Microsoft accounts only |
| a tenant id or domain | That one tenant (`"72f988bf-…"` or `"contoso.onmicrosoft.com"`) |

The multi-tenant endpoints publish a templated issuer (`https://login.microsoftonline.com/{tenantid}/v2.0`) and every token carries its own tenant's `iss`. The preset checks `iss` against the token's `tid` claim and `tid` against `tenant`; with `allowedTenants: [ "<tenant id>", … ]`, only those tenants get in — how a multi-tenant SaaS app limits sign-in to the customers it has onboarded.

**`identity.emailVerified` is always false.** Microsoft doesn't verify the `email` claim (a tenant admin can set it to anything), so it must never decide who someone is. `identity.id` is `sub`; `identity.tenantId` is the `tid`; `identity.username` is `preferred_username` (usually the UPN, which can change). Userinfo is off (`userinfo: "never"`) — the ID token already has everything userinfo would add.

Register the app under *Microsoft Entra ID → App registrations*: add a *Web* redirect URI of `<origin>/auth/microsoft/callback` (and, for logout at Microsoft, your `postLogoutRedirectUrl` as a redirect URI too), and create a client secret under *Certificates & secrets*. The *Supported account types* choice has to agree with `tenant`.

## GitLab

```bxs
auth.provider( "gitlab", boxExpressAuthGitLab( {
	clientId: getSystemSetting( "GITLAB_CLIENT_ID" ),
	clientSecret: getSystemSetting( "GITLAB_CLIENT_SECRET" ),
	callbackUrl: "https://tracker.example.com/auth/gitlab/callback",
	baseUrl: "https://gitlab.com"      // or your self-managed instance
} ) )
```

GitLab is an OIDC issuer at its own base URL, so this is the generic provider with that issuer. `identity.username` is the GitLab username; `emailVerified` comes from GitLab's `email_verified`. Create the application under *User settings → Applications* (or an instance-wide one under *Admin → Applications*) with the `openid`, `email` and `profile` scopes. GitLab has no `end_session_endpoint`, so logout is local only.
