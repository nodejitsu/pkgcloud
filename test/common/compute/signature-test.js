/*
 * signature-test.js: Test that shared methods meet some expectations for arguments.
 *
 * (C) 2013 Nodejitsu Inc.
 *
 */

var should = require('should'),
    providers = require('../../configs/providers.json'),
    helpers = require('../../helpers'),
    _ = require('underscore');

providers.forEach(function (provider) {

  describe('pkgcloud/common/compute/signatures [' + provider + ']', function () {

    var client = helpers.createClient(provider, 'compute');

    it('client.getVersion should have length 1', function () {
      client.getVersion.should.be.a('function');
      client.getVersion.should.have.length(1);
    });

    it('client.createServer should take 2 arguments', function () {
      client.createServer.should.be.a('function');
      client.createServer.should.have.length(2);
    });

    it('client.getServers should take at least 1 argument', function () {
      client.getServers.should.be.a('function');
      should.ok(client.getServers.length >= 1);
    });

    it('client.getServer should take 2 arguments', function () {
      client.getServer.should.be.a('function');
      client.getServer.should.have.length(2);
    });

    it('client.rebootServer should have minimum 2 arguments', function () {
      client.rebootServer.should.be.a('function');
      should.ok(client.rebootServer.length >= 2);
    });

    it('client.destroyServer should take 2 arguments', function () {
      client.destroyServer.should.be.a('function');
      client.destroyServer.should.have.length(2);
    });

    it('client.getFlavor should take 2 arguments', function () {
      client.getFlavor.should.be.a('function');
      client.getFlavor.should.have.length(2);
    });

    it('client.getFlavors should take 1 argument', function () {
      client.getFlavors.should.be.a('function');
      client.getFlavors.should.have.length(1);
    });

    it('client.getImage should take 2 arguments', function () {
      client.getImage.should.be.a('function');
      client.getImage.should.have.length(2);
    });

    it('client.getImages should have minimum 1 argument', function () {
      client.getImages.should.be.a('function');
      should.ok(client.getImages.length >= 1);
    });
  });
});

