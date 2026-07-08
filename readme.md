# Dokploy CLI (CIQ fork)

Dokploy CLI is a command-line tool to manage your Dokploy server remotely. It provides **449 commands** auto-generated from the Dokploy OpenAPI spec, plus a custom `deploy` command for one-step static/app deployments.

## Installation

```bash
npm install -g @serhii-ciq/dokploy-cli
```

## Authentication

### Option 1: Using the `auth` command

```bash
dokploy auth -u https://console.cloud.creatoriq.com -t YOUR_API_KEY
```

### Option 2: Environment variables

```bash
export DOKPLOY_URL="https://console.cloud.creatoriq.com"
export DOKPLOY_API_KEY="YOUR_API_KEY"
```

### Option 3: `.env` file

Create a `.env` file in your working directory:

```env
DOKPLOY_URL="https://console.cloud.creatoriq.com"
DOKPLOY_API_KEY="YOUR_API_KEY"
```

The CLI loads it automatically. Shell environment variables take priority over the `.env` file.

## Quick deploy

Deploy a directory to Dokploy in one command (similar to `vercel deploy`):

```bash
dokploy deploy .
```

On the first run it creates a project, application, uploads the code as a ZIP, waits for the build to finish, creates a domain, and prints the URL. A `.dokploy/config.json` file is saved so subsequent deploys only re-upload and rebuild.

### Options

| Flag | Default | Description |
|------|---------|-------------|
| `--name <name>` | directory basename | Project and application name |
| `--build-type <type>` | `static` | `static`, `railpack`, or `dockerfile` |
| `--publish-dir <dir>` | `.` | Directory nginx serves (static only) |
| `--port <port>` | `80` | Container port for the domain |
| `--spa` | off | SPA mode: nginx `try_files` fallback to `index.html` |
| `--json` | off | Output raw JSON |
| `--debug` | off | Show full API error responses |

### Examples

```bash
# Static site (default)
dokploy deploy ./my-site

# SPA (React/Vue/Angular)
dokploy deploy ./dist --spa --name my-app

# Node.js app with Railpack
dokploy deploy . --build-type railpack --port 3000

# Redeploy (same directory, config already exists)
dokploy deploy .
```

### `.dokploy/config.json`

Created automatically on first deploy. Add `.dokploy/` to your `.gitignore`.

```json
{
  "projectId": "...",
  "environmentId": "...",
  "applicationId": "...",
  "appName": "my-app-a1b2c3",
  "buildType": "static",
  "url": "https://my-app-a1b2c3.cloud.creatoriq.com"
}
```

## Usage (generated commands)

```bash
dokploy <group> <action> [options]
```

### Examples

```bash
# List all projects
dokploy project all

# Get a specific project
dokploy project one --projectId abc123

# Create an application
dokploy application create --name "my-app" --environmentId env123

# Deploy an application
dokploy application deploy --applicationId app123

# Create a postgres database
dokploy postgres create --name "my-db" --environmentId env123

# Stop a database
dokploy postgres stop --postgresId pg123

# Get raw JSON output
dokploy project all --json
```

### Getting help

```bash
# List all groups
dokploy --help

# List actions in a group
dokploy application --help

# See options for a specific action
dokploy application deploy --help
```

## Available command groups

| Group | Commands | Group | Commands |
|---|---|---|---|
| `admin` | 1 | `notification` | 38 |
| `ai` | 9 | `organization` | 10 |
| `application` | 29 | `patch` | 12 |
| `backup` | 11 | `port` | 4 |
| `bitbucket` | 7 | `postgres` | 14 |
| `certificates` | 4 | `preview-deployment` | 4 |
| `cluster` | 4 | `project` | 8 |
| `compose` | 28 | `redirects` | 4 |
| `deployment` | 8 | `redis` | 14 |
| `destination` | 6 | `registry` | 7 |
| `docker` | 7 | `rollback` | 2 |
| `domain` | 9 | `schedule` | 6 |
| `environment` | 7 | `security` | 4 |
| `gitea` | 8 | `server` | 16 |
| `github` | 6 | `settings` | 49 |
| `gitlab` | 7 | `ssh-key` | 6 |
| `git-provider` | 2 | `sso` | 10 |
| `license-key` | 6 | `stripe` | 7 |
| `mariadb` | 14 | `swarm` | 3 |
| `mongo` | 14 | `user` | 18 |
| `mounts` | 6 | `volume-backups` | 6 |
| `mysql` | 14 | | |

## Development

```bash
# Install dependencies
npm install --legacy-peer-deps

# Run without building (tsx transpiles on the fly)
npx tsx src/index.ts deploy . --name test

# Build TypeScript (skip prebuild which requires pnpm)
npx tsc -b

# Use local build globally via symlink
npm link

# Remove the symlink
npm unlink -g @serhii-ciq/dokploy-cli
```

### Updating generated commands

Commands are auto-generated from `openapi.json`. To update:

1. Replace `openapi.json` with the latest spec from the [Dokploy repo](https://github.com/Dokploy/dokploy)
2. Run `npx tsx scripts/generate.ts`
3. Build with `npx tsc -b`

### Publishing to npm

```bash
# Set the npm token (one-time, or use NPM_TOKEN env var)
# The local .npmrc is configured to use https://registry.npmjs.org/

# Bump version
npm version patch  # or minor / major

# Build and publish
npx tsc -b
NPM_TOKEN=<your-npm-token> npm publish --access public
```

Package: [`@serhii-ciq/dokploy-cli`](https://www.npmjs.com/package/@serhii-ciq/dokploy-cli)

## License

This project is licensed under the [MIT License](LICENSE).
