# History preservation check

Original default-branch heads at consolidation:

| Source | Head | Reachable commits |
| --- | --- | ---: |
| Backend | `8459f1b2cca3d854675d9f9a659be39a5f7b25bc` | 29 |
| Frontend | `27634e6d82ffec9b2c37e5f30df341922e07e17b` | 33 |

All 62 source commits remain reachable unchanged. A Git commit ID covers its tree, parents, authorship, author date, committer identity/date, message and embedded signature where present. Preserving the original objects therefore preserves those fields and original merge relationships. Verification of any signature still depends on GitHub's key and verification policies.

After checkout, verify both imported histories:

```sh
git merge-base --is-ancestor 8459f1b2cca3d854675d9f9a659be39a5f7b25bc HEAD
git merge-base --is-ancestor 27634e6d82ffec9b2c37e5f30df341922e07e17b HEAD
git rev-list --count 8459f1b2cca3d854675d9f9a659be39a5f7b25bc
git rev-list --count 27634e6d82ffec9b2c37e5f30df341922e07e17b
git log --follow -- frontend/src/App.vue
```

The branch also includes new directory relocation commits, the two-parent consolidation merge, and root documentation/CI changes. They use their real current dates. Only histories reachable from the original default-branch heads are imported; unused branches, tags and GitHub PR conversations are not copied.

Do not use squash or rebase when merging the consolidation PR. Retain the existing backend repository rather than creating a new GitHub repository, to preserve its 14 October 2022 creation date. Renaming/archival and hosting configuration updates follow the reviewed merge.
