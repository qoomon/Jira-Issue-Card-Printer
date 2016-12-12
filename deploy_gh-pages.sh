#!/bin/sh
echo 'Deploy to "gh-pages"'
git clone --depth 1 -b 'gh-pages' --single-branch "https://github.com/qoomon/Jira-Issue-Card-Printer.git" gh-pages
cd 'gh-pages'
  git rm -r '*' --ignore-unmatch --quiet

  cp -R ../dist/* ./ 
  git add .

  git -c user.name='travis' -c user.email='travis' commit -m "Travis Build" -m "Source Branch $TRAVIS_BRANCH" -m "$(git show -s --format='short' )"

  git push -f -q "https://qoomon:${GH_TOKEN}@github.com/qoomon/Jira-Issue-Card-Printer.git" gh-pages:gh-pages &2>/dev/null
cd -
