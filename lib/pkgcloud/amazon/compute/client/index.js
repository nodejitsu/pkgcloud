/*
 * index.js: Compute client for AWS CloudAPI
 *
 * (C) 2012 Nodejitsu Inc.
 *
 */

var qs     = require('querystring'),
    utile  = require('utile'),
    xml2js = require('xml2js'),
    auth   = require('../../../common/auth'),
    amazon = require('../../client');

var Client = exports.Client = function (options) {
  amazon.Client.call(this, options);

  utile.mixin(this, require('./flavors'));
  utile.mixin(this, require('./images'));
  utile.mixin(this, require('./servers'));
  utile.mixin(this, require('./keys'));

  this.before.push(auth.amazon.querySignature);
};

utile.inherits(Client, amazon.Client);

Client.prototype.query = function query(action, query, errback, callback) {
  return this.request(
    '?' + qs.stringify(utile.mixin({ Action: action }, query)),
    errback,
    function (body, res) {
      var parser = new xml2js.Parser();

      parser.parseString(body, function (err, data) {
        return err ? errback(err) : callback(data, res);
      });
    }
  );
};

Client.prototype.bootstrapOptions = function (options, keys) {
  return options.keyname || options.KeyName
    ? { KeyName: options.keyname || options.KeyName }
    : {};
};

Client.prototype.url = function () {
  var args = Array.prototype.slice.call(arguments);
  return ['https://' + this.serversUrl].concat(args).join('/');
};
