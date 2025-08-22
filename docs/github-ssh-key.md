## GitHub SSH key for this app

This environment has a dedicated SSH keypair to use with GitHub. Use this doc to find the key again, add it to GitHub, and verify access.

### Key locations
- Private key: `~/.ssh/mdlpcr_github`
- Public key: `~/.ssh/mdlpcr_github.pub`
- SSH config alias: `mdlpcr-github` (defined in `~/.ssh/config`)

Config entry that should exist:

```
Host mdlpcr-github
    HostName github.com
    User git
    IdentityFile ~/.ssh/mdlpcr_github
    IdentitiesOnly yes
    AddKeysToAgent yes
```

### Show the public key (copy this into GitHub)

Run:

```
cat ~/.ssh/mdlpcr_github.pub
```

Copy the full line that starts with `ssh-ed25519`. You may paste the entire line including the trailing comment (e.g., `MDL-PCR-Analyzer key (2025-08-22)`). The comment/date is optional and ignored for authentication.

### Add the key to GitHub

- Personal key: GitHub → Settings → SSH and GPG keys → New SSH key → paste the public key (including the comment/date is fine).
- Deploy key (per‑repo): Repo → Settings → Deploy keys → Add deploy key → paste the public key.

Give it a recognizable title like "MDL-PCR-Analyzer key (Codespace)".

Note: The "Title" in GitHub is a separate label you choose. It doesn’t need to match or include the date from the key’s comment.

### Use the key for this repository

Set the remote to use the SSH alias:

```
git remote set-url origin git@mdlpcr-github:jon06041/MDL-PCR-Analyzer.git
```

Verify it worked:

```
git remote -v
```

You should see `git@mdlpcr-github:jon06041/MDL-PCR-Analyzer.git` for `origin`.

### Test the SSH connection

```
ssh -T git@mdlpcr-github
```

On first connect, answer `yes` to trust the host. Success looks like:

```
Hi <your-github-username>! You've successfully authenticated, but GitHub does not provide shell access.
```

### Troubleshooting

- Permission denied (publickey):
  - Ensure permissions are correct:
    - `chmod 600 ~/.ssh/mdlpcr_github`
    - `chmod 644 ~/.ssh/mdlpcr_github.pub`
    - `chmod 600 ~/.ssh/config`
  - Confirm the config contains the `mdlpcr-github` entry.
  - Confirm the key is added in GitHub (Settings → SSH and GPG keys).
- Diagnose with verbose logs:
  
  ```
  ssh -vvv -T git@mdlpcr-github
  ```

### Notes

- Never commit private keys. Keys live in your home directory, not the repo.
- Public key (`.pub`) is safe to share; private key must remain secret.

## Using this key with AWS

You can reuse the same keypair for AWS services. There are two common cases:

### 1) EC2 (instance login)

Option A — Import as an EC2 Key Pair:
- EC2 Console → Key Pairs → Import key pair → Paste the content of `~/.ssh/mdlpcr_github.pub`.
- Name it something like `mdlpcr_github`.
- Launch instances using that key pair.

Connect to your instance:

```
ssh -i ~/.ssh/mdlpcr_github ec2-user@<ec2-public-dns>
```

Common usernames by AMI:
- Amazon Linux: `ec2-user`
- Ubuntu: `ubuntu`
- Debian: `admin` or `debian`
- CentOS: `centos`

Ensure the instance security group allows inbound TCP 22 from your IP.

Note on ED25519: Most modern Linux AMIs and OpenSSH support ED25519. If an AWS workflow insists on RSA, generate a separate RSA key just for EC2 and import that public key instead.

### 2) AWS CodeCommit (Git over SSH)

Steps:
1. IAM Console → Users → Your user → Security credentials → "Upload SSH public key for AWS CodeCommit" → paste `~/.ssh/mdlpcr_github.pub`.
2. After upload, note the SSH key ID shown by IAM (looks like `APKA...`). This ID is the SSH username for CodeCommit.
3. Add an SSH config entry (replace `<region>` and the example key ID):

```
Host aws-codecommit-<region>
  HostName git-codecommit.<region>.amazonaws.com
  User APKAEIBAERJR2EXAMPLE
  IdentityFile ~/.ssh/mdlpcr_github
  IdentitiesOnly yes
```

4. Use an SSH remote like:

```
git remote add codecommit ssh://aws-codecommit-<region>/v1/repos/<RepoName>
```

ED25519 note: CodeCommit supports ED25519 with modern OpenSSH. If you encounter an incompatibility in your environment, create a separate RSA key for CodeCommit and upload that to IAM.

