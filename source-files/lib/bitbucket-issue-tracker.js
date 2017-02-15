var $ = require('jquery');

var name = "Bitbucket";

var isEligible = function () {
    return /.*bitbucket.org\/.*/g.test(document.URL);
};

var getSelectedIssueKeyList = function () {

    //issues list
    if (/.*\/issues(\?|$)/g.test(document.URL)) {
        return $('.iterable-item .text .issue-list--title a').map(function () {
            return $(this).attr('title').match(/#([^:]+):/)[1];
        });
    }

    //single issue
    if (/.*\/issues\/.+/g.test(document.URL)) {
        return [document.URL.match(/.*\/issues\/([^/]*).*/)[1]];
    }

    return [];
};

var getIssueData = function (issueKey) {
    // https://confluence.atlassian.com/bitbucket/use-the-bitbucket-cloud-rest-apis

    var repo = document.location.pathname.match(/([^/]+\/[^/]+).*/)[1]
    var url = "/api/2.0/repositories/" + repo + "/issues/" + issueKey;
    console.log("IssueUrl: " + url);
    //console.log("Issue: " + issueKey + " Loading...");
    return new Promise(function (fulfill, reject){
        $.getJSON(url).done(fulfill).fail(reject);
    });
};

var getCardData = function (issueKey, callback) {
    var promises = [];
    var issueData = {};

    promises.push(getIssueData(issueKey).then(function (data) {
        issueData.key = data.id;

        issueData.type =data.kind;

        issueData.summary = data.title;
        issueData.description = data.content.html;
        issueData.labels = [];

        if (data.assignee) {
            issueData.assignee = data.assignee.display_name;
            issueData.avatarUrl = data.assignee.links.avatar.href;
        }

        // TODO make json call to get attachment count
        // data.links.attachments.href
        // issueData.hasAttachment = ???;

        issueData.url = data.links.html.href;
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
