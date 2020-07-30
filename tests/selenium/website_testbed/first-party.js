function setExpire() {
	var now = new Date();
	var time = now.getTime();
	var expireTime = time + 864000;
	now.setTime(expireTime);
	return ";expires=" + now.toGMTString();
}

function setPath() {
	return ";path=/";
}

function setSameSite() {
	return ";SameSite=None;Secure";
}

function updateCookie() {
	var oldcookie = document.cookie;
	var val = "1234567890";
	console.log("read cookie: " + oldcookie);
	document.cookie = "localtest=" + encodeURIComponent(val) + setExpire() + setPath() + setSameSite();
	console.log("updating cookie to:" + document.cookie);
}

updateCookie();
