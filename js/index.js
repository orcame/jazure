$(function(){
	var je={
		accountName:null,
		sharedKey:null,
		containerName:null,
		endpoint:'core.chinacloudapi.cn',
		sas:null,
		panel:$('#content'),
		menu:$('#menu'),
		container:null,
		init:function(){
			if(this.accountName && this.sharedKey && this.containerName){
				var account=ja.storage.account(this.accountName,this.sharedKey,this.endpoint);
				this.container=account.getContainer(this.containerName);
			}else if(this.sas){
				this.container=ja.container(sas);
			}
		},
		settings:function(){

		},
		createBox:function(item){
			var box=$('<div/>');
			box.append(item.Name);
			return box;
		},
		showList:function(list){
			var tb=je.panel.find('table tbody').empty();
			$.each(list,function(){
				var tr=$('<tr/>');
				tr.append('<td>'+this.Name+'</td>');
				tr.append('<td>'+this.Properties.Content_Length+'</td>');
				tr.append('<td>'+this.Properties.Last_Modified+'</td>');
				tb.append(tr);
			});
		},
		showBoxes:function(list){

		},
		listBlobs:function(){
			this.container.listBlobs(je.showList);
		}
	}
	window.je=je;
	je.accountName='neeostorage';
	je.sharedKey='byJtu9UFb3siM7KJneXw86XelJfYsDfp/3nmLAB+SJK7uxGy5N8qecbd0/UWzdRjCHYsBxQB1y3J9iFhN4lxYQ==';
	je.containerName='read-write';
	je.init();
	je.listBlobs();
})