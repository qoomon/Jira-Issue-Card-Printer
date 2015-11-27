(function() {
  var global = {};
  global.version = "4.2.6";
  global.issueTrackingUrl = "https://github.com/qoomon/Jira-Issue-Card-Printer";
  global.isDev = document.currentScript == null;
  global.isProd = !global.isDev;
  global.settings = {};

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
    } else if (/.*\/youtrack\/.*/g.test(document.URL)) {
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

    var settings = global.settings;
    settings.scale = readCookie("card_printer_font_scale",1);
    settings.rowCount = readCookie("card_printer_row_count",2);
    settings.colCount = readCookie("card_printer_column_count", 1);

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

    jQuery("#font-scale-range").val(settings.scale);
    jQuery("#rowCount").val(settings.rowCount);
    jQuery("#columnCount").val(settings.colCount);

    jQuery("#single-card-page-checkbox").attr('checked', readCookie("card_printer_single_card_page", 'true') == 'true');
    jQuery("#hide-description-checkbox").attr('checked', readCookie("card_printer_hide_description", 'false') == 'true');
    jQuery("#hide-assignee-checkbox").attr('checked', readCookie("card_printer_hide_assignee", 'true') == 'true');
    jQuery("#hide-due-date-checkbox").attr('checked', readCookie("card_printer_hide_due_date", 'false') == 'true');

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
    addDateFunctions();

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
    var printFrame = jQuery("#card-print-dialog-content-iframe");
    var printWindow = printFrame[0].contentWindow;
    var printDocument = printWindow.document;

    // hide/show description
    jQuery("#styleHideDescription", printDocument).remove();
    if (jQuery("#hide-description-checkbox")[0].checked) {
      var style = document.createElement('style');
      style.id = 'styleHideDescription';
      style.type = 'text/css';
      style.innerHTML = ".issue-description { display: none; }"
      jQuery("head", printDocument).append(style);
    }

    // hide/show assignee
    jQuery("#styleHideAssignee", printDocument).remove();
    if (jQuery("#hide-assignee-checkbox")[0].checked) {
      var style = document.createElement('style');
      style.id = 'styleHideAssignee';
      style.type = 'text/css';
      style.innerHTML = ".issue-assignee { display: none; }"
      jQuery("head", printDocument).append(style);
    }

    // hide/show assignee
    jQuery("#styleHideDueDate", printDocument).remove();
    if (jQuery("#hide-due-date-checkbox")[0].checked) {
      var style = document.createElement('style');
      style.id = 'styleHideDueDate';
      style.type = 'text/css';
      style.innerHTML = ".issue-due-box { display: none; }"
      jQuery("head", printDocument).append(style);
    }

    // enable/disable single card page
    jQuery("#styleSingleCardPage", printDocument).remove();
    if (jQuery("#single-card-page-checkbox")[0].checked) {
      var style = document.createElement('style');
      style.id = 'styleSingleCardPage';
      style.type = 'text/css';
      style.innerHTML = ".card { page-break-after: always; float: none; }"
      jQuery("head", printDocument).append(style);
    }
  }

  function scaleCards() {
    var printFrame = jQuery("#card-print-dialog-content-iframe");
    var printWindow = printFrame[0].contentWindow;
    var printDocument = printWindow.document;

    var scaleRoot = global.settings.scale;
    var rowCount = global.settings.rowCount;
    var columnCount = global.settings.colCount;

    // scale

    // reset scale
    jQuery("html", printDocument).css("font-size", scaleRoot +"cm");
    jQuery("#styleColumnCount", printDocument).remove();
    jQuery("#styleRowCount", printDocument).remove();

    // scale horizontal
    // substract one pixel due to rounding problems
    var cardMaxWidth = Math.floor(jQuery(".card", printDocument).outerWidth() / columnCount);
    var cardMinWidth = jQuery(".card", printDocument).css("min-width").replace("px", "");
    var scaleWidth = cardMaxWidth / cardMinWidth - 0.01;

    // scale vertical
    // substract one pixel due to rounding problems
    // dont know why to multiply outer height with 2
    var cardMaxHeight = Math.floor(jQuery(".card", printDocument).outerHeight()  / rowCount);
    var cardMinHeight = jQuery(".card", printDocument).css("min-height").replace("px", "");
    var scaleHeight = cardMaxHeight / cardMinHeight - 0.01;

    // scale down
    var scale = Math.min(scaleWidth, scaleHeight, 1);
    if (scale < 1) {
      jQuery("html", printDocument).css("font-size", ( scaleRoot * scale) + "cm");
    }

    // size

    // size horizontal
    var style = document.createElement('style');
    style.id = 'styleColumnCount';
    style.type = 'text/css';
    style.innerHTML = ".card { width: calc( 100% / " + columnCount + " - 0.001px  ); }"
    jQuery("head", printDocument).append(style);

    // size horizontal
    var style = document.createElement('style');
    style.id = 'styleRowCount';
    style.type = 'text/css';
    style.innerHTML = ".card { height: calc( 100% / " + rowCount + " - 0.001px );  }"
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
      writeCookie("card_printer_single_card_page", this.checked);
      redrawCards();
      return true;
    });

    // hide description

    result.find("#hide-description-checkbox").click(function() {
      writeCookie("card_printer_hide_description", this.checked);
      redrawCards();
      return true;
    });

    // show assignee

    result.find("#hide-assignee-checkbox").click(function() {
      writeCookie("card_printer_hide_assignee", this.checked);
      redrawCards();
      return true;
    });

    // show due date

    result.find("#hide-due-date-checkbox").click(function() {
      writeCookie("card_printer_hide_due_date", this.checked);
      redrawCards();
      return true;
    });

    // scale font

    result.find("#font-scale-range").on("input", function() {
      writeCookie("card_printer_font_scale", jQuery(this).val());

      global.settings.scale = jQuery(this).val();

      redrawCards();
    });

    // grid

    result.find("#rowCount").on("input", function() {
      writeCookie("card_printer_row_count", jQuery(this).val());

      global.settings.rowCount = jQuery(this).val();

      redrawCards();
    });
    result.find("#rowCount").click(function() {
      this.select();
    });


    result.find("#columnCount").on("input", function() {
      writeCookie("card_printer_column_count", jQuery(this).val());

      global.settings.colCount = jQuery(this).val();

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

  function readCookie(name, defaultValue) {
    var cookies = document.cookie.split('; ');

    for (var i = 0; i < cookies.length; i++) {
      var cookie = cookies[i].split('=');
      if (cookie[0] == name) return cookie[1];
    }
    return defaultValue
  }

  function writeCookie(name, value) {
    document.cookie = name + "=" + value;
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
          issueData.dueDate = new Date(data.fields.duedate).format('D d.m.');
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
            issueData.dueDate = new Date(data.fields.desiredDate).format('D d.m.');
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

      promises.push(module.getIssueData(issueKey, function(data) {
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
      return httpGet(url).then(function(responseData) {
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

      promises.push(module.getIssueData(issueKey, function(data) {
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

        issueData.url = data.url;
      }));

      return Promise.all(promises).then(function(results){return issueData;});
    };

    module.getIssueData = function(issueKey, callback, async) {
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

      promises.push(module.getIssueData(issueKey, function(data) {
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
          issueData.dueDate = new Date(data.due).format('D d.m.');
        }

        issueData.hasAttachment = data.attachments > 0;
        issueData.url = data.shortUrl;
      }));

      return Promise.all(promises).then(function(results){return issueData;});
    };

    module.getIssueData = function(issueKey, callback, async) {
      var url = "https://trello.com/1/cards/" + issueKey + "?members=true";
      console.log("IssueUrl: " + url);
      //console.log("Issue: " + issueKey + " Loading...");
      return httpGetJSON(url);
    };

    return module;
  }({}));
})();
