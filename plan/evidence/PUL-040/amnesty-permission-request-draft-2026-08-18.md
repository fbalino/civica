# Amnesty International — allowlisting / permission request (DRAFT)

**Status: NOT SENT.** Drafted 2026-08-18 for Fernando to review, edit, and
send himself. No contact has been made with Amnesty International.

## Where to send it

**Primary: `copyright@amnesty.org`** — Amnesty's own permissions page
(https://www.amnesty.org/en/about-us/permissions/) names this address for
permissions questions and for "any other uses" beyond the CC licence. A
request to read their public feed for non-commercial research is a
permissions question, so this is the correct front door.

**Secondary, only if copyright@ redirects you: `dpo@amnesty.org`** — Terms of
Use §16 names it for questions about the terms themselves, which is where the
automated-access clause lives. It is a legal/data-protection mailbox, not a
technical one.

**Do NOT use `press@amnesty.org`.** Amnesty's media centre states those
details are "for media enquiries only".

Amnesty publishes no address or form specifically for bot allowlisting or
crawler registration; these general channels are the only routes that exist.

## Draft message

> Subject: Permission request — automated access to the Amnesty RSS feed for a
> non-commercial research project
>
> Hello,
>
> I'm writing to ask permission for a small non-commercial research project to
> read your public news RSS feed automatically.
>
> I run Civica Atlas (https://civicaatlas.org), an independent, non-commercial
> comparative reference on how countries are governed. Part of it tracks
> governance-related events reported by human rights organisations, and
> Amnesty's reporting is one of the sources I would most like to include.
>
> What I would like to do is narrow:
>
> - Fetch https://www.amnesty.org/en/feed/ once per day — one request, no
>   crawling of the wider site.
> - Store each item's headline, summary, publication date and canonical link.
> - Display them only as attributed links back to your page on amnesty.org,
>   with Amnesty named as the source. No republication of full article text.
> - Non-commercial use throughout. The project sells nothing and runs no ads.
>
> I'm asking rather than proceeding because your Terms of Use (§3) require
> your permission for automated access, and requests from my end currently
> receive an HTTP 403. I have not attempted to work around that block, and I
> won't. If the answer is no, that's completely fine — I'll record Amnesty as
> a source I don't retrieve and leave it there.
>
> If it would help, I'm happy to identify the fetches with a dedicated user
> agent, keep to any rate or caching conditions you'd like to set, or use a
> different access route if you have one you'd prefer.
>
> Thank you for considering it, and for the work.
>
> Fernando Baliño
> Civica Atlas — https://civicaatlas.org
> [contact email]

## Before sending

- Fill in the contact email on the last line.
- Confirm the described use still matches what Civica does at send time.
- On a reply, record the outcome in
  `plan/evidence/PUL-040/amnesty-retrieval-block-2026-08-18.md` and update
  `src/lib/pulse/v2/publisher-fallback-permission.ts`:
  - **Granted** → set `amnesty.org` in `PUBLISHER_DIRECT_RETRIEVAL` to
    `granted` with the evidence, and re-enable the connector.
  - **Refused** → leave it as is; the connector already declines to retrieve.
    Record the refusal so nobody revisits it.
  - The Firecrawl fallback stays off for amnesty.org either way unless
    Amnesty specifically permits that route.
