#!/bin/sh

if [ $# -ne 3 ]; then
    echo "Usage: ... <SOURCE_FOLDER> <SOURCE_BRANCH> <TARGET_REPO> <TARGET_BRANCH>"
    exit 1;
fi

GIT_USERNAME='Travis'

SOURCE_FOLDER="$1"
SOURCE_BRANCH="$2"

TARGET_REPO="$3"
TARGET_BRANCH="$4"

echo "Deploy '$SOURCE_FOLDER' to '${TARGET_REPO}' '$TARGET_BRANCH'"

set -e

cd "${SOURCE_FOLDER}";

rm -rf '.git'
git init

echo ''
echo '--- Stash Files'
git commit --allow-empty -m '.' --quiet
git add .
git stash --quiet

echo ''
echo '--- Pull Target Repository'
git branch --move "${TARGET_BRANCH}"
git remote add 'origin' "${TARGET_REPO}"
git pull --rebase --no-tags --depth 1 'origin' "${TARGET_BRANCH}"
git branch --set-upstream-to="origin/${TARGET_BRANCH}" --quiet

echo ''
echo '--- Update to Stash'
git rm -r . --ignore-unmatch --quiet
git stash pop --quiet

echo ''
echo '--- Commit Changes'
git commit -m "Travis Build" -m "Source Branch ${SOURCE_BRANCH}" -m "$(git show -s --format='short')" --quiet
git log -n 1 --name-status HEAD --oneline --stat

echo ''
echo '--- Push Changes'
echo git push


