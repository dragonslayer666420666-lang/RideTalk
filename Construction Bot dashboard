# RideTalk Construction Bot

The Construction Bot is a GitHub-only update system for the public RideTalk Pages app.

## What it does

1. The repository owner opens an issue whose title begins with `[Construction Bot]`.
2. A GitHub Actions workflow reads the request.
3. GitHub Models creates a small exact-replacement plan for `index.html`.
4. Local scripts apply the plan and check JavaScript syntax, duplicate IDs, missing UI references, file size, and accidental secrets.
5. The workflow creates a new branch and pull request.
6. Nothing is merged until the repository owner reviews and merges the pull request.

Open the phone-friendly dashboard at:

`https://dragonslayer666420666-lang.github.io/RideTalk/construction-bot.html`

## Rollback

Open the repository **Actions** tab, choose **RideTalk Construction Bot Rollback**, tap **Run workflow**, and enter the merged Construction Bot pull-request number. The rollback also opens a pull request instead of changing `main` automatically.

## Required repository setting

In **Settings → Actions → General → Workflow permissions**, GitHub may require **Read and write permissions** and permission for Actions to create pull requests. The workflow itself requests only the permissions it needs: repository contents, issues, pull requests, and GitHub Models read access.

## Security rules

- No GitHub token is stored in `index.html`.
- The temporary `GITHUB_TOKEN` exists only during a GitHub Actions run.
- Only issues opened by the repository owner are accepted.
- The bot cannot auto-merge.
- The bot blocks common secret formats and dynamic `eval` code.
- Email files, uploads, and public URLs are never treated as trusted code.
