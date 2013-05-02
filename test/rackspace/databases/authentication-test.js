
/*
 * authentication-test.js: Tests for pkgcloud Rackspace compute authentication
 *
 * (C) 2010 Nodejitsu Inc.
 *
 */

var should = require('should'),
    macros = require('../macros'),
    async = require('async'),
    hock = require('hock'),
    helpers = require('../../helpers'),
    mock = process.env.MOCK;

describe('pkgcloud/rackspace/database/authentication', function() {
  var client, testContext = {}, authServer, server;

  before(function(done) {
    client = helpers.createClient('rackspace', 'database');

    if (!mock) {
      return done();
    }

    async.parallel([
      function(next) {
        hock.createHock(12346, function (err, hockClient) {
          should.not.exist(err);
          should.exist(hockClient);

          authServer = hockClient;
          next();
        });
      },
      function(next) {
        hock.createHock(12345, function (err, hockClient) {
          should.not.exist(err);
          should.exist(hockClient);

          server = hockClient;
          next();
        });
      }
    ], done)

  });

  describe('The pkgcloud Rackspace Database client', function() {
    it('should have core methods defined', function() {
      macros.shouldHaveCreds(client);
    });

    it('the getVersion() method should return the proper version', function(done) {
      if (mock) {
        server
          .get('/')
          .reply(203, {versions: [
            { id: 'v1.0', status: 'BETA' }
          ]});
      }

      client.getVersion(function (err, versions) {
        should.not.exist(err);
        should.exist(versions);
        versions.should.be.instanceOf(Array);
        versions.should.have.length(1);

        server && server.done();
        done();
      });
    });

    describe('the auth() method with a valid username and api key', function() {

      var client = helpers.createClient('rackspace', 'database'),
          err, res;

      beforeEach(function(done) {

        if (mock) {
          var credentials = {
            username: client.config.username,
            key: client.config.apiKey
          };

          authServer
            .post('/v1.1/auth', { credentials: credentials })
            .replyWithFile(200, __dirname + '/../../fixtures/rackspace/token.json');
        }

        client.auth(function (e, r) {
          err = e;
          res = r;
          authServer && authServer.done();
          done();
        });

      });

      it('should respond with 200 and appropriate info', function() {
        should.not.exist(err);
        should.exist(res);
        res.statusCode.should.equal(200);
        res.headers.should.be.a('object');
        res.body.should.be.a('object');
      });

      it('should respond with a token', function () {
        res.body.auth.should.be.a('object');
        res.body.auth.token.should.be.a('object');
        res.body.auth.token.id.should.be.a('string');
      });

      it('should update the config with appropriate urls', function () {
        var config = client.config;
        config.serverUrl.should.equal(res.headers['x-server-management-url']);
        config.storageUrl.should.equal(res.headers['x-storage-url']);
        config.cdnUrl.should.equal(res.headers['x-cdn-management-url']);
        config.authToken.should.equal(res.headers['x-auth-token']);
        config.accountNumber.should.be.a('string');
      });
    });

    describe('the auth() method with an invalid username and api key', function () {

      var badClient = helpers.createClient('rackspace', 'database', {
        username: 'fake',
        apiKey: 'data',
        protocol: 'http://',
        authUrl: 'localhost:12346'
      });

      var err, res;

      beforeEach(function (done) {

        if (mock) {
          authServer
            .post('/v1.1/auth', { credentials: { username: 'fake', key: 'data' }})
            .reply(401, {
              unauthorized: {
                message: 'Username or api key is invalid', code: 401
              }
            });
        }

        badClient.auth(function (e, r) {
          err = e;
          res = r;
          authServer && authServer.done();
          done();
        });
      });

      it('should respond with Error code 401', function () {
        should.exist(err);
        should.not.exist(res);
        should.exist(err.unauthorized);
        err.unauthorized.code.should.equal(401);
      });
    });
  });

  after(function (done) {
    if (!mock) {
      return done();
    }

    async.parallel([
      function (next) {
        authServer.close(next);
      },
      function (next) {
        server.close(next);
      }
    ], done)
  });
});
