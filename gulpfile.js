const gulp = require('gulp');
const gulpThrough = require('through2');
const gulpSequence = require('gulp-sequence');
const gulpMerge = require('merge2');

const gulpConcat = require('gulp-concat');
const gulpWrap = require('gulp-wrapper');
const gulpUglify = require('gulp-uglify');
const gulpSourcemaps = require('gulp-sourcemaps');
const gulpDel = require('del');

var browserify = require('browserify');
var source = require('vinyl-source-stream');
var buffer = require('vinyl-buffer');

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
            'copy-resources',
            'build-bookmarklet',
            'build-bookmarklet-installation-site'
        ],
        callback);
});

gulp.task('copy-resources', function () {
    return gulp.src('resources-files/**')
        .pipe(gulp.dest(destDir + 'resources/'));
});

gulp.task('build-bookmarklet', function () {
     return browserify({
            entries: ['source-files/main.js'],
            transform: [
                  "brfs"
                ]
        })
        .bundle()
        .pipe(source('bookmarklet.js'))
        .pipe(gulp.dest(destDir));
});


gulp.task('build-uglify', function (callback) {
    gulpSequence(
    'build',
    'uglify-bookmarklet',
    callback);
});

gulp.task('copy-resources', function () {
    return gulp.src('resources-files/**')
        .pipe(gulp.dest(destDir + 'resources/'));
});

gulp.task('uglify-bookmarklet', function (callback) {
    return gulp.src(destDir + 'bookmarklet.js')
        .pipe(gulpSourcemaps.init())
        .pipe(gulpUglify())
        .pipe(gulpSourcemaps.write('./'))
        .pipe(gulp.dest(destDir));
});

gulp.task('build-bookmarklet-installation-site', function () {
    return gulp.src('source-files/bookmarkInstallation.html')
        .pipe(gulp.dest(destDir));
});

