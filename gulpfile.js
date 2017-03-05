/**
 *
 * Gulpfile project setup
 *
 */

// Project configuration
const settings = {
    project: 'watchyoutubetogether',
    url: '',
    sync: {
        proxy: 'http://localhost/watchyoutubetogether',
        port: 8079,
        files: [
            '**/*.html',
            '**/*.php',
            '**/*.{png,jpg,gif}'
        ]
    },
    build: [
        '**/*.php',
        '**/*.html',
        '**/*.css',
        '**/*.js'
    ]
}

// Gulp
const gulp = require('gulp');
const browserSync = require('browser-sync');
const sass = require('gulp-sass');
const autoprefixer = require('gulp-autoprefixer');
const minifycss = require('gulp-uglifycss');
const rename = require('gulp-rename');
const concat = require('gulp-concat');
const babel = require('gulp-babel');
const uglify = require('gulp-uglify');

/**
 * Browser Sync
 */
gulp.task('browser-sync', () => {
    browserSync.init(settings.sync.files, {
        proxy: settings.sync.proxy,
        port: settings.sync.port,
        open: false,
        injectChanges: true,
        notify: false,
    });
});

/**
 * Styles
 *
 * Looking at src/sass compiling, autoprefixing, compressing the file and sending to the build folder
 *
 */
gulp.task('styles', () => {
    return gulp.src('./assets/css/src/*.scss')
        .pipe(sass({
            errLogToConsole: true,
            outputStyle: 'compact',
            precision: 10
        }))
        .pipe(autoprefixer('last 2 version', '> 1%', 'safari 5', 'ie 8', 'ie 9', 'opera 12.1', 'ios 6', 'android 4'))
        .pipe(rename({
            suffix: '.min'
        }))
        .pipe(minifycss())
        .pipe(gulp.dest('./assets/css'))
        .pipe(browserSync.stream());
});

/**
 * Scripts: Vendors
 *
 * Look at src/js/vendor and concatenate those files, send them to assets/js and minify the output.
 */
gulp.task('vendorJs', () => {
    return gulp.src('./assets/js/src/vendor/*.js')
        .pipe(concat('vendors.js'))
        .pipe(gulp.dest('./assets/js'))
        .pipe(rename({
            basename: 'vendors',
            suffix: '.min'
        }))
        .pipe(uglify())
        .pipe(gulp.dest('./assets/js'));
});

/**
 * Scripts: Custom
 *
 * Look at src/js and concatenate those files, send them to assets/js and minify the output.
 */
gulp.task('scriptsJs', () => {
    return gulp.src('./assets/js/src/*.js')
        .pipe(babel({
            presets: ['es2015']
        }))
        .pipe(rename({
            suffix: '.min'
        }))
        .pipe(uglify())
        .pipe(gulp.dest('./assets/js'));
});

/**
 * JS watch
 *
 * Required to fix css not injecting after a browser sync reload
 */
gulp.task('js-watch', ['scriptsJs'], browserSync.reload);

// Watch task
gulp.task('default', ['styles', 'vendorJs', 'scriptsJs', 'browser-sync'], () => {
    gulp.watch('./assets/css/**/*.scss', ['styles']);
    gulp.watch('./assets/js/**/*.js', ['js-watch']);
});
