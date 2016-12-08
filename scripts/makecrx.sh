#!/bin/bash
VERSION=`grep '"version":' manifest.json | cut -c14- | sed 's/[",[:space:]\n]//g'`
PREFIX=privacy_badger
name=$PREFIX-$VERSION
key=scripts/dummy-chromium.pem
pub=scripts/$name.pub
sig=scripts/$name.sig
zip=$name.zip
crx=$name.crx

trap 'rm -f "$pub" "$sig" "$zip"' EXIT

# signature
openssl sha1 -sha1 -binary -sign "$key" < "$zip" > "$sig"

# public key
openssl rsa -pubout -outform DER < "$key" > "$pub" 2>/dev/null

echo making $crx                                                                
byte_swap () {                                                                  
  # Take "abcdefgh" and return it as "ghefcdab"                                 
  echo "${1:6:2}${1:4:2}${1:2:2}${1:0:2}"                                       
}                                                                               
                                                                                
crmagic_hex="4372 3234" # Cr24                                                  
version_hex="0200 0000" # 2                                                     
pub_len_hex=$(byte_swap $(printf '%08x\n' $(ls -l "$pub" | awk '{print $5}')))  
sig_len_hex=$(byte_swap $(printf '%08x\n' $(ls -l "$sig" | awk '{print $5}')))  
(                                                                               
  echo "$crmagic_hex $version_hex $pub_len_hex $sig_len_hex" | xxd -r -p        
  cat "$pub" "$sig" "$zip"                                                      
) > "$crx"                                                                      
echo >&2 "Created $crx"            
