/*
 * servers.js: Instance methods for working with servers from Azure Cloud
 *
 * (C) Microsoft Open Technologies, Inc.
 *
 */
var async = require('async');
var errs = require('errs');
var _ = require('lodash');

var resourceManagement = require('azure-arm-resource');
var ComputeManagementClient = require('azure-arm-compute');

var constants = require('../../constants');

/**
 * Gets the current API version
 * @param {function} callback cb(err, version).
 */
function getVersion(callback) {
  callback(null, constants.MANAGEMENT_API_VERSION);
}

/**
 * Gets the current API limits
 * @param {function} callback - cb(err, version).
 */
function getLimits(callback) {
  return errs.handle(
    errs.create({
      message: 'Azure\'s API is not rate limited'
    }),
    callback
  );
}

/**
 * Lists all servers available to your account.
 * @param {function} callback - cb(err, servers). `servers` is an array that
 * represents the servers that are available to your account
 */
function getServers(callback) {
  var self = this;

  self.login(function (err) {

    if (err) {
      return callback(err);
    }

    var client = new ComputeManagementClient(self.azure.credentials, self.config.subscriptionId);
    client.virtualMachines.list(self.config.resourceGroup, function (err, results) {
      return err ?
        callback(err) :
        callback(null, results.map(function (res) {
          return new self.models.Server(self, res);
        }));
    });
  });
}

/**
 * Gets a server in Azure.
 * @param {Server|String} server Server id or a server
 * @param {Function} callback cb(err, serverId).
 */
function getServer(server, callback) {
  var self = this;
  var serverId = server instanceof self.models.Server ? server.name : server;

  self.login(function (err) {

    if (err) {
      return callback(err);
    }

    var client = new ComputeManagementClient(self.azure.credentials, self.config.subscriptionId);

    // This will ensure returning of instances running status
    var options = {
      expand: 'instanceView'
    };
    client.virtualMachines.get(self.config.resourceGroup, serverId, options, function (err, result) {

      if (err) {
        return callback(err);
      }

      // Get public dns url
      if (!result.networkProfile ||
        !result.networkProfile.networkInterfaces ||
        !result.networkProfile.networkInterfaces.length) {
        return callback(null, new self.models.Server(self, result));
      }

      var networkInterfaceId = result.networkProfile.networkInterfaces[0].id;
      var resourceClient = new resourceManagement.ResourceManagementClient(self.azure.credentials, self.config.subscriptionId);

      resourceClient.resources.getById(networkInterfaceId, constants.DEFAULT_API_VERSION, function (err, networkInterface) {

        if (err) {
          return callback(err);
        }

        if (!networkInterface.properties.ipConfigurations ||
          !networkInterface.properties.ipConfigurations.length ||
          !networkInterface.properties.ipConfigurations[0] ||
          !networkInterface.properties.ipConfigurations[0].properties ||
          !networkInterface.properties.ipConfigurations[0].properties.publicIPAddress ||
          !networkInterface.properties.ipConfigurations[0].properties.publicIPAddress.id) {
          return callback(null, new self.models.Server(self, result));
        }

        var publicIPID = networkInterface.properties.ipConfigurations[0].properties.publicIPAddress.id;
        resourceClient.resources.getById(publicIPID, constants.DEFAULT_API_VERSION, function (err, publicIP) {
          if (err) {
            return callback(err);
          }

          if (!publicIP.properties.dnsSettings || !publicIP.properties.dnsSettings.fqdn) {
            return callback(null, new self.models.Server(self, result));
          }

          result = result || {};
          result.hostname = publicIP.properties.dnsSettings.fqdn;

          return callback(null, new self.models.Server(self, result));
        });
      });
    });
  });
}

/**
 * Creates a server with the specified options
 * 
 * @description The flavor
 * properties of the options can be instances of Flavor
 * OR ids to those entities in Azure.
 * 
 * @param {object}   options - **Optional** options
 * @param {string}   options.name - **Optional** the name of server
 * @param {function} callback cb(err, server).
 */
function createServer(options, callback) {
  var self = this;

  if (!options.name || !options.username || !options.password) {
    return errs.handle(
      errs.create({
        message: 'Please provide a name for the vm, as well as the username and password for login'
      }),
      callback
    );
  }

  if (!options.flavor) {
    return errs.handle(
      errs.create({
        message: 'When creating an azure server a flavor or an image need to be supplied'
      }),
      callback
    );
  }

  var adjustVMTemplate = function (template) {

    var vmIndex = _.findIndex(template.resources, {
      'type': 'Microsoft.Compute/virtualMachines'
    });

    // Adding additional data disks
    if (options.storageDataDiskNames && options.storageDataDiskNames.length) {
      options.storageDataDiskNames.forEach(function (ddName, idx) {
        template.resources[vmIndex].properties.storageProfile.dataDisks.push({
          'name': 'datadisk' + idx.toString(),
          'diskSizeGB': '100',
          'lun': 0,
          'vhd': {
            'uri': '[concat(reference(concat(\'Microsoft.Storage/storageAccounts/\', variables(\'storageAccountName\')), \'2016-01-01\').primaryEndpoints.blob, parameters(\'storageContainerName\'),\'/\', \'' + ddName + '\', \'.vhd\')]'
          },
          'createOption': 'Empty'
        });
      });
    }

    // If this is a windows machine, add an extension that enables ssh connection via Win32-OpenSSH
    if (options.osType === 'Windows') {
      template.resources[vmIndex].resources = [{
        'type': 'Microsoft.Compute/virtualMachines/extensions',
        'name': '[concat(variables(\'vmName\'),\'/Win32sshExtension\')]',
        'apiVersion': constants.DEFAULT_API_VERSION,
        'location': '[resourceGroup().location]',
        'dependsOn': [
          '[concat(\'Microsoft.Compute/virtualMachines/\', variables(\'vmName\'))]'
        ],
        'properties': {
          'publisher': 'Microsoft.Compute',
          'type': 'CustomScriptExtension',
          'typeHandlerVersion': '1.8',
          'settings': {
            'fileUris': ["https://raw.githubusercontent.com/CatalystCode/pkgcloud/master/lib/pkgcloud/azure-v2/scripts/ssh.ps1"],
            'commandToExecute': `powershell -File ssh.ps1 .\\${options.username} ${options.password}`
          },
        }
      }];
    } else { // linux - make sure the new user is in sudoers - so he can sudo with no password
      template.resources[vmIndex].resources = [{
        'type': 'Microsoft.Compute/virtualMachines/extensions',
        'name': '[concat(variables(\'vmName\'),\'/LinuxSudoExtension\')]',
        'apiVersion': constants.DEFAULT_API_VERSION,
        'location': '[resourceGroup().location]',
        'dependsOn': [
          '[concat(\'Microsoft.Compute/virtualMachines/\', variables(\'vmName\'))]'
        ],
        'properties': {
          'publisher': 'Microsoft.OSTCExtensions',
          'type': 'CustomScriptForLinux',
          'typeHandlerVersion': '1.5',
          'settings': {
            'fileUris': ["https://raw.githubusercontent.com/CatalystCode/pkgcloud/master/lib/pkgcloud/azure-v2/scripts/sudo.sh"],
            'commandToExecute': 'bash sudo.sh ' + options.username
          },
        }
      }];
    }

    return template;
  };

  var templateName = 'compute' + (options.imageSourceUri ? '-from-image' : '');
  self.deploy(templateName, options, adjustVMTemplate, function (err) {
    return err ?
      callback(err) :
      self.getServer(options.name, callback);
  });
}

/**
 * Destroy a server in Azure.
 * @param {Server|string} server Server id or a server
 * @param {object} options optional | options for deletion
 * @param {boolean} options.destroyNics should destroy nics also
 * @param {boolean} options.destroyPublicIP should destroy public ip also
 * @param {boolean} options.destroyVnet should destroy vnet also
 * @param {boolean} options.destroyStorage should destroy storage account also
 * @param {function} callback cb(err, serverId).
 */
function destroyServer(server, options, callback) {
  var self = this;
  var serverId = server && server.name || server;

  if (typeof options === 'function' && typeof callback === 'undefined') {
    callback = options;
    options = {};
  }

  options = options || {};

  var resourceClient;
  var serverDetails;
  var nicsIds;
  var nicsDetails;

  var vnets;
  var publicIPs;

  async.waterfall([
    function (next) {
      self.login(next);
    },
    function (credentials, next) {
      self.getServer(serverId, next);
    },
    function (_server, next) {
      serverDetails = _server;
      next();
    },
    function (next) {
      // Deleting the vm
      resourceClient = new resourceManagement.ResourceManagementClient(self.azure.credentials, self.config.subscriptionId);
      var client = new ComputeManagementClient(self.azure.credentials, self.config.subscriptionId);
      client.virtualMachines.deleteMethod(self.config.resourceGroup, serverId, next);
    }
  ], function (err) {

    if (err) {
      return callback(err);
    }

    if (!options.destroyNics &&
      !options.destroyPublicIP &&
      !options.destroyVnet &&
      !options.destroyStorage) {
      return callback();
    }

    async.waterfall([
      function (next) {
        // Deleting the nics
        nicsIds = serverDetails &&
          serverDetails.azure &&
          serverDetails.azure.networkProfile &&
          serverDetails.azure.networkProfile.networkInterfaces || [];

        // Go over all nics, get their details and go on to delete them
        async.eachSeries(nicsIds, function (nic, cb) {

          nicsDetails = [];
          async.waterfall([
            function (nx) {
              resourceClient.resources.getById(nic.id, constants.MANAGEMENT_API_VERSION, nx);
            },
            function (nicDetails, request, response, nx) {
              nicsDetails.push(nicDetails);

              if (options.destroyNics) {
                resourceClient.resources.deleteById(nic.id, constants.MANAGEMENT_API_VERSION, nx);
              }
            }
          ], cb);

        }, next);
      },
      function (next) {
        // Collecting public ips and vnet ids
        publicIPs = [];
        vnets = [];
        nicsDetails.forEach(function (nic) {

          var configs = nic && nic.properties && nic.properties.ipConfigurations || [];

          // Collecting 
          configs.forEach(function (config) {
            var props = config && config.properties || {};
            if (props.publicIPAddress && props.publicIPAddress.id) {
              publicIPs.push(props.publicIPAddress.id);
            }

            if (props.subnet && props.subnet.id && props.subnet.id.indexOf('/subnets/') >= 0) {
              vnets.push(props.subnet.id.substr(0, props.subnet.id.indexOf('/subnets/')));
            }
          });

        });
        next();
      },
      function (next) {

        if (!options.destroyPublicIP) {
          return next();
        }

        // Deleting public ips
        async.eachSeries(publicIPs, function (publicIP, cb) {
          resourceClient.resources.deleteById(publicIP, constants.MANAGEMENT_API_VERSION, cb);
        }, next);
      },
      function (next) {

        if (!options.destroyVnet) {
          return next();
        }

        // Deleting vnets
        async.eachSeries(vnets, function (vnet, cb) {
          resourceClient.resources.deleteById(vnet, constants.MANAGEMENT_API_VERSION, cb);
        }, next);
      },
      function (next) {
        // Deleting storage account
        if (!options.destroyStorage) {
          return next();
        }

        var storageUri = serverDetails &&
          serverDetails.azure &&
          serverDetails.azure.storageProfile &&
          serverDetails.azure.storageProfile.osDisk &&
          serverDetails.azure.storageProfile.osDisk.vhd &&
          serverDetails.azure.storageProfile.osDisk.vhd.uri || null;

        if (!storageUri || !storageUri.startsWith('https://')) {
          return next();
        }

        var storageName = storageUri.substr('https://'.length);
        storageName = storageName.substr(0, storageName.indexOf('.'));

        // Presuming the storage account is in the same resource group as the vm
        resourceClient.resources.deleteMethod(
          self.config.resourceGroup,
          'Microsoft.Storage',
          'storageAccounts',
          storageName,
          '', '2016-01-01', next);
      }
    ], function (error) {
      callback(error, serverDetails);
    });
  });

}

/**
 * Stop a server in Azure.
 * @param {Server|string} server Server id or a server
 * @param {function} callback cb(err, serverId).
 */
function stopServer(server, callback) {
  var self = this;
  var serverId = server instanceof self.models.Server ? server.id : server;

  self.login(function (err) {

    if (err) {
      return callback(err);
    }

    var client = new ComputeManagementClient(self.azure.credentials, self.config.subscriptionId);
    client.virtualMachines.powerOff(self.config.resourceGroup, serverId, function (err) {
      return err ?
        callback(err) :
        callback(null, serverId);
    });
  });
}

/**
 * Restart a server in Azure.
 * @param {Server|string} server Server id or a server
 * @param {function} callback cb(err, serverId).
 */
function rebootServer(server, callback) {
  var self = this;
  var serverId = server instanceof self.models.Server ? server.id : server;

  self.login(function (err) {

    if (err) {
      return callback(err);
    }

    var client = new ComputeManagementClient(self.azure.credentials, self.config.subscriptionId);
    client.virtualMachines.restart(self.config.resourceGroup, serverId, function (err) {
      return err ?
        callback(err) :
        callback(null, serverId);
    });
  });
}

/**
 * Rename a server in Azure.
 * @param {Server|string} server Server id or a server
 * @param {function} callback cb(err, serverId).
 */
function renameServer(server, callback) {
  return errs.handle(
    errs.create({
      message: 'Not supported by Azure.'
    }),
    callback
  );
}

module.exports = {
  getVersion: getVersion,
  getLimits: getLimits,
  getServers: getServers,
  getServer: getServer,
  createServer: createServer,
  destroyServer: destroyServer,
  stopServer: stopServer,
  rebootServer: rebootServer,
  renameServer: renameServer
};