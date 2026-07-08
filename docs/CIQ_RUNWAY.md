# 🛫 CIQ Runway

**Internal platform for deploying apps, static sites, and databases.**
Built on top of [Dokploy](https://dokploy.com). One command — and you're live.

🌐 **UI Console:** [console.cloud.creatoriq.com](https://console.cloud.creatoriq.com)
📦 **CLI:** `@serhii-ciq/dokploy-cli`

---

## ✨ What is CIQ Runway?

Deploy anything from your terminal in one command:

- 🚀 **Static sites** — HTML, CSS, JS — just drop and go
- ⚛️ **SPAs** — React, Vue, Angular with client-side routing
- 🟢 **Node.js apps** — auto-detected with Railpack
- 🐘 **Postgres** — spin up a database in seconds
- 🔒 **HTTPS** — automatic TLS via ACM
- 🌍 **Domain** — `your-app.cloud.creatoriq.com` created automatically
- 🏷️ **Tagging** — projects are tagged with your username

---

## 🏁 Quick Start

### 1️⃣ Install

```bash
brew install node    # if you don't have Node.js / npm
npm install -g @serhii-ciq/dokploy-cli
```

> 💡 No `brew`? Ask your DevOps agent to install it, or grab Node.js from [nodejs.org](https://nodejs.org).

### 2️⃣ Authenticate

```bash
dokploy auth -u https://console.cloud.creatoriq.com -t YOUR_API_KEY
```

> 🔑 **Where to get your API key:**
> Open [console.cloud.creatoriq.com](https://console.cloud.creatoriq.com) → click your avatar → **API Keys** → **Create**

### 3️⃣ Deploy

```bash
dokploy deploy .
```

That's it. Your app is live. 🎉

---

## 📋 Deploy Command Reference

```bash
dokploy deploy [directory] [options]
```

| Flag | Default | Description |
|------|---------|-------------|
| `--name <name>` | directory name | Project and app name |
| `--build-type <type>` | `static` | `static`, `railpack`, or `dockerfile` |
| `--publish-dir <dir>` | `.` | Directory nginx serves (static only) |
| `--port <port>` | `80` | Container port for domain |
| `--spa` | off | SPA mode: nginx fallback to `index.html` |
| `--json` | off | Raw JSON output |
| `--debug` | off | Show full API error responses |

---

## 💡 Examples

### 📄 Static HTML site

```bash
dokploy deploy ./my-site
```

### ⚛️ SPA (React / Vue / Angular)

```bash
dokploy deploy ./dist --spa --name my-spa
```

> 💡 The `--spa` flag tells nginx to serve `index.html` for all routes — so `/about`, `/settings` etc. won't 404 on refresh.

### 🟢 Node.js app

```bash
dokploy deploy . --build-type railpack --port 3000
```

> ⚠️ Make sure your app listens on `process.env.PORT` (defaults to 3000).

### 🔄 Redeploy (update existing app)

```bash
dokploy deploy .
```

Just run the same command again. The CLI reads `.dokploy/config.json` and re-uploads your code.

---

## ⚙️ How It Works

### 🆕 First deploy

```
dokploy deploy . --name my-app
```

1. 👤 Gets your username from the API key
2. 📁 Creates a **project** named `my-app`
3. 🏷️ Tags the project with your username
4. 📦 Creates an **application** inside the project
5. 🔧 Sets the **build type** (static / railpack / dockerfile)
6. 🗜️ Creates a **ZIP** of your directory (excludes `.git`, `node_modules`, `.next`, `.env`)
7. ⬆️ Uploads the ZIP to Dokploy
8. ⏳ Waits for the **build** to complete
9. 🌍 Creates a **domain**: `my-app-xyz123.cloud.creatoriq.com`
10. 💾 Saves config to `.dokploy/config.json`
11. ✅ Prints the URL

### 🔄 Subsequent deploys

1. 📖 Reads `.dokploy/config.json`
2. 🗜️ Creates a new ZIP
3. ⬆️ Uploads and rebuilds
4. ✅ Prints the URL

### 📄 `.dokploy/config.json`

Created automatically. Add `.dokploy/` to your `.gitignore`.

```json
{
  "projectId": "abc123",
  "environmentId": "env456",
  "applicationId": "app789",
  "appName": "my-app-xyz123",
  "buildType": "static",
  "url": "https://my-app-xyz123.cloud.creatoriq.com"
}
```

---

## 🐘 Adding Postgres

### 1️⃣ Create the database

```bash
dokploy postgres create \
  --name my-db \
  --appName my-db \
  --databaseName mydb \
  --databaseUser myuser \
  --databasePassword "$(openssl rand -base64 16)" \
  --dockerImage postgres:18 \
  --environmentId <environmentId from .dokploy/config.json> \
  --description "Postgres for my-app" \
  --json
```

> 📝 Save `postgresId` and `appName` from the response. Dokploy adds a random suffix to `appName` (e.g. `my-db-zr4gky`).

### 2️⃣ Deploy the database

```bash
dokploy postgres deploy --postgresId <postgresId> --json
```

### 3️⃣ Connect your app

```bash
dokploy application save-environment \
  --applicationId <applicationId> \
  --env "PGHOST=my-db-zr4gky
PGPORT=5432
PGDATABASE=mydb
PGUSER=myuser
PGPASSWORD=<password>
DATABASE_URL=postgresql://myuser:<password>@my-db-zr4gky:5432/mydb" \
  --buildArgs '' \
  --buildSecrets '' \
  --createEnvFile \
  --json
```

> 💡 `PGHOST` is the Postgres `appName` (with the suffix). Containers on the same Dokploy network see each other by name.

### 4️⃣ Reload your app

```bash
dokploy application reload \
  --appName <your-app-appName> \
  --applicationId <applicationId> \
  --json
```

---

## 🖥️ UI Console

**URL:** [console.cloud.creatoriq.com](https://console.cloud.creatoriq.com)

What you can do in the UI:

- 📊 View **projects** and their status
- 📜 Read **build logs** and **container logs**
- 🌍 Manage **domains**
- 🔐 Edit **environment variables**
- 🔄 **Restart** or **stop** applications
- 🔑 Create **API keys** for CLI

---

## 🚫 `.dokployignore`

Control which files are excluded from the deploy archive. Create a `.dokployignore` in your project root (`.gitignore` syntax):

```
# don't upload tests and docs
__tests__/
docs/
*.test.ts
coverage/
```

> 💡 No `.dokployignore`? The CLI falls back to `.vercelignore` if it exists.
>
> These patterns are **always** excluded: `.git/`, `node_modules/`, `.dokploy/`, `.next/`, `.env`

---

## ❓ FAQ

**🔴 I get `unauthorized to access resource "project"`**
Your API key doesn't have project creation permissions. Ask ITSD to provision a project for you, or use an existing one.

**📁 Where is my config?**
`.dokploy/config.json` in the directory you deployed from. Add `.dokploy/` to `.gitignore`.

**🔄 How to redeploy?**
Just `dokploy deploy .` again. It reads the saved config and re-uploads.

**📜 How to see build logs?**
In the [UI console](https://console.cloud.creatoriq.com) → your project → your app → Deployments. Or via CLI:

```bash
dokploy deployment all --applicationId <applicationId> --json
```

**🔢 How to check which version I have?**

```bash
dokploy --version
```

**🗑️ How to deploy to a different project?**
Delete `.dokploy/config.json` and run `dokploy deploy .` again — it will create a new project.

---

📖 **Full CLI docs:** [readme.md](https://github.com/serhii-ciq/cli)
🐛 **Issues:** ping `#devops` in Slack
