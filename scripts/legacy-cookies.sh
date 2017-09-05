sed -e "s/^\([^\!].*\)$/@@||\1^\$third-party/g" src/data/yellowlist.txt > doc/yellowlist_legacy.txt
