# Production (Cloudflare tunnel)

The same setup as dt-next. The server keeps a deployment folder of its own, outside any checkout, e.g. `~/Containers/kisdigital`. It holds only what's specific to that server: `deploy.sh`, `.env` and `production.env`. Everything else comes from GitHub on each deploy: `deploy.sh` pulls the latest `main` into the folder's `src/`, then builds and starts with `src/production/docker-compose.yml`, so compose changes ship with the code. It also refreshes itself and `compose.sh` from the repo. It runs the app and `cloudflared`, publishes no ports, and uses the MySQL container already on the host: the app joins its network (`docker-mysql_default`, where `do-mirror-mysql` runs) and connects by container name.

App Platform (`.do/app.yaml`) still deploys every push to `main` until it's switched off. The Dockerfile's last stage is the app for its sake, and its fixed JVM settings are App Platform's; the compose file replaces them with ones sized from the container.

1. **Tunnel.** In Cloudflare Zero Trust, create a tunnel (Networks > Tunnels > Create, type Cloudflared). Under the tunnel's **Public hostname** tab, add `kisdigital.com` and `www.kisdigital.com` with service `HTTP` and URL `app:3005`. Copy the tunnel token from its install command.
2. **Deploy key.** The repo is private, so `deploy.sh` clones it over SSH. On the server, make a key just for this:

   ```bash
   ssh-keygen -t ed25519 -N "" -f ~/.ssh/kisdigital_deploy -C "kisdigital deploy"
   ```

   Add `~/.ssh/kisdigital_deploy.pub` to the repo under Settings > Deploy keys, read-only.
3. **Database.** The schema is a copy of amos's `chron`, loaded into `chron_production` on the MySQL container. Do it again just before switching DNS over, so nothing written on App Platform in between is lost. With amos's login in `~/Development/docker-mysql/amos.cnf` (a `[client]` section: host, port, user, password, `ssl-mode=REQUIRED`):

   ```bash
   docker cp ~/Development/docker-mysql/amos.cnf do-mirror-mysql:/tmp/amos.cnf
   ```

   ```bash
   docker exec do-mirror-mysql mysqldump --defaults-extra-file=/tmp/amos.cnf --single-transaction --quick --set-gtid-purged=OFF --no-tablespaces --hex-blob --default-character-set=utf8mb4 chron > ~/Development/docker-mysql/dumps/chron-$(date +%F).sql
   ```

   ```bash
   docker exec -u root do-mirror-mysql rm /tmp/amos.cnf
   ```

   Then load it into a fresh `chron_production`:

   ```bash
   docker exec -it do-mirror-mysql mysql -uroot -p
   ```

   ```sql
   DROP DATABASE IF EXISTS chron_production;
   CREATE DATABASE chron_production CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
   ```

   ```bash
   docker exec -i do-mirror-mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" chron_production' < ~/Development/docker-mysql/dumps/chron-$(date +%F).sql
   ```

4. **Settings.** Make the deployment folder:

   ```bash
   mkdir -p ~/Containers/kisdigital && cd ~/Containers/kisdigital
   ```

   Copy `deploy.sh`, `.env.example` (as `.env`) and `production.env.example` (as `production.env`) there from this folder, then fill them in. `.env` is read by compose only: the tunnel token, the repo and branch, and `DEPLOY_KEY=/home/<you>/.ssh/kisdigital_deploy`. `production.env` holds the app's settings; the secrets (R2, Google OAuth, the database password) are the ones App Platform has now.

5. **Deploy**, now and after every push to `main`:

   ```bash
   ./deploy.sh
   ```

   It brings `src/` to the latest commit, builds from it (and the latest base images), runs the specs in the new image, restarts the app on it, and removes the old one. If a spec fails, it stops there and the running app is left as it was; `SKIP_TESTS=1 ./deploy.sh` deploys without them. `cloudflared` connects once the app's health check passes, and stays stopped until `.env` has `TUNNEL_TOKEN`. To deploy something other than `main`, set `REPO_REF` in `.env` to a branch or tag.

New files in `db/migrations` are applied when the app starts (`models/util/Migrator.bx`) and recorded in `SchemaMigration`. The first start records 0001 to 0027 as already applied without running them, since those were applied by hand.

For anything else, `./compose.sh` is `docker compose` for the deployment: `./compose.sh logs -f app`, `./compose.sh ps`.

The compose file sets `TRUST_PROXY_HEADER=CF-Connecting-IP`, so `req.ip` (comments, sign-in logs, RequestLog) is each visitor rather than the tunnel. That's safe only because nothing reaches the app except through `cloudflared`; don't add a `ports:` entry to the app while it's set. The app container is limited to 1 GB and 1 CPU by default (`APP_MEMORY`, `APP_CPUS` in `.env`); the JVM takes three quarters of the memory for its heap, so a change needs only `./deploy.sh`, not a rebuild.
