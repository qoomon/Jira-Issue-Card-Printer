#!/bin/sh

GIT_REPO="https://qoomon:${GH_TOKEN}@github.com/qoomon/Jira-Issue-Card-Printer.git"
SOURCE_BRANCH="${TRAVIS_BRANCH}"
SOURCE_FOLDER='dist'
CLONE_FOLDER='gh-pages'
TARGET_BRANCH='gh-pages'

echo "Deploy to '${TARGET_BRANCH}'"

echo "Clone '${TARGET_BRANCH}' to '${CLONE_FOLDER}'"
git clone --branch ${TARGET_BRANCH} --depth 1  ${GIT_REPO} ${CLONE_FOLDER}
cd ${CLONE_FOLDER}; git rm -r . --ignore-unmatch --quiet

echo "Apply '${SOURCE_FOLDER}'"
cp -R ../${SOURCE_FOLDER}/* ./
git add .

echo "Commit changes to '${TARGET_BRANCH}'"
git config user.name 'Travis'
git config user.email '<>'
git commit -m "Travis Build" -m "Source Branch ${SOURCE_BRANCH}" -m "$(git show -s --format='short')"

echo "Push to '${TARGET_BRANCH}'"
git push -q origin ${TARGET_BRANCH}


