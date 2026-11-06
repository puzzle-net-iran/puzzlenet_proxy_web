# PuzzleNet Proxy — Telegram WEB Proxy on Cloudflare Workers

> A private Telegram proxy that runs on Cloudflare's free tier. One file, one setting, no server to rent or maintain.

<p align="center">
  <a href="https://github.com/puzzle-net-iran/puzzlenet_proxy_web/stargazers"><img src="https://img.shields.io/github/stars/puzzle-net-iran/puzzlenet_proxy_web?style=for-the-badge&color=gold" alt="GitHub Stars"></a>
  <a href="https://workers.cloudflare.com/"><img src="https://img.shields.io/badge/Cloudflare-Workers-F38020?style=for-the-badge&logo=cloudflare&logoColor=white" alt="Cloudflare Workers"></a>
  <a href="https://desktop.telegram.org/"><img src="https://img.shields.io/badge/Telegram-WEB%20Proxy-2CA5E0?style=for-the-badge&logo=telegram&logoColor=white" alt="Telegram WEB Proxy"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge" alt="License MIT"></a>
</p>

<p align="center">
  <a href="README.md"><b>English</b></a> •
  <a href="README.fa.md"><b>فارسی</b></a> •
  <a href="README.ru.md"><b>Русский</b></a> •
  <a href="README.zh.md"><b>简体中文</b></a> •
  <a href="llms.txt"><b>llms.txt</b></a>
</p>

---

## What this is

Telegram added a new proxy type called **WEB**. Unlike the classic MTProto proxy, it travels as ordinary HTTPS traffic, so it can run behind Cloudflare.

PuzzleNet Proxy turns a free Cloudflare Worker into that kind of proxy.

**In plain terms:** Cloudflare is a huge network that a large part of the web runs through, so blocking it outright is costly for a censor. Your Worker is a small program running inside that network. Telegram talks to your Worker, and your Worker passes the traffic on to Telegram's servers.

- **It looks like a website.** Anyone who opens your address in a browser sees an ordinary online store.
- **It cannot read your messages.** Telegram encrypts traffic between your app and its servers. The proxy only carries those encrypted bytes.
- **It costs nothing to run.** The Worker runs on Cloudflare's free plan. The only optional cost is a domain name, which usually costs a few dollars a year.

---

## Before you start

You need:

1. **A Cloudflare account.** It's free. Sign up at [dash.cloudflare.com](https://dash.cloudflare.com/).
2. **A domain name (strongly recommended).** The default `workers.dev` address is filtered in some countries, including Iran, and may not open on every port. Any cheap domain added to Cloudflare will do.
3. **A Telegram app that offers the WEB proxy type.** Telegram Desktop already has it. Mobile apps get it through app updates.

---

## Setup — five steps

### Step 1 — Create the Worker

1. Open the [Cloudflare Dashboard](https://dash.cloudflare.com/).
2. Go to **Workers & Pages** → **Create application** → **Create Worker**.
3. Give it any name (for example `puzzlenet-proxy`) and click **Deploy**.

### Step 2 — Paste the code

1. On the Worker's page, click **Edit code**.
2. Delete everything in the editor and paste the full contents of [`worker.js`](worker.js).
3. Click **Deploy**.

### Step 3 — Set your admin key (the only required setting)

1. Open your Worker's address in a browser. You will see a **setup page** that suggests a random key. Copy it.
2. In the dashboard, open your Worker → **Settings** → **Variables and Secrets** → **Add**:
   - **Name:** `ADMIN_KEY`
   - **Value:** the key you copied (or any password of at least 16 English letters and digits)
3. Click **Deploy**.

> [!IMPORTANT]
> Treat `ADMIN_KEY` like a password. Anyone who has it can open your panel and see your proxy secret.

### Step 4 — Connect your domain

1. Add your domain to Cloudflare. Cloudflare will show you two nameservers. Set those nameservers at the company you bought the domain from.
2. In your Worker, go to **Settings** → **Domains & Routes** → **Add** → **Custom Domain**.
3. Enter a subdomain, for example `tg.yourdomain.com`. Cloudflare sets up the certificate and DNS automatically.

### Step 5 — Open your panel and connect

Go to:

```text
https://tg.yourdomain.com/YOUR_ADMIN_KEY
```

The panel shows two ways to connect:

- **One tap:** a **Connect in Telegram** button for each of the six ports. On a phone or desktop with Telegram installed, tapping it adds the proxy straight away.
- **Manual entry:** the **server**, and the corresponding **port** and **secret** pair shown in the panel table:

| Field | Value |
|---|---|
| Server | `tg.yourdomain.com` |
| Port | any one of `443` · `2053` · `2083` · `2087` · `2096` · `8443` |
| Secret | the specific secret shown for that port in the panel table |

Where to enter them in Telegram:

- **Desktop:** Settings → Advanced → Connection type → Use custom proxy → Add proxy → **WEB**
- **Mobile:** Settings → Data and Storage → Proxy → Add Proxy → **WEB** (once your app version offers it)

**Done.** To share the proxy, send people **the links or the connection values (server, port, and that port's secret)**. Never send the panel address.

---

## Ports

All six Cloudflare HTTPS ports work without any extra setting:

`443` · `2053` · `2083` · `2087` · `2096` · `8443`

Each port has its own unique secret (derived deterministically from your setup) to keep connections isolated. If one port is slow or blocked, switch to another port and use its matching secret from the panel. You can add the proxy multiple times with different ports and switch between them in Telegram anytime.

---

## Settings reference

Only `ADMIN_KEY` is required. Everything else is optional.

| Variable | Purpose |
|---|---|
| `ADMIN_KEY` | **Required.** Password for your panel. Your proxy secrets are derived from it. |
| `SECRET` | A fixed 32-character hex secret for port 443 (and the base for other ports). Set this if you want to change `ADMIN_KEY` later without breaking links you already shared. |
| `EXTRA_HOSTS` | Other domains attached to this Worker, separated by commas. The panel generates links for them too. |
| `DECOY_URL` | A real website to show visitors instead of the built-in store page. Using one makes your proxy harder to tell apart from other deployments. |
| `CARRIER` | Leave it empty. Set it to `websocket` only if the default mode gives you trouble. |

> [!WARNING]
> If `SECRET` is not set, changing `ADMIN_KEY` also changes the secrets, and **every link you have shared stops working.**

---

## Under heavy censorship

Try these in order:

1. **Switch ports.** Use another port from the list above.
2. **Use a different domain.** If one domain is blocked, attach another one to the same Worker and add it to `EXTRA_HOSTS`.
3. **Use a clean Cloudflare IP (desktop only).** If the IPs your domain normally resolves to are blocked, point your domain at a Cloudflare IP that still works on your network. Add one line to your `hosts` file:
   - Windows: `C:\Windows\System32\drivers\etc\hosts`
   - macOS / Linux: `/etc/hosts`

   ```text
   CLEAN_IP   tg.yourdomain.com
   ```

   Replace `CLEAN_IP` with a Cloudflare IP that works on your network. Clean IPs vary by ISP and stop working over time, so test them yourself.
4. **Turn off ECH where it is blocked (for example Russia).** In Cloudflare, open your domain → **SSL/TLS** → **Edge Certificates** → **Encrypted Client Hello (ECH)** → **Off**.

> [!NOTE]
> No proxy works during a **complete** shutdown of international internet access. Cloudflare's servers are outside the country, so once the border is closed, nothing on Cloudflare can be reached. These measures help while access is filtered or partially restricted, not after it is fully cut.

---

## Troubleshooting

| What you see | What to do |
|---|---|
| The address shows an online store | Normal. The proxy works behind it. To open the panel, add `/YOUR_ADMIN_KEY` to the address. |
| The panel address shows the store | The key in the address doesn't match `ADMIN_KEY`, or you didn't click **Deploy** after setting it. |
| The setup page appears again | `ADMIN_KEY` is missing or shorter than 16 characters. |
| Telegram shows "connecting" forever | Try another port. Then try another domain. On `workers.dev`, connect a custom domain instead. |
| Links you shared stopped working | `ADMIN_KEY` was changed while `SECRET` was not set. Send out the new links from the panel. |

---

## FAQ

<details>
<summary><b>Which Telegram apps work?</b></summary>
Any Telegram app that offers the <b>WEB</b> proxy type. Telegram Desktop already does. Android and iOS apps support it once the option arrives in their updates.
</details>

<details>
<summary><b>How many people can use one proxy?</b></summary>
It is built for you and a small circle. Cloudflare's free plan allows 100,000 requests per day per account. For more people, it is better for each group to deploy its own Worker. That spreads the load, and a single leaked link doesn't take everyone down.
</details>

<details>
<summary><b>Can Cloudflare or the proxy read my messages?</b></summary>
No. Telegram encrypts traffic between your app and its servers. The proxy only forwards those encrypted bytes and cannot decrypt them.
</details>

<details>
<summary><b>Can I add a sponsored channel (ad tag)?</b></summary>
No. Sponsored channels require a server with a fixed outgoing port. Cloudflare's network changes outgoing ports, so this is not possible on Workers. The proxy connects straight to Telegram's servers, with no ads.
</details>

---

## Disclaimer

This project is provided for educational purposes and personal use. Running proxy services on Cloudflare Workers may conflict with Cloudflare's Terms of Service (Section 2.2.1(j)). You are responsible for how you use it.

---

## Support

PuzzleNet Proxy is free and open source, by [PuzzleNet](https://puzzlenet-group.ir). Star the repository to support its development:

