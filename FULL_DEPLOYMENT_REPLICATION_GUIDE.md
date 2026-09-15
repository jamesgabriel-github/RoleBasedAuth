# Full Deployment Replication Guide — Laravel + React, Split-Origin, GCP

A step-by-step guide to replicate this deployment from scratch: Laravel backend + Reverb on port `8000`, React frontend on the default HTTPS port `443`, Neon Postgres, and ExpressTURN for WebRTC — all under one domain.

## Final Architecture

| Component | Where it lives | Publicly reachable at |
|---|---|---|
| Frontend (React/Vite build) | `/var/www/app/frontend-dist`, served by Nginx | `https://yourdomain.duckdns.org` (no port — default 443) |
| Backend (Laravel API) | `/var/www/app/backend/public`, via PHP-FPM socket | `https://yourdomain.duckdns.org:8000` |
| Reverb (websocket server) | `127.0.0.1:8080`, proxied by Nginx | `wss://yourdomain.duckdns.org:8000/app/{key}` |
| Queue worker | Background systemd process | Not network-facing |
| Database | Neon Postgres (external, free tier) | Direct (non-pooled) connection only |
| TURN relay | ExpressTURN (external, free tier) | Referenced only in frontend env — nothing runs on this VM |

**Why split by port instead of one single origin:** this setup deliberately mirrors local dev, where frontend and backend run on different ports. Browsers scope cookies by scheme + hostname only (port is excluded from "site" for SameSite purposes), so a session cookie set for the bare domain works across both ports. The trade-off is that :443 and :8000 count as different *origins* for CORS, so CORS config and explicit `credentials: include` are required in a way a true single-origin setup wouldn't need.

---

## Part 1: GCP Infrastructure

**1. Create the VM.** Compute Engine → Create Instance:
- Machine type: `e2-micro` (Always Free tier)
- Region: `us-central1`, `us-west1`, or `us-east1` — these are the only free-tier-eligible regions
- Boot image: pin the version explicitly (e.g. Ubuntu 24.04 LTS) rather than picking a generic "Ubuntu LTS" option — a generic selection can silently provision whatever the *newest* LTS is at the time, which may not match what your project targets.

**2. Reserve and attach a static external IP.** Note: since February 2024, Google charges roughly $0.005/hour (~$3.65–4/month) for any in-use external IPv4 address, static or ephemeral — this is unavoidable for a publicly reachable VM, budget for it.

**3. Configure VPC firewall rules** (GCP denies all inbound by default):
```bash
gcloud compute instances add-tags VM_NAME --zone=ZONE --tags=http-server,https-server

gcloud compute firewall-rules create allow-http \
  --network=default --allow=tcp:80 \
  --source-ranges=0.0.0.0/0 --target-tags=http-server

gcloud compute firewall-rules create allow-https \
  --network=default --allow=tcp:443 \
  --source-ranges=0.0.0.0/0 --target-tags=https-server

gcloud compute firewall-rules create allow-backend \
  --network=default --allow=tcp:8000 \
  --source-ranges=0.0.0.0/0 --target-tags=https-server
```
Verify with `gcloud compute firewall-rules list`. SSH (port 22) is typically already covered by GCP's auto-created `default-allow-ssh` rule.

**4. Point a domain at the static IP.** A free DuckDNS subdomain works fine (`yourdomain.duckdns.org`) — needed because OAuth providers reject bare-IP redirect URIs, and WebRTC's `getUserMedia` requires a real HTTPS secure context. Verify propagation before continuing:
```bash
nslookup yourdomain.duckdns.org
```

---

## Part 2: OS & PHP Setup

**1. Confirm what OS actually got provisioned** — don't assume the console selection matches reality:
```bash
lsb_release -a
```

**2. If the target PHP version isn't in the OS's default repos**, add Ondřej Surý's repo (`packages.sury.org`), which tracks PHP versions across Ubuntu/Debian releases more aggressively than the OS defaults or the older `ppa:ondrej/php` Launchpad PPA (which can lag behind very new Ubuntu releases):
```bash
sudo apt update
sudo apt install -y lsb-release ca-certificates curl
curl -sSLo /tmp/debsuryorg-archive-keyring.deb https://packages.sury.org/debsuryorg-archive-keyring.deb
sudo dpkg -i /tmp/debsuryorg-archive-keyring.deb
sudo tee /etc/apt/sources.list.d/php.sources <<EOF
Types: deb
URIs: https://packages.sury.org/php/
Suites: $(lsb_release -sc)
Components: main
Signed-By: /usr/share/keyrings/debsuryorg-archive-keyring.gpg
EOF
sudo apt update
```

**3. Install PHP and everything else needed**, substituting your actual target PHP version for `8.3`:
```bash
sudo apt install -y nginx php8.3-fpm php8.3-cli php8.3-pgsql php8.3-mbstring php8.3-xml \
  php8.3-curl php8.3-zip php8.3-bcmath php8.3-intl php8.3-gd \
  postgresql-client certbot python3-certbot-nginx unzip git
```
(`php8.3-cli` is technically pulled in automatically as a hard dependency of `php8.3-fpm` — listed explicitly for clarity.)

**4. If multiple PHP versions are now installed side by side**, point the CLI at the one you want explicitly:
```bash
sudo update-alternatives --set php /usr/bin/php8.3
php -v   # confirm it reports the right version
```

**5. Install Composer:**
```bash
curl -sS https://getcomposer.org/installer | php
sudo mv composer.phar /usr/local/bin/composer
```

**6. Add a swap file** — `e2-micro` only has ~1GB RAM:
```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

---

## Part 3: TLS Certificate

Issue the certificate manually via the webroot method rather than letting certbot auto-edit an Nginx vhost — this setup needs custom multi-port server blocks that the auto-config plugin doesn't understand:
```bash
sudo certbot certonly --webroot -w /var/www/html -d yourdomain.duckdns.org
```
Verify:
```bash
sudo certbot certificates
```
Auto-renewal is handled by the `certbot.timer` systemd unit, installed automatically with certbot.

---

## Part 4: Nginx — Three Server Blocks

Create a home for the frontend build first:
```bash
sudo mkdir -p /var/www/app/frontend-dist
sudo chown $USER:www-data /var/www/app/frontend-dist
```

**Frontend config** (`/etc/nginx/sites-available/frontend`) — served on the default HTTPS port, with a plain-HTTP block that redirects to HTTPS except for the ACME challenge path (which must stay reachable on port 80 for future certificate renewals):
```bash
sudo tee /etc/nginx/sites-available/frontend > /dev/null <<'EOF'
server {
    listen 80;
    server_name yourdomain.duckdns.org;

    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

server {
    listen 443 ssl;
    server_name yourdomain.duckdns.org;

    ssl_certificate     /etc/letsencrypt/live/yourdomain.duckdns.org/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.duckdns.org/privkey.pem;

    root /var/www/app/frontend-dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~ /\.(?!well-known).* {
        deny all;
    }
}
EOF
```
Using a **quoted** heredoc (`<<'EOF'`) here matters — it stops bash from trying to substitute `$host` and `$request_uri` as shell variables before Nginx ever sees the file.

**Backend config** (`/etc/nginx/sites-available/backend`):
```bash
sudo tee /etc/nginx/sites-available/backend > /dev/null <<'EOF'
server {
    listen 8000 ssl;
    server_name yourdomain.duckdns.org;

    ssl_certificate     /etc/letsencrypt/live/yourdomain.duckdns.org/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.duckdns.org/privkey.pem;

    root /var/www/app/backend/public;
    index index.php;
    client_max_body_size 20m;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    # Reverb: client websocket connections use /app/{appKey}, server REST API uses /apps/{appId}/...
    location ~ ^/(app|apps)/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 60s;
    }

    location ~ \.php$ {
        include snippets/fastcgi-php.conf;
        fastcgi_pass unix:/run/php/php8.3-fpm.sock;
        fastcgi_param HTTPS on;
    }

    location ~ /\.(?!well-known).* { deny all; }
}
EOF
```

**Enable both and test before reloading:**
```bash
sudo ln -s /etc/nginx/sites-available/frontend /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/backend /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

**Verify nothing broke certificate renewal**, since the frontend config added a domain-specific block on port 80 where only the generic default site existed before:
```bash
sudo certbot renew --dry-run
```

---

## Part 5: Backend Deployment

**1. Clone the repo:**
```bash
sudo mkdir -p /var/www/app
sudo chown $USER:$USER /var/www/app
git clone <your-repo-url> /var/www/app
cd /var/www/app/backend
```

**2. Install PHP dependencies.** If `composer.lock` was generated on a newer PHP version than the server has, `composer install` will refuse with "please run composer update" — re-resolve against the actual server PHP version instead:
```bash
COMPOSER_MEMORY_LIMIT=-1 composer update --no-dev --optimize-autoloader
```
Commit the regenerated `composer.lock` back to the repo afterward so this doesn't resurface on the next deploy. Consider pinning the target PHP version in `composer.json` to prevent recurrence:
```json
"config": {
    "platform": { "php": "8.3.33" }
}
```

**3. Fix storage/cache permissions** so Nginx/PHP-FPM (`www-data`) can write to them:
```bash
sudo chown -R $USER:www-data storage bootstrap/cache
sudo chmod -R 775 storage bootstrap/cache
```

**4. Do not add a catch-all SPA route to `routes/web.php`.** With frontend and backend on separate origins, Nginx's `try_files ... /index.html` on the frontend block already handles SPA fallback routing — a Laravel-side catch-all is unnecessary and will actively break things if it tries to serve a file (`index.html`) that only exists in the frontend's own directory, not the backend's.

---

## Part 6: Database (Neon Postgres)

**1. Create a free-tier Neon project**, ideally in a region close to your VM (e.g. AWS US East (Ohio) for a `us-central1` GCP VM).

**2. Use the direct (non-pooled) connection string, not the `-pooler` one.** The pooled connection can cause Laravel migrations to fail mid-transaction with `SQLSTATE[25P02]: current transaction is aborted` — PgBouncer's transaction-pooling mode doesn't play well with some session-level behavior Laravel's schema builder relies on. At low traffic with a small number of long-lived processes (Reverb, one queue worker), the direct connection's limits are nowhere close to being a concern.

**3. Break the connection string into `.env` fields** (see Part 7 below) rather than using a single `DATABASE_URL`.

**4. Migrate:**
```bash
php artisan key:generate
php artisan migrate --force
```

---

## Part 7: Laravel Reverb Configuration

This is the part most likely to trip up a first-time setup, since two *different* things are both called "REVERB_PORT"-ish in different places.

### Backend `.env`
```
APP_URL=https://yourdomain.duckdns.org:8000
FRONTEND_URL=https://yourdomain.duckdns.org

SANCTUM_STATEFUL_DOMAINS=yourdomain.duckdns.org
SESSION_DOMAIN=yourdomain.duckdns.org
SESSION_SECURE_COOKIE=true

DB_CONNECTION=pgsql
DB_HOST=<neon direct host, no -pooler suffix>
DB_PORT=5432
DB_DATABASE=<neon database name>
DB_USERNAME=<neon username>
DB_PASSWORD=<neon password>
DB_SSLMODE=require

REVERB_HOST=yourdomain.duckdns.org
REVERB_PORT=8000
REVERB_SCHEME=https
REVERB_SERVER_HOST=127.0.0.1
REVERB_SERVER_PORT=8080
REVERB_APP_ID=<generate fresh — see below>
REVERB_APP_KEY=<generate fresh — see below>
REVERB_APP_SECRET=<generate fresh — see below>

GOOGLE_REDIRECT_URI=https://yourdomain.duckdns.org:8000/auth/google/callback
FACEBOOK_REDIRECT_URI=https://yourdomain.duckdns.org:8000/auth/facebook/callback
GITHUB_REDIRECT_URI=https://yourdomain.duckdns.org:8000/auth/github/callback
```

**The critical distinction:**
- `REVERB_SERVER_HOST` / `REVERB_SERVER_PORT` — where the actual Reverb process binds and listens (`127.0.0.1:8080`, unreachable from outside the VM).
- `REVERB_HOST` / `REVERB_PORT` / `REVERB_SCHEME` — the address the *frontend* uses to know where to open the websocket connection. Nginx's backend block (Part 4) is what bridges the two, proxying `/app/*` and `/apps/*` on the public `:8000` through to Reverb's internal `127.0.0.1:8080`.

**Generate fresh app credentials** — don't reuse local dev values, since `REVERB_APP_SECRET` is a real secret used to sign private-channel authentication:
```bash
echo "REVERB_APP_ID=$(openssl rand -hex 10)"
echo "REVERB_APP_KEY=$(openssl rand -hex 20)"
echo "REVERB_APP_SECRET=$(openssl rand -hex 20)"
```

**CORS** (`config/cors.php`) — if your project pulls `allowed_origins` from `FRONTEND_URL` dynamically, no separate edit is needed here at all:
```php
'paths' => ['api/*', 'sanctum/csrf-cookie', 'broadcasting/auth'],
'allowed_origins' => [env('FRONTEND_URL', 'http://localhost:5173')],
'supports_credentials' => true,
```

### systemd services
```bash
sudo tee /etc/systemd/system/reverb.service > /dev/null <<'EOF'
[Unit]
Description=Laravel Reverb
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/app/backend
ExecStart=/usr/bin/php artisan reverb:start
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

sudo tee /etc/systemd/system/queue-worker.service > /dev/null <<'EOF'
[Unit]
Description=Laravel Queue Worker
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/app/backend
ExecStart=/usr/bin/php artisan queue:work --sleep=3 --tries=3 --max-time=3600
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now reverb queue-worker
sudo systemctl status reverb queue-worker
```
The queue worker's `--max-time=3600` makes it exit cleanly once an hour; combined with `Restart=always`, it picks up new code after a deploy without manual intervention.

### Frontend Echo configuration — the `wsPort` / `wssPort` trap
Laravel Echo treats plain (`ws://`) and secure (`wss://`) connections as **separate settings**. If only `wsPort` is set and `forceTLS` evaluates to `true`, Echo silently falls back to its own default of port 443 for the secure connection, ignoring `wsPort` entirely — this shows up as a websocket URL with *no port at all* in DevTools (since 443 is the implicit default for `wss://`). Always set both explicitly:
```typescript
echoInstance = new Echo({
    broadcaster: 'reverb',
    key: import.meta.env.VITE_REVERB_APP_KEY,
    wsHost: import.meta.env.VITE_REVERB_HOST,
    wsPort: Number(import.meta.env.VITE_REVERB_PORT ?? 8080),
    wssPort: Number(import.meta.env.VITE_REVERB_PORT ?? 8080),
    forceTLS: import.meta.env.VITE_REVERB_SCHEME === 'https',
    enabledTransports: ['ws', 'wss'],
    authorizer: (channel) => ({
      authorize(socketId, callback) {
        apiClient
          .post('/broadcasting/auth', { socket_id: socketId, channel_name: channel.name })
          .then(({ data }) => callback(null, data))
          .catch((error) => callback(error, null))
      },
    }),
})
```

---

## Part 8: Frontend Deployment

**`frontend/.env.production`:**
```
VITE_API_URL=https://yourdomain.duckdns.org:8000
VITE_FRONTEND_URL=https://yourdomain.duckdns.org
VITE_REVERB_HOST=yourdomain.duckdns.org
VITE_REVERB_PORT=8000
VITE_REVERB_SCHEME=https
VITE_REVERB_APP_KEY=<must match REVERB_APP_KEY in the backend .env exactly>
VITE_TURN_URL=turn:relay1.expressturn.com:3478
VITE_TURN_USERNAME=<from ExpressTURN dashboard>
VITE_TURN_CREDENTIAL=<from ExpressTURN dashboard>
```

**Build locally (not on the VM — 1GB RAM won't enjoy a Vite build alongside everything else running):**
```powershell
npm ci
npm run build
Compress-Archive -Path dist\* -DestinationPath dist.zip
```
Use `dist\*`, not `dist` — zipping the folder itself (rather than its contents) creates a nested `dist/` folder inside the archive, which breaks Nginx's `root`-relative file resolution (shows up as a 403, not a 404).

**Upload via the SSH browser terminal's gear icon → Upload file**, then on the VM:
```bash
unzip -o ~/dist.zip -d ~/dist-upload
sudo rm -rf /var/www/app/frontend-dist/*
sudo cp -r ~/dist-upload/dist/* /var/www/app/frontend-dist/
sudo chown -R www-data:www-data /var/www/app/frontend-dist
```

**Verify the build actually contains what you think it does** before assuming a bug is server-side:
```powershell
Select-String -Path dist\assets\*.js -Pattern "yourdomain.duckdns.org"
```
Vite substitutes `import.meta.env.VITE_X` references with literal values *at build time* — if this comes back empty, the wrong env file was used or a variable name doesn't match what the code expects, and no amount of server-side debugging will fix it.

---

## Part 9: ExpressTURN Configuration

**1. Sign up at expressturn.com** and create a free TURN credential set from the dashboard (~1000GB/month free). Note the assigned relay hostname, username, and credential — nothing installs on the VM.

**2. Wire the credentials into `RTC_CONFIG`** (wherever your WebRTC config lives, e.g. `frontend/src/features/videoCall/utils.ts`), keeping existing STUN servers as the first attempt:
```typescript
export const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
    {
      urls: [
        import.meta.env.VITE_TURN_URL,
        'turns:relay1.expressturn.com:443?transport=tcp',
      ],
      username: import.meta.env.VITE_TURN_USERNAME,
      credential: import.meta.env.VITE_TURN_CREDENTIAL,
    },
  ],
}
```
The second URL is a TLS-over-443 fallback for networks that block plain UDP/TCP on 3478 but allow anything resembling ordinary HTTPS traffic.

**3. Rebuild and redeploy the frontend** (Part 8).

**4. Prove TURN is actually being used, not just configured** — same-network testing can succeed via direct P2P or STUN alone without ever touching TURN, giving false confidence:
- Temporarily set `iceTransportPolicy: 'relay'` in `RTC_CONFIG` to force every connection through TURN.
- Test between two devices on genuinely different networks (e.g. home wifi + mobile data).
- Open `chrome://webrtc-internals` during the call and confirm the selected candidate pair is type `relay` — with relay-only forced, this is the only way the call could have connected at all.
- Check the ExpressTURN dashboard afterward for non-zero bandwidth logged against your credentials.
- **Revert `iceTransportPolicy` back to `'all'`** (or remove it) once confirmed — relay-only forces every future call through TURN unnecessarily, burning the free bandwidth allowance even when a direct connection would have worked.

---

## Part 10: OAuth Provider Configuration

Update the redirect URI to `https://yourdomain.duckdns.org:8000/auth/{provider}/callback` in each of the following:

- **Google Cloud Console** → Credentials → your OAuth Client → Authorized redirect URIs. Supports multiple entries — local dev URIs can stay alongside production.
- **GitHub** → Settings → Developer settings → OAuth Apps → Authorization callback URL. **Only supports one URL at a time** — switching to production breaks local GitHub login unless a separate dev-only OAuth App is created with its own client ID/secret.
- **Facebook** → Meta for Developers → Facebook Login → Settings → Valid OAuth Redirect URIs (multiple allowed), plus **App Domains** under Settings → Basic (just the bare domain, no protocol or port). If the app is still in Development mode, login only works for accounts explicitly added under App Roles → Testers/Developers/Admins.

---

## Part 11: Full Verification Checklist

**Infrastructure**
- `gcloud compute firewall-rules list` — confirm 22, 80, 443, 8000 all present
- `nslookup yourdomain.duckdns.org` — confirms DNS resolves correctly

**TLS & Nginx**
- `sudo nginx -t` before every reload
- `sudo certbot certificates` and `sudo certbot renew --dry-run`
- `curl -Ik https://yourdomain.duckdns.org` → expect `200`
- `curl -Ik http://yourdomain.duckdns.org` → expect `301` redirect to HTTPS
- `curl -Ik https://yourdomain.duckdns.org:8000` → expect `404` (correct for an API-only origin with no route at `/`) — a `500`/`502` means something's actually broken

**Backend**
- `php -v` and `sudo -u www-data php -v` — confirm both resolve to the same intended PHP version
- `php artisan migrate:status`
- `tail -n 50 storage/logs/laravel.log` for real errors (a `SQLSTATE[25P02]` means look *earlier* in the same transaction for the actual failing statement)

**Services**
- `sudo systemctl status reverb queue-worker` — both `active (running)`
- Reverb's startup log line should read `Starting server on 127.0.0.1:8080` — if it shows `0.0.0.0:8080`, `REVERB_SERVER_HOST` wasn't picked up (check `.env`, then `config:clear && config:cache`, then `systemctl restart reverb`)
- `sudo journalctl -u reverb -n 50 --no-pager` / `-u queue-worker` for anything not obviously running

**Frontend Build**
- `Select-String -Path dist\assets\*.js -Pattern "yourdomain.duckdns.org"` before uploading

**Browser End-to-End**
1. Load the bare domain — no console errors
2. DevTools → Network → Fetch/XHR — API calls hit `:8000`, not `localhost`
3. DevTools → Network → WS — connects to `wss://yourdomain.duckdns.org:8000/app/<key>`, and `<key>` matches `REVERB_APP_KEY`
4. Register → log out → log back in (confirms CSRF + session cookie config)
5. Test all OAuth providers end to end
6. Two sessions, two users, real-time message delivery (confirms Reverb + queue worker)
7. A video call between two devices on different networks, with `iceTransportPolicy: 'relay'` temporarily forced (confirms TURN)

---

## Recurring Gotchas Worth Remembering

- **`.env` changes require re-caching**: `php artisan config:clear && php artisan config:cache`, or Laravel keeps serving stale values silently.
- **Long-running processes don't pick up config changes on their own**: after any `.env`/code change relevant to Reverb or the queue worker, `sudo systemctl restart reverb queue-worker` — cache-clearing alone isn't enough for a process that already started.
- **Frontend env values are baked in at build time**: any change requires a full rebuild + re-upload; there's no live-reload equivalent in production.
- **GCP's "Ubuntu LTS" image selection can drift** to whatever the newest release is — always verify with `lsb_release -a` rather than trusting the console label.
- **A public external IP on GCP is not free** since February 2024 — budget for it as a fixed monthly cost regardless of "Always Free" instance eligibility.
- **Composer lock files are PHP-version-sensitive**: a lock file resolved on a newer PHP will refuse to install on an older one; `composer update` re-resolves against whatever PHP is actually present.
- **Neon's pooled connection and Laravel migrations don't always mix well**: use the direct connection string unless you have a specific reason to need pooling.
- **Zip a folder's contents, not the folder itself**, or the archive gains a nested directory level that breaks path-relative serving.
