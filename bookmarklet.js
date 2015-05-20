(function() {
    var version = "3.5.0";
    console.log("Version: " + version);

    try {
        // load jQuery
        if (window.jQuery === undefined) {
            appendScript('//ajax.googleapis.com/ajax/libs/jquery/1.7.0/jquery.min.js');
        }

        var isDev = /.*jira.atlassian.com\/secure\/RapidBoard.jspa\?.*projectKey=ANERDS.*/g.test(document.URL) // Jira
            || /.*pivotaltracker.com\/n\/projects\/510733.*/g.test(document.URL) // PivotTracker
            || ( /.*trello.com\/.*/g.test(document.URL) && jQuery("span.js-member-name").text() =='Bengt Brodersen'); // Trello
        var isProd = !isDev;
        var appFunctions = null;
        var printScopeDeviderToken = "<b>Attachment</b>";

        var hostOrigin = "https://qoomon.github.io/Jira-Issue-Card-Printer/";
        if (isDev) {
            console.log("DEVELOPMENT");
            hostOrigin = "https://rawgit.com/qoomon/Jira-Issue-Card-Printer/develop/";
        }
        var resourceOrigin = hostOrigin + "resources/";

        // wait untill all scripts loaded
        appendScript('https://qoomon.github.io/void', function() {
            main();
        });

    } catch (err) {
        console.log(err.message);
        if (isProd) {
            ga('send', 'exception', {
                'exDescription': err.message,
                'exFatal': true
            });
        }
    }

    function init() {

        addStringFunctions();
        addDateFunctions();

        if (jQuery("meta[name='application-name'][ content='JIRA']").length > 0) {
            console.log("App: " + "Jira");
            appFunctions = jiraFunctions;
        } else if (/.*pivotaltracker.com\/.*/g.test(document.URL)) {
            console.log("App: " + "PivotalTracker");
            appFunctions = pivotalTrackerFunctions;
        } else if (/.*trello.com\/.*/g.test(document.URL)) {
            console.log("App: " + "Trello");
            appFunctions = trelloFunctions;
        } else {
          alert("Unsupported app.Please create an issue at https://github.com/qoomon/Jira-Issue-Card-Printer");
          return;
        }

        if (isProd){
            //cors = "https://cors-anywhere.herokuapp.com/";
            //$("#card").load("https://cors-anywhere.herokuapp.com/"+"https://qoomon.github.io/Jira-Issue-Card-Printer/card.html");
            initGoogleAnalytics();
        }
    }

    function main() {
        init();

        //preconditions
        if (jQuery("#card-print-overlay").length > 0) {
            alert("Print Card already opened!");
            return;
        }

        var issueKeyList = appFunctions.getSelectedIssueKeyList();
        if (issueKeyList.length <= 0) {
            alert("Please select at least one issue.");
            return;
        }

        // open print preview
        jQuery("body").append(printOverlayHTML);
        jQuery("#card-print-overlay").prepend(printOverlayStyle);

        jQuery("#rowCount").val(readCookie("card_printer_row_count",2));
        jQuery("#columnCount").val(readCookie("card_printer_column_count",1));
        jQuery("#card-scale-range").val(readCookie("card_printer_card_scale",1));
        jQuery("#multi-card-page-checkbox").attr('checked',readCookie("card_printer_multi_card_page",false) != 'false');
        jQuery("#hide-description-checkbox").attr('checked',readCookie("card_printer_hide_description",false) != 'false');


        if (isProd) {
            ga('send', 'pageview');
        }

        jQuery("#card-print-dialog-title").text("Card Print   -   Loading " + issueKeyList.length + " issues...");
        renderCards(issueKeyList, function() {
            jQuery("#card-print-dialog-title").text("Card Print");
            //print();
        });
    }

    function print() {
        var rowCount = jQuery("#rowCount").val();
        var columnCount = jQuery("#columnCount").val();
        var scale = jQuery("#card-scale-range").val();
        var multiCard = jQuery("#multi-card-page-checkbox").is(':checked');
        var hideDescription = jQuery("#hide-description-checkbox").is(':checked');

        writeCookie("card_printer_row_count", rowCount);
        writeCookie("card_printer_column_count",columnCount);
        writeCookie("card_printer_card_scale",scale);
        writeCookie("card_printer_multi_card_page",multiCard);
        writeCookie("card_printer_hide_description",hideDescription);

        var printFrame = jQuery("#card-print-dialog-content-iframe");
        var printWindow = printFrame[0].contentWindow;
        var printDocument = printWindow.document;
        if (isProd) {
            ga('send', 'event', 'button', 'click', 'print', jQuery(".card", printDocument).length);
        }
        var currentScale = jQuery("html", printDocument).css("font-size").replace("px", "");
        printWindow.matchMedia("print").addListener(function() {
            jQuery("html", printDocument).css("font-size",currentScale +"px");
            jQuery(".page", printDocument).css("height", "calc( 100% / " + rowCount    + " )");
            jQuery(".page", printDocument).css("width",  "calc( 100% / " + columnCount + " )");

            var pageWidth = jQuery(".page", printDocument).width();
            var cardWidth = jQuery(".card", printDocument).width();

            var newScale = currentScale * pageWidth / cardWidth;

            jQuery("html", printDocument).css("font-size",newScale +"px");

            jQuery(".card", printDocument).each(function(position, element) {

                var height = jQuery(element).height()
                  - jQuery(element).find(".card-header").height()
                  - jQuery(element).find(".card-footer").height()
                  - jQuery(element).find(".content-header").height()
                  - 40;
                jQuery(element).find(".description").css("max-height", height + "px");
            });
        });

        printWindow.print();
        jQuery("html", printDocument).css("font-size",currentScale +"px");
    }

    function hideDescription(hide) {
        var printFrame = jQuery("#card-print-dialog-content-iframe");
        var printWindow = printFrame[0].contentWindow;
        var printDocument = printWindow.document;
        if (hide) {
            jQuery(".description", printDocument).hide();
        } else {
            jQuery(".description", printDocument).show();
        }

        resizeIframe(printFrame);
    }

    function endableMultiCardPage(enable) {
        var printFrame = jQuery("#card-print-dialog-content-iframe");
        var printWindow = printFrame[0].contentWindow;
        var printDocument = printWindow.document;
        if (enable) {
            jQuery(".page", printDocument).addClass("multiCardPage");
        } else {
            jQuery(".page", printDocument).removeClass("multiCardPage");
        }
    }

    function renderCards(issueKeyList, callback) {

        var printFrame = jQuery("#card-print-dialog-content-iframe");
        var printWindow = printFrame[0].contentWindow;
        var printDocument = printWindow.document;

        printDocument.open();
        printDocument.write("<head/><body/>");

        jQuery("head", printDocument).append(printPanelPageCSS());
        jQuery("head", printDocument).append(printPanelCardCSS());

        console.log("load " + issueKeyList.length + " issues...");

        var deferredList = [];
        jQuery.each(issueKeyList, function(index, issueKey) {
            var page = newPage(issueKey);
            page.attr("index", index);
            page.hide();
            page.find('.key').text(issueKey);
            jQuery("body", printDocument).append(page);
            var deferred = addDeferred(deferredList);
            appFunctions.getCardData(issueKey, function(cardData) {
                //console.log("cardData: " + cardData);
                if (isProd) {
                    ga('send', 'event', 'task', 'generate', 'card', cardData.type);
                }
                fillCard(page, cardData);
                page.show();
                resizeIframe(printFrame);
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

    function closePrintPreview() {
        jQuery("#card-print-overlay").remove();
        jQuery("#card-print-overlay-style").remove();
    }

    function fillCard(card, data) {
        //Key
        card.find('.key').text(data.key);

        //Type
        card.find(".card").attr("type", data.type);

        //Summary
        card.find('.summary').text(data.summary);

        //Description
        if (data.description) {
            card.find('.description').html(data.description);
        } else {
            card.find(".description").addClass("hidden");
        }

        //Assignee
        if (data.assignee) {
            if (data.avatarUrl) {
                card.find(".assignee").css("background-image", "url('" + data.avatarUrl + "')");
            } else {
                card.find(".assignee").text(data.assignee[0].toUpperCase());
            }
        } else {
            card.find(".assignee").addClass("hidden");
        }

        //Due-Date
        if (data.dueDate) {
            card.find(".due-date").text(data.dueDate);
        } else {
            card.find(".due").addClass("hidden");
        }

        //Attachment
        if (data.hasAttachment) {} else {
            card.find('.attachment').addClass('hidden');
        }

        //Story Points
        if (data.storyPoints) {
            card.find(".estimate").text(data.storyPoints);
        } else {
            card.find(".estimate").addClass("hidden");
        }

        //Epic
        if (data.epicKey) {
            card.find(".epic-key").text(data.epicKey);
            card.find(".epic-name").text(data.epicName);
        } else {
            card.find(".epic").addClass("hidden");
        }

        //QR-Code
        var qrCodeUrl = 'https://chart.googleapis.com/chart?cht=qr&chs=256x256&chld=L|1&chl=' + encodeURIComponent(data.url);
        card.find(".qr-code").css("background-image", "url('" + qrCodeUrl + "')");
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
                      <label style="margin-right:10px"><input id="card-scale-range" type="range" min="0.4" max="1.6" step="0.1" value="1.0" />Scale</label>
                      <label style="margin-right:10px"><input id="multi-card-page-checkbox" type="checkbox"/>Multi Card Page</label>
                      <label style="margin-right:10px;"><input id="rowCount" type="text" class="text" maxlength="1" style="width: 10px;" value="2"/>Row Count</label>
                      <label style="margin-right:10px;"><input id="columnCount" type="text" class="text" maxlength="1" style="width: 10px;" value="1"/>Column Count</label>
                      <label style="margin-right:10px"><input id="hide-description-checkbox" type="checkbox"/>Hide Description</label>
                      <input id="card-print-dialog-print" type="button" class="aui-button aui-button-primary" value="Print" />
                      <a id="card-print-dialog-cancel" title="Cancel" class="cancel">Cancel</a>
                    </div>
                  </div>
                </div>
                */
            }));

        // info
        result.find("#report-issue")
            .click(function(event) {
                window.open('https://github.com/qoomon/Jira-Issue-Card-Printer/issues');
                return false;
            });

        result.find("#about")
            .click(function(event) {
                window.open('http://qoomon.blogspot.de/2014/01/jira-issue-card-printer-bookmarklet.html');
                return false;
            });

        // enable multe card page

        result.find("#multi-card-page-checkbox")
            .click(function() {
                endableMultiCardPage(this.checked);
                return true;
            });

        // hide description

        result.find("#hide-description-checkbox")
            .click(function() {
                hideDescription(this.checked);
                return true;
            });

        // scale card

        result.find("#card-scale-range").on("input", function() {
            var printFrame = jQuery("#card-print-dialog-content-iframe");
            var printWindow = printFrame[0].contentWindow;
            var printDocument = printWindow.document;
            jQuery("html", printDocument).css("font-size", jQuery(this).val() + "cm");
            resizeIframe(printFrame);
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

    function printPanelPageCSS() {

        var result = jQuery(document.createElement('style'))
            .attr("id", "printPanelPageStyle")
            .attr("type", "text/css")
            .html(multilineString(function() {
                /*!
    * {
      box-sizing: border-box;
    }
    HTML {
      font-size: 1.0cm;
      overflow: hidden;
    }
    .page {

      position: relative;
      overflow: auto;
      margin-left: auto;
      margin-right: auto;
      padding: 1.0cm;
      margin: 1.0cm;
      width: auto;
      height: 15cm;
      page-break-after: always;
      page-break-inside: avoid;

      background:white;

      -webkit-box-shadow: 0px 0px 7px 3px rgba(31,31,31,0.4);
      box-shadow: 0px 0px 7px 3px rgba(31,31,31,0.4);

      border-style: solid;
      border-color: #bfbfbf;
      border-width: 0.05cm;
      -webkit-border-radius: 0.1cm;
      border-radius: 0.1cm;

      overflow: hidden;
    }

    @media print {

      @page {
        margin: 0.0cm;
      }

      .page {
        background: white;
        border-color: light-grey;
        border-style: dashed;
        border-width: 1.0px;
        padding: 0.8cm;
        margin: 0.0cm;

        -webkit-box-shadow: none;
        box-shadow: none;

        -webkit-print-color-adjust:exact;
        print-color-adjust: exact;
      }

      .multiCardPage {
        height: auto;
        page-break-after: avoid;
        float: left;
      }

      .page:last-of-type {
        page-break-after: avoid;
      }
    }
  */
            }));

        return result;
    }

    // http://www.cssdesk.com/scHcP

    function newPage(issueKey) {
        var page = jQuery(document.createElement('div'))
            .attr("id", issueKey)
            .addClass("page")
            .addClass("singleCardPage")
            .html(multilineString(function() {
                /*!
                <div class="card">
                  <div class="author author-page">qoomon.com</div>
                  <div class="author author-name">Bengt Brodersen</div>
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

    function printPanelCardCSS() {
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
                     content: "";
                     display: block;
                     clear: both;
                     height:0
                 }
                 .card-border,
                 .badge,
                 .shadow {
                     border-style: solid;
                     border-color: #2f2f2f;
                     border-top-width: 0.14rem;
                     border-left-width: 0.14rem;
                     border-bottom-width: 0.24rem;
                     border-right-width: 0.24rem;
                     -webkit-border-radius: 0.25rem;
                     border-radius: 0.25rem;
                 }
                 .circular {
                     -webkit-border-radius: 50%;
                     border-radius: 50%;
                 }
                 .badge {
                     width: 3.2rem;
                     height: 3.2rem;
                     background: #d0d0d0;
                 }
                 .card {
                     position: relative;
                     min-width: 17.0rem;
                     height: 100%;
                     max-height: 100%;
                     overflow: hidden;
                 }
                 .author{
                     line-height: 0.8rem;
                 }
                 .author-page {
                     z-index: 999;
                     position: absolute;
                     top:2.5rem;
                     right:0.55rem;
                     font-size: 0.45rem;
                     -webkit-transform-origin: 100% 100%;
                     transform-origin: 100% 100%;
                     -webkit-transform: rotate(-90deg);
                     transform: rotate(-90deg);
                 }
                 .author-name {
                     z-index: 0;
                     position: absolute;
                     top:3.26rem;
                     right:-2.6rem;
                     font-size: 0.35rem;
                     -webkit-transform-origin: 0% 0%;
                     transform-origin: 0% 0%;
                     -webkit-transform: rotate(90deg);
                     transform: rotate(90deg);
                 }
                 .card-border {
                     position: absolute;
                     top:2.0rem;
                     left:0.4rem;
                     right:0.4rem;
                     height: calc(100% - 3.3rem);
                     background: #ffffff;
                 }
                 .card-header {
                   position: relative;
                 }
                 .card-content {
                     position: relative;
                     margin-top: 0.2rem;
                     margin-left: 1.0rem;
                     margin-right: 1.1rem;
                     margin-bottom: 0.2rem;
                     min-height: 1.2rem;
                     width: auto;
                 }
                 .content-header {
                     position: relative;
                     font-size: 1.1rem;
                     line-height: 1.1rem;
                     width: auto;
                 }
                 .card-footer {
                     position: absolute;
                     bottom: 0;
                     width: 100%;
                 }
                 .summary {
                     font-weight: bold;
                 }
                 .description {
                     margin-top: 0.4rem;
                     display:  block;
                     font-size: 0.6rem;
                     line-height: 0.6rem;
                     overflow: hidden;
                 }
                 .key {
                     position: absolute;
                     float: left;
                     width: auto;
                     min-width: 3.0rem;
                     height: 1.5rem;
                     left: 2.5rem;
                     margin-top: 1.2rem;
                     padding-left: 0.9rem;
                     padding-right: 0.4rem;
                     text-align: center;
                     font-weight: bold;
                     font-size: 0.8rem;
                     line-height: 1.2rem;
                 }
                 .type-icon {
                     position: relative;
                     float: left;
                     width: 3.15rem;
                     height: 3.15rem;
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
                     left: -0.60rem;
                     top:-1.5rem;
                     height: 1.5rem;
                     width: 1.5rem;
                     text-align: center;
                     font-weight: bold;
                     font-size: 0.9rem;
                     line-height: 1.15rem;
                     margin-top:1.5rem;
                     z-index: 999;
                     overflow: hidden;
                 }

                 .due {
                     position: relative;
                     float: right;
                 }
                 .due-icon {
                     position: relative;
                     float: right;
                     width: 2.5rem;
                     height: 2.5rem;
                     margin-top: 0.45rem;
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
                     width: auto;
                     min-width: 2.8rem;
                     height: 1.3rem;
                     right: -0.6rem;
                     margin-top: 1.3rem;
                     padding-left: 0.3rem;
                     padding-right: 0.6rem;
                     text-align: center;
                     font-weight: bold;
                     font-size: 0.7rem;
                     line-height: 1.0rem;
                 }
                 .attachment {
                     position: relative;
                     float: left;
                     margin-left: 0.6rem;
                     width: 2.1rem;
                     height: 2.1rem;
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
                     width: 2.1rem;
                     height: 2.1rem;
                     text-align: center;
                     font-weight: bold;
                     font-size: 1.4rem;
                     line-height: 1.8rem;
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
                     width: 2.1rem;
                     height: 2.1rem;
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
                     margin-right:0.6rem;
                     padding-top: 0.2rem;
                     padding-bottom: 0.2rem;
                     padding-left: 0.3rem;
                     padding-right: 0.3rem;
                     text-align: left;
                     font-size: 0.7rem;
                     line-height: 0.7rem;
                     max-width: calc( 100% - 10.2rem);
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
        iframe.height(iframe[0].contentWindow.document.body.scrollHeight);
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
                if (issueData.description) {
                    var printScope = issueData.description.indexOf(printScopeDeviderToken);
                    if (printScope >= 0) {
                        issueData.description = issueData.description.substring(0, printScope);
                        issueData.hasAttachment = true;
                    }
                }

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

                issueData.hasAttachment = false;
                if (issueData.description) {
                    var printScope = issueData.description.indexOf(printScopeDeviderToken);
                    if (printScope >= 0) {
                        issueData.description = issueData.description.substring(0, printScope);
                        issueData.hasAttachment = true;
                    }
                }

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
                if (issueData.description) {
                    var printScope = issueData.description.indexOf(printScopeDeviderToken);
                    if (printScope >= 0) {
                        issueData.description = issueData.description.substring(0, printScope);
                        issueData.hasAttachment = true;
                    }
                }

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
