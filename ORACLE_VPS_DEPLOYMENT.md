# Oracle Cloud VPS Deployment — Server Setup & Summary

## Why Oracle Cloud VPS

This project needs Laravel Reverb (a persistent websocket server) and a queue worker (`QUEUE_CONNECTION=database`) running continuously — not just request/response. Free PaaS tiers (Render, Railway, Fly.io) almost universally exclude persistent background processes, and Laravel Cloud has no permanent free tier. Oracle Cloud's "Always Free" tier is the one option that's genuinely $0/month forever **and** supports everything: Reverb, the queue worker, and even a self-hosted WebRTC TURN server (the app currently only has STUN configured — a known gap for calls off your local network).

**Chosen setup:**
- **Compute**: Oracle "Always Free" VM.Standard.A1.Flex, 2 OCPU / 12GB RAM, Ubuntu 24.04 (ARM64).
- **Single origin**: Laravel serves the built React app itself. Required because Sanctum's cookie-based auth breaks across different hostnames (already documented in this repo's own `PORT_FORWARDING_NOTES.md`) — same-origin sidesteps that entirely.
- **Domain**: a free DuckDNS subdomain — required (not optional) because OAuth providers reject bare-IP redirect URIs, and WebRTC's `getUserMedia` needs a real HTTPS secure context.
- **Database**: Neon's free Postgres tier, kept off the VPS itself — Oracle can flag an idle Always Free instance and reclaim/stop it, so keeping data off-box means a reclaim doesn't risk data.
- **TURN**: self-hosted `coturn` on the same VPS (free, unlike on a restricted PaaS) to fix the STUN-only WebRTC gap.
- **Reverb + queue worker**: systemd services, reverse-proxied through Nginx on the same `:443` origin as the app.

**Known risks to accept going in:**
- Oracle's Ubuntu images ship with iptables rules that block ports *independently* of the OCI console firewall — both layers must be opened or nothing is reachable, even when console rules look correct.
- Oracle can reclaim/stop an Always Free instance it flags as idle.
- This is full self-managed ops: no git-push deploys, no managed TLS/DB/queues — you own all of it.

---

## Prerequisites
- A DuckDNS account + reserved subdomain (e.g. `myapp.duckdns.org`).
- A Neon account with a free Postgres project created (get the pooled connection string).
- Google/Facebook/GitHub OAuth app consoles you can edit (to update redirect URIs later).

---

## Server-Side Setup Checklist

### 1. OCI Console
- [ ] Create Compute instance: shape **VM.Standard.A1.Flex**, 2 OCPU/12GB RAM, image **Ubuntu 24.04 LTS (aarch64)**.
- [ ] Reserve a **Reserved Public IP** and attach it to the instance (not the default ephemeral one).
- [ ] Edit the subnet's Security List / NSG — open ingress:
  - TCP 22 (ideally restricted to your IP)
  - TCP 80, TCP 443
  - TCP + UDP 3478 (coturn control)
  - UDP 49160–49200 (coturn relay range)

### 2. OS-Level Firewall (the double-firewall gotcha)
Oracle's stock Ubuntu image blocks these ports at the OS level regardless of the console rules above:
```bash
sudo iptables -L INPUT -n --line-numbers   # find the line number before the final REJECT/DROP
sudo iptables -I INPUT <N> -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT <N> -p tcp --dport 443 -j ACCEPT
sudo iptables -I INPUT <N> -p tcp --dport 3478 -j ACCEPT
sudo iptables -I INPUT <N> -p udp --dport 3478 -j ACCEPT
sudo iptables -I INPUT <N> -p udp --dport 49160:49200 -j ACCEPT
sudo netfilter-persistent save
```
Must insert *above* the reject/drop rule, not append after it.

### 3. Install Packages
```bash
sudo apt update
sudo apt install nginx php8.3-fpm php8.3-pgsql php8.3-mbstring php8.3-xml \
  php8.3-curl php8.3-zip php8.3-bcmath php8.3-intl php8.3-gd \
  postgresql-client coturn certbot python3-certbot-nginx unzip git
curl -sS https://getcomposer.org/installer | php && sudo mv composer.phar /usr/local/bin/composer
```
Build the frontend in CI, not on this box — keeps Node off the VPS entirely (see Deploy Workflow below).

- [ ] Clone repo to `/var/www/app`.
- [ ] Ensure `www-data` can write `backend/storage` and `backend/bootstrap/cache`.

### 4. DuckDNS + Let's Encrypt
- [ ] Create the DuckDNS subdomain, point it at the reserved public IP.
- [ ] Once Nginx's plain HTTP block exists and port 80 is reachable: `sudo certbot --nginx -d myapp.duckdns.org` (auto-renewal is handled by the installed `certbot.timer`).

### 5. Nginx Config (`/etc/nginx/sites-available/app`)
```nginx
server {
    listen 80;
    server_name myapp.duckdns.org;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name myapp.duckdns.org;
    ssl_certificate     /etc/letsencrypt/live/myapp.duckdns.org/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/myapp.duckdns.org/privkey.pem;

    root /var/www/app/backend/public;
    index index.html index.php;
    client_max_body_size 20m;

    location / {
        try_files $uri $uri/ /index.php?$query_string;
    }

    # Reverb: client websocket connections use /app/{appKey}, server REST API
    # uses /apps/{appId}/... — confirmed against vendor/laravel/reverb source.
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
```

### 6. systemd Services
`/etc/systemd/system/reverb.service`:
```ini
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
```
`/etc/systemd/system/queue-worker.service` — same shape, but:
```
ExecStart=/usr/bin/php artisan queue:work --sleep=3 --tries=3 --max-time=3600
```
`--max-time=3600` makes the worker cycle hourly so `Restart=always` picks up new code — without it, a deploy silently won't take effect for the worker until manually restarted.

- [ ] `sudo nano /etc/default/coturn` → set `TURNSERVER_ENABLED=1` (Ubuntu ships it disabled).
- [ ] `sudo systemctl enable --now reverb queue-worker coturn`

### 7. coturn Config (`/etc/turnserver.conf`)
```
listening-port=3478
min-port=49160
max-port=49200
realm=myapp.duckdns.org
fingerprint
lt-cred-mech
user=turnuser:CHANGE_ME_STRONG_PASSWORD
external-ip=<vps-public-ip>
no-cli
```
If OCI's NIC sees a private IP behind the public one, `external-ip` may need the `<public-ip>/<private-ip>` form — verify with a Trickle ICE / WebRTC TURN test once running.

### 8. OAuth Provider Console Updates
Update redirect URI to `https://myapp.duckdns.org/auth/{provider}/callback` in:
- [ ] **Google Cloud Console** → APIs & Services → Credentials → OAuth client.
- [ ] **GitHub** → Settings → Developer settings → OAuth Apps.
- [ ] **Facebook** → developers.facebook.com → Facebook Login → Settings → Valid OAuth Redirect URIs, **and** add the domain under App Settings → Basic → App Domains. In Development mode, Facebook Login only works for accounts added as testers/admins in the app's Roles.

---

## Repo-Side Changes Needed (before first deploy)

- **`backend/routes/web.php`** — add a catch-all SPA route (after the OAuth routes):
  ```php
  Route::get('/{any}', function () {
      return response()->file(public_path('index.html'));
  })->where('any', '^(?!api|auth|sanctum|broadcasting).*$');
  ```
- **Backend `.env`** — set `APP_URL`/`FRONTEND_URL`/`SANCTUM_STATEFUL_DOMAINS`/`SESSION_DOMAIN` all to the DuckDNS domain, `SESSION_SECURE_COOKIE=true`, `DB_*` to Neon (`DB_SSLMODE=require`), `REVERB_HOST/PORT/SCHEME` to the public domain/443/https, `REVERB_SERVER_HOST/PORT` to `127.0.0.1`/`8080`, and the three OAuth redirect URIs to the new domain.
- **`frontend/.env.production`** — `VITE_API_URL`/`VITE_FRONTEND_URL` = the domain, `VITE_REVERB_*` matching the backend, plus new `VITE_TURN_URL`/`VITE_TURN_USERNAME`/`VITE_TURN_CREDENTIAL`.
- **`frontend/src/features/videoCall/utils.ts`** — make `RTC_CONFIG` include a TURN entry sourced from the new `VITE_TURN_*` env vars, alongside the existing STUN servers.
- **`config/cors.php`** — no code change needed; same-origin requests don't trigger CORS at all once single-origin.
- Vite already builds to `frontend/dist/`; deploy copies `frontend/dist/*` → `backend/public/` (no collision with Laravel's own gitignored `public/build` scaffold).

---

## Deploy Workflow
Recommended: GitHub Actions SSH-deploy (get it working manually once first):
1. CI: checkout → `npm ci && npm run build` in `frontend/` → `rsync`/`scp` the repo (excluding `node_modules`, `vendor`) plus `frontend/dist/*` to `/var/www/app` via an SSH deploy key stored as a repo secret.
2. Remote deploy script:
   ```bash
   cd /var/www/app/backend
   composer install --no-dev --optimize-autoloader
   cp -r /var/www/app/frontend/dist/* public/
   php artisan migrate --force
   php artisan config:cache && php artisan route:cache
   sudo systemctl restart reverb queue-worker php8.3-fpm
   ```
3. `.env` lives on the server only — never synced from CI.

---

## Verification Checklist
- [ ] Deep-link directly to `/dashboard` in a fresh tab — confirms the catch-all route.
- [ ] Register, log out, log back in — confirms CSRF cookie + session domain/secure settings.
- [ ] Test Google, Facebook, and GitHub login end-to-end.
- [ ] DevTools → Network → WS: websocket connects to `wss://<domain>/app/<key>`; send a message between two sessions to confirm real-time delivery.
- [ ] `systemctl status queue-worker` after a deploy — confirm it's on fresh code, not stale.
- [ ] Video call between two devices on **different networks** (not just LAN) to confirm actual TURN relay.
- [ ] `sudo certbot renew --dry-run` — confirm auto-renewal works.
