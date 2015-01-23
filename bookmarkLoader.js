// tested for Chrome, IE
javascript:(function(){
        var head = document.getElementsByTagName("head")[0];
        var scriptElement = document.createElement("script");
        scriptElement.src = <URL to Script>;	
        head.appendChild(scriptElement);
        head.removeChild(scriptElement);
})();
