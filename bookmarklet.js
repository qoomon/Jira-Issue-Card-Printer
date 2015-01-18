var isDev = document.querySelector('[qoomon_dev]') != null;

// <GoogleAnalytics>
(function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
  (i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),
  m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
})(window,document,'script','//www.google-analytics.com/analytics.js','ga');

ga('create', 'UA-50840116-3', 'auto', {'alwaysSendReferrer': true});
ga('send', {'hitType': 'pageview', 'page': '/jiracardprinter/Bookmarklet.js'});
// </GoogleAnalytics>

// load jQuery
if (window.jQuery === undefined) {
  appendScript('//ajax.googleapis.com/ajax/libs/jquery/1.7.0/jquery.min.js');
}

// wait untill all scripts loaded
appendScript('https://qoomon.github.io/void', function(){
  init();
  main();
});

function init(){
  addJQueryFunctions();
  addConsoleFunctions();
  addStringFunctions();
  addDateFunctions();

  printScopeDeviderToken = "<b>Attachment</b>";

  hostOrigin = "https://qoomon.github.io/Jira-Issue-Card-Printer/";
  if(isDev){
    alert("Develop Version");
    hostOrigin = "https://rawgit.com/qoomon/Jira-Issue-Card-Printer/develop/";
  }
  resourceOrigin = hostOrigin+ "resources/";

  cors = "https://cors-anywhere.herokuapp.com/";
  //$("#card").load("https://cors-anywhere.herokuapp.com/"+"https://qoomon.github.io/Jira-Issue-Card-Printer/card.html");

  console.logLevel = console.INFO;
}

function main(){
  //preconditions
  if(jQuery("#card-print-overlay").length > 0){
    alert("Print Card already opened!");
    return;
  }

  var issueKeyList = getSelectedIssueKeyList();
  if(issueKeyList.length <= 0){
    alert("Please select at least one issue.");
    return;
  }

  // open print preview
  jQuery("head").append(printOverlayStyle);
  jQuery("body").append(printOverlayHTML);

  jQuery("#card-print-dialog-title").text("Card Print   -   Loading " + issueKeyList.length + " issues...");
  renderCards(issueKeyList, function(){
    jQuery("#card-print-dialog-title").text("Card Print");
    jQuery('#card-print-dialog-content-iframe')[0].contentWindow.print();
  });
}

function renderCards(issueKeyList, callback) {

  var printFrame = jQuery("#card-print-dialog-content-iframe");
  var printWindow = printFrame[0].contentWindow;
  var printDocument = printWindow.document;

  printDocument.open();
  printDocument.write("<head/><body/>");

  jQuery("head", printDocument).append(printPanelPageCSS());
  jQuery("head", printDocument).append(printPanelCardCSS());

  console.logInfo("load " + issueKeyList.length + " issues...");

  var deferredList = [];

  issueKeyList.each(function(position, issueKey) {
    var page = newPage(issueKey);
    page.hide();
    page.find('.key').text(issueKey);
    jQuery("body", printDocument).append(page);
    var deferred = addDeferred(deferredList);
    loadCardDataJSON(issueKey, function(responseData) {
      fillCardWithJSONData(page, responseData);
      page.show();
      resizeIframe(printFrame);
      deferred.resolve();
    });
  });
  console.logInfo("wait for issues loaded...");

  applyDeferred(deferredList,function() {
    console.logInfo("...all issues loaded.");
    jQuery(printWindow).load(function(){
      console.logInfo("...all resources loaded.");
      callback();
    })
    printDocument.close();
    console.logInfo("wait for resources loaded...");
  });
}

function closePrintPreview(){
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
  console.logDebug("key: " + key);
  card.find('.key').text(key);

  //Type
  var type = data.fields.issuetype.name.toLowerCase();
  console.logDebug("type: " + type);
  card.find(".card").attr("type", type);

  //Summary
  var summary = data.fields.summary;
  console.logDebug("summary: " + summary);
  card.find('.summary').text(summary);

  //Description
  var description = data.renderedFields.description;
  console.logDebug("description: " + description);
  card.find('.description').html(description);

  //Assignee
  var assignee = data.fields.assignee;
  console.logDebug("assignee: " + assignee);
  if ( assignee ) {
    var avatarUrl = assignee.avatarUrls['48x48'];
    if(avatarUrl.indexOf("ownerId=") < 0){
      var displayName = assignee.displayName;
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
  console.logDebug("duedate: " + duedate);
  if ( duedate ) {
    var renderedDuedate = new Date(duedate).format('D d.m.');
    card.find(".due-date").text(renderedDuedate);
  } else {
    card.find(".due").addClass("hidden");
  }

  //Attachment
  var hasAttachment = false;
  var indexOfPrintScopeDeviderToken =  description.indexOf(printScopeDeviderToken);
  if (indexOfPrintScopeDeviderToken >= 0) {
    var descriptionWithoutAttachment = description.substring(0, indexOfPrintScopeDeviderToken);
    card.find('.description').html(descriptionWithoutAttachment);
    hasAttachment = true;
  } else if (data.fields.attachment.length > 0) {
    hasAttachment = true;
  }
  console.logDebug("hasAttachment: " + hasAttachment);
  if ( hasAttachment ) {
  } else{
    card.find('.attachment').addClass('hidden');
  }

  //Story Points
  var storyPoints = data.fields.storyPoints;
  console.logDebug("storyPoints: " + storyPoints);
  if (storyPoints) {
    card.find(".estimate").text(storyPoints);
  } else {
    card.find(".estimate").addClass("hidden");
  }

  //Epic
  var epicKey = data.fields.epicLink;
  console.logDebug("epicKey: " + epicKey);
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
    console.logDebug("desiredDate: " + desiredDate);
    if ( desiredDate ) {
      var renderedDesiredDate = new Date(desiredDate).format('D d.m.');
      card.find(".due-date").text(renderedDesiredDate);
      card.find(".due").removeClass("hidden");
    } else {
      card.find(".due").addClass("hidden");
    }
  }


  function loadCardDataJSON(issueKey, callback) {

    //https://docs.atlassian.com/jira/REST/latest/
    var url = '/rest/api/2/issue/' + issueKey + '?expand=renderedFields,names';
    console.logDebug("IssueUrl: " + window.location.hostname + url);
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
    });
  }



//############################################################################################################################
//############################################################################################################################
//############################################################################################################################


// http://www.cssdesk.com/T9hXg

function printOverlayHTML(){


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

  // print

  result.find("#card-print-dialog-print")
  .click(function(event){
    jQuery('#card-print-dialog-content-iframe')[0].contentWindow.print();
    return false;
  });

  // closePrintPreview

  result.find("#card-print-dialog-cancel")
  .click(function(event){
    closePrintPreview();
    return false;
  });

  result.click(function(event) {
    if( event.target == this ){
      closePrintPreview();
    }
    return false;
  });

  jQuery(document).keyup(function(e) {
    if (e.keyCode == 27) {  // esc
      closePrintPreview();
    }
  });

  // prevent background scrolling
  result.scroll(function(event) {
    return false;
  });

  return result;
}

function printOverlayStyle(){
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


function printPanelPageCSS(){

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

function newPage(issueKey){
  var page = jQuery(document.createElement('div'))
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

  return page;
}

function printPanelCardCSS(){
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
  background-image: url({RESOURCE_ORIGIN}icons/Objects.png);
  background-repeat: no-repeat;
  -webkit-background-size: 70%;
  background-size: 70%;
  background-position: center;
  z-index: 1;
}
.card[type="story"] .type-icon {
  background-color: GOLD;
  background-image: url({RESOURCE_ORIGIN}icons/Bulb.png);
}
.card[type="bug"] .type-icon {
  background-color: CRIMSON;
  background-image: url({RESOURCE_ORIGIN}icons/Bug.png);
}
.card[type="epic"] .type-icon {
  background-color: ROYALBLUE;
  background-image: url({RESOURCE_ORIGIN}icons/Flash.png);
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
  background-image: url({RESOURCE_ORIGIN}icons/AlarmClock.png);
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
  background-image: url({RESOURCE_ORIGIN}icons/Attachment.png);
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
  background-image: url({RESOURCE_ORIGIN}icons/Person.png);
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
}).replace(/{RESOURCE_ORIGIN}/g, resourceOrigin));
  return result;
}

//############################################################################################################################
//############################################################################################################################
//############################################################################################################################

function appendScript(url, callback){

  var head = document.getElementsByTagName('head')[0];
  var script = document.createElement('script');
  script.src = url;

  // Then bind the event to the callback function.
  // There are several events for cross browser compatibility.
  script.onreadystatechange = callback;
  script.onload = callback;

  head.appendChild(script);
}

//############################################################################################################################
//############################################################################################################################
//############################################################################################################################

function addDeferred(deferredList){
  var deferred = new jQuery.Deferred()
  deferredList.push(deferred);
  return deferred;
}

function applyDeferred(deferredList, callback){
  jQuery.when.apply(jQuery, deferredList).done(callback);
}

//############################################################################################################################
//############################################################################################################################
//############################################################################################################################


function addJQueryFunctions() {
  //jQuery Extention
  jQuery.expr[':']['is'] = function(node, index, props){
    return node.textContent == props[3];
  }
}


function addConsoleFunctions() {

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

function addStringFunctions() {

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

function addDateFunctions() {

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
  u: function() { var m = this.getMilliseconds(); return (m < 10 ? '00' : (m < 100 ? '0' : '')) + m; },
  // Timezone
  e: function() { return "Not Yet Supported"; },
  I: function() {
    var DST = null;
    for (var i = 0; i < 12; ++i) {
      var d = new Date(this.getFullYear(), i, 1);
      var offset = d.getTimezoneOffset();
      if (DST === null) DST = offset;
      else if (offset < DST) { DST = offset; break; }
        else if (offset > DST) break;
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

function multilineString(commentFunction) {
  return commentFunction.toString()
  .replace(/^[^\/]+\/\*!?/, '')
  .replace(/\*\/[^\/]+$/, '');
}


function resizeIframe(iframe) {
  iframe.height(iframe[0].contentWindow.document.body.scrollHeight);
}
