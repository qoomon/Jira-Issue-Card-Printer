const gulp = require('gulp');
const gulpThrough = require('through2');
const gulpSequence = require('gulp-sequence');
const gulpMerge = require('merge2');

const gulpConcat = require('gulp-concat');
const gulpWrap = require('gulp-wrapper');
const gulpUglify = require('gulp-uglify');

const gulpDel = require('del');

const Fs = require('fs');
const Path = require('path');

const destDir = 'dist/';

gulp.task('clean', function () {
    return gulpDel([destDir]);
});

gulp.task('watch', function () {
    return gulp.watch(['resource-files/**/*', 'source-files/**/*'], ['build']);
});

gulp.task('build', function (callback) {
    gulpSequence(
        'clean',
        [
            'bookmarklet-copy-resources',
            'bookmarklet-build',
            'bookmarklet-installation-site-build'
        ],
        callback);
});

gulp.task('build-uglify', function (callback) {
    gulpSequence(
    'build',
    'bookmarklet-uglify',
    callback);

});

gulp.task('bookmarklet-uglify', function (callback) {
    return gulp.src(destDir + 'bookmarklet.js')
        .pipe(gulpUglify())
        .pipe(gulp.dest(destDir));
});


gulp.task('bookmarklet-copy-resources', function () {
    return gulp.src('resources-files/**')
        .pipe(gulp.dest(destDir + 'resources/'));
});

gulp.task('bookmarklet-build', function () {
    return gulpMerge(
        gulp.src('source-files/common.js'),
        gulp.src('source-files/webModule.js'),
        gulp.src('source-files/issue-tracker/*Module.js'),
        gulp.src('source-files/main.js')
            .pipe(gulpThrough.obj(function (file, encoding, callback) {
                file.contents = injectDependencies(file, encoding, /@@([^@]+):string@@/, function (text) {
                    return JSON.stringify(text).replace(/^"(.*)"$/, '$1');
                });
                callback(null, file);
            }))
    )
        .pipe(gulpConcat('bookmarklet.js'))
        .pipe(gulpWrap({
            header: ';(function() {\n',
            footer: '}());\n'
        }))
        .pipe(gulp.dest(destDir));
});

gulp.task('bookmarklet-installation-site-build', function () {
    gulp.src('source-files/bookmarkInstallation.html')
        .pipe(gulpThrough.obj(function (file, encoding, callback) {
            file.contents = injectDependencies(file, encoding, /@@([^@]+):url@@/, function (text) {
                return text.replace(/"/g, '&quot;').replace(/\n/g, ' ');
            });
            callback(null, file);
        }))
        .pipe(gulp.dest(destDir));
});


function injectDependencies(file, encoding, placeholderRegex, encodeFunction) {
    const fileDir = Path.dirname(file.path) + '/';
    const fileContent = String(file.contents);
    const placeholderSet = new Set(fileContent.match(new RegExp(placeholderRegex, 'g')));

    let fileContentResolved = fileContent;
    for (const placeholder of placeholderSet) {
        console.log("inject " + placeholder);
        let replacementFile = placeholder.replace(placeholderRegex, '$1');
        if (!replacementFile.startsWith('/')) {
            replacementFile = fileDir + replacementFile;
        }
        const replacementFileContent = Fs.readFileSync(replacementFile, {encoding: encoding});
        const replacementFileValue = encodeFunction ? encodeFunction(replacementFileContent) : replacementFileContent;
        fileContentResolved = fileContentResolved.replace(new RegExp(placeholder, 'g'), replacementFileValue);
    }

    return Buffer.from(fileContentResolved);
}
