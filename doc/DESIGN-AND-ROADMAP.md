# PRIVACY BADGER DESIGN AND ROADMAP

## DESIGN

### OBJECTIVE

Privacy Badger aims to

 - protect users against non-consensual tracking by sites as they browse the
   Web.

 - send and enforce the Do Not Track siganl to sites (especially "third party"
   sites since they are in a position to collect a large fraction of the user's
   browsing history)

### MECHANISM

Privacy Badger:

1. Ensures your browser is sending the DNT: 1 header
2. Observes which first party origins a given 3rd party origin is setting cookies on
   (certain cookies are deemed to be "low entropy", as discussed below
3. If a 3rd party origin receives a cookie on more than 3 first party origins,
   this is deemed to be "cross site tracking"
4. Typically, cross site trackers are blocked completely; Privacy Badger prevents the
   browser from communicating with them.  The exception is if the site is on
   Privacy Badger's "cookieblocklist", in which case resources from the site are
   loaded, but with their (third party) cookies blocked.

#### What is an "origin" for Privacy Badger?

Privacy Badger has two notions of origin.  One the [effective top level
domain](https://wiki.mozilla.org/Public_Suffix_List) 

#### What is a "low entropy" cookie?

Our current heuristic is to assign "number of identifying bits" estimates to
some known common cookie values, and to bound the sum of these to 12.


## ROADMAP

### Supercookie detection & processing

Conceptually, supercookies should be treated the same way as cookies by privacy
badger.

Some supercookies are like HTTP cookies in the sense that they are always
transmitted when the user makes requests.  Others require explicit retrieval
with JS calls (much like JavaScript access to browser cookies)



