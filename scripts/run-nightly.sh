#!/bin/bash
PROFILEDIR=/tmp/tmp-fx-profile.$$.d

mkdir $PROFILEDIR
~/Downloads/firefox/firefox -profile $PROFILEDIR -no-remote -new-instance
rm -rf $PROFILEDIR
