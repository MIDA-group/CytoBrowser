# CytoBrowser development – a Contributors’ Howto
Essentially we follow a simplified Gitflow (master is used as release branch)
https://www.atlassian.com/git/tutorials/comparing-workflows/gitflow-workflow
- Do not touch master; master is only for releases (and possible bugfixes) – done by Joakim
- Development is done in feature branches created from **develop**
- To sync, **rebase** feature branches from `develop`, and use `--force-with-lease` (make sure no one else uses it)
  - Make pull use rebase by default: `git config --global pull.rebase merges`
- Do not squash commit messages (we prefer the long history)

## Development procedure
### Create feature branch from develop
1. `git switch develop`
1. `git switch -c devel/feature_branch`
### Commit to your feature branch
1. `git pull` #most probably you are alone on your feature branch
1. `git add <yourfile>` #`git add -u` to stage all changes
1. `git status; git diff --staged` #does it look good?
1. `git commit -m "Short and meaningful commit message"`
1. `git push`
### Update feature branch from develop
Suggested to do this at the start of your workday, and mandatory before PR
1. `git switch devel/feature_branch` #you are probably already there
1. `git remote update` #or `git fetch --all` 
1. `git rebase develop`
1. `git mergetool` #if needed
1. **Test that nothing is broken!**
1. `git push --force-with-lease` #verify that no-one else is using your feature branch
## Update develop from feature branch
1. Perform "[Update feature branch from develop](#update-feature-branch-from-develop)"
1. Make pull request on [GitHub](https://github.com/MIDA-group/CytoBrowser/pulls)
