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

#### What is an "origin" for Privacy Badger?

Privacy Badger has two notions of origin.  One the [effective top level
domain](https://wiki.mozilla.org/Public_Suffix_List) 

#### What is a "low entropy" cookie?

Our [current heuristic](https://github.com/EFForg/privacybadgerchrome/blob/master/src/heuristicblocking.js#L588) is to assign "number of identifying bits" estimates to
some known common cookie values, and to bound the sum of these to 12.

### ADDITIONAL MECHANISMS

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

### Supercookie detection & processing

Conceptually, supercookies should be treated the same way as cookies by privacy
badger.

As 
