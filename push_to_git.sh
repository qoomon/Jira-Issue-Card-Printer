#!/bin/sh

SOURCE_FOLDER="$1"
SOURCE_BRANCH="${TRAVIS_BRANCH}"

TARGET_REPO="$2"
TARGET_BRANCH="$3"

CLONE_FOLDER='.deploy'

echo "Deploy '$SOURCE_FOLDER' to '${TARGET_REPO}' '$TARGET_BRANCH'"

echo "--- Clone Repo"
rm -rf .deploy "$CLONE_FOLDER"
git clone --branch "${TARGET_BRANCH}" --depth 1 "${TARGET_REPO}" "${CLONE_FOLDER}"
(
    cd "${CLONE_FOLDER}";

    echo "--- Apply Changes"
    git rm -r . --ignore-unmatch --quiet
    cp -R ../${SOURCE_FOLDER}/* ./
    git add .
    git config user.name 'Travis'
    git config user.email '<>'
    git commit -m "Travis Build" -m "Source Branch ${SOURCE_BRANCH}" -m "$(git show -s --format='short')"

    echo "--- Push Changes"
    git push -q 'origin' "${TARGET_BRANCH}"
)
rm -rf .deploy "$CLONE_FOLDER"


