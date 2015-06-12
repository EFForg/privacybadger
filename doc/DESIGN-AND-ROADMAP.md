# PRIVACY BADGER DESIGN AND ROADMAP

## DESIGN

### OBJECTIVE

Privacy Badger aims to

 - protect users against non-consensual tracking by sites as they browse the
   Web.

 - send and enforce the Do Not Track signal to sites (especially "third party"
   sites since they are in a position to collect a large fraction of the user's
   browsing history)

Privacy badger consists of a primary tracker blocking algorithm, augmented by
a number of secondary features that extend further privacy protection and
reduce breakage from the primary mechanism.

### PRIMARY MECHANISM

Privacy Badger:

1. Ensures your browser is sending the DNT: 1 header

2. Observes which first party origins a given 3rd party origin is setting cookies on
   (certain cookies are deemed to be "low entropy", as discussed below)

3. If a 3rd party origin receives a cookie, a supercookie, or makes 
   JavaScript fingerprinting API calls on 3 or more first party origins, this is deemed to be 
   "cross site tracking".

4. Typically, cross site trackers are blocked completely; Privacy Badger prevents the
   browser from communicating with them.  The exception is if the site is on
   Privacy Badger's "cookieblocklist" (aka the "yellow list"), in which case
   resources from the site are loaded, but with their (third party) cookies
   blocked.  The cookieblocklist is routinely fetched from [an EFF
   URL](https://www.eff.org/files/cookieblocklist.txt) to allow prompt fixes
   for breakage.

   Until methods for blocking them have been implemented, domains that perform
   fingerprinting or use third party supercookies should not be added to the
   cookieblocklist.

5. Users can also choose custom rules for any given domain flagged by Privacy Badger,
   overrulling any automatic decision Privacy Badger has made about the domain.

   Privacy badger uses three-state sliders (red - block, yellow - cookie block, green - allow) to convey this
   state in UI.  We believe this is less confusing than the UI in many other
   blocking tools, which often leave the user confused about whether a visual
   state represents blocking or the opportunity to block.

6. Domains can agree to the EFFs [Do Not Track policy](https://eff.org/dnt-policy). If a domain does this
   Privacy Badger will no longer block its traffic or cookies. If a
   first-party domain posts the policy, this applies to all third parties
   embedded on that domain.

   Sites post the policy at [a well-known
   URL](https://example.com/.well-known/dnt-policy.txt) on their domains.  The
   contents must match those of a file from the list of acceptable policies exactly; the policy
   file is [maintained on github](https://github.com/EFForg/dnt-policy/), but
   privacy badger fetches a list of known-good hashes periodically [from
   EFF](https://www.eff.org/files/dnt-policies.json) (version  1.0 of the
   policy file will be added to that list when Privacy Badger reaches version
   1.0)

#### Further Details

##### What is an "origin" for Privacy Badger?

Privacy Badger has two notions of origin.  One is the [effective top level
domain](https://wiki.mozilla.org/Public_Suffix_List) plus one level of
subdomain (eTLD+1), computed using
[getBaseDomain](https://developer.mozilla.org/en-US/docs/Mozilla/Tech/XPCOM/Reference/Interface/nsIEffectiveTLDService)
(which is built-in to Firefox; in Chrome we [ship a
copy](https://github.com/EFForg/privacybadgerchrome/blob/master/lib/basedomain.js#L68).
The accounting for which origins are trackers or not is performed by looking
up how many first party Fully Qualified Domain Names have been tracked by each
of these eTLD + 1 origins.  This is a conservative choice, which avoids the
need to evaluate sets of cookies with different scopes.  

When the heuristic determines that the correct response is to block,
that decision is applied to the third party eTLD from which tracking was seen.

To illustrate this, suppose the site <tt>tracking.co.uk</tt> was embedded on
every site on the Web, but each embed came from a randomly selected subdomain
<tt>a.tracking.co.uk</tt>, <tt>b.tracking.co.uk</tt>,
<tt>c.tracking.co.uk</tt>, etc.  Suppose the user visits
<tt>www.news-example.com</tt>, <tt>search.jobs-example.info</tt>.

The accounting data structure <tt>seenThirdParties</tt> would come to include:

```
{
  ...
  "tracking.co.uk" : {
    "www.news-example.com"    : true,
    "search.jobs-example.info : true,
  }
  ...
}
```

Now suppose the user visits a third site, <tt>clickbait.nonprofit.org</tt>,
and is tracked by <tt>q.tracking.co.uk</tt> on that site.  The
seenThirdParties data structure will have a third entry added to it, meeting
the threshold of three first party origins and defining
<tt>tracking.co.uk</tt> as a tracking eTLD+1.  *However*, only
<tt>q.tracking.co.uk</tt> will be blocked at this point; each other subdomain
of <tt>tracking.co.uk</tt> will be redlisted as and only as it attempts to
track the user.  This ensures that if there is a non-tracking subdomain,
<tt>api.tracking.co.uk</tt>, it will not be blocked.

##### What is a "low entropy" cookie?

Our [current heuristic](https://github.com/EFForg/privacybadgerchrome/blob/master/src/heuristicblocking.js#L578) is to assign "number of identifying bits" estimates to
some known common cookie values, and to bound the sum of these to 12.
Predetermined low-entropy cookies will not be identified as tracking, nor will
combinations of them so long as their total length is under 12 bits.

### ADDITIONAL MECHANISMS 

#### Widget Substitution

Many social media widgets are inherently designed to combine tracking
and occassionally-useful functionality in a single resouce load.
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
(cookieblock) or "red" (block) state, allowing users to selectively disable this
functionality if they wish.  The code for social media widgets is quite
diverse, so not all variants (especially custom variants that sites build for
themselves) are necessarily replaced.

The widget method may be used in the future to implement ["script
surrogates"](https://github.com/EFForg/privacybadgerchrome/issues/400),
which are a more privacy-protective alternative to yellowlisting certain
third-party JavaScript domains.  If that occurs, <tt>socialwidgets.json</tt>
should also be periodically fetched from a live EFF URL.

#### Consent Prompts for Third Party Logins

There are very rare instances where third party domains are necessary
for first-party functionality on a site, and those third parties will not
function with their cookies blocked.  Typically this occurs when the site
UI prompts the user to log in to the third party.  Common examples include users
attempting to log into Disqus widgets to post comments, or users trying to log
into accounts.google.com to comment on youtube.com.

We have implemented experimental solutions which invovle manually identifying
such situations, and triggering a request to the user to allow the request on
this site, allow it across the web, or prevent it.  

The login URLs that trigger this UI are [fetched live from
EFF](https://www.eff.org/files/domain_exception_list.txt).


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

#### Fingerprinting detection

As of Privacy Badger 1.0, any third party script that writes to an HTML5
canvas object and then reads a sufficiently large amount back from the third
party canvas object will be deemed to be a tracker.  Our research has
determined that this is a reliable way to distinguish between fingerprinting
and other third party canvas uses. 

This may be augmented by hooks to detect extensive enumeration of properties
in the <tt>navigator</tt> object in the near future.

### ROADMAP

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
requests were made on. If that list of first parties contains three or more first party
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

