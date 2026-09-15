# Google Cloud Deployment — Feasibility, Setup & Problems to Expect

## Is it possible?

Yes, with one important constraint: **it has to be a self-managed Compute Engine VM, not Cloud Run.** This app needs two long-running processes that stay alive continuously — Laravel **Reverb** (the websocket server for messaging) and a **queue worker** (`QUEUE_CONNECTION=database`) — neither of which fits Cloud Run's request-driven, scale-to-zero model. An open websocket connection keeps a Cloud Run instance "active" and billed, so Reverb can't run there within any free allowance once real users connect. The path is a normal VM: **Compute Engine `e2-micro`** (the Always Free instance type), running Nginx + PHP-FPM + Reverb + the queue worker as systemd services.

WebRTC's TURN relay is handled by **ExpressTURN's free hosted tier** (~1000GB/month) rather than self-hosting `coturn` on the VM — self-hosting would have competed with everything else for this box's own scarce 1GB RAM and, worse, its 1GB/month free egress allowance (a single video call can relay 100–200MB+, so a handful of calls would blow through the VM's entire monthly egress on their own). Offloading TURN to an external provider removes that pressure entirely and drops a firewall surface + systemd service from the box.

**Cloud SQL has no permanent free tier at all** (only a 30-day trial), so the database still needs to be an external managed free tier like Neon, regardless of where compute runs.

---

## Same Domain, Different Ports — How This Actually Works

Frontend and backend are served from **one domain** (`https://myapp.duckdns.org`), and from the browser's point of view everything cookie-relevant — the SPA itself, `/api/*` calls, `/sanctum/csrf-cookie`, `/broadcasting/auth` — goes over the **same single public port, 443**. This is what avoids the cookie/CSRF breakage documented in this repo's own `PORT_FORWARDING_NOTES.md` (different *hostnames* break Sanctum's cookie auth; same domain sidesteps it entirely, regardless of port).

Underneath that one public port, a couple of distinct processes run on different internal ports/sockets — neither reachable directly from the internet except through Nginx:

| Component | Where it actually listens | Publicly reachable? |
|---|---|---|
| Nginx | `:80` (redirects to 443), `:443` (TLS) | Yes — the only web-facing ports this VM exposes |
| Static SPA build (`index.html`, JS/CSS) | served directly by Nginx from `backend/public` | Via 443 only |
| Laravel API (PHP-FPM) | local Unix socket `/run/php/php8.3-fpm.sock` | No — Nginx proxies to it internally |
| Reverb (websocket server) | `127.0.0.1:8080` (`REVERB_SERVER_HOST`/`REVERB_SERVER_PORT`) | No — Nginx reverse-proxies `/app/*` and `/apps/*` to it over the same 443 |
| TURN relay (ExpressTURN) | `turn:free.expressturn.com:3478` | Yes, but **off-box entirely** — this VM doesn't run or expose any TURN service at all |

So "same domain, different ports" is accurate as the *internal* picture (Reverb on 8080, the PHP-FPM socket) — but the browser only ever talks to port 443 on this VM for anything involving cookies or session auth. TURN traffic never touches this VM at all now that it's hosted by ExpressTURN, and was never at risk of the cross-origin cookie problem anyway (it authenticates with its own long-term username/credential, unrelated to Sanctum).

---

## Problems / Things to Watch Out For

1. **The public IP is not actually free.** Since Feb 1, 2024, Google Cloud charges **$0.005/hour (~$3.65–4/month)** for any in-use external IPv4 address attached to a VM — static or ephemeral, no exceptions. Since OAuth callbacks require real inbound IPv4 reachability, this cost is unavoidable for this app. Budget for it as a fixed monthly cost even on the "free" tier.

2. **The free egress allowance is tiny — 1 GB/month.** With TURN relay now offloaded to ExpressTURN, this VM's own egress is mostly just serving the SPA's JS bundle to visitors and Reverb's websocket signaling traffic (small, text-based) — much more likely to actually fit within 1GB than before, but still worth watching as the app grows.

3. **RAM is tight.** The Always Free `e2-micro` has only **1GB memory** (2 shared/burstable vCPUs) — running Nginx, PHP-FPM, Reverb, and the queue worker simultaneously is still snug even without coturn in the mix. Mitigations: keep PHP-FPM's `pm.max_children` low, add a swap file, and monitor memory usage under load.

4. **Region lock-in for the free instance.** The Always Free `e2-micro` is only free in `us-west1`, `us-central1`, or `us-east1`. If most users aren't in North America, they'll see higher latency — this doesn't block eligibility, just affects performance.

5. **Only one free VM, and it's genuinely small.** There's no free equivalent to a larger always-on box — if the app outgrows `e2-micro`, the next tier is paid immediately (no partial/prorated free allowance).

6. **Cloud Run's free tier is a trap for this specific app.** It looks appealing (generous free request/compute allowance) but doesn't help here because of the websocket-keeps-instance-billed behavior above — don't be tempted to move just Reverb there expecting it to stay free.

7. **The "Ubuntu LTS" image you get today is 26.04 ("Resolute Raccoon"), not 24.04.** This isn't cosmetic — Ubuntu 26.04 defaults to **PHP 8.5**, not 8.3, so `php8.3-fpm` isn't in its default apt repos at all. Installing PHP 8.3 requires adding Ondřej Surý's third-party repo (`packages.sury.org`) first — skipping this step is exactly what causes `apt install php8.3-fpm` to fail with "unable to locate package."

8. **ExpressTURN's free tier has its own cap (~1000GB/month).** Much larger than the VM's own 1GB, but not unlimited — worth checking ExpressTURN's dashboard periodically if call volume grows, since that traffic is invisible to GCP billing/monitoring (it never touches this VM or this GCP project).

9. **No managed anything.** Same as any self-managed VM: you own PHP-FPM/Nginx setup, TLS renewal, process supervision, OS patching, and your own deploy flow — there's no git-push deploy magic on Compute Engine.

---

## Required Setup

### 1. Domain
A free DuckDNS subdomain (e.g. `myapp.duckdns.org`) pointed at the VM's static IP — required because OAuth providers (Google/Facebook/GitHub) reject bare-IP redirect URIs, and WebRTC's `getUserMedia` needs a real HTTPS secure context.

### 2. Compute Engine
- [ ] Create instance: machine type **e2-micro**, region **us-central1** (or us-west1/us-east1 to stay in the free tier), image **Ubuntu 26.04 LTS (Resolute Raccoon)** — this is what a generic "Ubuntu LTS" selection actually provisions today.
- [ ] Reserve a static external IP and assign it to the VM (accept the ~$3.65–4/mo charge — see Problems #1).
- [ ] Point the DuckDNS subdomain at this IP.

### 3. VPC Firewall Rules
Create ingress rules (tagged to the instance), since GCP denies all inbound by default:
- TCP 22 (ideally source-restricted to your IP)
- TCP 80, TCP 443

(No TURN-related ports needed here — ExpressTURN is off-box, so this VM doesn't need 3478 or a relay port range open at all.)

### 4. OS Packages (Ubuntu 26.04 — needs the Sury repo for PHP 8.3)
Ubuntu 26.04's default repos only ship PHP 8.5; add Ondřej Surý's repo first to get PHP 8.3. This is the current method per `packages.sury.org/php/README.txt` directly (a keyring package + `signed-by`, not a raw key dropped into `trusted.gpg.d` with no `signed-by` — that older pattern is deprecated and throws GPG warnings; re-verify against the README before running, since these steps have changed before):
```bash
sudo apt update
sudo apt install -y ca-certificates curl lsb-release gnupg
curl -sSLo /tmp/debsuryorg-archive-keyring.deb https://packages.sury.org/debsuryorg-archive-keyring.deb
sudo dpkg -i /tmp/debsuryorg-archive-keyring.deb
echo "deb [signed-by=/usr/share/keyrings/debsuryorg-archive-keyring.gpg] https://packages.sury.org/php/ $(lsb_release -sc) main" | sudo tee /etc/apt/sources.list.d/php.list
sudo apt update
```
Then install PHP 8.3 alongside Ubuntu's default 8.5 — **including `php8.3-cli`**, which `php8.3-fpm` does not pull in as a dependency (they're separate Debian packages); without it there's no `/usr/bin/php8.3` binary to run `artisan` commands or for `update-alternatives` to point at:
```bash
sudo apt install nginx php8.3-fpm php8.3-cli php8.3-pgsql php8.3-mbstring php8.3-xml \
  php8.3-curl php8.3-zip php8.3-bcmath php8.3-intl php8.3-gd \
  postgresql-client certbot python3-certbot-nginx unzip git
curl -sS https://getcomposer.org/installer | php && sudo mv composer.phar /usr/local/bin/composer
```
With both 8.3 and 8.5 now installed, `/usr/bin/php` is just an `update-alternatives` symlink — nothing guarantees it resolves to 8.3. The systemd units in §7 and the deploy script in §12 both invoke the bare `php` command, so set it explicitly and confirm:
```bash
sudo update-alternatives --set php /usr/bin/php8.3
php -v   # must report 8.3 — if it still shows 8.5, the alternative wasn't set correctly
```
Build the frontend in CI, not on this box — the 1GB-RAM instance shouldn't also run a Node build.

- [ ] Add a swap file (given the tight 1GB RAM — see Problems #3), e.g. a 2GB swapfile.
- [ ] Clone repo to `/var/www/app`; ensure `www-data` can write `backend/storage` and `backend/bootstrap/cache`.

### 5. Let's Encrypt
```bash
sudo certbot --nginx -d myapp.duckdns.org
```
(after Nginx's plain HTTP block exists and port 80 is reachable; auto-renewal via the installed `certbot.timer`).

### 6. Nginx Config (`/etc/nginx/sites-available/app`)
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
    # uses /apps/{appId}/...
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

### 7. systemd Services
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
`/etc/systemd/system/queue-worker.service` — same shape, `ExecStart=/usr/bin/php artisan queue:work --sleep=3 --tries=3 --max-time=3600` (the `--max-time` makes it cycle hourly so `Restart=always` picks up new code after a deploy).

- [ ] `sudo systemctl enable --now reverb queue-worker`

### 8. ExpressTURN Setup (replaces self-hosted coturn)
- [ ] Sign up at expressturn.com and create a free TURN credential set from their dashboard.
- [ ] Note the TURN URL (e.g. `turn:relay1.expressturn.com:3478`), username, and credential — these go into the frontend env, not the server (see §10 below). No install/config on the VM at all.
- [ ] Periodically check ExpressTURN's dashboard for usage against the ~1000GB/month free cap (Problems #8) — this traffic doesn't show up in GCP billing or monitoring since it never touches this VM or project.

### 9. Database (Neon)
Since Cloud SQL has no permanent free tier, use Neon's free Postgres tier regardless — same as any other deployment target. `DB_SSLMODE=require`.

**Use the direct/unpooled connection string (hostname without `-pooler`), not the pooled one — including for runtime, not just migrations.** Neon's pooled endpoint routes through PgBouncer in transaction-pooling mode, which doesn't support the session-level behavior schema migrations rely on; running `php artisan migrate` against the pooled host is a known way to hit `SQLSTATE[25P02]: current transaction is aborted` — Postgres aborts the whole migration transaction on an earlier statement and then reports the failure on whatever the next statement happens to be (e.g. a later `unique` constraint), which is misleading if you don't already know the pooled connection is the actual cause. Since this app runs on a single VM with a small, fixed PHP-FPM worker pool rather than a serverless/edge workload, there's little benefit to pooling here anyway — just use the unpooled connection everywhere and skip this class of bug entirely.

### 10. Repo-Side Changes Needed
- **`backend/routes/web.php`** — add a catch-all SPA route (after the existing OAuth routes):
  ```php
  Route::get('/{any}', function () {
      return response()->file(public_path('index.html'));
  })->where('any', '^(?!api|auth|sanctum|broadcasting).*$');
  ```
- **Backend `.env`** — `APP_URL`/`FRONTEND_URL`/`SANCTUM_STATEFUL_DOMAINS`/`SESSION_DOMAIN` all set to the DuckDNS domain, `SESSION_SECURE_COOKIE=true`, `DB_*` pointing at Neon, `REVERB_HOST/PORT/SCHEME` = domain/443/https, `REVERB_SERVER_HOST/PORT` = `127.0.0.1`/`8080`, OAuth redirect URIs updated to the new domain.
- **`frontend/.env.production`** — `VITE_API_URL`/`VITE_FRONTEND_URL` = the domain, `VITE_REVERB_*` matching the backend, plus `VITE_TURN_URL`/`VITE_TURN_USERNAME`/`VITE_TURN_CREDENTIAL` sourced from **ExpressTURN's dashboard** (not a self-hosted server).
- **`frontend/src/features/videoCall/utils.ts`** — add a TURN entry to `RTC_CONFIG` sourced from the new `VITE_TURN_*` env vars, alongside the existing STUN-only config.
- Vite builds to `frontend/dist/`; deploy copies `frontend/dist/*` → `backend/public/`.

### 11. OAuth Provider Console Updates
Update redirect URI to `https://myapp.duckdns.org/auth/{provider}/callback` in the Google Cloud Console (Credentials), GitHub OAuth App settings, and Facebook Login settings (also add the domain under App Domains; Development-mode apps only work for accounts added as testers/admins).

### 12. Deploy Workflow
GitHub Actions SSH-deploy recommended (validate manually once first):
1. CI: `npm ci && npm run build` in `frontend/` → `rsync`/`scp` the repo (excluding `node_modules`, `vendor`) plus `frontend/dist/*` to `/var/www/app` via an SSH deploy key.
2. Remote script: `composer install --no-dev --optimize-autoloader`, copy `dist/*` into `public/`, `php artisan migrate --force`, `config:cache`/`route:cache`, `systemctl restart reverb queue-worker php8.3-fpm`.
3. `.env` lives on the server only.

---

## Verification Checklist
- [ ] Deep-link directly to `/dashboard` in a fresh tab — confirms the catch-all route.
- [ ] Register, log out, log back in — confirms CSRF cookie + session domain/secure settings.
- [ ] Test Google, Facebook, and GitHub login end-to-end.
- [ ] DevTools → Network → WS: websocket connects to `wss://<domain>/app/<key>`; confirm real-time message delivery between two sessions.
- [ ] `systemctl status queue-worker` after a deploy — confirm it's on fresh code.
- [ ] Video call between two devices on different networks — confirms actual TURN relay via ExpressTURN (check their dashboard for bandwidth used, separate from this VM's own 1GB GCP egress allowance).
- [ ] `sudo certbot renew --dry-run`.
- [ ] Check GCP Billing after the first week to see actual IP + egress costs against the estimate in Problems #1–2.
