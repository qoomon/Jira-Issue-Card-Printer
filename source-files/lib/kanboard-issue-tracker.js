var $ = require('jquery');

var name = "Kanboard";


var isEligible = function () {
    return /.*\/?controller=TaskViewController&action=show&task_id=[^&]*.*/g.test(document.URL)
};

var getSelectedIssueKeyList = function () {

    //TaskView
    if (/.*\/?controller=TaskViewController&action=show&task_id=[^&]*.*/g.test(document.URL)) {
        return [document.URL.match(/.*&task_id=([^&]*).*/)[1]];
    }

    return [];
};

var getIssueData = function (issueKey) {
    // /?controller=TaskViewController&action=show&task_id=2

    var url = '/?controller=TaskViewController&action=show&task_id=' + issueKey;

    //console.log("Issue: " + issueKey + " Loading...");
    return new Promise(function (fulfill, reject){
        console.log("IssueUrl: " + url);
        $.get(url).done(fulfill).fail(reject);
    }).then(function (responseData) {
        var htmlObject = $('<div>').html(responseData);
    
        var issueData = {};
        issueData.id = issueKey;
        issueData.title = htmlObject.find('h2').text();
        issueData.category    = htmlObject.find('#task-summary > div > div.task-summary-columns > div:nth-child(2) > ul > li:nth-child(1) > span').text();
        issueData.complexity  = htmlObject.find('#task-summary > div > div.task-summary-columns > div:nth-child(1) > ul > li:nth-child(4) > span').text();
        issueData.assignee    = htmlObject.find('#task-summary > div > div.task-summary-columns > div:nth-child(3) > ul > li:nth-child(1) > span').text();
        if(issueData.assignee){
          issueData.assignee = issueData.assignee.trim();
        }
        issueData.duedate     = htmlObject.find('#task-summary > div > div.task-summary-columns > div:nth-child(4) > ul > li:nth-child(1) > span').text();
        issueData.description = htmlObject.find('section.accordion-section > div.accordion-content > article').html();  
        if(issueData.description){
          issueData.description = issueData.description.trim();
        }
        issueData.labels = htmlObject.find('#task-summary > div > div.task-tags > ul > li').map(function(){ return $(this).text();}).toArray();
        issueData.url = document.location.origin + url;
        return issueData;
    })
};

var getCardData = function (issueKey) {
    var promises = [];
    var issueData = {};

    promises.push(getIssueData(issueKey).then(function (data) {
        var promises = [];
        issueData.key = data.id;
        issueData.type = data.category.toLowerCase() || 'default';
        issueData.summary = data.title;
        issueData.description = data.description;
        issueData.labels = data.labels;
        issueData.estimate = issueData.complexity;
        issueData.assignee = data.assignee;
        if (data.duedate) {
            issueData.dueDate = new Date(data.duedate);
        }
        issueData.hasAttachment = false; //TODO
        issueData.url = data.url;
        return Promise.all(promises);
    }));

    return Promise.all(promises).then(function () {
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
