-- Adds a third User.role value for Google-authenticated accounts that
-- aren't CMS staff (routes/Auth.bx, AuthService.findOrCreateGoogleUser()).
-- 'author'/'admin' rows are unaffected — this only widens the enum so a
-- new row can be created with role='commenter' for anyone signing in with
-- Google whose email doesn't already match an existing User row. That role
-- carries no /manage access (see requireAuth() in routes/Manage.bx, and
-- doLogin()'s own role check) — it exists purely so a session can be
-- established ahead of the comments feature this is laying groundwork for.
ALTER TABLE User
    MODIFY COLUMN role ENUM('author','admin','commenter') NOT NULL DEFAULT 'author';
