(function() {
    var version = "4.0.6";
    console.log("Version: " + version);

    var global = {};
    global.isDev = /.*jira.atlassian.com\/secure\/RapidBoard.jspa\?.*projectKey=ANERDS.*/g.test(document.URL) // Jira
        || /.*pivotaltracker.com\/n\/projects\/510733.*/g.test(document.URL) // PivotTracker
        || ( /.*trello.com\/.*/g.test(document.URL) && jQuery("span.js-member-name").text() =='Bengt Brodersen'); // Trello
    global.isProd = !global.isDev;

    window.addEventListener("error", function(event) {
        var error = event.error;
        console.log("ERROR: " + error.stack);
        if (global.isProd) {
            ga('send', 'exception', {
                'exDescription': error.message,
                'exFatal': true
            });
        }
    });

    // load jQuery
    if (window.jQuery === undefined) {
        appendScript('//ajax.googleapis.com/ajax/libs/jquery/1.7.0/jquery.min.js');
    }

    // wait untill all scripts loaded
    appendScript('https://qoomon.github.io/void', function() {
        main();
    });

    function main() {
        init();

        // determine application
        if (jQuery("meta[name='application-name'][ content='JIRA']").length > 0) {
            console.log("App: " + "Jira");
            global.appFunctions = jiraFunctions;
        } else if (/.*pivotaltracker.com\/.*/g.test(document.URL)) {
            console.log("App: " + "PivotalTracker");
            global.appFunctions = pivotalTrackerFunctions;
        } else if (/.*trello.com\/.*/g.test(document.URL)) {
            console.log("App: " + "Trello");
            global.appFunctions = trelloFunctions;
        } else {
            alert("Unsupported app.Please create an issue at https://github.com/qoomon/Jira-Issue-Card-Printer");
            return;
        }

        //preconditions
        if (jQuery("#card-print-overlay").length > 0) {
            alert("Print Card already opened!");
            return;
        }

        // collect selcted issues
        var issueKeyList = global.appFunctions.getSelectedIssueKeyList();
        if (issueKeyList.length <= 0) {
            alert("Please select at least one issue.");
            return;
        }

        // open print preview
        jQuery("body").append(printOverlayHTML());
        jQuery("#card-print-overlay").prepend(printOverlayStyle());

        var printFrame = jQuery("#card-print-dialog-content-iframe");
        var printWindow = printFrame[0].contentWindow;
        printWindow.addEventListener("resize", function(){redrawCards();});
        printWindow.matchMedia("print").addListener(function(){redrawCards();});

        jQuery("#rowCount").val(readCookie("card_printer_row_count",2));
        jQuery("#columnCount").val(readCookie("card_printer_column_count",1));
        //jQuery("#font-scale-range").val(readCookie("card_printer_font_scale",1));
        jQuery("#single-card-page-checkbox").attr('checked',readCookie("card_printer_single_card_page", 'true' ) == 'true');
        jQuery("#hide-description-checkbox").attr('checked',readCookie("card_printer_hide_description", 'false') == 'true');

        jQuery("#card-print-dialog-title").text("Card Print   -   Loading " + issueKeyList.length + " issues...");
        renderCards(issueKeyList, function() {
            jQuery("#card-print-dialog-title").text("Card Print");
            //print();
        });

        if (global.isProd) {
            ga('send', 'pageview');
        }
    }

    function init() {
        addStringFunctions();
        addDateFunctions();

        global.hostOrigin = "https://qoomon.github.io/Jira-Issue-Card-Printer/";
        if (global.isDev) {
            console.log("DEVELOPMENT");
            global.hostOrigin = "https://rawgit.com/qoomon/Jira-Issue-Card-Printer/develop/";
        }
        global.resourceOrigin = global.hostOrigin + "resources/";

        if (global.isProd){
            initGoogleAnalytics();
        }
    }

    function print() {
        var printFrame = jQuery("#card-print-dialog-content-iframe");
        var printWindow = printFrame[0].contentWindow;
        var printDocument = printWindow.document;

        if (global.isProd) {
            ga('send', 'event', 'button', 'click', 'print', jQuery(".card", printDocument).length);
        }

        printWindow.print();
    }

    function renderCards(issueKeyList, callback) {

        var printFrame = jQuery("#card-print-dialog-content-iframe");
        var printWindow = printFrame[0].contentWindow;
        var printDocument = printWindow.document;

        printDocument.open();
        printDocument.write("<head/><body></body>");

        jQuery("head", printDocument).append(cardCss());
        jQuery("body", printDocument).append("<div id='preload'/>");
        jQuery("#preload", printDocument).append("<div class='zigzag'/>");

        console.log("load " + issueKeyList.length + " issues...");

        var deferredList = [];
        jQuery.each(issueKeyList, function(index, issueKey) {
            var page = cardHtml(issueKey);
            page.attr("index", index);
            page.hide();
            page.find('.issue-id').text(issueKey);
            jQuery("body", printDocument).append(page);
            var deferred = addDeferred(deferredList);
            global.appFunctions.getCardData(issueKey, function(cardData) {
                //console.log("cardData: " + cardData);
                if (global.isProd) {
                    ga('send', 'event', 'task', 'generate', 'card', cardData.type);
                }
                fillCard(page, cardData);
                page.show();
                redrawCards();
                deferred.resolve();
            });
        });
        console.log("wait for issues loaded...");

        applyDeferred(deferredList, function() {
            console.log("...all issues loaded.");
            jQuery(printWindow).load(function() {
                console.log("...all resources loaded.");
                callback();
            })
            printDocument.close();
            console.log("wait for resources loaded...");
        });
    }

    function redrawCards() {

        var printFrame = jQuery("#card-print-dialog-content-iframe");
        var printWindow = printFrame[0].contentWindow;
        var printDocument = printWindow.document;

        // hide/show description
        jQuery("#styleHideDescription", printDocument).remove();
        if(jQuery("#hide-description-checkbox")[0].checked){
            var style= document.createElement('style');
            style.id = 'styleHideDescription';
            style.type ='text/css';
            style.innerHTML = ".issue-description { display: none; }"
            jQuery("head", printDocument).append(style);
        }

        // enable/disable single card page
        jQuery("#styleSingleCardPage", printDocument).remove();
        if(jQuery("#single-card-page-checkbox")[0].checked){
            var style= document.createElement('style');
            style.id = 'styleSingleCardPage';
            style.type ='text/css';
            style.innerHTML = ".card { page-break-after: always; float: none; }"
            jQuery("head", printDocument).append(style);
        }

        scaleCards();

        cropCards();

        var printFrame = jQuery("#card-print-dialog-content-iframe");
        resizeIframe(printFrame);
    }


    function fillCard(card, data) {
        //Key
        card.find('.issue-id').text(data.key);

        //Type
        card.find(".issue-icon").attr("type", data.type);

        //Summary
        card.find('.issue-summary').text(data.summary);

        //Description
        if (data.description) {
            card.find('.issue-description').html(data.description);
        } else {
            card.find(".issue-description").addClass("hidden");
        }

        //Assignee
        if (data.assignee) {
            if (data.avatarUrl) {
                card.find(".issue-assignee").css("background-image", "url('" + data.avatarUrl + "')");
            } else {
                card.find(".issue-assignee").text(data.assignee[0].toUpperCase());
            }
        } else {
            card.find(".issue-assignee").addClass("hidden");
        }

        //Due-Date
        if (data.dueDate) {
            card.find(".issue-due-date").text(data.dueDate);
        } else {
            card.find(".issue-due-box").addClass("hidden");
        }

        //Attachment
        if (data.hasAttachment) {} else {
            card.find('.issue-attachment').addClass('hidden');
        }

        //Story Points
        if (data.storyPoints) {
            card.find(".issue-estimate").text(data.storyPoints);
        } else {
            card.find(".issue-estimate").addClass("hidden");
        }

        //Epic
        if (data.epicKey) {
            card.find(".issue-epic-id").text(data.epicKey);
            card.find(".issue-epic-name").text(data.epicName);
        } else {
            card.find(".issue-epic-box").addClass("hidden");
        }

        //QR-Code
        var qrCodeUrl = 'https://chart.googleapis.com/chart?cht=qr&chs=256x256&chld=L|1&chl=' + encodeURIComponent(data.url);
        card.find(".issue-qr-code").css("background-image", "url('" + qrCodeUrl + "')");
    }

    function scaleCards(){
      var printFrame = jQuery("#card-print-dialog-content-iframe");
      var printWindow = printFrame[0].contentWindow;
      var printDocument = printWindow.document;


      var columnCount = jQuery("#columnCount").val();
      var rowCount = jQuery("#rowCount").val();

      var cardCount = jQuery(".card", printDocument).length;
      var pageCount = Math.ceil(cardCount / (columnCount * rowCount))

      console.log("cardCount: "+cardCount);
      console.log("pageCount: "+pageCount);

      // size

      // size horizontal
      jQuery("#styleColumnCount", printDocument).remove();
      var style= document.createElement('style');
      style.id = 'styleColumnCount';
      style.type ='text/css';
      style.innerHTML = ".card { width: calc( 100% / " + columnCount + " - 0.0001px  ); }"
      jQuery("head", printDocument).append(style);

      // size horizontal
      jQuery("#styleRowCount", printDocument).remove();
      var style= document.createElement('style');
      style.id = 'styleRowCount';
      style.type ='text/css';
      style.innerHTML = ".card { height: calc( 100% / " + rowCount + " - 0.0001px ); }"
      jQuery("head", printDocument).append(style);

      // scale

      jQuery("html", printDocument).css("font-size", "1cm");

      // scale horizontal
      // substract one pixel due to rounding problems
      var cardMaxWidth = Math.floor(jQuery(".card", printDocument).outerWidth() / columnCount) ;
      var cardMinWidth = jQuery(".card", printDocument).css("min-width").replace("px", "") ;
      var scaleWidth = cardMaxWidth / cardMinWidth;
      console.log("cardMaxWidth: "+cardMaxWidth);
      console.log("cardMinWidth: "+cardMinWidth);
      console.log("scaleWidth: "+scaleWidth);

      // scale vertical
      // substract one pixel due to rounding problems
      var cardMaxHeight = Math.floor(jQuery(".card", printDocument).outerHeight() * 2 / rowCount) ;
      var cardMinHeight = jQuery(".card", printDocument).css("min-height").replace("px", "") ;
      var scaleHeight = cardMaxHeight / cardMinHeight;
      console.log("cardMaxHeight: "+cardMaxHeight);
      console.log("cardMinHeight: "+cardMinHeight);
      console.log("scaleHeight: "+scaleHeight);

      // scale min
      var scale = Math.min(scaleWidth, scaleHeight, 1);
      if(scale < 1) {
          jQuery("html", printDocument).css("font-size",scale +"cm");
      }
    }

    function cropCards() {
        var printFrame = jQuery("#card-print-dialog-content-iframe");
        var printWindow = printFrame[0].contentWindow;
        var printDocument = printWindow.document;

        var cardElements = printDocument.querySelectorAll(".card");
        forEach(cardElements, function (cardElement) {
            var cardContent = cardElement.querySelectorAll(".card-body")[0];
            if (cardContent.scrollHeight > cardContent.offsetHeight) {
                cardContent.classList.add("zigzag");
            } else {
                cardContent.classList.remove("zigzag");
            }
        });
    }

    function forEach(array, callback) {
        for (i = 0; i < array.length; i++) {
            callback(array[i]);
        }
    }

    function closePrintPreview() {
        jQuery("#card-print-overlay").remove();
        jQuery("#card-print-overlay-style").remove();
    }

    //############################################################################################################################
    //############################################################################################################################
    //############################################################################################################################

    // http://www.cssdesk.com/T9hXg

    function printOverlayHTML() {
        var result = jQuery(document.createElement('div'))
            .attr("id", "card-print-overlay")
            .html(multilineString(function() {
                /*!
                <div id="card-print-dialog">
                  <div id="card-print-dialog-header">
                    <div id="card-print-dialog-title">Card Print</div>
                    <div id="info">
                      <input id="report-issue" type="button" class="aui-button" value="Report Issues" />
                      <input id="about" type="button" class="aui-button" value="About" />
                    </div>
                  </div>
                  <div id="card-print-dialog-content">
                    <iframe id="card-print-dialog-content-iframe"></iframe>
                  </div>
                  <div id="card-print-dialog-footer">
                    <div class="buttons">
                      <label style="display:none; margin-right:10px"><input id="font-scale-range" type="range" min="0.4" max="1.6" step="0.1" value="1.0" />Font Scale</label>
                      <label style="margin-right:10px;"><input id="rowCount" type="text" class="text" maxlength="1" style="width: 10px;" value="2"/>Row Count</label>
                      <label style="margin-right:10px;"><input id="columnCount" type="text" class="text" maxlength="1" style="width: 10px;" value="1"/>Column Count</label>
                      <label style="margin-right:10px"><input id="single-card-page-checkbox" type="checkbox"/>Single Card Page</label>
                      <label style="margin-right:10px"><input id="hide-description-checkbox" type="checkbox"/>Hide Description</label>
                      <input id="card-print-dialog-print" type="button" class="aui-button aui-button-primary" value="Print" />
                      <a id="card-print-dialog-cancel" title="Cancel" class="cancel">Cancel</a>
                    </div>
                  </div>
                </div>
                */
            }));

        // info
        result.find("#report-issue").click(function(event) {
                window.open('https://github.com/qoomon/Jira-Issue-Card-Printer/issues');
                return false;
            });

        result.find("#about").click(function(event) {
                window.open('http://qoomon.blogspot.de/2014/01/jira-issue-card-printer-bookmarklet.html');
                return false;
            });

        // enable single card page

        result.find("#single-card-page-checkbox").click(function() {
            writeCookie("card_printer_single_card_page",this.checked);
            redrawCards();
            return true;
        });

        // hide description

        result.find("#hide-description-checkbox").click(function() {
            writeCookie("card_printer_hide_description",this.checked);
            redrawCards();
            return true;
        });

        // scale font

        result.find("#font-scale-range").on("input", function() {
            writeCookie("card_printer_font_scale",jQuery(this).val());

            var printFrame = result.find("#card-print-dialog-content-iframe");
            var printWindow = printFrame[0].contentWindow;
            var printDocument = printWindow.document;

            jQuery("html", printDocument).css("font-size", jQuery(this).val() + "cm");

            redrawCards();
        });

        // grid

        result.find("#rowCount").on("input", function() {
            writeCookie("card_printer_row_count", jQuery(this).val());
            redrawCards();
        });
        result.find("#rowCount").click( function() {
            this.select();
        });


        result.find("#columnCount").on("input", function() {
            writeCookie("card_printer_column_count",jQuery(this).val());
            redrawCards();
        });
        result.find("#columnCount").click( function() {
            this.select();
        });


        // print

        result.find("#card-print-dialog-print")
            .click(function(event) {
                print();
                return false;
            });

        // closePrintPreview

        result.find("#card-print-dialog-cancel")
            .click(function(event) {
                closePrintPreview();
                return false;
            });

        result.click(function(event) {
            if (event.target == this) {
                closePrintPreview();
            }
            return true;
        });

        jQuery(document).keyup(function(e) {
            if (e.keyCode == 27) { // esc
                closePrintPreview();
            }
        });

        // prevent background scrolling
        result.scroll(function(event) {
            return false;
        });

        return result;
    }

    function printOverlayStyle() {
        var result = jQuery(document.createElement('style'))
            .attr("id", "card-print-overlay-style")
            .attr("type", "text/css")
            .html(multilineString(function() {
                /*!
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

                  overflow: hidden;
                }

                #card-print-dialog-content-iframe {
                  position: relative;
                  height: 100%;
                  width: 100%;

                  overflow: hidden;
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

                #info {
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
                .cancel{
                  cursor: pointer;
                  font-size: 14px;
                  display: inline-block;
                  padding: 5px 10px;
                  vertical-align: baseline;
                }
                */
            }));
        return result;
    }

    // card layout: http://jsfiddle.net/qoomon/ykbLb2pw/

    function cardHtml(issueKey) {
        var page = jQuery(document.createElement('div'))
            .attr("id", issueKey)
            .addClass("card")
            .html(multilineString(function() {
                /*!
    <div class="card-content">
        <div class="card-body shadow">
            <div class="issue-summary"></div>
            <div class="issue-description"></div>
        </div>
        <div class="card-header">
            <div class="issue-id badge"></div>
            <div class="issue-icon badge" type="story"></div>
            <div class="issue-estimate badge"></div>
            <div class="issue-due-box">
                <div class="issue-due-date badge"></div>
                <div class="issue-due-icon badge"></div>
            </div>
        </div>
        <div class="card-footer">
            <div class="issue-qr-code badge"></div>
            <div class="issue-attachment badge"></div>
            <div class="issue-assignee badge"></div>
            <div class="issue-epic-box badge">
                <span class="issue-epic-id"></span>
                <span class="issue-epic-name"></span>
            </div>
        </div>
    </div>
    <div class="author">© qoomon.com Bengt Brodersen</div>
                  */
            }));

        return page;
    }

    function cardCss() {
        var result = jQuery(document.createElement('style'))
            .attr("type", "text/css")
            .html(multilineString(function() {
                /*!
    * {
        box-sizing: border-box;
        overflow: hidden;
    }
    html {
        background: WHITE;
        padding: 0rem;
        margin: 0rem;
        font-size: 1.0cm;
        overflow-y: scroll;
    }
    body {
        padding: 0rem;
        margin: 0rem;
    }
    #preload {
        position: fixed;
        top: 0rem;
        left: 100%;
    }
    .author {
        position: absolute;
        top:0.8rem;
        left:calc(50% - 3rem);
        font-size: 0.5rem;
    }
    .card {
        position: relative;
        float:left;
        height: 100%;
        width: 100%;
        padding: 0.5cm;
        min-width:19.0rem;
        min-height:10.0rem;

        border-color: LightGray;
        border-style: dotted;
        border-width: 0.03cm;
    }
    .card-content {
        position: relative;
        height: 100%;
        // find .card-header;
        padding-top: 2rem;
        // find .card-footer;
        padding-bottom: 1.3rem;
    }
    .card-body {
        position: relative;
        height: 100%;
        margin-left: 0.4rem;
        margin-right: 0.4rem;
        padding-top: 1.2rem;
        padding-bottom: 1.1rem;
        padding-left: 0.4rem;
        padding-right: 0.4rem;
        background: WHITE;
    }
    .card-header {
        position: absolute;
        top: 0rem;
        height: 4.2rem;
        width: 100%;
    }
    .card-footer {
        position: absolute;
        bottom: 0rem;
        height: 2.2rem;
        width: 100%;
    }
    .issue-summary {
        font-weight: bold;
        display: -webkit-box;
        //-webkit-line-clamp: 2;
        //-webkit-box-orient: vertical;
    }
    .issue-description {
        margin-top: 0.4rem;
        display: block;
        font-size: 0.6rem;
        line-height: 0.6rem;
        overflow: hidden;
    }
    .issue-id {
        position: absolute;
        left: 1rem;
        top: 1.2rem;
        height: 1.5rem;
        max-width: 10rem;
        min-width: 5rem;
        padding-left: 2.4rem;
        padding-right: 0.4rem;
        background-color: WHITESMOKE;
        line-height: 1.3rem;
        font-size: 0.8rem;
        font-weight: bold;
        text-align: center;
        white-space: nowrap;
        text-overflow: ellipsis;
    }
    .issue-icon {
        position: absolute;
        left: 0rem;
        top: 0rem;
        height: 3.2rem;
        width: 3.2rem;
        border-radius: 50% !important;
        background-color: GREENYELLOW !important;
        background-image: url(https://qoomon.github.io/Jira-Issue-Card-Printer/resources/icons/Objects.png);
        background-repeat: no-repeat;
        background-position: center;
        background-size: 70%;
    }
    .issue-icon[type="story"] {
        background-color: GOLD !important;
        background-image: url(https://qoomon.github.io/Jira-Issue-Card-Printer/resources/icons/Bulb.png);
    }
    .issue-icon[type="bug"] {
        background-color: CRIMSON !important;
        background-image: url(https://qoomon.github.io/Jira-Issue-Card-Printer/resources/icons/Bug.png);
    }
    .issue-icon[type="epic"] {
        background-color: ROYALBLUE !important;
        background-image: url(https://qoomon.github.io/Jira-Issue-Card-Printer/resources/icons/Flash.png);
    }
    .issue-estimate {
        position: absolute;
        left: 2.5rem;
        top: 0.0rem;
        height: 1.6rem;
        width: 1.6rem;
        border-radius: 49.5% !important;
        background-color: WHITESMOKE;
        line-height: 1.4rem;
        font-size: 0.9rem;
        font-weight: bold;
        text-align: center;
    }
    .issue-qr-code {
        position: absolute;
        left:0rem;
        top: 0rem;
        width: 2.2rem;
        height: 2.2rem;
        background-image: url(https://chart.googleapis.com/chart?cht=qr&chs=256x256&chld=L|1&chl=blog.qoomon.com);
        background-repeat: no-repeat;
        background-size: cover;
        background-position: center;
    }
    .issue-attachment {
        position: absolute;
        left:2.8rem;
        top: 0rem;
        width: 2.0rem;
        height: 2.0rem;
        border-radius: 50% !important;
        background-color: LIGHTSKYBLUE !important;
        background-image: url(https://qoomon.github.io/Jira-Issue-Card-Printer/resources/icons/Attachment.png);
        background-repeat: no-repeat;
        background-position: center;
        background-size: 70%;
    }
    .issue-assignee {
        position: absolute;
        top:0rem;
        right:0rem;
        width: 2.2rem;
        height: 2.2rem;
        border-radius: 50% !important;
        background-color: WHITESMOKE;
        //background-image: url(https://qoomon.github.io/Jira-Issue-Card-Printer/resources/icons/Person.png);
        background-repeat: no-repeat;
        background-position: center;
        background-size: cover;
        //-webkit-filter: contrast(200%) grayscale(100%);
        //filter: contrast(200%) grayscale(100%);
        text-align: center;
        font-weight: bold;
        font-size: 1.4rem;
        line-height: 1.8rem;
    }
    .issue-epic-box {
        position: absolute;
        right:3.0rem;
        top: 0rem;
        width: auto;
        min-width: 6rem;
        width: auto;
        max-width: 10rem;
        height: auto;
        max-height: 2.2rem;
        padding-top: 0.1rem;
        padding-bottom: 0.2rem;
        padding-left: 0.3rem;
        padding-right: 0.3rem;
        text-align: left;
        font-size: 0.6rem;
        line-height: 0.8rem;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
    }
    .issue-epic-id {
        font-size: 0.5rem;
        font-weight: bold;
    }
    .issue-epic-name {
        margin-left: 0.1rem;
        font-size: 0.6rem;
        font-weight: bold;
    }
    .issue-due-date-box {
        position: absolute;
        right: 0rem;
        top: 0rem;
        overflow: visible !important;
    }
    .issue-due-date {
        position: absolute;
        top: 1.3rem;
        right: 1rem;
        width: 5.3rem;
        min-width: 2.8rem;
        height: 1.3rem;
        padding-left: 0.2rem;
        padding-right: 1.4rem;
        text-align: center;
        font-weight: bold;
        font-size: 0.7rem;
        line-height: 1.0rem;
    }
    .issue-due-icon {
        position: absolute;
        top: 0.5rem;
        right: 0rem;
        width: 2.5rem;
        height: 2.5rem;
        border-radius: 50% !important;
        background-color: ORCHID !important;
        background-image: url(https://qoomon.github.io/Jira-Issue-Card-Printer/resources/icons/AlarmClock.png);
        background-repeat: no-repeat;
        background-position: center;
        background-size: 65%;
    }
    .badge, .shadow {
        border-style: solid;
        border-color: #555;
        border-top-width: 0.12rem;
        border-left-width: 0.12rem;
        border-bottom-width: 0.21rem;
        border-right-width: 0.21rem;
        border-radius: 0.25rem;
    }
    .badge {
        // WHITESMOKE, GAINSBOROM;
        background-color: WHITESMOKE;
    }
    .hidden {
        display: none;
    }

    .zigzag {
        border-bottom-width: 0rem;
    }
    .zigzag::after {
        position: absolute;
        bottom: -0.04rem;
        left:-0.07rem;
        content:"";
        width: 100%;
        border-style:solid;
        border-bottom-width: 0.8rem;
        border-image: url(https://qoomon.github.io/Jira-Issue-Card-Printer/resources/ZigZag.png) 0 0 56 fill round repeat;
    }
    @media print {
        @page {
            margin: 0.0mm;
            padding: 0.0mm;
        }
        html {
            -webkit-print-color-adjust:exact;
            print-color-adjust: exact;
        }
        .card {
            page-break-inside: avoid;
        }
      }
    }
                */
            }).replace(/{RESOURCE_ORIGIN}/g, global.resourceOrigin));
        return result;
    }

    //############################################################################################################################
    //############################################################################################################################
    //############################################################################################################################

    function appendScript(url, callback) {

        var head = document.getElementsByTagName('head')[0];
        var script = document.createElement('script');
        script.src = url;

        // Then bind the event to the callback function.
        // There are several events for cross browser compatibility.
        script.onreadystatechange = callback;
        script.onload = callback;

        head.appendChild(script);
    }

    function initGoogleAnalytics(){
      // <GoogleAnalytics>
      (function(i, s, o, g, r, a, m) {
          i['GoogleAnalyticsObject'] = r;
          i[r] = i[r] || function() {
              (i[r].q = i[r].q || []).push(arguments)
          }, i[r].l = 1 * new Date();
          a = s.createElement(o),
              m = s.getElementsByTagName(o)[0];
          a.async = 1;
          a.src = g;
          m.parentNode.insertBefore(a, m)
      })(window, document, 'script', '//www.google-analytics.com/analytics.js', 'ga');

      ga('create', 'UA-50840116-3', {
          'alwaysSendReferrer': true
      });
      ga('set', 'page', '/cardprinter');
    }

    //############################################################################################################################
    //############################################################################################################################
    //############################################################################################################################

    function addDeferred(deferredList) {
        var deferred = new jQuery.Deferred()
        deferredList.push(deferred);
        return deferred;
    }

    function applyDeferred(deferredList, callback) {
        jQuery.when.apply(jQuery, deferredList).done(callback);
    }

    function readCookie(name, defaultValue){
      var cookies = document.cookie.split('; ');

      for(var i = 0; i<cookies.length; i++){
         var cookie = cookies[i].split('=');
         if(cookie[0] == name) return cookie[1];
      }
      return defaultValue
    }
    function writeCookie(name, value){
      document.cookie=name+"=" +value;
    }
    //############################################################################################################################
    //############################################################################################################################
    //############################################################################################################################

    function addStringFunctions() {

        //trim string - remove leading and trailing whitespaces
        if (!String.prototype.trim) {
            String.prototype.trim = function() {
                return this.replace(/^\s+|\s+$/g, '');
            };
        }

        if (!String.prototype.startsWith) {
            String.prototype.startsWith = function(str) {
                return this.slice(0, str.length) == str;
            };
        }

        if (!String.prototype.endsWith) {
            String.prototype.endsWith = function(str) {
                return this.slice(-str.length) == str;
            };
        }

        if (!String.prototype.toCamelCase) {
            String.prototype.toCamelCase = function() {
                // remove all characters that should not be in a variable name
                // as well underscores an numbers from the beginning of the string
                var s = this.replace(/([^a-zA-Z0-9_\- ])|^[_0-9]+/g, "").trim().toLowerCase();
                // uppercase letters preceeded by a hyphen or a space
                s = s.replace(/([ -]+)([a-zA-Z0-9])/g, function(a, b, c) {
                    return c.toUpperCase();
                });
                // uppercase letters following numbers
                s = s.replace(/([0-9]+)([a-zA-Z])/g, function(a, b, c) {
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
            for (var i = 0; i < format.length; i++) {
                var curChar = format.charAt(i);
                if (i - 1 >= 0 && format.charAt(i - 1) == "\\") {
                    returnStr += curChar;
                } else if (replace[curChar]) {
                    returnStr += replace[curChar].call(this);
                } else if (curChar != "\\") {
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
            d: function() {
                return (this.getDate() < 10 ? '0' : '') + this.getDate();
            },
            D: function() {
                return Date.replaceChars.shortDays[this.getDay()];
            },
            j: function() {
                return this.getDate();
            },
            l: function() {
                return Date.replaceChars.longDays[this.getDay()];
            },
            N: function() {
                return this.getDay() + 1;
            },
            S: function() {
                return (this.getDate() % 10 == 1 && this.getDate() != 11 ? 'st' : (this.getDate() % 10 == 2 && this.getDate() != 12 ? 'nd' : (this.getDate() % 10 == 3 && this.getDate() != 13 ? 'rd' : 'th')));
            },
            w: function() {
                return this.getDay();
            },
            z: function() {
                var d = new Date(this.getFullYear(), 0, 1);
                return Math.ceil((this - d) / 86400000);
            }, // Fixed now
            // Week
            W: function() {
                var d = new Date(this.getFullYear(), 0, 1);
                return Math.ceil((((this - d) / 86400000) + d.getDay() + 1) / 7);
            }, // Fixed now
            // Month
            F: function() {
                return Date.replaceChars.longMonths[this.getMonth()];
            },
            m: function() {
                return (this.getMonth() < 9 ? '0' : '') + (this.getMonth() + 1);
            },
            M: function() {
                return Date.replaceChars.shortMonths[this.getMonth()];
            },
            n: function() {
                return this.getMonth() + 1;
            },
            t: function() {
                var d = new Date();
                return new Date(d.getFullYear(), d.getMonth(), 0).getDate()
            }, // Fixed now, gets #days of date
            // Year
            L: function() {
                var year = this.getFullYear();
                return (year % 400 == 0 || (year % 100 != 0 && year % 4 == 0));
            }, // Fixed now
            o: function() {
                var d = new Date(this.valueOf());
                d.setDate(d.getDate() - ((this.getDay() + 6) % 7) + 3);
                return d.getFullYear();
            }, //Fixed now
            Y: function() {
                return this.getFullYear();
            },
            y: function() {
                return ('' + this.getFullYear()).substr(2);
            },
            // Time
            a: function() {
                return this.getHours() < 12 ? 'am' : 'pm';
            },
            A: function() {
                return this.getHours() < 12 ? 'AM' : 'PM';
            },
            B: function() {
                return Math.floor((((this.getUTCHours() + 1) % 24) + this.getUTreminutes() / 60 + this.getUTCSeconds() / 3600) * 1000 / 24);
            }, // Fixed now
            g: function() {
                return this.getHours() % 12 || 12;
            },
            G: function() {
                return this.getHours();
            },
            h: function() {
                return ((this.getHours() % 12 || 12) < 10 ? '0' : '') + (this.getHours() % 12 || 12);
            },
            H: function() {
                return (this.getHours() < 10 ? '0' : '') + this.getHours();
            },
            i: function() {
                return (this.getMinutes() < 10 ? '0' : '') + this.getMinutes();
            },
            s: function() {
                return (this.getSeconds() < 10 ? '0' : '') + this.getSeconds();
            },
            u: function() {
                var m = this.getMilliseconds();
                return (m < 10 ? '00' : (m < 100 ? '0' : '')) + m;
            },
            // Timezone
            e: function() {
                return "Not Yet Supported";
            },
            I: function() {
                var DST = null;
                for (var i = 0; i < 12; ++i) {
                    var d = new Date(this.getFullYear(), i, 1);
                    var offset = d.getTimezoneOffset();
                    if (DST === null) DST = offset;
                    else if (offset < DST) {
                        DST = offset;
                        break;
                    } else if (offset > DST) break;
                }
                return (this.getTimezoneOffset() == DST) | 0;
            },
            O: function() {
                return (-this.getTimezoneOffset() < 0 ? '-' : '+') + (Math.abs(this.getTimezoneOffset() / 60) < 10 ? '0' : '') + (Math.abs(this.getTimezoneOffset() / 60)) + '00';
            },
            P: function() {
                return (-this.getTimezoneOffset() < 0 ? '-' : '+') + (Math.abs(this.getTimezoneOffset() / 60) < 10 ? '0' : '') + (Math.abs(this.getTimezoneOffset() / 60)) + ':00';
            }, // Fixed now
            T: function() {
                var m = this.getMonth();
                this.setMonth(0);
                var result = this.toTimeString().replace(/^.+ \(?([^\)]+)\)?$/, '$1');
                this.setMonth(m);
                return result;
            },
            Z: function() {
                return -this.getTimezoneOffset() * 60;
            },
            // Full Date/Time
            c: function() {
                return this.format("Y-m-d\\TH:i:sP");
            }, // Fixed now
            r: function() {
                return this.toString();
            },
            U: function() {
                return this.getTimep() / 1000;
            }
        };
    }

    function multilineString(commentFunction) {
        return commentFunction.toString()
            .replace(/^[^\/]+\/\*!?/, '')
            .replace(/\*\/[^\/]+$/, '');
    }

    function resizeIframe(iframe) {
        iframe.height(iframe[0].contentWindow.document.body.height);
    }

    // APP Specific Functions
    //############################################################################################################################
    //############################################################################################################################
    //############################################################################################################################

    var jiraFunctions = (function (module) {

        module.getSelectedIssueKeyList = function() {
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

            return [];
        };

        module.getCardData= function(issueKey, callback) {
            module.getIssueData(issueKey, function(data) {

                var issueData = {};

                issueData.key = data.key;

                issueData.type = data.fields.issuetype.name.toLowerCase();

                issueData.summary = data.fields.summary;

                issueData.description = data.renderedFields.description.replace(/<p>/, "");

                if (data.fields.assignee) {
                    issueData.assignee = data.fields.assignee.displayName;
                    var avatarUrl = data.fields.assignee.avatarUrls['48x48'];
                    if (avatarUrl.indexOf("ownerId=") >= 0) {
                        issueData.avatarUrl = avatarUrl;
                    }
                }

                if (data.fields.duedate) {
                    issueData.dueDate = new Date(data.fields.duedate).format('D d.m.');
                }

                issueData.hasAttachment = data.fields.attachment.length > 0;

                issueData.storyPoints = data.fields.storyPoints;

                issueData.epicKey = data.fields.epicLink;
                if (issueData.epicKey) {
                    jiraFunctions.getIssueData(issueData.epicKey, function(data) {
                        issueData.epicName = data.fields.epicName;
                    }, false);
                }

                issueData.url = window.location.origin + "/browse/" + issueData.key;

                //LRS Specific field mapping
                if (true) {
                    //Desired-Date
                    if (data.fields.desiredDate) {
                        issueData.dueDate = new Date(data.fields.desiredDate).format('D d.m.');
                    }
                }

                callback(issueData);
            });
        };

        module.getIssueData = function(issueKey, callback, async) {
            async = typeof async !== 'undefined' ? async : true;
            //https://docs.atlassian.com/jira/REST/latest/
            var url = '/rest/api/2/issue/' + issueKey + '?expand=renderedFields,names';
            console.log("IssueUrl: " + url);
            //console.log("Issue: " + issueKey + " Loading...");
            jQuery.ajax({
                type: 'GET',
                url: url,
                data: {},
                dataType: 'json',
                async: async,
                success: function(responseData) {
                    //console.log("Issue: " + issueKey + " Loaded!");
                    // add custom fields with field names
                    jQuery.each(responseData.names, function(key, value) {
                        if (key.startsWith("customfield_")) {
                            var newFieldId = value.toCamelCase();
                            //console.log("add new field: " + newFieldId + " with value from " + key);
                            responseData.fields[value.toCamelCase()] = responseData.fields[key];
                        }
                    });
                    callback(responseData);
                },
            });
        };

        return module;
    }({}));

    var pivotalTrackerFunctions = (function (module) {

        module.getSelectedIssueKeyList = function() {
            //Single Story
            if (/.*\/stories\/.*/g.test(document.URL)) {
                return [document.URL.replace(/.*\/stories\/([^?]*).*/, '$1')];  // TODO
            }

            // Board
            if (/.*\/projects\/.*/g.test(document.URL)) {
                return jQuery('.story[data-id]:has(.selected)').map(function() {
                    return jQuery(this).attr('data-id');
                });
            }

            return [];
        };

        module.getCardData = function(issueKey, callback) {
            module.getIssueData(issueKey, function(data) {

                var issueData = {};

                issueData.key = data.id;

                issueData.type = data.kind.toLowerCase();

                issueData.summary = data.name;

                issueData.description = data.description;

                if (data.owned_by && data.owned_by.length > 0) {
                    issueData.assignee = data.owner_ids[0].name;
                }

                if (data.deadline) {
                    issueData.dueDate = new Date(data.deadline).format('D d.m.');
                }

                // TODO
                issueData.hasAttachment = false;

                issueData.storyPoints = data.estimate;

                // TODO
                // issueData.epicKey = data.fields.epicLink;
                // if ( issueData.epicKey ) {
                //   getIssueDataPivotalTracker(issueData.epicKey , function(data) {
                //     issueData.epicName = data.fields.epicName;
                //   }, false);
                // }

                issueData.url = data.url;

                callback(issueData);
            });
        };

        module.getIssueData = function(issueKey, callback, async) {
            async = typeof async !== 'undefined' ? async : true;
            //http://www.pivotaltracker.com/help/api
            var url = 'https://www.pivotaltracker.com/services/v5/stories/' + issueKey + "?fields=name,kind,description,story_type,owned_by(name),comments(file_attachments(kind)),estimate,deadline";
            console.log("IssueUrl: " + url);
            //console.log("Issue: " + issueKey + " Loading...");
            jQuery.ajax({
                type: 'GET',
                url: url,
                data: {},
                dataType: 'json',
                async: async,
                success: function(responseData) {
                    //console.log("Issue: " + issueKey + " Loaded!");
                    callback(responseData);
                },
            });
        };

        return module;
    }({}));

    var trelloFunctions = (function (module) {

        module.getSelectedIssueKeyList = function() {
            //Card View
            if (/.*\/c\/.*/g.test(document.URL)) {
                return [document.URL.replace(/.*\/c\/([^/]*).*/g, '$1')];
            }

            return [];
        };

        module.getCardData = function(issueKey, callback) {
            module.getIssueData(issueKey, function(data) {

                var issueData = {};

                issueData.key = data.idShort;

                //  TODO get kind from label name
                // issueData.type = data.kind.toLowerCase();

                issueData.summary = data.name;

                issueData.description = data.desc;

                if (data.members && data.members.length > 0) {
                    issueData.assignee = data.members[0].fullName;
                    issueData.avatarUrl = "https://trello-avatars.s3.amazonaws.com/"+data.members[0].avatarHash+"/170.png";
                }

                if (data.due) {
                    issueData.dueDate = new Date(data.due).format('D d.m.');
                }

                issueData.hasAttachment = data.attachments > 0;

                issueData.url = data.shortUrl;

                callback(issueData);
            });
        };

        module.getIssueData = function(issueKey, callback, async) {
            async = typeof async !== 'undefined' ? async : true;
            //http://www.pivotaltracker.com/help/api
            var url = "https://trello.com/1/cards/" + issueKey + "?members=true";
            console.log("IssueUrl: " + url);
            //console.log("Issue: " + issueKey + " Loading...");
            jQuery.ajax({
                type: 'GET',
                url: url,
                data: {},
                dataType: 'json',
                async: async,
                success: function(responseData) {
                    //console.log("Issue: " + issueKey + " Loaded!");
                    callback(responseData);
                },
            });
        };

        return module;
    }({}));
})();
