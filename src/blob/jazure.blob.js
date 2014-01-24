(function (jAzure, $, global) {
    var pageBlobType = 'PageBlob', blockBlobType = 'BlockBlob';
    var ja = jAzure;
    //containers
    var container = function (sas) {
        return new container.prototype.init(sas);
    };

    container.prototype.init = function (sas) {
        ja.defineReadonlyProperties(this, { sas: sas });
        return this;
    };
    container.prototype.init.prototype = container.prototype;
    $.extend(container.prototype, {
        listBlobs: function (options, success, error) {
            if (typeof (options) == "function") {
                success = options;
                error = success;
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
                var blobs = $.xml2json(data).Blobs.Blob;
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
            ja.ajax({ url: this.sas, tpe: 'GET', params: options, convertor: convertor, success: success, error: error });
        },
        getBlob: function (blobName, blobType) {
            if (!blobType) {
                blobType = blockBlobType;
            }
            if (blobType != pageBlobType && blobType != blockBlobType) {
                throw 'the blob type can only be ' + blockBlobType + ' or ' + pageBlobType + ', by default is ' + blockBlobType + '.';
            }
            var qidx = this.sas.indexOf("?");
            var url = this.sas.substring(0, qidx);
            url += '/' + blobName;
            url += this.sas.substring(qidx);
            var b = blob(url, blobType);
            return b;
        },
        getBlockBlob: function (blobName) {
            return this.getBlob(blobName, blockBlobType);
        },
        getPageBlob: function (blobName) {
            return this.getPageBlob(blobName, pageBlobType);
        }
    });

    jAzure.container = container;
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
            ja.defineReadonlyProperties(this, { url: url, type: type, name: name });
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
            frame.src = this.url;
        }, remove: function (success, error) {
            ja.ajax({
                url: this.url
                , type: 'DELETE'
                , success: success
                , error: error
            });
        }, setMetadata: function (metadata) {
            if (metadata) {
                ja.ajax({
                    url: this.url
                    , params: { comp: 'metadata' }
                    , type: 'PUT'
                    , before: function (xhr) {
                        for (n in metadata) {
                            xhr.setRequestHeader(metaPrefix + n, metadata[n]);
                        }
                    }, success: function (data, sta, xhr) {
                        console.log('setMetadata', data);
                    }
                })
            }
        }, setProperties: function (properties) {
            if (properties) {
                ja.ajax({
                    url: this.url
                    , params: { comp: 'properties' }
                    , type: 'PUT'
                    , before: function (xhr) {
                        for (n in propertiesMap) {
                            xhr.setRequestHeader(propertiesMap[n], properties[n]);
                        }
                    }, success: function (data, sta, xhr) {
                        console.log('setMetadata', data);
                    }
                })
            }
        }, getMetadata: function (success, error) {
            var t = this;
            ja.ajax({
                url: this.url
                , params: { comp: 'metadata' }
                , type: 'HEAD'
                , success: function (data, sta, xhr) {
                    t.Metadata = ja.getResponseHeaders(xhr, metaPrefix);
                    if (success) {
                        success.call(t, t.Metadata);
                    }
                }, error: error
            })
        }, getProperties: function (success, error) {
            var t = this;
            ja.ajax({
                url: this.url
                , type: 'HEAD'
                , success: function (data, sta, xhr) {
                    var p = {};
                    for (var n in propertiesMap) {
                        p[n] = xhr.getResponseHeader(propertiesMap[n]);
                    }
                    t.Properties = p;
                    if (success) {
                        success.call(t, t.Properties);
                    }
                }, error: error
            })
        }
    };

    blob.prototype.init.prototype = blob.prototype;

    var chche = {};

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
        this.content = cp.file.slice(this.pointer, this.pointer + ja.blockSize);
        this.id = btoa("block-" + pad(cp.blocks.length, 6)).replace(/=/g, 'a');
        this.size = this.content.size;
        this.loaded = 0;
    };
    block.prototype = {
        upload: function () {
            var t = this, reader = new FileReader(), cp = this.cp;
            reader.onloadend = function (ev) {
                if (ev.target.readyState == FileReader.DONE) {
                    var data = new Uint8Array(ev.target.result);
                    ja.ajax({
                        url: cp.blob.url,
                        type: 'PUT',
                        params: { comp: 'block', blockid: t.id },
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
                    });
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
            if (!this.blobQueue[blob.url]) {
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
                this.blobQueue[blob.url] = cp;
            }
        },
        hasBlob: function (blob) {
            return !!this.blobQueue[blob.url];
        },
        dequeueBlob: function (blob) {
            delete this.blobQueue[blob.url];
        },
        enqueueErrorBlocks: function (blob) {
            var cp = this.blobQueue[blob.url];
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
            var uri = cp.blob.url
            , data = []
            , len = cp.blocks.length;
            cp.commiting = true;
            data.push('<?xml version="1.0" encoding="utf-8"?><BlockList>');
            for (var i = 0; i < len; i++) {
                data.push('<Latest>' + cp.blocks[i].id + '</Latest>');
            }
            data.push('</BlockList>');
            ja.ajax({
                url: uri,
                type: 'PUT',
                params: { comp: 'blocklist' },
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
            });
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