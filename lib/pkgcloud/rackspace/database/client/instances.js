/*
 * instances.js: Instance methods for working with database instances from Rackspace Cloud
 *
 * (C) 2011 Nodejitsu Inc.
 *
 */

var pkgcloud = require('../../../../../lib/pkgcloud'),
    Flavor   = pkgcloud.providers.rackspace.database.Flavor,
    Instance = pkgcloud.providers.rackspace.database.Instance,
    errs     = require('errs');

// Create Database Instance
// Need a flavor
// ### @options {Object} Set of options can be
// #### options['name'] {string} Name of instance (required)
// #### options['flavor'] {string | Object} Should be the HREF for the flavor or a instance of Flavor class (required)
// #### options['size'] {number} The Volume size in Gigabytes, must be between 1 and 8
// #### options['databases'] {array} Array of strings with database names to create when the instance is ready.
exports.createInstance = function createInstance (options, callback) {
  var self = this,
      flavorRef,
      size;

  // Check for options
  if (!options || typeof options === 'function') {
    return errs.handle(errs.create({
      message: 'Options required for create an instance.'
    }), options);
  }

  if (!options['name']) {
    return errs.handle(errs.create({
      message: 'options. name is a required argument'
    }), callback);
  }

  if (!options['flavor']) {
    return errs.handle(errs.create({
      message: 'options. flavor is a required argument'
    }), callback);
  }

  // If the 'databases' are specified we create a template for each database name.
  if (options && options['databases'] &&
      typeof options['databases'] === 'array' &&
      options['databases'].length > 0) {
    options['databases'].forEach(function (item, idx) {
      if (typeof item === 'string') {
        // This template is according to the defaults of rackspace.
        options['databases'][idx] = {
          name: item,
          character_set: "utf8",
          collate: 'utf8_general_ci'
        }
      }
    });
  }

  // Check for the correct value of 'size', should be between 1 and 8 otherwise will be 1
  if (options && options['size']) {
    size = (options['size'] > 0 && options['size'] < 9) ? options['size'] : 1;
  }

  // Extract the href value of the Flavor instance
  // Should be always true because above we return an error if not exists
  if (options && options['flavor']) {
    flavorRef = options['flavor'] instanceof Flavor ? options['flavor'].href : options['flavor'];
  }

  var createOptions = {
    method: 'POST',
    path: 'instances',
    body: {
      instance: {
        name: options['name'],
        flavorRef: flavorRef,
        databases: options['databases'] || [],
        volume: { size: size || 1 }
      }
    }
  };

  this.request(createOptions, callback, function(body, response) {
    var instance = new Instance(self, body.instance);
    callback(null, instance);
  });
};

// Gets all instances info
exports.getInstances = function getInstances (callback) {
  var self = this;

  if (typeof details === 'function') {
    callback = details;
    details = false;
  }

  this.request('instances/detail', callback, function (body) {
    callback(null, body.instances.map(function (result) {
      return new Instance(self, result);
    }));
  });
};

// Destroying the database instance
// ### @instance {string | Object} The ID of the istance of a instance of Instance class (required)
exports.destroyInstance = function destroyInstance (instance, callback) {
  // Check for instance
  if (typeof instance === 'function') {
    return errs.handle(errs.create({
      message: 'An instance is required.'
    }), instance);
  }

  var instanceId = instance instanceof Instance ? instance.id : instance;
  this.request('DELETE', 'instances/' + instanceId, callback, function (body, response) {
    callback(null, response);
  });
};

// Details of specific instance
// ### @instance {string | Object} The ID of the istance of a instance of Instance class (required)
exports.getInstance = function getInstance (instance, callback) {
  // Check for instance
  if (typeof instance === 'function') {
    return errs.handle(errs.create({
      message: 'An instance is required.'
    }), instance);
  }

  var self = this;
  var instanceId = instance instanceof Instance ? instance.id : instance;
  this.request('instances/' + instanceId, callback, function (body, response) {
    callback(null, body.instance);
  });
};
