(function() {
  // Public Instances
  // Jira: https://connect.atlassian.net/browse/NERDS-33286
  // PivotTracker: https://www.pivotaltracker.com/n/projects/510733
  // Trello: https://trello.com/b/8zlPSh70/spike
  // YouTrack: http://qoomon.myjetbrains.com/youtrack/dashboard

  var global = {};
  global.version = "4.3.3";
  global.issueTrackingUrl = "https://github.com/qoomon/Jira-Issue-Card-Printer";
  global.isDev = document.currentScript == null;
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
    init().then(function(){
      return main();
    }).catch(function(cause){
      console.log("ERROR " + cause.stack);
      alert("Sorry somthing went wrong.\n\nPlease create an issue at " + global.issueTrackingUrl + "\n\n" + cause.stack);
    });
  });

  function main() {
    var promises = [];

    console.log("Run...")
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
    } else if (/.*myjetbrains.com\/youtrack\/.*/g.test(document.URL)) {
      console.log("App: " + "YouTrack");
      global.appFunctions = youTrackFunctions;
    } else {
      alert("Unsupported app. Please create an issue at " + global.issueTrackingUrl);
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
    } else if (issueKeyList.length > 100) {
      confirm("Are you sure you want select " + issueKeyList.length + " issues?");
      return;
    }

    // open print preview
    jQuery("body").append(printPreviewElement());
    jQuery("#card-print-overlay").prepend(printOverlayStyleElement());

    var printFrame = jQuery("#card-print-dialog-content-iframe");
    var printWindow = printFrame[0].contentWindow;
    printWindow.addEventListener("resize", function() {
      redrawCards();
    });
    printWindow.matchMedia("print").addListener(function() {
      redrawCards();
    });

    var settings = global.settings;

    // restore UI state
    jQuery("#scaleRange").val(settings.scale);
    jQuery("#scaleRange").parent().find("output").val(settings.scale);
    jQuery("#rowCount").val(settings.rowCount);
    jQuery("#columnCount").val(settings.colCount);

    jQuery("#single-card-page-checkbox").attr('checked', settings.singleCardPage );
    jQuery("#hide-description-checkbox").attr('checked', settings.hideDescription );
    jQuery("#hide-assignee-checkbox").attr('checked', settings.hideAssignee );
    jQuery("#hide-due-date-checkbox").attr('checked', settings.hideDueDate );

    jQuery("#card-print-dialog-title").text("Card Printer " + global.version + " - Loading issues...");
    promises.push(renderCards(issueKeyList).then(function() {
      jQuery("#card-print-dialog-title").text("Card Printer " + global.version);
    }));

    if (global.isProd) {
      ga('send', 'pageview');
    }

    return Promise.all(promises);
  }

  function init() {
    var promises = [];

    console.log("Init...")
    addStringFunctions();

    loadSettings();

    global.hostOrigin = "https://qoomon.github.io/Jira-Issue-Card-Printer/";
    if (global.isDev) {
      console.log("DEVELOPMENT");
      global.hostOrigin = "https://rawgit.com/qoomon/Jira-Issue-Card-Printer/develop/";
    }
    global.resourceOrigin = global.hostOrigin + "resources/";

    if (global.isProd) {
      initGoogleAnalytics();
    }

    promises.push(httpGetCORS(global.hostOrigin + "card.html").then(function(data){
      global.cardHtml = data;
    }));

    promises.push(httpGetCORS(global.hostOrigin + "card.css").then(function(data){
      global.cardCss = data.replace(/https:\/\/qoomon.github.io\/Jira-Issue-Card-Printer\/resources/g, global.resourceOrigin);
    }));

    promises.push(httpGetCORS(global.hostOrigin + "printPreview.html").then(function(data){
      global.printPreviewHtml = data
    }));

    promises.push(httpGetCORS(global.hostOrigin + "printPreview.css").then(function(data){
      global.printPreviewCss = data.replace(/https:\/\/qoomon.github.io\/Jira-Issue-Card-Printer\/resources/g, global.resourceOrigin);
    }));

    return Promise.all(promises);
  }

  function saveSettings(){
    var settings = global.settings;
    writeCookie("card_printer_scale", settings.scale);
    writeCookie("card_printer_row_count", settings.rowCount);
    writeCookie("card_printer_column_count", settings.colCount);

    writeCookie("card_printer_single_card_page", settings.singleCardPage);
    writeCookie("card_printer_hide_description", settings.hideDescription);
    writeCookie("card_printer_hide_assignee", settings.hideAssignee);
    writeCookie("card_printer_hide_due_date", settings.hideDueDate);
  }

  function loadSettings(){
    var settings = global.settings = global.settings || {};
    settings.scale = parseFloat(readCookie("card_printer_scale")) || 0.0;
    settings.rowCount = parseInt(readCookie("card_printer_row_count2")) || 2;
    settings.colCount = parseInt(readCookie("card_printer_column_count")) || 1;

    settings.singleCardPage = parseBool(readCookie("card_printer_single_card_page"), true );
    settings.hideDescription = parseBool(readCookie("card_printer_hide_description"), false);
    settings.hideAssignee = parseBool(readCookie("card_printer_hide_assignee"), false);
    settings.hideDueDate = parseBool(readCookie("card_printer_hide_due_date"), false);
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

  function renderCards(issueKeyList) {
    var promises = [];

    var printFrame = jQuery("#card-print-dialog-content-iframe");
    var printWindow = printFrame[0].contentWindow;
    var printDocument = printWindow.document;

    printDocument.open();
    printDocument.write("<head/><body></body>");

    jQuery("head", printDocument).append(cardElementStyle());
    jQuery("body", printDocument).append("<div id='preload'/>");
    jQuery("#preload", printDocument).append("<div class='zigzag'/>");

    console.log("load " + issueKeyList.length + " issues...");

    jQuery.each(issueKeyList, function(index, issueKey) {
      var card = cardElement(issueKey);
      card.attr("index", index);
      card.hide();
      card.find('.issue-id').text(issueKey);
      jQuery("body", printDocument).append(card);

      promises.push(global.appFunctions.getCardData(issueKey).then(function(cardData) {
        console.log("cardData: " + JSON.stringify(cardData,2,2));
        if (global.isProd) {
          ga('send', 'event', 'card', 'generate', cardData.type);
        }
        fillCard(card, cardData);
        redrawCards();
        card.show();
      }));
    });

    console.log("wait for issues loaded...");
    return Promise.all(promises).then(function() {
      console.log("...all issues loaded.");

      jQuery(printWindow).load(function() {
        console.log("...all resources loaded.");
      });
      console.log("wait for resources loaded...");
      printDocument.close();
    });
  }

  function redrawCards() {
    styleCards();
    scaleCards();
    cropCards();
    resizeIframe(jQuery("#card-print-dialog-content-iframe"));
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
    if (data.superIssue) {
      card.find(".issue-epic-id").text(data.superIssue.key);
      card.find(".issue-epic-name").text(data.superIssue.summary);
    } else {
      card.find(".issue-epic-box").addClass("hidden");
    }

    //QR-Code
    var qrCodeUrl = 'https://chart.googleapis.com/chart?cht=qr&chs=256x256&chld=L|1&chl=' + encodeURIComponent(data.url);
    card.find(".issue-qr-code").css("background-image", "url('" + qrCodeUrl + "')");
  }

  function styleCards() {
    var settings = global.settings;

    var printFrame = jQuery("#card-print-dialog-content-iframe");
    var printWindow = printFrame[0].contentWindow;
    var printDocument = printWindow.document;

    // hide/show description
    jQuery("#styleHideDescription", printDocument).remove();
    if (settings.hideDescription) {
      var style = document.createElement('style');
      style.id = 'styleHideDescription';
      style.type = 'text/css';
      style.innerHTML = ".issue-description { display: none; }"
      jQuery("head", printDocument).append(style);
    }

    // hide/show assignee
    jQuery("#styleHideAssignee", printDocument).remove();
    if (settings.hideAssignee) {
      var style = document.createElement('style');
      style.id = 'styleHideAssignee';
      style.type = 'text/css';
      style.innerHTML = ".issue-assignee { display: none; }"
      jQuery("head", printDocument).append(style);
    }

    // hide/show assignee
    jQuery("#styleHideDueDate", printDocument).remove();
    if (settings.hideDueDate) {
      var style = document.createElement('style');
      style.id = 'styleHideDueDate';
      style.type = 'text/css';
      style.innerHTML = ".issue-due-box { display: none; }"
      jQuery("head", printDocument).append(style);
    }

    // enable/disable single card page
    jQuery("#styleSingleCardPage", printDocument).remove();
    if (settings.singleCardPage) {
      var style = document.createElement('style');
      style.id = 'styleSingleCardPage';
      style.type = 'text/css';
      style.innerHTML = ".card { page-break-after: always; float: none;}"
      jQuery("head", printDocument).append(style);
    }
  }

  function scaleCards() {
    var printFrame = jQuery("#card-print-dialog-content-iframe");
    var printWindow = printFrame[0].contentWindow;
    var printDocument = printWindow.document;

    var settings = global.settings;

    var scaleValue = settings.scale * 2.0;
    var scaleRoot;
    if(scaleValue < 0) {
      scaleRoot = 1.0 / (1.0 - scaleValue);
    } else {
      scaleRoot = 1.0 * (1.0 + scaleValue);
    }

    var rowCount = settings.rowCount;
    var columnCount = settings.colCount;

    // scale

    // reset scale
    jQuery("html", printDocument).css("font-size", scaleRoot + "cm");
    jQuery("#styleColumnCount", printDocument).remove();
    jQuery("#styleRowCount", printDocument).remove();

    // calculate scale

    var bodyElement = jQuery("body", printDocument);
    var cardMaxWidth = Math.floor(bodyElement.outerWidth() / columnCount);
    var cardMaxHeight = Math.floor(bodyElement.outerHeight() / rowCount);

    var cardElement = jQuery(".card", printDocument);
    var cardMinWidth = cardElement.css("min-width").replace("px", "");
    var cardMinHeight = cardElement.css("min-height").replace("px", "");

    var scaleWidth = cardMaxWidth / cardMinWidth ;
    var scaleHeight = cardMaxHeight / cardMinHeight ;
    var scale = Math.min(scaleWidth, scaleHeight, 1);

    // scale
    jQuery("html", printDocument).css("font-size", ( scaleRoot * scale ) + "cm");

    // size

    // size horizontal
    var style = document.createElement('style');
    style.id = 'styleColumnCount';
    style.type = 'text/css';
    style.innerHTML = ".card { width: calc( 100% / " + columnCount + " ); }"
    jQuery("head", printDocument).append(style);

    // size horizontal
    var style = document.createElement('style');
    style.id = 'styleRowCount';
    style.type = 'text/css';
    style.innerHTML = ".card { height: calc( 100% / " + rowCount + " );  }"
    jQuery("head", printDocument).append(style);
  }

  function cropCards() {
    var printFrame = jQuery("#card-print-dialog-content-iframe");
    var printWindow = printFrame[0].contentWindow;
    var printDocument = printWindow.document;

    var cardElements = printDocument.querySelectorAll(".card");
    forEach(cardElements, function(cardElement) {
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

  function printPreviewElement() {
    var result = jQuery('<div/>').html(global.printPreviewHtml).contents();

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
      global.settings.singleCardPage = this.checked;
      saveSettings();
      redrawCards();
      return true;
    });

    // hide description

    result.find("#hide-description-checkbox").click(function() {
      global.settings.hideDescription = this.checked;
      saveSettings();
      redrawCards();
      return true;
    });

    // show assignee

    result.find("#hide-assignee-checkbox").click(function() {
      global.settings.hideAssignee = this.checked;
      saveSettings();
      redrawCards();
      return true;
    });

    // show due date

    result.find("#hide-due-date-checkbox").click(function() {
      global.settings.hideDueDate = this.checked;
      saveSettings();
      redrawCards();
      return true;
    });

    // scale font

    result.find("#scaleRange").on("input", function() {
      global.settings.scale = jQuery(this).val();
      saveSettings();
      redrawCards();
    });

    // grid

    result.find("#rowCount").on("input", function() {
      global.settings.rowCount = jQuery(this).val();
      saveSettings();
      redrawCards();
    });
    result.find("#rowCount").click(function() {
      this.select();
    });


    result.find("#columnCount").on("input", function() {
      global.settings.colCount = jQuery(this).val();
      saveSettings();
      redrawCards();
    });
    result.find("#columnCount").click(function() {
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
      if (e.keyCode == 27) { // ESC
        closePrintPreview();
      }
    });

    // prevent background scrolling
    result.scroll(function(event) {
        return false;
    });

    return result;
  }

  function printOverlayStyleElement() {
    var result = jQuery(document.createElement('style'))
      .attr("id", "card-print-overlay-style")
      .attr("type", "text/css")
      .html(global.printPreviewCss);
    return result;
  }

  // card layout: http://jsfiddle.net/qoomon/ykbLb2pw/76

  function cardElement(issueKey) {
    var result = jQuery('<div/>').html(global.cardHtml).contents()
      .attr("id", issueKey)
    return result;
  }

  function cardElementStyle() {
    var result = jQuery(document.createElement('style'))
      .attr("type", "text/css")
      .html(global.cardCss);
    return result;
  }

  //############################################################################################################################
  //############################################################################################################################
  //############################################################################################################################

  function initGoogleAnalytics() {
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

  function parseBool(text, def){
    if(text == 'true') return true;
    else if ( text == 'false') return false;
    else return def;
  }

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

  function readCookie(name) {
    var cookies = document.cookie.split('; ');

    for (var i = 0; i < cookies.length; i++) {
      var cookie = cookies[i].split('=');
      if (cookie[0] == name) return cookie[1];
    }
    return null;
  }

  function writeCookie(name, value) {
    document.cookie = name + "=" + value;
  }

  function httpGetCORS(){
    arguments[0] = 'https://jsonp.afeld.me/?url=' + arguments[0];
    return httpGet.apply(this, arguments);
  }

  function httpGet(){
    return Promise.resolve(jQuery.get.apply(this, arguments));
  }

  function httpGetJSON(){
    return Promise.resolve(jQuery.getJSON.apply(this, arguments));
  }

  function multilineString(commentFunction) {
    return commentFunction.toString()
      .replace(/^[^\/]+\/\*!?/, '')
      .replace(/\*\/[^\/]+$/, '');
  }

  function resizeIframe(iframe) {
    iframe.height(iframe[0].contentWindow.document.body.height);
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

  function formatDate(date) {
    var shortMonths = {'Jan': 1, 'Feb':2, 'Mar':3, 'Apr':4, 'May':5, 'Jun':6, 'Jul':7, 'Aug':8, 'Sep':9, 'Oct':10, 'Nov':11, 'Dec':12 };
    var dateSplit = date.toString().split(" ");
    // Mo 28.11.
    return dateSplit[0] + " " + dateSplit[2] + "." + shortMonths[dateSplit[1]] + ".";
  }

  // APP Specific Functions
  //############################################################################################################################
  //############################################################################################################################
  //############################################################################################################################

  var jiraFunctions = (function(module) {

    module.getSelectedIssueKeyList = function() {

      //Issues
      if (/.*\/issues\/\?jql=.*/g.test(document.URL)) {
        var jql = document.URL.replace(/.*\?jql=(.*)/, '$1');
        var jqlIssues = [];
        var url = '/rest/api/2/search?jql=' + jql + "&maxResults=500&fields=key";
        console.log("IssueUrl: " + url);
        //console.log("Issue: " + issueKey + " Loading...");
        jQuery.ajax({
          type: 'GET',
          url: url,
          data: {},
          dataType: 'json',
          async: false,
          success: function(responseData) {
            console.log("responseData: " + responseData.issues);

            jQuery.each(responseData.issues, function(key, value) {
                jqlIssues.push(value.key);
            });
          },
        });
        console.log("jqlIssues: " + jqlIssues);
        return jqlIssues;
      }

      //Browse
      if (/.*\/browse\/.*/g.test(document.URL)) {
        return [document.URL.replace(/.*\/browse\/([^?]*).*/, '$1')];
      }

      //Project
      if (/.*\/projects\/.*/g.test(document.URL)) {
        return [document.URL.replace(/.*\/projects\/[^\/]*\/[^\/]*\/([^?]*).*/, '$1')];
      }

      // RapidBoard
      if (/.*\/secure\/RapidBoard.jspa.*/g.test(document.URL)) {
        return jQuery('div[data-issue-key].ghx-selected').map(function() {
          return jQuery(this).attr('data-issue-key');
        });
      }

      return [];
    };

    module.getCardData = function(issueKey) {
      var promises = [];
      var issueData = {};

      promises.push(module.getIssueData(issueKey).then(function(data) {
        var promises = [];
        issueData.key = data.key;
        issueData.type = data.fields.issuetype.name.toLowerCase();
        issueData.summary = data.fields.summary;
        issueData.description = data.renderedFields.description;

        if (data.fields.assignee) {
          issueData.assignee = data.fields.assignee.displayName;
          var avatarUrl = data.fields.assignee.avatarUrls['48x48'];
          if (avatarUrl.indexOf("ownerId=") >= 0) {
            issueData.avatarUrl = avatarUrl;
          }
        }

        if (data.fields.duedate) {
          issueData.dueDate = formatDate(new Date(data.fields.duedate));
        }

        issueData.hasAttachment = data.fields.attachment.length > 0;
        issueData.storyPoints = data.fields.storyPoints;

        if (data.fields.parent) {
          promises.push(module.getIssueData(data.fields.parent.key).then(function(data) {
            issueData.superIssue = {};
            issueData.superIssue.key = data.key;
            issueData.superIssue.summary = data.fields.summary;
          }));
        } else if (data.fields.epicLink) {
          promises.push(module.getIssueData(data.fields.epicLink).then(function(data) {
            issueData.superIssue = {};
            issueData.superIssue.key = data.key;
            issueData.superIssue.summary = data.fields.epicName;
          }));
        }

        issueData.url = window.location.origin + "/browse/" + issueData.key;

        //LRS Specific field mapping
        if (true) {
          //Desired-Date
          if (data.fields.desiredDate) {
            issueData.dueDate = formatDate(new Date(data.fields.desiredDate));
          }
        }

        return Promise.all(promises);
      }));

      return Promise.all(promises).then(function(results){return issueData;});
    };

    module.getIssueData = function(issueKey) {
      //https://docs.atlassian.com/jira/REST/latest/
      var url = '/rest/api/2/issue/' + issueKey + '?expand=renderedFields,names';
      console.log("IssueUrl: " + url);
      //console.log("Issue: " + issueKey + " Loading...");


      return httpGetJSON(url).then(function(responseData) {
        //console.log("Issue: " + issueKey + " Loaded!");
        // add custom fields with field names
        jQuery.each(responseData.names, function(key, value) {
          if (key.startsWith("customfield_")) {
            var fieldName = value.toCamelCase();
            //console.log("add new field: " + fieldName + " with value from " + key);
            responseData.fields[fieldName] = responseData.fields[key];
          }
        });
        return responseData;
      });
    };

    return module;
  }({}));

  var youTrackFunctions = (function(module) {

    module.getSelectedIssueKeyList = function() {
      //Detail View
      if (/.*\/issue\/.*/g.test(document.URL)) {
        return [document.URL.replace(/.*\/issue\/([^?]*).*/, '$1')];
      }

      // Agile Board
      if (/.*\/rest\/agile.*/g.test(document.URL)) {
        return jQuery('div.sb-task-focused').map(function() {
          return jQuery(this).attr('id');
        });
      }

      return [];
    };

    module.getCardData = function(issueKey) {
      var promises = [];
      var issueData = {};

      promises.push(module.getIssueData(issueKey).then(function(data) {
        issueData.key = data.id;
        issueData.type = data.field.type[0];
        issueData.summary = data.field.summary;
        issueData.description = data.field.description;

        if (data.field.assignee) {
          issueData.assignee = data.field.assignee[0].fullName;
        }

        if (data.field.attachments) {
          issueData.hasAttachment = data.field.attachments.length > 0;
        }

        issueData.url = window.location.origin + "/youtrack/issue/" + issueData.key;


      }));

      return Promise.all(promises).then(function(results){return issueData;});
    };

    module.getIssueData = function(issueKey) {
      var url = '/youtrack/rest/issue/' + issueKey + '?';
      console.log("IssueUrl: " + url);
      //console.log("Issue: " + issueKey + " Loading...");
      return httpGetJSON(url).then(function(responseData) {
        //console.log("Issue: " + issueKey + " Loaded!");
        jQuery.each(responseData.field, function(key, value) {
          // add fields with field names
          var fieldName = value.name.toCamelCase();
          //console.log("add new field: " + newFieldId + " with value from " + fieldName);
          responseData.field[fieldName] = value.value;
        });
        return responseData;
      });
    };

    return module;
  }({}));

  var pivotalTrackerFunctions = (function(module) {

    module.getSelectedIssueKeyList = function() {
      //Single Story
      if (/.*\/stories\/.*/g.test(document.URL)) {
        return [document.URL.replace(/.*\/stories\/([^?]*).*/, '$1')];
      }

      // Board
      if (/.*\/projects\/.*/g.test(document.URL)) {
        return jQuery('.story[data-id]:has(.selected)').map(function() {
          return jQuery(this).attr('data-id');
        });
      }

      return [];
    };

    module.getCardData = function(issueKey) {
      var promises = [];
      var issueData = {};

      promises.push(module.getIssueData(issueKey).then(function(data) {
        issueData.key = data.id;
        issueData.type = data.kind.toLowerCase();
        issueData.summary = data.name;
        issueData.description = data.description;

        if (data.owned_by && data.owned_by.length > 0) {
          issueData.assignee = data.owner_ids[0].name;
        }

        if (data.deadline) {
          issueData.dueDate = formatDate(new Date(data.deadline));
        }

        // TODO
        issueData.hasAttachment = false;
        issueData.storyPoints = data.estimate;

        issueData.url = data.url;
      }));

      return Promise.all(promises).then(function(results){return issueData;});
    };

    module.getIssueData = function(issueKey) {
      //http://www.pivotaltracker.com/help/api
      var url = 'https://www.pivotaltracker.com/services/v5/stories/' + issueKey + "?fields=name,kind,description,story_type,owned_by(name),comments(file_attachments(kind)),estimate,deadline";
      console.log("IssueUrl: " + url);
      //console.log("Issue: " + issueKey + " Loading...");
      return httpGetJSON(url);
    };

    return module;
  }({}));

  var trelloFunctions = (function(module) {

    module.getSelectedIssueKeyList = function() {
      //Card View
      if (/.*\/c\/.*/g.test(document.URL)) {
        return [document.URL.replace(/.*\/c\/([^/]*).*/g, '$1')];
      }

      return [];
    };

    module.getCardData = function(issueKey, callback) {
      var promises = [];
      var issueData = {};

      promises.push(module.getIssueData(issueKey).then(function(data) {
        issueData.key = data.idShort;

        //  TODO get kind from label name
        // issueData.type = data.kind.toLowerCase();

        issueData.summary = data.name;
        issueData.description = data.desc;

        if (data.members && data.members.length > 0) {
          issueData.assignee = data.members[0].fullName;
          issueData.avatarUrl = "https://trello-avatars.s3.amazonaws.com/" + data.members[0].avatarHash + "/170.png";
        }

        if (data.due) {
          issueData.dueDate = formatDate(new Date(data.due));
        }

        issueData.hasAttachment = data.attachments > 0;
        issueData.url = data.shortUrl;
      }));

      return Promise.all(promises).then(function(results){return issueData;});
    };

    module.getIssueData = function(issueKey) {
      var url = "https://trello.com/1/cards/" + issueKey + "?members=true";
      console.log("IssueUrl: " + url);
      //console.log("Issue: " + issueKey + " Loading...");
      return httpGetJSON(url);
    };

    return module;
  }({}));
})();
