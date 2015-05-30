# PRIVACY BADGER DESIGN AND ROADMAP

## DESIGN

### OBJECTIVE

Privacy Badger aims to

 - protect users against non-consensual tracking by sites as they browse the
   Web.

 - send and enforce the Do Not Track signal to sites (especially "third party"
   sites since they are in a position to collect a large fraction of the user's
   browsing history)

### PRIMARY MECHANISM

Privacy Badger:

1. Ensures your browser is sending the DNT: 1 header
2. Observes which first party origins a given 3rd party origin is setting cookies on
   (certain cookies are deemed to be "low entropy", as discussed below
3. If a 3rd party origin receives a cookie, a supercookie, or makes 
   JavaScript fingerprinting API calls on 3 or more first party origins, this is deemed to be 
   "cross site tracking"
4. Typically, cross site trackers are blocked completely; Privacy Badger prevents the
   browser from communicating with them.  The exception is if the site is on
   Privacy Badger's "cookieblocklist" (aka the "yellow list"), in which case
   resources from the site are loaded, but with their (third party) cookies.
   Until methods for blocking them have been implemented, domains that perform
   fingerprinting or use supercookies should only be added to the
   cookieblocklist
   (certain cookies are deemed to be "low entropy" and are not tracked, as discussed below)
5. Users can also choose custom rules for any given domain flagged by Privacy Badger,
   overrulling any automatic decision Privacy Badger has made about the domain.
6. Sites can agree to the EFFs Do Not Track policy. If a site does this
   Privacy Badger will no longer block their traffic or cookies.

### ADDITIONAL MECHANISMS AND FUTURE ROADMAP

#### What is an "origin" for Privacy Badger?

Privacy Badger has two notions of origin.  One the [effective top level
domain](https://wiki.mozilla.org/Public_Suffix_List) 

#### What is a "low entropy" cookie?

Our [current heuristic](https://github.com/EFForg/privacybadgerchrome/blob/master/src/heuristicblocking.js#L588) is to assign "number of identifying bits" estimates to
some known common cookie values, and to bound the sum of these to 12.
Predetermined low-entropy cookies will not be identified as tracking, nor will
combinations of them so long as their total length is under 12 bits.

#### What are the states for domain responses?

Currently domains have three states: no action, cookie block, and block.
No action allows all requests to resolve as normal without intervention from
Privacy Badger. Cookie block allows for requests to resolve normally but will
block all cookie requests. Block will cause any requests from that origin to be
blocked. The user can toggle these options manually, which will supersede any
determinations made automatically by Privacy Badger.

#### What does EFFs Do Not Track policy stipulate?

Currently the Do Not Track policy covers where the agreement will be hosted,
how users who send the DNT header are treated, log retention, how information
will be shared with other domains, notifications of disclosure, and possible exceptions.
It can be read in full [here](https://www.eff.org/dnt-policy).

#### How do sites agree to EFFs Do Not Track policy?

Sites can agree to this policy by posting at https://subdomain.example.com/.well-known/dnt-policy.txt, 
where "subdomain" is any domain to which the policy applies, for a given third party.

#### Widget Handling

Many social media widgets are inherently designed to combine tracking
functionality and occassionally-useful functionality in a single resouce load.
Privacy Badger aims to give the user acess to the functionality when they want
it, but protection against the tracking at all other times.

To that end, Privacy Badger has incorporated code from the TrackMeNot project
so that it is able to replace various types of widgets hosted
by third party origins with local, static equivalents that either replace the
original widget faithfully, or create a click-through step before the widget
is loaded and tracks the user.

The widget replacement table lives in the [socialwidgets.json
file](https://github.com/EFForg/privacybadgerchrome/blob/master/src/socialwidgets.json).
Widgets are only replaced if the domain hosting them is in a "yellow"
(cookieblock) or "red" (block) state, so users can disable this functionality
if they wish.  The code for social media widgets is quite diverse, so not all
  variants (especially custom variants that sites build for themselves) are
  necessarily replaced.

#### Canvas data

The canvas element of a browser can be used to read a lot of identifying
information about a user's system. Privacy Badger should block these requests,
and block third parties if they are found to be requesting this data.

#### Browser fingerprinting

Certian aspects of the browser, such as fonts, add-on or extensions, screen size,
and seen links, can be used to give the browser a fingerprint that is unique out
of a very small amount of users (see Panopticlick for more information). Privacy
Badger in the future should detect some of these values being read and treat that
as it would a cookie request, blocking third party origins if they do this across
multiple first party origins.

#### Click-to-play for extensions

Certain browser add-ons, like flash, expose an enormous amount of identifying
information about a user's system. Privacy Badger in the future should disable
these by default and allow users to have the option to agree to their use on a
site by site basis.

## Technical Implementation (Chrome)

### How are origins and the rules for them stored?

When a third party makes a request to a browser with Privacy Badger enabled, if
the request contains a cookie or the request for a cookie it gets flagged as 'tracking'.
Origins that make tracking requests get stored in a key value store where the keys
are the origins making the request, and the values are the first party origins these
requests were made on. If that list of first parties contains more than three first party
origins then the third party origin gets added to another list of known trackers.
When Privacy Badger gets a request from a origin on the known trackers list, if it
is not on the the cookieblocklist then Privacy Badger blocks that request. If it
is on the cookieblocklist then the request is allowed to resolve, but all cookie
setting parts of it are blocked. Both of these lists are stored on disk, and persist
between browser sessions.

Additionally users can manually set the desired action for any given domain.
These get added to their own lists, which are also stored on disk, and get checked
before Privacy Badger does its default action for a given origin. These are managed
from the popup window for privacy badger on the page as well as the options menu
for the whole extension.

