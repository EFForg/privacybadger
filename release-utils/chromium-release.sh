#!/bin/bash
# We use the immutable filesystem attribute as a workaround for the fact that
# the build scripts are not currently idempotent.

# The fact that the package is marked immutable means that it has been built
# for release.

if ! lsattr $PREPKG | cut -f 1 -d" " | grep -q i ; then

  if [ -f $PREPKG ] ; then
    echo $PREPKG is not immutable, rebuilding it for release!
  else
    echo building $PREPKG for the first time...
  fi

  if ! release-utils/make-eff-zip.sh $GITTAG ; then
    echo "Failed to build target $GITTAG"
    exit 1
  fi

  if ! [ -f "$PREPKG" -a -f "$PREPKGCWS" ] ; then
    echo "Failed to find package $PREPKG after build"
    exit 1
  fi

  # Verification and testing of build goes here!

  echo Marking $PREPKG immutable...
  if ! sudo true ; then
    echo "Failed to sudo :("
    exit 1
  fi
  if ! sudo chattr +i $PREPKG $PREPKGCWS; then
    echo ""
    echo "WARNING: FAILED TO MARK $PREPKG or $PREPKGCWS IMMUTABLE."
    echo "DO NOT RERUN THIS SCRIPT AFTER SIGNING"
    echo ""
    read -p "(Press Enter to acknowledge)"
  fi
  chmod a-w $PREPKG
else
  echo "$PREPKG is immutable; good, not rebuilding it..."
fi

function sayhash { # $1 <-- HASH ; $2 <---SIGFILEBALL
  echo "Generating hash for CHROME"
  while read -p "Please enter a pastebin ID once the signature is pasted, or press Enter to read the hash aloud:  " INP && [ "$INP" = "" ] ; do
    cat $1 | (echo "(Parameter.set 'Duration_Stretch 1.5)"; \
                echo -n '(SayText "'; \
                sha1sum | sed 's/\(.\{5\}\)/\1./g' | cut -c1-48 | fold -1 | sed 's/^a$/alpha/; s/^b$/bravo/; s/^c$/charlie/; s/^d$/delta/; s/^e$/echo/; s/^f$/foxtrot/; s/^9$/niner/; s/^8$/ate/'; \
                echo '")' ) | festival
  done
  if [ $INP = "skip" ] ; then
    return
  fi
  if ! wget "http://pastebin.com/raw?i=$INP" --output-document="$2" ; then
    echo "Failed to wget http://pastebin.com/raw?i=$INP"
    exit 1
  fi
}

function offlinesign {  # $1 <-- PREPKG ; $2 <---SIGFILE
  echo HASH FOR SIGNING:
  SIGFILEBALL="$2.lzma.base64"
  #echo "(place the resulting raw binary signature in $SIGFILEBALL)"
  sha1sum $1 
  echo metahash for confirmation only $(sha1sum $1   |cut -d' ' -f1 | tr -d '\n' | sha1sum  | cut -c1-6) ...
  echo
  sayhash $1 $SIGFILEBALL
}

# let the user sign both things before putting them on the filesystem
function oncesigned {
  SIGFILEBALL="$2.lzma.base64"
  cat $SIGFILEBALL | tr -d '\r' | base64 -d | unlzma -c > $2 || exit 1
  if ! [ -f $2 ] ; then
    echo "Failed to find $2"'!'
    exit 1
  fi

  if file $2 | grep -qv " data" ; then
    echo "WARNING WARNING $2 does not look like a binary signature:"
    echo `file $2`
    #exit 1
  fi
}


#offlinesign $PREPKG $SIGFILE
offlinesign $PREPKGCWS $SIGFILECWS

#oncesigned $PREPKG $SIGFILE
oncesigned $PREPKGCWS $SIGFILECWS


UPDATETMP=pkg/$UPDATEFILE
#unzip -p $PREPKG $UPDATEFILE > $UPDATETMP
sed -e "s/VERSION/$TARGET/g" release-utils/updates-master.xml > $UPDATETMP

MENTIONS=`grep $TARGET $UPDATETMP | wc -l`
if [ $MENTIONS -eq 0 ] ; then
  echo $UPDATEFILE inside $PREPKG does not appear to specify an upgrade to $TARGET
  exit 1
elif [ $MENTIONS -ne 1 ] ; then
  echo $UPDATEFILE inside $PREPKG contains $TARGET a strange number of times "($MENTIONS)"
  exit 1
fi

function combinetocrx { # $1 <- PREPKG $2 <- SIGFILE $3 <-POSTPKG
  if ! release-utils/make-eff-crx-from-zip.sh $1 $2 ; then
    echo failed to make signed $3
    exit 1
  fi
  if ! [ -f $3 ] ; then
    echo $3 mysteriously does not exist
    exit 1
  fi
}

#combinetocrx $PREPKG $SIGFILE $POSTPKG
combinetocrx $PREPKGCWS $SIGFILECWS $POSTPKGCWS

