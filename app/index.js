var global = {};

require('./lib/polyfill');
require('./lib/google-analytics'); ga('create', 'UA-50840116-3', { 'alwaysSendReferrer': true});
 
var fs = require('fs');
var $ = require('jquery');

var cookies = require('./lib/cookies');

var issueTrackers = [
    require('./lib/jira-issue-tracker'),
    require('./lib/bitbucket-issue-tracker'),
    require('./lib/mingle-issue-tracker'),
    require('./lib/pivotal-issue-tracker'),
    require('./lib/teamforge-issue-tracker'),
    require('./lib/trello-issue-tracker'),
    require('./lib/youtrack-issue-tracker'),
    require('./lib/kanboard-issue-tracker')
];

var textColor = function(text) {

    var colours = [
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
        '#fde93d',
        '#ffca28',
        '#ffb343',
        '#ff9604',
        '#ff7d54'
    ];

    var textHash = 0;
    var i, chr;
    for (i = 0; i < text.length; i += 1) {
        chr = text.charCodeAt(i);
        textHash = ((textHash << 5) - textHash) + chr;
        textHash |= 0; // Convert to 32bit integer
    }
    var colourIndex = Math.abs(textHash) % colours.length;
    return colours[colourIndex];
}

var formatDate = function(date) {
    var shortMonths = {
        'Jan': 1,
        'Feb': 2,
        'Mar': 3,
        'Apr': 4,
        'May': 5,
        'Jun': 6,
        'Jul': 7,
        'Aug': 8,
        'Sep': 9,
        'Oct': 10,
        'Nov': 11,
        'Dec': 12
    };
    var dateSplit = date.toString().split(" ");
    // Mo 28.11.
    return dateSplit[0] + " " + dateSplit[2] + "." + shortMonths[dateSplit[1]] + ".";
}

var resizeIframe = function(iframe) {
    iframe = $(iframe);
    if(iframe[0].contentWindow){
        iframe.height(iframe[0].contentWindow.document.body.height);
    }
}

var parseBool = function(text, def) {
    if (text == 'true') return true;
    else if (text == 'false') return false;
    else return def;
}

var saveSettings = function() {
    var settings = global.settings;
    cookies.write("card_printer_scale", settings.scale);
    cookies.write("card_printer_row_count", settings.rowCount);
    cookies.write("card_printer_column_count", settings.colCount);

    cookies.write("card_printer_single_card_page", settings.singleCardPage);
    cookies.write("card_printer_hide_description", settings.hideDescription);
    cookies.write("card_printer_hide_assignee", settings.hideAssignee);
    cookies.write("card_printer_hide_due_date", settings.hideDueDate);
    cookies.write("card_printer_hide_estimate", settings.hideEstimate);
    cookies.write("card_printer_hide_qr_code", settings.hideQrCode);
    cookies.write("card_printer_hide_tags", settings.hideTags);
    cookies.write("card_printer_hide_epic", settings.hideEpic);
}

var loadSettings = function() {
    var settings = global.settings = global.settings || {};
    settings.scale = parseFloat(cookies.read("card_printer_scale")) || 0.0;
    settings.rowCount = parseInt(cookies.read("card_printer_row_count")) || 2;
    settings.colCount = parseInt(cookies.read("card_printer_column_count")) || 1;

    settings.singleCardPage = parseBool(cookies.read("card_printer_single_card_page"), true);
    settings.hideDescription = parseBool(cookies.read("card_printer_hide_description"), false);
    settings.hideAssignee = parseBool(cookies.read("card_printer_hide_assignee"), false);
    settings.hideDueDate = parseBool(cookies.read("card_printer_hide_due_date"), false);
    settings.hideEstimate = parseBool(cookies.read("card_printer_hide_estimate"), false);
    settings.hideQrCode = parseBool(cookies.read("card_printer_hide_qr_code"), false);
    settings.hideTags = parseBool(cookies.read("card_printer_hide_tags"), true);
    settings.hideEpic = parseBool(cookies.read("card_printer_hide_epic"), false);
}

var print = function() {
    ga('send', 'event', 'button', 'click', 'print', $(".card", global.printFrame.contentWindow.document).length);
    global.printFrame.contentWindow.focus();
    global.printFrame.contentWindow.print();
}

var createOverlayFrame = function() {
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

var updatePrintDialogue = function() {
    var appFrameDocument = global.appFrame.document;
    var settings = global.settings;
    $("#scaleRange", appFrameDocument).val(settings.scale);
    $("#scaleRange", appFrameDocument).parent().find("output").val(settings.scale);
    $("#rowCount", appFrameDocument).val(settings.rowCount);
    $("#columnCount", appFrameDocument).val(settings.colCount);

    $("#single-card-page-checkbox", appFrameDocument).attr('checked', settings.singleCardPage);
    $("#description-checkbox", appFrameDocument).attr('checked', !settings.hideDescription);
    $("#assignee-checkbox", appFrameDocument).attr('checked', !settings.hideAssignee);
    $("#due-date-checkbox", appFrameDocument).attr('checked', !settings.hideDueDate);
    $("#estimate-checkbox", appFrameDocument).attr('checked', !settings.hideEstimate);
    $("#qr-code-checkbox", appFrameDocument).attr('checked', !settings.hideQrCode);
    $("#tags-checkbox", appFrameDocument).attr('checked', !settings.hideTags);
    $("#epic-checkbox", appFrameDocument).attr('checked', !settings.hideEpic);
}

var scaleCards = function() {
    var settings = global.settings;
    var printFrame = global.printFrame;

    var scaleValue = settings.scale * 2.0;
    var scaleRoot;
    if (scaleValue < 0) {
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
    var cardMaxHeight = bodyElement.outerHeight() > 0 ? Math.floor(bodyElement.outerHeight() / rowCount) : 0;

    var cardElement = $(".card", printFrame.document);
    var cardMinWidth = cardElement.css("min-width") ? cardElement.css("min-width").replace("px", "") : 0;
    var cardMinHeight = cardElement.css("min-height") ? cardElement.css("min-height").replace("px", "") : 0;

    var scaleWidth = cardMaxWidth / cardMinWidth;
    var scaleHeight = cardMaxHeight / cardMinHeight;
    var scale = Math.min(scaleWidth, scaleHeight, 1);

    // scale
    $("html", printFrame.document).css("font-size", ( scaleRoot * scale ) + "cm");

    // grid size
    var style = document.createElement('style');
    style.id = 'gridStyle';
    style.type = 'text/css';
    style.innerHTML = ".card { " +
        "width: calc( 99.9999999999% / " + columnCount + " );" +
        "height: calc( 99.999999999% / " + rowCount + " );" +
        "}";
    $("head", printFrame.document).append(style);
}

var cropCards = function() {
    var cardElements = Array.from(global.printFrame.document.querySelectorAll(".card"));
    cardElements.forEach(function (cardElement) {
        var cardContent = cardElement.querySelectorAll(".card-body")[0];
        if (cardContent.scrollHeight > cardContent.offsetHeight) {
            cardContent.classList.add("zigzag");
        } else {
            cardContent.classList.remove("zigzag");
        }
    });
}

var getIconStyle = function(type) {
    var style = {};
    style.color = textColor(type.toLowerCase());
    style.image = 'https://identicon.org/?t=' + encodeURIComponent(type.toLowerCase()) + '&s=256&c=b';
    style.size = '55%';

    switch (type.toLowerCase()) {
        case 'default':
            style.color = 'DARKTURQUOISE';
            style.image = 'https://qoomon.github.io/Jira-Issue-Card-Printer/resources/icons/Objects.png';
            style.size = '63%';
            break;
        case 'story':
        case 'user story':
            style.color = 'GOLD';
            style.image = 'https://qoomon.github.io/Jira-Issue-Card-Printer/resources/icons/Bulb.png';
            style.size = '63%';
            break;
        case 'bug':
        case 'problem':
        case 'correction':
            style.color = 'CRIMSON';
            style.image = 'https://qoomon.github.io/Jira-Issue-Card-Printer/resources/icons/Bug.png';
            style.size = '63%';
            break;
        case 'epic':
            style.color = 'ROYALBLUE';
            style.image = 'https://qoomon.github.io/Jira-Issue-Card-Printer/resources/icons/Flash.png';
            style.size = '63%';
            break;
        case 'task':
        case 'sub-task':
        case 'technical task':
        case 'aufgabe':
        case 'unteraufgabe':
        case 'technische aufgabe':
            style.color = 'WHEAT';
            style.image = 'https://qoomon.github.io/Jira-Issue-Card-Printer/resources/icons/Task.png';
            style.size = '63%';
            break;
        case 'new feature':
            style.color = 'LIMEGREEN';
            style.image = "https://qoomon.github.io/Jira-Issue-Card-Printer/resources/icons/Plus.png";
            style.size = '63%';
            break;
        case 'improvement':
        case 'verbesserung':
            style.color = 'CORNFLOWERBLUE';
            style.image = 'https://qoomon.github.io/Jira-Issue-Card-Printer/resources/icons/Arrow.png';
            style.size = '63%';
            break;
        case 'research':
            style.color = 'MEDIUMTURQUOISE';
            style.image = 'https://qoomon.github.io/Jira-Issue-Card-Printer/resources/icons/ErlenmeyerFlask.png';
            style.size = '63%';
            break;
        case 'test':
            style.color = 'ORANGE';
            style.image = 'https://qoomon.github.io/Jira-Issue-Card-Printer/resources/icons/CrashDummy.png';
            style.size = '63%';
            break;
    }
    return style;
}

var fillCard = function(card, data) {
    //Key
    card.find('.issue-id').text(data.key);

    //Type
    var iconBackground = getIconStyle(data.type);
    card.find('.issue-icon').css('background-color', iconBackground.color);
    card.find('.issue-icon').css('background-image', 'url(' + iconBackground.image + ')');
    card.find('.issue-icon').css('background-size', iconBackground.size);

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
            var initials = data.assignee.trim().replace(/\s{2,}/g," ").split(/\s/).map(function (namePart) {
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
        card.find(".issue-due-date").text(formatDate(data.dueDate));
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
    if (data.superIssue) {
        var superIssueTagElement = $('<div />');
        superIssueTagElement.text(data.superIssue);
        superIssueTagElement.addClass('badge');
        superIssueTagElement.addClass('issue-tag');
        superIssueTagElement.addClass('issue-tag-super-issue');
        superIssueTagElement.css('background-color', textColor(data.superIssue));
        card.find(".issue-tags-box").append(superIssueTagElement);
    }

    //Labels
    if (data.labels) {
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

var applyCardOptions = function() {
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
    $(".card", printFrame.document).css({'page-break-after': '', 'float': '', 'margin-bottom': ''});
    if (settings.singleCardPage) {
        $(".card", printFrame.document).css({
            'page-break-after': 'always',
            'float': 'none',
            'margin-bottom': '20px'
        });
    } else {
        $(".card", printFrame.document).each(function (index, element) {
            if (index % (settings.colCount * settings.rowCount ) >= (settings.colCount * (settings.rowCount - 1))) {
                $(element).css({'margin-bottom': '20px'});
            }
        });
    }
}

var redrawCards = function() {
    applyCardOptions();
    scaleCards();
    cropCards();
    resizeIframe(global.printFrame);
}

var renderCards = function(issueKeyList) {
    var promises = [];

    var printFrameDocument = global.printFrame.document;

    printFrameDocument.open();
    printFrameDocument.write("<head/><body></body>");
    printFrameDocument.close();

    $("head", printFrameDocument).append($('<style>').html(fs.readFileSync(__dirname + '/card.css', 'utf8')));
    // preload some resources
    $("head", printFrameDocument).append($('<link rel="subresource"/>').attr('href', 'https://qoomon.github.io/Jira-Issue-Card-Printer/resources/Tearing.png'));

    console.log("load " + issueKeyList.length + " issues...");

    $.each(issueKeyList, function (index, issueKey) {
        var card = $('<div/>').html(fs.readFileSync(__dirname + '/card.html', 'utf8')).contents()
            .attr("id", issueKey)
            .attr("index", index);
        card.find('.issue-id').text(issueKey);
        $("body", printFrameDocument).append(card);

        promises.push(global.appFunctions.getCardData(issueKey).then(function (cardData) {
            // console.log("cardData: " + JSON.stringify(cardData,2,2));
            ga('send', 'event', 'card', 'generate', cardData.type);
            fillCard(card, cardData);
            redrawCards();
        }));
    });

    console.log("wait for issues loaded...");
    return Promise.all(promises).then(function () {
        console.log("...all issues loaded.");
        redrawCards();
    });
}

var closePrintPreview = function() {
    $("#card-printer-iframe").remove();
}

var printPreviewJs = function() {

    var documentBody = $("body", global.appFrame.document);

    documentBody.find("#report-issue").click(function (event) {
        window.open('https://github.com/qoomon/Jira-Issue-Card-Printer/issues');
        return false;
    });

    documentBody.find("#about").click(function (event) {
        window.open('https://github.com/qoomon/Jira-Issue-Card-Printer');
        return false;
    });

    // enable single card page

    documentBody.find("#single-card-page-checkbox").click(function () {
        global.settings.singleCardPage = this.checked;
        saveSettings();
        redrawCards();
        return true;
    });

    // hide description

    documentBody.find("#description-checkbox").click(function () {
        global.settings.hideDescription = !this.checked;
        saveSettings();
        redrawCards();
        return true;
    });

    // show assignee

    documentBody.find("#assignee-checkbox").click(function () {
        global.settings.hideAssignee = !this.checked;
        saveSettings();
        redrawCards();
        return true;
    });

    // show due date

    documentBody.find("#due-date-checkbox").click(function () {
        global.settings.hideDueDate = !this.checked;
        saveSettings();
        redrawCards();
        return true;
    });

    // show due date

    documentBody.find("#estimate-checkbox").click(function () {
        global.settings.hideEstimate = !this.checked;
        saveSettings();
        redrawCards();
        return true;
    });

    // show QR Code

    documentBody.find("#qr-code-checkbox").click(function () {
        global.settings.hideQrCode = !this.checked;
        saveSettings();
        redrawCards();
        return true;
    });

    // show Tags

    documentBody.find("#tags-checkbox").click(function () {
        global.settings.hideTags = !this.checked;
        saveSettings();
        redrawCards();
        return true;
    });

    // show Epic

    documentBody.find("#epic-checkbox").click(function () {
        global.settings.hideEpic = !this.checked;
        saveSettings();
        redrawCards();
        return true;
    });

    // scale font

    // change is needed for IE11 Support
    documentBody.find("#scaleRange").on('input change', function () {
        global.settings.scale = $(this).val();
        saveSettings();
        redrawCards();
    });

    // grid

    documentBody.find("#rowCount").on('input', function () {
        global.settings.rowCount = $(this).val();
        saveSettings();
        redrawCards();
    });
    documentBody.find("#rowCount").click(function () {
        this.select();
    });

    documentBody.find("#columnCount").on('input', function () {
        global.settings.colCount = $(this).val();
        saveSettings();
        redrawCards();
    });
    documentBody.find("#columnCount").click(function () {
        this.select();
    });


    // print

    documentBody.find("#card-print-dialog-print")
        .click(function (event) {
            print();
            return false;
        });

    // closePrintPreview

    documentBody.find("#card-print-dialog-cancel")
        .click(function (event) {
            closePrintPreview();
            return false;
        });

    documentBody.find('#card-print-overlay').click(function (event) {
        if (event.target == this) {
            closePrintPreview();
        }
        return true;
    });

    // prevent background scrolling
    documentBody.scroll(function (event) {
        return false;
    });

    $(document).keyup(function (e) {
        if (e.keyCode == 27) { // ESC
            closePrintPreview();
        }
    });
}

var error2object = function(value) {
    if (value instanceof Error) {
        var error = {};
        Object.getOwnPropertyNames(value).forEach(function (key) {
            error[key] = value[key];
        });
        return error;
    }
    return value;
}

var main = function(issueTrackers) {
    loadSettings();

    var promises = [];

    //preconditions
    if ($("#card-printer-iframe").length > 0) {
        closePrintPreview();
    }

    console.log("Run...");
    for (var i = 0; i < issueTrackers.length; i++) {
        var issueTracker = issueTrackers[i];
        if (issueTracker.isEligible()) {
            global.appFunctions = issueTracker;
            break;
        }
    }

    if (!global.appFunctions) {
        alert("Unsupported Application " + document.URL + " Please create an issue at " + APP.issueTrackingUrl);
        return Promise.resolve();
    } else {
        console.log("Issue Tracker: " + global.appFunctions.name);
        ga('set', 'page', '/cardprinter');
    }

    ga('send', 'pageview');

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
    $("head", global.appFrame.document).prepend($('<style>').html(fs.readFileSync(__dirname + '/printPreview.css', 'utf8')));
    $("body", global.appFrame.document).append($('<div/>').html(fs.readFileSync(__dirname + '/printPreview.html', 'utf8')).contents());
    printPreviewJs();

    updatePrintDialogue();

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
        return Promise.resolve();
    }
    if (issueKeyList.length > 30) {
        var confirmResult = confirm("Are you sure you want select " + issueKeyList.length + " issues?");
        if (!confirmResult) {
            return Promise.resolve();
        }
    }

    // render cards
    promises.push(renderCards(issueKeyList));

    $("#card-print-dialog-title", global.appFrame.document).html("Card Printer " + APP.version + " - <b>Loading...</b>");
    return Promise.all(promises).then(function () {
        $("#card-print-dialog-title", global.appFrame.document).text("Card Printer " + APP.version);
    });
}

var handleError = function (error) {
    error = error2object(error);
    error = JSON.stringify(error);
    console.log("ERROR " + error);
    ga('send', 'exception', {'exDescription': APP.version + " - " + document.location.host + "\n" + error, 'exFatal': true});
    // closePrintPreview();
    alert("Sorry something went wrong\n\nPlease create an issue with following details at\n" + global.issueTrackingUrl + "\n\n" + error);
}

// Main Method ##################################################################################################
try {
    main(issueTrackers)['catch'](handleError);
} catch (e) {
    handleError(e);
}




