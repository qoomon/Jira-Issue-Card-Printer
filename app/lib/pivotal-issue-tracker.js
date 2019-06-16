var $ = require('jquery');

var name = "PivotalTracker";

var isEligible = function () {
    return /.*pivotaltracker.com\/.*/g.test(document.URL);
};

var getSelectedIssueKeyList = function () {
    //Single Story
    if (/.*\/stories\/.*/g.test(document.URL)) {
        return [document.URL.match(/.*\/stories\/([^?]*).*/)[1]];
    }

    // Project Board
    if (/.*\/projects\/.*/g.test(document.URL)) {
        return $('.story[data-id]:has(.selector.selected)').map(function () {
            return $(this).attr('data-id');
        });
    }

    // Workspace Board
    if (/.*\/workspaces\/.*/g.test(document.URL)) {
        return $('.story[data-id]:has(.selector.selected)').map(function () {
            return $(this).attr('data-id');
        });
    }

    return [];
};

var getIssueData = function (issueKey) {
    //http://www.pivotaltracker.com/help/api
    var url = 'https://www.pivotaltracker.com/services/v5/stories/' + issueKey + "?fields=name,kind,description,story_type,owned_by(name),comments(file_attachments(kind)),estimate,deadline";
    console.log("IssueUrl: " + url);
    //console.log("Issue: " + issueKey + " Loading...");
    return new Promise(function (fulfill, reject) {
        $.getJSON(url).done(fulfill).fail(reject);
    });
};

var getCardData = function (issueKey) {
    var promises = [];
    var issueData = {};

    promises.push(getIssueData(issueKey).then(function (data) {
        issueData.key = data.id;
        issueData.type = data.kind.toLowerCase();
        issueData.summary = data.name;
        issueData.description = data.description;

        if (data.owned_by && data.owned_by.length > 0) {
            issueData.assignee = data.owner_ids[0].name;
        }

        if (data.deadline) {
            issueData.dueDate = new Date(data.deadline);
        }

        // TODO
        issueData.hasAttachment = false;
        issueData.estimate = data.estimate;

        issueData.url = data.url;
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