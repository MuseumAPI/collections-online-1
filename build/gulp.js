module.exports = (gulp, customizationPath) => {
  const config = require('../lib/config');
  config.setCustomizationPath(customizationPath);

  //------------------------------------------
  // Require
  //------------------------------------------
  // sorted alphabetically after const name
  const autoprefixer = require('gulp-autoprefixer');
  const bower = require('gulp-bower');
  const browserify = require('browserify');
  const cleanCSS = require('gulp-clean-css');
  const concat = require('gulp-concat');
  const customPug = require('./custom-pug.js')(config);
  const del = require('del');
  const fs = require('fs');
  const gulpif = require('gulp-if');
  const notify = require('gulp-notify');
  const path = require('path');
  const plumber = require('gulp-plumber');
  const print = require('gulp-print');
  const pug = require('gulp-pug');
  const rename = require('gulp-rename');
  const sass = require('gulp-sass');
  const sequence = require('run-sequence');
  const source = require('vinyl-source-stream');
  const sourcemaps = require('gulp-sourcemaps');
  const svgmin = require('gulp-svgmin');
  const svgstore = require('gulp-svgstore');
  const uglify = require('gulp-uglify');
  const uniqueFiles = require('gulp-unique-files');

  //------------------------------------------
  // Directories - note that they are relative to the project specific gulpfile
  //------------------------------------------
  var DEST_DIR = path.join(customizationPath, 'generated');
  var ROOT_CO = __dirname + '/..';
  var BOWER_COMPONENTS_CO = ROOT_CO + '/bower_components';
  var STYLES_SRC = customizationPath + '/app/styles/main.scss';
  var STYLES_ALL = [
    customizationPath + '/app/styles/*.scss',
    ROOT_CO + '/app/styles/**/*.scss'
  ];
  var STYLES_DEST = DEST_DIR + '/styles';
  var SCRIPTS_FOLDER_CO = ROOT_CO + '/app/scripts';
  var SCRIPTS_CO = SCRIPTS_FOLDER_CO + '/*.js';
  var SCRIPTS_ARRAY_CO = [SCRIPTS_CO];
  var SCRIPTS = customizationPath + '/app/scripts/*.js';
  var SCRIPTS_DEST = DEST_DIR + '/scripts';
  var SCRIPT_NAME = 'main.js';
  var SVG_SRC_CO = ROOT_CO + '/app/images/icons/*.svg';
  var SVG_SRC = customizationPath + '/app/images/icons/*.svg';
  var SVG_DEST = DEST_DIR + '/images';
  var PUG_SRC_CO = ROOT_CO + '/app/views/**/*.pug';
  var PUG_SRC = customizationPath + '/app/views/**/*.pug';
  var PUG_DEST = DEST_DIR + '/views';
  var isDevelopment = process.env.NODE_ENV === 'development';

  // Add bower scripts
  var BOWER_SCRIPTS = [
    '/jquery/dist/jquery.js',
    '/ev-emitter/ev-emitter.js',
    '/get-size/get-size.js',
    '/desandro-matches-selector/matches-selector.js',
    '/fizzy-ui-utils/utils.js',
    '/outlayer/item.js',
    '/outlayer/outlayer.js',
    '/picturefill/dist/picturefill.js',
    '/typeahead.js/dist/typeahead.bundle.js',
    '/scrollToTop/jquery.scrollToTop.js',
    '/slick-carousel/slick/slick.min.js',
    '/formatter.js/dist/jquery.formatter.min.js',
    '/auth0-lock/build/lock.min.js'
  ].map((script) => {
    return BOWER_COMPONENTS_CO + script;
  });


  SCRIPTS_ARRAY_CO = BOWER_SCRIPTS.concat(SCRIPTS_ARRAY_CO);

  // Add Project specific scripts at the end.
  // Overwrites thanks to uniqueFiles in the js task
  SCRIPTS_ARRAY_CO.push(SCRIPTS);

  // Add the runtime lib used to run pug templates
  var SCRIPTS_BROWSERIFY_DIR_CO = ROOT_CO + '/app/scripts-browserify';
  var SCRIPTS_BROWSERIFY_DIR = customizationPath + '/app/scripts-browserify';

  var SCRIPTS_ALL = SCRIPTS_ARRAY_CO;

  gulp.task('reload-config', function() {
    config.reload();
  });

  // Return only
  //------------------------------------------
  // Individual tasks
  //------------------------------------------
  gulp.task('bower', function() {
    return bower({cwd: ROOT_CO});
  });

  gulp.task('css', function() {
    return gulp.src(STYLES_SRC)
      .pipe(plumber())
      .pipe(gulpif(isDevelopment, sourcemaps.init()))
      .pipe(sass().on('error', function(err) {
        sass.logError(err);
        return notify().write({
          'message': 'Sass error'
        });
      }))
      .pipe(cleanCSS())
      .pipe(autoprefixer({browsers: ['last 4 versions']}))
      .pipe(gulpif(isDevelopment, sourcemaps.write()))
      .pipe(gulp.dest(STYLES_DEST));
  });

  gulp.task('js-browserify', ['pug'], function() {
    return browserify({
      paths: [
        SCRIPTS_BROWSERIFY_DIR,
        SCRIPTS_BROWSERIFY_DIR_CO,
        DEST_DIR
      ],
      basedir: SCRIPTS_BROWSERIFY_DIR,
      debug: isDevelopment,
      entries: './index.js',
      insertGlobalVars: {
        clientSideConfig: function(file, dir) {
          const clientSideConfig = config.getClientSideConfig();
          return JSON.stringify(clientSideConfig);
        }
      }
    })
    .transform(require.resolve('babelify'), {
      // Mapping because of https://github.com/babel/gulp-babel/issues/93,
      'env': {
        'production': {
          'presets': [
            'babel-preset-latest',
            //'babel-preset-babili'
          ].map(require.resolve)
        },
        'beta': {
          'presets': [
            'babel-preset-latest',
            //'babel-preset-babili'
          ].map(require.resolve)
        }
      },
      // Global is needed because JS in collections-online is considered global
      global: !isDevelopment
    })
    .bundle()
    .on('error', function(err){
      console.log(err.stack);
      return notify().write({
        'title': 'Browserify error',
        'message': err.message
      });
    })
    .pipe(source('browserify-index.js'))
    .pipe(gulp.dest(SCRIPTS_DEST));
  });

  gulp.task('js', ['js-browserify'], function() {
    var scriptPaths = SCRIPTS_ARRAY_CO.concat([
      SCRIPTS_DEST + '/browserify-index.js'
    ]);
    return gulp.src(scriptPaths)
      .pipe(uniqueFiles())
      .pipe(concat(SCRIPT_NAME))
      .pipe(gulp.dest(SCRIPTS_DEST))
      .pipe(gulpif(!isDevelopment, uglify().on('error', console.error)))
      .pipe(gulp.dest(SCRIPTS_DEST))
      .pipe(notify('Ready to reload'))
      .on('error', function(err){
        console.log(err.stack);
        return notify().write({
          'title': 'JavaScript error',
          'message': err.message
        });
      });
  });

  gulp.task('svg', function() {
    return gulp.src([SVG_SRC_CO, SVG_SRC])
      .pipe(uniqueFiles())
      .pipe(svgmin())
      .pipe(rename({prefix: 'icon-'}))
      .pipe(svgstore({
        inlineSvg: true
      }))
      .pipe(gulp.dest(SVG_DEST));
  });

  gulp.task('pug', function() {
    return gulp.src([PUG_SRC_CO, PUG_SRC])
      .pipe(uniqueFiles())
      .pipe(pug({
        client: true,
        compileDebug: isDevelopment,
        pug: customPug
      }))
      .pipe(gulp.dest(PUG_DEST));
  });

  gulp.task('watch', function() {
    gulp.watch(STYLES_ALL, ['css']);
    gulp.watch([SVG_SRC, SVG_SRC_CO], ['svg']);
    gulp.watch([PUG_SRC_CO, PUG_SRC], ['js']);
    gulp.watch([
      SCRIPTS_ALL,
      SCRIPTS_BROWSERIFY_DIR_CO + '/**/*.js',
      SCRIPTS_BROWSERIFY_DIR + '/**/*.js',
      customizationPath + '/config/**/*',
      customizationPath + '/shared/*.js'
    ], ['reload-config', 'js']);
  });

  gulp.task('clean', function() {
    return del([DEST_DIR]);
  });
};
