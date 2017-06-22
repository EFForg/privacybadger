# How to fix broken site issues

Unfortunately, while working to protect your privacy, Privacy Badger can end up breaking website functionality. This document is about the process of classifying and resolving these breakages.

Here are the [open "broken site" and "good-volunteer-task"-labeled issues](https://github.com/EFForg/privacybadger/issues?utf8=%E2%9C%93&q=is%3Aissue%20is%3Aopen%20label%3A%22broken%20site%22%20label%3A%22good%20volunteer%20task%22).

The first thing to do is to confirm that Privacy Badger blocks (or will eventually learn to block) the domain, and that blocking the domain does indeed break the site.

Once the issue is confirmed, you should try to find the most appropriate way to resolve it. Privacy Badger has several existing ways of resolving site issues:

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
