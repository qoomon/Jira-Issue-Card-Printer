var read = function(name) {
    var cookies = document.cookie.split('; ');

    for (var i = 0; i < cookies.length; i++) {
        var cookie = cookies[i].split('=');
        if (cookie[0] == name) return cookie[1];
    }
    return null;
}

var write = function(name, value) {
    var expireDate = new Date();  // current date & time
    expireDate.setFullYear(expireDate.getFullYear() + 1) // one year
    document.cookie = name + "=" + value + "; Path=/; expires=" + expireDate.toGMTString();

    // cleanup due to former Path
    document.cookie = name + "=; expires=" + new Date(0).toGMTString();
}

module.exports = {
    read:read,
    write:write
};

