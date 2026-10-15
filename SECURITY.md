# Security Policy

This client talks to a local server that hands out vault secrets, so security reports matter.

## Reporting a vulnerability

**Do not open a public issue.** Use GitHub's private reporting:
https://github.com/TheMusicDev/bw-serve-client/security/advisories/new

Include the affected version, a description, and a minimal reproduction (with no real secrets). You'll get a reply within a few days.

## Scope

In scope: this package leaking secrets (logs, error messages, thrown objects), unsafe request construction (path/query injection), supply-chain issues (dependencies, publish pipeline).

Out of scope: vulnerabilities in the Bitwarden CLI or `bw serve` itself. Report those to [Bitwarden](https://bitwarden.com/help/report-a-vulnerability/) (https://hackerone.com/bitwarden).

## Supported versions

Only the latest release gets fixes.

## Hardening reminders for users

- `bw serve` has no authentication. Bind to `localhost` only.
- Never expose the port to a network, container network, or browser context.
- Don't log the `raw` session key returned by `unlock()`.
