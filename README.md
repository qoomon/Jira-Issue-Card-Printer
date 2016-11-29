# Issue-Card-Printer
Beautiful Issue Card Printer

I've written a little bookmarklet for converting digital issues in a pretty card layout for printing.

So long
Bengt

## Licence
It is free for personal and professional purpose.

**You are not allowed to change and host this boockmarklet under your own github account.**

You may fork this project to contribute.

### Card Layout
![Card Layout](CardExample.png)

### Installation
#### Drag'n'Drop
go to [Installation Site](https://qoomon.github.io/Jira-Issue-Card-Printer/bookmarkInstallation.html)

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
##### Jira
###### Jira Agile
holding STRG / CMD or SHIFT and click on issues
###### Jira Classic
just search for issues
##### Trello
###### read-only access Boards 
select the columns by click on the title so they get highlighted
###### write access Boards 
select a column by open the add new card input for spesific column


### Support
#### Browser
* **Chrome Browsers 46+**
* **Safari 9+**.

#### Issue tracker
* **Jira**
* **Trello**
* **PivotTracker**
* **YouTrack**
* **TeamForge**

###Info
I make use of **Google Analytics** to get some usage feedback. Please let me.
I will only track the **pageview** and the **amount of rendered cards**
**I do and will not track anything else**
