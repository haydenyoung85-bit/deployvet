// Wires the static site to the DeployVet Supabase edge functions. No build step, no dependencies.
(function () {
  const C = window.DEPLOYVET_CONFIG || {};
  const configured = C.SUPABASE_URL && !/YOUR-PROJECT-REF/.test(C.SUPABASE_URL) && C.SUPABASE_ANON_KEY && !/YOUR-SUPABASE/.test(C.SUPABASE_ANON_KEY);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  async function call(fn, body, method = "POST", query = "") {
    if (!configured) throw new Error("DeployVet is not switched on yet. Please try again soon.");
    const res = await fetch(`${C.SUPABASE_URL}/functions/v1/${fn}${query}`, {
      method,
      headers: { "content-type": "application/json", apikey: C.SUPABASE_ANON_KEY, authorization: `Bearer ${C.SUPABASE_ANON_KEY}` },
      body: method === "POST" ? JSON.stringify(body || {}) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) { const e = new Error(data.error || `Something went wrong (${res.status}). Please try again.`); e.status = res.status; e.data = data; throw e; }
    data._status = res.status;
    return data;
  }
  // Friendly text for scoreboard errors. 400 messages from the server are already plain and specific.
  const friendly = (e) => {
    if (e.status === 429) return "Whoa, slow down. Too many tries from your network today. Come back tomorrow.";
    if (e.status === 502) return "We couldn't scan your site just now. Is it up? Try again in a minute.";
    if (e.status === 404) return "That site isn't on the scoreboard, so there's nothing to remove.";
    if (e.status === 403) return "We can't see your token yet. DNS can take a few minutes. Check it's there, then try again.";
    if (e.status === 405 || e.status >= 500) return "Our side tripped. Please try again in a bit.";
    if (e.status) return e.message;
    return "Couldn't reach DeployVet. Check your connection and try again.";
  };
  window.DeployVet = { call, esc, friendly };

  const busy = (btn, on, label) => { if (!btn) return; if (on) { btn.dataset.l = btn.innerHTML; btn.disabled = true; btn.textContent = label; } else { btn.disabled = false; btn.innerHTML = btn.dataset.l || btn.innerHTML; } };
  const msg = (el, text, kind) => { if (!el) return; el.hidden = false; el.className = "notice " + (kind || ""); el.innerHTML = text; };

  // ---- Free roast ----
  // Roast lines: [headline, subline] per spice level and grade band. Roast the APP, never the person. No crude stuff.
  // ---- Roast copy ----
  // Voice: lowercase, deadpan, internet-native. Built from the REAL scan data (c = ctx below).
  // Roast the app and the AI-builder habits. Never the person's identity, looks or smarts. No puns.
  // c = { host, path, score, total, crit, high, title, worst }
  const S = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
  const ROASTS = {
    mild: {
      A: [(c) => [`ok ${c.host} actually ate.`, `${c.score}/100. we came here to roast and found nothing. kind of rude of you.`],
          (c) => [`not ${c.host} being secure.`, `we looked everywhere. the app just stared back. respect, unfortunately.`],
          (c) => [`the way ${c.host} gave us nothing.`, `${c.score}/100. our roast writers are bored. that's a compliment.`]],
      B: [(c) => [`${c.host} is so close it hurts.`, `${c.score}/100. one loose thread. pull it before someone else does.`],
          (c) => [`giving "almost done".`, `${c.host} did the homework and skipped the last page.`],
          (c) => [`${c.score}/100, the "one small thing" score.`, `${c.host} is mostly locked. mostly.`]],
      C: [(c) => [`${c.host} is giving mid.`, `${c.score}/100. some doors locked, some doors vibes.`],
          (c) => [`it's the "it works on my preview" for me.`, `${c.host} works. it's just not locked. ${S(c.total, "thing")} to fix.`],
          (c) => [`${c.host} said "ship now, patch later".`, `later is here. the list is short, at least.`]],
      D: [(c) => [`${c.host} trusts strangers a little too much.`, `${c.score}/100. sweet, but no.`],
          (c) => [`the AI was confident. the code was not.`, `${S(c.total, "finding")} on ${c.host}. fixable, promise.`],
          (c) => [`${c.host} left the welcome mat out.`, `and the data's sitting right next to it.`]],
      F: [(c) => [`${c.host} is open for business. all of it.`, `${c.score}/100. good news: you checked before someone else did.`],
          (c) => [`the vibes were coded. the locks were not.`, `${S(c.total, "finding")} on ${c.host}. start with the worst one below.`],
          (c) => [`${c.host} is sharing more than a group chat at 2am.`, `${c.score}/100. totally fixable. go.`]],
    },
    spicy: {
      A: [(c) => [`${c.score}/100?? be so for real.`, `${c.host} is locked down and honestly we're upset about it. nothing to roast. go touch grass.`],
          (c) => [`not ${c.host} actually reading the docs.`, `this is not how "the AI handled auth" usually ends. who raised this app.`],
          (c) => [`nobody: \n${c.host}: "i have security headers"`, `${c.score}/100. insufferable. we love it.`]],
      B: [(c) => [`${c.host} was SO close.`, `${c.score}/100. one issue. the kind you find right after the launch tweet.`],
          (c) => [`the way ${c.host} locked the front door and left one window open.`, `"${c.worst}". that's the window.`],
          (c) => [`${c.score}/100 is the "i'll fix it after launch" score.`, `you won't. fix it now. ${c.host} is one change from clean.`]],
      C: [(c) => [`${c.host} works on your preview and that's the whole security plan.`, `${c.score}/100. ${S(c.total, "finding")}. production did not get the memo.`],
          (c) => [`"claude said it was secure" energy.`, `${c.host} has ${S(c.total, "issue")} that claude did not mention.`],
          (c) => [`${c.host} is giving 47 "fix bug" commits.`, `${c.score}/100. the bugs stayed. they brought friends.`]],
      D: [(c) => [`${c.host} said "the AI handled auth" and the AI said "no i didn't".`, `${c.score}/100. ${S(c.total, "finding")}. half your doors are vibes.`],
          (c) => [`not ${c.host} trusting the entire internet.`, `${S(c.high + c.crit, "serious issue")}. this is a lost wallet with the ID still in it.`],
          (c) => [`the way ${c.host} shipped at 3am and it shows.`, `${c.score}/100. sleep is a security feature.`]],
      F: [(c) => [`${c.host} isn't an app. it's an open house.`, `${c.score}/100. ${S(c.total, "finding")}. snacks are in the kitchen, internet. help yourself.`],
          (c) => [`${c.score}/100 is crazy. be so for real.`, `we didn't hack ${c.host}. we just walked in. the door was open.`],
          (c) => [`nobody: \n${c.host}: "here's everything"`, `${`${c.crit} critical`} and ${c.high} high. this isn't a to-do list, it's a crime scene.`]],
    },
    nuclear: {
      A: [(c) => [`${c.score}/100. we brought a flamethrower to a fire station.`, `${c.host} is so locked down it's annoying. we're filing a complaint. with who? unclear.`],
          (c) => [`not ${c.host} making us look stupid.`, `we checked every path. nothing. you read the docs AND followed them. psychotic behavior honestly.`],
          (c) => [`${c.host} said "no" to every request we sent.`, `${c.score}/100. go outside. you've earned it. we haven't.`]],
      B: [(c) => [`${c.host} built a vault and left the side door open.`, `${c.score}/100. one hole. we found it in seconds. so will they.`],
          (c) => [`the way ${c.host} did almost all the work and fumbled at the goal line.`, `"${c.worst}". so much effort. so close. so roasted.`],
          (c) => [`${c.score}/100 is the most painful score possible.`, `${c.host} is one fix from untouchable and now it's on a roast card instead.`]],
      C: [(c) => [`${c.host}'s security plan is "nobody will look".`, `we looked. ${S(c.total, "finding")}. it took less time than your build.`],
          (c) => [`${c.host} runs on hope and a free tier.`, `${c.score}/100. hope is not a security header. we checked.`],
          (c) => [`it's the "claude said it was secure" for me.`, `${c.host} has ${S(c.total, "issue")} and a lot of confidence it hasn't earned.`]],
      D: [(c) => [`${c.host} isn't vibe-coded. it's vibe-exposed.`, `${c.score}/100. ${S(c.high + c.crit, "serious hole")}. hackers would leave a five-star review.`],
          (c) => [`the way ${c.host} trusts strangers more than its own login page.`, `${S(c.total, "finding")}. this app would hold the door for a burglar.`],
          (c) => [`${c.host} shipped at 3am and never looked back. we looked.`, `${c.score}/100. it's giving "deploy and pray". the prayer did not go through.`]],
      F: [(c) => [`${c.host} isn't vibe-coded. it's a crime scene with a favicon.`, `${c.score}/100. ${S(c.total, "finding")}. we're just here taking photos for the file.`],
          (c) => [`${c.score}/100. what the hell happened here.`, `${c.host} isn't leaking. it's a public fountain with a pricing page.`],
          (c) => [`nobody: \n${c.host}: *hands the internet its secrets*`, `${`${c.crit} critical`}. hackers aren't breaking in, they're carpooling.`]],
    },
  };
  // Burns per finding. Each: [mild[], spicy[], nuclear[]] of (c) => text. c.path = the real host + path.
  const B = (m, s, n) => [m, s, n];
  const ID_BURNS = {
    sourcemap_exposed: B([(c) => `your source maps are public on ${c.host}. anyone can read your original code.`], [(c) => `your source maps are public. you open-sourced your app by accident.`], [(c) => `source maps in prod on ${c.host}. the minifier did its job and you undid it.`]),
    cookie_session_insecure: B([(c) => `your session cookie is missing safety flags.`], [(c) => `session cookie with no flags. it's a sticky note with your login on it.`], [(c) => `your session cookie has no HttpOnly or Secure. one XSS and it's somebody else's account.`]),
    outdated_library: B([(c) => `${c.host} ships a library with known vulnerabilities.`], [(c) => `"${c.worst}". the vulnerabilities came pre-installed.`], [(c) => `"${c.worst}". that library has CVEs with birthdays.`]),
    phpinfo_exposed: B([(c) => `phpinfo() is public on ${c.host}.`], [(c) => `phpinfo() in prod. you published your server's whole diary.`], [(c) => `phpinfo() in prod. every config value, gift-wrapped.`]),
    debug_exposed: B([(c) => `debug mode is on in production.`], [(c) => `debug mode in prod. the stack traces are free for everyone.`], [(c) => `debug mode in prod. you're live-streaming your errors to attackers.`]),
    graphql_ide_public: B([(c) => `your GraphQL IDE is open to anyone.`], [(c) => `graphql playground open to the world. come explore my schema, said no secure app ever.`], [(c) => `open graphql playground. you gave strangers a query console.`]),
    env_exposed: B([(c) => `${c.path} loads for anyone. every secret in it is public.`],
      [(c) => `${c.path} returning 200 is crazy. you didn't get hacked bestie, you hosted an open house.`, (c) => `not ${c.path} just being downloadable. that file is the whole vault.`],
      [(c) => `${c.path} is public. you didn't leak your secrets, you catered them.`, (c) => `the way ${c.path} hands out every key you own. hackers don't need skills, they need a browser.`]),
    git_exposed: B([(c) => `${c.path} is public. your whole code history can be downloaded.`],
      [(c) => `${c.path} is open. every commit, including all 47 "fix bug" ones, is public now.`, (c) => `not ${c.path} streaming your entire commit history to strangers.`],
      [(c) => `${c.path} is open. your source code, your history, every 3am regret. on display.`, (c) => `${c.path} is public. this isn't open source, it's an open wound.`]),
    supabase_rls_readable: B([(c) => `a Supabase table on ${c.host} can be read without a login.`],
      [(c) => `RLS is off on ${c.host}. "the AI handled auth." the AI handled nothing.`, (c) => `the way your Supabase table just answers anyone who asks. giving public spreadsheet.`],
      [(c) => `RLS off on ${c.host}. your users' data has the privacy of a billboard. RLS was right there. right there.`, (c) => `your Supabase table is open to the whole internet. your users trusted you. the table trusted everyone.`]),
    supabase_schema_exposed: B([(c) => `${c.host}'s database layout is public.`],
      [(c) => `your Supabase schema is public. you handed strangers the map.`, (c) => `not ${c.host} posting its database floor plan online.`],
      [(c) => `your schema is public. you didn't just leave the door open, you drew the heist plan.`]),
    admin_open: B([(c) => `${c.path} loads without a login.`],
      [(c) => `${c.path} has no login. "it works on my preview." it works for everyone else too.`, (c) => `the way ${c.path} lets anyone in. no bouncer, no list, no nothing.`],
      [(c) => `${c.path} has no login. congrats, the internet is the admin now.`, (c) => `${c.path} is open. your app has a VIP room with no door and a neon sign.`]),
    api_open: B([(c) => `${c.path} answers anyone, no login needed.`],
      [(c) => `${c.path} takes requests from literally anyone. "the AI handled auth" strikes again.`],
      [(c) => `${c.path} serves strangers like a vending machine with no coin slot. free data, no line.`]),
    stripe_live_secret: B([(c) => `a live Stripe secret key is in ${c.host}'s public code.`],
      [(c) => `a live Stripe key in the browser on ${c.host}. not a test key. a LIVE one. be so for real.`],
      [(c) => `your live Stripe secret key is public. your revenue is a group project now.`, (c) => `live Stripe key in the frontend. you didn't launch a startup, you launched a giveaway.`]),
    missing_csp: B([(c) => `${c.host} has no Content-Security-Policy.`],
      [(c) => `no CSP on ${c.host}. any script that shows up gets to run. party with no guest list.`],
      [(c) => `no CSP. ${c.host} will run whatever script a stranger hands it, no questions asked.`]),
    missing_xfo: B([(c) => `${c.host} can be put in a frame on someone else's site.`],
      [(c) => `anyone can frame ${c.host} and trick your users into clicking. clickjacking says hi.`],
      [(c) => `no framing protection. any sketchy site can wear ${c.host} like a costume.`]),
    no_https: B([(c) => `${c.host} isn't on HTTPS. passwords go out in plain text.`],
      [(c) => `no HTTPS on ${c.host}. your login form is sending passwords on a postcard.`],
      [(c) => `no HTTPS in 2026. your users' passwords are crossing the internet with no clothes on.`]),
    no_https_redirect: B([(c) => `http://${c.host} still loads without moving to HTTPS.`],
      [(c) => `you bought the lock and left http://${c.host} wide open as a side entrance.`],
      [(c) => `HTTPS exists and http://${c.host} still works. a vault with a doggy door.`]),
    mixed_content: B([(c) => `${c.host} loads some files over plain http.`],
      [(c) => `HTTPS page, http files. ${c.host} is wearing its seatbelt as a scarf.`],
      [(c) => `${c.host} has HTTPS, then loads files over HTTP like it wants to get caught.`]),
    page_error: B([(c) => `${c.host}'s home page returns an error.`],
      [(c) => `${c.host}'s home page is an error. "${c.title}". bold launch strategy.`],
      [(c) => `your home page is "${c.title}". you shipped an error page with a domain name.`]),
    broken_links: B([(c) => `some links on ${c.host} go nowhere.`],
      [(c) => `the links on ${c.host} lead nowhere. your users click and get ghosted.`],
      [(c) => `${c.host}'s links go nowhere. a choose-your-own-adventure where every choice is wrong.`]),
    backup_exposed: B([(c) => `${c.path} is public. old backups keep old secrets.`],
      [(c) => `not ${c.path} just sitting there for anyone to download.`],
      [(c) => `${c.path} is public. you didn't back up your app, you backed it up onto the sidewalk.`]),
    config_exposed: B([(c) => `${c.path} is public. it shows how your app is wired.`],
      [(c) => `${c.path} is public. you taped the wiring diagram to the front door.`],
      [(c) => `${c.path} is public. that's the instruction manual for breaking in, and you published it.`]),
    ds_store: B([(c) => `${c.path} is public. it lists your folder names.`],
      [(c) => `${c.path} is public. your Mac is snitching on your folders.`],
      [(c) => `${c.path} is live. even your laptop is leaking now.`]),
    cors_wildcard_creds: B([(c) => `${c.host}'s CORS rules let other sites act as your users.`],
      [(c) => `your CORS says "any site, with cookies." that's a house key for every neighbor.`],
      [(c) => `wildcard CORS with credentials. any site on earth can borrow your users' sessions. damn.`]),
    x_powered_by: B([(c) => `${c.host} tells strangers what server it runs.`],
      [(c) => `${c.host} announces its tech stack like a dating profile. nobody asked.`],
      [(c) => `${c.host} hands hackers its exact stack. you wrote them a shopping list.`]),
  };
  const BURNS = { // fallback by category
    secrets: B([(c) => `a secret key is sitting in ${c.host}'s public JS.`], [(c) => `not the service_role key in the frontend on ${c.host}. anyone can copy it, and the bill is yours.`, (c) => `${c.host} shipped a secret key to every browser. that's not a key, that's a party invite.`], [(c) => `${c.host} put a secret key in the frontend. hackers don't need to hack, they need to scroll.`, (c) => `you didn't leak a key on ${c.host}. you published it. with a launch post.`]),
    database: ID_BURNS.supabase_rls_readable, headers: ID_BURNS.missing_csp, transport: ID_BURNS.mixed_content,
    exposure: B([(c) => `${c.path} is reachable by strangers.`], [(c) => `${c.path} is public. big "it works on my preview" energy.`], [(c) => `${c.path} is public. that's not a leak, that's a museum exhibit.`]),
    links: ID_BURNS.broken_links, seo: B([(c) => `search engines can't read ${c.host} well.`], [(c) => `google can't find ${c.host}. hackers found it fine. wrong order.`], [(c) => `${c.host} is invisible to google and wide open to strangers. impressive, backwards.`]),
    info: ID_BURNS.x_powered_by,
  };
  const COUNT_BURNS = {
    critical: (n, s) => [[`${`${n} critical`}. fix these first.`], [`${`${n} critical`}. somewhere a hacker just sat up straight.`, `${`${n} critical`}. not bugs. invitations.`], [`${`${n} critical`}. hackers are fighting over who gets in first.`, `${`${n} critical`}. we're just counting the evidence at this point.`]][s],
    high: (n, s) => [[`${S(n, "high issue")} to look at.`], [`${n} high. that's ${S(n, "open door")}.`, `${n} high. one tweet away from trending for the wrong reason.`], [`${n} high. more open doors than a mall on black friday.`, `${n} high. each one is somebody's favorite bookmark.`]][s],
    medium: (n, s) => [[`${n} medium. warm, not on fire.`], [`${n} medium. the "i'll fix it after launch" pile.`, `${n} medium. smoldering.`], [`${n} medium. smoldering like a laptop left on a bed.`, `${n} medium. small fires turn into big ones.`]][s],
    low: (n, s) => [[`${n} low. small stuff.`], [`${n} low. paper cuts, but a lot of them.`, `${n} low. not scary, just embarrassing.`], [`${n} low. death by paper cuts, starting here.`, `${n} low. tiny holes. hackers are tiny too.`]][s],
  };
  // Full roast paragraph (2-4 sentences) built from the real scan values.
  const FULL = {
    mild: [(c) => `${c.host} scored ${c.score}/100 with ${S(c.total, "finding")}.${c.crit ? ` ${c.crit} ${c.crit === 1 ? "is" : "are"} critical, so start there.` : ""} the worst one is "${c.worst}". nothing here is hard to fix, and you found it before anyone else did.`],
    spicy: [(c) => `${c.host} scored ${c.score}/100 and we found ${S(c.total, "thing")} without even logging in. the worst one is "${c.worst}"${c.wpath ? ` at ${c.wpath}` : ""}. the way the AI wrote all this and nobody checked is honestly impressive. anyway, the fix is right below. you're welcome.`,
            (c) => `not ${c.host} pulling ${c.score}/100. ${S(c.total, "finding")}, ${c.crit + c.high} of them serious, and the headliner is "${c.worst}". it's giving "it works on my preview". fix it below before your users find out the hard way.`],
    nuclear: [(c) => `${c.host}. ${c.score}/100. ${S(c.total, "finding")}. we didn't hack anything, we just asked nicely and your app said yes to everything. the headliner is "${c.worst}"${c.wpath ? ` at ${c.wpath}` : ""}, which is less of a bug and more of a public service. somewhere a hacker is adding ${c.host} to their bookmarks. but hey, at least the favicon loads.`,
              (c) => `be so for real: ${c.host} scored ${c.score}/100. ${`${c.crit} critical`}, ${c.high} high, and "${c.worst}" leading the parade. this app was clearly shipped at 3am on the strength of "claude said it was secure". the good news is every one of these is fixable. the bad news is you have to actually do it this time.`],
  };
  const FULL_SOFT = { // B and C: a few findings, nothing on fire
    mild: [(c) => `${c.host} scored ${c.score}/100 with ${S(c.total, "finding")}. the worst one is "${c.worst}". short list, easy fixes. you're close.`],
    spicy: [(c) => `${c.host} scored ${c.score}/100. ${S(c.total, "finding")}, and the worst one is "${c.worst}". not a disaster, just the classic "i'll fix it after launch" pile. you won't, so fix it now. it's right below.`,
            (c) => `the way ${c.host} got to ${c.score}/100 and just stopped. "${c.worst}" is the thing holding it back. one prompt to your builder and this roast gets a lot shorter.`],
    nuclear: [(c) => `${c.host}. ${c.score}/100. you did almost everything right, which makes "${c.worst}" so much funnier. ${S(c.total, "finding")} standing between you and a clean sheet. imagine doing all that work and getting roasted over this. anyway, the fix is below. don't make us come back.`,
              (c) => `be so for real: ${c.host} is a ${c.score}/100 app with a "${c.worst}" problem. it's like building a whole house and forgetting the lock on one door. ${S(c.total, "finding")}, all fixable today. the bar was right there.`],
  };
  const FULL_CLEAN = {
    mild: [(c) => `${c.host} scored ${c.score}/100 and we found nothing serious. that's not a promise it's safe, but it's a great start.`],
    spicy: [(c) => `${c.host} scored ${c.score}/100 and we found nothing serious. we tried. we really did. that's not a promise it's safe, but it's annoyingly good.`],
    nuclear: [(c) => `${c.host} scored ${c.score}/100 and gave us nothing. we sent every request we had and it said no to all of them. that's not a promise it's safe, it just means we couldn't get in from outside. go put the badge on before we find something.`],
  };
  const LV = { mild: 0, spicy: 1, nuclear: 2 };
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  // Same cutoffs as scanner.ts scoreOf()
  const band = (g, score) => { g = String(g || "").trim().toUpperCase().charAt(0); if (ROASTS.spicy[g]) return g; if (g === "E") return "F";
    const n = Number(score); return n >= 90 ? "A" : n >= 75 ? "B" : n >= 60 ? "C" : n >= 40 ? "D" : "F"; };
  const SITE = "https://deployvet.com/?utm_source=share";
  const siteFor = (how) => `${SITE}&utm_campaign=${how}`; // how = x | native | copy | card, so the numbers show which button worked
  const shareLead = (r, g, withUrl) => `deployvet roasted my app${withUrl && r.url ? ` (${r.url})` : ""}: ${r.score}/100 (${g}). it did not have to go that hard 💀 roast yours:`;
  const shareText = (r, g, withUrl, how) => `${shareLead(r, g, withUrl)} ${siteFor(how)}`;
  // Badge snippet: plain link with inline styles, no image to host. Shows the real score from this check.
  const badgeHtml = (r) => { const n = Math.max(0, Math.min(100, Math.round(Number(r.score) || 0))), d = new Date().toISOString().slice(0, 10);
    return `<a href="https://deployvet.com/?utm_source=badge" title="Free outside security check on ${d}. Not a pentest." style="display:inline-block;padding:4px 12px;border:2px solid #111;border-radius:999px;background:#b6f23a;color:#111;font:700 13px/1.4 system-ui,sans-serif;text-decoration:none">Roasted by DeployVet ${n}/100</a>`; };
  const BADGE_HTML = '<a href="https://deployvet.com/?utm_source=badge"><img src="https://deployvet.com/assets/badge-survived.svg" alt="Survived the DeployVet Roast" width="160" height="160"></a>';
  // Context from the real scan data. Every roast line is built from this.
  const hostOf = (u) => String(u || "").replace(/^[a-z]+:\/\//i, "").replace(/\/.*$/, "").toLowerCase() || "your app";
  const pathOf = (u, host) => { const s = String(u || "").replace(/^[a-z]+:\/\//i, "").replace(/\/$/, ""); return s.includes("/") ? s : (s || host); };
  function ctx(r) {
    const counts = r.counts || {}, t = r.topIssue || {}, host = hostOf(r.url || r.domain);
    const total = ["critical", "high", "medium", "low", "info"].reduce((a, k) => a + (Number(counts[k]) || 0), 0);
    const loc = t.location ? pathOf(t.location, host) : "";
    const guess = { env_exposed: "/.env", git_exposed: "/.git/", admin_open: "/admin", ds_store: "/.DS_Store" }[t.id];
    return { host, score: r.score, total, crit: Number(counts.critical) || 0, high: Number(counts.high) || 0,
      title: t.title || "", worst: (t.title || "nothing serious").replace(/\.$/, ""), wpath: loc && loc !== host ? loc : "",
      path: loc && loc !== host ? loc : guess ? host + guess : host };
  }
  const say = (fns, c) => pick(fns)(c);
// Scoreboard lines: name + score only (no finding details ever reach the board). Picked deterministically
  // from the entry id, so a row keeps its line and neighbours can be told apart.
  const BOARD_LINES = {
    A: [(n, sc) => `${n} gave us nothing to roast. rude.`, (n) => `not ${n} actually reading the docs.`, (n, sc) => `${sc}/100. insufferable. we love it.`, (n) => `${n} said no to every request. respect, sadly.`],
    B: [(n) => `${n} was SO close. one window open.`, (n, sc) => `${sc}/100 is the "i'll fix it after launch" score.`, (n) => `${n} locked the front door, forgot the back.`, (n) => `${n} did almost all the work. almost.`, (n) => `one fix from clean. ${n} chose violence.`],
    C: [(n) => `${n} works on the preview. that's the plan.`, (n) => `"claude said it was secure" energy.`, (n, sc) => `${sc}/100. security by vibes.`, (n) => `${n} runs on hope and a free tier.`],
    D: [(n) => `${n} said "the AI handled auth". it didn't.`, (n) => `${n} trusts strangers more than its login page.`, (n, sc) => `${sc}/100. shipped at 3am and it shows.`, (n) => `${n} is vibe-exposed, not vibe-coded.`],
    F: [(n) => `${n} isn't an app. it's an open house.`, (n) => `${n} is a crime scene with a favicon.`, (n, sc) => `${sc}/100. what the hell happened here.`, (n) => `${n} handed the internet its secrets.`],
  };
  const hash = (str) => { let h = 2166136261; for (const ch of String(str)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  // avoid = index used by the row above (same grade), so neighbours differ.
  window.DeployVet.boardLine = (g, row, avoid) => {
    const pool = BOARD_LINES[band(g, row && row.score)], n = (row && ((row.verified && row.display_name) || row.domain || row.masked)) || "this app";
    let i = hash((row && (row.id || row.domain || row.masked)) || n) % pool.length;
    if (i === avoid) i = (i + 1) % pool.length;
    return { text: pool[i](n, row && row.score), idx: i };
  };
  window.DeployVet.roastLine = (g, row) => window.DeployVet.boardLine(g, row).text;

  const urlForm = document.getElementById("check");
  const out = document.getElementById("check-result");
  const dlgR = document.getElementById("roast");
  let lastFocus = null;

  function fx(g) {
    const box = dlgR.querySelector(".fx"); box.innerHTML = "";
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const good = g === "A" || g === "B";
    const n = { A: 60, B: 30, C: 18, D: 34, F: 60 }[g];
    const cols = good ? ["#ff3d8b", "#ffe14d", "#b6f23a", "#ff7a1a", "#fff"] : ["#ff7a1a", "#ffe14d", "#ff3d8b"];
    box.className = "fx" + (good ? " conf" : "");
    for (let i = 0; i < n; i++) {
      const el = document.createElement("i");
      el.style.left = Math.random() * 100 + "%"; el.style.background = cols[i % cols.length];
      el.style.setProperty("--d", (1.6 + Math.random() * 1.8) + "s"); el.style.setProperty("--w", (Math.random() * .8) + "s");
      const sc = good ? 1 : .7 + Math.random() * 1.3; el.style.transform = `scale(${sc})`;
      box.appendChild(el);
    }
  }

  // Two-offer paid step (Scan $7, Fix it pack $10). Shown in the roast popup and in the inline result under the form.
  // Real counts only. With no findings it says so and does not claim problems. Copy follows the #pricing section of index.html.
  function offersBlock(c, total, where, top) {
    const n = Number(total) || 0, host = esc(c.host);
    const tt = top && top.title ? String(top.title).replace(/\.$/, "") : "";
    const tshort = tt.length > 70 ? tt.slice(0, 67) + "…" : tt;
    const head = n ? (n === 1 ? `1 issue found${tshort ? ": " + esc(tshort) : ""}. It's shown in full below.`
        : `${n} issues found. Worst${tshort ? ": " + esc(tshort) : ""}. The other ${n - 1} are locked.`)
      : "No problems found in the free check. The paid options go deeper.";
    const scanVal = n > 1 ? `Unlocks the other ${n - 1} issues, each with proof and a fix. Adds a read-only check of your public repo or Supabase.`
      : n ? "Adds a read-only check of your public repo or Supabase, plus fix prompts and a PDF."
      : "Adds a read-only check of your public repo or Supabase, which the free check does not do. Fix prompts and a PDF included.";
    const packVal = "Full report for one site with copyable fix prompts, a PDF, and 30 days of re-checks and glow-up tracking.";
    const scanBtn = `<button type="button" class="btn offer-btn" data-buy="deployvet_scan_once" data-domain="${host}" data-track="${where}-scan">Get the Scan: $7</button>`;
    const packAct = where === "popup"
      ? `<form class="fp-form" id="fp-form" data-domain="${host}">
          <label for="fp-email" class="sr">Your email</label><input id="fp-email" type="email" required placeholder="your email (for the report)" autocomplete="email">
          <button type="submit" class="btn btn-y offer-btn" data-track="popup-fixpack">Get Fix it pack: $10</button>
        </form><div id="fp-result" class="notice" hidden aria-live="polite"></div>`
      : `<button type="button" class="btn btn-y offer-btn" data-buy="deployvet_fix_pack" data-domain="${host}" data-track="result-fixpack">Get Fix it pack: $10</button>`;
    return `<div class="fixpack"${where === "popup" ? ' id="fixpack"' : ""}>
      <p class="fp-h">${head}</p>
      <div class="offers">
        <div class="offer"><h3 class="o-h">Scan</h3><p class="o-v">${scanVal}</p><p class="o-p"><b>$7</b> once</p><div class="o-act">${scanBtn}</div></div>
        <div class="offer"><h3 class="o-h">Fix it pack</h3><p class="o-v">${packVal}</p><p class="o-p"><b>$10</b> once</p><div class="o-act">${packAct}</div></div>
      </div>
      <p class="fp-note">One payment, no subscription, nothing renews. A developer's hour costs more than either one. After you pay, you prove you own the site, then the scan runs.</p></div>`;
  }
  document.addEventListener("submit", async (e) => {
    const f = e.target.closest("#fp-form"); if (!f) return;
    e.preventDefault(); const btn = f.querySelector("button");
    busy(btn, true, "opening secure checkout…");
    try {
      const body = { product: "deployvet_fix_pack", email: f.querySelector("#fp-email").value, domain: f.dataset.domain, builder: "other" };
      const r = await call("create-checkout", body);
      sessionStorage.setItem("dv_order", JSON.stringify({ order_id: r.order_id, site_id: r.site_id, verify_token: r.verify_token, domain: body.domain }));
      location.href = r.url;
    } catch (err) { msg(document.getElementById("fp-result"), esc(err.message), "err"); busy(btn, false); }
  });
  function openRoast(r, spice) {
    const g = band(r.grade, r.score), lv = LV[spice] ?? 1;
    const lvName = ROASTS[spice] ? spice : "spicy", c = ctx(r);
    // Server line (roast.ts gradeRoast) is built from the full findings, so it can name real misses. Prefer it.
    const [head0, sub] = say(ROASTS[lvName][g], c), head = typeof r.roast === "string" && r.roast ? r.roast : head0;
    const full = say((!r.topIssue ? FULL_CLEAN : (g === "D" || g === "F") ? FULL : FULL_SOFT)[lvName], c);
    const t = r.topIssue;
    const lvl = (x) => { const v = Array.isArray(x) ? pick(x) : x; return typeof v === "function" ? v(c) : v; };
    const topBurn = t ? lvl((ID_BURNS[t.id] || BURNS[t.category] || BURNS.info)[lv]) : "";
    const counts = r.counts || {};
    const order = ["critical", "high", "medium", "low", "info"];
    const chips = order.filter((k) => counts[k]).map((k) => `<span class="sev ${k}">${esc(counts[k])} ${esc(k)}</span>`).join("");
    const total = order.reduce((a, k) => a + (Number(counts[k]) || 0), 0);
    let burns = "";
    if (t) burns += `<li><span class="sev ${esc(t.severity)}">Worst issue · ${esc(t.category)}</span><p class="burn-l">${esc(topBurn)}</p>
      <p class="what"><b>${esc(t.title)}</b>${t.detail ? ` ${esc(t.detail)}` : ""}</p>
      <div class="fixbox"><b>The fix</b><p>${esc(t.fix || "Open the full roast for step-by-step fix prompts.")}</p></div></li>`;
    // Locked teaser: real counts only. Placeholder rows hold NO finding text.
    const left = {}; order.forEach((k) => { left[k] = Math.max(0, (Number(counts[k]) || 0) - (t && t.severity === k ? 1 : 0)); });
    const lockedN = t ? Math.max(0, total - 1) : 0;
    const lockChips = order.filter((k) => left[k]).map((k) => `<span class="sev ${k}">${esc(left[k])} ${esc(k)}</span>`).join("");
    const rest = lockedN ? `<li class="locked-teaser" id="locked">
      <p class="lk-h">${esc(lockedN)} more problem${lockedN === 1 ? "" : "s"} hidden 🔒</p>
      <div class="r-counts">${lockChips}</div>
      <div class="ph-rows" aria-hidden="true">${Array.from({ length: Math.min(lockedN, 3) }, () => '<div class="ph"><i></i><i></i><i></i></div>').join("")}</div>
      <p class="small">each one comes with plain steps you can copy and paste to whoever built your site (or the tool you used).</p></li>` : "";
    burns += rest;
    if (!burns) burns = `<li><p class="burn-l">${esc(pick(["nothing to burn. we checked twice. we're annoyed.", "zero burns. our roast writers are filing for unemployment.", `${c.host} is clean. our flamethrower is just sitting here.`]))}</p><p class="what">Our outside check found no serious issues. That's not a promise your app is safe, but it's a great start.</p></li>`;
    dlgR.className = "roast g-" + g;
    document.getElementById("roast-body").innerHTML = `
      <div class="r-card ${g === "A" || g === "B" ? "slam" : "shake"}">
        <p class="r-label">${esc(r.url || "Your app")} · ${esc(spice)} roast</p>
        <div class="r-top"><span class="r-score">${esc(r.score)}<small>/100</small></span><span class="r-grade" aria-label="Grade ${esc(g)}">${esc(g)}</span>
        </div>
        ${offersBlock(c, total, "popup", t)}
        ${r.check_id ? `<div class="qj" id="qj">
          <form id="qj-form" class="qj-form">
            <button type="submit" class="btn btn-big qj-btn" data-track="board-quick">Put me on the board 🔥</button>
            <label for="qj-name" class="sr">Nickname (optional)</label><input id="qj-name" maxlength="40" value="" placeholder="nickname (optional)" autocomplete="off">
          </form>
          <p class="qj-note">this goes public: your score and a roast line. your domain stays hidden as <code>${esc(maskDomain(c.host))}</code>.</p>
          <div id="qj-result" class="notice" hidden aria-live="polite"></div>
        </div>` : ""}
        <h2 class="r-head" id="roast-head">${esc(head).replace(/\n/g, "<br>")}</h2>
        <p class="r-sub">${esc(sub)}</p>
        <p class="r-full"><b>the full roast:</b> ${esc(full)}</p>
        <div class="r-counts">${chips || '<span class="sev low">0 issues</span>'}</div>
        ${total && t ? `<p class="small">${esc(total)} finding${total > 1 ? "s" : ""} in total. The free roast shows the worst one in full.</p>` : ""}
        ${r.message ? `<p class="small">${esc(r.message)}</p>` : ""}
      </div>
      <div class="r-share">
        <div class="r-actions">
          <button type="button" class="btn btn-sm btn-lime" id="share-main">Share my roast</button>
          <button type="button" class="btn btn-sm btn-line" data-track="share-copy" id="share-copy">Copy text</button>
          <button type="button" class="btn btn-sm btn-line" data-track="share-x" id="share-x" hidden>Post on X</button>
          <button type="button" class="btn btn-sm btn-line" data-track="roast-card" id="roast-card">Card (PNG)</button>
        </div>
        <label class="share-opt"><input type="checkbox" id="share-url"> Include my app's web address</label>
        <span class="share-note small" id="share-note" aria-live="polite"></span>
      </div>
      ${g === "A" || g === "B" ? `<details class="bd"><summary>Get a badge for your site</summary>
        <p class="small">Optional. Paste it in your footer if you want. It shows today's score (${esc(r.score)}/100) and links to DeployVet. Only use it on your own site, and update or remove it if the score changes.</p>
        <p class="bd-prev" id="badge-prev"></p>
        <label for="badge-code" class="sr">Badge HTML</label><textarea id="badge-code" readonly rows="4"></textarea>
        <button type="button" class="btn btn-sm btn-y" id="badge-copy" data-track="badge-copy">Copy badge code</button>
        ${g === "A" ? `<button type="button" class="btn btn-sm btn-line" id="badge-copy2" data-track="badge-copy-survived">Copy "Survived the Roast" image badge</button>` : ""}
      </details>` : ""}
      <form class="rr" id="rr-form">
        <h3>get security tips + a re-roast reminder</h3>
        <input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
        <div class="rr-row"><label for="rr-email" class="sr">Email</label><input id="rr-email" type="email" required placeholder="you@email.com" autocomplete="email">
        <button type="submit" class="btn btn-sm btn-lime" data-track="reroast-email">Email me</button></div>
        <p class="small rr-ok">We email a confirm link first. No confirm, no emails. After that: occasional security tips and a nudge to re-roast ${esc(c.host)}. Unsubscribe any time. <a href="/privacy.html">Privacy</a></p>
        <div id="rr-result" class="notice" hidden aria-live="polite"></div>
      </form>
      <ol class="r-burns">${burns}</ol>
      <p class="small"><button type="button" class="linkbtn" data-track="scoreboard-join" id="join-open">Verify you own it</button> to show your full domain on the scoreboard with a ✔ verified badge.</p>
      <div class="join" id="join" hidden>
        <h3>Verify you own it</h3>
        <p class="small">Optional upgrade. Prove you own the site and the board shows your full domain with a ✔ verified badge. You can leave any time.</p>
        <form id="join-form"><label for="j-domain">Your domain</label><input id="j-domain" required autocomplete="url" placeholder="your-app.com" value="${esc(r.url || "")}">
          <label for="j-name">Display name <span class="opt">(optional)</span></label><input id="j-name" maxlength="40" placeholder="Shown instead of your domain">
          <div><button type="submit" class="btn btn-sm">Next: verify</button></div></form>
        <div id="join-step2" hidden></div>
        <div id="join-result" class="notice" hidden aria-live="polite"></div>
        <p class="small leave"><a href="#" id="leave-open" data-track="scoreboard-leave">Remove my site</a> from the scoreboard</p>
      </div>
      </div>`;
    fx(g);
    lastFocus = document.activeElement;
    dlgR.showModal();
    dlgR.querySelector(".close").focus();
    const withUrl = () => document.getElementById("share-url").checked;
    const note = document.getElementById("share-note");
    const main = document.getElementById("share-main"), xBtn = document.getElementById("share-x");
    const canNative = typeof navigator.share === "function" && (matchMedia("(max-width: 820px)").matches || /Mobi|Android/i.test(navigator.userAgent));
    const postX = () => window.open("https://x.com/intent/post?text=" + encodeURIComponent(shareText(r, g, withUrl(), "x")), "_blank", "noopener,noreferrer");
    if (canNative) {
      main.dataset.track = "share-native"; xBtn.hidden = false;
      main.addEventListener("click", async () => { try { await navigator.share({ text: shareLead(r, g, withUrl()), url: siteFor("native") }); } catch (e) { if (e.name !== "AbortError") postX(); } });
    } else {
      main.dataset.track = "share-x"; main.textContent = "Post on X"; main.addEventListener("click", postX);
    }
    xBtn.addEventListener("click", postX);
    document.getElementById("share-copy").addEventListener("click", async () => {
      const tx = shareText(r, g, withUrl(), "copy");
      try { await navigator.clipboard.writeText(tx); note.textContent = "Copied. Paste it anywhere."; } catch (_) { window.prompt("Copy this:", tx); }
    });
    const bh = badgeHtml(r), bcode = document.getElementById("badge-code");
    if (bcode) {
      bcode.value = bh; document.getElementById("badge-prev").innerHTML = bh;
      const cp = (btn, txt) => btn && btn.addEventListener("click", async () => { try { await navigator.clipboard.writeText(txt); btn.textContent = "Copied"; } catch (_) { bcode.value = txt; bcode.select(); } });
      cp(document.getElementById("badge-copy"), bh); cp(document.getElementById("badge-copy2"), BADGE_HTML);
    }
    document.getElementById("roast-card").addEventListener("click", () => roastCard({ score: r.score, grade: g, head: head.replace(/\n/g, " "), burn: topBurn || sub }).catch((e) => { note.textContent = "Couldn't make the card: " + e.message; }));
    joinFlow(r);
    quickJoin(r);
    reRoast(r, c);
  }

  // Roast card: 1200x675 PNG drawn in the browser.
  async function drawCard({ score, grade, head, burn }) {
    const W = 1200, H = 675, cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const x = cv.getContext("2d");
    try { await document.fonts.load('800 80px "Bricolage Grotesque"'); } catch (_) {}
    const F = '"Bricolage Grotesque", "Arial Black", sans-serif';
    const bg = { A: "#b6f23a", B: "#b6f23a", C: "#ffe14d", D: "#ff7a1a", F: "#ff3d8b" }[grade] || "#ff3d8b";
    x.fillStyle = "#fff6e5"; x.fillRect(0, 0, W, H);
    const box = (X, Y, w, h, r, fill, sh = 10) => { x.fillStyle = "#111"; rr(X + sh, Y + sh, w, h, r); x.fill(); x.fillStyle = fill; rr(X, Y, w, h, r); x.fill(); x.lineWidth = 6; x.strokeStyle = "#111"; x.stroke(); };
    const rr = (X, Y, w, h, r) => { x.beginPath(); x.roundRect ? x.roundRect(X, Y, w, h, r) : x.rect(X, Y, w, h); };
    x.save(); x.translate(600, 330); x.rotate(-0.015); x.translate(-600, -330); box(40, 40, 1110, 560, 36, bg); x.restore();
    x.fillStyle = "#111"; x.font = `800 250px ${F}`; x.textBaseline = "alphabetic"; x.fillText(String(score), 90, 300);
    const sw = x.measureText(String(score)).width; x.font = `800 60px ${F}`; x.fillText("/100", 100 + sw, 300);
    x.save(); x.translate(980, 190); x.rotate(0.14); box(-100, -100, 200, 200, 34, "#111", 0); x.fillStyle = "#ffe14d"; x.font = `800 170px ${F}`; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(grade, 0, 10); x.restore();
    const wrap = (t, X, Y, maxW, lh, maxLines) => { const words = String(t).split(/\s+/); let line = "", n = 0;
      for (let i = 0; i < words.length; i++) { const test = line ? line + " " + words[i] : words[i];
        if (x.measureText(test).width > maxW && line) { if (++n === maxLines) { x.fillText(line + "…", X, Y); return Y; } x.fillText(line, X, Y); line = words[i]; Y += lh; } else line = test; }
      x.fillText(line, X, Y); return Y; };
    x.fillStyle = "#111"; x.textAlign = "left"; x.textBaseline = "alphabetic"; x.font = `800 58px ${F}`;
    let y = wrap(head, 90, 390, 1000, 62, 2);
    x.font = `600 34px ${F}`; wrap(burn, 90, y + 56, 1000, 40, 2);
    // footer strip
    box(40, 610, 1110, 50, 14, "#111", 0);
    x.fillStyle = "#fff6e5"; x.font = `800 28px ${F}`; x.fillText("roasted by deployvet. it didn't have to go that hard  ·  deployvet.com", 170, 645);
    try { const img = new Image(); img.src = "/favicon.svg"; await img.decode(); x.drawImage(img, 110, 614, 42, 42); } catch (_) {}
    return cv;
  }
  async function roastCard(d) {
    const cv = await drawCard(d);
    const blob = await new Promise((res) => cv.toBlob(res, "image/png"));
    const file = new File([blob], `deployvet-roast-${d.score}.png`, { type: "image/png" });
    const mobile = matchMedia("(max-width: 820px)").matches || /Mobi|Android/i.test(navigator.userAgent);
    if (mobile && navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], text: `deployvet roasted my app: ${d.score}/100. it didn't have to go that hard 💀 your turn: ${siteFor("card")}` }); return; } catch (e) { if (e.name === "AbortError") return; }
    }
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  window.DeployVet.drawCard = drawCard;

  // Scoreboard join: join -> verify instructions -> confirm. Leave: same proof, two calls. Spec: app/LEADERBOARD.md
  const proofHtml = (j, what) => {
    const i = j.instructions || {}, t = i.dns_txt || {};
    return `<p><b>Prove you own ${esc(j.domain)}.</b> Add <b>one</b> of these, then hit ${what}.</p>
      <p class="small">Option 1: a DNS TXT record on <code>${esc(t.host)}</code></p><pre class="code">${esc(t.value)}</pre>
      <p class="small">Option 2: this meta tag in the &lt;head&gt; of your home page</p><pre class="code">${esc(i.meta_tag)}</pre>
      <p class="small">The token works once and lasts 7 days. DNS can take a few minutes.</p>`;
  };
  function maskDomain(d) { const p = String(d).split("."); return `${(p[0] || "?").charAt(0)}*******${p.length > 1 ? "." + p.at(-1) : ""}`; }
  // "you're #3 in the Hall of Flame 💀". Same split (70) and tie rules as the scoreboard.
  function boardRank(d, en) {
    const fame = en.score >= 70, rows = ((fame ? d.fame : d.flame) || []);
    const i = rows.findIndex((x) => (en.id && x.id === en.id) || (!en.id && x.masked === en.masked && x.display_name === en.display_name && x.score === en.score));
    if (i < 0) return "";
    const rank = rows.findIndex((x) => x.score === rows[i].score) + 1;
    return fame ? `you're #${rank} in the Hall of Fame 🏆` : `you're #${rank} in the Hall of Flame 💀`;
  }
  function quickJoin(r) {
    const f = document.getElementById("qj-form"); if (!f) return;
    const res = document.getElementById("qj-result");
    f.addEventListener("submit", async (e) => {
      e.preventDefault(); const btn = f.querySelector("button[type=submit]"); res.hidden = true;
      busy(btn, true, "Posting…");
      try {
        const nickname = document.getElementById("qj-name").value.trim();
        const j = await call("leaderboard", { action: "join_quick", check_id: r.check_id, nickname: nickname || undefined }); // no score sent, ever
        const en = j.entry || {};
        f.hidden = true;
        let where = "";
        try { where = boardRank(await call("leaderboard", null, "GET"), en); } catch (_) {}
        msg(res, `${where ? esc(where) : "you're on the board"} as <b>${esc(en.display_name || en.masked)}</b>. <a href="/scoreboard.html">see the board</a>`, "ok");
      } catch (err) { msg(res, esc(err.status === 409 ? "that site is already on the board. one entry per site." : friendly(err)), "err"); busy(btn, false); }
    });
  }
  function reRoast(r, c) {
    const f = document.getElementById("rr-form"), res = document.getElementById("rr-result");
    f.addEventListener("submit", async (e) => {
      e.preventDefault(); const btn = f.querySelector("button[type=submit]"); res.hidden = true;
      busy(btn, true, "Sending…");
      try {
        await call("newsletter", { email: document.getElementById("rr-email").value, source: "popup", domain: c.host, website: f.querySelector("[name=website]").value || "" });
        msg(res, "check your inbox (and spam or promotions) for the confirm link. no confirm, no emails.", "ok"); f.querySelector("#rr-email").value = "";
      } catch (err) { msg(res, esc(err.status === 400 ? "that email doesn't look right." : friendly(err)), "err"); }
      busy(btn, false);
    });
  }
  function joinFlow(r) {
    const box = document.getElementById("join"), res = document.getElementById("join-result"), step2 = document.getElementById("join-step2");
    const form = document.getElementById("join-form"), dom = document.getElementById("j-domain");
    const clear = () => { res.hidden = true; };
    document.getElementById("join-open").addEventListener("click", () => { box.hidden = false; dom.focus(); });
    form.addEventListener("submit", async (e) => {
      e.preventDefault(); clear(); const btn = form.querySelector("button[type=submit]");
      const domain = dom.value.trim(), display_name = document.getElementById("j-name").value.trim();
      if (!domain) { msg(res, "Type your domain first, like your-app.com.", "err"); return; }
      busy(btn, true, "Saving…");
      try {
        const j = await call("leaderboard", { action: "join", domain, display_name: display_name || undefined });
        step2.hidden = false;
        step2.innerHTML = proofHtml(j, "Check now") + `<button type="button" class="btn btn-sm btn-lime" id="join-confirm" data-track="scoreboard-confirm">Check now</button>`;
        const go = document.getElementById("join-confirm"); go.focus();
        go.addEventListener("click", async () => {
          clear(); busy(go, true, "Checking…");
          try {
            const c = await call("leaderboard", { action: "confirm", domain: j.domain });
            const en = c.entry || {};
            msg(res, c.listed === false
              ? `Verified, score ${esc(en.score)} (${esc(en.grade)}). Your site is hidden by a moderator for now, so it won't show on the board. Questions? <a href="mailto:support@deployvet.com">support@deployvet.com</a>`
              : `You're in! ${esc(en.display_name || en.domain)} scored ${esc(en.score)} (${esc(en.grade)}) on a fresh scan. <a href="/scoreboard.html">See the scoreboard</a>`, "ok");
            step2.hidden = true;
          } catch (err) { msg(res, esc(friendly(err)), "err"); }
          busy(go, false);
        });
      } catch (err) { msg(res, esc(friendly(err)), "err"); }
      busy(btn, false);
    });
    document.getElementById("leave-open").addEventListener("click", async (ev) => {
      ev.preventDefault(); clear();
      const domain = dom.value.trim(); if (!domain) { msg(res, "Type your domain above first.", "err"); dom.focus(); return; }
      const link = ev.currentTarget; link.setAttribute("aria-disabled", "true");
      try {
        const l = await call("leaderboard", { action: "leave", domain });
        if (l.removed) { step2.hidden = true; msg(res, "Done. Your site is off the scoreboard. You can delete the token now.", "ok"); }
        else { step2.hidden = false; step2.innerHTML = proofHtml(l, "Remove my site again") + `<p class="small">This is a new token, just for leaving.</p>`; msg(res, "Almost gone. Add the new token, then click Remove my site again.", ""); }
      } catch (err) { msg(res, esc(friendly(err)), "err"); }
      link.removeAttribute("aria-disabled");
    });
  }

  if (dlgR) {
    dlgR.querySelector(".close").addEventListener("click", () => dlgR.close());
    dlgR.addEventListener("close", () => { dlgR.querySelector(".fx").innerHTML = ""; if (lastFocus) lastFocus.focus(); });
    dlgR.addEventListener("keydown", (e) => { // keep Tab inside the modal
      if (e.key !== "Tab") return;
      const f = [...dlgR.querySelectorAll("a[href],button:not([disabled]),input:not([type=hidden]),textarea,select")].filter((el) => el.offsetParent !== null || el.classList.contains("close"));
      if (!f.length) return; const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  }

  if (urlForm) urlForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = urlForm.querySelector("button[type=submit]");
    const url = urlForm.querySelector("#url").value;
    const spice = (urlForm.querySelector("[name=spice]:checked") || {}).value || "spicy";
    out.hidden = true;
    busy(btn, true, "Roasting…");
    try {
      const r = await call("free-check", { url, website: urlForm.querySelector("[name=website]")?.value || "" });
      if (r.blocked) {   // firewall / bot challenge: nothing honest to grade, so show no score
        out.hidden = false; out.className = "result-offers";
        out.innerHTML = `<p class="ro-h">Blocked by a firewall / bot challenge</p><p class="small">${esc(r.message)}</p>`;
        busy(btn, false); return;
      }
      openRoast(r, spice);
      // Same two offers inline under the form, so they are still there when the popup closes.
      const cc = ctx(r), tot = ["critical", "high", "medium", "low", "info"].reduce((a, k) => a + (Number((r.counts || {})[k]) || 0), 0);
      out.hidden = false; out.className = "result-offers"; out.innerHTML = `<p class="ro-h">Free check done for ${esc(cc.host)}: ${esc(r.score)}/100.</p>`
        + (r.cached && r.rescan_in_hours ? `<p class="small">This is your latest free check. Rescan available in about ${esc(r.rescan_in_hours)} hour${r.rescan_in_hours === 1 ? "" : "s"}. Fixed something already? The $10 Fix it pack includes re-checks, so you can verify it right now.</p>` : "")
        + (r.incomplete ? `<p class="small">${esc(r.incompleteNote || "Part of your site sits behind a firewall, so this score may be incomplete.")}</p>` : "")
        + offersBlock(cc, tot, "result");
    } catch (err) { msg(out, esc(err.message), "err"); }
    busy(btn, false);
  });

  // When the checkout opens from inside the roast modal, close the roast so only one modal shows.
  document.addEventListener("click", (e) => { if (e.target.closest("#roast [data-buy]") && dlgR.open) dlgR.close(); }, true);

  // ---- Newsletter ----
  const mailForm = document.querySelector(".mail-form");
  if (mailForm) mailForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = mailForm.querySelector("button"), note = document.getElementById("mail-result");
    busy(btn, true, "Sending…");
    try {
      const r = await call("newsletter", { email: mailForm.querySelector("#email").value, source: "site", website: mailForm.querySelector("[name=website]")?.value || "" });
      msg(note, "Almost done: we sent a confirm link. If you don't see it in a minute, check spam or promotions.", "ok"); mailForm.reset();
    } catch (err) { msg(note, esc(err.message), "err"); }
    busy(btn, false);
  });
  const nl = new URLSearchParams(location.search).get("newsletter");
  if (nl) msg(document.getElementById("mail-result"), { confirmed: "You're subscribed. Thanks!", unsubscribed: "You're unsubscribed. Sorry to see you go.", invalid: "That link didn't work. It may have expired." }[nl] || "", nl === "invalid" ? "err" : "ok");

  // ---- Checkout (Scan / Fix it pack) ----
  const dlg = document.getElementById("buy");
  const NAMES = { deployvet_scan_once: "DeployVet Scan · $7 once", deployvet_fix_pack: "DeployVet Fix it pack · $10 once" };
  const WHAT = { deployvet_scan_once: "You get: every issue with proof and a fix, fix prompts for your builder, and a PDF. One payment.", deployvet_fix_pack: "You get: the full report with copyable fix prompts, a PDF, and 30 days of re-checks. One payment." };
  document.addEventListener("click", (e) => {
    const a = e.target.closest("[data-buy]"); if (!a || !dlg) return;
    e.preventDefault();
    let product = a.dataset.buy;
    dlg.querySelectorAll("[name=plan]").forEach((r) => { r.checked = r.value === product; });
    dlg.querySelector("[name=product]").value = product;
    dlg.querySelector("#buy-title").textContent = NAMES[product] || "Checkout";
    const bw = dlg.querySelector("#buy-what"); if (bw) bw.textContent = WHAT[product] || "";
    const pp = dlg.querySelector(".pro-plan"); if (pp) pp.hidden = true;
    const u = a.dataset.domain || document.getElementById("url")?.value; if (u) dlg.querySelector("[name=domain]").value = u;
    document.getElementById("buy-result").hidden = true;
    dlg.showModal ? dlg.showModal() : dlg.setAttribute("open", "");
  });
  if (dlg) {
    dlg.querySelector(".close").addEventListener("click", () => dlg.close());
    dlg.querySelectorAll("[name=plan]").forEach((r) => r.addEventListener("change", () => { dlg.querySelector("[name=product]").value = r.value; dlg.querySelector("#buy-title").textContent = NAMES[r.value]; }));
    dlg.querySelector("form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const f = new FormData(e.target), btn = e.target.querySelector("button[type=submit]");
      const body = { product: f.get("product"), email: f.get("email"), domain: f.get("domain"), builder: f.get("builder") };
      if (f.get("repo_url")) body.repo_url = f.get("repo_url");
      if (f.get("supabase_url")) body.supabase_url = f.get("supabase_url");
      busy(btn, true, "Opening secure checkout…");
      try {
        const r = await call("create-checkout", body);
        sessionStorage.setItem("dv_order", JSON.stringify({ order_id: r.order_id, site_id: r.site_id, verify_token: r.verify_token, domain: body.domain }));
        location.href = r.url; // Stripe Checkout. The scan runs only after payment and domain proof.
      } catch (err) { msg(document.getElementById("buy-result"), esc(err.message), "err"); busy(btn, false); }
    });
  }
})();
