var pkgcloud = require('../../lib/pkgcloud');
var KH_admin_tenantID = '6ade8ae8037b4e449a4c7c7a65dc5e1b';
var client = pkgcloud.network.createClient({
  provider: 'openstack',
  tenantId: KH_admin_tenantID,
  token: 'd16cea96919a4fc9969a0a58cdf36eb0',
  region: 'RegionOne',
  authUrl: 'http://172.16.31.1:35357',
  strictSSL: false
});

client.getLoadbalancers(function (err, lbs) {
  if (err) {
    console.error(err);
  } else {
    console.log(lbs);
  }
});
