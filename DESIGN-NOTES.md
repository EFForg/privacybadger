# PRIVACY BADGER DESIGN NOTES
###BLOCKING

Blocking happens in webrequest.js; currently in onBeforeSendHeaders, but that
[should move](https://github.com/EFForg/privacybadgerchrome/issues?state=open)
(search for "cancel")

all WebRequest API calls should eventually be in webrequest.js though some of
them are currently in heuristicblocking.js (and we bind various hooks twice, URGH)

The state describing how we currently treat a given (3rd party) domain is called
an "action".  Currently this is an enum with {"noaction", "block",
"cookieblock", "usercookieblock", "userblock", "usernoaction"} we could
conceivably need a "cookiewhitelist" state that is stronger than the current
whitelist for a very small set of documented (reason, domain)s but that is not
yet implemented.

At webRequest time, an action is extracted from a data structure called
activeMatchers.  XXX DAN add issue: refactor activeMatchers logic in
webrequest.js.  Then the webRequest listener implements that action.

###UI

The main files are popup.js and popup.html.  At the end of a request pipeline, a
decision is made about whether it goes into the activeMatchers data structure
(for instance, tabless requests never go in there).  Otherwise activeMatchers is
keyed by tabId, and for a given tab there'll be a list of domains & the
respective subscriptions that fired for.

When you click the popup button, it reads the list of activeMatchers.  It makes
the same type of decision that the webRequest logic makes, deciding upon a
current action for the domain.

Q: is there are a guarantee that these will actually be the same throughout the
loading of a page? A: the opposite is true; a domain might have had action ==
noaction during the load, but switch to block at the end, in which case the UI
will show block.  For privacybadger development and debugging, we might one day
want to display this transition visually somehow.  Of course, it can be quite
complicated if the action changed partway through the loading events, perhaps
because of something in another tab.

Decisions to add origins to activeMatchers happen at the end of requests, so if
you start loading a page, some orgins might have had their requests completed,
and others not, so the popup UI will be half-baked.  Wishlist bug: have the
popup menu update in realtime.

The UI in general updates on window.unload, which fires when you click away from
the popup or re-furl it.  

Overall we need a clean attack on UX to make all of this CSS sane and nice at
least for 0.2 but possibly for the alpha!

For instance once a user has begun making manual changes to action state for
some domain, there is currently no way to hand it back to PB.  

###STATE MANAGEMENT

Adblock Plus is heavyweight!  It likes book keeping.  

The main entry point is FilterStorage.  It's a class in filterStorage.js.  An
instance of that keeps track of all the subscriptions and all the filters in the
subscriptions.  

In upstream ABP, all of the filters in all of the subscriptions get munged
together into a single CombinedMatcher object (which includes both white- and
black-listing filters).  We changed this to have CombinedMatchers per
subscription.  That lets us work out policy and UI decisions based on the source
of each filter.  (XXX unsure what performance hits we might be taking as a
result of that, it's probably important to make sure that we aren't hooking more
callbacks than we need to).  Fortunately there are no blocking callbacks...

activeMatchers contains lots of references to CombinedMatchers indexed by
(domain,tab).

There is a regexp oddity that does ondemand creation of RegExp objects, but
somehow this is broken by our changes.  Dan worked around that with a [dirty
hack](https://github.com/EFForg/privacybadgerchrome/blob/9e3cf6acc9c22b3edae54727da411d7c2fe02227/adblockplus/lib/filterClasses.js#L465)
which means that some filter that aren't domain-specific or otherwise
anticipated by that hack might explode in PB until we fix this.

###CODE STRUCTURE

Main ABP code is in adblockplus/lib, and that's shared with Firefox.  Most of the
work happens in there.  There's also some relevant stuff in
adblockplus/chrome/content/ui.

Aside from that, everything else is a more standard chrome repo.  The work is
done in {popup,background,heuristicblocking,webrequest}.js.


