var path = require('path');
var fs = require('fs');

var resourceManagement = require('azure-arm-resource');

function resolve(templateId) {
  var templatePath = path.join(__dirname, '..', 'templates', 'arm-' + templateId + '.json');
  var contents = fs.readFileSync(templatePath);
  return JSON.parse(contents);
}

function deploy(templateName, options, templateProcess, callback) {
  var self = this;

  if (templateProcess && !callback) {
    callback = templateProcess;
    templateProcess = function (template) { return template; };
  }

  self.login(function (err) {

    if (err) {
      return callback(err);
    }

    var template = resolve(templateName);
    template = templateProcess(template);
    var parameters = {
      properties: {
        template: template,
        parameters: {},
        mode: 'Incremental'
      }
    };
    Object.keys(options).forEach(function (key) {
      if (template.parameters[key]) {
        parameters.properties.parameters[key] = { value: options[key] };
      }
    });

    var deploymentName = 'pkgc-' + (new Date()).toISOString().replace(/\:|Z|\.|\-/g, '').replace(/T/g, '-');
    var resourceClient = new resourceManagement.ResourceManagementClient(self.azure.credentials, self.config.subscriptionId);
    resourceClient.deployments.createOrUpdate(self.config.resourceGroup, deploymentName, parameters, function (err, result) {
      return err
        ? callback(err)
        : callback(null, result);
    });
  });
}

module.exports = {
  deploy: deploy
};