/*
 * index.js: Rackspace loadbalancer client
 *
 * (C) 2013 Rackspace
 *      Ken Perkins
 * MIT LICENSE
 *
 */

var utile = require('utile'),
    rackspace = require('../../client'),
    urlJoin = require('url-join'),
    _ = require('underscore');

var Client = exports.Client = function (options) {
  rackspace.Client.call(this, options);

  utile.mixin(this, require('./entities.js'));
  utile.mixin(this, require('./checks.js'));

  this.serviceType = 'rax:monitor';
};

utile.inherits(Client, rackspace.Client);

Client.prototype._getUrl = function (options) {
  options = options || {};

  var fragment = '';

  if (options.path) {
    fragment = urlJoin(fragment, options.path);
  }

  if (fragment === '' || fragment === '/') {
    return this._serviceUrl;
  }

  return urlJoin(this._serviceUrl, fragment);
};
