#!/usr/bin/env bash
# Deploys KISDigital from GitHub. This script lives in the deployment folder
# (e.g. ~/Containers/kisdigital) beside .env and production.env, which are that
# server's own; everything else comes from the repo. It pulls REPO_REF (main)
# into src/, builds the image from it, and starts the app and cloudflared with
# src/production/docker-compose.yml. When the repo's copy of this script has
# changed, it replaces itself with that and runs again.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
cd "$here"

if [[ ! -f production.env ]]; then
	echo "Missing $here/production.env: copy production.env.example from the repo's production/ folder and fill it in" >&2
	exit 1
fi
touch .env

# a setting from .env, the file compose reads too
setting() {
	grep -E "^$1=" .env | tail -n 1 | cut -d= -f2- || true
}
repo_url=$(setting REPO_URL)
repo_ref=$(setting REPO_REF)
deploy_key=$(setting DEPLOY_KEY)
repo_url=${repo_url:-git@github.com:robertz/kisdigital-new.git}
repo_ref=${repo_ref:-main}
if [[ -n $deploy_key ]]; then
	export GIT_SSH_COMMAND="ssh -i $deploy_key -o IdentitiesOnly=yes"
fi

# src/ is ours alone: whatever is there becomes exactly REPO_REF's latest commit.
# Skipped on the second run after this script replaced itself.
if [[ -z ${DEPLOY_PULLED:-} ]]; then
	if [[ ! -d src/.git ]]; then
		git clone --quiet --depth 1 --branch "$repo_ref" "$repo_url" src
	else
		git -C src remote set-url origin "$repo_url"
		git -C src fetch --quiet --depth 1 origin "$repo_ref"
		git -C src reset --quiet --hard FETCH_HEAD
		git -C src clean --quiet -fdx
	fi
	if ! cmp -s src/production/deploy.sh "$here/deploy.sh"; then
		echo "deploy.sh changed in the repo; using the new one"
		cp src/production/deploy.sh "$here/deploy.sh.new"
		chmod +x "$here/deploy.sh.new"
		mv "$here/deploy.sh.new" "$here/deploy.sh"
		DEPLOY_PULLED=1 exec "$here/deploy.sh" "$@"
	fi
fi
echo "Deploying $(git -C src log -1 --format='%h %s')"
install -m 755 src/production/compose.sh "$here/compose.sh"

compose() {
	"$here/compose.sh" "$@"
}

# the image the app runs now (or "" before the first deploy)
app_container=$(compose ps -aq app 2>/dev/null || true)
previous=""
if [[ -n $app_container ]]; then
	previous=$(docker inspect -f '{{.Image}}' "$app_container" 2>/dev/null || true)
fi

# --pull: the latest base images (BoxLang, Node) too, not only the latest commit
compose build --pull app
current=$(docker image inspect -f '{{.Id}}' kisdigital:latest)

# the specs, in that image: a failure stops here, with the running app untouched.
# SKIP_TESTS=1 ./deploy.sh deploys without them, for when there's no time to fix one.
if [[ -n ${SKIP_TESTS:-} ]]; then
	echo "SKIP_TESTS is set: deploying without running the specs"
elif ! MYSQL_NETWORK=$(setting MYSQL_NETWORK) src/production/test-image.sh "$here/production.env"; then
	echo "The specs failed in the new image, so the app wasn't changed" >&2
	exit 1
fi

# compose doesn't recreate a container when only its image is new: say so
recreate=()
if [[ -n $previous && $previous != "$current" ]]; then
	recreate=(--force-recreate)
fi
# (the odd expansion: an empty array is "unbound" to set -u in macOS's bash 3.2)
compose up -d --remove-orphans ${recreate[@]+"${recreate[@]}"} app
if [[ -n $(setting TUNNEL_TOKEN) ]]; then
	compose up -d cloudflared
else
	echo "No TUNNEL_TOKEN in $here/.env yet: the app is running without cloudflared"
fi

# the image this replaced, now that nothing runs it
if [[ -n $previous && $previous != "$current" ]]; then
	docker image rm "$previous" > /dev/null 2>&1 || true
fi

compose ps
