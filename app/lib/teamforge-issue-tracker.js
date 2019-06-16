var $ = require('jquery');

var name = "TeamForge";

var isEligible = function () {
    return /^TeamForge\s:/.test(document.title);
};

var getSelectedIssueKeyList = function () {
    var keys = [];
    jQuery("input[type=checkbox][name=_listItem]").each(function (idx, el) {
        keys.push(el.value);
    });
    return keys;
};

// determine the positions of configurable fields within the table
var determineFieldPositions = (function () {
    var map = null;
    return function () {
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
                var elText = jQuery(el).clone().children().remove().end().text();
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

var getSiteAuthority = (function () {
    var authority = null;
    return function () {
        if (!authority) {
            var parser = document.createElement("a");
            parser.href = location.href;
            authority = parser.protocol + "//" + parser.hostname + parser.port;
        }
        return authority;
    };
})();

var getCardData = function (issueKey) {
    var issueData = {};
    jQuery("#ArtifactListTable tr.EvenRow:not(#filter), #ArtifactListTable tr.OddRow:not(#filter)").each(function (trIdx, trEl) {
        var curKey = jQuery(trEl).find("input[type=checkbox][name=_listItem]")[0].value;
        // skip processing of unwanted rows
        if (issueKey != curKey) {
            return;
        }
        issueData.key = curKey;
        issueData.type = 'Bug';
        issueData.hasAttachment = false;
        issueData.estimate = '';
        issueData.labels = [];

        jQuery(trEl).find("td").each(function (tdIdx, tdEl) {
            var posFieldMap = determineFieldPositions();
            var field = posFieldMap[tdIdx];
            // skip unknown field / column
            if (!field) {
                return;
            }
            if (field == "Description") {
                issueData.description = jQuery(tdEl).text();
            } else if (field == "Artifact ID : Title") {
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

var getIssueData = function (issueKey) {
    // The TeamForge API uses OAuth for authentication purposes, so we cannot use that here
    // see https://forge.collab.net/apidoc/
    return [];
};

module.exports = {
    name: name,
    isEligible: isEligible,
    getSelectedIssueKeyList: getSelectedIssueKeyList,
    getCardData: getCardData,
    getIssueData: getIssueData
};
