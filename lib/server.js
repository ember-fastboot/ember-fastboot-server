var chalk = require('chalk');
var fs = require('fs');
var path = require('path');
var EmberApp = require('./ember-app');
var debug   = require('debug')('ember-cli-fastboot:server');

function FastBootServer(options) {
  var distPath = options.distPath;
  var config = readPackageJSON(distPath);

  this.app = new EmberApp({
    distPath: path.resolve(distPath),
    appFile: config.appFile,
    vendorFile: config.vendorFile,
    moduleWhitelist: config.moduleWhitelist
  });

  this.html = fs.readFileSync(config.htmlFile, 'utf8');

  this.ui = options.ui;
}

FastBootServer.prototype.log = function(statusCode, message, startTime) {
  var color = statusCode === 200 ? 'green' : 'red';
  var now = new Date();

  if (startTime) {
    var diff = Date.now() - startTime;
    message = message + chalk.blue(" " + diff + "ms");
  }

  this.ui.writeLine(chalk.blue(now.toISOString()) + " " + chalk[color](statusCode) + " " + message);
};

FastBootServer.prototype.insertIntoIndexHTML = function(title, body) {
  var html = this.html.replace("<!-- EMBER_CLI_FASTBOOT_BODY -->", body);

  if (title) {
    html = html.replace("<!-- EMBER_CLI_FASTBOOT_TITLE -->", "<title>" + title + "</title>");
  }

  return html;
};

FastBootServer.prototype.handleSuccess = function(res, path, result, startTime) {
  this.log(200, 'OK ' + path, startTime);
  res.send(this.insertIntoIndexHTML(result.title, result.body));
};

FastBootServer.prototype.handleFailure = function(res, path, error, startTime) {
  if (error.name === "UnrecognizedURLError") {
    this.log(404, "Not Found " + path, startTime);
    res.sendStatus(404);
  } else {
    console.log(error.stack);
    this.log(500, "Unknown Error: " + error, startTime);
    res.sendStatus(500);
  }
};

FastBootServer.prototype.handleAppBootFailure = function(error) {
  debug("app boot failed");
  self.ui.writeLine(chalk.red("Error loading the application."));
  self.ui.writeLine(error);
};

FastBootServer.prototype.middleware = function() {
  return function(req, res, next) {
    var path = req.path;
    debug("middleware request; path=%s", path);

    var server = this;

    debug("handling url; url=%s", path);

    var startTime = Date.now();

    this.app.visit(path)
      .then(success, failure)
      .finally(function() {
        debug("finished handling; url=%s", path);
      });

    function success(result) {
      server.handleSuccess(res, path, result, startTime);
    }

    function failure(error) {
      server.handleFailure(res, path, error, startTime);
    }
  }.bind(this);
};

function readPackageJSON(distPath) {
  var pkgPath = path.join(distPath, 'package.json');

  try {
    var file = fs.readFileSync(pkgPath);

    var pkg = JSON.parse(file);
    var manifest = pkg.fastboot.manifest;

    return {
      appFile:  path.join(distPath, removePrepend(manifest.appFile, manifest.assetPrepend)),
      vendorFile: path.join(distPath, removePrepend(manifest.vendorFile, manifest.assetPrepend)),
      htmlFile: path.join(distPath, manifest.htmlFile),
      moduleWhitelist: pkg.fastboot.moduleWhitelist
    };
  } catch (e) {
    console.log("Couldn't find %s. You may need to update your version of ember-cli-fastboot.", pkgPath);
  }
}

function removePrepend(filePath, prepend) {
  if (prepend) {
    var prependRegex = new RegExp('^' +  prepend);
    filePath = filePath.replace(prependRegex, '');
  }

  return filePath;
}

module.exports = FastBootServer;
