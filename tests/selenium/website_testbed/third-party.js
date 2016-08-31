
function setExpire() {
  var now = new Date();
  var time = now.getTime();
  var expireTime = time + 864000;
  now.setTime( expireTime );
  return ";expires=" + now.toGMTString();
}

//function setDomain() {
//  return ";domain=" + "eff-tracker-test.s3-website-us-west-2.amazonaws.com";
//}

function setPath() {
  return ";path=/";
}

function updateCookie( ) {
  var oldcookie = document.cookie;
  var val = "1234567890";
  console.log("read cookie: " + oldcookie);
  //document.cookie = "thirdpartytest=" + encodeURIComponent( val ) + setDomain() + setExpire() + setPath();
  document.cookie = "thirdpartytest=" + encodeURIComponent( val ) + setExpire() + setPath();
  //document.cookie = "a=b; domain=eff-tracker-test.s3-website-us-west-2.amazonaws.com";
  console.log("updating cookie to:" + document.cookie);
}

updateCookie();
