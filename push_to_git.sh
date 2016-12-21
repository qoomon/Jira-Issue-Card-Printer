#!/bin/sh
set -e

if [ $# -ne 4 ]; then
    echo "Usage: ... <SOURCE_FOLDER> <COMMIT_MESSAGE> <TARGET_REPO> <TARGET_BRANCH>"
    exit 1;
fi

SOURCE_FOLDER="$1"
COMMIT_MESSAGE="$(echo "$2")"

TARGET_REPO="$3"
TARGET_BRANCH="$4"

echo "Deploy '$SOURCE_FOLDER' to '${TARGET_REPO}' '$TARGET_BRANCH'"

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
echo '--- Update to Stash & Commit Changes'
git rm -r . --ignore-unmatch --quiet
git stash pop --quiet
git commit -am $"$COMMIT_MESSAGE" --quiet
git --no-pager log -n 1 --name-status --stat --oneline

echo ''
echo '--- Push Changes'
echo git push


