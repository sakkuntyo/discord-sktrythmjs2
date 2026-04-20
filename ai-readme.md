# AI README

This document is a deployment/runbook for setting up this bot on a fresh Ubuntu
server using nvm, npm, and PM2.

## Ubuntu Deployment

These commands assume you are running as `root`. If you are not root, prefix the
`apt` commands with `sudo`.

### 1. Install OS Dependencies

```bash
apt update
apt install -y curl git build-essential python3 make g++ pkg-config ffmpeg
```

### 2. Install nvm and Node.js 20

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && . "$NVM_DIR/bash_completion"

nvm install 20
nvm use 20
nvm alias default 20

node -v
npm -v
```

Node.js must be `v20.18.1` or newer.

### 3. Clone the Repository

```bash
cd ~
git clone https://github.com/sakkuntyo/discord-sktrythmjs2.git
cd discord-sktrythmjs2
```

If the repository already exists:

```bash
cd ~/discord-sktrythmjs2
git pull
```

### 4. Configure Environment Variables

```bash
cp .env.example .env
nano .env
```

Required values:

```env
TOKEN=Discord Bot Token
CLIENT_ID=Discord Application Client ID
```

### 5. Install npm Dependencies

```bash
cd ~/discord-sktrythmjs2
rm -rf node_modules
YOUTUBE_DL_SKIP_PYTHON_CHECK=1 npm ci
```

If `@discordjs/opus` fails with `make not found`, install the build tools again:

```bash
apt update
apt install -y build-essential python3 make g++ pkg-config
```

Then retry:

```bash
rm -rf node_modules
YOUTUBE_DL_SKIP_PYTHON_CHECK=1 npm ci
```

### 6. Build

```bash
npm run compile
```

### 7. Manual Start Test

```bash
node build/main.js
```

Successful startup logs:

```text
Started refreshing application (/) commands.
Successfully reloaded application (/) commands.
```

Stop the manual process with `Ctrl+C` before starting PM2.

### 8. Run with PM2

```bash
npm install -g pm2

cd ~/discord-sktrythmjs2
pm2 delete discord-sktrythmjs2 2>/dev/null || true
pm2 start build/main.js --name discord-sktrythmjs2
pm2 logs discord-sktrythmjs2
```

### 9. Check for Duplicate Bot Processes

Do not run `node build/main.js` manually at the same time as PM2. Duplicate
bot processes can cause Discord `Unknown interaction` errors.

```bash
pm2 status
ps aux | grep 'node build/main.js' | grep -v grep
```

If multiple processes are running, reset PM2 and start only one process:

```bash
pm2 stop all
pm2 delete all

cd ~/discord-sktrythmjs2
pm2 start build/main.js --name discord-sktrythmjs2
```

### 10. Enable Startup After Reboot

```bash
pm2 save
pm2 startup
```

Run the command printed by `pm2 startup`. For root, it is usually similar to:

```bash
env PATH=$PATH:/root/.nvm/versions/node/$(node -v)/bin pm2 startup systemd -u root --hp /root
pm2 save
```

If that command does not work, use the exact command printed by `pm2 startup`.

## Updating the Deployment

```bash
cd ~/discord-sktrythmjs2
git pull
YOUTUBE_DL_SKIP_PYTHON_CHECK=1 npm ci
npm run compile
pm2 restart discord-sktrythmjs2
pm2 logs discord-sktrythmjs2
```

## Useful PM2 Commands

```bash
pm2 status
pm2 logs discord-sktrythmjs2
pm2 restart discord-sktrythmjs2
pm2 stop discord-sktrythmjs2
pm2 delete discord-sktrythmjs2
```

## Troubleshooting

Show recent logs:

```bash
cd ~/discord-sktrythmjs2
cat bot.err.log 2>/dev/null || true
pm2 logs discord-sktrythmjs2 --lines 100
```

If Discord reports `Unknown interaction`, check for duplicate bot processes:

```bash
pm2 status
ps aux | grep 'node build/main.js' | grep -v grep
```

If `npm run compile` fails with `tsc: not found`, `npm ci` did not finish
successfully. Fix the `npm ci` error first, then run:

```bash
npm run compile
```
