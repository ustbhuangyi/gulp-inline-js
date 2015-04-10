var fs = require('fs');
var pth = require('path');
var File = require('vinyl');
var _exists = fs.existsSync || pth.existsSync;
var iconv = require('iconv-lite');

var _ = module.exports;

var TEXT_FILE_EXTS = [
  'css', 'tpl', 'js', 'php',
  'txt', 'json', 'xml', 'htm',
  'text', 'xhtml', 'html', 'md',
  'conf', 'po', 'config', 'tmpl',
  'coffee', 'less', 'sass', 'jsp',
  'scss', 'manifest', 'bak', 'asp',
  'tmp', 'haml', 'jade', 'aspx',
  'ashx', 'java', 'py', 'c', 'cpp',
  'h', 'cshtml', 'asax', 'master',
  'ascx', 'cs', 'ftl', 'vm', 'ejs',
  'styl', 'jsx', 'handlebars'
];
var IMAGE_FILE_EXTS = [
  'svg', 'tif', 'tiff', 'wbmp',
  'png', 'bmp', 'fax', 'gif',
  'ico', 'jfif', 'jpe', 'jpeg',
  'jpg', 'woff', 'cur', 'webp',
  'swf', 'ttf', 'eot'
];

//parse the str from the quotes
_.stringQuote = function (str, quotes) {
  var info = {
    origin: str,
    rest: str = str.trim(),
    quote: ''
  };
  if (str) {
    quotes = quotes || '\'"';
    var strLen = str.length - 1;
    for (var i = 0, len = quotes.length; i < len; i++) {
      var c = quotes[i];
      if (str[0] === c && str[strLen] === c) {
        info.quote = c;
        info.rest = str.substring(1, strLen);
        break;
      }
    }
  }
  return info;
};

_.uri = function (path, dirname) {

  var info = _.stringQuote(path);
  var file = _.normalize(dirname, info.rest);

  if (file && _.isFile(file)) {
    var c = new Buffer(_.read(file));
    info.file = new File({
      path: file,
      contents: c
    });

  }
  return info;
};

//return the directory name of a path
_.dirname = function (path) {
  return pth.dirname(path);
};


//is utf8 bytes
_.isUtf8 = function (bytes) {
  var i = 0;
  while (i < bytes.length) {
    if ((// ASCII
      0x00 <= bytes[i] && bytes[i] <= 0x7F
      )) {
      i += 1;
      continue;
    }

    if ((// non-overlong 2-byte
      (0xC2 <= bytes[i] && bytes[i] <= 0xDF) &&
      (0x80 <= bytes[i + 1] && bytes[i + 1] <= 0xBF)
      )) {
      i += 2;
      continue;
    }

    if (
      (// excluding overlongs
      bytes[i] == 0xE0 &&
      (0xA0 <= bytes[i + 1] && bytes[i + 1] <= 0xBF) &&
      (0x80 <= bytes[i + 2] && bytes[i + 2] <= 0xBF)
      ) || (// straight 3-byte
      ((0xE1 <= bytes[i] && bytes[i] <= 0xEC) ||
      bytes[i] == 0xEE ||
      bytes[i] == 0xEF) &&
      (0x80 <= bytes[i + 1] && bytes[i + 1] <= 0xBF) &&
      (0x80 <= bytes[i + 2] && bytes[i + 2] <= 0xBF)
      ) || (// excluding surrogates
      bytes[i] == 0xED &&
      (0x80 <= bytes[i + 1] && bytes[i + 1] <= 0x9F) &&
      (0x80 <= bytes[i + 2] && bytes[i + 2] <= 0xBF)
      )
    ) {
      i += 3;
      continue;
    }

    if (
      (// planes 1-3
      bytes[i] == 0xF0 &&
      (0x90 <= bytes[i + 1] && bytes[i + 1] <= 0xBF) &&
      (0x80 <= bytes[i + 2] && bytes[i + 2] <= 0xBF) &&
      (0x80 <= bytes[i + 3] && bytes[i + 3] <= 0xBF)
      ) || (// planes 4-15
      (0xF1 <= bytes[i] && bytes[i] <= 0xF3) &&
      (0x80 <= bytes[i + 1] && bytes[i + 1] <= 0xBF) &&
      (0x80 <= bytes[i + 2] && bytes[i + 2] <= 0xBF) &&
      (0x80 <= bytes[i + 3] && bytes[i + 3] <= 0xBF)
      ) || (// plane 16
      bytes[i] == 0xF4 &&
      (0x80 <= bytes[i + 1] && bytes[i + 1] <= 0x8F) &&
      (0x80 <= bytes[i + 2] && bytes[i + 2] <= 0xBF) &&
      (0x80 <= bytes[i + 3] && bytes[i + 3] <= 0xBF)
      )
    ) {
      i += 4;
      continue;
    }
    return false;
  }
  return true;
};

//read buffer
_.readBuffer = function (buffer) {
  if (_.isUtf8(buffer)) {
    buffer = buffer.toString('utf8');
    if (buffer.charCodeAt(0) === 0xFEFF) {
      buffer = buffer.substring(1);
    }
  } else {
    buffer = iconv.decode(buffer, 'gbk');
  }
  return buffer;
};


//get the filetype regex expression
function getFileTypeReg(type) {
  var map = [];
  if (type === 'text') {
    map = TEXT_FILE_EXTS;
  } else if (type === 'image') {
    map = IMAGE_FILE_EXTS;
  } else {
    throw new Error('invalid file type [' + type + ']');
  }
  map = map.join('|');
  return new RegExp('\\.(?:' + map + ')$', 'i');
}


//is text file
_.isTextFile = function (path) {
  return getFileTypeReg('text').test(path || '');
};

//read file content
_.read = function (path, convert) {
  var content = false;
  if (_exists(path)) {
    content = fs.readFileSync(path);
    if (convert || _.isTextFile(path)) {
      content = _.readBuffer(content);
    }
  } else {
    throw new Error('unable to read file[' + path + ']: No such file or directory.');
  }
  return content;
}


//is a file
_.isFile = function (path) {
  return _exists(path) && fs.statSync(path).isFile();
};

//path normalize
_.normalize = function (path) {
  if (arguments.length > 1) {
    path = Array.prototype.join.call(arguments, '/');
  } else if (_.isString(path)) {
    //do nothing for quickly determining.
  } else if (_.isObject(path)) {
    path = Array.prototype.join.call(path, '/');
  } else if (_.isUndefined(path)) {
    path = '';
  }
  if (path) {
    path = pth.normalize(path.replace(/[\/\\]+/g, '/')).replace(/\\/g, '/');
    if (path !== '/') {
      path = path.replace(/\/$/, '');
    }
  }
  return path;
};

//is object
_.isObject = function (arg) {
  return typeof arg === 'object' && arg !== null;
};

//is string
_.isString = function (arg) {
  return typeof arg === 'string';
};

//is undefined
_.isUndefined = function (arg) {
  return arg === void 0;
};
