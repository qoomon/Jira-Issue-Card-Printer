const gulp = require('gulp');
const sequence = require('gulp-sequence');
const through = require('through2');
const del = require('del');

const fs = require('fs');
const path = require('path');

const destDir = 'dist/';

gulp.task('clean', function () {
   return del([destDir]);
});

gulp.task('watch', function () {
    return gulp.watch(['resource-files/**/*', 'source-files/**/*'], ['build']);
});

gulp.task('build', function(callback) {
  sequence('clean', ['copy-resources', 'build-js', 'build-html', 'build-css'], callback);
});

gulp.task('copy-resources', function() {
  return gulp.src('resources-files/**')
    .pipe(gulp.dest(destDir + 'resources/'));
});

gulp.task('build-js', function() {
  return gulp.src('source-files/bookmarklet.js')
    .pipe(through.obj(function(file, encoding, callback) {
      var fileContentResolved = resolvePlaceholder(file, encoding, /"@@([^@]+)@@:json"/, function(text){
        return JSON.stringify(text);
      });
      file.contents = new Buffer(fileContentResolved);
      callback(null,file);
    }))
    .pipe(gulp.dest(destDir));
});

gulp.task('build-html', function() {
  return gulp.src('source-files/bookmarkInstallation.html')
    .pipe(through.obj(function(file, encoding, callback) {
      var fileContentResolved = resolvePlaceholder(file, encoding, /"@@([^@]+):href@@"/, function(text){
        return text
          .replace(/\/\/.*$/m, '')
          .replace(/\n/g,' ')
          .replace(/"/g, '&quot;')
          .replace(/(.*)/, '"$1"');
      });
      file.contents = new Buffer(fileContentResolved);
      callback(null,file);
    }))
    .pipe(gulp.dest(destDir));
});

gulp.task('build-css', function() {
  return gulp.src('source-files/bookmarkInstallation.css')
    .pipe(gulp.dest(destDir));
});


function resolvePlaceholder(file, encoding, placeholderRegex, encodeFunction){
  const fileDir = path.dirname(file.path) + '/';
  const fileContent = file.contents.toString()
  const placeholderSet = new Set(fileContent.match(new RegExp(placeholderRegex, 'g')));

  var fileContentResolved = fileContent;
  for (let placeholder of placeholderSet) {
      console.log("resolve " + placeholder);
      var replacementFile = placeholder.replace(placeholderRegex, '$1')
      if(!replacementFile.startsWith('/')){
        replacementFile = fileDir + replacementFile;
      }
      const replacementFileContent = fs.readFileSync(replacementFile, { encoding: encoding });
      const replacementFileValue = encodeFunction(replacementFileContent);
      fileContentResolved = fileContentResolved.replace(new RegExp(placeholder, 'g'), replacementFileValue);
  }

  return fileContentResolved;
}
