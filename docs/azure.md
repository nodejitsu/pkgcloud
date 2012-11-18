# Azure Configuration for pkgcloud

* [Storage Configuration](#azure-storage)
* [Compute Configuration](#azure-compute)
* [Certificates](#azure-manage-cert)
  * [Azure Management Certificates](#azure-manage-cert)
  * [Azure SSH Certificates](#azure-ssh-cert)

<a name="azure-storage"></a>
**Azure Storage Configuration**

``` js
  {
    provider: 'azure',
    storageAccount: "test-storage-account",		//name of your storage account
    storageAccessKey: "test-storage-access-key"	//access key for storage account
  }
```

**Prerequisites**

1. Azure storage account must already exist. 
2. Storage account must be in same Azure location as compute servers (East US, West US, etc.). 
3. storageAccount and storageAccessKey are obtained from the [Storage](https://manage.windowsazure.com/#Workspace/StorageExtension/storage) section of the Azure Portal.
<br><br>


<a name="azure-compute"></a>

**Azure Compute Configuration**

``` js
  var azure = pkgcloud.compute.createClient({
    provider: 'azure',
    storageAccount: "test-storage-account",			//name of your storage account
    storageAccessKey: "test-storage-access-key", 	//access key for storage account
    managementCertificate: "./test/fixtures/azure/cert/management/management.pem",
    subscriptionId: "azure-account-subscription-id",
    azure: {
        location: "East US",	//azure location for server
        username: "pkgcloud",	//username for server
        password: "Pkgcloud!!",	//password for server
        ssh : {					//ssh settings for linux server
            port: 22,			//default is 22
            pem: "./test/fixtures/azure/cert/ssh/mycert.pem",
            pemPassword: ""
        },
        rdp : {					// rdp settings for windows server
            port: 3389
        }
	});
```
**Prerequisites**

1. Create a [Azure Management Certificate](#AzureManageCert).
2. Upload the management .cer file to the [Management Certificates](https://manage.windowsazure.com/#Workspace/AdminTasks/ListManagementCertificates) section of the Azure portal. 
3. Specify the location of the management.pem file in the azure.managementCertificate field.
4. Create a [Storage Account](https://manage.windowsazure.com/#Workspace/StorageExtension/storage) if one does not already exist. Storage accounts and Azure VMs will need to be in the same Azure location (East US, West US, etc.).
5. Obtain the Storage Account name and access key from the [Azure Portal] (https://manage.windowsazure.com/#Workspace/StorageExtension/storage). Click on 'Manage Keys' to view Storage account name and access key.
6. Specify the Storage account name and access key in the storageAccount and storageAccessKey fields.
7. Create a [Azure SSH Certificate](#azure-ssh-cert) if you will be using a Linux compute instance. Specify the path to the certificate pem file in the azure.ssh.pem field. If you used a password when creating the pem file, place the password in the azure.ssh.password field.

**Azure Account Settings**

**storageAccount:** Azure storage account must already exist. Storage account must be in same Azure location as compute servers (East US, West US, etc.). storageAccount name is obtained from the Storage section of the [Azure Portal] (https://manage.windowsazure.com/#Workspace/StorageExtension/storage).

**storageAccessKey:** Azure storage account access key. storageAccessKey is obtained from the Storage section of the [Azure Portal] (https://manage.windowsazure.com/#Workspace/StorageExtension/storage).

**managementCertificate:** See [Azure Management Certificates](#azure-manage-cert).

**subscriptionId:** The subscription ID of your Azure account obtained from the Administrators section of the [Azure Portal] (https://manage.windowsazure.com/#Workspace/AdminTasks/ListUsers).

**Azure Specific Settings**

**azure.location:** Location of storage account and Azure compute servers (East US, West US, etc.). Storage account and compute servers need to be in same location.

**azure.username:** The administrator username used to log into the Azure virtual machine. For Windows servers, this field is ignored and administrator is used for the username.

**azure.password:** The administrator password.


**azure.ssh.port:** The port to use for SSH on Linux servers.

**azure.ssh.pem:** The X509 certificate with a 2048-bit RSA keypair. Specify the path to this pem file. See [Azure x.509 SSH Certificates](#azure-ssh-cert).

**azure.ssh.pemPassword:** The password/pass phrase used when creating the pem file. See [Azure x.509 SSH Certificates](#azure-ssh-cert).

**azure.rdp.port:** The port to use for RDP on Windows servers.

<br>

<a name="azure-manage-cert"></a>
## Azure Management Certificates

#####Create an Azure Service Management certificate on Linux/Mac OSX:

1. Create rsa private key

	openssl genrsa -out management.key 2048

2. Create self signed certificate

	openssl req -new -key management.key -out management.csr

3. Create temp x509 pem file from rsa key and self signed certificate

	openssl x509 -req -days 3650 -in management.csr -signkey management.key -out temp.pem

4. Create management pem from temp pem file and rsa key file. This will be the managementCertificate file used by the compute client in pkgcloud.

	cat management.key temp.pem > management.pem. 
	

5. Create management pfx

	openssl pkcs12 -export -out management.pfx -in temp.pem -inkey management.key -name "My Certificate"

6. Create management cer. This will be the managementCertificate .cer file you need to upload to the [Management Certificates section](https://manage.windowsazure.com/#Workspace/AdminTasks/ListManagementCertificates) of the Azure portal. 

7. Secure files

	chmod 600 *.*

#####Create an Azure Service Management certificate from a .publishsettings file:

https://www.windowsazure.com/en-us/manage/linux/common-tasks/manage-certificates/

	
#####Create an Azure Service Management certificate on Windows:

http://msdn.microsoft.com/en-us/library/windowsazure/gg551722.aspx

<br>
<a name="azure-ssh-cert"></a>
## Azure x.509 SSH Certificates

#####Create an Azure x.509 SSH certificate on Linux/Mac OSX:

1. Create x.509 pem file and key file
	
	openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout myPrivateKey.key -out mycert.pem

2. Change the permissions on the private key and certificate for security.

	chmod 600 mycert.pem	
	chmod 600 myPrivateKey.key
	
3. Specify the path to mycert.pem in the azure.ssh.pem config property when creating an Azure pkgcloud compute client.

4. If you specified a password when creating the pem file, add the password to the azure.ssh.pemPassword config property when creating an Azure pkgcloud compute client.

5. When connecting with ssh to a running Azure compute server, specify the path to myPrivateKey.key.
 
	ssh -i  myPrivateKey.key -p <port> username@servicename.cloudapp.net

For more info: 

https://www.windowsazure.com/en-us/manage/linux/how-to-guides/ssh-into-linux/


* **new pkgcloud.storage.Client(options, callback)**

#### Author: [Nodejitsu](http://nodejitsu.com)
#### License: MIT