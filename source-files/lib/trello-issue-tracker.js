var $ = require('jquery');

var name = "trello";

var isEligible = function () {
    return /.*trello.com\/.*/g.test(document.URL);
};

var getSelectedIssueKeyList = function () {
    //Board View
    if (/.*\/b\/.*/g.test(document.URL)) {
        // open card composer
        var issueKeys = $(".card-composer").parent().find(".list-card > .list-card-details > .list-card-title").map(function () {
            return $(this).attr("href").match(/.*\/c\/([^\/]*).*/)[1];
        });

        //read only board

        var issueKeys2 = $("textarea.list-header-name.is-editing").parent().parent().find(".list-cards > .list-card > .list-card-details > .list-card-title").map(function () {
            return $(this).attr("href").match(/.*\/c\/([^\/]*).*/)[1];
        });

        return jQuery.merge(issueKeys, issueKeys2);
    }

    //Card View
    if (/.*\/c\/.*/g.test(document.URL)) {
        return [document.URL.match(/.*\/c\/([^\/]*).*/)[1]];
    }

    return [];
};

var getIssueData = function (issueKey) {
    var url = "/1/cards/" + issueKey + "?members=true";
    console.log("IssueUrl: " + url);
    //console.log("Issue: " + issueKey + " Loading...");
    return $.getJSON(url);
};

var getCardData = function (issueKey, callback) {
    var promises = [];
    var issueData = {};

    promises.push(getIssueData(issueKey).then(function (data) {
        issueData.key = data.idShort;

        // TODO get type from label name
        issueData.type = 'default';

        issueData.summary = data.name;
        issueData.description = data.desc;
        issueDate.labels = data.labels.map(function (label) {
            return label.name;
        });

        if (data.members && data.members.length > 0) {
            issueData.assignee = data.members[0].fullName;
            issueData.avatarUrl = "https://trello-avatars.s3.amazonaws.com/" + data.members[0].avatarHash + "/170.png";
        }

        if (data.due) {
            issueData.dueDate = new Date(data.due);
        }

        issueData.hasAttachment = data.attachments > 0;
        issueData.url = data.shortUrl;
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
