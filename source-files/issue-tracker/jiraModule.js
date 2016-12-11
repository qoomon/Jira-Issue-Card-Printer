var JiraModule = (function (module) {
    module.name = "JIRA";

    module.baseUrl = function () {
        var jiraBaseUrl = window.location.origin;
        try {
            jiraBaseUrl = $("input[title='baseURL']").attr('value');
        } catch (ex) {
        }
        return jiraBaseUrl;
    };

    module.isEligible = function () {
        return $("meta[name='application-name'][ content='JIRA']").length > 0;
    };

    module.getSelectedIssueKeyList = function () {

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

            var issues = $('.issue-list > li').map(function () {
                return $(this).attr('data-key');
            });

            //backward compatibility
            if (issues.empty()) {
                issues = $('tr[data-issuekey]').map(function () {
                    return $(this).attr('data-issuekey');
                });
            }

            return issues;
        }

        // RapidBoard
        if (/.*\/secure\/RapidBoard.jspa.*/g.test(document.URL)) {
            return $('div[data-issue-key].ghx-selected').map(function () {
                return $(this).attr('data-issue-key');
            });
        }

        return [];
    };

    module.getCardData = function (issueKey) {
        var promises = [];
        var issueData = {};

        promises.push(module.getIssueData(issueKey).then(function (data) {
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
                promises.push(module.getIssueData(data.fields.parent.key).then(function (data) {
                    issueData.superIssue = data.key + ' ' + data.fields.summary;
                }).catch(function () {
                }));
            } else if (data.fields.epicLink) {
                promises.push(module.getIssueData(data.fields.epicLink).then(function (data) {
                    issueData.superIssue = data.key + ' ' + data.fields.epicName;
                }).catch(function () {
                }));
            }

            issueData.url = module.baseUrl() + "/browse/" + issueData.key;

            return Promise.all(promises);
        }));

        return Promise.all(promises).then(function (results) {
            return issueData;
        });
    };

    module.getIssueData = function (issueKey) {
        //https://docs.atlassian.com/jira/REST/latest/
        var url = module.baseUrl() + '/rest/api/2/issue/' + issueKey + '?expand=renderedFields,names';
        console.log("IssueUrl: " + url);
        //console.log("Issue: " + issueKey + " Loading...");
        return httpGetJSON(url).then(function (responseData) {
            //console.log("Issue: " + issueKey + " Loaded!");
            // add custom fields with field names
            $.each(responseData.names, function (key, value) {
                if (key.startsWith("customfield_")) {
                    var fieldName = value.toCamelCase();
                    var fieldValue = responseData.fields[key];

                    //deposit-solutions specific field mapping
                    if (/.*\.deposit-solutions.com/g.test(window.location.hostname)) {
                        if (key == 'customfield_10006') {
                            fieldName = 'epicLink';
                        }
                        if (key == 'customfield_10007') {
                            fieldName = 'epicName';
                        }
                        if (key == 'customfield_10002') {
                            fieldName = 'storyPoints';
                        }
                    }

                    //lufthansa specific field mapping
                    if (/.*trackspace.lhsystems.com/g.test(window.location.hostname)) {
                        if (key == 'Xcustomfield_10006') {
                            fieldName = 'epicLink';
                        }
                        if (key == 'Xcustomfield_10007') {
                            fieldName = 'epicName';
                        }
                        if (key == 'Xcustomfield_10002') {
                            fieldName = 'storyPoints';
                        }
                        if (fieldName == 'desiredDate') {
                            fieldName = 'dueDate';
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
