const gulp = require('gulp');
const through = require('through2'); 
const fs = require('fs');
const path = require('path');

function resolveFilePlaceholder(text, baseDir, replacementFile){
  const replacementKey = '@@' + replacementFile + '@@';
  const replacementFileContent = JSON.stringify(fs.readFileSync(baseDir + replacementFile, { encoding: 'utf8' }));
  const replacementFileValue = JSON.stringify(replacementFileContent);
  return text.replace(replacementKey, replacementFileValue);
}


gulp.task('build', function() {
  return gulp.src('source-files/bookmarklet.js') 
    .pipe(through.obj(function(file, encoding, callback) {
      const fileDir = path.dirname(file.path) + '/';
      const fileContent = file.contents.toString()
      const placeholderRegex = /\"@@([^@]+)@@\"/g;
      const placeholderList = fileContent.match(placeholderRegex);
      
      var fileContentResolved = fileContent;
      for (let placeholder of placeholderList) {
          console.log("resolve " + placeholder);
          const replacementKey = placeholder;
          var replacementFile = replacementKey.replace(placeholderRegex, '$1')
          if(!replacementFile.startsWith('/')){
            replacementFile = fileDir + replacementFile;
          }
          const replacementFileContent = fs.readFileSync(replacementFile, { encoding: 'utf8' });
          const replacementFileValue = JSON.stringify(replacementFileContent);
          fileContentResolved = fileContentResolved.replace(replacementKey, replacementFileValue);
      }
      file.contents = new Buffer(fileContentResolved);
      callback(null,file);
    }))
    .pipe(gulp.dest(''));
});