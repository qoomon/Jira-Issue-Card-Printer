(function() {
  // Public Instances
  // Jira: https://connect.atlassian.net/browse/NERDS-33286
  // PivotTracker: https://www.pivotaltracker.com/n/projects/510733
  // Trello: https://trello.com/b/8zlPSh70/spike
  // YouTrack: http://qoomon.myjetbrains.com/youtrack/dashboard
  
  if (!String.prototype.startsWith) {
    String.prototype.startsWith = function(searchString, position) {
      position = position || 0;
      return this.indexOf(searchString, position) === position;
    };
  }

  var global = {};
  global.version = "4.9.0";
  global.issueTrackingUrl = "github.com/qoomon/Jira-Issue-Card-Printer";

  global.isDev = document.currentScript == null;

  // support for older jQuery versions
  if (!jQuery.fn.on) {
    jQuery.fn.on = function(action, handler) {
      return jQuery.bind(action, handler);
    };
  }

  var $ = jQuery;

  // enforce jQuery
  if (typeof jQuery == 'undefined') {
    alert("jQuery is required!\n\nPlease create an issue at\n" + global.issueTrackingUrl);
    return;
  }
  

  // run
  try {
    init().then(main).catch(handleError);
  } catch (e) {
    handleError(e);
  }

  function main() {
    var promises = [];

    ga('send', 'pageview');

    //preconditions
    if ($("#card-printer-iframe").length > 0) {
      closePrintPreview();
    }

    console.log("Run...")
    for (issueTracker of getIssueTrackers()) {
      if(issueTracker.isEligible()){
        console.log("Issue Tracker: " + issueTracker.name);
        global.appFunctions = issueTracker;
        break;
      }
    }

    if(!global.appFunctions){
      alert("Unsupported app. Please create an issue at " + global.issueTrackingUrl);
      return;
    }

    // add overlay frame
    var appFrame = createOverlayFrame();
    $("body").append(appFrame);


    // add convinient fields
    appFrame.window = appFrame.contentWindow;
    appFrame.document = appFrame.window.document;
    appFrame.document.open();
    appFrame.document.close();
    global.appFrame = appFrame;

    // add print dialog content
    $("head", global.appFrame.document).prepend(printPreviewElementStyle());
    $("body", global.appFrame.document).append(printPreviewElement());
    updatePrintDialoge();

    // get print content frame
    var printFrame = $("#card-print-dialog-content-iframe", global.appFrame.document)[0];
    // add convinient fields
    printFrame.window = printFrame.contentWindow;
    printFrame.document = printFrame.window.document;
    printFrame.document.open();
    printFrame.document.close();
    global.printFrame = printFrame;

    // add listeners to redraw crads on print event
    printFrame.window.addEventListener("resize", redrawCards);
    printFrame.window.matchMedia("print").addListener(redrawCards);

    // collect selcted issues
    var issueKeyList = global.appFunctions.getSelectedIssueKeyList();
    if (issueKeyList.length <= 0) {
      alert("Please select at least one issue.");
      return;
    } else if (issueKeyList.length > 30) {
      var confirmResult = confirm("Are you sure you want select " + issueKeyList.length + " issues?");
      if (!confirmResult) {
        return;
      }
    }

    // render cards
    promises.push(renderCards(issueKeyList));

    $("#card-print-dialog-title", global.appFrame.document).text("Card Printer " + global.version + " - Loading issues...");
    return Promise.all(promises).then(function() {
      $("#card-print-dialog-title", global.appFrame.document).text("Card Printer " + global.version);
    });
  }

  function init() {
    var promises = [];

    console.log("Init...")
    initGoogleAnalytics();

    addStringFunctions();
    loadSettings();

    global.hostOrigin = "https://qoomon.github.io/Jira-Issue-Card-Printer/";
    if (global.isDev) {
      console.log("DEVELOPMENT");
      global.hostOrigin = "https://rawgit.com/qoomon/Jira-Issue-Card-Printer/develop/";
    }
    global.resourceOrigin = global.hostOrigin + "resources/";

    var resources = getResources();

    global.cardHtml = resources.cardHtml;
    global.cardCss = resources.cardCss.replace(/https:\/\/qoomon.github.io\/Jira-Issue-Card-Printer\/resources/g, global.resourceOrigin);
    global.printPreviewHtml = resources.printPreviewHtml;
    global.printPreviewCss = resources.printPreviewCss.replace(/https:\/\/qoomon.github.io\/Jira-Issue-Card-Printer\/resources/g, global.resourceOrigin);

    return Promise.all(promises);
  }

  function error2object(value) {
      if (value instanceof Error) {
          var error = {};
          Object.getOwnPropertyNames(value).forEach(function (key) {
              error[key] = value[key];
          });
          return error;
      }
      return value;
  }

  function handleError(error){
    error = error2object(error);
    var error = JSON.stringify(error,2,2);
    console.log("ERROR " + error);
    ga('send', 'exception', { 'exDescription': error, 'exFatal': true });
    alert("Sorry something went wrong\n\nPlease create an issue with following details at\n" + global.issueTrackingUrl + "\n\n" + error);
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
    writeCookie("card_printer_hide_estimate", settings.hideEstimate);
    writeCookie("card_printer_hide_qr_code", settings.hideQrCode);
    writeCookie("card_printer_hide_tags", settings.hideTags);
    writeCookie("card_printer_hide_epic", settings.hideEpic);
  }

  function loadSettings(){
    var settings = global.settings = global.settings || {};
    settings.scale = parseFloat(readCookie("card_printer_scale")) || 0.0;
    settings.rowCount = parseInt(readCookie("card_printer_row_count")) || 2;
    settings.colCount = parseInt(readCookie("card_printer_column_count")) || 1;

    settings.singleCardPage = parseBool(readCookie("card_printer_single_card_page"), true );
    settings.hideDescription = parseBool(readCookie("card_printer_hide_description"), false);
    settings.hideAssignee = parseBool(readCookie("card_printer_hide_assignee"), false);
    settings.hideDueDate = parseBool(readCookie("card_printer_hide_due_date"), false);
    settings.hideEstimate = parseBool(readCookie("card_printer_hide_estimate"), false);
    settings.hideQrCode = parseBool(readCookie("card_printer_hide_qr_code"), false);
    settings.hideTags = parseBool(readCookie("card_printer_hide_tags"), true);
    settings.hideEpic = parseBool(readCookie("card_printer_hide_epic"), false);
  }

  function print() {
    ga('send', 'event', 'button', 'click', 'print', $(".card", global.printFrame.contentWindow.document).length);
    global.printFrame.contentWindow.print();
  }

  function createOverlayFrame(){
    var appFrame = document.createElement('iframe');
    appFrame.id = "card-printer-iframe";
    $(appFrame).css({
      'position': 'fixed',
      'height': '100%',
      'width': '100%',
      'top': '0',
      'left': '0',
      'background': 'rgba(0, 0, 0, 0.0)',
      'boxSizing': 'border-box',
      'wordWrap': 'break-word',
      'zIndex': '99999'
    });
    return appFrame;
  }

  function updatePrintDialoge(){
    var appFrameDocument = global.appFrame.document;
    var settings = global.settings;
    $("#scaleRange", appFrameDocument).val(settings.scale);
    $("#scaleRange", appFrameDocument).parent().find("output").val(settings.scale);
    $("#rowCount", appFrameDocument).val(settings.rowCount);
    $("#columnCount", appFrameDocument).val(settings.colCount);

    $("#single-card-page-checkbox", appFrameDocument).attr('checked', settings.singleCardPage );
    $("#description-checkbox", appFrameDocument).attr('checked', !settings.hideDescription );
    $("#assignee-checkbox", appFrameDocument).attr('checked', !settings.hideAssignee );
    $("#due-date-checkbox", appFrameDocument).attr('checked', !settings.hideDueDate );
    $("#estimate-checkbox", appFrameDocument).attr('checked', !settings.hideEstimate );
    $("#qr-code-checkbox", appFrameDocument).attr('checked', !settings.hideQrCode );
    $("#tags-checkbox", appFrameDocument).attr('checked', !settings.hideTags );
    $("#epic-checkbox", appFrameDocument).attr('checked', !settings.hideEpic );
  }

  function renderCards(issueKeyList) {
    var promises = [];

    var printFrameDocument = global.printFrame.document;

    printFrameDocument.open();
    printFrameDocument.write("<head/><body></body>");
    printFrameDocument.close();

    $("head", printFrameDocument).append(cardElementStyle());
    $("body", printFrameDocument).append("<div id='preload'/>");
    $("#preload", printFrameDocument).append("<div class='zigzag'/>");

    console.log("load " + issueKeyList.length + " issues...");

    $.each(issueKeyList, function(index, issueKey) {
      var card = cardElement(issueKey);
      card.attr("index", index);
      card.find('.issue-id').text(issueKey);
      $("body", printFrameDocument).append(card);

      promises.push(global.appFunctions.getCardData(issueKey).then(function(cardData) {
        // console.log("cardData: " + JSON.stringify(cardData,2,2));
        ga('send', 'event', 'card', 'generate', cardData.type);
        fillCard(card, cardData);
        redrawCards();
      }));
    });

    console.log("wait for issues loaded...");
    return Promise.all(promises).then(function() {
      console.log("...all issues loaded.");
      redrawCards();
    });
  }

  function redrawCards() {
    styleCards();
    scaleCards();
    cropCards();
    resizeIframe(global.printFrame);
  }

  function fillCard(card, data) {
    //Key
    card.find('.issue-id').text(data.key);

    //Type
    var backgroundColor;
    var backgroundImage;
    switch (data.type.toLowerCase()) {
      default: 
        backgroundColor = textColor(data.type.toLowerCase());
        backgroundImage = 'http://identicon.org/?t=' + data.type.toLowerCase() + '&s=256&c=b';
        break;
      case 'story':
      case 'user story':
        backgroundColor = 'GOLD';
        backgroundImage = 'https://qoomon.github.io/Jira-Issue-Card-Printer/resources/icons/Bulb.png';
        break;
      case 'bug':
      case 'problem':
      case 'correction':
        backgroundColor = 'CRIMSON';
        backgroundImage = 'https://qoomon.github.io/Jira-Issue-Card-Printer/resources/icons/Bug.png';
        break;
      case 'epic':
        backgroundColor = 'ROYALBLUE';
        backgroundImage = 'https://qoomon.github.io/Jira-Issue-Card-Printer/resources/icons/Flash.png';
        break;
      case 'task':
      case 'sub-task':
      case 'technical task':
      case 'aufgabe':
      case 'unteraufgabe':
      case 'technische aufgabe':
        backgroundColor = 'WHEAT';
        backgroundImage = 'https://qoomon.github.io/Jira-Issue-Card-Printer/resources/icons/Task.png';
        break;
      case 'new feature':
        backgroundColor = 'LIMEGREEN';
        backgroundImage = "https://qoomon.github.io/Jira-Issue-Card-Printer/resources/icons/Plus.png";
        break;
      case 'improvement':
      case 'verbesserung':
        backgroundColor = 'CORNFLOWERBLUE';
        backgroundImage = 'https://qoomon.github.io/Jira-Issue-Card-Printer/resources/icons/Arrow.png';
        break;
      case 'research':
        backgroundColor = 'MEDIUMTURQUOISE';
        backgroundImage = 'https://qoomon.github.io/Jira-Issue-Card-Printer/resources/icons/ErlenmeyerFlask.png';
        break;
      case 'test':
        backgroundColor = 'ORANGE';
        backgroundImage = 'https://qoomon.github.io/Jira-Issue-Card-Printer/resources/icons/CrashDummy.png';
        break;
    }
    card.find('.issue-icon').css('background-color', backgroundColor);
    card.find('.issue-icon').css('background-image', 'url(' + backgroundImage + ')');

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
        const initials = data.assignee.split(/ /).map(namePart => namePart[0].toUpperCase()).join('');
        card.find(".issue-assignee").text(initials);
        card.find(".issue-assignee").css("background-color", textColor(initials));
      }
    } else {
      card.find(".issue-assignee").remove();
    }

    //Due-Date
    if (data.dueDate) {
      card.find(".issue-due-date").text(data.dueDate);
    } else {
      card.find(".issue-due-box").remove();
    }

    //Attachment
    if (data.hasAttachment) {} else {
      card.find('.issue-attachment').remove();
    }

    //Estimate
    if (data.estimate) {
      card.find(".issue-estimate").text(data.estimate);
    } else {
      card.find(".issue-estimate").remove();
    }

    //Epic
    if (data.superIssue) {
      card.find(".issue-epic-id").text(data.superIssue.key);
      card.find(".issue-epic-name").text(data.superIssue.summary);
    } else {
      card.find(".issue-epic-box").remove();
    }

    //Tags
    if (data.tags) {
      card.find(".issue-tags").text(data.tags.join(', '));
    } else {
      card.find(".issue-tags").remove();
    }

    //QR-Code
    var qrCodeUrl = 'https://chart.googleapis.com/chart?cht=qr&chs=256x256&chld=L|1&chl=' + encodeURIComponent(data.url);
    card.find(".issue-qr-code").css("background-image", "url('" + qrCodeUrl + "')");
  }

  function styleCards() {
    var settings = global.settings;
    var printFrame = global.printFrame

    // hide/show description
    $(".issue-description", printFrame.document).toggle(!settings.hideDescription);
    // hide/show assignee
    $(".issue-assignee", printFrame.document).toggle(!settings.hideAssignee);
    // hide/show due date
    $(".issue-due-box", printFrame.document).toggle(!settings.hideDueDate);
    // hide/show estimate
    $(".issue-estimate", printFrame.document).toggle(!settings.hideEstimate);
    // hide/show cr code
    $(".issue-qr-code", printFrame.document).toggle(!settings.hideQrCode);
    // hide/show tags
    $(".issue-tags", printFrame.document).toggle(!settings.hideTags);
    // hide/show epic
    $(".issue-epic-box", printFrame.document).toggle(!settings.hideEpic);

    // enable/disable single card page
    $(".card", printFrame.document).css({ 'page-break-after' : '', 'float' : '', 'margin-bottom': '' });
    if (settings.singleCardPage) {
      $(".card", printFrame.document).css({ 'page-break-after': 'always', 'float': 'none', 'margin-bottom': '20px' });
    } else {
      $(".card", printFrame.document).each(function(index, element){
        if(index % (settings.colCount * settings.rowCount ) >= (settings.colCount * (settings.rowCount - 1))){
          $(element).css({ 'margin-bottom': '20px' });
        }
      });
    }
  }

  function scaleCards() {
    var settings = global.settings;
    var printFrame = global.printFrame;

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
    $("html", printFrame.document).css("font-size", scaleRoot + "cm");
    $("#gridStyle", printFrame.document).remove();

    // calculate scale

    var bodyElement = $("body", printFrame.document);
    var cardMaxWidth = Math.floor(bodyElement.outerWidth() / columnCount);
    var cardMaxHeight = Math.floor(bodyElement.outerHeight() / rowCount);

    var cardElement = $(".card", printFrame.document);
    var cardMinWidth = cardElement.css("min-width") ? cardElement.css("min-width").replace("px", "") : 0;
    var cardMinHeight = cardElement.css("min-height") ? cardElement.css("min-height").replace("px", "") : 0;

    var scaleWidth = cardMaxWidth / cardMinWidth ;
    var scaleHeight = cardMaxHeight / cardMinHeight ;
    var scale = Math.min(scaleWidth, scaleHeight, 1);

    // scale
    $("html", printFrame.document).css("font-size", ( scaleRoot * scale ) + "cm");

    // grid size
    var style = document.createElement('style');
    style.id = 'gridStyle';
    style.type = 'text/css';
    style.innerHTML = ".card { "+
    "width: calc( 100% / " + columnCount + " );" +
    "height: calc( 100% / " + rowCount + " );"+
    "}";
    $("head", printFrame.document).append(style);
  }

  function cropCards() {
    var cardElements = Array.from(global.printFrame.document.querySelectorAll(".card"));
    cardElements.forEach(function(cardElement) {
      var cardContent = cardElement.querySelectorAll(".card-body")[0];
      if (cardContent.scrollHeight > cardContent.offsetHeight) {
        cardContent.classList.add("zigzag");
      } else {
        cardContent.classList.remove("zigzag");
      }
    });
  }

  function closePrintPreview() {
    $("#card-printer-iframe").remove();
  }

  //############################################################################################################################
  //############################################################################################################################
  //############################################################################################################################

  // http://www.cssdesk.com/T9hXg

  function printPreviewElement() {
    var result = $('<div/>').html(global.printPreviewHtml).contents();

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

    result.find("#description-checkbox").click(function() {
      global.settings.hideDescription = !this.checked;
      saveSettings();
      redrawCards();
      return true;
    });

    // show assignee

    result.find("#assignee-checkbox").click(function() {
      global.settings.hideAssignee = !this.checked;
      saveSettings();
      redrawCards();
      return true;
    });

    // show due date

    result.find("#due-date-checkbox").click(function() {
      global.settings.hideDueDate = !this.checked;
      saveSettings();
      redrawCards();
      return true;
    });

    // show due date

    result.find("#estimate-checkbox").click(function() {
      global.settings.hideEstimate = !this.checked;
      saveSettings();
      redrawCards();
      return true;
    });

    // show QR Code

    result.find("#qr-code-checkbox").click(function() {
      global.settings.hideQrCode = !this.checked;
      saveSettings();
      redrawCards();
      return true;
    });

    // show Tags

    result.find("#tags-checkbox").click(function() {
      global.settings.hideTags = !this.checked;
      // can only display one of these two
      if (global.settings.hideTags == false ) {
        global.settings.hideEpic = true;
        $("#epic-checkbox", global.appFrame.document).attr('checked', false );
      }
      saveSettings();
      redrawCards();
      return true;
    });

    // show Epic 
    
    result.find("#epic-checkbox").click(function() {
      global.settings.hideEpic = !this.checked;
      // can only display one of these two
      if (global.settings.hideEpic == false ) {
        global.settings.hideTags = true;
        $("#tags-checkbox", global.appFrame.document).attr('checked', false );
      }
      saveSettings();
      redrawCards();
      return true;
    });

    // scale font

    result.find("#scaleRange").on('input', function() {
      global.settings.scale = $(this).val();
      saveSettings();
      redrawCards();
    });

    // grid

    result.find("#rowCount").on('input',function() {
      global.settings.rowCount = $(this).val();
      saveSettings();
      redrawCards();
    });
    result.find("#rowCount").click(function() {
      this.select();
    });

    result.find("#columnCount").on('input',function() {
      global.settings.colCount = $(this).val();
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

    $(document).keyup(function(e) {
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

  function printPreviewElementStyle() {
    var result = $(document.createElement('style'))
      .attr("type", "text/css")
      .html(global.printPreviewCss);
    return result;
  }

  // card layout: http://jsfiddle.net/qoomon/ykbLb2pw/76

  function cardElement(issueKey) {
    var result = $('<div/>').html(global.cardHtml).contents()
      .attr("id", issueKey)
    return result;
  }

  function cardElementStyle() {
    var result = $(document.createElement('style'))
      .attr("type", "text/css")
      .html(global.cardCss);
    return result;
  }
  
  function textColor(text){

    const colours = [
      '#EF5350',
      '#EC407A',
      '#AB47BC',
      '#7E57C2',
      '#5C6BC0',
      '#42A5F5',
      '#29B6F6',
      '#26C6DA',
      '#26A69A',
      '#66BB6A',
      '#9CCC65',
      '#D4E157',
      '#FFEE58',
      '#FFCA28',
      '#FFA726',
      '#FF7043',
      '#8D6E63',
      '#78909C'
    ];

    var textHash = 0, i, chr, len;
    for (i = 0, len = text.length; i < len; i++) {
      chr   = text.charCodeAt(i);
      textHash  = ((textHash << 5) - textHash) + chr;
      textHash |= 0; // Convert to 32bit integer
    }
    const colourIndex = textHash % colours.length;
    return colours[colourIndex];
  }

  //############################################################################################################################
  // APP Specific Functions
  //############################################################################################################################

  function getIssueTrackers(){
    var issueTrackers = []

    var jiraFunctions = (function(module) {
      module.name = "JIRA";

      module.baseUrl = function() {
        var jiraBaseUrl = window.location.origin;
        try { jiraBaseUrl = $("input[title='baseURL']").attr('value'); } catch(ex){}
        return jiraBaseUrl
      }

      module.isEligible = function(){
        return $("meta[name='application-name'][ content='JIRA']").length > 0;
      }

      module.getSelectedIssueKeyList = function() {

        //Issues
        if (/.*\/issues\/.*/g.test(document.URL)) {

          var issues =  $('.issue-list > li').map(function() {
              return $(this).attr('data-key');
          });

          //backward compatibility
          if (issues.empty()) {
            issues =  $('tr[data-issuekey]').map(function() {
              return $(this).attr('data-issuekey');
            });
          }

          return issues;
        }

        //Browse
        if (/.*\/browse\/.*/g.test(document.URL)) {
          return [document.URL.match(/.*\/browse\/([^?]*).*/)[1]];
        }

        //Project
        if (/.*\/projects\/.*/g.test(document.URL)) {
          return [document.URL.match(/.*\/projects\/[^\/]*\/[^\/]*\/([^?]*).*/)[1]];
        }

        // RapidBoard
        if (/.*\/secure\/RapidBoard.jspa.*/g.test(document.URL)) {
          return $('div[data-issue-key].ghx-selected').map(function() {
            return $(this).attr('data-issue-key');
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
          issueData.estimate = data.fields.storyPoints;

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

          issueData.url = module.baseUrl() + "/browse/" + issueData.key;

          return Promise.all(promises);
        }));

        return Promise.all(promises).then(function(results){return issueData;});
      };

      module.getIssueData = function(issueKey) {
        //https://docs.atlassian.com/jira/REST/latest/
        var url = module.baseUrl() + '/rest/api/2/issue/' + issueKey + '?expand=renderedFields,names';
        console.log("IssueUrl: " + url);
        //console.log("Issue: " + issueKey + " Loading...");
        return httpGetJSON(url).then(function(responseData) {
          //console.log("Issue: " + issueKey + " Loaded!");
          // add custom fields with field names
          $.each(responseData.names, function(key, value) {
            if (key.startsWith("customfield_")) {
              var fieldName = value.toCamelCase();
              var fieldValue = responseData.fields[key];

              //deposit-solutions specific field mapping
              if(/.*\.deposit-solutions.com/g.test(window.location.hostname)){
                if (key == 'customfield_10006'){
                  fieldName = 'epicLink'
                }
                if (key == 'customfield_10007'){
                  fieldName = 'epicName'
                }
                if (key == 'customfield_10002'){
                  fieldName = 'storyPoints'
                }
              }
              
              //lufthansa specific field mapping
               if(/.*trackspace.lhsystems.com/g.test(window.location.hostname)){
                if (key == 'Xcustomfield_10006'){
                  fieldName = 'epicLink'
                }
                if (key == 'Xcustomfield_10007'){
                  fieldName = 'epicName'
                }
                if (key == 'Xcustomfield_10002'){
                  fieldName = 'storyPoints'
                }
                if (fieldName == 'desiredDate') {
                 fieldName ='dueDate'
                 fieldValue = formatDate(new Date(fieldValue));
                }
              }
              
              //console.log("add new field: " + fieldName + " with value from " + key);
              responseData.fields[fieldName] = fieldValue;
            }
          });
          return responseData;
        });
      };

      return module;
    }({}));
    issueTrackers.push(jiraFunctions);

    var youTrackFunctions = (function(module) {
      module.name = "YouTrack";

      module.isEligible = function(){
        return /.*myjetbrains.com\/youtrack\/.*/g.test(document.URL) || /.*youtrack.jetbrains.com\/.*/g.test(document.URL);
      }

      module.getSelectedIssueKeyList = function() {
        //Detail View
        if (/.*\/issue\/.*/g.test(document.URL)) {
          return [document.URL.match(/.*\/issue\/([^?]*).*/)[1]];
        }

        // Agile Board
        if (/.*\/rest\/agile.*/g.test(document.URL)) {
          return $('div.sb-task-focused').map(function() {
            return $(this).attr('id');
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
          $.each(responseData.field, function(key, value) {
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
    issueTrackers.push(youTrackFunctions);

    var pivotalTrackerFunctions = (function(module) {
      module.name = "PivotalTracker";

      module.isEligible = function(){
        return /.*pivotaltracker.com\/.*/g.test(document.URL);
      }

      module.getSelectedIssueKeyList = function() {
        //Single Story
        if (/.*\/stories\/.*/g.test(document.URL)) {
          return [document.URL.match(/.*\/stories\/([^?]*).*/)[1]];
        }

        // Project Board
        if (/.*\/projects\/.*/g.test(document.URL)) {
          return $('.story[data-id]:has(.selector.selected)').map(function() {
            return $(this).attr('data-id');
          });
        }

        // Workspace Board
        if (/.*\/workspaces\/.*/g.test(document.URL)) {
          return $('.story[data-id]:has(.selector.selected)').map(function() {
            return $(this).attr('data-id');
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
          issueData.estimate = data.estimate;

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
    issueTrackers.push(pivotalTrackerFunctions);

    var trelloFunctions = (function(module) {
      module.name = "trello";

      module.isEligible = function(){
        return /.*trello.com\/.*/g.test(document.URL);
      }

      module.getSelectedIssueKeyList = function() {
        //Board View
        if (/.*\/b\/.*/g.test(document.URL)) {
          // open card composer
          var issueKeys = $( ".card-composer").parent().find(".list-card > .list-card-details > .list-card-title").map(function() {
            return $(this).attr("href").match(/.*\/c\/([^/]*).*/)[1];
          });
          
          //read only board
          
          var issueKeys2 = $( "textarea.list-header-name.is-editing" ).parent().parent().find(".list-cards > .list-card > .list-card-details > .list-card-title").map(function() {
            return $(this).attr("href").match(/.*\/c\/([^/]*).*/)[1];
          })

          return jQuery.merge(issueKeys,issueKeys2 );
        }
        
        //Card View
        if (/.*\/c\/.*/g.test(document.URL)) {
          return [document.URL.match(/.*\/c\/([^/]*).*/)[1]];
        }
        
        return [];
      };

      module.getCardData = function(issueKey, callback) {
        var promises = [];
        var issueData = {};

        promises.push(module.getIssueData(issueKey).then(function(data) {
          issueData.key = data.idShort;

          // TODO get type from label name
          issueData.type = 'default';

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
        var url = "/1/cards/" + issueKey + "?members=true";
        console.log("IssueUrl: " + url);
        //console.log("Issue: " + issueKey + " Loading...");
        return httpGetJSON(url);
      };

      return module;
    }({}));
    issueTrackers.push(trelloFunctions);

    var mingleFunctions = (function(module) {
      module.name = "mingle";

      module.isEligible = function(){
        return /.*mingle.thoughtworks.com\/.*/g.test(document.URL);
      }

      module.getSelectedIssueKeyList = function() {
        //Bord View - /projects/<project_name>/cards/grid
        if (/.*\/projects\/[^/]*\/cards\/grid(\?.*)?/g.test(document.URL)) {
          var project = document.URL.match(/.*\/projects\/([^/]*).*/)[1];
          var number = $(document).find('#card_show_lightbox_content > div > form[data-card-number]').attr('data-card-number');
          return [project + "-" + number];
        }

        //Card View - /projects/<project_name>/cards/<card_number>
        if (/.*\/projects\/[^/]*\/cards\/\d+(\?.*)?/g.test(document.URL)) {
          var project = document.URL.match(/.*\/projects\/([^/]*).*/)[1];
          var number = document.URL.match(/.*\/projects\/[^/]*\/cards\/(\d+)(\?.*)?/)[1];
          return [project + "-" + number];
        }

        return [];
      };

      module.getCardData = function(issueKey, callback) {
        var promises = [];
        var issueData = {};

        promises.push(module.getIssueData(issueKey).then(function(data) {
          data = $(data.documentElement)

          issueData.key = data.find('card > number')[0].textContent;
          issueData.type = data.find('card > card_type > name')[0].textContent.toLowerCase();
          issueData.summary = data.find('card > name')[0].textContent;
          issueData.description = data.find('card > description')[0].innerHTML;  // TODO use data.find('card > rendered_description')[0].attr('url');

          if(data.find('card > properties > property > name:contains(Owner) ~ value > name').length > 0){
            issueData.assignee = data.find('card > properties > property > name:contains(Owner) ~ value > name')[0].textContent;
            // TODOissueData.avatarUrl
          }

          // n/a issueData.dueDate = formatDate(new Date(dueDate));
          // n/a issueData.hasAttachment = data.fields.attachment.length > 0;

          if(data.find('card > properties > property > name:contains(Estimate) ~ value').length > 0){
            issueData.estimate = data.find('card > properties > property > name:contains(Estimate) ~ value')[0].textContent;
          }

          // n/a issueData.superIssue

          var projectIdentifier = data.find('card > project > identifier')[0].textContent;
          var cardNumber = data.find('card > number')[0].textContent
          issueData.url = "https://" + document.location.hostname + "/projects/" + projectIdentifier + "/cards/" + cardNumber;
        }));

        return Promise.all(promises).then(function(results){return issueData;});
      };

      module.getIssueData = function(issueKey) {
        var issueKeySplit = issueKey.split('-');
        var project = issueKeySplit[0];
        var number = issueKeySplit[1];
        var url = "/api/v2/projects/" + project + "/cards/" + number + ".xml";
        console.log("IssueUrl: " + url);
        //console.log("Issue: " + issueKey + " Loading...");
        return httpGet(url);
      };

      return module;
    }({}));
    issueTrackers.push(mingleFunctions);

    var teamForgeFunctions = (function(module) {
      module.name = "TeamForge";

      module.isEligible = function() {
        return /^TeamForge\s:/.test(document.title);
      };

      module.getSelectedIssueKeyList = function() {
        var keys = [];
        jQuery("input[type=checkbox][name=_listItem]").each(function(idx, el) { keys.push(el.value); });
        return keys;
      };

      // determine the positions of configurable fields within the table
      var determineFieldPositions = (function() {
        var map = null;
        return function() {
          if (!map) {
            map = {};
            // commented out fields are not used yet for the card layout
            var rMap = {
              "Customer": -1,
              "Category": -1,
              "Artifact ID\u00a0:\u00a0Title": -1,
              "Assigned To": -1,
              "Description": -1
              //"Priority": -1,
              //"Submitted By": -1,
            };

            jQuery("#ArtifactListTable tr.ItemListHeader td").each(function (idx, el) {
              // only return the immediate field text without text from child elements
              const elText = jQuery(el).clone().children().remove().end().text();
              if (elText in rMap) {
                rMap[elText] = idx;
              }
            });

            map = {};
            for (f in rMap) {
              if (rMap[f] == -1) {
                throw "Please configure the required field " + f + " in your current view.";
              }
              map[rMap[f]] = f;
            }
          }
          return map;
        };
      })();

      var getSiteAuthority = (function() {
        var authority = null;
        return function() {
          if (!authority) {
            var parser = document.createElement("a");
            parser.href = location.href;
            authority = parser.protocol + "//" + parser.hostname + parser.port;
          }
          return authority;
        }
      })();

      module.getCardData = function(issueKey) {
        var issueData = {};
        jQuery("#ArtifactListTable tr.EvenRow:not(#filter), #ArtifactListTable tr.OddRow:not(#filter)").each(function(trIdx, trEl) {
          const curKey = jQuery(trEl).find("input[type=checkbox][name=_listItem]")[0].value;
          // skip processing of unwanted rows
          if (issueKey !=  curKey) {
            return;
          }
          issueData.key = curKey;
          issueData.type = 'Bug';
          issueData.hasAttachment = false;
          issueData.estimate = '';
          issueData.tags = [];

          jQuery(trEl).find("td").each(function(tdIdx, tdEl) {
            const posFieldMap = determineFieldPositions();
            const field = posFieldMap[tdIdx];
            // skip unknown field / column
            if (!field) {
              return;
            }
            if (field == "Description") {
              issueData.description = jQuery(tdEl).text();
            }
            else if (field == "Artifact ID : Title") {
              issueData.summary = jQuery(tdEl).find("a").text();
              issueData.url = getSiteAuthority() + jQuery(tdEl).find("a").attr("href");
            } else if (field == "Assigned To") {
              issueData.assignee = jQuery(tdEl).text();
              if (issueData.assignee == 'None') {
                issueData.assignee = '';
              }
            } else if (field == "Customer" || field == "Category") {
              issueData.tags.push(field + ":" + jQuery(tdEl).text())
            }
          });
        });

        return Promise.resolve(issueData);
      };

      module.getIssueData = function(issueKey) {
        // The TeamForge API uses OAuth for authentication purposes, so we cannot use that here
        // see https://forge.collab.net/apidoc/
        return [];
      };

      return module;
    }({}));
    issueTrackers.push(teamForgeFunctions);

    return issueTrackers;
  }

  //############################################################################################################################
  //############################################################################################################################
  //############################################################################################################################

  function initGoogleAnalytics() {
    if (global.isDev) {
      this.ga = function(){ console.log("GoogleAnalytics: " + Object.keys(arguments).map(key => arguments[key]))}
      return;
    }
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
    var expireDate = new Date();  // current date & time
    expireDate.setFullYear(expireDate.getFullYear() + 1) // one year
    document.cookie = name + "=" + value + "; path=/; expires=" + expireDate.toGMTString();

    // cleanup due to former path
    document.cookie = name + "=; expires=" + new Date(0).toGMTString();
  }

  function httpGetCORS(){
    //arguments[0] = 'https://jsonp.afeld.me/?url=' + arguments[0];
    //arguments[0] = 'http://cors.io/?u=' + arguments[0];
    arguments[0] = 'https://crossorigin.me/' + arguments[0];
    return httpGet.apply(this, arguments);
  }

  function httpGet(){
    return Promise.resolve($.get.apply(this, arguments));
  }

  function httpGetJSON(){
    return Promise.resolve($.getJSON.apply(this, arguments));
  }

  function resizeIframe(iframe) {
    iframe = $(iframe);
    iframe.height(iframe[0].contentWindow.document.body.height);
  }

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

  function multilineString(commentFunction) {
      return commentFunction.toString()
          .replace(/^[^\/]+\/\*!?/, '')
          .replace(/\*\/[^\/]+$/, '');
  }

  //############################################################################################################################
  // Resources
  //############################################################################################################################
  function getResources(){
   var resources = {};
   resources.cardHtml = multilineString(function(){/*
     <div class="card">
       <div class="card-content">
         <div class="card-body shadow">
           <div class="issue-summary"></div>
           <div class="issue-description"></div>
         </div>
         <div class="card-header">
           <div class="author">
             <span>qoomon.com</span>
             <br>
             <span>©BengtBrodersen</span>
           </div>
           <div class="issue-id badge"></div>
           <div class="issue-id-fadeout"></div>
           <div class="issue-icon badge" type="loading"></div>
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
           <div class="issue-tags badge"></div>
           <div class="issue-epic-box badge">
             <span class="issue-epic-id"></span><br>
             <span class="issue-epic-name"></span>
           </div>
         </div>
       </div>
     </div>
     */});
    resources.cardCss = multilineString(function(){/*
     * {
       box-sizing: border-box;
       overflow: hidden;
     }
     html {
       background-color: LIGHTGREY;
       padding: 0rem;
       margin: 1rem;
       font-size: 1.0cm;
       overflow-y: scroll;
     }
     body {
       padding: 0rem;
       margin: 0rem;
       max-height: 100%;
       max-width: 100%;
       overflow: visible;
     }
     .badge, .shadow {
       border-style: solid;
       border-color: #454545;
       border-top-width: 0.12rem;
       border-left-width: 0.12rem;
       border-bottom-width: 0.21rem;
       border-right-width: 0.21rem;
       border-radius: 0.25rem;
     }
     .badge {
       background-color: WHITESMOKE;
     }
     .hidden {
       display: none;
     }
     .zigzag {
       border-bottom-width: 0rem;
     }
     .zigzag::after {
         box-sizing: border-box;
         position: absolute;
         bottom: 0.00rem;
         left: 0.0rem;
         content: "";
         width: 100%;
         border-style: solid;
         border-bottom-width: 0.5rem;
         border-image: url(https://rawgit.com/qoomon/Jira-Issue-Card-Printer/develop/resources//Tearing.png);
         border-image-width: 0 0 0.7rem 0;
         border-image-slice: 56 0 56 1;
         border-image-repeat: round round;
     }
     #preload {
       position: fixed;
       top: 0rem;
       left: 100%;
     }
     .author {
       color: DIMGREY;
       position: relative;
       top: 0.2rem;
       left: calc(50% - 2rem);
       font-size: 0.8rem;
       overflow: visible;
       line-height: 0.38rem;
     }
     .author > span:nth-of-type(2) {
       position: relative;
       top: 0.1rem;
       left: 0.65rem;
       font-size: 0.5em;
     }
     .card {
       position: relative;
       float: left;
       height: 100%;
       width: 100%;
       padding: 0.5rem;
       min-width: 14.5rem;
       min-height: 8.65rem;
       overflow: hidden;
       background-color: WHITE;
     }
     .card::before {
         box-sizing: border-box;
         overflow: visible;
         position: absolute;
         top: 0.0rem;
         left: 0.0rem;
         content: "";
         width: 100%;
         height: 100%;
         border-color: LightGray;
         border-style: dashed;
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
       padding-top: 1.1rem;
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
       font-size: 0.9rem;
     }
     .issue-description {
       margin-top: 0.1rem;
       display: block;
       font-size: 0.6rem;
       line-height: 0.62rem;
       overflow: hidden;
     }
     .issue-description p:first-of-type {
       margin-top: 0rem;
     }
     .issue-description p:last-of-type {
       margin-bottom: 0rem;
     }
     .issue-id {
       position: absolute;
       left: 1rem;
       top: 1.2rem;
       height: 1.5rem;
       max-width: calc(100% - 7.5rem);
       min-width: 6.0rem;
       padding-left: 2.1rem;
       padding-right: 0.4rem;
       background-color: WHITESMOKE;
       line-height: 1.3rem;
       font-size: 0.8rem;
       font-weight: bold;
       text-align: center;
       white-space: nowrap;
       direction: rtl;
     }
     .issue-id-fadeout {
       position: absolute;
       left: 2.4rem;
       top: 1.3rem;
       width: 1.2rem;
       height: 1.2rem;
       z-index: 0;
       background: linear-gradient(to left, rgba(224, 224, 224, 0) 0%, rgba(224, 224, 224, 1) 60%);
     }
     .issue-icon {
       position: absolute;
       left: 0rem;
       top: 0rem;
       height: 3.0rem;
       width: 3.0rem;
       border-radius: 50%;
       background-color: DEEPSKYBLUE;
       background-image: url(https://qoomon.github.io/Jira-Issue-Card-Printer/resources/icons/CloudLoading.png);
       background-repeat: no-repeat;
       background-position: center;
       background-size: 63%;
     }
     .issue-estimate {
       position: absolute;
       left: 2.5rem;
       top: 0.0rem;
       height: 1.6rem;
       width: 1.6rem;
       border-radius: 50%;
       background-color: WHITESMOKE;
       line-height: 1.4rem;
       font-size: 0.9rem;
       font-weight: bold;
       text-align: center;
     }
     .issue-qr-code {
       position: absolute;
       left: 0rem;
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
       left: 2.5rem;
       top: 0rem;
       width: 2.0rem;
       height: 2.0rem;
       border-radius: 50%;
       background-color: LIGHTSKYBLUE;
       background-image: url(https://qoomon.github.io/Jira-Issue-Card-Printer/resources/icons/Attachment.png);
       background-repeat: no-repeat;
       background-position: center;
       background-size: 70%;
     }
     .issue-assignee {
       position: absolute;
       top: 0rem;
       right: 0rem;
       width: 2.2rem;
       height: 2.2rem;
       border-radius: 50%;
       background-color: WHITESMOKE;
       background-repeat: no-repeat;
       background-position: center;
       background-size: cover;
       //-webkit-filter: contrast(200%) grayscale(100%);
       //filter: contrast(200%) grayscale(100%);
       text-align: center;
       font-weight: bold;
       font-size: 1.0rem;
       line-height: 2.0rem;
     }
     .issue-tags {
       position: absolute;
       right: 2.5rem;
       top: 0.4rem;
       width: auto;
       min-width: 2rem;
       width: auto;
       max-width: calc(100% - 7.5rem);
       height: auto;
       max-height: 1.9rem;
       padding-top: 0.2rem;
       padding-bottom: 0.2rem;
       padding-left: 0.3rem;
       padding-right: 0.3rem;
       text-align: left;
       font-size: 0.7rem;
       line-height: 0.7rem;
       font-style: italic;
       background: lightyellow;
     }
     .issue-epic-box {
       position: absolute;
       right: 2.5rem;
       top: 0rem;
       width: auto;
       min-width: 2rem;
       width: auto;
       max-width: calc(100% - 7.5rem);
       height: auto;
       max-height: 2.2rem;
       padding-top: 0.1rem;
       padding-bottom: 0.2rem;
       padding-left: 0.3rem;
       padding-right: 0.3rem;
       text-align: left;
       font-size: 0.5rem;
       line-height: 0.55rem;
     }
     .issue-epic-id {
       font-size: 0.6rem;
       font-weight: bold;
       max-width: 1rem;
     }
     .issue-epic-name {
       font-size: 0.55rem;
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
       border-radius: 50%;
       background-color: ORCHID;
       background-image: url(https://qoomon.github.io/Jira-Issue-Card-Printer/resources/icons/AlarmClock.png);
       background-repeat: no-repeat;
       background-position: center;
       background-size: 65%;
     }
     @media print {
       @page {
         margin: 0.0mm;
         padding: 0.0mm;
       }
       html {
         margin: 0.0mm;
         padding: 0.0mm;
         background-color: WHITE !important;
         -webkit-print-color-adjust: exact !important;
         print-color-adjust: exact !important;
       }
       .card {
         page-break-inside: avoid !important;
         margin: 0.0mm !important;
       }
     }
     */});
    resources.printPreviewHtml = multilineString(function(){/*
     <div id="card-print-overlay">
       <div id="card-print-dialog">
         <div id="card-print-dialog-header">
           <div id="card-print-dialog-title">Card Printer</div>
           <div id="info">
             <label id="info-line"><b>Jira</b> - <b>Trello</b> - <b>YouTrack</b> - <b>PivotalTracker</b> - <b>TeamForge</b></label>
             <div id="report-issue" class="ui-element button" >Report Issues</div>
             <div id="about" class="ui-element button" >About</div>
           </div>
         </div>
         <div id="card-print-dialog-content">
           <iframe id="card-print-dialog-content-iframe"></iframe>
         </div>
         <div id="card-print-dialog-footer">
           <div class="buttons">
             <div class="ui-element" style="float: left;" >
               <input id="columnCount" type="number" min="0" max="9" class="numberInput" style="float: left; width: 18px; padding: 2px;" value="1"/>
               <div style="float: left; margin-left: 5px; margin-right: 5px;">x</div>
               <input id="rowCount" type="number" min="0" max="9" class="numberInput" style="float: left; width: 18px; padding: 2px;" value="2"/>
               <label style="float: left; margin-left:5px;">Page Grid</label>
             </div>
             <div class="ui-element" style="float: left;">
               <form style="float: left;" oninput="amount.value=parseFloat(scaleRange.value).toFixed(1)">
                 <input id="scaleRange" type="range" min="-1.0" max="1.0" step="0.1" value="0.0" style="float: left; width: 70px; position: relative;
         top: -2px;" />
                 <label>Scale</label>
                 <output style="float: left; width: 22px; margin-left:2px;" name="amount" for="scaleRange"></output>
               </form>

             </div>
             <div class="ui-element checkbox" style="float: left;">
               <input id="single-card-page-checkbox" type="checkbox"/>
               <label for="single-card-page-checkbox"></label>
               <label for="single-card-page-checkbox">Single Card Per Page</label>
             </div>
             <div class="ui-element checkbox" style="float: left;">
               <input id="description-checkbox" type="checkbox"/>
               <label for="description-checkbox"></label>
               <label for="description-checkbo">Description</label>
             </div>
             <div class="ui-element checkbox" style="float: left;">
               <input id="assignee-checkbox" type="checkbox"/>
               <label for="assignee-checkbox"></label>
               <label for="assignee-checkbox">Assignee</label>
             </div>
             <div class="ui-element checkbox" style="float: left;">
               <input id="due-date-checkbox" type="checkbox"/>
               <label for="due-date-checkbox"></label>
               <label for="due-date-checkbox">Due Date</label>
             </div>
             <div class="ui-element checkbox" style="float: left;">
               <input id="estimate-checkbox" type="checkbox"/>
               <label for="estimate-checkbox"></label>
               <label for="estimate-checkbox">Estimate</label>
             </div>
             <div class="ui-element checkbox" style="float: left;">
               <input id="qr-code-checkbox" type="checkbox"/>
               <label for="qr-code-checkbox"></label>
               <label for="qr-code-checkbox">QR Code</label>
             </div>
             <div class="ui-element checkbox" style="float: left;">
               <input id="tags-checkbox" type="checkbox"/>
               <label for="tags-checkbox"></label>
               <label for="tags-checkbox">Tags</label>
             </div>
             <div class="ui-element checkbox" style="float: left;">
               <input id="epic-checkbox" type="checkbox"/>
               <label for="epic-checkbox"></label>
               <label for="epic-checkbox">Epic</label>
             </div>

             <div id="card-print-dialog-print" class="ui-element button button-primary" >Print</div>
           </div>
         </div>
       </div>
     </div>
     */});
    resources.printPreviewCss = multilineString(function(){/*
     * {
       font-family: Arial, sans-serif;
       color: #656565;
     }
     #card-print-overlay {
       position: fixed;
       height: 100%;
       width: 100%;
       top: 0;
       left: 0;
       background: rgba(0, 0, 0, 0.5);
       box-sizing: border-box;
       word-wrap: break-word;
       z-index: 99999;
     }
     #card-print-dialog {
       position: relative;
       top: 60px;
       right: 0px;
       left: 0px;
       height: calc(100% - 120px);
       width: 1100px;
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
       padding: 10px 15px 15px 15px;
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
       border: none;
     }
     #card-print-dialog-footer {
       position: relative;
       background: #f0f0f0;
       border-top: 1px solid #cccccc;
       height: 30px;
       padding: 15px 15px 10px 15px;
       text-align: right;
       font-size: 13px;
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
       height: 30px;
     }
     #info-line {
       font-size: 14px;
       line-height: 29px;
       margin-right: 8.4rem;
     }
     #card-print-dialog-title {
       position: relative;
       float: left;
       color: rgb(51, 51, 51);
       display: block;
       font-size: 20px;
       font-weight: normal;
       height: 30px;
       line-height: 30px;
     }
     .ui-element {
       color: #656565;
       font-size: 12px;
       font-weight: 600;
       display: inline-block;
       margin: 5px 5px;
       vertical-align: baseline;
     }
     .button {
         cursor: pointer;
         background-color: #DEDEDE;
         border: 1px solid #D4D4D4;
         border-radius: 3px;
         display: inline-block;
         font-size: 13px;
         font-weight: 700;
         padding: 5.8px 20px;
         margin: 0px 2px;
         text-decoration: none;
         text-align: center;
     }
     .button-primary{
         background-color: #5689db;
         border: 1px solid #5689db;
         color: #fff;
     }
     label {
       display: block;
       margin-left: 5px;
       float:left;
     }
     label[for] {
       cursor: pointer;
     }
     .checkbox {
       position: relative;
       width: auto;
       height: auto;
     }
     .checkbox  input[type=checkbox]{
       display: none;
     }
     .checkbox input[type=checkbox]  + label {
       margin: 0px;
       position: relative;
       width: 15px;
       height: 15px;
       border-radius: 4px;
       background-color: #DEDEDE;
       border: 1px solid #D4D4D4;
     }
     .checkbox input[type=checkbox] + label::after {
       opacity: 0;
       content: '';
       position: absolute;
       width: 6px;
       height: 3px;
       background: transparent;
       top: 4px;
       left: 4px;
       border: 2px solid #656565;
       border-top: none;
       border-right: none;
       transform: rotate(-45deg);
     }
     .checkbox input[type=checkbox]:checked + label::after {
       opacity: 1;
     }
     input[type=number].numberInput {
         color: #656565;
         position: relative;
         top: -2;
         font-size: 12px;
         font-weight: 700;
         width:1.5em;
         padding:3px;
         margin:0;
         border:1px solid #ddd;
         border-radius:5px;
         text-align: center;
         background-color: #DEDEDE;
         border: 1px solid #D4D4D4;
         width: 100px;
     }
     input[type=number].numberInput::-webkit-inner-spin-button,
     input[type=number].numberInput ::-webkit-outer-spin-button {
        -webkit-appearance: none;
     }
     input[type=number].numberInput:hover{
         border:1px solid #ddd;
         background-color: #f6f6f6;
     }
     input[type=number].numberInput:focus{
         outline:none;
         border:1px solid #ddd;
         background-color: #f6f6f6;
     }
     */});

     return resources;
   }


})();
