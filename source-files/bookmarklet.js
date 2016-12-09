(function() {
  // Public Instances
  // Jira: https://connect.atlassian.net/browse/NERDS-33286
  // PivotTracker: https://www.pivotaltracker.com/n/projects/510733
  // Trello: https://trello.com/b/8zlPSh70/spike
  // YouTrack: http://qoomon.myjetbrains.com/youtrack/dashboard

  var global = {};
  global.version = "5.0.1";
  global.issueTrackingUrl = "github.com/qoomon/Jira-Issue-Card-Printer";


  if (!String.prototype.startsWith) {
    String.prototype.startsWith = function(searchString, position){
      position = position || 0;
      return this.substr(position, searchString.length) === searchString;
    };
  }

  if (!Array.from) {
    Array.from = (function () {
      var toStr = Object.prototype.toString;
      var isCallable = function (fn) {
        return typeof fn === 'function' || toStr.call(fn) === '[object Function]';
      };
      var toInteger = function (value) {
        var number = Number(value);
        if (isNaN(number)) { return 0; }
        if (number === 0 || !isFinite(number)) { return number; }
        return (number > 0 ? 1 : -1) * Math.floor(Math.abs(number));
      };
      var maxSafeInteger = Math.pow(2, 53) - 1;
      var toLength = function (value) {
        var len = toInteger(value);
        return Math.min(Math.max(len, 0), maxSafeInteger);
      };

      // La propriété length de la méthode vaut 1.
      return function from(arrayLike/*, mapFn, thisArg */) {
        // 1. Soit C, la valeur this
        var C = this;

        // 2. Soit items le ToObject(arrayLike).
        var items = Object(arrayLike);

        // 3. ReturnIfAbrupt(items).
        if (arrayLike == null) {
          throw new TypeError("Array.from doit utiliser un objet semblable à un tableau - null ou undefined ne peuvent pas être utilisés");
        }

        // 4. Si mapfn est undefined, le mapping sera false.
        var mapFn = arguments.length > 1 ? arguments[1] : void undefined;
        var T;
        if (typeof mapFn !== 'undefined') {
          // 5. sinon
          // 5. a. si IsCallable(mapfn) est false, on lève une TypeError.
          if (!isCallable(mapFn)) {
            throw new TypeError('Array.from: lorsqu il est utilisé le deuxième argument doit être une fonction');
          }

          // 5. b. si thisArg a été fourni, T sera thisArg ; sinon T sera undefined.
          if (arguments.length > 2) {
            T = arguments[2];
          }
        }

        // 10. Soit lenValue pour Get(items, "length").
        // 11. Soit len pour ToLength(lenValue).
        var len = toLength(items.length);

        // 13. Si IsConstructor(C) vaut true, alors
        // 13. a. Soit A le résultat de l'appel à la méthode interne [[Construct]] avec une liste en argument qui contient l'élément len.
        // 14. a. Sinon, soit A le résultat de ArrayCreate(len).
        var A = isCallable(C) ? Object(new C(len)) : new Array(len);

        // 16. Soit k égal à 0.
        var k = 0;  // 17. On répète tant que k < len…
        var kValue;
        while (k < len) {
          kValue = items[k];
          if (mapFn) {
            A[k] = typeof T === 'undefined' ? mapFn(kValue, k) : mapFn.call(T, kValue, k);
          } else {
            A[k] = kValue;
          }
          k += 1;
        }
        // 18. Soit putStatus égal à Put(A, "length", len, true).
        A.length = len;  // 20. On renvoie A.
        return A;
      };
    }());
  }

  // enforce jQuery
  if (typeof jQuery == 'undefined') {
    alert("Unsupported Application " + document.URL + " or jQuery is missing!\n\nPlease create an issue at\n" + global.issueTrackingUrl);
    return;
  }

  // support for older jQuery versions
  if (!jQuery.fn.on) {
    jQuery.fn.on = function(action, handler) {
      return jQuery.bind(action, handler);
    };
  }

  var $ = jQuery;

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

    console.log("Run...");
    var issueTrackers = getIssueTrackers();
    for (var i = 0; i < issueTrackers.length; i++) {
      var issueTracker = issueTrackers[i];
      if(issueTracker.isEligible()){
        global.appFunctions = issueTracker;
        break;
      }
    }

    if(!global.appFunctions){
      alert("Unsupported Application " + document.URL + " Please create an issue at " + global.issueTrackingUrl);
      return;
    } else {
      console.log("Issue Tracker: " +   global.appFunctions.name);
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

    // add listeners to redraw cards on print event
    printFrame.window.addEventListener("resize", redrawCards);
    printFrame.window.matchMedia("print").addListener(redrawCards);
    printFrame.window.onbeforeprint = redrawCards;
    printFrame.window.onafterprint = redrawCards;

    // collect selected issues
    var issueKeyList = global.appFunctions.getSelectedIssueKeyList();
    if (issueKeyList.length <= 0) {
      alert("Please select at least one issue.");
      return;
    }
    if (issueKeyList.length > 30) {
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

    console.log("Init...");
    initGoogleAnalytics();

    addStringFunctions();
    loadSettings();

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
    error = JSON.stringify(error,2,2);
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
    global.printFrame.contentWindow.focus();
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
    var backgroundSize = '63%';
    switch (data.type.toLowerCase()) {
      case 'default':
        backgroundColor = 'SILVER';
        backgroundImage = 'https://qoomon.github.io/Jira-Issue-Card-Printer/resources/icons/objects.png';
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
      default:
        backgroundColor = textColor(data.type.toLowerCase());
        backgroundImage = 'http://identicon.org/?t=' + data.type.toLowerCase() + '&s=256&c=b';
        backgroundSize = '55%';
    }
    card.find('.issue-icon').css('background-color', backgroundColor);
    card.find('.issue-icon').css('background-image', 'url(' + backgroundImage + ')');
    card.find('.issue-icon').css('background-size', backgroundSize);

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
        const initials = data.assignee.trim().split(/\s/).map(function (namePart) {
          return namePart[0].toUpperCase();
        }).join('');
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
    if (!data.hasAttachment) {
      card.find('.issue-attachment').remove();
    }

    //Estimate
    if (data.estimate) {
      card.find(".issue-estimate").text(data.estimate);
    } else {
      card.find(".issue-estimate").remove();
    }

    //Supper Issue
    if(data.superIssue){
      var superIssueTagElement = $('<div />');
      superIssueTagElement.text(data.superIssue);
      superIssueTagElement.addClass('badge');
      superIssueTagElement.addClass('issue-tag');
      superIssueTagElement.addClass('issue-tag-super-issue');
      superIssueTagElement.css('background-color', textColor(data.superIssue));
      card.find(".issue-tags-box").append(superIssueTagElement);
    }

    //Labels
    if(data.labels){
      data.labels.forEach(function (label) {
        var tagElement = $('<div />');
        tagElement.text(label);
        tagElement.addClass('badge');
        tagElement.addClass('issue-tag');
        tagElement.addClass('issue-tag-label');
        tagElement.css('background-color', textColor(label));
        card.find(".issue-tags-box").append(tagElement);
      });
    }



    //QR-Code
    var qrCodeUrl = 'https://chart.googleapis.com/chart?cht=qr&chs=256x256&chld=L|1&chl=' + encodeURIComponent(data.url);
    card.find(".issue-qr-code").css("background-image", "url('" + qrCodeUrl + "')");
  }

  function styleCards() {
    var settings = global.settings;
    var printFrame = global.printFrame;

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
    // hide/show super issue tag
    $(".issue-tag-super-issue", printFrame.document).toggle(!settings.hideEpic);
    // hide/show label tags
    $(".issue-tag-label", printFrame.document).toggle(!settings.hideTags);

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
    "width: calc( 99.9999999999% / " + columnCount + " );" +
    "height: calc( 99.999999999% / " + rowCount + " );"+
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
    var result = $('<div/>').html("@@printPreview.html@@").contents();

    // info

    result.find("#report-issue").click(function(event) {
      window.open('https://github.com/qoomon/Jira-Issue-Card-Printer/issues');
      return false;
    });

    result.find("#about").click(function(event) {
      window.open('https://github.com/qoomon/Jira-Issue-Card-Printer');
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
      saveSettings();
      redrawCards();
      return true;
    });

    // show Epic

    result.find("#epic-checkbox").click(function() {
      global.settings.hideEpic = !this.checked;
      saveSettings();
      redrawCards();
      return true;
    });

    // scale font

    // change is needed for IE11 Support
    result.find("#scaleRange").on('input change', function() {
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
      .html("@@printPreview.css@@");
    return result;
  }

  // card layout: http://jsfiddle.net/qoomon/ykbLb2pw/76

  function cardElement(issueKey) {
    var result = $('<div/>').html("@@card.html@@").contents()
      .attr("id", issueKey);
    return result;
  }

  function cardElementStyle() {
    var result = $(document.createElement('style'))
      .attr("type", "text/css")
      .html("@@card.css@@");
    return result;
  }

  function textColor(text){

    const colours = [
      '#ff5653',
      '#ff5ecc',
      '#de59f5',
      '#ab7aff',
      '#7f91fb',
      '#38a1f7',
      '#21b6f9',
      '#26c6da',
      '#27cebe',
      '#78dc7c',
      '#9ccc65',
      '#f9a72f',
      '#fde93d',
      '#ffca28',
      '#ffb343',
      '#ff7d54',
      '#d4a493'
    ];

    var textHash = 0;
    var i, chr;
    for (i = 0; i < text.length; i+=1) {
      chr = text.charCodeAt(i);
      textHash = ((textHash << 5) - textHash) + chr;
      textHash |= 0; // Convert to 32bit integer
    }
    const colourIndex = Math.abs(textHash) % colours.length;
    return colours[colourIndex];
  }

  //############################################################################################################################
  // APP Specific Functions
  //############################################################################################################################

  function getIssueTrackers(){
    var issueTrackers = [];

    var jiraFunctions = (function(module) {
      module.name = "JIRA";

      module.baseUrl = function() {
        var jiraBaseUrl = window.location.origin;
        try { jiraBaseUrl = $("input[title='baseURL']").attr('value'); } catch(ex){}
        return jiraBaseUrl;
      };

      module.isEligible = function(){
        return $("meta[name='application-name'][ content='JIRA']").length > 0;
      };

      module.getSelectedIssueKeyList = function() {

        //Browse
        if (/.*\/browse\/.*/g.test(document.URL)) {
          return [document.URL.match(/.*\/browse\/([^?]*).*/)[1]];
        }

        //Project
        if (/.*\/projects\/.*/g.test(document.URL)) {
          return [document.URL.match(/.*\/projects\/[^\/]*\/[^\/]*\/([^?]*).*/)[1]];
        }

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
          issueData.labels = data.fields.labels;

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
              issueData.superIssue = data.key + ' ' + data.fields.summary;
            }).catch(function(){}));
          } else if (data.fields.epicLink) {
            promises.push(module.getIssueData(data.fields.epicLink).then(function(data) {
              issueData.superIssue = data.key + ' ' + data.fields.epicName;
            }).catch(function(){}));
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
                  fieldName = 'epicLink';
                }
                if (key == 'customfield_10007'){
                  fieldName = 'epicName';
                }
                if (key == 'customfield_10002'){
                  fieldName = 'storyPoints';
                }
              }

              //lufthansa specific field mapping
               if(/.*trackspace.lhsystems.com/g.test(window.location.hostname)){
                if (key == 'Xcustomfield_10006'){
                  fieldName = 'epicLink';
                }
                if (key == 'Xcustomfield_10007'){
                  fieldName = 'epicName';
                }
                if (key == 'Xcustomfield_10002'){
                  fieldName = 'storyPoints';
                }
                if (fieldName == 'desiredDate') {
                 fieldName ='dueDate';
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
        return (/.*myjetbrains.com\/youtrack\/.*/g).test(document.URL) || (/.*youtrack.jetbrains.com\/.*/g).test(document.URL);
      };

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
      };

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
      };

      module.getSelectedIssueKeyList = function() {
        //Board View
        if (/.*\/b\/.*/g.test(document.URL)) {
          // open card composer
          var issueKeys = $( ".card-composer").parent().find(".list-card > .list-card-details > .list-card-title").map(function() {
            return $(this).attr("href").match(/.*\/c\/([^\/]*).*/)[1];
          });

          //read only board

          var issueKeys2 = $( "textarea.list-header-name.is-editing" ).parent().parent().find(".list-cards > .list-card > .list-card-details > .list-card-title").map(function() {
            return $(this).attr("href").match(/.*\/c\/([^\/]*).*/)[1];
          });

          return jQuery.merge(issueKeys,issueKeys2 );
        }

        //Card View
        if (/.*\/c\/.*/g.test(document.URL)) {
          return [document.URL.match(/.*\/c\/([^\/]*).*/)[1]];
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
          issueDate.labels = data.labels.map(function(label){
            return label.name;
          });

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
      };

      module.getSelectedIssueKeyList = function() {
        //Bord View - /projects/<project_name>/cards/grid
        if (/.*\/projects\/[^\/]*\/cards\/grid(\?.*)?/g.test(document.URL)) {
          var project = document.URL.match(/.*\/projects\/([^\/]*).*/)[1];
          var number = $(document).find('#card_show_lightbox_content > div > form[data-card-number]').attr('data-card-number');
          return [project + "-" + number];
        }

        //Card View - /projects/<project_name>/cards/<card_number>
        if (/.*\/projects\/[^\/]*\/cards\/\d+(\?.*)?/g.test(document.URL)) {
          var project = document.URL.match(/.*\/projects\/([^\/]*).*/)[1];
          var number = document.URL.match(/.*\/projects\/[^\/]*\/cards\/(\d+)(\?.*)?/)[1];
          return [project + "-" + number];
        }

        return [];
      };

      module.getCardData = function(issueKey, callback) {
        var promises = [];
        var issueData = {};

        promises.push(module.getIssueData(issueKey).then(function(data) {
          data = $(data.documentElement);

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

          // TODO issueData.labels

          var projectIdentifier = data.find('card > project > identifier')[0].textContent;
          var cardNumber = data.find('card > number')[0].textContent;
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
            Object.keys(rMap).forEach(function (f) {
              if (rMap[f] == -1) {
                throw "Please configure the required field " + f + " in your current view.";
              }
              map[rMap[f]] = f;
            });
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
        };
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
          issueData.labels = [];

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
            else if (field == "Artifact ID : Title") {
              issueData.summary = jQuery(tdEl).find("a").text();
              issueData.url = getSiteAuthority() + jQuery(tdEl).find("a").attr("href");
            } else if (field == "Assigned To") {
              issueData.assignee = jQuery(tdEl).text();
              if (issueData.assignee == 'None') {
                issueData.assignee = '';
              }
            } else if (field == "Customer" || field == "Category") {
              issueData.labels.push(field + ":" + jQuery(tdEl).text());
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
        // uppercase letters preceded by a hyphen or a space
        s = s.replace(/([ \-]+)([a-zA-Z0-9])/g, function(a, b, c) {
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
})();
