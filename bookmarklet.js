loadScripts(function(){
     if (window.jQuery === undefined) {  
          appendScript("//ajax.googleapis.com/ajax/libs/jquery/1.7.0/jquery.min.js", false);
     }
},function(){
    addGoogleAnalytics();
    init();
    main();
});

function main(){
    
    console.logLevel = console.INFO;

    printScopeDeviderToken1 = "~~~~~";
    printScopeDeviderToken2 = "<b>Attachment</b>"

    if(jQuery("#card-print-overlay").length > 0){
        alert("Print Card already opened!");
        return;
    }

    var issueKeyList = getSelectedIssueKeyList();
    if(issueKeyList.length <= 0){
        alert("Please select at least one issue.");
        return;
    }

    // Google Analytics
    ga('create', 'UA-50840116-3', 'auto', {'alwaysSendReferrer': true});
    ga('send', {
        'hitType': 'pageview',
        'page': '/jiracardprinter/Bookmarklet.js'
    });

    open(issueKeyList);
}


function open(issueKeyList) {

    jQuery(document).keyup(function(e) {
        if (e.keyCode == 27) {  // esc
            close();
        }  
    });

    jQuery("head").append(newPrintOverlayStyle);
    jQuery("body").append(newPrintOverlayHTML);

    var printFrame = jQuery("#card-print-dialog-content-iframe");
    var printWindow = printFrame[0].contentWindow;
    var printDocument = printWindow.document;

    printDocument.open();
    printDocument.write("<head/><body/>");
   
    jQuery("head", printDocument).append(newPrintPanelPageCSS());
    jQuery("head", printDocument).append(newPrintPanelCardCSS());
    
    console.logInfo("load " + issueKeyList.length + " issues...");
    jQuery("#card-print-dialog-title").text("Card Print   -   Loading... " + 0 + " / " + issueKeyList.length);
    var deferredList = [];
    issueKeyList.each(function(position, issueKey) {
        var card = newCardHTML(issueKey);
        card.hide();
        jQuery("body", printDocument).append(card);
        var deferred = new jQuery.Deferred()
        deferredList.push(deferred);
        loadCardDataJSON(issueKey, function(responseData) {
            fillCardWithJSONData(card, responseData); 
            card.show();
            resizeIframe(printFrame);
            jQuery("#card-print-dialog-title").text("Card Print   -   Loading... " + (position + 1) + " / " + issueKeyList.length);
            deferred.resolve();
        });
    });
    console.logInfo("wait for issues loaded...");

    jQuery.when.apply(jQuery, deferredList).done(function() {
        jQuery(printWindow).load(function(){
            jQuery("#card-print-dialog-title").text("Card Print");
            console.logInfo("everything loaded!");
            printWindow.print();
        })
        printDocument.close();
        console.logInfo("wait for resources loaded...");
    });
}

function close(){
    console.logInfo("close overlay");
     jQuery("#card-print-overlay").remove();
     jQuery("#card-print-overlay-style").remove();
}


function getSelectedIssueKeyList() {

    //JIRA
    if (jQuery("meta[name='application-name'][ content='JIRA']").length > 0) {
        //Browse
        if (/.*\/browse\/.*/g.test(document.URL)) {
            return jQuery("a[data-issue-key][id='key-val']").map(function() {
                return jQuery(this).attr('data-issue-key');
            });
        }

        // RapidBoard
        if (/.*\/secure\/RapidBoard.jspa.*/g.test(document.URL)) {
            return jQuery('div[data-issue-key].ghx-selected').map(function() {
                return jQuery(this).attr('data-issue-key');
            });
        }
    }

    return [];
}

function fillCardWithJSONData(card, data) {
    //Key
    var key = data.key; 
    console.logInfo("key: " + key);
    card.find('.key').text(key);

    //Type
    var type = data.fields.issuetype.name.toLowerCase();
    console.logInfo("type: " + type);
    card.find(".card").attr("type", type);
    
    //Summary
    var summary = data.fields.summary;
    console.logInfo("summary: " + summary);
    card.find('.summary').text(summary);

    //Description
    var description = data.renderedFields.description;
    console.logInfo("description: " + description);
    card.find('.description').html(description);

    //Assignee
    var assignee = data.fields.assignee;
    console.logInfo("assignee: " + assignee);
    if ( assignee ) {
        var avatarUrl = assignee.avatarUrls['48x48'];
        if(avatarUrl.indexOf("ownerId=") < 0){ 
            var displayName = assignee.displayName;
            //card.find(".assignee").css("background", stringToColor(displayName));
            card.find(".assignee").text(displayName[0]);
        }
        else {
            card.find(".assignee").css("background-image", "url('" + avatarUrl + "')");
        }  
    } else {
        card.find(".assignee").addClass("hidden"); 
    }

     //Due-Date
    var duedate = data.fields.duedate;
    console.logInfo("duedate: " + duedate);
    if ( duedate ) {
        var renderedDuedate = new Date(duedate).format('D d.m.');
        card.find(".due-date").text(renderedDuedate);
    } else {
        card.find(".due").addClass("hidden"); 
    }

    //Attachment  
    var hasAttachment = false;
    var indexOfPrintScopeDeviderToken = ((description.indexOf(printScopeDeviderToken2) + 1) || (description.indexOf(printScopeDeviderToken1) + 1)) - 1;
    if (indexOfPrintScopeDeviderToken >= 0) {
        var descriptionWithoutAttachment = description.substring(0, indexOfPrintScopeDeviderToken);
        card.find('.description').html(descriptionWithoutAttachment);
        hasAttachment = true;
    } else if (data.fields.attachment.length > 0) {
        hasAttachment = true;
    }
    console.logInfo("hasAttachment: " + hasAttachment);
    if ( hasAttachment ) {
    } else{
        card.find('.attachment').addClass('hidden');
    }

    //Story Points 
    var storyPoints = data.fields.storyPoints;
    console.logInfo("storyPoints: " + storyPoints);
    if (storyPoints) {
        card.find(".estimate").text(storyPoints);
    } else {
       card.find(".estimate").addClass("hidden"); 
    }

    //Epic
    var epicKey = data.fields.epicLink;
    console.logInfo("epicKey: " + epicKey);
    if ( epicKey ) {
        card.find(".epic-key").text(epicKey);
        loadCardDataJSON(epicKey, function(responseData) { 
            var epicName = responseData.fields.epicName; 
            console.logTrace("epicName: " + epicName);
            card.find(".epic-name").text(epicName);
        }, false);
    } else {
         card.find(".epic").addClass("hidden"); 
    }

    //QR-Code
    var qrCodeImageUrl = 'https://chart.googleapis.com/chart?cht=qr&chs=256x256&chld=L|1&chl=' + window.location.origin + "/browse/" + key;
    console.logTrace("qrCodeImageUrl: " + qrCodeImageUrl);
    card.find(".qr-code").css("background-image", "url('" + qrCodeImageUrl + "')");
    
    //handle Site specifics
    switch (window.location.hostname) {
        case "lrs-support.com": fillCardWithJSONDataLRS(card, data);
            break;
        default: 
    }
   
}

function fillCardWithJSONDataLRS(card, data) {
    console.logInfo("Apply LRS Specifics");
     //Desired-Date
    var desiredDate = data.fields.desiredDate;
    console.logInfo("desiredDate: " + desiredDate);
    if ( desiredDate ) {
        var renderedDesiredDate = new Date(desiredDate).format('D d.m.');
        card.find(".due-date").text(renderedDesiredDate);
        card.find(".due").removeClass("hidden"); 
    } else {
        card.find(".due").addClass("hidden"); 
    }
}


function loadCardDataJSON(issueKey, callback, async) {
    async = firstNotNull(async, true);

    //https://docs.atlassian.com/jira/REST/latest/
    var url = '/rest/api/2/issue/' + issueKey + '?expand=renderedFields,names';
    console.logInfo("IssueUrl: " + window.location.hostname + url);
    console.logDebug("Issue: " + issueKey + " Loading...");
    return  jQuery.ajax({
        type: 'GET',
        url: url,
        dataType: 'json',
        success: function(responseData){
            fields = responseData.fields;
            // add custom fields with field names 
            jQuery.each(responseData.names, function(key, value) {
                if(key.startsWith("customfield_")){
                    var newFieldId = value.toCamelCase();
                    console.logTrace("add new field: " + newFieldId +" with value from "+ key);
                    fields[value.toCamelCase()] = fields[key]; 
                }
            });
            console.logDebug("Issue: " + issueKey + " Loaded!");
            callback(responseData);
        },
        data: {},
        async: async
    });
}



//############################################################################################################################
//############################################################################################################################
//############################################################################################################################


// http://www.cssdesk.com/T9hXg

function newPrintOverlayHTML(){
    var result = jQuery(document.createElement('div'))
        .attr("id","card-print-overlay")
        .html(multilineString(function() {
                /*!
<div id="card-print-dialog">
    <div id="card-print-dialog-header">
      <div id="card-print-dialog-title">Card Print</div>
      <div id="buttons">
        <input id="card-print-dialog-print" type="button" class="aui-button aui-button-primary" value="Print" />
        <a id="card-print-dialog-cancel" title="Cancel" class="cancel">Cancel</a>
      </div>
    </div>
    <div id="card-print-dialog-content">
        <iframe id="card-print-dialog-content-iframe"></iframe>
    </div>
    <div id="card-print-dialog-footer"></div>
</div>
*/
            }));

    result.find("#card-print-dialog-print")
        .click(function(event){
            jQuery('#card-print-dialog-content-iframe')[0].contentWindow.print();
            return false;
        });

    result.find("#card-print-dialog-cancel")
        .click(function(event){
            close();
            return false;
        });

    result.click(function(event) {
        if( event.target == this ){
            close();
        }
        return false;
    });
    result.scroll(function(event) {
        return false;
    });
    
    return result;
}

function newPrintOverlayStyle(){
 var result = jQuery(document.createElement('style'))
        .attr("id", "card-print-overlay-style")
        .attr("type", "text/css")
        .html(multilineString(function() {
                /*!
#card-print-dialog-cancel {
    padding:5px 10px 5px 10px;
}
#card-print-overlay {
  position: fixed;
  height: 100%;
  width: 100%;
  top: 0;
  left: 0;
  background:rgba(0, 0, 0, 0.5);
  box-sizing: border-box;
  word-wrap:break-word;
  z-index: 99999;
}

#card-print-dialog {
  position: relative;

  top: 60px;
  right:0px;
  left:0px;
  
  height: calc(100% - 120px);
  width: 1000px;
  margin: auto;
  
  border-style: solid;
  border-color: #cccccc;
  border-width: 1px;
  -moz-border-radius: 4px;
  -webkit-border-radius: 4px;
  border-radius: 4px;
  
  overflow: hidden;
}

#card-print-dialog-header {
  position: relative;
  background: #f0f0f0;
  height: 25px;
  
  border-bottom: 1px solid #cccccc;
  
  padding: 15px 20px 15px 20px;
}

#card-print-dialog-content {
  position: relative;
  background: white;
  height: calc(100% - 106px);
  width: 100%;
  
  overflow-y: scroll;
}
#card-print-dialog-content-iframe {
  position: relative;
  height: 100%;
  width: 100%;
  border:none;
}

#card-print-dialog-footer {
  position: relative;
  background: #f0f0f0;
  border-top: 1px solid #cccccc;
  height: 30px;
  padding: 10px;
  text-align: right;
}

#buttons {
  position: relative;
  float: right;
  display: inline-block;
  height 30px;
}

#card-print-dialog-title{
  position: relative;
  float: left;
  color: rgb(51, 51, 51);
  display: block;
  font-family: Arial, sans-serif;
  font-size: 20px;
  font-weight: normal;
  height: 30px;
  line-height: 30px;
}
*/
            }));
    return result;
}


function newPrintPanelPageCSS(){

    var result = jQuery(document.createElement('style'))
        .attr("id", "printPanelPageStyle")
        .attr("type", "text/css")
        .html(multilineString(function() {
/*!
.page {
    position: relative;
    overflow: auto;
    margin-left: auto;
    margin-right: auto;
    width: auto;
    max-width: 29.7cm;
    min-width: 21cm;
    height: auto;
    page-break-after: always;
    
    background:rgba(256, 256, 256, 0.85);
    
    -webkit-box-shadow: 0px 0px 7px 3px rgba(31,31,31,0.4);
    -moz-box-shadow: 0px 0px 7px 3px rgba(31,31,31,0.4);
    box-shadow: 0px 0px 7px 3px rgba(31,31,31,0.4);

    border-style: solid;
    border-color: #bfbfbf;
    border-width: 0.05cm;
    -moz-border-radius: 0.1cm;
    -webkit-border-radius: 0.1cm;
    border-radius: 0.1cm;
    
    padding: 1.0cm;
    margin: 1.0cm;
    
    }
    
@media print {

.page {

    page-break-after: always;

    background:rgba(256, 256, 256, 0.0);
    border-style: none;
    padding: 0.0cm;
    margin: 0.0cm;

    -webkit-box-shadow: none;
    -moz-box-shadow: none;
    box-shadow: none;
    
    -webkit-print-color-adjust:exact;
    print-color-adjust: exact;

    -webkit-filter:opacity(1.0);
    filter:opacity(1.0);
}

.page:last-of-type {
    page-break-after: auto;
    }
}
*/
        }));

    return result;
}


// http://www.cssdesk.com/scHcP

function newCardHTML(issueKey){
    var card = jQuery(document.createElement('div'))
        .attr("id",issueKey)
        .addClass("page")
        .html(multilineString(function() {
                /*!
<div class="card">
    <div class="author">Bengt Brodersen - qoomon.com</div>
    <div class="card-border"></div>
    <div class="card-header">
        <div class="type-icon badge circular"></div>
        <div class="key badge"></div>
         <div class="estimate badge circular " contenteditable="true"></div>
        <div class="due">
            <div class="due-icon badge circular "></div>
            <div class="due-date badge" contenteditable="true"></div>
        </div>
    </div>
    <div class="card-content">
        <div class="content-header">
           <span class="summary" contenteditable="true"></span>
        </div>
        <div class="description" contenteditable="true"></div>
    </div>
    <div class="card-footer">
        <div class="assignee badge circular"></div>
        <div class="qr-code badge"></div>
        <div class="attachment badge circular"></div>
        <div class="epic badge">
          <span class="epic-key"></span>
          <span class="epic-name" contenteditable="true"></span>
        </div>
    </div>    
</div>
*/
            }));
    card.find('.key').text(issueKey);

    return card;
}

function newPrintPanelCardCSS(){
    var result = jQuery(document.createElement('style'))
        .attr("type", "text/css")
        .html(multilineString(function() {
                /*!
* {
    color: black;
    font-family:"Droid Serif";
}
body {
    margin: 0;
}
.hidden {
    visibility: hidden;
}
.card-header:after, 
.card-footer:after {
    content:" ";
    display: block;
    clear: both;
    height:0
}
.card-border, 
.badge, 
.shadow {
    border-style: solid;
    border-color: #2f2f2f;
    border-top-width: 0.14cm;
    border-left-width: 0.14cm;
    border-bottom-width: 0.24cm;
    border-right-width: 0.24cm;
    -webkit-border-radius: 0.25cm;
    border-radius: 0.25cm;
    // -webkit-filter: drop-shadow(0px 5px 10px black)
}
.circular {
    -moz-border-radius: 50%;
    -webkit-border-radius: 50%;
    border-radius: 50%;
}
.badge {
    width: 3.2cm;
    height: 3.2cm;
    background: #d0d0d0;
}

.card {
    position: relative;
    min-width: 21.0cm;
}
.author {
    z-index: 999;
    position: absolute;
    top:3.1cm;
    right:0.7cm;
    -webkit-transform-origin: 100% 100%;
    transform-origin: 100% 100%;
    -webkit-transform: rotate(-90deg);
    transform: rotate(-90deg);
    font-size: 0.4cm;
    color: DARKGREY;
}
.card-border {
    position: absolute;
    top:2.0cm;
    left:0.4cm;
    right:0.4cm;
    height: calc(100% - 4.0cm);
    background: #ffffff;

}
.card-header {
  position: relative;
}
.card-content {
    position: relative;
    margin-top: 0.3cm;
    margin-left: 1.0cm;
    margin-right: 1.1cm;
    margin-bottom: 0.2cm;
    min-height: 5.0cm;
}
.content-header {
    position: relative;
    font-size: 1.1cm;
    line-height: 1.1cm;
    margin-bottom: 0.6cm;
}
.card-footer {
    position: relative;
    page-break-inside: avoid;
}
.summary {
    font-weight: bold;
}
.description {
    font-size: 0.6cm;
    line-height: 0.6cm;
}
.key {
    position: absolute;
    float: left;
    width: auto;
    min-width: 4.4cm;
    height: 1.35cm;
    left: 2.8cm;
    margin-top: 1.05cm;
    padding-top: 0.2cm;
    padding-left: 0.9cm;
    padding-right: 0.4cm;
    text-align: center;
    font-weight: bold;
    font-size: 1.0cm;
    line-height: 1.30cm;
}
.type-icon {
    position: relative;
    float: left;
    background-color: GREENYELLOW;
    background-image: url(https://googledrive.com/host/0Bwgd0mVaLU_KU0N5b3JyRnJaNTA/resources/icons/Objects.png);
    background-repeat: no-repeat;
    -webkit-background-size: 70%;
    background-size: 70%;
    background-position: center;
    z-index: 1;
}

.card[type="story"] .type-icon {
    background-color: GOLD;
    background-image: url(https://googledrive.com/host/0Bwgd0mVaLU_KU0N5b3JyRnJaNTA/resources/icons/Bulb.png);
}
.card[type="bug"] .type-icon {
    background-color: CRIMSON;
    background-image: url(https://googledrive.com/host/0Bwgd0mVaLU_KU0N5b3JyRnJaNTA/resources/icons/Bug.png);
}
.card[type="epic"] .type-icon {
    background-color: ROYALBLUE;
    background-image: url(https://googledrive.com/host/0Bwgd0mVaLU_KU0N5b3JyRnJaNTA/resources/icons/Flash.png);
}

.estimate {
    position: relative;
    float: left;
    left: -0.65cm;
    top:-1.5cm;
    height: 1.1cm;
    width: 1.1cm;
    text-align: center;
    font-weight: bold;
    font-size: 1cm;
    line-height: 1.15cm;
    margin-top:1.5cm;
    z-index: 999;
}

.due {
    position: relative;
    float: right;
}
.due-icon {
    position: relative;
    float:right;
    width: 2.5cm;
    height: 2.5cm;
    margin-top: 0.35cm;
    background-color: MEDIUMPURPLE;
    background-image: url(https://googledrive.com/host/0Bwgd0mVaLU_KU0N5b3JyRnJaNTA/resources/icons/AlarmClock.png);
    background-repeat: no-repeat;
    -webkit-background-size: 65%;
    background-size: 65%;
    background-position: center;
    z-index: 1;
}
.due-date {
    position: relative;
    float: right;
    right: -0.6cm;
    width: auto;
    min-width: 2.8cm;
    height: auto;
    margin-top: 1.3cm;
    padding-top: 0.3cm;
    padding-bottom: 0.2cm;
    padding-left: 0.3cm;
    padding-right: 0.6cm;
    text-align: center;
    font-weight: bold;
    font-size: 0.7cm;
    line-height: 0.7cm;
}
.attachment {
    position: relative;
    float: left;
    margin-left: 0.6cm;
    width: 2.1cm;
    height: 2.1cm;
    background-color: LIGHTSKYBLUE;
    background-image: url(https://images.weserv.nl/?url=www.iconsdb.com/icons/download/color/2f2f2f/attach-256.png);
    background-repeat: no-repeat;
    -webkit-background-size: 70%;
    background-size: 70%;
    background-position: center;
    
}
.assignee {
    position: relative;
    float: right;
    width: 2.1cm;
    height: 2.1cm;
    text-align: center;
    font-weight: bold;
    font-size: 2.0cm;
    line-height: 2.5cm;
    padding-left: 0.1cm;
    background-image: url(https://images.weserv.nl/?url=www.iconsdb.com/icons/download/color/aaaaaa/contacts-256.png);
    background-repeat: no-repeat;
    -webkit-background-size: cover;
    background-size: cover;
    -webkit-background-size: 100%;
    background-size: 100%;
    -webkit-filter: contrast(150%) grayscale(100%);
    filter: contrast(150%) grayscale(100%);
    background-position: center;
}
.qr-code {
    position: relative;
    float: left;
    width: 2.1cm;
    height: 2.1cm;
    background-image: url(https://chart.googleapis.com/chart?cht=qr&chs=256x256&chld=L|1&chl=blog.qoomon.com);
    background-repeat: no-repeat;
    -webkit-background-size: cover;
    background-size: cover;
    background-position: center;
}
.epic {
    width: auto;
    height: auto;
    position: relative;
    float:right;
    margin-right:0.6cm;
    padding-top: 0.2cm;
    padding-bottom: 0.2cm;
    padding-left: 0.3cm;
    padding-right: 0.3cm;
    text-align: left;
    font-size: 0.7cm;
    line-height: 0.7cm;
    max-width: calc( 100% - 10.2cm);
}
.epic-key {
}
.epic-name {
    font-weight: bold;
}
*/
            }));
    return result;
}

//############################################################################################################################
//############################################################################################################################
//############################################################################################################################
function loadScripts(load, callback){
   
    load();

    var head = document.getElementsByTagName('head')[0];
    var script = document.createElement('script');
    script.src = "https://qoomon.github.io/void.js";
    script.async = false;
    
     // Then bind the event to the callback function.
    // There are several events for cross browser compatibility.
    script.onreadystatechange = callback;
    script.onload = callback;
    
    head.appendChild(script);
}

function appendScript(src, async) {
            var head = document.getElementsByTagName('head')[0];
            console.log("add script " + src);
            var script = document.createElement('script');
            script.src = src;
            script.async = async;
            head.appendChild(script);
}

function init() {
     //jQuery Extention
     jQuery.expr[':']['is'] = function(node, index, props){
      return node.textContent == props[3];
    }
     
    loadLoggingFunctions();
    loadStringFunctions();
    
    Date.prototype.format = function(format) {
        var returnStr = '';
        var replace = Date.replaceChars;
        for (var i = 0; i < format.length; i++) {       var curChar = format.charAt(i);         if (i - 1 >= 0 && format.charAt(i - 1) == "\\") {
                returnStr += curChar;
            }
            else if (replace[curChar]) {
                returnStr += replace[curChar].call(this);
            } else if (curChar != "\\"){
                returnStr += curChar;
            }
        }
        return returnStr;
    };
    
    Date.replaceChars = {
        shortMonths: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
        longMonths: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
        shortDays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
        longDays: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    
        // Day
        d: function() { return (this.getDate() < 10 ? '0' : '') + this.getDate(); },
        D: function() { return Date.replaceChars.shortDays[this.getDay()]; },
        j: function() { return this.getDate(); },
        l: function() { return Date.replaceChars.longDays[this.getDay()]; },
        N: function() { return this.getDay() + 1; },
        S: function() { return (this.getDate() % 10 == 1 && this.getDate() != 11 ? 'st' : (this.getDate() % 10 == 2 && this.getDate() != 12 ? 'nd' : (this.getDate() % 10 == 3 && this.getDate() != 13 ? 'rd' : 'th'))); },
        w: function() { return this.getDay(); },
        z: function() { var d = new Date(this.getFullYear(),0,1); return Math.ceil((this - d) / 86400000); }, // Fixed now
        // Week
        W: function() { var d = new Date(this.getFullYear(), 0, 1); return Math.ceil((((this - d) / 86400000) + d.getDay() + 1) / 7); }, // Fixed now
        // Month
        F: function() { return Date.replaceChars.longMonths[this.getMonth()]; },
        m: function() { return (this.getMonth() < 9 ? '0' : '') + (this.getMonth() + 1); },
        M: function() { return Date.replaceChars.shortMonths[this.getMonth()]; },
        n: function() { return this.getMonth() + 1; },
        t: function() { var d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 0).getDate() }, // Fixed now, gets #days of date
        // Year
        L: function() { var year = this.getFullYear(); return (year % 400 == 0 || (year % 100 != 0 && year % 4 == 0)); },   // Fixed now
        o: function() { var d  = new Date(this.valueOf());  d.setDate(d.getDate() - ((this.getDay() + 6) % 7) + 3); return d.getFullYear();}, //Fixed now
        Y: function() { return this.getFullYear(); },
        y: function() { return ('' + this.getFullYear()).substr(2); },
        // Time
        a: function() { return this.getHours() < 12 ? 'am' : 'pm'; },
        A: function() { return this.getHours() < 12 ? 'AM' : 'PM'; },
        B: function() { return Math.floor((((this.getUTCHours() + 1) % 24) + this.getUTCMinutes() / 60 + this.getUTCSeconds() / 3600) * 1000 / 24); }, // Fixed now
        g: function() { return this.getHours() % 12 || 12; },
        G: function() { return this.getHours(); },
        h: function() { return ((this.getHours() % 12 || 12) < 10 ? '0' : '') + (this.getHours() % 12 || 12); },
        H: function() { return (this.getHours() < 10 ? '0' : '') + this.getHours(); },
        i: function() { return (this.getMinutes() < 10 ? '0' : '') + this.getMinutes(); },
        s: function() { return (this.getSeconds() < 10 ? '0' : '') + this.getSeconds(); },
        u: function() { var m = this.getMilliseconds(); return (m < 10 ? '00' : (m < 100 ?
    '0' : '')) + m; },
        // Timezone
        e: function() { return "Not Yet Supported"; },
        I: function() {
            var DST = null;
                for (var i = 0; i < 12; ++i) {
                        var d = new Date(this.getFullYear(), i, 1);
                        var offset = d.getTimezoneOffset();
    
                        if (DST === null) DST = offset;
                        else if (offset < DST) { DST = offset; break; }                     else if (offset > DST) break;
                }
                return (this.getTimezoneOffset() == DST) | 0;
            },
        O: function() { return (-this.getTimezoneOffset() < 0 ? '-' : '+') + (Math.abs(this.getTimezoneOffset() / 60) < 10 ? '0' : '') + (Math.abs(this.getTimezoneOffset() / 60)) + '00'; },
        P: function() { return (-this.getTimezoneOffset() < 0 ? '-' : '+') + (Math.abs(this.getTimezoneOffset() / 60) < 10 ? '0' : '') + (Math.abs(this.getTimezoneOffset() / 60)) + ':00'; }, // Fixed now
        T: function() { var m = this.getMonth(); this.setMonth(0); var result = this.toTimeString().replace(/^.+ \(?([^\)]+)\)?$/, '$1'); this.setMonth(m); return result;},
        Z: function() { return -this.getTimezoneOffset() * 60; },
        // Full Date/Time
        c: function() { return this.format("Y-m-d\\TH:i:sP"); }, // Fixed now
        r: function() { return this.toString(); },
        U: function() { return this.getTimep() / 1000; }
    };

}



function addGoogleAnalytics() {
    // Google Analytics
    (function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
          (i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),
          m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
          })(window,document,'script','//www.google-analytics.com/analytics.js','ga');
}

function loadLoggingFunctions() {

    console.ERROR = 0;
    console.WARN  = 1;
    console.INFO  = 2;
    console.DEBUG = 3;
    console.TRACE = 4;

    console.logLevel = console.INFO ;

    console.logError = function(msg){
        if(console.logLevel >= console.ERROR ) {
            console.log("ERROR: " + msg);
        }
    }

    console.logWarn = function(msg){
         if(console.logLevel >= console.WARN ) {
            console.log("WARN:  " + msg);
        }
    }

    console.logInfo = function(msg){
         if(console.logLevel >= console.INFO ) {
            console.log("INFO:  " + msg);
        }
    }

    console.logDebug = function(msg){
        if(console.logLevel >= console.DEBUG ) {
            console.log("DEBUG: " + msg);
        }
    }

    console.logTrace = function(msg){
         if(console.logLevel >= console.TRACE ) {
            console.log("TRACE: " + msg);
        }
    }
}

function loadStringFunctions() {

    //trim string - remove leading and trailing whitespaces
    if (!String.prototype.trim) {
        String.prototype.trim = function() {
            return this.replace(/^\s+|\s+$/g, '');
        };
    }

    if (!String.prototype.startsWith) {
        String.prototype.startsWith = function (str){
            return this.slice(0, str.length) == str;
        };
    }

    if (!String.prototype.endsWith) {
        String.prototype.endsWith = function (str){
            return this.slice(-str.length) == str;
        };
    }

    if (!String.prototype.toCamelCase) {
        String.prototype.toCamelCase = function() {
            // remove all characters that should not be in a variable name
            // as well underscores an numbers from the beginning of the string
            var s = this.replace(/([^a-zA-Z0-9_\- ])|^[_0-9]+/g, "").trim().toLowerCase();
            // uppercase letters preceeded by a hyphen or a space
            s = s.replace(/([ -]+)([a-zA-Z0-9])/g, function(a,b,c) {
                return c.toUpperCase();
            });
            // uppercase letters following numbers
            s = s.replace(/([0-9]+)([a-zA-Z])/g, function(a,b,c) {
                return b + c.toUpperCase();
            });
            return s;
        }
    }
}







//############################################################################################################################
//############################################################################################################################
//############################################################################################################################


function firstNotNull(arg, def) {
   return (arg != undefined && arg != null) ? arg : def;
}



function generateHTMLWithAbsolutePathes(html) {
    var absoultePath = function(index, href) {
        var link = link || document.createElement("a");
        link.href = href;
        return (link.protocol + "//" + link.host + link.pathname + link.search + link.hash);
    };

    jQuery(html).find('[href]').not('[href^="http"],[href^="https"],[href^="mailto:"],[href^="#"]').each(function() {
        jQuery(this).attr('href', absoultePath);
    });
    jQuery(html).find('[src]').not('[src^="http"],[src^="https"]').each(function() {
        jQuery(this).attr('src', absoultePath);
    });

    return html;
}

function multilineString(commentFunction) {
    return commentFunction.toString()
        .replace(/^[^\/]+\/\*!?/, '')
        .replace(/\*\/[^\/]+$/, '');
}

/**
 * Retrieve nested item from object/array
 * @param {Object|Array} obj
 * @param {String} path dot separated
 * @param {*} def default value ( if result undefined )
 * @returns {*}
 */
function getProperty(obj, path, def){
    for(var i = 0,path = path.split('.'),len = path.length; i < len; i++){
        if(!obj || typeof obj !== 'object') return def;
        obj = obj[path[i]];
    }

    if(obj === undefined) return def;
    return obj;
}

function resizeIframe(iframe) {
    iframe.height(iframe[0].contentWindow.document.body.scrollHeight);
}

/********************************************************
Name: str_to_color
Description: create a hash from a string then generates a color
Usage: alert('#'+str_to_color("Any string can be converted"));
author: Brandon Corbin [code@icorbin.com]
website: http://icorbin.com
********************************************************/

function stringToColor(str) {
    'use strict';
    // Generate a Hash for the String
    var hash = function(word) {
        var h = 0;
        for (var i = 0; i < word.length; i++) {
            h = word.charCodeAt(i) + ((h << 5) - h);
        }
        return h;
    };

    // Change the darkness or lightness
    var shade = function(color, prc) {
        var num = parseInt(color, 16),
            amt = Math.round(2.55 * prc),
            R = (num >> 16) + amt,
            G = (num >> 8 & 0x00FF) + amt,
            B = (num & 0x0000FF) + amt;
        return (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
            (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
            (B < 255 ? B < 1 ? 0 : B : 255))
            .toString(16)
            .slice(1);

    };
    // Convert init to an RGBA
    var int_to_rgba = function(i) {
        var color = ((i >> 24) & 0xFF).toString(16) +
            ((i >> 16) & 0xFF).toString(16) +
            ((i >> 8) & 0xFF).toString(16) +
            (i & 0xFF).toString(16);
        return color;
    };

    return '#'+shade(int_to_rgba(hash(str)), -10);

}
