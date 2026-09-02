# Security incident runbook

## Purge a secret from Git history

Treat any credential committed to Git as compromised. Rewriting history does not
make the old credential safe, and it does not remove copies from existing
clones or forks.

1. **Rotate or revoke the secret first.** Create a replacement through the
   provider, update the Replit secret or environment variable, and verify the
   application uses the replacement. Do not paste the live credential into
   this repository or commit it again.
2. **Make a disposable mirror clone.** Work from a fresh clone so the original
   repository remains available as a backup:

   ```sh
   git clone --mirror <repository-url> repo-history-scrub.git
   cd repo-history-scrub.git
   ```

   Install `git-filter-repo` if it is not already available:

   ```sh
   python3 -m pip install git-filter-repo
   ```

3. **Scrub every affected commit.** For a file that should never have been
   tracked, remove it from all history:

   ```sh
   git filter-repo --path path/to/exposed-file --invert-paths
   ```

   To redact a value while keeping the file, create a temporary replacement
   file outside the repository. Each line uses
   `OLD_VALUE==>REDACTED_VALUE`:

   ```sh
   printf '%s\n' 'REVOKED_VALUE==>REDACTED_VALUE' > /tmp/git-secret-replacements.txt
   git filter-repo --replace-text /tmp/git-secret-replacements.txt
   rm -f /tmp/git-secret-replacements.txt
   ```

   Replace the example values locally; never commit the replacement file.
   Inspect the rewritten history and confirm the old value and file no longer
   appear before publishing it.
4. **Force-push the rewritten history.** `git-filter-repo` may remove the
   `origin` remote as a safety measure, so add it back if needed, then update
   all branches and tags:

   ```sh
   git remote add origin <repository-url>  # only if origin is missing
   git push --force --mirror origin
   ```

   Coordinate this push with the team because it replaces the remote history.
5. **Notify collaborators and fork owners.** Tell everyone to delete old local
   clones and **re-clone** the repository; do not pull the rewritten history
   into an old clone. Ask owners of any forks or mirrors to repeat the scrub or
   remove their copies. Assume the credential remains exposed wherever an old
   commit may have been cached, and continue monitoring and revoking it as
   necessary.

For a suspected leak in a hosted Git service, also use that provider's secret
scanning or cache-removal process after the force-push. History rewriting is
not a substitute for rotating the credential.