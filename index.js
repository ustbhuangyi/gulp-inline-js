'use strict';

var gutil = require('gulp-util');
var through = require('through2');
var _ = require('./lib/util.js');

var PluginError = gutil.PluginError;

var pluginName = 'gulp-inline-js';

var stringRegStr = '(?:' +
  '\"(?:[^\\\\\"\\r\\n\\f]|\\\\[\\s\\S])*\"' + //match the " delimiter string
  '|' +
  '\'(?:[^\\\\\'\\r\\n\\f]|\\\\[\\s\\S])*\'' + //match the ' delimiter string
  ')';

var jscommentRegStr = '(?:' +
  '\\/\\/[^\\r\\n\\f]*' + // match the single line comment
  '|' +
  '\\/\\*[\\s\\S]+?\\*\\/' + //match the multi line comment
  ')';

var inlineRegStr = '\\b(__inline)\\s*\\(\\s*(' + stringRegStr + ')\\s*\\)';

function createError(file, err) {
  if (typeof err === 'string') {
    return new PluginError(pluginName, file.path + ': ' + err, {
      fileName: file.path,
      showStack: false
    });
  }

  var msg = err.message || err.msg || 'unspecified error';

  return new PluginError(pluginName, file.path + ': ' + msg, {
    fileName: file.path,
    lineNumber: err.line,
    stack: err.stack,
    showStack: false
  });
}

module.exports = function (opt) {

  var embeddedMap = {};

  function embeddedCheck(fileMain, fileEmbedded) {
    var main = fileMain.path;
    var embedded = fileEmbedded.path;

    if (main === embedded) {
      error('unable to embed file[' + main + '] into itself.');
    } else if (embeddedMap[embedded]) {
      var next = embeddedMap[embedded],
        msg = [embedded];
      while (next && next !== embedded) {
        msg.push(next);
        next = embeddedMap[next];

      }
      console.log(msg);
      msg.push(embedded);
      error('circular dependency on [' + msg.join('] -> [') + '].');
    }
    embeddedMap[embedded] = main;
    return true;
  }

  function embeddedUnlock(file) {
    delete embeddedMap[file.path];
  }

  function error(msg) {
    //for watching, unable to exit
    embeddedMap = {};
    throw new Error(msg);
  }

  function embed(file) {
    var reg = new RegExp(stringRegStr + '|' +
    jscommentRegStr + '|' + inlineRegStr, 'g');

    var content = String(file.contents);

    content = content.replace(reg, function (m, type, url) {
      if (type === '__inline') {
        var info = _.uri(url, _.dirname(file.path));
        if (info && info.file) {
          try {
            var f = info.file;
            if (embeddedCheck(file, f)) {
              embed(f);
              m = String(f.contents);
            }
          }
          catch (e) {
            embeddedMap = {};
            e.message = e.message + ' in [' + file.path + ']';
            throw e;
          }
        }
        else {
          var msg = 'unable to inline non-existent file [' + url + ']'
          throw new Error(msg);
        }
      }
      return m;
    });

    file.contents = new Buffer(content);
  }

  function expand(file, encoding, callback) {

    if (file.isNull()) {
      return callback(null, file);
    }

    if (file.isStream()) {
      return callback(createError(file, 'Streaming not supported'));
    }

    try {
      embed(file);
    }
    catch (e) {
      return callback(createError(file, e.message));
    }

    embeddedUnlock(file);

    callback(null, file);
  }

  return through.obj(expand);
};
