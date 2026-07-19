# WordPress.org Plugin Audit Skill

A reusable checklist for auditing a WordPress plugin against the
[WordPress.org Plugin Directory Guidelines](https://developer.wordpress.org/plugins/wordpress-org/detailed-plugin-guidelines/)
**before** submitting (or resubmitting) to the wp.org repository. Derived from
real reviewer feedback. Work top to bottom; each section has a *what reviewers
look for*, a *how to find it in the code*, and a *how to fix it*.

> wp.org is **not a marketplace**. It hosts free, fully-functional, GPL-compliant
> plugins. Any audit must assume the reviewer will read the **entire** codebase,
> not just the spots you point them to. Fixing only the flagged lines and
> resubmitting is the fastest way to a rejection — "if more issues of the same
> nature are found, this plugin will not be reviewed again."

---

## How to use this skill

1. Identify the plugin tree(s) to audit (the **distributed** tree — the one that
   ships to wp.org — not a premium source tree it's generated from).
2. Run each section's grep/search commands against that tree.
3. For every hit, decide: compliant, needs fix, or needs removal.
4. Re-run after fixing; reviewers re-scan the whole plugin.
5. Produce a findings list with file:line references and a remediation per item.

---

## 1. 🔴 Trialware & locked features (Guideline 5)

**The rule:** plugins must be **fully functional**. You may not lock, disable,
or limit any built-in feature behind a license key, trial period, time limit,
usage quota, or *any other intended restriction* — even if the locked code is
present "just in case the user upgrades."

A plugin **may** mention that more features exist in a *separate* plugin hosted
elsewhere. It may **not** ship the gated code with a switch holding it shut.

### Ask yourself
- Does any function only work after a license check or payment?
- Is any functionality disabled or limited until it's "unlocked"?
- Are there time-based or usage-based limits?

If yes to any (after excluding genuine external-service features — see §2), it
does not comply.

### How to find it
Search the **shipping** tree for gates and dead-code hides:

```sh
# License / premium gates
grep -rniE "is_premium|is_pro|license|pro_only|premium_only|unlock|upgrade|trial|activate_license" --include=*.php .

# Hard-disabled UI: feature registered but link/branch hidden
grep -rnE "if \(\s*false\s*\)|if\(false\)|return; *// *premium|0 *&& *|/\* *premium" --include=*.php .

# Registered handlers whose UI is suppressed (the classic tell):
# a hook/handler that exists but the menu/button/link to it is behind if(false)
grep -rniE "admin_post_|add_submenu_page|add_menu_page|register_rest_route" --include=*.php .
```

**The classic violation pattern:** a handler like
`admin_post_<plugin>_<feature>` is fully registered, but the UI link that
triggers it is wrapped in `if (false)` — and the feature is *described in the
readme as available*. The reviewer sees: documented feature, working backend,
deliberately hidden trigger = trialware.

### How to fix
- **Remove** all license checks / gating mechanisms that control access to
  built-in code.
- **Either fully enable** the feature (delete the `if (false)`, expose the UI) —
  **or remove the feature entirely** from the shipped plugin (handler, UI,
  assets, *and* its mention in the readme). Don't leave orphaned backend code.
- If it's a genuine premium feature, it lives in a **separate** plugin hosted
  off wp.org — not shipped here behind a flag.
- Reconcile the **readme**: it must not advertise anything the shipped plugin
  can't actually do.

> Note for generated/freemium builds: if the wp.org tree is produced by a build
> script from a premium source tree, the gate-stripping must happen in the
> **build output**. Audit the generated tree, not the source. A leaked
> `if(false)`-hidden handler in the generated lite plugin is a build-script bug.

---

## 2. 🌐 Serviceware — external services (Guideline 6)

An external service is acceptable **only if all** of these hold:

- The service performs **actual processing on external servers**.
- That functionality **cannot reasonably be done locally** by the plugin.
- The service is **clearly documented in the readme**, including links to its
  **Terms of Use** and **Privacy Policy**.

A "spam checker" that calls an external API to classify spam is fine. A service
that merely **checks a license key to unlock local features is not** — that's
trialware (§1) wearing a service costume.

### How to find it
```sh
# Outbound calls
grep -rniE "wp_remote_(get|post|request)|curl_|file_get_contents\(\s*['\"]https?:" --include=*.php .

# Hardcoded endpoints / domains
grep -rniE "https?://[a-z0-9.-]+" --include=*.php .
```

For each external endpoint, classify:
- **Real processing** (geocoding, email delivery, SMS, spam scoring, AI) → likely OK, must be documented.
- **License/entitlement check** → not OK; remove (see §1).
- **Telemetry/phone-home** → must be opt-in and documented.

### How to fix
- Document every legitimate service in the readme: what it does, what data is
  sent, and **working** Terms + Privacy links.
- Remove any "service" whose only job is gating local features.

---

## 3. 🔗 readme URLs must resolve (no 404s)

Reviewers **fetch the URLs** declared in your plugin and readme. A Terms/Privacy
(or any declared) URL returning **404** (or any non-200, or a non-public page)
is a rejection item.

> Common pattern: a `Terms/Privacy URL` in `readme.txt` points at a docs page
> that returns **404**. The link must point to a live, public page.

### How to find it
```sh
# Collect every URL in the readme and plugin headers
grep -rnoE "https?://[^ )\"'<>]+" readme.txt README.md *.php 2>/dev/null | sort -u

# Then verify each resolves (200, public):
while read -r url; do
  code=$(curl -s -o /dev/null -w "%{http_code}" -L "$url")
  echo "$code  $url"
done < <(grep -rhoE "https?://[^ )\"'<>]+" readme.txt *.php 2>/dev/null | sort -u)
```

Pay special attention to:
- `Plugin URI` / `Author URI` in the main file header.
- Terms of Use / Privacy Policy links for every external service.
- "Donate link", support, and docs URLs in `readme.txt`.

### How to fix
- Replace dead URLs with live, public ones that actually describe the service.
- If you don't control the linked page, link to one you do (or to the service's
  official, current Terms/Privacy page).
- Remove URLs you can't keep live.

---

## 4. 📛 Plugin name & slug — distinctiveness + trademarks

This is one of the most common pend reasons and is judged by a human, so treat
it seriously. Reviewers run the display **name** and the **slug** through search
and an AI trademark check.

> Common pattern: a display name / slug that matches a third-party
> project/trademark **and** is too generic (doesn't describe what the plugin
> does) gets flagged. The usual fix is to add an owner-distinctive (often coined
> or brand) term up front, e.g. `<Brand> <Function> <Topic>` /
> `<brand>-<function>-<topic>`.

### The rules
- **Not too generic** — the name should briefly say what the plugin does, *or* be
  an original coined term. Bare descriptors like "Contact Manager" or
  "<Topic> Form" alone are too generic.
- **Distinctive** — must stand out from existing plugins. Adding a letter or a
  generic adjective (*Advanced*, *Simple*, *Easy*, *Pro*) does **not** make it
  distinctive. Lookalike names, similar meanings, and naming *patterns* all count
  as "similar", not just letter-by-letter matches.
- **Respect trademarks / project names** you don't own:
  - Trademark **at the start** of the name implies affiliation → not allowed.
  - Trademark elsewhere without a clear "no affiliation" structure → still risky.
  - **No portmanteaus / blends** of a trademark (e.g. "PricesPress" blends
    "WordPress").
  - Safer pattern: put the trademark **at the end** after "for" or "with", and
    lead with *your own* distinctive/coined term —
    e.g. ✅ `Priconix Sync for WooCommerce`, ✅ `<YourBrand> Prices Updater for WooCommerce`.
    Note "for X" alone is usually **too generic** unless prefixed with a coined term.

### How to self-check
1. Search the proposed name (and parts of it) on Google/DuckDuckGo/an LLM.
2. If similar plugins exist, prepend a coined term / personal brand / unique
   identifier and search again. Repeat until it clearly stands out.
3. Also check trademark usage in: **your wp.org username & display name**, the
   **contributor** usernames/display names, the **plugin/author URLs**, and the
   **icon/banner graphics** — not just the plugin name.

### How to fix (and the slug workflow)
1. Update the display name in **both** `readme.txt` and the **plugin header**.
2. Update the slug / text domain in the code (i18n calls, text domain header).
3. **Reply to the review email explicitly requesting the new slug reservation** —
   changing it in code is *not* enough; the team must reserve it server-side.
   Permalinks **cannot** be changed after approval, so decide carefully now.
4. Re-upload via "Add your plugin". A transient Text-Domain warning before they
   reserve the slug is expected.

> Ownership note: if you built the plugin for a client as a freelancer, the
> **client must own** the wp.org listing (permission isn't enough); they add you
> as a committer. Mismatched owner email/username gets flagged.

---

## 5. Broader compliance sweep (do this every time)

Reviewers warn that the AI highlights only the *most apparent* issues — you're
expected to read the whole codebase. Cover these common rejection causes too.

### 5a. Sanitization, escaping, nonces & permissions
```sh
grep -rnE "\$_(GET|POST|REQUEST|SERVER|COOKIE)\b" --include=*.php .   # must be sanitized + unslashed
grep -rnE "echo |printf|print " --include=*.php .                     # output must be escaped
grep -rniE "wp_verify_nonce|check_admin_referer|check_ajax_referer|current_user_can" --include=*.php .
```
- All input via `$_GET/$_POST/$_REQUEST` sanitized with the right `sanitize_*`
  **and** `wp_unslash()` before use.
- All output escaped at the point of output with the most restrictive function
  that fits: `esc_url()` (URLs), `esc_attr()` (attributes), `esc_html()` (text),
  `wp_kses()/wp_kses_post()` (intentional HTML). Escape as late as possible.
- Every **state-changing** action (forms, AJAX `wp_ajax_*`, `admin_post_*`, REST
  writes) verifies a **nonce** *and* checks `current_user_can()` when the action
  is role-restricted. When in doubt, check both.

### 5b. REST API `permission_callback`
Every `register_rest_route()` / `wp_register_ability()` **must** declare a
`permission_callback` — omitting it is a hard fail.
```sh
grep -rnA4 "register_rest_route\|wp_register_ability" --include=*.php . | grep -niE "permission_callback|register_rest_route"
```
- Sensitive/data-changing routes → real check, e.g.
  `'permission_callback' => fn() => current_user_can( 'manage_options' )`.
- Genuinely public routes → **`__return_true`** *deliberately* (not omitted), so
  the reviewer can see the public access is intentional.
- A public POST/webhook endpoint (`'permission_callback' => '__return_true'` on a
  write route) gets scrutinized — make sure it's nonce/secret/signature-guarded
  in the callback itself and document why it must be public.

### 5c. Enqueue JS/CSS — no raw `<script>`/`<style>`
Inline `<script>`/`<style>` tags and raw `<link>`s get flagged; use the enqueue
API for performance and compatibility.
```sh
grep -rnE "<script|<style|<link[^>]+stylesheet" --include=*.php . --include=*.html
```
- Static JS → `wp_register_script()` + `wp_enqueue_script()` (on `wp_enqueue_scripts`
  for front-end, `admin_enqueue_scripts` for admin).
- Inline JS → `wp_add_inline_script()`. Inline CSS → `wp_add_inline_style()`.
- Static CSS → `wp_register_style()` + `wp_enqueue_style()`.
- Pass `defer`/`async` via the script-attributes API (WP 6.3+), not hand-written tags.

### 5d. No remotely-loaded static assets
Images, JS, CSS, and fonts must ship **inside** the plugin, not be hot-linked
from your server, a CDN, or Google/jQuery/etc. (This is separate from §2
serviceware — it's about *static files*, not processing APIs.)
```sh
grep -rnE "(src|href)\s*=\s*['\"]https?://" --include=*.js --include=*.css --include=*.php .
grep -rnE "https?://[^ '\"]+\.(js|css|png|jpe?g|gif|svg|woff2?|ttf)" --include=*.* .
```
- Download and bundle the file locally; reference with `plugins_url()`.
- Allowed exceptions: Google-hosted/approved-CDN web fonts (if GPL-compatible),
  genuine service/oEmbed/API calls (document per §2). A hot-linked logo or icon
  image from a third-party CDN is **not** an exception — bundle it.

### 5e. Database access
```sh
grep -rniE "\$wpdb->(query|get_|prepare)" --include=*.php .
```
- Every dynamic query uses `$wpdb->prepare()`. No string-interpolated SQL.

### 5f. Direct file access guard
```sh
grep -rLE "defined\(\s*'ABSPATH'\s*\)|defined\(\s*\"ABSPATH\"" --include=*.php .  # files MISSING the guard
```
- Every PHP file should bail if `ABSPATH` is undefined (`if (!defined('ABSPATH')) exit;`).

### 5g. Prefixing / collision safety
A prefix must be **≥4 chars**, distinct/unique to the plugin (not a common word),
underscore- or dash-separated.
```sh
grep -rnE "^function |^class |define\(|register_post_type\(|add_shortcode\(|add_action\(\s*['\"]wp_ajax_" --include=*.php .
```
- Functions, classes, constants, **globals**, options/transients/post-meta keys,
  hooks, CPT slugs, shortcodes, script handles all carry the prefix. Generic
  names (`class Settings`, `function init`, `update_option('options', …)`) collide.
- Caution: if the plugin was renamed, runtime identifiers — option keys,
  transients, AJAX actions, nonces, REST namespace, CPT slug — may be kept
  **deliberately stable** so existing installs don't lose data. Don't "fix"
  those to match a new class-name prefix without a migration plan.

### 5h. No bundled / obfuscated / external code
- No minified-only JS/CSS without source, no `eval`, no remotely-loaded executable
  code, no compiled binaries without source. GPL-compatible licenses only (the
  four freedoms: run, study/modify, redistribute, distribute modified).

### 5i. Text domain & i18n
- Text domain matches the **wp.org-assigned slug** exactly, and every user-facing
  string is wrapped in a translation function with that domain.
```sh
grep -rnoE "__\(|_e\(|esc_html__\(|esc_attr__\(" --include=*.php . | head
grep -rnE "Text Domain:" --include=*.php .
```

### 5j. User tracking & consent (Guidelines 7 & 9)
- No tracking of users/site data without **explicit opt-in** consent. Analytics,
  telemetry, and phone-home must be off by default and documented.

### 5k. Admin-dashboard hijacking & upgrade nags (Guideline 11)
- Upgrade prompts, admin notices, and alerts must be **limited in scope and used
  with moderation** — no persistent, dashboard-wide, or undismissible nags.
```sh
grep -rniE "admin_notices|add_action\(\s*['\"]admin_notices|upgrade|go pro|premium" --include=*.php .
```

### 5l. readme `Contributors` & ownership
- The `Contributors:` line in `readme.txt` is a case-sensitive, comma-separated
  list of **real wp.org usernames** (not display names, not emails). Add the
  author's wp.org username; a username that doesn't exist gets flagged.
- The submitting account / owner email should match the actual plugin owner
  (see the freelance/ownership note in §4).

---

## 6. Deliverable: the audit report

Produce a findings list the maintainer can act on:

```
## Plugin Audit — <plugin> <version>  (<date>)

### 🔴 Blocking (will cause rejection)
- [Trialware] <file>:<line> — <what's gated and how>. Fix: <enable | remove + delist from readme>.
- [Name/Trademark] <name>/<slug> — <conflict/generic>. Fix: <new name>; request slug reservation.
- [REST] <file>:<line> — route missing permission_callback. Fix: add callback / __return_true.
- [Remote asset] <file>:<line> — hot-links <url>. Fix: bundle locally.
- [readme URL] <url> — returns <code>. Fix: <replacement>.
- [Undocumented service] <endpoint> — not in readme External services. Fix: document + ToS/Privacy links.

### 🟠 Should fix
- [Enqueue] <file>:<line> — raw <script>/<style>. Fix: wp_enqueue_*/wp_add_inline_*.
- [Escaping] <file>:<line> — unescaped output. Fix: wrap in esc_html().
- [Nonce] <file>:<line> — state-change without nonce/cap check. Fix: verify nonce + current_user_can.
- [Prefix] <file>:<line> — unprefixed <name>. Fix: prefix it.
- [Contributors] readme.txt — missing/invalid wp.org username. Fix: add real username.

### 🟢 Notes / intentional
- <file>:<line> — phpcs:ignore is intentional because <rationale>.
- <identifier> — runtime id kept stable across rename (migration risk); not a prefix bug.
```

For each blocking item, re-verify after the fix and confirm the readme matches
the shipped functionality. Then re-run §§1–5 across the whole tree before
resubmitting — partial fixes get the plugin permanently shelved.

---

## Quick-start one-liner sweep

```sh
# Run from the root of the SHIPPING plugin tree
echo "== gates ==";        grep -rniE "is_premium|is_pro|license|unlock|trial|if \(\s*false\s*\)" --include=*.php .
echo "== services ==";     grep -rniE "wp_remote_|curl_|https?://" --include=*.php .
echo "== remote assets =="; grep -rnE "(src|href)\s*=\s*['\"]https?://" --include=*.js --include=*.css --include=*.php .
echo "== raw script/style =="; grep -rnE "<script|<style" --include=*.php .
echo "== rest perms ==";    grep -rnA4 "register_rest_route" --include=*.php .
echo "== unescaped in ==";  grep -rnE "\$_(GET|POST|REQUEST)\b" --include=*.php .
echo "== nonces ==";       grep -rniE "wp_verify_nonce|check_admin_referer|check_ajax_referer|current_user_can" --include=*.php .
echo "== sql ==";          grep -rniE "\$wpdb->(query|get_)" --include=*.php .
echo "== abspath guard missing =="; grep -rLE "defined\(\s*'ABSPATH'" --include=*.php .
echo "== admin nags ==";   grep -rniE "admin_notices|go pro|upgrade" --include=*.php .
echo "== readme urls ==";  grep -rhoE "https?://[^ )\"'<>]+" readme.txt *.php 2>/dev/null | sort -u
```
