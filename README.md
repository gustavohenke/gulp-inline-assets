# gulp-inline-assets
> Inline local and external assets (images, fonts) in a CSS file in the form of a data URI.

[![Build Status](https://img.shields.io/travis/gustavohenke/gulp-inline-assets.svg?style=flat-square)](https://travis-ci.org/gustavohenke/gulp-inline-assets)

## Install
```shell
$ npm install --save-dev gulp-inline-assets
```

## Usage

```js
```

```javascript
var gulp = require('gulp');
var inlineAssets = require('gulp-inline-assets');

gulp.task('default', function () {
    return gulp.src('src/app.css')
        .pipe(inlineAssets(options))
        .pipe(gulp.dest('dist'));
});
```

## Options

### ignoreErrors
Type: `boolean`

Determines if URLs with errors should be ignored.

## License
MIT @ Gustavo Henke