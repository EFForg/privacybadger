# How to fix broken site issues

Unfortunately, while working to protect your privacy, Privacy Badger can end up breaking website functionality. This document is about the process of classifying and resolving these breakages.

Here are the [open "broken site" and "good-volunteer-task"-labeled issues](https://github.com/EFForg/privacybadger/issues?utf8=%E2%9C%93&q=is%3Aissue%20is%3Aopen%20label%3A%22broken%20site%22%20label%3A%22good%20volunteer%20task%22).


## Confirm Privacy Badger is responsible

The first thing to do is to confirm that Privacy Badger blocks (or will eventually learn to block) the domain, and that blocking the domain does indeed break the site.

Browser caching can get in our way here, as cached resources bypass request filtering by extensions. Disable your browser cache when debugging, for example by reloading using `Ctrl+Shift+R` every time.

Try disabling Privacy Badger for the site, and then reloading the page. Does that fix the issue? If it doesn't, does disabling the entire Privacy Badger add-on and reloading the page fix the issue? If it still doesn't, Privacy Badger is not at fault.

If disabling Badger and reloading the page fixed the issue, and re-enabling and reloading brought the issue back, let's try to figure out the responsible domain(s). Try allowing half the blocked domains to load. If (after reloading the page) the issue was fixed, pick half of those domains and revert them back to Badger's control. Eventually you should find the exact domain(s) that, when blocked, cause the issue to appear.


## Resolve the breakage

Once the issue is confirmed (and the responsible domains have been identified), you should try to find the most appropriate way to resolve it. Privacy Badger comes with several approaches:

- Multi-domain first parties
- Script surrogates
- Widget replacement
- EFF's Do Not Track policy
- Yellowlisting

The question to ask is, which way addresses the issue most specifically, resolving the breakage while increasing privacy exposure by the smallest amount? Let's look at some common kinds of breakages.


### Domains that are part of the site but don't look like it

Does the blocked domain actually belong to the site, but Privacy Badger doesn't know that and so treats the domain as an external tracker? Sounds like a job for [multi-domain first parties](https://github.com/EFForg/privacybadger/issues/781).


### JavaScript errors

Does blocking the domain block a JavaScript analytics library that the site tries to use and fails, breaking site navigation? This could be resolved by [script surrogates](https://github.com/EFForg/privacybadger/issues/400).


### External services

Is the missing comments section powered by a commenting service that Privacy Badger learned to block? Perhaps a new [widget replacement](https://github.com/EFForg/privacybadger/pull/196) should be added.

We should also ask the service to to adopt the [EFF Do Not Track policy](https://www.eff.org/dnt-policy), which is a way for privacy-conscious companies to receive recognition for their good practices. If their service can and will abide by the policy's requirements, posting the policy on the service's domains will tell Privacy Badger to allow loading of resources from those domains.


### External domains too complex to surrogate or replace with placeholders

If nothing else seems to fit, adding the affected domain to the "[yellowlist](/doc/yellowlist-criteria.md)" will make Privacy Badger set the domain to "yellow" (cookie-blocked) instead of "red" (blocked) after seeing it track on three or more sites.

Resources from yellowlisted domains are requested without referrer headers, and are restricted from reading or writing cookies or localStorage.
