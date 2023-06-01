# PRIVACY BADGER DESIGN AND ROADMAP

See also [the FAQ on Privacy Badger's homepage](https://privacybadger.org/#faq).

## DESIGN

### OBJECTIVE

Privacy Badger aims to

 - Protect users against non-consensual tracking by third party domains as they
   browse the Web.

 - Send and enforce the Do Not Track signal to sites (especially "third party"
   sites since they are in a position to collect a large fraction of the user's
   browsing history).

Privacy Badger consists of a primary tracker blocking algorithm, augmented by
a number of secondary features that extend further privacy protection and
reduce breakage from the primary mechanism.

### PRIMARY MECHANISM

Privacy Badger:

1. Ensures your browser is sending the DNT: 1 header (in some regulatory
   environments, it is advisable to note "installing Privacy Badger will enable
   Do Not Track" on your installation page / app store entry.
2. Observes which first party origins a given third party origin is setting cookies on
   (certain cookies are deemed to be "low entropy", as discussed below).

   2a. Observes which first party origins a given third party is doing certain
   types of fingerprinting on.

   2b. Observes which first party origins a given third party is setting certain types
   of supercookies on.

   2c. Observes which first party origins a given third party is sending
   certain parts of first party cookies back to itself using image query
   strings (pixel cookie sharing).

   2d. Observes on which first party origins a given third party
   uses the [Beacon API].

3. If a third party origin receives a cookie, a supercookie, an image pixel
   containing first party cookie data, uses the Beacon API, or makes
   JavaScript fingerprinting API calls on three or more first party origins,
   this is deemed to be "cross site tracking".
4. Typically, cross site trackers are blocked completely; Privacy Badger
   prevents the browser from communicating with them. The exception is if the
   site is on Privacy Badger's "yellow list" (aka the "cookie block list"), in
   which case resources from the site are loaded, but without access to their
   (third party) cookies or local storage, and with the referer header either
   trimmed down to the origin (for GET requests) or removed outright (all other
   requests). The yellow list is routinely fetched from [an EFF URL](https://www.eff.org/files/cookieblocklist_new.txt)
   to allow prompt fixes for breakage.

   Until methods for blocking them have been implemented, domains that perform
   fingerprinting or use third party supercookies should not be added to the
   yellow list.
5. Users can also choose custom rules for any given domain flagged by Privacy Badger,
   overrulling any automatic decision Privacy Badger has made about the domain.
   Privacy Badger uses three-state sliders (red → block, yellow → cookie block, green → allow) to convey this
   state in UI. We believe this is less confusing than the UI in many other
   blocking tools, which often leave the user confused about whether a visual
   state represents current blocking or the opportunity to block.
6. Domains can agree to EFF's [Do Not Track policy](https://eff.org/dnt-policy). If a domain does this
   Privacy Badger will no longer block its traffic or cookies. If a
   first-party domain posts the policy, this applies to all third parties
   embedded on that domain.
   Sites post the policy at [a well-known URL](https://example.com/.well-known/dnt-policy.txt)
   on their domains. The contents must match those of a file from the list of
   acceptable policies exactly; the policy file is [maintained on github](https://github.com/EFForg/dnt-policy/),
   but Privacy Badger fetches a list of known-good hashes periodically [from EFF](https://www.eff.org/files/dnt-policies.json)
   (version  1.0 of the policy file will be added to that list when Privacy Badger
   reaches version 1.0)

#### Further Details

Learning from cookies and the Beacon API happens in [`heuristicblocking.js`](../src/js/heuristicblocking.js) [*sic*].

Privacy Badger also learns from [fingerprinting](../src/js/contentscripts/fingerprinting.js) and [HTML5 local storage "supercookies"](../src/js/contentscripts/supercookie.js).

Request blocking/modification happens in [`webrequest.js`](../src/js/webrequest.js).

##### Technical Implementation:

When a browser with Privacy Badger enabled makes a request to a third party, and Privacy Badger observes tracking (for example, the request contains a cookie or the response tries to set a cookie), the domain gets flagged as "tracking".

Origins that make tracking requests get stored in a key-value store (`snitch_map`) where the keys are the [eTLD+1](https://en.wikipedia.org/wiki/Public_Suffix_List) of tracking origins, and the values are lists of the first party eTLD+1 origins (that is, the sites) these requests were made on. Such origins also get stored in another key-value store (`action_map`) where each origin is associated with the action Privacy Badger should take when it next sees requests (or responses) by that origin.

Once Privacy Badger sees tracking from an origin on `constants.TRACKING_THRESHOLD` or more first party origins, Privacy Badger will update `action_map` to note that this origin should now get blocked (`constants.BLOCK`). If the origin is on the yellow list, its `action_map` entry will instead get updated to `constants.COOKIEBLOCK`, and its requests will be allowed to resolve although without access to cookies or local storage and with the referer header trimmed or removed.

Additionally users can manually set the desired action for any FQDN, which updates `action_map`.

These key-value stores are stored on disk, and persist between browser sessions.

##### Data Structures:

`action_map` is an object keyed by fully qualified domain names of third parties (potential trackers). The value for each key is another object containing at least one (`heuristicAction`) and up to four entries:

- `heuristicAction`: one of `""` (no tracking seen), `"allow"` (Privacy Badger has not yet made a decision to block), `"cookieblock"`, `"block"`
- `userAction`: one of `"user_allow"`, `"user_cookieblock"`, `"user_block"`. Set if the user moves the slider for the corresponding third party FQDN.
- `dnt`: `true` or `false`
- `nextUpdateTime`: an integer timestamp of the earliest time we should recheck for presence of EFF's DNT Policy

For example:

```json
{
    "google.com": {
        "heuristicAction": "block",
        "nextUpdateTime": 1602051816434
    },
    "fonts.google.com": {
        "heuristicAction": "cookieblock"
    },
    "accounts.google.com": {
        "heuristicAction": "cookieblock",
        "userAction": "user_allow"
    },
    "maybe.a.tracker.example.net": {
        "heuristicAction": "allow"
    },
    "privacy.respectful.example.com": {
        "dnt": true,
        "heuristicAction": "",
        "nextUpdateTime": 1602130658236
    }
}
```

`snitch_map` is an object keyed by [eTLD+1](https://en.wikipedia.org/wiki/Public_Suffix_List) (no subdomains!) domain names of third parties (potential trackers). The values are arrays of eTLD+1 domain names of first parties (sites you visit directly) that the corresponding third party was seen perform tracking on. For example:

```json
{
    "google-analytics.com": [
        "linkedin.com",
        "theguardian.com",
        "godaddy.com"
    ]
}
```


##### What is an "origin" for Privacy Badger?

Privacy Badger has two notions of origin.  One is the [effective top level
domain](https://wiki.mozilla.org/Public_Suffix_List) plus one level of
subdomain (eTLD+1), computed using
[`getBaseDomain()`](https://github.com/EFForg/privacybadger/blob/8e8ad9838b74b6d13354163f78d362ca60dd44f9/src/lib/basedomain.js#L75).
The accounting for which origins are trackers or not is performed by looking
up how many first party fully qualified domain names (FQDNs) have been tracked by each
of these eTLD + 1 origins.  This is a conservative choice, which avoids the
need to evaluate sets of cookies with different scopes.

When the heuristic determines that the correct response is to block,
that decision is applied to the third party eTLD+1 from which tracking was seen.

Users are able to override Privacy Badger's decision for any given FQDN if they
do not wish to block something that is otherwise blocked (or block something
that is not blocked).


##### What is a "low entropy" cookie?

Our [current cookie heuristic](https://github.com/EFForg/privacybadger/blob/8e8ad9838b74b6d13354163f78d362ca60dd44f9/src/js/heuristicblocking.js#L632) is to assign "number of identifying bits" estimates to
some known common cookie values, and to bound the sum of these to 12.
Predetermined low-entropy cookies will not be identified as tracking, nor will
combinations of them so long as their total estimated entropy is under 12 bits.

### ADDITIONAL MECHANISMS

#### Widget Substitution

Many social media widgets are inherently designed to combine tracking
and occasionally-useful functionality in a single resource load.
Privacy Badger aims to give the user access to the functionality when they want
it, but protection against the tracking at all other times.

To that end, Privacy Badger has incorporated code from the ShareMeNot project
so that it is able to replace various types of widgets hosted
by third party origins with local, static equivalents that either replace the
original widget faithfully, or create a click-through step before the widget
is loaded and tracks the user.

The widget replacement table lives in the [socialwidgets.json file](https://github.com/EFForg/privacybadger/blob/8e8ad9838b74b6d13354163f78d362ca60dd44f9/src/data/socialwidgets.json).
Widgets are replaced unless the user has chosen to specifically allow that third party
domain (by moving the slider to 'green' in the UI), so users can selectively
disable this functionality if they wish. The code for social media widgets is
quite diverse, so not all variants (especially custom variants that sites build
for themselves) are necessarily replaced.

#### What are the states for domain responses?

Currently domains have three states: no action, cookie block, and block. No
action allows all requests to resolve as normal without intervention from
Privacy Badger. Cookie block allows for requests to resolve normally but will
block cookies from being read or created. Cookie block also trims or removes
the referer header. Block will cause any requests from that origin to be
blocked entirely; before even a TCP connection can be established. The user can
toggle these options manually, which will supersede any determinations made
automatically by Privacy Badger.

#### What does EFFs Do Not Track policy stipulate?

Currently the Do Not Track policy covers where the agreement will be hosted,
how users who send the DNT header are treated, log retention, how information
will be shared with other domains, notifications of disclosure, and possible exceptions.
It can be read in full [here](https://www.eff.org/dnt-policy).

#### How do sites agree to EFFs Do Not Track policy?

Sites can agree to this policy by posting at https://subdomain.example.com/.well-known/dnt-policy.txt,
where "subdomain" is any domain to which the policy applies, for a given third party.

#### Fingerprinting detection
Certain aspects of the browser, such as fonts, add-ons or extensions, screen size,
and seen links, can be used to give the browser a fingerprint that is unique out
of a very small amount of users (see [Panopticlick](https://panopticlick.eff.org/) for more information).

As of Privacy Badger 1.0, any third party script that writes to an HTML5
canvas object and then reads a sufficiently large amount back from the third
party canvas object will be treated the same way as a third party cookie, blocking the
third party origin if it does this across multiple first party origins. Our
research has determined that this is a reliable way to distinguish between
fingerprinting and other third party canvas uses.

This may be augmented by hooks to detect extensive enumeration of properties
in the `navigator` object in the future.

#### Pixel cookie sharing detection

Detection of first to third party cookie sharing via image pixels was added in [#2088](https://github.com/EFForg/privacybadger/issues/2088).

#### Beacon API detection

Added in https://github.com/EFForg/privacybadger/pull/2898.

### ROADMAP

#### High priority issues

Please see our ["high priority"-labeled issues](https://github.com/EFForg/privacybadger/issues?q=is%3Aissue+is%3Aopen+label%3A%22high+priority%22).


[Beacon API]: https://developer.mozilla.org/en-US/docs/Web/API/Beacon_API
