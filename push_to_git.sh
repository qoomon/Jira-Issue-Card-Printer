#!/bin/sh

SOURCE_FOLDER="$1"
SOURCE_BRANCH="${TRAVIS_BRANCH}"

TARGET_REPO="$2"
TARGET_BRANCH="$3"

CLONE_FOLDER='.deploy'

echo "Deploy '$SOURCE_FOLDER' to '${TARGET_BRANCH}' '$TARGET_BRANCH'"
rm -rf .deploy "$CLONE_FOLDER"

echo "--- Clone '${TARGET_BRANCH}' to '${CLONE_FOLDER}'"
git clone --branch ${TARGET_BRANCH} --depth 1  ${TARGET_REPO} ${CLONE_FOLDER}
cd ${CLONE_FOLDER}; git rm -r . --ignore-unmatch --quiet

echo "--- Apply '${SOURCE_FOLDER}'"
cp -R ../${SOURCE_FOLDER}/* ./
git add .

echo "--- Commit changes to '${TARGET_BRANCH}'"
git config user.name 'Travis'
git config user.email '<>'
git commit -m "Travis Build" -m "Source Branch ${SOURCE_BRANCH}" -m "$(git show -s --format='short')"

echo "--- Push to '${TARGET_BRANCH}'"
git push -q origin ${TARGET_BRANCH}


