#!/bin/bash
PROFILEDIR=/tmp/tmp-fx-profile.$$.d

mkdir $PROFILEDIR
~/bin/firefox/firefox -profile $PROFILEDIR -no-remote -new-instance
rm -rf $PROFILEDIR
