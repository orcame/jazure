This is javascript sdk for azure storage.

To use this plugin, you need:
+ a modern browser that support HTML5.
+ an azure storage account
+ open the [CORS](http://blogs.msdn.com/b/windowsazurestorage/archive/2013/11/27/windows-azure-storage-release-introducing-cors-json-minute-metrics-and-more.aspx) of your storage account.
+ jquery(all version should be ok.)

<!--list end-->

	//notice ja is an alise of jAzure
	var container=ja.container(containerSas);
	var blob=container.getBlob('myblob');
	blob.upload(file,function(){
		//before upload.
	},progress:function(ev){
		//uploading...
	},success:function(data){
		//upload success.
	},error:function(){
		//upload error.
	});

##container

	var container = ja.container(sas);

Properties:  

Name|Default|Readonly|Description
---|---|---|---
sas|passed in by parameter|true|the sas url of the container

Functions:  

Name|Return|Async|Description
---|---|---|---
getBlob|blob|false|accored the passed in blobName and blobType, reurn a blob instance.
getBlockBlob|blob|false|return a block blob instance.
getPageBlob|blob|false|return a page blob instance.
listBlobs|null|true|get blob list under the container.

##blob

	var blob = container.getBlob(blobName,blobType)

Properties:  

Name|Default|Readonly|Description
---|---|---|---
name|passed in|true|the long name of the blob.
url|auto generated|true|the url of the blob.
type|passed in|true|the blob type(PageBlob/BlockBlob).
properties|null|false|the properties of the blob.
metadata|empty object|false|the metadata of the blob.

Functions:  

Name|Return|Async|Description
---|---|---|---
upload|null|true|upload the blob to azure storage server.
remove|null|true|delete the blob from azure storage server.
download|null|false|down the blob to local machine.
getProperties|null|true|get blob properties from server.
setProperties|null|true|set the blob properties(save to server).
getMetadata|null|true|get blob metadata from server.
setMetadata|null|true|set the blob metadata(save to server).