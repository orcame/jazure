(function (jAzure, $, global) {
    var pageBlobType = 'PageBlob'
        , blockBlobType = 'BlockBlob'
        , ja = jAzure
        , storage = ja.storage
        , container = ja.storage.container
        , web = ja.storage.web;

    //extend container prototype
    $.extend(container.prototype, {
        listBlobs: function (options, success, error) {
            if (typeof (options) == "function") {
                error = success;
                success = options;
                options = null;
            }
            options = options || {};
            options.restype = 'container';
            options.comp = 'list';
            var t = this;
            var addBlob = function (list, blob) {
                var b = t.getBlob(blob.Name, blob.Properties.BlobType);
                b.Properties = blob.Properties;
                list.push(b);
            };
            var convertor = function (data) {
                var blobs = data.Blobs.Blob;
                console.log(blobs);
                var list = [];
                if ($.isArray(blobs)) {
                    var len = blobs.length;
                    for (var idx = 0; idx < len; idx++) {
                        addBlob(list, blobs[idx]);
                    }
                } else if (blobs) {//if the container has only one blob.
                    addBlob(list, blobs);
                }
                return list;
            };
            this.web.request(this.Url, 'GET', options, {
                convertor: convertor,
                success: success,
                error: error
            }).send();
        },
        getBlob: function (blobName, blobType) {
            if (!blobType) {
                blobType = blockBlobType;
            }
            if (blobType != pageBlobType && blobType != blockBlobType) {
                throw 'the blob type can only be ' + blockBlobType + ' or ' + pageBlobType + ', by default is ' + blockBlobType + '.';
            }
            var qidx = this.Url.indexOf("?");
            var url = '';
            if (qidx > 0) {
                this.Url.substring(0, qidx);
                url += '/' + blobName;
                url += this.Url.substring(qidx);
            } else {
                url = this.Url + '/' + blobName;
            }
            var b = blob(url, blobType);
            b.web = this.web;
            return b;
        },
        getBlockBlob: function (blobName) {
            return this.getBlob(blobName, blockBlobType);
        },
        getPageBlob: function (blobName) {
            return this.getPageBlob(blobName, pageBlobType);
        }
    });

    //blobs
    var blob = function (url, type) {
        return new blob.prototype.init(url, type);
    };
    var metaPrefix = 'x-ms-meta-';
    var propertiesMap = {
        'BlobType': 'x-ms-blob-type',
        'Cache_Control': 'Cache-Control',
        'Content_Disposition': 'Content-Disposition',
        'Content_Encoding': 'Content-Encoding',
        'Content_Language': 'Content-Language',
        'Content_Length': 'Content-Length',
        'Content_MD5': 'Content-MD5',
        'Content_Type': 'Content-Type',
        'Etag': 'Etag',
        'Last_Modified': 'Last-Modified',
        'LeaseState': 'x-ms-lease-state',
        'LeaseStatus': 'x-ms-lease-status'
    };
    blob.prototype = {
        init: function (url, type) {
            regex = new RegExp('http(s?)://[^/]*/[^/]*/([^?]*)', 'g');
            var match = regex.exec(url);
            if (!match) {
                throw "invalid blob url.";
            }
            var name = match[2];
            ja.defineReadonlyProperties(this, { Url: url, BlobType: type, Name: name });
            this.web = web();
            return this;
        },
        upload: function (file, before, progress, success, error) {
            if (!progress) {
                progress = before;
                success = progress;
                error = success;
            }
            else if (!success) {
                success = before;
                error = success;
            }
            uploader.enqueueBlob(this, file, before, progress, success, error);
            uploader.enqueueErrorBlocks(blob);
            uploader.upload();
        }, download: function () {
            var id = 'ja-blob-download-frame-';
            var frame = document.getElementById(id);
            if (frame == null) {
                frame = document.createElement('iframe');
                frame.id = id;
                frame.style.display = 'none';
                document.body.appendChild(frame);
            }
            frame.src = this.Url;
        }, 'delete': function (success, error) {
            this.web.request(this.Url, 'DELETE').send(success, error);
        }, setMetadata: function (metadata, success, error) {
            if (metadata) {
                var t = this;
                var headers = {};
                for (n in metadata) {
                    headers[metaPrefix + n] = metadata[n];
                };
                this.web.request(this.Url, 'PUT', { comp: 'metadata' }, {
                    headers: headers
                    , success: success
                    , error: error
                }).send();
            }
        }, setProperties: function (properties, success, error) {
            if (properties) {
                this.web.request(this.Url, 'PUT', { comp: 'properties' }, {
                    before: function (xhr) {
                        for (n in propertiesMap) {
                            xhr.setRequestHeader(propertiesMap[n], properties[n]);
                        }
                    }, success: success
                    , error: error
                }).send();
            }
        }, getMetadata: function (success, error) {
            var t = this;
            t.web.request(this.Url, 'GET', { comp: 'metadata' }, {
                success: function (data, sta, xhr) {
                    t.Metadata = ja.getResponseHeaders(xhr, metaPrefix);
                    if (success) {
                        success.call(t, t.Metadata);
                    }
                }, error: error
            }).send();
        }, getProperties: function (success, error) {
            var t = this;
            t.web.request(this.Url, 'HEAD', null, {
                success: function (data, sta, xhr) {
                    var p = {};
                    for (var n in propertiesMap) {
                        p[n] = xhr.getResponseHeader(propertiesMap[n]);
                    }
                    t.Properties = p;
                    if (success) {
                        success.call(t, t.Properties);
                    }
                }, error: error
            }).send();
        }
    };

    blob.prototype.init.prototype = blob.prototype;

    //used to create block id.
    function pad(number, length) {
        var str = '' + number;
        while (str.length < length) {
            str = '0' + str;
        }
        return str;
    };
    var block = function (cp) {
        this.cp = cp;
        this.pointer = cp.pointer;
        this.content = cp.file.slice(this.pointer, this.pointer + ja.storage.blockSize);
        this.id = btoa("block-" + pad(cp.blocks.length, 6)).replace(/=/g, 'a');
        this.size = this.content.size;
        this.loaded = 0;
    };
    block.prototype = {
        upload: function () {
            var t = this, reader = new FileReader(), cp = this.cp, web = cp.blob.web;
            reader.onloadend = function (ev) {
                if (ev.target.readyState == FileReader.DONE) {
                    var data = new Uint8Array(ev.target.result);
                    web.request(cp.blob.Url, 'PUT'
                        , { comp: 'block', blockid: t.id }
                        , {
                            data: data,
                            processData: false,
                            before: function (xhr) {
                                xhr.setRequestHeader('x-ms-blob-type', cp.blob.type);
                                if (!cp.send) {
                                    if (cp.before) {
                                        cp.before.apply(cp.blob, arguments);
                                    }
                                }
                                cp.send = true;
                            }, progress: function (ev) {
                                cp.loaded += (ev.loaded - t.loaded);
                                t.loaded = ev.loaded;
                                if (cp.progress) {
                                    cp.progress.call(cp.blob, { loaded: cp.loaded, total: cp.size });
                                }
                            }, success: function () {
                                if (cp.loaded == cp.size) {
                                    uploader.commit(cp);
                                }
                                uploader.threads--;
                                uploader.upload();
                            }, error: function () {
                                cp.loaded -= t.loaded;
                                cp.errorBlocks.push(t);
                                if (cp.error) {
                                    cp.error.apply(cp.blob, arguments);
                                }
                                uploader.threads--;
                                uploader.upload();
                            }
                        }).send();
                }
            }
            reader.readAsArrayBuffer(t.content);
        }
    };
    var uploader = {
        blobQueue: {},
        blockQueue: [],
        threads: 0,
        enqueueBlob: function (blob, file, before, progress, success, error) {
            if (!this.blobQueue[blob.Url]) {
                var cp = {};
                cp.blob = blob;
                cp.send = false;
                cp.pointer = 0;
                cp.file = file;
                cp.size = file.size;
                cp.loaded = 0;
                cp.type = file.type;
                cp.before = before;
                cp.progress = progress;
                cp.success = success;
                cp.error = error;
                cp.blocks = [];
                cp.errorBlocks = [];
                this.blobQueue[blob.Url] = cp;
            }
        },
        hasBlob: function (blob) {
            return !!this.blobQueue[blob.Url];
        },
        dequeueBlob: function (blob) {
            delete this.blobQueue[blob.Url];
        },
        enqueueErrorBlocks: function (blob) {
            var cp = this.blobQueue[blob.Url];
            if (cp) {
                var bk = cp.errorBlocks.shift();
                if (bk) {
                    this.blockQueue.push(bk);
                }
            }
        },
        enqueueAllErrorBlocks: function () {
            for (var n in this.blobQueue) {
                var cp = this.blobQueue[n];
                this.enQueueErrorBlocks(cp.blob);
            }
        },
        nextBlock: function () {
            for (key in this.blobQueue) {
                var cp = this.blobQueue[key];
                if (cp.pointer < cp.size) {
                    var bk = new block(cp);
                    cp.blocks.push(bk);
                    cp.pointer += bk.size;
                    return bk;
                }
            }
            return this.blockQueue.shift();
        }, upload: function () {
            this.commitAll();
            while (ja.maxThread == 0 || this.threads < ja.maxThread) {
                var block = this.nextBlock();
                if (block != null) {
                    block.upload();
                    this.threads++;
                } else {
                    break;
                }
            }
        }, commit: function (cp) {
            var uri = cp.blob.Url
            , data = []
            , len = cp.blocks.length
            , web = cp.blob.web;
            cp.commiting = true;
            data.push('<?xml version="1.0" encoding="utf-8"?><BlockList>');
            for (var i = 0; i < len; i++) {
                data.push('<Latest>' + cp.blocks[i].id + '</Latest>');
            }
            data.push('</BlockList>');
            web.request(uri, 'PUT', { comp: 'blocklist' }, {
                data: data.join(''),
                before: function (xhr) {
                    xhr.setRequestHeader('x-ms-blob-content-type', cp.type);
                }, success: function () {
                    if (cp.success) {
                        uploader.dequeueBlob(cp.blob);//remove the blob from the queue
                        cp.success.apply(cp.blob, arguments);
                    }
                }, error: function () {
                    cp.commiting = false;
                    if (cp.error) {
                        cp.error.apply(cp.blob, arguments);
                    }
                }
            }).send();
        }, commitAll: function () {
            for (n in this.pool) {
                var cp = this.pool[n];
                if (cp.loaded == cp.size && !cp.commiting) {
                    this.commit(cp);
                }
            }
        }
    }
})(jAzure, jQuery, window);