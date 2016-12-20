var YouTrackModule = (function (module) {
    module.name = "YouTrack";

    module.isEligible = function () {
        return (/.*myjetbrains.com\/youtrack\/.*/g).test(document.URL) || (/.*youtrack.jetbrains.com\/.*/g).test(document.URL);
    };

    module.getSelectedIssueKeyList = function () {
        //Detail View
        if (/.*\/issue\/.*/g.test(document.URL)) {
            return [document.URL.match(/.*\/issue\/([^?]*).*/)[1]];
        }

        // Agile Board
        if (/.*\/rest\/agile.*/g.test(document.URL)) {
            return $('div.sb-task-focused').map(function () {
                return $(this).attr('id');
            });
        }

        return [];
    };

    module.getCardData = function (issueKey) {
        var promises = [];
        var issueData = {};

        promises.push(module.getIssueData(issueKey).then(function (data) {
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

        return Promise.all(promises).then(function (results) {
            return issueData;
        });
    };

    module.getIssueData = function (issueKey) {
        var url = '/youtrack/rest/issue/' + issueKey + '?';
        console.log("IssueUrl: " + url);
        //console.log("Issue: " + issueKey + " Loading...");
        return httpGetJSON(url).then(function (responseData) {
            //console.log("Issue: " + issueKey + " Loaded!");
            $.each(responseData.field, function (key, value) {
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
