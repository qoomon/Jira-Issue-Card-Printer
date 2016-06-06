# Jira-Issue-Card-Printer
Beautiful Jira Issue Card Printer

I've written a little bookmarklet for converting Jira issues in a pretty card layout for printing.

So long
Bengt

### Card Layout
![Card Layout](CardExample.png)

### Installation
#### Drag'n'Drop
got to [Instalation Site](https://qoomon.github.io/Jira-Issue-Card-Printer/bookmarkInstalation.html)

*or*

#### Manually
Create Bookmark with folowing content.
```
javascript:(function(){ var script = document.createElement("script"); script.src = "https://qoomon.github.io/Jira-Issue-Card-Printer/bookmarklet.js"; document.body.appendChild(script); document.body.removeChild(script);})();
```

### Usage
Just select Issue(s) then run the Bookmarklet.

Marker to separate description into print and no print area ("~~~~~")

#### Select multible issues
##### Jira Agile
holding STRG / CMD or SHIFT and click on issues
##### Jira Classic
just search for issues

### Support
#### Browser
* **Chrome Browsers 46+**
* **Safari 9+**.

#### Issue tracker
* **Jira**
* **Trello**
* **PivotTracker**
* **YouTrack**

###Info
I make use of **Google Analytics** to get some usage feedback. Please let me.
I will only track the **pageview** and the **amount of rendered cards**
**I do and will not track anything else**
