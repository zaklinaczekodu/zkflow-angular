'use strict';

var inject = require('gulp-inject');
var minifyHtml = require('gulp-minify-html');
var template = require('gulp-template');
var gulpif = require('gulp-if');
var zkutils = require('gulp-zkflow-utils');
var q = require('q');
var plumber = require('gulp-plumber');
var _ = require('lodash');
var zkflowWatcher = require('zkflow-watcher');

function getInjectTask(options, gulp, mode, getOutputDir) {

  function injectTask(next) {

    var outputDir = getOutputDir();
    var logger = zkutils.logger('inject');
    var injectablesGlobs = prefixGlobs(options.injectablesGlobs);
    var headInjectablesGlobs = prefixGlobs(options.headInjectablesGlobs);
    var nextHandler;

    var noInjectFilesMessage =
      '\nNo inject files found.\n\n' +
      'Your inject files are determined by globs\n' +
      options.globs.toString() + '\n\n' +
      'You can add some matching files with inject.\n' +
      'See README.md for example file\n';

    function addBaseDir(glob) {
      if (glob.charAt(0) === '!') {
        return '!' + outputDir + glob.slice(1);
      }
      return outputDir + glob;
    }

    function prefixGlobs(globs) {

      var prefixedGlobs;

      if (typeof globs === 'undefined') {
        return;
      }

      if (_.isArray(globs)) {
        prefixedGlobs = [];
        globs.forEach(function(glob) {
          prefixedGlobs.push(addBaseDir(glob));
        });
        return prefixedGlobs;
      }

      return outputDir + globs;

    }

    function getInject(globs, name) {
      return inject(
        gulp.src(globs, options.headInjectablesGlobs), {
          addRootSlash: options.absolute,
          ignorePath: outputDir,
          name: name
        }
      );
    }

    function getAngularMainModuleName() {

      if (mode.env === 'prod') {
        return options.prodAngularMainModuleName;
      }

      if (mode.env === 'test') {
        return options.testAngularMainModuleName;
      }

      return options.devAngularMainModuleName;

    }

    function runInject() {

      return nextHandler.handle(
          zkutils.globby(options.globs, noInjectFilesMessage), {
            ignoreFailures: true,
            handleSuccess: false
          })
        .then(function() {

          var deferred = q.defer();
          var stream;

          stream = gulp.src(options.globs, options.globsOptions)
            .pipe(plumber(deferred.reject))
            .pipe(getInject(injectablesGlobs));

          if (typeof headInjectablesGlobs !== 'undefined') {
            stream = stream.pipe(getInject(headInjectablesGlobs, 'head'));
          }

          stream
            .pipe(template({
              angularMainModuleName: mode.angularMainModuleProdFallback ? options.prodAngularMainModuleName : getAngularMainModuleName()
            }))
            .pipe(gulpif(mode.env !== 'dev', minifyHtml(options.minifyHtml)))
            .pipe(gulp.dest(outputDir))
            .on('end', deferred.resolve);

          return nextHandler.handle(deferred.promise);

        });

    }

    nextHandler = new zkutils.NextHandler({
      next: next,
      watch: mode.watch,
      logger: logger
    });

    zkflowWatcher.watch(runInject, mode.watch, options.globs, logger);

  }

  return injectTask;

}

module.exports = {
  getTask: getInjectTask,
  defaultOptions: {
    globs: 'src/index.html',
    injectablesGlobs: [
      'index*.js',
      'index*.css'
    ],
    injectablesGlobsOptions: {
      read: false
    },
    absolute: true,
    prodAngularMainModuleName: 'app',
    devAngularMainModuleName: 'appDev',
    testAngularMainModuleName: 'appTest',
    minifyHtml: {
      empty: true,
      spare: true,
      quotes: true
    }
  }
};
