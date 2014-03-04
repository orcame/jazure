$(function () {
    Date.prototype.format = function (fmt) {
        var o = {
            "M+": this.getMonth() + 1,
            "d+": this.getDate(),
            "h+": this.getHours() % 12 == 0 ? 12 : this.getHours() % 12,
            "H+": this.getHours(),
            "m+": this.getMinutes(),
            "s+": this.getSeconds(),
            "q+": Math.floor((this.getMonth() + 3) / 3),
            "S": this.getMilliseconds()
        };
        var week = {
            "0": "\u65e5",
            "1": "\u4e00",
            "2": "\u4e8c",
            "3": "\u4e09",
            "4": "\u56db",
            "5": "\u4e94",
            "6": "\u516d"
        };
        if (/(y+)/.test(fmt)) {
            fmt = fmt.replace(RegExp.$1, (this.getFullYear() + "").substr(4 - RegExp.$1.length));
        }
        if (/(E+)/.test(fmt)) {
            fmt = fmt.replace(RegExp.$1, ((RegExp.$1.length > 1) ? (RegExp.$1.length > 2 ? "\u661f\u671f" : "\u5468") : "") + week[this.getDay() + ""]);
        }
        for (var k in o) {
            if (new RegExp("(" + k + ")").test(fmt)) {
                fmt = fmt.replace(RegExp.$1, (RegExp.$1.length == 1) ? (o[k]) : (("00" + o[k]).substr(("" + o[k]).length)));
            }
        }
        return fmt;
    };

    function readableSize(value) {
        var units = ["B", "KB", "MB", "GB", "TB", "PB"];
        if (typeof (value) == 'string') {
            value = parseInt(value);
        }
        for (var idx = 0; idx < units.length; idx++) {
            if (value < 1024) {
                return value.toFixed(2) + units[idx];
            }
            value = value / 1024;
        }
    };

    function readableDate(value) {
        var date = new Date(value);
        if (isNaN(date.getDate())) {
            return 'N/A';
        }
        return date.format('MM/dd/yyyy HH:mm');
    };

    function extensionName(value) {
        if (!value) {
            return '';
        }
        return value.substr(value.lastIndexOf('.') + 1).toLowerCase();
    };

    var extensions = {
        document: ['txt', 'pdf', 'doc', 'docx', 'xls', 'xlsx'],
        videos: ['rm', 'rmvb', 'wmv', 'avi', 'mp4'],
        pictures: ['png', 'jpg', 'jpeg', 'bmp']
    };

    function filterByExtension(blobs, extensions) {
        var len = blobs.length, list = [];
        for (var idx = 0; idx < len; idx++) {
            var ext = extensionName(blobs[idx].Name);
            if (extensions.indexOf(ext) != -1) {
                list.push(blobs[idx]);
            }
        }
        return list;
    };
    var je = {
        accountName: null,
        sharedKey: null,
        containerName: null,
        endpoint: 'core.chinacloudapi.cn',
        sas: null,
        wrapper: $('#page-wrapper'),
        btnAdd: $('#addFile'),
        messagePanel: $('.messages-dropdown'),
        message: $('.message-preview'),
        container: null,
        init: function () {
            if (this.accountName && this.sharedKey && this.containerName) {
                this.account = ja.storage.account(this.accountName, this.sharedKey, this.endpoint);
                this.container = this.account.getContainer(this.containerName);
            } else if (this.sas) {
                this.container = ja.storage.container(this.sas);
            }
        },
        getFileCatagory: function (fileName) {
            var ext = extensionName(fileName).toLowerCase();
            if (extensions.document.indexOf(ext) >= 0) {
                return 'document';
            } else if (extensions.videos.indexOf(ext) >= 0) {
                return 'video';
            } else if (extensions.pictures.indexOf(ext) >= 0) {
                return 'picture';
            }
            return 'other';
        },
        initEvents: function () {
            this.btnAdd.find('input[type="file"]').change(function () {
                var files = $(this).get(0).files;
                if (files && files.length > 0) {
                    var div = $('<div class="message-upload"/>').appendTo(je.message);
                    div.html('<div class="message-upload">'
                             + '       <div class="message-upload-file">' + files[0].name + '</div>'
                             + '       <div class="message-upload-status">'
                             + '           <div class="progress">'
                             + '               <div class="progress-bar" role="progressbar" aria-valuenow="60" aria-valuemin="0" aria-valuemax="100" style="width: 60%;">'
                             + '               </div>'
                             + '           </div>'
                             + '       </div>'
                             + '   </div>');
                    var bar = div.find('.progress-bar')
                    var badge = je.messagePanel.find('.badge');
                    badge.text(parseInt(badge.text(), 10) + 1)
                    blob = je.container.getBlob(files[0].name);
                    blob.upload(files[0], null, function (ev) {
                        var percent = ev.loaded / ev.total * 100;
                        bar.attr('aria-valuenow', percent).width(percent + '%');
                    }, function () {

                    }, function () {

                    });
                }
            });
            $('#btnSettings').click(function () {
                je.showSettings();
            });
            $('#btnRefresh').click(function () {
                je.getAllItems();
            });
        },
        showSettings: function () {
            $('#modal-wrapper').load('views/settings.html', function (html) {
                var settings = je.render(html);
                var t = $(this).html(settings);
                t.children().modal('toggle');

                t.find('#btnSettingSave').click(function () {
                    je.accountName = t.find('#settingAccountName').val();
                    je.sharedKey = t.find('#settingSharedKey').val();
                    je.containerName = t.find('#settingContainerName').val();
                    je.endpoint = t.find('#settingEndpoint').val();
                    je.sas = t.find('#settingSASUrl').val();
                    je.init();
                    je.getAllItems();
                    t.children().modal('toggle');
                })
            });
        },
        pickDocuments: function (blobs) {
            return filterByExtension(blobs, extensions.document)
        },
        pickPictures: function (blobs) {
            return filterByExtension(blobs, extensions.pictures);
        },
        pickVideos: function (blobs) {
            return filterByExtension(blobs, extensions.videos);
        },
        readableSize: readableSize,
        readableDate: readableDate,
        getAllItems: function () {
            this.container.children(function (data) {
                console.log(data);
                window.dir = data.directories[0];
                $('<div/>').load('views/allitems.html', function (html) {
                    var table = je.render(html, {
                        blobs: data.blobs,
                        directories: data.directories,
                        extension: extensionName
                    });
                    je.wrapper.empty().html(table).find('a[href="javascript:"]').click(function () {
                        var blobName = $(this).text();
                        var catalog = je.getFileCatagory(blobName);
                        switch (catalog) {
                            case "picture":
                                je.openImage(blobName);
                                break;
                            case "video":
                                je.openVideo(blobName);
                                break;
                            case "document":
                            case "other":
                            default:
                                je.openDocumentAndOthers(blobName);
                                break;

                        }
                    })
                    je.wrapper.find('.je-catalog').click(function () {
                        var catalog = $(this).attr('data-catalog');
                        je.filterList(catalog)
                    })
                    je.wrapper.find('#showAll').click(function () {
                        je.filterList();
                    })
                })
            });
        },
        filterList: function (catalog) {
            var table = $('.je-list'), label = $('#currentCatalog')
            if (catalog) {
                table.find('tbody tr').each(function () {
                    var blobName = $(this).find('a').text();
                    if (je.getFileCatagory(blobName) != catalog) {
                        $(this).hide();
                    } else {
                        $(this).show();
                    }
                    var fa = 'fa-';
                    switch (catalog) {
                        case 'document':
                            fa += 'th-list';
                            break;
                        case 'picture':
                            fa += 'picture-o'
                            break;
                        case 'video':
                            fa += 'video-camera';
                            break;
                        case 'other':
                        default:
                            fa += 'list';
                            break;
                    }
                    label.html('<i class="fa ' + fa + '"></i> ' + catalog.substr(0, 1).toUpperCase() + catalog.substr(1) + 's');
                });
            } else {
                table.find('tbody tr').show();
                label.html('<i class="fa fa-th"></i> All Items')
            }
        },
        openImage: function (blobName) {
            var blob = je.container.getBlob(blobName);
            $('#modal-wrapper').load('views/imageviewer.html', function (html) {
                var c = je.render(html, { blob: blob });
                var t = $(this).html(c);
                t.children().modal('toggle');
            });
        },
        openVideo: function (blobName) {
            var blob = je.container.getBlob(blobName);
            var win = window.open('views/videoplayer.html?file=' + encodeURIComponent(blob.Url), '_blank');
        },
        openDocumentAndOthers: function (blobName) {
            var blob = je.container.getBlob(blobName);
            blob.download();
        },
        render: function (html, content) {
            var re = /<%(.+?)%>/g, reExp = /(^( )?(if|for|else|switch|case|break|var|{|}))(.*)?/g, code = 'var r=[];\n', cursor = 0;
            if (content) {
                for (var n in content) {
                    code += 'var ' + n + '= this["' + n + '"];\n';
                }
            }
            var add = function (line, js) {
                js ? (code += line.match(reExp) ? line + '\n' : 'r.push(' + line + ');\n') :
                    (code += line != '' ? 'r.push("' + line.replace(/"/g, '\\"') + '");\n' : '');
                return add;
            }
            while (match = re.exec(html)) {
                add(html.slice(cursor, match.index))(match[1], true);
                cursor = match.index + match[0].length;
            }
            add(html.substr(cursor, html.length - cursor));
            code += 'return r.join("");';
            return new Function('', code.replace(/[\r\t\n]/g, '')).apply(content);
        }
    }
    window.je = je;
    je.sas = 'https://neeostorage.blob.core.chinacloudapi.cn/read-write?sv=2013-08-15&sr=c&sig=6EBfXjw7uikZmm9u3SdNQN5vrLE4IxvGNQd9MzvRYog%3D&st=2014-02-21T08%3A12%3A58Z&se=2036-12-15T16%3A12%3A58Z&sp=rwdl';
    je.init();
    je.initEvents();
    je.getAllItems();
})