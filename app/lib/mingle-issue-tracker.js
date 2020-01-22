var $ = require('jquery');

var name = "mingle";

var isEligible = function () {
    return /.*mingle\.thoughtworks.com\/.*/g.test(document.URL);
};

var getSelectedIssueKeyList = function () {
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

var getIssueData = function (issueKey) {
    var issueKeySplit = issueKey.split('-');
    var project = issueKeySplit[0];
    var number = issueKeySplit[1];
    var url = "/api/v2/projects/" + project + "/cards/" + number + ".xml";
    console.log("IssueUrl: " + url);
    //console.log("Issue: " + issueKey + " Loading...");
    return new Promise(function (fulfill, reject) {
        $.get(url).done(fulfill).fail(reject);
    });

};

var getCardData = function (issueKey, callback) {
    var promises = [];
    var issueData = {};

    promises.push(getIssueData(issueKey).then(function (data) {
        data = $(data.documentElement);

        issueData.key = data.find('card > number')[0].textContent;
        issueData.type = data.find('card > card_type > name')[0].textContent.toLowerCase();
        issueData.summary = data.find('card > name')[0].textContent;
        issueData.description = data.find('card > description')[0].innerHTML;  // TODO use data.find('card > rendered_description')[0].attr('url');

        if (data.find('card > properties > property > name:contains(Owner) ~ value > name').length > 0) {
            issueData.assignee = data.find('card > properties > property > name:contains(Owner) ~ value > name')[0].textContent;
            // TODOissueData.avatarUrl
        }

        // n/a issueData.dueDate = new Date(dueDate);
        // n/a issueData.hasAttachment = data.fields.attachment.length > 0;

        if (data.find('card > properties > property > name:contains(Estimate) ~ value').length > 0) {
            issueData.estimate = data.find('card > properties > property > name:contains(Estimate) ~ value')[0].textContent;
        }

        // TODO issueData.labels

        var projectIdentifier = data.find('card > project > identifier')[0].textContent;
        var cardNumber = data.find('card > number')[0].textContent;
        issueData.url = "https://" + document.location.hostname + "/projects/" + projectIdentifier + "/cards/" + cardNumber;
    }));

    return Promise.all(promises).then(function (results) {
        return issueData;
    });
};

module.exports = {
    name: name,
    isEligible: isEligible,
    getSelectedIssueKeyList: getSelectedIssueKeyList,
    getCardData: getCardData,
    getIssueData: getIssueData
};
