// tested for Chrome, IE
javascript:(function(){
        var head = document.getElementsByTagName("head")[0];
        var scriptElement = document.createElement("script");
        scriptElement.src = 'https://qoomon.github.io/Jira-Issue-Card-Printer/bookmarklet.js';	
        head.appendChild(scriptElement);
        head.removeChild(scriptElement);
})();
