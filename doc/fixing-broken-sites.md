# How to fix broken site issues

Unfortunately, while working to protect your privacy, Privacy Badger can end up breaking website functionality. Here are the [open "broken site" and "help wanted"-labeled issues](https://github.com/EFForg/privacybadger/issues?utf8=✓&q=is%3Aissue%20is%3Aopen%20label%3A"broken%20site"%20label%3A"help%20wanted"%20).

This document is about the process of classifying and resolving these breakages.


## Confirm Privacy Badger is responsible

The first thing to do is to confirm that Privacy Badger blocks (or will eventually learn to block) the domain, and that blocking the domain does indeed break the site.

Browser caching can get in our way here, as cached resources bypass request filtering by extensions. Disable your browser cache when debugging, for example by reloading using <kbd>Ctrl+Shift+R</kbd> every time.

Try disabling Privacy Badger for the site, and then reloading the page. Does that fix the issue? If it doesn't, does disabling the entire Privacy Badger add-on and reloading the page fix the issue? If it still doesn't, Privacy Badger is not at fault.

If disabling Badger and reloading the page fixed the issue, and re-enabling and reloading brought the issue back, let's try to figure out the responsible domain(s). Try allowing half the blocked domains to load. If (after reloading the page) the issue was fixed, pick half of those domains and revert them back to Badger's control. Eventually you should find the exact domain(s) that, when blocked, cause the issue to appear.


## Resolve the breakage

Once the issue is confirmed (and the responsible domains have been identified), you should try to find the most appropriate way to resolve it. Privacy Badger comes with several approaches:

| Approach | Label | Original issue | Difficulty | Notes |
| --- | :---: | :---: | :---: | --- |
| Multi-domain first parties | [MDFP](https://github.com/EFForg/privacybadger/labels/MDFP) | [#781](https://github.com/EFForg/privacybadger/issues/781) | Easy | Narrowly applicable |
| Script surrogates | [surrogates](https://github.com/EFForg/privacybadger/labels/surrogates) | [#400](https://github.com/EFForg/privacybadger/issues/400) | Hard | Should use uBlock Origin's surrogates ("neutered scripts") as much as possible |
| Widget replacement | [widgets](https://github.com/EFForg/privacybadger/labels/widgets) | [#196](https://github.com/EFForg/privacybadger/issues/196), [#1467](https://github.com/EFForg/privacybadger/issues/1467) | Medium | Still needs review/improvements, although some progress being made ([#2262](https://github.com/EFForg/privacybadger/pull/2262)) |
| EFF's Do Not Track policy | [DNT Policy](https://github.com/EFForg/privacybadger/labels/DNT%20policy)| - | n/a | Narrowly applicable |
| Yellowlisting | [yellowlist](https://github.com/EFForg/privacybadger/labels/yellowlist)| - | Easy | Only protects against some types of tracking |

The question to ask is, which way addresses the issue most specifically, resolving the breakage while increasing privacy exposure by the smallest amount? If you are not sure, that's OK! Opening a new issue (or chiming in on an existing issue) to ask for help is fine.

Let's look at some common kinds of breakages and see how they relate to the approaches above.


### Domains that are part of the site but don't look like it

Does the blocked domain actually belong to the site, but Privacy Badger doesn't know that and so treats the domain as an external tracker? Sounds like a job for [multi-domain first parties](https://github.com/EFForg/privacybadger/issues/781) (MDFP).

When adding domains to the MDFP list, please add base ([eTLD](https://en.wikipedia.org/wiki/Public_Suffix_List)+1) domains only. For example, there is no need to add `api.example.net` when adding `example.com` and `example.net`.

For past examples, you could browse [the list of merged pull requests with the "MDFP" label](https://github.com/EFForg/privacybadger/issues?q=label%3AMDFP+is%3Amerged).


### JavaScript errors

Does blocking the domain block a JavaScript analytics library that the site tries to use and fails, breaking site navigation? This could be resolved by [script surrogates](https://github.com/EFForg/privacybadger/issues/400).


### External services

Is the missing comments section powered by a commenting service that Privacy Badger learned to block? Perhaps a new [widget replacement](https://github.com/EFForg/privacybadger/pull/196) should be added.

We should also ask the service to to adopt the [EFF Do Not Track policy](https://www.eff.org/dnt-policy), which is a way for privacy-conscious companies to receive recognition for their good practices. If their service can and will abide by the policy's requirements, posting the policy on the service's domains will tell Privacy Badger to allow loading of resources from those domains.


### External domains too complex to surrogate or replace with placeholders

If nothing else seems to fit, adding the affected domain to the "[yellowlist](/doc/yellowlist-criteria.md)" will make Privacy Badger set the domain to "yellow" ("cookie-blocked") instead of "red" (blocked) after seeing it track on three or more sites.

Resources from yellowlisted domains are requested without referrer headers, and are restricted from reading or writing cookies or localStorage.

[Here is an example yellowlist pull request](https://github.com/EFForg/privacybadger/pull/1543) that shows what's good to know when deciding how to fix a breakage, and how to get that information.
