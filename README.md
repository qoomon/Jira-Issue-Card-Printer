# Jira-Issue-Card-Printer
Beautiful Jira Issue Card Printer

I've written a little bookmarklet for converting Jira issues in a pretty card layout for printing.

So long
Bengt

### Card Layout
![Card Layout](http://4.bp.blogspot.com/-BgfPtVWFxVo/VLTjiqpPzjI/AAAAAAAAGLw/PgF3D6eq35c/s1600/Screen%2BShot%2B2015-01-13%2Bat%2B10.19.22.png)

### Installation
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
search for issues und select *List View* 

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
