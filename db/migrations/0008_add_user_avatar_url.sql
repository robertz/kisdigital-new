-- Google's userinfo response includes a `picture` URL for the signed-in
-- account's profile photo — AuthService.findOrCreateGoogleUser() now
-- captures it for new (role='commenter') accounts. Nullable: password-login
-- accounts (admin/author, created via the /manage author editor) never had
-- a picture to begin with, and existing rows are never mutated by a repeat
-- Google sign-in (see findOrCreateGoogleUser()'s own docblock), so this
-- stays empty for anyone who signed up before this column existed too.
ALTER TABLE User
    ADD COLUMN avatar_url VARCHAR(500) NULL AFTER avatar_label;
