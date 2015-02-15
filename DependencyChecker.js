jQuery.fn.isAfter = function(sel){
  return this.prevAll().filter(sel).length !== 0;
};

jQuery.fn.isBefore= function(sel){
  return this.nextAll().filter(sel).length !== 0;
};

function loadDataJSON(issueKey, callback) {

  //https://docs.atlassian.com/jira/REST/latest/
  var url = '/rest/api/2/issue/' + issueKey + '?fields=summary,issuelinks';
  //console.log("IssueUrl: " + window.location.hostname + url);
  //console.log("Issue: " + issueKey + " Loading...");
  return  jQuery.ajax({
    type: 'GET',
    url: url,
    dataType: 'json',
    success: function(responseData){
      //console.log("Issue: " + issueKey + " Loaded!");
      callback(responseData);
    },
    data: {},
  });
}

function checkDependencies(){
  jQuery('[data-issue-key]').each(function() {
    var issueElement = jQuery(this);
    var issueKey = issueElement.attr('data-issue-key');
    loadDataJSON(issueKey, function(responseData){
      var issueLinks = responseData.fields.issuelinks;
      jQuery.each(issueLinks,function(position, issue) {
        if(issue.type.name == "Blocker" && issue.inwardIssue){
          var dependencyIssueKey = issue.inwardIssue.key;
          if (issueElement.isBefore('[data-issue-key='+dependencyIssueKey+']')) {
            issueElement.find('.ghx-end.ghx-row').find('.ghx-end')
             .before('<span class="aui-label ghx-label-2 ghx-label ghx-label-double">'+'⚠☟ '+' '+dependencyIssueKey+'</span>')

          }
        }
      })
    })
  });
}

checkDependencies();

$( ".js-issue-list" ).change(function() {
  console.log("##################################");
  checkDependencies();
});
